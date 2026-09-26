'use strict';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const MAX_LEVEL = 5;

// ---------------------------------------------------------------------------
// Storage: <data folder>/people.json + images/<photo file> (see src-tauri/src/main.rs)
// ---------------------------------------------------------------------------
const tauri = window.__TAURI__;
const invoke = (...args) => tauri.core.invoke(...args);
let people = [];
let imagesDir = '';

function fileDoc(extra) {
  return { app: 'whoisthis', version: 2, ...extra, people };
}
function errText(err) { return err?.message ?? String(err); }

// Writes are queued so they land in order; each one writes the whole list as it was when called
let saving = Promise.resolve();
function persist() {
  const json = JSON.stringify(fileDoc());
  const done = saving.then(() => invoke('save_people', { json }));
  saving = done.catch(() => {});
  return done;
}
function upsert(p) {
  const i = people.findIndex(x => x.id === p.id);
  if (i >= 0) people[i] = p; else people.push(p);
}
async function savePerson(p) {
  upsert(p);
  try { await persist(); } catch (err) { toast(t('io.saveFailed', { err: errText(err) })); }
}
async function deletePerson(id) {
  const p = people.find(x => x.id === id);
  people = people.filter(x => x.id !== id);
  try {
    await persist();
    if (p?.photo) await invoke('delete_image', { name: p.photo });
  } catch (err) {
    toast(t('io.saveFailed', { err: errText(err) }));
  }
}

// Photos are stored as images/<person id>-<timestamp>.jpg; a new name on every change avoids stale caches
const PHOTO_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;
// Person ids are UUIDs; anything else (e.g. from a crafted import file) is rejected
const PERSON_ID = /^[A-Za-z0-9_-]{1,64}$/;
async function writePhoto(blob, id) {
  const name = `${id}-${Date.now().toString(36)}.jpg`;
  await invoke('save_image', new Uint8Array(await blob.arrayBuffer()), { headers: { name } });
  return name;
}
function photoUrl(p) {
  const sep = imagesDir.includes('\\') ? '\\' : '/';
  return p.photo ? tauri.core.convertFileSrc(imagesDir + sep + p.photo) : '';
}
async function dataUrlToBlob(url) {
  return (await fetch(url)).blob();
}

// v0.1 kept everything in the webview's IndexedDB with photos as data URLs; move it to files once
const LEGACY_DB = 'whoisthis';
async function readLegacyDB() {
  const dbs = await indexedDB.databases?.() ?? [];
  if (!dbs.some(d => d.name === LEGACY_DB)) return [];
  const idb = await new Promise((resolve, reject) => {
    const r = indexedDB.open(LEGACY_DB);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    if (!idb.objectStoreNames.contains('people')) return [];
    return await new Promise((resolve, reject) => {
      const r = idb.transaction('people', 'readonly').objectStore('people').getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    idb.close();
  }
}
async function migrateLegacy() {
  const old = await readLegacyDB();
  if (!old.length) return;
  for (const p of old.sort((a, b) => a.created - b.created)) {
    if (!p?.id || !p.photo?.startsWith('data:')) continue;
    upsert({ ...p, photo: await writePhoto(await dataUrlToBlob(p.photo), p.id) });
  }
  await persist();
  indexedDB.deleteDatabase(LEGACY_DB);
}

// Imported files may come from anywhere: keep only well-typed values for the fields the app uses
function importedPerson(p, photo) {
  const str = v => (typeof v === 'string' ? v : '');
  const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  return newPerson({
    ...p,
    name: str(p.name), reading: str(p.reading), group: str(p.group), note: str(p.note), photo,
    level: Math.min(Math.max(Math.trunc(num(p.level)), 0), MAX_LEVEL),
    correct: Math.max(Math.trunc(num(p.correct)), 0),
    wrong: Math.max(Math.trunc(num(p.wrong)), 0),
    created: num(p.created, Date.now()),
  });
}

function newPerson(fields) {
  return {
    id: crypto.randomUUID(),
    name: '', reading: '', group: '', note: '', photo: '',
    level: 0, correct: 0, wrong: 0,
    created: Date.now(),
    ...fields,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Loose comparison: ignores case, width (full/half), katakana vs hiragana, spaces and punctuation
function normalize(s) {
  return (s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・･.\-_]/g, '')
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

function confirmDialog(text) {
  const dlg = $('#confirmDialog');
  $('#confirmText').textContent = text;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise(resolve => {
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
  });
}

// Downscale to MAX_SIDE on the long edge and encode as JPEG (keeps the data folder and exports small)
const MAX_SIDE = 600;
function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(blob => blob ? resolve(blob) : reject(new Error(t('people.badImage', { file: file.name }))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('people.badImage', { file: file.name }))); };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------
function renderLangSelect() {
  $('#langSelect').innerHTML = Object.entries(MESSAGES)
    .map(([code, m]) => `<option value="${code}">${esc(m._name)}</option>`).join('');
  $('#langSelect').value = lang;
}
function applyStaticText() {
  applyI18n();
  renderPoolSize();
}
$('#langSelect').addEventListener('change', e => {
  setLang(e.target.value);
  applyStaticText();
  renderAll();
  // Re-render whatever quiz screen is visible so dynamic text switches too
  if (quiz && !$('#quizPlay').hidden) {
    // Self-check only shows user data and static text, which applyStaticText already updated
    if (quiz.mode === 'selfcheck') return;
    if (quiz.answered) showFeedback(quiz.lastOk); else renderQuestion();
  } else if (quiz && !$('#quizResult').hidden) {
    showResult();
  }
});

// ---------------------------------------------------------------------------
// Group filter
// ---------------------------------------------------------------------------
const ALL = '__all__';
let currentGroup = ALL;

function groups() {
  return [...new Set(people.map(p => p.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang));
}
function filtered() {
  return currentGroup === ALL ? people : people.filter(p => p.group === currentGroup);
}
function renderGroups() {
  const gs = groups();
  if (currentGroup !== ALL && !gs.includes(currentGroup)) currentGroup = ALL;
  $('#groupSelect').innerHTML =
    `<option value="${ALL}">${esc(t('group.all', { n: people.length }))}</option>` +
    gs.map(g => `<option value="${esc(g)}">${esc(t('group.item', { name: g, n: people.filter(p => p.group === g).length }))}</option>`).join('');
  $('#groupSelect').value = currentGroup;
  $('#groupList').innerHTML = gs.map(g => `<option value="${esc(g)}"></option>`).join('');
}
$('#groupSelect').addEventListener('change', e => {
  currentGroup = e.target.value;
  renderAll();
  if (currentView === 'study') startStudy();
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
let currentView = 'people';
function showView(name) {
  currentView = name;
  $$('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'study') startStudy();
  if (name === 'quiz') showQuizSetup();
}
$$('.tab').forEach(el => el.addEventListener('click', () => showView(el.dataset.view)));

function renderAll() {
  renderGroups();
  renderPoolSize();
  renderPeople();
  if (currentView === 'study') renderStudy();
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
function levelBar(level) {
  return `<div class="level" title="${esc(t('people.level', { level, max: MAX_LEVEL }))}">` +
    Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('') +
    '</div>';
}

function renderPeople() {
  const q = normalize($('#searchInput').value);
  const list = filtered().filter(p =>
    !q || [p.name, p.reading, p.group, p.note].some(s => normalize(s).includes(q)));
  $('#peopleGrid').innerHTML = list.map(p => `
    <button class="card" data-id="${esc(p.id)}">
      <img src="${esc(photoUrl(p))}" alt="" loading="lazy" />
      <div class="card-body">
        <div class="card-name">${esc(p.name) || esc(t('people.noName'))}</div>
        <div class="card-sub">${esc([p.reading, p.group].filter(Boolean).join(' · '))}</div>
        ${levelBar(p.level || 0)}
      </div>
    </button>`).join('');
  $('#peopleEmpty').hidden = people.length > 0;
}
$('#searchInput').addEventListener('input', renderPeople);
$('#peopleGrid').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) openEditor(card.dataset.id);
});

async function addFiles(files) {
  const images = [...files].filter(f => f.type.startsWith('image/'));
  if (!images.length) return;
  const group = currentGroup === ALL ? '' : currentGroup;
  let added = 0;
  for (const f of images) {
    try {
      const id = crypto.randomUUID();
      const photo = await writePhoto(await fileToPhoto(f), id);
      const name = f.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
      await savePerson(newPerson({ id, name, photo, group }));
      added++;
    } catch (err) {
      toast(err.message);
    }
  }
  renderAll();
  if (added) toast(t('people.added', { n: added }));
}
$('#fileInput').addEventListener('change', async e => {
  await addFiles(e.target.files);
  e.target.value = '';
});

// Drag & drop
let dragDepth = 0;
window.addEventListener('dragenter', e => {
  if (![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault();
  dragDepth++;
  $('#dropOverlay').hidden = false;
});
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('#dropOverlay').hidden = true;
});
window.addEventListener('drop', async e => {
  e.preventDefault();
  dragDepth = 0;
  $('#dropOverlay').hidden = true;
  if (e.dataTransfer.files.length) {
    showView('people');
    await addFiles(e.dataTransfer.files);
  }
});

// ---------------------------------------------------------------------------
// Edit dialog
// ---------------------------------------------------------------------------
let editing = null;
let editPhoto = null; // { blob, url } picked in the dialog, written to disk only on save
function clearEditPhoto() {
  if (editPhoto) URL.revokeObjectURL(editPhoto.url);
  editPhoto = null;
}

function openEditor(id) {
  const p = people.find(x => x.id === id);
  if (!p) return;
  editing = { ...p };
  clearEditPhoto();
  $('#editImg').src = photoUrl(p);
  $('#editName').value = p.name;
  $('#editReading').value = p.reading;
  $('#editGroup').value = p.group;
  $('#editNote').value = p.note;
  const total = (p.correct || 0) + (p.wrong || 0);
  $('#editStats').textContent = total
    ? t('edit.stats', { correct: p.correct || 0, total, level: p.level || 0, max: MAX_LEVEL })
    : t('edit.stats.none');
  $('#editDialog').showModal();
  $('#editName').select();
}
$('#editPhotoInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f || !editing) return;
  try {
    const blob = await fileToPhoto(f);
    clearEditPhoto();
    editPhoto = { blob, url: URL.createObjectURL(blob) };
    $('#editImg').src = editPhoto.url;
  } catch (err) {
    toast(err.message);
  }
  e.target.value = '';
});
$('#editForm').addEventListener('submit', async () => {
  if (!editing) return;
  editing.name = $('#editName').value.trim();
  editing.reading = $('#editReading').value.trim();
  editing.group = $('#editGroup').value.trim();
  editing.note = $('#editNote').value.trim();
  const target = editing;
  const newPhoto = editPhoto?.blob;
  editing = null;
  const oldPhoto = target.photo;
  try {
    if (newPhoto) target.photo = await writePhoto(newPhoto, target.id);
  } catch (err) {
    toast(t('io.saveFailed', { err: errText(err) }));
    return;
  }
  await savePerson(target);
  if (target.photo !== oldPhoto) invoke('delete_image', { name: oldPhoto }).catch(() => {});
  renderAll();
});
$('#editDialog').addEventListener('close', clearEditPhoto);
$('#editCancel').addEventListener('click', () => $('#editDialog').close());
$('#editDelete').addEventListener('click', async () => {
  if (!editing) return;
  const target = editing;
  $('#editDialog').close();
  if (await confirmDialog(t('edit.confirmDelete', { name: target.name || t('people.noName') }))) {
    await deletePerson(target.id);
    renderAll();
    toast(t('edit.deleted'));
  }
});

// ---------------------------------------------------------------------------
// Data folder, export / import (a zip with the same layout as the data folder)
// ---------------------------------------------------------------------------
$('#openFolderBtn').addEventListener('click', () => {
  invoke('open_data_dir').catch(err => toast(errText(err)));
});

$('#exportBtn').addEventListener('click', async () => {
  if (!people.length) { toast(t('io.nothing')); return; }
  const date = new Date();
  const now = date.toISOString();
  const time = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  try {
    const path = await tauri.dialog.save({
      defaultPath: `whoisthis-${now.slice(0, 10)}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    if (!path) return;
    await invoke('export_zip', { path, time, json: JSON.stringify(fileDoc({ exported: now })) });
    toast(t('io.exported', { n: people.length }));
  } catch (err) {
    toast(t('io.exportFailed', { err: errText(err) }));
  }
});

$('#importBtn').addEventListener('click', async () => {
  try {
    const path = await tauri.dialog.open({ filters: [{ name: 'WhoIsThis', extensions: ['zip', 'json'] }] });
    if (!path) return;
    // For a zip the backend has already copied the images into the data folder
    const data = JSON.parse(await invoke('import_file', { path }));
    if (data.app !== 'whoisthis' || !Array.isArray(data.people)) throw new Error(t('io.notOurs'));
    const replaced = [];
    let n = 0;
    for (const p of data.people) {
      if (typeof p?.id !== 'string' || !PERSON_ID.test(p.id) || typeof p.photo !== 'string') continue;
      let photo = p.photo;
      // Old .json exports embed the photo as a data URL
      if (photo.startsWith('data:')) photo = await writePhoto(await dataUrlToBlob(photo), p.id);
      else if (!PHOTO_NAME.test(photo)) continue;
      const old = people.find(x => x.id === p.id);
      if (old?.photo && old.photo !== photo) replaced.push(old.photo);
      upsert(importedPerson(p, photo));
      n++;
    }
    await persist();
    for (const name of replaced) invoke('delete_image', { name }).catch(() => {});
    renderAll();
    toast(t('io.imported', { n }));
  } catch (err) {
    toast(t('io.importFailed', { err: errText(err) }));
  }
});

// ---------------------------------------------------------------------------
// Study (flashcards)
// ---------------------------------------------------------------------------
let deck = [];
let deckPos = 0;

function startStudy() {
  deck = shuffle(filtered());
  deckPos = 0;
  renderStudy();
}
function renderStudy() {
  // Drop people that were deleted since the deck was built
  deck = deck.map(d => people.find(p => p.id === d.id)).filter(Boolean);
  deckPos = Math.min(deckPos, Math.max(0, deck.length - 1));
  const has = deck.length > 0;
  $('.study-wrap').hidden = !has;
  $('#studyEmpty').hidden = has;
  if (!has) return;
  const p = deck[deckPos];
  $('#studyImg').src = photoUrl(p);
  $('#studyName').textContent = p.name;
  $('#studyReading').textContent = p.reading;
  $('#studyMeta').textContent = [p.group, p.note].filter(Boolean).join('\n');
  $('#studyBack').hidden = true;
  $('#studyTap').hidden = false;
  $('#studyPos').textContent = `${deckPos + 1} / ${deck.length}`;
}
function flipStudy() {
  const back = $('#studyBack');
  back.hidden = !back.hidden;
  $('#studyTap').hidden = !back.hidden;
}
function moveStudy(d) {
  if (!deck.length) return;
  deckPos = (deckPos + d + deck.length) % deck.length;
  renderStudy();
}
$('#studyCard').addEventListener('click', flipStudy);
$('#studyPrev').addEventListener('click', () => moveStudy(-1));
$('#studyNext').addEventListener('click', () => moveStudy(1));
$('#studyShuffle').addEventListener('click', () => { startStudy(); toast(t('study.shuffled')); });

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------
let quiz = null;

function showQuizSetup() {
  quiz = null;
  $('#quizSetup').hidden = false;
  $('#quizPlay').hidden = true;
  $('#quizResult').hidden = true;
  $('#quizWarn').hidden = true;
}

// Question count: "Everyone" (default) or a number the user types
function renderPoolSize() {
  const n = filtered().length;
  $('#quizPoolSize').textContent = t('quiz.count.pool', { n });
  $('#countInput').max = Math.max(1, n);
}
$('#countInput').addEventListener('focus', () => { $('#countCustom').checked = true; });
$('#countInput').addEventListener('input', () => { $('#countCustom').checked = true; });

// Returns the number of questions to ask, or null if the typed number is invalid
function questionCount(poolSize) {
  if ($('input[name=count]:checked').value === 'all') return poolSize;
  const n = Number($('#countInput').value);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, poolSize);
}

// Weighted draw without replacement: lower mastery => higher chance
function pickWeighted(pool, n) {
  const rest = [...pool];
  const out = [];
  while (out.length < n && rest.length) {
    const w = rest.map(p => 2 ** (MAX_LEVEL - Math.min(p.level || 0, MAX_LEVEL)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < rest.length - 1 && (r -= w[i]) > 0) i++;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

// Distractors come from the current group, or from everyone if the group is too small
function choicePool() {
  return filtered().length >= 4 ? filtered() : people;
}

function startQuiz(targets, mode) {
  const warn = $('#quizWarn');
  if (!targets.length) {
    warn.textContent = t('quiz.noOne');
    warn.hidden = false;
    return;
  }
  const distinctNames = new Set(choicePool().map(p => normalize(p.name)));
  if ((mode === 'face2name' || mode === 'name2face') && distinctNames.size < 2) {
    warn.textContent = t('quiz.needTwo');
    warn.hidden = false;
    return;
  }
  quiz = { mode, questions: targets, index: 0, correct: 0, missed: [], answered: false };
  $('#quizSetup').hidden = true;
  $('#quizResult').hidden = true;
  $('#quizPlay').hidden = false;
  renderQuestion();
}

$('#quizStart').addEventListener('click', () => {
  const mode = $('input[name=mode]:checked').value;
  const pool = filtered();
  const count = questionCount(pool.length);
  if (count === null) {
    $('#quizWarn').textContent = t('quiz.count.invalid');
    $('#quizWarn').hidden = false;
    $('#countInput').focus();
    return;
  }
  startQuiz(pickWeighted(pool, count), mode);
});
$('#quizQuit').addEventListener('click', showQuizSetup);
$('#quizAgain').addEventListener('click', showQuizSetup);
$('#quizRetryMissed').addEventListener('click', () => startQuiz(shuffle(quiz.missed), quiz.mode));

function buildChoices(answer) {
  // Never show two options with the same name
  const seen = new Set([normalize(answer.name)]);
  const others = [];
  for (const p of shuffle(choicePool())) {
    if (others.length >= 3) break;
    const key = normalize(p.name);
    if (p.id === answer.id || seen.has(key)) continue;
    seen.add(key);
    others.push(p);
  }
  return shuffle([answer, ...others]);
}

function renderQuestion() {
  const { questions, index, mode } = quiz;
  const p = questions[index];
  quiz.answered = false;
  $('#quizProgress').textContent = `${index + 1} / ${questions.length}`;
  $('#quizBar').style.width = `${(index / questions.length) * 100}%`;
  $('#quizFeedback').hidden = true;
  $('#quizNext').hidden = true;

  const prompt = $('#quizPrompt');
  const choices = $('#quizChoices');
  const typing = $('#quizTyping');
  const self = $('#quizSelf');
  self.hidden = mode !== 'selfcheck';

  if (mode === 'name2face') {
    prompt.innerHTML = `<div class="prompt-name">${esc(p.name)}<small>${esc(p.reading)}</small></div>`;
  } else {
    prompt.innerHTML = `<img src="${esc(photoUrl(p))}" alt="" />`;
  }

  if (mode === 'selfcheck') {
    choices.hidden = true;
    typing.hidden = true;
    $('#quizReveal').hidden = false;
    $('#quizAnswer').hidden = true;
    $('#quizJudge').hidden = true;
    $('#quizAnswerName').textContent = p.name;
    $('#quizAnswerReading').textContent = p.reading;
    $('#quizAnswerNote').textContent = p.note;
    $('#quizReveal').focus();
    return;
  }

  if (mode === 'typing') {
    choices.hidden = true;
    typing.hidden = false;
    $('#quizInput').value = '';
    $('#quizInput').disabled = false;
    $('#quizInput').focus();
    return;
  }

  typing.hidden = true;
  choices.hidden = false;
  choices.classList.toggle('faces', mode === 'name2face');
  quiz.choices = buildChoices(p);
  choices.innerHTML = quiz.choices.map((c, i) => mode === 'name2face'
    ? `<button class="choice face" data-i="${i}"><img src="${esc(photoUrl(c))}" alt="" /><kbd>${i + 1}</kbd></button>`
    : `<button class="choice" data-i="${i}"><kbd>${i + 1}</kbd>${esc(c.name)}</button>`).join('');
}

$('#quizChoices').addEventListener('click', e => {
  const btn = e.target.closest('.choice');
  if (btn) answerChoice(Number(btn.dataset.i));
});

function answerChoice(i) {
  if (!quiz || quiz.answered || !quiz.choices?.[i]) return;
  const p = quiz.questions[quiz.index];
  const ok = quiz.choices[i].id === p.id;
  $$('#quizChoices .choice').forEach((b, j) => {
    b.disabled = true;
    if (quiz.choices[j].id === p.id) b.classList.add('correct');
    else if (j === i) b.classList.add('wrong');
  });
  finishAnswer(ok);
}

$('#quizTyping').addEventListener('submit', e => {
  e.preventDefault();
  if (!quiz || quiz.answered) return;
  const p = quiz.questions[quiz.index];
  const input = normalize($('#quizInput').value);
  if (!input) return;
  const ok = input === normalize(p.name) || (!!p.reading && input === normalize(p.reading));
  $('#quizInput').disabled = true;
  finishAnswer(ok);
});

// Self-check: reveal the answer, then the user marks it right or wrong
function revealAnswer() {
  if (!quiz || quiz.mode !== 'selfcheck' || quiz.answered || !$('#quizAnswer').hidden) return;
  $('#quizReveal').hidden = true;
  $('#quizAnswer').hidden = false;
  $('#quizJudge').hidden = false;
}
function judgeSelf(ok) {
  if (!quiz || quiz.mode !== 'selfcheck' || quiz.answered || $('#quizAnswer').hidden) return;
  finishAnswer(ok);
}
$('#quizReveal').addEventListener('click', revealAnswer);
$('#quizGot').addEventListener('click', () => judgeSelf(true));
$('#quizMiss').addEventListener('click', () => judgeSelf(false));

async function finishAnswer(ok) {
  quiz.answered = true;
  quiz.lastOk = ok;
  const p = quiz.questions[quiz.index];
  const fresh = people.find(x => x.id === p.id) || p;
  const updated = ok
    ? { ...fresh, correct: (fresh.correct || 0) + 1, level: Math.min(MAX_LEVEL, (fresh.level || 0) + 1) }
    : { ...fresh, wrong: (fresh.wrong || 0) + 1, level: 0 };

  if (ok) quiz.correct++;
  else quiz.missed.push(updated);
  // Self-check already showed the answer, so go straight to the next question
  if (quiz.mode === 'selfcheck') nextQuestion(); else showFeedback(ok);
  await savePerson(updated);
}

function showFeedback(ok) {
  const p = quiz.questions[quiz.index];
  const fb = $('#quizFeedback');
  fb.className = 'feedback ' + (ok ? 'ok' : 'ng');
  const who = p.reading ? `${p.name} (${p.reading})` : p.name;
  fb.innerHTML = esc(t(ok ? 'quiz.correct' : 'quiz.wrong', { who })) +
    (p.note ? `<div class="note">${esc(p.note)}</div>` : '');
  fb.hidden = false;
  $('#quizNext').hidden = false;
  $('#quizNext').focus();
}

function nextQuestion() {
  if (!quiz || !quiz.answered) return;
  quiz.index++;
  if (quiz.index < quiz.questions.length) renderQuestion();
  else showResult();
}
$('#quizNext').addEventListener('click', nextQuestion);

function showResult() {
  const { correct, questions, missed } = quiz;
  $('#quizPlay').hidden = true;
  $('#quizResult').hidden = false;
  const pct = Math.round((correct / questions.length) * 100);
  const msg = t(pct === 100 ? 'quiz.msg.perfect' : pct >= 80 ? 'quiz.msg.good' : pct >= 50 ? 'quiz.msg.ok' : 'quiz.msg.low');
  $('#quizScore').innerHTML = `${correct} / ${questions.length}<small>${pct}% · ${esc(msg)}</small>`;
  $('#quizMissed').innerHTML = missed.map(p =>
    `<figure><img src="${esc(photoUrl(p))}" alt="" /><figcaption>${esc(p.name)}</figcaption></figure>`).join('');
  $('#quizRetryMissed').hidden = missed.length === 0;
  renderAll();
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------
$('#aboutBtn').addEventListener('click', async () => {
  let version = '';
  try { version = await tauri.app.getVersion(); } catch { /* not available */ }
  $('#aboutVersion').textContent = version ? t('about.version', { v: version }) : '';
  const frame = $('#licensesFrame');
  if (!frame.getAttribute('src')) frame.src = 'third-party-licenses.html';
  $('#aboutDialog').showModal();
});
$('#aboutClose').addEventListener('click', () => $('#aboutDialog').close());

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------
document.addEventListener('keydown', e => {
  if ($$('dialog').some(d => d.open)) return;
  const inField = e.target.matches('input, textarea, select');

  if (currentView === 'study' && !inField) {
    if (e.key === ' ') { e.preventDefault(); flipStudy(); }
    if (e.key === 'ArrowRight') moveStudy(1);
    if (e.key === 'ArrowLeft') moveStudy(-1);
  }
  if (currentView === 'quiz' && quiz && !$('#quizPlay').hidden && quiz.mode === 'selfcheck') {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); revealAnswer(); }
    if (e.key === 'ArrowRight') judgeSelf(true);
    if (e.key === 'ArrowLeft') judgeSelf(false);
    return;
  }
  if (currentView === 'quiz' && quiz && !$('#quizPlay').hidden) {
    if (e.key === 'Enter' && quiz.answered) { e.preventDefault(); nextQuestion(); }
    if (!inField && /^[1-4]$/.test(e.key)) answerChoice(Number(e.key) - 1);
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async () => {
  renderLangSelect();
  applyStaticText();
  try {
    imagesDir = await invoke('images_dir');
    const json = await invoke('load_people');
    if (json) people = JSON.parse(json).people ?? [];
    else await migrateLegacy();
  } catch (err) {
    toast(t('io.saveFailed', { err: errText(err) }));
  }
  renderAll();
})();
