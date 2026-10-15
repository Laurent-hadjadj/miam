'use strict';

/**
 *  Ma-Moulinette - MIAM
 *  --------------
 *  Copyright (c) 2015-2026.
 *  Laurent HADJADJ <laurent_h@me.com>.
 *  Licensed Creative Common  CC-BY-NC-SA 4.0.
 *  ---
 *  Vous pouvez obtenir une copie de la licence à l'adresse suivante :
 *  http://creativecommons.org/licenses/by-nc-sa/4.0/
 */

/**
 * Habilitations : le profil de l'utilisateur est déduit des groupes (attribut `memberOf` de l'AD)
 * que CAS libère dans la réponse de validation du ticket. Aucune table d'habilitations n'est
 * tenue dans MIAM : la source de vérité reste l'annuaire, la population admise est donc
 * restreinte dès l'entrée et se gère là où elle l'est déjà.
 *
 * Profils : `admin` (lecture, suppression, journal) et `consultation` (lecture seule).
 * Un agent dans aucun des groupes configurés n'obtient pas de session.
 *
 * Les comparaisons de groupes se font sur le nom court (`CN=`), sans tenir compte de la casse :
 * la configuration peut donc citer un nom court ou un DN complet, et l'annuaire renvoyer l'un ou l'autre.
 *
 * Ne fait PAS : aucune requête à l'annuaire (les groupes viennent de la réponse CAS), aucun contrôle
 * d'accès lui-même (c'est app.js qui applique le profil), aucune prise en charge des groupes imbriqués.
 */

/** Profil complet : lecture, suppression et accès au journal d'activité. */
const ADMIN = 'admin';
/** Profil en lecture seule. */
const CONSULTATION = 'consultation';

/** Entités XML nommées décodées (les références numériques sont traitées à part). */
const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Décode les entités XML d'une valeur d'attribut (`&amp;`, `&#233;`, `&#xE9;`...).
 * Nécessaire car un DN peut contenir `&` (ex. `OU=Groupes &amp; Co`) que le serveur CAS échappe dans le XML.
 *
 * @param {string} text texte brut tiré du XML
 * @returns {string}
 */
function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return XML_ENTITIES[entity.toLowerCase()];
  });
}

/**
 * Toutes les valeurs de l'attribut du serveur CAS `name` (un élément `<cas:name>` par valeur).
 * Le nom est échappé avant d'entrer dans l'expression régulière : il vient de la configuration
 * (`ROLE_ATTRIBUTE`) et ne doit pas pouvoir en modifier le sens.
 *
 * @param {string} xml réponse de validation de ticket CAS
 * @param {string} name nom de l'attribut, sans le préfixe `cas:`
 * @returns {string[]} valeurs décodées et sans espaces autour ; les valeurs vides sont écartées
 */
function extractAttributeValues(xml, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<cas:${escaped}>([\\s\\S]*?)</cas:${escaped}>`, 'g');
  return [...xml.matchAll(pattern)].map((m) => decodeXml(m[1]).trim()).filter(Boolean);
}

/**
 * Nom court d'un groupe : `CN=GRP_X,OU=…` donne `grp_x` ; une valeur sans DN est conservée telle quelle.
 * Le résultat est toujours en minuscules et sans espaces autour : c'est la forme de comparaison.
 *
 * @param {string} value DN complet ou nom court
 * @returns {string}
 */
function groupName(value) {
  const match = /^cn=([^,]+)/i.exec(value);
  return (match ? match[1] : value).trim().toLowerCase();
}

/**
 * Découpe une liste de groupes séparés par des virgules ou points-virgules (`GRP_A, GRP_B`).
 * Ne convient donc pas à une liste de DN complets, dont les virgules seraient prises pour des séparateurs :
 * la configuration doit citer des noms courts.
 *
 * @param {string} [raw] valeur de `ROLE_ADMIN_GROUPS` ou `ROLE_CONSULT_GROUPS`
 * @returns {string[]} noms courts normalisés (voir `groupName`), sans entrée vide
 */
function parseGroupList(raw) {
  return (raw || '')
    .split(/[;,]/)
    .map((g) => groupName(g))
    .filter(Boolean);
}

/**
 * Profil le plus élevé couvert par les groupes de l'agent, ou `null` s'il n'est habilité à rien.
 * L'administrateur l'emporte sur la consultation si l'agent appartient aux deux groupes.
 *
 * @param {string[]} memberOf valeurs brutes de l'attribut de groupes (DN ou noms courts)
 * @param {{ adminGroups: string[], consultationGroups: string[] }} groupes noms courts normalisés (voir `parseGroupList`)
 * @returns {'admin'|'consultation'|null}
 */
function resolveRole(memberOf, { adminGroups, consultationGroups }) {
  const groups = new Set(memberOf.map(groupName));
  if (adminGroups.some((g) => groups.has(g))) {
    return ADMIN;
  }
  if (consultationGroups.some((g) => groups.has(g))) {
    return CONSULTATION;
  }
  return null;
}

module.exports = { ADMIN, CONSULTATION, extractAttributeValues, parseGroupList, resolveRole, groupName };
