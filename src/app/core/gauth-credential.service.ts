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


import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TotpAccount } from './models';

/**
 * Enrôlement TOTP - accès via le module BFF (`/api`), qui relaie vers l'endpoint actuator `gauthCredentialRepository`
 * (GoogleAuthenticatorTokenCredentialRepositoryEndpoint, confirmé par
 * décompilation CAS 6.6.15.2). Routes et verbes exacts :
 *   GET    /gauthCredentialRepository              -> load()
 *   GET    /gauthCredentialRepository/{username}   -> get(username)
 *   DELETE /gauthCredentialRepository/{username}   -> delete(username)
 */
@Injectable({ providedIn: 'root' })
export class GauthCredentialService {
  private readonly baseUrl = `${API_BASE_URL}/gauthCredentialRepository`;

  constructor(private readonly http: HttpClient) { }

  /** Liste tous les comptes TOTP (`GET /api/gauthCredentialRepository`). */
  getAll(): Observable<TotpAccount[]> {
    return this.http.get<TotpAccount[]>(this.baseUrl);
  }

  /**
   * Liste les comptes TOTP d'un utilisateur ; l'identifiant est encodé dans l'URL.
   *
   * @param username identifiant de l'utilisateur.
   */
  getByUsername(username: string): Observable<TotpAccount[]> {
    return this.http.get<TotpAccount[]>(`${this.baseUrl}/${encodeURIComponent(username)}`);
  }

  /**
   * Supprime TOUS les comptes TOTP de l'utilisateur (l'API Actuator ne sait pas supprimer par appareil).
   * Pour supprimer aussi ses appareils de confiance, passer par `AccountAdminService`.
   *
   * @param username identifiant de l'utilisateur.
   */
  deleteByUsername(username: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(username)}`);
  }
}
