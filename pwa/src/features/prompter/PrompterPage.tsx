import { FeatureCard } from '@/components/FeatureCard';
import { StatusPill } from '@/components/StatusPill';

export function PrompterPage() {
  return (
    <div className="space-y-4">
      <FeatureCard
        eyebrow="Prompter"
        title="Mode scene lisible"
        description="Le prompter PWA reprend l'esprit de l'app Expo: paroles larges, repere stable et lecture utilisable en repet comme sur scene."
        aside="Draft"
      >
        <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-black text-white">Caught In The Echo</p>
              <p className="mt-1 text-sm text-[var(--fz-text-muted)]">Foo Fighters · 120 BPM · Am</p>
            </div>
            <div className="fz-card-soft rounded-2xl px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/85">
              Live
            </div>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-white/6 bg-white/4 px-4 py-4 text-[1.02rem] leading-8 text-white/92">
            <p className="m-0">
              [Am] Caught in the echo
              <br />
              We hold the line when the lights go low
              <br />
              [F] Hearts on fire, feet on the floor
              <br />
              The room keeps asking for a little more
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <StatusPill label="Auto-scroll" tone="accent" />
          <StatusPill label="Accords lisibles" />
          <StatusPill label="Grand texte" tone="success" />
        </div>
      </FeatureCard>
    </div>
  );
}
