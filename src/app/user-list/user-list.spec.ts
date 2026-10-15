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
import { CasAuthService } from '../core/cas-auth.service';
import { AuditLogEntry, SsoSession, TotpAccount, TrustedDevice } from '../core/models';
import { account, device, ssoSession } from '../../testing/fakes';
import { UserList } from './user-list';

/** Réponses simulées pour le chargement initial ; une liste omise est renvoyée vide. */
interface Data {
  accounts?: TotpAccount[];
  devices?: TrustedDevice[];
  sessions?: SsoSession[];
  audit?: AuditLogEntry[];
}

/**
 * Vérifie la liste des utilisateurs : affichage selon le profil (la consultation est en lecture seule
 * et ne lit pas le journal), compteurs, rendu des tableaux et de la pastille de session, recherche et
 * pagination indépendante par onglet, et les actions (suppression en cascade d'un compte, révocation
 * d'un appareil ou d'une session) avec confirmation, échec et rechargement. Le BFF est simulé par
 * `HttpTestingController` ; `ConfirmService.ask` et `NotificationService.show` sont espionnés.
 */
describe('UserList', () => {
  let http: HttpTestingController;
  let snack: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<UserList>;

  let role: 'admin' | 'consultation' = 'admin';

  /**
   * Ouvre une session d'agent du profil courant (`role`), crée la liste et répond au chargement
   * initial. `currentUser` est l'agent connecté : le passer égal au compte visé permet de tester la
   * suppression de son propre compte.
   */
  function setup(data: Data = {}, currentUser: string | null = null) {
    sessionStorage.clear();
    // Session toujours présente : le profil détermine les boutons visibles. 'agent.test' n'est le titulaire d'aucun compte des tests.
    sessionStorage.setItem('totp-admin-cas-session', JSON.stringify({ username: currentUser ?? 'agent.test', role }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    snack = vi.spyOn(NotificationService.prototype, 'show').mockReturnValue(undefined);
    fixture = TestBed.createComponent(UserList);
    const component = fixture.componentInstance;
    flushLoad(data);
    return component;
  }

  /** Répond aux requêtes de chargement ; le journal n'est demandé que pour le profil administration. */
  function flushLoad({ accounts = [], devices = [], sessions = [], audit = [] }: Data): void {
    http.expectOne('/api/gauthCredentialRepository').flush(accounts);
    http.expectOne('/api/multifactorTrustedDevices').flush(devices);
    http.expectOne('/api/ssoSessions').flush({ activeSsoSessions: sessions });
    if (role === 'admin') {
      http.expectOne('/bff/audit-log').flush({ entries: audit });
    }
  }

  beforeEach(() => {
    role = 'admin';
  });

  // `verify` échoue si une requête n'a pas été attendue ; la restauration des espions a lieu même dans ce cas.
  afterEach(() => {
    try {
      http.verify();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('profil consultation : lecture seule, ni boutons de suppression, ni compteur du journal, ni appel au journal', async () => {
    role = 'consultation';
    setup({ accounts: [account('alice')], devices: [device('alice')], sessions: [ssoSession('alice')] });
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const buttons = Array.from(root.querySelectorAll('tbody tr:first-child button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['🔍 Afficher']);
    expect(root.querySelector('.btn-delete')).toBeNull();
    expect(root.querySelectorAll('.stat-tile')).toHaveLength(3);
    expect(fixture.componentInstance.loading()).toBe(false);
    http.expectNone('/bff/audit-log');
  });

  it('calcule les compteurs globaux', () => {
    const component = setup({
      accounts: [account('alice'), account('bob')],
      devices: [device('alice')],
      sessions: [ssoSession('alice')],
      audit: [],
    });
    expect(component.accountsCount()).toBe(2);
    expect(component.devicesCount()).toBe(1);
    expect(component.sessionsCount()).toBe(1);
    expect(component.auditLogCount()).toBe(0);
    expect(component.auditLogCountIsHigh()).toBe(false);
    expect(component.loading()).toBe(false);
  });

  it('rend les comptes en tableau : pastille de session, boutons Afficher / Supprimer et onglets comptés', async () => {
    const component = setup({ accounts: [account('alice'), account('bob')], sessions: [ssoSession('alice')] });
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('table.data-table tbody tr')).toHaveLength(2);
    const dots = root.querySelectorAll('tbody .status-dot');
    expect(dots[0].classList).toContain('active');
    expect(dots[1].classList).not.toContain('active');
    expect(root.querySelector('.stat-value')?.textContent).toBe('2');

    const buttons = Array.from(root.querySelectorAll('tbody tr:first-child button')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['🔍 Afficher', '🗑️ Supprimer']);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (root.querySelector('tbody tr:first-child button') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/users', 'alice']);

    const confirm = vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(false));
    (root.querySelectorAll('tbody tr:first-child button')[1] as HTMLButtonElement).click();
    expect(confirm).toHaveBeenCalled();
    expect(component.accountsCount()).toBe(2);
  });

  it("affiche un message quand il n'y a aucun compte", async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.empty-message')?.textContent).toContain('Aucun compte TOTP');
  });

  it('indique si un utilisateur a une session SSO active', () => {
    const component = setup({ accounts: [account('alice')], sessions: [ssoSession('alice')] });
    expect(component.hasActiveSession('alice')).toBe(true);
    expect(component.hasActiveSession('bob')).toBe(false);
  });

  it('filtre les trois listes sur l\'identifiant ou le nom d\'appareil et revient à la première page', () => {
    const component = setup({
      accounts: [account('alice', { name: 'Portable' }), account('bob', { name: 'Fixe' })],
      devices: [device('alice'), device('bob')],
      sessions: [ssoSession('alice'), ssoSession('bob')],
    });
    component.onAccountsPage({ pageIndex: 3, pageSize: 10, length: 50 });

    component.onSearch('ALI');
    expect(component.filteredAccounts().map((a) => a.username)).toEqual(['alice']);
    expect(component.filteredDevices().map((d) => d.principal)).toEqual(['alice']);
    expect(component.filteredSessions().map((s) => s.authenticated_principal)).toEqual(['alice']);
    expect(component.accountsPageIndex()).toBe(0);

    component.onSearch('fixe');
    expect(component.filteredAccounts().map((a) => a.username)).toEqual(['bob']);
  });

  it('pagine chaque liste indépendamment', () => {
    const accounts = Array.from({ length: 12 }, (_, i) => account(`user${i}`));
    const component = setup({ accounts });
    expect(component.pagedAccounts()).toHaveLength(10);
    component.onAccountsPage({ pageIndex: 1, pageSize: 10, length: 12 });
    expect(component.pagedAccounts()).toHaveLength(2);
    component.onDevicesPage({ pageIndex: 2, pageSize: 25, length: 0 });
    component.onSessionsPage({ pageIndex: 1, pageSize: 50, length: 0 });
    expect(component.devicesPageSize()).toBe(25);
    expect(component.sessionsPageSize()).toBe(50);
  });

  it('liste les applications d\'une session SSO', () => {
    const component = setup();
    expect(component.sessionServices(ssoSession('alice'))).toBe('https://app.exemple.fr/');
    expect(component.sessionServices(ssoSession('alice', { authenticated_services: undefined as never }))).toBe('');
  });

  it('ouvre la page de détail d\'un utilisateur', () => {
    const component = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.viewAccount('alice');
    expect(navigate).toHaveBeenCalledWith(['/users', 'alice']);
  });

  it('signale chaque échec de chargement', () => {
    // Pas de `setup` ici : il répond avec succès, alors que les quatre requêtes doivent échouer.
    sessionStorage.setItem('totp-admin-cas-session', JSON.stringify({ username: 'agent.test', role: 'admin' }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    snack = vi.spyOn(NotificationService.prototype, 'show').mockReturnValue(undefined);
    const fixture = TestBed.createComponent(UserList);
    const failure = { status: 500, statusText: 'Server Error' };
    http.expectOne('/api/gauthCredentialRepository').flush(null, failure);
    http.expectOne('/api/multifactorTrustedDevices').flush(null, failure);
    http.expectOne('/api/ssoSessions').flush(null, failure);
    http.expectOne('/bff/audit-log').flush(null, failure);

    expect(snack).toHaveBeenCalledTimes(4);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  describe('suppression d\'un compte TOTP', () => {
    it('ne fait rien si l\'agent annule la confirmation', () => {
      const component = setup({ accounts: [account('alice')] });
      vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(false));
      component.deleteAccount(account('alice'));
      http.expectNone((r) => r.method === 'DELETE');
    });

    it('prévient du nombre d\'appareils de confiance qui seront aussi révoqués', () => {
      const component = setup({ accounts: [account('alice')], devices: [device('alice'), device('alice', { recordKey: 'k2' }), device('bob')] });
      const confirm = vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(false));
      component.deleteAccount(account('alice'));
      expect(confirm.mock.calls[0][0].message).toBe('Supprimer tous les comptes TOTP de "alice" et 2 appareil(s) de confiance associé(s) ?');
    });

    it('révoque les appareils, supprime le compte, notifie et recharge', () => {
      const component = setup({ accounts: [account('alice')], devices: [device('alice')] }, 'admin');
      vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
      component.deleteAccount(account('alice'));

      http.expectOne('/api/multifactorTrustedDevices/alice%40Poste%40fp').flush(null);
      http.expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' }).flush(null);

      expect(snack).toHaveBeenCalledWith(
        'Compte(s) TOTP de "alice" et appareils de confiance associés supprimés.');
      flushLoad({});
    });

    it('signale l\'échec sans recharger', () => {
      const component = setup({ accounts: [account('alice')] }, 'admin');
      vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
      component.deleteAccount(account('alice'));
      http
        .expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' })
        .flush(null, { status: 500, statusText: 'Server Error' });
      expect(snack).toHaveBeenCalledWith('Échec de la suppression du compte TOTP.');
    });

    it('supprimer SON propre compte déconnecte l\'application au lieu de recharger la liste', () => {
      const component = setup({ accounts: [account('alice')] }, 'alice');
      const logout = vi.spyOn(TestBed.inject(CasAuthService), 'logout').mockImplementation(() => undefined);
      vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
      component.deleteAccount(account('alice'));
      http.expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' }).flush(null);

      expect(logout).toHaveBeenCalled();
      http.expectNone('/api/gauthCredentialRepository');
    });
  });

  it('révoque un appareil de confiance après confirmation, puis recharge', () => {
    const component = setup({ devices: [device('alice')] });
    vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
    component.revokeDevice(device('alice'));
    http.expectOne({ method: 'DELETE', url: '/api/multifactorTrustedDevices/alice%40Poste%40fp' }).flush(null);
    flushLoad({});
  });

  it('signale l\'échec de révocation d\'un appareil', () => {
    const component = setup({ devices: [device('alice')] });
    vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
    component.revokeDevice(device('alice'));
    http
      .expectOne({ method: 'DELETE', url: '/api/multifactorTrustedDevices/alice%40Poste%40fp' })
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(snack).toHaveBeenCalledWith("Échec de la révocation de l'appareil.");
  });

  it('révoque une session SSO en transmettant le principal pour le journal', () => {
    const component = setup({ sessions: [ssoSession('alice')] });
    vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
    component.revokeSession(ssoSession('alice'));
    const request = http.expectOne((r) => r.url === '/api/ssoSessions/TGT-alice');
    expect(request.request.params.get('principal')).toBe('alice');
    request.flush(null);
    flushLoad({});
  });

  it('annuler la confirmation de révocation ne déclenche aucun appel', () => {
    const component = setup({ devices: [device('alice')], sessions: [ssoSession('alice')] });
    vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(false));
    component.revokeDevice(device('alice'));
    component.revokeSession(ssoSession('alice'));
    http.expectNone((r) => r.method === 'DELETE');
  });
});
