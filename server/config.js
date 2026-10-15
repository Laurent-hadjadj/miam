'use strict';

/**
 * Configuration du module BFF : lit les variables d'environnement une seule fois, au démarrage,
 * et en fait un objet que `createApp` (app.js) consomme tel quel. C'est le seul module qui lit
 * `process.env` pour la configuration (hors `LOG_LEVEL`, relu par logger.js).
 *
 * Garanties : les secrets n'ont jamais de vraie valeur par défaut, et en production le démarrage
 * est refusé s'ils manquent ou si aucun groupe administrateur n'est défini. Les durées et seuils
 * invalides (conservation du journal) sont rejetés plutôt que corrigés en silence.
 *
 * Ne fait PAS : aucun appel réseau (le serveur CAS n'est pas appelé ici), aucune lecture de fichier
 * `.env` (celle-ci relève de l'environnement d'exécution, voir proxy.conf.js pour `ng serve`).
 */

const path = require('node:path');
const { parseGroupList } = require('./roles');
const logger = require('./logger');

/** Valeur provisoire des secrets non renseignés ; sa présence après lecture signale un oubli. */
const PLACEHOLDER = 'a_changer';

/** Durée de conservation du journal d'activité : bornes de la politique RGPD (voir docs/conformite/rgpd.md). */
const RETENTION_MIN_MONTHS = 6;
const RETENTION_MAX_MONTHS = 12;

/**
 * Lit `AUDIT_RETENTION_MONTHS`. Une valeur hors bornes est une erreur (et non corrigée) : la durée
 * de conservation est un engagement RGPD, une faute de frappe ne doit pas la modifier sans bruit.
 *
 * @param {string|undefined} raw valeur brute de la variable
 * @returns {number} nombre de mois entier ; 12 (maximum) si la variable est absente ou vide
 * @throws {Error} si la valeur n'est pas un entier entre 6 et 12
 */
function parseRetentionMonths(raw) {
  if (raw === undefined || raw === '') {
    return RETENTION_MAX_MONTHS;
  }
  const months = Number(raw);
  if (!Number.isInteger(months) || months < RETENTION_MIN_MONTHS || months > RETENTION_MAX_MONTHS) {
    throw new Error(
      `AUDIT_RETENTION_MONTHS doit être un entier entre ${RETENTION_MIN_MONTHS} et ${RETENTION_MAX_MONTHS} (reçu : "${raw}").`,
    );
  }
  return months;
}

/**
 * Le contexte du CAS (`/sso`, `/cas`, `/user`, ou rien) est défini par `server.servlet.context-path`
 * dans l'application.yml du CAS : il n'existe donc qu'ici, dans CAS_BASE_URL (hôte + contexte).
 * Tout le reste en découle : l'API Actuator (`<CAS_BASE_URL>/actuator`) et l'adresse vue du navigateur
 * (le chemin de CAS_BASE_URL, précédé de CAS_PUBLIC_ORIGIN si le navigateur joint le CAS par un autre
 * hôte ou port que MIAM). `/sso` n'apparaît que dans cette valeur par défaut.
 */
const DEFAULT_CAS_BASE_URL = 'http://localhost:8080/sso';

/** Retire les « / » finaux : les adresses CAS sont toujours suivies d'un chemin qui commence par « / ». */
function trimTrailingSlashes(url) {
  return url.replace(/\/+$/, '');
}

/**
 * Chemin (contexte) d'une URL CAS : `http://hote:9000/cas` -> `/cas` ; `http://hote:9000` -> vide.
 * Exportée pour proxy.conf.js, qui en déduit la route CAS à relayer en développement.
 *
 * @param {string} casBaseUrl adresse du CAS (hôte et contexte)
 * @returns {string} le chemin sans « / » final, ou une chaîne vide s'il n'y a pas de contexte ou si l'adresse est invalide
 */
function casContextPath(casBaseUrl) {
  try {
    return trimTrailingSlashes(new URL(casBaseUrl).pathname);
  } catch {
    return '';
  }
}

/**
 * Construit la configuration du module BFF à partir des variables d'environnement.
 *
 * Les secrets (`SESSION_SECRET`, `ACTUATOR_USERNAME`, `ACTUATOR_PASSWORD`) n'ont volontairement
 * aucune vraie valeur par défaut : hors production un avertissement est émis, en production
 * (`NODE_ENV=production`, cas du conteneur) le démarrage est refusé tant qu'ils ne sont pas fixés.
 * Même règle pour `ROLE_ADMIN_GROUPS` : sans lui, personne ne pourrait supprimer ni lire le journal.
 *
 * @param {Record<string, string|undefined>} [env] variables d'environnement (injectable pour les tests)
 * @returns {object} configuration consommée par `createApp`
 * @throws {Error} en production si un secret ou `ROLE_ADMIN_GROUPS` manque, ou si
 *   `AUDIT_RETENTION_MONTHS` est invalide (quel que soit l'environnement)
 */
function loadConfig(env = process.env) {
  const casBaseUrl = trimTrailingSlashes(env.CAS_BASE_URL || DEFAULT_CAS_BASE_URL);
  const config = {
    port: Number(env.PORT) || 80,
    casBaseUrl,
    casActuatorBaseUrl: env.CAS_ACTUATOR_BASE_URL || `${casBaseUrl}/actuator`,
    casBaseUrlPublic:
      env.CAS_BASE_URL_PUBLIC || `${trimTrailingSlashes(env.CAS_PUBLIC_ORIGIN || '')}${casContextPath(casBaseUrl)}`,
    actuatorUsername: env.ACTUATOR_USERNAME || PLACEHOLDER,
    actuatorPassword: env.ACTUATOR_PASSWORD || PLACEHOLDER,
    sessionSecret: env.SESSION_SECRET || PLACEHOLDER,
    // Seule la valeur exacte « true » active l'attribut Secure du cookie de session (à activer derrière HTTPS ;
    // un cookie Secure n'est pas renvoyé par le navigateur en HTTP simple).
    cookieSecure: env.COOKIE_SECURE === 'true',
    logoUrl: env.LOGO_URL || '',
    appAuthor: env.APP_AUTHOR || '',
    // À défaut de APP_VERSION explicite, reprend la version de package.json.
    appVersion: env.APP_VERSION || require('../package.json').version,
    // Sortie de `ng build` servie par le module, relative à l'emplacement de ce fichier.
    staticDir: path.join(__dirname, '..', 'dist', 'miam', 'browser'),
    // Pour les trois limites de débit et TRUST_PROXY, `Number(...) || défaut` : une valeur absente, non
    // numérique ou nulle donne la valeur par défaut. Les limites ne peuvent donc pas être désactivées par 0.
    // Requêtes par minute et par IP sur /api/public/healthcheck/status (429 au-delà).
    healthRateLimit: Number(env.HEALTHCHECK_RATE_LIMIT) || 30,
    // Requêtes par minute et par IP sur l'ouverture de session (/bff/session) et sur le relais /api.
    loginRateLimit: Number(env.LOGIN_RATE_LIMIT) || 20,
    apiRateLimit: Number(env.API_RATE_LIMIT) || 300,
    // Nombre de proxys de confiance devant le module (0 = aucun : l'IP lue est celle de la connexion).
    // Derrière un reverse proxy, mettre 1, sinon tous les agents partagent la même limite.
    trustProxy: Number(env.TRUST_PROXY) || 0,
    // Habilitations : groupes (valeur de l'attribut roleAttribute libéré par CAS, nom court ou DN).
    roleAttribute: env.ROLE_ATTRIBUTE || 'memberOf',
    adminGroups: parseGroupList(env.ROLE_ADMIN_GROUPS),
    consultationGroups: parseGroupList(env.ROLE_CONSULT_GROUPS),
    // Informations RGPD affichées par la page /informations (vides = formulations neutres).
    privacyController: env.PRIVACY_CONTROLLER || '',
    privacyDpoContact: env.PRIVACY_DPO_CONTACT || '',
    privacyLegalBasis: env.PRIVACY_LEGAL_BASIS || '',
    auditRetentionMonths: parseRetentionMonths(env.AUDIT_RETENTION_MONTHS),
    // Fichier SQLite du journal d'activité ; en conteneur, le placer sur un volume pour qu'il survive aux redémarrages.
    auditDbPath: env.AUDIT_DB_PATH || path.join(__dirname, 'data', 'audit.db'),
  };

  // Un secret resté à la valeur provisoire est traité comme absent.
  const missing = [
    ['SESSION_SECRET', config.sessionSecret],
    ['ACTUATOR_USERNAME', config.actuatorUsername],
    ['ACTUATOR_PASSWORD', config.actuatorPassword],
  ]
    .filter(([, value]) => value === PLACEHOLDER)
    .map(([name]) => name);

  if (missing.length > 0) {
    const message = `Variables non définies (valeur par défaut "${PLACEHOLDER}") : ${missing.join(', ')}`;
    if (env.NODE_ENV === 'production') {
      throw new Error(`${message}. Démarrage refusé en production.`);
    }
    logger.warn(`[bff] ${message} - acceptable en local uniquement (voir .env.example).`);
  }

  if (config.adminGroups.length === 0) {
    const message = 'ROLE_ADMIN_GROUPS non défini : aucun agent ne pourrait supprimer ni consulter le journal';
    if (env.NODE_ENV === 'production') {
      throw new Error(`${message}. Démarrage refusé en production.`);
    }
    logger.warn(`[bff] ${message}. Hors production, tout agent authentifié est administrateur.`);
  }

  return config;
}

module.exports = { loadConfig, casContextPath };
