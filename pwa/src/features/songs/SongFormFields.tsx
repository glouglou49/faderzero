import type { SongStatus } from '@/db/schema';
import { songStatusOptions } from '@/features/songs/songPresentation';
import type { ChangeEvent } from 'react';

export interface SongFormValues {
  title: string;
  artist: string;
  lyrics: string;
  key: string;
  bpm: string;
  status: SongStatus;
  durationMinutes: string;
  durationSeconds: string;
  notes: string;
}

interface SongFormFieldsProps {
  values: SongFormValues;
  onChange: (nextValues: SongFormValues) => void;
  disabled?: boolean;
}

export function SongFormFields({ values, onChange, disabled = false }: SongFormFieldsProps) {
  function updateField<K extends keyof SongFormValues>(field: K, value: SongFormValues[K]) {
    onChange({
      ...values,
      [field]: value,
    });
  }

  function handleTextAreaChange(field: 'lyrics' | 'notes') {
    return (event: ChangeEvent<HTMLTextAreaElement>) => {
      updateField(field, event.target.value);
    };
  }

  function handleInputChange(field: 'title' | 'artist' | 'key' | 'bpm' | 'durationMinutes' | 'durationSeconds') {
    return (event: ChangeEvent<HTMLInputElement>) => {
      updateField(field, event.target.value);
    };
  }

  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    updateField('status', event.target.value as SongStatus);
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
          Titre
        </span>
        <input
          value={values.title}
          onChange={handleInputChange('title')}
          placeholder="Ex. Last Train Home"
          disabled={disabled}
          className="fz-input text-base"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
            Artiste
          </span>
          <input
            value={values.artist}
            onChange={handleInputChange('artist')}
            placeholder="Optionnel"
            disabled={disabled}
            className="fz-input text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
            BPM
          </span>
          <input
            value={values.bpm}
            onChange={handleInputChange('bpm')}
            inputMode="numeric"
            placeholder="120"
            disabled={disabled}
            className="fz-input text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_6.2rem_6.2rem] gap-3">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
            Etat
          </span>
          <select value={values.status} onChange={handleSelectChange} disabled={disabled} className="fz-input text-sm">
            {songStatusOptions.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
            Min
          </span>
          <input
            value={values.durationMinutes}
            onChange={handleInputChange('durationMinutes')}
            inputMode="numeric"
            placeholder="00"
            disabled={disabled}
            className="fz-input text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
            Sec
          </span>
          <input
            value={values.durationSeconds}
            onChange={handleInputChange('durationSeconds')}
            inputMode="numeric"
            placeholder="00"
            disabled={disabled}
            className="fz-input text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
          Tonalite
        </span>
        <input
          value={values.key}
          onChange={handleInputChange('key')}
          placeholder="Ex. Am"
          disabled={disabled}
          className="fz-input text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
          Paroles
        </span>
        <textarea
          value={values.lyrics}
          onChange={handleTextAreaChange('lyrics')}
          rows={10}
          placeholder="Couplets, refrains, accords..."
          disabled={disabled}
          className="fz-input min-h-52 resize-y text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
          Notes
        </span>
        <textarea
          value={values.notes}
          onChange={handleTextAreaChange('notes')}
          rows={4}
          placeholder="Repere scene, structure, remarques..."
          disabled={disabled}
          className="fz-input min-h-28 resize-y text-sm"
        />
      </label>
    </div>
  );
}
