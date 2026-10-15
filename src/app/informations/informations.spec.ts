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
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { Informations } from './informations';

/**
 * Vérifie la page d'information RGPD : plan des rubriques et formulations neutres sans configuration,
 * durée de conservation par défaut, en-tête de marque réservé au visiteur non connecté, bouton Retour.
 * Les variables `PRIVACY_*` ne sont pas renseignées en test : seuls les textes de repli sont couverts.
 */
describe('Informations', () => {
  function create(authenticated: boolean) {
    sessionStorage.clear();
    if (authenticated) {
      sessionStorage.setItem('totp-admin-cas-session', JSON.stringify({ username: 'alice', role: 'admin' }));
    }
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(Informations);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('présente le traitement avec des formulations neutres tant que l\'organisation n\'a rien renseigné', () => {
    const { root } = create(false);
    expect(root.querySelector('h1')?.textContent).toBe('Informations sur vos données personnelles');
    expect(Array.from(root.querySelectorAll('h2')).map((h) => h.textContent)).toEqual([
      'Responsable du traitement',
      'Personnes concernées et données traitées',
      'Finalité et base légale',
      'Durée de conservation',
      'Destinataires',
      'Vos droits',
    ]);
    expect(root.textContent).toContain('délégué à la protection des données de votre organisation');
    expect(root.textContent).toContain('registre des traitements');
  });

  it('indique la durée de conservation du journal (12 mois par défaut)', () => {
    const { root } = create(false);
    expect(root.querySelector('strong')?.textContent).toBeDefined();
    expect(root.textContent).toContain('conservé 12 mois');
  });

  it('en-tête de marque pour un visiteur, pas pour un agent connecté (qui a déjà la barre d\'outils)', () => {
    expect(create(false).root.querySelector('app-brand-header')).not.toBeNull();
    // Deuxième création dans le même test : on repart d'un module de test vierge (providers, session).
    TestBed.resetTestingModule();
    expect(create(true).root.querySelector('app-brand-header')).toBeNull();
  });

  it('le bouton Retour revient à la page précédente', () => {
    const { root } = create(false);
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);
    (root.querySelector('article button') as HTMLButtonElement).click();
    expect(back).toHaveBeenCalled();
  });
});
