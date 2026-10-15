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
