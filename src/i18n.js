'use strict';

// UI strings. English is the base language; every key must exist in `en`.
// To add a language, add an entry here with the same keys and a `_name`.
// Values may be functions that receive the params object.
const MESSAGES = {
  en: {
    _name: 'English',
    'tab.people': 'People',
    'tab.study': 'Study',
    'tab.quiz': 'Quiz',
    'group.label': 'Group',
    'group.all': p => `All (${p.n})`,
    'group.item': p => `${p.name} (${p.n})`,
    'lang.label': 'Language',
    'about.button': 'About',

    'people.add': '+ Add photos',
    'people.search': 'Search name, reading, group',
    'people.openFolder': 'Open data folder',
    'people.export': 'Export',
    'people.import': 'Import',
    'people.hint': 'You can also drag & drop photos onto the window. The file name becomes the initial name (e.g. <code>Jane Smith.jpg</code>).',
    'people.empty.title': 'No one here yet',
    'people.empty.body': 'Add photos of the people you want to remember.',
    'people.noName': '(no name)',
    'people.level': p => `Mastery ${p.level}/${p.max}`,
    'people.added': p => p.n === 1
      ? 'Added 1 person. Click the card to check the name.'
      : `Added ${p.n} people. Click a card to check the name.`,
    'people.badImage': p => `Could not load image: ${p.file}`,
    'people.dropHere': 'Drop to add',

    'study.tap': 'Click / Space to reveal the name',
    'study.prev': '← Prev',
    'study.next': 'Next →',
    'study.shuffle': 'Shuffle',
    'study.shuffled': 'Shuffled',
    'study.empty.title': 'No one to show',
    'study.empty.body': 'Add photos in the People tab.',

    'quiz.setup': 'Quiz settings',
    'quiz.mode': 'Question type',
    'quiz.mode.selfcheck': 'See a face, recall the name, then check yourself',
    'quiz.mode.face2name': 'See a face, choose the name (4 choices)',
    'quiz.mode.name2face': 'See a name, choose the face (4 choices)',
    'quiz.mode.typing': 'See a face, type the name',
    'quiz.count': 'Questions',
    'quiz.count.all': 'Everyone',
    'quiz.count.pool': p => p.n === 1 ? '(1 person)' : `(${p.n} people)`,
    'quiz.count.unit': 'questions',
    'quiz.count.invalid': 'Enter a number of questions of 1 or more.',
    'quiz.weighted': 'People you struggle with come up more often.',
    'quiz.start': 'Start',
    'quiz.quit': 'Quit',
    'quiz.typing.placeholder': 'Type the name or reading',
    'quiz.answer': 'Answer',
    'quiz.reveal': 'Show answer',
    'quiz.gotIt': 'Got it',
    'quiz.missedIt': 'Missed it',
    'quiz.next': 'Next (Enter)',
    'quiz.noOne': 'No one to quiz. Add people in the People tab.',
    'quiz.needTwo': 'Multiple-choice needs at least 2 people with different names.',
    'quiz.correct': p => `Correct! ${p.who}`,
    'quiz.wrong': p => `Not quite. It's ${p.who}`,
    'quiz.retryMissed': 'Retry the ones I missed',
    'quiz.backToSetup': 'Back to settings',
    'quiz.msg.perfect': 'Perfect!',
    'quiz.msg.good': 'Great job!',
    'quiz.msg.ok': 'Almost there!',
    'quiz.msg.low': 'Keep practicing!',

    'edit.changePhoto': 'Change photo',
    'edit.name': 'Name',
    'edit.reading': 'Reading (optional)',
    'edit.reading.placeholder': 'e.g. pronunciation or nickname',
    'edit.group': 'Group',
    'edit.group.placeholder': 'e.g. Sales, Class 3B',
    'edit.note': 'Note',
    'edit.note.placeholder': 'Memory hints (hobbies, where you met, ...)',
    'edit.stats': p => `Correct ${p.correct} / ${p.total} · Mastery ${p.level}/${p.max}`,
    'edit.stats.none': 'Not quizzed yet',
    'edit.delete': 'Delete',
    'edit.cancel': 'Cancel',
    'edit.save': 'Save',
    'edit.confirmDelete': p => `Delete "${p.name}"?`,
    'edit.deleted': 'Deleted',

    'confirm.ok': 'OK',
    'confirm.cancel': 'Cancel',

    'io.nothing': 'Nothing to export',
    'io.exported': p => p.n === 1 ? 'Exported 1 person' : `Exported ${p.n} people`,
    'io.exportFailed': p => `Export failed: ${p.err}`,
    'io.notOurs': 'This is not a WhoIsThis export file',
    'io.imported': p => `Imported ${p.n} (existing entries were overwritten)`,
    'io.importFailed': p => `Import failed: ${p.err}`,
    'io.saveFailed': p => `Could not save: ${p.err}`,

    'about.title': 'About WhoIsThis',
    'about.body': 'A small app for learning to match faces and names.',
    'about.license': 'Released under the MIT License.',
    'about.thirdParty': 'Third-party licenses',
    'about.close': 'Close',
    'about.version': p => `Version ${p.v}`,
    'about.privacy': 'All photos and data stay on this computer. Nothing is sent over the network.',
  },

  ja: {
    _name: '日本語',
    'tab.people': '人物',
    'tab.study': '覚える',
    'tab.quiz': 'クイズ',
    'group.label': 'グループ',
    'group.all': p => `すべて（${p.n}人）`,
    'group.item': p => `${p.name}（${p.n}人）`,
    'lang.label': '言語',
    'about.button': 'このアプリについて',

    'people.add': '＋ 写真を追加',
    'people.search': '名前・よみ・グループで検索',
    'people.openFolder': 'データフォルダを開く',
    'people.export': '書き出し',
    'people.import': '読み込み',
    'people.hint': '写真をウィンドウにドラッグ＆ドロップしても追加できます。ファイル名が仮の名前になります（例: <code>山田太郎.jpg</code>）。',
    'people.empty.title': 'まだ誰もいません',
    'people.empty.body': '覚えたい人の写真を追加しましょう。',
    'people.noName': '（名前なし）',
    'people.level': p => `習熟度 ${p.level}/${p.max}`,
    'people.added': p => `${p.n}人を追加しました。カードをクリックして名前を確認してください`,
    'people.badImage': p => `画像を読み込めません: ${p.file}`,
    'people.dropHere': 'ここにドロップして追加',

    'study.tap': 'クリック / スペースで名前を表示',
    'study.prev': '← 前へ',
    'study.next': '次へ →',
    'study.shuffle': 'シャッフル',
    'study.shuffled': 'シャッフルしました',
    'study.empty.title': '表示できる人がいません',
    'study.empty.body': '「人物」タブで写真を追加してください。',

    'quiz.setup': 'クイズ設定',
    'quiz.mode': '出題形式',
    'quiz.mode.selfcheck': '顔を見て名前を思い出し、答えを見て自己採点',
    'quiz.mode.face2name': '顔を見て名前を選ぶ（4択）',
    'quiz.mode.name2face': '名前を見て顔を選ぶ（4択）',
    'quiz.mode.typing': '顔を見て名前を入力する',
    'quiz.count': '問題数',
    'quiz.count.all': '全員',
    'quiz.count.pool': p => `（${p.n}人）`,
    'quiz.count.unit': '問',
    'quiz.count.invalid': '問題数は1以上の数を入力してください。',
    'quiz.weighted': '苦手な人ほど出題されやすくなります。',
    'quiz.start': 'スタート',
    'quiz.quit': 'やめる',
    'quiz.typing.placeholder': '名前 または よみ を入力',
    'quiz.answer': '回答',
    'quiz.reveal': '答えを見る',
    'quiz.gotIt': '正解',
    'quiz.missedIt': '不正解',
    'quiz.next': '次へ（Enter）',
    'quiz.noOne': '出題できる人がいません。「人物」タブで追加してください。',
    'quiz.needTwo': '4択クイズには名前の違う人が2人以上必要です。',
    'quiz.correct': p => `正解！ ${p.who}`,
    'quiz.wrong': p => `不正解… 正解は ${p.who}`,
    'quiz.retryMissed': '間違えた人だけもう一度',
    'quiz.backToSetup': '設定に戻る',
    'quiz.msg.perfect': '完璧です！',
    'quiz.msg.good': 'いい調子！',
    'quiz.msg.ok': 'もう少し！',
    'quiz.msg.low': '繰り返して覚えましょう',

    'edit.changePhoto': '写真を変更',
    'edit.name': '名前',
    'edit.reading': 'よみがな',
    'edit.reading.placeholder': 'やまだ たろう',
    'edit.group': 'グループ',
    'edit.group.placeholder': '例: 営業部、3年B組',
    'edit.note': 'メモ',
    'edit.note.placeholder': '覚えるヒント（趣味、出会った場所など）',
    'edit.stats': p => `正解 ${p.correct} / ${p.total} 回・習熟度 ${p.level}/${p.max}`,
    'edit.stats.none': 'まだクイズに出ていません',
    'edit.delete': '削除',
    'edit.cancel': 'キャンセル',
    'edit.save': '保存',
    'edit.confirmDelete': p => `「${p.name}」を削除しますか？`,
    'edit.deleted': '削除しました',

    'confirm.ok': 'OK',
    'confirm.cancel': 'キャンセル',

    'io.nothing': '書き出すデータがありません',
    'io.exported': p => `${p.n}人分を書き出しました`,
    'io.exportFailed': p => `書き出しに失敗しました: ${p.err}`,
    'io.notOurs': 'WhoIsThis の書き出しファイルではありません',
    'io.imported': p => `${p.n}人分を読み込みました（同じ人は上書き）`,
    'io.importFailed': p => `読み込みに失敗しました: ${p.err}`,
    'io.saveFailed': p => `保存に失敗しました: ${p.err}`,

    'about.title': 'WhoIsThis について',
    'about.body': '顔と名前を一致させる練習をするための小さなアプリです。',
    'about.license': 'MIT ライセンスで公開しています。',
    'about.thirdParty': 'サードパーティライセンス',
    'about.close': '閉じる',
    'about.version': p => `バージョン ${p.v}`,
    'about.privacy': '写真やデータはすべてこのコンピューター内に保存され、ネットワークには送信されません。',
  },
};

const LANG_KEY = 'whoisthis.lang';

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && MESSAGES[saved]) return saved;
  } catch { /* storage may be unavailable */ }
  for (const l of navigator.languages || [navigator.language]) {
    const base = String(l).toLowerCase().split('-')[0];
    if (MESSAGES[base]) return base;
  }
  return 'en';
}

let lang = detectLang();

function t(key, params = {}) {
  const v = MESSAGES[lang][key] ?? MESSAGES.en[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(params) : v;
}

// Apply translations to static markup:
//   data-i18n="key"             -> textContent
//   data-i18n-html="key"        -> innerHTML (trusted strings from MESSAGES only)
//   data-i18n-placeholder="key" -> placeholder
//   data-i18n-title="key"       -> title
function applyI18n(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
}

function setLang(next) {
  if (!MESSAGES[next]) return;
  lang = next;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  applyI18n();
}
