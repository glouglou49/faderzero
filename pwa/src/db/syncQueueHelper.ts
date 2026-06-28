import type { FaderZeroDatabase } from './db';
import type { SyncQueueItem } from './schema';
import { now } from '@/lib/now';

export async function enqueueMutation(
  database: FaderZeroDatabase,
  workspaceId: string,
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  operation: SyncQueueItem['operation'],
  payload: any,
  baseServerVersion?: number
): Promise<'queued' | 'removed_from_queue' | 'updated'> {
  const timestamp = now();

  // Recherche d'une mutation en attente (pending) pour cet objet précis
  const existing = await database.syncQueue
    .where('entityId')
    .equals(entityId)
    .filter(
      (item) =>
        item.entityType === entityType &&
        item.workspaceId === workspaceId &&
        item.status === 'pending'
    )
    .first();

  if (existing) {
    if (operation === 'soft_delete') {
      if (existing.operation === 'create') {
        // L'objet a été créé puis supprimé localement hors ligne :
        // On supprime simplement la mutation de création de la file et on ne synchronise rien.
        await database.syncQueue.delete(existing.id!);
        return 'removed_from_queue';
      } else {
        // On transforme la mutation existante (ex: update) en soft_delete
        await database.syncQueue.update(existing.id!, {
          operation: 'soft_delete',
          payload: { ...existing.payload, ...payload },
          queuedAt: timestamp,
        });
        return 'updated';
      }
    } else if (operation === 'update') {
      // On fusionne les payloads de mise à jour successifs
      await database.syncQueue.update(existing.id!, {
        payload: { ...existing.payload, ...payload },
        queuedAt: timestamp,
      });
      return 'updated';
    }
  }

  // Si aucune mutation existante n'est trouvée, on en ajoute une nouvelle
  const item: SyncQueueItem = {
    workspaceId,
    entityType,
    entityId,
    operation,
    payload,
    status: 'pending',
    queuedAt: timestamp,
  };

  if (baseServerVersion !== undefined) {
    item.baseServerVersion = baseServerVersion;
  }

  await database.syncQueue.add(item);
  return 'queued';
}
