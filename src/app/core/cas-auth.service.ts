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


import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { CAS_BASE_URL, PREFIX_URL } from './api-config';

/** Clé du miroir d'affichage dans `sessionStorage` (propre à l'onglet, effacé à sa fermeture). */
const SESSION_KEY = 'totp-admin-cas-session';
/** Ouverture de la session applicative : échange d'un ticket CAS contre une session BFF. */
const BFF_SESSION_URL = `${PREFIX_URL}/bff/session`;
/** Fermeture de la session BFF. */
const BFF_LOGOUT_URL = `${PREFIX_URL}/bff/logout`;

/** `admin` : lecture, suppression, journal. `consultation` : lecture seule (attribué par les groupes AD, voir server/roles.js). */
export type Role = 'admin' | 'consultation';

/** Issue d'une tentative de connexion : `non-habilite` = authentifié par CAS mais dans aucun groupe MIAM. */
export type LoginResult = 'ok' | 'invalide' | 'non-habilite';

/** Contenu du miroir de session : identité et profil, jamais de jeton ni de secret. */
interface CasSession {
  username: string;
  role: Role;
}

/**
 * Authentification applicative via CAS + MFA, intermédiée par le BFF
 * (server/app.js) : le navigateur ne valide jamais de ticket ni n'appelle
 * l'API Actuator directement, il passe par /bff/session et /api/* sur sa propre
 * origine. Le MFA est rendu obligatoire côté CAS par le fichier de service
 * dédié (multifactorAuthenticationPolicy, voir docs/architecture/integration-cas.md),
 * indépendamment du déclencheur global par groupe AD.
 *
 * Le signal `session` ci-dessous (et son miroir sessionStorage) n'est qu'un
 * CACHE d'affichage pour l'UI (nav, bouton de connexion) - la vraie barrière
 * de sécurité est la session serveur (cookie httpOnly posée par le BFF) que
 * chaque appel /api/* vérifie indépendamment. Un état client falsifié
 * n'ouvre donc aucun accès réel aux données.
 */
@Injectable({ providedIn: 'root' })
export class CasAuthService {
  private readonly http = inject(HttpClient);

  /** Miroir d'affichage, initialisé depuis `sessionStorage` (survit à un rafraîchissement de l'onglet). */
  private readonly session = signal<CasSession | null>(this.readFromStorage());

  /** Vrai si un agent est connecté d'après le miroir (affichage et gardes de navigation uniquement). */
  readonly isAuthenticated = computed(() => this.session() !== null);
  /** Identifiant de l'agent connecté, `null` sans session. */
  readonly username = computed(() => this.session()?.username ?? null);
  /** Profil de l'agent connecté (`admin` ou `consultation`), `null` sans session. */
  readonly role = computed(() => this.session()?.role ?? null);
  /** Seul le profil administrateur voit les boutons de suppression et le journal (le BFF refuse de toute façon). */
  readonly isAdmin = computed(() => this.session()?.role === 'admin');

  /** URL de service CAS : toujours la même page, sans query string/hash. */
  private currentServiceUrl(): string {
    return window.location.origin + window.location.pathname;
  }

  /** Redirige vers l'écran de connexion CAS (webflow MFA inclus). */
  redirectToLogin(): void {
    const service = encodeURIComponent(this.currentServiceUrl());
    window.location.href = `${CAS_BASE_URL}/login?service=${service}`;
  }

  /**
   * Fait valider le ticket par le BFF (lui seul parle à /p3/serviceValidate,
   * côté serveur) et ouvre la session applicative si le ticket est valide.
   *
   * @param ticket ticket de service (`ST-…`) reçu en retour de la connexion CAS.
   * L'URL de service transmise au BFF est calculée comme dans `redirectToLogin` (page courante sans
   * query string), de sorte que la validation du ticket porte sur le même service.
   *
   * @returns un flux qui émet une seule issue et ne tombe jamais en erreur : `ok` (session ouverte
   *   et mémorisée), `non-habilite` (réponse 403 : authentifié par CAS mais dans aucun groupe MIAM)
   *   ou `invalide` (toute autre erreur). Sans `ok`, aucune session n'est ouverte.
   */
  validateTicket(ticket: string): Observable<LoginResult> {
    const service = this.currentServiceUrl();

    return this.http.post<{ username: string; role: Role }>(BFF_SESSION_URL, { ticket, service }).pipe(
      map((body): LoginResult => {
        const session: CasSession = { username: body.username, role: body.role };
        this.session.set(session);
        this.writeToStorage(session);
        return 'ok';
      }),
      catchError((error: HttpErrorResponse) => of<LoginResult>(error.status === 403 ? 'non-habilite' : 'invalide')),
    );
  }

  /**
   * Ferme la session BFF puis déclenche la vraie déconnexion CAS (SLO, TGT
   * détruit - une reconnexion repassera intégralement par le login + MFA).
   * `service` ramène le navigateur sur la page de confirmation de
   * déconnexion plutôt que sur la page CAS par défaut - nécessite
   * `cas.logout.follow-service-redirects: true` côté CAS, sans quoi ce
   * paramètre est ignoré (vérifié par décompilation de
   * DefaultLogoutRedirectionStrategy, CAS 6.6.15.2).
   */
  logout(): void {
    this.session.set(null);
    sessionStorage.removeItem(SESSION_KEY);

    this.http
      .post(BFF_LOGOUT_URL, {})
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        const service = encodeURIComponent(`${window.location.origin}/deconnexion`);
        window.location.href = `${CAS_BASE_URL}/logout?service=${service}`;
      });
  }

  /** Relit le miroir ; toute donnée absente, illisible ou sans identifiant donne `null` (pas de session). */
  private readFromStorage(): CasSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }
      const stored = JSON.parse(raw) as { username?: string; role?: Role };
      // Cache d'affichage d'avant les profils (sans rôle) : traité en lecture seule, le BFF reste juge.
      return stored.username ? { username: stored.username, role: stored.role ?? 'consultation' } : null;
    } catch {
      return null;
    }
  }

  /** Mémorise le miroir ; un échec d'écriture est toléré (voir le commentaire du `catch`). */
  private writeToStorage(session: CasSession): void {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // sessionStorage indisponible : la session reste valide en mémoire
      // pour l'onglet courant (signal), juste pas persistée au refresh.
    }
  }
}
