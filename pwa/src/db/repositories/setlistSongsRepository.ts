import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type {
  CreateSetlistSongInput,
  SetlistSongDetail,
  SetlistSongRecord,
  UpdateSetlistSongInput,
} from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';

export class SetlistSongsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  async listBySetlistId(setlistId: string) {
    const rows = await this.database.setlistSongs.where('setlistId').equals(setlistId).toArray();
    return rows.sort((left, right) => left.position - right.position);
  }

  async listDetailedBySetlistId(setlistId: string) {
    const [entries, songs] = await Promise.all([
      this.listBySetlistId(setlistId),
      this.database.songs.toArray(),
    ]);

    const songMap = new Map(songs.map((song) => [song.id, song]));

    return entries
      .map<SetlistSongDetail | null>((entry) => {
        const song = songMap.get(entry.songId);
        if (!song || song.deletedAt !== undefined) {
          return null;
        }

        const detail: SetlistSongDetail = {
          ...entry,
          songTitle: song.title,
        };

        if (song.artist !== undefined) {
          detail.songArtist = song.artist;
        }
        if (song.key !== undefined) {
          detail.songKey = song.key;
        }
        if (song.bpm !== undefined) {
          detail.songBpm = song.bpm;
        }

        return detail;
      })
      .filter((entry): entry is SetlistSongDetail => entry !== null);
  }

  async create(input: CreateSetlistSongInput) {
    const timestamp = now();
    const setlistSong: SetlistSongRecord = {
      id: createId(),
      setlistId: input.setlistId,
      songId: input.songId,
      position: input.position,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.database.setlistSongs.add(setlistSong);
    return setlistSong;
  }

  async addSongToSetlist(setlistId: string, songId: string) {
    const existingEntries = await this.listBySetlistId(setlistId);
    const nextPosition =
      existingEntries.length === 0
        ? 0
        : Math.max(...existingEntries.map((entry) => entry.position)) + 1;

    return this.create({
      setlistId,
      songId,
      position: nextPosition,
    });
  }

  async update(id: string, updates: UpdateSetlistSongInput) {
    const existingSetlistSong = await this.database.setlistSongs.get(id);
    if (!existingSetlistSong) {
      throw new Error(`Setlist song not found: ${id}`);
    }

    const nextSetlistSong: SetlistSongRecord = {
      ...existingSetlistSong,
      ...updates,
      updatedAt: now(),
    };

    await this.database.setlistSongs.put(nextSetlistSong);
    return nextSetlistSong;
  }

  async delete(id: string) {
    const existingSetlistSong = await this.database.setlistSongs.get(id);
    if (!existingSetlistSong) {
      return;
    }

    await this.database.transaction('rw', this.database.setlistSongs, async () => {
      await this.database.setlistSongs.delete(id);
      await this.reindexSetlist(existingSetlistSong.setlistId);
    });
  }

  async deleteBySetlistId(setlistId: string) {
    const rows = await this.database.setlistSongs.where('setlistId').equals(setlistId).primaryKeys();
    await this.database.setlistSongs.bulkDelete(rows);
  }

  async deleteBySongId(songId: string) {
    const rows = await this.database.setlistSongs.where('songId').equals(songId).toArray();
    const affectedSetlistIds = [...new Set(rows.map((row) => row.setlistId))];

    await this.database.transaction('rw', this.database.setlistSongs, async () => {
      await this.database.setlistSongs.bulkDelete(rows.map((row) => row.id));

      for (const setlistId of affectedSetlistIds) {
        await this.reindexSetlist(setlistId);
      }
    });
  }

  async move(setlistSongId: string, direction: -1 | 1) {
    const entry = await this.database.setlistSongs.get(setlistSongId);
    if (!entry) {
      throw new Error(`Setlist song not found: ${setlistSongId}`);
    }

    const orderedEntries = await this.listBySetlistId(entry.setlistId);
    const currentIndex = orderedEntries.findIndex((item) => item.id === setlistSongId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedEntries.length) {
      return orderedEntries;
    }

    const reorderedEntries = [...orderedEntries];
    const [movedEntry] = reorderedEntries.splice(currentIndex, 1);
    if (!movedEntry) {
      return orderedEntries;
    }
    reorderedEntries.splice(targetIndex, 0, movedEntry);

    return this.persistOrderedPositions(entry.setlistId, reorderedEntries);
  }

  private async reindexSetlist(setlistId: string) {
    const orderedEntries = await this.listBySetlistId(setlistId);
    await this.persistOrderedPositions(setlistId, orderedEntries);
  }

  private async persistOrderedPositions(setlistId: string, orderedEntries: SetlistSongRecord[]) {
    const timestamp = now();
    const normalizedEntries = orderedEntries.map((entry, index) => ({
      ...entry,
      position: index,
      updatedAt: timestamp,
    }));

    await this.database.setlistSongs.bulkPut(normalizedEntries);
    return this.listBySetlistId(setlistId);
  }
}

export const setlistSongsRepository = new SetlistSongsRepository();
