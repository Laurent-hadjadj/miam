# Changelog

Toutes les évolutions notables de MIAM sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.2.0] - 2026-10-25

### Ajouté

- **Compteurs par motif dans le journal** : trois tuiles indiquent le nombre de suppressions de compte TOTP, de révocations d'appareil de confiance et de révocations de session SSO (calculées sur les entrées retenues par les filtres) ;
- **Tri du journal par colonne ou par direction** : cliquer sur l'en-tête d'une colonne trie les lignes par cette colonne ; un deuxième clic inverse la direction (croissant / décroissant), un troisième supprime le tri. L'en-tête actif et la direction sont indiqués par une flèche ;
- **Badge d'environnement sur toutes les pages** : le badge (DEV, INT, REC, PRD) présent dans l'en-tête des pages publiques est désormais aussi affiché dans la barre d'outils connectée (`mat-toolbar`), visible sur toutes les pages après authentification ;
- **Tests e2e — preuves visuelles** : `npm run e2e:visuel` (config `playwright.visuel.config.ts`) enregistre une vidéo, une capture et une trace par test et produit un rapport HTML consultable avec `npm run e2e:rapport` ;

### Modifié

- **Journal ouvert au profil consultation** : `GET /bff/audit-log` n'exige plus le profil administrateur, le lien et la page « Journal » ainsi que la tuile « Suppressions journalisées » sont visibles par la consultation. Le journal n'affichant que l'agent, l'action, le compte concerné et l'heure, le BFF ne renvoie plus le champ `detail` (clé d'appareil, TGT), y compris pour les anciennes entrées ; il reste en base. `adminGuard` et `requireAdmin` sont supprimés (code mort) ;

### Corrigé

- **Docker — journal local embarqué dans l'image** : `server/data` (base SQLite d'audit, données personnelles) n'était pas exclu par `.dockerignore` ; `COPY server` l'embarquait et le volume `/app/server/data` en héritait au premier démarrage. Exclus, ainsi que `playwright-report` (70 Mo), `playwright*.config.ts`, `skills` et `scripts` ;
- **Docker — `PREFIX_URL`** : variable transmise par `docker-compose.yml` et documentée dans `docs/exploitation/configuration.md` (le port CAS par défaut y est corrigé : 8083) ;
- **Liste des utilisateurs — libellé du bouton de révocation d'appareil** : l'apostrophe typographique de l'`aria-label` est rétablie (échappée en `\u2019`), ce qui corrige un test e2e d'accessibilité ;
- **Tests BFF** : `startBff` fournit `prefixUrl`, la signature de `AuditLog.record` (`target_display`) et le port CAS par défaut (8083) sont alignés ; 53 tests passent ;
- **Page d'accueil — icône des messages d'alerte tronquée** : dans le bandeau d'erreur (ex. utilisateur authentifié mais absent du groupe AD autorisé), l'icône `mat-icon` rétrécissait dans le conteneur `flex` quand le message était long. Elle ne rétrécit plus (`flex: 0 0 auto`) et le texte passe à la ligne (`overflow-wrap`) ;
- **Liste des utilisateurs — seuil d'alerte du journal** : `auditLogCountIsHigh` reste un signal `computed` avec le seuil de 1 000 000 d'entrées (le refactoring l'avait transformé en méthode avec un seuil de 100) ;
- **Tests — couverture** : 4 tests ajoutés pour le tri du journal (tri par défaut, cycle croissant / décroissant / aucun, colonne unique, cibles nulles) ; 128 tests unitaires, seuils de couverture (85 %) respectés ;
- **Version affichée dans le pied de page** : le fallback statique passait de `1.0.0` à `1.2.0` pour coller à la version `package.json` ; la version est désormais lue dynamiquement via `APP_VERSION` exposée par `/env.js` (résolue depuis `package.json` par le BFF si non fournie) ;
- **Tri — erreurs de type TypeScript** : les méthodes `activeSortColumn()` et `activeSortDirection()` du journal renvoyaient `''` (chaîne vide) au lieu d'un type `'asc' | 'desc'`. Converties en `computed` signals avec les types explicites `'string'` et `'asc' | 'desc'` ;
- **Tri — table non reconnue par Material** : la balise `<table>` du journal manquait l'attribut `mat-table`, provoquant une erreur de compilation Angular (`MatTableModule` ne trouvait pas l'élément). Ajout de `mat-table` ;
- **Liste des utilisateurs — erreurs de build et de tests** :
  - `AccountAdminService.getAll()` n'existait pas ; remplacé par `gauthService.getAll()` pour les comptes TOTP et `trustedDeviceService.getAll()` pour les appareils ;
  - `user-list.html` : `[attr.aria-label]` contenait une apostrophe française (`l'appareil`) qui plantait le compilateur Angular. Remplacée par `\u0027` (escape Unicode) ;
  - Tests `user-list.spec.ts` : 4 échecs dus au chargement asynchrone (`Promise.all` + `Promise.all().then()` ne se résolvait pas avant les assertions). Ajout d'une fonction `flushMicrotasks()` pour attendre les micro-tâches, et restructuration de `setup()` pour que `fixture.detectChanges()` et `flushLoad()` s'exécutent dans le bon ordre ;
  - Suppression du fichier `src/user-list.ts` (ancien chemin non utilisé par les routes) ;

## [1.1.1] - 2026-10-21

### Corrigé

- **Tests unitaires — URLs d'API incohérentes** : les tests de `TrustedDeviceService` attendaient `/bff/api/...` au lieu de `/api/...` (valeur de `API_BASE_URL`). Corrigé ;
- **Tests unitaires — query string `principal` manquante** : les tests de `user-details` et `user-list` qui mockaient `DELETE /api/multifactorTrustedDevices/{key}` ne tenaient pas compte du paramètre `?principal=` ajouté par `TrustedDeviceService.revoke()`. Remplacé les `expectOne` par des predicates vérifiant URL + `principal` ;
- **Tests E2E — `addCookies` timeout** : les 3 échecs sur `accessibility.spec.ts` étaient dus au serveur Angular non démarré (`localhost:4200`). Les tests passent en lançant `ng serve` avant `npm run e2e` ;
- **Sécurité — npm audit** : 2 des 4 failles corrigées par `npm audit fix` (`@modelcontextprotocol/server` dans `@angular/cli`, transport HTTP / fuite mémoire / bearer auth). Les 2 restantes (`vite`/`launch-editor` via `@angular/build`) sont sans impact en production (usage développement uniquement) ;

## [1.1.0] - 2026-10-20

### Corrigé

- **Sessions SSO — décalage horaire +2 h** : le pipe `date` de Angular convertissait implicitement les dates UTC en heure locale Paris (CEST). Ajout du paramètre `'UTC'` au pipe `date` dans les onglets « Sessions SSO » et les fiches utilisateur pour un affichage cohérent ;
- **Journal — compte concerné cliquable** : la colonne « Compte concerné » affichait un bouton `<button>` ouvrant la fiche utilisateur. Remplacé par un `<span>` — le journal est statique, pas de navigation ;
- **Journal — noms de comptes erronés** : le mappage via `TotpAccount.name` retournait le nom de l'appareil TOTP (ex. « Poste 19 ») au lieu du login du compte. Le champ s'affiche désormais tel quel (`entry.target`) ;
- **Journal — lignes manquantes** : le filtrage et la pagination étaient corrects mais un code de mapping TOTP parasite interférait avec l'affichage. Nettoyé ;

### Amélioré

- **Déconnexion auto après révocation SSO** : si un utilisateur se révoque sa propre session SSO, il est déconnecté de l'application (comme pour la suppression de son propre compte TOTP). La vérification `casAuth.username()` garantit qu'un admin qui révoque le compte d'un autre utilisateur ne le déconnecte pas ;
- **Révocation appareil de confiance — journal** : le `target` du journal contenait le `recordKey` JWT au lieu du login du compte concerné. Le frontend envoie désormais le `principal` en query string (comme pour les sessions SSO), et le module BFF l'utilise comme `target` dans le journal. Fallback sur l'extraction du login du recordKey pour les appels sans `principal` ;
- **Badge d'environnement** : nouvelle variable `ENVIRONMENT` (DEV, INT, REC, PRD) affichée dans l'en-tête à côté du logo MIAM sous forme de badge coloré. Exposée via `/env.js`, configurée dans `.env.example`, Dockerfile et docker-compose ;
- **Journal — colonne `target_display`** : la méthode `audit.record()` accepte désormais 5 paramètres (`target_display` ajouté). Le TGT n'est plus stocké dans le journal (retiré de `prepareApiDeleteAudit`) ;
- **Infra** : Ajout d'un prefix devant les routes /bff/* :

### Configuration

- **ENVIRONMENT** : variable `ENVIRONMENT` (DEV/INT/REC/PRD) ajoutée dans `.env.example`, `server/config.js`, `Dockerfile` et `docker-compose.yml`. Exposée au navigateur via `/env.js` et affichée dans l'en-tête ;

### Tests

- **Journal** : cible affichée en texte brut (plus de bouton cliquable) — tests unitaires et e2e mis à jour ;
- **Déconnexion auto** : tests ajoutés pour la révocation de sa propre session SSO (user-list + user-details) et vérification qu'une session d'un autre utilisateur ne déconnecte pas ;
- **TrustedDeviceService** : 4 nouveaux tests unitaires (liste, liste par utilisateur, révocation avec/sans principal) ;
- **ENVIRONMENT** : test unitaire dans `config.test.js` ;
- Compteur : 123 tests unitaires Angular (au lieu de 116), 52 tests du module BFF (au lieu de 51) ;

## [1.0.0] - 2026-10-15

Première version livrable : console d'administration des comptes TOTP, appareils de confiance et sessions SSO d'un serveur CAS protégé par MFA.

### Ajouté

- **Connexion** : Authentification de l'utilisateur par le serveur CAS avec MFA obligatoire à chaque connexion (`forceExecution` et `bypassTrustedDeviceEnabled` : un appareil de confiance ne dispense pas du code), validation du ticket côté serveur, session applicative portée par le module BFF (cookie `httpOnly`, `SameSite=Lax`, 8 h). Déconnexion unique (SLO) avec page de confirmation ;
- **BFF** : Serveur Node/Express qui sert l'application et reste le seul appelant de des API Actuator du serveur CAS (identifiants jamais envoyés au navigateur). Relais limité à `GET`/`DELETE`, en-têtes de sécurité (CSP, `X-Frame-Options`…), configuration publique `/env.js`, gestionnaire d'erreur sans trace ;
- **Comptes TOTP** : Liste, recherche, pagination, détail par utilisateur, suppression. Les secrets (`secretKey`, `validationCode`, codes de secours) sont retirés par le BFF et n'atteignent jamais le navigateur ;
- **Appareils de confiance** : Liste, détail, révocation ;
- **Sessions SSO** : Liste, détail, révocation (vraie déconnexion CAS), pastille « session active » sur chaque utilisateur ;
- **Suppression en cascade** : Un compte TOTP n'est supprimé qu'après la révocation de ses appareils de confiance (aucun appareil orphelin, aucune suppression si une révocation échoue) ; supprimer son propre compte déconnecte l'agent ;
- **Journal d'activité** : Qui a supprimé quel compte, appareil ou session, et quand, avec l'identité réelle de l'agent (SQLite propre au module BFF), uniquement sur succès. Page dédiée avec double filtre (agent / compte concerné), compteur d'alerte à 1 000 000 d'entrées et **purge automatique** (`AUDIT_RETENTION_MONTHS`, 12 mois par défaut, 6 à 12 autorisés) ;
- **Thèmes** : Thèmes orange (défaut) et bleu, bascule dynamique disponible avant et après connexion, préférence mémorisée en cookie, logos et favicons assortis, couleur primaire alignée sur le thème ;
- **Responsive** : Points de rupture Angular Material (`xsmall` à `xlarge`) pilotés par un service, logos adaptés (icône seule sur petit écran), barre d'outils et pied de page condensés en mobile, accueil sans défilement sur 375×667 ;
- **Accessibilité** : Audit axe-core (WCAG 2.1 AA, contraste inclus) de toutes les pages dans les deux thèmes, repères et titres, lien d'évitement, focus après navigation, `aria-*` contextuels, messages de résultat dans une zone `<output>`, boîte de confirmation `alertdialog` (remplace `confirm()`), pastille de session aussi en texte, boutons à coins carrés, cibles tactiles 44 px ;
- **Limitation de débit** : En mémoire, par IP et par minute (429 + `Retry-After`) sur l'ouverture de session (`LOGIN_RATE_LIMIT`, 20), le relais `/api` (`API_RATE_LIMIT`, 300) et le point de santé ; `TRUST_PROXY` pour lire l'IP du client derrière un reverse proxy ;
**Journal technique** : Une ligne par événement sur la sortie standard (`<horodatage> <NIVEAU> message`), niveau réglable (`LOG_LEVEL`), recueilli par l'orchestrateur ; aucun secret, ticket ni nom de groupe, erreurs résumées sans leurs propriétés ni pile d'appels (sauf `debug`) ;
- **Contexte CAS configurable** : Le contexte du CAS (`/sso`, `/cas`, `/user` ou aucun) n'est écrit qu'à un endroit, `CAS_BASE_URL` ; des API Actuator et l'adresse vue du navigateur s'en déduisent (`CAS_PUBLIC_ORIGIN` pour un autre hôte ou port), proxy de `ng serve` compris ;
- **Point de santé** : `GET /api/public/healthcheck/status` (journal SQLite + CAS, 200 / 503 / 429, cache 5 s, 30 appels/min/IP), `HEALTHCHECK` Docker ;
- **Chargement à la demande** : Pages de gestion et journal en *lazy loading* (bundle initial 663 Ko pour un budget à 700 Ko) ;
- **Déploiement** : Image Docker et exemple Docker Compose, volume du journal, démarrage **refusé en production** sans `SESSION_SECRET`, `ACTUATOR_USERNAME` et `ACTUATOR_PASSWORD` ; **environnement** : variable `ENVIRONMENT` (DEV/INT/REC/PRD) propagée du `.env` au navigateur, badge visuel dans l'en-tête ;
- **Tests** : 123 tests unitaires Angular (95 % de lignes couvertes, seuils bloquants à 85 %), 52 tests du module BFF (98 % de lignes), 60 tests Playwright avec backend entièrement simulé ;
- **Sécurité** : Scan ZAP actif (0 échec, 111 contrôles réussis, 2 avertissements sans objet), `npm audit` sans vulnérabilité ;
- **Habilitations** : Profil de l'agent déduit des groupes AD (`memberOf`) libérés par CAS : *administration* (suppression, révocation, journal) ou *consultation* (lecture seule) ; un agent hors des groupes n'ouvre pas de session ; droits appliqués par le BFF (403), boutons masqués dans l'interface ; aucune table d'habilitations dans MIAM ; `ROLE_ADMIN_GROUPS` obligatoire en production ;
- **Information des personnes** : Page publique `/informations` (responsable, finalité, durée, droits), liée depuis l'en-tête et la barre d'outils, mentions de l'organisme par `PRIVACY_*` ;
-**Confidentialité** : Polices Roboto et Material Icons **auto-hébergées** (`@fontsource/roboto`, `material-icons`), plus aucun appel à Google Fonts ; CSP sans origine tierce ; test e2e qui échoue si une requête part vers un tiers ;
-**Conformité** : Analyse RGPD (cartographie des données, principes de l’article 5, base légale, durées, droits, violation, AIPD, fiche de registre, plan d’action) dans `docs/conformite/rgpd.md` ;
- **Documentation** : `README.md` allégé et dossier `docs/` découpé (utilisation, architecture, intégration CAS, développement, tests, sécurité, thèmes et accessibilité, release, configuration, déploiement).

### Reste à faire

- [ ] **Bloquant** : déployer `cas/services/MIAM-999.json` dans CAS (MFA forcé, `memberOf` libéré) et vérifier que CAS lit `memberOf` dans l'annuaire ([Intégration CAS](docs/architecture/integration-cas.md)) ;
- [ ] Créer les groupes `GRP_MIAM_ADMIN` et `GRP_MIAM_CONSULT` dans l'annuaire (démarrage possible avec un groupe existant, voir [Intégration CAS](docs/architecture/integration-cas.md)) ;
- [ ] Valider les habilitations contre un **CAS réel** (libération de `memberOf`, un compte par groupe) : le BFF n'est testé qu'avec une réponse CAS simulée ;
- [ ] Parcours complet de l'image Docker contre un CAS réel à valider avant mise en production (l'image se construit, refuse de démarrer sans secrets et répond aux sondes `/env.js` et `/bff/session`).

### Limites constatées

- **Appareils de confiance sans chiffrement** : sur un CAS où `cas.authn.mfa.trusted.crypto.enabled` vaut `false` (développement), un appareil dont le nom contient `/` ne peut pas être révoqué par les API Actuator (rejet du `%2F` par Tomcat puis par le pare-feu Spring Security) ; la suppression en cascade du compte échoue alors. Sans objet quand le chiffrement est actif (clé encodée en Base64 URL-safe) — voir [Intégration CAS](docs/architecture/integration-cas.md) ;
- **Suppression par utilisateur uniquement** : Les API Actuator ne suppriment pas un compte TOTP par appareil, la suppression retire donc tous les comptes TOTP de la personne ;
- **Appareils expirés invisibles** : Les API Actuator ne renvoient que les appareils de confiance non expirés ;
- **Session SSO** : supprimer le compte TOTP n'invalide pas la session SSO déjà ouverte de l'utilisateur ; la révoquer explicitement est parfois nécessaire pour le débloquer ;
- **Sessions BFF et limitation de débit en mémoire** : un redémarrage du module BFF déconnecte les agents et remet les compteurs à zéro ; une seule instance est supportée (plusieurs instances exigeraient un stockage partagé, type Redis, non prévu) ;
- **Journal local** : le journal d'activité vit dans un fichier SQLite de l'instance (volume à monter) ; il ne trace que les actions passées par MIAM, pas celles faites directement sur CAS ;
- **Un seul compte technique** côté actuator : CAS ne distingue pas les agents, seul le journal du module BFF les identifie ;
- **Navigateurs testés** : tests automatisés sur Chrome uniquement ;
- **Accessibilité** : contrôlée par axe-core et par la structure du DOM, sans essai manuel avec un lecteur d’écran (outillage indisponible) ;
- **Style** : la CSP conserve `style-src 'unsafe-inline'` (styles injectés par Angular, sans nonce).
