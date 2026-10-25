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
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService } from '../core/notification.service';
import { AuditLogService } from '../core/audit-log.service';
import { AuditLogEntry, AuditAction } from '../core/models';

/** Taille de page initiale du tableau (première valeur de `pageSizeOptions`). */
const DEFAULT_PAGE_SIZE = 25;

/** Libellés français affichés pour chaque code d'action du journal. */
const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  DELETE_TOTP_ACCOUNT: 'Suppression compte TOTP',
  REVOKE_TRUSTED_DEVICE: 'Révocation appareil de confiance',
  REVOKE_SSO_SESSION: 'Révocation session SSO',
};

/**
 * Journal d'activité du module BFF (server/app.js, SQLite) : qui a supprimé quel
 * compte TOTP / appareil / session, et quand. Page dédiée (pas un onglet de
 * la page de gestion) avec deux filtres indépendants - l'agent qui a agi et
 * le compte qui a subi l'action ne sont pas la même recherche.
 *
 * Route : `journal` (voir app.routes.ts), accessible aux profils administration et consultation
 * (`casAuthGuard`) : le BFF ne renvoie ni identifiant de session ni clé d'appareil (champ `detail` retiré),
 * seulement l'agent, l'action, le compte concerné et l'heure. Aucune entrée ni sortie. Dépendances :
 * AuditLogService (lecture), NotificationService (échec de chargement), Router (lien vers un compte).
 *
 * Lecture seule : le journal est chargé en entier une fois, puis filtré, trié et paginé côté navigateur
 * (pas de nouvel appel réseau lors d'un filtre, tri ou changement de page). L'identifiant des agents
 * et des comptes est une donnée personnelle (RGPD) : la durée de conservation est gérée par le BFF
 * et annoncée dans la page d'informations.
 */
@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    DatePipe,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './journal.html',
  styleUrl: './journal.css',
})
export class Journal {
  private readonly auditLogService = inject(AuditLogService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  /** Vrai pendant le chargement : affiche l'indicateur et marque le tableau `aria-busy`. */
  readonly loading = signal(false);
  /** Texte saisi dans le filtre « agent » (celui qui a agi). */
  readonly actorFilter = signal('');
  /** Texte saisi dans le filtre « compte concerné » (celui qui a subi l'action). */
  readonly targetFilter = signal('');

  /** Journal complet tel que reçu du BFF, avant filtrage, tri et pagination. */
  private readonly entries = signal<AuditLogEntry[]>([]);

  /** Index (à partir de 0) de la page affichée. */
  readonly pageIndex = signal(0);
  /** Nombre de lignes par page. */
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  /** Tailles de page proposées par le paginateur. */
  readonly pageSizeOptions = [25, 50, 100, 200];

  /**
   * Entrées retenues par les deux filtres (sous-chaîne, insensible à la casse, espaces de bord ignorés ;
   * les deux conditions se cumulent). Une entrée sans compte concerné (`target` nul, cas d'une
   * suppression en masse) n'est conservée que si le filtre « compte » est vide.
   */
  readonly filteredEntries = computed(() => {
    const actorTerm = this.actorFilter().toLowerCase().trim();
    const targetTerm = this.targetFilter().toLowerCase().trim();
    return this.entries().filter((e) => {
      const matchesActor = !actorTerm || e.actor.toLowerCase().includes(actorTerm);
      const matchesTarget = !targetTerm || (e.target ?? '').toLowerCase().includes(targetTerm);
      return matchesActor && matchesTarget;
    });
  });

  /** Tri : état de direction pour chaque colonne. */
  private readonly sortTimestamp = signal<'asc' | 'desc' | ''>('desc');
  private readonly sortActor = signal<'asc' | 'desc' | ''>('');
  private readonly sortAction = signal<'asc' | 'desc' | ''>('');
  private readonly sortTarget = signal<'asc' | 'desc' | ''>('');

  /**
   * Nombre d'actions par motif (suppression TOTP, révocation d'appareil, fermeture de session SSO),
   * calculé sur les entrées retenues par les filtres.
   */
  readonly actionCounts = computed(() => {
    const entries = this.filteredEntries();
    return (Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((action) => ({
      action,
      label: AUDIT_ACTION_LABELS[action],
      count: entries.filter((e) => e.action === action).length,
    }));
  });

  /**
   * Entrées filtrées ET triées, puis paginées.
   */
  readonly pagedEntries = computed(() => {
    let data = [...this.filteredEntries()];

    // Applique le tri actif
    const sortCol = this.activeSortColumn();
    const sortDir = this.activeSortDirection();
    if (sortCol && sortDir) {
      data.sort((a, b) => {
        let cmp = 0;
        const aVal = (a as unknown as Record<string, unknown>)[sortCol];
        const bVal = (b as unknown as Record<string, unknown>)[sortCol];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          cmp = aVal.localeCompare(bVal, 'fr', { sensitivity: 'base' });
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''), 'fr', { sensitivity: 'base' });
        }

        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    const start = this.pageIndex() * this.pageSize();
    return data.slice(start, start + this.pageSize());
  });

  /** Nom de la colonne triée actuellement. */
  private readonly activeSortColumn = computed(() => {
    if (this.sortTimestamp() !== '') return 'timestamp';
    if (this.sortActor() !== '') return 'actor';
    if (this.sortAction() !== '') return 'action';
    if (this.sortTarget() !== '') return 'target';
    return '';
  });

  /** Direction de tri actuelle. */
  private readonly activeSortDirection = computed<'asc' | 'desc'>(() => {
    if (this.sortTimestamp() !== '') return this.sortTimestamp() as 'asc' | 'desc';
    if (this.sortActor() !== '') return this.sortActor() as 'asc' | 'desc';
    if (this.sortAction() !== '') return this.sortAction() as 'asc' | 'desc';
    if (this.sortTarget() !== '') return this.sortTarget() as 'asc' | 'desc';
    return 'asc';
  });

  /** Colonnes du tableau, dans l'ordre d'affichage. */
  readonly columns = ['timestamp', 'actor', 'action', 'target'];

  /** Charge le journal dès la création du composant. */
  constructor() {
    this.reload();
  }

  /**
   * Relit le journal auprès du BFF et remplace les entrées en mémoire. En cas d'échec, les entrées déjà
   * chargées sont conservées et un message est annoncé via la zone de notification.
   */
  reload(): void {
    this.loading.set(true);
    this.auditLogService.getAll().subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.notify("Impossible de charger le journal d'activité.");
        this.loading.set(false);
      },
    });
  }

  /**
   * Bascule le tri sur la colonne donnée : '' → 'asc' → 'desc' → ''.
   * Un seul colonne peut être triée à la fois.
   */
  toggleSort(column: string): void {
    // Désactive toutes les autres colonnes
    if (column !== 'timestamp') this.sortTimestamp.set('');
    if (column !== 'actor') this.sortActor.set('');
    if (column !== 'action') this.sortAction.set('');
    if (column !== 'target') this.sortTarget.set('');

    const current = column === 'timestamp' ? this.sortTimestamp()
      : column === 'actor' ? this.sortActor()
      : column === 'action' ? this.sortAction()
      : this.sortTarget();

    if (current === 'asc') {
      if (column === 'timestamp') this.sortTimestamp.set('desc');
      else if (column === 'actor') this.sortActor.set('desc');
      else if (column === 'action') this.sortAction.set('desc');
      else this.sortTarget.set('desc');
    } else if (current === 'desc') {
      if (column === 'timestamp') this.sortTimestamp.set('');
      else if (column === 'actor') this.sortActor.set('');
      else if (column === 'action') this.sortAction.set('');
      else this.sortTarget.set('');
    } else {
      if (column === 'timestamp') this.sortTimestamp.set('asc');
      else if (column === 'actor') this.sortActor.set('asc');
      else if (column === 'action') this.sortAction.set('asc');
      else this.sortTarget.set('asc');
    }
  }

  /** Retourne l'icône de tri pour la colonne donnée. */
  sortIcon(column: string): string {
    const dir = column === 'timestamp' ? this.sortTimestamp()
      : column === 'actor' ? this.sortActor()
      : column === 'action' ? this.sortAction()
      : this.sortTarget();
    if (dir === 'asc') return 'arrow_upward';
    if (dir === 'desc') return 'arrow_downward';
    return '';
  }

  /** Retourne vrai si la colonne est actuellement triée. */
  isSorted(column: string): boolean {
    const dir = column === 'timestamp' ? this.sortTimestamp()
      : column === 'actor' ? this.sortActor()
      : column === 'action' ? this.sortAction()
      : this.sortTarget();
    return dir !== '';
  }

  /** Applique le filtre « agent » et revient à la première page (sinon la page courante pourrait être vide). */
  onActorFilter(value: string): void {
    this.actorFilter.set(value);
    this.pageIndex.set(0);
  }

  /** Applique le filtre « compte concerné » et revient à la première page. */
  onTargetFilter(value: string): void {
    this.targetFilter.set(value);
    this.pageIndex.set(0);
  }

  /** Reprend la page et la taille de page choisies dans le paginateur. */
  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  /** Ouvre la fiche (`/users/<identifiant>`) du compte concerné par une entrée. */
  viewTarget(username: string): void {
    this.router.navigate(['/users', username]);
  }

  /** Libellé français d'un code d'action ; un code inconnu (version plus récente du BFF) est affiché tel quel. */
  actionLabel(action: AuditAction): string {
    return AUDIT_ACTION_LABELS[action] ?? action;
  }

  /** Annonce un message dans la zone live `<output>` de NotificationService. */
  private notify(message: string): void {
    this.notifications.show(message);
  }
}
