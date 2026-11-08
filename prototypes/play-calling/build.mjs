/**
 * Builds the prototype into one self-contained page for publishing as its own artifact.
 * Run from the repo root: node prototypes/play-calling/build.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'prototypes/play-calling';
execSync(`npx vite build --config ${dir}/vite.config.ts`, { stdio: 'inherit' });
const js = readFileSync(`${dir}/dist/app.js`, 'utf8');
const css = readFileSync(`${dir}/dist/index.css`, 'utf8');
const html = readFileSync(`${dir}/index.html`, 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
// Keep the title, the claude meta and the font links; tags may span several lines.
const keep = (head.match(/<title>[\s\S]*?<\/title>|<(meta name="claude|link)[\s\S]*?>/g) ?? []).map((t) => t.replace(/\s+/g, ' ')).join('\n');
const page = `${keep}\n<style>${css}</style>\n<div id="root"></div>\n<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>\n`;
writeFileSync(`${dir}/dist/page.html`, page);
console.log(`Wrote ${dir}/dist/page.html (${Math.round(page.length / 1024)} KB)`);
