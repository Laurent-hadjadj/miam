# 🧪 Tests unitaires

## 1️⃣ État des suites (relevé du 15/10/2026)

| Suite | Fichiers | Tests | Outil | Nature |
| --- | ---: | ---: | --- | --- |
| Application Angular (`src/**/*.spec.ts`) | 21 | **116** | Vitest 5 + `TestBed` (jsdom) | Services, garde, composants |
| Module BFF (`server/test/*.test.js`) | 4 | **41** | `node:test` (intégré à Node) | Routes, session, relais, journal, configuration, point de santé |
| Bout en bout (`e2e/`) | 9 | **59** | Playwright | Voir [Tests e2e](test-e2e.md) |

> **Couverture de code**

| Périmètre | Lignes | Branches | Fonctions | Instructions |
| --- | ---: | ---: | ---: | ---: |
| Application Angular | **95,41 %** | 93,45 % | 90,04 % | 93,95 % |
| BFF (`server/`) | **97,79 %** | 93,79 % | 97,83 % | — |

> [!NOTE]
> Ces valeurs sont un **relevé manuel**, pas une sortie de CI : elles se périment à chaque campagne de tests. Les régénérer avec `npm run test:coverage` et `npm run test:bff` (voir [Checklist de release](checklist-release.md)).

Seuils bloquants (`angular.json`, `coverageThresholds`) : 85 % sur les instructions, branches, fonctions et lignes — `npm run test:coverage` échoue en dessous.

## 2️⃣ Exécuter

```bash
npm test                  # application Angular, sans mode watch
npm run test:coverage     # idem + couverture + seuils (rapport texte)
npm run test:bff          # BFF + couverture Node
```

Les tests Angular s'exécutent dans jsdom : ni navigateur ni serveur requis.

## 3️⃣ Organisation

Chaque `*.spec.ts` est à côté du fichier testé. Les doublures partagées sont dans `src/testing/fakes.ts` (compilé uniquement pour les tests) :

| Doublure | Usage |
| --- | --- |
| `fakeResponsive(initial)` | Remplace `ResponsiveService` par un signal pilotable (`breakpoint.set('xsmall')`) |
| `account()`, `device()`, `ssoSession()` | Fabriques de données conformes aux modèles |
| `clearThemeCookie()` | Remet le thème à zéro entre deux tests |

| Zone | Ce qui est vérifié |
| --- | --- |
| `core/*.service` | URL, verbes et **encodage** des identifiants (`recordKey` avec `@`, espaces, `/`), extraction des réponses, session et son cache d'affichage |
| `AccountAdminService` | Cascade : appareils de l'utilisateur (et eux seuls) révoqués **avant** le compte ; aucun compte supprimé si une révocation échoue |
| `ThemeService`, `ResponsiveService` | Cookie, attribut `data-theme`, favicons, correspondance points de rupture Material |
| `casAuthGuard` | Laisse passer / renvoie vers l'accueil sans connexion automatique |
| Composants | Rendu du gabarit **et** logique : filtres, pagination, confirmation, suppression de son propre compte (déconnexion), messages d'échec, logo selon thème et point de rupture |

## 4️⃣ Écrire un test

- Données : fabriques de `src/testing/fakes.ts` ; requêtes : `HttpTestingController` (`expectOne`, `expectNone`, `verify()` en `afterEach`) ;
- boîte de confirmation : `vi.spyOn(ConfirmService.prototype, 'ask').mockReturnValue(of(true))` (un `Observable` : le test reste synchrone) ;
- messages de résultat : `vi.spyOn(NotificationService.prototype, 'show')` ;
- déconnexion : `vi.spyOn(TestBed.inject(CasAuthService), 'logout').mockImplementation(() => undefined)` pour ne pas naviguer hors de jsdom ;
- toujours remettre les doublures à zéro (`vi.restoreAllMocks()`), même quand `http.verify()` échoue (`try/finally`).

> [!TIP]
> `ConfirmService` et `NotificationService` sont des services racine : on les espionne **sur le prototype**, sans avoir à les fournir dans chaque `TestBed`.

## 5️⃣ Tests du module BFF

`createApp(config)` construit l'application sans écouter de port ni lire l'environnement : les tests lancent un **faux CAS** (validation de ticket + actuator, qui enregistre ce qu'il reçoit), une base SQLite en mémoire (`:memory:`) et un dossier statique temporaire.

| Sujet | Cas couverts |
| --- | --- |
| En-têtes | CSP, `X-Frame-Options`, `nosniff`, pas de `X-Powered-By` |
| `/env.js` | Configuration publique seulement, jamais de secret |
| Authentification | 401 sans session partout ; 400/401 sur ticket absent/invalide ; cookie `httpOnly` + `SameSite=Lax` ; déconnexion ; CAS injoignable (502) |
| Relais | `Authorization: Basic` ajouté **côté serveur** ; verbes autres que GET/DELETE refusés (405) ; actuator injoignable (502) |
| Données sensibles | `secretKey`, `validationCode`, `scratchCodes` absents des réponses |
| Journal | Les trois types d'action et la suppression en masse sont tracés avec l'agent réel ; un échec CAS ou une lecture ne l'est pas ; URL malformée sans plantage |
| Habilitations | Extraction de `memberOf` (valeurs multiples, entités XML), correspondance par nom court ; administrateur / consultation / hors groupe ; **403** sur toute suppression et sur le journal pour la consultation (rien n'est envoyé à CAS, rien n'est journalisé) ; **403** à la connexion hors groupe ; production sans `ROLE_ADMIN_GROUPS` refusée |
| Purge du journal | Seules les entrées plus anciennes que la durée sont supprimées (12 puis 6 mois), purge idempotente ; configuration : 12 par défaut, 6 à 12 acceptés, autre valeur refusée |
| Point de santé | Public (sans session) ; 200 / `OK`, 503 / `KO` si CAS est injoignable, 429 au-delà de la limite de débit (idem pour `/bff/session` et `/api`, avec `Retry-After`) ; `/api/*` reste protégé ; cache de 5 s, 5xx de CAS = défaut, 3xx/4xx = joignable |
| Configuration | Valeurs par défaut ; **démarrage refusé en production** sans secrets ; simple avertissement hors production |

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [`Checklist pour la version RELEASE`](./checklist-release.md) - [`Pour bien démarrer`](./pour-bien-demarrer.md) - [`Sécurité`](./securite.md) - [`Sécurité`](./securite.md) -  [`Test E2E`](./test-e2e.md) - [`Thème et Accessibilité`](./themes-accessibilite.md)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
