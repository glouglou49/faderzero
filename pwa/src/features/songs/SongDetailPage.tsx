import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent, type SVGProps } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/components/StatusPill';
import { songsRepository } from '@/db/repositories/songsRepository';
import { SongFormFields, type SongFormValues } from '@/features/songs/SongFormFields';
import { formatSongDuration, getSongStatusTone } from '@/features/songs/songPresentation';

type IconProps = SVGProps<SVGSVGElement>;

function BackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 18 9 12l6-6" />
    </svg>
  );
}

function PencilIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 20 4.5-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

function TrashIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12h10l1-12" />
      <path d="M9 7V5h6v2" />
    </svg>
  );
}

const initialFormValues: SongFormValues = {
  title: '',
  artist: '',
  lyrics: '',
  key: '',
  bpm: '',
  status: 'Idee',
  durationMinutes: '00',
  durationSeconds: '00',
  notes: '',
};

function toDurationFields(durationSeconds: number) {
  const boundedDuration = Math.max(0, durationSeconds);

  return {
    durationMinutes: String(Math.floor(boundedDuration / 60)).padStart(2, '0'),
    durationSeconds: String(boundedDuration % 60).padStart(2, '0'),
  };
}

export function SongDetailPage() {
  const { songId = '' } = useParams();
  const navigate = useNavigate();
  const song = useLiveQuery(() => songsRepository.getById(songId), [songId]);
  const [formValues, setFormValues] = useState<SongFormValues>(initialFormValues);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!song) {
      return;
    }

    setFormValues({
      title: song.title,
      artist: song.artist ?? '',
      lyrics: song.lyrics,
      key: song.key ?? '',
      bpm: song.bpm !== undefined ? String(song.bpm) : '',
      status: song.status,
      ...toDurationFields(song.durationSeconds),
      notes: song.notes ?? '',
    });
  }, [song]);

  if (song === undefined) {
    return <FeatureCard eyebrow="Chargement" title="Lecture de la chanson" description="Recuperation des donnees locales..." />;
  }

  if (!song || song.deletedAt !== undefined) {
    return (
      <FeatureCard
        eyebrow="Introuvable"
        title="Cette chanson n'est plus disponible"
        description="Elle a peut-etre deja ete supprimee ou n'existe pas dans la base locale."
      >
        <Link
          to="/songs"
          className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white"
        >
          Retour au repertoire
        </Link>
      </FeatureCard>
    );
  }

  const currentSong = song;

  async function handleSaveSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = formValues.title.trim();
    if (!trimmedTitle) {
      setError('Le titre est obligatoire.');
      return;
    }

    const parsedBpm = formValues.bpm.trim() ? Number(formValues.bpm) : undefined;
    if (parsedBpm !== undefined && Number.isNaN(parsedBpm)) {
      setError('Le BPM doit etre un nombre.');
      return;
    }

    const parsedMinutes = formValues.durationMinutes.trim() ? Number(formValues.durationMinutes) : 0;
    const parsedSeconds = formValues.durationSeconds.trim() ? Number(formValues.durationSeconds) : 0;
    if ([parsedMinutes, parsedSeconds].some((value) => Number.isNaN(value) || value < 0)) {
      setError('La duree doit contenir des valeurs positives.');
      return;
    }
    if (parsedSeconds > 59) {
      setError('Les secondes doivent etre comprises entre 0 et 59.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        title: trimmedTitle,
        artist: formValues.artist,
        lyrics: formValues.lyrics,
        key: formValues.key,
        status: formValues.status,
        durationSeconds: parsedMinutes * 60 + parsedSeconds,
        notes: formValues.notes,
      };

      await songsRepository.update(
        currentSong.id,
        parsedBpm === undefined
          ? payload
          : {
              ...payload,
              bpm: parsedBpm,
            },
      );
      setIsEditMode(false);
      setMessage('Chanson enregistree.');
    } catch {
      setError("Impossible d'enregistrer la chanson.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSong() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await songsRepository.softDelete(currentSong.id);
      setIsDeleteDialogOpen(false);
      navigate('/songs');
    } catch {
      setError('Impossible de supprimer cette chanson.');
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setFormValues({
      title: currentSong.title,
      artist: currentSong.artist ?? '',
      lyrics: currentSong.lyrics,
      key: currentSong.key ?? '',
      bpm: currentSong.bpm !== undefined ? String(currentSong.bpm) : '',
      status: currentSong.status,
      ...toDurationFields(currentSong.durationSeconds),
      notes: currentSong.notes ?? '',
    });
    setError(null);
    setMessage(null);
    setIsDeleteDialogOpen(false);
    setIsEditMode(false);
  }

  return (
    <div className="space-y-4">
      <section className="sticky top-8 z-30 -mx-1 border-b border-white/8 bg-[var(--fz-bg)] px-1 pb-3 pt-2">
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3">
          <Link
            to="/songs"
            aria-label="Retour"
            className="fz-card-soft flex h-11 w-11 items-center justify-center rounded-[1rem] text-white"
          >
            <BackIcon className="h-5 w-5" />
          </Link>

          <h1 className="truncate text-center text-[1rem] font-black text-white">{currentSong.title || 'Sans titre'}</h1>

          <div className="flex items-center justify-end gap-2">
            {isEditMode ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isSaving}
                aria-label="Supprimer"
                className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-rose-500/25 bg-rose-500/10 text-rose-300 disabled:opacity-60"
              >
                <TrashIcon className="h-4.5 w-4.5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setIsEditMode((previousValue) => !previousValue)}
              aria-label={isEditMode ? 'Fermer la modification' : 'Modifier'}
              className={[
                'flex h-11 w-11 items-center justify-center rounded-[1rem] border',
                isEditMode
                  ? 'border-white/12 bg-white/8 text-white'
                  : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
              ].join(' ')}
            >
              {isEditMode ? <CheckIcon className="h-4.5 w-4.5" /> : <PencilIcon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4 pt-1">
        {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}
        {message ? <p className="text-sm font-semibold text-emerald-400">{message}</p> : null}

        <section className="fz-card rounded-[1.45rem] p-4">
          <div className="space-y-4">
            <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5">
              <p className="text-[0.72rem] font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Titre</p>
              <p className="mt-2 text-[2rem] font-black tracking-tight text-white">{currentSong.title || 'Sans titre'}</p>
              {currentSong.artist ? <p className="mt-1.5 text-[0.9rem] text-white/72">{currentSong.artist}</p> : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">BPM</p>
                <p className="mt-1.5 text-[1rem] font-black text-white">{currentSong.bpm ?? '--'}</p>
              </div>
              <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Tone</p>
                <p className="mt-1.5 text-[1rem] font-black text-white">{currentSong.key || '--'}</p>
              </div>
              <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Etat</p>
                <div className="mt-1.5">
                  <StatusPill label={currentSong.status} tone={getSongStatusTone(currentSong.status)} />
                </div>
              </div>
              <div className="rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Duree</p>
                <p className="mt-1.5 text-[1rem] font-black text-white">{formatSongDuration(currentSong.durationSeconds)}</p>
              </div>
            </div>

            <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Paroles</p>
              <p className="mt-2.5 whitespace-pre-line text-[0.95rem] leading-7 text-white/88">
                {currentSong.lyrics || 'Aucune parole pour le moment.'}
              </p>
            </div>

            {currentSong.notes ? (
              <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Notes</p>
                <p className="mt-2.5 whitespace-pre-line text-[0.9rem] leading-7 text-white/78">{currentSong.notes}</p>
              </div>
            ) : null}
          </div>
        </section>

        {isEditMode ? (
          <FeatureCard
            eyebrow="Edition"
            title="Modifier la chanson"
            description="Edition locale via le repository songs, en gardant le mode visu comme point d'entree."
          >
            <form className="space-y-3" onSubmit={handleSaveSong}>
              <SongFormFields values={formValues} onChange={setFormValues} disabled={isSaving} />
              {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="fz-button-secondary flex-1 px-4 py-3 text-[0.82rem] font-black uppercase tracking-[0.12em] text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="fz-button-primary flex-1 px-4 py-3 text-[0.82rem] font-black uppercase tracking-[0.12em] disabled:opacity-60"
                >
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </FeatureCard>
        ) : null}
      </section>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Supprimer cette chanson ?"
        description="La chanson sera retiree de la liste active sur cet appareil. Cette action demande une confirmation explicite."
        confirmLabel="Supprimer"
        isBusy={isSaving}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSong}
      />
    </div>
  );
}
