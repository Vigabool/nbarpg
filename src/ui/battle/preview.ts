import { previewRound, type BattleState } from '../../engine/combat';
import type { Intent } from './parts';

/**
 * What ending the round now would do, as the battle screen shows it: each enemy's and summon's
 * intent, the heroes who'd fall, and who hits each hero for how much.
 */
export function roundPreview(state: BattleState) {
  const intents: Record<string, Intent> = {};
  const summonIntents: Record<string, string[]> = {};
  const preview = previewRound(state);
  const doomed = new Set<string>(state.heroes.filter((h) => h.alive && !preview.after.heroes.find((x) => x.id === h.id)?.alive).map((h) => h.id));
  const incoming: Record<string, Record<string, number>> = {};
  for (const l of preview.log)
    for (const [heroId, n] of Object.entries(l.hits ?? {})) {
      const by = (incoming[heroId] ??= {});
      if (l.actorId) by[l.actorId] = (by[l.actorId] ?? 0) + n;
    }
  for (const l of preview.log) {
    if (l.side === 'summon' && l.actorId) {
      (summonIntents[l.actorId] ??= []).push(l.short ?? l.text);
      continue;
    }
    const e = state.enemies.find((x) => x.id === l.actorId);
    if (!e) continue;
    const i = (intents[e.id] ??= { short: [], full: [] });
    i.short.push(l.short ?? l.text);
    i.full.push(l.text);
  }
  return { intents, summonIntents, doomed, incoming };
}
