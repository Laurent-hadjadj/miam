# 🔌 Intégration CAS

MIAM a été est vérifiée avec la version **Apereo CAS 6.6.x**. Cette page liste ce que le serveur CAS doit fournir.

> Lien : <https://apereo.github.io/cas/development/mfa/GoogleAuthenticator-Authentication.html>

_
> [!CAUTION]
> **Deux éléments côté serveur CAS sont bloquants : sans eux, MIAM ne fonctionne pas.**

1. **Le fichier de service** [`cas/services/MIAM-999.json`](../../cas/services/MIAM-999.json) doit être déployé dans sur le serveur CAS (dossier service). Il autorise MIAM à s'authentifier via CAS, **impose le MFA** (`multifactorAuthenticationPolicy` : `mfa-gauth`, `forceExecution`, `failureMode: CLOSED`) et **fournit libère l'attribut `memberOf`**. Sans lui : l'application est refusée par le serveur CAS, ou connexion sans code TOTP ;
2. **L'attribut `memberOf` le serveur CAS** (`cas.authn.ldap[0].principal-attribute-list` contient `MemberOf:memberOf`) **puis validé** vers le service (point 1). Sans lui, aucun agent n'obtient de profil : **tout le monde est refusé** (« Accès refusé »).

> [!CAUTION]
> `memberOf:memberOf` est un attribut standard de l'annuaire AD, pour fonctionner avec un annuaire openLDAP un attribut similaire ajouté.

_
> **Lien** : Détail, symptômes et vérifications : [Intégration CAS](integration-cas.md#diagnostic-des-prérequis-cas).

## 1️⃣ Service enregistré

MIAM est un service CAS comme un autre. Le MFA y est **imposé** quel que soit le déclencheur global et quel que soit l'appareil de confiance enregistré :

```json
{
  "@class": "org.apereo.cas.services.CasRegisteredService",
  "serviceId": "^https://miam.exemple.fr(/.*)?$",
  "name": "miam",
  "id": 10,
  "evaluationOrder": 0,
  "multifactorAuthenticationPolicy": {
    "@class": "org.apereo.cas.services.DefaultRegisteredServiceMultifactorPolicy",
    "multifactorAuthenticationProviders": ["mfa-gauth"],
    "failureMode": "CLOSED",
    "forceExecution": true,
    "bypassTrustedDeviceEnabled": true
  },
  "logoutType": "NONE",
  "attributeReleasePolicy": {
    "@class": "org.apereo.cas.services.ReturnAllowedAttributeReleasePolicy",
    "allowedAttributes": ["java.util.ArrayList", ["memberOf"]]
  }
}
```

> [!TIP]
> Fichier prêt à déposer dans le dossier des services de CAS : [`cas/services/MIAM-999.json`](../../cas/services/MIAM-999.json).\
> Remplacer `miam.exemple.fr` dans `serviceId` par l'URL publique de MIAM (dans le JSON, chaque point de l'expression régulière s'écrit `\\.` : `miam\\.exemple\\.fr`) ; en développement, `^http://localhost:(4200|8081)(/.*)?$`.\
> Le dépôt CAS lit ces fichiers au démarrage ou à chaud selon sa configuration (`cas.service-registry.*`).

_
> [!CAUTION]
> **Le dossier où déposer le fichier dépend de la configuration du serveur CAS**, pas du nom `services`.\
> Lisez la valeur de `cas.service-registry.json.location` dans le `application.yml` du serveru CAS qui tourne, puis résolvez `${cas.standalone.configurationDirectory…}` avec le dossier réellement passé au démarrage.

_
> [!TIP]
> `file:${cas.standalone.configurationDirectory:/opt/cas/services}` désigne **le dossier de configuration lui-même** dès que celui-ci est défini (la valeur après `:` n'est qu'un repli), alors que `file:${cas.standalone.configurationDirectory}/../services` désigne le dossier `services` voisin.
>
> Quand MIAM est atteint par une adresse IP, le `serviceId` doit la contenir, par exemple `"^http?s://192\\.0\\.2\\.10(/.*)?$"` (dans le JSON, chaque point s'écrit `\\.`).
> Le port n'apparaît pas pour le port 80.

| Propriété | Pourquoi |
| --- | --- |
| `serviceId` | Doit couvrir l'origine publique de MIAM (en développement : `http://localhost:4200`) |
| `forceExecution: true` | Le MFA est exécuté même si le serveur CAS n'en voit pas l'utilité (session SSO ouverte sans MFA, déclencheur global muet) |
| `bypassTrustedDeviceEnabled: true` | **Ignore les appareils de confiance** : le code TOTP est redemandé à chaque connexion, même depuis un navigateur déjà « mémorisé ». Sans lui, un appareil de confiance valide dispense du code malgré `forceExecution` (vérifié version CAS 6.6.15 et 7.x). L'agent administre les accès des autres : le code doit être exigé à chaque fois |
| `failureMode: CLOSED` | Si le MFA est indisponible, l'accès est refusé (jamais contourné) |
| `logoutType: NONE` | MIAM ferme elle-même sa session au module BFF avant de rediriger vers le serveur CAS |
| `attributeReleasePolicy` | Vérifie **uniquement** `memberOf` (groupes de l'annuaire) : MIAM en déduit le profil de l'agent, voir la section 6 |

## 2️⃣ Propriétés CAS

```yaml
# Déconnexion : suivre le paramètre ?service= de /logout (sinon CAS l'ignore et affiche sa propre page)
cas.logout.follow-service-redirects: true

# Lecture des groupes de l'annuaire : BLOQUANT, MIAM en déduit le profil de l'agent.
# `MemberOf:memberOf` doit figurer dans la liste (les autres attributs sont ceux de votre configuration).
cas.authn.ldap[0].principal-attribute-list: sn:nom,givenName:prenom,mail,MemberOf:memberOf

# Endpoints actuator utilisés par MIAM
management.endpoints.web.exposure.include: ssoSessions,gauthCredentialRepository,multifactorTrustedDevices
management.endpoint.ssoSessions.enabled: true
management.endpoint.gauthCredentialRepository.enabled: true
management.endpoint.multifactorTrustedDevices.enabled: true
cas.monitor.endpoints.endpoint.defaults.access: AUTHENTICATED

# Compte technique HTTP Basic des API Actuator (valeurs d'exemple)
spring.security.user.name: a_renseigner
spring.security.user.password: a_renseigner
```

> [!NOTE]
> Le CORS côté CAS n'est **plus nécessaire** : le navigateur n'appelle jamais l'API Actuator, seul le module BFF le fait (serveur à serveur).

_
> [!WARNING]
> `cas.logout.follow-service-redirects` est un réglage **global** (pas de surcharge par service) : sans lui, la déconnexion de MIAM n'aboutit pas sur la page `/deconnexion` mais sur la page CAS par défaut.

## 3️⃣ Contrat des endpoints actuator

| Fonction MIAM | Appel (via `/api` du module BFF) | Remarque |
| --- | --- | --- |
| Lister les comptes TOTP | `GET /gauthCredentialRepository` | Secrets retirés par le BFF |
| Comptes d'un utilisateur | `GET /gauthCredentialRepository/{username}` | |
| Supprimer les comptes | `DELETE /gauthCredentialRepository/{username}` | Supprime **tous** les comptes TOTP de l'utilisateur (pas de suppression par appareil) |
| Lister les appareils de confiance | `GET /multifactorTrustedDevices[/{username}]` | Ne renvoie que les enregistrements **non expirés** |
| Révoquer un appareil | `DELETE /multifactorTrustedDevices/{recordKey}` | Voir la limite du § 5 |
| Lister les sessions SSO | `GET /ssoSessions[?username=]` | Champs : `authenticated_principal`, `authentication_date_formatted`, `ticket_granting_ticket`, `authenticated_services`… |
| Révoquer une session | `DELETE /ssoSessions/{ticketGrantingTicket}` | Vraie déconnexion unique (SLO) |

## 4️⃣ Sessions SSO et MFA

Quand un utilisateur s'est connecté (mot de passe + code TOTP), le serveur CAS ouvre une **session SSO**, matérialisée par un ticket appelé **TGT**. Tant que cette session existe, le serveur CAS considère l'utilisateur comme déjà authentifié, **MFA compris**, et ne lui redemande rien pour les applications suivantes.

Conséquence : supprimer le compte TOTP ou les appareils de confiance retire le moyen de *passer* le MFA, mais **n'annule pas** une session déjà ouverte. L'utilisateur peut donc rester connecté avec son ancien statut (jusqu'à l'expiration du TGT) et ne pas voir l'enrôlement qu'on attend de lui.

Pour le débloquer, il faut aussi **révoquer sa session SSO** : à la reconnexion suivante, CAS rejoue le parcours complet. C'est pourquoi MIAM propose la révocation des sessions, et pourquoi le parcours de réinitialisation conseille de la faire (voir [Parcours de l'agent](../utilisation/parcours-agent.md)).

La durée de la session du module BFF (8 h) est alignée sur `cas.ticket.tgt.primary.max-time-to-live-in-seconds`.

## 5️⃣ Limite : appareils de confiance et caractère `/`

Le `recordKey` d'un appareil est utilisé comme **segment d'URL** pour le révoquer. Le serveur CAS le construit ainsi : `principal@nom@empreinte`, où `nom` est le nom saisi (ou pré-rempli) par l'utilisateur lors de l'enrôlement.

| Chiffrement des appareils de confiance (`cas.authn.mfa.trusted.crypto.enabled`) | `recordKey` | Effet d'un `/` dans le nom |
| --- | --- | --- |
| `true` (intégration, recette, production) | JWE encodé en Base64 URL-safe (alphabet `A-Za-z0-9-_`) | **Aucun** : le `/` n'apparaît jamais dans l'URL |
| `false` (développement, bac à sable) | Clair | Le `/` est encodé `%2F`, **rejeté** par Tomcat (400) puis par le pare-feu Spring Security `StrictHttpFirewall` (500) : l'appareil ne peut plus être révoqué par l'API Actuator, et la suppression en cascade d'un compte échoue |

Aucune propriété CAS ne lève ces deux protections sans code Java dédié (non retenu). Solution, côté serveur CAS :

- le nom pré-rempli utilise désormais `dd-MM-yyyy` (plus de `/`) ;
- le script `ressources/scripts/fix-trusted-device-slash.sh` corrige en base les enregistrements existants (`--apply` pour écrire, simulation par défaut) ;
- activer le chiffrement des appareils de confiance (avec clé fixe) sur l'environnement concerné.

> [!NOTE]
> Un utilisateur peut encore saisir à la main un nom contenant `/` : sur un CAS sans chiffrement, ce cas reste possible.

## 6️⃣ Habilitations : groupes de l'annuaire

MIAM ne tient **aucune table d'habilitations** : le profil de l'agent est déduit des groupes de l'annuaire (AD) que le serveur CAS fourni dans la réponse de validation du ticket (`/p3/serviceValidate`, l'attribut `memberOf`). La population admise est donc restreinte **dès l'entrée** et se gère là où elle l'est déjà : dans l'annuaire, avec son propre cycle de vie (arrivées, départs, revues d'habilitations).

```xml
<cas:authenticationSuccess>
  <cas:user>sophie.petite-coeur</cas:user>
  <cas:attributes>
    <cas:memberOf>CN=GRP_MIAM_ADMIN,OU=Groupes,DC=exemple,DC=fr</cas:memberOf>
    <cas:memberOf>CN=GRP_AUTRE,OU=Groupes,DC=exemple,DC=fr</cas:memberOf>
  </cas:attributes>
</cas:authenticationSuccess>
```

| Groupe de l'agent | Profil | Droits |
| --- | --- | --- |
| Dans `ROLE_ADMIN_GROUPS` | **admin** | Lecture, suppression de comptes TOTP, révocation d'appareils et de sessions, journal d'activité |
| Dans `ROLE_CONSULT_GROUPS` (et pas admin) | **consultation** | Lecture seule : ni suppression, ni révocation, ni journal |
| Aucun des deux | — | **Aucune session** : « Accès refusé » (HTTP 403) |

Les noms de groupes se configurent par leur **nom court** (le `CN`), sans casse : `GRP_MIAM_ADMIN` couvre `CN=GRP_MIAM_ADMIN,OU=…`. Voir [Configuration](../exploitation/configuration.md).

> [!WARNING]
> **À vérifier côté serveur CAS** :
>
> (1) l'attribut `memberOf` est bien lu depuis l'AD dans le profil de l'utilisateur (`cas.authn.attribute-repository.ldap[0].attributes`) ;\
> (2) le service MIAM le vérifie (`attributeReleasePolicy` ci-dessus) ;\
> (3) la réponse de `/p3/serviceValidate` le contient effectivement, en dev avec un compte de test de chaque groupe.
>
> Le module BFF est testé avec une réponse CAS simulée, **pas** avec un CAS réel.

_
> [!TIP]
> Le droit est appliqué **côté serveur** : un profil consultation reçoit `403` sur toute suppression et sur le journal, même s'il appelle l'API à la main. L'interface masque simplement les boutons.

_
> [!NOTE]
> Une modification de groupe dans l'annuaire s'applique à la **connexion suivante** : le profil est fixé à l'ouverture de la session (8 h maximum). Pour retirer immédiatement un droit, révoquer aussi la session SSO de l'utiliateur.

### 🫧 Groupes à créer dans l'annuaire

| Groupe | Profil | Membres | Remarque |
| --- | --- | --- | --- |
| `GRP_MIAM_ADMIN` | Administration | Agents habilités à supprimer / révoquer et à lire le journal | Population restreinte, revue régulière |
| `GRP_MIAM_CONSULT` | Consultation | Agents en lecture seule (supervision, support de niveau 1) | Facultatif au démarrage |

Un agent présent dans les deux groupes a le profil le plus élevé (administration). Les groupes doivent être **visibles par le serveur CAS** dans `memberOf` : si le serveur CAS lit déjà les groupes AD/openLDAP (pour le déclencheur MFA global, par exemple), il n'y a rien d'autre à brancher que la vérification de l'attribut vers le service MIAM.

Texte type de la demande à l'équipe en charge de l'annuaire d'entreprise (AD/OpenLDAP) :

> Création de deux groupes de sécurité pour l'application MIAM :
>
> - `GRP_MIAM_ADMIN` (administration des facteurs d'authentification)
> - `GRP_MIAM_CONSULT` (consultation seule).
> - Propriétaire : `[responsable du centre de services]`
> - Membres initiaux : `[liste]`.
> - Revue des membres : `[périodicité]`.
> - Mise à disposition de l'attribut `memberOf` à sur le serveur CAS (`application.yml`) pour le service MIAM.

### 👣 Mise en place progressive

Les groupes demandent un délai (création, alimentation, validation côté serveur CAS). Pour ne pas bloquer une mise en production :

| Étape | Action |
| --- | --- |
| 1 | Demander la création des deux groupes (texte ci-dessus) |
| 2 | En attendant, démarrer avec **un groupe existant** du centre de services : `ROLE_ADMIN_GROUPS=<groupe existant>`, `ROLE_CONSULT_GROUPS` vide. Aucun développement : ce n'est qu'une valeur de configuration |
| 3 | Valider sur un environnement d'intégration : un compte dans le groupe (admin), un hors groupe (refusé), puis un compte consultation une fois `GRP_MIAM_CONSULT` disponible |
| 4 | Basculer `ROLE_ADMIN_GROUPS=GRP_MIAM_ADMIN` et `ROLE_CONSULT_GROUPS=GRP_MIAM_CONSULT`, redémarrer le conteneur |

> [!CAUTION]
> Ne jamais contourner la condition en production : sans groupe administrateur, MIAM refuse volontairement de démarrer plutôt que d'ouvrir ses droits à tout agent authentifié.

## 7️⃣ Diagnostic des prérequis CAS

À dérouler **avant** toute mise en production, avec un compte de chaque groupe. Les symptômes se lisent à l'écran et dans les journaux du conteneur MIAM (`[bff]`).

| Symptôme | Cause probable | Vérification / correction |
| --- | --- | --- |
| Le serveur CAS refuse l'application (« application non autorisée », journal `Service Access Denied`) | Fichier de service absent, déposé **dans un autre dossier que celui lu par le serveur CAS**, invalide, ou `serviceId` qui ne couvre pas l'URL de MIAM | Vérifier `cas.service-registry.json.location` résolu, la ligne `Loaded [N] service(s)` du journal (N doit augmenter), l'absence de `duplicate id`, puis tester l'expression régulière sur l'URL exacte |
| Connexion à MIAM **sans demande de code TOTP** (le journal CAS montre un appareil de confiance reconnu, aucune page TOTP) | `multifactorAuthenticationPolicy` absente ou ignorée (mauvais fichier chargé, identifiant de service en conflit) | Vérifier le fichier réellement chargé par CAS ; le service doit porter `mfa-gauth`, `forceExecution: true` et `bypassTrustedDeviceEnabled: true` |
| « Accès refusé… habilité à aucun profil » pour **tous** les agents ; journal : `habilité à aucun profil … (0 groupe(s) reçu(s))` | `memberOf` non lu dans l'annuaire **ou** non libéré vers le service | Vérifier `principal-attribute-list` (`MemberOf:memberOf`) puis `attributeReleasePolicy` du service |
| « Accès refusé » pour un agent précis ; journal : `… (N groupe(s) reçu(s))` avec N > 0 | L'agent n'est dans aucun des groupes configurés, ou les noms diffèrent (faute de frappe dans `ROLE_ADMIN_GROUPS`) | Comparer le nom court (`CN`) du groupe de l'annuaire à la variable ; la casse est ignorée |
| Agent admis mais en lecture seule | Seul `GRP_MIAM_CONSULT` est reçu | Ajouter l'agent à `GRP_MIAM_ADMIN`, puis nouvelle connexion |

> [!WARNING]
> Le journal du module BFF n'écrit que le **nombre** de groupes reçus, jamais leurs noms : l'appartenance d'un agent à des groupes est une donnée personnelle. Pour voir les groupes exacts, inspecter la réponse de `/p3/serviceValidate` côté CAS (journaux de CAS en mode débogage, sur un environnement de test).

## 📌 Pied de page

> [!NOTE]
> Ce document fait partie de la documentation de MIAM.\
> Toute suggestion d'amélioration est bienvenue.

🛟 [Architecture technique](./architecture-technique.md)

[Retour vers la page principale](../README.md)

> 🔚 -= Fin de la page =-
