/**
 * Plays many battles with the auto-play bot to check balance:
 *   npm run data:simulate -- [--battles 300] [--seed 1]
 */
import { rules } from '../src/rules';
import { loadSeasonFile } from './load-season';
import { simulate } from './sim-lib';

const arg = (name: string, d: number) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : d);
const data = loadSeasonFile();
const r = simulate(data, arg('--battles', 300), arg('--seed', 1));
console.log(`${data.synthetic ? '[SYNTHETIC DATA] ' : ''}${r.battles} battles with the auto-play bot (round cap ${rules.combat.roundCap})`);
console.log(`Win rate: ${(r.winRate * 100).toFixed(1)}%  (losses to round cap: ${r.roundCapLosses})`);
console.log(`Average rounds: ${r.avgRounds.toFixed(1)}  ·  heroes fallen per battle: ${r.fallenPerBattle.toFixed(2)}`);
console.log(`Waves cleared: ${r.wavesCleared.map((c, i) => `${i}: ${c}`).join('  ')}`);
console.log(`Goblin attacks per battle: ${r.goblinAttacks.toFixed(1)} (${r.goblinDamage.toFixed(1)} damage)`);
console.log(`Average starting energy: ${r.avgPool.toFixed(1)}  ·  monsters per battle: ${r.monsters.toFixed(1)} (goblins ${r.goblins.toFixed(1)})`);
