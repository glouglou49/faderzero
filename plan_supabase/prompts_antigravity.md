# Prompts Antigravity par phase

## Mode d’emploi

Utilise **un prompt à la fois**, dans l’ordre.  
Chaque prompt est formulé pour qu’Antigravity exécute la phase sans redécider l’architecture.

Règles communes à rappeler à chaque exécution:

- Tu travailles dans `D:\App en dev\FaderZeroPWA`.
- Utilise systématiquement la skill 'supabase' et la skill 'supabase-postgres-best-practices' en lisant leurs fichiers SKILL.md respectifs.
- Ne modifie **aucun fichier dans `expo/`**.
- Toute nouvelle implémentation doit vivre dans `pwa/`.
- La PWA doit rester **offline-first**.
- Garde Dexie/IndexedDB comme source de vérité locale pour l’UI.
- La sync QR existante doit rester fonctionnelle tant qu’elle n’est pas explicitement remplacée.
- Utilise TypeScript strict.
- N’introduis pas de grosse abstraction inutile.
- À la fin de chaque phase:
  - liste les fichiers modifiés
  - exécute les tests pertinents si possible
  - indique clairement les risques restants

## Prompt 1 - Audit et préparation locale

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Lis AGENTS.md et .agents/rules/pwa-migration.md puis inspecte l’architecture actuelle de la PWA, en particulier:
- pwa/src/db/schema.ts
- pwa/src/db/db.ts
- pwa/src/db/repositories/*.ts
- pwa/src/features/sync/qrTransfer.ts

Objectif:
- confirmer les points d’intégration Supabase
- ne rien modifier dans expo/
- préparer la base technique sans casser l’existant

Exécute cette phase:
1. ajoute les dépendances minimales Supabase côté pwa avec versions pinées
2. crée un fichier pwa/.env.example avec:
   - VITE_SUPABASE_URL=
   - VITE_SUPABASE_ANON_KEY=
3. prépare une structure initiale pwa/src/services/supabase/ avec des fichiers vides ou des squelettes minimaux si utile
4. n’implémente pas encore la logique métier complète de sync

Contraintes:
- pas de service_role dans le frontend
- pas de modification dans expo/
- pas de refactor large

Livrables attendus:
- dépendances installées
- .env.example créé
- structure de services Supabase préparée
- build/typecheck si possible

À la fin:
- donne la liste des fichiers modifiés
- dis si le build/typecheck passe
- note les points bloquants éventuels
```

## Prompt 2 - Reset Supabase et bootstrap SQL

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
préparer tous les scripts et la documentation pour réinitialiser la couche FaderZero de l’instance Supabase self-hosted sur 192.168.1.71, sans toucher expo/.

Tu dois créer:
- pwa/supabase/README.md
- pwa/supabase/sql/00_reset_faderzero.sql
- pwa/supabase/sql/01_schema.sql
- pwa/supabase/sql/02_rls.sql
- pwa/supabase/sql/03_storage.sql
- pwa/supabase/sql/04_seed_minimal.sql

Consignes:
- le reset concerne uniquement FaderZero
- ne garde aucune donnée existante FaderZero
- n’écris pas de procédure qui détruit d’autres usages éventuels de l’instance

Le contenu attendu:
- 00_reset_faderzero.sql:
  - drop policies FaderZero si elles existent
  - drop tables FaderZero dans le bon ordre
  - drop fonctions auxiliaires FaderZero si besoin
  - documente clairement ce qui ne peut pas être supprimé en pur SQL
- 01_schema.sql:
  - crée profiles, workspaces, workspace_members, workspace_invites, songs, setlists, setlist_songs, song_assets
  - ajoute les indexes nécessaires
  - prévoit server_version, deleted_at, last_modified_by
- 02_rls.sql:
  - active RLS partout
  - policies par appartenance workspace
  - pas de auth.role()
  - pour update: USING + WITH CHECK
- 03_storage.sql:
  - crée le bucket privé audio
  - documente ou implémente les policies Storage cohérentes avec workspace membership
- 04_seed_minimal.sql:
  - seed minimal non destructif pour tests de base si pertinent
- README:
  - ordre exact d’exécution
  - avertissements destructifs
  - vérifications après reset
  - limites éventuelles du self-hosted

N’utilise pas encore de secrets réels.

À la fin:
- liste les fichiers créés/modifiés
- résume la procédure exacte d’exécution
- signale les points qui devront être vérifiés sur l’instance réelle 192.168.1.71
```

## Prompt 3 - Étendre le schéma local Dexie

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
faire évoluer le modèle local Dexie de la PWA pour préparer la sync Supabase, sans casser l’architecture offline-first ni l’existant QR.

Tu dois modifier la couche locale dans pwa/ pour:
- ajouter workspaceId aux entités synchronisées
- ajouter serverVersion
- ajouter syncStatus
- ajouter deletedAt sur SetlistSongRecord
- ajouter les stores:
  - songAssets
  - syncQueue
  - syncConflicts
  - syncState

Consignes:
- garde Dexie/IndexedDB comme source de vérité locale UI
- ne modifie rien dans expo/
- fais une nouvelle version Dexie avec migration robuste
- évite les abstractions inutiles

Attendu:
- mise à jour de pwa/src/db/schema.ts
- mise à jour de pwa/src/db/db.ts
- création des types:
  - SongAssetRecord
  - SyncQueueItem
  - SyncConflictRecord
  - SyncStateRecord
- ajout des indexes utiles à la sync
- adaptation des utilitaires/tests si nécessaire

Vérifications:
- les migrations Dexie doivent rester supportées
- les tests existants doivent être ajustés proprement

À la fin:
- liste les fichiers modifiés
- exécute les tests unitaires liés à db si possible
- résume les migrations introduites
```

## Prompt 4 - Client Supabase et mappers

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
ajouter une couche Supabase claire côté PWA sans brancher encore toute la sync complète.

Crée ou complète:
- pwa/src/services/supabase/client.ts
- pwa/src/services/supabase/mappers.ts
- pwa/src/services/supabase/auth.ts
- pwa/src/services/supabase/workspace.ts
- pwa/src/services/supabase/storage.ts
- pwa/src/services/supabase/realtime.ts
- pwa/src/services/supabase/sync.ts

Contraintes:
- uniquement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY côté frontend
- erreur claire si config absente
- aucune logique Supabase dans les composants React
- centralise tous les mappings local <-> remote

Mappings à couvrir:
- timestamptz <-> ms
- setlist_songs <-> setlistSongs
- duration_seconds <-> durationSeconds
- deleted_at <-> deletedAt
- server_version <-> serverVersion
- workspace_id <-> workspaceId

Attendu:
- singleton client Supabase navigateur
- helpers de mapping testables
- squelettes de services prêts à être utilisés par les phases suivantes

À la fin:
- liste les fichiers modifiés
- exécute typecheck si possible
- indique les contrats publics des services créés
```

## Prompt 5 - Auth et workspace actif

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
implémenter la connexion Supabase et la gestion du workspace actif dans la PWA.

À faire:
- implémenter auth email OTP / magic link
- fournir:
  - signInWithOtp(email)
  - signOut()
  - getSession()
  - onAuthStateChange()
- créer la logique de bootstrap:
  - upsert profile au premier login si nécessaire
  - création de workspace
  - ajout du créateur comme owner
- charger et conserver le workspace actif localement

UI minimale attendue:
- saisie email
- demande OTP / magic link
- état connecté/déconnecté
- création de workspace si aucun
- sélection de workspace si plusieurs

Contraintes:
- ne modifie rien dans expo/
- ne fais pas encore la sync métier complète dans cette phase
- garde la PWA mobile-first

À la fin:
- liste les fichiers modifiés
- exécute build/typecheck/tests pertinents si possible
- explique le flux utilisateur de connexion et de sélection de workspace
```

## Prompt 6 - Repositories locaux et sync queue

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
faire évoluer les repositories locaux pour qu’ils alimentent une file de synchronisation, tout en gardant Dexie comme point d’entrée unique de l’écriture métier.

Tu dois modifier:
- pwa/src/db/repositories/songsRepository.ts
- pwa/src/db/repositories/setlistsRepository.ts
- pwa/src/db/repositories/setlistSongsRepository.ts

Comportement attendu:
- toute création, mise à jour ou suppression logique:
  - écrit dans Dexie immédiatement
  - met syncStatus à pending
  - ajoute ou fusionne une entrée syncQueue
  - conserve baseServerVersion si dispo

Important:
- pour setlistSongs, passe à un modèle compatible soft delete
- ne laisse pas de suppression physique incompatible avec la future sync, sauf nécessité clairement documentée

Définis proprement SyncQueueItem:
- entityType
- entityId
- operation
- payload
- baseServerVersion
- status
- queuedAt
- lastTriedAt
- errorMessage

Ajoute ou adapte les tests unitaires des repositories.

À la fin:
- liste les fichiers modifiés
- exécute les tests repositories/db si possible
- explique comment la queue fusionne les mutations successives
```

## Prompt 7 - Moteur de sync push/pull/realtime

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
implémenter le moteur de synchronisation Supabase en gardant la PWA strictement local-first.

À implémenter:
- pushPendingMutations(workspaceId)
- pullRemoteChanges(workspaceId)
- subscribeToWorkspaceChanges(workspaceId)

Règles:
- Dexie reste la source de vérité UI
- les événements realtime ne doivent pas écrire directement dans Dexie
- ils déclenchent un pull ciblé ou débouncé

Push:
- traite syncQueue
- envoie les mutations vers Supabase
- récupère la version distante canonique au succès
- met à jour Dexie avec la version canonique
- passe syncStatus à synced

Conflits:
- compare baseServerVersion à server_version distant
- si mismatch:
  - ne pas écraser
  - marquer conflict
  - stocker snapshot local et snapshot distant dans syncConflicts

Pull:
- pull incrémental par checkpoint
- tables:
  - songs
  - setlists
  - setlist_songs
  - song_assets
- respecter deleted_at

Déclencheurs:
- après login
- après retour réseau
- après écriture locale utile
- après événement realtime
- bouton manuel dans l’écran Sync

Ajoute les tests les plus critiques pour push/pull/conflits.

À la fin:
- liste les fichiers modifiés
- exécute les tests de sync/typecheck si possible
- explique comment tu évites les boucles et les écrasements silencieux
```

## Prompt 8 - Audio assets Storage

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
ajouter la gestion des fichiers audio .mp3/.wav via Supabase Storage, avec métadonnées synchronisées et lecture en streaming.

À faire:
- implémenter SongAssetRecord local + mapping distant song_assets
- implémenter uploadSongAsset(songId, file)
- implémenter getSongAssetPlaybackUrl(assetId)
- intégrer la suppression logique des assets

Règles:
- les blobs audio ne vont pas dans Postgres
- pas de cache offline audio durable en V1
- utiliser le bucket privé prévu pour l’audio
- chemin standard:
  - workspaces/{workspaceId}/songs/{songId}/{assetId}.{ext}

UI minimale:
- depuis l’écran de détail d’un morceau ou zone équivalente:
  - upload d’un fichier audio
  - liste des assets
  - bouton de lecture

Veille à garder un état cohérent si upload ou écriture métadonnée échoue.

À la fin:
- liste les fichiers modifiés
- exécute les tests/typecheck possibles
- explique le flux upload -> metadata -> playback
```

## Prompt 9 - UI de sync et polissage intégration

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
exposer proprement dans l’UI la nouvelle couche Supabase sans casser la sync QR existante.

À faire:
- étendre la page Sync existante ou ajouter une section dédiée pour montrer:
  - état de connexion
  - workspace actif
  - dernier push
  - dernier pull
  - nombre d’éléments pending
  - erreurs
  - conflits
  - bouton de sync manuelle
- garder la sync QR visible et distincte
- garder une UX mobile-first claire

Ne fais pas de refonte complète de design si ce n’est pas nécessaire.
Le but est un écran fonctionnel, lisible et robuste.

À la fin:
- liste les fichiers modifiés
- exécute build/typecheck/tests pertinents si possible
- décris ce que l’utilisateur peut maintenant faire depuis l’écran Sync
```

## Prompt 10 - Stabilisation, tests et documentation finale

```text
Travaille dans D:\App en dev\FaderZeroPWA.

Objectif:
finaliser l’intégration Supabase PWA avec vérifications, tests, documentation et nettoyage raisonnable.

À faire:
- revoir les erreurs TypeScript, imports, contrats de services
- compléter les tests manquants les plus importants
- vérifier que la sync QR fonctionne encore
- documenter la procédure d’installation/configuration locale
- documenter la procédure de reset et bootstrap Supabase
- documenter les limites restantes de V1

Checklist de validation minimale:
- expo/ intact
- build OK
- typecheck OK
- tests clés OK ou écarts explicitement documentés
- auth OK
- workspace OK
- sync queue OK
- push/pull/realtime OK
- audio upload/playback OK
- QR sync toujours présente

Livrables:
- code final propre
- documentation d’exploitation
- résumé clair des risques restants

À la fin:
- liste tous les fichiers modifiés
- donne les commandes à lancer
- dresse la liste des risques ou TODO restants
```
