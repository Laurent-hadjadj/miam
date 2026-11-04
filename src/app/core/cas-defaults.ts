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

/**
 * Adresse du CAS vue du navigateur quand `window.__env.casBaseUrl` n'est pas fournie, c'est-à-dire
 * seulement avec `ng serve` (en déploiement, le module BFF l'injecte depuis CAS_BASE_URL).
 *
 * Le contexte du CAS (`/sso`, `/cas`, rien…) dépend de son `application.yml` : `/sso` n'est qu'une
 * valeur par défaut, écrite ICI et dans les tests Playwright (qui l'importent d'ici). Pour un autre
 * contexte en développement, renseigner `casBaseUrl` dans `public/env.js`.
 */
export const DEFAULT_CAS_BASE_URL = '/sso';
