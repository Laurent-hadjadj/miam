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

/** Durée d'affichage d'un message avant effacement (ms). */
const DISPLAY_MS = 8000;
/** Délai entre l'effacement et la réinscription : force une nouvelle annonce même si le texte est identique. */
const REANNOUNCE_MS = 50;

/**
 * Messages de résultat (succès / échec) affichés dans la zone live
 * `<output>` du composant `Notification`, lue par les lecteurs d'écran.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  /** Message courant ; chaîne vide quand rien n'est à annoncer. */
  readonly message = signal('');
  /** Minuteur unique (publication différée, puis effacement) : annulé à chaque nouveau message. */
  private timer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Annonce un message : le signal est d'abord vidé, puis renseigné après `REANNOUNCE_MS`, afin que
   * la zone live relise un texte identique au précédent. Remplace tout message en cours et s'efface
   * seul après `DISPLAY_MS`.
   *
   * @param message texte à annoncer (succès ou échec d'une action).
   */
  show(message: string): void {
    clearTimeout(this.timer);
    this.message.set('');
    this.timer = setTimeout(() => {
      this.message.set(message);
      this.timer = setTimeout(() => this.message.set(''), DISPLAY_MS);
    }, REANNOUNCE_MS);
  }

  /** Efface immédiatement le message et annule toute publication ou tout effacement en attente. */
  dismiss(): void {
    clearTimeout(this.timer);
    this.message.set('');
  }
}
