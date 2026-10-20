# 🎨 Thèmes, responsive et accessibilité

## 1️⃣ Thèmes

Deux thèmes, **orange** (par défaut) et **bleu**, qui pilotent la couleur primaire, le logo et les favicons.

| Élément | Orange | Bleu |
| --- | --- | --- |
| Couleur primaire (`--mat-sys-primary`) | `#a85a00` | `#3c5a78` |
| Texte sur primaire (`--mat-sys-on-primary`) | `#ffffff` | `#ffffff` |
| Logos (`public/images/`) | `logo-horizontal.svg`, `logo-vertical.svg`, `logo.svg` | les mêmes fichiers suffixés `-bleu.svg` |
| Favicons (`public/favicon/`) | sans suffixe | suffixe `-bleu` |

Les couleurs primaires sont des **teintes foncées** de celles des logos (`#e59a3c` / `#56789c`) : la couleur du logo ne passe pas le contraste en fond de bouton avec un texte blanc, alors que ces teintes servent à la fois de fond de bouton et de texte/contour sur fond blanc.

### Fonctionnement

1. `ThemeService` lit le cookie `miam-theme` (`orange` ou `bleu`, un an, `SameSite=Lax`) ; à défaut, **orange** ;
2. il pose `data-theme="…"` sur `<html>` ; `styles.scss` y rattache les variables `--mat-sys-primary` / `--mat-sys-on-primary` — tous les composants Material (boutons, barre d'outils, onglets) suivent ;
3. il remplace le `href` des quatre `<link>` de favicon ;
4. le composant `ThemeSwitch` (en-tête public **et** barre d'outils connectée) appelle `toggle()` ; le choix est mémorisé.

`index.html` déclare `data-theme="orange"` et les favicons orange par défaut, pour éviter tout clignotement avant le démarrage d'Angular.

> [!TIP]
> Pour changer le thème par défaut : constante `DEFAULT_THEME` de `core/theme.service.ts`, plus `data-theme` et les favicons de `index.html`.

### Forme des boutons

Material 3 arrondit les boutons en pilule. MIAM utilise des boutons **à coins carrés** (rayon 4 px) via l'API officielle de thème (`mat.button-overrides` dans `styles.scss`, jetons `*-container-shape`). Il n'existe pas de propriété de composant (`@Input`) pour cela : `MatButton` n'expose que `appearance` (couleur/élévation).

## 2️⃣ Responsive

Les points de rupture sont ceux d'**Angular Material** (`@angular/cdk/layout`), exposés par `ResponsiveService` sous forme de signal `breakpoint()` : le gabarit réagit aussi au redimensionnement ou à la rotation, pas seulement au chargement.

| Palier | Largeur | Logo d'en-tête | Bascule de thème | Barre d'outils connectée | Logo vertical (accueil) |
| --- | --- | --- | --- | --- | --- |
| `xsmall` | < 600 px | icône seule | 1 pastille 44×44 | icône, navigation sans libellé | 130 px |
| `small` | 600–959 px | icône seule | 1 pastille 44×44 | icône, navigation sans libellé | 284 px |
| `medium` | 960–1279 px | horizontal + texte | 2 pastilles | logo + titre + libellés | 369 px |
| `large` | 1280–1919 px | horizontal + texte | 2 pastilles | idem | 454 px |
| `xlarge` | ≥ 1920 px | horizontal + texte | 2 pastilles | idem | 511 px |

Le logo vertical est volontairement réduit en `xsmall` : accueil, texte et bouton « Se connecter » doivent tenir **sans défilement** sur un petit téléphone (vérifié à 375×667).

Le pied de page passe sur **une seule ligne** sous 480 px (auteur abrégé « L. HADJADJ », espaces réduits).

> [!NOTE]
> La taille du logo est posée par une **classe CSS** (`size-xsmall` … `size-xlarge`) choisie selon le palier, jamais par un style inline.

## 3️⃣ Accessibilité

Les pages visent le niveau **WCAG 2.1 AA**. Chaque page est contrôlée automatiquement par [axe-core](https://github.com/dequelabs/axe-core) (règles WCAG 2.0/2.1 A et AA + bonnes pratiques, **contraste de toutes les couleurs inclus**) dans les **deux thèmes**, voir [Tests e2e](test-e2e.md).

### Structure et navigation

| Point | Mise en œuvre |
| --- | --- |
| Repères (landmarks) | `<header>` (bannière de marque ou barre d'outils `role="banner"`), `<nav aria-label="Navigation principale">`, **un seul** `<main id="contenu">`, `<footer>` |
| Titres | Un seul `<h1>` par page (masqué visuellement sur la page de gestion), `<h2>` pour les cartes du détail |
| Titre du document | Un titre par route (« Utilisateurs - MIAM », « Journal d'activité - MIAM »…) |
| Lien d'évitement | « Aller au contenu principal », visible au focus clavier uniquement |
| Après une navigation | Le focus passe à `<main>` : le lecteur d'écran annonce la nouvelle page |
| Page courante | `aria-current="page"` + soulignement (pas seulement la couleur) |
| Focus clavier | Contour de 3 px toujours visible (`:focus-visible`) |
| Mouvement | `prefers-reduced-motion` respecté |

### Annonces pour les lecteurs d'écran et la transcription vocale

| Besoin | Élément utilisé |
| --- | --- |
| Résultat d'une action (succès, échec) | Zone `<output>` (rôle `status`, annonce polie) **toujours présente** dans le DOM, remplie par `NotificationService` ; bouton « Fermer le message » nommé |
| Vérification de la connexion en cours | `<output>` avec le texte « Vérification de votre authentification… » |
| Erreur de connexion | `<output role="alert">` (annonce immédiate) |
| Chargement des listes | `<output>` avec texte masqué + `aria-busy` sur le tableau du journal |
| Confirmation d'une action destructrice | Boîte `role="alertdialog"` Material : titre = nom accessible, focus piégé, initial sur **Annuler**, Échap annule, focus rendu au bouton d'origine |

> [!NOTE]
> Une zone live doit exister **avant** que son contenu change pour être annoncée. C'est pourquoi l'`<output>` des messages de résultat n'est jamais ajouté à la volée ; `NotificationService` vide puis réécrit le texte (50 ms) pour qu'un même message répété soit de nouveau annoncé.

### Attributs ARIA

| Cas | Traitement |
| --- | --- |
| Icônes Material et emojis décoratifs (🔍, 🗑️) | `aria-hidden="true"` |
| Boutons d'action | `aria-label` contextuel : « Révoquer l’appareil Poste de alice », « Supprimer le compte TOTP de alice »… |
| Champs de recherche et de filtre | `aria-label` (le `placeholder` seul n'est pas un nom accessible), `type="search"` |
| Tableaux | `aria-label` (« Comptes TOTP », « Appareils de confiance », « Sessions SSO », « Journal d'activité ») |
| Onglets et pagination | `aria-label` sur le groupe d'onglets et sur chaque pagination |
| Pastille de session | Couleur **et** forme (disque plein / anneau) **et** texte masqué (« Session active : ») |
| Bascule de thème | `role="switch"`, `aria-label="Thème orange"`, `aria-checked`, pastilles `aria-hidden` |
| Nom de l'agent connecté | Préfixe masqué « Agent connecté : » ; nom tronqué par une ellipse sur petit écran pour garder le bouton de déconnexion visible |
| Profil consultation | Étiquette « Consultation » (texte + contour) ; sur petit écran, texte masqué « Profil consultation, lecture seule » |
| Lien « Informations » | Libellé visible à partir de « medium », icône seule dessous avec `aria-label` complet ; cible 44×44 px |
| Illustration de la déconnexion | `aria-hidden="true"` (le titre porte déjà l'information) |
| Logos | `alt` explicite |

### Contrastes

| Texte | Couleurs | Rapport |
| --- | --- | --- |
| Bouton principal | blanc sur `#a85a00` / `#3c5a78` | ≥ 4,5:1 (test dédié dans les deux thèmes) |
| Texte d'aide, pied de page | `#4a636b` sur blanc | ≈ 6,4:1 |
| Bouton destructif | blanc sur `#8a2115` | ≈ 8,6:1 |
| Message de résultat | blanc sur `#1f2933` | > 14:1 |

L'audit axe-core contrôle ces rapports sur **toutes** les pages, y compris boîte de confirmation ouverte. Un pied de page à `#6b8790` (3,8:1) a ainsi été relevé et corrigé.

### Cibles tactiles

44×44 px minimum (pastille de thème en petit écran, bouton « Fermer le message », boutons Material 48 px).

### Limites

> [!WARNING]
>
> - **pas d'audit manuel avec lecteur d'écran** (NVDA, JAWS, VoiceOver) : l'outillage n'est pas disponible, les annonces sont vérifiées par la structure du DOM et par axe-core, pas à l'écoute ;
> - axe-core détecte une partie seulement des défauts d'accessibilité : un test manuel reste nécessaire pour le reste (ordre de lecture, pertinence des libellés) ;
> - les tableaux ne sont pas triables (pas de tri au clavier ni à la souris).

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [`Checklist pour la version RELEASE`](./checklist-release.md) - [`Pour bien démarrer`](./pour-bien-demarrer.md) - [`Sécurité`](./securite.md) - [`Sécurité`](./securite.md) -  [`Test E2E`](./test-e2e.md) - [`Test unitaire`](./test-unitaire.md)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
