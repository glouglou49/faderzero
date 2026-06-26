import Dexie, { type EntityTable } from 'dexie';
import type { DatabaseSchema, SetlistRecord, SetlistSongRecord, SongRecord } from '@/db/schema';
import { createId } from '@/lib/createId';
import { now } from '@/lib/now';

export const FADERZERO_DB_NAME = 'faderzero-pwa';

const version1Stores = {
  songs: 'id, title, updatedAt',
  setlists: 'id, name, updatedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<keyof DatabaseSchema, string>;

const version2Stores = {
  songs: 'id, title, updatedAt, deletedAt',
  setlists: 'id, name, updatedAt, deletedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<keyof DatabaseSchema, string>;

const version3Stores = {
  songs: 'id, title, updatedAt, deletedAt, status',
  setlists: 'id, name, updatedAt, deletedAt',
  setlistSongs: 'id, setlistId, songId, [setlistId+position], updatedAt',
} satisfies Record<keyof DatabaseSchema, string>;

export class FaderZeroDatabase extends Dexie {
  songs!: EntityTable<SongRecord, 'id'>;
  setlists!: EntityTable<SetlistRecord, 'id'>;
  setlistSongs!: EntityTable<SetlistSongRecord, 'id'>;

  constructor(name = FADERZERO_DB_NAME) {
    super(name);

    this.version(1).stores(version1Stores);

    this.version(2)
      .stores(version2Stores)
      .upgrade(async (transaction) => {
        const timestamp = now();

        await transaction
          .table<SongRecord, string>('songs')
          .toCollection()
          .modify((song) => {
            song.id ||= createId();
            song.title ||= '';
            song.lyrics ||= '';
            song.createdAt ||= song.updatedAt || timestamp;
            song.updatedAt ||= song.createdAt || timestamp;
          });

        await transaction
          .table<SetlistRecord, string>('setlists')
          .toCollection()
          .modify((setlist) => {
            setlist.id ||= createId();
            setlist.name ||= '';
            setlist.createdAt ||= setlist.updatedAt || timestamp;
            setlist.updatedAt ||= setlist.createdAt || timestamp;
          });

        await transaction
          .table<SetlistSongRecord, string>('setlistSongs')
          .toCollection()
          .modify((setlistSong) => {
            setlistSong.id ||= createId();
            setlistSong.position ||= 0;
            setlistSong.createdAt ||= setlistSong.updatedAt || timestamp;
            setlistSong.updatedAt ||= setlistSong.createdAt || timestamp;
          });
      });

    this.version(3)
      .stores(version3Stores)
      .upgrade(async (transaction) => {
        await transaction
          .table<SongRecord, string>('songs')
          .toCollection()
          .modify((song) => {
            song.status ||= 'Idee';
            song.durationSeconds ||= 0;
          });
      });
  }
}

export function createDatabase(name = FADERZERO_DB_NAME) {
  return new FaderZeroDatabase(name);
}

export const db = createDatabase();
