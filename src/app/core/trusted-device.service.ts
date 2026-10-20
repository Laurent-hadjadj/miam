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


import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TrustedDevice } from './models';

/**
 * Appareils de confiance (cookie MFATRUSTED) - endpoint actuator
 * `multifactorTrustedDevices` (MultifactorAuthenticationTrustReportEndpoint,
 * confirmé par décompilation CAS 6.6.15.2). Routes et verbes exacts :
 *   GET    /multifactorTrustedDevices              -> devices()
 *   GET    /multifactorTrustedDevices/{username}   -> devicesForUser(username)
 *   DELETE /multifactorTrustedDevices/{key}        -> revoke(recordKey)
 * Pas d'export/import côté CAS pour cet endpoint (contrairement à
 * gauthCredentialRepository) - uniquement liste et révocation.
 */
@Injectable({ providedIn: 'root' })
export class TrustedDeviceService {
  private readonly baseUrl = `${API_BASE_URL}/multifactorTrustedDevices`;

  constructor(private readonly http: HttpClient) { }

  /** Liste tous les appareils de confiance. */
  getAll(): Observable<TrustedDevice[]> {
    return this.http.get<TrustedDevice[]>(this.baseUrl);
  }

  /**
   * Liste les appareils de confiance d'un utilisateur ; l'identifiant est encodé dans l'URL.
   *
   * @param username identifiant de l'utilisateur.
   */
  getByUsername(username: string): Observable<TrustedDevice[]> {
    return this.http.get<TrustedDevice[]>(`${this.baseUrl}/${encodeURIComponent(username)}`);
  }

  /**
   * Révoque un appareil de confiance.
   *
   * @param recordKey clé de l'appareil (champ `recordKey` de TrustedDevice), pas le nom. Elle est
   *   encodée dans l'URL car elle contient des caractères réservés (`@`, espaces, parfois `/`).
   * @param principal identifiant de l'utilisateur, passé en query string pour l'audit (le BFF l'utilise
   *   pour journaliser le compte concerné au lieu du recordKey).
   */
  revoke(recordKey: string, principal?: string): Observable<void> {
    const url = `${this.baseUrl}/${encodeURIComponent(recordKey)}`;
    if (principal) {
      const params = new HttpParams().set('principal', principal);
      return this.http.delete<void>(url, { params });
    }
    return this.http.delete<void>(url);
  }
}
