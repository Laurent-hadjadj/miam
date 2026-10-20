# 🎭 Tests de bout en bout

Suite [Playwright](https://playwright.dev/) : **59 tests** dans 9 fichiers, qui pilotent l'application dans un vrai Chrome.

## 1️⃣ Principe : un backend entièrement simulé

> [!NOTE]
> Le contexte du CAS (`/sso`, `/cas`, `/user` ou aucun) dépend de son `application.yml`. Il n'est écrit qu'à un endroit, `CAS_BASE_URL` : voir [Configuration](../exploitation/configuration.md).

Aucun serveur CAS, MongoDB ni le module BFF réel n'est nécessaire. Tous les appels `/bff/*`, `/api/*` et `{CAS_BASE_URL}/*` sont interceptés (`page.route`) par les fonctions de `e2e/fixtures.ts` : la suite tourne partout, intégration continue comprise.

| Fonction (`fixtures.ts`) | Rôle |
| --- | --- |
| `withSession(page, username?, rôle?)` | Pose une session côté navigateur (défaut `sophie.petite-coeur`, profil `admin` ; `consultation` pour la lecture seule) |
| `mockBffSession(page, résultat)` | Simule `POST /bff/session` (succès ou statut d'erreur) |
| `mockActuator(page, comptes, appareils, sessions?, journal?)` | Simule les listes de des API Actuator et du journal |
| `confirmDialog(page)` | Valide la boîte de confirmation (`alertdialog`) en cliquant sur Supprimer / Révoquer |
| `makeAccount()`, `makeDevice()`, `makeSession()` | Fabriques de données |

## 2️⃣ Couverture fonctionnelle

| Fichier | Tests | Parcours |
| --- | ---: | --- |
| `home.spec.ts` | 5 | Accueil anonyme, redirection vers CAS avec le bon `service`, ticket valide → gestion, ticket invalide → message, accès direct protégé → accueil |
| `logout.spec.ts` | 2 | Déconnexion → `/logout?service=…/deconnexion`, page « Déconnexion réussie » |
| `user-list.spec.ts` | 6 | Pagination, filtre, suppression en cascade (appareils puis compte), **suppression de son propre compte → déconnexion**, compteurs et pastille, lien vers le journal |
| `user-details.spec.ts` | 4 | Détail formaté, pastille grise sans session, cascade, suppression de son propre compte |
| `journal.spec.ts` | 3 | Double filtre agent / compte, filtre cible seul, clic vers le détail |
| `accessibility.spec.ts` | 19 | **axe-core (WCAG 2 A/AA + bonnes pratiques, contraste inclus)** sur accueil, déconnexion, gestion (3 onglets), détail, journal et boîte de confirmation, dans les deux thèmes ; clavier (focus de la boîte, Échap, lien d'évitement, `aria-current`), zone `<output>`, titres et `h1` |
| `habilitations.spec.ts` | 8 | Profil consultation (aucun bouton destructif, pas de Journal, `/journal` renvoie à la liste), profil admin, agent hors groupe (message dédié), **page `/informations`** (en-tête avant connexion, barre d'outils après, mobile : cible 44 px et pas de débordement), bouton de déconnexion visible à 375 px |
| `confidentialite.spec.ts` | 2 | **Aucune requête vers un tiers** (toute requête hors de l'origine de l'application échoue le test) ; Roboto et Material Icons réellement chargées, icônes rendues en glyphes |
| `theme.spec.ts` | 8 | Thème par défaut et bascule (cookie, rechargement), mobile / tablette / « medium », bascule une fois connecté, **contraste WCAG ≥ 4,5:1 du bouton principal dans les deux thèmes** |

## 3️⃣ Exécuter

```bash
npm run e2e                          # toute la suite
npx playwright test theme.spec.ts    # un fichier
npx playwright test --ui             # mode interactif
```

`playwright.config.ts` lance `npm start` si le port 4200 est libre et **réutilise** un serveur déjà démarré (hors intégration continue). Navigateur : Chrome installé sur la machine (`channel: 'chrome'`), aucun téléchargement.

> [!NOTE]
> La fenêtre par défaut de Playwright (1280×720) tombe dans le point de rupture Material **« large »** : logo horizontal et deux pastilles de thème. Pour tester le mobile, appeler `page.setViewportSize({ width: 375, height: 812 })` avant `goto`.

## 4️⃣ Écrire un test

- sélectionner par **rôle et nom accessible** (`getByRole('button', { name: 'Supprimer' })`) plutôt que par classe CSS : cela vérifie aussi l'accessibilité ; le nom s'apparie en sous-chaîne, donc deux boutons « Supprimer » sur une même page sont ambigus (d'où « Révoquer » pour les appareils et sessions) ;
- chaîner deux gestionnaires `page.route` : `route.fallback()` passe au gestionnaire précédent, alors que `route.continue()` va directement au réseau ;
- la confirmation d'une action destructrice est une boîte Material (`alertdialog`), pas un `confirm()` natif : utiliser `confirmDialog(page)` après le clic ;
- les cookies de thème se posent par `page.context().addCookies([...])` avant `goto`.

## 5️⃣ Limites

> [!WARNING]
>
> - ces tests ne valident **pas** le dialogue réel avec le serveur CAS (login, MFA) ni le module BFF : le module BFF est couvert par ses propres tests (voir [Tests unitaires](test-unitaire.md)), le parcours réel se vérifie à la main avec un bac à sable ;
> - un seul navigateur (Chrome) ; le rendu Edge/Firefox n'est pas automatisé.

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [`Checklist pour la version RELEASE`](./checklist-release.md) - [`Pour bien démarrer`](./pour-bien-demarrer.md) - [`Sécurité`](./securite.md) - [`Sécurité`](./securite.md) -  [`Test unitaire`](./test-unitaire.md) - [`Thème et Accessibilité`](./themes-accessibilite.md)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
