'use strict';

/**
 * Point d'entrée du module BFF : lit la configuration (variables d'environnement) et démarre le serveur.
 *
 * Ordre voulu : la configuration est chargée en premier, de sorte qu'une configuration invalide
 * en production (secret manquant, durée de conservation hors bornes) arrête le processus avant
 * toute ouverture de port. Ce fichier ne contient aucune logique métier : tout est dans app.js.
 */
const { loadConfig } = require('./config');
const { createApp } = require('./app');
const logger = require('./logger');

const config = loadConfig();
const { app, audit } = createApp(config);

/** Intervalle entre deux purges du journal : une fois par jour. */
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Purge du journal d'activité au démarrage puis une fois par jour (durée : AUDIT_RETENTION_MONTHS).
 * Une erreur est journalisée sans arrêter le serveur : la purge est reprise au prochain passage.
 * Le minuteur est `unref` pour ne pas, à lui seul, empêcher l'arrêt du processus.
 */
function purgeAuditLog() {
  try {
    const removed = audit.purge(config.auditRetentionMonths);
    logger.info(`[bff] purge du journal (> ${config.auditRetentionMonths} mois) : ${removed} entrée(s) supprimée(s)`);
  } catch (err) {
    logger.error('[bff] Échec de la purge du journal', err);
  }
}
purgeAuditLog();
setInterval(purgeAuditLog, PURGE_INTERVAL_MS).unref();

app.listen(config.port, () => {
  logger.info(`[bff] démarré sur le port ${config.port}`);
});
