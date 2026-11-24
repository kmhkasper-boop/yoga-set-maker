/* Yoga Set Maker – app. Alles werkt lokaal en offline; gegevens blijven op het toestel. */
(function () {
'use strict';
const APP_VERSION = '1.2.0';
const { POSES, CATS, SEQS } = window.YOGA;
const GEO = window.POSE_GEO;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LEVELS = [['beginner', 'Beginner'], ['gemiddeld', 'Gemiddeld'], ['gevorderd', 'Gevorderd'], ['alle', 'Alle niveaus']];
const levelName = (k) => (LEVELS.find((l) => l[0] === k) || ['', ''])[1];

/* ================= THEMA'S ================= */
const THEMES = {
  sterre:     { name: "Sterre's goud", brand: '#8b782e', accent: '#408174', warm: '#dd9425', sand: '#d7bca9', sandl: '#f3ebe3', bg: '#fbf8f4', far: '#d6c59c', mat: '#ecdfd1' },
  salie:      { name: 'Salie',        brand: '#667a59', accent: '#4c6b5a', warm: '#c98b4a', sand: '#c9d3bf', sandl: '#eef1ea', bg: '#f8faf6', far: '#c3cfb9', mat: '#e1e7da' },
  lavendel:   { name: 'Lavendel',     brand: '#76679a', accent: '#585a8e', warm: '#d08a6b', sand: '#d6cde3', sandl: '#f1edf6', bg: '#faf8fc', far: '#cbc1dd', mat: '#e6e0ef' },
  oceaan:     { name: 'Oceaan',       brand: '#3d6d84', accent: '#2c7a8a', warm: '#e09a4f', sand: '#c4d7df', sandl: '#ecf3f6', bg: '#f7fafb', far: '#b9d0da', mat: '#dce8ed' },
  terracotta: { name: 'Terracotta',   brand: '#ac5d3d', accent: '#6b8666', warm: '#d99a3c', sand: '#e3c4b3', sandl: '#f6ece6', bg: '#fcf8f5', far: '#e6c0ad', mat: '#efdcd1' },
};
const mix = (hex, w, f) => { const a = parseInt(hex.slice(1), 16), b = parseInt(w.slice(1), 16); const c = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f); return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1); };

/* ================= OPSLAG ================= */
const KEY = 'ysm.data.v1';
const DEFAULT_SETTINGS = { teacher: 'Sterre', studio: "Sterre's Yoga", logo: null, theme: 'sterre', brand: '#8b782e', accent: '#408174', spb: 5, chime: true, vol: 0.7, auto: true, showCues: true, feedbackEmail: 'lucascaska@gmail.com' };
let D;
function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 300); }
function saveNow() {
  clearTimeout(saveT);
  try { localStorage.setItem(KEY, JSON.stringify(D)); }
  catch (e) { toast('Opslaan lukt niet: het geheugen is vol. Maak een back-up en verwijder oude muziek.'); }
}
const idb = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('ysm-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => { const t = db.transaction('f', mode); const st = t.objectStore('f'); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
  return { put: (k, v) => tx('readwrite', (s) => s.put(v, k)), get: (k) => tx('readonly', (s) => s.get(k)), del: (k) => tx('readwrite', (s) => s.delete(k)), keys: () => tx('readonly', (s) => s.getAllKeys()) };
})();
const urlCache = new Map();
async function blobUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await idb.get(id).catch(() => null);
  if (!rec) return null;
  const u = URL.createObjectURL(rec.blob || rec);
  urlCache.set(id, u); return u;
}
function hydrateImgs(root = document) { $$('img[data-blob]', root).forEach(async (im) => { if (im.src) return; const u = await blobUrl(im.dataset.blob); if (u) im.src = u; }); }

/* ================= HOUDINGEN ================= */
const poseMap = new Map(POSES.map((p) => [p.id, p]));
function getPose(id) { return poseMap.get(id) || (D.custom || []).find((p) => p.id === id) || null; }
function allPoses() { return POSES.concat(D.custom || []); }
function mirrorFor(pose, side) {
  if (!pose || !side || side === 'both') return false;
  const g = !pose.img && GEO[pose.g]; const front = !!(g && g.v === 'f' && !g.back); // achteraanzicht telt als zijaanzicht
  return side === 'l' ? !front : front; // vooraanzicht: rechterbeen staat links in beeld
}
function figHtml(pose, opts = {}) {
  if (!pose) return '<svg viewBox="0 0 132 120"></svg>';
  if (pose.img) return `<img data-blob="${esc(pose.img)}" alt="${esc(pose.nl)}" style="${opts.mirror ? 'transform:scaleX(-1)' : ''}">`;
  return window.Figure.svg(GEO[pose.g] || GEO.tadasana, opts);
}

/* ================= TIJD ================= */
const spb = () => D.settings.spb || 5;
function baseSecs(it) { return it.unit === 'a' ? (it.dur || 0) * spb() : (it.dur || 0); }
function itemSecs(it) {
  if (it.type === 'pose') return baseSecs(it) * (it.side === 'both' ? 2 : 1);
  if (it.type === 'text') return it.dur || 0;
  return 0;
}
const setSecs = (s) => s.items.reduce((a, it) => a + itemSecs(it), 0);
function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
function fmtLong(sec) {
  sec = Math.round(sec); if (sec < 60) return sec + ' sec';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ' u ' : '') + (m ? m + ' min' : '') + (s ? ' ' + s + ' sec' : '');
}
function fmtDur(it) {
  if (it.unit === 'a') return it.dur + ' adem';
  const s = it.dur || 0; if (s < 60) return s + ' sec';
  return Math.floor(s / 60) + (s % 60 ? ':' + String(s % 60).padStart(2, '0') : '') + ' min';
}
const sideLabel = (side) => ({ both: 'Rechts + links', r: 'Alleen rechts', l: 'Alleen links' }[side] || '');

/* ================= ALGEMENE UI ================= */
let toastT;
function toast(msg, action) {
  const t = $('#toast'); t.innerHTML = esc(msg) + (action ? ` <button class="btn small" style="margin-left:10px;min-height:36px;background:#fff;color:#2f2b26">${esc(action.label)}</button>` : '');
  t.style.pointerEvents = action ? 'auto' : 'none';
  if (action) t.querySelector('button').onclick = () => { action.fn(); t.classList.remove('on'); };
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), action ? 6000 : 2400);
}
function sheet(html, { onOpen, cls = '' } = {}) {
  const bg = el(`<div class="sheet-bg"><div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`);
  const close = () => { bg.remove(); document.removeEventListener('keydown', key); };
  const key = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(bg);
  const sh = bg.firstElementChild; sh.close = close;
  $$('[data-close]', sh).forEach((b) => b.addEventListener('click', close));
  if (onOpen) onOpen(sh, close);
  hydrateImgs(sh);
  return sh;
}
function confirmBox(title, text, ok = 'Ja', danger = false) {
  return new Promise((res) => {
    let done = false;
    const sh = sheet(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="foot"><button class="btn ghost" data-no>Nee, terug</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div>`);
    const fin = (v) => { if (done) return; done = true; sh.close(); res(v); };
    $('[data-no]', sh).onclick = () => fin(false); $('[data-yes]', sh).onclick = () => fin(true);
    const obs = new MutationObserver(() => { if (!document.body.contains(sh)) { obs.disconnect(); fin(false); } }); obs.observe(document.body, { childList: true });
  });
}
function pickFile(accept, multiple = false) {
  return new Promise((res) => {
    const old = $('#fileIn'); const inp = old.cloneNode(); old.replaceWith(inp);
    inp.accept = accept; inp.multiple = multiple; inp.value = '';
    inp.onchange = () => res([...inp.files]); inp.click();
  });
}
async function downscale(file, max = 2000, q = 0.85) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
  } catch (e) { return file; }
}
function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

/* ================= THEMA TOEPASSEN ================= */
function applyTheme() {
  const s = D.settings; let t = THEMES[s.theme];
  if (!t) t = Object.assign({}, THEMES.sterre, { brand: s.brand, accent: s.accent, far: mix(s.brand, '#ffffff', 0.55) });
  const r = document.documentElement.style;
  r.setProperty('--brand', t.brand); r.setProperty('--accent', t.accent); r.setProperty('--accent-d', mix(t.accent, '#000000', 0.32));
  r.setProperty('--warm', t.warm); r.setProperty('--sand', t.sand); r.setProperty('--sand-l', t.sandl); r.setProperty('--bg', t.bg);
  r.setProperty('--fig', t.brand); r.setProperty('--fig-far', t.far); r.setProperty('--mat', t.mat);
  $('meta[name=theme-color]').content = '#ffffff';
  $('#studioName').textContent = s.studio || 'Yoga Set Maker';
  $('#logoImg').src = s.logo || defaultLogo();
  document.title = (s.studio ? s.studio + ' · ' : '') + 'Yoga Set Maker';
}
function defaultLogo() {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#8b782e';
  const pts = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 12 : 27, a = (i * 22.5 - 90) * Math.PI / 180; pts.push((50 + r * Math.cos(a)).toFixed(1) + ',' + (50 + r * Math.sin(a)).toFixed(1)); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="${c}" stroke-width="5"/><polygon points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="3.6" stroke-linejoin="round"/><circle cx="50" cy="50" r="5" fill="${c}"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* ================= VOORBEELDSETS ================= */
function P(pose, dur, unit, side, note) { const p = getPose(pose); return { id: uid(), type: 'pose', pose, dur: dur ?? p.dur, unit: unit || p.unit, side: p.sides ? (side || 'both') : null, note: note || '' }; }
const Hd = (text) => ({ id: uid(), type: 'head', text });
const Tx = (text, dur = 0) => ({ id: uid(), type: 'text', text, dur });
function exampleSets() {
  const now = Date.now();
  return [
    { id: 'ex-ochtend', example: true, fav: true, title: 'Ochtendflow – wakker worden', intention: 'Energie en ruimte voor de dag. Bewegen op de adem.', level: 'alle', notes: '', spotify: '', tracks: [], photo: null, created: now, updated: now,
      items: [Hd('Aankomen'), P('sukhasana', 8), P('ujjayi', 120, 's'), Tx('Vertel kort het thema van de les: ruimte maken in lijf en hoofd.', 60),
        Hd('Warming-up'), P('tafel', 3), P('koe', 5, 'a', null, '5 keer wisselen met de kat, op het ritme van de adem'), P('kat', 5), P('adho_mukha', 5), P('uttanasana', 5),
        Hd('Zonnegroet'), P('tadasana', 3), P('urdhva_hastasana', 1), P('uttanasana', 1), P('ardha_uttanasana', 1), P('plank', 3), P('bhujangasana', 2), P('adho_mukha', 5), Tx('Herhaal de zonnegroet 3 tot 5 keer in je eigen tempo.', 240),
        Hd('Staande houdingen'), P('virabhadrasana2', 5), P('trikonasana', 5), P('vrksasana', 6),
        Hd('Afbouw'), P('paschimottanasana', 8), P('supta_matsyendrasana', 8), P('savasana', 300, 's')] },
    { id: 'ex-avond', example: true, fav: false, title: 'Rustige avond – Yin & ontspanning', intention: 'Loslaten en zakken. Lang blijven, weinig doen.', level: 'beginner', notes: 'Veel kussens en dekens klaarleggen.', spotify: '', tracks: [], photo: null, created: now - 1000, updated: now - 1000,
      items: [Hd('Landen'), P('buikadem', 180, 's'), P('apanasana', 60, 's'),
        Hd('Yin'), P('balasana', 180, 's'), P('sfinx', 180, 's'), P('duif', 180, 's'), P('paschimottanasana', 180, 's', null, 'Met kussen onder de knieën, rug mag rond'), P('baddha_konasana', 180, 's'), P('supta_matsyendrasana', 120, 's'),
        Hd('Ontspanning'), P('viparita_karani', 300, 's'), P('savasana', 420, 's'), Tx('Rustig terugkomen, op de zij rollen en zittend afsluiten. Thee!', 60)] },
    { id: 'ex-stoel', example: true, fav: false, title: 'Stoelyoga – dinsdagochtend', intention: 'Soepel en vitaal blijven, zonder op de grond te hoeven.', level: 'beginner', notes: 'Stevige stoelen zonder wieltjes.', spotify: '', tracks: [], photo: null, created: now - 2000, updated: now - 2000,
      items: [Hd('Aankomen'), P('stoel_berg', 6), P('nadi', 120, 's'),
        Hd('Bewegen'), P('stoel_armen', 5, 'a', null, 'Armen omhoog op de inademing, omlaag op de uitademing'), P('stoel_koe', 5), P('stoel_kat', 5), P('stoel_draai', 5), P('stoel_vooroverbuiging', 5),
        Hd('Staan met de stoel'), P('tadasana', 5, 'a', null, 'Eén hand op de leuning van de stoel'), P('vrksasana', 5, 'a', null, 'Met de hand op de stoel'), P('utkatasana', 3),
        Hd('Afsluiten'), P('meditatie', 240, 's')] },
  ];
}

/* ================= INIT DATA ================= */
function freshData() { return { v: 1, sets: exampleSets(), settings: Object.assign({}, DEFAULT_SETTINGS), custom: [], notes: {}, tracks: {}, current: null, toured: false, created: Date.now() }; }
D = load() || freshData();
D.settings = Object.assign({}, DEFAULT_SETTINGS, D.settings || {});
D.custom = D.custom || []; D.notes = D.notes || {}; D.tracks = D.tracks || {};
const curSet = () => D.sets.find((s) => s.id === D.current) || null;
function touch(s) { s.updated = Date.now(); save(); }

/* ================= NAVIGATIE ================= */
let VIEW = 'sets';
const pick = { on: false, at: null };
function go(v, opts = {}) {
  VIEW = v;
  $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  if (v !== 'lib') pick.on = false;
  if (v === 'sets') renderSets();
  if (v === 'build') renderBuild();
  if (v === 'lib') renderLib();
  if (v === 'settings') renderSettings();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  updateFab();
}
$$('#nav button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.v === 'build' && !curSet()) { newSet(); return; }
  go(b.dataset.v);
}));

/* ================= MIJN SETS ================= */
const setsState = { q: '', filter: 'all' };
function renderSets() {
  const v = $('#v-sets');
  const name = D.settings.teacher ? ', ' + esc(D.settings.teacher) : '';
  v.innerHTML = `
    <h1 class="title-xl">Hoi${name}! <em>Mijn sets</em></h1>
    <div class="newset"><button class="btn primary" id="newSetBtn" data-tour="newset"><span class="ico">＋</span> Nieuwe set maken</button></div>
    <div class="search" style="margin-top:12px"><input class="input" id="setQ" type="search" placeholder="Zoek een set…" value="${esc(setsState.q)}" aria-label="Zoek een set"></div>
    <div class="chips" data-tour="setfilter">
      <button class="chip ${setsState.filter === 'all' ? 'on' : ''}" data-f="all">Alle sets</button>
      <button class="chip ${setsState.filter === 'fav' ? 'on' : ''}" data-f="fav">★ Favorieten</button>
      <button class="chip ${setsState.filter === 'mine' ? 'on' : ''}" data-f="mine">Mijn eigen</button>
      <button class="chip ${setsState.filter === 'ex' ? 'on' : ''}" data-f="ex">Voorbeelden</button>
    </div>
    <div class="sets" id="setList" data-tour="setlist"></div>`;
  $('#newSetBtn').onclick = () => newSet();
  $('#setQ').oninput = (e) => { setsState.q = e.target.value; fillSets(); };
  $$('.chips .chip', v).forEach((c) => c.onclick = () => { setsState.filter = c.dataset.f; renderSets(); });
  fillSets();
}
function fillSets() {
  const list = $('#setList'); if (!list) return;
  const q = setsState.q.trim().toLowerCase();
  let sets = D.sets.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (setsState.filter === 'fav') sets = sets.filter((s) => s.fav);
  if (setsState.filter === 'ex') sets = sets.filter((s) => s.example);
  if (setsState.filter === 'mine') sets = sets.filter((s) => !s.example);
  if (q) sets = sets.filter((s) => (s.title + ' ' + (s.intention || '') + ' ' + s.items.map((i) => (getPose(i.pose) || {}).nl || i.text || '').join(' ')).toLowerCase().includes(q));
  if (!sets.length) {
    list.innerHTML = `<div class="empty card" style="grid-column:1/-1">${window.Figure.svg(GEO.balasana)}<p>${q ? 'Geen set gevonden met “' + esc(q) + '”.' : setsState.filter === 'fav' ? 'Nog geen favorieten. Tik op het sterretje ☆ bij een set.' : 'Nog geen sets. Tik op “Nieuwe set maken”.'}</p></div>`;
    return;
  }
  list.innerHTML = sets.map((s) => {
    const poses = s.items.filter((i) => i.type === 'pose');
    const strip = poses.slice(0, 6).map((i) => figHtml(getPose(i.pose), { mirror: mirrorFor(getPose(i.pose), i.side), colors: { halo: 'var(--sand-l)' } })).join('');
    const d = new Date(s.updated || s.created || Date.now());
    return `<article class="card setcard" data-id="${s.id}">
      <button class="fav ${s.fav ? 'on' : ''}" data-fav aria-label="Favoriet">${s.fav ? '★' : '☆'}</button>
      <h3>${esc(s.title || 'Naamloze set')}</h3>
      <div class="strip">${strip || '<span class="muted" style="padding:0 8px">Nog leeg</span>'}</div>
      <div class="meta"><span>⏱ ${fmtLong(setSecs(s))}</span><span>${poses.length} houdingen</span>${s.level ? `<span class="badge">${levelName(s.level)}</span>` : ''}${s.example ? '<span class="badge ex">Voorbeeld</span>' : ''}</div>
      ${s.intention ? `<div class="muted" style="font-style:italic;font-size:15px">${esc(s.intention)}</div>` : ''}
      <div class="row" style="margin-top:2px"><button class="btn small primary" data-open>✎ Openen</button><button class="btn small ghost" data-view>👁 Bekijken</button><button class="btn small ghost" data-more aria-label="Meer opties">⋯ Meer</button></div>
      <div class="muted" style="font-size:12.5px">Bewerkt ${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </article>`;
  }).join('');
  hydrateImgs(list);
  $$('.setcard', list).forEach((c) => {
    const s = D.sets.find((x) => x.id === c.dataset.id);
    c.addEventListener('click', (e) => {
      if (e.target.closest('[data-fav]')) { s.fav = !s.fav; save(); fillSets(); return; }
      if (e.target.closest('[data-view]')) { openPreview(s); return; }
      if (e.target.closest('[data-more]')) { setMenu(s); return; }
      openSet(s.id);
    });
  });
}
function openSet(id) { D.current = id; save(); go('build'); }
function newSet(firstPose) {
  const s = { id: uid(), title: '', intention: '', level: 'alle', notes: '', items: [], spotify: '', tracks: [], photo: null, fav: false, created: Date.now(), updated: Date.now() };
  if (firstPose) s.items.push(P(firstPose));
  D.sets.push(s); D.current = s.id; save(); go('build');
  setTimeout(() => { const t = $('#setTitle'); if (t && !firstPose) t.focus(); }, 200);
  return s;
}
function duplicateSet(s) {
  const c = JSON.parse(JSON.stringify(s)); c.id = uid(); c.title = (s.title || 'Set') + ' (kopie)'; c.example = false; c.fav = false; c.created = c.updated = Date.now();
  c.items.forEach((i) => i.id = uid()); D.sets.push(c); save(); return c;
}
async function deleteSet(s) {
  if (!(await confirmBox('Set verwijderen?', `“${s.title || 'Naamloze set'}” wordt verwijderd.`, 'Ja, verwijderen', true))) return;
  const i = D.sets.indexOf(s); D.sets.splice(i, 1); if (D.current === s.id) D.current = null; save();
  if (VIEW === 'build') go('sets'); else fillSets();
  toast('Set verwijderd', { label: 'Ongedaan maken', fn: () => { D.sets.splice(i, 0, s); save(); VIEW === 'sets' ? fillSets() : go('sets'); } });
}
function setMenu(s) {
  const sh = sheet(`<h2>${esc(s.title || 'Naamloze set')}</h2><p class="muted">${fmtLong(setSecs(s))}</p>
    <div class="menu-list">
      <button data-a="open"><span class="ico">✎</span>Openen en bewerken</button>
      <button data-a="view"><span class="ico">👁</span>Bekijken (overzicht)</button>
      <button data-a="class"><span class="ico">▶</span>Les geven (lesmodus)</button>
      <button data-a="print"><span class="ico">🖨</span>Printen of PDF maken</button>
      <button data-a="dup"><span class="ico">⧉</span>Dupliceren (kopie maken)</button>
      <button data-a="fav"><span class="ico">${s.fav ? '★' : '☆'}</span>${s.fav ? 'Uit favorieten halen' : 'Favoriet maken'}</button>
      <button data-a="share"><span class="ico">⇪</span>Delen / als bestand bewaren</button>
      <button data-a="del" class="danger"><span class="ico">🗑</span>Verwijderen</button>
    </div><div class="foot"><button class="btn ghost" data-close>Sluiten</button></div>`);
  $$('[data-a]', sh).forEach((b) => b.onclick = () => {
    sh.close();
    const a = b.dataset.a;
    if (a === 'open') openSet(s.id);
    if (a === 'view') openPreview(s);
    if (a === 'class') startClass(s);
    if (a === 'print') printDialog(s);
    if (a === 'dup') { const c = duplicateSet(s); toast('Kopie gemaakt'); if (VIEW === 'build') openSet(c.id); else fillSets(); }
    if (a === 'fav') { s.fav = !s.fav; save(); VIEW === 'sets' ? fillSets() : renderBuild(); }
    if (a === 'share') shareSet(s);
    if (a === 'del') deleteSet(s);
  });
}

/* ================= SET MAKEN (BOUWER) ================= */
const ui = { refZoom: 1 };
function renderBuild() {
  const v = $('#v-build');
  const s = curSet();
  if (!s) { v.innerHTML = `<div class="empty card">${window.Figure.svg(GEO.tadasana)}<p>Er is nog geen set open.</p><button class="btn primary" id="nb">＋ Nieuwe set maken</button></div>`; $('#nb').onclick = () => newSet(); return; }
  const tr = s.tracks.length;
  v.innerHTML = `
  <div class="bhead">
    <div class="t"><input class="input" id="setTitle" placeholder="Naam van de set…" value="${esc(s.title)}" aria-label="Naam van de set" data-tour="title" enterkeyhint="done">
      <div class="total" data-tour="total"><b id="totalClock">${fmtClock(setSecs(s))}</b><small>totale tijd</small></div></div>
    <div class="bactions">
      <button class="btn ghost" id="bView" data-tour="preview"><span class="ico">👁</span>Bekijken</button>
      <button class="btn primary" id="bClass" data-tour="class"><span class="ico">▶</span>Les geven</button>
      <button class="btn ghost" id="bPrint" data-tour="print"><span class="ico">🖨</span>Printen</button>
      <button class="btn ghost" id="bMore"><span class="ico">⋯</span>Meer</button>
    </div>
  </div>
  <details class="card panel" id="pInfo" ${s.items.length ? '' : 'open'}><summary><span class="pt">🌿 Thema & niveau</span> <span class="sum">${esc(s.intention || levelName(s.level) || '')}</span></summary><div class="in">
    <label class="field"><span>Thema of intentie van de les</span><textarea class="input" id="setInt" rows="2" placeholder="Bijv. Aarden en vertragen">${esc(s.intention)}</textarea></label>
    <div class="field"><span>Niveau</span><div class="seg" id="setLvl">${LEVELS.map((l) => `<button data-l="${l[0]}" class="${s.level === l[0] ? 'on' : ''}">${l[1]}</button>`).join('')}</div></div>
    <label class="field"><span>Notities voor mezelf (materiaal, groep…)</span><textarea class="input" id="setNotes" rows="2" placeholder="Bijv. blokken en dekens klaarleggen">${esc(s.notes)}</textarea></label>
  </div></details>
  <details class="card panel" id="pPhoto" data-tour="photo" ${s.photo && !ui.refOpen ? '' : ''}><summary><span class="pt">📷 Foto van papier</span> <span class="sum">${s.photo ? 'foto toegevoegd' : 'foto als voorbeeld'}</span></summary><div class="in" id="photoIn"></div></details>
  <details class="card panel" id="pMusic" data-tour="music"><summary><span class="pt">🎵 Muziek</span> <span class="sum">${[s.spotify ? 'Spotify' : '', tr ? tr + ' liedje' + (tr > 1 ? 's' : '') : ''].filter(Boolean).join(' + ') || 'Spotify of eigen liedjes'}</span></summary><div class="in" id="musicIn"></div></details>
  <div class="workspace ${s.photo && s.showRef ? 'split' : ''}" id="ws">
    ${s.photo && s.showRef ? `<div class="refpane" id="refPane"><span class="lbl">Je tekening</span><div class="tools"><button data-z="-1" aria-label="Kleiner">−</button><button data-z="1" aria-label="Groter">＋</button><button data-z="x" aria-label="Verbergen">✕</button></div><div class="scroller"><img data-blob="${esc(s.photo)}" alt="Foto van de getekende set" style="width:${ui.refZoom * 100}%"></div></div>` : ''}
    <div>
      <div class="items" id="items"></div>
      <div class="addbar" data-tour="add">
        <button class="btn primary" id="addPose"><span class="ico">＋</span> Houding toevoegen</button>
        <button class="btn ghost" id="addText"><span class="ico">✎</span> Tekst / uitleg</button>
        <button class="btn ghost" id="addHead"><span class="ico">❝</span> Kopje</button>
        <button class="btn ghost" id="addSeq" style="grid-column:1/-1"><span class="ico">☀</span> Reeks invoegen (bijv. zonnegroet)</button>
      </div>
    </div>
  </div>`;
  $('#setTitle').oninput = (e) => { s.title = e.target.value; touch(s); };
  $('#setTitle').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };
  $('#setInt').oninput = (e) => { s.intention = e.target.value; touch(s); };
  $('#setNotes').oninput = (e) => { s.notes = e.target.value; touch(s); };
  $$('#setLvl button').forEach((b) => b.onclick = () => { s.level = b.dataset.l; touch(s); $$('#setLvl button').forEach((x) => x.classList.toggle('on', x === b)); });
  $('#bView').onclick = () => openPreview(s);
  $('#bClass').onclick = () => startClass(s);
  $('#bPrint').onclick = () => printDialog(s);
  $('#bMore').onclick = () => setMenu(s);
  $('#addPose').onclick = () => openPicker(null);
  $('#addText').onclick = () => { addItem(s, Tx(''), null, true); };
  $('#addHead').onclick = () => { addItem(s, Hd(''), null, true); };
  $('#addSeq').onclick = () => seqDialog(s, null);
  const rp = $('#refPane');
  if (rp) $$('[data-z]', rp).forEach((b) => b.onclick = () => {
    if (b.dataset.z === 'x') { s.showRef = false; save(); renderBuild(); return; }
    ui.refZoom = clamp(ui.refZoom + (+b.dataset.z) * 0.5, 1, 4); $('img', rp).style.width = ui.refZoom * 100 + '%';
  });
  renderPhoto(s); renderMusic(s); renderItems(s);
  hydrateImgs(v);
  setBh();
}
function setBh() { const cs = curSet(); document.documentElement.classList.toggle('ref-on', VIEW === 'build' && !!(cs && cs.photo && cs.showRef)); const b = $('.bhead'); if (b) document.documentElement.style.setProperty('--bh', b.offsetHeight + 'px'); }
window.addEventListener('resize', setBh);
function updateTotal(s) { const t = $('#totalClock'); if (t) t.textContent = fmtClock(setSecs(s)); }
function itemHtml(it, n) {
  const grip = `<div class="grip" data-grip aria-label="Vasthouden en schuiven" title="Vasthouden en schuiven"><svg viewBox="0 0 12 20" fill="currentColor"><circle cx="3" cy="3" r="1.8"/><circle cx="9" cy="3" r="1.8"/><circle cx="3" cy="10" r="1.8"/><circle cx="9" cy="10" r="1.8"/><circle cx="3" cy="17" r="1.8"/><circle cx="9" cy="17" r="1.8"/></svg></div>`;
  const menu = `<button class="menu-btn" data-menu aria-label="Opties">⋯</button>`;
  if (it.type === 'head') return `<div class="item head" data-id="${it.id}">${grip}<div class="body" style="padding:0 4px"><input data-text placeholder="Kopje, bijv. Warming-up" value="${esc(it.text)}" enterkeyhint="done"></div>${menu}</div>`;
  if (it.type === 'text') return `<div class="item card text" data-id="${it.id}">${grip}<div class="body"><textarea data-text rows="2" placeholder="Schrijf hier je uitleg of aanwijzing…">${esc(it.text)}</textarea>
    <div class="ctl"><div class="stepper"><button data-step="-1" aria-label="Korter">−</button><button class="val" data-val>${it.dur ? fmtLong(it.dur) : 'geen tijd'}</button><button data-step="1" aria-label="Langer">+</button></div></div></div>${menu}</div>`;
  const p = getPose(it.pose) || { nl: 'Onbekende houding', sa: '' };
  return `<div class="item card ip" data-id="${it.id}">${grip}<span class="num">${n}</span>
    <div class="pic" data-info>${figHtml(p, { mirror: mirrorFor(p, it.side) })}</div>
    <div class="body"><div class="name">${esc(p.nl)}<small>${esc(p.sa)}</small></div>
      <div class="ctl"><div class="stepper" data-tour-step><button data-step="-1" aria-label="Korter">−</button><button class="val" data-val>${fmtDur(it)}</button><button data-step="1" aria-label="Langer">+</button></div>
      ${it.side ? `<button class="sides ${it.side === 'both' ? '' : 'one'}" data-side>⇆ ${sideLabel(it.side)}</button>` : ''}</div>
      ${it.note ? `<div class="note">✎ ${esc(it.note)}</div>` : ''}
    </div>${menu}</div>`;
}
function renderItems(s) {
  const box = $('#items'); if (!box) return;
  if (!s.items.length) {
    box.innerHTML = `<div class="empty card">${window.Figure.svg(GEO.urdhva_hastasana)}<p><b>Je set is nog leeg.</b><br>Tik hieronder op <b>“Houding toevoegen”</b> om te beginnen.</p></div>`;
    updateTotal(s); return;
  }
  let n = 0;
  box.innerHTML = s.items.map((it) => itemHtml(it, it.type === 'pose' ? ++n : 0)).join('');
  hydrateImgs(box);
  updateTotal(s);
}
function itemEl(id) { return $(`#items .item[data-id="${id}"]`); }
function refreshItem(s, it) {
  const old = itemEl(it.id); if (!old) return renderItems(s);
  const idx = s.items.filter((i) => i.type === 'pose').indexOf(it) + 1;
  const neu = el(itemHtml(it, idx)); old.replaceWith(neu); hydrateImgs(neu); updateTotal(s);
}
function addItem(s, it, at, focus) {
  if (at == null || at > s.items.length) s.items.push(it); else s.items.splice(at, 0, it);
  touch(s); renderItems(s);
  const e = itemEl(it.id);
  if (e) { e.classList.add('flash'); if (focus) { e.scrollIntoView({ block: 'center', behavior: 'smooth' }); const f = $('[data-text]', e); if (f) setTimeout(() => f.focus(), 350); } }
}
// stappen voor duur
function stepDur(it, dir) {
  if (it.type === 'text') { const steps = [0, 30, 60, 90, 120, 180, 240, 300, 420, 600, 900]; let i = steps.findIndex((x) => x >= (it.dur || 0)); if (i < 0) i = steps.length - 1; if (steps[i] !== it.dur && dir < 0) i++; it.dur = steps[clamp(i + dir, 0, steps.length - 1)]; return; }
  if (it.unit === 'a') { it.dur = clamp((it.dur || 0) + dir, 1, 60); return; }
  const d = it.dur || 0; const st = d < 60 || (d === 60 && dir < 0) ? 5 : d < 300 || (d === 300 && dir < 0) ? 15 : 60;
  it.dur = clamp(d + dir * st, 5, 3600);
}
function durPicker(s, it) {
  const isA = it.unit === 'a';
  const optsA = [1, 2, 3, 5, 8, 10, 12, 15, 20, 30];
  const optsS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600, 900];
  const optsT = [0, 30, 60, 120, 180, 300, 600];
  const p = getPose(it.pose);
  const render = () => {
    const a = it.type === 'pose' && it.unit === 'a';
    const list = it.type === 'text' ? optsT : a ? optsA : optsS;
    return `<h2>Hoe lang?</h2><p class="muted">${p ? esc(p.nl) : 'Tekstkaart'}${it.side === 'both' ? ' · de tijd geldt per kant' : ''}</p>
      ${it.type === 'pose' ? `<div class="seg" style="margin:8px 0 14px"><button data-u="a" class="${a ? 'on' : ''}">Ademhalingen</button><button data-u="s" class="${a ? '' : 'on'}">Seconden / minuten</button></div>` : ''}
      <div class="themes" style="grid-template-columns:repeat(auto-fill,minmax(92px,1fr))">${list.map((x) => `<button class="theme ${x === it.dur ? 'on' : ''}" data-d="${x}" style="min-height:62px;font-size:17px;font-weight:700">${it.type === 'text' ? (x ? fmtLong(x) : 'geen tijd') : a ? x + ' adem' : fmtDur({ unit: 's', dur: x })}</button>`).join('')}</div>
      ${a ? `<p class="muted" style="font-size:14.5px">1 ademhaling ≈ ${spb()} seconden (aan te passen bij Instellingen).</p>` : ''}
      <div class="foot"><button class="btn ghost" data-close>Klaar</button></div>`;
  };
  const sh = sheet(render());
  const bind = () => {
    $$('[data-u]', sh).forEach((b) => b.onclick = () => {
      const secs = baseSecs(it); it.unit = b.dataset.u;
      it.dur = it.unit === 'a' ? clamp(Math.round(secs / spb()), 1, 60) : clamp(Math.round(secs / 5) * 5, 5, 3600);
      touch(s); refreshItem(s, it); sh.innerHTML = '<div class="grab"></div>' + render(); $$('[data-close]', sh).forEach((x) => x.onclick = sh.close); bind();
    });
    $$('[data-d]', sh).forEach((b) => b.onclick = () => { it.dur = +b.dataset.d; touch(s); refreshItem(s, it); sh.close(); });
  };
  bind();
}
function itemMenu(s, it) {
  const p = getPose(it.pose);
  const i = s.items.indexOf(it);
  const sh = sheet(`<h2>${esc(p ? p.nl : it.type === 'head' ? 'Kopje' : 'Tekstkaart')}</h2>
    <div class="menu-list">
      ${p ? '<button data-a="info"><span class="ico">ℹ</span>Uitleg en aandachtspunten</button>' : ''}
      ${p ? `<button data-a="note"><span class="ico">✎</span>${it.note ? 'Eigen aanwijzing wijzigen' : 'Eigen aanwijzing toevoegen'}</button>` : ''}
      ${p && it.side ? '<button data-a="side"><span class="ico">⇆</span>Kant kiezen (rechts / links / beide)</button>' : ''}
      ${p ? '<button data-a="swap"><span class="ico">↻</span>Andere houding kiezen</button>' : ''}
      <button data-a="dup"><span class="ico">⧉</span>Dupliceren</button>
      <button data-a="up" ${i === 0 ? 'disabled style="opacity:.4"' : ''}><span class="ico">↑</span>Eén plek omhoog</button>
      <button data-a="down" ${i === s.items.length - 1 ? 'disabled style="opacity:.4"' : ''}><span class="ico">↓</span>Eén plek omlaag</button>
      <button data-a="insert"><span class="ico">＋</span>Houding hierna invoegen</button>
      <button data-a="del" class="danger"><span class="ico">🗑</span>Verwijderen</button>
    </div><div class="foot"><button class="btn ghost" data-close>Sluiten</button></div>`);
  $$('[data-a]', sh).forEach((b) => b.onclick = async () => {
    const a = b.dataset.a; sh.close();
    if (a === 'info') poseSheet(p, { item: it, set: s });
    if (a === 'note') noteDialog(s, it);
    if (a === 'side') sideDialog(s, it);
    if (a === 'swap') { pick.swap = it.id; openPicker(null); }
    if (a === 'dup') { const c = Object.assign({}, it, { id: uid() }); addItem(s, c, i + 1); toast('Gedupliceerd'); }
    if (a === 'up' && i > 0) { s.items.splice(i - 1, 0, s.items.splice(i, 1)[0]); touch(s); renderItems(s); itemEl(it.id).classList.add('flash'); }
    if (a === 'down' && i < s.items.length - 1) { s.items.splice(i + 1, 0, s.items.splice(i, 1)[0]); touch(s); renderItems(s); itemEl(it.id).classList.add('flash'); }
    if (a === 'insert') openPicker(i + 1);
    if (a === 'del') { s.items.splice(i, 1); touch(s); renderItems(s); toast('Verwijderd', { label: 'Ongedaan maken', fn: () => { s.items.splice(i, 0, it); touch(s); renderItems(s); } }); }
  });
}
function noteDialog(s, it) {
  const sh = sheet(`<h2>Eigen aanwijzing</h2><p class="muted">Alleen voor deze plek in deze set. Je ziet hem terug bij Bekijken, Printen en in de lesmodus.</p>
    <textarea class="input" id="noteTx" rows="4" placeholder="Bijv. 3 keer herhalen, of: knieën op een deken">${esc(it.note)}</textarea>
    <div class="foot"><button class="btn ghost" data-close>Annuleren</button><button class="btn primary" id="noteOk">Bewaren</button></div>`);
  setTimeout(() => $('#noteTx').focus(), 200);
  $('#noteOk').onclick = () => { it.note = $('#noteTx').value.trim(); touch(s); refreshItem(s, it); sh.close(); };
}
function sideDialog(s, it) {
  const sh = sheet(`<h2>Welke kant?</h2><p class="muted">Bij “Rechts + links” komt de houding in de les twee keer: eerst rechts, dan links. De tijd telt dubbel.</p>
    <div class="menu-list"><button data-s="both"><span class="ico">⇆</span>Rechts + links (beide kanten)</button><button data-s="r"><span class="ico">→</span>Alleen rechts</button><button data-s="l"><span class="ico">←</span>Alleen links</button></div>
    <div class="foot"><button class="btn ghost" data-close>Sluiten</button></div>`);
  $$('[data-s]', sh).forEach((b) => b.onclick = () => { it.side = b.dataset.s; touch(s); refreshItem(s, it); sh.close(); });
}
function seqDialog(s, at) {
  const sh = sheet(`<h2>Reeks invoegen</h2><p class="muted">Een reeks zet meerdere houdingen tegelijk in je set. Daarna kun je alles nog aanpassen.</p>
    <div class="menu-list">${SEQS.map((q) => `<button data-q="${q.id}"><span class="ico">☀</span><span><b>${esc(q.nl)}</b><br><small class="muted">${q.items.map((x) => getPose(x[0]).nl).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6).join(' · ')}…</small></span></button>`).join('')}</div>
    <div class="foot"><button class="btn ghost" data-close>Sluiten</button></div>`);
  $$('[data-q]', sh).forEach((b) => b.onclick = () => {
    const q = SEQS.find((x) => x.id === b.dataset.q);
    const items = [Hd(q.nl)].concat(q.items.map((x) => { const it = P(x[0], x[1], 'a'); if (it.side) it.side = x[2] || 'both'; return it; }));
    let pos = at == null ? s.items.length : at;
    items.forEach((it) => s.items.splice(pos++, 0, it));
    touch(s); renderItems(s); sh.close(); toast(q.nl + ' ingevoegd ✓');
    const e = itemEl(items[0].id); if (e) e.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

/* --- klik- en invoer-afhandeling op de kaarten --- */
document.addEventListener('click', (e) => {
  const itEl = e.target.closest('#items .item'); if (!itEl) return;
  const s = curSet(); const it = s && s.items.find((i) => i.id === itEl.dataset.id); if (!it) return;
  if (e.target.closest('[data-step]')) { stepDur(it, +e.target.closest('[data-step]').dataset.step); touch(s); const v = $('[data-val]', itEl); v.textContent = it.type === 'text' ? (it.dur ? fmtLong(it.dur) : 'geen tijd') : fmtDur(it); updateTotal(s); return; }
  if (e.target.closest('[data-val]')) { durPicker(s, it); return; }
  if (e.target.closest('[data-side]')) { it.side = it.side === 'both' ? 'r' : it.side === 'r' ? 'l' : 'both'; touch(s); refreshItem(s, it); toast(sideLabel(it.side)); return; }
  if (e.target.closest('[data-menu]')) { itemMenu(s, it); return; }
  if (e.target.closest('[data-info]') || e.target.closest('.name')) { poseSheet(getPose(it.pose), { item: it, set: s }); }
});
document.addEventListener('input', (e) => {
  const t = e.target.closest('#items [data-text]'); if (!t) return;
  const s = curSet(); const it = s.items.find((i) => i.id === t.closest('.item').dataset.id); if (!it) return;
  it.text = t.value; touch(s);
  if (t.tagName === 'TEXTAREA') { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('#items .head input')) e.target.blur(); });

/* --- slepen om te ordenen (vinger, muis of pen) --- */
(function dragSort() {
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('#items [data-grip]'); if (!g || e.button > 0) return;
    e.preventDefault();
    const item = g.closest('.item'), r = item.getBoundingClientRect();
    const ph = document.createElement('div'); ph.className = 'placeholder'; ph.style.height = r.height + 'px';
    item.after(ph);
    item.classList.add('dragging'); Object.assign(item.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
    drag = { item, ph, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, id: e.pointerId };
    try { g.setPointerCapture(e.pointerId); } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(12);
    const loop = () => {
      if (!drag) return;
      const edge = 110, y = drag.y, hgt = window.innerHeight;
      if (y < edge + 40) window.scrollBy(0, -Math.ceil((edge + 40 - y) / 6));
      else if (y > hgt - edge - 60) window.scrollBy(0, Math.ceil((y - (hgt - edge - 60)) / 6));
      place(); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  function place() {
    const { item, ph, x, y } = drag;
    item.style.left = x - drag.dx + 'px'; item.style.top = y - drag.dy + 'px';
    const under = document.elementFromPoint(x, y); if (!under) return;
    const tgt = under.closest('#items .item');
    if (!tgt || tgt === item) return;
    const r = tgt.getBoundingClientRect();
    const box = $('#items').getBoundingClientRect();
    const multi = r.width < box.width * 0.8;
    const after = multi ? (x > r.left + r.width / 2) : (y > r.top + r.height / 2);
    if (after) { if (tgt.nextElementSibling !== ph) tgt.after(ph); }
    else if (tgt.previousElementSibling !== ph) tgt.before(ph);
  }
  document.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; e.preventDefault(); drag.x = e.clientX; drag.y = e.clientY; }, { passive: false });
  const end = (e) => {
    if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
    const { item, ph } = drag; drag = null;
    const s = curSet();
    const order = [...$('#items').children].filter((c) => c !== item).map((c) => (c === ph ? item.dataset.id : c.dataset.id));
    ph.remove(); item.classList.remove('dragging'); item.removeAttribute('style');
    const before = s.items.map((i) => i.id).join();
    s.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    if (s.items.map((i) => i.id).join() !== before) { touch(s); renderItems(s); const ne = itemEl(item.dataset.id); if (ne) ne.classList.add('flash'); }
    else renderItems(s);
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  document.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
})();

/* ================= FOTO VAN PAPIER ================= */
function renderPhoto(s) {
  const box = $('#photoIn'); if (!box) return;
  if (!s.photo) {
    box.innerHTML = `<p class="muted" style="margin-top:0">Heb je een set al op papier getekend? Maak er een foto van. De foto staat dan naast je set, zodat je hem makkelijk kunt overnemen.</p>
      <button class="btn primary wide" id="phAdd"><span class="ico">📷</span> Foto maken of kiezen</button>`;
    $('#phAdd').onclick = () => addPhoto(s);
    return;
  }
  box.innerHTML = `<img class="photothumb" data-blob="${esc(s.photo)}" alt="Foto van de getekende set" id="phThumb">
    <div class="row"><button class="btn ${s.showRef ? 'ghost' : 'primary'}" id="phSide" style="flex:1">${s.showRef ? '✕ Niet meer naast de set' : '⇄ Naast de set zetten'}</button>
    <button class="btn ghost" id="phBig">⤢ Groot</button><button class="btn ghost" id="phNew">↻ Andere</button><button class="btn danger" id="phDel" aria-label="Foto verwijderen">🗑</button></div>`;
  hydrateImgs(box);
  $('#phSide').onclick = () => { s.showRef = !s.showRef; save(); renderBuild(); if (s.showRef) setTimeout(() => { const r = $('#refPane'); if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 100); };
  $('#phBig').onclick = $('#phThumb').onclick = () => bigPhoto(s.photo);
  $('#phNew').onclick = () => addPhoto(s);
  $('#phDel').onclick = async () => { if (!(await confirmBox('Foto verwijderen?', 'De foto van je tekening wordt uit deze set gehaald.', 'Verwijderen', true))) return; const id = s.photo; s.photo = null; s.showRef = false; touch(s); renderBuild(); idb.del(id).catch(() => {}); };
}
async function addPhoto(s) {
  const [f] = await pickFile('image/*'); if (!f) return;
  toast('Foto wordt bewaard…');
  const blob = await downscale(f, 2200, 0.85);
  const id = 'ph_' + uid(); await idb.put(id, { blob, name: f.name, type: blob.type });
  const old = s.photo; s.photo = id; s.showRef = true; touch(s);
  if (old) idb.del(old).catch(() => {});
  renderBuild(); toast('Foto staat nu naast je set ✓');
  setTimeout(() => { const r = $('#refPane'); if (r) r.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 150);
}
function bigPhoto(id) {
  const ov = el(`<div class="overlay" style="background:#1f1b17"><div class="ov-top" style="background:#1f1b17;border:0"><h2 style="color:#fff">Je tekening</h2><button class="btn small ghost" data-z="-1">−</button><button class="btn small ghost" data-z="1">＋</button><button class="btn small" data-x>✕ Sluiten</button></div>
    <div style="overflow:auto;touch-action:pan-x pan-y pinch-zoom;height:calc(100% - 70px)"><img data-blob="${esc(id)}" style="width:100%;display:block" alt=""></div></div>`);
  document.body.appendChild(ov); hydrateImgs(ov); let z = 1;
  $$('[data-z]', ov).forEach((b) => b.onclick = () => { z = clamp(z + (+b.dataset.z) * 0.5, 1, 5); $('img', ov).style.width = z * 100 + '%'; });
  $('[data-x]', ov).onclick = () => ov.remove();
}

/* ================= MUZIEK ================= */
const player = { list: [], idx: -1, setId: null };
const audio = $('#audio');
function renderMusic(s) {
  const box = $('#musicIn'); if (!box) return;
  const sum = $('#pMusic .sum'); if (sum) sum.textContent = [s.spotify ? 'Spotify' : '', s.tracks.length ? s.tracks.length + ' liedje' + (s.tracks.length > 1 ? 's' : '') : ''].filter(Boolean).join(' + ') || 'Spotify of eigen liedjes';
  box.innerHTML = `
    <div class="field"><span>Spotify-playlist (link plakken)</span>
      <div class="row" style="flex-wrap:nowrap"><input class="input" id="spUrl" inputmode="url" placeholder="https://open.spotify.com/playlist/…" value="${esc(s.spotify)}"><button class="btn small ghost" id="spPaste" title="Plakken">📋</button></div></div>
    ${s.spotify ? `<button class="btn spotify wide" id="spOpen"><span class="ico">♫</span> Open playlist in Spotify</button>` : `<p class="muted" style="font-size:14.5px;margin:0">Tip: in Spotify tik je bij een playlist op ⋯ › Delen › Link kopiëren, en plakt hem hier.</p>`}
    <h4 style="margin:18px 0 6px;font-size:15px">Eigen liedjes (mp3) – spelen in de app, ook zonder internet</h4>
    <div class="tracks" id="trackList">${s.tracks.map((id, i) => { const m = D.tracks[id] || { name: 'Liedje' }; const on = player.setId === s.id && player.idx === i && !audio.paused; return `<div class="track ${on ? 'playing' : ''}" data-t="${i}"><button data-play aria-label="Afspelen">${on ? '⏸\uFE0E' : '▶\uFE0E'}</button><span class="tn">${esc(m.name)}</span><button data-tup aria-label="Omhoog" ${i ? '' : 'style="visibility:hidden"'}>↑</button><button data-tdel aria-label="Verwijderen">✕</button></div>`; }).join('')}</div>
    <button class="btn ghost wide" id="trAdd"><span class="ico">＋</span> Muziek toevoegen</button>`;
  const u = $('#spUrl');
  u.onchange = u.onblur = () => { const v = normSpotify(u.value); if (v !== s.spotify) { s.spotify = v; touch(s); renderMusic(s); } };
  $('#spPaste').onclick = async () => { try { const t = await navigator.clipboard.readText(); u.value = t; u.onchange(); } catch (e) { u.focus(); toast('Houd je vinger in het vak en kies “Plak”'); } };
  if ($('#spOpen')) $('#spOpen').onclick = () => openSpotify(s.spotify);
  $('#trAdd').onclick = () => addTracks(s);
  $$('#trackList .track').forEach((t) => {
    const i = +t.dataset.t;
    $('[data-play]', t).onclick = () => { if (player.setId === s.id && player.idx === i && !audio.paused) audio.pause(); else playTrack(s, i); };
    $('[data-tup]', t).onclick = () => { s.tracks.splice(i - 1, 0, s.tracks.splice(i, 1)[0]); touch(s); renderMusic(s); };
    $('[data-tdel]', t).onclick = () => { const id = s.tracks.splice(i, 1)[0]; touch(s); if (player.setId === s.id) { audio.pause(); player.idx = -1; updatePlayer(); } renderMusic(s); cleanupTrack(id); toast('Liedje uit de set gehaald'); };
  });
}
function normSpotify(v) {
  v = (v || '').trim(); if (!v) return '';
  const m = v.match(/spotify:(playlist|album|track|artist):([A-Za-z0-9]+)/); if (m) return `https://open.spotify.com/${m[1]}/${m[2]}`;
  const u = v.match(/https?:\/\/[^\s]*spotify[^\s]*/i); if (u) return u[0];
  if (/^[A-Za-z0-9]{22}$/.test(v)) return 'https://open.spotify.com/playlist/' + v;
  toast('Dat lijkt geen Spotify-link. Kopieer de link via Delen in Spotify.'); return v;
}
function openSpotify(url) { if (!url) return; window.open(url, '_blank', 'noopener'); }
async function addTracks(s) {
  const files = await pickFile('audio/*,.mp3,.m4a,.aac,.wav,.ogg', true); if (!files.length) return;
  toast('Muziek wordt bewaard…');
  for (const f of files) {
    const id = 'au_' + uid();
    try { await idb.put(id, { blob: f, name: f.name, type: f.type }); } catch (e) { toast('Bewaren lukte niet (geheugen vol?)'); continue; }
    D.tracks[id] = { name: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' '), size: f.size };
    s.tracks.push(id);
  }
  touch(s); renderMusic(s); toast(files.length + (files.length > 1 ? ' liedjes' : ' liedje') + ' toegevoegd ✓');
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
function cleanupTrack(id) { if (D.sets.some((x) => x.tracks.includes(id))) return; delete D.tracks[id]; save(); idb.del(id).catch(() => {}); }
async function playTrack(s, i) {
  if (!s.tracks.length) return;
  i = ((i % s.tracks.length) + s.tracks.length) % s.tracks.length;
  const id = s.tracks[i]; const u = await blobUrl(id);
  if (!u) { toast('Dit liedje is niet meer op dit toestel'); return; }
  player.setId = s.id; player.idx = i; player.list = s.tracks.slice();
  if (audio.src !== u) audio.src = u;
  audio.volume = 1;
  try { await audio.play(); } catch (e) { toast('Tik nogmaals op ▶ om af te spelen'); }
  updatePlayer();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: (D.tracks[id] || {}).name || 'Muziek', artist: D.settings.studio || 'Yoga Set Maker', album: s.title || '' });
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => nextTrack(-1));
  }
}
function nextTrack(d) { const s = D.sets.find((x) => x.id === player.setId); if (s) playTrack(s, player.idx + d); }
audio.addEventListener('ended', () => nextTrack(1));
['play', 'pause'].forEach((ev) => audio.addEventListener(ev, () => { updatePlayer(); const s = curSet(); if (s && VIEW === 'build') renderMusic(s); }));
audio.addEventListener('timeupdate', () => { const pr = $('#playerBar progress'); if (pr && audio.duration) pr.value = audio.currentTime / audio.duration; });
function updatePlayer() {
  let bar = $('#playerBar');
  const active = player.idx >= 0 && audio.src;
  if (!active) { if (bar) bar.remove(); document.body.classList.remove('has-player'); return; }
  const name = (D.tracks[player.list[player.idx]] || {}).name || 'Muziek';
  if (!bar) { bar = el(`<div class="player" id="playerBar"><button data-p aria-label="Afspelen of pauzeren"></button><span class="tn"></span><button data-n aria-label="Volgende">⏭\uFE0E</button><button data-x aria-label="Stoppen">✕</button><progress max="1" value="0"></progress></div>`); document.body.appendChild(bar);
    $('[data-p]', bar).onclick = () => (audio.paused ? audio.play() : audio.pause());
    $('[data-n]', bar).onclick = () => nextTrack(1);
    $('[data-x]', bar).onclick = () => { audio.pause(); player.idx = -1; updatePlayer(); const s = curSet(); if (s && VIEW === 'build') renderMusic(s); };
  }
  $('[data-p]', bar).textContent = audio.paused ? '▶\uFE0E' : '⏸\uFE0E';
  $('.tn', bar).textContent = '♫ ' + name;
  document.body.classList.add('has-player');
}

/* ================= HOUDINGEN (BIBLIOTHEEK) ================= */
const libState = { q: '', cat: 'all' };
function openPicker(at) {
  const s = curSet(); if (!s) return;
  pick.on = true; pick.at = at; pick.count = 0;
  go('lib');
}
function renderLib() {
  const v = $('#v-lib'); const s = curSet();
  const inPick = pick.on && s;
  v.innerHTML = `
    ${inPick ? `<div class="pickbar"><span class="tx">${pick.swap ? 'Kies de nieuwe houding.' : `Tik op <b>＋</b> om toe te voegen aan <b>${esc(s.title || 'je set')}</b>.`}</span><button class="btn primary small" id="pickDone">✓ Klaar</button></div>` : `<h1 class="title-xl"><em>Houdingen</em> <span class="muted" style="font-size:17px">${allPoses().length} met uitleg</span></h1>`}
    <div class="search" data-tour="lib-search"><input class="input" id="libQ" type="search" placeholder="Zoek, bijv. boom, krijger of vrksasana…" value="${esc(libState.q)}" aria-label="Zoek een houding"></div>
    <div class="chips" data-tour="lib-chips">
      <button class="chip ${libState.cat === 'all' ? 'on' : ''}" data-c="all">Alle</button>
      ${CATS.map((c) => `<button class="chip ${libState.cat === c[0] ? 'on' : ''}" data-c="${c[0]}">${c[1]}</button>`).join('')}
      <button class="chip ${libState.cat === 'begin' ? 'on' : ''}" data-c="begin">Voor beginners</button>
      <button class="chip ${libState.cat === 'eigen' ? 'on' : ''}" data-c="eigen">Mijn eigen</button>
      ${inPick ? `<button class="chip ${libState.cat === 'seq' ? 'on' : ''}" data-c="seq">☀ Reeksen</button>` : ''}
    </div>
    <div class="poses" id="poseGrid"></div>
    <div style="margin-top:16px"><button class="btn ghost wide" id="addCustom"><span class="ico">＋</span> Eigen houding toevoegen</button></div>`;
  $('#libQ').oninput = (e) => { libState.q = e.target.value; fillLib(); };
  $$('.chip', v).forEach((c) => c.onclick = () => { libState.cat = c.dataset.c; $$('.chip', v).forEach((x) => x.classList.toggle('on', x === c)); fillLib(); });
  $('#addCustom').onclick = () => customPoseDialog();
  if ($('#pickDone')) $('#pickDone').onclick = () => { pick.on = false; pick.swap = null; go('build'); };
  fillLib();
}
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function fillLib() {
  const g = $('#poseGrid'); if (!g) return;
  const inPick = pick.on && curSet();
  if (libState.cat === 'seq' && inPick) {
    g.innerHTML = SEQS.map((q) => `<div class="card pose" data-seq="${q.id}">${figHtml(getPose(q.items[2][0]))}<div class="pn">☀ ${esc(q.nl)}</div><div class="ps">${q.items.length} houdingen</div><button class="add" aria-label="Toevoegen">＋</button></div>`).join('');
    $$('[data-seq]', g).forEach((c) => c.onclick = () => { const s = curSet(); seqDialog(s, pick.at); });
    return;
  }
  const q = norm(libState.q.trim());
  let list = allPoses();
  if (libState.cat === 'eigen') list = list.filter((p) => p.custom);
  else if (libState.cat === 'begin') list = list.filter((p) => p.lvl === 1);
  else if (libState.cat !== 'all') list = list.filter((p) => p.cat === libState.cat);
  if (q) list = list.filter((p) => norm(p.nl + ' ' + p.sa + ' ' + p.cat + ' ' + (p.uitleg || '')).includes(q));
  if (!list.length) { g.innerHTML = `<div class="empty" style="grid-column:1/-1">${libState.cat === 'eigen' ? 'Je hebt nog geen eigen houdingen. Tik hieronder op “Eigen houding toevoegen”.' : 'Niets gevonden. Probeer een ander woord.'}</div>`; return; }
  g.innerHTML = list.map((p) => `<div class="card pose" data-p="${esc(p.id)}"><span class="lv" title="${esc(window.YOGA.LVL[p.lvl] || '')}">${'●'.repeat(p.lvl || 1)}</span>${figHtml(p)}<div class="pn">${esc(p.nl)}</div><div class="ps">${esc(p.sa)}</div>${inPick ? '<button class="add" data-add aria-label="Toevoegen">＋</button>' : ''}</div>`).join('');
  hydrateImgs(g);
  $$('[data-p]', g).forEach((c) => c.onclick = (e) => {
    const p = getPose(c.dataset.p);
    if (e.target.closest('[data-add]')) { addFromLib(p); return; }
    poseSheet(p);
  });
}
function addFromLib(p) {
  const s = curSet(); if (!s) { newSet(p.id); toast(p.nl + ' toegevoegd aan een nieuwe set ✓'); return; }
  if (pick.swap) {
    const it = s.items.find((i) => i.id === pick.swap); pick.swap = null;
    if (it) { const n = P(p.id); it.pose = p.id; it.dur = n.dur; it.unit = n.unit; it.side = n.side; touch(s); }
    pick.on = false; go('build'); toast('Vervangen door ' + p.nl); return;
  }
  const it = P(p.id);
  if (pick.on && pick.at != null) { s.items.splice(pick.at, 0, it); pick.at++; } else s.items.push(it);
  touch(s); pick.count = (pick.count || 0) + 1;
  toast(`${p.nl} toegevoegd ✓ (${s.items.filter((i) => i.type === 'pose').length} in je set)`);
}
function poseSheet(p, ctx = {}) {
  if (!p) return;
  const s = curSet();
  const it = ctx.item;
  const own = D.notes[p.id] || '';
  const cat = (CATS.find((c) => c[0] === p.cat) || ['', ''])[1];
  const sh = sheet(`
    <div class="fig-big">${figHtml(p, { mirror: it ? mirrorFor(p, it.side) : false })}</div>
    <h2 style="margin-top:10px">${esc(p.nl)}</h2><div class="sa">${esc(p.sa)} · ${esc(cat)} · ${esc(window.YOGA.LVL[p.lvl] || '')}${p.sides ? ' · beide kanten' : ''}</div>
    ${p.uitleg ? `<p>${esc(p.uitleg)}</p>` : ''}
    ${p.cues && p.cues.length ? `<h4>Waar let je op</h4><ul>${p.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${p.vars && p.vars.length ? `<h4>Makkelijker / varianten</h4><ul>${p.vars.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${p.letop && p.letop.length ? `<h4>Let op: blessures & zwangerschap</h4><div class="warn"><ul>${p.letop.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    <h4>Mijn eigen aanwijzingen</h4>
    <textarea class="input" id="ownNote" rows="3" placeholder="Wat zeg jij altijd bij deze houding? Dit wordt bewaard voor al je sets.">${esc(own)}</textarea>
    ${p.custom ? '<div class="row" style="margin-top:10px"><button class="btn ghost small" id="cEdit">✎ Eigen houding bewerken</button><button class="btn danger small" id="cDel">🗑 Verwijderen</button></div>' : ''}
    <div class="foot"><button class="btn ghost" data-close>Sluiten</button>${it ? '' : `<button class="btn primary" id="psAdd">＋ ${s ? 'Toevoegen aan set' : 'Nieuwe set hiermee'}</button>`}</div>`);
  $('#ownNote', sh).oninput = (e) => { const v = e.target.value.trim(); if (v) D.notes[p.id] = v; else delete D.notes[p.id]; save(); };
  if ($('#psAdd', sh)) $('#psAdd', sh).onclick = () => { sh.close(); addFromLib(p); if (VIEW === 'build') renderItems(curSet()); };
  if ($('#cEdit', sh)) $('#cEdit', sh).onclick = () => { sh.close(); customPoseDialog(p); };
  if ($('#cDel', sh)) $('#cDel', sh).onclick = async () => {
    sh.close();
    const used = D.sets.some((x) => x.items.some((i) => i.pose === p.id));
    if (!(await confirmBox('Eigen houding verwijderen?', used ? 'Let op: deze houding staat nog in een of meer sets.' : `“${p.nl}” wordt verwijderd.`, 'Verwijderen', true))) return;
    D.custom = D.custom.filter((c) => c.id !== p.id); save(); if (p.img) idb.del(p.img).catch(() => {}); renderLib();
  };
}
function customPoseDialog(p) {
  const isNew = !p;
  const c = p ? JSON.parse(JSON.stringify(p)) : { id: 'c_' + uid(), custom: true, nl: '', sa: '', cat: 'staand', lvl: 1, sides: false, dur: 5, unit: 'a', uitleg: '', cues: [], vars: [], letop: [], g: 'tadasana', img: null };
  let newImg = null;
  const sh = sheet(`<h2>${isNew ? 'Eigen houding' : 'Houding bewerken'}</h2>
    <label class="field"><span>Naam</span><input class="input" id="cNl" value="${esc(c.nl)}" placeholder="Bijv. Wilde ding"></label>
    <label class="field"><span>Sanskriet-naam (mag leeg)</span><input class="input" id="cSa" value="${esc(c.sa)}"></label>
    <div class="field"><span>Soort</span><select class="input" id="cCat">${CATS.map((k) => `<option value="${k[0]}" ${c.cat === k[0] ? 'selected' : ''}>${k[1]}</option>`).join('')}</select></div>
    <div class="switch"><span>Twee kanten (rechts en links)</span><input type="checkbox" id="cSides" ${c.sides ? 'checked' : ''}></div>
    <label class="field"><span>Uitleg</span><textarea class="input" id="cUit" rows="3">${esc(c.uitleg)}</textarea></label>
    <label class="field"><span>Waar let je op (één per regel)</span><textarea class="input" id="cCues" rows="3">${esc(c.cues.join('\n'))}</textarea></label>
    <label class="field"><span>Let op / blessures (één per regel)</span><textarea class="input" id="cLet" rows="2">${esc(c.letop.join('\n'))}</textarea></label>
    <div class="field"><span>Plaatje</span>
      <div class="row" style="margin-bottom:8px"><button class="btn ghost small" id="cPhoto">📷 Eigen foto of tekening</button><span class="muted" id="cImgInfo" style="font-size:14px">${c.img ? 'Eigen foto gekozen' : 'of kies hieronder een tekening'}</span></div>
      <div class="picks" id="cPicks">${POSES.filter((x, i, a) => a.findIndex((y) => y.g === x.g) === i).map((x) => `<button data-g="${x.g}" class="${!c.img && c.g === x.g ? 'on' : ''}" title="${esc(x.nl)}">${window.Figure.svg(GEO[x.g])}</button>`).join('')}</div></div>
    <div class="foot"><button class="btn ghost" data-close>Annuleren</button><button class="btn primary" id="cOk">Bewaren</button></div>`);
  $$('#cPicks [data-g]', sh).forEach((b) => b.onclick = () => { c.g = b.dataset.g; c.img = null; newImg = null; $$('#cPicks button', sh).forEach((x) => x.classList.toggle('on', x === b)); $('#cImgInfo', sh).textContent = 'Tekening gekozen'; });
  $('#cPhoto', sh).onclick = async () => { const [f] = await pickFile('image/*'); if (!f) return; newImg = await downscale(f, 900, 0.85); $('#cImgInfo', sh).textContent = 'Eigen foto gekozen ✓'; $$('#cPicks button', sh).forEach((x) => x.classList.remove('on')); };
  $('#cOk', sh).onclick = async () => {
    c.nl = $('#cNl', sh).value.trim(); if (!c.nl) { toast('Geef de houding een naam'); $('#cNl', sh).focus(); return; }
    c.sa = $('#cSa', sh).value.trim(); c.cat = $('#cCat', sh).value; c.sides = $('#cSides', sh).checked;
    const lines = (id) => $(id, sh).value.split('\n').map((x) => x.trim()).filter(Boolean);
    c.uitleg = $('#cUit', sh).value.trim(); c.cues = lines('#cCues'); c.letop = lines('#cLet');
    if (newImg) { const id = 'cp_' + uid(); await idb.put(id, { blob: newImg, type: newImg.type }); if (c.img) idb.del(c.img).catch(() => {}); c.img = id; }
    const i = D.custom.findIndex((x) => x.id === c.id); if (i >= 0) D.custom[i] = c; else D.custom.push(c);
    save(); sh.close(); libState.cat = 'eigen'; if (VIEW === 'lib') renderLib(); else go('lib'); toast('Eigen houding bewaard ✓');
  };
}

/* ================= BEKIJKEN (OVERZICHT) ================= */
function cueFor(it, p, n = 1) {
  const out = [];
  if (it.note) out.push(it.note);
  if (D.notes[p.id]) out.push(D.notes[p.id]);
  if (out.length < n && p.cues) out.push(...p.cues.slice(0, n - out.length));
  return out.slice(0, Math.max(n, out.length > n ? n : out.length));
}
function openPreview(s) {
  const showCues = D.settings.showCues;
  let t = 0, n = 0;
  const rows = s.items.map((it) => {
    if (it.type === 'head') return `<div class="pv-sec">${esc(it.text || 'Kopje')}</div>`;
    if (it.type === 'text') { const r = it.text ? `<div class="pv-note">${esc(it.text)}${it.dur ? ` <b style="font-style:normal">· ${fmtLong(it.dur)}</b>` : ''}</div>` : ''; t += itemSecs(it); return r; }
    const p = getPose(it.pose) || { nl: '?', sa: '' }; n++;
    const start = t; t += itemSecs(it);
    const cues = showCues && p.id ? cueFor(it, p, 2) : (it.note ? [it.note] : []);
    return `<div class="pv-step"><span class="n">${n}</span>${figHtml(p, { mirror: mirrorFor(p, it.side) })}
      <div class="tx"><b>${esc(p.nl)}</b>${it.side ? ` <span class="badge">${sideLabel(it.side)}</span>` : ''}<div class="sa">${esc(p.sa)}</div>${cues.map((c) => `<div class="cue">• ${esc(c)}</div>`).join('')}</div>
      <div class="tm">${fmtDur(it)}${it.side === 'both' ? '<small>per kant</small>' : ''}<small>vanaf ${fmtClock(start)}</small></div></div>`;
  }).join('');
  const ov = el(`<div class="overlay" id="preview"><div class="ov-top"><button class="btn small ghost" data-x>← Terug</button><h2>Bekijken</h2>
      <button class="btn small ghost" data-print>🖨</button><button class="btn small primary" data-class>▶ Les geven</button></div>
    <div class="pv"><div class="pv-head"><div class="studio">${esc(D.settings.studio || '')}</div><h1>${esc(s.title || 'Naamloze set')}</h1>
      ${s.intention ? `<div class="int">“${esc(s.intention)}”</div>` : ''}
      <div class="meta"><span>⏱ <b>${fmtLong(setSecs(s))}</b></span><span>${n} houdingen</span>${s.level ? `<span>${levelName(s.level)}</span>` : ''}</div>
      ${s.spotify ? `<div style="margin-top:12px"><button class="btn small spotify" data-sp>♫ Spotify-playlist</button></div>` : ''}
      <div class="switch" style="max-width:360px;margin:10px auto 0;border:0"><span>Aanwijzingen tonen</span><input type="checkbox" data-cues ${showCues ? 'checked' : ''}></div></div>
      ${rows || '<p class="empty">Deze set is nog leeg.</p>'}
      ${s.notes ? `<div class="pv-note" style="margin-top:20px">📝 ${esc(s.notes)}</div>` : ''}
    </div></div>`);
  document.body.appendChild(ov); hydrateImgs(ov);
  $('[data-x]', ov).onclick = () => ov.remove();
  $('[data-print]', ov).onclick = () => printDialog(s);
  $('[data-class]', ov).onclick = () => { ov.remove(); startClass(s); };
  if ($('[data-sp]', ov)) $('[data-sp]', ov).onclick = () => openSpotify(s.spotify);
  $('[data-cues]', ov).onchange = (e) => { D.settings.showCues = e.target.checked; save(); ov.remove(); openPreview(s); };
}

/* ================= PRINTEN / PDF ================= */
function printDialog(s) {
  const sh = sheet(`<h2>Printen of PDF</h2><p class="muted">Kies hoe je lesblad eruit moet zien. In het printscherm kun je ook <b>“Bewaar als PDF”</b> kiezen.</p>
    <div class="menu-list"><button data-m="grid"><span class="ico">▦</span><span><b>Overzicht</b><br><small class="muted">Compact lesblad met alle plaatjes, zoals een getekende set</small></span></button>
    <button data-m="list"><span class="ico">☰</span><span><b>Uitgebreid</b><br><small class="muted">Met uitleg en aandachtspunten per houding</small></span></button></div>
    <p class="muted" style="font-size:14px">iPhone: tik in het printscherm op het deel-icoon › “Bewaar in Bestanden” voor een PDF. Android: kies als printer “Opslaan als PDF”.</p>
    <div class="foot"><button class="btn ghost" data-close>Annuleren</button></div>`);
  $$('[data-m]', sh).forEach((b) => b.onclick = () => { sh.close(); doPrint(s, b.dataset.m); });
}
async function doPrint(s, mode) {
  const pa = $('#printArea'); let n = 0; let t = 0;
  const logo = D.settings.logo || defaultLogo();
  const body = s.items.map((it) => {
    if (it.type === 'head') return mode === 'grid' ? `<div class="pr-sec">${esc(it.text)}</div>` : `<div class="pr-sec" style="margin-top:10px">${esc(it.text)}</div>`;
    if (it.type === 'text') { t += itemSecs(it); return it.text ? `<div class="pr-note">${esc(it.text)}${it.dur ? ' · ' + fmtLong(it.dur) : ''}</div>` : ''; }
    const p = getPose(it.pose) || { nl: '?', sa: '' }; n++; t += itemSecs(it);
    if (mode === 'grid') return `<div class="pr-tile"><span class="n">${n}</span>${figHtml(p, { mirror: mirrorFor(p, it.side) })}<b>${esc(p.nl)}</b><small>${fmtDur(it)}${it.side ? ' · ' + (it.side === 'both' ? 'R + L' : it.side === 'r' ? 'rechts' : 'links') : ''}</small>${it.note ? `<small><i>${esc(it.note)}</i></small>` : ''}</div>`;
    const cues = cueFor(it, p, 3);
    return `<div class="pr-row">${figHtml(p, { mirror: mirrorFor(p, it.side) })}<div class="tx"><b>${n}. ${esc(p.nl)}</b> <i style="color:#666">${esc(p.sa)}</i>${it.side ? ' · ' + sideLabel(it.side) : ''}<ul>${cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${p.letop && p.letop[0] ? `<div style="color:#8a5a12;font-size:9pt">Let op: ${esc(p.letop.join(' · '))}</div>` : ''}</div><div class="tm">${fmtDur(it)}${it.side === 'both' ? ' ×2' : ''}</div></div>`;
  }).join('');
  pa.innerHTML = `<div class="pr-head"><img src="${logo}" alt=""><div><div class="studio">${esc(D.settings.studio || '')}</div><h1>${esc(s.title || 'Yogaset')}</h1></div>
    <div class="r">⏱ ${fmtLong(setSecs(s))} · ${n} houdingen${s.level ? '<br>' + levelName(s.level) : ''}<br>${new Date().toLocaleDateString('nl-NL')}</div></div>
    ${s.intention ? `<p class="pr-int">“${esc(s.intention)}”</p>` : ''}
    <div class="${mode === 'grid' ? 'pr-grid' : 'pr-list'}">${body}</div>
    ${s.notes ? `<p class="pr-music">📝 ${esc(s.notes)}</p>` : ''}
    ${s.spotify || s.tracks.length ? `<p class="pr-music">♫ ${s.spotify ? 'Spotify: ' + esc(s.spotify) : ''}${s.tracks.length ? (s.spotify ? ' · ' : '') + s.tracks.map((id) => esc((D.tracks[id] || {}).name || '')).join(', ') : ''}</p>` : ''}
    <div class="pr-foot">${esc(D.settings.teacher || '')} · gemaakt met Yoga Set Maker</div>`;
  await new Promise((r) => setTimeout(r, 120));
  const imgs = $$('img', pa); await Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
  window.print();
}

/* ================= LESMODUS ================= */
let C = null;
function buildSteps(s) {
  const steps = []; let sec = '';
  s.items.forEach((it) => {
    if (it.type === 'head') { sec = it.text; return; }
    if (it.type === 'text') { if (it.text || it.dur) steps.push({ kind: 'text', it, secs: it.dur || 0, sec }); return; }
    const p = getPose(it.pose); if (!p) return;
    if (it.side === 'both') { steps.push({ kind: 'pose', it, p, side: 'r', secs: baseSecs(it), sec }); steps.push({ kind: 'pose', it, p, side: 'l', secs: baseSecs(it), sec }); }
    else steps.push({ kind: 'pose', it, p, side: it.side, secs: baseSecs(it), sec });
  });
  return steps;
}
let actx;
function chime(kind = 'end') {
  if (!D.settings.chime) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime, vol = D.settings.vol ?? 0.7;
    const master = actx.createGain(); master.gain.value = vol * 0.5; master.connect(actx.destination);
    const base = kind === 'start' ? 784 : 659.25;
    [[1, 1], [2.01, 0.42], [3.02, 0.18], [4.2, 0.08]].forEach(([m, a]) => {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = base * m;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2 / m + 0.6);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 4);
    });
  } catch (e) {}
}
let wakeLock = null;
async function lockScreen() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (C && document.visibilityState === 'visible') lockScreen(); });
function startClass(s, from = 0) {
  const steps = buildSteps(s);
  if (!steps.length) { toast('Voeg eerst houdingen toe aan je set'); return; }
  $('#preview') && $('#preview').remove();
  chime('start');
  C = { s, steps, i: from, left: steps[from].secs, running: true, auto: D.settings.auto, last: Date.now(), total: steps.reduce((a, b) => a + b.secs, 0) };
  const ov = el(`<div class="cls" id="cls" role="dialog" aria-label="Lesmodus">
    <div class="bar"><button class="btn small ghost" data-x>✕ Stop</button><span class="sec" id="cSec"></span><span class="muted" id="cCount" style="font-size:14px"></span>
      <button class="btn small ghost" data-auto title="Automatisch door naar de volgende houding"></button>${s.tracks.length ? '<button class="btn small ghost" data-mus aria-label="Muziek">♫</button>' : ''}${s.spotify ? '<button class="btn small spotify" data-sp aria-label="Spotify">♫</button>' : ''}</div>
    <div class="prog"><i id="cProg"></i></div>
    <div class="stage" id="cStage"></div>
    <div class="next" id="cNext"></div>
    <div class="ctrls"><button class="btn ghost" data-prev>◀ Vorige</button><button class="btn primary" data-pp></button><button class="btn ghost" data-next>Volgende ▶</button></div>
  </div>`);
  document.body.appendChild(ov);
  $('[data-x]', ov).onclick = stopClass;
  $('[data-prev]', ov).onclick = () => goStep(C.i - 1);
  $('[data-next]', ov).onclick = () => goStep(C.i + 1);
  $('[data-pp]', ov).onclick = () => { if (C.left <= 0 && C.steps[C.i].secs) { goStep(C.i + 1); return; } C.running = !C.running; C.last = Date.now(); drawClass(); };
  $('[data-auto]', ov).onclick = () => { C.auto = !C.auto; D.settings.auto = C.auto; save(); drawClass(); toast(C.auto ? 'Gaat automatisch door' : 'Wacht op jou bij elke houding'); };
  if ($('[data-mus]', ov)) $('[data-mus]', ov).onclick = () => { if (player.setId === s.id && !audio.paused) audio.pause(); else if (player.setId === s.id && player.idx >= 0) audio.play(); else playTrack(s, 0); };
  if ($('[data-sp]', ov)) $('[data-sp]', ov).onclick = () => openSpotify(s.spotify);
  lockScreen();
  if (document.documentElement.requestFullscreen && !/iPhone|iPad/.test(navigator.userAgent)) document.documentElement.requestFullscreen().catch(() => {});
  document.addEventListener('keydown', classKeys);
  C.timer = setInterval(tick, 250);
  drawClass();
}
function classKeys(e) {
  if (!C) return;
  if (['ArrowRight', 'PageDown', 'ArrowDown'].includes(e.key)) { e.preventDefault(); goStep(C.i + 1); }
  else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { e.preventDefault(); goStep(C.i - 1); }
  else if (e.key === ' ' || e.key === 'Enter' || e.key === 'b' || e.key === '.') { e.preventDefault(); $('#cls [data-pp]').click(); }
  else if (e.key === 'Escape') stopClass();
}
function tick() {
  if (!C || !C.running) { if (C) C.last = Date.now(); return; }
  const now = Date.now(), dt = (now - C.last) / 1000; C.last = now;
  const st = C.steps[C.i]; if (!st.secs) return;
  if (C.left > 0) {
    C.left -= dt;
    if (C.left <= 0) {
      C.left = 0; chime();
      if (C.auto && C.i < C.steps.length - 1) { setTimeout(() => { if (C && C.left === 0) goStep(C.i + 1, true); }, 900); }
      else if (C.i === C.steps.length - 1) { C.running = false; }
    }
    drawTimer();
  }
}
function goStep(i, auto) {
  if (!C) return;
  if (i >= C.steps.length) { stopClass(true); return; }
  i = clamp(i, 0, C.steps.length - 1); C.i = i; C.left = C.steps[i].secs; C.last = Date.now();
  if (auto || C.auto) C.running = true;
  drawClass();
}
function drawTimer() {
  const st = C.steps[C.i]; const t = $('#cTimer'); if (!t) return;
  if (!st.secs) { t.innerHTML = '<small>geen tijd · tik op Volgende</small>'; }
  else {
    const it = st.it, br = it.type === 'pose' && it.unit === 'a';
    const left = Math.ceil(C.left);
    t.innerHTML = (C.left <= 0 ? '✓' : fmtClock(left)) + `<small>${C.left <= 0 ? (C.i === C.steps.length - 1 ? 'Einde van de les' : 'Klaar – tik op Volgende') : br ? `${it.dur} ademhalingen` + (st.side ? ' · ' + (st.side === 'r' ? 'rechts' : 'links') : '') : (st.side ? (st.side === 'r' ? 'rechterkant' : 'linkerkant') : '')}</small>`;
  }
  const done = C.steps.slice(0, C.i).reduce((a, b) => a + b.secs, 0) + (st.secs - C.left);
  $('#cProg').style.width = (C.total ? (done / C.total) * 100 : (C.i / C.steps.length) * 100) + '%';
  $('#cls').classList.toggle('paused', !C.running);
  const pp = $('#cls [data-pp]'); pp.textContent = C.left <= 0 && st.secs ? 'Volgende ▶' : C.running ? '❚❚ Pauze' : '▶ Verder';
}
function drawClass() {
  const st = C.steps[C.i];
  $('#cSec').textContent = st.sec || C.s.title || '';
  $('#cCount').textContent = `${C.i + 1} / ${C.steps.length}`;
  $('#cls [data-auto]').textContent = C.auto ? '⟳ Auto aan' : '⟳ Auto uit';
  const stage = $('#cStage');
  if (st.kind === 'text') stage.innerHTML = `<div class="textstep">${esc(st.it.text || '')}</div><div class="timer" id="cTimer"></div>`;
  else {
    const cues = cueFor(st.it, st.p, 1);
    stage.innerHTML = `<div class="fig-wrap">${figHtml(st.p, { mirror: mirrorFor(st.p, st.side) })}</div><div><div class="pname">${esc(st.p.nl)}</div><div class="psa">${esc(st.p.sa)}</div>
      ${st.side ? `<span class="side">${st.side === 'r' ? 'Rechts' : 'Links'}</span>` : ''}<div class="timer" id="cTimer"></div>${cues[0] ? `<div class="cue">${esc(cues[0])}</div>` : ''}</div>`;
  }
  hydrateImgs(stage);
  const nx = C.steps[C.i + 1];
  $('#cNext').innerHTML = nx ? `Hierna: ${nx.kind === 'pose' ? figHtml(nx.p, { mirror: mirrorFor(nx.p, nx.side) }) + '<b>' + esc(nx.p.nl) + '</b>' + (nx.side ? ' (' + (nx.side === 'r' ? 'rechts' : 'links') + ')' : '') : '<i>' + esc((nx.it.text || '').slice(0, 50)) + '</i>'}` : '<b>Laatste houding</b>';
  hydrateImgs($('#cNext'));
  drawTimer();
}
function stopClass(finished) {
  if (!C) return;
  clearInterval(C.timer); document.removeEventListener('keydown', classKeys);
  $('#cls') && $('#cls').remove();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  C = null;
  if (finished === true) { chime(); toast('Namasté 🙏 De les is klaar'); }
}

/* ================= INSTELLINGEN ================= */
function renderSettings() {
  const v = $('#v-settings'); const st = D.settings;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  v.innerHTML = `<h1 class="title-xl"><em>Instellingen</em></h1>
  <section class="card set-sec"><h3>Jouw gegevens</h3>
    <label class="field"><span>Jouw naam</span><input class="input" id="sTeacher" value="${esc(st.teacher)}"></label>
    <label class="field"><span>Naam van je studio (bovenaan en op het lesblad)</span><input class="input" id="sStudio" value="${esc(st.studio)}"></label>
    <div class="field"><span>Logo</span><div class="row"><img class="logo-prev" src="${st.logo || defaultLogo()}" alt="Logo"><button class="btn ghost small" id="sLogo">Ander logo kiezen</button>${st.logo ? '<button class="btn ghost small" id="sLogoReset">Standaard</button>' : ''}</div></div>
  </section>
  <section class="card set-sec"><h3>Kleuren</h3><div class="themes">${Object.entries(THEMES).map(([k, t]) => `<button class="theme ${st.theme === k ? 'on' : ''}" data-th="${k}"><div class="sw"><i style="background:${t.brand}"></i><i style="background:${t.accent}"></i><i style="background:${t.sand}"></i></div>${t.name}</button>`).join('')}
    <button class="theme ${st.theme === 'eigen' ? 'on' : ''}" data-th="eigen"><div class="sw"><i style="background:${st.brand}"></i><i style="background:${st.accent}"></i></div>Eigen kleuren</button></div>
    ${st.theme === 'eigen' ? `<div class="row" style="margin-top:12px"><label class="row">Hoofdkleur <input type="color" id="sBrand" value="${st.brand}" style="width:56px;height:44px;border:0;background:none"></label><label class="row">Knoppen <input type="color" id="sAccent" value="${st.accent}" style="width:56px;height:44px;border:0;background:none"></label></div>` : ''}
  </section>
  <section class="card set-sec"><h3>Tijd en lesmodus</h3>
    <div class="field"><span>Eén ademhaling duurt ongeveer</span><div class="row"><div class="stepper"><button id="spbM">−</button><span class="val" id="spbV" style="display:grid;place-items:center">${st.spb} sec</span><button id="spbP">+</button></div><span class="muted" style="font-size:14px">voor het berekenen van de totale tijd</span></div></div>
    <div class="switch"><span>Belletje bij elke overgang</span><input type="checkbox" id="sChime" ${st.chime ? 'checked' : ''}></div>
    <div class="switch"><span>Volume belletje</span><input type="range" id="sVol" min="0.1" max="1" step="0.1" value="${st.vol}" style="width:46%"><button class="btn small ghost" id="sTest">🔔 Test</button></div>
    <div class="switch"><span>Automatisch door naar de volgende houding</span><input type="checkbox" id="sAuto" ${st.auto ? 'checked' : ''}></div>
  </section>
  <section class="card set-sec" data-tour="backup"><h3>Back-up (heel belangrijk)</h3>
    <p class="muted" style="margin-top:0">Je sets staan alleen op dit toestel. Maak af en toe een back-up en bewaar die bijvoorbeeld in je mail of iCloud/Google Drive. Met dat bestand zet je alles ook over naar een nieuwe telefoon of tablet.</p>
    <div class="switch"><span>Ook muziek meenemen (maakt het bestand groot)</span><input type="checkbox" id="bkMusic"></div>
    <div class="row"><button class="btn primary" id="bkOut" style="flex:1">⇩ Back-up maken</button><button class="btn ghost" id="bkIn" style="flex:1">⇧ Back-up terugzetten</button></div>
    <p class="muted" style="font-size:13.5px;margin-bottom:0" id="bkInfo"></p>
  </section>
  ${isInstalled() ? '' : `<section class="card set-sec" data-tour="install"><h3>App op je beginscherm</h3>
    <p class="muted" style="margin-top:0">Zet de app als icoontje op je beginscherm. Dan open je hem met één tik, schermvullend en ook zonder internet.</p>
    <button class="btn primary wide" data-install>📲 App op je beginscherm zetten</button>
  </section>`}
  ${isInstalled() ? '<section class="card set-sec"><h3>App op je beginscherm</h3><div class="install-hint">✓ De app staat op je beginscherm en werkt ook zonder internet.</div></section>' : ''}
  <section class="card set-sec" data-tour="feedback"><h3>Feedback of wens doorgeven</h3>
    <p class="muted" style="margin-top:0">Werkt iets niet, mis je iets of heb je een vraag? Laat het weten, dan kan de app verbeterd worden.</p>
    <button class="btn primary wide" id="sFb">✉ Feedback / wens doorgeven</button>
    <label class="field" style="margin-top:14px"><span>Feedback gaat naar dit e-mailadres</span><input class="input" type="email" id="sFbMail" inputmode="email" autocomplete="off" value="${esc(st.feedbackEmail || '')}"></label>
  </section>
  <section class="card set-sec"><h3>Hulp</h3><div class="row"><button class="btn ghost" id="sTour" style="flex:1">? Rondleiding opnieuw</button><button class="btn ghost" id="sEx" style="flex:1">☀ Voorbeeldsets terugzetten</button></div>
    <p class="muted" style="font-size:13.5px;margin:12px 0 0">Yoga Set Maker · versie ${APP_VERSION} · werkt offline · je gegevens blijven op dit toestel. Illustraties en teksten zijn een algemene leidraad; pas ze aan aan je eigen lesgeven en je leerlingen.</p></section>`;
  const bind = (id, k, fn = (x) => x) => { $(id).oninput = (e) => { st[k] = fn(e.target.value); save(); applyTheme(); }; };
  bind('#sTeacher', 'teacher'); bind('#sStudio', 'studio');
  $('#sLogo').onclick = async () => { const [f] = await pickFile('image/*'); if (!f) return; const b = await downscale(f, 256, 0.9); const r = new FileReader(); r.onload = () => { st.logo = r.result; save(); applyTheme(); renderSettings(); }; r.readAsDataURL(b); };
  if ($('#sLogoReset')) $('#sLogoReset').onclick = () => { st.logo = null; save(); applyTheme(); renderSettings(); };
  $$('[data-th]').forEach((b) => b.onclick = () => { st.theme = b.dataset.th; if (st.theme !== 'eigen') { st.brand = THEMES[st.theme].brand; st.accent = THEMES[st.theme].accent; } save(); applyTheme(); renderSettings(); });
  if ($('#sBrand')) { $('#sBrand').oninput = (e) => { st.brand = e.target.value; save(); applyTheme(); }; $('#sAccent').oninput = (e) => { st.accent = e.target.value; save(); applyTheme(); }; }
  const spbSet = (d) => { st.spb = clamp(st.spb + d, 2, 12); save(); $('#spbV').textContent = st.spb + ' sec'; };
  $('#spbM').onclick = () => spbSet(-1); $('#spbP').onclick = () => spbSet(1);
  $('#sChime').onchange = (e) => { st.chime = e.target.checked; save(); };
  $('#sVol').oninput = (e) => { st.vol = +e.target.value; save(); };
  $('#sTest').onclick = () => { const c = st.chime; st.chime = true; chime(); st.chime = c; };
  $('#sAuto').onchange = (e) => { st.auto = e.target.checked; save(); };
  $('#bkOut').onclick = () => makeBackup($('#bkMusic').checked);
  $('#bkIn').onclick = () => importFile();
  $('#sTour').onclick = () => startTour();
  $('#sFb').onclick = () => openFeedback();
  $('#sFbMail').oninput = (e) => { st.feedbackEmail = e.target.value.trim(); save(); };
  $('#sEx').onclick = () => { exampleSets().forEach((ex) => { const i = D.sets.findIndex((x) => x.id === ex.id); if (i >= 0) D.sets[i] = ex; else D.sets.push(ex); }); save(); toast('Voorbeeldsets staan weer klaar'); };
  if (D.lastBackup) $('#bkInfo').textContent = 'Laatste back-up: ' + new Date(D.lastBackup).toLocaleString('nl-NL');
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { const i = $('#bkInfo'); if (i) i.textContent += (i.textContent ? ' · ' : '') + 'In gebruik: ' + (e.usage / 1048576).toFixed(1) + ' MB'; });
}
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('De app staat nu op je beginscherm ✓'); $$('[data-install]').forEach((b) => b.closest('.set-sec, .install-row') ? b.closest('.set-sec, .install-row').remove() : b.remove()); });
function isInstalled() { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; }
function platform() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return { os: 'ios', dev: /iPad/.test(ua) || !/iPhone|iPod/.test(ua) ? 'iPad' : 'iPhone', browser: /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : /GSA|Instagram|FBAN|FBAV|WhatsApp/.test(ua) ? 'app' : 'safari' };
  if (/Android/.test(ua)) return { os: 'android', browser: /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'firefox' : /EdgA/.test(ua) ? 'edge' : 'chrome' };
  return { os: 'desktop', browser: /Edg\//.test(ua) ? 'edge' : /Firefox/.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other' };
}
const LIVE_URL = 'https://kmhkasper-boop.github.io/yoga-set-maker/';
const IC = {
  share: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  dots: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
};
function stepHtml(n, title, mock, text) { return `<div class="ist"><div class="ist-n">${n}</div><div class="ist-b"><b>${title}</b><div class="ist-mock">${mock}</div><p>${text}</p></div></div>`; }
function installSteps(pf) {
  const icon = `<img src="icons/icon-192.png" alt="" class="ist-app">`;
  if (pf.os === 'ios') {
    const where = pf.dev === 'iPad' ? 'rechtsboven naast de adresbalk' : 'onderaan het scherm (soms rechts in de adresbalk)';
    let pre = '';
    if (pf.browser !== 'safari') pre = `<div class="ist-warn"><b>Let op:</b> je gebruikt nu ${pf.browser === 'chrome' ? 'Chrome' : pf.browser === 'firefox' ? 'Firefox' : pf.browser === 'edge' ? 'Edge' : 'een app'} op je ${pf.dev}. Het makkelijkst gaat het in <b>Safari</b>: kopieer de link en open hem in Safari. Met Chrome kan het ook vanaf iOS 16.4: tik op het deel-icoon ${IC.share} in de adresbalk en volg dezelfde stappen.<div class="row" style="margin-top:10px"><button class="btn small primary" data-copylink>Kopieer de link</button></div></div>`;
    return pre + stepHtml(1, 'Tik op het deel-icoon', `<div class="mk-bar"><span>‹</span><span>›</span><span class="hl">${IC.share}</span><span>▢</span></div>`, `Het vierkantje met het pijltje omhoog, ${where}.`) +
      stepHtml(2, 'Kies “Zet op beginscherm”', `<div class="mk-list"><div>Kopieer</div><div>Voeg bladwijzer toe</div><div class="hl">Zet op beginscherm <span>${IC.plus}</span></div></div>`, 'Scroll een klein stukje naar beneden als je hem niet meteen ziet.') +
      stepHtml(3, 'Tik op “Voeg toe”', `<div class="mk-top"><span>Annuleer</span><b>Zet op beginscherm</b><span class="hl">Voeg toe</span></div>`, 'Rechtsboven in het venster.') +
      stepHtml(4, 'Klaar!', `<div class="mk-home">${icon}<small>Yoga Sets</small></div>`, 'Open de app voortaan met dit icoontje op je beginscherm.');
  }
  if (pf.os === 'android') {
    if (pf.browser === 'samsung') return stepHtml(1, 'Tik op het menu', `<div class="mk-bar"><span>‹</span><span>›</span><span>⌂</span><span>▣</span><span class="hl">☰</span></div>`, 'De drie streepjes onderaan.') + stepHtml(2, 'Kies “Pagina toevoegen aan” › “Startscherm”', `<div class="mk-list"><div class="hl">Toevoegen aan startscherm</div></div>`, 'Bevestig met “Toevoegen”.') + stepHtml(3, 'Klaar!', `<div class="mk-home">${icon}<small>Yoga Sets</small></div>`, 'Het icoontje staat nu op je startscherm.');
    return stepHtml(1, 'Tik op de drie puntjes', `<div class="mk-addr"><span>🔒 kmhkasper-boop.github.io</span><span class="hl">${IC.dots}</span></div>`, 'Rechtsboven in Chrome.') +
      stepHtml(2, 'Kies “App installeren”', `<div class="mk-list"><div>Nieuw tabblad</div><div>Bladwijzers</div><div class="hl">App installeren</div></div>`, 'Staat er “Toevoegen aan startscherm”? Dat is ook goed.') +
      stepHtml(3, 'Tik op “Installeren”', `<div class="mk-top"><span></span><b>App installeren?</b><span class="hl">Installeren</span></div>`, '') +
      stepHtml(4, 'Klaar!', `<div class="mk-home">${icon}<small>Yoga Sets</small></div>`, 'Open de app voortaan met dit icoontje.');
  }
  if (pf.browser === 'safari') return stepHtml(1, 'Kies in de menubalk “Archief”', `<div class="mk-list"><div class="hl">Voeg toe aan Dock…</div></div>`, 'Op een Mac met macOS Sonoma of nieuwer. Daarna staat de app in je Dock.');
  if (pf.browser === 'firefox') return `<p>Firefox kan apps niet installeren. Open de app in <b>Chrome</b> of <b>Edge</b> en klik op het installeer-icoon in de adresbalk. Je kunt de app ook gewoon als bladwijzer bewaren.</p>`;
  return stepHtml(1, 'Klik op het installeer-icoon', `<div class="mk-addr"><span>🔒 kmhkasper-boop.github.io/yoga-set-maker</span><span class="hl" style="font-size:22px">⊕</span></div>`, 'Rechts in de adresbalk. Of via het menu ⋮ › “Opslaan en delen” › “App installeren”.') +
    stepHtml(2, 'Klik op “Installeren”', `<div class="mk-top"><span></span><b>App installeren?</b><span class="hl">Installeren</span></div>`, 'De app opent in een eigen venster en staat bij je programma’s.');
}
async function openInstall() {
  if (isInstalled()) { toast('De app staat al op je beginscherm ✓'); return; }
  if (location.protocol === 'file:') {
    const sh = sheet(`<h2>App op je beginscherm zetten</h2><p>Dit is de offline versie (een bestand). Die kun je niet als app installeren. Open daarvoor de app via de link:</p><p class="ist-link">${LIVE_URL}</p><div class="foot"><button class="btn ghost" data-close>Sluiten</button><button class="btn primary" data-copylink>Kopieer de link</button></div>`);
    bindCopyLink(sh); return;
  }
  if (deferredInstall) {
    const ev = deferredInstall; deferredInstall = null;
    try { ev.prompt(); const r = await ev.userChoice; if (r && r.outcome === 'accepted') toast('Gelukt! De app komt op je beginscherm ✓'); else toast('Geen probleem, het kan later ook nog via Instellingen'); } catch (e) { showInstallSteps(); }
    return;
  }
  showInstallSteps();
}
function showInstallSteps() {
  const pf = platform();
  const name = pf.os === 'ios' ? `je ${pf.dev}` : pf.os === 'android' ? 'je telefoon' : 'je computer';
  const sh = sheet(`<h2>App op ${name} zetten</h2><p class="muted" style="margin-top:0">${pf.os === 'desktop' ? 'Zo opent de app in een eigen venster en werkt hij ook zonder internet.' : 'Zo staat de app als icoontje op je beginscherm en werkt hij ook zonder internet.'}</p>${installSteps(pf)}<div class="foot"><button class="btn primary" data-close>Begrepen</button></div>`, { cls: 'install-sheet' });
  bindCopyLink(sh);
}
function bindCopyLink(sh) {
  $$('[data-copylink]', sh).forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(LIVE_URL); toast('Link gekopieerd. Plak hem in Safari.'); } catch (e) { prompt('Kopieer deze link:', LIVE_URL); }
  });
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-install]'); if (b) { e.preventDefault(); openInstall(); } });

/* ================= BACK-UP / DELEN ================= */
const b64 = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
const unb64 = async (data) => (await fetch(data)).blob();
async function collectBlobs(ids) {
  const out = {};
  for (const id of ids) { const rec = await idb.get(id).catch(() => null); if (rec) out[id] = { name: rec.name || '', type: rec.type || (rec.blob && rec.blob.type) || '', data: await b64(rec.blob || rec) }; }
  return out;
}
async function makeBackup(withMusic) {
  toast('Back-up wordt gemaakt…');
  const ids = [];
  D.sets.forEach((s) => { if (s.photo) ids.push(s.photo); if (withMusic) ids.push(...s.tracks); });
  D.custom.forEach((c) => c.img && ids.push(c.img));
  const data = JSON.parse(JSON.stringify(D)); if (!withMusic) { data.sets.forEach((s) => s.tracks = []); data.tracks = {}; }
  const file = { app: 'yoga-set-maker', kind: 'backup', v: 1, date: new Date().toISOString(), data, files: await collectBlobs([...new Set(ids)]) };
  const name = `yoga-sets-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  D.lastBackup = Date.now(); save();
  await shareOrDownload(name, blob, 'Back-up van mijn yogasets');
  if (VIEW === 'settings') renderSettings();
}
async function shareOrDownload(name, blob, title) {
  const f = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [f] }) && /Android|iPhone|iPad/.test(navigator.userAgent)) {
    try { await navigator.share({ files: [f], title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(name, blob); toast('Bestand bewaard bij je downloads ✓');
}
async function shareSet(s) {
  const ids = []; if (s.photo) ids.push(s.photo);
  const custom = D.custom.filter((c) => s.items.some((i) => i.pose === c.id)); custom.forEach((c) => c.img && ids.push(c.img));
  const set = JSON.parse(JSON.stringify(s)); set.tracks = [];
  const file = { app: 'yoga-set-maker', kind: 'set', v: 1, date: new Date().toISOString(), set, custom, files: await collectBlobs(ids) };
  const name = (s.title || 'yogaset').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.json';
  await shareOrDownload(name, new Blob([JSON.stringify(file)], { type: 'application/json' }), s.title);
}
async function importFile() {
  const [f] = await pickFile('.json,application/json'); if (!f) return;
  let j; try { j = JSON.parse(await f.text()); } catch (e) { toast('Dit bestand kan ik niet lezen'); return; }
  if (!j || j.app !== 'yoga-set-maker') { toast('Dit is geen back-up van Yoga Set Maker'); return; }
  for (const [id, b] of Object.entries(j.files || {})) { try { await idb.put(id, { blob: await unb64(b.data), name: b.name, type: b.type }); } catch (e) {} }
  if (j.kind === 'set') {
    const s = j.set; if (D.sets.some((x) => x.id === s.id)) { s.id = uid(); s.title += ' (geïmporteerd)'; }
    (j.custom || []).forEach((c) => { if (!D.custom.some((x) => x.id === c.id)) D.custom.push(c); });
    s.example = false; D.sets.push(s); save(); toast('Set “' + s.title + '” toegevoegd ✓'); go('sets'); return;
  }
  const replace = await confirmBox('Back-up terugzetten', `Back-up van ${new Date(j.date).toLocaleDateString('nl-NL')} met ${j.data.sets.length} sets. Wil je alles op dit toestel vervangen? Kies “Nee” om de sets toe te voegen aan wat er al staat.`, 'Ja, alles vervangen', true);
  const d = j.data;
  if (replace) { D = Object.assign(freshData(), d); D.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings); }
  else {
    d.sets.forEach((s) => { const i = D.sets.findIndex((x) => x.id === s.id); if (i >= 0) D.sets[i] = s; else D.sets.push(s); });
    (d.custom || []).forEach((c) => { const i = D.custom.findIndex((x) => x.id === c.id); if (i >= 0) D.custom[i] = c; else D.custom.push(c); });
    Object.assign(D.notes, d.notes || {}); Object.assign(D.tracks, d.tracks || {});
  }
  saveNow(); applyTheme(); toast('Back-up teruggezet ✓'); go('sets');
}

/* ================= PLUSKNOP ================= */
function updateFab() {
  let f = $('#fab');
  const show = VIEW === 'build' && curSet();
  if (!show) { if (f) f.remove(); return; }
  if (!f) { f = el('<button class="btn primary fab" id="fab" aria-label="Houding toevoegen">＋ Houding</button>'); document.body.appendChild(f); f.onclick = () => openPicker(null); }
}

/* ================= RONDLEIDING ("LEG UIT") ================= */
function tourSteps() {
  const name = D.settings.teacher || '';
  const ex = () => { if (!D.sets.find((s) => s.id === 'ex-ochtend')) D.sets.push(exampleSets()[0]); D.current = 'ex-ochtend'; };
  const closeAll = () => { $$('.sheet-bg, .overlay').forEach((x) => x.remove()); };
  const openPanel = (id) => () => { const p = $(id); if (p) p.open = true; };
  return [
    { title: `Welkom${name ? ', ' + name : ''}!`, text: 'Met deze app maak je je yogasets: houdingen kiezen, schuiven, tijden instellen en daarna bekijken, printen of direct lesgeven. Ik laat je in een paar stappen zien hoe alles werkt. Tik op “Volgende”.', v: 'sets' },
    { sel: '[data-tour=nav-sets]', title: 'Onderaan: de vier knoppen', text: 'Hiermee wissel je tussen je sets, het maken van een set, alle houdingen en de instellingen. Je kunt nooit verdwalen: tik gewoon onderaan.', v: 'sets' },
    { sel: '[data-tour=setlist]', title: 'Mijn sets', text: 'Hier staan al je sets, de nieuwste bovenaan. Met het sterretje ☆ maak je een set favoriet. Er staan al drie voorbeeldsets klaar.', v: 'sets' },
    { sel: '[data-tour=newset]', title: 'Nieuwe set', text: 'Met deze knop begin je een nieuwe, lege set. Nu openen we even een voorbeeldset om te laten zien hoe het werkt.', v: 'sets' },
    { sel: '[data-tour=title]', title: 'Naam van de set', text: 'Tik hier om de naam te veranderen. Alles wordt meteen vanzelf bewaard; je hoeft nooit op “opslaan” te drukken.', v: 'build', prep: ex },
    { sel: '[data-tour=total]', title: 'Totale tijd', text: 'Hier zie je steeds hoe lang de les duurt. Verander je een tijd, dan rekent de app direct opnieuw.', v: 'build', prep: ex },
    { sel: '#items .item.ip', title: 'Een houding', text: 'Elke kaart is één houding. Tik op het plaatje voor uitleg, aandachtspunten en wat je moet weten bij blessures of zwangerschap.', v: 'build', prep: ex },
    { sel: '#items .item.ip [data-tour-step]', title: 'Hoe lang?', text: 'Met − en + maak je de houding korter of langer. Tik op het getal zelf om te kiezen tussen ademhalingen of seconden/minuten.', v: 'build', prep: ex },
    { sel: '#items .item.ip [data-side]', title: 'Rechts en links', text: 'Bij houdingen met twee kanten zie je deze knop. “Rechts + links” betekent: de houding komt twee keer in de les. Tik om te wisselen.', v: 'build', prep: ex },
    { sel: '#items .item.ip [data-grip]', title: 'Schuiven', text: 'Houd de puntjes vast en schuif de kaart omhoog of omlaag naar een andere plek. Lukt slepen niet? Gebruik de ⋯ knop rechts › “Eén plek omhoog”.', v: 'build', prep: ex },
    { sel: '#items .item.ip [data-menu]', title: 'Meer opties', text: 'Via ⋯ kun je een houding dupliceren, verwijderen, een eigen aanwijzing toevoegen of een andere houding kiezen. Verwijderd per ongeluk? Tik op “Ongedaan maken”.', v: 'build', prep: ex },
    { sel: '[data-tour=add]', title: 'Toevoegen', text: 'Voeg houdingen toe, een tekstkaart (bijv. uitleg of een verhaaltje), een kopje zoals “Warming-up”, of meteen een hele zonnegroet.', v: 'build', prep: ex },
    { sel: '[data-tour=photo]', title: 'Foto van je tekening', text: 'Heb je een set op papier getekend? Maak er hier een foto van. Die staat dan naast je set, zodat je hem makkelijk kunt overnemen.', v: 'build', prep: ex },
    { sel: '[data-tour=music]', title: 'Muziek', text: 'Plak de link van je Spotify-playlist: met één knop open je hem. Of voeg eigen mp3-liedjes toe, die spelen in de app, ook zonder internet.', v: 'build', prep: ex },
    { sel: '[data-tour=preview]', title: 'Bekijken', text: 'Een rustig overzicht van je hele set, met tijden en aanwijzingen. Handig om je les nog even door te lezen.', v: 'build', prep: ex },
    { sel: '[data-tour=class]', title: 'Les geven', text: 'Grote plaatjes, een timer en een zacht belletje bij elke overgang. Het scherm blijft aan. Je kunt pauzeren, terug en verder.', v: 'build', prep: ex },
    { sel: '[data-tour=print]', title: 'Printen of PDF', text: 'Print je set op één A4, of met alle uitleg erbij. In het printscherm kun je ook een PDF bewaren.', v: 'build', prep: ex },
    { sel: '[data-tour=lib-chips]', title: 'Alle houdingen', text: `Hier vind je ${allPoses().length} houdingen met uitleg. Zoek op naam of kies een soort, zoals Staand, Balans of Stoelyoga. Je kunt ook je eigen houdingen toevoegen.`, v: 'lib', prep: () => { pick.on = false; } },
    ...(isInstalled() ? [] : [{ sel: '[data-tour=install]', title: 'App op je beginscherm', text: 'Tik hier om de app als icoontje op je beginscherm te zetten. Op de iPhone laat de app je stap voor stap zien hoe dat in Safari gaat.', v: 'settings' }]),
    { sel: '[data-tour=backup]', title: 'Back-up maken', text: 'Je sets staan alleen op dit toestel. Maak daarom af en toe een back-up en bewaar die in je mail of in de cloud. Hier pas je ook je naam, logo en kleuren aan.', v: 'settings' },
    { sel: '[data-tour=feedback]', title: 'Feedback of wens doorgeven', text: 'Werkt iets niet of mis je iets? Hier schrijf je het op. Je mail-app opent met het bericht klaar, jij tikt zelf op versturen.', v: 'settings' },
    { sel: '[data-tour=help]', title: 'Klaar!', text: 'Vergeten hoe iets werkt? Tik altijd op “Leg uit”: daar start je deze rondleiding opnieuw of geef je feedback door. Veel plezier met lesgeven! 🙏', v: 'sets' },
  ];
}
let TOUR = null;
function startTour() {
  $$('.sheet-bg, .overlay').forEach((x) => x.remove());
  if (C) stopClass();
  TOUR = { i: 0, steps: tourSteps(), prevCurrent: D.current };
  const catcher = el('<div class="tour-catch"></div>'), hole = el('<div class="tour-hole none"></div>'), box = el('<div class="tour-box" role="dialog" aria-live="polite"></div>');
  document.body.append(catcher, hole, box);
  TOUR.els = { catcher, hole, box };
  catcher.onclick = () => {};
  tourShow();
  window.addEventListener('resize', tourPlace);
}
function tourShow() {
  const st = TOUR.steps[TOUR.i];
  if (st.prep) st.prep();
  if (st.v && VIEW !== st.v) go(st.v); else if (st.prep && st.v === 'build') renderBuild();
  const { box } = TOUR.els;
  box.innerHTML = `<h3>${esc(st.title)}</h3><p>${esc(st.text)}</p><div class="tb"><span class="cnt">${TOUR.i + 1} van ${TOUR.steps.length}</span>
    ${TOUR.i ? '<button class="btn small ghost" data-b>← Terug</button>' : '<button class="btn small ghost" data-s>Overslaan</button>'}
    <button class="btn small primary" data-n>${TOUR.i === TOUR.steps.length - 1 ? 'Klaar ✓' : 'Volgende →'}</button></div>`;
  $('[data-n]', box).onclick = () => { if (TOUR.i >= TOUR.steps.length - 1) endTour(); else { TOUR.i++; tourShow(); } };
  if ($('[data-b]', box)) $('[data-b]', box).onclick = () => { TOUR.i--; tourShow(); };
  if ($('[data-s]', box)) $('[data-s]', box).onclick = endTour;
  const t = st.sel ? $(st.sel) : null;
  if (t) { t.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' }); }
  setTimeout(tourPlace, 60); setTimeout(tourPlace, 400);
}
function tourPlace() {
  if (!TOUR) return;
  const st = TOUR.steps[TOUR.i]; const { hole, box } = TOUR.els;
  const t = st.sel ? $(st.sel) : null;
  const vh = window.innerHeight;
  if (!t || !t.getClientRects().length) { hole.className = 'tour-hole none'; box.style.top = Math.max(20, vh / 2 - box.offsetHeight / 2) + 'px'; box.style.bottom = ''; return; }
  const r = t.getBoundingClientRect(); const pad = 6;
  hole.className = 'tour-hole';
  Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
  const bh = box.offsetHeight;
  if (r.bottom + pad + 14 + bh < vh - 10) box.style.top = r.bottom + pad + 14 + 'px';
  else if (r.top - pad - 14 - bh > 10) box.style.top = r.top - pad - 14 - bh + 'px';
  else box.style.top = Math.max(10, vh - bh - 16) + 'px';
}
function endTour() {
  if (!TOUR) return;
  Object.values(TOUR.els).forEach((e) => e.remove());
  window.removeEventListener('resize', tourPlace);
  TOUR = null; D.toured = true; save();
  go('sets');
}
$('#helpBtn').onclick = openHelp;
function openHelp() {
  const sh = sheet(`<h2>Hulp nodig?</h2>
    <p>Kies wat je wilt doen.</p>
    <div class="help-choices">
      <button class="btn primary wide" data-h="tour">? Leg uit: rondleiding door de app</button>
      ${isInstalled() ? '' : '<button class="btn ghost wide" data-h="inst">📲 App op je beginscherm zetten</button>'}
      <button class="btn ghost wide" data-h="fb">✉ Feedback / wens doorgeven</button>
    </div>
    <div class="foot"><button class="btn ghost" data-close>Sluiten</button></div>`, { cls: 'help-sheet' });
  $('[data-h=tour]', sh).onclick = () => { sh.close(); startTour(); };
  $('[data-h=fb]', sh).onclick = () => { sh.close(); openFeedback(); };
  if ($('[data-h=inst]', sh)) $('[data-h=inst]', sh).onclick = () => { sh.close(); openInstall(); };
}

/* ================= FEEDBACK ================= */
const FB_TYPES = [['fout', '🐞 Fout', 'Er gaat iets mis'], ['wens', '✨ Wens', 'Dit zou ik graag willen'], ['vraag', '❓ Vraag', 'Hoe werkt dit?']];
const FB_SCREENS = ['Algemeen / weet ik niet', 'Mijn sets', 'Set maken', 'Houdingen', 'Les geven', 'Bekijken', 'Printen', 'Muziek', 'Foto van papier', 'Instellingen', 'Leg uit / rondleiding'];
const VIEW_SCREEN = { sets: 'Mijn sets', build: 'Set maken', lib: 'Houdingen', settings: 'Instellingen' };
function deviceInfo() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'onbekend';
  const osv = (ua.match(/OS (\d+[_.]\d+)/) || ua.match(/Android (\d+(\.\d+)?)/) || [])[1];
  const br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `${os}${osv ? ' ' + osv.replace('_', '.') : ''} · ${br} · scherm ${screen.width}×${screen.height} · ${standalone ? 'geïnstalleerde app' : location.protocol === 'file:' ? 'offline bestand' : 'in de browser'} · ${navigator.language || ''}`;
}
function openFeedback(pre = {}) {
  const st = D.settings; const dr = Object.assign({ type: 'wens', msg: '', screen: '', set: '' }, D.fbDraft || {}, pre);
  if (!dr.screen) dr.screen = VIEW_SCREEN[VIEW] || FB_SCREENS[0];
  if (!dr.set && VIEW === 'build' && curSet()) dr.set = curSet().id;
  const sets = D.sets.slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  const sh = sheet(`<h2>Feedback of wens doorgeven</h2>
    <p class="muted" style="margin-top:0">Je bericht gaat via je eigen mail-app naar <b>${esc(st.feedbackEmail || 'nog geen adres ingesteld')}</b>. Je ziet het eerst, en verstuurt het zelf.</p>
    <div class="field"><span>Wat wil je doorgeven?</span><div class="fb-types">${FB_TYPES.map(([k, l, d]) => `<button class="fb-type ${dr.type === k ? 'on' : ''}" data-ft="${k}"><b>${l}</b><small>${d}</small></button>`).join('')}</div></div>
    <label class="field"><span>Je bericht</span><textarea class="input" id="fbMsg" rows="5" placeholder="Bijvoorbeeld: bij het printen staat de tijd niet goed. Of: ik zou graag eigen foto's bij een houding willen.">${esc(dr.msg)}</textarea></label>
    <label class="field"><span>Over welk scherm? <i class="muted">(mag leeg)</i></span><select class="input" id="fbScreen">${FB_SCREENS.map((x) => `<option ${x === dr.screen ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
    <label class="field"><span>Over welke set? <i class="muted">(mag leeg)</i></span><select class="input" id="fbSet"><option value="">Geen bepaalde set</option>${sets.map((x) => `<option value="${x.id}" ${x.id === dr.set ? 'selected' : ''}>${esc(x.title || 'Naamloze set')}</option>`).join('')}</select></label>
    <p class="muted fb-auto">Wordt automatisch toegevoegd: versie ${APP_VERSION} · ${esc(deviceInfo())}</p>
    <div class="fb-actions"><button class="btn primary wide" id="fbMail">✉ Open in mijn mail-app</button><button class="btn ghost wide" id="fbCopy">Kopieer tekst</button></div>
    <p class="muted" style="font-size:13.5px;margin:8px 0 0">Gebeurt er niets na “Open in mijn mail-app”? Tik dan op “Kopieer tekst” en plak het in een mail of appje.</p>
    <div class="foot"><button class="btn ghost" data-close>Sluiten</button></div>`, { cls: 'fb-sheet' });
  const keep = () => { D.fbDraft = { type: dr.type, msg: $('#fbMsg', sh).value, screen: $('#fbScreen', sh).value, set: $('#fbSet', sh).value }; save(); };
  $$('[data-ft]', sh).forEach((b) => b.onclick = () => { dr.type = b.dataset.ft; $$('[data-ft]', sh).forEach((x) => x.classList.toggle('on', x === b)); keep(); });
  ['#fbMsg', '#fbScreen', '#fbSet'].forEach((id) => $(id, sh).addEventListener('input', keep));
  const compose = () => {
    const msg = $('#fbMsg', sh).value.trim();
    const setO = D.sets.find((x) => x.id === $('#fbSet', sh).value);
    const type = FB_TYPES.find((t) => t[0] === dr.type);
    const body = [`Soort: ${type[1].replace(/^\S+\s/, '')}`, '', msg, '', '—', `Scherm: ${$('#fbScreen', sh).value}`, setO ? `Set: ${setO.title || 'Naamloze set'} (${setO.items.length} kaarten)` : 'Set: geen bepaalde set',
      `Van: ${st.teacher || ''}${st.studio ? ' · ' + st.studio : ''}`, `App: Yoga Set Maker ${APP_VERSION}`, `Toestel: ${deviceInfo()}`, `Datum: ${new Date().toLocaleString('nl-NL')}`].join('\n');
    return { msg, subject: 'Yoga Set Maker feedback', body };
  };
  $('#fbMail', sh).onclick = () => {
    const c = compose(); if (!c.msg) { toast('Schrijf eerst kort je bericht'); $('#fbMsg', sh).focus(); return; }
    const to = (st.feedbackEmail || '').trim();
    if (!to) { toast('Vul eerst bij Instellingen een e-mailadres in, of kopieer de tekst'); return; }
    const url = `mailto:${encodeURIComponent(to).replace('%40', '@')}?subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(c.body.replace(/\n/g, '\r\n'))}`;
    D.fbLast = Date.now(); save();
    window.__lastMailto = url; window.location.href = url;
    setTimeout(() => toast('Je mail-app gaat open. Vergeet niet op versturen te tikken.', { label: 'Bericht wissen', fn: () => { D.fbDraft = null; save(); } }), 600);
  };
  $('#fbCopy', sh).onclick = async () => {
    const c = compose(); if (!c.msg) { toast('Schrijf eerst kort je bericht'); $('#fbMsg', sh).focus(); return; }
    const txt = `Aan: ${st.feedbackEmail || ''}\nOnderwerp: ${c.subject}\n\n${c.body}`;
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {
      const ta = el('<textarea style="position:fixed;top:0;left:0;opacity:0"></textarea>'); ta.value = txt; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length);
      try { ok = document.execCommand('copy'); } catch (e2) {} ta.remove();
    }
    if (ok) toast('Tekst gekopieerd. Plak hem in een mail of appje' + (st.feedbackEmail ? ' aan ' + st.feedbackEmail : ''));
    else sheet(`<h2>Kopieer deze tekst</h2><p class="muted">Houd je vinger op de tekst en kies “Alles selecteren” en “Kopieer”.</p><textarea class="input" rows="10" readonly>${esc(txt)}</textarea><div class="foot"><button class="btn primary" data-close>Klaar</button></div>`);
  };
}

/* ================= START ================= */
function welcome() {
  const name = D.settings.teacher;
  const sh = sheet(`<div class="fig-big" style="background:var(--sand-l)">${window.Figure.svg(GEO.vrksasana, { colors: { halo: 'var(--sand-l)' } })}</div>
    <h2 style="margin-top:12px">Welkom${name ? ', ' + esc(name) : ''}! 🌿</h2>
    <p>Met deze app maak je snel en makkelijk je yogasets. Alles werkt ook zonder internet en blijft op je eigen telefoon.</p>
    <p>Wil je een korte rondleiding? Het duurt maar twee minuutjes. Je kunt hem later altijd opnieuw starten met de knop <b>“Leg uit”</b> rechtsboven.</p>
    ${isInstalled() || location.protocol === 'file:' ? '' : '<div class="install-row"><button class="btn ghost wide" data-install data-close>📲 App op je beginscherm zetten</button></div>'}
    <div class="foot"><button class="btn ghost" data-later>Later</button><button class="btn primary" data-go>Ja, leg uit</button></div>`);
  $('[data-go]', sh).onclick = () => { sh.close(); startTour(); };
  $('[data-later]', sh).onclick = () => { sh.close(); D.toured = true; save(); };
  if ($('[data-install]', sh)) $('[data-install]', sh).addEventListener('click', () => { D.toured = true; save(); });
}
applyTheme();
go(D.current && curSet() && location.hash === '#build' ? 'build' : 'sets');
if (!D.toured) setTimeout(welcome, 400);
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) showUpdateBar(); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
}
function showUpdateBar() {
  if ($('#updBar')) return;
  const b = el(`<div id="updBar" class="upd-bar" role="status"><span>✨ Er is een nieuwe versie van de app.</span><button class="btn small">Vernieuwen</button></div>`);
  $('button', b).onclick = () => { saveNow(); location.reload(); };
  document.body.appendChild(b);
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist().catch(() => {}); });
window.YSM = { D: () => D, openInstall, showInstallSteps, platform, isInstalled, go, startTour, openFeedback, openHelp, showUpdateBar, poseSheet: (id) => poseSheet(YOGA.POSES.find((p) => p.id === id)), startClass: (id) => startClass(D.sets.find((s) => s.id === id) || curSet()), openPreview: (id) => openPreview(D.sets.find((s) => s.id === id) || curSet()), doPrint: (id, m) => doPrint(D.sets.find((s) => s.id === id) || curSet(), m), openSet, version: APP_VERSION };
})();
