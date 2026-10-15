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
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

/** Données passées à la boîte de confirmation par `ConfirmService.ask()` (injectées via `MAT_DIALOG_DATA`). */
export interface ConfirmDialogData {
  /** Titre de la boîte, rendu en `h2` : c'est le nom accessible annoncé à l'ouverture. */
  title: string;
  /** Texte de la question posée à l'agent, annoncé après le titre. */
  message: string;
  /** Libellé du bouton de confirmation (ex. « Supprimer »). */
  confirmLabel: string;
  /** Emoji décoratif du bouton de confirmation, masqué aux lecteurs d'écran. */
  confirmEmoji?: string;
}

/**
 * Contenu de la boîte de confirmation d'une action destructrice (suppression d'un appareil, d'un
 * compte…). Il ne s'ouvre pas directement : on passe par `ConfirmService.ask()`, qui lui donne le rôle
 * `alertdialog`, le piège de focus de Material et le premier élément tabulable comme focus initial
 * (« Annuler », choix le moins risqué).
 *
 * Fermeture : `false` pour « Annuler » (Échap ou clic hors de la boîte ferment sans valeur, que
 * `ConfirmService` ramène aussi à `false`), `true` pour le bouton de confirmation. Le composant ne
 * réalise aucune suppression lui-même.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  styleUrl: './confirm-dialog.css',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  /** Titre, message et libellés fournis par l'appelant. */
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
