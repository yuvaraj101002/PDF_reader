// Generates all app-icon / splash / favicon PNGs from one SVG design.
// Run: npm run generate:brand   (rerun after tweaking the art below)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

// ── design ──────────────────────────────────────────────────────────────────
// Warm & friendly brand: raspberry→violet gradient, open white book with a
// heart bookmark feel — matches src/ui/app-theme.ts.

const GRADIENT = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F97B9E"/>
    <stop offset="1" stop-color="#8B7AE0"/>
  </linearGradient>`;

/** heart, drawn in a 512-unit box centered on (256, 272) */
const HEART_PATH =
  'M256 464 C 256 464 48 328 48 200 C 48 128 104 80 168 80 ' +
  'C 208 80 240 100 256 128 C 272 100 304 80 344 80 ' +
  'C 408 80 464 128 464 200 C 464 328 256 464 256 464 Z';

/** 4-point sparkle in a 56-unit box centered on origin */
const SPARKLE_PATH = 'M 0 -28 L 8 -8 L 28 0 L 8 8 L 0 28 L -8 8 L -28 0 L -8 -8 Z';

/** the artwork, drawn for a 1024×1024 frame (no background) */
function art({ silhouette = false, sparkleColor = '#FFFFFF' } = {}) {
  const page = '#FFFFFF';
  const crease = silhouette ? '#FFFFFF' : '#E8DCEA';
  const lines = silhouette ? '#FFFFFF' : '#C9BAD9';
  const heart = silhouette ? '#FFFFFF' : '#FFD9E4';
  const sparkle = silhouette ? '#FFFFFF' : sparkleColor;
  return `
  <g>
    <!-- soft ground shadow -->
    ${silhouette ? '' : '<ellipse cx="512" cy="712" rx="238" ry="26" fill="#000000" opacity="0.10"/>'}
    <!-- book cover peeking under the pages -->
    <path d="M 512 442 C 450 402, 340 396, 266 422 L 266 690 C 340 664, 450 670, 512 708
             C 574 670, 684 664, 758 690 L 758 422 C 684 396, 574 402, 512 442 Z"
          fill="${silhouette ? '#FFFFFF' : '#6B5BC7'}"/>
    <!-- open pages -->
    <path d="M 512 420 C 455 382, 352 376, 284 400 L 284 668 C 352 644, 455 650, 512 686 Z"
          fill="${page}"/>
    <path d="M 512 420 C 569 382, 672 376, 740 400 L 740 668 C 672 644, 569 650, 512 686 Z"
          fill="${page}"/>
    <!-- spine crease -->
    <path d="M 512 424 L 512 682" stroke="${crease}" stroke-width="7" stroke-linecap="round"/>
    ${
      silhouette
        ? ''
        : `
    <!-- text lines -->
    <g stroke="${lines}" stroke-width="14" stroke-linecap="round">
      <path d="M 328 466 L 462 452"/>
      <path d="M 328 514 L 462 500"/>
      <path d="M 328 562 L 462 548"/>
      <path d="M 328 610 L 430 598"/>
      <path d="M 562 452 L 696 466"/>
      <path d="M 562 500 L 696 514"/>
      <path d="M 562 548 L 696 562"/>
      <path d="M 594 598 L 696 610"/>
    </g>`
    }
    <!-- floating heart -->
    <g transform="translate(742 250) rotate(14) scale(0.30) translate(-256 -272)">
      <path d="${HEART_PATH}" fill="${heart}"/>
    </g>
    <!-- sparkles -->
    <g fill="${sparkle}" opacity="${silhouette ? 1 : 0.9}">
      <g transform="translate(272 262)"><path d="${SPARKLE_PATH}"/></g>
      <g transform="translate(322 348) scale(0.55)"><path d="${SPARKLE_PATH}"/></g>
      <g transform="translate(236 608) scale(0.7)"><path d="${SPARKLE_PATH}"/></g>
    </g>
  </g>`;
}

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${GRADIENT}</defs>${body}</svg>`;

/** scale the art about the canvas center (adaptive-icon safe zone etc.) */
const scaled = (factor, options) =>
  `<g transform="translate(512 512) scale(${factor}) translate(-512 -512)">${art(options)}</g>`;

const FULL_BG = '<rect width="1024" height="1024" fill="url(#bg)"/>';

const ASSETS = [
  // full-square app icon (OS rounds the corners itself)
  { file: 'icon.png', size: 1024, body: FULL_BG + scaled(1.02) },
  // android adaptive layers: art inside the ~66% safe zone
  { file: 'android-icon-foreground.png', size: 1024, body: scaled(0.62) },
  { file: 'android-icon-background.png', size: 1024, body: FULL_BG },
  { file: 'android-icon-monochrome.png', size: 1024, body: scaled(0.62, { silhouette: true }) },
  // splash logo on transparent (splash backgroundColor comes from app.json);
  // sparkles tinted — white would vanish on the cream splash background
  { file: 'splash-icon.png', size: 512, body: scaled(1.12, { sparkleColor: '#C9B4F2' }) },
  { file: 'favicon.png', size: 48, body: FULL_BG + scaled(1.02) },
];

await mkdir(OUT, { recursive: true });
for (const { file, size, body } of ASSETS) {
  await sharp(Buffer.from(svg(body)), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, file));
  console.log(`✓ ${file} (${size}×${size})`);
}
