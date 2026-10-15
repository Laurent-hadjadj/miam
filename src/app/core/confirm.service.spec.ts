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
 * Contrats de `ConfirmService` et de `ConfirmDialog` : la boîte est un `alertdialog` nommé par son
 * titre (accessibilité), l'emoji décoratif est masqué aux lecteurs d'écran, et le flux émet `true`
 * à la confirmation, `false` à l'annulation ou à la fermeture.
 */

import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ConfirmService } from './confirm.service';

const DATA = { title: 'Supprimer le compte TOTP', message: 'Supprimer "alice" ?', confirmLabel: 'Supprimer', confirmEmoji: '🗑️' };

describe('ConfirmService / ConfirmDialog', () => {
  async function open() {
    const service = TestBed.inject(ConfirmService);
    const result = firstValueFrom(service.ask(DATA));
    // Laisse Material rendre la boîte dans le DOM avant que le test ne l'interroge.
    await new Promise((resolve) => setTimeout(resolve));
    return { result };
  }

  function dialogEl(): HTMLElement {
    return document.querySelector('mat-dialog-container') as HTMLElement;
  }

  it("ouvre une boîte alertdialog nommée par son titre, avec le message et l'emoji masqué", async () => {
    const { result } = await open();
    const el = dialogEl();
    expect(el.getAttribute('role')).toBe('alertdialog');
    const title = el.querySelector('h2');
    expect(title?.textContent).toBe(DATA.title);
    expect(el.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(el.textContent).toContain('Supprimer "alice" ?');
    expect(el.querySelector('button.btn-delete span[aria-hidden="true"]')?.textContent).toBe('🗑️');
    TestBed.inject(MatDialog).closeAll();
    expect(await result).toBe(false);
  });

  it('émet true quand on confirme', async () => {
    const { result } = await open();
    (dialogEl().querySelector('button.btn-delete') as HTMLButtonElement).click();
    expect(await result).toBe(true);
  });

  it('émet false quand on annule', async () => {
    const { result } = await open();
    (dialogEl().querySelectorAll('button')[0] as HTMLButtonElement).click();
    expect(await result).toBe(false);
  });
});
