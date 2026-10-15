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
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { CasAuthService } from '../core/cas-auth.service';
import { ThemeService } from '../core/theme.service';
import { clearThemeCookie, fakeResponsive } from '../../testing/fakes';
import { Home } from './home';

/**
 * Vérifie la page d'accueil publique : contenu et logo (thème, palier responsive), redirection d'un
 * agent déjà connecté, traitement du ticket CAS au retour (retrait de l'URL, validation par le BFF
 * simulé avec `HttpTestingController`, succès, indicateur d'attente, échec avec nouvel essai).
 * La navigation du Router est espionnée (et, au dernier test, la redirection vers CAS) : aucune
 * navigation réelle n'a lieu.
 */
describe('Home', () => {
  // Isolation : la session (sessionStorage), le cookie de thème et l'URL (ticket) persistent entre tests.
  beforeEach(() => {
    sessionStorage.clear();
    clearThemeCookie();
    window.history.replaceState({}, '', '/');
  });
  afterEach(() => {
    clearThemeCookie();
    window.history.replaceState({}, '', '/');
  });

  function setup(breakpoint: 'large' | 'xsmall' = 'large') {
    const responsive = fakeResponsive(breakpoint);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), responsive.provider],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);
    return { navigate, http, responsive };
  }

  it('affiche l\'accueil public : titre, bouton de connexion et logo vertical', async () => {
    setup();
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toBe('Bienvenue,');
    expect(root.querySelector('.login-button')?.textContent).toContain('Se connecter');
    expect(root.querySelector('.hero-illustration img')?.getAttribute('src')).toBe('images/logo-vertical.svg');
  });

  it('le logo vertical suit le thème et sa taille le point de rupture (classe CSS, pas de style inline)', async () => {
    const { responsive } = setup();
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const illustration = (fixture.nativeElement as HTMLElement).querySelector('.hero-illustration') as HTMLElement;

    expect(illustration.classList).toContain('size-large');
    responsive.breakpoint.set('xsmall');
    TestBed.inject(ThemeService).setTheme('bleu');
    fixture.detectChanges();

    expect(illustration.classList).toContain('size-xsmall');
    expect(illustration.getAttribute('style')).toBeNull();
    expect(illustration.querySelector('img')?.getAttribute('src')).toBe('images/logo-vertical-bleu.svg');
  });

  it('un agent déjà connecté est renvoyé directement vers la gestion', async () => {
    sessionStorage.setItem('totp-admin-cas-session', JSON.stringify({ username: 'alice' }));
    const { navigate, http } = setup();
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/users');
    http.expectNone('/bff/session');
  });

  it('retour de CAS avec un ticket valide : retire le ticket de l\'URL, valide via le BFF, ouvre la gestion', async () => {
    window.history.replaceState({}, '', '/?ticket=ST-1');
    const { navigate, http } = setup();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(window.location.search).toBe('');
    http.expectOne('/bff/session').flush({ username: 'alice' });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/users');
  });

  it('pendant la validation, affiche un indicateur à la place du bouton', async () => {
    window.history.replaceState({}, '', '/?ticket=ST-1');
    const { http } = setup();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('output.status')?.textContent).toContain('Vérification');
    expect(root.querySelector('.login-button')).toBeNull();
    http.expectOne('/bff/session').flush({ username: 'alice' });
  });

  it('ticket refusé : message d\'erreur, on reste sur l\'accueil et on peut réessayer', async () => {
    window.history.replaceState({}, '', '/?ticket=ST-ko');
    const { navigate, http } = setup();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    http.expectOne('/bff/session').flush({ error: 'ticket invalide' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('La connexion a échoué');
    expect(navigate).not.toHaveBeenCalled();

    const redirect = vi.spyOn(TestBed.inject(CasAuthService), 'redirectToLogin').mockImplementation(() => undefined);
    (root.querySelector('.login-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(redirect).toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });
});
