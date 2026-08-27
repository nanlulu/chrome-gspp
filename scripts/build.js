import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(root, 'dist');
const watch = process.argv.includes('--watch');

// Content scripts cannot be ES modules, so everything is bundled to a classic
// IIFE. The popup and options pages are bundled the same way for consistency.
const entries = {
  content: 'src/content/index.js',
  popup: 'src/ui/popup.js',
  options: 'src/ui/options.js',
};

async function copyStatic() {
  await cp(resolve(root, 'src/manifest.json'), resolve(outdir, 'manifest.json'));
  await cp(resolve(root, 'src/styles/overlay.css'), resolve(outdir, 'overlay.css'));
  await cp(resolve(root, 'src/ui/popup.html'), resolve(outdir, 'popup.html'));
  await cp(resolve(root, 'src/ui/options.html'), resolve(outdir, 'options.html'));
  await cp(resolve(root, 'src/ui/ui.css'), resolve(outdir, 'ui.css'));
  await cp(resolve(root, 'src/icons'), resolve(outdir, 'icons'), { recursive: true });
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const options = {
  entryPoints: Object.entries(entries).map(([out, input]) => ({ out, in: input })),
  bundle: true,
  format: 'iife',
  target: 'chrome114',
  outdir,
  logLevel: 'info',
  legalComments: 'none',
  // Emit pure ASCII, escaping any non-ASCII into \u sequences. Chrome refuses
  // to load a content script containing Unicode noncharacters (e.g. U+FFFF)
  // with a misleading "isn't UTF-8 encoded" error, even though such bytes are
  // valid UTF-8. This makes that impossible by construction.
  charset: 'ascii',
};

/**
 * Fail the build on anything Chrome's loader rejects. Chrome's message points
 * at the file but not the character, so catch it here where we can say exactly
 * where it is.
 */
async function verifyLoadable() {
  const problems = [];
  for (const name of Object.keys(entries)) {
    const file = resolve(outdir, `${name}.js`);
    const text = await readFile(file, 'utf8');
    for (let i = 0; i < text.length; i += 1) {
      const cp = text.codePointAt(i);
      const isNoncharacter = (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xfffe) === 0xfffe;
      const isLoneSurrogate = cp >= 0xd800 && cp <= 0xdfff;
      if (isNoncharacter || isLoneSurrogate) {
        problems.push(
          `${name}.js:${i} contains U+${cp.toString(16).toUpperCase()} — `
          + `near ${JSON.stringify(text.slice(Math.max(0, i - 40), i + 8))}`,
        );
      }
    }
  }
  if (problems.length) {
    console.error('\nBuild output would be rejected by Chrome:');
    for (const problem of problems) console.error('  ' + problem);
    process.exit(1);
  }
}

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  await copyStatic();
  console.log('watching...');
} else {
  await esbuild.build(options);
  await copyStatic();
  await verifyLoadable();
  console.log('built -> dist/ (verified loadable)');
}
