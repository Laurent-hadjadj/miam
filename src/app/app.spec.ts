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
 * Contrats du composant racine `App` : la barre d'outils n'apparaît que pour un utilisateur connecté, le
 * logo suit le thème et le point de rupture (icône seule en mobile, navigation nommée par
 * `aria-label`), et le bouton de déconnexion délègue à `CasAuthService.logout`. Aucun appel réseau
 * réel : `HttpClient` est simulé et le `ResponsiveService` est piloté par `fakeResponsive`.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CasAuthService } from './core/cas-auth.service';
import { ThemeService } from './core/theme.service';
import { clearThemeCookie, fakeResponsive } from '../testing/fakes';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearThemeCookie();
  });
  afterEach(clearThemeCookie);

  function create(authenticated: boolean, breakpoint: 'large' | 'xsmall' = 'large') {
    if (authenticated) {
      sessionStorage.setItem('totp-admin-cas-session', JSON.stringify({ username: 'alice', role: 'admin' }));
    }
    const responsive = fakeResponsive(breakpoint);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), responsive.provider],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('sans session : pas de barre d\'outils, mais le pied de page', () => {
    const { root } = create(false);
    expect(root.querySelector('mat-toolbar')).toBeNull();
    expect(root.querySelector('app-footer')).not.toBeNull();
  });

  it('connecté : barre d\'outils avec logo, navigation, nom de l\'agent et bascule de thème', () => {
    const { root } = create(true);
    expect(root.querySelector('mat-toolbar img.toolbar-logo')?.getAttribute('src')).toBe('images/logo-horizontal.svg');
    expect(root.querySelector('.toolbar-title')?.textContent).toContain('Administration TOTP');
    expect(root.querySelector('.username')?.textContent?.trim()).toBe('Agent connecté : alice');
    expect(root.querySelector('mat-toolbar app-theme-switch')).not.toBeNull();
    expect(root.querySelectorAll('mat-toolbar a')).toHaveLength(3);
  });

  it('le logo de la barre d\'outils suit le thème', () => {
    const { fixture, root } = create(true);
    TestBed.inject(ThemeService).setTheme('bleu');
    fixture.detectChanges();
    expect(root.querySelector('img.toolbar-logo')?.getAttribute('src')).toBe('images/logo-horizontal-bleu.svg');
  });

  it('en mobile : icône seule, plus de titre ni de libellés, navigation accessible par title/aria-label', () => {
    const { root } = create(true, 'xsmall');
    expect(root.querySelector('img.toolbar-logo')?.getAttribute('src')).toBe('images/logo.svg');
    expect(root.querySelector('.toolbar-title')).toBeNull();
    const links = Array.from(root.querySelectorAll('mat-toolbar a'));
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['Utilisateurs', 'Journal', 'Informations sur vos données personnelles']);
    expect(links.map((l) => l.textContent?.trim())).toEqual(['people', 'history', 'info']);
  });

  it('le bouton de déconnexion appelle CasAuthService.logout', () => {
    const { root } = create(true);
    const logout = vi.spyOn(TestBed.inject(CasAuthService), 'logout').mockImplementation(() => undefined);
    (root.querySelector('button[title="Déconnexion"]') as HTMLButtonElement).click();
    expect(logout).toHaveBeenCalled();
  });
});
