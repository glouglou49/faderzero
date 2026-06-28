import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FocusEvent, type PropsWithChildren, type UIEvent } from 'react';
import type { SongStatus } from '@/db/schema';
import { songStatusOptions } from '@/features/songs/songPresentation';

export interface SongFormValues {
  title: string;
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

type ActivePicker = 'status' | 'key' | 'bpm' | 'duration' | null;

const keyOptions = ['', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const bpmOptions = ['', ...Array.from({ length: 271 }, (_, index) => String(index + 30))];
const durationMinuteOptions = Array.from({ length: 100 }, (_, index) => String(index).padStart(2, '0'));
const durationSecondOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const lyricsBlockOptions = ['[Couplet]', '[Intro]', '[Refrain]', '[Pont]', '[Solo]'] as const;
const wheelItemHeight = 64;
const wheelViewportHeight = 320;
const wheelCenterPadding = wheelViewportHeight / 2 - wheelItemHeight / 2;

function formatDurationLabel(minutes: string, seconds: string) {
  return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

function PickerDialog({
  title,
  description,
  closeLabel = 'Fermer',
  onClose,
  children,
}: PropsWithChildren<{ title: string; description?: string; closeLabel?: string; onClose: () => void }>) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('[data-picker-selected="true"]').forEach((element) => {
        element.scrollIntoView({ block: 'center', inline: 'center' });
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 pt-16 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[1.6rem] border border-white/10 bg-[var(--fz-bg)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[1.28rem] font-black tracking-tight text-white">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-[var(--fz-text-muted)]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-xl font-black leading-none text-white transition hover:bg-white/10"
          >
            &times;
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function PickerTrigger({
  label,
  value,
  onClick,
  disabled = false,
  emphasized = false,
}: {
  label: string;
  value: string;
  onClick: () => void;
  disabled?: boolean;
  emphasized?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex w-full items-center justify-between gap-2 rounded-[1rem] border p-3.5 text-left transition disabled:opacity-60',
        emphasized ? 'border-white/16 bg-black/24' : 'border-white/8 bg-white/4',
      ].join(' ')}
    >
      <span className="block text-[0.62rem] font-black uppercase tracking-[0.18em] text-[var(--fz-text-muted)]">{label}</span>
      <span className="block text-[1rem] font-black text-white">{value}</span>
    </button>
  );
}

function WheelColumn({
  options,
  selectedValue,
  onSelect,
  suffix,
  emptyLabel = '--',
}: {
  options: readonly string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  suffix?: string;
  emptyLabel?: string;
}) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const hasInitializedScrollRef = useRef(false);

  useEffect(() => {
    if (hasInitializedScrollRef.current) {
      return;
    }

    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option === selectedValue),
    );
    const nextScrollTop = selectedIndex * wheelItemHeight;
    const element = scrollAreaRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = nextScrollTop;
    hasInitializedScrollRef.current = true;
  }, [options, selectedValue]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  function commitCenteredValue(scrollTop: number) {
    const nextIndex = Math.max(0, Math.min(options.length - 1, Math.round(scrollTop / wheelItemHeight)));
    const nextValue = options[nextIndex] ?? '';
    if (nextValue !== selectedValue) {
      onSelect(nextValue);
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const nextScrollTop = element.scrollTop;
    commitCenteredValue(nextScrollTop);

    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      element.scrollTo({
        top: Math.round(nextScrollTop / wheelItemHeight) * wheelItemHeight,
        behavior: 'auto',
      });
    }, 180);
  }

  return (
    <div className="relative h-80 overflow-hidden rounded-[1.7rem] bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-14 bg-gradient-to-b from-black via-black/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-14 bg-gradient-to-t from-black via-black/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-1/2 z-30 h-14 -translate-y-1/2 rounded-[1.05rem] border border-white/75 bg-white/[0.015] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
      />
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="relative z-10 h-full snap-y snap-proximity overflow-y-auto overscroll-contain scrollbar-none"
      >
        <div style={{ height: `${wheelCenterPadding}px` }} />
        {options.map((option) => {
          const displayValue = option || emptyLabel;

          return (
            <button
              key={`${suffix ?? 'value'}-${displayValue}`}
              type="button"
              data-picker-selected={option === selectedValue ? 'true' : 'false'}
              onClick={() => onSelect(option)}
              className="flex h-16 w-full snap-center items-center justify-center gap-2 px-4 text-center text-[1.05rem] font-black text-white transition"
            >
              <span>{displayValue}</span>
              {suffix ? <span className="text-white/72">{suffix}</span> : null}
            </button>
          );
        })}
        <div style={{ height: `${wheelCenterPadding}px` }} />
      </div>
    </div>
  );
}

export function SongFormFields({ values, onChange, disabled = false }: SongFormFieldsProps) {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null);
  const [isLyricsFocused, setIsLyricsFocused] = useState(false);
  const lyricsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = lyricsTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [values.lyrics]);

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

  function handleInputChange(field: 'title') {
    return (event: ChangeEvent<HTMLInputElement>) => {
      updateField(field, event.target.value);
    };
  }

  function handleDurationChange(field: 'durationMinutes' | 'durationSeconds', value: string) {
    updateField(field, value);
  }

  function handleLyricsFocus() {
    setIsLyricsFocused(true);
  }

  function handleLyricsBlur(event: FocusEvent<HTMLTextAreaElement>) {
    const nextFocusedElement = event.relatedTarget;
    if (nextFocusedElement instanceof HTMLElement && nextFocusedElement.dataset.lyricsShortcut === 'true') {
      return;
    }

    setIsLyricsFocused(false);
  }

  function insertLyricsBlock(blockLabel: string) {
    const textarea = lyricsTextareaRef.current;
    const currentValue = values.lyrics;

    if (!textarea) {
      updateField('lyrics', currentValue ? `${currentValue}\n\n${blockLabel}\n` : `${blockLabel}\n`);
      return;
    }

    const selectionStart = textarea.selectionStart ?? currentValue.length;
    const selectionEnd = textarea.selectionEnd ?? currentValue.length;
    const prefix = currentValue.slice(0, selectionStart);
    const suffix = currentValue.slice(selectionEnd);
    const needsLeadingBreak = prefix.length > 0 && !prefix.endsWith('\n') ? '\n' : '';
    const needsExtraGap = prefix.length > 0 ? '\n' : '';
    const insertion = `${needsLeadingBreak}${needsExtraGap}${blockLabel}\n`;
    const nextValue = `${prefix}${insertion}${suffix}`;
    const nextCursorPosition = prefix.length + insertion.length;

    updateField('lyrics', nextValue);
    setIsLyricsFocused(true);

    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    }, 0);
  }

  return (
    <>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Titre</span>
          <input
            value={values.title}
            onChange={handleInputChange('title')}
            placeholder="Ex. Last Train Home"
            disabled={disabled}
            className="fz-input text-base"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <PickerTrigger
            label="Etat"
            value={songStatusOptions.find((option) => option.value === values.status)?.label ?? values.status}
            onClick={() => setActivePicker('status')}
            disabled={disabled}
          />
          <PickerTrigger
            label="Tonalite"
            value={values.key || '--'}
            onClick={() => setActivePicker('key')}
            disabled={disabled}
          />
          <PickerTrigger
            label="TEMPO"
            value={values.bpm ? `${values.bpm} BPM` : '--'}
            onClick={() => setActivePicker('bpm')}
            disabled={disabled}
          />
          <PickerTrigger
            label="Duree"
            value={formatDurationLabel(values.durationMinutes, values.durationSeconds)}
            onClick={() => setActivePicker('duration')}
            disabled={disabled}
          />
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Notes</span>
          <textarea
            value={values.notes}
            onChange={handleTextAreaChange('notes')}
            rows={4}
            placeholder="Repere scene, structure, remarques..."
            disabled={disabled}
            className="fz-input min-h-28 resize-y text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.2em] text-[var(--fz-text-muted)]">Paroles</span>
          {isLyricsFocused ? (
            <div
              className="sticky z-20 mb-3 rounded-[1rem] bg-[var(--fz-panel-strong)] py-1"
              style={{ top: 'calc(var(--fz-header-height, 64px) + var(--fz-viewport-offset-top, 0px) + 76px)' }}
            >
              <div className="overflow-x-auto scrollbar-none">
                <div className="flex min-w-max items-center gap-2 px-1 py-1">
                  {lyricsBlockOptions.map((blockLabel) => (
                    <button
                      key={blockLabel}
                      type="button"
                      data-lyrics-shortcut="true"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertLyricsBlock(blockLabel)}
                      className="rounded-[0.85rem] border border-white/10 bg-black/18 px-3 py-2 text-sm font-black text-white/82 transition hover:bg-white/8"
                    >
                      {blockLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <textarea
            ref={lyricsTextareaRef}
            value={values.lyrics}
            onChange={handleTextAreaChange('lyrics')}
            onFocus={handleLyricsFocus}
            onBlur={handleLyricsBlur}
            rows={10}
            placeholder="Couplets, refrains, accords..."
            disabled={disabled}
            className="fz-input min-h-52 resize-none overflow-hidden text-sm leading-7"
          />
        </label>

      </div>

      {activePicker === 'status' ? (
        <PickerDialog title="Statut de creation" onClose={() => setActivePicker(null)}>
          <div className="grid grid-cols-3 gap-3">
            {songStatusOptions.map((statusOption) => {
              const isSelected = values.status === statusOption.value;
              return (
                <button
                  key={statusOption.value}
                  type="button"
                  data-picker-selected={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    updateField('status', statusOption.value);
                    setActivePicker(null);
                  }}
                  className={[
                    'rounded-2xl px-4 py-4 text-sm font-black transition',
                    isSelected ? 'bg-indigo-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]' : 'bg-white/6 text-white/78',
                  ].join(' ')}
                >
                  {statusOption.label}
                </button>
              );
            })}
          </div>
        </PickerDialog>
      ) : null}

      {activePicker === 'key' ? (
        <PickerDialog title="Selectionner la Tonalite" onClose={() => setActivePicker(null)}>
          <div className="grid grid-cols-4 gap-3">
            {keyOptions.map((keyOption) => {
              const displayValue = keyOption || '--';
              const isSelected = values.key === keyOption;

              return (
                <button
                  key={displayValue}
                  type="button"
                  data-picker-selected={isSelected ? 'true' : 'false'}
                  onClick={() => {
                    updateField('key', keyOption);
                    setActivePicker(null);
                  }}
                  className={[
                    'rounded-2xl px-4 py-4 text-sm font-black transition',
                    isSelected ? 'bg-emerald-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'bg-white/6 text-white/78',
                  ].join(' ')}
                >
                  {displayValue}
                </button>
              );
            })}
          </div>
        </PickerDialog>
      ) : null}

      {activePicker === 'bpm' ? (
        <PickerDialog title="Selectionner le tempo" description="Faites defiler de 30 a 300 BPM" closeLabel="OK" onClose={() => setActivePicker(null)}>
          <WheelColumn options={bpmOptions} selectedValue={values.bpm} onSelect={(value) => updateField('bpm', value)} suffix="BPM" />
        </PickerDialog>
      ) : null}

      {activePicker === 'duration' ? (
        <PickerDialog title="Selectionner la duree" description="Minutes et secondes" closeLabel="OK" onClose={() => setActivePicker(null)}>
          <div className="grid grid-cols-2 gap-4">
            <WheelColumn
              options={durationMinuteOptions}
              selectedValue={values.durationMinutes}
              onSelect={(value) => handleDurationChange('durationMinutes', value)}
              suffix="min"
            />
            <WheelColumn
              options={durationSecondOptions}
              selectedValue={values.durationSeconds}
              onSelect={(value) => handleDurationChange('durationSeconds', value)}
              suffix="sec"
            />
          </div>
        </PickerDialog>
      ) : null}
    </>
  );
}
