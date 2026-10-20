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
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { filter, switchMap } from 'rxjs';
import { ConfirmService } from '../core/confirm.service';
import { NotificationService } from '../core/notification.service';
import { SearchBar } from '../search-bar/search-bar';
import { CasAuthService } from '../core/cas-auth.service';
import { AccountAdminService } from '../core/account-admin.service';
import { GauthCredentialService } from '../core/gauth-credential.service';
import { TrustedDeviceService } from '../core/trusted-device.service';
import { SsoSessionService } from '../core/sso-session.service';
import { AuditLogService } from '../core/audit-log.service';
import { TotpAccount, TrustedDevice, SsoSession, AuditLogEntry } from '../core/models';

/** Taille de page initiale de chacun des trois tableaux (première valeur de `pageSizeOptions`). */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Page principale de la console : trois onglets (comptes TOTP, appareils de confiance, sessions SSO)
 * avec compteurs, recherche commune et actions de déblocage.
 *
 * Route : `users` (protégée par `casAuthGuard`). Aucune entrée ni sortie. Dépendances : les services
 * d'accès à l'API Actuator (via le BFF), AuditLogService (compteur du journal, administration seulement),
 * AccountAdminService (suppression en cascade), ConfirmService, NotificationService, CasAuthService
 * (profil, déconnexion), Router (fiche d'un utilisateur) et SearchBar.
 *
 * Données : les trois listes sont chargées en entier, puis filtrées et paginées dans le navigateur
 * (la recherche ne déclenche aucun appel). La recherche porte sur l'identifiant et le nom d'appareil
 * (l'identifiant seul pour les sessions) ; les compteurs du bandeau, eux, ne sont jamais filtrés.
 *
 * Profil : l'administration voit les boutons de suppression et de révocation et le compteur du
 * journal, et déclenche la lecture du journal ; la consultation reste en lecture seule et ne
 * sollicite pas le journal. Masquer les boutons n'est qu'un confort : le BFF refuse de toute façon
 * (403) une suppression ou la lecture du journal hors profil administration.
 *
 * Accessibilité : titre de page réservé aux lecteurs d'écran, statistiques regroupées (`role="group"`),
 * tableaux et paginateurs nommés, pastille de session en couleur ET en forme (disque plein ou contour
 * vide) ET en texte réservé aux lecteurs d'écran, boutons à nom accessible explicite (l'emoji est
 * masqué), résultats annoncés par la zone live de Notification.
 */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatTabsModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    SearchBar,
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
})
export class UserList {
  private readonly casAuth = inject(CasAuthService);
  private readonly accountAdmin = inject(AccountAdminService);
  private readonly gauthService = inject(GauthCredentialService);
  private readonly trustedDeviceService = inject(TrustedDeviceService);
  private readonly ssoSessionService = inject(SsoSessionService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly router = inject(Router);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  /** Profil administrateur : seul à voir les boutons de suppression/révocation, le compteur et le journal. */
  readonly isAdmin = this.casAuth.isAdmin;

  /** Vrai pendant le chargement (voir `reload` pour savoir quelle réponse le termine). */
  readonly loading = signal(false);
  /** Texte de recherche commun aux trois onglets. */
  readonly searchTerm = signal('');

  /** Listes complètes telles que reçues, avant filtrage et pagination. */
  private readonly accounts = signal<TotpAccount[]>([]);
  private readonly devices = signal<TrustedDevice[]>([]);
  private readonly sessions = signal<SsoSession[]>([]);
  /** Journal d'activité, chargé seulement pour le profil administration (sert au compteur). */
  private readonly auditLog = signal<AuditLogEntry[]>([]);

  /** Page affichée et taille de page de chaque onglet, indépendantes les unes des autres. */
  readonly accountsPageIndex = signal(0);
  readonly accountsPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly devicesPageIndex = signal(0);
  readonly devicesPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sessionsPageIndex = signal(0);
  readonly sessionsPageSize = signal(DEFAULT_PAGE_SIZE);

  /** Comptes TOTP dont l'identifiant ou le nom d'appareil contient la recherche (insensible à la casse). */
  readonly filteredAccounts = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.accounts().filter(
      (a) => a.username.toLowerCase().includes(term) || a.name.toLowerCase().includes(term),
    );
  });

  /** Appareils de confiance dont le titulaire ou le nom contient la recherche (insensible à la casse). */
  readonly filteredDevices = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.devices().filter(
      (d) => d.principal.toLowerCase().includes(term) || d.name.toLowerCase().includes(term),
    );
  });

  /** Page courante des comptes filtrés : c'est elle que le tableau affiche. */
  readonly pagedAccounts = computed(() => {
    const start = this.accountsPageIndex() * this.accountsPageSize();
    return this.filteredAccounts().slice(start, start + this.accountsPageSize());
  });

  /** Page courante des appareils filtrés. */
  readonly pagedDevices = computed(() => {
    const start = this.devicesPageIndex() * this.devicesPageSize();
    return this.filteredDevices().slice(start, start + this.devicesPageSize());
  });

  /** Sessions SSO dont le titulaire contient la recherche (insensible à la casse). */
  readonly filteredSessions = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.sessions().filter((s) => s.authenticated_principal.toLowerCase().includes(term));
  });

  /** Page courante des sessions filtrées. */
  readonly pagedSessions = computed(() => {
    const start = this.sessionsPageIndex() * this.sessionsPageSize();
    return this.filteredSessions().slice(start, start + this.sessionsPageSize());
  });

  /** Totaux globaux (pas filtrés par la recherche) pour les compteurs du bandeau. */
  readonly accountsCount = computed(() => this.accounts().length);
  readonly devicesCount = computed(() => this.devices().length);
  readonly sessionsCount = computed(() => this.sessions().length);
  /** Taille totale du journal (toutes actions confondues) - sert de jauge pour savoir quand purger la base SQLite du module BFF. */
  readonly auditLogCount = computed(() => this.auditLog().length);
  /** Seuil arbitraire mentionné par l'équipe comme signal qu'il faut purger la base - juste un repère visuel, pas de purge automatique. */
  readonly auditLogCountIsHigh = computed(() => this.auditLogCount() >= 1_000_000);

  /** Lookup O(1) pour la pastille de statut - évite un .some() par ligne sur de grandes listes (1000+ utilisateurs). */
  readonly activeSessionPrincipals = computed(() => new Set(this.sessions().map((s) => s.authenticated_principal)));

  /** Colonnes de chaque tableau, dans l'ordre d'affichage. */
  readonly accountColumns = ['username', 'name', 'registrationDate', 'actions'];
  readonly deviceColumns = ['principal', 'name', 'recordDate', 'expirationDate', 'actions'];
  readonly sessionColumns = ['principal', 'authenticationDate', 'services', 'actions'];
  /** Tailles de page proposées par les paginateurs. */
  readonly pageSizeOptions = [10, 25, 50, 100];

  /** Charge les listes dès la création du composant. */
  constructor() {
    this.reload();
  }

  /**
   * Relit en parallèle comptes, appareils, sessions et (administration seulement) journal. Chaque
   * échec est annoncé séparément et laisse la liste concernée telle quelle.
   *
   * Fin du chargement : réponse du journal pour l'administration, réponse des sessions pour la
   * consultation, qui ne lit pas le journal. Les réponses des comptes et des appareils ne la
   * conditionnent pas.
   */
  reload(): void {
    this.loading.set(true);
    this.gauthService.getAll().subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: () => this.notify("Impossible de charger les comptes TOTP."),
    });
    this.trustedDeviceService.getAll().subscribe({
      next: (devices) => this.devices.set(devices),
      error: () => this.notify('Impossible de charger les appareils de confiance.'),
    });
    // Sans journal (profil consultation), la fin du chargement est celle de la dernière liste.
    const finSansJournal = () => {
      if (!this.isAdmin()) {
        this.loading.set(false);
      }
    };
    this.ssoSessionService.getAll().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        finSansJournal();
      },
      error: () => {
        this.notify('Impossible de charger les sessions SSO.');
        finSansJournal();
      },
    });
    if (!this.isAdmin()) {
      return;
    }
    this.auditLogService.getAll().subscribe({
      next: (entries) => {
        this.auditLog.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.notify("Impossible de charger le journal d'activité.");
        this.loading.set(false);
      },
    });
  }

  /** Applique la recherche aux trois onglets et revient à la première page de chacun. */
  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.accountsPageIndex.set(0);
    this.devicesPageIndex.set(0);
    this.sessionsPageIndex.set(0);
  }

  /** Reprend la page et la taille de page choisies dans le paginateur des comptes. */
  onAccountsPage(event: PageEvent): void {
    this.accountsPageIndex.set(event.pageIndex);
    this.accountsPageSize.set(event.pageSize);
  }

  /** Reprend la page et la taille de page choisies dans le paginateur des appareils. */
  onDevicesPage(event: PageEvent): void {
    this.devicesPageIndex.set(event.pageIndex);
    this.devicesPageSize.set(event.pageSize);
  }

  /** Reprend la page et la taille de page choisies dans le paginateur des sessions. */
  onSessionsPage(event: PageEvent): void {
    this.sessionsPageIndex.set(event.pageIndex);
    this.sessionsPageSize.set(event.pageSize);
  }

  /** Ouvre la fiche (`/users/<identifiant>`) d'un utilisateur ; sert aux trois onglets. */
  viewAccount(username: string): void {
    this.router.navigate(['/users', username]);
  }

  /**
   * Supprime le compte TOTP après confirmation, avec les appareils de confiance de son titulaire.
   *
   * Pourquoi en cascade : l'API Actuator ne supprime que par identifiant, donc TOUS les comptes TOTP de
   * l'utilisateur ; ses appareils sont révoqués d'abord (voir `AccountAdminService`), sinon ils
   * resteraient orphelins et laisseraient contourner le second facteur. Seuls les appareils de ce
   * titulaire sont comptés dans le message de confirmation et révoqués.
   *
   * Si l'agent supprime SON propre compte, il est déconnecté au lieu de recharger la liste.
   */
  deleteAccount(account: TotpAccount): void {
    const relatedDevices = this.devices().filter((d) => d.principal === account.username);
    const warning = relatedDevices.length > 0 ? ` et ${relatedDevices.length} appareil(s) de confiance associé(s)` : '';
    this.confirmService
      .ask({
        title: 'Supprimer le compte TOTP',
        message: `Supprimer tous les comptes TOTP de "${account.username}"${warning} ?`,
        confirmLabel: 'Supprimer',
        confirmEmoji: '🗑️',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.accountAdmin.deleteAccountWithDevices(account.username, relatedDevices)),
      )
      .subscribe({
        next: () => {
          if (this.accountAdmin.isCurrentUser(account.username)) {
            // Son propre compte TOTP vient d'être supprimé : le MFA ne pourra
            // plus revalider cette session, on déconnecte immédiatement.
            this.notify('Votre compte TOTP a été supprimé - déconnexion en cours.');
            this.casAuth.logout();
            return;
          }
          this.notify(`Compte(s) TOTP de "${account.username}" et appareils de confiance associés supprimés.`);
          this.reload();
        },
        error: () => this.notify('Échec de la suppression du compte TOTP.'),
      });
  }

  /** Révoque un appareil de confiance (par sa clé d'enregistrement) après confirmation, puis recharge les listes. */
  revokeDevice(device: TrustedDevice): void {
    this.confirmService
      .ask({
        title: "Révoquer l'appareil de confiance",
        message: `Révoquer l'appareil "${device.name}" de "${device.principal}" ?`,
        confirmLabel: 'Révoquer',
        confirmEmoji: '🗑️',
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.trustedDeviceService.revoke(device.recordKey, device.principal)),
      )
      .subscribe({
        next: () => {
          this.notify(`Appareil "${device.name}" révoqué.`);
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
          if (session.authenticated_principal === this.casAuth.username()) {
            this.notify('Votre session SSO a été révoquée - déconnexion en cours.');
            this.casAuth.logout();
            return;
          }
          this.notify(`Session de "${session.authenticated_principal}" révoquée.`);
          this.reload();
        },
        error: () => this.notify('Échec de la révocation de la session.'),
      });
  }

  /** Vrai si l'utilisateur a au moins une session SSO active (alimente la pastille de statut). */
  hasActiveSession(username: string): boolean {
    return this.activeSessionPrincipals().has(username);
  }

  /** Adresses des applications ouvertes dans la session, séparées par une virgule ; vide si aucune. */
  sessionServices(session: SsoSession): string {
    return Object.values(session.authenticated_services ?? {})
      .map((s) => s.originalUrl)
      .join(', ');
  }

  /** Annonce un message dans la zone live `<output>` de NotificationService. */
  private notify(message: string): void {
    this.notifications.show(message);
  }
}
