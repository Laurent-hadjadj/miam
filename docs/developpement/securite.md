# 🔒 Sécurité

## 1️⃣ Modèle de menace

MIAM permet de **supprimer des facteurs d'authentification** : sa compromission serait une porte d'entrée vers les comptes des utilisateurs.

Les risques traités :

| Menace | Réponse |
| --- | --- |
| Appeler des API Actuator sans passer par CAS/MFA | Le navigateur n'y accède jamais ; seul le BFF le fait, derrière une session issue d'un ticket CAS validé côté serveur |
| Vol des identifiants des API Actuator | Uniquement dans la configuration serveur, jamais envoyés au navigateur ni écrits dans `/env.js` |
| Falsification de l'état côté navigateur | Le `sessionStorage` n'est qu'un cache d'affichage ; chaque appel `/api/*` revérifie la session serveur |
| Fuite des secrets TOTP | `secretKey`, `validationCode` et `scratchCodes` retirés par le BFF avant toute réponse |
| Usage détourné du relais | Seuls `GET` et `DELETE` sont relayés (405 sinon) : pas d'import de comptes, pas d'écriture |
| Action destructrice non attribuable | Journal d'activité côté BFF, avec l'identité réelle de l'agent, seulement sur succès |
| Session volée | Cookie `httpOnly`, `SameSite=Lax`, `Secure` en HTTPS, durée 8 h alignée sur le TGT |
| CSRF | `SameSite=Lax` + requêtes d'état uniquement par `fetch`/XHR (voir [Architecture](../architecture/architecture-technique.md)) |
| Agent trop privilégié | Deux profils issus des groupes AD (admin / consultation), **appliqués côté serveur** (403 sur toute suppression et sur le journal pour la consultation) ; hors des groupes : aucune session. Pas de table d'habilitations dans MIAM (source : l'annuaire) |
| Démarrage avec secrets par défaut | **Refusé** en production (`NODE_ENV=production`), y compris sans `ROLE_ADMIN_GROUPS` ; avertissement hors production |
| Dépendances vulnérables | `npm audit` : 0 vulnérabilité (relevé du 15/10/2026) — le relais HTTP est écrit avec `fetch`, sans bibliothèque de proxy |

## 2️⃣ En-têtes de sécurité

Posés sur toutes les réponses du module BFF :

| En-tête | Valeur |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

`X-Powered-By` est désactivé. Une erreur inattendue ne renvoie jamais de trace : message générique, détail dans les journaux du serveur.

> [!NOTE]
> Aucune origine tierce n'est autorisée : les polices (Roboto, Material Icons) sont embarquées dans l'application. Un test e2e échoue si une requête part ailleurs.

_
> [!NOTE]
> `style-src 'unsafe-inline'` est requis par les `<style>` qu'Angular injecte par composant. Le code de l'application, lui, n'utilise aucun style inline.

## 3️⃣ Scan ZAP

Scan dynamique OWASP ZAP (image `zaproxy/zap-stable`, scan actif complet avec spider client) exécuté le 15/10/2026 sur le module BFF servant le build de production, avec la CSP actuelle (aucune origine tierce), la page publique `/informations` et le point de santé, périmètre non authentifié :

| Résultat | Valeur |
| --- | --- |
| Échecs | **0** |
| Contrôles réussis | **111** |
| Avertissements | 2 (`unsafe-inline` des styles, inhérent à Angular ; « HTTP Only Site », sans objet : le scan tourne en HTTP, sans reverse proxy TLS) |

Rapports : `security/zap-reports/full-scan-report.html` et `.json` (scan du 15/10/2026), et `full-scan-report-2026-10-14.*` (scan précédent).

> [!NOTE]
> Le conteneur ZAP met ses règles à jour à chaque lancement : le nombre de contrôles varie d'un jour à l'autre (139 le 14/10, 111 le 15/10) sans changement de code. Trois constats du scan du 14/10 ne sont plus remontés mais restent exacts, et sans objet pour MIAM :
> - `Cross-Origin-Embedder-Policy` / `Cross-Origin-Opener-Policy` absents (application sans ressource tierce ni fenêtre croisée) ;
> - `bypassSecurityTrustHtml` dans le bundle : code interne d'Angular, non appelé par MIAM ;
> - `env.js` servi avec `max-age=0` : fichier public, non secret.

> [!NOTE]
> Le scan couvre la surface publique ; les pages protégées (session CAS) ne sont pas explorées par ZAP.
> Le module a été lancé avec `NODE_ENV=production` et des limites de débit relevées (`LOGIN_RATE_LIMIT`, `API_RATE_LIMIT`, `HEALTHCHECK_RATE_LIMIT`) : avec les limites par défaut, les 429 écourtent les attaques sur ces routes, ce qui est le comportement voulu.\
> À rejouer à chaque version (voir [Checklist de release](checklist-release.md)).

## 4️⃣ Points d'attention

> [!CAUTION]
>
> - **Sessions en mémoire** : un redémarrage du module BFF déconnecte les agents ; plusieurs instances derrière un répartiteur nécessiteraient un stockage de session partagé (Redis);
> - **Limitation de débit en mémoire** (une instance) : compteurs remis à zéro au redémarrage ; derrière un reverse proxy, fixer `TRUST_PROXY=1` ;
> - **Compte technique des API Actuator** : un seul compte partagé côté CAS, d'où l'importance du journal du module BFF pour l'attribution ;
> - **Fichiers locaux** : `.env`, `.git-credentials` et `.gitconfig` sont ignorés par Git et Docker, mais ne doivent pas être conservés dans une archive du dossier de travail.

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [`Checklist pour la version RELEASE`](./checklist-release.md) - [`Pour bien démarrer`](./pour-bien-demarrer.md) - [`Regroupement-commits`](./regroupement-commits.md) - [`Test E2E`](./test-e2e.md) - [`Test unitaire`](./test-unitaire.md) - [`Thème et Accessibilité`](./themes-accessibilite.md)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
