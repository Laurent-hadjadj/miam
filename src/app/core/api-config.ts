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
 * Configuration d'exécution côté navigateur : constantes dérivées de `window.__env` (script `env.js`)
 * et préfixe des appels vers le module BFF.
 *
 * Contrat : tout ce qui figure ici est PUBLIC (le navigateur ne détient aucun secret). Les valeurs
 * sont figées au chargement du module ; les changer exige de recharger la page.
 */

import { DEFAULT_CAS_BASE_URL } from './cas-defaults';

declare global {
  interface Window {
    /**
     * Paramètres publics posés par `env.js` avant le démarrage de l'application. Tous les champs
     * sont facultatifs : une valeur absente ou vide retombe sur le défaut de la constante concernée.
     */
    __env?: {
      casBaseUrl?: string;
      logoUrl?: string;
      appAuthor?: string;
      appVersion?: string;
      privacyController?: string;
      privacyDpoContact?: string;
      privacyLegalBasis?: string;
      auditRetentionMonths?: number;
    };
  }
}

/**
 * Proxy BFF (server/app.js), même origine - jamais de secret ici. Le
 * navigateur ne communique plus directement avec l'API Actuator du seveur CAS : 
 * le BFF détient les identifiants HTTP Basic côté serveur et exige une 
 * session valide (ouverte uniquement après validation réelle d'un ticket CAS)
 * avant de relayer quoi que ce soit. Voir l'audit de sécurité : l'ancien schéma
 * (identifiants actuator dans window.__env, servis sans authentification) permettait à
 * n'importe qui de contourner entièrement CAS/MFA.
 */
export const API_BASE_URL = '/api';

/**
 * Base CAS publique (login, logout, MFA) - toujours une valeur non secrète,
 * résolue au CHARGEMENT de la page via `window.__env` : `public/env.js`
 * (committé, valeurs de dev par défaut) en dev, route dynamique `/env.js`
 * servie par le BFF en déploiement (voir server/app.js) - la même image
 * sert donc dev/int/rec/prod sans rebuild, juste en changeant les variables
 * d'environnement du conteneur. Valeur vide = CAS à la racine du domaine (aucun
 * contexte) ; valeur absente = `DEFAULT_CAS_BASE_URL` (voir cas-defaults.ts).
 */
export const CAS_BASE_URL = window.__env?.casBaseUrl ?? DEFAULT_CAS_BASE_URL;

/**
 * Logo d'entreprise optionnel, affiché avant le logo MIAM dans l'en-tête de
 * marque (voir BrandHeader) - personnalisable par environnement, sans
 * rebuild, via la même mécanique que CAS_BASE_URL. Vide par défaut : aucun
 * logo d'entreprise n'est alors affiché, seul le logo MIAM reste visible.
 */
export const LOGO_URL = window.__env?.logoUrl || '';

/** Auteur affiché dans le pied de page - personnalisable par environnement, même mécanique que LOGO_URL. */
export const APP_AUTHOR = window.__env?.appAuthor || 'Laurent HADJADJ';
/** Version affichée dans le pied de page - personnalisable par environnement, même mécanique que LOGO_URL. */
export const APP_VERSION = window.__env?.appVersion || '1.0.0';

/**
 * Informations RGPD de la page /informations, renseignées par l'organisation qui déploie MIAM
 * (variables PRIVACY_* du BFF). Vides : formulations neutres renvoyant au DPO.
 */
export const PRIVACY_CONTROLLER = window.__env?.privacyController || '';
/** Contact du délégué à la protection des données (DPO), pour l'exercice des droits RGPD. */
export const PRIVACY_DPO_CONTACT = window.__env?.privacyDpoContact || '';
/** Base légale du traitement, affichée telle que fournie par l'organisation. */
export const PRIVACY_LEGAL_BASIS = window.__env?.privacyLegalBasis || '';
/** Durée de conservation du journal d'activité, en mois (AUDIT_RETENTION_MONTHS du BFF). */
export const AUDIT_RETENTION_MONTHS = window.__env?.auditRetentionMonths || 12;
