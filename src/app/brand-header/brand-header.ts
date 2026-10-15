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
import { ThemeService } from '../core/theme.service';
import { ResponsiveService } from '../core/responsive.service';
import { LOGO_URL } from '../core/api-config';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeSwitch } from '../theme-switch/theme-switch';

/**
 * Logo MIAM par thème, en deux variantes :
 * - `horizontal` : logo + texte (MIAM + sous-titre), utilisé à partir du
 *   point de rupture "medium" ;
 * - `icon` : logo seul (sans texte), utilisé en "xsmall"/"small" où le texte
 *   du logo horizontal devient illisible une fois réduit.
 */
const MIAM_LOGOS: Record<'bleu' | 'orange', { horizontal: string; icon: string }> = {
  bleu: { horizontal: 'images/logo-horizontal-bleu.svg', icon: 'images/logo-bleu.svg' },
  orange: { horizontal: 'images/logo-horizontal.svg', icon: 'images/logo.svg' },
};

/**
 * En-tête de marque, partagé par les pages publiques (accueil, déconnexion).
 * Ordre d'affichage : logo d'entreprise (optionnel, `LOGO_URL` - rien si
 * vide) puis logo MIAM selon le thème. Variante (icône seule vs horizontale) pilotée
 * par ResponsiveService (points de rupture Material `@angular/cdk/layout`),
 * pas par une media-query CSS isolée - réagit aussi à un redimensionnement
 * de fenêtre, pas seulement au chargement. Bascule bleu/orange via
 * ThemeService.
 *
 * Aucune entrée ni sortie. Dépendances : ThemeService (thème courant), ResponsiveService (palier),
 * `LOGO_URL` de `api-config.ts`, le lien vers `/informations` (RGPD, accessible sans connexion) et la
 * bascule de thème `app-theme-switch`. Il n'affiche ni identité d'agent ni bouton de connexion : ceux-ci
 * appartiennent à la page qui l'embarque.
 */
@Component({
  selector: 'app-brand-header',
  standalone: true,
  imports: [ThemeSwitch, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './brand-header.html',
  styleUrl: './brand-header.css',
})
export class BrandHeader {
  private readonly themeService = inject(ThemeService);
  private readonly responsiveService = inject(ResponsiveService);

  /** Thème courant (signal de ThemeService), qui choisit la déclinaison de couleur du logo. */
  protected readonly theme = this.themeService.theme;
  /** Logo d'entreprise optionnel ; chaîne vide = aucun logo (le gabarit ne rend alors pas l'image). */
  protected readonly companyLogoUrl = LOGO_URL;

  /**
   * "xsmall"/"small" : logo icône seule + une pastille de thème unique (cible tactile 44x44).
   * Le libellé du lien « Informations » disparaît aussi ; son nom accessible reste porté par `aria-label`.
   */
  protected readonly isCompact = computed(() => {
    const bp = this.responsiveService.breakpoint();
    return bp === 'xsmall' || bp === 'small';
  });

  /** Chemin du logo MIAM : variante icône ou horizontale selon le palier, déclinaison selon le thème. */
  protected readonly miamLogoUrl = computed(() => {
    const logos = MIAM_LOGOS[this.theme()];
    return this.isCompact() ? logos.icon : logos.horizontal;
  });
}
