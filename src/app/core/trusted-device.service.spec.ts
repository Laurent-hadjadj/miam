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
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TrustedDeviceService } from './trusted-device.service';

describe('TrustedDeviceService', () => {
  let service: TrustedDeviceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), TrustedDeviceService],
    });
    service = TestBed.inject(TrustedDeviceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('liste tous les appareils de confiance', () => {
    service.getAll().subscribe((devices) => {
      expect(devices).toHaveLength(1);
      expect(devices[0].recordKey).toBe('key1');
    });
    const req = httpMock.expectOne('/api/multifactorTrustedDevices');
    expect(req.request.method).toBe('GET');
    req.flush([{ recordKey: 'key1' }]);
  });

  it('liste les appareils d\'un utilisateur avec encodage URL', () => {
    service.getByUsername('alice+test').subscribe((devices) => {
      expect(devices).toHaveLength(1);
    });
    const req = httpMock.expectOne('/api/multifactorTrustedDevices/alice%2Btest');
    expect(req.request.method).toBe('GET');
    req.flush([{ recordKey: 'key1' }]);
  });

  it('révoque un appareil sans principal', () => {
    service.revoke('key%40Poste').subscribe(() => {});
    const req = httpMock.expectOne('/api/multifactorTrustedDevices/key%2540Poste');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.has('principal')).toBe(false);
    req.flush(null);
  });

  it('révoque un appareil avec principal (query string)', () => {
    service.revoke('key@Poste', 'alice').subscribe(() => {});
    const req = httpMock.expectOne((r) =>
      r.url === '/api/multifactorTrustedDevices/key%40Poste' &&
      r.params.get('principal') === 'alice',
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
