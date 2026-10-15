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


import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CasAuthService } from './cas-auth.service';

/**
 * Gardes de routes. Elles s'appuient sur le miroir de session de `CasAuthService` : c'est un
 * confort de navigation, pas une barrière de sécurité. Un état client falsifié ne donne accès à
 * aucune donnée, car le module BFF revérifie la session serveur à chaque appel.
 */

/**
 * La connexion CAS (+ MFA) ne se déclenche que depuis la page d'accueil
 * (bouton "Se connecter"), jamais automatiquement : un accès direct à une
 * page protégée sans session renvoie simplement vers l'accueil.
 *
 * @returns `true` si l'agent est connecté (tous profils), sinon l'`UrlTree` de l'accueil.
 */
export const casAuthGuard: CanActivateFn = () => {
  const auth = inject(CasAuthService);
  const router = inject(Router);

  return auth.isAuthenticated() || router.createUrlTree(['/']);
};

/**
 * Pages réservées au profil administrateur (journal d'activité) : les autres profils retournent à la liste.
 *
 * @returns `true` pour un administrateur ; l'`UrlTree` de l'accueil sans session ; celui de la liste
 *   `/users` pour un profil consultation.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(CasAuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }
  return auth.isAdmin() || router.createUrlTree(['/users']);
};
