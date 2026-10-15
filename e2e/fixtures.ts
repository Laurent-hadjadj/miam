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

/**
 * Contrat commun des tests e2e : tout ce qu'une spec doit utiliser pour simuler le monde extérieur.
 *
 * Principe : le navigateur est réel (Chrome), mais **rien d'extérieur n'est joint**. Ni CAS, ni module BFF,
 * ni actuator, ni MongoDB : chaque appel réseau de l'application est intercepté par `page.route` et reçoit
 * une réponse fabriquée ici. Les tests tournent donc partout (poste, intégration continue) et sont
 * déterministes.
 *
 * Les appels que l'application émet réellement, et qu'il faut donc simuler :
 *
 * | Appel du navigateur                                       | Simulé par             |
 * | --------------------------------------------------------- | ---------------------- |
 * | `POST /bff/session` (échange d'un ticket CAS)             | {@link mockBffSession} |
 * | `GET /api/gauthCredentialRepository`                      | {@link mockActuator}   |
 * | `GET /api/multifactorTrustedDevices`                      | {@link mockActuator}   |
 * | `GET /api/ssoSessions`                                    | {@link mockActuator}   |
 * | `GET /bff/audit-log`                                      | {@link mockActuator}   |
 * | `GET {CAS}/login`, `GET {CAS}/logout` (redirections)      | {@link casRoute}       |
 * | `GET/DELETE /api/<ressource>/<utilisateur>` (aperçu)      | `page.route` dans la spec |
 *
 * Règles de `page.route` à connaître :
 * - les routes sont essayées dans l'ordre INVERSE de leur enregistrement : la dernière enregistrée passe
 *   en premier, une route plus spécifique doit donc être déclarée après une route plus générale ;
 * - `route.fallback()` passe à la route enregistrée avant ; `route.continue()` envoie la requête au
 *   RÉSEAU (donc ici vers un serveur absent) ;
 * - les routes sont propres à une page : chaque test repart de zéro.
 */

import { expect, Page, Route } from '@playwright/test';

import { DEFAULT_CAS_BASE_URL } from '../src/app/core/cas-defaults';

/** Clé `sessionStorage` du miroir de session lu par `CasAuthService` (voir src/app/core/cas-auth.service.ts). */
const SESSION_KEY = 'totp-admin-cas-session';

/**
 * Motif de route Playwright d'une page CAS vue du navigateur.
 *
 * Construit depuis le contexte par défaut de l'application (src/app/core/cas-defaults.ts), jamais écrit en
 * dur dans les specs : changer ce défaut ne doit casser aucun test.
 *
 * @param action page CAS visée.
 * @returns motif glob (joker devant et derrière) de l'adresse `<contexte CAS>/<action>`.
 */
export const casRoute = (action: 'login' | 'logout'): string => `**${DEFAULT_CAS_BASE_URL}/${action}**`;

/**
 * Prédicat d'URL pour `page.waitForURL` : vrai quand le navigateur est arrivé sur la page CAS demandée avec
 * un paramètre `service` (adresse de retour). Le CONTENU de `service` se vérifie ensuite dans la spec.
 *
 * @param action page CAS attendue.
 * @example
 * await page.waitForURL(casUrlPattern('login'));
 */
export const casUrlPattern =
  (action: 'login' | 'logout') =>
    (url: URL): boolean =>
      url.pathname === `${DEFAULT_CAS_BASE_URL}/${action}` && url.searchParams.has('service');

/** Compte TOTP tel que renvoyé par `gauthCredentialRepository` (champs utilisés par l'application). */
export interface TotpAccountFixture {
  id: number;
  /** Identifiant de l'agent (clé de suppression : `DELETE /api/gauthCredentialRepository/<username>`). */
  username: string;
  /** Nom de l'appareil d'enrôlement affiché dans la liste. */
  name: string;
  /** Date ISO 8601 avec décalage ; l'interface l'affiche en `dd/MM/yyyy HH:mm`. */
  registrationDate: string;
  lastUsedDateTime: string | null;
}

/** Appareil de confiance tel que renvoyé par `multifactorTrustedDevices`. */
export interface TrustedDeviceFixture {
  id: number;
  /** Identifiant de l'agent propriétaire : rattache l'appareil à un compte TOTP. */
  principal: string;
  deviceFingerprint: string;
  recordDate: string;
  /** Clé de révocation (`<principal>@<nom>@<empreinte>`), passée dans l'URL du `DELETE`. */
  recordKey: string;
  name: string;
  /** Date ISO 8601 ; affichée « Expire le … ». */
  expirationDate: string;
}

/**
 * Fabrique un compte TOTP valide ; les champs non précisés reçoivent des valeurs plausibles.
 * L'`id` est aléatoire : ne pas s'appuyer dessus dans une assertion.
 *
 * @param username identifiant de l'agent.
 * @param overrides champs à imposer (ex. `{ name: 'Portable Alice' }` pour tester un filtre).
 */
export function makeAccount(username: string, overrides: Partial<TotpAccountFixture> = {}): TotpAccountFixture {
  return {
    id: Math.floor(Math.random() * 1_000_000_000),
    username,
    name: `Poste ${username}`,
    registrationDate: '2026-09-01T08:00:00.000+02:00',
    lastUsedDateTime: null,
    ...overrides,
  };
}

/**
 * Fabrique un appareil de confiance valide pour l'agent `principal`.
 * `id` et `deviceFingerprint` sont aléatoires ; `recordKey` suit le format réel de CAS.
 *
 * @param principal identifiant de l'agent propriétaire.
 * @param overrides champs à imposer (ex. `{ expirationDate }` pour tester le format de date).
 */
export function makeDevice(principal: string, overrides: Partial<TrustedDeviceFixture> = {}): TrustedDeviceFixture {
  return {
    id: Math.floor(Math.random() * 1_000_000_000),
    principal,
    deviceFingerprint: 'fp-' + Math.random().toString(36).slice(2),
    recordDate: '2026-10-01T08:00:00.000+02:00',
    recordKey: `${principal}@Poste ${principal}@fp-test`,
    name: `Poste ${principal}`,
    expirationDate: '2026-10-01T20:00:00.000+02:00',
    ...overrides,
  };
}

/** Session SSO (TGT) telle que renvoyée par `ssoSessions` ; les noms de champs sont ceux de CAS (snake_case). */
export interface SsoSessionFixture {
  /** Agent connecté : sa présence ici allume la pastille « session active » dans la liste. */
  authenticated_principal: string;
  authentication_date_formatted: string;
  number_of_uses: number;
  /** Identifiant du TGT, passé dans l'URL de révocation (`DELETE /api/ssoSessions/<TGT>?principal=…`). */
  ticket_granting_ticket: string;
  remember_me: boolean;
  /** Durées en secondes. */
  expiration_policy: { timeToIdle: number; timeToLive: number };
  authenticated_services: Record<string, { id: string; originalUrl: string; principal: string }>;
}

/**
 * Fabrique une session SSO active pour l'agent `principal`. Le TGT est aléatoire : deux sessions
 * fabriquées se distinguent.
 *
 * @param principal identifiant de l'agent connecté.
 * @param overrides champs à imposer.
 */
export function makeSession(principal: string, overrides: Partial<SsoSessionFixture> = {}): SsoSessionFixture {
  return {
    authenticated_principal: principal,
    authentication_date_formatted: '2026-10-01T08:00:00Z',
    number_of_uses: 1,
    ticket_granting_ticket: 'TGT-1-fixture-' + Math.random().toString(36).slice(2),
    remember_me: false,
    expiration_policy: { timeToIdle: 7200, timeToLive: 28800 },
    authenticated_services: {
      'ST-1-fixture': { id: 'http://localhost:4200/', originalUrl: 'http://localhost:4200/', principal },
    },
    ...overrides,
  };
}

/**
 * Ouvre une session applicative AVANT tout script de la page : l'agent est considéré connecté sans passer
 * par CAS, et `casAuthGuard` laisse entrer.
 *
 * Ne simule QUE le côté navigateur (le miroir en `sessionStorage`). Les appels `/api` qui suivent restent à
 * simuler avec {@link mockActuator}, sinon ils partent en vrai réseau.
 *
 * @param page page Playwright, avant `page.goto`.
 * @param username agent connecté. Utiliser `sophie.petite-coeur` : un compte réel ne doit jamais figurer ici
 *   (donnée personnelle).
 * @param role `admin` (suppression, révocation, journal) ou `consultation` (lecture seule) ; le profil réel
 *   est décidé par le module BFF d'après les groupes AD, l'interface ne fait que le refléter.
 * @example
 * await withSession(page, 'bob.lecteur', 'consultation');
 */
export async function withSession(
  page: Page,
  username = 'sophie.petite-coeur',
  role: 'admin' | 'consultation' = 'admin',
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => sessionStorage.setItem(key, value),
    [SESSION_KEY, JSON.stringify({ username, role })],
  );
}

/**
 * Simule l'échange d'un ticket CAS auprès du module BFF (`POST /bff/session`). C'est le BFF, et non le
 * navigateur, qui valide le ticket auprès de CAS (voir cas-auth.service.ts et api-config.ts).
 *
 * @param page page Playwright, avant `page.goto('/?ticket=…')`.
 * @param result `{ username, role? }` : ticket accepté (profil `admin` par défaut) ; `{ status }` : ticket
 *   refusé avec ce code HTTP (401 : ticket invalide, 403 : agent authentifié mais hors des groupes habilités,
 *   502 : CAS injoignable).
 * @example
 * await mockBffSession(page, { status: 403 }); // agent hors des groupes
 */
export async function mockBffSession(
  page: Page,
  result: { username: string; role?: 'admin' | 'consultation' } | { status: number },
): Promise<void> {
  await page.route('**/bff/session', (route) => {
    // Seul le POST d'ouverture est simulé : un GET (lecture de la session) suit son cours.
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    if ('username' in result) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ role: 'admin', ...result }) });
    }
    return route.fulfill({ status: result.status, contentType: 'application/json', body: '{"error":"invalide"}' });
  });
}

/** Réponse JSON 200 : fabrique un gestionnaire de route qui renvoie `data`. */
function jsonRoute(data: unknown) {
  return (route: Route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
}

/** Entrée du journal d'activité telle que renvoyée par `GET /bff/audit-log` (réservé au profil admin). */
export interface AuditLogEntryFixture {
  /** Date ISO 8601 UTC. */
  timestamp: string;
  /** Agent qui a agi. */
  actor: string;
  action: 'DELETE_TOTP_ACCOUNT' | 'REVOKE_TRUSTED_DEVICE' | 'REVOKE_SSO_SESSION';
  /** Compte qui a subi l'action. */
  target: string | null;
  /** Précision : identifiant de TGT ou clé d'appareil, selon l'action. */
  detail: string | null;
}

/**
 * Simule les quatre sources que la page de gestion charge à CHAQUE rechargement : comptes TOTP, appareils
 * de confiance, sessions SSO (relais `/api` du module BFF) et journal (`/bff/audit-log`).
 *
 * À appeler pour tout test qui ouvre `/users`, `/users/<agent>` ou `/journal`, même si la spec n'utilise pas
 * une des listes : sans mock, la requête partirait en vrai réseau (401 d'un BFF sans session, ou refus de
 * connexion).
 *
 * Seules les LECTURES des listes sont simulées. Les `DELETE` et les appels par utilisateur
 * (`/api/<ressource>/<agent>`) ne le sont pas : la spec les déclare elle-même (et passe la main avec
 * `route.continue()` pour les méthodes qu'elle ne traite pas).
 *
 * @param page page Playwright.
 * @param accounts comptes TOTP renvoyés (liste complète, avant pagination).
 * @param devices appareils de confiance renvoyés.
 * @param sessions sessions SSO actives renvoyées.
 * @param auditLog entrées du journal renvoyées.
 * @example
 * await mockActuator(page, [makeAccount('alice')], [makeDevice('alice')], [makeSession('alice')]);
 */
export async function mockActuator(
  page: Page,
  accounts: TotpAccountFixture[],
  devices: TrustedDeviceFixture[],
  sessions: SsoSessionFixture[] = [],
  auditLog: AuditLogEntryFixture[] = [],
): Promise<void> {
  await page.route('**/api/gauthCredentialRepository', (route) => {
    if (route.request().method() === 'GET') {
      return jsonRoute(accounts)(route);
    }
    return route.continue();
  });
  await page.route('**/api/multifactorTrustedDevices', (route) => {
    if (route.request().method() === 'GET') {
      return jsonRoute(devices)(route);
    }
    return route.continue();
  });
  await page.route('**/api/ssoSessions', (route) => {
    if (route.request().method() === 'GET') {
      // API Actuator du serveur CAS enveloppe la liste dans `activeSsoSessions`.
      return jsonRoute({ activeSsoSessions: sessions })(route);
    }
    return route.continue();
  });
  await page.route('**/bff/audit-log', (route) => {
    if (route.request().method() === 'GET') {
      // Le module BFF enveloppe la liste dans `entries`.
      return jsonRoute({ entries: auditLog })(route);
    }
    return route.continue();
  });
}

/**
 * Confirme la boîte d'alerte accessible (rôle `alertdialog`, qui remplace l'ancien `confirm()` natif) en
 * cliquant sur son bouton d'action, puis attend sa fermeture.
 *
 * Échoue si la boîte n'est pas visible : à appeler juste après le clic qui l'ouvre. Le bouton cherché
 * s'appelle « Supprimer » ou « Révoquer » (le bouton « Annuler » est écarté).
 *
 * @param page page Playwright.
 */
export async function confirmDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Supprimer|Révoquer/ }).click();
  await expect(dialog).toBeHidden();
}
