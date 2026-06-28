import { supabase } from './client';
import { db } from '@/db/db';
import { now } from '@/lib/now';
import type { SyncQueueItem } from '@/db/schema';
import {
  toDbSong,
  toLocalSong,
  toDbSetlist,
  toLocalSetlist,
  toDbSetlistSong,
  toLocalSetlistSong,
  toDbSongAsset,
  toLocalSongAsset,
} from './mappers';

// ---------------------------------------------------------------------
// CONFIGURATION DES ENTITÉS SYNCHRONISÉES
// ---------------------------------------------------------------------

const ENTITY_CONFIGS = {
  song: {
    dbTable: 'songs',
    localTable: 'songs',
    toDb: toDbSong,
    toLocal: toLocalSong,
  },
  setlist: {
    dbTable: 'setlists',
    localTable: 'setlists',
    toDb: toDbSetlist,
    toLocal: toLocalSetlist,
  },
  setlistSong: {
    dbTable: 'setlist_songs',
    localTable: 'setlistSongs',
    toDb: toDbSetlistSong,
    toLocal: toLocalSetlistSong,
  },
  songAsset: {
    dbTable: 'song_assets',
    localTable: 'songAssets',
    toDb: toDbSongAsset,
    toLocal: toLocalSongAsset,
  },
} as const;

// ---------------------------------------------------------------------
// MOTEUR PUSH (MUTATIONS LOCALES -> SUPABASE)
// ---------------------------------------------------------------------

export async function pushPendingMutations(workspaceId: string): Promise<void> {
  // Récupérer toutes les mutations en attente (pending ou failed) dans l'ordre FIFO
  const mutations = await db.syncQueue
    .where('workspaceId')
    .equals(workspaceId)
    .filter((item) => item.status === 'pending' || item.status === 'failed')
    .toArray();

  mutations.sort((a, b) => a.queuedAt - b.queuedAt);

  for (const mutation of mutations) {
    const config = ENTITY_CONFIGS[mutation.entityType];
    if (!config) continue;

    // Passage en cours de traitement
    await db.syncQueue.update(mutation.id!, { status: 'processing' });

    try {
      if (mutation.operation === 'create') {
        // CREATION : Insertion directe dans Supabase
        const { data: remoteRow, error: insertError } = await supabase
          .from(config.dbTable)
          .insert({
            ...mutation.payload,
            workspace_id: workspaceId,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Mise à jour de Dexie avec la version canonique du serveur
        const localRecord = config.toLocal(remoteRow);
        await db.table(config.localTable).put(localRecord);

        // Suppression de la mutation de la queue
        await db.syncQueue.delete(mutation.id!);

        // Avancer le checkpoint local pour cette table pour éviter de la re-puller
        await updateStateCheckpoint(workspaceId, config.localTable, Number(remoteRow.server_version));
      } else {
        // UPDATE ou SOFT_DELETE : Vérification de conflits via server_version
        const { data: remoteRow, error: fetchError } = await supabase
          .from(config.dbTable)
          .select('*')
          .eq('id', mutation.entityId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!remoteRow) {
          // L'objet n'existe pas sur le serveur (suppression externe ou erreur)
          // On marque le conflit
          await handleConflict(workspaceId, mutation, null);
          continue;
        }

        // Vérification de version : conflit si mismatch de version de base
        const serverVersion = Number(remoteRow.server_version);
        if (mutation.baseServerVersion !== undefined && mutation.baseServerVersion !== serverVersion) {
          await handleConflict(workspaceId, mutation, config.toLocal(remoteRow));
          continue;
        }

        // Pas de conflit : exécution de l'update/delete sur Supabase
        const { data: updatedRow, error: updateError } = await supabase
          .from(config.dbTable)
          .update(mutation.payload)
          .eq('id', mutation.entityId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Mise à jour locale avec les données distantes actualisées
        const localRecord = config.toLocal(updatedRow);
        await db.table(config.localTable).put(localRecord);

        // Nettoyage de la queue
        await db.syncQueue.delete(mutation.id!);

        // Avancer le checkpoint
        await updateStateCheckpoint(workspaceId, config.localTable, Number(updatedRow.server_version));
      }
    } catch (err: any) {
      console.error(`[Push Error] Mutation ${mutation.id} échouée :`, err);
      await db.syncQueue.update(mutation.id!, {
        status: 'failed',
        errorMessage: err.message || 'Unknown error',
        lastTriedAt: now(),
      });
    }
  }
}

// Helper pour gérer le conflit
async function handleConflict(workspaceId: string, mutation: SyncQueueItem, remoteRecord: any) {
  const config = ENTITY_CONFIGS[mutation.entityType];
  const localRecord = await db.table(config.localTable).get(mutation.entityId);

  await db.transaction('rw', db.syncQueue, db.syncConflicts, db.table(config.localTable), async () => {
    // 1. Enregistrer le conflit
    await db.syncConflicts.put({
      id: mutation.entityId,
      workspaceId,
      entityType: mutation.entityType,
      entityId: mutation.entityId,
      localRecord,
      remoteRecord,
      detectedAt: now(),
    });

    // 2. Marquer la mutation en conflit
    await db.syncQueue.update(mutation.id!, { status: 'conflict' });

    // 3. Marquer le record local en conflit pour alerter l'UI
    if (localRecord) {
      await db.table(config.localTable).update(mutation.entityId, { syncStatus: 'conflict' });
    }
  });
}

// Helper pour mettre à jour le checkpoint dans syncState
async function updateStateCheckpoint(workspaceId: string, tableName: string, serverVersion: number) {
  const stateKey = `${workspaceId}:${tableName}`;
  const existingState = await db.syncState.get(stateKey);
  const currentVersion = existingState ? existingState.lastPulledVersion : 0;

  if (serverVersion > currentVersion) {
    await db.syncState.put({
      id: stateKey,
      workspaceId,
      tableName,
      lastPulledVersion: serverVersion,
      lastPulledAt: now(),
    });
  }
}

// ---------------------------------------------------------------------
// MOTEUR PULL (SUPABASE -> DEXIE LOCAL-FIRST)
// ---------------------------------------------------------------------

export async function pullRemoteChanges(workspaceId: string): Promise<void> {
  for (const [, config] of Object.entries(ENTITY_CONFIGS)) {
    const stateKey = `${workspaceId}:${config.localTable}`;
    const state = await db.syncState.get(stateKey);
    const lastPulledVersion = state ? state.lastPulledVersion : 0;

    try {
      const { data: remoteRows, error: pullError } = await supabase
        .from(config.dbTable)
        .select('*')
        .eq('workspace_id', workspaceId)
        .gt('server_version', lastPulledVersion)
        .order('server_version', { ascending: true });

      if (pullError) throw pullError;

      if (remoteRows && remoteRows.length > 0) {
        await db.transaction('rw', db.table(config.localTable), db.syncState, async () => {
          for (const row of remoteRows) {
            const localRecord = config.toLocal(row);
            const existingLocal = await db.table(config.localTable).get(row.id);

            // Règle local-first : si l'objet local a des modifications non synchronisées
            // (pending ou conflict), on ne l'écrase pas lors du pull.
            if (existingLocal && (existingLocal.syncStatus === 'pending' || existingLocal.syncStatus === 'conflict')) {
              continue;
            }

            // Sinon, mise à jour ou insertion locale
            await db.table(config.localTable).put(localRecord);
          }

          // Mise à jour du checkpoint
          const maxVersion = Math.max(...remoteRows.map((r) => Number(r.server_version)));
          await db.syncState.put({
            id: stateKey,
            workspaceId,
            tableName: config.localTable,
            lastPulledVersion: maxVersion,
            lastPulledAt: now(),
          });
        });
      }
    } catch (err) {
      console.error(`[Pull Error] Table ${config.localTable} échouée :`, err);
      throw err;
    }
  }
}

export async function resolveConflict(conflictId: string, resolution: 'local' | 'remote'): Promise<void> {
  const conflict = await db.syncConflicts.get(conflictId);
  if (!conflict) return;

  const config = ENTITY_CONFIGS[conflict.entityType];
  if (!config) return;

  if (resolution === 'local') {
    // La version locale gagne :
    // Remettre le statut local à 'pending' pour qu'il soit synchronisé au prochain push
    await db.table(config.localTable).update(conflict.entityId, { syncStatus: 'pending' });

    // Mettre à jour la mutation bloquée en statut 'conflict' pour qu'elle reparte en 'pending'
    // avec la nouvelle baseServerVersion (celle du serveur actuel) pour passer le test de conflit
    const queueItem = await db.syncQueue
      .where('entityId')
      .equals(conflict.entityId)
      .filter((item) => item.entityType === conflict.entityType && item.status === 'conflict')
      .first();

    if (queueItem) {
      const updatePayload: any = { status: 'pending' };
      if (conflict.remoteRecord) {
        updatePayload.baseServerVersion = Number(conflict.remoteRecord.serverVersion);
      }
      await db.syncQueue.update(queueItem.id!, updatePayload);
    }
  } else {
    // La version distante gagne :
    // Écraser la version locale par la version distante
    if (conflict.remoteRecord) {
      await db.table(config.localTable).put(conflict.remoteRecord);
    } else {
      await db.table(config.localTable).delete(conflict.entityId);
    }

    // Supprimer la mutation bloquée de la queue
    const queueItem = await db.syncQueue
      .where('entityId')
      .equals(conflict.entityId)
      .filter((item) => item.entityType === conflict.entityType && item.status === 'conflict')
      .first();

    if (queueItem) {
      await db.syncQueue.delete(queueItem.id!);
    }
  }

  // Supprimer l'enregistrement de conflit
  await db.syncConflicts.delete(conflictId);
}

