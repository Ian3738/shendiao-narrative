/* ==========================================================
   《神鵰俠侶》呈現層引擎 v2 —— 直排

   與 v1 的差別：
   ・文字直排、由右至左
   ・逐段替換，不累積捲動
   ・回目卡、分段進度條、名錄（人物＋數值）
   ・氛圍粒子取代滿版插圖
   ・無音訊
   ・單一存檔，不可回頭
   ========================================================== */

(() => {
'use strict';

const $ = (s) => document.querySelector(s);
const SAVE = 'shendiao.v2';

// 全十六回，已全部完成。
const BOOK = [
  { n: '第 一 回', t: '破窯', key: 'ch01' },   { n: '第 二 回', t: '桃花島', key: 'ch02' },
  { n: '第 三 回', t: '終南山', key: 'ch03' }, { n: '第 四 回', t: '古墓', key: 'ch04' },
  { n: '第 五 回', t: '出墓', key: 'ch05' },      { n: '第 六 回', t: '江湖', key: 'ch06' },
  { n: '第 七 回', t: '大勝關', key: 'ch07' },    { n: '第 八 回', t: '絕情谷', key: 'ch08' },
  { n: '第 九 回', t: '斷臂', key: 'ch09' },      { n: '第 十 回', t: '劍塚', key: 'ch10' },
  { n: '第十一回', t: '襄陽', key: 'ch11' },      { n: '第十二回', t: '斷腸崖', key: 'ch12' },
  { n: '第十三回', t: '神鵰俠', key: 'ch13' },    { n: '第十四回', t: '風陵渡', key: 'ch14' },
  { n: '第十五回', t: '谷底', key: 'ch15' },      { n: '第十六回', t: '襄陽城', key: 'ch16' },
];

// 名錄裡的人物。未登場的顯示為灰。
const CAST = ['楊過', '孫婆婆', '小龍女', '郭靖', '黃蓉', '郭芙', '李莫愁', '程英', '陸無雙', '郭襄'];

const PREFACE = [
  { s: '本作只有一個存檔。' },
  { s: '它會自動覆寫，無法回頭。' },
  { s: '選擇之前，請想清楚。', warn: true },
  { s: '想不清楚也無妨——想不清楚也是這個故事的一部分。', warn: true },
  { s: '然後，不要回頭。' },
];

// 跨回帶入的數值
const CARRY = ['qingyi', 'xiaming'];

const state = {
  ch: 0,              // 目前回（0-based）
  story: null,
  queue: [],
  met: new Set(['楊過']),
  por: null,        // 目前顯示的立繪
  emo: null,        // 下一句對白的表情覆寫（# emo: 標籤）
  fx: 'dust',
};

// ---------- 分類 ----------
// 說話者可帶括號附註，例如「楊過（嘴裡有餅）：路過的。」
const SPEAKER = /^([一-鿿]{2,5})(（[^）]{1,10}）)?：([\s\S]*)$/;
const SYS = /^〔[\s\S]*〕$/;
// 設計註記：正式遊玩不顯示
const NOTE = /測試|暗數值|設計|本章要|本作的|依 核心設計|保留給|不可達|垂直切片|驗證/;

function classify(raw) {
  const t = raw.trim();
  if (!t) return null;
  if (SYS.test(t)) return NOTE.test(t) ? null : { kind: 'sys', text: t };
  const m = t.match(SPEAKER);
  if (m) {
    state.met.add(m[1]);
    return { kind: 'say', who: m[1], aside: m[2] || '', text: m[3] };
  }
  return { kind: 'p', text: t };
}

// ---------- 立繪 ----------
// 由說話者的名字自動對應，不必在 ink 裡逐句下標籤。
// 楊過在故事裡橫跨三十幾年，依回數換立繪。
function portraitFor(who) {
  if (who === '楊過') {
    if (state.ch <= 2) return '楊過_少年';   // 一～三回
    if (state.ch <= 8) return '楊過_青年';   // 四～九回（斷臂發生在第九回中段，該處用 # emo 切）
    return '楊過_斷臂';                       // 第十回之後
  }
  if (who === '神鵰俠') return '楊過_斷臂';
  return who;
}

function showPortrait(who) {
  const el = $('#por');
  // # emo: 標籤可指定這一句要用哪張表情，用完即丟
  const name = state.emo || portraitFor(who);
  state.emo = null;
  if (state.por === name) return;            // 同一個人不重載
  const url = encodeURI(`portrait/${name}.png`);
  const img = new Image();
  img.onload = () => { el.src = url; el.classList.add('on'); state.por = name; };
  img.onerror = () => { el.classList.remove('on'); state.por = null; };  // 沒有立繪的配角
  img.src = url;
}

function clearPortrait() {
  $('#por').classList.remove('on');
  state.por = null;
  state.emo = null;
}

// ---------- 渲染：逐段替換 ----------
// 旁白走右側直排，對白走下方橫向對話框。兩者互斥。
function render(item) {
  const row = $('#dlg-row');
  const box = $('#text');

  if (item.kind === 'say') {
    box.innerHTML = '';
    showPortrait(item.who);
    $('#dlg-name').textContent = item.who + (item.aside || '');
    $('#dlg-text').textContent = item.text.replace(/^[「『]|[」』]$/g, '');
    row.classList.remove('hidden');
    requestAnimationFrame(() => row.classList.add('on'));
    return;
  }

  row.classList.remove('on');
  row.classList.add('hidden');

  box.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'para' + (item.kind === 'sys' ? ' sys' : '');
  p.textContent = item.text;
  box.appendChild(p);
}

// ---------- 標籤 ----------
function applyTags(tags) {
  for (const raw of tags || []) {
    const [k, v] = raw.split(':').map((s) => s.trim());
    if (k === 'bg')    { setBg(v); clearPortrait(); }   // 換景就收立繪
    if (k === 'fx')    state.fx = v;
    if (k === 'emo')   state.emo = v;
    if (k === 'clear') $('#text').innerHTML = '';
  }
}

function setBg(name) {
  const el = $('#bg');
  if (!name || name === 'none') { el.classList.remove('on'); return; }
  const url = encodeURI(`art/${name}.png`);
  const img = new Image();
  img.onload = () => { el.style.backgroundImage = `url("${url}")`; el.classList.add('on'); };
  img.onerror = () => el.classList.remove('on');
  img.src = url;
}

// ---------- 推進 ----------
function pull() {
  const s = state.story;
  const q = [];
  while (s.canContinue) {
    const raw = s.Continue();
    applyTags(s.currentTags);
    const it = classify(raw);
    if (it) q.push(it);
  }
  state.queue = q;
  step();
}

function step() {
  if (state.queue.length) {
    render(state.queue.shift());
    $('#next').classList.toggle('on', state.queue.length > 0 || state.story.currentChoices.length === 0);
    if (!state.queue.length && state.story.currentChoices.length) {
      setTimeout(showChoices, 700);
    }
    save();
    return;
  }
  if (state.story.currentChoices.length) { showChoices(); return; }
  endChapter();
}

function showChoices() {
  const box = $('#choices');
  box.innerHTML = '';
  $('#next').classList.remove('on');
  state.story.currentChoices.forEach((c, i) => {
    const b = document.createElement('button');
    b.textContent = c.text;
    b.style.animationDelay = (i * 90) + 'ms';
    b.onclick = (e) => {
      e.stopPropagation();
      box.classList.remove('on');
      box.innerHTML = '';
      state.story.ChooseChoiceIndex(c.index);
      pull();
    };
    box.appendChild(b);
  });
  box.classList.add('on');
}

// ---------- 回目 ----------
function chapterCard(i, done) {
  const card = $('#chapter-card');
  card.querySelector('.cc-num').textContent = BOOK[i].n;
  card.querySelector('.cc-title').textContent = BOOK[i].t;
  card.classList.remove('hidden');
  drawProgress();
  setTimeout(() => {
    card.classList.add('hidden');
    done();
  }, 2800);
}

function drawProgress() {
  const bar = $('#progress');
  bar.innerHTML = '';
  BOOK.forEach((_, i) => {
    const seg = document.createElement('i');
    if (i < state.ch) seg.className = 'done';
    if (i === state.ch) seg.className = 'now';
    bar.appendChild(seg);
  });
}

function readCarry(s) {
  const o = {};
  for (const k of CARRY) { try { const v = s.variablesState[k]; if (v != null) o[k] = v; } catch (_) {} }
  return o;
}
function writeCarry(s, v) {
  for (const [k, x] of Object.entries(v || {})) {
    try { if (s.variablesState[k] !== undefined) s.variablesState[k] = x; } catch (_) {}
  }
}

function endChapter() {
  $('#next').classList.remove('on');
  const carry = readCarry(state.story);
  const next = state.ch + 1;

  if (next < BOOK.length && BOOK[next].key) {
    state.ch = next;
    state.story = new inkjs.Story(window.STORY[BOOK[next].key]);
    writeCarry(state.story, carry);
    $('#text').innerHTML = '';
    clearPortrait();
    $('#dlg-row').classList.add('hidden');
    save();
    chapterCard(next, pull);
    return;
  }

  // 尚未寫到的回：停在這裡
  const box = $('#choices');
  box.innerHTML = '';
  const b = document.createElement('button');
  b.textContent = '（已寫到此　回到卷首）';
  b.onclick = () => { localStorage.removeItem(SAVE); location.reload(); };
  box.appendChild(b);
  box.classList.add('on');
}

// ---------- 名錄 ----------
function openRoster() {
  const cast = $('#cast');
  cast.innerHTML = '';
  CAST.forEach((n) => {
    const p = document.createElement('p');
    p.textContent = state.met.has(n) ? n : '？';
    if (!state.met.has(n)) p.className = 'unmet';
    cast.appendChild(p);
  });
  const v = (k) => { try { const x = state.story.variablesState[k]; return x == null ? 0 : x; } catch (_) { return 0; } };
  $('#s-qing').textContent = v('qingyi');
  $('#s-xia').textContent  = v('xiaming');
  $('#s-suxin').textContent = v('suxin') ? '已成' : '—';
  $('#roster').classList.remove('hidden');
}

// ---------- 粒子 ----------
function initFx() {
  const cv = $('#fx'), ctx = cv.getContext('2d');
  let w = 0, h = 0, parts = [];
  const resize = () => {
    w = cv.width = innerWidth * devicePixelRatio;
    h = cv.height = innerHeight * devicePixelRatio;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const n = Math.round((innerWidth * innerHeight) / 26000);
    parts = Array.from({ length: n }, () => spawn());
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawn() {
    return { x: rnd(0, w), y: rnd(0, h), r: rnd(.6, 2.1) * devicePixelRatio,
             vy: rnd(.12, .55) * devicePixelRatio, vx: rnd(-.14, .1) * devicePixelRatio,
             a: rnd(.12, .5), t: rnd(0, 6.28) };
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    const snow = state.fx === 'snow';
    for (const p of parts) {
      p.t += .012;
      p.y += p.vy * (snow ? 2.1 : 1);
      p.x += p.vx + Math.sin(p.t) * (snow ? .5 : .18) * devicePixelRatio;
      if (p.y > h + 8) { p.y = -8; p.x = rnd(0, w); }
      if (p.x < -8) p.x = w + 8; if (p.x > w + 8) p.x = -8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, snow ? p.r * 1.5 : p.r, 0, 6.283);
      ctx.fillStyle = `rgba(232,224,208,${p.a * (snow ? 1 : .62)})`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  addEventListener('resize', resize);
  resize(); tick();
}

// ---------- 存檔：單一，自動覆寫，不可回頭 ----------
function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify({
      ch: state.ch, met: [...state.met],
      json: state.story.state.toJson(),
    }));
  } catch (_) {}
}

// ---------- 啟動 ----------
// 讀檔必須先還原回數。
// 之前這裡漏了 state.ch，於是永遠拿第一回的劇本去載入別回的存檔——
// 不會拋錯，但故事接不下去，畫面就卡住。玩過的人再進來就進不去。
function begin(loaded) {
  if (loaded) {
    const i = Number(loaded.ch);
    if (!Number.isInteger(i) || i < 0 || i >= BOOK.length || !BOOK[i].key) {
      return begin(null);           // 存檔壞了就重新開始，不要卡住
    }
    state.ch = i;
  }

  const key = BOOK[state.ch].key;
  state.story = new inkjs.Story(window.STORY[key]);

  if (loaded) {
    try {
      state.story.state.LoadJson(loaded.json);
      state.met = new Set(loaded.met || ['楊過']);
      // 載進來卻無話可說也無選項＝壞檔，退回重新開始
      if (!state.story.canContinue && state.story.currentChoices.length === 0) {
        throw new Error('empty state');
      }
    } catch (_) {
      localStorage.removeItem(SAVE);
      state.ch = 0;
      state.met = new Set(['楊過']);
      state.story = new inkjs.Story(window.STORY[BOOK[0].key]);
    }
  }

  $('#preface').classList.add('hidden');
  $('#title-screen').classList.add('hidden');
  chapterCard(state.ch, pull);
}

function boot() {
  if (typeof inkjs === 'undefined' || !window.STORY) {
    document.body.innerHTML = '<p style="padding:3rem;color:#ccc;font:15px serif">載入失敗：找不到 ink.js 或 story.js。</p>';
    return;
  }
  initFx();
  drawProgress();

  const cols = $('#preface-cols');
  PREFACE.forEach((line, i) => {
    const p = document.createElement('p');
    p.textContent = line.s;
    if (line.warn) p.className = 'warn';
    p.style.animationDelay = (i * 260) + 'ms';
    cols.appendChild(p);
  });

  // 開發用：?hui=12 直接跳到第十二回（數值用該回的入回預設值）。正式版移除。
  const jump = parseInt(new URLSearchParams(location.search).get('hui'), 10);
  if (jump >= 1 && jump <= BOOK.length && BOOK[jump - 1].key) {
    state.ch = jump - 1;
    setTimeout(() => begin(null), 0);
    return;
  }

  const saved = (() => { try { return JSON.parse(localStorage.getItem(SAVE)); } catch (_) { return null; } })();
  const fresh = () => {
    localStorage.removeItem(SAVE);
    state.ch = 0;
    state.met = new Set(['楊過']);
    $('#title-screen').classList.add('hidden');
    $('#preface').classList.remove('hidden');
  };

  if (saved) {
    $('#btn-start').textContent = '續　卷';
    // 脫困出口：存檔壞掉的時候，使用者要有辦法自己重來
    $('#btn-fresh').classList.remove('hidden');
  }

  $('#btn-start').onclick = () => {
    if (saved) { begin(saved); return; }
    fresh();
  };
  $('#btn-fresh').onclick = fresh;
  $('#btn-open').onclick = () => begin(null);
  $('#btn-roster').onclick = (e) => { e.stopPropagation(); openRoster(); };
  $('#btn-back').onclick = (e) => { e.stopPropagation(); $('#roster').classList.add('hidden'); };

  const advance = (e) => {
    if (e.target.closest && (e.target.closest('#choices') || e.target.closest('#hud')
        || e.target.closest('.overlay'))) return;
    if (!state.story) return;
    if (!$('#roster').classList.contains('hidden')) return;
    if ($('#choices').classList.contains('on')) return;
    step();
  };
  document.addEventListener('click', advance);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowLeft') { e.preventDefault(); advance(e); }
  });
}

document.addEventListener('DOMContentLoaded', boot);
})();
