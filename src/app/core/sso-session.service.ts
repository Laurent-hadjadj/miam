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
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { SsoSession } from './models';

interface SsoSessionsResponse {
  activeSsoSessions: SsoSession[];
}

/**
 * Sessions SSO (TGT) - endpoint actuator `ssoSessions`
 * (SingleSignOnSessionsEndpoint, confirmé par décompilation CAS 6.6.15.2).
 * Utile notamment pour débloquer un compte resté bloqué sur un contournement
 * MFA (`MULTIFACTOR_AUTHENTICATION_BYPASS`) tant que son TGT existant n'est
 * pas détruit - supprimer le compte TOTP ou les appareils de confiance seuls
 * ne suffit pas, la décision de contournement reste mémorisée sur le TGT.
 * Routes et verbes exacts :
 *   GET    /ssoSessions?username={u}           -> liste (filtrée si fournie)
 *   DELETE /ssoSessions/{ticketGrantingTicket}  -> révoque une session (vraie SLO)
 */
@Injectable({ providedIn: 'root' })
export class SsoSessionService {
  private readonly baseUrl = `${API_BASE_URL}/ssoSessions`;

  constructor(private readonly http: HttpClient) { }

  /** Liste toutes les sessions SSO actives ; `[]` si la réponse n'en contient pas. */
  getAll(): Observable<SsoSession[]> {
    return this.http
      .get<SsoSessionsResponse>(this.baseUrl)
      .pipe(map((response) => response.activeSsoSessions ?? []));
  }

  /**
   * Liste les sessions SSO actives d'un utilisateur (filtre `username` en query string) ; `[]` si absentes.
   *
   * @param username identifiant de l'utilisateur.
   */
  getByUsername(username: string): Observable<SsoSession[]> {
    const params = new HttpParams().set('username', username);
    return this.http
      .get<SsoSessionsResponse>(this.baseUrl, { params })
      .pipe(map((response) => response.activeSsoSessions ?? []));
  }

  /**
   * Révoque une session SSO (destruction du TGT).
   *
   * @param ticketGrantingTicket identifiant du TGT, encodé dans l'URL.
   * @param principal utilisateur propriétaire de la session, passé en query string pour le seul
   *   besoin du journal d'activité du module BFF (/bff/audit-log) - le TGT seul ne permet pas de
   *   retrouver l'identité de la session révoquée (contrairement au recordKey d'un appareil de
   *   confiance). Ignoré par l'API Actuator du serveurCAS lui-même.
   */
  revoke(ticketGrantingTicket: string, principal: string): Observable<void> {
    const params = new HttpParams().set('principal', principal);
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(ticketGrantingTicket)}`, { params });
  }
}
