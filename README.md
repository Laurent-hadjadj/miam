# 🍪 MIAM — MFA Incident Access Management

[![Version](./docs/shields/version.svg)](CHANGELOG.md)
[![Angular](./docs/shields/angular.svg)](https://angular.dev/)
[![Node](./docs/shields/nodejs.svg)](https://nodejs.org/)
[![Tests](./docs/shields/test.svg)](docs/developpement/test-unitaire.md)
[![Coverage](./docs/shields/couverture.svg)](docs/developpement/test-unitaire.md)
[![Licence](/docs/shields/licence.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

```text
.___  ___.  __       ___      .___  ___.
|   \/   | |  |     /   \     |   \/   |
|  \  /  | |  |    /  ^  \    |  \  /  |
|  |\/|  | |  |   /  /_\  \   |  |\/|  |
|  |  |  | |  |  /  _____  \  |  |  |  |
|__|  |__| |__| /__/     \__\ |__|  |__|
```

**MIAM** est la console d'administration web des **comptes TOTP**, des **appareils de confiance** et des **sessions SSO** d'un serveur [Apereo CAS](https://apereo.github.io/cas/) protégé par double authentification. Elle est destinée à un centre de services : un utilisateur, lui-même authentifié par le serveur CAS avec MFA, débloque un utilisateur (téléphone perdu, appareil à retirer, session bloquée) et chaque action est tracée.

> [!NOTE]
> MIAM ne remplace pas le serveur CAS : elle pilote ses *endpoints actuator* (`gauthCredentialRepository`, `multifactorTrustedDevices`, `ssoSessions`) par l'intermédiaire d'un petit serveur intermédiaire (BFF). Les identifiants des API Actuator ne quittent jamais ce serveur.\
> Elle remplace l'utilisation des appels cURL ou les accès directe depuis un navigateurs

_
> [!CAUTION]
> **Deux éléments côté CAS sont bloquants : sans eux, MIAM ne fonctionne pas.**
>
> 1. **Le fichier de service** [`cas/services/MIAM-999.json`](cas/services/MIAM-999.json) doit être déployé dans CAS. Il autorise MIAM à s'authentifier via CAS, **impose le MFA** (`multifactorAuthenticationPolicy` : `mfa-gauth`, `forceExecution`, `bypassTrustedDeviceEnabled`, `failureMode: CLOSED`) et **délivre l'attribut `memberOf`**. Sans lui : application refusée par CAS, ou connexion sans code TOTP ;
> 2. **L'attribut `memberOf` doit être lu depuis l'annuaire par le serveur CAS** (`cas.authn.ldap[0].principal-attribute-list` contient `MemberOf:memberOf`) **puis vérifie** vers le service (point 1). Sans lui, aucun agent n'obtient de profil : **tout le monde est refusé** (« Accès refusé »).
>
> Détail, symptômes et vérifications : [Intégration CAS](docs/architecture/integration-cas.md).

## 1️⃣ Licence

> [!NOTE]
> MIAM est distribuée sous licence **[Creative Commons CC BY-NC-SA 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)** : citer l'auteur (BY), pas d'usage commercial (NC), partage sous la même licence (SA).

## 2️⃣ Fonctionnalités disponibles

- [x] Connexion de l'utilisateur sur le serveur **CAS + MFA obligatoire** (TOTP), session applicative portée par le BFF ;
- [x] **Comptes TOTP** : liste, recherche, pagination, détail par utilisateur, suppression ;
- [x] **Appareils de confiance** : liste, détail, révocation ;
- [x] **Sessions SSO** : liste, détail, révocation (vraie déconnexion CAS) ;
- [x] Suppression d'un compte TOTP **en cascade** (appareils de confiance révoqués avant le compte, pas d'appareil orphelin) ;
- [x] Suppression de **son propre compte** : déconnexion immédiate de l'application ;
- [x] Révocation de **sa propre session SSO** : déconnexion immédiate de l'application ;
- [x] **Journal d'activité** (qui a supprimé quoi, quand) avec double filtre agent / compte concerné ;
- [x] **Deux thèmes** (orange par défaut, bleu), bascule dynamique, préférence mémorisée en cookie, logos et favicons assortis ;
- [x] Interface **responsive** (points de rupture Angular Material), cibles tactiles 44 px ;
- [x] **Accessibilité** WCAG 2.1 AA contrôlée par axe-core (contraste, ARIA, `<output>` pour les messages, boîte de confirmation `alertdialog`, navigation clavier) ;
- [x] **Habilitations** par groupes AD (`memberOf`) : profils administration / consultation appliqués côté serveur, aucune table de droits dans MIAM ;
- [x] **Page d'information RGPD** (`/informations`) ;
- [x] **Conformité RGPD** : journal purgé automatiquement (12 mois par défaut, 6 à 12 réglables), polices auto-hébergées (aucun appel à un tiers) ;
- [x] **Point de santé** `GET /api/public/healthcheck/status` (journal SQLite + CAS) et `HEALTHCHECK` Docker ;
- [x] Secrets TOTP (`secretKey`, codes de secours) **jamais transmis au navigateur** ;
- [x] Déploiement **Docker**, démarrage refusé en production si les secrets ne sont pas fournis.

## 3️⃣ Démarrage rapide

Prérequis : Node.js ≥ 24.15 et un serveur CAS joignable (un bac à sable local convient).

```bash
npm ci
cp .env.example .env        # puis renseigner les secrets et ROLE_ADMIN_GROUPS (poste : NODE_ENV=development, PORT=3000)
npm run bff                 # BFF  -> http://localhost:<PORT> (80 par défaut)
npm start                   # Angular -> http://localhost:4200
```

Détail du démarrage, des variables et de l'enchaînement avec CAS : [Pour bien démarrer](docs/developpement/pour-bien-demarrer.md).

## 4️⃣ Documentation

| Thème | Page |
| --- | --- |
| Comment l'agent s'en sert (workflow, cas d'usage) | [Parcours de l'agent](docs/utilisation/parcours-agent.md) |
| Architecture, module BFF, journal d'activité | [Architecture technique](docs/architecture/architecture-technique.md) |
| Ce que CAS doit fournir (service, actuator, limites) | [Intégration CAS](docs/architecture/integration-cas.md) |
| Environnement de développement, conventions | [Pour bien démarrer](docs/developpement/pour-bien-demarrer.md) |
| Tests unitaires, couverture, tests du module BFF | [Tests unitaires](docs/developpement/test-unitaire.md) |
| Tests de bout en bout | [Tests e2e](docs/developpement/test-e2e.md) |
| Sécurité (modèle, durcissements, scan ZAP) | [Sécurité](docs/developpement/securite.md) |
| Données personnelles, durées, droits, plan d’action | [Conformité RGPD](docs/conformite/rgpd.md) |
| Thèmes, responsive, accessibilité | [Thèmes et accessibilité](docs/developpement/themes-accessibilite.md) |
| Livrer une version | [Checklist de release](docs/developpement/checklist-release.md) |
| Variables d'environnement | [Configuration](docs/exploitation/configuration.md) |
| Docker, journal d'activité, exploitation | [Déploiement](docs/exploitation/deploiement.md) |

Sommaire complet : [docs/README.md](docs/README.md).

## 5️⃣ Reste à faire et limites connues

- [ ] Sessions du module BFF en mémoire : un redémarrage déconnecte les agents (suffisant pour une instance unique).

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 Liste détaillée et limites constatées : [CHANGELOG](CHANGELOG.md).

> 🔚 -= Fin de la page =-
