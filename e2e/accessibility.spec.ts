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
 * Accessibilité : contrôle automatique axe-core et parcours au clavier / lecteur d'écran.
 *
 * Deux familles de tests :
 * 1. axe-core sur chaque page, dans les DEUX thèmes (le contraste dépend de la couleur d'accent) : zéro
 *    violation WCAG 2.0/2.1 A et AA, plus les bonnes pratiques axe ;
 * 2. comportements qu'un outil automatique ne voit pas : boîte de confirmation (nom, focus, Échap), zone
 *    d'annonce `<output>`, lien d'évitement, focus après navigation, titres de page, pastille en texte.
 *
 * Limite assumée : aucun essai manuel avec un lecteur d'écran (voir docs/developpement/themes-accessibilite.md).
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';
import { confirmDialog, makeAccount, makeDevice, makeSession, mockActuator, withSession } from './fixtures';

// axe-core analyse tout le DOM : plus lent que les tests ordinaires quand plusieurs navigateurs tournent en parallèle.
test.setTimeout(60_000);

const THEMES = ['orange', 'bleu'] as const;
// Règles axe-core appliquées à toutes les pages : WCAG 2.0/2.1 A et AA (dont le contraste des couleurs) +
// bonnes pratiques. En retirer une doit rester une décision explicite.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/**
 * Fixe le thème de l'application avant le chargement de la page, via le cookie qu'elle relit au
 * démarrage (`miam-theme`).
 *
 * @param page page Playwright, avant `page.goto`.
 * @param theme `orange` ou `bleu`.
 * @returns une promesse résolue quand le cookie est posé.
 *
 * Created at: 15/10/2026 12:31:11 (Europe/Paris)
 * @author     Laurent HADJADJ <laurent_h@me.com>
 * @copyright  Licensed Ma-Moulinette - Creative Common CC-BY-NC-SA 4.0.
 */
async function setTheme(page: Page, theme: string): Promise<void> {
  await page.context().addCookies([{ name: 'miam-theme', value: theme, url: 'http://localhost:4200' }]);
}

/**
 * Analyse la page affichée avec axe-core et échoue s'il reste une violation des règles `TAGS`.
 * Le message d'échec liste, pour chaque violation, la règle, son impact et les éléments en cause.
 *
 * @param page page Playwright, déjà chargée et stabilisée (attendre un élément visible avant l'appel).
 * @returns une promesse résolue quand la page est conforme.
 *
 * Created at: 15/10/2026 12:31:07 (Europe/Paris)
 * @author     Laurent HADJADJ <laurent_h@me.com>
 * @copyright  Licensed Ma-Moulinette - Creative Common CC-BY-NC-SA 4.0.
 */
async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}) : ${v.help}\n` +
      v.nodes.map((n) => '   ' + n.target.join(' ') + ' -> ' + (n.any[0]?.message ?? '')).join('\n'),
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

/**
 * Prépare une page de gestion réaliste : agent connecté et données simulées (deux comptes TOTP, un
 * appareil de confiance, une session SSO pour `alice.martin`, une entrée de journal).
 *
 * @param page page Playwright, avant `page.goto`.
 * @returns une promesse résolue quand la session et les mocks sont en place.
 *
 * Created at: 15/10/2026 12:31:02 (Europe/Paris)
 * @author     Laurent HADJADJ <laurent_h@me.com>
 * @copyright  Licensed Ma-Moulinette - Creative Common CC-BY-NC-SA 4.0.
 */
async function seed(page: Page): Promise<void> {
  await withSession(page);
  await mockActuator(
    page,
    [makeAccount('alice.martin'), makeAccount('bob.bernard')],
    [makeDevice('alice.martin')],
    [makeSession('alice.martin')],
    [
      {
        timestamp: '2026-10-01T08:00:00Z',
        actor: 'sophie.petite-coeur',
        action: 'DELETE_TOTP_ACCOUNT',
        target: 'alice.martin',
        detail: null,
      },
    ],
  );
}

for (const theme of THEMES) {
  test.describe(`Accessibilité automatique — thème ${theme}`, () => {
    test.beforeEach(async ({ page }) => setTheme(page, theme));

    test('accueil', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Bienvenue,' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('déconnexion réussie', async ({ page }) => {
      await page.goto('/deconnexion');
      await expect(page.getByRole('heading', { name: 'Déconnexion réussie' })).toBeVisible();
      await expectNoViolations(page);
    });

    test('informations RGPD', async ({ page }) => {
      await page.goto('/informations');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoViolations(page);
    });

    test('page de gestion (3 onglets)', async ({ page }) => {
      await seed(page);
      await page.goto('/users');
      await expect(page.getByRole('table', { name: 'Comptes TOTP' })).toBeVisible();
      await expectNoViolations(page);
      for (const tab of ['Appareils de confiance', 'Sessions SSO']) {
        await page.getByRole('tab', { name: new RegExp(tab) }).click();
        await expect(page.getByRole('table', { name: tab })).toBeVisible();
        await expectNoViolations(page);
      }
    });

    test('détail utilisateur', async ({ page }) => {
      await seed(page);
      await page.route('**/api/gauthCredentialRepository/alice.martin', (r) =>
        r.fulfill({ contentType: 'application/json', body: JSON.stringify([makeAccount('alice.martin')]) }),
      );
      await page.route('**/api/multifactorTrustedDevices/alice.martin', (r) =>
        r.fulfill({ contentType: 'application/json', body: JSON.stringify([makeDevice('alice.martin')]) }),
      );
      await page.goto('/users/alice.martin');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('alice.martin');
      await expectNoViolations(page);
    });

    test('journal', async ({ page }) => {
      await seed(page);
      await page.goto('/journal');
      await expect(page.getByRole('table', { name: "Journal d'activité" })).toBeVisible();
      await expectNoViolations(page);
    });

    test('boîte de confirmation ouverte', async ({ page }) => {
      await seed(page);
      await page.goto('/users');
      await page.getByRole('button', { name: /Supprimer le compte TOTP de alice.martin/ }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expectNoViolations(page);
    });
  });
}

test.describe('Accessibilité — clavier et lecteurs d’écran', () => {
  test('la boîte de confirmation est nommée, prend le focus, se ferme avec Échap et rend le focus', async ({ page }) => {
    await seed(page);
    await page.goto('/users');
    const trigger = page.getByRole('button', { name: /Supprimer le compte TOTP de alice.martin/ });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('alertdialog', { name: 'Supprimer le compte TOTP' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('le résultat d’une action est annoncé dans la zone <output>', async ({ page }) => {
    await seed(page);
    await page.route('**/api/multifactorTrustedDevices/*', (r) =>
      r.request().method() === 'DELETE' ? r.fulfill({ status: 200, body: '' }) : r.continue(),
    );
    await page.goto('/users');
    const live = page.locator('app-notification output');
    expect(await live.evaluate((el) => el.tagName)).toBe('OUTPUT');
    await expect(live).toHaveText('');

    await page.getByRole('tab', { name: /Appareils de confiance/ }).click();
    await page.getByRole('button', { name: /Révoquer l’appareil/ }).click();
    await confirmDialog(page);
    await expect(live).toContainText('révoqué');
    await page.getByRole('button', { name: 'Fermer le message' }).click();
    await expect(live).toHaveText('');
  });

  test('le lien d’évitement mène au contenu principal sans changer d’URL', async ({ page }) => {
    await seed(page);
    await page.goto('/users');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Aller au contenu principal' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#contenu')).toBeFocused();
    await expect(page).toHaveURL(/\/users$/);
  });

  test('la navigation marque la page courante et le focus passe au contenu après navigation', async ({ page }) => {
    await seed(page);
    await page.goto('/users');
    await expect(page.getByRole('link', { name: 'Utilisateurs' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: 'Journal' }).click();
    await expect(page.getByRole('link', { name: 'Journal' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main#contenu')).toBeFocused();
    await expect(page).toHaveTitle("Journal d'activité - MIAM");
  });

  test('chaque page a un titre de document et un seul h1', async ({ page }) => {
    // Pages publiques d'abord (sans session : avec une session, l'accueil renvoie vers /users).
    const publicPages: [string, string][] = [
      ['/', 'Accueil - MIAM'],
      ['/deconnexion', 'Déconnexion réussie - MIAM'],
      ['/informations', 'Informations personnelles - MIAM'],
    ];
    for (const [url, title] of publicPages) {
      await page.goto(url);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('pages de gestion : titre de document et un seul h1', async ({ page }) => {
    await seed(page);
    const pages: [string, string][] = [
      ['/users', 'Utilisateurs - MIAM'],
      ['/journal', "Journal d'activité - MIAM"],
    ];
    for (const [url, title] of pages) {
      await page.goto(url);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('la pastille de session est aussi exprimée en texte', async ({ page }) => {
    await seed(page);
    await page.goto('/users');
    const row = page.getByRole('row').filter({ hasText: 'alice.martin' });
    await expect(row.locator('.visually-hidden').first()).toHaveText(/Session active/);
    const other = page.getByRole('row').filter({ hasText: 'bob.bernard' });
    await expect(other.locator('.visually-hidden').first()).toHaveText(/Pas de session active/);
  });
});
