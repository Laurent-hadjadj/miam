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
 * Thèmes orange (défaut) et bleu, et adaptation à la taille d'écran.
 *
 * Contrats vérifiés :
 * - le thème se change avant et après connexion, se retient dans le cookie `miam-theme` et survit au rechargement ;
 * - paliers Angular Material : en « xsmall » et « small » (< 960 px) le logo est l'icône seule et le sélecteur de
 *   thème est la pastille compacte ; à partir de « medium », logo horizontal et sélecteur complet ;
 * - cibles tactiles d'au moins 44 x 44 px ;
 * - contraste WCAG 2.1 AA du bouton principal dans chaque thème.
 */

import { expect, test } from '@playwright/test';
import { mockActuator, withSession } from './fixtures';

test.describe('Thème (bleu/orange)', () => {
  test('orange par défaut, bascule vers bleu et persiste via cookie après rechargement', async ({ page }) => {
    await page.goto('/');

    const logo = page.locator('img.miam-logo');
    const fullSwitch = page.locator('.theme-switch');
    await expect(logo).toHaveAttribute('src', 'images/logo-horizontal.svg');
    await expect(fullSwitch.locator('.swatch-orange')).toHaveClass(/active/);

    await fullSwitch.click();

    await expect(logo).toHaveAttribute('src', 'images/logo-horizontal-bleu.svg');
    await expect(fullSwitch.locator('.swatch-bleu')).toHaveClass(/active/);

    const cookies = await page.context().cookies();
    const themeCookie = cookies.find((c) => c.name === 'miam-theme');
    expect(themeCookie?.value).toBe('bleu');

    await page.reload();
    await expect(logo).toHaveAttribute('src', 'images/logo-horizontal-bleu.svg');
    await expect(fullSwitch.locator('.swatch-bleu')).toHaveClass(/active/);
  });

  test('en mobile ("xsmall"), logo icône seule + une pastille à cible tactile 44x44', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const logo = page.locator('img.miam-logo');
    const compactSwitch = page.locator('.theme-switch-compact');
    await expect(page.locator('.theme-switch')).toHaveCount(0);
    await expect(compactSwitch).toBeVisible();
    await expect(logo).toHaveAttribute('src', 'images/logo.svg');

    const box = await compactSwitch.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await compactSwitch.click();

    await expect(logo).toHaveAttribute('src', 'images/logo-bleu.svg');
    await expect(compactSwitch.locator('.swatch')).toHaveClass(/swatch-bleu/);
  });

  test('en tablette ("small", 700px), logo icône seule et switch compact aussi', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto('/');

    await expect(page.locator('img.miam-logo')).toHaveAttribute('src', 'images/logo.svg');
    await expect(page.locator('.theme-switch-compact')).toBeVisible();
  });

  test('en "medium" (960px), logo horizontal + texte', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 900 });
    await page.goto('/');

    await expect(page.locator('img.miam-logo')).toHaveAttribute('src', 'images/logo-horizontal.svg');
    await expect(page.locator('.theme-switch')).toBeVisible();
  });
});

/**
 * Ratio de contraste WCAG 2.1 entre deux couleurs.
 *
 * Luminance relative = 0,2126 R + 0,7152 G + 0,0722 B (canaux linéarisés) ; ratio = (L1 + 0,05) / (L2 + 0,05) avec
 * L1 la plus claire. Le seuil AA est 4,5 pour le texte courant, 3 pour les éléments graphiques.
 *
 * @param a couleur au format CSS `rgb(r, g, b)` (celui de `getComputedStyle`).
 * @param b seconde couleur, même format.
 * @returns ratio entre 1 (identiques) et 21 (noir sur blanc).
 */
function contrastRatio(a: string, b: string): number {
  const luminance = (rgb: string): number => {
    const [r, g, c] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const lin = (v: number): number => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(c);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test.describe('Accessibilité WCAG - contraste du bouton principal', () => {
  for (const theme of ['orange', 'bleu']) {
    test(`le bouton "Se connecter" a un contraste >= 4.5:1 en thème ${theme}`, async ({ page }) => {
      await page.context().addCookies([{ name: 'miam-theme', value: theme, url: 'http://localhost:4200' }]);
      await page.goto('/');

      const button = page.getByRole('button', { name: 'Se connecter' });
      const { background, label } = await button.evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        label: getComputedStyle(el).color,
      }));

      expect(contrastRatio(background, label), `${label} sur ${background}`).toBeGreaterThanOrEqual(4.5);
      // Le bouton ne doit pas se fondre dans le fond blanc de la page.
      expect(contrastRatio(background, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(3);
    });
  }
});

test.describe('Thème une fois connecté', () => {
  test('la barre d\'outils permet de changer de thème, logo et couleur suivent', async ({ page }) => {
    await withSession(page);
    await mockActuator(page, [], []);
    await page.goto('/users');

    const toolbarLogo = page.locator('mat-toolbar img.toolbar-logo');
    await expect(toolbarLogo).toHaveAttribute('src', 'images/logo-horizontal.svg');
    await page.locator('mat-toolbar .theme-switch').click();

    await expect(toolbarLogo).toHaveAttribute('src', 'images/logo-horizontal-bleu.svg');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'bleu');
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'miam-theme')?.value).toBe('bleu');
  });

  test('en mobile, la pastille unique de la barre d\'outils bascule aussi le thème', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await withSession(page);
    await mockActuator(page, [], []);
    await page.goto('/users');

    await page.locator('mat-toolbar .theme-switch-compact').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'bleu');
  });
});
