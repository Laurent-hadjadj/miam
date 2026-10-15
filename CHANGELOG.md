# Changelog

Toutes les évolutions notables de MIAM sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.0.0] - 2026-10-15

Première version livrable : console d'administration des comptes TOTP, appareils de confiance et sessions SSO d'un serveur CAS protégé par MFA.

### Ajouté

**Connexion** : Authentification de l'utilisateur par le serveur CAS avec MFA obligatoire à chaque connexion (`forceExecution` et `bypassTrustedDeviceEnabled` : un appareil de confiance ne dispense pas du code), validation du ticket côté serveur, session applicative portée par le module BFF (cookie `httpOnly`, `SameSite=Lax`, 8 h). Déconnexion unique (SLO) avec page de confirmation ;
**BFF** : Serveur Node/Express qui sert l'application et reste le seul appelant de des API Actuator du serveur CAS (identifiants jamais envoyés au navigateur). Relais limité à `GET`/`DELETE`, en-têtes de sécurité (CSP, `X-Frame-Options`…), configuration publique `/env.js`, gestionnaire d'erreur sans trace ;
**Comptes TOTP** : Liste, recherche, pagination, détail par utilisateur, suppression. Les secrets (`secretKey`, `validationCode`, codes de secours) sont retirés par le BFF et n'atteignent jamais le navigateur ;
**Appareils de confiance** : Liste, détail, révocation ;
**Sessions SSO** : Liste, détail, révocation (vraie déconnexion CAS), pastille « session active » sur chaque utilisateur ;
**Suppression en cascade** : Un compte TOTP n'est supprimé qu'après la révocation de ses appareils de confiance (aucun appareil orphelin, aucune suppression si une révocation échoue) ; supprimer son propre compte déconnecte l'agent ;
**Journal d'activité** : Qui a supprimé quel compte, appareil ou session, et quand, avec l'identité réelle de l'agent (SQLite propre au module BFF), uniquement sur succès. Page dédiée avec double filtre (agent / compte concerné), compteur d'alerte à 1 000 000 d'entrées et **purge automatique** (`AUDIT_RETENTION_MONTHS`, 12 mois par défaut, 6 à 12 autorisés) ;
**Thèmes** : Thèmes orange (défaut) et bleu, bascule dynamique disponible avant et après connexion, préférence mémorisée en cookie, logos et favicons assortis, couleur primaire alignée sur le thème ;
**Responsive** : Points de rupture Angular Material (`xsmall` à `xlarge`) pilotés par un service, logos adaptés (icône seule sur petit écran), barre d'outils et pied de page condensés en mobile, accueil sans défilement sur 375×667 ;
**Accessibilité** : Audit axe-core (WCAG 2.1 AA, contraste inclus) de toutes les pages dans les deux thèmes, repères et titres, lien d'évitement, focus après navigation, `aria-*` contextuels, messages de résultat dans une zone `<output>`, boîte de confirmation `alertdialog` (remplace `confirm()`), pastille de session aussi en texte, boutons à coins carrés, cibles tactiles 44 px ;
**Limitation de débit** : En mémoire, par IP et par minute (429 + `Retry-After`) sur l'ouverture de session (`LOGIN_RATE_LIMIT`, 20), le relais `/api` (`API_RATE_LIMIT`, 300) et le point de santé ; `TRUST_PROXY` pour lire l'IP du client derrière un reverse proxy ;
**Journal technique** : Une ligne par événement sur la sortie standard (`<horodatage> <NIVEAU> message`), niveau réglable (`LOG_LEVEL`), recueilli par l'orchestrateur ; aucun secret, ticket ni nom de groupe, erreurs résumées sans leurs propriétés ni pile d'appels (sauf `debug`) ;
**Contexte CAS configurable** : Le contexte du CAS (`/sso`, `/cas`, `/user` ou aucun) n'est écrit qu'à un endroit, `CAS_BASE_URL` ; des API Actuator et l'adresse vue du navigateur s'en déduisent (`CAS_PUBLIC_ORIGIN` pour un autre hôte ou port), proxy de `ng serve` compris ;
**Point de santé** : `GET /api/public/healthcheck/status` (journal SQLite + CAS, 200 / 503 / 429, cache 5 s, 30 appels/min/IP), `HEALTHCHECK` Docker ;
**Chargement à la demande** : Pages de gestion et journal en *lazy loading* (bundle initial 663 Ko pour un budget à 700 Ko) ;
**Déploiement** : Image Docker et exemple Docker Compose, volume du journal, démarrage **refusé en production** sans `SESSION_SECRET`, `ACTUATOR_USERNAME` et `ACTUATOR_PASSWORD` ;
**Tests** : 116 tests unitaires Angular (95 % de lignes couvertes, seuils bloquants à 85 %), 51 tests du module BFF (98 % de lignes), 60 tests Playwright avec backend entièrement simulé ;
**Sécurité** : Scan ZAP actif (0 échec, 111 contrôles réussis, 2 avertissements sans objet), `npm audit` sans vulnérabilité ;
**Habilitations** : Profil de l'agent déduit des groupes AD (`memberOf`) libérés par CAS : *administration* (suppression, révocation, journal) ou *consultation* (lecture seule) ; un agent hors des groupes n'ouvre pas de session ; droits appliqués par le BFF (403), boutons masqués dans l'interface ; aucune table d'habilitations dans MIAM ; `ROLE_ADMIN_GROUPS` obligatoire en production ;
**Information des personnes** : Page publique `/informations` (responsable, finalité, durée, droits), liée depuis l'en-tête et la barre d'outils, mentions de l'organisme par `PRIVACY_*` ;
**Confidentialité** : Polices Roboto et Material Icons **auto-hébergées** (`@fontsource/roboto`, `material-icons`), plus aucun appel à Google Fonts ; CSP sans origine tierce ; test e2e qui échoue si une requête part vers un tiers ;
**Conformité** : Analyse RGPD (cartographie des données, principes de l’article 5, base légale, durées, droits, violation, AIPD, fiche de registre, plan d’action) dans `docs/conformite/rgpd.md` ;
**Documentation** : `README.md` allégé et dossier `docs/` découpé (utilisation, architecture, intégration CAS, développement, tests, sécurité, thèmes et accessibilité, release, configuration, déploiement).

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
