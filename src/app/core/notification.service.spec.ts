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
 * Contrats de `NotificationService` : publication différée du message (pour que la zone live relise
 * un texte identique), effacement automatique après 8 secondes, remplacement par un nouveau message
 * et `dismiss()`. Les minuteurs sont simulés (`vi.useFakeTimers`) : aucune attente réelle.
 */

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => vi.useRealTimers());

  it('publie le message après un court délai (ré-annonce même si le texte est identique)', () => {
    service.show('Fait.');
    expect(service.message()).toBe('');
    vi.advanceTimersByTime(60);
    expect(service.message()).toBe('Fait.');
  });

  it('efface le message au bout de 8 secondes', () => {
    service.show('Fait.');
    vi.advanceTimersByTime(60);
    vi.advanceTimersByTime(8000);
    expect(service.message()).toBe('');
  });

  it('un nouveau message remplace le précédent', () => {
    service.show('Premier');
    vi.advanceTimersByTime(60);
    service.show('Second');
    expect(service.message()).toBe('');
    vi.advanceTimersByTime(60);
    expect(service.message()).toBe('Second');
  });

  it('dismiss() efface immédiatement et annule la publication en attente', () => {
    service.show('Fait.');
    service.dismiss();
    vi.advanceTimersByTime(100);
    expect(service.message()).toBe('');
  });
});
