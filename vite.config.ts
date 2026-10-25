import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/** Build label for bug reports: the commit (with + if there were uncommitted changes) and the date. */
function buildLabel(): string {
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain').toString().trim() ? '+' : '';
    return `${commit}${dirty} · ${new Date().toISOString().slice(0, 10)}`;
  } catch {
    return `dev · ${new Date().toISOString().slice(0, 10)}`;
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  define: { 'import.meta.env.VITE_BUILD': JSON.stringify(buildLabel()) },
  // `--mode artifact` builds the claude.ai artifact: stable file names so
  // republishing replaces files instead of piling up hashed copies.
  build:
    mode === 'artifact'
      ? {
          outDir: 'dist-artifact',
          rollupOptions: { output: { entryFileNames: 'assets/app.js', assetFileNames: 'assets/[name][extname]' } },
        }
      : {},
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
}));
