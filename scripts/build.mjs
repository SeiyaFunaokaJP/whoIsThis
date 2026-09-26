#!/usr/bin/env node
// One-command release build for the current OS.
//
//   npm run build                    build installers for this OS into dist/
//   npm run build -- --target <triple>  extra args are passed to `tauri build`
//
// Steps: regenerate third-party license notices -> tauri build -> copy artifacts to dist/

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';

function run(cmd, cmdArgs) {
  console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`);
  // shell is needed on Windows to resolve npx.cmd
  execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: isWin });
}

run('node', ['scripts/licenses.mjs']);
run('npx', ['tauri', 'build', ...args]);

// Collect artifacts
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const targetIdx = args.indexOf('--target');
const triple = targetIdx >= 0 ? args[targetIdx + 1] : null;
const profile = args.includes('--debug') ? 'debug' : 'release';
const outDir = path.join(ROOT, 'src-tauri', 'target', ...(triple ? [triple] : []), profile);
const dist = path.join(ROOT, 'dist');
// Empty dist/ instead of deleting it, so a folder open in Explorer/Finder doesn't make this fail
fs.mkdirSync(dist, { recursive: true });
for (const f of fs.readdirSync(dist)) {
  try {
    fs.rmSync(path.join(dist, f), { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EBUSY') throw err;
    console.error(`\n[ERROR] dist/${f} is in use. Close WhoIsThis (or whatever has the file open) and run the build again.`);
    console.error(`        The build itself succeeded: ${path.relative(ROOT, outDir)}`);
    process.exit(1);
  }
}

const copied = [];
function copy(src, name = path.basename(src)) {
  const dest = path.join(dist, name);
  fs.cpSync(src, dest, { recursive: true });
  copied.push(name);
}

const bundleDir = path.join(outDir, 'bundle');
const ARTIFACT = /\.(exe|msi|dmg|deb|rpm)$/i;
if (fs.existsSync(bundleDir)) {
  for (const kind of fs.readdirSync(bundleDir)) {
    for (const f of fs.readdirSync(path.join(bundleDir, kind))) {
      if (ARTIFACT.test(f)) copy(path.join(bundleDir, kind, f));
    }
  }
}
// Windows: also ship the standalone exe (runs without installing)
const exe = path.join(outDir, 'who-is-this.exe');
if (fs.existsSync(exe)) {
  const arch = (triple || process.arch).includes('aarch64') || process.arch === 'arm64' ? 'arm64' : 'x64';
  copy(exe, `WhoIsThis_${version}_${arch}_portable.exe`);
}
copy(path.join(ROOT, 'LICENSE'), 'LICENSE.txt');
copy(path.join(ROOT, 'THIRD_PARTY_LICENSES.md'));

console.log(`\nDone. Artifacts in dist/:\n  ${copied.join('\n  ')}`);
