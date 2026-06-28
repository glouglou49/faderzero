# Supabase Reset & Bootstrap - FaderZero

Ce dossier contient les scripts SQL nécessaires pour réinitialiser et configurer l'instance Supabase self-hosted (`192.168.1.71`) pour FaderZero.

> [!WARNING]
> Cette procédure est destructive. Toutes les données des tables de FaderZero ainsi que le bucket de stockage audio associé seront supprimés.

## Ordre d'exécution des scripts SQL

Vous devez exécuter les scripts dans l'ordre suivant à l'aide du SQL Editor dans le tableau de bord Supabase (Studio) sur `http://192.168.1.71:54323` :

1. **`sql/00_reset_faderzero.sql`** : Supprime les tables, triggers et policies existants pour repartir de zéro.
2. **`sql/01_schema.sql`** : Crée les tables, les index et les triggers d'auto-incrémentation de version.
3. **`sql/02_rls.sql`** : Active la sécurité RLS et applique les règles d'accès restrictives par groupe/workspace.
4. **`sql/03_storage.sql`** : Crée le bucket audio privé `faderzero-audio` et applique les règles de sécurité associées.
5. **`sql/04_seed_minimal.sql`** : (Optionnel) Ajoute des données initiales minimales non destructives pour vos tests.

## Vérifications après réinitialisation

Une fois les scripts exécutés, assurez-vous de la conformité de l'installation :
1. Les tables métier (`profiles`, `workspaces`, `workspace_members`, `workspace_invites`, `songs`, `setlists`, `setlist_songs`, `song_assets`) doivent être créées dans le schéma `public`.
2. La sécurité RLS doit être marquée comme activée sur toutes ces tables.
3. Le bucket `faderzero-audio` doit exister dans Supabase Storage et être marqué comme **privé**.

## Configuration de la PWA

Pour savoir comment connecter la PWA à cette instance Supabase, configurer les variables d'environnement, gérer les conflits et téléverser des fichiers audio, consultez le guide complet de synchronisation : [SUPABASE_SYNC.md](../docs/SUPABASE_SYNC.md).
