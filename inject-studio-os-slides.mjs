/**
 * Inject Studio OS slides into docs/client-deck/client-deck.html (after Vini Pricing).
 *
 * Usage:
 *   node docs/client-deck/inject-studio-os-slides.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { injectStudioOsIntoDeckHtml } from './studio-os-slides.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_PATH = join(__dirname, 'client-deck.html');
const PUBLIC_DECK = join(__dirname, '..', '..', 'public', 'client-deck');

const before = readFileSync(DECK_PATH, 'utf8');
const after = injectStudioOsIntoDeckHtml(before);
writeFileSync(DECK_PATH, after, 'utf8');

const labels = [...after.matchAll(/data-pitch-label="([^"]+)"/g)].map((m) => m[1]);
const start = labels.indexOf('Vini Pricing');
console.log(`Updated ${DECK_PATH}`);
console.log(`Slides: ${labels.length}`);
labels.forEach((l, i) => {
  const mark = i > start && i < labels.indexOf('Built for Dealerships') ? ' ← studio' : '';
  console.log(`${String(i + 1).padStart(2)}. ${l}${mark}`);
});

// Mirror into public/ so http://127.0.0.1:5174/client-deck/ serves the deck
if (existsSync(join(__dirname, '..', '..', 'public'))) {
  spawnSync(
    'rsync',
    ['-a', '--delete', '--exclude', '*.mjs', '--exclude', 'README.md', `${__dirname}/`, PUBLIC_DECK],
    { stdio: 'inherit' },
  );
  console.log(`Synced → ${PUBLIC_DECK}`);
}
