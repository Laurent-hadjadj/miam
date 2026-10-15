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

/**
 * Bascule de thème bleu/orange, partagée par l'en-tête des pages publiques
 * (BrandHeader) et la barre d'outils des pages connectées (App) : "xsmall"/
 * "small" = une seule pastille (cible tactile 44x44), au-delà = les deux
 * pastilles côte à côte.
 *
 * Aucune entrée ni sortie ; dépend de ThemeService (état et cookie du thème) et de ResponsiveService
 * (palier). Le bouton est un interrupteur (`role="switch"`) dont l'état « coché » signifie « thème
 * orange actif » et dont le nom accessible est fixe (« Thème orange ») ; l'action est précisée par
 * `title`. Les pastilles sont décoratives (`aria-hidden`) : couleur et forme ne portent pas seules le sens.
 */
@Component({
  selector: 'app-theme-switch',
  standalone: true,
  templateUrl: './theme-switch.html',
  styleUrl: './theme-switch.css',
})
export class ThemeSwitch {
  private readonly themeService = inject(ThemeService);
  private readonly responsiveService = inject(ResponsiveService);

  /** Thème courant (signal de ThemeService). */
  protected readonly theme = this.themeService.theme;

  /** Vrai en "xsmall"/"small" : le gabarit n'affiche alors qu'une pastille de 44x44 au lieu de deux. */
  protected readonly isCompact = computed(() => {
    const bp = this.responsiveService.breakpoint();
    return bp === 'xsmall' || bp === 'small';
  });

  /** Passe de bleu à orange ou inversement ; ThemeService mémorise le choix en cookie et l'applique. */
  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
