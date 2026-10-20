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
 * Proxy de `ng serve` : relaie le CAS, le module BFF (/api, /bff) vers leurs serveurs.
 *
 * Le contexte du CAS (`/sso`, `/cas`, rien…) n'est pas écrit ici : il vient de CAS_BASE_URL, lue
 * dans le `.env` du poste (même variable que le module BFF), `http://localhost:8083/sso` par défaut.
 * Sans contexte (CAS à la racine), aucune route CAS n'est relayée : renseigner alors une adresse
 * absolue dans `casBaseUrl` de `public/env.js`.
 *
 * Note : Angular CLI ne supporte pas les computed property names dans un objet littéral.
 */
const path = require('path');
const { casContextPath } = require('./server/config');

try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(__dirname, '.env');
  dotenv.config({ path: envPath });
} catch (err) {
  console.warn('Fichier .env non trouvé, utilisation des valeurs par défaut.');
}

const casBaseUrl = process.env.CAS_BASE_URL || 'http://localhost:8083/sso';
const prefix = process.env.PREFIX_URL || '';

// Le module BFF de développement écoute sur PORT du .env, 3000 à défaut (et non 80, valeur par défaut de config.js).
const bff = `http://localhost:${process.env.PORT || 3000}`;
const contexte = casContextPath(casBaseUrl);

// `secure: false` : le développement local accepte les certificats auto-signés ;
// `changeOrigin: true` : l'en-tête Host devient celui de la cible.
const proxy = {};

proxy[prefix + '/api'] = { target: bff, secure: false, changeOrigin: true };
proxy[prefix + '/bff'] = { target: bff, secure: false, changeOrigin: true };

// Route CAS ajoutée seulement s'il existe un contexte : la route est le contexte lui-même (`/sso`...),
// et sans contexte il n'y a aucun préfixe à relayer (voir l'en-tête du fichier).
if (contexte) {
  proxy[contexte] = { target: new URL(casBaseUrl).origin, secure: false, changeOrigin: true, logLevel: 'debug' };
}

module.exports = proxy;
