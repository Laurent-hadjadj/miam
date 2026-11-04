/**
 *  Ma-Moulinette - MIAM
 *  --------------
 *  Copyright (c) 2015-2026.
 *  Laurent HADJADJ <laurent_h@me.com>.
 *  SPDX-License-Identifier: AGPL-3.0-or-later.
 *  ---
 *  Vous pouvez obtenir une copie de la licence à l'adresse suivante :
 *  https://www.gnu.org/licenses/agpl-3.0.html
 */


import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BrandHeader } from '../brand-header/brand-header';

/**
 * Page de confirmation affichée après une déconnexion CAS réussie (SLO) -
 * service de retour passé à `/logout?service=...` par CasAuthService.logout().
 * Nécessite `cas.logout.follow-service-redirects: true` côté CAS, sans quoi
 * CAS ignore le service et affiche sa propre page de déconnexion.
 *
 * Route : `deconnexion` (publique, sans garde). Aucune entrée, sortie ni injection : la session a déjà
 * été effacée par `CasAuthService.logout()` avant l'arrivée ici, la page ne fait que le confirmer.
 * Le bouton ramène à l'accueil (`/`), d'où une nouvelle connexion repassera par CAS et le MFA.
 */
@Component({
  selector: 'app-logged-out',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, BrandHeader],
  templateUrl: './logged-out.html',
  styleUrl: './logged-out.css',
})
export class LoggedOut { }
