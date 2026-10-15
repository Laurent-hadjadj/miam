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
 * Déconnexion unique : l'agent quitte MIAM ET sa session CAS.
 *
 * Contrats vérifiés :
 * - « Se déconnecter » ferme d'abord la session du module BFF (`POST /bff/logout`, simulé en 204) puis
 *   redirige vers `<contexte CAS>/logout?service=<origine>/deconnexion` ;
 * - `/deconnexion` est une page publique de confirmation, avec retour à l'accueil.
 */

import { expect, test } from '@playwright/test';
import { casRoute, casUrlPattern, mockActuator, withSession } from './fixtures';

test.describe('Déconnexion', () => {
  test('Quitter redirige vers /logout avec le service de la page de déconnexion', async ({ page }) => {
    await page.route(casRoute('logout'), (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><body>CAS logout (mock)</body></html>' }),
    );
    await page.route('**/bff/logout', (route) => route.fulfill({ status: 204, body: '' }));
    await withSession(page);
    await mockActuator(page, [], []);

    await page.goto('/users');
    await page.getByRole('button', { name: 'Se déconnecter' }).click();

    await page.waitForURL(casUrlPattern('logout'));
    const url = new URL(page.url());
    expect(decodeURIComponent(url.searchParams.get('service') ?? '')).toBe('http://localhost:4200/deconnexion');
  });

  test('la page de déconnexion affiche un message de succès et ramène à l\'accueil', async ({ page }) => {
    await page.goto('/deconnexion');

    await expect(page.getByRole('heading', { name: 'Déconnexion réussie' })).toBeVisible();
    await expect(page.getByText('déconnecté en toute sécurité')).toBeVisible();

    await page.getByRole('button', { name: 'Retour à l\'accueil' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });
});
