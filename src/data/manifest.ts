/** public/data/seasons.json, written by `npm run data:build`: the seasons the app can load. */
export interface SeasonManifest {
  /** The season new runs start in: the newest one. */
  current: string;
  seasons: { season: string; live: boolean; weeks: number; throughDate?: string }[];
}

/** For a deploy built before the manifest existed. */
export const FALLBACK_MANIFEST: SeasonManifest = { current: '2025-26', seasons: [{ season: '2025-26', live: false, weeks: 0 }] };
