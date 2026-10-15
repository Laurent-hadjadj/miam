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
 * Fabriques de données et mocks partagées par les tests unitaires (Vitest). Hors production :
 * ce dossier n'est utilisé que par les `*.spec.ts`.
 *
 * Les données sont fictives et génériques (aucun identifiant ni hôte réel) ; chaque fabrique accepte
 * des `overrides` pour ne préciser dans un test que les champs qui l'intéressent.
 */

import { signal } from '@angular/core';
import { AppBreakpoint, ResponsiveService } from '../app/core/responsive.service';
import { SsoSession, TotpAccount, TrustedDevice } from '../app/core/models';

/**
 * ResponsiveService pilotable : `fake.breakpoint.set('xsmall')` dans un test.
 *
 * @param initial palier initial (`large` par défaut).
 * @returns le signal `breakpoint` à piloter et le `provider` à ajouter à la configuration du `TestBed`.
 */
export function fakeResponsive(initial: AppBreakpoint = 'large') {
  const breakpoint = signal<AppBreakpoint>(initial);
  return { breakpoint, provider: { provide: ResponsiveService, useValue: { breakpoint } } };
}

/**
 * Compte TOTP fictif pour `username` (ne contient aucun secret, comme la forme `TotpAccount`).
 *
 * @param overrides champs à remplacer.
 */
export function account(username: string, overrides: Partial<TotpAccount> = {}): TotpAccount {
  return {
    id: 1,
    username,
    name: `Poste ${username}`,
    registrationDate: '2026-09-01T08:00:00.000+02:00',
    lastUsedDateTime: null,
    ...overrides,
  };
}

/**
 * Appareil de confiance fictif de `principal`. Sa `recordKey` suit le format `principal@Poste@fp`.
 *
 * @param overrides champs à remplacer.
 */
export function device(principal: string, overrides: Partial<TrustedDevice> = {}): TrustedDevice {
  return {
    id: 1,
    principal,
    deviceFingerprint: 'fp',
    recordDate: '2026-10-01T08:00:00.000+02:00',
    recordKey: `${principal}@Poste@fp`,
    name: 'Poste',
    expirationDate: '2026-10-01T20:00:00.000+02:00',
    ...overrides,
  };
}

/**
 * Session SSO fictive de `principal`, avec un seul service authentifié ; son TGT vaut `TGT-<principal>`.
 *
 * @param overrides champs à remplacer.
 */
export function ssoSession(principal: string, overrides: Partial<SsoSession> = {}): SsoSession {
  return {
    authenticated_principal: principal,
    authentication_date_formatted: '2026-10-01T08:00:00Z',
    ticket_granting_ticket: `TGT-${principal}`,
    number_of_uses: 1,
    remember_me: false,
    expiration_policy: { timeToIdle: 7200, timeToLive: 28800 },
    authenticated_services: { 'ST-1': { id: 'app', originalUrl: 'https://app.exemple.fr/', principal: principal } },
    ...overrides,
  };
}

/** Supprime le cookie de thème (`miam-theme`) pour isoler les tests : il persiste entre deux tests du même document. */
export function clearThemeCookie(): void {
  document.cookie = 'miam-theme=; path=/; max-age=0';
}
