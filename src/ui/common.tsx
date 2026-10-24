import { useEffect, useState, type ReactNode } from 'react';
import type { SeasonData } from '../data/types';
import { rules, type HeroClass, type Tier } from '../rules';

export const CLASS_ICON: Record<HeroClass, string> = {
  warrior: '🛡️',
  ranger: '🏹',
  cleric: '✨',
  rogue: '🗡️',
  wizard: '🔮',
};

export const TIER_LABEL: Record<Tier, string> = {
  cold: 'Cold',
  average: 'Average',
  good: 'Good',
  great: 'Great',
  elite: 'Elite',
};

export function TierChip({ tier, prefix }: { tier: Tier; prefix?: string }) {
  return (
    <span className={`chip tier tier-${tier}`}>
      {prefix ? `${prefix} ` : ''}
      {TIER_LABEL[tier]}
    </span>
  );
}

export function ClassName({ c }: { c: HeroClass }) {
  return (
    <span>
      <span aria-hidden>{CLASS_ICON[c]}</span> {rules.classes[c].name}
    </span>
  );
}

export function Bar({ value, max, kind, label }: { value: number; max: number; kind: 'hp' | 'pool' | 'cap'; label?: ReactNode }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const extra = kind === 'hp' && pct > 50 ? ' ok' : kind === 'cap' && value > max ? ' over' : '';
  return (
    <div>
      {label && <div className="spread tiny muted num">{label}</div>}
      <div className={`bar ${kind}${extra}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Salaries are in gold: 1 gold = $1M of game salary. */
export const money = (m: number) => `${m} gold`;

export const gamesCount = (n: number) => `${n} game${n === 1 ? '' : 's'}`;

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function weekLabel(data: SeasonData, index: number): string {
  const w = data.weeks.find((x) => x.index === index);
  if (!w) return `Week ${index}`;
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `Week ${w.index} · ${fmt(w.start)}–${fmt(w.end)}`;
}

export function statLine(l: { pts: number; reb: number; ast: number; stl: number; blk: number; fg3m: number; tov: number; min: number }): string {
  const parts = [`${l.pts} PTS`, `${l.reb} REB`, `${l.ast} AST`];
  if (l.stl) parts.push(`${l.stl} STL`);
  if (l.blk) parts.push(`${l.blk} BLK`);
  if (l.fg3m) parts.push(`${l.fg3m} 3PM`);
  if (l.tov) parts.push(`${l.tov} TO`);
  return parts.join(' · ');
}

/**
 * A button that asks for a second tap before acting. Used instead of
 * window.confirm(), which some embedded viewers block.
 */
export function ConfirmButton({
  className,
  disabled,
  needsConfirm = true,
  confirmLabel,
  onConfirm,
  children,
}: {
  className?: string;
  disabled?: boolean;
  needsConfirm?: boolean;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={`${className ?? 'btn'}${armed ? ' armed' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (!needsConfirm || armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
