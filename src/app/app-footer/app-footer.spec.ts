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
import { AppFooter } from './app-footer';

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
    expect(root.querySelector('.footer-center')?.textContent).toContain('CC-NC-BY-SA 4.0');
    expect(root.querySelector('.footer-right')?.textContent).toMatch(/^v\d+\.\d+\.\d+/);
  });
});
