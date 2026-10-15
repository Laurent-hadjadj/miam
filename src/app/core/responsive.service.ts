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

import { Injectable, inject } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Paliers d'affichage de l'application, du plus étroit au plus large. */
export type AppBreakpoint = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge';

/**
 * Points de rupture standard d'Angular Material (`@angular/cdk/layout`,
 * `Breakpoints.XSmall/Small/Medium/Large/XLarge`) - plutôt que des seuils
 * `@media` ad hoc dans chaque feuille de style, pour que tous les composants
 * de l'appli s'accordent sur les mêmes ruptures et réagissent dynamiquement
 * (resize de fenêtre, rotation d'écran), pas seulement au chargement.
 */
const TIERS: { key: AppBreakpoint; query: string }[] = [
  { key: 'xsmall', query: Breakpoints.XSmall },
  { key: 'small', query: Breakpoints.Small },
  { key: 'medium', query: Breakpoints.Medium },
  { key: 'large', query: Breakpoints.Large },
  { key: 'xlarge', query: Breakpoints.XLarge },
];

/**
 * Expose le palier d'affichage courant sous forme de signal, pour que les composants adaptent leur
 * rendu sans dupliquer de media queries. Ne fait que traduire l'état du `BreakpointObserver`.
 */
@Injectable({ providedIn: 'root' })
export class ResponsiveService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  /**
   * Palier courant, mis à jour à chaque changement. Vaut `large` au départ et si aucun palier ne
   * correspond (par exemple en environnement de test sans média).
   */
  readonly breakpoint = toSignal(
    this.breakpointObserver
      .observe(TIERS.map((tier) => tier.query))
      .pipe(map((state) => TIERS.find((tier) => state.breakpoints[tier.query])?.key ?? 'large')),
    { initialValue: 'large' },
  );
}
