'use strict';

/**
 * Tests de health.js : la vérification de santé est exercée contre un faux CAS HTTP local et un
 * faux journal d'activité (objet avec `ping`), l'horloge étant injectée quand le temps compte.
 *
 * Ce que le fichier vérifie : panne du journal détectée même si CAS répond, seuil entre
 * « joignable » (redirection, 4xx) et « en défaut » (5xx), cache de 5 secondes, et comportement du
 * limiteur de débit ré-exporté par health.js. Le contrat HTTP complet (200, 503, 429) est testé
 * dans app.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHealthCheck, createRateLimiter } = require('../health');

/** Faux CAS qui répond toujours `status` sans corps et compte les appels reçus (`hits.count`). */
function startCas(status) {
  const hits = { count: 0 };
  const server = http.createServer((req, res) => {
    hits.count += 1;
    res.statusCode = status;
    res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, hits, url: `http://127.0.0.1:${server.address().port}/sso` })));
}

test('KO quand le journal d\'activité ne répond pas, même si CAS va bien', async () => {
  const cas = await startCas(200);
  try {
    const check = createHealthCheck({
      audit: { ping: () => { throw new Error('disque plein'); } },
      casBaseUrl: cas.url,
    });
    const errors = await check();
    assert.equal(errors.length, 1);
    assert.match(errors[0], /journal d'activité/);
  } finally {
    cas.server.close();
  }
});

test('une redirection ou un 4xx de CAS compte comme joignable, un 5xx non', async () => {
  for (const [status, expectedErrors] of [[302, 0], [404, 0], [503, 1]]) {
    const cas = await startCas(status);
    try {
      const errors = await createHealthCheck({ audit: { ping: () => [] }, casBaseUrl: cas.url })();
      assert.equal(errors.length, expectedErrors, `HTTP ${status}`);
    } finally {
      cas.server.close();
    }
  }
});

test('le résultat est mis en cache 5 secondes puis revérifié', async () => {
  const cas = await startCas(200);
  // Horloge simulée : 5 001 ms après le premier appel, le cache de 5 000 ms est expiré.
  let clock = 1_000;
  try {
    const check = createHealthCheck({ audit: { ping: () => [] }, casBaseUrl: cas.url, now: () => clock });
    await check();
    await check();
    assert.equal(cas.hits.count, 1);
    clock += 5_001;
    await check();
    assert.equal(cas.hits.count, 2);
  } finally {
    cas.server.close();
  }
});

test('limiteur : refuse au-delà de la limite par IP, indépendamment entre IP, puis repart à la fenêtre suivante', () => {
  // Une fenêtre dure 60 000 ms : avancer l'horloge de cette durée remet les compteurs à zéro.
  let clock = 0;
  const isAccepted = createRateLimiter(2, () => clock);
  assert.equal(isAccepted('a'), true);
  assert.equal(isAccepted('a'), true);
  assert.equal(isAccepted('a'), false);
  assert.equal(isAccepted('b'), true);
  clock += 60_000;
  assert.equal(isAccepted('a'), true);
});
