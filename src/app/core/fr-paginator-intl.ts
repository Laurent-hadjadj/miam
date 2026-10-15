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


import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Labels français pour mat-paginator (aucune traduction fournie par Material lui-même).
 * Enregistrée comme fabrique du jeton `MatPaginatorIntl` dans `app.config.ts`.
 *
 * @returns une instance dont `getRangeLabel` rend « 1 – 10 sur 15 » (ou « 0 sur 0 » pour une liste
 *   vide) ; hors bornes, la fin de plage est `page * pageSize + pageSize`, comme dans Material.
 */
export function frenchPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = 'Éléments par page :';
  intl.nextPageLabel = 'Page suivante';
  intl.previousPageLabel = 'Page précédente';
  intl.firstPageLabel = 'Première page';
  intl.lastPageLabel = 'Dernière page';
  intl.getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 sur ${length}`;
    }
    const startIndex = page * pageSize;
    const endIndex = startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;
    return `${startIndex + 1} – ${endIndex} sur ${length}`;
  };
  return intl;
}
