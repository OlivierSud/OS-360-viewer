# ROADMAP.md  
# Virtual Tour Editor — Feuille de route

---

# 1. Vision globale

Virtual Tour Editor est conçu comme un produit évolutif en plusieurs étapes :

- V1 : éditeur local fonctionnel
- V2 : publication et cloud
- V3 : plateforme collaborative SaaS + IA

Chaque version doit rester rétrocompatible autant que possible avec `project.json`.

---

# 2. V1 — MVP (Offline Editor)

## 2.1 Objectif

Créer une application fonctionnelle permettant :

- import de panoramas 360°
- création de scènes
- navigation entre scènes
- liens entre scènes
- positionnement sur carte
- sauvegarde locale de projet
- export `project.json`

---

## 2.2 Fonctionnalités

### Éditeur
- import d’images 360°
- génération automatique de scènes
- interface 3 panneaux (scènes / viewer / propriétés)
- drag & drop des scènes
- édition des propriétés

---

### Viewer 360
- affichage panoramique via Photo Sphere Viewer
- navigation entre scènes
- hotspots basiques
- transitions simples

---

### Carte
- affichage Leaflet
- positionnement scènes
- synchronisation viewer ↔ carte

---

### Stockage
- stockage local uniquement
- IndexedDB ou File System API
- export/import JSON

---

## 2.3 Contraintes

- aucun backend
- compatible GitHub Pages
- offline-first
- performance panoramas 8K–16K

---

## 2.4 Livrable V1

- application web complète
- export/import project.json
- viewer standalone utilisable

---

# 3. V2 — Cloud & Publication

## 3.1 Objectif

Transformer l’outil en plateforme de publication de visites virtuelles.

---

## 3.2 Fonctionnalités

### Cloud Storage
- upload automatique des panoramas
- gestion des URLs CDN
- intégration StorageProvider cloud

---

### Publication
- génération de lien public
- partage de visite virtuelle
- mode viewer séparé (public)

---

### Gestion projets
- sauvegarde cloud des projets
- multi-projets utilisateur

---

### Export avancé
- export ZIP complet
- export web standalone

---

## 3.3 Authentification (optionnelle V2)

- comptes utilisateurs
- login email/password
- projets privés / publics

---

## 3.4 Infrastructure

- Cloudflare R2 (ou équivalent)
- Supabase possible
- CDN global

---

## 3.5 Livrable V2

- plateforme web complète
- publication de visites en ligne
- partage par URL

---

# 4. V3 — SaaS collaboratif + IA

## 4.1 Objectif

Transformer le produit en plateforme professionnelle de création collaborative de visites virtuelles.

---

## 4.2 Fonctionnalités principales

### Collaboration temps réel
- multi-utilisateur sur un même projet
- édition synchronisée
- curseurs visibles
- locking de scènes

---

### IA assistée

- génération automatique de liens entre scènes
- placement automatique sur carte
- suggestions de hotspots
- optimisation du parcours utilisateur

---

### Analyse & analytics

- tracking des visites
- heatmaps des zones regardées
- temps passé par scène
- taux de navigation

---

### VR avancé

- mode VR natif amélioré
- compatibilité Meta Quest
- navigation gestuelle

---

### Marketplace (optionnel futur)
- templates de visites
- assets 360°
- thèmes UI

---

## 4.3 Architecture V3

- backend complet (API)
- base de données projets
- websocket temps réel
- stockage cloud distribué

---

## 4.4 Livrable V3

- SaaS complet
- collaboration en temps réel
- IA intégrée
- plateforme commerciale

---

# 5. Évolution du format project.json

## V1
- local file
- scènes + liens + hotspots

## V2
- ajout metadata cloud
- IDs utilisateur
- URLs CDN

## V3
- versioning avancé
- collaboration metadata
- locks de scènes
- audit log

---

# 6. Priorités globales

## Priorité 1 (V1)
- éditeur stable
- viewer fluide
- carte fonctionnelle

## Priorité 2 (V2)
- cloud storage
- publication simple
- partage URL

## Priorité 3 (V3)
- collaboration
- IA
- SaaS complet

---

# 7. Contraintes de conception

- rétrocompatibilité maximale
- aucune rupture brutale de format
- architecture modulaire obligatoire
- séparation stricte UI / data / storage

---

# 8. Objectif final

Créer un outil capable de :

- produire des visites virtuelles professionnelles
- fonctionner en SaaS cloud
- supporter collaboration temps réel
- intégrer IA et automatisation
- rester simple pour un utilisateur non technique

---

# FIN DU ROADMAP.md
