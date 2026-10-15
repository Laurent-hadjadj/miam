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

import { Component } from '@angular/core';
import { APP_AUTHOR, APP_VERSION } from '../core/api-config';

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
   * espace n'est pas abrégé (l'expression ne correspond pas, la valeur reste inchangée).
   */
  protected readonly authorShort = APP_AUTHOR.replace(/^(\S)\S*\s+(.+)$/, '$1. $2');
  /** Version de l'application, préfixée de « v » dans le gabarit. */
  protected readonly version = APP_VERSION;
  /** Année courante au moment de la création du composant (pas de mise à jour ensuite). */
  protected readonly year = new Date().getFullYear();
}
