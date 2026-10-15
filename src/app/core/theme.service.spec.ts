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
 * Contrats de `ThemeService` : thème orange par défaut, reprise de la préférence en cookie (valeur
 * inconnue ignorée), et application d'un changement au signal, au cookie, à l'attribut `data-theme`
 * de `<html>` et aux favicons. Les balises `<link>` de favicon sont injectées dans le `<head>` du
 * test puis retirées, car la page de test n'a pas celles d'`index.html`.
 */

import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const FAVICONS = [
  { tag: '<link rel="icon" type="image/png" sizes="32x32" href="favicon/favicon-32x32.png">', file: 'favicon-32x32.png' },
  { tag: '<link rel="icon" type="image/png" sizes="16x16" href="favicon/favicon-16x16.png">', file: 'favicon-16x16.png' },
  { tag: '<link rel="icon" type="image/x-icon" href="favicon/favicon.ico">', file: 'favicon.ico' },
  { tag: '<link rel="apple-touch-icon" href="favicon/apple-touch-icon.png">', file: 'apple-touch-icon.png' },
];

function clearCookie(): void {
  document.cookie = 'miam-theme=; path=/; max-age=0';
}

function hrefs(): string[] {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[data-test-favicon]')).map((l) =>
    l.getAttribute('href') ?? '',
  );
}

describe('ThemeService', () => {
  beforeEach(() => {
    clearCookie();
    delete document.documentElement.dataset['theme'];
    for (const { tag } of FAVICONS) {
      document.head.insertAdjacentHTML('beforeend', tag.replace('<link ', '<link data-test-favicon '));
    }
  });

  afterEach(() => {
    clearCookie();
    document.head.querySelectorAll('link[data-test-favicon]').forEach((l) => l.remove());
  });

  it('est orange par défaut et le publie sur <html>', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('orange');
    expect(document.documentElement.dataset['theme']).toBe('orange');
  });

  it('reprend la préférence enregistrée en cookie', () => {
    document.cookie = 'miam-theme=bleu; path=/';
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('bleu');
    expect(document.documentElement.dataset['theme']).toBe('bleu');
  });

  it('ignore une valeur de cookie inconnue', () => {
    document.cookie = 'miam-theme=violet; path=/';
    expect(TestBed.inject(ThemeService).theme()).toBe('orange');
  });

  it('setTheme met à jour le signal, le cookie, <html> et les favicons', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('bleu');

    expect(service.theme()).toBe('bleu');
    expect(document.cookie).toContain('miam-theme=bleu');
    expect(document.documentElement.dataset['theme']).toBe('bleu');
    expect(hrefs()).toEqual([
      'favicon/favicon-32x32-bleu.png',
      'favicon/favicon-16x16-bleu.png',
      'favicon/favicon-bleu.ico',
      'favicon/apple-touch-icon-bleu.png',
    ]);

    service.setTheme('orange');
    expect(hrefs()).toEqual(FAVICONS.map(({ file }) => `favicon/${file}`));
  });

  it('toggle bascule entre les deux thèmes', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.theme()).toBe('bleu');
    service.toggle();
    expect(service.theme()).toBe('orange');
  });
});
