import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type SVGProps } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/components/StatusPill';
import { songsRepository } from '@/db/repositories/songsRepository';
import { SongFormFields, type SongFormValues } from '@/features/songs/SongFormFields';
import { formatSongDuration, getSongStatusTone } from '@/features/songs/songPresentation';
import { useAuthStore } from '@/stores/authStore';
import { songAssetsRepository } from '@/db/repositories/songAssetsRepository';
import { uploadSongAsset, getSongAssetPlaybackUrl } from '@/services/supabase/storage';

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

function toSongFormValues(song: NonNullable<Awaited<ReturnType<typeof songsRepository.getById>>>) {
  return {
    title: song.title,
    lyrics: song.lyrics,
    key: song.key ?? '',
    bpm: song.bpm !== undefined ? String(song.bpm) : '',
    status: song.status,
    ...toDurationFields(song.durationSeconds),
    notes: song.notes ?? '',
  } satisfies SongFormValues;
}

function areFormValuesEqual(left: SongFormValues, right: SongFormValues) {
  return (
    left.title === right.title &&
    left.lyrics === right.lyrics &&
    left.key === right.key &&
    left.bpm === right.bpm &&
    left.status === right.status &&
    left.durationMinutes === right.durationMinutes &&
    left.durationSeconds === right.durationSeconds &&
    left.notes === right.notes
  );
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
  const autosaveTimeoutRef = useRef<number | null>(null);

  const assets = useLiveQuery(() => songAssetsRepository.listBySongId(songId), [songId]);
  const [isUploading, setIsUploading] = useState(false);
  const [playingAssetId, setPlayingAssetId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const workspaceId = useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
      await uploadSongAsset(workspaceId, songId, file);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de l'upload de l'audio.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePlayPause(assetId: string) {
    if (playingAssetId === assetId && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const workspaceId = useAuthStore.getState().activeWorkspace?.id || 'default-workspace';
      const signedUrl = await getSongAssetPlaybackUrl(workspaceId, assetId);
      
      const audio = new Audio(signedUrl);
      audioRef.current = audio;
      
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => {
        setPlayingAssetId(null);
        setIsPlaying(false);
      });

      setPlayingAssetId(assetId);
      await audio.play();
    } catch (err) {
      console.error(err);
      setError("Impossible de lire le fichier audio.");
    }
  }

  async function handleDeleteAsset(assetId: string) {
    if (confirm("Supprimer ce fichier audio ?")) {
      try {
        await songAssetsRepository.softDelete(assetId);
      } catch (err) {
        console.error(err);
        setError("Impossible de supprimer le fichier audio.");
      }
    }
  }

  useEffect(() => {
    if (!song || isEditMode) {
      return;
    }

    setFormValues(toSongFormValues(song));
  }, [isEditMode, song]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEditMode || isSaving) {
      return;
    }

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

    if (!song || song.deletedAt !== undefined) {
      return;
    }

    const persistedValues = toSongFormValues(song);
    if (areFormValuesEqual(formValues, persistedValues)) {
      setError(null);
      return;
    }

    setError(null);

    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        setIsSaving(true);

        try {
          const payload = {
            title: trimmedTitle,
            lyrics: formValues.lyrics,
            key: formValues.key,
            status: formValues.status,
            durationSeconds: parsedMinutes * 60 + parsedSeconds,
            notes: formValues.notes,
          };

          await songsRepository.update(
            song.id,
            parsedBpm === undefined
              ? payload
              : {
                  ...payload,
                  bpm: parsedBpm,
                },
          );
        } catch {
          setError("Impossible d'enregistrer la chanson.");
        } finally {
          setIsSaving(false);
        }
      })();
    }, 280);

    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formValues, isEditMode, isSaving, song]);

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

  async function handleDeleteSong() {
    setIsSaving(true);
    setError(null);

    try {
      await songsRepository.softDelete(currentSong.id);
      setIsDeleteDialogOpen(false);
      navigate('/songs');
    } catch {
      setError('Impossible de supprimer cette chanson.');
      setIsSaving(false);
    }
  }

  function handleCloseEdit() {
    setError(null);
    setIsDeleteDialogOpen(false);
    setIsEditMode(false);
  }

  return (
    <div className="space-y-4">
      <section
        className="sticky z-30 -mx-1 border-b border-white/8 bg-[var(--fz-bg)] px-1 pb-3 pt-2"
        style={{ top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px))' }}
      >
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
              onClick={() => {
                if (isEditMode) {
                  handleCloseEdit();
                  return;
                }

                setError(null);
                setIsEditMode(true);
              }}
              aria-label={isEditMode ? 'Annuler la modification' : 'Modifier'}
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

        <section className="fz-card rounded-[1.45rem] p-4">
          {isEditMode ? (
            <div className="space-y-3">
              <SongFormFields values={formValues} onChange={setFormValues} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-2 rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Etat</p>
                  <div className="shrink-0">
                    <StatusPill label={currentSong.status} tone={getSongStatusTone(currentSong.status)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Tone</p>
                  <p className="text-[1rem] font-black text-white">{currentSong.key || '--'}</p>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">TEMPO</p>
                  <p className="text-[1rem] font-black text-white">{currentSong.bpm ? `${currentSong.bpm} BPM` : '--'}</p>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-[1rem] border border-white/8 bg-white/4 p-3.5">
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Duree</p>
                  <p className="text-[1rem] font-black text-white">{formatSongDuration(currentSong.durationSeconds)}</p>
                </div>
              </div>

              {currentSong.notes ? (
                <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Notes</p>
                  <p className="mt-2.5 whitespace-pre-line text-[0.9rem] leading-7 text-white/78">{currentSong.notes}</p>
                </div>
              ) : null}

              <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Paroles</p>
                <p className="mt-2.5 whitespace-pre-line text-[0.95rem] leading-7 text-white/88">
                  {currentSong.lyrics || 'Aucune parole pour le moment.'}
                </p>
              </div>

              {/* SECTION AUDIO ASSETS */}
              <div className="rounded-[1rem] border border-white/8 bg-black/20 p-3.5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">Fichiers Audio</p>
                  <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-orange-300 hover:bg-orange-500/20 transition">
                    {isUploading ? 'Upload...' : '+ Ajouter'}
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>

                {assets === undefined ? (
                  <p className="text-[0.75rem] text-white/40">Chargement des fichiers audio...</p>
                ) : assets.length === 0 ? (
                  <p className="text-[0.75rem] text-white/40">Aucun fichier audio associe.</p>
                ) : (
                  <div className="space-y-2">
                    {assets.map((asset) => {
                      const isThisPlaying = playingAssetId === asset.id && isPlaying;
                      return (
                        <div key={asset.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/3 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-white">{asset.filename}</p>
                            <p className="text-[0.62rem] text-white/40 mt-0.5">
                              {(asset.sizeBytes / (1024 * 1024)).toFixed(2)} Mo
                              {asset.syncStatus === 'pending' && (
                                <span className="ml-2 text-orange-400 font-bold">En attente de sync</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlayPause(asset.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white hover:bg-white/10"
                              aria-label={isThisPlaying ? "Pause" : "Play"}
                            >
                              {isThisPlaying ? (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                </svg>
                              ) : (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                              aria-label="Supprimer"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
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
