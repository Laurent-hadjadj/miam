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
 * Journal d'activité (`/journal`, profil administrateur) : qui a supprimé ou révoqué quoi, et quand.
 *
 * Contrats vérifiés :
 * - la liste affiche les entrées fournies par `GET /bff/audit-log` ;
 * - deux filtres INDÉPENDANTS : par agent (qui a agi) et par compte concerné (qui a subi l'action), qui se
 *   cumulent ;
 * - les comptes concernés sont affichés en texte brut (pas de navigation depuis le journal).
 *
 * Les entrées passent par le dernier paramètre de `mockActuator` (voir fixtures.ts).
 */

import { expect, test } from '@playwright/test';
import { mockActuator, withSession } from './fixtures';

test.describe('Journal d\'activité', () => {
  test('liste les entrées et se filtre indépendamment par agent et par compte concerné', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [], [], [], [
      {
        timestamp: '2026-10-01T08:00:00Z',
        actor: 'sophie.petite-coeur',
        action: 'DELETE_TOTP_ACCOUNT',
        target: 'alice.martin',
        detail: null,
      },
      {
        timestamp: '2026-10-02T09:00:00Z',
        actor: 'bob.agent',
        action: 'REVOKE_SSO_SESSION',
        target: 'alice.martin',
        detail: 'TGT-1-xyz',
      },
      {
        timestamp: '2026-10-03T10:00:00Z',
        actor: 'sophie.petite-coeur',
        action: 'REVOKE_TRUSTED_DEVICE',
        target: 'zoe.dupont',
        detail: 'zoe.dupont@Poste@fp',
      },
    ]);

    await page.goto('/journal');

    await expect(page.getByRole('heading', { name: "Journal d'activité" })).toBeVisible();
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(3);

    // Filtre par agent uniquement : 2 lignes de sophie.petite-coeur.
    await page.getByPlaceholder('Filtrer par agent (qui a agi)').fill('sophie');
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(2);
    await expect(page.getByText('bob.agent')).not.toBeVisible();

    // Ajoute le filtre sur le compte concerné : ne garde que la ligne où sophie.petite-coeur a agi sur zoe.dupont.
    await page.getByPlaceholder('Filtrer par compte concerné (qui a subi l\'action)').fill('zoe');
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(1);
    await expect(page.getByText('Révocation appareil de confiance')).toBeVisible();
  });

  test('le filtre sur le compte concerné seul retrouve une action quel que soit l\'agent', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [], [], [], [
      {
        timestamp: '2026-10-01T08:00:00Z',
        actor: 'sophie.petite-coeur',
        action: 'DELETE_TOTP_ACCOUNT',
        target: 'alice.martin',
        detail: null,
      },
      {
        timestamp: '2026-10-02T09:00:00Z',
        actor: 'bob.agent',
        action: 'REVOKE_SSO_SESSION',
        target: 'alice.martin',
        detail: 'TGT-1-xyz',
      },
    ]);

    await page.goto('/journal');
    await page.getByPlaceholder('Filtrer par compte concerné (qui a subi l\'action)').fill('alice');

    await expect(page.locator('table.data-table tbody tr')).toHaveCount(2);
  });

  test('le compte concerné est affiché en texte brut (pas de navigation depuis le journal)', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [], [], [], [
      { timestamp: '2026-10-01T08:00:00Z', actor: 'sophie.petite-coeur', action: 'DELETE_TOTP_ACCOUNT', target: 'alice.martin', detail: null },
    ]);
    await page.goto('/journal');

    // Le compte concerné est visible en texte brut
    await expect(page.getByText('alice.martin')).toBeVisible();
    // Pas de bouton cliquable dans la colonne "Compte concerné"
    await expect(page.getByRole('button', { name: 'alice.martin' })).not.toBeVisible();
  });
});
