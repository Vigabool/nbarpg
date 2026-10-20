/**
 * Builds the app for publishing as a claude.ai artifact. The artifact host
 * supplies <html>/<head>/<body>, so the published page is just the head tags
 * and body content of Vite's index.html.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --mode artifact', { stdio: 'inherit' });
const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => /^<(title|link rel="stylesheet"|script)/.test(l))
  // The host adds its own charset and viewport metas.
  .join('\n');
writeFileSync('dist-artifact/page.html', `${keep}\n${body.trim()}\n`);
console.log('Wrote dist-artifact/page.html');
