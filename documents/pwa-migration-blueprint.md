# FaderZero - Blueprint de migration PWA offline-first

## Constat sur le workspace actuel

Le workspace disponible ne contient pas le code source de l'application Expo existante.
Je n'ai trouvé que des documents de cadrage dans `documents/`.

Conséquence :

- impossible d'auditer la navigation, le schéma SQLite, la sync QR actuelle ou le prompteur réel
- impossible de réutiliser la logique métier existante sans voir le code
- impossible de garantir "sans casser l'app Expo" tant que le dépôt Expo n'est pas présent

Ce document sert donc de trajectoire de migration sûre, prête à être confrontée au vrai code dès que le dépôt sera ajouté.

## Objectif produit et technique

Faire évoluer FaderZero vers une PWA mobile-first et offline-first sans remplacer brutalement l'application Expo existante.

Le principe de sécurité est simple :

- l'app Expo reste la référence fonctionnelle tant que la PWA n'a pas atteint un MVP complet
- la PWA vit dans un dossier séparé `pwa/`
- aucune dépendance à un backend pour la V1
- les données utilisateur restent locales dans IndexedDB
- toute synchro et toute migration doivent être explicites, traçables et non destructives

## Architecture cible recommandée

```text
/expo-app                 application existante inchangée tant que possible
/pwa
  /src
    /app
    /components
    /features
      /songs
      /setlists
      /prompter
      /sync
      /metronome
    /db
      db.ts
      schema.ts
      /repositories
    /services
    /stores
    /lib
```

Stack recommandée :

- Vite
- React
- TypeScript strict
- React Router
- Zustand
- Dexie + dexie-react-hooks
- vite-plugin-pwa
- lz-string
- qrcode
- html5-qrcode ou zxing-js
- Vitest

## Séparation des responsabilités

### 1. Couche données

Responsable de :

- schéma Dexie versionné
- migrations locales
- repositories
- helpers d'identifiants et timestamps

Règle :

- aucun composant React ne doit accéder directement à Dexie

### 2. Couche métier

Responsable de :

- règles d'édition des morceaux
- composition des setlists
- import/export JSON
- reconstruction et validation des transferts QR
- résolution de conflits à l'import

Règle :

- la logique métier utile de l'app Expo devra être extraite ici quand le code sera disponible

### 3. Couche UI

Responsable de :

- écrans web
- responsive mobile
- états chargement, vide, erreur
- installation PWA
- interactions caméra

## Modèle de données local recommandé

### songs

- `id: string`
- `title: string`
- `artist?: string`
- `lyrics: string`
- `key?: string`
- `bpm?: number`
- `notes?: string`
- `createdAt: number`
- `updatedAt: number`
- `deletedAt?: number | null`

Index recommandés :

- `id`
- `title`
- `updatedAt`
- `deletedAt`

### setlists

- `id: string`
- `name: string`
- `date?: string`
- `notes?: string`
- `createdAt: number`
- `updatedAt: number`
- `deletedAt?: number | null`

Index recommandés :

- `id`
- `name`
- `updatedAt`
- `deletedAt`

### setlistSongs

- `id: string`
- `setlistId: string`
- `songId: string`
- `position: number`
- `createdAt: number`
- `updatedAt: number`

Index recommandés :

- `id`
- `setlistId`
- `[setlistId+position]`
- `songId`
- `updatedAt`

Décision importante :

- ne pas imposer une unicité sur `setlistId + songId`
- cela permet de mettre plusieurs fois le même morceau dans une setlist

## Principes offline-first

### Source de vérité locale

La PWA considère IndexedDB comme source de vérité locale.

### Écriture optimiste locale

Toutes les créations, mises à jour et suppressions sont d'abord écrites localement.

### Soft delete recommandé

Pour `songs` et `setlists`, préférer un `deletedAt` plutôt qu'une suppression immédiate.

Avantages :

- import/export plus sûr
- résolution de conflits plus simple
- restauration possible

### Intégrité relationnelle

Quand un morceau est supprimé :

- soit on soft-delete seulement le morceau et on conserve les liens pour audit/import
- soit on nettoie les `setlistSongs` dans une opération transactionnelle

Décision à valider contre l'existant Expo :

- si l'app actuelle pratique déjà une suppression logique, il faut conserver ce comportement

## Sécurisation de la base locale

Sans backend, on ne peut pas promettre une sécurité forte contre un appareil compromis.
En revanche, on peut réduire fortement les risques de corruption et de perte.

Mesures recommandées :

- schéma Dexie versionné avec migrations explicites
- repositories testés unitairement
- opérations multi-table en transaction Dexie
- validation systématique des payloads importés avant écriture
- jamais de suppression automatique lors d'un import partiel
- rapport d'import détaillé après chaque migration ou synchro
- exports JSON manuels pour sauvegarde utilisateur

Option à envisager plus tard :

- chiffrement côté client d'exports manuels avec mot de passe

À éviter en V1 :

- chiffrement opaque dans IndexedDB sans gestion de clé fiable
- caches service worker contenant des données métier sensibles

## Stratégie de sync QR

La sync QR doit être pensée comme un transfert manuel fiable, pas comme une réplication temps réel.

### Format global recommandé

```json
{
  "protocol": "faderzero-sync",
  "protocolVersion": 1,
  "exportedAt": 0,
  "sourceApp": "faderzero-pwa",
  "payloadHash": "sha256-or-equivalent",
  "payload": {
    "songs": [],
    "setlists": [],
    "setlistSongs": []
  }
}
```

### Fragmentation

Chaque QR doit inclure :

- `transferId`
- `index`
- `total`
- `payloadHash`
- `chunk`

Règles de robustesse :

- accepter les fragments dans le désordre
- ignorer les doublons
- ne jamais importer avant réception complète
- vérifier `protocol`, `protocolVersion` et `payloadHash`

### Résolution de conflits

Règle recommandée :

- même `id` : comparer `updatedAt`
- `updatedAt` plus récent côté import : mise à jour
- `updatedAt` plus ancien : ignorer
- même titre mais `id` différent : ne pas fusionner automatiquement

Sortie attendue :

- rapport `created / updated / skipped / conflicts / invalid`

## Stratégie de migration des données depuis Expo

Chemin le plus sûr :

1. ajouter un export JSON minimal dans l'app Expo existante
2. importer ce JSON dans la PWA
3. conserver la sync QR comme canal secondaire entre appareils PWA

Pourquoi :

- le JSON est plus simple à déboguer
- il réduit le risque d'erreurs silencieuses
- il permet une migration utilisateur progressive

Format JSON cible :

```json
{
  "version": 1,
  "app": "faderzero",
  "exportedAt": 0,
  "songs": [],
  "setlists": [],
  "setlistSongs": []
}
```

## Plan de migration recommandé

### Étape 0 - Audit réel de l'app Expo

Dès que le dépôt est disponible, relever :

- structure du projet
- navigation
- schéma SQLite réel
- écrans clés
- logique métier réutilisable
- code spécifique Expo à remplacer
- fonctionnement actuel du prompteur
- protocole QR réel

Livrable :

- tableau `à conserver / à remplacer / à réécrire`

### Étape 1 - Squelette PWA isolé

Créer `pwa/` sans toucher à Expo.

Objectif :

- build propre
- TypeScript strict
- routing minimal
- thème mobile-first
- setup tests

### Étape 2 - Base locale Dexie

Implémenter :

- schéma
- migrations
- repositories
- helpers `createId` et `now`
- tests unitaires

### Étape 3 - Verticale "songs"

Implémenter :

- liste
- création
- édition
- suppression logique
- recherche
- tri

Objectif :

- première fonctionnalité complète réellement utilisable offline

### Étape 4 - Verticale "setlists"

Implémenter :

- liste
- détail
- ajout de morceaux
- retrait
- réordonnancement

### Étape 5 - Prompteur web

Implémenter :

- lecture plein écran
- taille de texte
- autoscroll
- accords entre crochets

### Étape 6 - Export/import JSON

Implémenter côté PWA :

- export JSON
- import JSON
- rapport d'import

Puis seulement :

- patch minimal Expo pour export JSON compatible

### Étape 7 - Sync QR PWA

Implémenter :

- export fragmenté
- affichage de progression
- import via caméra
- reconstruction robuste

### Étape 8 - Métrologie et stabilisation

Implémenter :

- tests
- polish PWA
- aide à l'installation
- gestion des mises à jour

## Ce qui doit probablement être conservé depuis Expo

À confirmer sur le vrai code :

- noms métier
- formes des entités utiles
- règles de tri et d'édition
- logique d'assemblage des setlists
- conventions de timestamp
- éventuel format d'export/sync déjà existant

## Ce qui devra probablement être remplacé

À confirmer sur le vrai code :

- navigation Expo / React Navigation
- composants React Native
- accès SQLite natif Expo
- partage de fichiers spécifique mobile natif
- APIs caméra natives si elles existent

## Ce qui devra probablement être réécrit

À confirmer sur le vrai code :

- couche persistance web
- prompteur en CSS/DOM
- permissions caméra navigateur
- stratégie PWA et service worker
- import/export local web

## Risques principaux

### Risque 1 - dérive de schéma

Si la base SQLite Expo ne correspond pas aux entités supposées, la migration peut casser les imports.

Réduction du risque :

- auditer le schéma réel avant toute implémentation avancée

### Risque 2 - conflit de données

Sans stratégie claire sur `updatedAt`, les imports peuvent écraser de bonnes données.

Réduction du risque :

- comparer par `id` puis `updatedAt`
- ne jamais fusionner par titre seul

### Risque 3 - sync QR incomplète

Un transfert partiel peut corrompre l'import si l'écriture commence trop tôt.

Réduction du risque :

- import uniquement après validation complète de tous les fragments

### Risque 4 - confusion entre cache PWA et données utilisateur

Le service worker peut accidentellement mettre en cache des artefacts métier.

Réduction du risque :

- limiter le cache aux assets statiques
- conserver les données utilisateur uniquement dans IndexedDB

### Risque 5 - limitations iOS PWA

Caméra, audio, plein écran et comportement en arrière-plan peuvent être plus limités qu'en natif.

Réduction du risque :

- documenter ces limites tôt
- valider manuellement sur Safari iOS dès le prompteur et le scan QR

## Première liste de fichiers à créer dans `pwa/`

```text
pwa/package.json
pwa/tsconfig.json
pwa/vite.config.ts
pwa/vitest.config.ts
pwa/index.html
pwa/public/manifest.webmanifest
pwa/src/main.tsx
pwa/src/app/App.tsx
pwa/src/app/router.tsx
pwa/src/app/providers.tsx
pwa/src/app/styles.css
pwa/src/db/db.ts
pwa/src/db/schema.ts
pwa/src/db/repositories/songsRepository.ts
pwa/src/db/repositories/setlistsRepository.ts
pwa/src/db/repositories/setlistSongsRepository.ts
pwa/src/lib/createId.ts
pwa/src/lib/now.ts
pwa/src/features/songs/
pwa/src/features/setlists/
pwa/src/features/prompter/
pwa/src/features/sync/
pwa/src/features/metronome/
pwa/src/services/importExport/
pwa/src/services/sync/
pwa/src/stores/
```

## Ce qu'il faut me fournir pour passer de la stratégie à l'implémentation

Le minimum utile :

- le vrai dépôt Expo de FaderZero
- ou au moins ces fichiers

Liste prioritaire :

- `package.json`
- l'arborescence `src/` ou `app/`
- le code SQLite
- le code de sync QR
- le code du prompteur
- les types ou modèles métier

## Recommandation immédiate

La prochaine étape la plus sûre est :

- soit ajouter ici le dépôt Expo réel pour lancer un audit précis
- soit me demander directement de créer le squelette `pwa/` dans ce workspace si vous voulez démarrer la migration même sans audit

