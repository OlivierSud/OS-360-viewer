# STORAGE.md  
# Virtual Tour Editor — Gestion du stockage des médias

---

# 1. Rôle du système de stockage

Le système de stockage est responsable de la gestion de tous les fichiers volumineux utilisés dans une visite virtuelle :

- panoramas 360°
- miniatures
- cartes
- images additionnelles
- audio (future)
- vidéo (future)
- documents PDF (future)

Le stockage est totalement **dissocié du fichier `project.json`**.

---

# 2. Principe fondamental

## 2.1 Aucun média dans le projet

Le fichier `project.json` ne doit jamais contenir :

- fichiers binaires
- base64
- blobs
- données encodées

Il ne contient que des **URLs de référence**.

---

## 2.2 Séparation stricte

Trois couches distinctes :

```text
[ UI React ]
      ↓
[ Project (project.json) ]
      ↓
[ StorageProvider ]
      ↓
[ Stockage réel (local / cloud) ]

```
# 3. Interface StorageProvider
## 3.1 Contrat principal
```ts
export interface StorageProvider {
  upload(file: File, path?: string): Promise<string>;

  download(url: string): Promise<Blob>;

  delete(url: string): Promise<void>;

  list?(prefix?: string): Promise<string[]>;
}
```
## 3.2 Règles de comportement
- upload retourne une URL publique ou interne
- download récupère le fichier
- delete supprime le fichier distant
- list est optionnel (utile pour cloud providers)
# 4. Stratégie de stockage des médias
## 4.1 Organisation logique

Tous les fichiers doivent suivre une structure standard :

- /projects/{projectId}/
- panoramas/
- thumbs/
- map/
- assets/
## 4.2 Exemple de fichier panorama
- projects/house-001/panoramas/hall_8k.webp
## 4.3 Exemple URL finale
https://cdn.example.com/projects/house-001/panoramas/hall.webp
# 5. Implémentation V1 (Offline)
## 5.1 LocalStorageProvider

En V1, aucun backend n’est utilisé.

Le stockage est simulé via :

- IndexedDB (recommandé)
- ou File System Access API (si disponible)
## 5.2 Comportement
- upload = copie locale + URL blob
- download = lecture locale
- delete = suppression locale
## 5.3 Avantage

Permet :

- développement 100% offline
- GitHub Pages compatible
- tests rapides sans infrastructure
# 6. Évolutions futures (Cloud Providers)

Le système doit pouvoir intégrer sans modification du code métier :

## 6.1 Cloudflare R2
- stockage objet S3-compatible
- idéal pour panoramas lourds
- CDN global
## 6.2 Supabase Storage
- authentification intégrée
- gestion utilisateurs
- API simple
## 6.3 Backblaze B2
- stockage économique
- haute capacité
# 7. Abstraction obligatoire

Aucune partie du code métier ne doit dépendre :

- d’un provider spécifique
- d’une API externe
- d’une URL formatée

Tout passe par :

- StorageProvider
# 8. Stratégie de nommage des fichiers
## 8.1 Convention

Tous les fichiers doivent être :

- uniques
- prévisibles
- organisés par projet

Format recommandé :

- {sceneId}_{resolution}.{ext}

Exemple :

- hall_8k.webp
- hall_thumb.webp
# 9. Gestion des performances
## 9.1 Règles obligatoires
- compression des panoramas (WebP recommandé)
- thumbnails systématiques
- lazy loading
- chargement différé des scènes non visibles
## 9.2 Préchargement intelligent

Le système doit :

- charger la scène active immédiatement
- précharger la scène liée suivante
- décharger les scènes non utilisées
# 10. Sécurité
## 10.1 Règles
- aucune donnée sensible dans les URLs
- pas de clé API dans le client (V1 offline uniquement)
- validation des fichiers uploadés
# 11. Workflow complet de stockage
## 11.1 Import utilisateur
- User selects file
- ↓
- StorageProvider.upload()
- ↓
- URL retournée
- ↓
- Ajout dans project.json
## 11.2 Affichage
- project.json
- ↓
- URL récupérée
- ↓
- Photo Sphere Viewer load
## 11.3 Suppression
- Scene removed
- ↓
- StorageProvider.delete()
- ↓
- Cleanup project.json
# 12. Cache et optimisation
## 12.1 Cache navigateur

Les médias doivent être cacheables via :

- headers HTTP (cloud)
- cache IndexedDB (local)
## 12.2 Stratégie de cache
- panoramas : long cache (immutable)
- thumbnails : cache moyen
- maps : cache moyen
# 13. Migration future vers SaaS

Le système de stockage est conçu pour évoluer vers :

- comptes utilisateurs
- espaces privés
- partage sécurisé
- permissions par projet
- expiration des liens
# 14. Cas d’usage avancés (futurs)
- multi-projets par utilisateur
- stockage collaboratif
- versioning de médias
- rollback de scènes
- duplication de projets
# 15. Contraintes techniques
- aucun stockage direct dans GitHub
- aucun blob dans project.json
- compatibilité GitHub Pages obligatoire
- fonctionnement offline obligatoire en V1
