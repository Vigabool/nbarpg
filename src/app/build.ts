/** Which build is running, e.g. "7f8a555 · 2026-10-25", for bug reports (set in vite.config.ts). */
export const BUILD: string = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_BUILD ?? 'dev';
