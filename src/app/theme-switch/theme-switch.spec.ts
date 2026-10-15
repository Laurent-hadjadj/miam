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

import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../core/theme.service';
import { clearThemeCookie, fakeResponsive } from '../../testing/fakes';
import { ThemeSwitch } from './theme-switch';

/**
 * Vérifie la bascule de thème : deux pastilles (interrupteur ARIA) à partir de "medium", une seule en
 * "xsmall", bascule au clic avec mémorisation en cookie. Le palier est simulé par `fakeResponsive` ;
 * le cookie de thème est effacé avant et après chaque test.
 */
describe('ThemeSwitch', () => {
  beforeEach(clearThemeCookie);
  afterEach(clearThemeCookie);

  function create(initial: 'large' | 'xsmall' = 'large') {
    const responsive = fakeResponsive(initial);
    TestBed.configureTestingModule({ providers: [responsive.provider] });
    const fixture = TestBed.createComponent(ThemeSwitch);
    fixture.detectChanges();
    return { fixture, responsive, root: fixture.nativeElement as HTMLElement };
  }

  it('affiche les deux pastilles à partir de "medium", celle du thème actif est marquée', () => {
    const { root } = create();
    expect(root.querySelector('.theme-switch-compact')).toBeNull();
    const button = root.querySelector<HTMLButtonElement>('.theme-switch');
    expect(button?.getAttribute('role')).toBe('switch');
    expect(button?.getAttribute('aria-checked')).toBe('true');
    expect(root.querySelector('.swatch-orange')?.classList).toContain('active');
    expect(root.querySelector('.swatch-bleu')?.classList).not.toContain('active');
  });

  it('un clic bascule le thème (cookie inclus)', () => {
    const { fixture, root } = create();
    root.querySelector<HTMLButtonElement>('.theme-switch')?.click();
    fixture.detectChanges();

    expect(TestBed.inject(ThemeService).theme()).toBe('bleu');
    expect(root.querySelector('.theme-switch')?.getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector('.theme-switch')?.getAttribute('title')).toBe('Passer au thème orange');
    expect(document.cookie).toContain('miam-theme=bleu');
  });

  it('en "xsmall", une seule pastille (cible tactile) à la couleur du thème actif', () => {
    const { fixture, responsive, root } = create();
    responsive.breakpoint.set('xsmall');
    fixture.detectChanges();

    expect(root.querySelector('.theme-switch')).toBeNull();
    const compact = root.querySelector<HTMLButtonElement>('.theme-switch-compact');
    expect(compact?.querySelector('.swatch')?.classList).toContain('swatch-orange');
    compact?.click();
    fixture.detectChanges();
    expect(compact?.querySelector('.swatch')?.classList).toContain('swatch-bleu');
  });
});
