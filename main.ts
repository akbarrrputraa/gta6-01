// Solmar Bay — the make.fun gta6-01 entrypoint (Node 22, standard library only).
//
// The game lives in game/ as plain static files: game/index.html plus its ES
// modules and the vendored three.js build under game/vendor/. This program
// hands it in: it copies game/ and screenshots/ next to this file into the
// output directory and writes /output/dossier.json with the vendored
// make.fun library, which the scorer rebuilds and compares byte for byte.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deterministic: same input files, same output bytes, every time.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Count the plain files under a directory, recursively. */
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) n += countFiles(full);
    else if (entry.isFile()) n += 1;
  }
  return n;
}

function handIn() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  const shotsOut = join(outDir, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(repoRoot, 'screenshots');
  if (existsSync(shotsIn)) cpSync(shotsIn, shotsOut, { recursive: true });

  // The gate's own caps: only text_max_bytes shapes the dossier bytes; the
  // rest make this program refuse exactly where the scorer would refuse.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  // A one-line receipt on stdout (it changes no output bytes): how many
  // game files and screenshots were handed in, and how big the dossier is.
  const gameFiles = countFiles(join(outDir, 'game'));
  const shotFiles = existsSync(join(outDir, 'screenshots'))
    ? readdirSync(join(outDir, 'screenshots')).filter((f) => statSync(join(outDir, 'screenshots', f)).isFile()).length
    : 0;
  const dossierBytes = statSync(join(outDir, 'dossier.json')).size;
  console.log(`Solmar Bay handed in: ${gameFiles} game files, ${shotFiles} screenshots, dossier.json ${dossierBytes} bytes -> ${outDir}`);
}

handIn();
