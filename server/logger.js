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
 * Journal technique du module BFF : une ligne par événement sur la sortie standard / d'erreur,
 * `<horodatage ISO> <NIVEAU> <message>`. En conteneur, l'orchestrateur (docker logs, journald, collecteur)
 * les recueille et en gère la rotation ; aucun fichier n'est écrit ici, donc rien à purger de plus.
 *
 * Niveau minimal : variable `LOG_LEVEL` (error, warn, info, debug ; défaut info), relue à chaque appel.
 *
 * Aucune dépendance. Une erreur n'est JAMAIS affichée en entier (`console.error(err)` imprime toutes ses
 * propriétés, dont le corps brut d'une requête mal formée, donc un ticket CAS) : seuls son type, son code
 * et son message le sont, et sa pile d'appels uniquement au niveau debug.
 */

/** Gravité croissante vers le bruit : un message est émis si son niveau est inférieur ou égal au seuil. */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
/** Méthode de `console` utilisée par niveau : erreurs et avertissements sur stderr, le reste sur stdout. */
const SINKS = { error: 'error', warn: 'warn', info: 'log', debug: 'log' };

/**
 * Seuil courant, relu à chaque appel pour que `LOG_LEVEL` puisse changer sans redémarrage du module
 * (utile aussi aux tests). Une valeur absente ou inconnue donne le niveau info.
 */
function threshold() {
  return LEVELS[String(process.env.LOG_LEVEL || '').toLowerCase()] ?? LEVELS.info;
}

/**
 * Résumé sûr d'une erreur. Le message d'une erreur d'analyse du corps (`entity.*`) cite un extrait du
 * corps de la requête : il est omis.
 *
 * @param {unknown} err erreur, chaîne, ou toute autre valeur (ignorée : résumé vide)
 * @param {boolean} [withStack] ajoute la pile d'appels (réservé au niveau debug)
 * @returns {string} `Nom : code : message` sans doublon ; vide si rien d'exploitable
 * @example
 * describe(new Error('fetch failed'), false); // 'Error : fetch failed'
 */
function describe(err, withStack) {
  if (!(err instanceof Error)) {
    return typeof err === 'string' ? err : '';
  }
  const code = err.code ?? err.type ?? err.cause?.code;
  const cite = typeof err.type === 'string' && err.type.startsWith('entity.');
  const parts = [err.name, code, cite ? '' : err.message].filter(Boolean);
  const resume = [...new Set(parts)].join(' : ');
  return withStack && err.stack ? `${resume}\n${err.stack}` : resume;
}

/**
 * Écrit une ligne si le niveau passe le seuil.
 *
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} message texte du journal : n'y mettre aucune donnée personnelle ni ticket
 * @param {unknown} [err] erreur associée, résumée par `describe`
 */
function write(level, message, err) {
  if (LEVELS[level] > threshold()) {
    return;
  }
  const detail = describe(err, threshold() >= LEVELS.debug);
  console[SINKS[level]](`${new Date().toISOString()} ${level.toUpperCase()} ${message}${detail ? ` - ${detail}` : ''}`);
}

// `describe` est exporté en plus des quatre niveaux, pour qu'un appelant puisse résumer une erreur
// de la même façon sans passer par une ligne de journal (aucun appelant actuel dans le module).
module.exports = {
  error: (message, err) => write('error', message, err),
  warn: (message, err) => write('warn', message, err),
  info: (message, err) => write('info', message, err),
  debug: (message, err) => write('debug', message, err),
  describe,
};
