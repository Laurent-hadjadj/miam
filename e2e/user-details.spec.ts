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
 * Page de gestion, aperçu d'un agent (`/users/<agent>`) : ses comptes, appareils et sessions.
 *
 * Contrats vérifiés :
 * - dates affichées au format `dd/MM/yyyy HH:mm` (et non en ISO brut), pastille verte seulement si l'agent a
 *   une session SSO active, retour à la liste ;
 * - supprimer le compte révoque aussi les appareils déjà chargés sur la page ;
 * - supprimer son propre compte déconnecte l'application.
 *
 * Contrairement à la liste, l'aperçu appelle des adresses FILTRÉES par agent
 * (`/api/<ressource>/<agent>`) que `mockActuator` ne couvre pas : chaque test les déclare lui-même.
 */

import { expect, test } from '@playwright/test';
import { casRoute, casUrlPattern, confirmDialog, makeAccount, makeDevice, makeSession, withSession } from './fixtures';

test.describe('Page de gestion - aperçu utilisateur', () => {
  test('affiche les comptes, appareils et sessions avec des dates formatées, et revient à la liste', async ({
    page,
  }) => {
    const account = makeAccount('alice.martin', { registrationDate: '2026-09-01T08:00:00.000+02:00' });
    const device = makeDevice('alice.martin', { expirationDate: '2026-10-01T20:00:00.000+02:00' });
    const session = makeSession('alice.martin');

    await withSession(page);
    await page.route('**/api/gauthCredentialRepository/alice.martin', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([account]) }),
    );
    await page.route('**/api/multifactorTrustedDevices/alice.martin', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([device]) }),
    );
    await page.route('**/api/ssoSessions*', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ activeSsoSessions: [session] }) }),
    );

    await page.goto('/users/alice.martin');

    await expect(page.getByRole('heading', { name: 'alice.martin' })).toBeVisible();
    // Format dd/MM/yyyy HH:mm (fr-FR) - pas la chaîne ISO brute.
    await expect(page.getByText('Enrôlé le 01/09/2026 08:00')).toBeVisible();
    await expect(page.getByText('Expire le 01/10/2026 20:00')).toBeVisible();
    // Session active -> pastille verte (classe .active) à côté du nom.
    await expect(page.locator('h1 .status-dot')).toHaveClass(/active/);

    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page).toHaveURL('/users');
  });

  test("sans session active, la pastille reste grise", async ({ page }) => {
    const account = makeAccount('bob.bernard');
    await withSession(page);
    await page.route('**/api/gauthCredentialRepository/bob.bernard', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([account]) }),
    );
    await page.route('**/api/multifactorTrustedDevices/bob.bernard', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/api/ssoSessions*', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ activeSsoSessions: [] }) }),
    );

    await page.goto('/users/bob.bernard');

    await expect(page.getByRole('heading', { name: 'bob.bernard' })).toBeVisible();
    await expect(page.locator('h1 .status-dot')).not.toHaveClass(/active/);
  });

  test('supprimer le compte révoque aussi les appareils déjà chargés sur cette page', async ({ page }) => {
    const account = makeAccount('alice.martin');
    const device = makeDevice('alice.martin');
    await withSession(page);
    await page.route('**/api/gauthCredentialRepository/alice.martin', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 200, body: '' });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify([account]) });
    });
    await page.route('**/api/multifactorTrustedDevices/alice.martin', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([device]) }),
    );
    await page.route('**/api/ssoSessions*', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ activeSsoSessions: [] }) }),
    );

    const calls: string[] = [];
    // Déclarée APRÈS la route GET ci-dessus, donc essayée avant elle (les routes s'évaluent en ordre inverse) :
    // elle ne traite que les DELETE et rend la main pour les GET.
    await page.route('**/api/multifactorTrustedDevices/**', (route) => {
      if (route.request().method() === 'DELETE') {
        calls.push('DELETE device');
        return route.fulfill({ status: 200, body: '' });
      }
      // Laisse la main au handler GET plus spécifique enregistré au-dessus
      // (route.continue() irait directement au réseau, pas au handler suivant).
      return route.fallback();
    });

    await page.goto('/users/alice.martin');
    await page.getByRole('button', { name: 'Supprimer' }).click();
    await confirmDialog(page);

    await expect.poll(() => calls).toEqual(['DELETE device']);
  });

  test('supprimer son propre compte TOTP déconnecte l\'application', async ({ page }) => {
    const account = makeAccount('sophie.petite-coeur');
    await page.route(casRoute('logout'), (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><body>CAS logout (mock)</body></html>' }),
    );
    await page.route('**/bff/logout', (route) => route.fulfill({ status: 204, body: '' }));
    await withSession(page, 'sophie.petite-coeur');
    await page.route('**/api/gauthCredentialRepository/sophie.petite-coeur', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 200, body: '' });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify([account]) });
    });
    await page.route('**/api/multifactorTrustedDevices/sophie.petite-coeur', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/api/ssoSessions*', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ activeSsoSessions: [] }) }),
    );

    await page.goto('/users/sophie.petite-coeur');
    await page.getByRole('button', { name: 'Supprimer' }).click();
    await confirmDialog(page);

    await page.waitForURL(casUrlPattern('logout'));
  });
});
