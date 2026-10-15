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
 * Contrats HTTP des services d'accès aux données (comptes TOTP, appareils de confiance, sessions SSO,
 * journal d'activité) : routes, verbes, encodage des identifiants dans l'URL, extraction des tableaux
 * des réponses (`[]` si absents) et paramètres de requête. Le navigateur ne parle qu'au module BFF
 * (`/api`, `/bff`), jamais à l'API Actuator du serveur CAS : les requêtes sont simulées par `HttpTestingController`.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuditLogService } from './audit-log.service';
import { GauthCredentialService } from './gauth-credential.service';
import { SsoSessionService } from './sso-session.service';
import { TrustedDeviceService } from './trusted-device.service';

describe('Services d\'accès à l\'actuator (via le BFF)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('GauthCredentialService', () => {
    it('liste tous les comptes, puis ceux d\'un utilisateur (identifiant encodé)', () => {
      const service = TestBed.inject(GauthCredentialService);
      service.getAll().subscribe();
      http.expectOne({ method: 'GET', url: '/api/gauthCredentialRepository' }).flush([]);
      service.getByUsername('a b/c').subscribe();
      http.expectOne({ method: 'GET', url: '/api/gauthCredentialRepository/a%20b%2Fc' }).flush([]);
    });

    it('supprime les comptes d\'un utilisateur par son identifiant', () => {
      TestBed.inject(GauthCredentialService).deleteByUsername('alice').subscribe();
      http.expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' }).flush(null);
    });
  });

  describe('TrustedDeviceService', () => {
    it('liste les appareils, tous ou ceux d\'un utilisateur', () => {
      const service = TestBed.inject(TrustedDeviceService);
      service.getAll().subscribe();
      http.expectOne({ method: 'GET', url: '/api/multifactorTrustedDevices' }).flush([]);
      service.getByUsername('alice').subscribe();
      http.expectOne({ method: 'GET', url: '/api/multifactorTrustedDevices/alice' }).flush([]);
    });

    it('révoque par recordKey, encodé dans l\'URL (il contient @, espaces et parfois /)', () => {
      TestBed.inject(TrustedDeviceService).revoke('alice@Poste 13/10/2026@fp').subscribe();
      http
        .expectOne({ method: 'DELETE', url: '/api/multifactorTrustedDevices/alice%40Poste%2013%2F10%2F2026%40fp' })
        .flush(null);
    });
  });

  describe('SsoSessionService', () => {
    it('extrait activeSsoSessions de la réponse, [] si absent', () => {
      const service = TestBed.inject(SsoSessionService);
      let sessions: unknown[] | undefined;
      service.getAll().subscribe((value) => (sessions = value));
      http.expectOne('/api/ssoSessions').flush({ activeSsoSessions: [{ ticket_granting_ticket: 'TGT-1' }] });
      expect(sessions).toEqual([{ ticket_granting_ticket: 'TGT-1' }]);

      service.getAll().subscribe((value) => (sessions = value));
      http.expectOne('/api/ssoSessions').flush({});
      expect(sessions).toEqual([]);
    });

    it('filtre par username via la query string', () => {
      TestBed.inject(SsoSessionService).getByUsername('alice').subscribe();
      const request = http.expectOne((r) => r.url === '/api/ssoSessions');
      expect(request.request.params.get('username')).toBe('alice');
      request.flush({ activeSsoSessions: [] });
    });

    it('révoque un TGT en transmettant le principal (pour le journal du module BFF)', () => {
      TestBed.inject(SsoSessionService).revoke('TGT-1-abc', 'alice').subscribe();
      const request = http.expectOne((r) => r.url === '/api/ssoSessions/TGT-1-abc');
      expect(request.request.method).toBe('DELETE');
      expect(request.request.params.get('principal')).toBe('alice');
      request.flush(null);
    });
  });

  describe('AuditLogService', () => {
    it('lit /bff/audit-log et extrait les entrées, [] si absentes', () => {
      const service = TestBed.inject(AuditLogService);
      let entries: unknown[] | undefined;
      service.getAll().subscribe((value) => (entries = value));
      http.expectOne('/bff/audit-log').flush({ entries: [{ actor: 'alice' }] });
      expect(entries).toEqual([{ actor: 'alice' }]);

      service.getAll().subscribe((value) => (entries = value));
      http.expectOne('/bff/audit-log').flush({});
      expect(entries).toEqual([]);
    });
  });
});
