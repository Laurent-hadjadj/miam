# ✅ Checklist de release

À dérouler dans l'ordre pour livrer une version. Chaque étape a une commande ou un critère vérifiable.

> [!TIP]
> `npm run test:all` enchaîne tests unitaires (avec couverture), tests du module BFF et e2e.

## 1️⃣ Qualité

- [ ] `npm test` : tous les tests unitaires passent ;
- [ ] `npm run test:coverage` : seuils de 85 % respectés — **noter les chiffres** (lignes, branches, fonctions) ;
- [ ] `npm run test:bff` : tests du module BFF verts — noter le nombre de tests et la couverture ;
- [ ] `npm run e2e` : suite Playwright verte (59 tests, dont l'audit d'accessibilité axe-core) ;
- [ ] `npm run build` : build de production **sans avertissement** (budget initial 700 Ko, 1 Mo bloquant) ;
- [ ] `npm audit` : aucune vulnérabilité ;
- [ ] pas de fichier parasite (`*.js` ou `*.tsbuildinfo` dans `src/`, rapports de test, secrets).

## 2️⃣ Sécurité

> [!CAUTION]
> Prérequis **bloquants** côté CAS, à valider avant toute mise en production : le fichier de service `cas/services/MIAM-999.json` déployé (MFA forcé, `memberOf` vérifié) et `memberOf` lu dans l'annuaire. Voir [Intégration CAS](../architecture/integration-cas.md).

- [ ] fichier de service MIAM chargé par le CAS cible, `serviceId` adapté à l'URL de l'environnement ;
- [ ] connexion de test : le **code TOTP est demandé** à chaque connexion à MIAM, **y compris depuis un navigateur déjà enregistré comme appareil de confiance** ;
- [ ] `memberOf` reçu dans `/p3/serviceValidate` : un compte de chaque groupe (admin, consultation) obtient son profil, un compte hors groupe est refusé ;

- [ ] scan ZAP rejoué contre le build de production (voir [Sécurité](securite.md)), rapports remplacés dans `security/zap-reports/` ;
- [ ] aucun secret ni nom d'hôte réel dans le dépôt : `git grep -nE "password|secret|192\.168|\.interne"` ne remonte que des exemples ;
- [ ] démarrage refusé sans secrets : `NODE_ENV=production node server/index.js` doit échouer.

> [!CAUTION]
> Ne jamais livrer avec un secret ou un nom d'hôte réel dans le dépôt, ni avec un scan de sécurité périmé.

## 3️⃣ Documentation

- [ ] chiffres de [Tests unitaires](test-unitaire.md) et badges du `README.md` mis à jour ;
- [ ] pages `docs/` relues pour tout ce que la version change ;
- [ ] `CHANGELOG.md` : section de la version (ajouts, reste à faire, limites).

## 4️⃣ Version

- [ ] `version` dans `package.json` (et `package-lock.json`) ; le pied de page l'affiche (`APP_VERSION` la surcharge si définie) ;
- [ ] badge de version du `README.md` ;
- [ ] `CHANGELOG.md` daté.

## 5️⃣ Livrable

- [ ] `docker build -t miam:<version> .` réussit ;
- [ ] conteneur lancé avec les variables obligatoires : `GET /env.js` répond 200, `GET /bff/session` répond 401, `GET /api/public/healthcheck/status` répond 200 ;
- [ ] habilitations vérifiées **contre le CAS réel** avec un compte de chaque groupe (admin, consultation, hors groupe) : voir [Intégration CAS](../architecture/integration-cas.md) ;
- [ ] parcours réel sur un serveur CAS : connexion + MFA, liste, une révocation, entrée visible dans le journal, déconnexion ;
- [ ] étiquette Git `v<version>` posée sur le commit validé.

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [`Pour bien démarrer`](./pour-bien-demarrer.md) - [`Regroupement-commits`](./regroupement-commits.md) - [`Sécurité`](./securite.md) - [`Test E2E`](./test-e2e.md) - [`Test unitaire`](./test-unitaire.md) - [`Thème et Accessibilité`](./themes-accessibilite.md)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
