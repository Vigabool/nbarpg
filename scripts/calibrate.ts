/**
 * Computes tier thresholds from the season's game logs and writes a report to
 * docs/calibration-<season>.md. Pass --apply to write the suggested thresholds
 * into src/rules/tiers.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { calibrate, summarizeSalaries } from '../src/engine/calibration';
import { TIERS, rules, type HeroClass } from '../src/rules';
import { loadSeasonFile } from './load-season';

const apply = process.argv.includes('--apply');
const data = loadSeasonFile();
const results = calibrate(data);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const cal = rules.calibration;

const lines: string[] = [];
lines.push(`# Tier calibration — ${data.season}`, '');
if (data.synthetic) lines.push('> **SYNTHETIC DATA.** These numbers come from the test fixture, not real games. Do not apply them.', '');
lines.push(
  `Generated ${new Date().toISOString().slice(0, 10)} from ${data.source}.`,
  '',
  `Sample: nights with ${cal.minMinutes}+ minutes, from each class's comparison pool. ` +
    `Tier cutoffs at percentiles ${cal.percentiles.average} / ${cal.percentiles.good} / ${cal.percentiles.great} / ${cal.percentiles.elite} ` +
    '(Average / Good / Great / Elite).',
  '',
  '| Class | Pool | Nights | Current (Avg/Good/Great/Elite) | Suggested | Tier mix now (C/A/G/Gr/E) | Tier mix suggested |',
  '| --- | --- | --- | --- | --- | --- | --- |',
);
for (const r of results) {
  const fmt = (t: typeof r.current) => `${t.average} / ${t.good} / ${t.great} / ${t.elite}`;
  const mix = (s: typeof r.currentShare) => TIERS.map((t) => pct(s[t])).join(' / ');
  lines.push(
    `| ${rules.classes[r.heroClass].name} | ${cal.comparisonPools[r.heroClass].description} | ${r.sampleSize} | ${fmt(r.current)} | ${fmt(r.suggested)} | ${mix(r.currentShare)} | ${mix(r.suggestedShare)} |`,
  );
}
const sal = summarizeSalaries(data);
lines.push(
  '',
  '## Salaries (current thresholds)',
  '',
  `Eligible players: ${sal.eligiblePlayers}. Best-tier counts: ${TIERS.map((t) => `${t} ${sal.byTier[t]}`).join(', ')}. ` +
    `Versatile (Great+ in 2+ classes): ${sal.versatile}. The 8 most expensive players cost $${sal.top8Cost}M against a $${rules.salary.cap}M cap.`,
  '',
);
writeFileSync(`docs/calibration-${data.season}.md`, lines.join('\n'));
console.log(lines.join('\n'));

if (apply) {
  if (data.synthetic) {
    console.error('\nRefusing to --apply thresholds computed from synthetic data.');
    process.exit(1);
  }
  const path = 'src/rules/tiers.json';
  const tiers = JSON.parse(readFileSync(path, 'utf8'));
  for (const r of results) tiers.thresholds[r.heroClass as HeroClass] = r.suggested;
  tiers.thresholdSource = `calibrated from ${data.season} game logs (${new Date().toISOString().slice(0, 10)})`;
  writeFileSync(path, JSON.stringify(tiers, null, 2) + '\n');
  console.log(`\nApplied suggested thresholds to ${path}.`);
}
