import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { pushPendingMutations, pullRemoteChanges } from './sync';
import { supabase } from './client';
import { createTestDatabase, destroyTestDatabase } from '@/test/dbTestUtils';
import type { FaderZeroDatabase } from '@/db/db';
import { now } from '@/lib/now';

// Variable de redirection du Proxy
let activeTestDb: FaderZeroDatabase;

// Mock du module db pour rediriger la DB globale vers notre instance active de test
vi.mock('@/db/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/db/db')>();
  return {
    ...original,
    db: new Proxy({}, {
      get(_target, prop) {
        return (activeTestDb as any)[prop];
      },
    }),
  };
});

// Définition globale des Mocks pour Vitest
const singleMock = vi.fn();
const maybeSingleMock = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const gtMock = vi.fn();
const orderMock = vi.fn();

const queryBuilder = {
  select: selectMock,
  insert: insertMock,
  update: updateMock,
  eq: eqMock,
  gt: gtMock,
  order: orderMock,
  maybeSingle: maybeSingleMock,
  single: singleMock,
};

selectMock.mockReturnValue(queryBuilder);
insertMock.mockReturnValue(queryBuilder);
updateMock.mockReturnValue(queryBuilder);
eqMock.mockReturnValue(queryBuilder);
gtMock.mockReturnValue(queryBuilder);
orderMock.mockReturnValue(queryBuilder);
maybeSingleMock.mockReturnValue(queryBuilder);
singleMock.mockReturnValue(queryBuilder);

// Mock de Supabase Client
vi.mock('./client', () => {
  return {
    supabase: {
      from: vi.fn().mockImplementation(() => queryBuilder),
    },
  };
});

describe('Sync Engine', () => {
  let database: FaderZeroDatabase;
  const workspaceId = 'test-workspace-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    database = await createTestDatabase('sync-engine-test');
    activeTestDb = database;
  });

  afterEach(async () => {
    await destroyTestDatabase(database);
  });

  describe('pushPendingMutations', () => {
    it('successfully pushes a new creation mutation and clears the queue', async () => {
      // 1. Enregistrement local d'un morceau en attente de sync
      const songId = 'new-song-id';
      const timestamp = now();
      const localSong = {
        id: songId,
        workspaceId,
        title: 'Imagine',
        lyrics: 'Imagine all the people...',
        status: 'Pret' as const,
        durationSeconds: 180,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending' as const,
      };
      await database.songs.add(localSong);

      // 2. Ajout de la mutation dans la queue
      await database.syncQueue.add({
        workspaceId,
        entityType: 'song',
        entityId: songId,
        operation: 'create',
        payload: {
          title: 'Imagine',
          lyrics: 'Imagine all the people...',
          status: 'Pret',
          durationSeconds: 180,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        status: 'pending',
        queuedAt: timestamp,
      });

      // 3. Mock de la réponse de Supabase
      const mockDbRow = {
        id: songId,
        workspace_id: workspaceId,
        title: 'Imagine',
        lyrics: 'Imagine all the people...',
        status: 'Pret',
        duration_seconds: 180,
        created_at: new Date(timestamp).toISOString(),
        updated_at: new Date(timestamp).toISOString(),
        deleted_at: null,
        server_version: 15,
        last_modified_by: 'some-user',
      };

      singleMock.mockResolvedValueOnce({ data: mockDbRow, error: null } as any);

      // 4. Exécution du push
      await pushPendingMutations(workspaceId);

      // 5. Assertions
      expect(supabase.from).toHaveBeenCalledWith('songs');
      
      // La mutation a été supprimée de la queue
      const queue = await database.syncQueue.toArray();
      expect(queue).toHaveLength(0);

      // Le morceau local est marqué comme synchronisé avec sa version distante
      const syncedSong = await database.songs.get(songId);
      expect(syncedSong?.syncStatus).toBe('synced');
      expect(syncedSong?.serverVersion).toBe(15);

      // Le checkpoint de synchronisation locale (syncState) a avancé
      const checkpoint = await database.syncState.get(`${workspaceId}:songs`);
      expect(checkpoint?.lastPulledVersion).toBe(15);
    });

    it('detects conflict when baseServerVersion mismatch and populates syncConflicts', async () => {
      const songId = 'conflict-song-id';
      const timestamp = now();
      const localSong = {
        id: songId,
        workspaceId,
        title: 'Yesterday (Edited Locally)',
        lyrics: 'Yesterday, all my troubles...',
        status: 'Pret' as const,
        durationSeconds: 120,
        createdAt: timestamp,
        updatedAt: timestamp + 1000,
        serverVersion: 3, // Version de base locale
        syncStatus: 'pending' as const,
      };
      await database.songs.add(localSong);

      // Mutation d'update avec baseServerVersion = 3
      await database.syncQueue.add({
        workspaceId,
        entityType: 'song',
        entityId: songId,
        operation: 'update',
        payload: {
          title: 'Yesterday (Edited Locally)',
          updatedAt: timestamp + 1000,
        },
        baseServerVersion: 3,
        status: 'pending',
        queuedAt: timestamp,
      });

      // Mock de Supabase renvoyant une version serveur plus récente (ex: 5)
      const mockServerRow = {
        id: songId,
        workspace_id: workspaceId,
        title: 'Yesterday (Edited Remotely)',
        lyrics: 'Yesterday, all my troubles...',
        status: 'Pret',
        duration_seconds: 120,
        created_at: new Date(timestamp).toISOString(),
        updated_at: new Date(timestamp + 500).toISOString(),
        deleted_at: null,
        server_version: 5, // Différente de 3 !
        last_modified_by: 'other-user',
      };

      maybeSingleMock.mockResolvedValueOnce({ data: mockServerRow, error: null } as any);

      // Exécution du push
      await pushPendingMutations(workspaceId);

      // La mutation est marquée en statut 'conflict'
      const queue = await database.syncQueue.toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0]?.status).toBe('conflict');

      // Le morceau local est marqué en statut 'conflict'
      const song = await database.songs.get(songId);
      expect(song?.syncStatus).toBe('conflict');

      // Une entrée de conflit a été générée
      const conflicts = await database.syncConflicts.toArray();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        id: songId,
        workspaceId,
        entityType: 'song',
        entityId: songId,
      });
      expect(conflicts[0]?.localRecord).toMatchObject({ title: 'Yesterday (Edited Locally)' });
      expect(conflicts[0]?.remoteRecord).toMatchObject({ title: 'Yesterday (Edited Remotely)' });
    });
  });

  describe('pullRemoteChanges', () => {
    it('pulls remote changes and respects the local-first rule', async () => {
      // 1. Initialiser le checkpoint à la version 10
      await database.syncState.put({
        id: `${workspaceId}:songs`,
        workspaceId,
        tableName: 'songs',
        lastPulledVersion: 10,
        lastPulledAt: now(),
      });

      // 2. Définir un morceau en conflit/pending localement et un autre propre
      const cleanSongId = 'clean-song';
      const pendingSongId = 'pending-song';
      
      await database.songs.add({
        id: cleanSongId,
        workspaceId,
        title: 'Clean Old',
        lyrics: '',
        status: 'Pret',
        durationSeconds: 150,
        createdAt: now(),
        updatedAt: now(),
        syncStatus: 'synced',
        serverVersion: 8,
      });

      await database.songs.add({
        id: pendingSongId,
        workspaceId,
        title: 'Local Changes',
        lyrics: '',
        status: 'Pret',
        durationSeconds: 150,
        createdAt: now(),
        updatedAt: now(),
        syncStatus: 'pending',
        serverVersion: 8,
      });

      // 3. Mock des résultats distants (mises à jour des deux morceaux avec version 12)
      const remoteRows = [
        {
          id: cleanSongId,
          workspace_id: workspaceId,
          title: 'Clean Remotely Updated',
          lyrics: '',
          status: 'Pret',
          duration_seconds: 150,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          server_version: 11,
          last_modified_by: 'user-2',
        },
        {
          id: pendingSongId,
          workspace_id: workspaceId,
          title: 'Server Wins If We Overwrote (But we shouldn\'t!)',
          lyrics: '',
          status: 'Pret',
          duration_seconds: 150,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          server_version: 12,
          last_modified_by: 'user-2',
        }
      ];

      orderMock.mockResolvedValueOnce({ data: remoteRows, error: null } as any);

      // 4. Exécution du pull
      await pullRemoteChanges(workspaceId);

      // 5. Assertions
      // Le morceau propre a bien été mis à jour localement
      const cleanSong = await database.songs.get(cleanSongId);
      expect(cleanSong?.title).toBe('Clean Remotely Updated');
      expect(cleanSong?.serverVersion).toBe(11);

      // Le morceau 'pending' n'a PAS été écrasé (règle local-first)
      const pendingSong = await database.songs.get(pendingSongId);
      expect(pendingSong?.title).toBe('Local Changes');
      expect(pendingSong?.syncStatus).toBe('pending');

      // Le checkpoint a avancé au max (12)
      const checkpoint = await database.syncState.get(`${workspaceId}:songs`);
      expect(checkpoint?.lastPulledVersion).toBe(12);
    });
  });
});
