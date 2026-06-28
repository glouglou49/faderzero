import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type { SongAssetRecord } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';
import { useAuthStore } from '@/stores/authStore';
import { enqueueMutation } from '@/db/syncQueueHelper';

export class SongAssetsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  private getActiveWorkspaceId(): string {
    return useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
  }

  async listBySongId(songId: string, includeDeleted = false) {
    const assets = await this.database.songAssets.where('songId').equals(songId).toArray();
    return assets
      .filter((asset) => includeDeleted || asset.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async getById(id: string) {
    return this.database.songAssets.get(id);
  }

  async create(input: {
    id?: string;
    songId: string;
    storagePath: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds?: number;
  }) {
    const timestamp = now();
    const workspaceId = this.getActiveWorkspaceId();

    const asset: SongAssetRecord = {
      id: input.id || createId(),
      workspaceId,
      songId: input.songId,
      storagePath: input.storagePath,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    if (input.durationSeconds !== undefined) {
      asset.durationSeconds = input.durationSeconds;
    }

    await this.database.transaction('rw', this.database.songAssets, this.database.syncQueue, async () => {
      await this.database.songAssets.add(asset);
      await enqueueMutation(
        this.database,
        workspaceId,
        'songAsset',
        asset.id,
        'create',
        {
          songId: asset.songId,
          storagePath: asset.storagePath,
          filename: asset.filename,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          durationSeconds: asset.durationSeconds,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        }
      );
    });

    return asset;
  }

  async softDelete(id: string) {
    const existing = await this.database.songAssets.get(id);
    if (!existing) {
      throw new Error(`Song asset not found: ${id}`);
    }

    const timestamp = now();
    const deletedAsset: SongAssetRecord = {
      ...existing,
      deletedAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };

    await this.database.transaction('rw', this.database.songAssets, this.database.syncQueue, async () => {
      await this.database.songAssets.put(deletedAsset);
      await enqueueMutation(
        this.database,
        deletedAsset.workspaceId,
        'songAsset',
        deletedAsset.id,
        'soft_delete',
        { deletedAt: timestamp },
        existing.serverVersion
      );
    });

    return deletedAsset;
  }
}

export const songAssetsRepository = new SongAssetsRepository();
