# WhoIsThis

**English** | [日本語](README.ja.md)

A small desktop app for learning to match faces and names. Add photos of the people you want to remember, study them as flashcards, and quiz yourself until the names stick.

Runs on Windows, macOS and Linux. Everything stays on your computer: no account, no network access.

## Features

- **People**: add photos with a button or by drag & drop. The file name becomes the initial name (`Jane Smith.jpg` → Jane Smith). Each person can have a reading/pronunciation, group, and memory-hint note.
- **Study**: flashcards. <kbd>Space</kbd> reveals the name, <kbd>←</kbd> <kbd>→</kbd> move.
- **Quiz**: four modes. People you get wrong come up more often.
  - **Self-check** (default): see a face, recall the name, reveal the answer with <kbd>Space</kbd>, then mark it <kbd>→</kbd> Got it / <kbd>←</kbd> Missed it
  - Face → name (4 choices), name → face (4 choices): answer with <kbd>1</kbd>–<kbd>4</kbd>, <kbd>Enter</kbd> for next
  - Face → type the name
- **Groups**: limit everything to one group (e.g. "Sales", "Class 3B").
- **Data folder**: photos are saved as plain JPEG files in `whoisthis-data/images/` next to the app (or in the OS app-data folder when that location is read-only, e.g. MSI installs, macOS and Linux packages). Open it with **Open data folder**.
- **Export / Import**: move your data to another computer (any OS) as a zip file (`people.json` + `images/`, the same layout as the data folder).
- **Languages**: English and Japanese (follows the OS language; switch any time in the header).

## Download

Get the latest build from the [Releases](../../releases) page:

| OS | File |
|---|---|
| Windows | `*_portable.exe` (no install, just run it), `*-setup.exe` or `*.msi` |
| macOS | `*.dmg` (universal: Apple Silicon and Intel) |
| Linux | `*.deb` (Debian/Ubuntu) or `*.rpm` (Fedora/openSUSE) |

- Windows 10/11 already include the Microsoft Edge WebView2 runtime the app uses.
- The macOS build is not signed. On first launch, right-click the app and choose **Open**.
- There is no AppImage build on purpose; see [licenses/NOTES.md](licenses/NOTES.md).

## Build from source

Requirements: [Node.js](https://nodejs.org/) 18+ and [Rust](https://rustup.rs/), plus the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

**Easiest:** double-click `build.bat` on Windows, or run `./build.sh` on macOS/Linux. It installs the npm packages if needed, builds, and puts the results in `dist/`.

Or with npm:

```sh
npm install
npm run dev        # run in development mode
npm run build      # build installers for this OS into dist/
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the app with live reload |
| `npm run build` | Regenerate license notices, run `tauri build`, copy the installers (and the portable exe on Windows) into `dist/` |
| `npm run licenses` | Regenerate `THIRD_PARTY_LICENSES.md` and the in-app license page |
| `npm run licenses:check` | Fail if a dependency's license is not allowed or the notices are stale (used in CI) |
| `npm run bump -- 0.2.0` | Set the version in every file that stores it |

### Releasing for all platforms

Tauri apps have to be built on each OS, so GitHub Actions ([.github/workflows/build.yml](.github/workflows/build.yml)) builds all three:

```sh
npm run bump -- 0.2.0
git commit -am "Release v0.2.0"
git tag v0.2.0
git push origin HEAD v0.2.0
```

This creates a draft GitHub Release with the Windows, macOS and Linux files attached. Review it and publish.

## Adding a language

UI strings live in [src/i18n.js](src/i18n.js). Copy the `en` block, translate the values, and give it a `_name`. The language menu picks it up automatically. English is the fallback for any missing key.

## Project layout

```
src/                 web UI (plain HTML/CSS/JS, no build step)
  i18n.js            translations
  app.js             app logic (data is stored as files in the data folder)
  third-party-licenses.html   generated, shown in the About dialog
src-tauri/           Rust / Tauri shell
scripts/             build, license and version scripts
licenses/            license-file overrides and notes for the notices
```

## License

[MIT](LICENSE). Third-party software notices: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) (also available in the app under **About**).
