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

import { Injectable, signal } from '@angular/core';

/** Thèmes disponibles ; la valeur est aussi celle de l'attribut `data-theme` posé sur `<html>`. */
export type AppTheme = 'bleu' | 'orange';

/** Cookie de préférence d'affichage (aucune donnée personnelle). */
const COOKIE_NAME = 'miam-theme';
/** Durée de conservation du cookie : un an. */
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
/** Thème appliqué tant qu'aucun cookie valide n'existe. */
const DEFAULT_THEME: AppTheme = 'orange';

/**
 * Favicons présents dans `public/favicon/` : le thème "orange" correspond
 * aux fichiers sans suffixe, le thème "bleu" aux mêmes noms suffixés
 * "-bleu" (ex. favicon-32x32.png / favicon-32x32-bleu.png).
 */
const FAVICON_LINKS: { selector: string; file: string }[] = [
  { selector: 'link[rel="icon"][type="image/png"][sizes="32x32"]', file: 'favicon-32x32.png' },
  { selector: 'link[rel="icon"][type="image/png"][sizes="16x16"]', file: 'favicon-16x16.png' },
  { selector: 'link[rel="icon"][type="image/x-icon"]', file: 'favicon.ico' },
  { selector: 'link[rel="apple-touch-icon"]', file: 'apple-touch-icon.png' },
];

/**
 * Chemin du favicon pour un thème : `favicon/<fichier>` en orange, `favicon/<nom>-bleu.<extension>` en bleu.
 *
 * @param file nom du fichier orange (par exemple `favicon-32x32.png`).
 */
function themedFaviconPath(file: string, theme: AppTheme): string {
  if (theme === 'orange') {
    return `favicon/${file}`;
  }
  const dot = file.lastIndexOf('.');
  return `favicon/${file.slice(0, dot)}-bleu${file.slice(dot)}`;
}

/**
 * Thème visuel de l'application (logo + favicons) : "orange" par défaut,
 * bascule possible vers "bleu". Préférence mémorisée en cookie (pas de
 * session serveur impliquée, juste un choix d'affichage) pour survivre à un
 * changement d'onglet/navigateur fermé, contrairement à un signal en mémoire
 * seule.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Thème courant, initialisé depuis le cookie s'il est valide, sinon `DEFAULT_THEME`. */
  readonly theme = signal<AppTheme>(this.readFromCookie() ?? DEFAULT_THEME);

  /** Applique le thème initial (attribut `data-theme` et favicons) dès l'instanciation du service. */
  constructor() {
    this.applyTheme(this.theme());
  }

  /**
   * Change de thème : met à jour le signal, mémorise le choix en cookie et applique le thème au document.
   *
   * @param theme thème à activer.
   */
  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    this.writeToCookie(theme);
    this.applyTheme(theme);
  }

  /** Bascule entre « bleu » et « orange ». */
  toggle(): void {
    this.setTheme(this.theme() === 'bleu' ? 'orange' : 'bleu');
  }

  /** Pose `data-theme` sur `<html>` et réécrit le `href` de chaque favicon présent dans la page (ceux absents sont ignorés). */
  private applyTheme(theme: AppTheme): void {
    document.documentElement.dataset['theme'] = theme;
    for (const link of FAVICON_LINKS) {
      const el = document.querySelector<HTMLLinkElement>(link.selector);
      if (el) {
        el.href = themedFaviconPath(link.file, theme);
      }
    }
  }

  /** Lit le cookie ; seules les valeurs `bleu` et `orange` sont acceptées, toute autre donne `null`. */
  private readFromCookie(): AppTheme | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(bleu|orange)`));
    return match ? (match[1] as AppTheme) : null;
  }

  /** Écrit le cookie pour un an, limité au site (`SameSite=Lax`). */
  private writeToCookie(theme: AppTheme): void {
    document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }
}
