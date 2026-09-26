#!/usr/bin/env node
// Set the app version everywhere it is stored.
//   npm run bump -- 0.2.0
// tauri.conf.json reads the version from package.json, so only package.json,
// src-tauri/Cargo.toml and src-tauri/Cargo.lock need updating.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version || '')) {
  console.error('Usage: npm run bump -- <version>   (e.g. 0.2.0)');
  process.exit(1);
}

function edit(rel, fn) {
  const file = path.join(ROOT, rel);
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`No version found to update in ${rel}`);
  fs.writeFileSync(file, after);
  console.log(`updated ${rel}`);
}

edit('package.json', s => s.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));
edit('package-lock.json', s => s.replace(/^(\s{2}"version":\s*")[^"]+(")/m, `$1${version}$2`)
  .replace(/("packages":\s*\{\s*"":\s*\{[^}]*?"version":\s*")[^"]+(")/, `$1${version}$2`));
edit('src-tauri/Cargo.toml', s => s.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`));
edit('src-tauri/Cargo.lock', s => s.replace(/(name = "who-is-this"\r?\nversion = ")[^"]+(")/, `$1${version}$2`));

console.log(`\nVersion is now ${version}. To release:\n  git commit -am "Release v${version}"\n  git tag v${version}\n  git push origin HEAD v${version}`);
