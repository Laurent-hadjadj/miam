'use strict';

/**
 * Tests de roles.js : fonctions pures, sans serveur ni réseau.
 *
 * Ce que le fichier vérifie : extraction des valeurs d'un attribut d'une réponse CAS (entités XML
 * décodées, attribut absent, nom contenant un caractère spécial de regex), normalisation des noms de
 * groupes (DN ou nom court, casse ignorée, séparateurs virgule et point-virgule), et résolution du
 * profil (administrateur prioritaire, puis consultation, sinon aucun). L'application du profil aux
 * routes est testée dans app.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractAttributeValues, parseGroupList, resolveRole, groupName } = require('../roles');

// Réponse CAS type : deux groupes (le second contient une entité `&amp;`) et un attribut sans rapport (mail).
const XML =
  '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas"><cas:authenticationSuccess><cas:user>alice</cas:user>' +
  '<cas:attributes><cas:memberOf>CN=GRP_MIAM_ADMIN,OU=Groupes,DC=exemple,DC=fr</cas:memberOf>' +
  '<cas:memberOf>CN=GRP_AUTRE,OU=Groupes &amp; Co,DC=exemple,DC=fr</cas:memberOf>' +
  '<cas:mail>alice@exemple.fr</cas:mail></cas:attributes></cas:authenticationSuccess></cas:serviceResponse>';

test('extractAttributeValues : toutes les valeurs, entités XML décodées, autres attributs ignorés', () => {
  assert.deepEqual(extractAttributeValues(XML, 'memberOf'), [
    'CN=GRP_MIAM_ADMIN,OU=Groupes,DC=exemple,DC=fr',
    'CN=GRP_AUTRE,OU=Groupes & Co,DC=exemple,DC=fr',
  ]);
  assert.deepEqual(extractAttributeValues(XML, 'absent'), []);
  assert.deepEqual(extractAttributeValues('<cas:a.b>x</cas:a.b>', 'a.b'), ['x']);
});

test('groupName (DN ou nom court) et parseGroupList (noms courts), insensible à la casse, séparateurs , et ;', () => {
  assert.equal(groupName('CN=GRP_X,OU=a,DC=b'), 'grp_x');
  assert.equal(groupName(' Grp_Y '), 'grp_y');
  assert.deepEqual(parseGroupList('GRP_A, Grp_B ; ,'), ['grp_a', 'grp_b']);
  assert.deepEqual(parseGroupList(undefined), []);
});

test('resolveRole : administrateur prioritaire, puis consultation, sinon aucun profil', () => {
  const config = { adminGroups: ['grp_miam_admin'], consultationGroups: ['grp_miam_consult'] };
  assert.equal(resolveRole(['CN=GRP_MIAM_ADMIN,OU=x', 'CN=GRP_MIAM_CONSULT,OU=x'], config), 'admin');
  assert.equal(resolveRole(['CN=GRP_MIAM_CONSULT,OU=x'], config), 'consultation');
  assert.equal(resolveRole(['CN=GRP_AUTRE,OU=x'], config), null);
  assert.equal(resolveRole([], config), null);
});
