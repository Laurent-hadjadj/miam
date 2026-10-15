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


import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { filter, switchMap } from 'rxjs';
import { ConfirmService } from '../core/confirm.service';
import { NotificationService } from '../core/notification.service';
import { CasAuthService } from '../core/cas-auth.service';
import { AccountAdminService } from '../core/account-admin.service';
import { GauthCredentialService } from '../core/gauth-credential.service';
import { TrustedDeviceService } from '../core/trusted-device.service';
import { SsoSessionService } from '../core/sso-session.service';
import { TotpAccount, TrustedDevice, SsoSession } from '../core/models';

/**
 * Fiche d'un utilisateur : ses comptes TOTP, ses appareils de confiance et ses sessions SSO, avec les
 * actions de déblocage (suppression du compte, révocation d'un appareil ou d'une session).
 *
 * Route : `users/:username` (protégée par `casAuthGuard`). L'identifiant est lu une seule fois dans
 * l'URL à la création (instantané de la route) : aller d'une fiche à une autre sans quitter la page ne
 * relit pas le paramètre. Aucune entrée ni sortie. Dépendances : les services d'accès à l'API actuator
 * (via le BFF), AccountAdminService (suppression en cascade), ConfirmService (confirmation),
 * NotificationService (résultat annoncé aux lecteurs d'écran), CasAuthService (profil, déconnexion).
 *
 * Profil : l'administration voit les boutons de suppression et de révocation ; la consultation ne
 * voit que les données. Masquer ces boutons n'est qu'un confort, le BFF refuse de toute façon une
 * suppression hors profil administration (403).
 *
 * Accessibilité : l'état de session du titre est rendu en couleur ET en forme (disque plein ou
 * contour vide) ET en texte réservé aux lecteurs d'écran ; chaque bouton d'action porte un nom
 * accessible explicite (l'emoji est masqué) ; les résultats passent par la zone live de Notification.
 */
@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './user-details.html',
  styleUrl: './user-details.css',
})
export class UserDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly casAuth = inject(CasAuthService);
  private readonly accountAdmin = inject(AccountAdminService);
  private readonly gauthService = inject(GauthCredentialService);
  private readonly trustedDeviceService = inject(TrustedDeviceService);
  private readonly ssoSessionService = inject(SsoSessionService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  /** Profil administrateur : seul à voir les boutons de suppression / révocation. */
  readonly isAdmin = this.casAuth.isAdmin;

  /** Identifiant de l'utilisateur affiché (paramètre `:username` de l'URL) ; vide si absent. */
  readonly username = signal('');
  /** Vrai tant que le chargement n'est pas terminé (voir `reload` pour la définition exacte). */
  readonly loading = signal(false);
  /** Comptes TOTP de l'utilisateur. */
  readonly accounts = signal<TotpAccount[]>([]);
  /** Appareils de confiance de l'utilisateur. */
  readonly devices = signal<TrustedDevice[]>([]);
  /** Sessions SSO actives de l'utilisateur. */
  readonly sessions = signal<SsoSession[]>([]);
  /** Vrai si l'utilisateur a au moins une session SSO active : pilote la pastille du titre. */
  readonly hasActiveSession = computed(() => this.sessions().length > 0);

  /** Lit l'identifiant dans l'URL et charge les données ; sans identifiant, la page reste vide. */
  constructor() {
    const username = this.route.snapshot.paramMap.get('username');
    if (username) {
      this.username.set(username);
      this.reload();
    }
  }

  /**
   * Relit en parallèle comptes, appareils et sessions de l'utilisateur. Chaque échec est annoncé
   * séparément et laisse la liste correspondante telle quelle. L'indicateur de chargement s'arrête
   * à la réponse de la requête des sessions (la dernière déclarée), sans attendre les deux autres.
   */
  reload(): void {
    const username = this.username();
    this.loading.set(true);
    this.gauthService.getByUsername(username).subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: () => this.notify('Impossible de charger les comptes TOTP de cet utilisateur.'),
    });
    this.trustedDeviceService.getByUsername(username).subscribe({
      next: (devices) => this.devices.set(devices),
      error: () => this.notify('Impossible de charger les appareils de confiance de cet utilisateur.'),
    });
    this.ssoSessionService.getByUsername(username).subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: () => {
        this.notify('Impossible de charger les sessions SSO de cet utilisateur.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Supprime le compte TOTP après confirmation, avec tous les appareils de confiance de l'utilisateur.
   *
   * Pourquoi en cascade : l'API Actuator ne supprime que par identifiant, donc TOUS les comptes TOTP de
   * l'utilisateur ; ses appareils sont révoqués d'abord (voir `AccountAdminService`), sinon ils
   * resteraient orphelins et laisseraient contourner le second facteur. Le message de confirmation
   * annonce le nombre d'appareils concernés.
   *
   * Si l'agent supprime SON propre compte, le MFA ne pourrait plus revalider sa session : il est
   * déconnecté tout de suite au lieu de recharger la page. Sinon la fiche est rechargée.
   */
  deleteAccount(account: TotpAccount): void {
    const deviceCount = this.devices().length;
    const warning = deviceCount > 0 ? ` et ${deviceCount} appareil(s) de confiance associé(s)` : '';
    this.confirmService
      .ask({
        title: 'Supprimer le compte TOTP',
        message: `Supprimer tous les comptes TOTP de "${account.username}"${warning} ?`,
        confirmLabel: 'Supprimer',
        confirmEmoji: '🗑️',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.accountAdmin.deleteAccountWithDevices(account.username, this.devices())),
      )
      .subscribe({
        next: () => {
          if (this.accountAdmin.isCurrentUser(account.username)) {
            this.notify('Votre compte TOTP a été supprimé - déconnexion en cours.');
            this.casAuth.logout();
            return;
          }
          this.notify('Compte(s) TOTP et appareils de confiance associés supprimés.');
          this.reload();
        },
        error: () => this.notify('Échec de la suppression du compte TOTP.'),
      });
  }

  /** Révoque un appareil de confiance (par sa clé d'enregistrement) après confirmation, puis recharge la fiche. */
  revokeDevice(device: TrustedDevice): void {
    this.confirmService
      .ask({
        title: "Révoquer l'appareil de confiance",
        message: `Révoquer l'appareil "${device.name}" ?`,
        confirmLabel: 'Révoquer',
        confirmEmoji: '🗑️',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.trustedDeviceService.revoke(device.recordKey)),
      )
      .subscribe({
        next: () => {
          this.notify('Appareil révoqué.');
          this.reload();
        },
        error: () => this.notify("Échec de la révocation de l'appareil."),
      });
  }

  /**
   * Révoque une session SSO (TGT) - vraie déconnexion (SLO) côté CAS. Utile
   * notamment pour débloquer un compte resté bloqué sur un contournement MFA
   * mémorisé sur le TGT (voir SsoSessionService) : supprimer le compte TOTP
   * ou les appareils de confiance seuls ne suffit pas toujours.
   */
  revokeSession(session: SsoSession): void {
    this.confirmService
      .ask({
        title: 'Révoquer la session SSO',
        message: `Révoquer la session de "${session.authenticated_principal}" ?`,
        confirmLabel: 'Révoquer',
        confirmEmoji: '🗑️',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.ssoSessionService.revoke(session.ticket_granting_ticket, session.authenticated_principal)),
      )
      .subscribe({
        next: () => {
          this.notify('Session révoquée.');
          this.reload();
        },
        error: () => this.notify('Échec de la révocation de la session.'),
      });
  }

  /** Adresses des applications ouvertes dans la session, séparées par une virgule ; vide si aucune. */
  sessionServices(session: SsoSession): string {
    return Object.values(session.authenticated_services ?? {})
      .map((s) => s.originalUrl)
      .join(', ');
  }

  /** Retourne à la liste des utilisateurs (destination fixe, contrairement à l'historique du navigateur). */
  onBack(): void {
    this.router.navigate(['/users']);
  }

  /** Annonce un message dans la zone live `<output>` de NotificationService. */
  private notify(message: string): void {
    this.notifications.show(message);
  }
}
