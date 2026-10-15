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
 * Contrats de `CasAuthService` : le miroir de session (`sessionStorage`) n'est qu'un cache d'affichage,
 * la session s'ouvre uniquement après validation du ticket par le BFF (`POST /bff/session`) et les
 * trois issues `ok` / `invalide` / `non-habilite` sont distinguées. Vérifie les profils admin et
 * consultation (dont le repli en lecture seule d'un ancien cache sans rôle) et la déconnexion.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CasAuthService } from './cas-auth.service';

const SESSION_KEY = 'totp-admin-cas-session';

function setup(): { service: CasAuthService; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { service: TestBed.inject(CasAuthService), http: TestBed.inject(HttpTestingController) };
}

describe('CasAuthService', () => {
  beforeEach(() => sessionStorage.clear());

  it('est non authentifié sans session mémorisée', () => {
    const { service } = setup();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.username()).toBeNull();
  });

  it('reprend la session mémorisée dans sessionStorage (cache d\'affichage)', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: 'alice' }));
    const { service } = setup();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.username()).toBe('alice');
  });

  it('ignore un sessionStorage corrompu', () => {
    sessionStorage.setItem(SESSION_KEY, '{pas du json');
    const { service } = setup();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('valide le ticket via le BFF, ouvre la session et la mémorise', () => {
    const { service, http } = setup();
    let result: string | undefined;
    service.validateTicket('ST-1').subscribe((r) => (result = r));

    const request = http.expectOne('/bff/session');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ticket: 'ST-1',
      service: window.location.origin + window.location.pathname,
    });
    request.flush({ username: 'alice', role: 'admin' });

    expect(result).toBe('ok');
    expect(service.username()).toBe('alice');
    expect(service.role()).toBe('admin');
    expect(service.isAdmin()).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}')).toEqual({ username: 'alice', role: 'admin' });
  });

  it('refuse un ticket rejeté par le BFF : aucune session ouverte', () => {
    const { service, http } = setup();
    let result: string | undefined;
    service.validateTicket('ST-ko').subscribe((r) => (result = r));

    http.expectOne('/bff/session').flush({ error: 'ticket invalide' }, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBe('invalide');
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('logout efface immédiatement la session locale puis ferme celle du module BFF', () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: 'alice' }));
    const { service, http } = setup();

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    const request = http.expectOne('/bff/logout');
    expect(request.request.method).toBe('POST');
    // Pas de flush : la suite (redirection vers CAS) navigue hors de la page.
  });

  it('agent authentifié mais non habilité (403) : aucune session, résultat distinct', () => {
    const { service, http } = setup();
    let result: string | undefined;
    service.validateTicket('ST-x').subscribe((r) => (result = r));
    http.expectOne('/bff/session').flush({ error: 'agent non habilité' }, { status: 403, statusText: 'Forbidden' });
    expect(result).toBe('non-habilite');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('profil consultation : connecté mais pas administrateur', () => {
    const { service, http } = setup();
    service.validateTicket('ST-l').subscribe();
    http.expectOne('/bff/session').flush({ username: 'bob', role: 'consultation' });
    expect(service.isAuthenticated()).toBe(true);
    expect(service.role()).toBe('consultation');
    expect(service.isAdmin()).toBe(false);
  });

  it("cache d'affichage d'avant les profils (sans rôle) : traité en lecture seule", () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: 'alice' }));
    const { service } = setup();
    expect(service.role()).toBe('consultation');
    expect(service.isAdmin()).toBe(false);
  });
});
