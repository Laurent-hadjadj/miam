/**
 *  Ma-Moulinette - MIAM
 *  --------------
 *  Copyright (c) 2015-2026.
 *  Laurent HADJADJ <laurent_h@me.com>.
 *  Licensed Creative Common CC-BY-NC-SA 4.0.
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
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { filter, switchMap, forkJoin } from 'rxjs';
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
 * Données : les trois listes sont chargées en entier, puis filtrées, triées et paginées dans le navigateur
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
    MatSortModule,
    MatIconModule,
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

  /** Listes complètes telles que reçues, avant filtrage, tri et pagination. */
  private readonly accounts = signal<TotpAccount[]>([]);
  private readonly devices = signal<TrustedDevice[]>([]);
  private readonly sessions = signal<SsoSession[]>([]);
  private readonly auditLog = signal<AuditLogEntry[]>([]);

  /** Identifiants actifs pour la pastille de statut (optimisé : Set au lieu de recherche dans le tableau). */
  readonly activeSessionPrincipals = computed(() => new Set(this.sessions().map((s) => s.authenticated_principal)));

  /** Compteurs bruts (non filtrés). */
  readonly accountsCount = computed(() => this.accounts().length);
  readonly devicesCount = computed(() => this.devices().length);
  readonly sessionsCount = computed(() => this.sessions().length);
  readonly auditLogCount = computed(() => this.auditLog().length);

  /** Index (à partir de 0) de la page affichée pour chaque tableau. */
  readonly accountsPageIndex = signal(0);
  readonly devicesPageIndex = signal(0);
  readonly sessionsPageIndex = signal(0);
  /** Nombre de lignes par page pour chaque tableau. */
  readonly accountsPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly devicesPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sessionsPageSize = signal(DEFAULT_PAGE_SIZE);
  /** Tailles de page proposées par les paginateurs. */
  readonly pageSizeOptions = [10, 20, 50, 100];

  /**
   * Entrées retenues par la recherche (sous-chaîne, insensible à la casse, espaces de bord ignorés).
   * Les compteurs du bandeau, eux, ne sont jamais filtrés.
   */
  readonly filteredAccounts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.accounts();
    return this.accounts().filter((a) => {
      const username = a.username.toLowerCase();
      const name = a.name.toLowerCase();
      return username.includes(term) || name.includes(term);
    });
  });

  readonly filteredDevices = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.devices();
    return this.devices().filter((d) => {
      const principal = d.principal.toLowerCase();
      const name = d.name.toLowerCase();
      return principal.includes(term) || name.includes(term);
    });
  });

  readonly filteredSessions = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.sessions();
    return this.sessions().filter((s) => {
      const principal = (s.authenticated_principal ?? '').toLowerCase();
      return principal.includes(term);
    });
  });

  /** Colonnes du tableau des comptes TOTP. */
  readonly accountColumns = ['username', 'name', 'registrationDate', 'actions'];
  /** Colonnes du tableau des appareils de confiance. */
  readonly deviceColumns = ['principal', 'name', 'recordDate', 'expirationDate', 'actions'];
  /** Colonnes du tableau des sessions SSO. */
  readonly sessionColumns = ['principal', 'authenticationDate', 'services', 'actions'];

  /**
   * Tranches filtrées ET triées, puis paginées pour les comptes TOTP.
   */
  readonly pagedAccounts = computed(() => {
    const data = this.sortFn(this.filteredAccounts(), 'username', 'asc');
    const start = this.accountsPageIndex() * this.accountsPageSize();
    return data.slice(start, start + this.accountsPageSize());
  });

  /**
   * Tranches filtrées ET triées, puis paginées pour les appareils de confiance.
   */
  readonly pagedDevices = computed(() => {
    const data = this.sortFn(this.filteredDevices(), 'principal', 'asc');
    const start = this.devicesPageIndex() * this.devicesPageSize();
    return data.slice(start, start + this.devicesPageSize());
  });

  /**
   * Tranches filtrées ET triées, puis paginées pour les sessions SSO.
   */
  readonly pagedSessions = computed(() => {
    const data = this.sortFn(this.filteredSessions(), 'authenticationDate', 'desc');
    const start = this.sessionsPageIndex() * this.sessionsPageSize();
    return data.slice(start, start + this.sessionsPageSize());
  });

  /**
   * Charge toutes les données en une seule fois (la recherche, le tri et la pagination sont côté navigateur).
   * En cas d'échec, un message est annoncé via la zone de notification.
   */
  reload(): void {
    this.loading.set(true);

    // Les appels sont indépendants et non critiques : on les lance en parallèle.
    // En cas d'échec d'un seul, les autres données sont conservées.
    const accounts$ = new Promise<void>((resolve) => {
      this.gauthService.getAll().subscribe({
        next: (accounts: TotpAccount[]) => {
          this.accounts.set(accounts);
          resolve();
        },
        error: () => {
          this.notify('Échec du chargement des comptes TOTP.');
          resolve();
        },
      });
    });

    const devices$ = new Promise<void>((resolve) => {
      this.trustedDeviceService.getAll().subscribe({
        next: (devices: TrustedDevice[]) => {
          this.devices.set(devices);
          resolve();
        },
        error: () => {
          this.notify('Échec du chargement des appareils de confiance.');
          resolve();
        },
      });
    });

    const sessions$ = new Promise<void>((resolve) => {
      this.ssoSessionService.getAll().subscribe({
        next: (sessions: SsoSession[]) => {
          this.sessions.set(sessions);
          resolve();
        },
        error: () => {
          this.notify('Échec du chargement des sessions SSO.');
          resolve();
        },
      });
    });

    const audit$ = new Promise<void>((resolve) => {
      this.auditLogService.getAll().subscribe({
        next: (entries: AuditLogEntry[]) => {
          this.auditLog.set(entries);
          resolve();
        },
        error: () => {
          this.notify("Échec du chargement du journal d'activité.");
          resolve();
        },
      });
    });

    Promise.all([accounts$, devices$, sessions$, audit$]).then(() => {
      this.loading.set(false);
    });
  }

  /**
   * Applique la recherche sur les trois tableaux et revient à la première page.
   */
  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.accountsPageIndex.set(0);
    this.devicesPageIndex.set(0);
    this.sessionsPageIndex.set(0);
  }

  /**
   * Reprend la page et la taille de page choisies dans le paginateur des comptes TOTP.
   */
  onAccountsPage(event: PageEvent): void {
    this.accountsPageIndex.set(event.pageIndex);
    this.accountsPageSize.set(event.pageSize);
  }

  /** Reprend la page et la taille de page choisies dans le paginateur des appareils de confiance. */
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
      .map((s: { originalUrl: string }) => s.originalUrl)
      .join(', ');
  }

  /** Seuil arbitraire mentionné par l'équipe comme signal qu'il faut purger la base - juste un repère visuel, pas de purge automatique. */
  readonly auditLogCountIsHigh = computed(() => this.auditLogCount() >= 1_000_000);

  /**
   * Fonction de tri générique : trie un tableau d'objets par la propriété donnée.
   * Gère les chaînes (insensible à la casse, locale), les nombres et les dates.
   */
  private sortFn<T>(data: T[], column: string, defaultDir: 'asc' | 'desc'): T[] {
    const sortState = this.sortStates.get(column);
    if (!sortState) return data;

    const sorted = [...data];
    sorted.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[column];
      const bVal = (b as Record<string, unknown>)[column];
      const dir = sortState.direction();

      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal, 'fr', { sensitivity: 'base' });
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (aVal instanceof Date && bVal instanceof Date) {
        cmp = aVal.getTime() - bVal.getTime();
      } else {
        cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''), 'fr', { sensitivity: 'base' });
      }

      return dir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }

  /**
   * Bascule le tri sur la colonne donnée.
   */
  toggleSort(column: string): void {
    const sortState = this.sortStates.get(column);
    if (sortState) {
      sortState.toggle();
    }
  }

  /**
   * Retourne l'icône de tri pour la colonne donnée.
   */
  sortIcon(column: string): string {
    const sortState = this.sortStates.get(column);
    if (!sortState) return '';
    return sortState.icon();
  }

  /**
   * Retourne vrai si la colonne est actuellement triée.
   */
  isSorted(column: string): boolean {
    const sortState = this.sortStates.get(column);
    return sortState ? sortState.active() : false;
  }

  /** Annonce un message dans la zone live `<output>` de NotificationService. */
  private notify(message: string): void {
    this.notifications.show(message);
  }

  // ---- Tri par colonne ----

  /** État de tri pour chaque colonne de chaque tableau. */
  private readonly sortStates = new Map<string, SortState>();

  // Comptes TOTP
  private readonly sortUsername = new SortState();
  private readonly sortName = new SortState();
  private readonly sortRegistrationDate = new SortState();

  // Appareils de confiance
  private readonly sortPrincipal = new SortState();
  private readonly sortDeviceName = new SortState();
  private readonly sortRecordDate = new SortState();
  private readonly sortExpirationDate = new SortState();

  // Sessions SSO
  private readonly sortSessionPrincipal = new SortState();
  private readonly sortAuthDate = new SortState();

  constructor() {
    // Associe les états de tri aux colonnes
    this.sortStates.set('username', this.sortUsername);
    this.sortStates.set('name', this.sortName);
    this.sortStates.set('registrationDate', this.sortRegistrationDate);
    this.sortStates.set('principal', this.sortPrincipal);
    this.sortStates.set('deviceName', this.sortDeviceName);
    this.sortStates.set('recordDate', this.sortRecordDate);
    this.sortStates.set('expirationDate', this.sortExpirationDate);
    this.sortStates.set('authenticated_principal', this.sortSessionPrincipal);
    this.sortStates.set('authenticationDate', this.sortAuthDate);

    // Tri par défaut : comptes par username asc, appareils par principal asc, sessions par date desc
    this.sortUsername.direction.set('asc');
    this.sortPrincipal.direction.set('asc');
    this.sortAuthDate.direction.set('desc');

    this.reload();
  }
}

// ---- État de tri pour une colonne ----

/** Direction du tri. */
type SortDirection = 'asc' | 'desc' | '';

/** État de tri réutilisable pour une colonne d'un tableau. */
class SortState {
  readonly direction = signal<SortDirection>('');

  /** Bascule : '' → 'asc' → 'desc' → ''. */
  toggle(): void {
    if (this.direction() === 'asc') {
      this.direction.set('desc');
    } else if (this.direction() === 'desc') {
      this.direction.set('');
    } else {
      this.direction.set('asc');
    }
  }

  /** Icône Material. */
  icon(): string {
    if (!this.direction()) return '';
    return this.direction() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  /** Retourne vrai si trié (asc ou desc). */
  active(): boolean {
    return this.direction() !== '';
  }
}
