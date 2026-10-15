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

import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../core/notification.service';

/**
 * Zone de messages de résultat. L'élément `<output>` (rôle `status`, annonce polie) est
 * toujours présent dans le DOM : une zone live doit exister avant que son contenu change
 * pour que la transcription vocale annonce le message.
 *
 * Aucune entrée ni sortie : tout l'état est dans `NotificationService` (message, effacement
 * automatique, ré-annonce d'un texte identique). Le composant ne fait qu'afficher ce message et
 * proposer le bouton de fermeture, qui n'existe que tant qu'un message est visible.
 */
@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  styleUrl: './notification.css',
  templateUrl: './notification.html',
})
export class Notification {
  /** Service partagé : `message()` alimente la zone live, `dismiss()` l'efface. */
  protected readonly notifications = inject(NotificationService);
}
