#!/usr/bin/env node
/**
 * Turn the raw match footage into web clips.
 *
 *   node scripts/encode-clips.mjs [sourceDir]
 *
 * Reads .mov files from footage/severn (or sourceDir) and writes, for each one,
 * a muted H.264 .mp4 plus a poster .jpg into public/clips/severn.
 *
 * Audio is dropped on purpose: autoplay only works muted, and it halves the file.
 * Re-runs skip any clip whose .mp4 is already newer than its source.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { slugFor } from './clip-slugs.mjs';

const SRC = resolve(process.argv[2] ?? 'footage/severn');
const OUT = resolve('public/clips/severn');
const CRF = process.env.CRF ?? '26';

mkdirSync(OUT, { recursive: true });

const ff = (args) => execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', ...args]);

const movs = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.mov')).sort();
if (!movs.length) {
  console.error(`No .mov files in ${SRC}`);
  process.exit(1);
}

let made = 0;
for (const name of movs) {
  const src = join(SRC, name);
  const slug = slugFor(name);
  const mp4 = join(OUT, `${slug}.mp4`);
  const jpg = join(OUT, `${slug}.jpg`);

  if (existsSync(mp4) && statSync(mp4).mtimeMs > statSync(src).mtimeMs) {
    console.log(`skip  ${slug}`);
    continue;
  }

  // -2 keeps the height even, which the odd source dimensions (1034x500, 1294x596) need.
  ff(['-i', src, '-an', '-c:v', 'libx264', '-crf', CRF, '-preset', 'slow',
      '-vf', "scale='min(960,iw)':-2", '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  ff(['-ss', '0.5', '-i', src, '-frames:v', '1', '-vf', "scale='min(960,iw)':-2", '-q:v', '6', jpg]);

  const mb = (statSync(mp4).size / 1048576).toFixed(2);
  console.log(`ok    ${slug}  ${mb} MB`);
  made += 1;
}
console.log(`\n${made} encoded, ${movs.length - made} skipped.`);
