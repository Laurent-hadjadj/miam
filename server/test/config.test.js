'use strict';

/**
 * Tests de config.js : `loadConfig` reçoit un objet d'environnement fabriqué (jamais `process.env`),
 * ce qui isole chaque cas.
 *
 * Ce que le fichier vérifie : lecture et valeurs par défaut des variables, refus de démarrer en
 * production sans secret ou sans groupe administrateur (simple avertissement hors production),
 * bornes de la durée de conservation du journal (6 à 12 mois), lecture des groupes d'habilitation,
 * et dérivation des API Actuator et de l'adresse publique de CAS depuis `CAS_BASE_URL`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../config');

// Environnement minimal valide en production : les trois secrets et au moins un groupe administrateur.
const SECRETS = {
  SESSION_SECRET: 's',
  ACTUATOR_USERNAME: 'u',
  ACTUATOR_PASSWORD: 'p',
  ROLE_ADMIN_GROUPS: 'GRP_MIAM_ADMIN',
};

test('lit la configuration depuis les variables d\'environnement', () => {
  const config = loadConfig({
    ...SECRETS,
    PORT: '8080',
    CAS_BASE_URL: 'http://cas/sso',
    COOKIE_SECURE: 'true',
    APP_VERSION: '2.0.0',
  });
  assert.equal(config.port, 8080);
  assert.equal(config.casBaseUrl, 'http://cas/sso');
  assert.equal(config.cookieSecure, true);
  assert.equal(config.appVersion, '2.0.0');
  assert.equal(config.sessionSecret, 's');
});

test('valeurs par défaut non secrètes : port 80, CAS local, cookie non sécurisé', () => {
  const config = loadConfig({ ...SECRETS });
  assert.equal(config.port, 80);
  assert.equal(config.casActuatorBaseUrl, 'http://localhost:8080/sso/actuator');
  assert.equal(config.casBaseUrlPublic, '/sso');
  assert.equal(config.cookieSecure, false);
  assert.match(config.appVersion, /^\d+\.\d+\.\d+/);
});

test('en production, refuse de démarrer sans les secrets', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production' }),
    /SESSION_SECRET, ACTUATOR_USERNAME, ACTUATOR_PASSWORD/,
  );
  assert.throws(() => loadConfig({ NODE_ENV: 'production', ...SECRETS, ACTUATOR_PASSWORD: 'a_changer' }), /ACTUATOR_PASSWORD/);
});

test('en production, démarre dès que les secrets sont fixés', () => {
  assert.doesNotThrow(() => loadConfig({ NODE_ENV: 'production', ...SECRETS }));
});

test('hors production, un secret manquant n\'empêche pas le démarrage (avertissement seulement)', () => {
  // Capture des avertissements : le journal écrit sur console.warn, restauré dans le `finally`.
  const warn = console.warn;
  const messages = [];
  console.warn = (message) => messages.push(message);
  try {
    assert.doesNotThrow(() => loadConfig({}));
    assert.ok(messages.some((m) => /Variables non définies/.test(m)));
  } finally {
    console.warn = warn;
  }
  assert.match(messages[0], /SESSION_SECRET/);
  assert.ok(messages.some((m) => /ROLE_ADMIN_GROUPS/.test(m)), 'avertissement sur les habilitations');
});

test('conservation du journal : 12 mois par défaut, 6 à 12 mois acceptés', () => {
  assert.equal(loadConfig({ ...SECRETS }).auditRetentionMonths, 12);
  assert.equal(loadConfig({ ...SECRETS, AUDIT_RETENTION_MONTHS: '' }).auditRetentionMonths, 12);
  assert.equal(loadConfig({ ...SECRETS, AUDIT_RETENTION_MONTHS: '6' }).auditRetentionMonths, 6);
  assert.equal(loadConfig({ ...SECRETS, AUDIT_RETENTION_MONTHS: '9' }).auditRetentionMonths, 9);
});

test('conservation du journal : hors de 6 à 12 mois ou non entier, le démarrage est refusé', () => {
  for (const valeur of ['5', '13', '0', '-1', '7.5', 'abc']) {
    assert.throws(() => loadConfig({ ...SECRETS, AUDIT_RETENTION_MONTHS: valeur }), /AUDIT_RETENTION_MONTHS/, valeur);
  }
});

test('habilitations : groupes lus (noms courts, casse ignorée), attribut memberOf par défaut', () => {
  const config = loadConfig({ ...SECRETS, ROLE_ADMIN_GROUPS: 'GRP_A, Grp_B', ROLE_CONSULT_GROUPS: 'GRP_LECTURE' });
  assert.deepEqual(config.adminGroups, ['grp_a', 'grp_b']);
  assert.deepEqual(config.consultationGroups, ['grp_lecture']);
  assert.equal(config.roleAttribute, 'memberOf');
  assert.equal(loadConfig({ ...SECRETS, ROLE_ATTRIBUTE: 'groupes' }).roleAttribute, 'groupes');
});

test('habilitations : en production, sans ROLE_ADMIN_GROUPS le démarrage est refusé', () => {
  // Déstructuration pour retirer ROLE_ADMIN_GROUPS tout en gardant les trois secrets.
  const { ROLE_ADMIN_GROUPS, ...sansGroupes } = SECRETS;
  assert.throws(() => loadConfig({ ...sansGroupes, NODE_ENV: 'production' }), /ROLE_ADMIN_GROUPS/);
  assert.deepEqual(loadConfig(sansGroupes).adminGroups, [], 'hors production : avertissement seulement');
});

test('contexte CAS : tout découle de CAS_BASE_URL (/cas, /user, aucun contexte), actuator et adresse publique comprises', () => {
  const cas = loadConfig({ ...SECRETS, CAS_BASE_URL: 'http://hote:9000/cas/' });
  assert.equal(cas.casBaseUrl, 'http://hote:9000/cas', 'barre finale retirée');
  assert.equal(cas.casActuatorBaseUrl, 'http://hote:9000/cas/actuator');
  assert.equal(cas.casBaseUrlPublic, '/cas');

  const user = loadConfig({ ...SECRETS, CAS_BASE_URL: 'http://hote:9000/user' });
  assert.equal(user.casActuatorBaseUrl, 'http://hote:9000/user/actuator');
  assert.equal(user.casBaseUrlPublic, '/user');

  const racine = loadConfig({ ...SECRETS, CAS_BASE_URL: 'http://hote:9000' });
  assert.equal(racine.casActuatorBaseUrl, 'http://hote:9000/actuator');
  assert.equal(racine.casBaseUrlPublic, '', 'CAS à la racine : aucun contexte');

  const direct = loadConfig({ ...SECRETS, CAS_BASE_URL: 'http://interne:9000/cas', CAS_PUBLIC_ORIGIN: 'http://hote:9000/' });
  assert.equal(direct.casBaseUrlPublic, 'http://hote:9000/cas', 'origine publique + contexte de CAS_BASE_URL');

  const explicite = loadConfig({
    ...SECRETS,
    CAS_BASE_URL: 'http://interne:9000/cas',
    CAS_ACTUATOR_BASE_URL: 'http://interne:9001/gestion',
    CAS_BASE_URL_PUBLIC: 'https://sso.exemple.fr/cas',
  });
  assert.equal(explicite.casActuatorBaseUrl, 'http://interne:9001/gestion', 'une valeur explicite l\'emporte');
  assert.equal(explicite.casBaseUrlPublic, 'https://sso.exemple.fr/cas');
});

test('ENVIRONMENT : DEV par défaut, surcharge possible', () => {
  assert.equal(loadConfig({ ...SECRETS }).environment, 'DEV');
  assert.equal(loadConfig({ ...SECRETS, ENVIRONMENT: 'INT' }).environment, 'INT');
  assert.equal(loadConfig({ ...SECRETS, ENVIRONMENT: 'rec' }).environment, 'REC');
  assert.equal(loadConfig({ ...SECRETS, ENVIRONMENT: 'prd' }).environment, 'PRD');
});
