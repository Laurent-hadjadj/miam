'use strict';

/**
 * Tests de logger.js : la sortie de `console` est interceptée pour lire les lignes réellement émises.
 *
 * Ce que le fichier vérifie : format d'une ligne (horodatage ISO, niveau, message) et flux utilisé par
 * niveau, filtrage par `LOG_LEVEL` (info par défaut), et surtout la confidentialité des erreurs :
 * ni propriétés brutes (corps de requête, donc ticket CAS), ni message d'une erreur d'analyse du
 * corps, ni pile d'appels hors niveau debug.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const logger = require('../logger');

/**
 * Capture ce que le journal écrit sur la sortie standard / d'erreur le temps d'un test.
 * `LOG_LEVEL` et les méthodes de `console` sont rétablis ensuite, même en cas d'échec.
 *
 * @param {string|undefined} niveau valeur de LOG_LEVEL pendant la capture ; undefined = variable absente
 * @param {() => void} fn code qui émet les lignes de journal
 * @returns {Array<[string, string]>} couples [méthode de console, ligne écrite]
 */
function capturer(niveau, fn) {
  const sorties = [];
  const origines = { log: console.log, warn: console.warn, error: console.error };
  const avant = process.env.LOG_LEVEL;
  for (const k of Object.keys(origines)) {
    console[k] = (m) => sorties.push([k, String(m)]);
  }
  if (niveau === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = niveau;
  }
  try {
    fn();
  } finally {
    Object.assign(console, origines);
    if (avant === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = avant;
    }
  }
  return sorties;
}

test('format : horodatage ISO, niveau, message ; erreurs sur stderr, avertissements sur stderr, infos sur stdout', () => {
  const sorties = capturer(undefined, () => {
    logger.info('démarré');
    logger.warn('attention');
    logger.error('échec');
  });
  assert.deepEqual(sorties.map(([flux]) => flux), ['log', 'warn', 'error']);
  assert.match(sorties[0][1], /^\d{4}-\d{2}-\d{2}T[\d:.]+Z INFO démarré$/);
  assert.match(sorties[1][1], / WARN attention$/);
  assert.match(sorties[2][1], / ERROR échec$/);
});

test('LOG_LEVEL : info par défaut (debug masqué), error ne laisse passer que les erreurs, debug laisse tout', () => {
  const emettre = () => {
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
  };
  assert.equal(capturer(undefined, emettre).length, 3);
  assert.equal(capturer('error', emettre).length, 1);
  assert.equal(capturer('warn', emettre).length, 2);
  assert.equal(capturer('debug', emettre).length, 4);
  assert.equal(capturer('n_importe_quoi', emettre).length, 3, 'valeur inconnue : niveau info');
});

test('erreur : type, code et message seulement, jamais les propriétés (corps brut) ni la pile hors debug', () => {
  // `body` simule la propriété qu'un `console.error(err)` complet afficherait : elle contient un ticket.
  const err = new Error('fetch failed');
  err.cause = { code: 'ECONNREFUSED' };
  err.body = '{"ticket":"ST-123-secret"}';
  const sorties = capturer(undefined, () => logger.error('[bff] CAS injoignable', err));
  const ligne = sorties[0][1];
  assert.match(ligne, /CAS injoignable - Error : ECONNREFUSED : fetch failed$/);
  assert.doesNotMatch(ligne, /ST-123-secret|\n\s+at /);
});

test('erreur d\'analyse du corps : le message, qui cite un extrait de la requête, est omis', () => {
  const err = new SyntaxError('Unexpected token \'x\', "ticket=ST-123" is not valid JSON');
  err.type = 'entity.parse.failed';
  err.body = 'ticket=ST-123';
  const ligne = capturer(undefined, () => logger.error('[bff] Erreur non gérée', err))[0][1];
  assert.match(ligne, /SyntaxError : entity.parse.failed$/);
  assert.doesNotMatch(ligne, /ST-123/);
});

test('la pile d\'appels n\'apparaît qu\'au niveau debug', () => {
  const err = new Error('boum');
  assert.match(capturer('debug', () => logger.error('x', err))[0][1], /\n\s+at /);
  assert.doesNotMatch(capturer('info', () => logger.error('x', err))[0][1], /\n\s+at /);
});
