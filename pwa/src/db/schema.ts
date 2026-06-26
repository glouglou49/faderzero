export type SongStatus = 'Idee' | 'En cours' | 'Pret';

export interface SongRecord {
  id: string;
  title: string;
  artist?: string;
  lyrics: string;
  key?: string;
  bpm?: number;
  status: SongStatus;
  durationSeconds: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface SetlistRecord {
  id: string;
  name: string;
  date?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface SetlistSongRecord {
  id: string;
  setlistId: string;
  songId: string;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface DatabaseSchema {
  songs: SongRecord;
  setlists: SetlistRecord;
  setlistSongs: SetlistSongRecord;
}

export interface CreateSongInput {
  title: string;
  artist?: string;
  lyrics?: string;
  key?: string;
  bpm?: number;
  status?: SongStatus;
  durationSeconds?: number;
  notes?: string;
}

export interface UpdateSongInput {
  title?: string;
  artist?: string;
  lyrics?: string;
  key?: string;
  bpm?: number;
  status?: SongStatus;
  durationSeconds?: number;
  notes?: string;
  deletedAt?: number;
}

export interface SongListOptions {
  query?: string;
  includeDeleted?: boolean;
}

export interface CreateSetlistInput {
  name: string;
  date?: string;
  notes?: string;
}

export interface UpdateSetlistInput {
  name?: string;
  date?: string;
  notes?: string;
  deletedAt?: number;
}

export interface SetlistListOptions {
  includeDeleted?: boolean;
}

export interface SetlistSummary {
  id: string;
  name: string;
  date?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  songCount: number;
}

export interface CreateSetlistSongInput {
  setlistId: string;
  songId: string;
  position: number;
}

export interface UpdateSetlistSongInput {
  position?: number;
}

export interface SetlistSongDetail extends SetlistSongRecord {
  songTitle: string;
  songArtist?: string;
  songKey?: string;
  songBpm?: number;
}
