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


import { Component, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

/**
 * Champ de recherche d'un utilisateur, utilisé par la liste (`UserList`).
 *
 * Composant « bête » : il ne filtre rien et n'appelle aucun service. Il émet le texte brut du champ à
 * chaque modification, sans délai ni nettoyage ; le parent décide quoi en faire (filtrage, longueur
 * minimale, normalisation).
 *
 * Accessibilité : le champ est de type `search` et porte un `aria-label`, car le `placeholder` seul ne
 * constitue pas un nom accessible fiable ; l'icône de loupe est décorative.
 */
@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.css',
})
export class SearchBar {
  /** Émet le contenu actuel du champ à chaque saisie, collage ou effacement (chaîne vide comprise). */
  readonly search = output<string>();

  /** Gestionnaire de l'événement `input` du champ : relaie sa valeur via la sortie `search`. */
  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.emit(value);
  }
}
