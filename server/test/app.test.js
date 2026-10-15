'use strict';

/**
 * Tests d'intégration de app.js : le module BFF est démarré (port éphémère, base SQLite
 * en mémoire) face à un faux CAS HTTP local qui joue la validation de ticket et l'API Actuator. Les
 * requêtes passent par `fetch`, comme le ferait Angular.
 *
 * Ce que le fichier vérifie : en-têtes de sécurité et configuration publique (/env.js), ouverture et
 * fermeture de session, refus sans session, relais restreint à GET et DELETE avec identifiants
 * côté serveur, retrait des secrets TOTP, journal d'activité (actions tracées, échecs non tracés,
 * purge de conservation), habilitations (administrateur, consultation, hors groupes), point de santé,
 * limitation de débit, et gestion des erreurs sans fuite (corps mal formé, CAS ou actuator injoignables).
 *
 * Il ne vérifie pas les détails de roles.js, config.js, health.js ni logger.js, couverts par leurs
 * propres fichiers de test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, extractUsername } = require('../app');

// Contexte CAS volontairement différent de /sso : rien dans le module BFF ne doit en dépendre.
const CAS_CTX = '/identite';

/**
 * Faux CAS : validation de ticket + actuator. Enregistre ce qu'il reçoit.
 *
 * Tickets reconnus : `ST-ok` (groupe administrateur), `ST-lecture` (groupe consultation), `ST-aucun`
 * (groupe sans habilitation) ; tout autre ticket est rejeté. Un chemin contenant `/fail` répond 500 ;
 * les chemins `gauthCredentialRepository` renvoient un compte TOTP avec ses champs secrets, pour
 * vérifier que le BFF les retire ; les autres chemins renvoient une liste vide.
 *
 * @returns {Promise<{ server: import('node:http').Server, received: object[], port: number }>}
 */
function startFakeCas() {
  const received = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fake');
    received.push({ method: req.method, path: url.pathname, authorization: req.headers.authorization });

    if (url.pathname === `${CAS_CTX}/p3/serviceValidate`) {
      res.setHeader('Content-Type', 'text/xml');
      const groupesParTicket = {
        'ST-ok': ['CN=GRP_MIAM_ADMIN,OU=Groupes,DC=exemple,DC=fr'],
        'ST-lecture': ['CN=GRP_MIAM_CONSULT,OU=Groupes,DC=exemple,DC=fr'],
        'ST-aucun': ['CN=GRP_AUTRE,OU=Groupes,DC=exemple,DC=fr'],
      };
      const groupes = groupesParTicket[url.searchParams.get('ticket')];
      if (groupes) {
        const attributs = groupes.map((g) => `<cas:memberOf>${g}</cas:memberOf>`).join('');
        return res.end(
          '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationSuccess>' +
            `<cas:user>alice</cas:user><cas:attributes>${attributs}</cas:attributes>` +
            '</cas:authenticationSuccess></cas:serviceResponse>',
        );
      }
      return res.end(
        '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationFailure code="INVALID_TICKET"/></cas:serviceResponse>',
      );
    }
    if (url.pathname.includes('/fail')) {
      res.statusCode = 500;
      return res.end('{}');
    }
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/gauthCredentialRepository/alice') || url.pathname.endsWith('/gauthCredentialRepository')) {
      return res.end(
        JSON.stringify([{ id: 1, username: 'alice', name: 'Poste', secretKey: 'SECRET', validationCode: 123456, scratchCodes: [1, 2], registrationDate: null }]),
      );
    }
    res.end('[]');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, received, port: server.address().port }));
  });
}

/**
 * Démarre un module BFF de test relié à un faux CAS.
 *
 * Le client `request` conserve le cookie de session entre les appels (comme un navigateur) ;
 * `redirect: 'manual'` laisse voir les redirections au lieu de les suivre. `stop()` ferme tout et
 * supprime le dossier statique temporaire : à appeler dans un `finally`.
 *
 * @param {object} [overrides] valeurs de configuration qui remplacent celles par défaut du test
 */
async function startBff(overrides = {}) {
  const cas = await startFakeCas();
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miam-static-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<html>SPA</html>');
  const casUrl = `http://127.0.0.1:${cas.port}`;
  const { app, audit } = createApp({
    casActuatorBaseUrl: `${casUrl}${CAS_CTX}/actuator`,
    casBaseUrl: `${casUrl}${CAS_CTX}`,
    casBaseUrlPublic: CAS_CTX,
    actuatorUsername: 'svc-actuator',
    actuatorPassword: 'svc-secret',
    sessionSecret: 'test-secret',
    cookieSecure: false,
    logoUrl: 'logo.svg',
    appAuthor: 'Auteur',
    appVersion: '9.9.9',
    staticDir,
    auditDbPath: ':memory:',
    ...overrides,
  });
  const bff = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  const base = `http://127.0.0.1:${bff.address().port}`;
  let cookie = '';

  const request = async (method, url, body) => {
    const response = await fetch(base + url, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const setCookie = response.headers.getSetCookie();
    if (setCookie.length > 0) {
      cookie = setCookie[0].split(';')[0];
    }
    return response;
  };

  return {
    request,
    baseUrl: base,
    cas,
    audit,
    login: (ticket = 'ST-ok') => request('POST', '/bff/session', { ticket, service: 'http://app/' }),
    stop: async () => {
      await new Promise((resolve) => bff.close(resolve));
      await new Promise((resolve) => cas.server.close(resolve));
      audit.close();
      fs.rmSync(staticDir, { recursive: true, force: true });
    },
  };
}

test('extractUsername lit le <cas:user> d\'une réponse de succès uniquement', () => {
  assert.equal(extractUsername('<cas:authenticationSuccess><cas:user> bob </cas:user></cas:authenticationSuccess>'), 'bob');
  assert.equal(extractUsername('<cas:authenticationFailure code="INVALID_TICKET"/>'), null);
});

test('en-têtes de sécurité posés, X-Powered-By absent', async () => {
  const bff = await startBff();
  try {
    const response = await bff.request('GET', '/env.js');
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    assert.doesNotMatch(response.headers.get('content-security-policy'), /https?:/, 'aucune origine tierce autorisée par la CSP (polices auto-hébergées)');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
  } finally {
    await bff.stop();
  }
});

test('/env.js expose uniquement la configuration publique', async () => {
  const bff = await startBff();
  try {
    const body = await (await bff.request('GET', '/env.js')).text();
    assert.ok(body.includes(`"casBaseUrl":"${CAS_CTX}"`), 'adresse CAS publique injectée dans la page');
    assert.match(body, /"appVersion":"9.9.9"/);
    assert.doesNotMatch(body, /svc-secret|svc-actuator|test-secret/);
  } finally {
    await bff.stop();
  }
});

test('sans session : /bff/session, /bff/audit-log et /api renvoient 401 et rien n\'atteint CAS', async () => {
  const bff = await startBff();
  try {
    for (const url of ['/bff/session', '/bff/audit-log', '/api/gauthCredentialRepository']) {
      assert.equal((await bff.request('GET', url)).status, 401, url);
    }
    assert.equal((await bff.request('DELETE', '/api/gauthCredentialRepository/bob')).status, 401);
    assert.equal(bff.cas.received.length, 0);
  } finally {
    await bff.stop();
  }
});

test('POST /bff/session : 400 sans ticket, 401 si ticket invalide', async () => {
  const bff = await startBff();
  try {
    assert.equal((await bff.request('POST', '/bff/session', {})).status, 400);
    const invalid = await bff.request('POST', '/bff/session', { ticket: 'ST-ko', service: 'http://app/' });
    assert.equal(invalid.status, 401);
    assert.equal((await bff.request('GET', '/bff/session')).status, 401);
  } finally {
    await bff.stop();
  }
});

test('ticket valide : session ouverte, cookie httpOnly SameSite=Lax, puis déconnexion', async () => {
  const bff = await startBff();
  try {
    const login = await bff.login();
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { username: 'alice', role: 'admin' });
    const setCookie = login.headers.getSetCookie()[0];
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);

    const me = await bff.request('GET', '/bff/session');
    assert.deepEqual(await me.json(), { username: 'alice', role: 'admin' });

    assert.equal((await bff.request('POST', '/bff/logout')).status, 204);
    assert.equal((await bff.request('GET', '/bff/session')).status, 401);
  } finally {
    await bff.stop();
  }
});

test('CAS injoignable : 502 sans stack trace', async () => {
  // Le port 1 de la boucle locale refuse la connexion : simule un CAS arrêté.
  const bff = await startBff({ casBaseUrl: 'http://127.0.0.1:1/sso' });
  // La sortie d'erreur est coupée pour ne pas polluer le rapport de test.
  const log = console.error;
  console.error = () => undefined;
  try {
    const response = await bff.request('POST', '/bff/session', { ticket: 'ST-ok', service: 'http://app/' });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'CAS injoignable' });
  } finally {
    console.error = log;
    await bff.stop();
  }
});

test('/api relaie vers l\'actuator avec les identifiants Basic ajoutés côté serveur', async () => {
  const bff = await startBff();
  try {
    await bff.login();
    const response = await bff.request('GET', '/api/ssoSessions');
    assert.equal(response.status, 200);
    const call = bff.cas.received.find((r) => r.path === `${CAS_CTX}/actuator/ssoSessions`);
    const expected = `Basic ${Buffer.from('svc-actuator:svc-secret').toString('base64')}`;
    assert.equal(call.authorization, expected);
    assert.doesNotMatch(await response.text(), /svc-secret/);
  } finally {
    await bff.stop();
  }
});

test("seuls GET et DELETE sont relayés : l'import de comptes TOTP et toute écriture sont refusés (405)", async () => {
  const bff = await startBff();
  try {
    await bff.login();
    for (const method of ['POST', 'PUT', 'PATCH']) {
      const response = await bff.request(method, '/api/gauthCredentialRepository/import', { any: 'thing' });
      assert.equal(response.status, 405, method);
      assert.equal(response.headers.get('allow'), 'GET, DELETE');
    }
    assert.equal(bff.cas.received.filter((r) => r.path.includes('import')).length, 0);
  } finally {
    await bff.stop();
  }
});

test('actuator injoignable : 502 sans détail technique', async () => {
  const bff = await startBff({ casActuatorBaseUrl: 'http://127.0.0.1:1/sso/actuator' });
  const log = console.error;
  console.error = () => undefined;
  try {
    await bff.login();
    const response = await bff.request('GET', '/api/ssoSessions');
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'CAS injoignable' });
  } finally {
    console.error = log;
    await bff.stop();
  }
});

test('les secrets TOTP (secretKey, codes de secours, code de validation) ne sont jamais transmis au navigateur', async () => {
  const bff = await startBff();
  try {
    await bff.login();
    for (const url of ['/api/gauthCredentialRepository', '/api/gauthCredentialRepository/alice']) {
      const body = await (await bff.request('GET', url)).text();
      assert.doesNotMatch(body, /SECRET|scratchCodes|validationCode|secretKey/, url);
      assert.deepEqual(JSON.parse(body)[0], { id: 1, username: 'alice', name: 'Poste', registrationDate: null });
    }
  } finally {
    await bff.stop();
  }
});

test('journal : une suppression réussie est tracée avec l\'agent réel, les trois types d\'action', async () => {
  const bff = await startBff();
  try {
    await bff.login();
    const recordKey = 'carol@Poste 13-10-2026 11:06@FINGERPRINT';
    assert.equal((await bff.request('DELETE', '/api/gauthCredentialRepository/bob')).status, 200);
    assert.equal((await bff.request('DELETE', `/api/multifactorTrustedDevices/${encodeURIComponent(recordKey)}`)).status, 200);
    assert.equal((await bff.request('DELETE', '/api/ssoSessions/TGT-1?principal=dave')).status, 200);
    assert.equal((await bff.request('DELETE', '/api/gauthCredentialRepository')).status, 200);

    const { entries } = await (await bff.request('GET', '/bff/audit-log')).json();
    const summary = entries.reverse().map(({ actor, action, target, detail }) => ({ actor, action, target, detail }));
    assert.deepEqual(summary, [
      { actor: 'alice', action: 'DELETE_TOTP_ACCOUNT', target: 'bob', detail: null },
      { actor: 'alice', action: 'REVOKE_TRUSTED_DEVICE', target: 'carol', detail: recordKey },
      { actor: 'alice', action: 'REVOKE_SSO_SESSION', target: 'dave', detail: 'TGT-1' },
      { actor: 'alice', action: 'DELETE_TOTP_ACCOUNT', target: null, detail: 'suppression en masse (tous les comptes)' },
    ]);
  } finally {
    await bff.stop();
  }
});

test('journal : une suppression refusée par CAS n\'est pas journalisée', async () => {
  const bff = await startBff();
  try {
    await bff.login();
    assert.equal((await bff.request('DELETE', '/api/gauthCredentialRepository/fail')).status, 500);
    const { entries } = await (await bff.request('GET', '/bff/audit-log')).json();
    assert.equal(entries.length, 0);
  } finally {
    await bff.stop();
  }
});

test('journal : une lecture (GET) n\'est jamais journalisée', async () => {
  const bff = await startBff();
  try {
    await bff.login();
    await bff.request('GET', '/api/ssoSessions');
    const { entries } = await (await bff.request('GET', '/bff/audit-log')).json();
    assert.equal(entries.length, 0);
  } finally {
    await bff.stop();
  }
});

test('URL malformée sur un DELETE : pas de plantage du module BFF', async () => {
  const bff = await startBff();
  try {
    await bff.login();
    // Séquence « %E0%A4%A » : encodage UTF-8 tronqué, `decodeURIComponent` lève une erreur.
    const response = await bff.request('DELETE', '/api/multifactorTrustedDevices/%E0%A4%A');
    assert.notEqual(response.status, 500);
    assert.equal((await bff.request('GET', '/bff/session')).status, 200);
  } finally {
    await bff.stop();
  }
});

test('fallback SPA : une route Angular renvoie index.html', async () => {
  const bff = await startBff();
  try {
    const response = await bff.request('GET', '/users/alice');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<html>SPA</html>');
  } finally {
    await bff.stop();
  }
});

test('point de santé : public, OK quand le journal et CAS répondent', async () => {
  const bff = await startBff();
  try {
    const response = await bff.request('GET', '/api/public/healthcheck/status');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { codeRetour: 'OK', listMessage: [] });
  } finally {
    await bff.stop();
  }
});

test('point de santé : 503 / KO quand CAS est injoignable', async () => {
  const bff = await startBff({ casBaseUrl: 'http://127.0.0.1:1/sso' });
  try {
    const response = await bff.request('GET', '/api/public/healthcheck/status');
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.codeRetour, 'KO');
    assert.match(body.listMessage[0], /CAS est injoignable/);
  } finally {
    await bff.stop();
  }
});

test('point de santé : 429 au-delà de la limite de débit', async () => {
  const bff = await startBff({ healthRateLimit: 2 });
  try {
    assert.equal((await bff.request('GET', '/api/public/healthcheck/status')).status, 200);
    assert.equal((await bff.request('GET', '/api/public/healthcheck/status')).status, 200);
    const limited = await bff.request('GET', '/api/public/healthcheck/status');
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).codeRetour, 'KO');
  } finally {
    await bff.stop();
  }
});

test('point de santé : le relais /api reste protégé (401 sans session)', async () => {
  const bff = await startBff();
  try {
    assert.equal((await bff.request('GET', '/api/gauthCredentialRepository')).status, 401);
  } finally {
    await bff.stop();
  }
});

test('purge du journal : supprime seulement les entrées plus anciennes que la durée de conservation', async () => {
  const bff = await startBff();
  try {
    const maintenant = new Date('2026-10-14T12:00:00Z');
    bff.audit.record('agent', 'DELETE_TOTP_ACCOUNT', 'ancienne', null, '2025-01-01T00:00:00.000Z');
    bff.audit.record('agent', 'DELETE_TOTP_ACCOUNT', 'moyenne', null, '2025-11-01T00:00:00.000Z');
    bff.audit.record('agent', 'DELETE_TOTP_ACCOUNT', 'recente', null, '2026-10-01T00:00:00.000Z');

    // Les horodatages sont fournis à `record` pour fixer l'âge des entrées sans dépendre de l'horloge.
    // 12 mois avant le 14/10/2026 = 14/10/2025 : seule l'entrée de janvier 2025 disparaît.
    assert.equal(bff.audit.purge(12, maintenant), 1);
    assert.deepEqual(bff.audit.entries().map((e) => e.target).sort(), ['moyenne', 'recente']);

    // 6 mois = 14/04/2026 : l'entrée de novembre 2025 disparaît à son tour.
    assert.equal(bff.audit.purge(6, maintenant), 1);
    assert.deepEqual(bff.audit.entries().map((e) => e.target), ['recente']);

    assert.equal(bff.audit.purge(6, maintenant), 0, 'purge idempotente');
  } finally {
    await bff.stop();
  }
});

// Groupes (noms courts normalisés) qui activent les habilitations ; sans eux, tout agent authentifié est administrateur.
const HABILITATIONS = { adminGroups: ['grp_miam_admin'], consultationGroups: ['grp_miam_consult'] };

test('habilitations : l\'administrateur lit, supprime et consulte le journal', async () => {
  const bff = await startBff(HABILITATIONS);
  try {
    const login = await bff.login('ST-ok');
    assert.deepEqual(await login.json(), { username: 'alice', role: 'admin' });
    assert.equal((await bff.request('GET', '/api/gauthCredentialRepository')).status, 200);
    assert.equal((await bff.request('DELETE', '/api/multifactorTrustedDevices/alice%40Poste%40fp')).status, 200);
    assert.equal((await bff.request('GET', '/bff/audit-log')).status, 200);
  } finally {
    await bff.stop();
  }
});

test('habilitations : le profil consultation lit mais ne supprime ni ne voit le journal (403)', async () => {
  const bff = await startBff(HABILITATIONS);
  try {
    const login = await bff.login('ST-lecture');
    assert.deepEqual(await login.json(), { username: 'alice', role: 'consultation' });
    assert.equal((await bff.request('GET', '/api/gauthCredentialRepository')).status, 200);

    const casAvant = bff.cas.received.length;
    const suppression = await bff.request('DELETE', '/api/multifactorTrustedDevices/alice%40Poste%40fp');
    assert.equal(suppression.status, 403);
    assert.deepEqual(await suppression.json(), { error: 'droits insuffisants' });
    assert.equal(bff.cas.received.length, casAvant, 'la suppression ne part jamais vers CAS');
    assert.equal(bff.audit.entries().length, 0, 'et n\'est pas journalisée');

    assert.equal((await bff.request('GET', '/bff/audit-log')).status, 403);
    assert.equal((await bff.request('GET', '/bff/session')).status, 200);
  } finally {
    await bff.stop();
  }
});

test('habilitations : un agent hors des groupes n\'obtient aucune session (403) ; le journal indique le nombre de groupes reçus', async () => {
  const avertissements = [];
  const warn = console.warn;
  console.warn = (m) => avertissements.push(String(m));
  const bff = await startBff(HABILITATIONS);
  try {
    const login = await bff.login('ST-aucun');
    assert.equal(login.status, 403);
    assert.deepEqual(await login.json(), { error: 'agent non habilité' });
    assert.equal((await bff.request('GET', '/bff/session')).status, 401);
    assert.equal((await bff.request('GET', '/api/gauthCredentialRepository')).status, 401);
    assert.ok(avertissements.some((m) => m.includes('1 groupe(s) reçu(s)')), 'nombre de groupes journalisé');
    assert.ok(avertissements.every((m) => !m.includes('GRP_AUTRE')), 'jamais les noms de groupes');
  } finally {
    console.warn = warn;
    await bff.stop();
  }
});

test('/env.js expose les informations RGPD publiques, jamais de secret', async () => {
  const bff = await startBff({ privacyController: 'Organisme X', privacyDpoContact: 'dpo@exemple.fr', privacyLegalBasis: 'Mission', auditRetentionMonths: 12 });
  try {
    const texte = await (await bff.request('GET', '/env.js')).text();
    assert.match(texte, /"privacyController":"Organisme X"/);
    assert.match(texte, /"auditRetentionMonths":12/);
    assert.doesNotMatch(texte, /svc-secret|test-secret/);
  } finally {
    await bff.stop();
  }
});

test('limitation de débit : /bff/session et /api répondent 429 avec Retry-After au-delà de la limite', async () => {
  const avertissements = [];
  const warn = console.warn;
  console.warn = (m) => avertissements.push(String(m));
  const bff = await startBff({ loginRateLimit: 2, apiRateLimit: 2 });
  try {
    // Un corps vide donne 400 (réponse rapide, sans appel à CAS) mais compte quand même dans la limite.
    assert.equal((await bff.request('POST', '/bff/session', {})).status, 400);
    assert.equal((await bff.request('POST', '/bff/session', {})).status, 400);
    const limite = await bff.request('POST', '/bff/session', {});
    assert.equal(limite.status, 429);
    assert.equal(limite.headers.get('retry-after'), '60');
    // Sans session, /api répond 401 : la limite s'applique avant le contrôle de session (401 puis 429).
    assert.equal((await bff.request('GET', '/api/gauthCredentialRepository')).status, 401);
    assert.equal((await bff.request('GET', '/api/gauthCredentialRepository')).status, 401);
    assert.equal((await bff.request('GET', '/api/gauthCredentialRepository')).status, 429);
    assert.ok(avertissements.some((m) => m.includes('limite de débit dépassée sur /bff/session')));
  } finally {
    console.warn = warn;
    await bff.stop();
  }
});

test('build de production : aucun script inline ni feuille de style chargée par script (la CSP script-src \'self\' les bloquerait)', (t) => {
  // Contrôle le résultat de `npm run build` : ignoré (skip) si le build n'a pas été produit.
  const index = path.join(__dirname, '..', '..', 'dist', 'miam', 'browser', 'index.html');
  if (!fs.existsSync(index)) {
    return t.skip('dist/ absent : lancer npm run build');
  }
  const html = fs.readFileSync(index, 'utf8');
  assert.doesNotMatch(html, /data-beasties-media|media="print"/, 'CSS critique inliné : la feuille principale resterait en media=print');
  assert.doesNotMatch(html, /<script>/, 'script inline interdit par la CSP');
});

test('purge du journal : fin de mois (31 août - 6 mois = 28 février), sans déborder sur mars', async () => {
  const bff = await startBff();
  try {
    bff.audit.record('agent', 'DELETE_TOTP_ACCOUNT', 'avant', null, '2027-02-27T23:59:59.000Z');
    bff.audit.record('agent', 'DELETE_TOTP_ACCOUNT', 'apres', null, '2027-02-28T13:00:00.000Z');
    // 2027 n'est pas bissextile : la limite est le 28/02/2027 à 12:00, jamais le 03/03.
    assert.equal(bff.audit.purge(6, new Date('2027-08-31T12:00:00Z')), 1);
    assert.deepEqual(bff.audit.entries().map((e) => e.target), ['apres']);
  } finally {
    await bff.stop();
  }
});

test('corps JSON mal formé : 400 « Requête invalide », avertissement sans le contenu du corps (ticket)', async () => {
  const avertissements = [];
  const warn = console.warn;
  console.warn = (m) => avertissements.push(String(m));
  const bff = await startBff();
  try {
    // `fetch` direct : `request` n'envoie que du JSON valide, or il faut un corps volontairement tronqué.
    const response = await fetch(`${bff.baseUrl}/bff/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"ticket":"ST-123-secret"',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Requête invalide' });
    assert.ok(avertissements.some((m) => m.includes('Requête invalide')));
    assert.ok(avertissements.every((m) => !m.includes('ST-123-secret')), 'le ticket n\'est jamais journalisé');
  } finally {
    console.warn = warn;
    await bff.stop();
  }
});
