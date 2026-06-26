import type { PropsWithChildren } from 'react';

interface FormDialogProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  closeLabel?: string;
  onClose: () => void;
}

export function FormDialog({ eyebrow, title, closeLabel = 'Fermer', onClose, children }: FormDialogProps) {
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black/70 px-5 pb-5 pt-16">
      <div className="mx-auto w-full max-w-sm">
        <div className="fz-card max-h-[calc(100dvh-2.5rem)] overflow-y-auto rounded-[1.9rem] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">{eyebrow}</p>
              <h2 className="mt-2 text-[1.35rem] font-black text-white">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="fz-button-secondary px-3 py-2 text-[0.75rem] font-black uppercase tracking-[0.12em] text-white"
            >
              {closeLabel}
            </button>
          </div>

          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
