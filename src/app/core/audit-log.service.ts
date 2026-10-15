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
import { Observable, map } from 'rxjs';
import { AuditLogEntry } from './models';

interface AuditLogResponse {
  entries: AuditLogEntry[];
}

/**
 * Journal d'activité (qui a supprimé quel compte TOTP / appareil / session,
 * et quand) - endpoint propre au BFF (server/app.js, SQLite), pas un
 * endpoint actuator CAS. Voir server/app.js pour le détail : CAS ne peut
 * pas tracer qui agit réellement (compte actuator technique partagé), seul
 * le BFF connaît l'identité de l'agent authentifié par session.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  constructor(private readonly http: HttpClient) { }

  /**
   * Lit le journal d'activité complet via `GET /bff/audit-log` (réservé au profil administrateur,
   * contrôlé par le BFF).
   *
   * @returns les entrées telles que fournies par le BFF, ou `[]` si la réponse n'en contient pas.
   */
  getAll(): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogResponse>('/bff/audit-log').pipe(map((response) => response.entries ?? []));
  }
}
