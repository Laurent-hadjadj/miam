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
 * Formes exactes CAS 6.6.15.2
 * (voir cas-server-core-authentication-api / cas-server-support-trusted-mfa-core).
 */

/**
 * org.apereo.cas.authentication.OneTimeTokenAccount (endpoint gauthCredentialRepository).
 * `secretKey`, `validationCode` et `scratchCodes` sont retirés par le BFF avant
 * d'atteindre le navigateur (voir server/app.js) : volontairement absents ici.
 */
export interface TotpAccount {
  id: number;
  username: string;
  name: string;
  registrationDate: string | null;
  lastUsedDateTime: string | null;
}

/** org.apereo.cas.trusted.authentication.api.MultifactorAuthenticationTrustRecord (endpoint multifactorTrustedDevices) */
export interface TrustedDevice {
  id: number;
  principal: string;
  deviceFingerprint: string;
  recordDate: string;
  recordKey: string;
  name: string;
  expirationDate: string;
}

/** org.apereo.cas.ticket.TicketGrantingTicket (endpoint ssoSessions, SingleSignOnSessionsEndpoint). */
interface SsoSessionAuthenticatedService {
  id: string;
  originalUrl: string;
  principal: string;
}

interface SsoSessionExpirationPolicy {
  timeToIdle: number;
  timeToLive: number;
}

/** Session SSO telle que renvoyée par l'API Actuator `ssoSessions` (noms de champs en snake_case, imposés par CAS). */
export interface SsoSession {
  authenticated_principal: string;
  authentication_date_formatted: string;
  number_of_uses: number;
  ticket_granting_ticket: string;
  remember_me: boolean;
  expiration_policy: SsoSessionExpirationPolicy;
  authenticated_services: Record<string, SsoSessionAuthenticatedService>;
}

/** Actions tracées dans le journal : suppression d'un compte TOTP, révocation d'un appareil de confiance ou d'une session SSO. */
export type AuditAction = 'DELETE_TOTP_ACCOUNT' | 'REVOKE_TRUSTED_DEVICE' | 'REVOKE_SSO_SESSION';

/** Journal d'activité du module BFF (server/app.js, table SQLite audit_log) - pas une forme CAS. */
export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  action: AuditAction;
  target: string | null;
  detail: string | null;
}
