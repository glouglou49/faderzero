import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function WorkspaceSelectionPage() {
  const { workspaces, createWorkspace, setActiveWorkspace, signOut, loading, error } = useAuthStore();
  const [newWsName, setNewWsName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(workspaces.length === 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newWsName.trim() || loading) return;
    try {
      await createWorkspace(newWsName.trim());
      setNewWsName('');
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] px-4 text-[#f5f0ea]">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[40%] h-[80%] w-[80%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[40%] h-[80%] w-[80%] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md rounded-[1.8rem] border border-white/10 bg-white/5 p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="text-center mb-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-orange-400 mb-4 shadow-[0_0_20px_rgba(251,146,60,0.15)]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-white">Espace Groupe</h1>
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-white/50 mt-1">Sélectionnez ou créez votre espace</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[0.75rem] text-center">
            {error}
          </div>
        )}

        {!showCreateForm && workspaces.length > 0 ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60 mb-3">Vos groupes actifs</p>
              <div className="max-h-[220px] overflow-y-auto space-y-2.5 pr-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws)}
                    className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-orange-500/50 hover:bg-white/10"
                  >
                    <span className="text-sm font-semibold text-white">{ws.name}</span>
                    <span className="text-[0.65rem] text-orange-400 font-bold uppercase tracking-[0.1em]">Rejoindre →</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full rounded-2xl border border-dashed border-white/20 bg-transparent px-4 py-3.5 text-[0.72rem] font-black uppercase tracking-[0.2em] text-white hover:border-orange-500/50 hover:text-orange-400 transition"
              >
                + Créer un nouveau groupe
              </button>
              <button
                onClick={() => signOut()}
                className="w-full text-center text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/40 hover:text-red-400 transition py-2"
              >
                Déconnexion
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-6">
            <div>
              <label htmlFor="wsName" className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60 mb-2">
                Nom du groupe / workspace
              </label>
              <input
                id="wsName"
                type="text"
                required
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="Ex: Mon Super Groupe"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading || !newWsName.trim()}
                className="w-full rounded-2xl bg-white px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.2em] text-[#0c0d10] transition hover:bg-orange-500 hover:text-white disabled:bg-white/10 disabled:text-white/40 shadow-lg"
              >
                {loading ? 'Création...' : 'Créer et rejoindre'}
              </button>
              {workspaces.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="w-full text-center text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/60 hover:text-white transition py-2"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
