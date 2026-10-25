import { BUILD } from './build';
import type { SaveGame } from './game';

/** A plain-text report to paste into a message: what broke, which build, and where in the run. */
export function errorReport(error: Error, save: SaveGame | null): string {
  const b = save?.battle;
  const where = save
    ? [
        `Phase: ${save.phase} · week ${save.weekIndex} · encounter ${save.encounter ?? 'default'}`,
        b
          ? `Battle: round ${b.round}, wave ${b.waveIndex + 1}/${b.waveCount}, heroes standing ${b.heroes.filter((h) => h.alive).length}/${b.heroes.length}`
          : '',
        `Last log: ${b?.log.at(-1)?.text ?? '–'}`,
      ].filter(Boolean)
    : ['No saved run'];
  return [
    `NBA Fantasy RPG error report`,
    `Build: ${BUILD}`,
    `Time: ${new Date().toISOString()}`,
    `Error: ${error.message}`,
    ...where,
    `Browser: ${navigator.userAgent}`,
    '',
    (error.stack ?? '').split('\n').slice(0, 12).join('\n'),
  ].join('\n');
}
