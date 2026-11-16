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
import { AppFooter, abbreviateAuthor } from './app-footer';

/**
 * Vérifie le contenu du pied de page : année courante, auteur dans ses deux variantes (complète et
 * abrégée), licence et version au format `x.y.z`. Les valeurs d'auteur attendues sont les valeurs par
 * défaut de `api-config.ts` (aucun `window.__env` en test).
 */
describe('AppFooter', () => {
  it('affiche l\'année, l\'auteur (complet et abrégé pour le mobile), la licence et la version', async () => {
    const fixture = TestBed.createComponent(AppFooter);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.footer-left')?.textContent).toContain(`© ${new Date().getFullYear()}`);
    expect(root.querySelector('.author-full')?.textContent).toBe('Laurent HADJADJ');
    expect(root.querySelector('.author-short')?.textContent).toBe('L. HADJADJ');
    expect(root.querySelector('.footer-center')?.textContent).toContain('AGPL 3.0');
    expect(root.querySelector('.footer-right')?.textContent).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it('abrège le prénom en initiale, sans modifier un nom sans prénom', () => {
    expect(abbreviateAuthor('Laurent HADJADJ')).toBe('L. HADJADJ');
    expect(abbreviateAuthor('Jean Pierre   DUPONT')).toBe('J. Pierre   DUPONT');
    expect(abbreviateAuthor('HADJADJ')).toBe('HADJADJ');
    expect(abbreviateAuthor('Laurent ')).toBe('Laurent ');
    expect(abbreviateAuthor(' Laurent')).toBe(' Laurent');
    expect(abbreviateAuthor('')).toBe('');
  });
});
