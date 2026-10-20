# 🚀 Pour bien démarrer

## 1️⃣ Prérequis

| Composant | Version | Usage |
| --- | --- | --- |
| Node.js | **≥ 24.15** (Angular CLI 22) | Build, BFF, tests |
| npm | 11 | Gestion des dépendances (`package-lock.json` versionné) |
| Google Chrome | stable | Tests e2e (`channel: 'chrome'`, aucun navigateur à télécharger) |
| CAS + MongoDB | 6.6.15.2 | Backend réel ; un bac à sable du CAS-APereO convient aussi |
| Docker | récent | Uniquement pour construire/exécuter l'image |

## 2️⃣ Fichiers de configuration

> [!NOTE]
> Le contexte du CAS (`/sso`, `/cas`, `/user` ou aucun) dépend de son `application.yml`. Il n'est écrit qu'à un endroit, `CAS_BASE_URL` : voir [Configuration](../exploitation/configuration.md).

| Fichier | Rôle | Suivi Git |
| --- | --- | --- |
| `.env.example` | Modèle commenté de la configuration du module BFF | ✅ |
| `.env` | Valeurs locales (3 secrets) lues par `npm run bff` | ❌ ignoré |
| `proxy.conf.js` | En développement, relaie le contexte du CAS (déduit de `CAS_BASE_URL` du `.env`) vers CAS et `/api`, `/bff` vers le module BFF (`PORT` du `.env`) | ✅ |
| `public/env.js` | Configuration publique par défaut en développement (rien de secret). `casBaseUrl` n'y figure que pour un contexte CAS différent de `/sso` | ✅ |

> [!WARNING]
> Ne jamais committer de secret. `.env` est ignoré par Git et par Docker ; le BFF **refuse de démarrer** en production tant que `SESSION_SECRET`, `ACTUATOR_USERNAME` et `ACTUATOR_PASSWORD` ne sont pas fournis.

## 3️⃣ Démarrer en local

> [!TIP]
> On considère que vous avez un repos avec la version du serveur CAS compilable et un serveur mongodb/postgreSQL sur votre poste.
>
> Le serveur CAS est accessible sur `http://localhost:8083` et le serveur, par example, MongoDB sur le port 27017.
>
> La configuration du serveur CAS active MFA (mfa_gauth), la connexion JDBC (mongoDb, Oracle, postgreSQL,...), l'enregistrement TOTP et l'appareil de confiance enregistré dans la base de données.

Trois processus, dans cet ordre :

```bash
# 1. CAS + MongoDB (bac à sable)
cd CAS/bac-a-sable
./start-mongo.sh && ./start-cas.sh        # CAS prêt sur :8083 (le premier chargement de /login est lent)

# 2. Module BFF (port 80 par défaut, 3000 en local)
cd ../../miam
cp .env.example .env                       # puis renseigner ACTUATOR_*, SESSION_SECRET, ROLE_ADMIN_GROUPS ; sur un poste : NODE_ENV=development et PORT=3000 (le 80 est souvent déjà pris)
npm run bff

# 3. Angular (port 4200)
npm start
```

Ouvrir `http://localhost:4200/`. Le service CAS doit couvrir `http://localhost:4200` (voir [Intégration CAS](../architecture/integration-cas.md)).

> [!TIP]
> Les pages publiques (accueil, informations, déconnexion) et tout ce qui est thème / responsive se développent **sans** CAS ni MongoDB : seul `npm start` est nécessaire.

_
> [!NOTE]
> Après l'ajout d'un **nouveau** fichier dans `public/`, redémarrer `npm start` : le serveur de développement ne le voit pas à chaud (les fichiers modifiés, eux, sont pris en compte).

## 4️⃣ Scripts npm

| Script | Action |
| --- | --- |
| `npm start` | Serveur de développement Angular (4200) |
| `npm run build` | Build de production dans `dist/miam/` |
| `npm run watch` | Build de développement en continu |
| `npm run bff` | Démarre le BFF (lit `.env`) |
| `npm test` | Tests unitaires Angular (Vitest) |
| `npm run test:coverage` | Idem avec couverture et seuils (85 %) |
| `npm run test:bff` | Tests du module BFF (`node:test`) avec couverture |
| `npm run e2e` | Tests Playwright |
| `npm run test:all` | Tout, dans l'ordre |

## 5️⃣ Conventions

- **En-tête de licence** (CC BY-NC-SA 4.0) en tête de chaque fichier source ;
- composants *standalone*, **signaux** pour l'état, nommage Angular sans suffixe `Component` ;
- **aucun style inline** (ni `style=""` ni `[style.x]`) : classes CSS, éventuellement posées selon le point de rupture ;
- points de rupture via `ResponsiveService`, pas de `@media` isolée pour piloter un comportement (les `@media` de présentation pure restent acceptées) ;
- couleurs de thème via les variables Material (`--mat-sys-primary`), pas de couleur d'accent en dur dans les composants ;
- aucun appel HTTP hors des services de `src/app/core/` ;
- textes de l'interface en français ; pas de nom d'hôte, d'IP ni de secret réel dans le code ou la documentation.

## 6️⃣ Ressources graphiques

| Dossier | Contenu |
| --- | --- |
| `public/images/` | Logos **affichés** (horizontal et vertical en SVG, icône 512 px en PNG), version orange et bleue |
| `public/favicon/` | Favicons **affichés**, version orange (sans suffixe) et bleue (`-bleu`) |
| `design/` | Sources et variantes **non livrées** (anciennes marques, tailles supplémentaires) |

> [!TIP]
> Convention SVG : attributs `width="100%" height="100%"` et dimensions réelles dans le `viewBox` (attribut en `viewBox`, avec un B majuscule dans un fichier `.svg`) ; la taille affichée est pilotée par le CSS.

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [`Cheklist pour la version RELEASE`](./checklist-release.md) - [`Sécurité`](./securite.md) - [`Test E2E`](./test-e2e.md) - [`Test unitaire`](./test-unitaire.md) - [`Thème et Accessibilité`](./themes-accessibilite.md)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
