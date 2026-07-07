# DEPLOYMENT.md  
# Virtual Tour Editor — Déploiement et publication

---

# 1. Objectif

Ce document définit la stratégie de déploiement du Virtual Tour Editor et de ses visites virtuelles.

Le projet doit être :

- simple à déployer
- compatible GitHub Pages
- entièrement statique en V1
- évolutif vers du cloud en V2+

---

# 2. Architecture de déploiement

## 2.1 V1 (statique uniquement)

L’application est une SPA (Single Page Application) construite avec :

- React
- TypeScript
- Vite

Elle est déployée sous forme de fichiers statiques :

```text
index.html
assets/

```
## 2.2 Hébergement cible principal
- GitHub Pages
## 2.3 Hébergements compatibles futurs
- Cloudflare Pages
- Netlify
- Vercel
- serveur statique S3
# 3. Build du projet
## 3.1 Commandes standard
```bash
npm install
npm run build
```
## 3.2 Résultat attendu

Le dossier généré :

- dist/

Contient :

- HTML
- JS bundle
- assets optimisés
## 3.3 Prévisualisation locale
```bash
npm run preview
```
# 4. Configuration GitHub Pages
## 4.1 Structure recommandée

Le projet doit être configuré pour fonctionner sous un sous-chemin :

https://username.github.io/virtual-tour-editor/
## 4.2 Vite config
```ts
export default defineConfig({
  base: "/virtual-tour-editor/"
});
```
## 4.3 Déploiement automatique

Option recommandée :

- GitHub Actions
## 4.4 Workflow GitHub Actions
```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install
        run: npm install

      - name: Build
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```
# 5. Déploiement de la visionneuse (Viewer)
## 5.1 Principe

Le viewer est inclus dans la même application que l’éditeur en V1.

Il lit uniquement :

- project.json
## 5.2 Publication d’une visite

Une visite est publiée en mettant à disposition :

- un project.json
- un dossier de médias (CDN ou stockage objet)
## 5.3 URL de partage

Exemple :

https://cdn.example.com/projects/house-001/project.json
# 6. Stratégie de publication (V1)
## 6.1 Sans backend

En V1 :

- pas de serveur
- pas de base de données
- pas d’authentification

La publication consiste à :

- exporter un project.json
- uploader manuellement les médias
## 6.2 Export projet

L’éditeur doit permettre :

export ZIP contenant :
- project.json
- structure dossiers médias
# 7. Stratégie de stockage en production (V2+)

Les futures versions introduiront :

- Cloudflare R2
- Supabase Storage
- Backblaze B2
## 7.1 Objectif

Permettre :

- upload automatique
- génération d’URL publiques
- gestion des permissions
# 8. Gestion des chemins
## 8.1 Règle fondamentale

Tous les médias doivent être référencés par URL :

https://cdn.domain.com/project/scene.webp
## 8.2 Interdiction

❌ Interdit :

- chemins locaux absolus
- fichiers dans Git
- base64 dans JSON
# 9. Performance en production
## 9.1 Optimisations obligatoires
- lazy loading des scènes
- compression WebP
- thumbnails systématiques
- cache navigateur long terme
## 9.2 Chargement viewer

Le viewer doit :

- charger uniquement la scène active
- précharger la suivante
- libérer les textures non utilisées
# 10. Sécurité
## 10.1 V1
- aucune donnée sensible
- aucun token exposé
- aucune API backend
## 10.2 V2+
- authentification utilisateur
- URLs signées
- expiration des liens
# 11. Versioning des déploiements

Chaque build doit correspondre à :

- une version Git
- un tag optionnel
- un changelog
# 12. Environnements
## 12.1 Dev
- localhost:5173
## 12.2 Production
https://username.github.io/virtual-tour-editor/
# 13. Stratégie de rollback
- Git revert
- redeploy automatique via GitHub Actions
# 14. Évolutions futures

Le système de déploiement évoluera vers :

- SaaS multi-utilisateur
- publication en un clic
- gestion de projets cloud
- versioning cloud
- partage sécurisé
- QR codes
- accès invité
