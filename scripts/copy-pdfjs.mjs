// Copies the pdf.js engine out of node_modules into bundled app assets so PDF
// import works fully offline (PLAN.md Milestone 2.5). Runs on postinstall.
// The `.jsasset` extension is registered as a metro asset in metro.config.js.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build');
const target = join(root, 'assets', 'pdfjs');

mkdirSync(target, { recursive: true });
copyFileSync(join(source, 'pdf.min.mjs'), join(target, 'pdf.min.jsasset'));
copyFileSync(join(source, 'pdf.worker.min.mjs'), join(target, 'pdf.worker.min.jsasset'));

const { version } = JSON.parse(
  readFileSync(join(root, 'node_modules', 'pdfjs-dist', 'package.json'), 'utf8'),
);
console.log(`assets/pdfjs ready (pdfjs-dist ${version})`);
