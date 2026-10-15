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
 * Contrat de `AccountAdminService` : la suppression d'un compte TOTP est en cascade. Les appareils de
 * confiance de l'utilisateur (et d'eux seuls) sont révoqués d'abord, puis le compte est supprimé ;
 * si une révocation échoue, le compte est conservé. Vérifie aussi `isCurrentUser`. Requêtes HTTP
 * simulées (`HttpTestingController`), aucun réseau réel.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccountAdminService } from './account-admin.service';
import { TrustedDevice } from './models';

/** Appareil minimal ; le nom entre dans la `recordKey`, ce qui rend chaque URL de révocation distincte. */
function device(principal: string, name: string): TrustedDevice {
  return {
    id: 1,
    principal,
    deviceFingerprint: 'fp',
    recordDate: '2026-10-01T08:00:00Z',
    recordKey: `${principal}@${name}@fp`,
    name,
    expirationDate: '2026-10-01T20:00:00Z',
  };
}

describe('AccountAdminService', () => {
  let service: AccountAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AccountAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('révoque d\'abord les appareils de l\'utilisateur (et eux seuls), puis supprime le compte', () => {
    let done = false;
    service
      .deleteAccountWithDevices('alice', [device('alice', 'PC'), device('bob', 'Mac'), device('alice', 'Mobile')])
      .subscribe(() => (done = true));

    http.expectOne('/api/multifactorTrustedDevices/alice%40PC%40fp').flush(null);
    // La suppression du compte n'est demandée qu'une fois TOUTES les révocations terminées.
    http.expectNone('/api/gauthCredentialRepository/alice');
    http.expectOne('/api/multifactorTrustedDevices/alice%40Mobile%40fp').flush(null);

    http.expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' }).flush(null);
    expect(done).toBe(true);
  });

  it('sans appareil, supprime directement le compte', () => {
    service.deleteAccountWithDevices('alice', []).subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' }).flush(null);
  });

  it('si une révocation échoue, le compte n\'est PAS supprimé (pas d\'appareil orphelin déguisé)', () => {
    let error: unknown;
    service.deleteAccountWithDevices('alice', [device('alice', 'PC')]).subscribe({ error: (e) => (error = e) });

    http
      .expectOne('/api/multifactorTrustedDevices/alice%40PC%40fp')
      .flush(null, { status: 500, statusText: 'Server Error' });

    http.expectNone('/api/gauthCredentialRepository/alice');
    expect(error).toBeTruthy();
  });

  it('reconnaît le compte de l\'agent connecté', () => {
    // La session est lue à l'instanciation de CasAuthService : on la pose avant de recréer le module de test.
    sessionStorage.setItem('totp-admin-cas-session', JSON.stringify({ username: 'alice' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fresh = TestBed.inject(AccountAdminService);
    expect(fresh.isCurrentUser('alice')).toBe(true);
    expect(fresh.isCurrentUser('bob')).toBe(false);
  });
});
