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
import { provideRouter } from '@angular/router';
import { LoggedOut } from './logged-out';

/**
 * Vérifie la page de confirmation de déconnexion : titre, message, bouton de retour à l'accueil et
 * en-tête de marque. Seul un routeur vide est fourni (le composant n'injecte aucun service).
 */
describe('LoggedOut', () => {
  it('confirme la déconnexion et propose de revenir à l\'accueil', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(LoggedOut);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toBe('Déconnexion réussie');
    expect(root.querySelector('.message')?.textContent).toContain('déconnecté en toute sécurité');
    expect(root.querySelector('section button')?.textContent).toContain('Retour à l\'accueil');
    expect(root.querySelector('app-brand-header')).not.toBeNull();
  });
});
