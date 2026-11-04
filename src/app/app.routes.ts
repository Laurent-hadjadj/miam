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


import { Routes } from '@angular/router';
import { Home } from './home/home';
import { LoggedOut } from './logged-out/logged-out';
import { casAuthGuard } from './core/cas-auth.guard';

/**
 * Table des routes de l'application.
 *
 * - Publiques : accueil (point de départ de la connexion CAS), informations RGPD, confirmation de
 *   déconnexion.
 * - `users`, `users/:username` et `journal` : exigent une session (`casAuthGuard`), profils admin et consultation.
 * - Toute autre URL redirige vers l'accueil.
 *
 * Les gardes ne servent qu'à guider la navigation : l'autorisation réelle est appliquée par le
 * module BFF sur chaque appel `/api` et `/bff`. Les pages hors accueil et déconnexion sont chargées
 * à la demande (`loadComponent`) pour alléger le bundle initial.
 */
export const routes: Routes = [
  { path: '', component: Home, title: 'Accueil - MIAM' },
  { path: 'informations', loadComponent: () => import('./informations/informations').then((m) => m.Informations), title: 'Informations personnelles - MIAM' },
  { path: 'deconnexion', component: LoggedOut, title: 'Déconnexion réussie - MIAM' },
  { path: 'users', title: 'Utilisateurs - MIAM', loadComponent: () => import('./user-list/user-list').then((m) => m.UserList), canActivate: [casAuthGuard] },
  { path: 'users/:username', title: 'Détail utilisateur - MIAM', loadComponent: () => import('./user-details/user-details').then((m) => m.UserDetails), canActivate: [casAuthGuard] },
  { path: 'journal', title: "Journal d'activité - MIAM", loadComponent: () => import('./journal/journal').then((m) => m.Journal), canActivate: [casAuthGuard] },
  { path: '**', redirectTo: '' },
];
