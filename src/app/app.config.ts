/**
 *  Ma-Moulinette - MIAM
 *  --------------
 *  Copyright (c) 2015-2026.
 *  Laurent HADJADJ <laurent_h@me.com>.
 *  SPDX-License-Identifier: AGPL-3.0-or-later.
 *  ---
 *  Vous pouvez obtenir une copie de la licence à l'adresse suivante :
 *  https://www.gnu.org/licenses/agpl-3.0.html
 */


import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { routes } from './app.routes';
import { frenchPaginatorIntl } from './core/fr-paginator-intl';

// Données de la locale française : requises par les pipes de date/nombre et LOCALE_ID ci-dessous.
registerLocaleData(localeFr);

/**
 * Configuration d'injection de l'application (fournisseurs globaux) : détection des erreurs
 * globales du navigateur, routage (`app.routes.ts`), client HTTP, locale française et libellés
 * français du paginateur Material.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Plus d'intercepteur Basic Auth côté navigateur : le module BFF (server/)
    // détient désormais les identifiants actuator et gate l'accès via un
    // cookie de session httpOnly, envoyé automatiquement par le navigateur
    // puisque /api et /bff sont toujours servis en même origine que l'app
    // (proxy.conf.js en dev, le module BFF lui-même en déploiement).
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    { provide: MatPaginatorIntl, useFactory: frenchPaginatorIntl },
  ],
};
