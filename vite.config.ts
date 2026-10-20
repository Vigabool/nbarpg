import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
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
