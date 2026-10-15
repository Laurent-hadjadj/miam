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
 * Accueil et ouverture de session : du visiteur anonyme à la page de gestion.
 *
 * Contrats vérifiés :
 * - le bouton « Se connecter » redirige vers `<contexte CAS>/login?service=<origine de MIAM>/` ;
 * - le contexte du CAS vient de `window.__env` (env.js), jamais du code ;
 * - un ticket (`/?ticket=ST-…`) est échangé auprès du module BFF (`POST /bff/session`) : accepté, l'agent
 *   arrive sur `/users` ; refusé, il reste sur l'accueil avec un message ;
 * - une page protégée sans session renvoie vers l'accueil.
 *
 * CAS est remplacé par une page simulée ; le module BFF par `mockBffSession` (voir fixtures.ts).
 */

import { expect, test } from '@playwright/test';
import { casRoute, casUrlPattern, mockActuator, mockBffSession } from './fixtures';

test.describe('Page d\'accueil', () => {
  test('affiche le titre, les logos et le bouton de connexion pour un visiteur anonyme', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Bienvenue,' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await expect(page.locator('img.miam-logo')).toBeVisible();
  });

  test('le bouton Se connecter redirige vers le login CAS avec le bon service', async ({ page }) => {
    await page.route(casRoute('login'), (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><body>CAS login (mock)</body></html>' }),
    );

    await page.goto('/');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await page.waitForURL(casUrlPattern('login'));
    const url = new URL(page.url());
    expect(decodeURIComponent(url.searchParams.get('service') ?? '')).toBe('http://localhost:4200/');
  });

  test('le contexte du CAS vient de la configuration injectée, jamais du code (ex. /identite, puis aucun contexte)', async ({ page }) => {
    // [valeur de casBaseUrl injectée dans env.js, page de login attendue] : une chaîne vide signifie « CAS à la
    // racine du domaine », sans aucun contexte.
    for (const [casBaseUrl, chemin] of [['/identite', '/identite/login'], ['', '/login']]) {
      await page.route('**/env.js', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: `window.__env = { casBaseUrl: '${casBaseUrl}' };` }),
      );
      await page.route(`**${chemin}**`, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<html><body>CAS login (mock)</body></html>' }),
      );

      await page.goto('/');
      await page.getByRole('button', { name: 'Se connecter' }).click();

      await page.waitForURL((url) => url.pathname === chemin && url.searchParams.has('service'));
      // Chaque tour rejoue le même parcours avec un autre contexte : on retire les routes du tour précédent,
      // sans quoi elles répondraient encore au suivant.
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });

  test('un ticket CAS valide ouvre la page de gestion', async ({ page }) => {
    await mockBffSession(page, { username: 'sophie.petite-coeur' });
    await mockActuator(page, [], []);

    await page.goto('/?ticket=ST-fake-valid');

    await expect(page).toHaveURL('/users');
    await expect(page.getByText('sophie.petite-coeur')).toBeVisible();
  });

  test('un ticket CAS invalide affiche un message d\'erreur et reste sur l\'accueil', async ({ page }) => {
    await mockBffSession(page, { status: 401 });

    await page.goto('/?ticket=ST-fake-invalid');

    await expect(page.getByRole('alert')).toContainText('échoué');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('accéder directement à /users sans session renvoie vers l\'accueil', async ({ page }) => {
    await page.goto('/users');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });
});
