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
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NotificationService } from '../core/notification.service';
import { ConfirmService } from '../core/confirm.service';
import { CasAuthService } from '../core/cas-auth.service';
import { SsoSession, TotpAccount, TrustedDevice } from '../core/models';
import { account, device, ssoSession } from '../../testing/fakes';
import { UserDetails } from './user-details';

/** Réponses simulées pour le chargement initial ; une liste omise est renvoyée vide. */
interface Data {
  accounts?: TotpAccount[];
  devices?: TrustedDevice[];
  sessions?: SsoSession[];
}

/**
 * Vérifie la fiche utilisateur : chargement des trois listes pour l'identifiant de l'URL, affichage
 * selon le profil (les boutons de suppression et de révocation n'existent que pour l'administration),
 * accessibilité des boutons et de la pastille de session, et les trois actions (suppression en
 * cascade du compte, révocation d'un appareil, révocation d'une session) avec confirmation, échec et
 * rechargement. Le BFF est simulé par `HttpTestingController` ; `ConfirmService.ask` et
 * `NotificationService.show` sont espionnés pour piloter la réponse de l'agent et lire les messages.
 */
describe('UserDetails', () => {
  let http: HttpTestingController;
  let snack: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<UserDetails>;

  let role: 'admin' | 'consultation' = 'admin';

  /**
   * Ouvre la fiche de « alice », ouvre une session d'agent du profil courant (`role`) puis répond au
   * chargement initial. `currentUser` est l'agent connecté : le passer égal au compte visé permet de
   * tester la suppression de son propre compte.
   */
  function setup(data: Data = {}, currentUser: string | null = null) {
    sessionStorage.clear();
    // Session toujours présente : le profil détermine les boutons visibles. 'agent.test' n'est le titulaire d'aucun compte des tests.
    sessionStorage.setItem('totp-admin-cas-session', JSON.stringify({ username: currentUser ?? 'agent.test', role }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ username: 'alice' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    snack = vi.spyOn(NotificationService.prototype, 'show').mockReturnValue(undefined);
    fixture = TestBed.createComponent(UserDetails);
    const component = fixture.componentInstance;
    flushLoad(data);
    return component;
  }

  /** Répond aux trois requêtes de chargement (la liste des sessions est filtrée par `username`). */
  function flushLoad({ accounts = [], devices = [], sessions = [] }: Data): void {
    http.expectOne('/api/gauthCredentialRepository/alice').flush(accounts);
    http.expectOne('/api/multifactorTrustedDevices/alice').flush(devices);
    const request = http.expectOne((r) => r.url === '/api/ssoSessions');
    expect(request.request.params.get('username')).toBe('alice');
    request.flush({ activeSsoSessions: sessions });
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

  it('charge les comptes, appareils et sessions de l\'utilisateur de l\'URL', () => {
    const component = setup({ accounts: [account('alice')], devices: [device('alice')], sessions: [ssoSession('alice')] });
    expect(component.username()).toBe('alice');
    expect(component.accounts()).toHaveLength(1);
    expect(component.devices()).toHaveLength(1);
    expect(component.sessions()).toHaveLength(1);
    expect(component.hasActiveSession()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('sans session SSO, l\'utilisateur n\'est pas marqué actif', () => {
    expect(setup().hasActiveSession()).toBe(false);
  });

  it('profil consultation : aucun bouton de suppression ni de révocation', () => {
    role = 'consultation';
    setup({ accounts: [account('alice')], devices: [device('alice')], sessions: [ssoSession('alice')] });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.btn-delete')).toBeNull();
    expect(root.querySelectorAll('.entry-row')).toHaveLength(3);
  });

  it('rend trois messages « vide » quand l\'utilisateur n\'a ni compte, ni appareil, ni session', () => {
    setup();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(Array.from(root.querySelectorAll('.empty-message')).map((e) => e.textContent)).toEqual([
      'Aucun compte TOTP enrôlé pour cet utilisateur.',
      'Aucun appareil de confiance pour cet utilisateur.',
      'Aucune session SSO active pour cet utilisateur.',
    ]);
    expect(root.querySelector('h1 .status-dot')?.classList).not.toContain('active');
  });

  it('chaque ligne propose Supprimer (compte) ou Révoquer (appareil, session) et le retour à la liste', () => {
    setup({ accounts: [account('alice')], devices: [device('alice')], sessions: [ssoSession('alice')] });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const labels = Array.from(root.querySelectorAll('.entry-row button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['🗑️ Supprimer', '🗑️ Révoquer', '🗑️ Révoquer']);
    expect(root.querySelector('h1 .status-dot')?.classList).toContain('active');
    // Nom accessible explicite (l'emoji est masqué) et état de session aussi en texte, pas seulement en couleur.
    const names = Array.from(root.querySelectorAll('.entry-row button')).map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Supprimer le compte TOTP Poste alice',
      'Révoquer l’appareil Poste',
      'Révoquer la session SSO de alice',
    ]);
    expect(root.querySelector('h1 .visually-hidden')?.textContent).toContain('Session active');
    expect(root.querySelector('h1 .status-dot')?.getAttribute('aria-hidden')).toBe('true');

    const confirm = vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(false));
    root.querySelectorAll<HTMLButtonElement>('.entry-row button').forEach((b) => b.click());
    expect(confirm).toHaveBeenCalledTimes(3);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (root.querySelector('button') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/users']);
  });

  it('signale les échecs de chargement', () => {
    // Pas de `setup` ici : il répond avec succès, alors que les trois requêtes doivent échouer.
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ username: 'alice' }) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    snack = vi.spyOn(NotificationService.prototype, 'show').mockReturnValue(undefined);
    const component = TestBed.createComponent(UserDetails).componentInstance;
    const failure = { status: 500, statusText: 'Server Error' };
    http.expectOne('/api/gauthCredentialRepository/alice').flush(null, failure);
    http.expectOne('/api/multifactorTrustedDevices/alice').flush(null, failure);
    http.expectOne((r) => r.url === '/api/ssoSessions').flush(null, failure);

    expect(snack).toHaveBeenCalledTimes(3);
    expect(component.loading()).toBe(false);
  });

  it('retourne à la liste', () => {
    const component = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.onBack();
    expect(navigate).toHaveBeenCalledWith(['/users']);
  });

  it('liste les applications d\'une session', () => {
    const component = setup();
    expect(component.sessionServices(ssoSession('alice'))).toBe('https://app.exemple.fr/');
  });

  describe('suppression du compte', () => {
    it('annulée : aucun appel', () => {
      const component = setup({ accounts: [account('alice')] });
      vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(false));
      component.deleteAccount(account('alice'));
      http.expectNone((r) => r.method === 'DELETE');
    });

    it('révoque les appareils déjà chargés, supprime le compte et recharge', () => {
      const component = setup({ accounts: [account('alice')], devices: [device('alice')] }, 'admin');
      const confirm = vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
      component.deleteAccount(account('alice'));
      expect(confirm.mock.calls[0][0].message).toContain('1 appareil(s) de confiance');

      // Ordre imposé par le service : l'appareil est révoqué avant que le compte ne soit supprimé.
      http.expectOne('/api/multifactorTrustedDevices/alice%40Poste%40fp').flush(null);
      http.expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' }).flush(null);
      expect(snack).toHaveBeenCalledWith('Compte(s) TOTP et appareils de confiance associés supprimés.');
      flushLoad({});
    });

    it('signale l\'échec', () => {
      const component = setup({ accounts: [account('alice')] }, 'admin');
      vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
      component.deleteAccount(account('alice'));
      http
        .expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' })
        .flush(null, { status: 500, statusText: 'Server Error' });
      expect(snack).toHaveBeenCalledWith('Échec de la suppression du compte TOTP.');
    });

    it('supprimer SON propre compte déconnecte l\'application', () => {
      const component = setup({ accounts: [account('alice')] }, 'alice');
      const logout = vi.spyOn(TestBed.inject(CasAuthService), 'logout').mockImplementation(() => undefined);
      vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));
      component.deleteAccount(account('alice'));
      http.expectOne({ method: 'DELETE', url: '/api/gauthCredentialRepository/alice' }).flush(null);
      expect(logout).toHaveBeenCalled();
    });
  });

  it('révoque un appareil puis recharge ; signale l\'échec', () => {
    const component = setup({ devices: [device('alice')] });
    vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));

    component.revokeDevice(device('alice'));
    http.expectOne('/api/multifactorTrustedDevices/alice%40Poste%40fp').flush(null);
    flushLoad({});

    component.revokeDevice(device('alice'));
    http
      .expectOne('/api/multifactorTrustedDevices/alice%40Poste%40fp')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(snack).toHaveBeenCalledWith("Échec de la révocation de l'appareil.");
  });

  it('révoque une session SSO puis recharge ; signale l\'échec', () => {
    const component = setup({ sessions: [ssoSession('alice')] });
    vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true));

    component.revokeSession(ssoSession('alice'));
    http.expectOne((r) => r.url === '/api/ssoSessions/TGT-alice').flush(null);
    flushLoad({});

    component.revokeSession(ssoSession('alice'));
    http
      .expectOne((r) => r.url === '/api/ssoSessions/TGT-alice')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(snack).toHaveBeenCalledWith('Échec de la révocation de la session.');
  });
});
