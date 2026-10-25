/**
 * The Dragon's Lair round-1 ambush, played the way a player would: Provoke, Empower + Ready Crit
 * (or Shadowstep) + Backstab, then everyone's biggest hit on the sleeping Dragon. Reports how often
 * it dies in round 1 and, with --full, how the battle ends (the smart bot plays on).
 *   npm run data:lair-combo -- [100] [--full]
 */
import { eligiblePlayers } from '../src/engine/calibration';
import type { HeroGamePick } from '../src/engine/horde';
import { computePool, seasonTier } from '../src/engine/rating';
import { smartAutoplay } from '../src/engine/smartBot';
import { performAction, type BattleState } from '../src/engine/combat';
import { playerGamesInWeek, prepareBattle } from '../src/engine/week';
import { CLASSES, tierIndex } from '../src/rules';
import { loadSeasonFile } from './load-season';
const data = loadSeasonFile();
const players = eligiblePlayers(data);
const n = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 100);
const full = process.argv.includes('--full');
let seed = 7;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const tryAct = (s: BattleState, heroId: string, actionId: string, targetIds: string[] = []) => {
  try {
    return performAction(s, { heroId: heroId as never, actionId, targetIds });
  } catch {
    return s;
  }
};
let killed = 0,
  wonKilled = 0,
  wonSurvived = 0;
const left: number[] = [];
for (let i = 0; i < n; i++) {
  const week = data.weeks[Math.floor(rand() * data.weeks.length)];
  const draw = players.filter(() => rand() < 0.33);
  const used = new Set<number>();
  const picks: HeroGamePick[] = [];
  for (const c of CLASSES) {
    const best = draw
      .filter((p) => !used.has(p.id) && playerGamesInWeek(data, week, p.id).length > 0)
      .sort((a, b) => tierIndex(seasonTier(c, b.avg)) - tierIndex(seasonTier(c, a.avg)))[0];
    if (!best) continue;
    used.add(best.id);
    const gameId = playerGamesInWeek(data, week, best.id)
      .map((g) => ({
        g,
        pool: computePool(
          c,
          data.games[g].lines.find((l) => l.playerId === best.id)!,
        ).pool,
      }))
      .sort((a, b) => b.pool - a.pool)[0].g;
    picks.push({ heroClass: c, playerId: best.id, gameId });
  }
  let s = prepareBattle(picks, data, undefined, 'dragon-lair').battle;
  const D = s.enemies.find((e) => e.kind === 'dragon')!.id;
  const hpOf = (x: BattleState) => x.enemies.find((e) => e.id === D)!.hp;
  s = tryAct(s, 'warrior', 'provoke', [D]);
  s = tryAct(s, 'cleric', 'empower', ['rogue']);
  const crit = tryAct(s, 'rogue', 'shadowstep');
  s = crit !== s ? crit : tryAct(s, 'rogue', 'ready-crit');
  s = tryAct(s, 'rogue', 'backstab', [D]);
  for (const [h, ids] of [
    ['ranger', ['aimed-shot', 'double-strike', 'longbow']],
    ['wizard', ['lightning-bolt', 'magic-missile', 'staff']],
    ['warrior', ['shield-bash', 'axe']],
    ['cleric', ['holy-strike', 'mace']],
    ['rogue', ['dagger']],
  ] as const) {
    let best = s;
    for (const id of ids) {
      const t = tryAct(s, h, id, id === 'double-strike' ? [D, D] : [D]);
      if (hpOf(t) < hpOf(best)) best = t;
    }
    s = best;
  }
  const dead = !s.enemies.find((e) => e.id === D)!.alive;
  if (dead) killed++;
  else left.push(Math.round((hpOf(s) / s.enemies.find((e) => e.id === D)!.maxHp) * 100));
  if (full) {
    const end = smartAutoplay(s);
    if (end.phase === 'won') dead ? wonKilled++ : wonSurvived++;
  }
}
left.sort((a, b) => a - b);
console.log(`combo kills the Dragon in round 1: ${killed}/${n}; survivors' HP left %: ${left.join(' ')}`);
if (full) console.log(`win after kill ${wonKilled}/${killed}, win after failed ambush ${wonSurvived}/${n - killed}`);
