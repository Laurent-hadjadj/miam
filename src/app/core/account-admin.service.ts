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

import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { CasAuthService } from './cas-auth.service';
import { GauthCredentialService } from './gauth-credential.service';
import { TrustedDeviceService } from './trusted-device.service';
import { TrustedDevice } from './models';

/**
 * Suppression d'un compte TOTP avec ses appareils de confiance.
 *
 * L'API Actuator ne supprime un compte TOTP que par `username` (pas par id
 * d'appareil) : ceci retire TOUS les comptes TOTP de l'utilisateur. On
 * révoque donc d'abord tous ses appareils de confiance, sans quoi ils
 * resteraient orphelins (un enregistrement de confiance sans compte TOTP
 * pour valider le MFA et laissant contourner le code). Si une révocation
 * échoue, le compte n'est pas supprimé.
 */
@Injectable({ providedIn: 'root' })
export class AccountAdminService {
  private readonly gauthService = inject(GauthCredentialService);
  private readonly trustedDeviceService = inject(TrustedDeviceService);
  private readonly casAuth = inject(CasAuthService);

  /**
   * Supprime en cascade : révoque les appareils de confiance de `username`, puis son compte TOTP.
   *
   * @param username identifiant de l'utilisateur dont le compte TOTP est supprimé.
   * @param devices appareils connus de la page appelante ; seuls ceux dont `principal` vaut
   *   `username` sont révoqués (les autres sont ignorés). Les révocations partent en parallèle ;
   *   la suppression du compte n'est demandée qu'une fois toutes terminées.
   * @returns un flux qui émet puis se termine à la fin de la suppression du compte. Il échoue dès
   *   qu'une révocation échoue, et le compte n'est alors pas supprimé.
   */
  deleteAccountWithDevices(username: string, devices: TrustedDevice[]): Observable<void> {
    const revocations = devices
      .filter((device) => device.principal === username)
      .map((device) => this.trustedDeviceService.revoke(device.recordKey));
    return forkJoin(revocations.length > 0 ? revocations : [of(null)]).pipe(
      switchMap(() => this.gauthService.deleteByUsername(username)),
    );
  }

  /** Vrai si le compte visé est celui de l'agent actuellement connecté à l'application. */
  isCurrentUser(username: string): boolean {
    return username === this.casAuth.username();
  }
}
