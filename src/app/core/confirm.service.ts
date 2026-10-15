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

import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';
import { ConfirmDialog, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';

/**
 * Demande de confirmation avant une action destructrice. Remplace `window.confirm()`
 * par une boîte `alertdialog` accessible (focus piégé, titre et message lus à l'ouverture,
 * Échap pour annuler).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  /**
   * Ouvre la boîte de confirmation.
   *
   * @param data titre, message et libellé du bouton de confirmation (voir `ConfirmDialogData`).
   * @returns un flux qui émet une seule fois à la fermeture : `true` si l'agent confirme, `false` s'il
   *   annule ou ferme la boîte (Échap par exemple).
   */
  ask(data: ConfirmDialogData): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialog, {
        data,
        role: 'alertdialog',
        width: '30rem',
        maxWidth: '92vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(map((result) => result === true));
  }
}
