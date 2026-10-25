import { rules as defaultRules, type HeroClass, type Rules } from '../rules';
import { progressOf, type SaveGame } from './game';

export type Purchase = { kind: 'weapon' } | { kind: 'shield' } | { kind: 'gear'; id: string } | { kind: 'feat'; id: string };

/** What a purchase costs this hero now, or null if it isn't available (maxed, owned, wrong class). */
export function priceOf(game: SaveGame, c: HeroClass, p: Purchase, rules: Rules = defaultRules): number | null {
  const prog = progressOf(game, c);
  const r = rules.progression;
  switch (p.kind) {
    case 'weapon':
      return r.weapon.costs[prog.weapon] ?? null;
    case 'shield':
      return c === 'warrior' ? (r.shield.costs[prog.shield] ?? null) : null;
    case 'gear': {
      const g = r.gear[p.id];
      return g && g.heroClass === c && !prog.gear.includes(p.id) ? g.cost : null;
    }
    case 'feat': {
      const f = r.feats[p.id];
      return f && f.heroClass === c && !prog.feats.includes(p.id) ? f.cost : null;
    }
  }
}

/** Spends a hero's PP on an Armory purchase. Throws if it isn't available or affordable. */
export function buy(game: SaveGame, c: HeroClass, p: Purchase, rules: Rules = defaultRules): SaveGame {
  const cost = priceOf(game, c, p, rules);
  if (cost === null) throw new Error('Not available');
  if (game.pp[c] < cost) throw new Error(`Needs ${cost} PP`);
  const prog = { ...progressOf(game, c) };
  if (p.kind === 'weapon') prog.weapon++;
  else if (p.kind === 'shield') prog.shield++;
  else if (p.kind === 'gear') prog.gear = [...prog.gear, p.id];
  else prog.feats = [...prog.feats, p.id];
  return { ...game, pp: { ...game.pp, [c]: game.pp[c] - cost }, progress: { ...game.progress!, [c]: prog } };
}

/** PP a respec would give back: everything the hero spent on gear and feats. */
export function respecRefund(game: SaveGame, c: HeroClass, rules: Rules = defaultRules): number {
  const prog = progressOf(game, c);
  const r = rules.progression;
  return prog.gear.reduce((t, id) => t + (r.gear[id]?.cost ?? 0), 0) + prog.feats.reduce((t, id) => t + (r.feats[id]?.cost ?? 0), 0);
}

/**
 * Respec, free: returns a hero's gear and feats for a full refund so the PP can go to a different
 * build. Weapon and shield levels stay (they're plain upgrades, with nothing to swap them for).
 */
export function respec(game: SaveGame, c: HeroClass, rules: Rules = defaultRules): SaveGame {
  const refund = respecRefund(game, c, rules);
  if (!refund) return game;
  const prog = { ...progressOf(game, c), gear: [], feats: [] };
  return { ...game, pp: { ...game.pp, [c]: game.pp[c] + refund }, progress: { ...game.progress!, [c]: prog } };
}
