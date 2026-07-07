# UI_GUIDELINES.md  
# Virtual Tour Editor — Guidelines d’interface utilisateur

---

# 1. Objectif de l’interface

L’interface du Virtual Tour Editor doit permettre de créer des visites virtuelles de manière :

- intuitive
- rapide
- professionnelle
- visuelle
- non technique

L’application doit se comporter comme un logiciel de création (type Photoshop / Lightroom / Blender), et non comme une simple application web.

---

# 2. Principes UX fondamentaux

## 2.1 Clarté avant complexité

Chaque action doit être :

- visible
- compréhensible
- accessible en maximum 2 clics

---

## 2.2 Priorité au visuel

Les panoramas sont le cœur du produit.

L’UI doit toujours privilégier :

- le viewer 360°
- la carte
- la scène active

---

## 2.3 Mode outil (tool-based UI)

L’utilisateur ne navigue pas dans des pages, mais dans des outils :

- Viewer 360
- Carte
- Liste des scènes
- Propriétés
- Hotspots

---

## 2.4 Non-destruction des données

Aucune action ne doit détruire une scène sans confirmation.

---

# 3. Structure générale de l’interface

## 3.1 Layout principal

```text
┌──────────────────────────────────────────────────────────────┐
│ Toolbar globale                                              │
├───────────────┬───────────────────────────────┬─────────────┤
│ Scenes list   │   Viewer 360 (Photo Sphere)   │ Properties   │
│               │                               │             │
├───────────────┴───────────────────────────────┴─────────────┤
│ Map (Leaflet)                                                │
└──────────────────────────────────────────────────────────────┘

```
## 3.2 Zones principales
### 1. Toolbar

Contient :

- Nouveau projet
- Ouvrir
- Sauvegarder
- Import panoramas
- Export
- Mode (Editor / Viewer)
### 2. Scenes Panel

Liste des scènes :

- miniature
- nom
- indicateur scène active

Interactions :

- clic → sélection
- double clic → ouverture viewer
- drag & drop → réorganisation
### 3. Viewer 360

Zone centrale principale.

Basée sur Photo Sphere Viewer.

Fonctionnalités :

- rotation
- zoom
- fullscreen
- VR mode
- affichage hotspots
- affichage liens (flèches)
### 4. Properties Panel

Affiche les propriétés de la scène sélectionnée :

- titre
- image
- orientation nord
- position carte
- hotspots
- liens
### 5. Map Panel

Basée sur Leaflet.

Fonctions :

- position des scènes
- déplacement drag & drop
- sélection scène
- visualisation globale du projet
# 4. Navigation utilisateur
## 4.1 Sélection d’une scène

Trois sources possibles :

- Scenes list
- Viewer 360 (hotspot / link)
- Map

Toutes doivent synchroniser l’état global.

## 4.2 Synchronisation globale

Toute sélection met à jour :

- viewer
- map
- properties panel
- scenes list highlight
# 5. Interaction 360
## 5.1 Navigation entre scènes

Les transitions sont représentées par :

- flèches dans le panorama
- hotspots cliquables
## 5.2 Animation de transition

Lors d’un changement de scène :

- fade out
- chargement image
- fade in
## 5.3 Hotspots

Les hotspots doivent :

- être visibles dans le viewer
- être interactifs
- afficher tooltip au survol
- ouvrir panneau latéral si nécessaire
# 6. Carte interactive
## 6.1 Comportement

Chaque scène possède :

- une position (x, y)
- un marqueur sur la carte
## 6.2 Interaction
- drag marker → update position
- click marker → select scene
- double click → open scene in viewer
## 6.3 Synchronisation

Carte ↔ Viewer doivent être toujours synchronisés.

# 7. Barre d’outils (Toolbar)
## 7.1 Actions principales
- Nouveau projet
- Import panoramas
- Sauvegarde
- Export
- Import project.json
- Mode switch (Editor / Viewer)
## 7.2 Raccourcis clavier
- Action	Shortcut
- Save	Ctrl + S
- Undo	Ctrl + Z
- Redo	Ctrl + Y
- Import	Ctrl + I
- Export	Ctrl + E
- Search scene	Ctrl + K
# 8. Mode Éditeur vs Mode Viewer
## 8.1 Mode Éditeur

Permet :

- modification complète
- ajout scènes
- liens
- hotspots
- carte
## 8.2 Mode Viewer

Permet uniquement :

- navigation
- exploration
- interaction hotspots
- suivi des liens

Aucune modification possible.

# 9. Design system
## 9.1 Style général
```ts
interface sombre (dark mode par défaut)
accent couleur unique (bleu / cyan)
UI minimaliste
forte hiérarchie visuelle
```
## 9.2 Composants
- panels flottants
- cartes avec ombre légère
- boutons simples
- icônes universelles
## 9.3 Typographie
- sans-serif moderne
- lisibilité maximale
- tailles hiérarchiques claires
# 10. Performance UI
## 10.1 Règles
- aucun re-render inutile
- lazy loading des scènes
- virtualisation des listes
- memoization des composants lourds
## 10.2 Viewer 360
- chargement progressif
- textures compressées
- cache mémoire actif
# 11. Expérience utilisateur cible

L’utilisateur doit pouvoir :

- importer une visite
- voir instantanément un panorama
- comprendre la structure en carte
- créer des liens visuellement
- organiser la visite sans effort technique
# 12. Accessibilité
- navigation clavier
- contrastes élevés
- tooltips explicatifs
- actions toujours visibles
# 13. Erreurs et validations UI
- scènes sans image → warning
- liens cassés → highlight rouge
- hotspots invalides → désactivés
- project.json invalide → blocage import
# 14. Évolutions futures UI

Prévu pour intégrer :

- mode VR avancé
- collaboration multi-utilisateurs
- commentaires en temps réel
- IA assistant UI
- timeline des modifications
- mode présentation client
- annotations avancées
