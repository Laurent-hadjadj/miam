# 🛡️ Conformité RGPD

Analyse des données personnelles traitées par MIAM, de leur cycle de vie et des écarts à traiter avant la mise en production.

> [!WARNING]
> Cette page est une **analyse technique** fondée sur le code et la configuration de MIAM. Ce n'est pas un avis juridique : la qualification (base légale, AIPD, registre) relève du **responsable de traitement** et de son **délégué à la protection des données (DPO)**.
> Les éléments entre crochets `[…]` sont à renseigner par l'organisation qui déploie MIAM.

## 1️⃣ Périmètre

| Élément | Valeur |
| --- | --- |
| Traitement | Gestion des facteurs d'authentification (TOTP, appareils de confiance, sessions SSO) des utilisateurs d'un CAS, par les agents d'un centre de services, avec traçabilité des actions |
| Responsable de traitement | `[organisation qui déploie MIAM]` |
| DPO | `[contact du DPO]` |
| Personnes concernées | **Agents** du centre de services (utilisateurs de MIAM) · **Utilisateurs finaux** du CAS dont le compte est géré |
| Sous-traitants | Aucun intégré à MIAM. Hébergement et reverse proxy : `[à compléter]` |
| Données sensibles (art. 9) | Aucune |

## 2️⃣ Cartographie des données

| Donnée | Personnes | Où elle vit | Durée | Finalité |
| --- | --- | --- | --- | --- |
| **Identifiant de l'agent** (login CAS) | Agents | Session du module BFF (mémoire) ; cookie `totp-admin-session` ; `sessionStorage` du navigateur ; colonne `actor` du journal | Session : 8 h max. Journal : 12 mois par défaut (6 à 12, voir section 5) | Authentifier l'agent, attribuer ses actions |
| **Identifiant de l'utilisateur géré** | Utilisateurs | Transit (réponses de l'API Actuator affichées à l'écran) ; **URL des appels** `/api/…/{identifiant}` ; colonnes `target` et `detail` du journal | Transit : aucune. Journal : 12 mois par défaut (6 à 12, voir section 5) | Retrouver, supprimer, révoquer |
| **Nom d'appareil** (saisi par l'utilisateur, texte libre) | Utilisateurs | Transit ; colonne `detail` du journal (clé de l'appareil) | Idem | Distinguer les appareils |
| **Empreinte d'appareil** (`deviceFingerprint`) | Utilisateurs | Transit (non affichée) ; incluse dans la clé d'appareil écrite dans `detail` | Idem | Identifier l'appareil de confiance |
| **Sessions SSO** : date, nombre d'usages, URL des applications consultées | Utilisateurs | Transit uniquement | Aucune | Choisir la session à révoquer |
| **Horodatage et nature de l'action** | Agents | Journal (`timestamp`, `action`) | **Illimitée aujourd'hui** | Traçabilité |
| **Secrets TOTP** (`secretKey`, `validationCode`, codes de secours) | Utilisateurs | **Jamais** transmis au navigateur ni stockés : retirés par le BFF avant toute réponse | — | — |
| **Adresse IP** | Agents, appelants du point de santé | Journaux du conteneur (uniquement en cas de dépassement de la limite de débit) ; journaux d'accès du reverse proxy `[à vérifier]` | Selon l'hébergeur | Limitation de débit, exploitation |
| **Identifiant d'un agent refusé** | Agents sans profil | Journal technique du conteneur : une ligne `WARN` lors d'un refus d'habilitation (identifiant et nombre de groupes reçus, jamais leurs noms) | Rotation des journaux de l'hébergeur `[à vérifier]` | Diagnostic d'un accès refusé |
| **Préférence de thème** (`miam-theme`) | Agents | Cookie du navigateur, 1 an | 1 an | Confort d'affichage |

> [!NOTE]
> MIAM **ne conserve aucune copie** des comptes TOTP, appareils ou sessions : ils sont lus à la demande depuis le serveur CAS. Le seul stockage durable est le **journal d'activité** (fichier SQLite `audit.db`).

### 🍪 Cookies et traceurs

| Cookie | Rôle | Régime |
| --- | --- | --- |
| `totp-admin-session` | Session de l'agent (`httpOnly`, `SameSite=Lax`, `Secure` en HTTPS) | Strictement nécessaire au service : **exempté** de consentement |
| `miam-theme` | Mémorise le choix orange / bleu, posé par une action volontaire de l'agent | Préférence d'interface choisie par l'utilisateur : en principe **exemptée** (à confirmer par le DPO) |

> [!NOTE]
> Aucun outil de mesure d'audience, de publicité ou de suivi n'est embarqué.

## 3️⃣ Principes de l'article 5

| Principe | État | Constat |
| --- | :---: | --- |
| Licéité, loyauté, transparence | 🟡 | Base légale à documenter (section 4) ; page d'information `/informations` en place (section 7), à compléter avec les mentions de l'organisme |
| Limitation des finalités | ✅ | Un seul usage : débloquer un utilisateur et tracer l'action. Le journal n'est pas réutilisé à d'autres fins |
| Minimisation | 🟡 | Secrets TOTP exclus, aucune copie des comptes, journal réservé au profil admin, population d'agents restreinte par groupe AD. Reste : la clé d'appareil écrite dans `detail` contient l'empreinte |
| Exactitude | ✅ | Données lues en direct dans CAS, pas de recopie |
| Limitation de la conservation | ✅ | Journal purgé automatiquement au-delà de `AUDIT_RETENTION_MONTHS` (12 mois par défaut, 6 à 12 autorisés). Reste à aligner les sauvegardes et les journaux du reverse proxy |
| Intégrité et confidentialité | ✅ | Voir section 8 |
| Responsabilité (accountability) | 🟡 | Registre et AIPD à produire (sections 11 et 12) ; cette page en fournit la matière |

## 4️⃣ Base légale proposée

À valider par le DPO :

| Hypothèse | Argument |
| --- | --- |
| **Mission d'intérêt public** (art. 6.1.e) — si le responsable de traitement est un organisme public | Assurer l'accès sécurisé aux services numériques de l'organisme |
| **Intérêt légitime** (art. 6.1.f) — organisme privé | Sécuriser les accès et attribuer les actions d'administration ; mise en balance : le journal ne contient que l'identifiant, la nature et l'heure de l'action |

> [!NOTE]
> Le **consentement** n'est pas adapté : l'agent n'a pas le choix d'utiliser l'outil, et l'utilisateur géré n'est pas en position de refuser le déblocage de son compte.

## 5️⃣ Durées de conservation

| Donnée | Recommandation | Mise en œuvre |
| --- | --- | --- |
| Session BFF | 8 h (déjà le cas) | Cookie `maxAge` |
| Journal d'activité | **12 mois par défaut, réglable de 6 à 12 mois** (`AUDIT_RETENTION_MONTHS`) ; une valeur hors de cette plage empêche le démarrage. Ordre de grandeur usuel des recommandations de la CNIL sur la journalisation | **Purge automatique** au démarrage puis toutes les 24 h, voir [Déploiement](../exploitation/deploiement.md) |
| Journaux d'accès du reverse proxy | Alignés sur la politique de l'hébergeur (en général ≤ 12 mois) | `[à renseigner]` |
| Cookie `miam-theme` | 1 an | Fixé dans `theme.service.ts` |

## 6️⃣ Droits des personnes

| Droit | Application à MIAM |
| --- | --- |
| **Accès** (art. 15) | Le DPO extrait les lignes du journal où la personne apparaît comme agent (`actor`) ou comme cible (`target`) — requête ci-dessous |
| **Rectification** (art. 16) | Sans objet : le journal est une trace factuelle ; les comptes sont sur le serveur CAS |
| **Effacement** (art. 17) | Limité : le journal sert une obligation de sécurité et la constatation de faits ; il peut être refusé pendant sa durée de conservation. À l'échéance, la purge efface la ligne |
| **Opposition** (art. 21) | À examiner au cas par cas par le DPO (motifs tenant à la situation particulière) |
| **Limitation** (art. 18) | Possible en gelant la purge pour les lignes concernées |
| **Portabilité** (art. 20) | Non applicable (pas de consentement ni de contrat) |

Extraction pour une demande d'accès (lecture seule, application arrêtée ou copie du fichier) :

```bash
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('server/data/audit.db',{readOnly:true});\
console.log(JSON.stringify(db.prepare('SELECT timestamp,actor,action,target,detail FROM audit_log WHERE actor=? OR target=? ORDER BY id').all('<identifiant>','<identifiant>'),null,2))"
```

## 7️⃣ Information des personnes (art. 13 et 14)

MIAM publie la page **`/informations`** (accessible sans connexion, depuis l'en-tête et la barre d'outils).
Les mentions propres à l'organisme se renseignent par `PRIVACY_CONTROLLER`, `PRIVACY_DPO_CONTACT` et `PRIVACY_LEGAL_BASIS` ; la durée de conservation affichée suit `AUDIT_RETENTION_MONTHS`. Texte de référence, à reprendre aussi dans la charte informatique :

> [!CAUTION]
> **Traitement « Gestion des accès à double facteur »** : Les actions d'administration des comptes TOTP, appareils de confiance et sessions (suppression, révocation) sont enregistrées : **date**, **identifiant de l'agent**, **nature de l'action**, **identifiant du compte concerné**.\
> **Finalité** : sécurité des accès et traçabilité. Base légale : `[mission d'intérêt public / intérêt légitime]`. Conservation : `[durée]`. Destinataires : agents habilités du centre de services, DPO, `[RSSI]`. Droits d'accès, de rectification, d'opposition : `[contact du DPO]`. Réclamation possible auprès de la CNIL.

| Public | Vecteur proposé |
| --- | --- |
| Agents du centre de services | Page `/informations` de MIAM + charte informatique |
| Utilisateurs dont le compte est géré | Mention dans l'information relative à la double authentification de l'organisme |

## 8️⃣ Sécurité (art. 32)

Mesures en place — détail dans [Sécurité](../developpement/securite.md) :

| Mesure | État |
| --- | :--- |
| Authentification de l'agent par le serveur CAS avec double facteur obligatoire | ✅ |
| Identifiants du service Actuator uniquement côté serveur | ✅ |
| Secrets TOTP jamais transmis au navigateur | ✅ |
| Session `httpOnly`, `SameSite=Lax`, `Secure`, 8 h | ✅ |
| Relais limité à `GET` et `DELETE` | ✅ |
| En-têtes de sécurité (CSP, anti-clickjacking…), scan ZAP sans échec | ✅ |
| Démarrage refusé en production sans secrets | ✅ |
| Journal d'activité écrit seulement sur succès, avec l'identité réelle de l'agent | ✅ |
| Chiffrement en transit | 🟡 À la charge du reverse proxy HTTPS (obligatoire en production) |
| Chiffrement au repos du journal | 🟡 À la charge du volume / de l'hébergeur |
| Sauvegarde du journal | 🟡 Procédure décrite, à planifier ; une sauvegarde prolonge la durée de conservation réelle |
| Moindre privilège | ✅ Profils admin / consultation issus des groupes AD, appliqués par le serveur |

## 9️⃣ Sous-traitants et transferts hors UE

| Flux | Constat |
| --- | --- |
| Hébergement, reverse proxy | `[à compléter, contrat art. 28 si prestataire]` |
| Google Fonts | ✅ **Corrigé** : Roboto et Material Icons sont désormais embarquées dans l'application (paquets `@fontsource/roboto` et `material-icons`). Plus aucun appel à un tiers, CSP sans origine externe, test e2e qui échoue à la moindre requête externe |
| Services d'analyse, de publicité, de réseaux sociaux | Aucun |

## 🔟 Violation de données (art. 33 et 34)

Scénarios plausibles : vol du fichier `audit.db` ; accès non autorisé à MIAM ; fuite des journaux du reverse proxy.

| Étape | Action |
| --- | --- |
| Détecter | Alerte de l'hébergeur, anomalie dans le journal, signalement d'un utilisateur |
| Contenir | Révoquer la session de l'agent concerné, changer `SESSION_SECRET` (déconnecte tous les utilisateurs) et les identifiants du service Actuator |
| Évaluer | Le journal ne contient ni mot de passe, ni secret TOTP : impact limité à la révélation d'identifiants et d'actions d'administration |
| Notifier | DPO immédiatement ; CNIL **sous 72 h** si risque pour les personnes (art. 33) ; personnes concernées si risque élevé (art. 34) |
| Consigner | Registre interne des violations, même sans notification |

## 1️⃣1️⃣ Analyse d'impact (AIPD)

À arbitrer par le DPO. Éléments d'appréciation au regard des critères usuels du G29 / CNIL :

| Critère | MIAM |
| --- | --- |
| Données sensibles ou hautement personnelles | Non |
| Traitement à grande échelle | Non en principe (volume = effectif de l'organisme, accès restreint aux utilisateurs) |
| Croisement de jeux de données | Non |
| Personnes vulnérables (dont salariés) | Oui mais Non, au sens large : le journal trace l'activité des **utilisateurs**, euh juste leur demande de déblocage ! |
| Surveillance systématique | Non : traçabilité des seules actions d'administration, pas de suivi d'activité continu |
| Usage innovant, exclusion d'un droit ou service | Non |

Au plus un critère est rempli : une AIPD n'apparaît **pas obligatoire**, à confirmer et à consigner dans le registre.

## 1️⃣2️⃣ Fiche de registre (art. 30)

| Rubrique | Contenu |
| --- | --- |
| Nom du traitement | Gestion des accès à double facteur (MIAM) |
| Responsable / DPO | `[…]` / `[…]` |
| Finalités | Débloquer les utilisateurs (TOTP, appareils, sessions) ; tracer les actions d'administration |
| Catégories de personnes | Agents du centre de services ; utilisateurs du CAS |
| Catégories de données | Identifiants, noms et empreintes d'appareils, dates, nature des actions |
| Destinataires | Agents habilités, DPO, `[RSSI]`, hébergeur `[…]` |
| Transferts hors UE | Aucun |
| Durées | Session 8 h ; journal 12 mois (réglable de 6 à 12) |
| Mesures de sécurité | Section 8 |

## 1️⃣3️⃣ Plan d'action

| Priorité | Écart | Action | Où |
| :---: | --- | --- | --- |
| ✅ 1 | Journal conservé sans limite | **Fait** : purge automatique, 12 mois par défaut (6 à 12), `AUDIT_RETENTION_MONTHS` | `server/` |
| ✅ 2 | Polices chargées depuis Google | **Fait** : polices auto-hébergées, CSP durcie | `angular.json`, `server/app.js` |
| ✅ 3 | Aucune information des personnes | **Fait** : page publique `/informations` liée depuis l'en-tête et la barre d'outils ; renseigner `PRIVACY_CONTROLLER`, `PRIVACY_DPO_CONTACT`, `PRIVACY_LEGAL_BASIS` | `src/app/informations/` |
| 🟡 4 | Registre et AIPD | Reporter les sections 11 et 12 dans le registre de l'organisme | DPO |
| ✅ 5 | Pas de moindre privilège | **Fait** : profils admin / consultation déduits des groupes AD (`memberOf`), appliqués côté serveur | `server/roles.js`, [Intégration CAS](../architecture/integration-cas.md) |
| ✅ 6 | Identifiants dans les URL des journaux d'accès | **Documenté** : format de journal et rétention du reverse proxy (exemple nginx) | [Déploiement](../exploitation/deploiement.md) |
| 🟢 7 | Sauvegardes | Aligner la rétention des sauvegardes sur celle du journal | Exploitation |

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [`Article 5`](<https://www.privacy-regulation.eu/fr/5.htm>) - [`Article 9`](<https://www.privacy-regulation.eu/fr/9.htm>) - [`Article 13`](<https://www.privacy-regulation.eu/fr/9.htm>) - [`Article 14`](<https://www.privacy-regulation.eu/fr/14.htm>) - [`Article 15`](<https://www.privacy-regulation.eu/fr/15.htm>) - [`Article 16`](<https://www.privacy-regulation.eu/fr/16.htm>) - [`Article 17`](<https://www.privacy-regulation.eu/fr/17.htm>) - [`Article 18`](<https://www.privacy-regulation.eu/fr/18.htm>) - [`Article 20`](<https://www.privacy-regulation.eu/fr/20.htm>) - [`Article 21`](<https://www.privacy-regulation.eu/fr/21.htm>) - [`Article 30`](<https://www.privacy-regulation.eu/fr/30.htm>) - [`Article 32`](<https://www.privacy-regulation.eu/fr/32.htm>) - [`Article 33`](<https://www.privacy-regulation.eu/fr/33.htm>) - [`Article 34`](<https://www.privacy-regulation.eu/fr/34.htm>)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
