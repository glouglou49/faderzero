import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type { CreateSongInput, SongListOptions, SongRecord, UpdateSongInput } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';

export class SongsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  async list(options: SongListOptions = {}) {
    const query = options.query?.trim().toLocaleLowerCase();
    const songs = await this.database.songs.toArray();

    return songs
      .filter((song) => options.includeDeleted || song.deletedAt === undefined)
      .filter((song) => {
        if (!query) {
          return true;
        }

        return song.title.toLocaleLowerCase().includes(query);
      })
      .sort((left, right) => left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' }));
  }

  async getById(id: string) {
    return this.database.songs.get(id);
  }

  async create(input: CreateSongInput) {
    const timestamp = now();
    const song: SongRecord = {
      id: createId(),
      title: input.title.trim(),
      lyrics: input.lyrics ?? '',
      status: input.status ?? 'Idee',
      durationSeconds: input.durationSeconds ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const artist = input.artist?.trim();
    const key = input.key?.trim();
    const notes = input.notes?.trim();

    if (artist) {
      song.artist = artist;
    }
    if (key) {
      song.key = key;
    }
    if (input.bpm !== undefined) {
      song.bpm = input.bpm;
    }
    if (notes) {
      song.notes = notes;
    }

    await this.database.songs.add(song);
    return song;
  }

  async update(id: string, updates: UpdateSongInput) {
    const existingSong = await this.database.songs.get(id);
    if (!existingSong) {
      throw new Error(`Song not found: ${id}`);
    }

    const nextSong: SongRecord = { ...existingSong, updatedAt: now() };

    if (updates.title !== undefined) {
      nextSong.title = updates.title.trim();
    }
    if (updates.lyrics !== undefined) {
      nextSong.lyrics = updates.lyrics;
    }
    if (updates.bpm !== undefined) {
      nextSong.bpm = updates.bpm;
    }
    if (updates.status !== undefined) {
      nextSong.status = updates.status;
    }
    if (updates.durationSeconds !== undefined) {
      nextSong.durationSeconds = updates.durationSeconds;
    }
    if (updates.deletedAt !== undefined) {
      nextSong.deletedAt = updates.deletedAt;
    }
    if (updates.artist !== undefined) {
      const artist = updates.artist.trim();
      if (artist) {
        nextSong.artist = artist;
      } else {
        delete nextSong.artist;
      }
    }
    if (updates.key !== undefined) {
      const key = updates.key.trim();
      if (key) {
        nextSong.key = key;
      } else {
        delete nextSong.key;
      }
    }
    if (updates.notes !== undefined) {
      const notes = updates.notes.trim();
      if (notes) {
        nextSong.notes = notes;
      } else {
        delete nextSong.notes;
      }
    }

    await this.database.songs.put(nextSong);
    return nextSong;
  }

  async softDelete(id: string) {
    const existingSong = await this.database.songs.get(id);
    if (!existingSong) {
      throw new Error(`Song not found: ${id}`);
    }

    const timestamp = now();
    const deletedSong: SongRecord = {
      ...existingSong,
      deletedAt: timestamp,
      updatedAt: timestamp,
    };

    await this.database.transaction('rw', this.database.songs, this.database.setlistSongs, async () => {
      await this.database.songs.put(deletedSong);
      const relatedEntries = await this.database.setlistSongs.where('songId').equals(id).primaryKeys();
      await this.database.setlistSongs.bulkDelete(relatedEntries);
    });

    return deletedSong;
  }

  async countActive() {
    const songs = await this.list();
    return songs.length;
  }
}

export const songsRepository = new SongsRepository();
