'use strict';

/**
 *  Ma-Moulinette - MIAM
 *  --------------
 *  Copyright (c) 2015-2026.
 *  Laurent HADJADJ <laurent_h@me.com>.
 *  Licensed Creative Common  CC-BY-NC-SA 4.0.
 *  ---
 *  Vous pouvez obtenir une copie de la licence à l'adresse suivante :
 *  http://creativecommons.org/licenses/by-nc-sa/4.0/
 */

/**
 * Point de santé du module BFF, sur le modèle du HealthCheckService de Ma-Moulinette :
 * liste d'erreurs vide = OK, résultat mis en cache quelques secondes pour qu'un
 * orchestrateur qui interroge souvent ne déclenche pas une vérification à chaque appel.
 *
 * Deux dépendances sont vérifiées : le journal d'activité (SQLite) et CAS (joignable).
 *
 * Le point de santé est public (sans session) : les messages renvoyés restent donc génériques
 * (aucun nom d'hôte, chemin ni pile d'appels) ; le détail technique va au journal du serveur.
 * Il est protégé par la limitation de débit de rate-limit.js, que ce module ré-exporte pour
 * que app.js et les tests n'aient qu'un point d'entrée.
 *
 * Ne fait PAS : aucune authentification auprès de CAS (seule la page publique /login est
 * sollicitée), aucune vérification des API Actuator ni des identifiants techniques.
 */

/** Durée de validité du résultat en cache : une supervision fréquente ne multiplie pas les appels à CAS. */
const CACHE_TTL_MS = 5_000;
/** Délai maximal d'attente du serveur CAS ; au-delà, CAS est déclaré injoignable. */
const CAS_TIMEOUT_MS = 3_000;
const { createRateLimiter } = require('./rate-limit');
const logger = require('./logger');

/**
 * @param {{ audit: { ping: () => void }, casBaseUrl: string, now?: () => number }} deps
 * @returns {() => Promise<string[]>} liste de messages d'erreur (vide si tout va bien)
 *
 * Le résultat, succès comme échec, est conservé `CACHE_TTL_MS` ms (5 s) ; l'horloge `now` est
 * injectable pour tester l'expiration sans attendre. Les deux vérifications sont enchaînées,
 * et une panne de l'une n'empêche pas l'autre : toutes les erreurs sont remontées ensemble.
 */
function createHealthCheck({ audit, casBaseUrl, now = Date.now }) {
  let cached = null;

  async function run() {
    const errors = [];

    try {
      audit.ping();
    } catch (err) {
      logger.error('[health] Journal d\'activité indisponible', err);
      errors.push('[HealthCheck] ❌ Le journal d\'activité (SQLite) est indisponible');
    }

    try {
      // Toute réponse HTTP (même une redirection ou un 4xx) prouve que CAS répond ; seule une
      // erreur 5xx ou réseau est un défaut. /login est public, aucun identifiant n'est envoyé.
      const res = await fetch(`${casBaseUrl}/login`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(CAS_TIMEOUT_MS),
      });
      if (res.status >= 500) {
        errors.push(`[HealthCheck] ❌ CAS répond en erreur (HTTP ${res.status})`);
      }
    } catch (err) {
      logger.error('[health] CAS injoignable', err);
      errors.push('[HealthCheck] ❌ CAS est injoignable');
    }

    return errors;
  }

  return async function check() {
    if (cached && cached.expires > now()) {
      return cached.errors;
    }
    const errors = await run();
    cached = { errors, expires: now() + CACHE_TTL_MS };
    return errors;
  };
}

/**
 * Route Express : GET /api/public/healthcheck/status -> { codeRetour, listMessage }.
 * Statuts : 200 (OK), 503 (au moins une dépendance en défaut), 429 (limite de débit dépassée).
 * `Cache-Control: no-store` est posé sur toutes les réponses : un état de santé ne doit jamais
 * être servi par un cache intermédiaire. La limite est contrôlée avant la vérification, pour
 * qu'un client refusé ne déclenche aucun appel à CAS.
 *
 * @param {{ check: () => Promise<string[]>, isAccepted: (key: string) => boolean }} deps
 *   `check` vient de `createHealthCheck`, `isAccepted` de `createRateLimiter`
 */
function healthHandler({ check, isAccepted }) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!isAccepted(req.ip || 'anonymous')) {
      logger.warn(`[health] nombre de tentatives dépassé (${req.ip})`);
      return res.status(429).json({
        codeRetour: 'KO',
        listMessage: ['nombre de tentatives dépassé, veuillez réessayer plus tard.'],
      });
    }
    const errors = await check();
    return res.status(errors.length === 0 ? 200 : 503).json({
      codeRetour: errors.length === 0 ? 'OK' : 'KO',
      listMessage: errors,
    });
  };
}

module.exports = { createHealthCheck, createRateLimiter, healthHandler };
