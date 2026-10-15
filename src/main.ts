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
 * Point d'entrée du navigateur : démarre le composant racine `App` avec la configuration
 * applicative (`appConfig`). Aucune logique métier ici.
 *
 * `window.__env` (voir `core/api-config.ts`) est lu à l'import des modules : le script `env.js`
 * est donc chargé par `index.html` avant ce code.
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Un échec de démarrage n'est que journalisé dans la console : aucune interface n'existe encore pour l'afficher.
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
