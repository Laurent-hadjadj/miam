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
 * Contrat de `ResponsiveService` : chaque point de rupture Material actif est traduit en palier
 * applicatif (`xsmall` à `xlarge`), et `large` sert de repli si aucun ne correspond. Le
 * `BreakpointObserver` est remplacé par une doublure à état fixe.
 */

import { TestBed } from '@angular/core/testing';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { AppBreakpoint, ResponsiveService } from './responsive.service';

function breakpointFor(active: string | null): AppBreakpoint {
  const breakpoints: Record<string, boolean> = {};
  for (const query of [Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium, Breakpoints.Large, Breakpoints.XLarge]) {
    breakpoints[query] = query === active;
  }
  TestBed.configureTestingModule({
    providers: [{ provide: BreakpointObserver, useValue: { observe: () => of({ matches: true, breakpoints }) } }],
  });
  return TestBed.inject(ResponsiveService).breakpoint();
}

describe('ResponsiveService', () => {
  it.each([
    ['xsmall', Breakpoints.XSmall],
    ['small', Breakpoints.Small],
    ['medium', Breakpoints.Medium],
    ['large', Breakpoints.Large],
    ['xlarge', Breakpoints.XLarge],
  ] as const)('traduit le point de rupture Material actif en "%s"', (expected, query) => {
    expect(breakpointFor(query)).toBe(expected);
  });

  it('retombe sur "large" si aucun point de rupture ne correspond', () => {
    expect(breakpointFor(null)).toBe('large');
  });
});
