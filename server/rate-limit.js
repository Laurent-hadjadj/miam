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
 * Limitation de débit en mémoire : une instance unique du module BFF suffit.
 * Fenêtre fixe d'une minute ; le compteur est remis à zéro à chaque fenêtre,
 * ce qui borne aussi la mémoire utilisée.
 *
 * Fenêtre fixe et non glissante : un client peut donc enchaîner jusqu'à 2 x limite requêtes à
 * cheval sur deux fenêtres. C'est acceptable pour l'objectif (freiner un abus, pas facturer).
 * Les compteurs ne sont pas partagés entre instances et disparaissent au redémarrage.
 */

const logger = require('./logger');

/** Durée de la fenêtre (une minute) ; sert aussi à la valeur de `Retry-After`, en secondes. */
const RATE_WINDOW_MS = 60_000;

/**
 * Crée un compteur par clé (en pratique l'adresse IP) sur la fenêtre courante.
 *
 * @param {number} limit requêtes acceptées par clé et par fenêtre
 * @param {() => number} [now] horloge injectable (tests)
 * @returns {(key: string) => boolean} true tant que la clé reste sous la limite. Chaque appel compte,
 *   y compris ceux qui sont refusés ; la fenêtre est vérifiée à l'appel (pas de minuteur)
 * @example
 * const isAccepted = createRateLimiter(2);
 * isAccepted('10.0.0.1'); // true
 * isAccepted('10.0.0.1'); // true
 * isAccepted('10.0.0.1'); // false jusqu'à la fenêtre suivante
 */
function createRateLimiter(limit, now = Date.now) {
  let windowStart = now();
  let hits = new Map();
  return function isAccepted(key) {
    if (now() - windowStart >= RATE_WINDOW_MS) {
      windowStart = now();
      hits = new Map();
    }
    const count = (hits.get(key) || 0) + 1;
    hits.set(key, count);
    return count <= limit;
  };
}

/**
 * Middleware Express : 429 + en-tête Retry-After au-delà de la limite.
 * La clé est l'adresse IP (voir TRUST_PROXY pour qu'elle soit celle du client derrière un proxy) ;
 * sans cela, derrière un reverse proxy, tous les agents partageraient la même limite. Le journal ne
 * garde que le nom de la route : l'adresse IP, donnée personnelle, n'y figure pas.
 * `Retry-After` vaut toujours la durée entière de la fenêtre (60 s), pas le temps restant.
 *
 * @param {(key: string) => boolean} isAccepted
 * @param {string} name nom de la route limitée, pour le journal (jamais de donnée personnelle)
 */
function rateLimit(isAccepted, name) {
  return (req, res, next) => {
    if (isAccepted(req.ip || 'anonymous')) {
      return next();
    }
    logger.warn(`[bff] limite de débit dépassée sur ${name}`);
    res.set('Retry-After', String(RATE_WINDOW_MS / 1000));
    return res.status(429).json({ error: 'trop de requêtes, veuillez réessayer dans une minute' });
  };
}

module.exports = { createRateLimiter, rateLimit, RATE_WINDOW_MS };
