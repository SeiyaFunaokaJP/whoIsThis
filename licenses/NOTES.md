# License notes

How WhoIsThis handles third-party licenses, and what was checked. Last reviewed 2026-09-26 against
the dependency versions in `src-tauri/Cargo.lock` and `package-lock.json`.

## What ships in the app

| Component | Where it ends up | License | Obligation | How we meet it |
|---|---|---|---|---|
| Rust crates (all platforms; the count is in `THIRD_PARTY_LICENSES.md`) | compiled into the app binary | MIT, Apache-2.0, BSD, ISC, Zlib, Unicode-3.0, MPL-2.0 and similar | include copyright and license texts | `THIRD_PARTY_LICENSES.md`, also embedded in the app (About → Third-party licenses) |
| MPL-2.0 crates: cssparser, cssparser-macros, selectors, dtoa-short, option-ext | compiled in, unmodified | MPL-2.0 | tell recipients where the source is (§3.2) and include the license | the notices link each crate's repository; source is on crates.io. **If you ever modify one of these crates, you must publish your modified files under MPL-2.0.** |
| Microsoft WebView2 SDK `WebView2LoaderStatic.lib` 1.0.3650.58 | statically linked into Windows builds (via webview2-com-sys) | BSD-3-Clause-style (Microsoft) | "Redistributions in binary form must reproduce the above copyright notice…" | included in the notices (`licenses/extra/webview2-sdk`) |
| NSIS 3.11 installer stub and LZMA decompressor | Windows `*-setup.exe` only | zlib/libpng, bzip2, CPL-1.0 (LZMA, with a linking exception) | zlib: acknowledgment optional; CPL: object code must say where the source is | NSIS COPYING included in the notices, with a link to the NSIS source |
| MSVC C runtime (statically linked by tauri-build) | Windows binaries | Visual Studio "Distributable Code" terms | no notice required; the app must add significant functionality; no copyleft relicensing | nothing extra needed (MIT is not an "Excluded License") |
| WiX Toolset 3.14 | builds the `.msi` only | MS-RL (the toolset) | none for generated MSIs: the .NET Foundation says generated packages "will normally fall outside the scope of the MS-RL" | nothing needed |
| Microsoft Edge WebView2 Runtime, WebKit (macOS), WebKitGTK (Linux) | **not shipped**: provided by the OS or package manager | — | — | — |

The web UI (`src/`) contains no third-party code or fonts. It uses the OS's system fonts.

## Build-time only (not distributed)

- `@tauri-apps/cli` 2.11.5: Apache-2.0 OR MIT (npm devDependency)
- Rust build dependencies and proc-macros: still listed in the notices to be safe
- GitHub Actions used in CI

## Why there is no AppImage build

Tauri's AppImage bundles the system libraries the app needs, including WebKitGTK, GTK and GLib, which
are LGPL. Redistributing LGPL library binaries requires shipping (or offering in writing for 3 years)
the exact corresponding source (LGPL-2.1 §4 / §6). The `.deb` and `.rpm` packages instead declare
`libwebkit2gtk-4.1` and `libgtk-3` as dependencies that the user's package manager installs, so we
don't redistribute them. For that reason `bundle.targets` in `src-tauri/tauri.conf.json` leaves out `appimage`.
If you ever add AppImage, you also need to publish the LGPL sources (or a written offer) with it.

## Crates without a license file in their crates.io package

Some crates declare a license in `Cargo.toml` but don't include the text in the published package.
Their license files were fetched verbatim from upstream **at the commit the crate version was released
from** (the `sha1` in the crate's `.cargo_vcs_info.json`), because license files can change over time.
They are stored in `licenses/overrides/<crate>/`, each with a `SOURCE.txt` that starts with

```
Crate: <name> <version>
Commit: <sha1 of the release commit>
```

followed by the exact URL of every file. `npm run licenses` (and CI) fails if an override's crate
version or commit no longer matches `Cargo.lock` and `.cargo_vcs_info.json`, e.g. after a dependency
update, or if an override is no longer used. When that happens, fetch the files again from the new
release commit, compare them, and update `SOURCE.txt`. Notable cases:

- **objc2 family** (macOS only): at the release commits the repository only had `LICENSE.md`, which
  names the licenses without the full text. The full texts were added upstream later
  (commit ee9a7ad, 2026-03-18, "Include license text in the repository") and are taken from there.
- **selectors**: the upstream repository has no MPL-2.0 license file anywhere at the release commit,
  but the source files carry the MPL-2.0 header, so the canonical MPL-2.0 text from mozilla.org is used.
- **defmt-parser, libappindicator-sys, tauri-plugin**: the crates live in a subdirectory of a larger
  repository with no license files of their own, so the repository-root files at the release commit are used.

`npm run licenses` fails if a new dependency ships no license file. Add its upstream license under
`licenses/overrides/<crate>/`, with a `SOURCE.txt`.

## Allowed licenses

The allowlist is in `scripts/licenses.mjs` (`ALLOWED`). Anything else, including GPL, LGPL and AGPL,
makes `npm run licenses` and CI fail. MPL-2.0 is allowed because it is file-level copyleft and we use
those crates unmodified.

## Not fully verified

- The Microsoft.Web.WebView2 package's NOTICE.txt lists Antlr3.Runtime and StringTemplate4 (BSD-3).
  They appear to belong to the bundled `wv2winrt` code generator, not the loader library we link, but
  this was not confirmed.
- The Visual Studio license wording was checked against the 2021 GA license documents.

## Sources

- WebView2 SDK license: LICENSE.txt in <https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.3650.58>
- NSIS: <https://nsis.sourceforge.io/License>
- WiX: <https://docs.firegiant.com/wix/> (licensing section)
- Tauri AppImage: <https://v2.tauri.app/distribute/appimage/>, tauri-bundler `linux/appimage/linuxdeploy.rs` (tauri-cli v2.11.5)
- LGPL-2.1: <https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt>
- Visual Studio 2022 license, Distributable Code: <https://visualstudio.microsoft.com/license-terms/>
