'use strict';

/**
 * BFF (Backend For Frontend) : sert l'appli Angular compilée et reste le SEUL
 * appelant les API Actuator du serveur CAS.
 *
 * Les identifiants HTTP Basic des API Actuator vivent ici, dans la configuration
 * serveur, jamais envoyés au navigateur. L'accès à /api/* exige une session
 * (cookie httpOnly, signé) ouverte uniquement après validation RÉELLE d'un
 * ticket CAS côté serveur (/bff/session) : un état falsifié côté navigateur
 * (sessionStorage) n'a aucune valeur de sécurité.
 *
 * CSRF : SameSite=Lax sur le cookie de session suffit (pas de jeton séparé) -
 * toutes les requêtes d'état (/api DELETE, /bff/logout) passent par fetch/XHR
 * same-site depuis Angular, jamais par un <form> POST classique ; Lax bloque
 * déjà le cookie sur les requêtes XHR/fetch cross-site, quelle que soit la
 * méthode.
 *
 * Ordre de montage dans `createApp` (il compte) : en-têtes de sécurité, session, point de santé
 * public, `/env.js`, routes `${config.prefixUrl}/bff/*`, relais `/api` (limitation de débit, session, contrôle du
 * profil, préparation de l'audit, relais), fichiers statiques, repli SPA, gestionnaire d'erreurs.
 *
 * Ce que le module ne fait PAS : il ne conserve aucun compte ni habilitation (le profil vient
 * des groupes de l'annuaire, voir roles.js), ne relaie que GET et DELETE vers les API Actuator, et ne
 * partage pas ses sessions entre instances (store mémoire, une seule instance).
 */
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const session = require('express-session');
const { DatabaseSync } = require('node:sqlite');
const { ADMIN, extractAttributeValues, resolveRole } = require('./roles');
const { createHealthCheck, healthHandler } = require('./health');
const { createRateLimiter, rateLimit } = require('./rate-limit');
const logger = require('./logger');
const { config } = require('node:process');

/** Nom du cookie de session BFF ; réutilisé à la déconnexion pour l'effacer. */
const SESSION_COOKIE = 'totp-admin-session';

/**
 * Extrait l'identifiant de l'utilisateur d'une réponse de validation de ticket CAS 3.0 (XML).
 * Le XML vient du serveur CAS (adresse configurée), jamais d'une entrée utilisateur : une
 * expression régulière suffit, sans analyseur XML. Seul un `authenticationSuccess` donne un nom.
 *
 * @param {string} xml corps de la réponse de `/p3/serviceValidate`
 * @returns {string|null} le contenu de `<cas:user>` sans espaces autour, ou null en cas d'échec
 */
function extractUsername(xml) {
  const match = /<cas:authenticationSuccess>[\s\S]*?<cas:user>([^<]+)<\/cas:user>/.exec(xml);
  return match ? match[1].trim() : null;
}

/**
 * Journal d'activité (qui a supprimé quel compte TOTP / appareil / session, et
 * quand) - stocké dans un fichier SQLite propre à cette appli.
 * `node:sqlite` est intégré à Node >= 22 (aucune dépendance native).
 *
 * Les API Actuator du serveur CAS s'authentifient toujours avec le même compte technique : le
 * serveur CAS ne peut donc pas savoir quel utilisateur a déclenché une suppression.
 * Le module BFF, lui, le sait (req.session.username, posé après validation du ticket CAS).
 *
 * @param {string} dbPath chemin du fichier SQLite (le dossier est créé au besoin), ou `:memory:` (tests)
 * @returns {{
 *   record: (actor: string, action: string, target?: string|null, detail?: string|null, timestamp?: string) => void,
 *   entries: () => object[],
 *   purge: (months: number, now?: Date) => number,
 *   ping: () => object[],
 *   close: () => void
 * }} `entries` renvoie au plus les 2000 entrées les plus récentes, la plus récente d'abord ;
 *   `purge` renvoie le nombre d'entrées supprimées
 */
function openAuditLog(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      target_display TEXT,
      detail TEXT
    )
  `);
  const insert = db.prepare('INSERT INTO audit_log (timestamp, actor, action, target, target_display, detail) VALUES (?, ?, ?, ?, ?, ?)');
  const list = db.prepare(
    'SELECT timestamp, actor, action, target, target_display, detail FROM audit_log ORDER BY id DESC LIMIT 2000',
  );
  const removeOlder = db.prepare('DELETE FROM audit_log WHERE timestamp < ?');
  return {
    record(actor, action, target, target_display, detail, timestamp = new Date().toISOString()) {
      insert.run(timestamp, actor, action, target || null, target_display || null, detail || null);
    },
    entries: () => list.all(),
    /**
     * Supprime les entrées plus anciennes que `months` mois (limitation de la conservation, RGPD).
     * Les horodatages sont en ISO 8601 UTC : la comparaison de chaînes suit l'ordre chronologique.
     */
    purge(months, now = new Date()) {
      // Même jour du mois, `months` mois plus tôt ; si ce jour n'existe pas (31 août - 6 mois = 31 février),
      // dernier jour du mois (28 ou 29 février) : sans cela, JavaScript déborderait sur le 3 mars.
      const limite = new Date(now);
      const jour = limite.getUTCDate();
      limite.setUTCDate(1);
      limite.setUTCMonth(limite.getUTCMonth() - months);
      const dernierJour = new Date(Date.UTC(limite.getUTCFullYear(), limite.getUTCMonth() + 1, 0)).getUTCDate();
      limite.setUTCDate(Math.min(jour, dernierJour));
      return Number(removeOlder.run(limite.toISOString()).changes);
    },
    /** Vérifie que la base répond et que la table existe (point de santé). */
    ping: () => db.prepare('SELECT 1 FROM audit_log LIMIT 1').all(),
    close: () => db.close(),
  };
}

/**
 * Prépare l'entrée d'audit d'une requête DELETE, sans l'écrire : elle n'est
 * journalisée que si les API actuator répondent un succès (voir `proxyRes`), sans quoi
 * une suppression qui échoue côté CAS apparaîtrait à tort comme réussie.
 * `principal` est passé en query string par Angular pour les sessions SSO (le
 * TGT seul ne permet pas de retrouver la cible), alors que le recordKey d'un
 * appareil de confiance commence par `<principal>@...`.
 *
 * Actions préparées : `DELETE_TOTP_ACCOUNT` (un compte, ou tous si aucune cible),
 * `REVOKE_TRUSTED_DEVICE`, `REVOKE_SSO_SESSION`. Une ressource inconnue n'est pas journalisée.
 * L'acteur est toujours l'agent de la session, jamais une valeur fournie par le client.
 *
 * @param {import('express').Request} req requête DELETE du relais (`req.path` relatif à `/api`)
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function prepareApiDeleteAudit(req, res, next) {
  if (req.method !== 'DELETE') {
    return next();
  }
  const actor = req.session.username;
  const [, resource, rawTarget] = req.path.split('/');

  let target = null;
  try {
    target = rawTarget ? decodeURIComponent(rawTarget) : null;
  } catch {
    // Chemin mal encodé : on ne bloque pas la requête, on ne journalise
    // simplement pas proprement sa cible.
    target = rawTarget || null;
  }

  if (resource === 'gauthCredentialRepository') {
    req._pendingAudit = target
      ? { actor, action: 'DELETE_TOTP_ACCOUNT', target }
      : { actor, action: 'DELETE_TOTP_ACCOUNT', target: null, detail: 'suppression en masse (tous les comptes)' };
  } else if (resource === 'multifactorTrustedDevices' && target) {
    const principal = typeof req.query.principal === 'string' ? req.query.principal : target.split('@')[0];
    req._pendingAudit = { actor, action: 'REVOKE_TRUSTED_DEVICE', target: principal };
  } else if (resource === 'ssoSessions' && target) {
    const principal = typeof req.query.principal === 'string' ? req.query.principal : null;
    req._pendingAudit = { actor, action: 'REVOKE_SSO_SESSION', target: principal };
  }
  return next();
}

/**
 * Champs sensibles d'un compte TOTP renvoyés par les API Actuator (secret partagé,
 * code de validation, codes de secours) : aucune page ne les affiche, ils ne
 * doivent donc jamais atteindre le navigateur (mémoire, cache, onglet Réseau).
 */
const SENSITIVE_TOTP_FIELDS = ['secretKey', 'validationCode', 'scratchCodes'];

/**
 * Retire les champs sensibles d'un compte TOTP ou d'une liste de comptes (modifie les objets en place).
 *
 * @param {object|object[]} payload réponse JSON décodée des API Actuator
 * @returns {object|object[]} la même structure, sans `SENSITIVE_TOTP_FIELDS`
 */
function stripSensitiveTotpFields(payload) {
  const strip = (account) => {
    if (account && typeof account === 'object') {
      for (const field of SENSITIVE_TOTP_FIELDS) {
        delete account[field];
      }
    }
    return account;
  };
  return Array.isArray(payload) ? payload.map(strip) : strip(payload);
}

/** Vrai pour une lecture (GET) des comptes TOTP : seules ces réponses sont filtrées par `stripSensitiveTotpFields`. */
function isTotpRead(req) {
  return req.method === 'GET' && req.path.split('/')[1] === 'gauthCredentialRepository';
}

/** Garde d'authentification : 401 tant que la session n'a pas été ouverte par `POST /bff/session`. */
function requireSession(req, res, next) {
  if (!req.session || !req.session.username) {
    return res.status(401).json({ error: 'non authentifié' });
  }
  return next();
}

/** Réserve une route au profil administrateur (403 sinon). À placer après requireSession. */
function requireAdmin(req, res, next) {
  if (req.session.role !== ADMIN) {
    return res.status(403).json({ error: 'droits insuffisants' });
  }
  return next();
}

/**
 * En-têtes de sécurité. CSP calée sur ce que charge réellement l'appli : aucun
 * script externe, aucune police tierce (Roboto et Material Icons sont
 * auto-hébergées), XHR same-origin.
 * 'unsafe-inline' sur style-src uniquement : requis par les <style> qu'Angular
 * injecte par composant (ViewEncapsulation), pas de nonce configuré au build.
 * `frame-ancestors 'none'` et X-Frame-Options DENY interdisent l'intégration dans un cadre
 * (clickjacking) ; le second couvre les navigateurs sans prise en charge de la CSP.
 * Posé avant tout autre middleware pour s'appliquer aussi aux erreurs et aux fichiers statiques.
 */
function securityHeaders(req, res, next) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; img-src 'self' data:; connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
}

/**
 * Construit l'application Express à partir d'une configuration (voir
 * config.js). Retourne aussi le journal d'activité, pour pouvoir l'inspecter
 * et le fermer (tests).
 *
 * @param {object} config configuration produite par `loadConfig` (config.js) ; les limites de débit
 *   absentes (`healthRateLimit`, `loginRateLimit`, `apiRateLimit`) prennent 30, 20 et 300 requêtes
 *   par minute et par IP, `trustProxy` absent vaut 0
 * @returns {{ app: import('express').Express, audit: ReturnType<typeof openAuditLog> }}
 */
function createApp(config) {
  const audit = openAuditLog(config.auditDbPath);
  const app = express();
  app.disable('x-powered-by');
  // Sans proxy déclaré, req.ip est l'adresse de la connexion ; avec N proxys de confiance, celle du client.
  app.set('trust proxy', config.trustProxy ?? 0);
  app.use(securityHeaders);

  // Le cookie ne contient que l'identifiant de session ; le nom d'agent et le profil restent côté
  // serveur. `saveUninitialized: false` : aucun cookie n'est émis avant l'ouverture d'une session.
  app.use(
    session({
      name: SESSION_COOKIE,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      // Store mémoire par défaut : suffisant pour une instance unique, mais
      // un redémarrage du module BFF invalide les sessions en cours.
      cookie: {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: 'lax',
        // Aligné sur cas.ticket.tgt.primary.max-time-to-live-in-seconds côté
        // CAS (8h) : la session BFF ne doit pas survivre au TGT qu'elle représente.
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  /**
   * Point de santé public (sans session, sans secret) pour l'orchestrateur ou la supervision.
   * Même contrat que Ma-Moulinette : { codeRetour: 'OK'|'KO', listMessage: [...] }, HTTP 200 / 503 / 429.
   * Déclaré avant le relais /api, qui exige une session.
   */
  app.get(
    '/api/public/healthcheck/status',
    healthHandler({
      check: createHealthCheck({ audit, casBaseUrl: config.casBaseUrl }),
      isAccepted: createRateLimiter(config.healthRateLimit ?? 30),
    }),
  );

  /** Config publique (non secrète) injectée dans la page - voir core/api-config.ts. */
  app.get('/env.js', (req, res) => {
    res.type('application/javascript').send(
      `window.__env = ${JSON.stringify({
        /** on injecte le prefix d'URL */
        prefixUrl: config.prefixUrl,
        casBaseUrl: config.casBaseUrlPublic,
        logoUrl: config.logoUrl,
        appAuthor: config.appAuthor,
        privacyController: config.privacyController,
        privacyDpoContact: config.privacyDpoContact,
        privacyLegalBasis: config.privacyLegalBasis,
        auditRetentionMonths: config.auditRetentionMonths,
        environment: config.environment,
      })};`,
    );
  });

  /**
   * Valide le ticket CAS côté serveur (jamais exposé au navigateur) et ouvre la session BFF.
   * Corps attendu : `{ ticket, service }` ; réponses : 200 `{ username, role }`, 400 (champ manquant),
   * 401 (ticket invalide), 403 (agent dans aucun groupe habilité), 502 (CAS injoignable).
   * La limitation de débit précède `express.json()` : une requête refusée n'est même pas analysée.
   */
  app.post(`${config.prefixUrl}/bff/session`, rateLimit(createRateLimiter(config.loginRateLimit ?? 20), `${config.prefixUrl}/bff/session`), express.json(), async (req, res) => {
    const { ticket, service } = req.body || {};
    if (!ticket || !service) {
      return res.status(400).json({ error: 'ticket et service requis' });
    }

    try {
      const url = `${config.casBaseUrl}/p3/serviceValidate?service=${encodeURIComponent(service)}&ticket=${encodeURIComponent(ticket)}`;
      const casResponse = await fetch(url);
      const casText = await casResponse.text();
      // Le statut HTTP n'est pas testé : seule la présence d'un `authenticationSuccess` valide le ticket.
      const username = extractUsername(casText);

      if (!username) {
        return res.status(401).json({ error: 'ticket invalide' });
      }

      // Profil déduit des groupes AD libérés par CAS. Sans groupe configuré (développement
      // seulement : la production exige ROLE_ADMIN_GROUPS), tout agent authentifié est administrateur.
      const groupes = { adminGroups: config.adminGroups ?? [], consultationGroups: config.consultationGroups ?? [] };
      const habilitationsActives = groupes.adminGroups.length > 0 || groupes.consultationGroups.length > 0;
      const groupesRecus = habilitationsActives ? extractAttributeValues(casText, config.roleAttribute || 'memberOf') : [];
      const role = habilitationsActives ? resolveRole(groupesRecus, groupes) : ADMIN;
      if (!role) {
        // Seul le NOMBRE de groupes est journalisé (0 = attribut non lu ou non libéré par CAS ; >0 = noms à comparer).
        logger.warn(`[bff] Agent authentifié mais habilité à aucun profil : ${username} (${groupesRecus.length} groupe(s) reçu(s))`);
        return res.status(403).json({ error: 'agent non habilité' });
      }

      req.session.username = username;
      req.session.role = role;
      return res.json({ username, role });
    } catch (err) {
      logger.error('[bff] Échec de validation du ticket CAS', err);
      return res.status(502).json({ error: 'CAS injoignable' });
    }
  });

  // Permet à Angular de retrouver l'agent et son profil après un rechargement de page.
  app.get(`${config.prefixUrl}/bff/session`, requireSession, (req, res) =>
    res.json({ username: req.session.username, role: req.session.role }),
  );

  // Détruit la session côté serveur puis efface le cookie ; idempotent (204 même sans session).
  // Ne déconnecte pas de CAS : la fin de session SSO relève du navigateur et de CAS.
  app.post(`${config.prefixUrl}/bff/logout`, (req, res) => {
    if (!req.session) {
      return res.status(204).end();
    }
    req.session.destroy(() => {
      res.clearCookie(SESSION_COOKIE);
      res.status(204).end();
    });
  });

  // Journal d'activité réservé au profil administrateur (403 pour la consultation).
  app.get(`${config.prefixUrl}/bff/audit-log`, requireSession, requireAdmin, (req, res) => res.json({ entries: audit.entries() }));

  // En-tête calculé une fois ; il ne quitte jamais le serveur (ajouté uniquement aux appels vers les API Actuator).
  const basicAuth = `Basic ${Buffer.from(`${config.actuatorUsername}:${config.actuatorPassword}`).toString('base64')}`;

  /**
   * Relais vers les API Actuator du serveur CAS : l'appli n'utilise que la lecture (GET) et la
   * suppression (DELETE) - tout autre verbe (ex. POST /gauthCredentialRepository/import)
   * est refusé plutôt que relayé. Les réponses sont de petits documents JSON, on
   * les lit en entier pour pouvoir journaliser et retirer les champs sensibles.
   *
   * Chaîne : limitation de débit, session obligatoire, refus de DELETE hors profil administrateur,
   * préparation de l'audit, puis relais. Le contrôle du profil précède le relais : une suppression
   * refusée ne part jamais vers CAS et n'est pas journalisée.
   */
  app.use('/api', rateLimit(createRateLimiter(config.apiRateLimit ?? 300), '/api'), requireSession, async (req, res, next) => {
    // Le profil consultation lit seulement : toute suppression exige le profil administrateur.
    if (req.method === 'DELETE' && req.session.role !== ADMIN) {
      return res.status(403).json({ error: 'droits insuffisants' });
    }
    return next();
  }, prepareApiDeleteAudit, async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      return res.status(405).set('Allow', 'GET, DELETE').json({ error: 'méthode non autorisée' });
    }

    let upstream;
    try {
      // `redirect: 'manual'` : une redirection des API Actuator n'est pas suivie (les identifiants Basic
      // ne doivent pas être renvoyés vers une autre adresse). Délai de 15 s pour ne pas bloquer la requête.
      upstream = await fetch(`${config.casActuatorBaseUrl}${req.url}`, {
        method: req.method,
        headers: { Authorization: basicAuth, Accept: req.headers.accept || 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      logger.error("[bff] Actuator CAS injoignable", err);
      return res.status(502).json({ error: 'CAS injoignable' });
    }

    let body = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'application/json';

    // Journalisation seulement après un succès (2xx) de l'API Actuator : voir prepareApiDeleteAudit.
    if (req._pendingAudit && upstream.status >= 200 && upstream.status < 300) {
      const { actor, action, target, target_display, detail } = req._pendingAudit;
      audit.record(actor, action, target, target_display, detail);
    }
    if (isTotpRead(req) && contentType.includes('json')) {
      try {
        body = Buffer.from(JSON.stringify(stripSensitiveTotpFields(JSON.parse(body.toString('utf8')))));
      } catch {
        // Corps non JSON (erreur CAS en HTML par ex.) : transmis tel quel.
      }
    }
    return res.status(upstream.status).type(contentType).send(body);
  });

  // Application Angular compilée, déclarée après /api et /bff pour qu'aucun fichier ne les masque.
  app.use(express.static(config.staticDir));
  // Fallback SPA Angular (/users/xxx, /deconnexion...) : renvoie index.html
  // pour toute route non reconnue. `app.use` sans motif : Express 5 n'accepte
  // plus le wildcard nu.
  app.use((req, res) => res.sendFile(path.join(config.staticDir, 'index.html')));

  // Filet de sécurité : une exception non prévue ne renvoie jamais de stack
  // trace au client, quel que soit NODE_ENV - message générique, détail dans
  // les logs serveur.
  app.use((err, req, res, next) => {
    // Erreur du client (corps JSON mal formé, trop gros…) : 4xx et simple avertissement ; le reste est une panne.
    const client = Number.isInteger(err.status) && err.status >= 400 && err.status < 500;
    if (client) {
      logger.warn('[bff] Requête invalide', err);
    } else {
      logger.error('[bff] Erreur non gérée', err);
    }
    if (res.headersSent) {
      return next(err);
    }
    res.status(client ? err.status : 500).json({ error: client ? 'Requête invalide' : 'Erreur interne' });
  });

  return { app, audit };
}

module.exports = { createApp, extractUsername };
