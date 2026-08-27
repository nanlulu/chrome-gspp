// Package dist/ into a versioned zip for the Chrome Web Store.
//
//   npm run package            build, then zip to releases/gsheet-plus-plus-v<version>.zip
//   npm run package -- --force overwrite an existing zip for this version
//
// dist/ is the unpacked build you load via chrome://extensions. It is never
// written to here — zips land in releases/, one per version, and an existing
// version's zip is never silently overwritten. Once a version is uploaded to
// the store its bytes should stay fixed; bump the version instead.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const releasesDir = resolve(root, 'releases');
const force = process.argv.includes('--force');

function fail(message, hint) {
  console.error(`\n✗ ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(resolve(root, 'src/manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

// Drift here means the zip name disagrees with the version the store reads out
// of the manifest — confusing later, and easy to prevent now.
if (manifest.version !== pkg.version) {
  fail(
    `version mismatch: src/manifest.json is ${manifest.version}, package.json is ${pkg.version}`,
    `run: npm run set-version -- ${manifest.version}`,
  );
}

const { version } = manifest;

if (!existsSync(resolve(distDir, 'manifest.json'))) {
  fail('dist/ has no manifest.json', 'run: npm run build');
}

mkdirSync(releasesDir, { recursive: true });
const outFile = resolve(releasesDir, `gsheet-plus-plus-v${version}.zip`);

if (existsSync(outFile) && !force) {
  fail(
    `releases/gsheet-plus-plus-v${version}.zip already exists`,
    'bump the version (npm run set-version -- <next>), or pass --force to overwrite.',
  );
}

// Chrome requires manifest.json at the archive root, so zip from inside dist/.
// -X drops extended attributes; the excludes keep macOS/editor junk out.
execFileSync(
  'zip',
  ['-r', '-X', '-q', outFile, '.', '-x', '*.DS_Store', '-x', '__MACOSX/*', '-x', '*.map'],
  { cwd: distDir, stdio: 'inherit' },
);

// Verify what we actually produced rather than assuming the zip is right.
const listing = execFileSync('unzip', ['-l', outFile], { encoding: 'utf8' });
if (!/\smanifest\.json\s*$/m.test(listing)) {
  fail('manifest.json is not at the root of the archive', 'Chrome will reject this package.');
}

const required = ['manifest.json', 'content.js', 'overlay.css', 'popup.html', 'options.html'];
const missing = required.filter((file) => !listing.includes(file));
if (missing.length) fail(`archive is missing: ${missing.join(', ')}`, 'run: npm run build');

const sizeKb = (statSync(outFile).size / 1024).toFixed(1);
console.log(`\n✓ packaged v${version}`);
console.log(`  releases/gsheet-plus-plus-v${version}.zip  (${sizeKb} KB)`);
console.log('\n  Upload at https://chrome.google.com/webstore/devconsole');
console.log(`  Privacy policy URL is in README.md`);
