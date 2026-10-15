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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notification } from './notification';
import { NotificationService } from '../core/notification.service';

/**
 * Vérifie la zone de messages : la zone `<output>` existe dès le départ et vide, le message s'affiche
 * avec un bouton de fermeture nommé, et ce bouton l'efface. Les minuteries sont simulées (fake timers).
 */
describe('Notification', () => {
  let fixture: ComponentFixture<Notification>;
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(Notification);
    service = TestBed.inject(NotificationService);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('la zone <output> existe dès le départ, vide (zone live présente avant le premier message)', () => {
    const output = (fixture.nativeElement as HTMLElement).querySelector('output');
    expect(output).not.toBeNull();
    expect(output?.textContent?.trim()).toBe('');
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('affiche le message dans <output> avec un bouton de fermeture nommé', () => {
    service.show('Appareil révoqué.');
    // Le service efface puis réinscrit le message après 50 ms pour forcer la ré-annonce : 60 ms suffisent.
    vi.advanceTimersByTime(60);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('output')?.textContent).toContain('Appareil révoqué.');
    expect(root.querySelector('.notification-bar')?.classList).toContain('visible');
    expect(root.querySelector('button')?.getAttribute('aria-label')).toBe('Fermer le message');
  });

  it('le bouton Fermer efface le message', () => {
    service.show('Appareil révoqué.');
    vi.advanceTimersByTime(60);
    fixture.detectChanges();
    ((fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('output')?.textContent?.trim()).toBe('');
  });
});
