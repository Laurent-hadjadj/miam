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
 * Confidentialité (RGPD) : l'application ne contacte que sa propre origine.
 *
 * - aucune requête vers un tiers (polices, scripts, mesure d'audience), qui recevrait l'adresse IP et le
 *   navigateur de chaque visiteur ;
 * - les polices Roboto et Material Icons sont servies par l'application elle-même.
 */

import { expect, test } from '@playwright/test';
import { makeAccount, makeDevice, makeSession, mockActuator, withSession } from './fixtures';

// RGPD : aucune requête ne doit partir vers un tiers (polices, scripts, mesure d'audience…),
// qui recevrait l'adresse IP et le navigateur de chaque visiteur. Voir docs/conformite/rgpd.md.
test.describe('Confidentialité — aucun appel à un tiers', () => {
  test('toutes les requêtes visent l’origine de l’application', async ({ page }) => {
    const externes: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== 'http://localhost:4200') {
        externes.push(request.url());
      }
    });

    await page.goto('/');
    await withSession(page);
    await mockActuator(page, [makeAccount('alice.martin')], [makeDevice('alice.martin')], [makeSession('alice.martin')]);
    await page.goto('/users');
    await expect(page.getByRole('table', { name: 'Comptes TOTP' })).toBeVisible();
    await page.goto('/journal');
    await expect(page.getByRole('heading', { name: "Journal d'activité" })).toBeVisible();

    expect(externes).toEqual([]);
  });

  test('Roboto et Material Icons sont chargées depuis l’application (icônes rendues en glyphes)', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [makeAccount('alice.martin')], []);
    await page.goto('/users');
    await expect(page.getByRole('table', { name: 'Comptes TOTP' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const polices = await page.evaluate(() => ({
      roboto: document.fonts.check('400 16px Roboto'),
      icones: document.fonts.check('24px "Material Icons"'),
      source: Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')),
    }));
    expect(polices.roboto).toBe(true);
    expect(polices.icones).toBe(true);
    expect(polices.source).toEqual(expect.arrayContaining(['Roboto', 'Material Icons']));

    // Sans la police, la ligature « people » s'afficherait en toutes lettres (largeur >> 24 px).
    const largeur = await page.locator('mat-toolbar mat-icon').first().evaluate((el) => el.getBoundingClientRect().width);
    expect(largeur).toBeLessThanOrEqual(30);
  });
});
