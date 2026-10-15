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
 * Route : `journal` (voir app.routes.ts), réservée au profil administration par `adminGuard` ; le BFF
 * refuse de toute façon la lecture aux autres profils (403 sur `GET /bff/audit-log`), le garde ne
 * sert donc qu'à éviter d'afficher une page vouée à l'échec. Aucune entrée ni sortie. Dépendances :
 * AuditLogService (lecture), NotificationService (échec de chargement), Router (lien vers un compte).
 *
 * Lecture seule : le journal est chargé en entier une fois, puis filtré et paginé côté navigateur
 * (pas de nouvel appel réseau lors d'un filtre ou d'un changement de page). L'identifiant des agents
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

  /** Journal complet tel que reçu du BFF, avant filtrage et pagination. */
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

  /** Tranche de `filteredEntries` correspondant à la page courante : c'est elle que le tableau affiche. */
  readonly pagedEntries = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredEntries().slice(start, start + this.pageSize());
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
