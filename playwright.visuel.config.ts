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

import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Exécution des tests e2e avec preuves visuelles (`npm run e2e:visuel`) : une vidéo, une capture
 * finale et une trace par test, regroupées dans un rapport HTML (`playwright-report/`, ouvert avec
 * `npm run e2e:rapport`). Les preuves brutes sont aussi dans `test-results/` (`video.webm`,
 * `test-finished-1.png`). Configuration à part pour ne pas alourdir l'exécution normale ni la CI.
 */
export default defineConfig({
  ...base,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...base.use,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },
});
