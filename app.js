'use strict';

/* ---------- Storage ---------- */

const STORE_KEY = 'exhale.v1';
const DEFAULT_SETTINGS = { narrator: true, voiceURI: 'rec:heart', haptics: true, countdown: true, keepAwake: true, theme: 'auto' };

const PRESETS = [
  { id: 'relax', name: 'Relax', category: 'stress', desc: 'A longer exhale calms your nervous system. A good everyday reset.',
    inhale: 4, hold1: 0, exhale: 6, hold2: 0, mode: 'minutes', amount: 3, sets: 1, rest: 0, c1: '#4fb3e8', c2: '#3fc1a5' },
  { id: 'deep-calm', name: 'Deep Calm', category: 'anxiety', desc: 'Inhale, pause, then let go slowly. Helps when anxiety builds up.',
    inhale: 4, hold1: 5, exhale: 6, hold2: 0, mode: 'minutes', amount: 4, sets: 1, rest: 0, c1: '#7c6cf0', c2: '#4fb3e8' },
  { id: '478', name: '4-7-8 Sleep', category: 'sleep', desc: 'Dr. Andrew Weil\'s technique for falling asleep. Start with 4 cycles and build up.',
    inhale: 4, hold1: 7, exhale: 8, hold2: 0, mode: 'cycles', amount: 4, sets: 1, rest: 0, c1: '#3b4fa8', c2: '#8b7cf6' },
  { id: 'box', name: 'Box Breathing', category: 'focus', desc: 'Four equal sides. Used by athletes and first responders to stay calm under pressure.',
    inhale: 4, hold1: 4, exhale: 4, hold2: 4, mode: 'minutes', amount: 5, sets: 1, rest: 0, c1: '#3a8dde', c2: '#3fc1a5' },
  { id: 'coherent', name: 'Coherent Breathing', category: 'stress', desc: 'About 5.5 breaths per minute, a rate linked to better heart rate variability.',
    inhale: 5.5, hold1: 0, exhale: 5.5, hold2: 0, mode: 'minutes', amount: 5, sets: 1, rest: 0, c1: '#3fc1a5', c2: '#a6d96a' },
  { id: 'sleep-wind', name: 'Wind Down', category: 'sleep', desc: 'Slow and long. Lie down, close your eyes and follow the narrator.',
    inhale: 4, hold1: 2, exhale: 8, hold2: 2, mode: 'minutes', amount: 8, sets: 1, rest: 0, c1: '#1f3a6b', c2: '#7c6cf0' },
  { id: 'anxiety-sets', name: 'Anxiety Relief', category: 'anxiety', desc: 'Three sets of extended exhales with short breaks in between.',
    inhale: 4, hold1: 0, exhale: 8, hold2: 0, mode: 'cycles', amount: 6, sets: 3, rest: 20, c1: '#e07a9f', c2: '#7c6cf0' },
  { id: 'energize', name: 'Energize', category: 'focus', desc: 'Quicker, even breaths with a short pause to wake up body and mind.',
    inhale: 3, hold1: 1, exhale: 3, hold2: 0, mode: 'minutes', amount: 2, sets: 1, rest: 0, c1: '#f2a541', c2: '#e07a9f' },
];

const CATEGORIES = { all: 'All', sleep: 'Sleep', stress: 'Stress', anxiety: 'Anxiety', focus: 'Focus', custom: 'My exercises' };

function loadState() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) {}
  return {
    custom: s.custom || [],
    overrides: s.overrides || {},          // per-preset duration tweaks
    sessions: s.sessions || [],
    reminders: s.reminders || [],
    settings: Object.assign({}, DEFAULT_SETTINGS, s.settings),
  };
}
let state = loadState();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast('Could not save data on this device'); }
}

function allExercises() {
  const presets = PRESETS.map(p => Object.assign({ builtin: true }, p, state.overrides[p.id]));
  return presets.concat(state.custom.map(c => Object.assign({ category: 'custom' }, c)));
}
const findExercise = id => allExercises().find(e => e.id === id);

/* ---------- Formatting ---------- */

const nf = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });
const fmtNum = n => nf.format(n);
const pad = n => String(n).padStart(2, '0');
function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cycleLen = e => e.inhale + e.hold1 + e.exhale + e.hold2;
const patternText = e => [e.inhale, e.hold1, e.exhale, e.hold2].filter((v, i) => v > 0 || i % 2 === 0).map(fmtNum).join(' · ');

function cyclesPerSet(e) {
  if (e.mode === 'infinite') return Infinity;
  if (e.mode === 'cycles') return Math.max(1, e.amount);
  return Math.max(1, Math.ceil(e.amount * 60 / cycleLen(e)));
}
function totalSeconds(e) {
  if (e.mode === 'infinite') return Infinity;
  return cyclesPerSet(e) * cycleLen(e) * e.sets + e.rest * (e.sets - 1);
}
function durationText(e) {
  if (e.mode === 'infinite') return 'No time limit';
  const mins = e.mode === 'minutes' ? e.amount * e.sets + e.rest * (e.sets - 1) / 60 : totalSeconds(e) / 60;
  const parts = [`${fmtNum(Math.round(mins * 10) / 10)} min`];
  if (e.mode === 'cycles') parts.push(`${e.amount} cycles`);
  if (e.sets > 1) parts.push(`${e.sets} sets`);
  return parts.join(' · ');
}

/* ---------- Theme ---------- */

const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = state.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && darkMQ.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]').content = dark ? '#0b1424' : '#e6eef8';
}
darkMQ.addEventListener('change', () => { applyTheme(); if (currentTab === 'settings') renderSettings(); });
applyTheme();

/* ---------- UI helpers ---------- */

const $ = sel => document.querySelector(sel);
const view = $('#view');
let currentTab = 'breathe';
let filter = 'all';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, 2600);
}

function switchHtml(key, checked) {
  return `<label class="switch"><input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''}><span></span></label>`;
}

function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
  ({ breathe: renderBreathe, progress: renderProgress, reminders: renderReminders, learn: renderLearn, settings: renderSettings })[currentTab]();
  view.scrollTop = 0;
}

$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  currentTab = b.dataset.tab;
  closeSheet();
  render();
  window.scrollTo(0, 0);
});

/* ---------- Breathe tab ---------- */

function renderBreathe() {
  const list = allExercises().filter(e => filter === 'all' || e.category === filter);
  view.innerHTML = `
    <h1>Breathe</h1>
    <p class="sub">${greeting()}</p>
    <div class="chips">${Object.entries(CATEGORIES).map(([k, v]) =>
      `<button class="chip ${filter === k ? 'active' : ''}" data-filter="${k}">${v}</button>`).join('')}</div>
    ${list.map(e => `
      <button class="ex" data-open="${e.id}" style="--c1:${e.c1 || '#4fb3e8'};--c2:${e.c2 || '#7c6cf0'}">
        <div class="ex-dot"></div>
        <div class="ex-body">
          <div class="ex-name">${esc(e.name)}</div>
          <div class="ex-meta">${durationText(e)}</div>
          <div class="ex-pattern">${patternText(e)}</div>
        </div>
        <span class="muted">›</span>
      </button>`).join('')}
    ${list.length ? '' : '<p class="muted">No exercises here yet.</p>'}
    <button class="add-btn" data-new>+ Create your own exercise</button>`;
}

function greeting() {
  const h = new Date().getHours();
  const today = todayMinutes();
  const hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return today ? `${hi}. ${fmtNum(today)} mindful min today.` : `${hi}. Take a moment for yourself.`;
}

view.addEventListener('click', e => {
  const t = e.target;
  const f = t.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; renderBreathe(); return; }
  const o = t.closest('[data-open]');
  if (o) { openDetail(o.dataset.open); return; }
  if (t.closest('[data-new]')) { openEditor(null); return; }
});

/* ---------- Exercise detail sheet ---------- */

function openSheet(html) {
  $('#sheet').innerHTML = '<div class="grab"></div>' + html;
  $('#sheet').hidden = false;
  $('#sheet-backdrop').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true; }
$('#sheet-backdrop').addEventListener('click', closeSheet);

function patternViz(e) {
  const cells = [['Inhale', e.inhale, 'var(--inhale)'], ['Hold', e.hold1, 'var(--hold)'],
    ['Exhale', e.exhale, 'var(--exhale)'], ['Hold', e.hold2, 'var(--hold)']].filter(c => c[1] > 0);
  return `<div class="pattern-viz">${cells.map(([n, v, c]) =>
    `<div style="flex:${v};background:${c}"><b>${fmtNum(v)}</b>${n}</div>`).join('')}</div>`;
}

function openDetail(id) {
  const e = findExercise(id);
  if (!e) return;
  const amountLabel = e.mode === 'cycles' ? 'Cycles' : 'Minutes';
  openSheet(`
    <div class="row"><h3 style="font-size:22px">${esc(e.name)}</h3><span class="spacer"></span>
      <button class="btn ghost" data-act="edit">${e.builtin ? 'Customize' : 'Edit'}</button></div>
    <p class="muted" style="margin:0">${esc(e.desc || '')}</p>
    ${patternViz(e)}
    <p class="small muted" style="margin:-4px 0 16px">Seconds per phase · one cycle is ${fmtNum(cycleLen(e))} s</p>
    ${e.mode === 'infinite' ? '<p class="muted">Breathe as long as you like. A timer keeps track.</p>' : `
    <div class="row" style="margin-bottom:8px">
      <div><b>${amountLabel}</b>${e.sets > 1 ? `<div class="small muted">per set · ${e.sets} sets</div>` : ''}</div>
      <span class="spacer"></span>
      <div class="stepper"><button data-act="dec" aria-label="Less">−</button>
        <span class="val mono" id="amt">${fmtNum(e.amount)}</span>
        <button data-act="inc" aria-label="More">+</button></div>
    </div>
    <p class="small muted" id="dur">${durationText(e)}</p>`}
    <button class="btn primary wide" data-act="start" style="margin-top:12px">Start</button>`);

  $('#sheet').onclick = ev => {
    const a = ev.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'start') { closeSheet(); startSession(findExercise(id)); }
    if (act === 'edit') { closeSheet(); openEditor(id); }
    if (act === 'inc' || act === 'dec') {
      const cur = findExercise(id);
      const step = cur.mode === 'cycles' ? 1 : (cur.amount < 2 ? .5 : 1);
      const amount = Math.min(99, Math.max(cur.mode === 'cycles' ? 1 : .5, cur.amount + (act === 'inc' ? step : -step)));
      if (cur.builtin) state.overrides[id] = Object.assign({}, state.overrides[id], { amount });
      else Object.assign(state.custom.find(c => c.id === id), { amount });
      save();
      $('#amt').textContent = fmtNum(amount);
      $('#dur').textContent = durationText(findExercise(id));
      if (currentTab === 'breathe') renderBreathe();
    }
  };
}

/* ---------- Editor ---------- */

function openEditor(id) {
  const src = id ? findExercise(id) : null;
  const isCopy = src && src.builtin;
  const e = Object.assign({ name: '', desc: '', inhale: 4, hold1: 0, exhale: 4, hold2: 0, mode: 'minutes', amount: 3, sets: 1, rest: 15,
    c1: '#4fb3e8', c2: '#7c6cf0' }, src || {});
  if (isCopy) e.name = `My ${e.name}`;
  const draft = Object.assign({}, e);

  const step = (key, label, min, max, inc) => `
    <div class="field"><label>${label}</label><div class="stepper">
      <button data-step="${key}" data-d="${-inc}" data-min="${min}" data-max="${max}">−</button>
      <span class="val mono" data-val="${key}">${fmtNum(draft[key])}</span>
      <button data-step="${key}" data-d="${inc}" data-min="${min}" data-max="${max}">+</button></div></div>`;

  openSheet(`
    <h3 style="font-size:22px">${src && !isCopy ? 'Edit exercise' : 'New exercise'}</h3>
    <div class="field"><label>Name</label><input type="text" id="e-name" maxlength="40" value="${esc(draft.name)}" placeholder="e.g. Morning calm"></div>
    <div class="field"><label>Description (optional)</label><input type="text" id="e-desc" maxlength="120" value="${esc(draft.desc || '')}"></div>
    <div id="e-viz"></div>
    <div class="grid4">
      ${step('inhale', 'Inhale (s)', 1, 30, .5)}
      ${step('hold1', 'Hold after inhale (s)', 0, 60, .5)}
      ${step('exhale', 'Exhale (s)', 1, 30, .5)}
      ${step('hold2', 'Hold after exhale (s)', 0, 60, .5)}
    </div>
    <div class="field"><label>Duration</label>
      <div class="seg" id="e-mode">
        <button data-mode="minutes">Minutes</button><button data-mode="cycles">Cycles</button><button data-mode="infinite">Infinite</button>
      </div></div>
    <div id="e-amount"></div>
    <p class="small muted" id="e-total"></p>
    <div class="row" style="margin-top:10px">
      ${src && !isCopy ? '<button class="btn danger" data-del>Delete</button>' : ''}
      <span class="spacer"></span>
      <button class="btn" data-cancel>Cancel</button>
      <button class="btn primary" data-save>Save</button>
    </div>`);

  function refresh() {
    document.querySelectorAll('#sheet [data-val]').forEach(v => { v.textContent = fmtNum(draft[v.dataset.val]); });
    document.querySelectorAll('#e-mode button').forEach(b => b.classList.toggle('active', b.dataset.mode === draft.mode));
    $('#e-viz').innerHTML = patternViz(draft);
    $('#e-amount').innerHTML = draft.mode === 'infinite' ? '' : `<div class="grid4">
      ${step('amount', draft.mode === 'cycles' ? 'Cycles per set' : 'Minutes per set', draft.mode === 'cycles' ? 1 : .5, 99, draft.mode === 'cycles' ? 1 : .5)}
      ${step('sets', 'Sets', 1, 10, 1)}
      ${draft.sets > 1 ? step('rest', 'Rest between sets (s)', 0, 300, 5) : ''}</div>`;
    $('#e-total').textContent = draft.mode === 'infinite' ? 'Runs until you stop it.' : `Total: ${durationText(draft)}`;
  }
  refresh();

  $('#sheet').onclick = ev => {
    const t = ev.target;
    const s = t.closest('[data-step]');
    if (s) {
      const k = s.dataset.step;
      draft[k] = Math.round(Math.min(+s.dataset.max, Math.max(+s.dataset.min, draft[k] + +s.dataset.d)) * 10) / 10;
      refresh(); return;
    }
    const m = t.closest('[data-mode]');
    if (m) {
      draft.mode = m.dataset.mode;
      if (draft.mode === 'cycles') draft.amount = Math.max(1, Math.round(draft.amount));
      if (draft.mode === 'infinite') draft.sets = 1;
      refresh(); return;
    }
    if (t.closest('[data-cancel]')) { closeSheet(); return; }
    if (t.closest('[data-del]')) {
      if (!confirm(`Delete "${draft.name}"?`)) return;
      state.custom = state.custom.filter(c => c.id !== id);
      save(); closeSheet(); render(); toast('Exercise deleted'); return;
    }
    if (t.closest('[data-save]')) {
      draft.name = $('#e-name').value.trim() || 'My exercise';
      draft.desc = $('#e-desc').value.trim();
      const rec = { id: src && !isCopy ? id : 'c' + Date.now().toString(36), name: draft.name, desc: draft.desc,
        inhale: draft.inhale, hold1: draft.hold1, exhale: draft.exhale, hold2: draft.hold2,
        mode: draft.mode, amount: draft.amount, sets: draft.sets, rest: draft.rest, c1: draft.c1, c2: draft.c2 };
      const i = state.custom.findIndex(c => c.id === rec.id);
      if (i >= 0) state.custom[i] = rec; else state.custom.push(rec);
      save(); closeSheet();
      currentTab = 'breathe'; filter = 'custom'; render();
      toast('Exercise saved');
    }
  };
}

/* ---------- Narrator & haptic cues ---------- */

// Recorded voices (clips in voice/<id>/<word>.mp3) sound the same on every device and are the default.
// The device's own speech voices stay available as extra options.
const RECORDED = [
  ['heart', 'Heart – warm, female (US)'],
  ['bella', 'Bella – soft, female (US)'],
  ['emma', 'Emma – gentle, female (UK)'],
  ['michael', 'Michael – calm, male (US)'],
  ['nicole', 'Nicole – ASMR whisper, female (US)'],
  ['velvet', 'Velvet – soft and breathy, female (US)'],
];
const WORDS = { inhale: 'Inhale', hold: 'Hold', exhale: 'Exhale', rest: 'Rest' };
const hasSpeech = 'speechSynthesis' in window;
const recordedId = () => {
  const v = state.settings.voiceURI || 'rec:heart';
  return v.startsWith('rec:') ? v.slice(4) : null;
};

let audioCtx = null, clipSource = null;
const clips = {};   // 'heart/inhale' -> Promise<AudioBuffer>
function loadClip(key) {
  if (!clips[key]) {
    clips[key] = fetch(`voice/${key}.mp3`).then(r => r.arrayBuffer())
      .then(buf => new Promise((ok, fail) => audioCtx.decodeAudioData(buf, ok, fail)));
    clips[key].catch(() => { delete clips[key]; });
  }
  return clips[key];
}
// Browsers (iOS especially) only allow audio that starts from a tap, so this runs on Start / Preview.
function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!audioCtx && AC) audioCtx = new AC();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  const id = recordedId();
  if (audioCtx && id) Object.keys(WORDS).forEach(w => loadClip(`${id}/${w}`));
  if (hasSpeech) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
}
function playClip(key) {
  if (!audioCtx) return;
  loadClip(key).then(buffer => {
    if (clipSource) try { clipSource.stop(); } catch (e) {}
    clipSource = audioCtx.createBufferSource();
    clipSource.buffer = buffer;
    clipSource.connect(audioCtx.destination);
    clipSource.start();
  }).catch(() => {});
}

// Neural voices (Edge "Online (Natural)", Apple "Premium"/"Enhanced", Google network voices) sound far more human
// than the classic built-in ones, so they rank first and are picked by default.
const isNatural = v => /natural|neural|premium|enhanced|google/i.test(v.name) || v.localService === false;
const voiceScore = v => (isNatural(v) ? 4 : 0) + (v.lang.startsWith('en') ? 2 : 0)
  + (/aria|jenny|emma|ava|samantha|serena|libby|sonia|natasha/i.test(v.name) ? 1 : 0);

function narratorVoices() {
  if (!hasSpeech) return [];
  return speechSynthesis.getVoices().slice().sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
}
function chosenVoice() {
  const voices = narratorVoices();
  return voices.find(v => v.voiceURI === state.settings.voiceURI) || voices[0] || null;
}
if (hasSpeech) speechSynthesis.addEventListener('voiceschanged', () => { if (currentTab === 'settings') renderSettings(); });

// word is one of the WORDS keys
function say(word, force) {
  if (!state.settings.narrator && !force) return;
  const id = recordedId();
  if (id) { playClip(`${id}/${word}`); return; }
  if (!hasSpeech) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(WORDS[word]);
  const v = chosenVoice();
  if (v) { u.voice = v; u.lang = v.lang; }
  // Slow, slightly lower and softer for a calm delivery; classic voices need more slowing than neural ones.
  u.rate = v && isNatural(v) ? .82 : .72;
  u.pitch = .9;
  u.volume = .85;
  speechSynthesis.speak(u);
}
function previewVoice() {
  unlockAudio();
  ['inhale', 'hold', 'exhale'].forEach((w, i) => setTimeout(() => say(w, true), i * 1300));
}

const PHASES = {
  inhale: { label: 'Inhale', voice: 'inhale', color: 'var(--inhale)' },
  hold1: { label: 'Hold', voice: 'hold', color: 'var(--hold)' },
  exhale: { label: 'Exhale', voice: 'exhale', color: 'var(--exhale)' },
  hold2: { label: 'Hold', voice: 'hold', color: 'var(--hold)' },
  rest: { label: 'Rest', voice: 'rest', color: 'var(--rest)' },
};

function cue(phase) {
  const st = state.settings;
  say(PHASES[phase].voice);
  if (st.haptics && navigator.vibrate) {
    navigator.vibrate(phase === 'inhale' ? [60] : phase === 'exhale' ? [40, 60, 40] : [25]);
  }
}

/* ---------- Breathing session engine ---------- */

let S = null;           // running session
let wakeLock = null;

async function requestWake() {
  if (!state.settings.keepAwake || !('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function releaseWake() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
document.addEventListener('visibilitychange', () => { if (S && !S.paused && document.visibilityState === 'visible') requestWake(); });

function startSession(e) {
  unlockAudio();
  const phases = ['inhale', 'hold1', 'exhale', 'hold2'].filter(k => e[k] > 0);
  S = {
    e, phases, cycles: cyclesPerSet(e), total: totalSeconds(e),
    set: 0, cycle: 0, pi: -1, phase: 'ready', phaseStart: 0, phaseEnd: state.settings.countdown ? 3 : 0,
    acc: 0, resumedAt: performance.now(), paused: false, lastCount: null,
  };
  $('#s-title').textContent = e.name;
  $('#s-pause').textContent = 'Pause';
  $('#orb').style.setProperty('--orb', 'var(--rest)');
  $('#s-phase').textContent = 'Get ready';
  $('#session').hidden = false;
  requestWake();
  S.raf = requestAnimationFrame(tick);
  S.timer = setInterval(advance, 200);
}

const clock = () => S.acc + (S.paused ? 0 : (performance.now() - S.resumedAt) / 1000);

function nextPhase() {
  const len = k => k === 'rest' ? S.e.rest : S.e[k];
  if (S.phase === 'rest') { S.set++; S.cycle = 0; S.pi = 0; }
  else if (S.phase === 'ready') { S.pi = 0; }
  else {
    S.pi++;
    if (S.pi >= S.phases.length) {
      S.pi = 0; S.cycle++;
      if (S.cycle >= S.cycles) {
        if (S.set + 1 >= S.e.sets) return finishSession(true);
        if (S.e.rest > 0) { setPhase('rest', len('rest')); return true; }
        S.set++; S.cycle = 0;
      }
    }
  }
  const k = S.phases[S.pi];
  setPhase(k, len(k));
  return true;
}
function setPhase(k, dur) {
  S.phaseStart = S.phaseEnd;
  S.phaseEnd = S.phaseStart + dur;
  S.phase = k;
  $('#s-phase').textContent = PHASES[k].label;
  $('#orb').style.setProperty('--orb', PHASES[k].color);
  cue(k);
}

const MIN_SCALE = .42, MAX_SCALE = 1;
const ease = p => .5 - Math.cos(Math.PI * Math.min(1, Math.max(0, p))) / 2;

// Phase changes (and the narrator) run on a timer so they keep going when the window is in the background;
// animation frames only draw the circle and pause while hidden.
function advance() {
  if (!S) return false;
  const now = clock();
  while (S && now >= S.phaseEnd) { if (nextPhase() === false) return false; }
  return !!S;
}

function tick() {
  if (!advance()) return;
  const now = clock();

  const p = (now - S.phaseStart) / Math.max(.001, S.phaseEnd - S.phaseStart);
  let scale = MIN_SCALE;
  if (S.phase === 'inhale') scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * ease(p);
  else if (S.phase === 'hold1') scale = MAX_SCALE;
  else if (S.phase === 'exhale') scale = MAX_SCALE - (MAX_SCALE - MIN_SCALE) * ease(p);
  else if (S.phase === 'rest' || S.phase === 'ready') scale = MIN_SCALE + .04 * Math.sin(now * 1.5);
  $('#orb').style.transform = `scale(${scale})`;

  const count = Math.ceil(S.phaseEnd - now);
  if (count !== S.lastCount) {
    S.lastCount = count;
    $('#s-count').textContent = count > 0 ? count : '';
    const elapsed = Math.max(0, now - startOffset());
    $('#s-timer').textContent = fmtClock(S.total === Infinity ? elapsed : S.total - elapsed);
    renderSessionProgress(now);
  }
  S.raf = requestAnimationFrame(tick);
}
const startOffset = () => state.settings.countdown ? 3 : 0;

function renderSessionProgress(now) {
  if (S.phase === 'ready') { $('#s-progress').innerHTML = ''; return; }
  const parts = [];
  if (S.e.sets > 1) parts.push(`Set ${S.set + 1} of ${S.e.sets}`);
  if (S.phase !== 'rest') parts.push(S.cycles === Infinity ? `Cycle ${S.cycle + 1}` : `Cycle ${S.cycle + 1} of ${S.cycles}`);
  let bar = '';
  if (S.total !== Infinity) {
    const pct = Math.min(100, (now - startOffset()) / S.total * 100);
    bar = `<div class="pbar"><i style="width:${pct}%"></i></div>`;
  }
  $('#s-progress').innerHTML = parts.join(' · ') + bar;
}

function togglePause() {
  if (!S) return;
  if (S.paused) {
    S.paused = false; S.resumedAt = performance.now();
    $('#s-pause').textContent = 'Pause';
    $('#s-phase').textContent = PHASES[S.phase] ? PHASES[S.phase].label : 'Get ready';
    requestWake();
    S.raf = requestAnimationFrame(tick);
  } else {
    S.acc = clock(); S.paused = true;
    cancelAnimationFrame(S.raf);
    $('#s-pause').textContent = 'Resume';
    $('#s-phase').textContent = 'Paused';
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    releaseWake();
  }
}

function finishSession(completed) {
  if (!S) return false;
  cancelAnimationFrame(S.raf);
  clearInterval(S.timer);
  const seconds = Math.min(completed ? S.total : Infinity, Math.max(0, clock() - startOffset()));
  const cycles = S.set * (S.cycles === Infinity ? 0 : S.cycles) + S.cycle;
  const e = S.e;
  S = null;
  releaseWake();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  $('#session').hidden = true;

  if (seconds >= 30) {
    state.sessions.push({ at: new Date().toISOString(), id: e.id, name: e.name, sec: Math.round(seconds) });
    save();
  }
  if (completed || seconds >= 30) {
    const mins = Math.round(seconds / 6) / 10;
    $('#f-summary').innerHTML = `You breathed for <b>${fmtNum(mins)} min</b>${cycles ? ` · ${cycles} cycles` : ''}.<br>${fmtNum(totalMinutes())} mindful min in total.`;
    $('#finish').hidden = false;
  } else {
    render();
  }
  return false;
}

$('#s-pause').addEventListener('click', togglePause);
$('#s-close').addEventListener('click', () => { if (S) finishSession(false); });
$('#f-done').addEventListener('click', () => { $('#finish').hidden = true; render(); });
document.addEventListener('keydown', ev => {
  if ($('#session').hidden) { if (ev.key === 'Escape') closeSheet(); return; }
  if (ev.key === ' ') { ev.preventDefault(); togglePause(); }
  if (ev.key === 'Escape') finishSession(false);
});

/* ---------- Progress tab ---------- */

const totalMinutes = () => Math.round(state.sessions.reduce((a, s) => a + s.sec, 0) / 6) / 10;
function todayMinutes() {
  const k = dayKey(new Date());
  return Math.round(state.sessions.filter(s => dayKey(new Date(s.at)) === k).reduce((a, s) => a + s.sec, 0) / 6) / 10;
}
function streaks() {
  const days = new Set(state.sessions.map(s => dayKey(new Date(s.at))));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(d))) { current++; d.setDate(d.getDate() - 1); }
  let longest = 0, run = 0, prev = null;
  [...days].sort().forEach(k => {
    const t = new Date(k + 'T12:00:00');
    run = prev && (t - prev) / 864e5 < 1.5 ? run + 1 : 1;
    longest = Math.max(longest, run); prev = t;
  });
  return { current, longest };
}

function renderProgress() {
  const { current, longest } = streaks();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const min = state.sessions.filter(s => dayKey(new Date(s.at)) === k).reduce((a, s) => a + s.sec, 0) / 60;
    week.push({ label: d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2), min });
  }
  const max = Math.max(5, ...week.map(w => w.min));
  const recent = state.sessions.slice(-15).reverse();
  const weekly = state.sessions.filter(s => Date.now() - new Date(s.at) < 7 * 864e5).length;

  view.innerHTML = `
    <h1>Progress</h1>
    <p class="sub">Your mindful minutes, stored privately on this device.</p>
    <div class="stats">
      <div class="stat"><div class="v">${fmtNum(totalMinutes())}<small>min</small></div><div class="k">Mindful minutes</div></div>
      <div class="stat"><div class="v">${fmtNum(state.sessions.length)}</div><div class="k">Sessions</div></div>
      <div class="stat"><div class="v">${fmtNum(current)}<small>${current === 1 ? 'day' : 'days'}</small></div><div class="k">Current streak</div></div>
      <div class="stat"><div class="v">${weekly > 99 ? '99+' : weekly}</div><div class="k">Sessions this week</div></div>
    </div>
    <div class="card">
      <div class="row"><h3>Last 7 days</h3><span class="spacer"></span><span class="small muted">Longest streak: ${fmtNum(longest)} days</span></div>
      <div class="bars">${week.map(w => `
        <div class="bar">${w.min ? `<em>${fmtNum(Math.round(w.min))}</em>` : ''}<i style="height:${w.min / max * 100}%"></i><span>${w.label}</span></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <h3>Recent sessions</h3>
      ${recent.length ? `<ul class="log">${recent.map(s => `
        <li><span>${esc(s.name)}</span><span class="spacer"></span>
        <span class="muted small">${new Date(s.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${fmtNum(Math.round(s.sec / 6) / 10)} min</span></li>`).join('')}</ul>`
        : '<p class="muted small">Finish a session of 30 seconds or more and it shows up here.</p>'}
    </div>`;
}

/* ---------- Reminders ---------- */

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function renderReminders() {
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  view.innerHTML = `
    <h1>Reminders</h1>
    <p class="sub">Get a nudge to stop and breathe during the day.</p>
    ${perm === 'default' ? `<div class="card"><p style="margin-top:0">Allow notifications so reminders can pop up while Exhale is open.</p>
      <button class="btn primary" data-perm>Allow notifications</button></div>` : ''}
    ${perm === 'denied' ? '<div class="card small muted">Notifications are blocked for this site. You can still add reminders to your calendar below.</div>' : ''}
    ${state.reminders.map((r, i) => `
      <div class="card">
        <div class="row">
          <input type="time" value="${r.time}" data-rtime="${i}" style="font-size:26px;font-weight:650;border:0;background:none;padding:0">
          <span class="spacer"></span>${`<label class="switch"><input type="checkbox" data-ron="${i}" ${r.on ? 'checked' : ''}><span></span></label>`}
        </div>
        <div class="days" style="margin:12px 0">${DAY_NAMES.map((d, di) =>
          `<button class="${r.days.includes(di) ? 'active' : ''}" data-rday="${i}" data-d="${di}">${d}</button>`).join('')}</div>
        <div class="row"><button class="btn ghost" data-rics="${i}">Add to calendar</button><span class="spacer"></span>
          <button class="btn danger" data-rdel="${i}">Remove</button></div>
      </div>`).join('')}
    <button class="add-btn" data-radd>+ Add reminder</button>
    <p class="small muted" style="margin-top:16px">Web apps can only show reminders while they are open (or running in the background on some devices).
      For reminders that always arrive, use <b>Add to calendar</b>: it creates a repeating calendar event with an alert.</p>`;
}

view.addEventListener('click', e => {
  if (currentTab !== 'reminders') return;
  const t = e.target;
  if (t.closest('[data-perm]')) { Notification.requestPermission().then(renderReminders); return; }
  if (t.closest('[data-radd]')) {
    state.reminders.push({ time: '09:00', days: [1, 2, 3, 4, 5], on: true });
    save(); renderReminders();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(renderReminders);
    return;
  }
  const d = t.closest('[data-rday]');
  if (d) {
    const r = state.reminders[d.dataset.rday], di = +d.dataset.d;
    r.days = r.days.includes(di) ? r.days.filter(x => x !== di) : r.days.concat(di).sort();
    save(); renderReminders(); return;
  }
  const del = t.closest('[data-rdel]');
  if (del) { state.reminders.splice(+del.dataset.rdel, 1); save(); renderReminders(); return; }
  const ics = t.closest('[data-rics]');
  if (ics) downloadIcs(state.reminders[+ics.dataset.rics]);
});
view.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.rtime !== undefined) { state.reminders[+t.dataset.rtime].time = t.value || '09:00'; save(); }
  if (t.dataset.ron !== undefined) { state.reminders[+t.dataset.ron].on = t.checked; save(); }
  if (t.dataset.setting) {
    state.settings[t.dataset.setting] = t.type === 'checkbox' ? t.checked : t.value;
    save(); applyTheme();
    if (t.dataset.setting === 'voiceURI') { unlockAudio(); say('inhale', true); }
  }
});

function downloadIcs(r) {
  if (!r.days.length) { toast('Pick at least one day first'); return; }
  const [h, m] = r.time.split(':');
  const d = new Date();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Exhale//Breathing Reminder//EN', 'BEGIN:VEVENT',
    `UID:exhale-${Date.now()}@exhale.local`, `DTSTAMP:${stamp}`,
    `DTSTART:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${h}${m}00`,
    'DURATION:PT5M', `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map(x => ICS_DAYS[x]).join(',')}`,
    'SUMMARY:Time to breathe', 'DESCRIPTION:Take a few minutes for a breathing exercise in Exhale.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Time to breathe', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  downloadFile(`breathe-reminder-${r.time.replace(':', '')}.ics`, ics, 'text/calendar');
}

function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function checkReminders() {
  const now = new Date();
  const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const today = dayKey(now);
  let changed = false;
  state.reminders.forEach(r => {
    if (!r.on || r.time !== hm || !r.days.includes(now.getDay()) || r.last === today + hm) return;
    r.last = today + hm; changed = true;
    if (S) return; // already breathing
    const body = 'Take a minute to slow down and breathe.';
    if ('Notification' in window && Notification.permission === 'granted') {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification('Time to breathe', { body, icon: 'icons/icon-192.png', tag: 'exhale-reminder' }));
      } else {
        new Notification('Time to breathe', { body, icon: 'icons/icon-192.png' });
      }
    } else {
      toast('Time to breathe 🌿');
    }
  });
  if (changed) save();
}
setInterval(checkReminders, 15000);

/* ---------- Learn tab ---------- */

const BOOKS = [
  ['Breath: The New Science of a Lost Art', 'James Nestor', 'How the way we breathe affects sleep, health and mood, and how to fix it.', '#4fb3e8', '#1f3a6b'],
  ['The Wim Hof Method', 'Wim Hof', 'Breathing, cold exposure and commitment, from the "Iceman" himself.', '#3fc1a5', '#1f6b5a'],
  ['The Oxygen Advantage', 'Patrick McKeown', 'Nasal breathing and light breathing for fitness, sleep and calm.', '#f2a541', '#b0552a'],
  ['The Healing Power of the Breath', 'Richard P. Brown & Patricia L. Gerbarg', 'Two physicians on breathing practices for stress, anxiety and focus.', '#8b7cf6', '#3b2f8f'],
  ['Just Breathe', 'Dan Brulé', 'A practical guide to breathwork for everyday life.', '#e07a9f', '#7c2f55'],
];

function renderLearn() {
  view.innerHTML = `<div class="learn">
    <h1>Learn</h1>
    <p class="sub">Why slow, deep breathing works and how to get the most out of it.</p>
    <div class="card">
      <h3>Why breathe deeply?</h3>
      <p>Breathing is the one part of your autonomic nervous system you can steer on purpose. Slow breaths with a longer exhale
      activate the <b>parasympathetic</b> ("rest and digest") branch: your heart rate drops, blood pressure eases and muscles relax.</p>
      <ul>
        <li><b>Less stress and anxiety</b>: a few minutes of slow breathing lowers the body's alarm response.</li>
        <li><b>Better sleep</b>: calming breaths before bed help you fall asleep faster.</li>
        <li><b>Heart rate variability</b>: breathing around 5–6 times per minute raises HRV, a marker of resilience.</li>
        <li><b>Focus</b>: steady patterns like box breathing clear your head before a demanding task.</li>
      </ul>
    </div>
    <h2>Techniques</h2>
    <details class="card"><summary>4-7-8 breathing</summary><p>Inhale through your nose for 4 seconds, hold for 7, exhale through your mouth for 8.
      Popularised by Dr. Andrew Weil as a natural sleep aid. Start with 4 cycles; it can feel light-headed at first.</p></details>
    <details class="card"><summary>Box breathing</summary><p>Inhale, hold, exhale and hold again, each for 4 seconds. Used by Navy SEALs, athletes
      and first responders to stay calm and focused under pressure.</p></details>
    <details class="card"><summary>Coherent (resonance) breathing</summary><p>Breathe in and out evenly at about 5.5 seconds each, roughly
      5.5 breaths per minute. This rate tends to bring heart rhythm and breathing into sync.</p></details>
    <details class="card"><summary>Extended exhale</summary><p>Making the exhale longer than the inhale (for example 4 in, 6–8 out) is one of the
      quickest ways to calm down. Most exercises in Exhale build on this.</p></details>
    <h2>Tips</h2>
    <div class="card"><ul style="margin:0">
      <li>Breathe through your nose when you can, and let your belly rise rather than your chest.</li>
      <li>Sit or lie down comfortably. Close your eyes and follow the narrator.</li>
      <li>A few minutes every day beats one long session a week. Set a reminder to make it a habit.</li>
      <li>If you feel dizzy, stop and breathe normally. This app is not a substitute for medical advice.</li>
    </ul></div>
    <h2>Recommended reading</h2>
    ${BOOKS.map(([t, a, d, c1, c2]) => `
      <div class="card book" style="--c1:${c1};--c2:${c2}"><div class="book-cover"></div>
        <div><h3>${t}</h3><div class="small muted" style="margin-bottom:6px">${a}</div><div class="small">${d}</div></div></div>`).join('')}
  </div>`;
}

/* ---------- Settings tab ---------- */

function renderSettings() {
  const st = state.settings;
  const row = (key, label, hint) => `<div class="toggle-row"><div class="lbl">${label}${hint ? `<small>${hint}</small>` : ''}</div>${switchHtml(key, st[key])}</div>`;
  view.innerHTML = `
    <h1>Settings</h1>
    <p class="sub">Make each session feel right.</p>
    <h2 style="margin-top:0">Appearance</h2>
    <div class="card">
      <div class="seg theme-seg" role="radiogroup" aria-label="Appearance">
        ${[['light', '☀', 'Light'], ['dark', '☾', 'Dark'], ['auto', '◐', 'System']].map(([v, icon, l]) =>
          `<button role="radio" aria-checked="${st.theme === v}" class="${st.theme === v ? 'active' : ''}" data-theme-choice="${v}"><span>${icon}</span>${l}</button>`).join('')}
      </div>
      <p class="small muted" style="margin:10px 0 0">${st.theme === 'auto'
        ? `Follows your device's light or dark setting (now ${darkMQ.matches ? 'dark' : 'light'}).`
        : `Always ${st.theme}, whatever your device is set to.`}</p>
    </div>
    <h2>Narrator</h2>
    <div class="card">
      ${row('narrator', 'Narrator', 'Says "inhale", "hold" and "exhale" at each step')}
      <div class="field" style="margin:12px 0 0"><label>Narrator voice</label>
        <div class="row">
          <select data-setting="voiceURI" style="flex:1;min-width:0">
            ${voiceOptions()}
          </select>
          <button class="btn" data-preview>▶ Preview</button>
        </div>
        <p class="small muted" style="margin:8px 0 0">Recorded voices sound the same on every device. Device voices depend on your browser.</p>
      </div>
    </div>
    <h2>Session</h2>
    <div class="card">
      ${row('haptics', 'Vibration', navigator.vibrate ? 'Vibrates at each phase change' : 'Not supported on this device')}
      ${row('countdown', '3-second countdown', 'Time to settle in before the first breath')}
      ${row('keepAwake', 'Keep screen on', 'Stops the screen from dimming during a session')}
    </div>
    <h2>Your data</h2>
    <div class="card">
      <p class="small muted" style="margin-top:0">Everything stays on this device. Export a backup to move your exercises, reminders and history to another device.</p>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn" data-export>Export backup</button>
        <button class="btn" data-import>Import backup</button>
        <span class="spacer"></span>
        <button class="btn danger" data-reset>Erase all</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>
    <h2>Install</h2>
    <div class="card small">
      <p style="margin-top:0"><b>iPhone / iPad:</b> open in Safari, tap Share, then <i>Add to Home Screen</i>.</p>
      <p style="margin-bottom:0"><b>Android / desktop:</b> use <i>Install app</i> in your browser menu. It then works offline like a normal app.</p>
      ${installPrompt ? '<button class="btn primary" data-install style="margin-top:12px">Install Exhale</button>' : ''}
      <p id="offline-status" style="margin:12px 0 0" class="muted">Checking offline status…</p>
    </div>
    <p class="small muted" style="text-align:center">Exhale 1.0</p>`;
  showOfflineStatus();
}

// Settings shows whether every file the app needs is saved for offline use, and names any that are missing.
async function showOfflineStatus() {
  const el = $('#offline-status');
  if (!el) return;
  if (!('serviceWorker' in navigator) || !window.caches) { el.textContent = 'This browser cannot save the app for offline use.'; return; }
  if (!navigator.serviceWorker.controller) {
    el.textContent = 'Getting ready for offline use… Close and reopen the app (while online) to finish.';
    return;
  }
  const files = ['index.html', 'app.js', 'styles.css', 'manifest.webmanifest']
    .concat(RECORDED.flatMap(([id]) => Object.keys(WORDS).map(w => `voice/${id}/${w}.mp3`)));
  const missing = [];
  for (const f of files) if (!(await caches.match(f, { ignoreSearch: true }))) missing.push(f);
  if (!$('#offline-status')) return;
  el.innerHTML = missing.length
    ? `⚠ Not fully available offline. Missing: ${missing.map(esc).join(', ')}`
    : '✓ Ready to use offline';
  el.className = missing.length ? '' : 'muted';
  el.style.color = missing.length ? 'var(--danger)' : 'var(--exhale)';
}

function voiceOptions() {
  const rec = recordedId();
  const voices = narratorVoices();
  const current = rec ? null : chosenVoice();
  const opt = v => `<option value="${esc(v.voiceURI)}" ${current && current.voiceURI === v.voiceURI ? 'selected' : ''}>
    ${esc(v.name.replace(/^Microsoft /, '').replace(/ - .*$/, ''))} (${esc(v.lang)})</option>`;
  const natural = voices.filter(isNatural), standard = voices.filter(v => !isNatural(v));
  return `<optgroup label="Recorded calm voices">${RECORDED.map(([id, name]) =>
      `<option value="rec:${id}" ${rec === id ? 'selected' : ''}>${name}</option>`).join('')}</optgroup>`
    + (natural.length ? `<optgroup label="Device voices – natural">${natural.map(opt).join('')}</optgroup>` : '')
    + (standard.length ? `<optgroup label="Device voices – basic">${standard.map(opt).join('')}</optgroup>` : '');
}

view.addEventListener('click', e => {
  if (currentTab !== 'settings') return;
  const t = e.target;
  if (t.closest('[data-preview]')) previewVoice();
  const th = t.closest('[data-theme-choice]');
  if (th) { state.settings.theme = th.dataset.themeChoice; save(); applyTheme(); renderSettings(); }
  if (t.closest('[data-export]')) {
    downloadFile(`exhale-backup-${dayKey(new Date())}.json`, JSON.stringify(state, null, 2), 'application/json');
  }
  if (t.closest('[data-import]')) $('#import-file').click();
  if (t.closest('[data-reset]') && confirm('Erase all custom exercises, reminders and history?')) {
    localStorage.removeItem(STORE_KEY); state = loadState(); applyTheme(); render(); toast('All data erased');
  }
  if (t.closest('[data-install]') && installPrompt) { installPrompt.prompt(); installPrompt = null; }
});
view.addEventListener('change', e => {
  if (e.target.id !== 'import-file' || !e.target.files[0]) return;
  e.target.files[0].text().then(txt => {
    const data = JSON.parse(txt);
    if (!data || !Array.isArray(data.sessions)) throw new Error('bad file');
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    state = loadState(); applyTheme(); render(); toast('Backup imported');
  }).catch(() => toast('That file is not an Exhale backup'));
});

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (currentTab === 'settings') renderSettings(); });

/* ---------- Boot ---------- */

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
checkReminders();

// Home-screen shortcuts open an exercise directly: ?start=<id>
const startId = new URLSearchParams(location.search).get('start');
if (startId && findExercise(startId)) openDetail(startId);
