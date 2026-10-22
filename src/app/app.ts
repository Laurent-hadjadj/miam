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


import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CasAuthService } from './core/cas-auth.service';
import { AppFooter } from './app-footer/app-footer';
import { ThemeSwitch } from './theme-switch/theme-switch';
import { ThemeService } from './core/theme.service';
import { ResponsiveService } from './core/responsive.service';
import { Notification } from './notification/notification';
import { ENVIRONMENT } from './core/api-config';

/**
 * Composant racine : squelette de l'application (barre d'outils, zone de contenu routée, pied de page,
 * zone de notifications).
 *
 * La barre d'outils n'est affichée que pour un utilisateur connecté (`authService.isAuthenticated`) ; ce
 * n'est qu'un confort d'affichage, l'accès aux données reste contrôlé par le module BFF.
 *
 * Accessibilité : lien d'évitement vers le contenu (`#contenu`) et déplacement du focus vers ce
 * contenu après chaque navigation.
 *
 * Ne fait PAS : aucun appel réseau, aucune décision d'autorisation (voir `core/cas-auth.guard.ts`).
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule, AppFooter, ThemeSwitch, Notification],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly authService = inject(CasAuthService);
  // Instancié ici pour appliquer le thème (data-theme, favicons) sur toutes les pages, pas seulement les publiques.
  protected readonly themeService = inject(ThemeService);
  private readonly responsiveService = inject(ResponsiveService);
  private readonly router = inject(Router);

  /** S'abonne aux fins de navigation pour y replacer le focus (désabonnement automatique à la destruction). */
  constructor() {
    // Après chaque navigation (hors chargement initial), le focus passe au contenu : le lecteur d'écran
    // annonce la nouvelle page au lieu de rester sur le lien cliqué.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.navigated) {
          this.focusContent();
        }
        this.navigated = true;
      });
  }

  /** Faux jusqu'à la première navigation terminée : le chargement initial ne doit pas voler le focus. */
  private navigated = false;

  /** "xsmall"/"small" : logo icône seule et navigation sans libellés (même seuil que BrandHeader). */
  protected readonly isCompact = computed(() => {
    const bp = this.responsiveService.breakpoint();
    return bp === 'xsmall' || bp === 'small';
  });

  /**
   * Chemin (relatif à la balise base) du logo de la barre d'outils : icône seule en mode compact,
   * version horizontale sinon, déclinaison bleue ou orange selon le thème courant.
   */
  protected readonly logoUrl = computed(() => {
    const orange = this.themeService.theme() === 'orange';
    if (this.isCompact()) {
      return orange ? 'images/logo.svg' : 'images/logo-bleu.svg';
    }
    return orange ? 'images/logo-horizontal.svg' : 'images/logo-horizontal-bleu.svg';
  });

  /** Lien d'évitement : focus sur le contenu sans changer l'URL (la balise base casserait un lien #ancre). */
  skipToContent(event: Event): void {
    event.preventDefault();
    this.focusContent();
  }

  /** Place le focus sur l'élément `#contenu` ; sans effet s'il n'existe pas dans la page. */
  private focusContent(): void {
    document.getElementById('contenu')?.focus();
  }

  /** Déconnexion de l'agent : délègue à `CasAuthService.logout` (session du module BFF puis déconnexion de serveur CAS). */
  logout(): void {
    this.authService.logout();
  }

  /** Environnement d'exécution (DEV, INT, REC, PRD). */
  protected readonly env = ENVIRONMENT;

  /** Label court du badge d'environnement. */
  protected readonly envLabel = computed(() => {
    switch (this.env) {
      case 'DEV': return 'DEV';
      case 'INT': return 'INT';
      case 'REC': return 'REC';
      case 'PRD': return 'PRD';
    }
  });

  /** Classe CSS du badge : `env-dev`, `env-int`, `env-rec`, `env-prd`. */
  protected readonly envClass = computed(() => {
    return `env-${this.env.toLowerCase()}`;
  });
}
