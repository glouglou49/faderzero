import { describe, expect, it } from 'vitest';
import { SongAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';

describe('SongAssetsRepository', () => {
  it('creates, lists and soft deletes song assets', async () => {
    const database = await createTestDatabase('song-assets-repository');
    const repository = new SongAssetsRepository(database);

    // 1. Creation d'un asset
    const asset = await repository.create({
      songId: 'song-xyz',
      storagePath: 'workspaces/default-workspace/songs/song-xyz/asset-123.mp3',
      filename: 'backing_track.mp3',
      mimeType: 'audio/mpeg',
      sizeBytes: 1048576,
    });

    expect(asset.id).toBeDefined();
    expect(asset.songId).toBe('song-xyz');
    expect(asset.syncStatus).toBe('pending');

    // 2. Listing
    const activeAssets = await repository.listBySongId('song-xyz');
    expect(activeAssets).toHaveLength(1);
    expect(activeAssets[0]?.filename).toBe('backing_track.mp3');

    // Vérification de la syncQueue
    const queue = await database.syncQueue.toArray();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      entityType: 'songAsset',
      entityId: asset.id,
      operation: 'create',
    });

    // 3. Soft Delete
    await repository.softDelete(asset.id);

    const activeAfterDelete = await repository.listBySongId('song-xyz');
    expect(activeAfterDelete).toHaveLength(0);

    const allAssets = await repository.listBySongId('song-xyz', true);
    expect(allAssets).toHaveLength(1);
    expect(allAssets[0]?.deletedAt).toBeDefined();

    // Vérification que la mutation a été nettoyée de la file car créée puis supprimée hors-ligne
    const queueAfterDelete = await database.syncQueue.toArray();
    expect(queueAfterDelete).toHaveLength(0);

    await destroyTestDatabase(database);
  });
});
