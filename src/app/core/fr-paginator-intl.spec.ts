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
 * Contrats de `frenchPaginatorIntl` : libellés français du paginateur et format de la plage
 * affichée (« 1 – 10 sur 15 »), y compris pour une liste vide.
 */

import { frenchPaginatorIntl } from './fr-paginator-intl';

describe('frenchPaginatorIntl', () => {
  const intl = frenchPaginatorIntl();

  it('traduit les libellés en français', () => {
    expect(intl.itemsPerPageLabel).toBe('Éléments par page :');
    expect(intl.nextPageLabel).toBe('Page suivante');
    expect(intl.previousPageLabel).toBe('Page précédente');
  });

  it('formate la plage affichée', () => {
    expect(intl.getRangeLabel(0, 10, 15)).toBe('1 – 10 sur 15');
    expect(intl.getRangeLabel(1, 10, 15)).toBe('11 – 15 sur 15');
  });

  it('gère une liste vide', () => {
    expect(intl.getRangeLabel(0, 10, 0)).toBe('0 sur 0');
  });
});
