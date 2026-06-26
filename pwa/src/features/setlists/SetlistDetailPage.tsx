import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeatureCard } from '@/components/FeatureCard';
import { setlistSongsRepository } from '@/db/repositories/setlistSongsRepository';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';
import { songsRepository } from '@/db/repositories/songsRepository';

export function SetlistDetailPage() {
  const { setlistId = '' } = useParams();
  const navigate = useNavigate();
  const setlist = useLiveQuery(() => setlistsRepository.getById(setlistId), [setlistId]);
  const entries = useLiveQuery(() => setlistSongsRepository.listDetailedBySetlistId(setlistId), [setlistId]);
  const songs = useLiveQuery(() => songsRepository.list(), []);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!setlist) {
      return;
    }

    setName(setlist.name);
    setDate(setlist.date ?? '');
    setNotes(setlist.notes ?? '');
  }, [setlist]);

  const availableSongs = useMemo(() => songs ?? [], [songs]);
  const songCount = entries?.length ?? 0;

  if (setlist === undefined || entries === undefined || songs === undefined) {
    return (
      <FeatureCard
        eyebrow="Chargement"
        title="Lecture de la setlist"
        description="Recuperation des donnees locales..."
      />
    );
  }

  if (!setlist || setlist.deletedAt !== undefined) {
    return (
      <FeatureCard
        eyebrow="Introuvable"
        title="Cette setlist n'est plus disponible"
        description="Elle a peut-etre ete supprimee ou n'existe plus dans la base locale."
      >
        <Link to="/setlists" className="fz-button-secondary inline-flex px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white">
          Retour a la liste
        </Link>
      </FeatureCard>
    );
  }

  const currentSetlist = setlist;

  async function handleSaveSetlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Le nom de la setlist est obligatoire.');
      return;
    }

    setError(null);
    setActionMessage(null);

    try {
      await setlistsRepository.update(currentSetlist.id, {
        name: trimmedName,
        date,
        notes,
      });
      setActionMessage('Setlist enregistree.');
    } catch {
      setError("Impossible d'enregistrer la setlist.");
    }
  }

  async function handleDeleteSetlist() {
    setIsDeleting(true);
    setError(null);
    setActionMessage(null);

    try {
      await setlistsRepository.softDelete(currentSetlist.id);
      setIsDeleteDialogOpen(false);
      navigate('/setlists');
    } catch {
      setError('Impossible de supprimer la setlist.');
      setIsDeleting(false);
    }
  }

  async function handleAddSong(songId: string) {
    setError(null);
    setActionMessage(null);

    try {
      await setlistSongsRepository.addSongToSetlist(currentSetlist.id, songId);
    } catch {
      setError("Impossible d'ajouter ce morceau a la setlist.");
    }
  }

  async function handleMoveEntry(entryId: string, direction: -1 | 1) {
    setError(null);
    setActionMessage(null);

    try {
      await setlistSongsRepository.move(entryId, direction);
    } catch {
      setError('Impossible de reordonner ce morceau.');
    }
  }

  async function handleRemoveEntry(entryId: string) {
    setError(null);
    setActionMessage(null);

    try {
      await setlistSongsRepository.delete(entryId);
    } catch {
      setError('Impossible de retirer ce morceau.');
    }
  }

  return (
    <div className="space-y-4">
      <FeatureCard
        eyebrow="Setlist Detail"
        title={currentSetlist.name}
        description={`${songCount} morceau${songCount > 1 ? 'x' : ''} dans l'ordre de passage.`}
        aside={currentSetlist.date || 'Live'}
      >
        <div className="fz-actions-row fz-actions-row--compact">
          <Link to="/setlists" className="fz-button-secondary px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-white">
            Retour
          </Link>
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
            className="fz-button-danger px-4 py-3 text-sm font-black uppercase tracking-[0.16em]"
          >
            Supprimer
          </button>
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Edition"
        title="Modifier la setlist"
        description="Nom, date et notes restent locaux dans IndexedDB."
      >
        <form className="space-y-3" onSubmit={handleSaveSetlist}>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Nom</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="fz-input text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Date</span>
            <input value={date} onChange={(event) => setDate(event.target.value)} type="date" className="fz-input text-sm" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="fz-input min-h-28 resize-y text-sm"
            />
          </label>
          {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}
          {actionMessage ? <p className="text-sm font-semibold text-emerald-400">{actionMessage}</p> : null}
          <button type="submit" className="fz-button-primary w-full px-4 py-3 text-sm font-black uppercase tracking-[0.16em]">
            Enregistrer
          </button>
        </form>
      </FeatureCard>

      <FeatureCard
        eyebrow="Ordre"
        title="Morceaux de la setlist"
        description="Le meme morceau peut etre ajoute plusieurs fois. Les positions sont renormalisees apres chaque retrait."
      >
        <div className="space-y-3">
          {entries.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-[var(--fz-text-muted)]">
              Aucun morceau dans cette setlist pour le moment.
            </p>
          ) : (
            entries.map((entry, index) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
                      Position {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-black text-white">{entry.songTitle}</h3>
                    <p className="mt-1 text-sm text-[var(--fz-text-muted)]">
                      {entry.songArtist || 'Artiste non defini'}
                      {entry.songBpm ? ` · ${entry.songBpm} BPM` : ''}
                      {entry.songKey ? ` · ${entry.songKey}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="fz-button-danger px-3 py-2 text-xs font-black uppercase tracking-[0.16em]"
                  >
                    Retirer
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleMoveEntry(entry.id, -1)}
                    disabled={index === 0}
                    className="fz-button-secondary px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-white disabled:opacity-40"
                  >
                    Monter
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveEntry(entry.id, 1)}
                    disabled={index === entries.length - 1}
                    className="fz-button-secondary px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-white disabled:opacity-40"
                  >
                    Descendre
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Add Songs"
        title="Ajouter des morceaux existants"
        description="Cette liste vient du repository songs. Cliquer plusieurs fois ajoute plusieurs occurrences si necessaire."
      >
        <div className="space-y-3">
          {availableSongs.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-[var(--fz-text-muted)]">
              Aucun morceau actif disponible pour l'instant. La verticale songs devra en creer.
            </p>
          ) : (
            availableSongs.map((song) => (
              <div key={song.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-white">{song.title}</h3>
                  <p className="mt-1 text-sm text-[var(--fz-text-muted)]">
                    {song.artist || 'Artiste non defini'}
                    {song.bpm ? ` · ${song.bpm} BPM` : ''}
                    {song.key ? ` · ${song.key}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddSong(song.id)}
                  className="fz-button-primary w-full px-4 py-3 text-xs font-black uppercase tracking-[0.16em] sm:w-auto"
                >
                  Ajouter
                </button>
              </div>
            ))
          )}
        </div>
      </FeatureCard>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Supprimer cette setlist ?"
        description="La setlist sera retiree de la base locale active sur cet appareil apres confirmation."
        confirmLabel="Supprimer"
        isBusy={isDeleting}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSetlist}
      />
    </div>
  );
}
