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
 * Contrats des gardes de routes : `casAuthGuard` laisse passer un agent connecté et renvoie sinon vers
 * l'accueil (sans connexion CAS automatique) ; `adminGuard` réserve en plus la page au profil
 * administrateur (consultation renvoyé vers `/users`, visiteur vers l'accueil). `CasAuthService` est
 * remplacé par une doublure à deux méthodes.
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { adminGuard, casAuthGuard } from './cas-auth.guard';
import { CasAuthService } from './cas-auth.service';

function runGuard(authenticated: boolean): boolean | UrlTree {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CasAuthService, useValue: { isAuthenticated: () => authenticated } }],
  });
  return TestBed.runInInjectionContext(
    () => casAuthGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as boolean | UrlTree,
  );
}

describe('casAuthGuard', () => {
  it('laisse passer un agent authentifié', () => {
    expect(runGuard(true)).toBe(true);
  });

  it('renvoie vers l\'accueil sans session, sans déclencher de connexion CAS automatique', () => {
    const result = runGuard(false);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});

describe('adminGuard', () => {
  function run(authenticated: boolean, admin: boolean): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CasAuthService, useValue: { isAuthenticated: () => authenticated, isAdmin: () => admin } },
      ],
    });
    return TestBed.runInInjectionContext(
      () => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as boolean | UrlTree,
    );
  }

  it('laisse passer un administrateur', () => {
    expect(run(true, true)).toBe(true);
  });

  it('renvoie un profil consultation vers la liste', () => {
    const result = run(true, false);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/users');
  });

  it("renvoie un visiteur sans session vers l'accueil", () => {
    const result = run(false, false);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
