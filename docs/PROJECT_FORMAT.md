# PROJECT_FORMAT.md  
# Virtual Tour Editor — Format de données (project.json)

---

# 1. Rôle du fichier project.json

Le fichier `project.json` est **la source unique de vérité** d’une visite virtuelle.

Il contient toutes les informations nécessaires pour :

- reconstruire une visite complète
- afficher les scènes
- gérer les liens
- positionner les scènes sur une carte
- afficher les hotspots
- configurer le comportement du viewer

Aucun autre fichier ne doit contenir de logique métier.

---

# 2. Principes fondamentaux

## 2.1 Single Source of Truth

Un projet = un fichier :

```text
project.json

```
## 2.2 Aucune donnée média embarquée

Les fichiers volumineux (images, vidéos, audio) ne doivent jamais être inclus dans le JSON.

Ils doivent être référencés par URL :

- CDN
- stockage objet
- local dev server
## 2.3 Compatibilité évolutive

Le format doit être :

- extensible
- versionné
- rétrocompatible autant que possible
# 3. Structure générale
```json
{
  "version": 1,

  "project": {},
  "map": {},
  "scenes": []
}
```
# 4. Versioning
## 4.1 Champ version obligatoire
- "version": 1

Ce champ permet :

- migration future du format
- compatibilité ascendante
- évolution du modèle sans casser les anciens projets
# 5. Section project
## 5.1 Description

Contient les métadonnées globales.

- "project": {
- "title": "Maison Dupont",
- "author": "Agence XYZ",
- "createdAt": "2026-01-01",
- "updatedAt": "2026-01-02",
- "defaultScene": "hall"
- }
## 5.2 Champs
- Champ	Type	Description
- title	string	Nom du projet
- author	string	Créateur
- createdAt	string	Date création
- updatedAt	string	Dernière modification
- defaultScene	string	Scène d’entrée
# 6. Section map
## 6.1 Description

Contient les informations de la carte 2D.

- "map": {
- "image": "https://cdn.example.com/map.webp",
- "width": 3000,
- "height": 1800
- }
## 6.2 Champs
- Champ	Type	Description
- image	string	URL image de la carte
- width	number	Largeur originale
- height	number	Hauteur originale
# 7. Section scenes
## 7.1 Structure générale
- "scenes": [
```json
  {
    "id": "hall",
    "title": "Hall",
    "image": "",
    "thumbnail": "",
    "position": { "x": 0, "y": 0 },
    "north": 0,
    "links": [],
    "hotspots": []
  }
]
```
## 7.2 Champs Scene
- Champ	Type	Description
- id	string	Identifiant unique
- title	string	Nom affiché
- image	string	URL panorama 360
- thumbnail	string	URL miniature
- position	object	Position sur la carte
- north	number	Orientation nord
- links	array	Liens vers autres scènes
- hotspots	array	Points interactifs
## 7.3 Position
- "position": {
- "x": 120,
- "y": 90
- }
- x : coordonnée horizontale sur carte
- y : coordonnée verticale sur carte
# 8. Links (liaisons entre scènes)
## 8.1 Définition

Un link représente une transition entre deux scènes.

```json
{
  "target": "salon",
  "yaw": 45,
  "pitch": 0
}
```
## 8.2 Champs
- Champ	Type	Description
- target	string	ID scène cible
- yaw	number	direction horizontale
- pitch	number	direction verticale
## 8.3 Comportement
- affiché sous forme de flèche dans le panorama
- cliquable
- déclenche changement de scène
# 9. Hotspots
## 9.1 Définition

Un hotspot est un élément interactif dans une scène.

```json
{
  "id": "info-1",
  "type": "info",
  "yaw": 20,
  "pitch": -10,
  "content": "Entrée principale"
}
```
## 9.2 Champs
- Champ	Type	Description
- id	string	identifiant
- type	string	type de hotspot
- yaw	number	position horizontale
- pitch	number	position verticale
- content	string	contenu affiché
## 9.3 Types prévus
- info
- text
- image (future)
- video (future)
- audio (future)
- link (future)
# 10. Contraintes du format
## 10.1 Simplicité

Le format doit rester lisible et éditable à la main.

## 10.2 Immutabilité logique

Les modifications doivent être faites via l’éditeur, pas directement dans le JSON.

## 10.3 Compatibilité

Toute évolution doit :

- ajouter des champs
- ne pas supprimer les anciens
- éviter les breaking changes
# 11. Validation du format

Un project.json valide doit contenir :

- version
- project
- scenes

map est optionnel mais recommandé.

# 12. Règles importantes
- pas de données binaires
- pas de base64
- pas de médias intégrés
- uniquement des URLs
- IDs uniques obligatoires pour les scènes
- liens toujours vers un scene.id existant
# 13. Exemple complet minimal
```json
{
  "version": 1,

  "project": {
    "title": "Demo",
    "defaultScene": "hall"
  },

  "map": {
    "image": "https://cdn.example.com/map.webp",
    "width": 2000,
    "height": 1000
  },

  "scenes": [
    {
      "id": "hall",
      "title": "Hall",
      "image": "https://cdn.example.com/hall.webp",
      "thumbnail": "https://cdn.example.com/hall_thumb.webp",

      "position": { "x": 100, "y": 80 },

      "north": 0,

      "links": [
        {
          "target": "salon",
          "yaw": 90,
          "pitch": 0
        }
      ],

      "hotspots": []
    },

    {
      "id": "salon",
      "title": "Salon",
      "image": "https://cdn.example.com/salon.webp",
      "thumbnail": "https://cdn.example.com/salon_thumb.webp",

      "position": { "x": 300, "y": 120 },

      "north": 0,

      "links": [],
      "hotspots": []
    }
  ]
}
```
# 14. Évolutions futures prévues

Le format est conçu pour évoluer vers :

- multi-étages
- GPS réel
- annotations
- audio
- vidéo
- IA (auto-linking)
- collaboration temps réel
- versioning avancé
- permissions utilisateur
- visites privées
