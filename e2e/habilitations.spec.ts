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
 * Habilitations : ce que l'interface montre selon le profil de l'agent.
 *
 * Le profil est décidé par le module BFF d'après les groupes AD (voir docs/architecture/integration-cas.md) ;
 * ces tests vérifient seulement que l'INTERFACE le reflète. Le refus réel (403) est testé côté serveur
 * (server/test/app.test.js).
 *
 * - `admin` : boutons de suppression, lien « Journal », quatrième tuile de compteur ;
 * - `consultation` : lecture seule, aucun bouton d'action, ni journal ni sa tuile ;
 * - hors des groupes : le module BFF répond 403 à l'ouverture de session, message dédié sur l'accueil.
 *
 * Suivent deux contrôles voisins : la barre d'outils en mobile et la page d'information RGPD.
 */

import { expect, test } from '@playwright/test';
import { makeAccount, makeDevice, makeSession, mockActuator, mockBffSession, withSession } from './fixtures';

test.describe('Habilitations (profils issus des groupes AD)', () => {
  test('profil consultation : lecture seule, sans suppression ni journal', async ({ page }) => {
    await withSession(page, 'bob.lecteur', 'consultation');
    await mockActuator(page, [makeAccount('alice.martin')], [makeDevice('alice.martin')], [makeSession('alice.martin')]);
    await page.goto('/users');

    await expect(page.getByRole('table', { name: 'Comptes TOTP' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Afficher les détails de alice.martin/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Supprimer|Révoquer/ })).toHaveCount(0);
    await expect(page.locator('.stat-tile')).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Journal' })).toHaveCount(0);
    await expect(page.getByText('Consultation', { exact: true })).toBeVisible();
  });

  test('profil consultation : la page /journal renvoie vers la liste', async ({ page }) => {
    await withSession(page, 'bob.lecteur', 'consultation');
    await mockActuator(page, [], []);
    await page.goto('/journal');
    await expect(page).toHaveURL(/\/users$/);
  });

  test('profil administrateur : boutons de suppression, journal et compteur à 4 tuiles', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [makeAccount('alice.martin')], [makeDevice('alice.martin')], [makeSession('alice.martin')]);
    await page.goto('/users');
    await expect(page.getByRole('button', { name: /Supprimer le compte TOTP de alice.martin/ })).toBeVisible();
    await expect(page.locator('.stat-tile')).toHaveCount(4);
    await expect(page.getByRole('link', { name: 'Journal' })).toBeVisible();
    await expect(page.getByText('Consultation', { exact: true })).toHaveCount(0);
  });

  test('agent authentifié par CAS mais hors des groupes : message dédié, aucune session', async ({ page }) => {
    await mockBffSession(page, { status: 403 });
    await page.goto('/?ticket=ST-nh');
    await expect(page.getByRole('alert')).toContainText("n'est habilité à aucun profil");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  });
});

test('mobile : le bouton de déconnexion reste dans la fenêtre malgré les quatre liens et le nom', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await withSession(page, 'sophie.petite-coeur');
  await mockActuator(page, [makeAccount('alice.martin')], []);
  await page.goto('/users');
  const boite = await page.getByRole('button', { name: 'Se déconnecter' }).boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.x + boite!.width).toBeLessThanOrEqual(375);
  expect(boite!.x).toBeGreaterThanOrEqual(0);
});

test.describe('Page d’information RGPD', () => {
  test('accessible depuis l’en-tête avant connexion, puis retour', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Informations sur vos données personnelles' }).click();
    await expect(page).toHaveURL(/\/informations$/);
    await expect(page).toHaveTitle('Informations personnelles - MIAM');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Informations sur vos données personnelles');
    await expect(page.getByText('conservé 12 mois')).toBeVisible();
    await page.getByRole('button', { name: 'Retour à la page précédente' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('accessible depuis la barre d’outils une fois connecté', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [makeAccount('alice.martin')], []);
    await page.goto('/users');
    await page.getByRole('link', { name: 'Informations sur vos données personnelles' }).click();
    await expect(page).toHaveURL(/\/informations$/);
    await expect(page.locator('app-brand-header')).toHaveCount(0);
  });

  test('mobile : icône seule dans l’en-tête, sans débordement horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const lien = page.getByRole('link', { name: 'Informations sur vos données personnelles' });
    await expect(lien).toBeVisible();
    await expect(lien).not.toContainText('Informations');
    const { largeurPage, largeurFenetre } = await page.evaluate(() => ({
      largeurPage: document.documentElement.scrollWidth,
      largeurFenetre: window.innerWidth,
    }));
    expect(largeurPage).toBeLessThanOrEqual(largeurFenetre);
    const boite = await lien.boundingBox();
    expect(boite!.width).toBeGreaterThanOrEqual(44);
    expect(boite!.height).toBeGreaterThanOrEqual(44);
  });
});
