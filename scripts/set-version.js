// Set the extension version in both places that carry it.
//
//   npm run set-version -- 1.0.0
//
// src/manifest.json is what the Chrome Web Store reads; package.json is kept in
// step so the release zip is named after the same number. package.js refuses to
// build if the two disagree.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const next = process.argv[2];

// Chrome allows 1 to 4 dot-separated integers, each 0-65535, no leading zeros.
const VALID = /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/;

if (!next) {
  console.error('usage: npm run set-version -- <version>   e.g. 1.0.0');
  process.exit(1);
}
if (!VALID.test(next) || next.split('.').some((part) => Number(part) > 65535)) {
  console.error(`✗ "${next}" is not a valid Chrome extension version.`);
  console.error('  Use 1-4 dot-separated integers, each 0-65535, no leading zeros. e.g. 1.0.0');
  process.exit(1);
}

/** Compare dotted versions numerically, padding the shorter one with zeros. */
function compare(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const manifestPath = resolve(root, 'src/manifest.json');
const pkgPath = resolve(root, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const current = manifest.version;

// The store rejects an upload whose version is not higher than the last one, so
// warn early rather than at upload time.
if (compare(next, current) <= 0) {
  console.warn(`⚠ ${next} is not higher than the current ${current}.`);
  console.warn('  The Chrome Web Store rejects uploads that do not increase the version.');
}

manifest.version = next;
pkg.version = next;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`✓ version ${current} -> ${next}  (src/manifest.json, package.json)`);
console.log('  next: npm run package');
