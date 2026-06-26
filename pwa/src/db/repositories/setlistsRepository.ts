import type { FaderZeroDatabase } from '@/db/db';
import { db } from '@/db/db';
import type {
  CreateSetlistInput,
  SetlistListOptions,
  SetlistRecord,
  SetlistSummary,
  UpdateSetlistInput,
} from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';

export class SetlistsRepository {
  private readonly database: FaderZeroDatabase;

  constructor(database: FaderZeroDatabase = db) {
    this.database = database;
  }

  async list(options: SetlistListOptions = {}) {
    const setlists = await this.database.setlists.toArray();

    return setlists
      .filter((setlist) => options.includeDeleted || setlist.deletedAt === undefined)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async listSummaries(options: SetlistListOptions = {}) {
    const [setlists, setlistSongs] = await Promise.all([
      this.list(options),
      this.database.setlistSongs.toArray(),
    ]);

    const counts = new Map<string, number>();
    for (const setlistSong of setlistSongs) {
      counts.set(setlistSong.setlistId, (counts.get(setlistSong.setlistId) ?? 0) + 1);
    }

    return setlists.map<SetlistSummary>((setlist) => ({
      ...setlist,
      songCount: counts.get(setlist.id) ?? 0,
    }));
  }

  async getById(id: string) {
    return this.database.setlists.get(id);
  }

  async create(input: CreateSetlistInput) {
    const timestamp = now();
    const setlist: SetlistRecord = {
      id: createId(),
      name: input.name.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const date = input.date?.trim();
    const notes = input.notes?.trim();

    if (date) {
      setlist.date = date;
    }
    if (notes) {
      setlist.notes = notes;
    }

    await this.database.setlists.add(setlist);
    return setlist;
  }

  async update(id: string, updates: UpdateSetlistInput) {
    const existingSetlist = await this.database.setlists.get(id);
    if (!existingSetlist) {
      throw new Error(`Setlist not found: ${id}`);
    }

    const nextSetlist: SetlistRecord = { ...existingSetlist, updatedAt: now() };

    if (updates.name !== undefined) {
      nextSetlist.name = updates.name.trim();
    }
    if (updates.deletedAt !== undefined) {
      nextSetlist.deletedAt = updates.deletedAt;
    }
    if (updates.date !== undefined) {
      const date = updates.date.trim();
      if (date) {
        nextSetlist.date = date;
      } else {
        delete nextSetlist.date;
      }
    }
    if (updates.notes !== undefined) {
      const notes = updates.notes.trim();
      if (notes) {
        nextSetlist.notes = notes;
      } else {
        delete nextSetlist.notes;
      }
    }

    await this.database.setlists.put(nextSetlist);
    return nextSetlist;
  }

  async softDelete(id: string) {
    const existingSetlist = await this.database.setlists.get(id);
    if (!existingSetlist) {
      throw new Error(`Setlist not found: ${id}`);
    }

    const timestamp = now();
    const deletedSetlist: SetlistRecord = {
      ...existingSetlist,
      deletedAt: timestamp,
      updatedAt: timestamp,
    };

    await this.database.transaction('rw', this.database.setlists, this.database.setlistSongs, async () => {
      await this.database.setlists.put(deletedSetlist);
      const relatedEntries = await this.database.setlistSongs.where('setlistId').equals(id).primaryKeys();
      await this.database.setlistSongs.bulkDelete(relatedEntries);
    });

    return deletedSetlist;
  }
}

export const setlistsRepository = new SetlistsRepository();
