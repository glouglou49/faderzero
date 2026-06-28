# Implémentation Supabase self-hosted pour FaderZero PWA

## Résumé

Objectif: brancher la PWA `pwa/` sur une instance **Supabase self-hosted** située sur `192.168.1.71`, en conservant l’architecture **offline-first** déjà en place.

Contraintes non négociables:

- ne **rien modifier dans `expo/`**
- toute l’implémentation vit dans `pwa/`
- **Dexie/IndexedDB reste la source de vérité UI locale**
- Supabase sert de backend externe pour:
  - authentification
  - partage par groupe
  - synchronisation réseau
  - stockage audio `.mp3` / `.wav`
- la base Supabase existante doit être **réinitialisée côté app FaderZero** avant mise en place
- on ne garde **aucune donnée existante**
- V1:
  - **login obligatoire**
  - données **partagées par workspace/groupe**
  - sync **local-first + realtime**
  - audio en **streaming depuis Storage**
  - **pas de cache offline audio**
- la sync QR actuelle de la PWA doit rester fonctionnelle tant qu’elle n’est pas explicitement remplacée

## Phase 1. Audit technique local et préparation

### 1.1 Lire et respecter l’existant

- Lire les règles:
  - `AGENTS.md`
  - `.agents/rules/pwa-migration.md`
- Inspecter l’existant PWA pour ne pas casser le modèle local:
  - `pwa/src/db/schema.ts`
  - `pwa/src/db/db.ts`
  - `pwa/src/db/repositories/*.ts`
  - `pwa/src/features/sync/qrTransfer.ts`
- Conserver les noms métiers actuels quand c’est pertinent:
  - `songs`
  - `setlists`
  - `setlistSongs`
  - `sync`
  - `prompter`

### 1.2 Préparer les dépendances côté PWA

- Ajouter les packages Supabase nécessaires dans `pwa/` avec versions pinées:
  - `@supabase/supabase-js`
- Ne pas introduire d’abstraction excessive.
- Garder TypeScript strict.

### 1.3 Préparer la configuration d’environnement

Créer un modèle de config PWA pour Supabase, sans secrets côté repo:

- `pwa/.env.example` avec:
  - `VITE_SUPABASE_URL=`
  - `VITE_SUPABASE_ANON_KEY=`
- Le client frontend ne doit utiliser **que** la clé publique.
- Ne jamais exposer de `service_role` dans la PWA.

## Phase 2. Réinitialisation de l’instance Supabase sur `192.168.1.71`

### 2.1 Cadrage du reset

Le reset concerne **FaderZero uniquement**:

- suppression des tables métier FaderZero si elles existent
- suppression des policies RLS FaderZero
- suppression des buckets Storage FaderZero
- suppression des objets audio FaderZero

Ne pas toucher d’autres usages éventuels de l’instance s’ils existent.

### 2.2 Livrables de reset à produire dans le repo

Créer une arborescence Supabase côté `pwa/` ou racine projet, mais sans toucher `expo/`. Recommandation:

- `pwa/supabase/README.md`
- `pwa/supabase/sql/00_reset_faderzero.sql`
- `pwa/supabase/sql/01_schema.sql`
- `pwa/supabase/sql/02_rls.sql`
- `pwa/supabase/sql/03_storage.sql`
- `pwa/supabase/sql/04_seed_minimal.sql`

Le script `00_reset_faderzero.sql` doit:

- supprimer les policies des tables FaderZero si elles existent
- supprimer les tables FaderZero dans le bon ordre
- supprimer les éventuelles fonctions auxiliaires FaderZero
- supprimer ou vider les buckets FaderZero si gérable par SQL ou documenter la commande d’admin à lancer séparément

Le README doit documenter:

- l’ordre exact d’exécution
- ce qui est destructif
- les prérequis d’accès au serveur `192.168.1.71`
- comment vérifier qu’on repart d’un état vide

### 2.3 Vérification attendue après reset

Documenter une checklist claire:

- aucune table métier FaderZero restante
- aucun objet audio FaderZero restant
- aucun bucket audio FaderZero actif sans être recréé proprement
- aucune policy héritée de l’ancien setup

## Phase 3. Schéma Supabase cible

### 3.1 Principes de modélisation

Le backend distant doit refléter le métier actuel local, mais avec support multi-membres:

- toutes les tables métier partagées portent `workspace_id`
- soft delete partout où nécessaire
- version serveur explicite pour la sync
- audit minimal de qui a modifié

### 3.2 Tables à créer

Créer les tables suivantes.

#### `profiles`

Usage: profil applicatif rattaché à `auth.users`

Champs minimum:

- `id uuid primary key` référencé sur `auth.users.id`
- `display_name text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `workspaces`

Usage: groupe partagé

Champs minimum:

- `id uuid primary key`
- `name text not null`
- `created_by uuid not null`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `workspace_members`

Usage: appartenance utilisateur-groupe

Champs minimum:

- `id uuid primary key`
- `workspace_id uuid not null`
- `user_id uuid not null`
- `role text not null`
- `created_at timestamptz`
- `updated_at timestamptz`

Contraintes:

- unicité sur `(workspace_id, user_id)`
- `role` borné à un petit ensemble explicite, par exemple:
  - `owner`
  - `member`

#### `workspace_invites`

Usage: invitation simple V1

Champs minimum:

- `id uuid primary key`
- `workspace_id uuid not null`
- `email text not null`
- `token text not null unique`
- `status text not null`
- `created_by uuid not null`
- `expires_at timestamptz nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `songs`

Champs minimum:

- `id text primary key`
- `workspace_id uuid not null`
- `title text not null`
- `artist text nullable`
- `lyrics text not null default ''`
- `key text nullable`
- `bpm integer nullable`
- `status text not null`
- `duration_seconds integer not null default 0`
- `notes text nullable`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz nullable`
- `server_version bigint not null default 1`
- `last_modified_by uuid nullable`

Conserver les IDs texte côté métier pour rester compatible avec Dexie et la sync existante.

#### `setlists`

Champs minimum:

- `id text primary key`
- `workspace_id uuid not null`
- `name text not null`
- `date text nullable`
- `notes text nullable`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz nullable`
- `server_version bigint not null default 1`
- `last_modified_by uuid nullable`

#### `setlist_songs`

Important: utiliser le nom SQL `setlist_songs`, tout en gardant les noms métier `setlistSongs` dans le code si nécessaire.

Champs minimum:

- `id text primary key`
- `workspace_id uuid not null`
- `setlist_id text not null`
- `song_id text not null`
- `position integer not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz nullable`
- `server_version bigint not null default 1`
- `last_modified_by uuid nullable`

Ne pas imposer d’unicité sur `(setlist_id, song_id)` pour permettre un même morceau plusieurs fois dans une setlist.

#### `song_assets`

Champs minimum:

- `id text primary key`
- `workspace_id uuid not null`
- `song_id text not null`
- `storage_path text not null unique`
- `filename text not null`
- `mime_type text not null`
- `size_bytes bigint not null`
- `duration_seconds integer nullable`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz nullable`
- `server_version bigint not null default 1`
- `last_modified_by uuid nullable`

### 3.3 Indexes à créer

Créer au minimum:

- `songs(workspace_id, updated_at)`
- `songs(workspace_id, deleted_at)`
- `setlists(workspace_id, updated_at)`
- `setlists(workspace_id, deleted_at)`
- `setlist_songs(workspace_id, setlist_id, position)`
- `setlist_songs(workspace_id, updated_at)`
- `song_assets(workspace_id, song_id)`
- `song_assets(workspace_id, updated_at)`
- `workspace_members(workspace_id, user_id) unique`

### 3.4 Convention serveur pour `server_version`

À chaque insert/update/soft delete d’une ligne métier:

- incrémenter `server_version`
- mettre à jour `updated_at`
- renseigner `last_modified_by` avec l’utilisateur courant si disponible

Faire cela via logique SQL simple ou côté app si vraiment nécessaire, mais préférence à une logique cohérente centralisée côté base.

## Phase 4. Sécurité et RLS

### 4.1 Exigences générales

- activer RLS sur **toutes** les tables exposées
- ne jamais utiliser `auth.role()`
- écrire des policies avec `TO authenticated`
- toujours combiner rôle + prédicat d’appartenance au workspace
- si une update est autorisée:
  - prévoir `USING`
  - prévoir `WITH CHECK`

### 4.2 Modèle de contrôle d’accès

Principe:

- un utilisateur connecté peut agir seulement dans les workspaces dont il est membre

Appliquer ce modèle sur:

- `workspaces`
- `workspace_members`
- `workspace_invites`
- `songs`
- `setlists`
- `setlist_songs`
- `song_assets`

### 4.3 Storage

Créer un bucket privé dédié, par exemple:

- `faderzero-audio`

Arborescence objet:

- `workspaces/{workspaceId}/songs/{songId}/{assetId}.{ext}`

Policies Storage:

- lecture autorisée si l’utilisateur est membre du workspace extrait du chemin
- écriture autorisée si l’utilisateur est membre du workspace extrait du chemin
- suppression autorisée au minimum pour les owners, ou pour tout membre si on veut rester simple en V1
- garder cette règle cohérente avec `song_assets`

Si le parsing du chemin en policy devient trop fragile, documenter une convention stricte et l’implémenter des deux côtés.

## Phase 5. Extension du schéma local Dexie

### 5.1 Évolution des types métier

Modifier `pwa/src/db/schema.ts` pour ajouter:

- `workspaceId: string` sur toutes les entités synchronisées
- `serverVersion?: number`
- `syncStatus?: 'synced' | 'pending' | 'conflict'`
- `deletedAt?: number` aussi sur `SetlistSongRecord`

Créer de nouveaux types:

- `SongAssetRecord`
- `SyncQueueItem`
- `SyncConflictRecord`
- `SyncStateRecord`

### 5.2 Évolution de Dexie

Modifier `pwa/src/db/db.ts` avec une nouvelle version Dexie.

Ajouter les stores:

- `songAssets`
- `syncQueue`
- `syncConflicts`
- `syncState`

Conserver les stores existants:

- `songs`
- `setlists`
- `setlistSongs`

Prévoir une migration Dexie qui:

- ajoute `workspaceId` si absent avec une valeur temporaire vide ou sentinelle
- ajoute `serverVersion` par défaut
- ajoute `syncStatus`
- ajoute `deletedAt` à `setlistSongs`
- prépare les nouveaux stores

Important:
- ne pas casser les tests existants
- la migration doit rester robuste sur des bases déjà créées en local

### 5.3 Indexes Dexie à ajouter

Ajouter des indexes utiles pour sync:

- sur `songs`: `workspaceId`, `updatedAt`, `deletedAt`, `syncStatus`
- sur `setlists`: `workspaceId`, `updatedAt`, `deletedAt`, `syncStatus`
- sur `setlistSongs`: `workspaceId`, `setlistId`, `[setlistId+position]`, `updatedAt`, `deletedAt`, `syncStatus`
- sur `songAssets`: `workspaceId`, `songId`, `updatedAt`, `deletedAt`, `syncStatus`
- sur `syncQueue`: `status`, `queuedAt`, `entityType`, `entityId`

## Phase 6. Client Supabase côté PWA

### 6.1 Fichiers à créer

Créer une couche dédiée, par exemple sous `pwa/src/services/supabase/`:

- `client.ts`
- `auth.ts`
- `workspace.ts`
- `sync.ts`
- `realtime.ts`
- `storage.ts`
- `mappers.ts`

### 6.2 `client.ts`

Créer un singleton Supabase browser client à partir de:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ne pas masquer les erreurs de configuration:
- si variable manquante, erreur claire

### 6.3 Mappers local <-> remote

Centraliser les conversions:

- timestamps Supabase `timestamptz` <-> nombres locaux en ms
- `setlist_songs` SQL <-> `setlistSongs` TS
- `duration_seconds` <-> `durationSeconds`
- `deleted_at` <-> `deletedAt`
- `server_version` <-> `serverVersion`
- `workspace_id` <-> `workspaceId`

Ne pas dupliquer ces conversions dans les composants ou repositories.

## Phase 7. Authentification et workspace actif

### 7.1 Auth V1

Implémenter une auth email OTP / magic link.

Fonctions attendues:

- `signInWithOtp(email)`
- `signOut()`
- `getSession()`
- `onAuthStateChange()`

### 7.2 Workspace actif

Au login:

- charger la liste des workspaces du user
- si un seul workspace:
  - le sélectionner automatiquement
- si plusieurs:
  - exposer un sélecteur simple
- si aucun:
  - permettre de créer un workspace

Le workspace actif doit être conservé localement dans un store applicatif léger.

### 7.3 Bootstrap utilisateur

Prévoir la logique minimale:

- à la première connexion, créer ou upsert `profiles`
- permettre la création d’un workspace initial
- ajouter le créateur comme `owner` dans `workspace_members`

## Phase 8. Repositories locaux et file de sync

### 8.1 Principe général

Les repositories Dexie restent le point d’entrée de l’écriture métier.  
Ne pas faire écrire les composants directement dans Supabase.

Chaque create/update/delete local doit:

- écrire dans Dexie immédiatement
- mettre `syncStatus = 'pending'`
- ajouter ou mettre à jour une entrée `syncQueue`
- conserver `serverVersion` courant si disponible comme `baseServerVersion`

### 8.2 Évolution des repositories existants

Mettre à jour:

- `songsRepository`
- `setlistsRepository`
- `setlistSongsRepository`

Comportement attendu:

- `create`:
  - génère l’entité locale
  - renseigne `workspaceId`
  - `syncStatus = 'pending'`
  - ajoute une mutation `create`
- `update`:
  - modifie localement
  - `syncStatus = 'pending'`
  - ajoute une mutation `update`
- `softDelete`:
  - marque `deletedAt`
  - `syncStatus = 'pending'`
  - ajoute une mutation `soft_delete`

Pour `setlistSongs`, remplacer la suppression physique locale par un soft delete compatible sync, ou documenter clairement toute suppression physique résiduelle si elle est strictement nécessaire. La recommandation est de passer en soft delete ici aussi.

### 8.3 Structure de `syncQueue`

Définir un type explicite, par exemple:

- `id`
- `workspaceId`
- `entityType` parmi:
  - `song`
  - `setlist`
  - `setlistSong`
  - `songAsset`
- `entityId`
- `operation` parmi:
  - `create`
  - `update`
  - `soft_delete`
- `payload`
- `baseServerVersion nullable`
- `status` parmi:
  - `pending`
  - `processing`
  - `failed`
  - `conflict`
- `queuedAt`
- `lastTriedAt nullable`
- `errorMessage nullable`

Si plusieurs updates successifs arrivent sur la même entité non encore syncée:
- fusionner intelligemment la queue autant que possible au lieu d’empiler inutilement

## Phase 9. Moteur de synchronisation

### 9.1 Règle d’or

La PWA reste **local-first**:

- l’utilisateur interagit toujours avec Dexie
- Supabase n’est jamais la source directe de rendu des écrans métier

### 9.2 Push

Implémenter `pushPendingMutations(workspaceId)`.

Comportement:

- traiter la queue par ordre FIFO raisonnable
- pour chaque mutation:
  - lire l’état local courant
  - mapper vers le schéma Supabase
  - exécuter insert/upsert/update distant
- lors du succès:
  - récupérer la ligne distante canonique
  - la remapper en local
  - écrire la version canonique dans Dexie
  - marquer `syncStatus = 'synced'`
  - supprimer ou clôturer l’entrée de queue

### 9.3 Détection de conflit

Pour chaque update/delete:

- comparer `baseServerVersion` à la `server_version` distante
- si mismatch:
  - ne pas écraser silencieusement
  - marquer l’entrée de queue en `conflict`
  - stocker un enregistrement dans `syncConflicts` avec:
    - snapshot local
    - snapshot distant
    - type d’entité
    - entityId
    - detectedAt

En V1, ne pas implémenter de merge automatique complexe.  
La version distante est la référence partagée, et le conflit doit être visible à l’utilisateur.

### 9.4 Pull incrémental

Implémenter `pullRemoteChanges(workspaceId)`.

Principe:

- conserver un checkpoint local par table
- récupérer les lignes modifiées depuis le dernier checkpoint
- upsert en local les versions distantes
- avancer le checkpoint seulement après succès complet

Tables concernées:

- `songs`
- `setlists`
- `setlist_songs`
- `song_assets`

Le pull doit respecter les soft deletes:
- une ligne distante avec `deleted_at` doit être répercutée localement, pas ignorée

### 9.5 Realtime

Implémenter `subscribeToWorkspaceChanges(workspaceId)`.

Principe:

- s’abonner aux changements des tables métier du workspace
- à réception d’un événement:
  - ne pas muter Dexie directement depuis le payload realtime
  - déclencher un pull ciblé ou un pull incrémental débouncé

Éviter les boucles:
- une mutation poussée localement ne doit pas générer un cycle infini de retraitement

### 9.6 Déclenchement de sync

Déclencher la sync:

- après login et chargement du workspace actif
- quand le réseau redevient disponible
- après certaines écritures locales
- après réception d’un événement realtime
- manuellement depuis l’écran Sync

## Phase 10. Gestion des assets audio

### 10.1 Métadonnées locales et distantes

Créer `SongAssetRecord` en local et synchroniser vers `song_assets`.

Champs locaux recommandés:

- `id`
- `workspaceId`
- `songId`
- `storagePath`
- `filename`
- `mimeType`
- `sizeBytes`
- `durationSeconds?`
- `createdAt`
- `updatedAt`
- `deletedAt?`
- `serverVersion?`
- `syncStatus?`

### 10.2 Upload

Implémenter `uploadSongAsset(songId, file)`.

Comportement:

- vérifier le workspace actif
- créer un `assetId`
- construire `storagePath`
- uploader dans le bucket privé
- écrire la métadonnée locale et distante
- marquer `syncStatus = 'synced'` au succès
- en cas d’échec, ne pas laisser d’état incohérent silencieux

### 10.3 Lecture

Implémenter `getSongAssetPlaybackUrl(assetId)`.

Comportement:

- récupérer l’asset
- demander une URL signée de lecture
- la renvoyer au lecteur audio

V1:
- pas de préchargement massif
- pas de téléchargement offline durable des audios

### 10.4 Suppression

Supprimer un asset doit:

- soft-delete la métadonnée `song_assets`
- supprimer l’objet Storage si la politique choisie le permet immédiatement, ou documenter un nettoyage différé

Choix recommandé V1:
- suppression logique d’abord
- suppression Storage immédiate si simple et fiable
- sinon laisser une note explicite sur le ménage ultérieur

## Phase 11. UI minimale à ajouter

### 11.1 Auth

Ajouter les écrans ou composants minimaux pour:

- saisie email
- demande OTP / magic link
- état connecté / déconnecté
- déconnexion

### 11.2 Workspace

Ajouter UI minimale pour:

- créer un workspace
- afficher le workspace actif
- changer de workspace si plusieurs

### 11.3 Sync

Étendre l’écran existant `SyncPage` ou ajouter une section dédiée pour afficher:

- statut connexion
- dernier push
- dernier pull
- nombre d’éléments en attente
- erreurs de sync
- conflits détectés
- bouton de sync manuelle

La sync QR actuelle doit rester accessible et distincte de la sync Supabase.

### 11.4 Audio

Ajouter une intégration minimale côté song detail ou équivalent:

- upload d’un fichier audio
- liste des assets associés au morceau
- bouton de lecture

Ne pas chercher un design final ambitieux à ce stade; viser un flux fonctionnel testé.

## Phase 12. Tests

### 12.1 Tests unitaires locaux

Étendre les tests existants pour couvrir:

- migration Dexie
- création des entités avec `workspaceId`
- queue `pending`
- soft delete de `setlistSongs`
- mapping local <-> remote

### 12.2 Tests du moteur de sync

Ajouter des tests pour:

- push de création song
- push d’update song
- push de soft delete
- pull incrémental
- conflit de `serverVersion`
- application correcte des soft deletes distants
- réception realtime suivie d’un pull

### 12.3 Tests audio

Tester:

- création de métadonnée asset
- mapping Storage path
- erreurs d’upload
- récupération URL signée

### 12.4 Vérifications manuelles

Prévoir une checklist manuelle:

- login avec 2 comptes
- création d’un workspace
- rejoindre un workspace partagé
- appareil A crée/modifie un morceau
- appareil B voit la mise à jour après sync/realtime
- offline local puis reconnexion
- conflit volontaire sur la même song depuis 2 appareils
- upload et lecture d’un `.mp3` ou `.wav`
- la sync QR continue de marcher

## Phase 13. Fichiers attendus

Sans imposer exactement chaque nom, le résultat doit au minimum toucher:

- config env PWA
- client Supabase
- services auth/workspace/sync/realtime/storage
- schéma Dexie et types
- repositories existants
- UI auth/workspace/sync/audio
- tests
- scripts SQL de reset/bootstrap Supabase
- documentation d’exploitation

Chemins probables:

- `pwa/src/db/schema.ts`
- `pwa/src/db/db.ts`
- `pwa/src/db/repositories/*.ts`
- `pwa/src/features/sync/*`
- `pwa/src/features/songs/*`
- `pwa/src/services/supabase/*`
- `pwa/supabase/sql/*`
- `pwa/.env.example`

## Critères d’acceptation

Le travail est considéré terminé si:

- `expo/` est intact
- la PWA build et typecheck
- le schéma local supporte workspace + sync queue + conflicts + song assets
- l’instance Supabase FaderZero peut être reset proprement
- les tables distantes, RLS et Storage sont recréés proprement
- un utilisateur peut se connecter
- un workspace peut être créé et utilisé
- `songs`, `setlists`, `setlistSongs` se synchronisent entre au moins 2 clients
- les conflits ne sont pas écrasés silencieusement
- un fichier audio peut être uploadé et lu
- la sync QR existante fonctionne encore
- les tests ajoutés passent, ou les écarts restants sont explicitement documentés

## Hypothèses à appliquer sans redécision

- ne pas migrer Expo
- ne pas implémenter de backend custom hors Supabase
- ne pas mettre d’audio métier en cache offline en V1
- ne pas faire de merge automatique complexe de conflits
- ne pas remplacer la sync QR tant que cela n’est pas demandé
- garder les IDs texte métier existants pour `songs`, `setlists`, `setlistSongs`, `song_assets`
- utiliser `setlist_songs` côté SQL et mapper proprement côté TypeScript

## Ordre d’exécution recommandé

1. Préparer config PWA et dépendances.
2. Produire les scripts SQL de reset + bootstrap.
3. Mettre en place schéma Supabase + RLS + Storage.
4. Étendre les types et Dexie.
5. Ajouter le client Supabase et les mappers.
6. Implémenter auth + workspace.
7. Faire évoluer les repositories pour alimenter la sync queue.
8. Implémenter push/pull/realtime.
9. Ajouter `song_assets` + upload/lecture audio.
10. Étendre l’UI Sync et l’UI minimale auth/workspace/audio.
11. Ajouter et exécuter les tests.
12. Documenter clairement la procédure de reset et les limites restantes.
