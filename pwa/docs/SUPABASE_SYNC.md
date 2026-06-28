# Synchronisation Cloud Supabase - Documentation Technique & Exploitation (V1)

Ce document décrit le fonctionnement, la configuration et l'exploitation de la synchronisation cloud Supabase pour la PWA FaderZero.

---

## 1. Variables d'Environnement
Pour connecter la PWA à votre instance Supabase, vous devez renseigner les variables d'environnement suivantes dans `pwa/.env` (à copier depuis `pwa/.env.example`) :

```env
VITE_SUPABASE_URL=http://192.168.1.71:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

* **VITE_SUPABASE_URL** : L'URL de la passerelle Kong API de votre instance Supabase self-hosted (ex: `http://192.168.1.71:54321`).
* **VITE_SUPABASE_ANON_KEY** : La clé "anon" publique de votre instance Supabase (permet l'accès authentifié et l'application des règles RLS).

Note de développement local : si `VITE_SUPABASE_URL` utilise `http://`, le serveur Vite de la PWA désactive automatiquement son HTTPS local pour éviter le blocage navigateur "mixed content" (`https` app -> `http` API).

---

## 2. Procédure de Reset & Bootstrap Database
Pour réinitialiser complètement l'environnement de base de données FaderZero sur votre instance self-hosted :

1. Ouvrez l'interface **Supabase Studio** à l'adresse `http://192.168.1.71:54323`.
2. Accédez à l'éditeur SQL (**SQL Editor**).
3. Exécutez dans l'ordre les scripts situés dans `pwa/supabase/sql/` :
   - **`00_reset_faderzero.sql`** : Nettoie les tables, triggers et structures de données existantes.
   - **`01_schema.sql`** : Crée les tables métier, la séquence globale de version (`global_server_version_seq`), les triggers de modification temporelle et le trigger de profil utilisateur automatique.
   - **`02_rls.sql`** : Active la sécurité RLS sur toutes les tables et crée les politiques par groupe/workspace pour cloisonner les données.
   - **`03_storage.sql`** : Crée le bucket de stockage audio privé `faderzero-audio` et configure ses règles de lecture/écriture.
   - **`04_seed_minimal.sql`** : (Optionnel) Ajoute des données de démonstration minimales rattachées à votre premier utilisateur.

---

## 3. Fonctionnement Technique du Moteur de Sync

Le moteur de synchronisation est conçu pour être **strictement local-first** et résilient hors ligne.

```
+-------------+                    +------------------+
| Écritures   | -- (immédiat) -->  | Base Dexie locale|
| Application |                    +------------------+
+-------------+                             |
                                   (crée mutation)
                                            v
                                   +------------------+
                                   |    syncQueue     |
                                   +------------------+
                                            |
                                  pushPendingMutations()
                                            v
                                   +------------------+
                                   | Supabase Remote  |
                                   +------------------+
```

### A. Push (Local -> Supabase)
Toutes les modifications locales (créations, mises à jour, suppressions logiques) sont écrites instantanément dans Dexie avec le statut `syncStatus = 'pending'`, et enfilées dans `syncQueue`.
- **Fusion intelligente** : Les mutations successives hors ligne sur un même objet sont fusionnées en queue pour minimiser les échanges (ex: plusieurs updates sont combinés ; une création suivie d'une suppression locale s'annulent mutuellement).
- **Détection des conflits** : Lors de l'envoi d'une modification, le moteur compare la version de référence locale (`baseServerVersion`) avec celle présente sur le serveur (`server_version`). S'il y a divergence, la synchronisation est mise en attente, le statut passe à `'conflict'` et une alerte de conflit est créée.

### B. Pull (Supabase -> Local)
Le pull interroge de manière incrémentale les tables distantes en demandant les lignes ayant une version supérieure au dernier checkpoint local (`lastPulledVersion` de la table).
- **Règle Local-First (Non-écrasement)** : Si un enregistrement distant reçu a un statut local `'pending'` ou `'conflict'`, le pull l'ignore et ne l'écrase pas. Le conflit sera résolu lors du push.

### C. Temps Réel & Évitement de boucles
Le client s'abonne à Supabase Realtime via WebSocket pour écouter les modifications distantes.
- **Filtrage de l'auteur** : Le client vérifie le champ `last_modified_by` de la notification. Si c'est l'utilisateur connecté lui-même qui a initié le changement, l'événement est ignoré.
- **Checkpoints dynamiques** : Le checkpoint local est avancé immédiatement après un push réussi pour s'assurer qu'un pull subséquent ne récupère pas inutilement la ligne que l'on vient de pousser.

---

## 4. Gestion des Conflits

Lorsqu'un conflit est détecté, l'utilisateur a le choix dans l'écran de synchronisation :
1. **Garder ma version (Local Wins)** : Le client remet le statut local à `'pending'` et met à jour la mutation bloquée avec le numéro de version actuel du serveur. Lors du prochain push, le serveur acceptera l'écriture et écrasera sa propre version.
2. **Garder la version du groupe (Remote Wins)** : Le client écrase l'enregistrement Dexie avec le snapshot distant récupéré lors du conflit, et supprime la mutation locale bloquée.

---

## 5. Stockage des Audio Assets
- Les fichiers binaires volumineux ne sont jamais insérés dans la base Postgres. Ils sont versés sur Supabase Storage.
- Chemin standardisé : `workspaces/{workspaceId}/songs/{songId}/{assetId}.{ext}`.
- La lecture s'effectue en streaming via des URL signées de courte durée (valables 1 heure) générées par la méthode `getSongAssetPlaybackUrl`.
- **Limite technique de la V1** : Les fichiers audio ne sont pas mis en cache hors ligne pour le moment. Ils nécessitent une connexion active pour être lus.

---

## 6. Coexistence avec la Sync QR Code
- La synchronisation Cloud (Supabase) et la synchronisation locale par QR Code coexistent sur le même écran de manière totalement isolée.
- La synchronisation QR code n'altère pas la configuration Supabase et importe les chansons et setlists directement dans IndexedDB en attribuant le workspace actif ou le workspace par défaut.
