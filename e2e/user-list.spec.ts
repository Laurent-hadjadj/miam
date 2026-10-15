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
 * Page de gestion, onglet « Comptes TOTP » (`/users`) : liste, recherche, suppression et compteurs.
 *
 * Contrats vérifiés :
 * - pagination à 10 lignes et libellés français ;
 * - filtre par identifiant ou nom d'appareil, qui revient à la première page ;
 * - suppression en cascade : les appareils de confiance de l'agent sont révoqués AVANT son compte TOTP (l'ordre
 *   des appels est vérifié, il évite les appareils orphelins) ;
 * - supprimer son propre compte déconnecte l'agent (sa session ne vaut plus rien) ;
 * - compteurs globaux et pastille « session active » ;
 * - accès à la page du journal.
 *
 * `mockActuator` simule les listes ; les `DELETE` sont déclarés dans chaque test (voir fixtures.ts).
 */

import { expect, test } from '@playwright/test';
import { casRoute, casUrlPattern, confirmDialog, makeAccount, makeDevice, makeSession, mockActuator, withSession } from './fixtures';

test.describe('Page de gestion - liste', () => {
  test('pagine les comptes TOTP avec les libellés en français', async ({ page }) => {
    const accounts = Array.from({ length: 15 }, (_, i) => makeAccount(`user${String(i).padStart(2, '0')}`));
    await withSession(page);
    await mockActuator(page, accounts, []);

    await page.goto('/users');

    await expect(page.getByRole('tab', { name: 'Comptes TOTP (15)' })).toBeVisible();
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(10);
    await expect(page.getByText('1 – 10 sur 15')).toBeVisible();
    await expect(page.getByText('Éléments par page')).toBeVisible();

    await page.getByRole('button', { name: 'Page suivante' }).click();
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(5);
  });

  test('filtre par identifiant ou nom d\'appareil et réinitialise la page', async ({ page }) => {
    const accounts = [
      makeAccount('alice.martin', { name: 'Portable Alice' }),
      makeAccount('bob.bernard', { name: 'Poste fixe' }),
    ];
    await withSession(page);
    await mockActuator(page, accounts, []);

    await page.goto('/users');
    await page.getByPlaceholder('Rechercher un utilisateur').fill('alice');

    await expect(page.getByRole('tab', { name: 'Comptes TOTP (1)' })).toBeVisible();
    await expect(page.getByText('alice.martin')).toBeVisible();
    await expect(page.getByText('bob.bernard')).not.toBeVisible();
  });

  test('supprimer un compte TOTP révoque d\'abord ses appareils de confiance', async ({ page }) => {
    const account = makeAccount('alice.martin');
    const device = makeDevice('alice.martin');
    await withSession(page);
    await mockActuator(page, [account], [device]);

    // Journal des appels reçus, dans l'ordre : c'est lui qui prouve « appareils d'abord, compte ensuite ».
    const calls: string[] = [];
    await page.route('**/api/multifactorTrustedDevices/**', (route) => {
      calls.push(`DELETE device`);
      return route.fulfill({ status: 200, body: '' });
    });
    await page.route('**/api/gauthCredentialRepository/alice.martin', (route) => {
      if (route.request().method() === 'DELETE') {
        calls.push('DELETE account');
        return route.fulfill({ status: 200, body: '' });
      }
      return route.continue();
    });

    await page.goto('/users');
    await page.getByRole('button', { name: 'Supprimer' }).first().click();
    await confirmDialog(page);

    await expect.poll(() => calls).toEqual(['DELETE device', 'DELETE account']);
  });

  test('supprimer son propre compte TOTP déconnecte l\'application', async ({ page }) => {
    const account = makeAccount('sophie.petite-coeur');
    await page.route(casRoute('logout'), (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html><body>CAS logout (mock)</body></html>' }),
    );
    await page.route('**/bff/logout', (route) => route.fulfill({ status: 204, body: '' }));
    await withSession(page, 'sophie.petite-coeur');
    await mockActuator(page, [account], []);
    await page.route('**/api/gauthCredentialRepository/sophie.petite-coeur', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({ status: 200, body: '' });
      }
      return route.continue();
    });

    await page.goto('/users');
    await page.getByRole('button', { name: 'Supprimer' }).first().click();
    await confirmDialog(page);

    await page.waitForURL(casUrlPattern('logout'));
  });

  test('affiche les compteurs globaux et la pastille de session active', async ({ page }) => {
    const accounts = [makeAccount('alice.martin'), makeAccount('bob.bernard')];
    const devices = [makeDevice('alice.martin')];
    const sessions = [makeSession('alice.martin')];
    await withSession(page);
    await mockActuator(page, accounts, devices, sessions, [
      { timestamp: '2026-10-01T08:00:00Z', actor: 'sophie.petite-coeur', action: 'REVOKE_TRUSTED_DEVICE', target: 'zoe.dupont', detail: null },
    ]);

    await page.goto('/users');

    const stats = page.locator('.stat-tile');
    await expect(stats.nth(0)).toContainText('2');
    await expect(stats.nth(0)).toContainText('Comptes TOTP enrôlés');
    await expect(stats.nth(1)).toContainText('1');
    await expect(stats.nth(1)).toContainText('Appareils de confiance');
    await expect(stats.nth(2)).toContainText('1');
    await expect(stats.nth(2)).toContainText('Sessions SSO actives');
    await expect(stats.nth(3)).toContainText('1');
    await expect(stats.nth(3)).toContainText('Suppressions journalisées');

    // alice.martin a une session active (pastille verte), bob.bernard non (grise).
    const rows = page.locator('table.data-table tbody tr');
    await expect(rows.filter({ hasText: 'alice.martin' }).locator('.status-dot')).toHaveClass(/active/);
    await expect(rows.filter({ hasText: 'bob.bernard' }).locator('.status-dot')).not.toHaveClass(/active/);
  });

  test('le bouton Journal de la barre d\'outils mène à la page dédiée', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [], []);

    await page.goto('/users');
    await page.getByRole('link', { name: 'Journal' }).click();

    await expect(page).toHaveURL('/journal');
    await expect(page.getByRole('heading', { name: "Journal d'activité" })).toBeVisible();
  });
});
