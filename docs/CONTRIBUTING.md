# CONTRIBUTING.md  
# Virtual Tour Editor — Guide de contribution

---

# 1. Objectif

Ce document définit les règles pour contribuer au projet Virtual Tour Editor.

Il s’adresse :

- aux développeurs humains
- aux assistants IA (Codex, Gemini, ChatGPT, etc.)

L’objectif est de garantir :

- cohérence du code
- qualité de l’architecture
- stabilité du projet
- évolutivité à long terme

---

# 2. Philosophie du projet

Virtual Tour Editor est un projet :

- modulaire
- extensible
- orienté produit
- conçu comme un logiciel professionnel

Chaque contribution doit respecter la logique suivante :

> Simplicité + maintenabilité > complexité inutile

---

# 3. Avant de contribuer

Avant toute modification :

- lire `SPEC.md`
- lire `ARCHITECTURE.md`
- lire `CODING_STYLE.md`
- comprendre `PROJECT_FORMAT.md`

Aucune contribution ne doit casser ces règles.

---

# 4. Types de contributions acceptées

## 4.1 Fonctionnalités

- nouvelles fonctionnalités UI
- nouveaux outils d’édition
- améliorations viewer 360
- gestion carte
- hotspots
- liens entre scènes

---

## 4.2 Refactorisation

- amélioration structure code
- optimisation performance
- simplification logique
- suppression duplication

---

## 4.3 Bug fixes

- correction de comportements UI
- correction synchronisation state
- correction rendering 360
- correction carte Leaflet

---

## 4.4 Documentation

- mise à jour docs
- clarification SPEC
- ajout exemples
- amélioration lisibilité

---

# 5. Règles de développement

## 5.1 Aucune logique métier dans l’UI

L’UI ne doit appeler que des services.

---

## 5.2 Respect strict du project.json

Aucune donnée ne doit exister en dehors de :

```text
project.json

```
## 5.3 Pas de dépendance backend en V1

Toute contribution doit fonctionner :

- offline
- sans serveur
- sans API externe obligatoire
## 5.4 Storage obligatoire via abstraction

Toujours utiliser :

- StorageProvider
# 6. Structure des commits
## 6.1 Format obligatoire
- type(scope): description
## 6.2 Types autorisés
- feat → nouvelle fonctionnalité
- fix → correction bug
- refactor → refactorisation
- docs → documentation
- chore → maintenance
## 6.3 Exemples
- feat(viewer): add hotspot rendering system
- fix(map): correct scene position sync issue
- refactor(storage): simplify StorageProvider interface
# 7. Git workflow
## 7.1 Branching
- main → stable
- dev → développement
- feature/* → nouvelles fonctionnalités
- fix/* → corrections
## 7.2 Exemple
- feature/add-hotspots
- fix/map-sync-bug
# 8. Pull Requests

Chaque PR doit contenir :

- description claire
- objectif de la modification
- impact sur project.json
- capture d’écran si UI
# 9. Règles de qualité
## 9.1 Obligatoire
- code lisible
- pas de duplication
- pas de logique métier dans UI
- typage TypeScript strict
- services utilisés systématiquement
## 9.2 Interdit
- any non justifié
- logique métier dans composants React
- accès direct au storage
- modification non documentée du format JSON
# 10. Compatibilité

Toute contribution doit garantir :

- compatibilité GitHub Pages
- fonctionnement offline
- compatibilité navigateur moderne
- performance sur panoramas lourds
# 11. Tests

Les contributions doivent inclure des tests si applicable :

- services métier
- validation project.json
- logique de navigation
- liens entre scènes
# 12. Documentation

Toute nouvelle fonctionnalité doit être documentée dans :

- SPEC.md (si impact structure)
- ARCHITECTURE.md (si impact système)
- README.md (si nouvelle capacité visible utilisateur)
# 13. Design system

Toute contribution UI doit respecter :

- layout existant
- cohérence visuelle
- dark mode par défaut
- accessibilité minimale
# 14. Performance

Aucune contribution ne doit :

- dégrader le rendu 360°
- ralentir la carte Leaflet
- augmenter inutilement la taille des bundles
# 15. Review

Chaque contribution est validée selon :

- conformité architecture
- respect coding style
- absence de régression
- cohérence UX
# 16. Vision long terme

Le projet vise à devenir :

- un éditeur professionnel de visites virtuelles
- une plateforme extensible SaaS
- un outil compatible VR et Web
- une base pour IA assistée
