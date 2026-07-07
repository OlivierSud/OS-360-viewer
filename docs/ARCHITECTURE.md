# ARCHITECTURE.md  
# Virtual Tour Editor — Architecture logicielle

---

# 1. Vue d’ensemble

Virtual Tour Editor est une application web modulaire construite en **React + TypeScript + Vite**.

Elle suit une architecture orientée :

- composants UI
- services métier
- modèle de données centralisé (`project.json`)
- abstraction du stockage

L’objectif est de séparer clairement :

- l’interface utilisateur
- la logique métier
- les données
- les intégrations externes

---

# 2. Architecture globale

```text
+----------------------+
|   React UI Layer     |
|  (components/pages)  |
+----------+-----------+
           |
           v
+----------------------+
|   Domain Layer       |
| (models + services)  |
+----------+-----------+
           |
           v
+----------------------+
|   Data Layer         |
| project.json         |
+----------+-----------+
           |
           v
+----------------------+
| Storage Providers    |
| (local / cloud)      |
+----------------------+

```
## 3.1 Structure des dossiers
```text
src/

components/
    Viewer/
    Editor/
    Map/
    Toolbar/
    Sidebar/
    Properties/
    Hotspots/

pages/
    EditorPage/
    ViewerPage/

services/
    ProjectService.ts
    SceneService.ts
    LinkService.ts
    HotspotService.ts

models/
    Project.ts
    Scene.ts
    Hotspot.ts
    Link.ts

storage/
    StorageProvider.ts
    LocalStorageProvider.ts

hooks/
    useProject.ts
    useScenes.ts
    useViewer.ts

state/
    projectStore.ts

utils/
    math.ts
    export.ts
    import.ts

types/
    index.ts
```

# 4. Couches architecturales
## 4.1 UI Layer (React)

Responsable de :

- affichage du panorama
- affichage de la carte
- interaction utilisateur
- drag & drop
- navigation

Ne contient aucune logique métier complexe.

## 4.2 Domain Layer

Contient toute la logique métier :

- création de scènes
- gestion des liens
- validation du project.json
- règles de navigation
- synchronisation viewer/carte

Exemple :

- SceneService.createScene()
- LinkService.createLink()
- ProjectService.saveProject()
## 4.3 Data Layer

Le seul format de vérité :

- project.json

Toutes les modifications passent par :

- chargement JSON
- modification en mémoire
- sauvegarde JSON
## 4.4 Storage Layer

Abstraction des systèmes de stockage.

```ts
interface StorageProvider {
  upload(file: File): Promise<string>
  download(url: string): Promise<Blob>
  delete(url: string): Promise<void>
}
Implémentation V1
LocalStorageProvider (offline uniquement)
Extensions futures
Cloudflare R2
Supabase Storage
Backblaze B2
```
# 5. Flux de données
## 5.1 Chargement d’un projet
- project.json
- ↓
- ProjectService.load()
- ↓
- State (Zustand)
- ↓
- UI React
## 5.2 Modification d’une scène
- UI action
- ↓
- SceneService
- ↓
- State update
- ↓
- project.json mis à jour
## 5.3 Navigation viewer
- Scene A
- ↓ (link)
- Scene B
- ↓
- Photo Sphere Viewer reload
# 6. State management

Utilisation de Zustand.

Structure globale :
- projectStore

- project
- scenes
- selectedScene
- selectedLink
- selectedHotspot
- mode (editor/viewer)
# 7. Viewer 360

Basé sur :

- Photo Sphere Viewer

Responsabilités :

- afficher scène active
- gérer rotation / zoom
- afficher hotspots
- afficher flèches de navigation
- gérer transition entre scènes
# 8. Carte (Leaflet)

Responsabilités :

- afficher plan du projet
- afficher positions des scènes
- déplacer scènes
- synchroniser sélection avec viewer
# 9. Synchronisation carte ↔ viewer
- Règle principale

Toute scène sélectionnée dans :

- viewer
- carte
- liste

doit être synchronisée globalement.

Exemple :
- Carte click → Scene sélectionnée → Viewer change
- Viewer click link → Scene change → Carte highlight
# 10. Modèle de données
## 10.1 Project
- metadata
- version
- settings
## 10.2 Scene
- id
- image URL
- thumbnail
- position (map)
- north orientation
- links[]
- hotspots[]
## 10.3 Link
- target scene id
- yaw
- pitch
## 10.4 Hotspot
- type
- position (yaw/pitch)
- content
# 11. Règles de conception
## 11.1 Séparation stricte
- UI ≠ logique métier
- logique métier ≠ stockage
- stockage ≠ UI
## 11.2 Pure functions

Les services doivent être :

- testables
- sans dépendance UI
- déterministes
## 11.3 Immutabilité

Le state ne doit jamais être modifié directement.

# 12. Performance
Optimisations obligatoires :
- lazy loading des panoramas
- préchargement scène suivante
- cache navigateur
- thumbnails compressées
- déchargement scènes non utilisées
# 13. Extensibilité

L’architecture doit permettre d’ajouter sans refactor :

- cloud storage
- collaboration
- IA
- VR avancé
- annotations
- audio / vidéo
- export web
- multi projets
- utilisateurs
# 14. Décisions techniques importantes
## 14.1 Pas de backend en V1

Tout est local.

## 14.2 JSON comme source unique

project.json = vérité absolue.

## 14.3 Viewer indépendant

Le viewer doit fonctionner sans éditeur.

## 14.4 Storage abstrait

Aucun code métier ne dépend du stockage.

# 15. Évolution future de l’architecture
- Phase 1 (V1)
- app unique React
- stockage local
- viewer intégré
- Phase 2
- séparation viewer / editor
- export web
- Phase 3
- cloud storage
- SaaS
- Phase 4
- collaboration temps réel
- IA assistance
