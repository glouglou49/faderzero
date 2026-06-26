import type { SongStatus } from '@/db/schema';

export const songStatusOptions: Array<{ value: SongStatus; label: string }> = [
  { value: 'Idee', label: 'Idee' },
  { value: 'En cours', label: 'En cours' },
  { value: 'Pret', label: 'Pret' },
];

export function getSongStatusTone(status: SongStatus): 'default' | 'accent' | 'success' {
  if (status === 'Pret') {
    return 'success';
  }

  if (status === 'En cours') {
    return 'accent';
  }

  return 'default';
}

export function formatSongDuration(durationSeconds: number) {
  const boundedDuration = Math.max(0, durationSeconds);
  const minutes = Math.floor(boundedDuration / 60);
  const seconds = boundedDuration % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
