# SPEC.md  
# Virtual Tour Editor — Spécification fonctionnelle

---

# 1. Vision du projet

Virtual Tour Editor est une application web permettant de créer, éditer et consulter des visites virtuelles immersives basées sur des panoramas 360°.

Le projet ne cherche pas à développer un moteur 3D, mais une **couche logicielle d’édition professionnelle** permettant de structurer, relier et organiser des scènes 360°.

Le rendu des panoramas est délégué à :

- Photo Sphere Viewer  
  https://photo-sphere-viewer.js.org/

La cartographie est gérée via :

- Leaflet  
  https://leafletjs.com/

---

# 2. Objectifs du projet

L’application doit permettre :

- importer des images 360°
- créer automatiquement des scènes
- organiser des scènes en parcours
- relier les scènes entre elles
- positionner les scènes sur une carte
- ajouter des hotspots interactifs
- sauvegarder un projet complet
- recharger un projet existant
- visualiser une visite immersive

---

# 3. Principes fondamentaux

## 3.1 Offline-first

L’application doit fonctionner sans backend.

Toutes les données doivent être manipulables localement.

---

## 3.2 Web-first

L’application est une application web :

- compatible desktop
- compatible mobile
- compatible Meta Quest (via navigateur VR)

---

## 3.3 Statique

Le projet doit pouvoir être hébergé sur GitHub Pages.

Aucun serveur n’est requis.

---

## 3.4 Single source of truth

- Chaque visite est définie par un seul fichier : project.json

---

## 3.5 Séparation des responsabilités

- UI : React
- logique métier : services
- données : project.json + médias externes
- stockage : abstraction StorageProvider

---

## 3.6 Extensibilité

Le système doit pouvoir évoluer vers :

- cloud storage
- collaboration
- IA
- VR avancée
- statistiques
- mobile apps

sans refonte majeure.

---

# 4. Concepts métier

## 4.1 Projet

Un projet représente une visite virtuelle complète.

Il contient :

- métadonnées
- scènes
- liens
- hotspots
- carte

---

## 4.2 Scène

Une scène est un panorama 360°.

Elle contient :

- image 360°
- miniature
- position sur carte
- orientation nord
- liens vers autres scènes
- hotspots

---

## 4.3 Lien

Un lien relie deux scènes.

Il est représenté par une flèche dans le panorama.

---

## 4.4 Hotspot

Un hotspot est un point interactif :

- texte
- information
- futur média (audio, vidéo, PDF)

---

## 4.5 Carte

La carte représente la structure spatiale des scènes.

Elle permet :

- positionnement
- navigation
- organisation logique

---

# 5. Architecture fonctionnelle

## 5.1 Mode Éditeur

Permet :

- import de panoramas
- création de scènes
- création de liens
- positionnement sur carte
- sauvegarde

## 5.2 Mode Viewer

Permet uniquement :

- lecture du project.json
- navigation dans la visite

---

# 6. Format de données principal

## 6.1 Principe

Toutes les données sont stockées dans :


- project.json


Les médias sont externes (URL uniquement).

---

## 6.2 Structure du project.json

```json
{
  "version": 1,

  "project": {
    "title": "Maison Dupont",
    "author": "",
    "createdAt": "",
    "defaultScene": "hall"
  },

  "map": {
    "image": "https://storage.example.com/map.webp",
    "width": 3000,
    "height": 1800
  },

  "scenes": [
    {
      "id": "hall",
      "title": "Hall",

      "image": "https://storage.example.com/panoramas/hall.webp",
      "thumbnail": "https://storage.example.com/thumbs/hall.webp",

      "position": {
        "x": 120,
        "y": 90
      },

      "north": 0,

      "links": [
        {
          "target": "salon",
          "yaw": 40,
          "pitch": 0
        }
      ],

      "hotspots": [
        {
          "id": "info-1",
          "type": "info",
          "yaw": 20,
          "pitch": -10,
          "content": "Entrée principale"
        }
      ]
    }
  ]
}
```
# 7. Stockage des médias
## 7.1 Règles
- aucun média dans Git
- aucun média dans project.json
- uniquement des URLs
## 7.2 Interface de stockage
```ts
interface StorageProvider {
  upload(file: File): Promise<string>
  download(url: string): Promise<Blob>
  delete(url: string): Promise<void>
}
```
## 7.3 Implémentation V1
- LocalStorageProvider uniquement (offline)
## 7.4 Évolutions prévues
- Cloudflare R2
- Supabase Storage
- Backblaze B2
# 8. Workflow utilisateur
## 8.1 Création
- ouvrir l’app
- importer des panoramas
- scènes générées automatiquement
- affichage immédiat
## 8.2 Édition
- relier les scènes
- positionner sur carte
- ajouter hotspots
- modifier titres
## 8.3 Sauvegarde
- export project.json
- sauvegarde locale
## 8.4 Publication (future)
- upload vers stockage distant
- génération lien public
# 9. Interface utilisateur
```text
Layout attendu
---------------------------------------------------
Toolbar
---------------------------------------------------
Scenes | Viewer 360 | Properties
---------------------------------------------------
Map (Leaflet)
---------------------------------------------------
```
# 10. Viewer 360

Basé sur Photo Sphere Viewer.

Fonctionnalités :

- rotation
- zoom
- plein écran
- VR mode
- hotspots
- navigation entre scènes
# 11. Carte

Basée sur Leaflet.

Fonctionnalités :

- affichage plan
- position des scènes
- déplacement des scènes
- sélection scène
- synchronisation avec viewer
# 12. Performance

Contraintes :

- support panoramas 16K
- lazy loading
- préchargement scène suivante
- cache navigateur
- miniatures optimisées
# 13. Contraintes techniques
- React + TypeScript obligatoire
- Vite obligatoire
- GitHub Pages compatible
- aucune dépendance backend
- architecture modulaire

# 14. Évolutivité

Le système doit pouvoir évoluer vers :

- SaaS multi-utilisateur
- cloud storage
- collaboration
- IA (auto linking, auto placement)
- VR avancée
- mobile app
- desktop app (Electron / Tauri)
- QR codes
- analytics
- audio / vidéo / PDF
- multilingue
# 15. Objectif final

Construire un outil professionnel de création de visites virtuelles permettant :

- une expérience fluide
- une édition intuitive
- une architecture évolutive
- une compatibilité web et VR
- une publication simple
