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

import { defineConfig, devices } from '@playwright/test';

/**
 * Tests e2e Angular, backend CAS/actuator entièrement simulé via interception
 * réseau (page.route) - aucune dépendance au bac-à-sable CAS réel,
 * donc exécutables n'importe où (CI incluse) sans instance CAS/MongoDB.
 * `channel: 'chrome'` réutilise le Chrome stable déjà installé sur la
 * machine plutôt que de télécharger un Chromium dédié via `playwright install`.
 *
 * - `fullyParallel` : chaque test est indépendant (page et mocks propres), l'ordre n'importe pas ;
 * - `webServer` : `npm start` (ng serve) est lancé si le port 4200 est libre. S'il est DÉJÀ occupé, le serveur
 *   existant est réutilisé (hors CI) : vérifier qu'il sert le code à jour, sinon les échecs sont trompeurs
 *   (nouveaux fichiers de `public/` ou changement d'`angular.json` : redémarrer `ng serve`) ;
 * - en CI : 2 reprises par test, et `test.only` interdit.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
