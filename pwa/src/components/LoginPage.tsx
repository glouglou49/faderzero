import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getSupabaseConfigError } from '@/services/supabase/client';
import { verifyOtpToken } from '@/services/supabase/auth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { signIn, loading, error } = useAuthStore();
  const configError = getSupabaseConfigError();
  const displayedError = configError ?? error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading || configError) return;
    try {
      await signIn(email.trim());
      setSent(true);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleVerifyToken(e: React.FormEvent) {
    e.preventDefault();
    const value = tokenInput.trim();
    if (!value || isVerifying) return;

    setIsVerifying(true);
    setVerifyError(null);

    try {
      let token = value;
      if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
          const urlObj = new URL(value);
          const extracted = urlObj.searchParams.get('token');
          if (extracted) {
            token = extracted;
          }
        } catch {
          // ignore
        }
      }

      await verifyOtpToken(token, 'magiclink');
    } catch (err: any) {
      console.error(err);
      setVerifyError(err.message || 'Impossible de vérifier le lien ou le jeton.');
    } finally {
      setIsVerifying(false);
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
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z" />
            </svg>
          </span>
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-white">FaderZero</h1>
          <p className="text-[0.72rem] uppercase tracking-[0.16em] text-white/50 mt-1">Votre prompteur scénique</p>
        </div>

        {sent ? (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-center">
              <p className="text-sm font-semibold">Lien de connexion envoyé !</p>
              <p className="text-[0.75rem] text-white/60 mt-1">Consultez votre boîte mail ({email}) pour vous connecter.</p>
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => setSent(false)}
                className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-white/60 hover:text-white transition"
              >
                ← Utiliser un autre e-mail
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60 mb-2">
                Adresse E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
              />
            </div>

            {displayedError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[0.75rem] text-center">
                {displayedError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || Boolean(configError)}
              className="relative w-full overflow-hidden rounded-2xl bg-white px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.2em] text-[#0c0d10] transition hover:bg-orange-500 hover:text-white disabled:bg-white/10 disabled:text-white/40 shadow-lg"
            >
              {loading ? 'Envoi en cours...' : "Se connecter / S'inscrire"}
            </button>
          </form>
        )}

        {/* SECTION RECOURS VISIBLE EN TOUT TEMPS */}
        <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
          <div>
            <label htmlFor="token" className="block text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/60 mb-2">
              Vérification Manuelle (Secours)
            </label>
            <form onSubmit={handleVerifyToken} className="space-y-3">
              <input
                id="token"
                type="text"
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Collez le lien ou le jeton de connexion..."
                disabled={isVerifying}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs text-white placeholder-white/20 transition focus:border-orange-500/50 focus:bg-white/10 focus:outline-none focus:ring-0"
              />
              <p className="text-[0.62rem] text-white/40 leading-relaxed mt-2">
                Si le clic sur le lien magique échoue (ex: blocage d'IP), copiez-le depuis votre boîte mail Inbucket et collez-le ici pour vous connecter directement.
              </p>

              {verifyError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[0.75rem] text-center">
                  {verifyError}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !tokenInput.trim()}
                className="w-full rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/20 px-4 py-3 text-[0.72rem] font-black uppercase tracking-[0.2em] transition disabled:opacity-45 shadow-lg mt-1"
              >
                {isVerifying ? 'Vérification...' : 'Valider et se connecter'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
