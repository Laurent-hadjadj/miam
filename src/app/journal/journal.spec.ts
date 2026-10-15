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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NotificationService } from '../core/notification.service';
import { ConfirmService } from '../core/confirm.service';
import { AuditLogEntry } from '../core/models';
import { Journal } from './journal';

/** Fabrique une entrée de journal ; `target` nul représente une action sans compte précis (suppression en masse). */
function entry(actor: string, target: string | null, action: AuditLogEntry['action'] = 'DELETE_TOTP_ACCOUNT'): AuditLogEntry {
  return { timestamp: '2026-10-13T09:00:00.000Z', actor, action, target, detail: null };
}

/**
 * Vérifie la page du journal d'activité : chargement depuis le BFF (simulé avec
 * `HttpTestingController`), rendu du tableau, filtres indépendants, pagination avec retour à la
 * première page, libellés d'action, navigation vers un compte et signalement d'un échec de chargement.
 */
describe('Journal', () => {
  let fixture: ComponentFixture<Journal>;
  afterEach(() => vi.restoreAllMocks());

  /**
   * Crée le composant et répond tout de suite à sa requête de chargement : `'erreur'` simule une
   * panne (500). `NotificationService.show` est remplacé pour observer les messages sans minuterie.
   */
  function setup(entries: AuditLogEntry[] | 'erreur') {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const snack = vi.spyOn(NotificationService.prototype, 'show').mockReturnValue(undefined);
    fixture = TestBed.createComponent(Journal);
    const component = fixture.componentInstance;
    const request = TestBed.inject(HttpTestingController).expectOne('/bff/audit-log');
    if (entries === 'erreur') {
      request.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      request.flush({ entries });
    }
    return { component, snack };
  }

  it('charge les entrées du journal', () => {
    const { component } = setup([entry('alice', 'bob'), entry('carol', 'dave')]);
    expect(component.loading()).toBe(false);
    expect(component.filteredEntries()).toHaveLength(2);
  });

  it("rend un tableau lisible : libellés d'action, cible cliquable, ligne vide pour la suppression en masse", async () => {
    const { component } = setup([entry('alice', 'bob', 'REVOKE_TRUSTED_DEVICE'), entry('alice', null)]);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const rows = Array.from(root.querySelectorAll('table tbody tr'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Révocation appareil de confiance');
    expect(rows[0].textContent).toContain('alice');

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const target = rows[0].querySelector('button, a') as HTMLElement;
    target.click();
    expect(navigate).toHaveBeenCalledWith(['/users', 'bob']);
    expect(component.filteredEntries()).toHaveLength(2);
  });

  it('filtre indépendamment sur l\'agent qui a agi et sur le compte concerné (insensible à la casse)', () => {
    const { component } = setup([entry('alice', 'bob'), entry('alice', 'carol'), entry('dave', 'bob')]);

    component.onActorFilter('ALI');
    expect(component.filteredEntries().map((e) => e.target)).toEqual(['bob', 'carol']);

    component.onTargetFilter(' bob ');
    expect(component.filteredEntries()).toHaveLength(1);

    component.onActorFilter('');
    expect(component.filteredEntries().map((e) => e.actor)).toEqual(['alice', 'dave']);
  });

  it('une entrée sans cible (suppression en masse) n\'est retenue que si le filtre cible est vide', () => {
    const { component } = setup([entry('alice', null)]);
    expect(component.filteredEntries()).toHaveLength(1);
    component.onTargetFilter('bob');
    expect(component.filteredEntries()).toHaveLength(0);
  });

  it('pagine (25 par défaut) et revient à la première page quand un filtre change', () => {
    const entries = Array.from({ length: 30 }, (_, i) => entry('alice', `user${i}`));
    const { component } = setup(entries);

    expect(component.pagedEntries()).toHaveLength(25);
    component.onPage({ pageIndex: 1, pageSize: 25, length: 30 });
    expect(component.pagedEntries()).toHaveLength(5);

    component.onActorFilter('alice');
    expect(component.pageIndex()).toBe(0);
  });

  it('libellés français des actions, code brut si inconnu', () => {
    const { component } = setup([]);
    expect(component.actionLabel('DELETE_TOTP_ACCOUNT')).toBe('Suppression compte TOTP');
    expect(component.actionLabel('REVOKE_TRUSTED_DEVICE')).toBe('Révocation appareil de confiance');
    expect(component.actionLabel('REVOKE_SSO_SESSION')).toBe('Révocation session SSO');
    expect(component.actionLabel('AUTRE' as AuditLogEntry['action'])).toBe('AUTRE');
  });

  it('ouvre la page de l\'utilisateur ciblé', () => {
    const { component } = setup([]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.viewTarget('bob');
    expect(navigate).toHaveBeenCalledWith(['/users', 'bob']);
  });

  it('signale l\'échec de chargement', () => {
    const { component, snack } = setup('erreur');
    expect(component.loading()).toBe(false);
    expect(snack).toHaveBeenCalledWith("Impossible de charger le journal d'activité.");
  });
});
