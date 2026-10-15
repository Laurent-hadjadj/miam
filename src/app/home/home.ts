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


import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CasAuthService } from '../core/cas-auth.service';
import { ThemeService } from '../core/theme.service';
import { AppBreakpoint, ResponsiveService } from '../core/responsive.service';
import { BrandHeader } from '../brand-header/brand-header';

/** Logo vertical de la page d'accueil, par thème (le logo horizontal est celui de BrandHeader). */
const VERTICAL_LOGOS: Record<'bleu' | 'orange', string> = {
  bleu: 'images/logo-vertical-bleu.svg',
  orange: 'images/logo-vertical.svg',
};

/**
 * Classe CSS (pas de style inline, voir home.css) selon le point de rupture
 * (ResponsiveService) : juste assez petit en "xsmall" pour que le texte et le
 * bouton "Se connecter" tiennent à l'écran sans scroller (vérifié sur
 * 375x667, iPhone SE), plus grand ensuite où la place ne manque pas.
 */
const VERTICAL_LOGO_SIZE_CLASS: Record<AppBreakpoint, string> = {
  xsmall: 'size-xsmall',
  small: 'size-small',
  medium: 'size-medium',
  large: 'size-large',
  xlarge: 'size-xlarge',
};

/**
 * Page d'accueil publique : seul point d'entrée non protégé de l'application.
 * Elle porte le bouton "Se connecter" qui déclenche la redirection vers CAS
 * (+ MFA obligatoire) ; aucune autre route ne redirige automatiquement vers
 * CAS (voir core/cas-auth.guard.ts). Elle gère aussi le retour de CAS : un
 * ticket dans l'URL est validé ici, puis on ouvre la page de gestion ou on
 * affiche un message d'erreur.
 *
 * Route : `''` (voir app.routes.ts). Aucune entrée ni sortie. Dépendances : CasAuthService (session,
 * redirection, validation du ticket), Router, ThemeService et ResponsiveService (logo), BrandHeader.
 *
 * Elle ne décide d'aucun droit : le profil (administration ou consultation) vient du BFF avec la
 * session, et c'est le BFF qui reste juge de chaque appel. Un compte authentifié mais absent de tout
 * groupe MIAM n'obtient pas de session (le BFF répond 403) et reste ici avec un message.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, BrandHeader],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  private readonly authService = inject(CasAuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly responsiveService = inject(ResponsiveService);

  /** Vrai pendant la validation du ticket CAS : le gabarit remplace le bouton par un indicateur. */
  protected readonly validating = signal(false);
  /** Message d'échec affiché dans une alerte ; `null` = aucun. Effacé au prochain clic sur « Se connecter ». */
  protected readonly error = signal<string | null>(null);

  /** Chemin du logo vertical selon le thème courant (relu à chaque détection de changement). */
  protected get verticalLogoUrl(): string {
    return VERTICAL_LOGOS[this.themeService.theme()];
  }

  /** Classe CSS de taille du logo selon le palier courant, appliquée dans le gabarit. */
  protected get verticalLogoSizeClass(): string {
    return VERTICAL_LOGO_SIZE_CLASS[this.responsiveService.breakpoint()];
  }

  /**
   * Trois cas, dans l'ordre :
   * 1. une session existe déjà : redirection immédiate vers `/users` ;
   * 2. pas de paramètre `ticket` dans l'URL : simple affichage de l'accueil ;
   * 3. retour de CAS avec un ticket : validation par le BFF, puis `/users` en cas de succès, sinon
   *    un message d'erreur. Le message distingue l'accès refusé (compte sans profil MIAM) de l'échec
   *    de validation (ticket invalide ou autre erreur).
   */
  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl('/users');
      return;
    }

    const ticket = new URLSearchParams(window.location.search).get('ticket');
    if (!ticket) {
      return;
    }

    // Ticket CAS à usage unique : on le retire de l'URL immédiatement, avant
    // même sa validation, pour qu'un rechargement de page ne le rejoue pas.
    window.history.replaceState({}, '', window.location.pathname);

    this.validating.set(true);
    this.authService.validateTicket(ticket).subscribe((result) => {
      this.validating.set(false);
      if (result === 'ok') {
        this.router.navigateByUrl('/users');
      } else if (result === 'non-habilite') {
        this.error.set(
          "Accès refusé : votre compte est authentifié mais n'est habilité à aucun profil de MIAM. Contactez l'administrateur de l'application.",
        );
      } else {
        this.error.set(
          "La connexion a échoué : impossible de valider votre authentification auprès du CAS. Veuillez réessayer.",
        );
      }
    });
  }

  /**
   * Efface l'éventuel message d'erreur puis redirige vers l'écran de connexion CAS (avec MFA). Le
   * navigateur quitte l'application : aucune suite n'est exécutée ici.
   */
  login(): void {
    this.error.set(null);
    this.authService.redirectToLogin();
  }
}
