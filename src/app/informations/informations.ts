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
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CasAuthService } from '../core/cas-auth.service';
import { BrandHeader } from '../brand-header/brand-header';
import {
  AUDIT_RETENTION_MONTHS,
  PRIVACY_CONTROLLER,
  PRIVACY_DPO_CONTACT,
  PRIVACY_LEGAL_BASIS,
} from '../core/api-config';

/**
 * Information des personnes (RGPD, art. 13 et 14) : page publique, accessible avant comme après
 * la connexion. Les mentions propres à l'organisation (responsable de traitement, contact du DPO,
 * base légale) viennent de la configuration du BFF ; à défaut, des formulations neutres.
 *
 * Route : `informations` (chargée à la demande, sans garde). Aucune entrée ni sortie. Dépendances :
 * CasAuthService (savoir si un agent est connecté), Location (retour arrière), BrandHeader et les
 * constantes `PRIVACY_*` / `AUDIT_RETENTION_MONTHS` de `core/api-config.ts`.
 *
 * Elle n'affiche aucune donnée personnelle réelle : seulement le texte d'information. Quand rien n'est
 * renseigné, elle renvoie au DPO et au registre des traitements au lieu d'inventer une mention.
 */
@Component({
  selector: 'app-informations',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, BrandHeader],
  styleUrl: './informations.css',
  templateUrl: './informations.html',
})
export class Informations {
  /** Sert uniquement au gabarit : l'en-tête de marque n'est affiché que pour un visiteur non connecté. */
  protected readonly auth = inject(CasAuthService);
  private readonly location = inject(Location);

  /** Responsable de traitement (`PRIVACY_CONTROLLER`) ; vide = formulation neutre dans le gabarit. */
  protected readonly controller = PRIVACY_CONTROLLER;
  /** Contact du délégué à la protection des données (`PRIVACY_DPO_CONTACT`) ; vide = formulation neutre. */
  protected readonly dpoContact = PRIVACY_DPO_CONTACT;
  /** Base légale (`PRIVACY_LEGAL_BASIS`) ; vide = renvoi au registre des traitements. */
  protected readonly legalBasis = PRIVACY_LEGAL_BASIS;
  /** Durée de conservation du journal d'activité, en mois (12 par défaut). */
  protected readonly retentionMonths = AUDIT_RETENTION_MONTHS;

  /**
   * Revient à la page précédente de l'historique du navigateur : la page est atteinte depuis l'accueil
   * comme depuis la console, il n'y a donc pas de destination fixe.
   */
  back(): void {
    this.location.back();
  }
}
