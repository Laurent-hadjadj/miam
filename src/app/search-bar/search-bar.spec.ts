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

import { TestBed } from '@angular/core/testing';
import { SearchBar } from './search-bar';

/**
 * Vérifie que la barre de recherche relaie la valeur du champ via sa sortie `search`, y compris
 * l'effacement (chaîne vide).
 */
describe('SearchBar', () => {
  it('émet la valeur saisie à chaque modification du champ (saisie, collage, saisie automatique)', async () => {
    const fixture = TestBed.createComponent(SearchBar);
    const emitted: string[] = [];
    fixture.componentInstance.search.subscribe((value) => emitted.push(value));
    await fixture.whenStable();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = 'alice';
    input.dispatchEvent(new Event('input'));
    input.value = '';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['alice', '']);
  });
});
