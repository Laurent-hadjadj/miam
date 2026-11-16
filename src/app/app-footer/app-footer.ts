/**
 *  Ma-Moulinette - MIAM
 *  --------------
 *  Copyright (c) 2015-2026.
 *  Laurent HADJADJ <laurent_h@me.com>.
 *  SPDX-License-Identifier: AGPL-3.0-or-later.
 *  ---
 *  Vous pouvez obtenir une copie de la licence à l'adresse suivante :
 *  https://www.gnu.org/licenses/agpl-3.0.html
 */

import { Component } from '@angular/core';
import { APP_AUTHOR, APP_VERSION } from '../core/api-config';

/**
 * Abrège le prénom en initiale : « Laurent HADJADJ » -> « L. HADJADJ ». Sans espace, ou sans rien après
 * le premier mot, le nom est renvoyé tel quel. Pas d'expression régulière à retour arrière : la recherche
 * du premier espace est linéaire quelle que soit la valeur de `APP_AUTHOR` (configurable).
 */
export function abbreviateAuthor(name: string): string {
  const firstSpace = name.search(/\s/);
  if (firstSpace < 1) return name;
  const rest = name.slice(firstSpace).trimStart();
  return rest ? `${name[0]}. ${rest}` : name;
}

/**
 * Pied de page affiché sur toutes les pages (publiques et authentifiées) : année en cours, auteur,
 * licence et version de l'application.
 *
 * Composant d'affichage pur : aucune entrée, aucune sortie, aucune injection. L'auteur et la version
 * viennent de `core/api-config.ts` (`APP_AUTHOR`, `APP_VERSION`), donc personnalisables par
 * environnement sans reconstruire l'application. Il ne porte aucune donnée personnelle.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './app-footer.html',
  styleUrl: './app-footer.css',
})
export class AppFooter {
  /** Nom complet de l'auteur, affiché au-dessus du palier mobile. */
  protected readonly author = APP_AUTHOR;
  /**
   * "Laurent HADJADJ" -> "L. HADJADJ" pour le pied de page mobile (une seule ligne). Un nom sans
   * espace n'est pas abrégé (la valeur reste inchangée).
   */
  protected readonly authorShort = abbreviateAuthor(APP_AUTHOR);
  /** Version de l'application, préfixée de « v » dans le gabarit. */
  protected readonly version = APP_VERSION;
  /** Année courante au moment de la création du composant (pas de mise à jour ensuite). */
  protected readonly year = new Date().getFullYear();
}
