import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/components/StatusPill';
import { setlistsRepository } from '@/db/repositories/setlistsRepository';

export function SetlistsPage() {
  const setlists = useLiveQuery(() => setlistsRepository.listSummaries(), []);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateSetlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Donnez un nom a la setlist.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await setlistsRepository.create({
        name: trimmedName,
        notes,
      });
      setName('');
      setNotes('');
    } catch {
      setError('Impossible de creer la setlist.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <FeatureCard
        eyebrow="Setlists"
        title="Construire la scene"
        description="Setlists claires, denses et mobiles, pour retrouver l'energie de l'interface Expo sans perdre la souplesse web."
        aside={setlists ? `${setlists.length}` : '...'}
      >
        <div className="flex flex-wrap gap-3">
          <StatusPill label="Ordre local" tone="success" />
          <StatusPill label="Multi-occurrence" />
          <StatusPill label="Offline" tone="accent" />
        </div>
      </FeatureCard>

      <FeatureCard
        eyebrow="Create"
        title="Nouvelle setlist"
        description="Creation immediate dans IndexedDB avec une presentation plus premium que formulaire d'admin."
      >
        <form className="space-y-3" onSubmit={handleCreateSetlist}>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
              Nom
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Festival ete 2026"
              className="fz-input text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes de concert ou contexte"
              rows={3}
              className="fz-input min-h-28 resize-y text-sm"
            />
          </label>
          {error ? <p className="text-sm font-semibold text-rose-400">{error}</p> : null}
          <button
            type="submit"
            disabled={isSaving}
            className="fz-button-primary w-full px-4 py-3 text-sm font-black uppercase tracking-[0.16em] disabled:opacity-60"
          >
            {isSaving ? 'Creation...' : 'Creer la setlist'}
          </button>
        </form>
      </FeatureCard>

      <section className="space-y-3">
        {setlists === undefined ? (
          <FeatureCard eyebrow="Chargement" title="Lecture des setlists" description="Ouverture de la base locale..." />
        ) : setlists.length === 0 ? (
          <FeatureCard
            eyebrow="Vide"
            title="Aucune setlist pour l'instant"
            description="Creez votre premiere setlist ici, puis ouvrez-la pour y ajouter des morceaux existants."
          />
        ) : (
          setlists.map((setlist) => (
            <Link
              key={setlist.id}
              to={`/setlists/${setlist.id}`}
              className="fz-card block rounded-[1.6rem] p-5 transition hover:border-[var(--fz-border-strong)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] font-black uppercase tracking-[0.22em] text-[var(--fz-text-muted)]">
                    {setlist.songCount} morceau{setlist.songCount > 1 ? 'x' : ''}
                  </p>
                  <h2 className="mt-2 text-[1.45rem] font-black tracking-tight text-white">{setlist.name}</h2>
                  <p className="mt-3 text-sm text-[var(--fz-text-muted)]">
                    {setlist.notes || "Ouvrez la setlist pour gerer l'ordre, les ajouts et les retraits."}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.2em] text-white/90">
                  Ouvrir
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
