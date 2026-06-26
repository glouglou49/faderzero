import { NavLink, Outlet } from 'react-router-dom';
import { useState, type SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function SongsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </svg>
  );
}

function SetlistIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M9 7h10" />
      <path d="M9 12h10" />
      <path d="M9 17h10" />
      <path d="M4 7h.01" />
      <path d="M4 12h.01" />
      <path d="M4 17h.01" />
    </svg>
  );
}

function PrompterIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="5" width="16" height="12" rx="2.5" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function SyncIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M7.5 8.5A7 7 0 0 1 19 12" />
      <path d="M16.5 15.5A7 7 0 0 1 5 12" />
    </svg>
  );
}

function MetronomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 20h10" />
      <path d="M8.5 20 11 5h2l2.5 15" />
      <path d="M10 11h4" />
      <path d="M14.5 7.5 18 5" />
    </svg>
  );
}

function MenuIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

const navItems = [
  { to: '/songs', label: 'Songs', Icon: SongsIcon },
  { to: '/setlists', label: 'Setlists', Icon: SetlistIcon },
  { to: '/prompter', label: 'Prompter', Icon: PrompterIcon },
  { to: '/sync', label: 'Sync', Icon: SyncIcon },
  { to: '/metronome', label: 'Click', Icon: MetronomeIcon },
] as const;

export function AppShell() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--fz-bg)] text-[#f5f0ea]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-3 pb-6 pt-3 sm:px-4">
        <header className="sticky top-0 z-40 bg-[var(--fz-bg)] px-1 pb-2 pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
              aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="fz-card-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] text-white"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <p className="min-w-0 flex-1 text-center text-[0.72rem] font-black uppercase tracking-[0.26em] text-[var(--fz-text-muted)]">
              FaderZero
            </p>
            <div className="h-11 w-11 shrink-0" aria-hidden="true" />
          </div>

          {isMenuOpen ? (
            <nav className="mt-3 rounded-[1.4rem] border border-white/10 bg-[rgba(12,13,16,0.92)] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-3 rounded-[1rem] px-3 py-3 transition',
                        isActive ? 'bg-white text-[#111319]' : 'text-[var(--fz-text-muted)] hover:bg-white/5',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={[
                            'flex h-9 w-9 items-center justify-center rounded-full',
                            isActive ? 'bg-[#111319] text-white' : 'bg-white/6 text-white/85',
                          ].join(' ')}
                        >
                          <item.Icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-[0.72rem] font-black uppercase tracking-[0.16em]">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </nav>
          ) : null}
        </header>

        <main className="flex-1 py-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
