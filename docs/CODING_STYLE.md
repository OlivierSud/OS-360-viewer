# CODING_STYLE.md  
# Virtual Tour Editor — Conventions de code

---

# 1. Objectif

Ce document définit les règles de style, d’architecture et de qualité de code pour le projet Virtual Tour Editor.

L’objectif est d’assurer :

- un code lisible
- un code maintenable
- un code scalable
- une cohérence sur tout le projet
- une compatibilité avec développement assisté par IA

---

# 2. Langages et standards

## 2.1 Langage principal

- TypeScript (strict mode obligatoire)

## 2.2 UI

- React (fonctionnel uniquement)
- Hooks obligatoires
- Aucun composant classe

## 2.3 Build

- Vite

---

# 3. Règles TypeScript

## 3.1 Strict mode obligatoire

```ts
{
  "strict": true,
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}

```
## 3.2 Typage obligatoire

Aucun any n’est autorisé sauf cas exceptionnel documenté.

## 3.3 Interfaces vs Types
```ts
interface pour les objets métier
type pour unions / helpers
```
## 3.4 Exemple recommandé
```ts
interface Scene {
  id: string;
  title: string;
  image: string;
  thumbnail: string;
  position: {
    x: number;
    y: number;
  };
  north: number;
  links: Link[];
  hotspots: Hotspot[];
}
```
# 4. Architecture du code
## 4.1 Séparation stricte

Le code doit être organisé en 4 couches :

- UI (components)
- state (Zustand)
- services (logique métier)
- storage (accès données)
## 4.2 Règle fondamentale

Aucun composant UI ne doit contenir de logique métier complexe.

## 4.3 Exemple interdit

❌ Mauvais :

```ts
const save = () => {
  project.scenes.push(newScene);
  localStorage.setItem("project", JSON.stringify(project));
};
```
## 4.4 Exemple correct

✔ Bon :

- SceneService.addScene(newScene);
# 5. Conventions de nommage
## 5.1 Fichiers
- PascalCase pour composants React
- camelCase pour services et utils

Exemples :

- SceneViewer.tsx
- MapPanel.tsx
- projectService.ts
## 5.2 Variables
- camelCase obligatoire
```ts
const currentScene = ...
```
## 5.3 Constantes
- UPPER_SNAKE_CASE
- const MAX_ZOOM_LEVEL = 5;
## 5.4 Interfaces
- PascalCase
```ts
interface ProjectState {}
```
# 6. React guidelines
## 6.1 Functional components only
```ts
export function SceneViewer() {
  return <div />;
}
```
## 6.2 Hooks obligatoires
- useState
- useEffect
- useMemo
- useCallback
## 6.3 Custom hooks

Toute logique complexe doit être déplacée dans un hook :

- useProject()
- useScenes()
- useViewer()
## 6.4 Props typing

Toujours typées explicitement :

```ts
interface Props {
  sceneId: string;
}

function SceneViewer({ sceneId }: Props) {}
```
# 7. State management
## 7.1 Zustand obligatoire

Aucune autre solution globale (Redux interdit en V1).

## 7.2 Store global
```ts
projectStore = {
  project,
  scenes,
  selectedScene,
  mode
}
```
## 7.3 Règle

Le store ne contient pas de logique métier complexe.

# 8. Services
## 8.1 Rôle

Les services contiennent toute la logique métier :

- création scènes
- création liens
- validation project.json
- import/export
## 8.2 Exemple
```ts
class SceneService {
  static createScene(data: Partial<Scene>): Scene {
    return {
      id: crypto.randomUUID(),
      ...data
    } as Scene;
  }
}
```
# 9. Storage
## 9.1 Règle fondamentale

Aucun code métier ne doit accéder directement à :

- localStorage
- IndexedDB
- APIs cloud

Tout passe par :

- StorageProvider
# 10. Gestion des erreurs
## 10.1 Obligatoire

Toutes les erreurs doivent être :

- gérées
- loggées
- affichées utilisateur si nécessaire
## 10.2 Exemple
```ts
try {
  await Storage.upload(file);
} catch (e) {
  console.error(e);
  showToast("Upload failed");
}
```
# 11. Performance
## 11.1 Règles
- éviter les re-renders inutiles
- utiliser useMemo/useCallback
- lazy loading obligatoire pour panoramas
## 11.2 Images lourdes
- compression WebP
- thumbnails obligatoires
- chargement progressif
# 12. Imports
## 12.1 Ordre obligatoire
- React
- libs externes
- components internes
- services
- utils
- types
## 12.2 Exemple
```ts
import React from "react";
import { useState } from "react";

import { SceneViewer } from "@/components/SceneViewer";

import { SceneService } from "@/services/SceneService";

import type { Scene } from "@/types";
```
# 13. Règles d’écriture
## 13.1 Simplicité

Préférer :

- code simple
- fonctions courtes
- responsabilités uniques
## 13.2 Interdictions
- pas de logique métier dans UI
- pas de duplication
- pas de magie cachée
- pas de dépendance circulaire
# 14. Tests (optionnel V1 mais prévu)
- tests unitaires sur services
- tests sur project.json validation
- tests de structure de scènes
# 15. Documentation inline

Le code complexe doit être commenté :

- pourquoi (pas quoi)
- logique métier critique
- décisions techniques importantes
# 16. Évolutivité

Le code doit être prêt pour :

- multi-user
- cloud storage
- collaboration temps réel
- IA assistée
- VR avancée
- versioning
