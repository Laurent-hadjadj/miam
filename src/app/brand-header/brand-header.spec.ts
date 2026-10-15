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
import { provideRouter } from '@angular/router';
import { ThemeService } from '../core/theme.service';
import { clearThemeCookie, fakeResponsive } from '../../testing/fakes';
import { BrandHeader } from './brand-header';

/**
 * Vérifie l'en-tête de marque : choix du logo MIAM selon le palier responsive (simulé par
 * `fakeResponsive`) et le thème, absence de logo d'entreprise quand `LOGO_URL` est vide, présence de la
 * bascule de thème. Le cookie de thème est effacé avant et après chaque test pour isoler les cas.
 */
describe('BrandHeader', () => {
  beforeEach(clearThemeCookie);
  afterEach(clearThemeCookie);

  function create() {
    const responsive = fakeResponsive('large');
    TestBed.configureTestingModule({ providers: [responsive.provider, provideRouter([])] });
    const fixture = TestBed.createComponent(BrandHeader);
    fixture.detectChanges();
    const logo = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('img.miam-logo');
    return { fixture, responsive, logo };
  }

  it('logo horizontal (avec texte) à partir de "medium", selon le thème', () => {
    const { fixture, logo } = create();
    expect(logo()?.getAttribute('src')).toBe('images/logo-horizontal.svg');

    TestBed.inject(ThemeService).setTheme('bleu');
    fixture.detectChanges();
    expect(logo()?.getAttribute('src')).toBe('images/logo-horizontal-bleu.svg');
  });

  it('icône seule en "xsmall" et "small", où le texte du logo serait illisible', () => {
    const { fixture, responsive, logo } = create();
    for (const size of ['xsmall', 'small'] as const) {
      responsive.breakpoint.set(size);
      fixture.detectChanges();
      expect(logo()?.getAttribute('src')).toBe('images/logo.svg');
      expect((fixture.nativeElement as HTMLElement).querySelector('.brand-header')?.classList).toContain('compact');
    }
  });

  it('n\'affiche pas de logo d\'entreprise quand LOGO_URL est vide', () => {
    const { fixture } = create();
    expect((fixture.nativeElement as HTMLElement).querySelector('.company-logo')).toBeNull();
  });

  it('embarque la bascule de thème', () => {
    const { fixture } = create();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-theme-switch')).not.toBeNull();
  });
});
