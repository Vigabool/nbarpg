import { useState, type ReactNode } from 'react';
import type { EnemyState } from '../../engine/combat';
import type { Tier } from '../../rules';
import { behaviorOf, encounterIds, encounterOf, monsterIcon, monsterName, monsterShort } from '../../engine/encounter';
import { TIER_LABEL } from '../common';

/** Goblins with the same team and damage share one card. */
export function groupGoblins(goblins: EnemyState[]): EnemyState[][] {
  const groups = new Map<string, EnemyState[]>();
  for (const g of goblins) {
    const key = `${g.name}|${g.damage}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  return [...groups.values()];
}

export function Meter({ value, max, kind }: { value: number; max: number; kind: 'hp' | 'pool' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter ${kind}${kind === 'hp' && pct > 50 ? ' ok' : ''}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${pct}%` }} />
      <b className="num">{kind === 'hp' ? `${value}/${max}` : value}</b>
    </div>
  );
}

/** A compact status marker. Tap to show what it means. */
export function Tag({ icon, text, tone = '', passThrough = false }: { icon: ReactNode; text: string; tone?: string; passThrough?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={`tag ${tone}`}
      title={text}
      aria-label={text}
      onClick={(e) => {
        // On hero rows the tap also selects the hero; on enemy cards it must not pick a target.
        if (!passThrough) e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {icon}
      {open && <span className="tag-text">{text}</span>}
    </button>
  );
}

export function TierDot({ tier }: { tier: Tier }) {
  return <span className={`tier-dot tier-${tier}`} title={`${TIER_LABEL[tier]} night`} aria-label={`${TIER_LABEL[tier]} night`} />;
}

export interface Intent {
  short: string[];
  full: string[];
}

/** A classic Warlord is a boosted Champion; an encounter boss (e.g. the Chieftain, the Lich) is its own kind. */
export const BOSS_KINDS = new Set(encounterIds().map((id) => encounterOf(id).boss));

export const isClassicWarlord = (e: EnemyState) => e.isWarlord && !BOSS_KINDS.has(e.kind);

/** Wraiths drain every hero instead of attacking one, so their number gets a different mark. */
export const dmgMark = (e: EnemyState, enc?: string) => (behaviorOf(e.kind, enc) === 'wraith' ? '💧' : '⚔');

export const foeShort = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? 'Warlord' : monsterShort(e.kind, enc));

export const foeName = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? `Warlord ${monsterName(e.kind, enc)}` : monsterName(e.kind, enc));

export const foeIcon = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? '👑' : monsterIcon(e.kind, enc));
