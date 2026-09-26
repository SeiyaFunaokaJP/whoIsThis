#!/usr/bin/env node
// Generates the third-party license notices for everything compiled into the app.
//
//   node scripts/licenses.mjs          regenerate THIRD_PARTY_LICENSES.md and src/third-party-licenses.html
//   node scripts/licenses.mjs --check  fail if the committed files are out of date (for CI)
//
// How it works
//   1. Resolve the Rust dependency graph for every platform we ship (`cargo metadata --filter-platform`).
//   2. Check each crate's SPDX license expression against ALLOWED (anything else, e.g. GPL, fails the run).
//   3. Copy the license files each crate ships in its crates.io package verbatim. Crates that do not
//      ship one get it from licenses/overrides/<crate>/ (fetched from upstream, see SOURCE.txt there).
//      An override must name the exact crate version and release commit, or the run fails.
//   4. Append non-Rust components that end up in the binaries, from licenses/extra/<name>/.
//
// No npm dependencies: only Node and cargo are needed.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'src-tauri', 'Cargo.toml');
const OVERRIDES = path.join(ROOT, 'licenses', 'overrides');
const EXTRA = path.join(ROOT, 'licenses', 'extra');
const OUT_MD = path.join(ROOT, 'THIRD_PARTY_LICENSES.md');
const OUT_HTML = path.join(ROOT, 'src', 'third-party-licenses.html');

// Every platform we build for, so the notices cover all released binaries.
const TARGETS = [
  'x86_64-pc-windows-msvc',
  'aarch64-pc-windows-msvc',
  'x86_64-apple-darwin',
  'aarch64-apple-darwin',
  'x86_64-unknown-linux-gnu',
  'aarch64-unknown-linux-gnu',
];

// Permissive licenses plus MPL-2.0 (file-level copyleft; fine for unmodified crates whose
// source is published on crates.io). Copyleft licenses such as GPL/LGPL/AGPL are not allowed.
const ALLOWED = new Set([
  'MIT', 'MIT-0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', '0BSD',
  'CC0-1.0', 'Unlicense', 'Unicode-3.0', 'Unicode-DFS-2016', 'BSL-1.0', 'MPL-2.0',
]);
const ALLOWED_EXCEPTIONS = new Set(['LLVM-exception']);

const LICENSE_FILE = /^(licen[cs]e|copying|copyright|notice|unlicense)([-_.].*)?$/i;

// ---------------------------------------------------------------------------
// SPDX expression check: true if some choice of alternatives uses only allowed licenses
// ---------------------------------------------------------------------------
function allowedExpr(expr) {
  // Old crates use "/" as a synonym for OR
  const tokens = expr.replace(/\//g, ' OR ').match(/\(|\)|[^\s()]+/g) || [];
  let i = 0;
  const peek = () => tokens[i];
  function primary() {
    if (peek() === '(') { i++; const v = orExpr(); i++; return v; }
    const id = tokens[i++];
    if (peek() === 'WITH') { i++; const exc = tokens[i++]; return ALLOWED.has(id) && ALLOWED_EXCEPTIONS.has(exc); }
    return ALLOWED.has(id.replace(/\+$/, ''));
  }
  function andExpr() { let v = primary(); while (peek() === 'AND') { i++; v = primary() && v; } return v; }
  function orExpr() { let v = andExpr(); while (peek() === 'OR') { i++; v = andExpr() || v; } return v; }
  const ok = orExpr();
  return ok && i === tokens.length;
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------
function cargoMetadata(target) {
  const out = execFileSync('cargo', [
    'metadata', '--format-version', '1', '--locked', '--manifest-path', MANIFEST, '--filter-platform', target,
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(out);
}

const packages = new Map(); // id -> package
for (const target of TARGETS) {
  const meta = cargoMetadata(target);
  const byId = new Map(meta.packages.map(p => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map(n => [n.id, n]));
  const stack = [meta.resolve.root];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    if (id !== meta.resolve.root) packages.set(id, byId.get(id));
    for (const dep of nodes.get(id).deps) {
      // Follow normal and build dependencies; dev-dependencies never ship.
      if (dep.dep_kinds.some(k => k.kind !== 'dev')) stack.push(dep.pkg);
    }
  }
}

// ---------------------------------------------------------------------------
// License texts
// ---------------------------------------------------------------------------
function readLicenseFiles(dir, exclude = []) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && LICENSE_FILE.test(e.name) && !exclude.includes(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(e => ({ file: e.name, text: fs.readFileSync(path.join(dir, e.name), 'utf8').replace(/\r\n/g, '\n').trim() }));
}

// An override is only valid for the exact crate version and release commit it was taken for, since
// upstream license files can change. SOURCE.txt must start with "Crate: <name> <version>" and
// "Commit: <sha1>", matching Cargo.lock and the crate's .cargo_vcs_info.json.
function checkOverride(p, dir) {
  const where = `licenses/overrides/${p.name}/SOURCE.txt`;
  const sourceFile = path.join(dir, 'SOURCE.txt');
  if (!fs.existsSync(sourceFile)) return [`${p.name} ${p.version}: ${where} is missing`];
  const source = fs.readFileSync(sourceFile, 'utf8');
  const crate = source.match(/^Crate:\s*(\S+)\s+(\S+)/m);
  const commit = source.match(/^Commit:\s*([0-9a-f]{40})\b/m);
  const out = [];
  if (!crate || crate[1] !== p.name || crate[2] !== p.version) {
    out.push(`${p.name} ${p.version}: ${where} is for ${crate ? `${crate[1]} ${crate[2]}` : 'an unknown version'}. ` +
      'Re-fetch the license files from the new release commit and update SOURCE.txt.');
  }
  const vcsFile = path.join(path.dirname(p.manifest_path), '.cargo_vcs_info.json');
  const vcsSha = fs.existsSync(vcsFile) ? JSON.parse(fs.readFileSync(vcsFile, 'utf8')).git?.sha1 : null;
  if (!commit) out.push(`${p.name} ${p.version}: ${where} has no "Commit: <sha1>" line`);
  else if (vcsSha && commit[1] !== vcsSha) {
    out.push(`${p.name} ${p.version}: ${where} records commit ${commit[1]}, but the crate was released from ${vcsSha}`);
  }
  return out;
}

const problems = [];
const crates = [];
const usedOverrides = new Set();
for (const p of [...packages.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))) {
  const license = p.license || (p.license_file ? `SEE LICENSE FILE (${p.license_file})` : '');
  if (!p.license) problems.push(`${p.name} ${p.version}: no SPDX license expression in Cargo.toml`);
  else if (!allowedExpr(p.license)) problems.push(`${p.name} ${p.version}: license "${p.license}" is not in the allowlist`);

  const overrideDir = path.join(OVERRIDES, p.name);
  let files = readLicenseFiles(overrideDir, ['SOURCE.txt']);
  let source = 'upstream repository';
  if (files.length) {
    usedOverrides.add(p.name);
    problems.push(...checkOverride(p, overrideDir));
  } else {
    files = readLicenseFiles(path.dirname(p.manifest_path));
    source = 'crates.io package';
  }
  if (!files.length) problems.push(`${p.name} ${p.version}: package ships no license file; add one under licenses/overrides/${p.name}/`);
  crates.push({ name: p.name, version: p.version, license, repository: p.repository || `https://crates.io/crates/${p.name}`, files, source });
}
if (fs.existsSync(OVERRIDES)) {
  for (const name of fs.readdirSync(OVERRIDES)) {
    if (!usedOverrides.has(name)) problems.push(`licenses/overrides/${name}/ is not used by any dependency; remove it`);
  }
}

// Non-Rust components compiled or linked into the binaries (licenses/extra/<name>/meta.json + license file)
const extras = fs.existsSync(EXTRA)
  ? fs.readdirSync(EXTRA, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => {
      const dir = path.join(EXTRA, e.name);
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
      return { ...meta, files: readLicenseFiles(dir) };
    })
  : [];

if (problems.length) {
  console.error('License check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// Each distinct license text is printed once, followed by every crate that ships it
const texts = new Map(); // sha256 -> { id, text, users: [] }
for (const c of crates) {
  c.textIds = [];
  for (const f of c.files) {
    const key = createHash('sha256').update(f.text).digest('hex');
    if (!texts.has(key)) texts.set(key, { id: `L${texts.size + 1}`, text: f.text, users: [] });
    const entry = texts.get(key);
    entry.users.push(`${c.name} ${c.version} (${f.file})`);
    c.textIds.push(entry.id);
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const INTRO = 'WhoIsThis is licensed under the MIT License (see LICENSE). It includes the third-party ' +
  'software listed below. All Rust crates are used unmodified; their source code is available on ' +
  'crates.io and at the repository linked for each one. Where a crate is offered under a choice of ' +
  'licenses, all license files it ships are reproduced here. Identical license texts are printed once and list every crate that uses them. This list covers every platform WhoIsThis ' +
  'is built for and includes build-time dependencies, so it is a superset of what any single binary contains.';

function markdown() {
  const out = [
    '# Third-party licenses', '',
    '<!-- GENERATED by scripts/licenses.mjs. Run `npm run licenses` instead of editing by hand. -->', '',
    INTRO, '',
    `Contents: ${extras.length} non-Rust components, ${crates.length} Rust crates, ${texts.size} distinct license texts.`, '',
  ];
  for (const e of extras) {
    out.push(`## ${e.name} ${e.version}`, '', e.description, '', `Source: <${e.url}>`, '');
    for (const f of e.files) out.push('```text', f.text, '```', '');
  }
  out.push('## Rust crates', '');
  for (const c of crates) {
    out.push(`- ${c.name} ${c.version} — ${c.license} — <${c.repository}> — license text: ${c.textIds.join(', ')}` +
      (c.source !== 'crates.io package' ? ` (from ${c.source}, see licenses/overrides/${c.name})` : ''));
  }
  out.push('', '## License texts', '');
  for (const t of texts.values()) {
    out.push(`### ${t.id}`, '', `Used by: ${t.users.join(', ')}`, '', '```text', t.text, '```', '');
  }
  return out.join('\n');
}

function escHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function link(url, text) {
  return `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(text)}</a>`;
}
function html() {
  const sections = [
    ...extras.map(e => `<section><h2>${escHtml(e.name)} ${escHtml(e.version)}</h2><p>${escHtml(e.description)}</p><p>${link(e.url, e.url)}</p>` +
      e.files.map(f => `<pre>${escHtml(f.text)}</pre>`).join('') + '</section>'),
    '<section><h2>Rust crates</h2><ul>' + crates.map(c =>
      `<li>${link(c.repository, `${c.name} ${c.version}`)} — ${escHtml(c.license)} — ` +
      c.textIds.map(id => `<a href="#${id}">${id}</a>`).join(', ') + '</li>').join('') + '</ul></section>',
    ...[...texts.values()].map(t => `<section id="${t.id}"><h3>${t.id}</h3><p>Used by: ${escHtml(t.users.join(', '))}</p><pre>${escHtml(t.text)}</pre></section>`),
  ];
  return `<!doctype html>
<!-- GENERATED by scripts/licenses.mjs. Run \`npm run licenses\` instead of editing by hand. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Third-party licenses</title>
<style>
:root { color-scheme: light dark; }
body { font: 13px/1.5 system-ui, sans-serif; margin: 16px; background: Canvas; color: CanvasText; }
h1 { font-size: 17px; margin-top: 0; }
section { border-top: 1px solid rgba(128,128,128,.3); padding-top: 8px; margin-top: 16px; }
h2 { font-size: 14px; } h3 { font-size: 12px; margin-bottom: 4px; }
ul { padding-left: 18px; margin: 4px 0; }
pre { white-space: pre-wrap; word-break: break-word; background: rgba(128,128,128,.1); padding: 10px; border-radius: 6px; font-size: 11.5px; }
a { color: #2a7fa8; }
</style>
</head>
<body>
<h1>Third-party licenses</h1>
<p>${escHtml(INTRO)}</p>
${sections.join('\n')}
</body>
</html>
`;
}

const outputs = [[OUT_MD, markdown()], [OUT_HTML, html()]];
if (process.argv.includes('--check')) {
  const stale = outputs.filter(([file, text]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== text);
  if (stale.length) {
    console.error('Out of date: ' + stale.map(([f]) => path.relative(ROOT, f)).join(', ') + '\nRun `npm run licenses` and commit the result.');
    process.exit(1);
  }
  console.log(`Third-party licenses are up to date (${crates.length} crates).`);
} else {
  for (const [file, text] of outputs) fs.writeFileSync(file, text);
  console.log(`Wrote ${path.relative(ROOT, OUT_MD)} and ${path.relative(ROOT, OUT_HTML)} (${crates.length} crates, ${texts.size} distinct license texts, ${extras.length} other components).`);
}
