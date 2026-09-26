# WhoIsThis

[English](README.md) | **日本語**

顔と名前を一致させる練習をするための小さなデスクトップアプリです。覚えたい人の写真を登録し、フラッシュカードで覚えて、クイズで確認します。

Windows / macOS / Linux で動作します。データはすべてお使いのコンピューター内に保存され、アカウント登録やネットワーク通信はありません。

## 機能

- **人物**: ボタンまたはドラッグ＆ドロップで写真を追加。ファイル名が仮の名前になります（`山田太郎.jpg` → 山田太郎）。よみがな・グループ・覚えるヒントのメモも登録できます。
- **覚える**: フラッシュカード。<kbd>Space</kbd> で名前表示、<kbd>←</kbd> <kbd>→</kbd> で移動。
- **クイズ**: 4つの形式。間違えた人ほど出題されやすくなります。
  - **自己採点**（デフォルト）: 顔を見て名前を思い出し、<kbd>Space</kbd> で答えを表示、<kbd>→</kbd> 正解 / <kbd>←</kbd> 不正解
  - 顔→名前（4択）、名前→顔（4択）: <kbd>1</kbd>〜<kbd>4</kbd> で回答、<kbd>Enter</kbd> で次へ
  - 顔→名前を入力
- **グループ**: 「営業部」「3年B組」などで絞り込み。
- **データフォルダ**: 写真はアプリと同じ場所の `whoisthis-data/images/` に JPEG ファイルとして保存されます（MSI 版・macOS・Linux パッケージなど、そこに書き込めない場合は OS のアプリデータフォルダ）。「データフォルダを開く」ボタンで開けます。
- **書き出し / 読み込み**: zip ファイル（`people.json` + `images/`、データフォルダと同じ構成）で別のコンピューター（別 OS でも可）へデータを移せます。
- **多言語**: 英語・日本語（OS の言語に合わせて自動選択、ヘッダーからいつでも切り替え可）。

## ダウンロード

[Releases](../../releases) ページから最新版を入手してください。

| OS | ファイル |
|---|---|
| Windows | `*_portable.exe`（インストール不要、ダブルクリックで起動）、`*-setup.exe`、`*.msi` |
| macOS | `*.dmg`（Apple Silicon / Intel 両対応） |
| Linux | `*.deb`（Debian/Ubuntu）、`*.rpm`（Fedora/openSUSE） |

- Windows 10/11 には必要な WebView2 ランタイムが標準で入っています。
- macOS 版は署名していません。初回は右クリック →「開く」で起動してください。
- AppImage 版は意図的に作っていません（理由は [licenses/NOTES.md](licenses/NOTES.md)）。

## ソースからビルド

必要なもの: [Node.js](https://nodejs.org/) 18 以上、[Rust](https://rustup.rs/)、各 OS の [Tauri 前提条件](https://v2.tauri.app/start/prerequisites/)

**いちばん簡単な方法:** Windows では `build.bat` をダブルクリック、macOS / Linux では `./build.sh` を実行します。必要なら npm パッケージをインストールし、ビルドして `dist/` に出力します。

npm で実行する場合:

```sh
npm install
npm run dev        # 開発モードで起動
npm run build      # この OS 向けのインストーラーを dist/ に出力
```

| スクリプト | 内容 |
|---|---|
| `npm run dev` | 開発モードで起動 |
| `npm run build` | ライセンス表記を再生成 → `tauri build` → インストーラー（Windows ではポータブル exe も）を `dist/` にコピー |
| `npm run licenses` | `THIRD_PARTY_LICENSES.md` とアプリ内ライセンスページを再生成 |
| `npm run licenses:check` | 許可されていないライセンスの依存や表記の古さを検出（CI で使用） |
| `npm run bump -- 0.2.0` | バージョン番号を関係ファイルすべてで更新 |

### 全 OS 向けリリース

Tauri は OS ごとにその OS 上でビルドする必要があるため、GitHub Actions（[.github/workflows/build.yml](.github/workflows/build.yml)）で3 OS 分をビルドします。

```sh
npm run bump -- 0.2.0
git commit -am "Release v0.2.0"
git tag v0.2.0
git push origin HEAD v0.2.0
```

Windows / macOS / Linux 版が添付された GitHub Release の下書きが作られるので、確認して公開してください。

## 言語の追加

UI の文言は [src/i18n.js](src/i18n.js) にあります。`en` ブロックをコピーして翻訳し、`_name` を付ければ言語メニューに自動で表示されます。訳がないキーは英語で表示されます。

## ライセンス

[MIT](LICENSE)。サードパーティソフトウェアの表記は [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) にあります（アプリの「このアプリについて」からも確認できます）。
