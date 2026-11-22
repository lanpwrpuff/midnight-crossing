// Screens, controls, options and saving for The Midnight Crossing.
(function () {
  'use strict';
  const MC = window.MC;
  const D = MC.DATA;
  const PLACES = MC.PLACES;
  const hourLabel = MC.hourLabel;

  const SAVE_KEY = 'midnight-crossing-save-v2';
  const OPT_KEY = 'midnight-crossing-options-v1';
  const ACTION_MIN = 30;
  const DIFFS = {
    cozy: { label: 'Cozy', offset: 0, leads: 18, highlight: true,
      desc: 'Time to follow every lead. Contradictions are highlighted. Puzzles have no time limit, and everyone shows their shoes.' },
    standard: { label: 'Standard', offset: 30, leads: 15, highlight: true,
      desc: 'Time for most leads, not all. Contradictions are highlighted. Puzzles are timed: fail one and lose 30 minutes.' },
    dread: { label: 'Dread', offset: 120, leads: 11, highlight: false,
      desc: 'Only 11 leads. No highlights, fewer witnesses, short puzzle timers, and some guests refuse to show their shoes.' },
    // Earned at Inspector rank. The mystery itself is a Dread case (gen), so it is checked by the same fairness rules.
    nightmare: { label: 'Nightmare', offset: 150, leads: 10, highlight: false, gen: 'dread', rank: 'Inspector',
      desc: 'A Dread case with only 10 leads, even shorter puzzle timers, and a notebook that asks no questions.' },
  };
  const genDiff = (d) => (DIFFS[d] && DIFFS[d].gen) || d;
  // Seconds allowed for each puzzle. Cozy has no entry: no time limit and nothing to lose.
  const TIMERS = {
    standard: { drawer: 150, letter: 90, cipher: 75 },
    dread: { drawer: 90, letter: 60, cipher: 45 },
    nightmare: { drawer: 70, letter: 45, cipher: 35 },
  };
  const PUZZLE_IDS = ['drawer', 'letter', 'cipher'];
  const ERAS = { old: { label: 'Old-fashioned', code: 'O' }, modern: { label: 'Present day', code: 'N' } };
  const PALETTES = {
    moonlit: { label: 'Moonlit Frost', swatch: ['#0d1420', '#7fc4c4', '#c3cad3', '#f2e9b0'] },
    gaslight: { label: 'Gaslight Express', swatch: ['#4a1c1c', '#c9a46a', '#6b6866', '#efe6d2'] },
    seance: { label: 'Séance Lilac', swatch: ['#1a1620', '#9a86b0', '#c98b95', '#ece4d6'] },
    orchard: { label: 'Autumn Orchard', swatch: ['#3b2a1e', '#d9792b', '#56663a', '#e8b65a'] },
    // Earned through the career (see RANKS).
    candle: { label: 'Candle Wax', swatch: ['#15110c', '#f0a640', '#c4b294', '#ffd98a'] },
    bloodmoon: { label: 'Blood Moon', swatch: ['#140b0d', '#e0574f', '#c09a9a', '#ff9b7a'] },
    ink: { label: 'Ink and Bone', swatch: ['#0b0b0c', '#d8c08a', '#a9a59c', '#f2eee6'] },
  };
  const DEFAULT_OPTS = { place: 'random', era: 'random', palette: 'auto', sound: 'off', lastSound: 'low' };
  const SOUNDS = { off: { label: 'Off', v: 0 }, low: { label: 'Quiet', v: 0.35 }, high: { label: 'Normal', v: 0.75 } };
  const Atmo = MC.Atmo || { available: false, setLevel() {}, setPlace() {}, setDread() {}, chime() {}, discover() {} };

  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const wideQuery = window.matchMedia('(min-width: 1100px)');

  const S = {
    screen: 'title', titleMode: null, numError: '',
    c: null, diff: 'standard', done: [], solved: [], shoes: [], board: freshBoard(), bsel: null, bfrom: null, talk: {}, tmenu: null, tdawn: false, nbSec: 'suspects', nbOpen: false, objs: {}, reveal: 3, notes: [], noteUndo: null, tab: 'ship',
    draft: {}, dawn: false,
  };
  let lastScreen = null;

  // ---------- helpers ----------
  const place = () => PLACES[S.c.place];
  const room = (id) => S.c.rooms.find((r) => r.id === id);
  const person = (id) => S.c.people[id];
  const weaponById = (id) => S.c.weapons.find((w) => w.id === id);
  const slot = (i) => S.c.slots[i];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const pickRandom = (a) => a[Math.floor(Math.random() * a.length)];
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Same case + same action = same wording every time you re-read it.
  function phrasePicker(id) {
    const r = MC.makeRng((S.c.seed * 7919 + hashStr(S.c.place + id)) >>> 0);
    return (a) => a[Math.floor(r() * a.length)];
  }
  function clock(min) {
    min = ((min % 1440) + 1440) % 1440;
    const h = Math.floor(min / 60), m = min % 60;
    if (h === 0 && m === 0) return 'midnight';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  const startMin = () => S.c.foundMin + DIFFS[S.diff].offset;
  const totalLeads = () => DIFFS[S.diff].leads;
  const nowMin = () => startMin() + S.done.length * ACTION_MIN;
  const deadlineMin = () => startMin() + totalLeads() * ACTION_MIN;
  const leadsLeft = () => totalLeads() - S.done.length;
  const randomSeed = () => 1000 + Math.floor(Math.random() * 9000);
  const isWide = () => wideQuery.matches;
  const caseCode = (c) => PLACES[c.place].code + ERAS[c.era].code + '-' + c.seed;
  const dinnerRoomName = () => S.c.rooms[0].name;
  // "garden shears" needs "are/were/them" where other weapons take "is/was/it".
  const many = (w) => /s$/.test(w.name);

  // Fill in {name}, {region} etc. for the current case.
  function fmt(text) {
    const c = S.c;
    return text
      .split('{bare}').join(c.name.replace(/^the /i, ''))
      .split('{Name}').join(cap(c.name))
      .split('{name}').join(c.name)
      .split('{region}').join(c.region)
      .split('{dinner}').join(hourLabel(c.dinnerHour))
      .split('{dinnerRoom}').join(dinnerRoomName());
  }

  function initials(p) { return p.first[0] + p.last[0]; }
  // A guest's face. The initials stay underneath, so if a picture ever fails to load the circle still makes sense.
  const faceImg = (p, cls) => (p.portrait ? '<img class="' + (cls || 'face-img') + '" src="' + p.portrait + '" alt="" decoding="async" onerror="this.remove()">' : '');
  const avatar = (p, small) =>
    '<span class="avatar' + (small ? ' sm' : '') + (p.portrait ? ' face' : '') + '" style="--pc:' + p.color + '" aria-hidden="true">' + initials(p) + faceImg(p) + '</span>';
  // Hand-drawn icons (art/icons). They take the colour of the text around them.
  const ico = (name) => '<span class="ico ico-' + name + '" aria-hidden="true"></span>';
  // Painted weapons (art/weapons/<place>-<name>.jpg). Some weapons look different in the present day.
  const WEAPON_ART = new Set(['ship-candlestick', 'ship-knife', 'ship-cord', 'ship-boathook', 'ship-wrench', 'ship-sextant', 'ship-rope',
    'train-cakeknife', 'train-pan', 'train-cord', 'train-lamp', 'train-hatpin', 'train-opener', 'train-strap', 'train-shovel', 'train-extinguisher',
    'plane-bottle', 'plane-knife', 'plane-lamp', 'plane-flashlight', 'plane-blindcord', 'plane-opener', 'plane-soapdish', 'plane-strap',
    'manor-fork', 'manor-rollingpin', 'manor-bellcord', 'manor-shears', 'manor-candelabra']);
  const WEAPON_LOOK = { 'plane-flashlight-old': 'plane-lamp', 'train-hatpin-modern': 'train-opener', 'train-shovel-modern': 'train-extinguisher' };
  function weaponArt(w) {
    const k = S.c.place + '-' + w.id;
    const f = WEAPON_LOOK[k + '-' + S.c.era] || k;
    return WEAPON_ART.has(f) ? 'art/weapons/' + f + '.jpg' : '';
  }
  const weaponImg = (w, cls) => { const src = weaponArt(w); return src ? '<img class="' + (cls || 'wpn-img') + '" src="' + src + '" alt="" decoding="async" onerror="this.remove()">' : ''; };
  // Small painted pictures on evidence cards (art/clues).
  const CLUE_ART = { item: 'magnifying-glass', proof: 'folded-ticket', motive: 'wax-envelope', puzzle: 'skeleton-key' };

  // ---------- guest portraits ----------
  // 16 painted faces per era, numbered by how well-off they look: [wealth 1-3, f / m / n (could be anyone)].
  // Each guest gets a face that fits their wealth and name, dealt out the same way every time for a given case.
  const PORTRAITS = {
    old: { 1: [1, 'f'], 2: [1, 'm'], 3: [1, 'f'], 4: [1, 'm'], 5: [2, 'f'], 6: [2, 'm'], 7: [2, 'f'], 8: [2, 'm'],
      9: [2, 'n'], 10: [2, 'm'], 11: [3, 'f'], 12: [3, 'f'], 13: [3, 'm'], 14: [3, 'm'], 15: [3, 'f'], 16: [1, 'n'] },
    modern: { 1: [1, 'f'], 2: [1, 'm'], 3: [1, 'n'], 4: [1, 'f'], 5: [1, 'm'], 6: [1, 'f'], 7: [2, 'm'], 8: [2, 'f'],
      9: [2, 'm'], 10: [2, 'f'], 11: [2, 'n'], 12: [2, 'm'], 13: [3, 'm'], 14: [3, 'f'], 15: [3, 'f'], 16: [3, 'm'] },
  };
  // Present-day first names carry no gender in the data, so the faces use this.
  const MODERN_G = { Maya: 'f', Jordan: 'n', Priya: 'f', Leo: 'm', Sam: 'n', Aiden: 'm', Zara: 'f', Mateo: 'm', Chloe: 'f', Riley: 'n',
    Theo: 'm', Noor: 'f', Kai: 'n', Ines: 'f', Marcus: 'm', Hana: 'f', Dev: 'm', Ruby: 'f', Sasha: 'n', Omar: 'm', Freya: 'f', Quinn: 'n', Luca: 'm', Tamsin: 'f' };
  function assignPortraits(c) {
    const pool = PORTRAITS[c.era];
    const nums = Object.keys(pool).map(Number);
    const rng = MC.makeRng((c.seed * 613 + hashStr(c.place + c.era + 'faces')) >>> 0);
    const used = new Set();
    Object.keys(c.people).sort().forEach((pid) => {
      const p = c.people[pid];
      const old = MC.PEOPLE.firstNames.old.find((f) => f.n === p.first);
      const g = c.era === 'old' ? (old ? old.g : 'n') : (MODERN_G[p.first] || 'n');
      const fits = (n, wealth, gender) => !used.has(n) && (!wealth || pool[n][0] === p.wealth) &&
        (!gender || g === 'n' || pool[n][1] === 'n' || pool[n][1] === g);
      let cand = nums.filter((n) => fits(n, true, true));
      if (!cand.length) cand = nums.filter((n) => fits(n, false, true));
      if (!cand.length) cand = nums.filter((n) => fits(n, false, false));
      const n = cand[Math.floor(rng() * cand.length)];
      used.add(n);
      p.portrait = 'art/portraits/' + c.era + '-' + String(n).padStart(2, '0') + '.jpg';
    });
    return c;
  }
  const fill = (tpl, s, v) => tpl.split('{s}').join(person(s).name).split('{v}').join(person(v).name);
  const nameList = (ids) => {
    const n = ids.map((id) => person(id).name);
    return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  };
  const watchTime = () => clock((S.c.dinnerHour + S.c.T) * 60 + S.c.watchMinute);
  const slotTime = (s, minute) => clock((S.c.dinnerHour + s) * 60 + minute);
  // A locked phone opens once you have searched the room where its code is hidden.
  const phoneOpen = (pid) => { const b = S.c.belongings[pid]; return !b.locked || seen(b.codeRoom, 'code'); };
  const evidenceVisible = (pid, e) => !e.inPhone || phoneOpen(pid);
  const endOfSlot = (s) => (s === 3 ? hourLabel(S.c.dinnerHour + 4) : slot(s + 1));

  // ---------- options ----------
  function loadOpts() {
    try {
      const v = JSON.parse(localStorage.getItem(OPT_KEY));
      if (v && typeof v === 'object') {
        return {
          place: v.place === 'random' || PLACES[v.place] ? v.place : 'random',
          era: v.era === 'random' || ERAS[v.era] ? v.era : 'random',
          palette: v.palette === 'auto' || PALETTES[v.palette] ? v.palette : 'auto',
          sound: SOUNDS[v.sound] ? v.sound : 'off',
          lastSound: v.lastSound === 'high' ? 'high' : 'low',
        };
      }
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULT_OPTS);
  }
  function saveOpts(o) { try { localStorage.setItem(OPT_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } }
  let OPTS = loadOpts();

  // ---------- the detective's career ----------
  // Every case you close adds its score to a running total, which climbs a ladder of ranks.
  // Ranks unlock new colour themes and the Nightmare difficulty: things to look at and harder play, never help.
  // Only the FIRST time you close a given case code counts, so replaying a case you know earns nothing.
  // The career lives in this browser only (there are no accounts).
  const CAREER_KEY = 'midnight-crossing-career-v1';
  const RANKS = [
    { t: 'Constable', at: 0 },
    { t: 'Sergeant', at: 2500, unlock: { palette: 'candle' }, what: 'the Candle Wax colour theme' },
    { t: 'Inspector', at: 7500, unlock: { diff: 'nightmare' }, what: 'Nightmare difficulty' },
    { t: 'Chief Inspector', at: 16000, unlock: { palette: 'bloodmoon' }, what: 'the Blood Moon colour theme' },
    { t: 'Master Detective', at: 30000, unlock: { palette: 'ink' }, what: 'the Ink and Bone colour theme' },
  ];
  // [symbol, name, how to earn it]. Earned only on cases that count toward your career.
  const BADGES = {
    first: ['✦', 'First case closed', 'Close your first case.'],
    exact: ['✓', 'Never wrong', 'Name the killer, the weapon and the hour, all correctly, with at least three key discoveries.'],
    silver: ['❦', 'Silver tongue', 'Break the killer\'s alibi and get the red herring\'s confession in the same case.'],
    light: ['☽', 'Light touch', 'Break the killer\'s alibi and catch them with at least half your leads unused.'],
    stone: ['◈', 'No stone unturned', 'Solve all three puzzles in one case.'],
    hound: ['✧', 'Bloodhound', 'Catch the killer after matching the footprint to their own shoes.'],
    nightmare: ['✠', 'Nightmare survivor', 'Catch the killer on Nightmare.'],
  };
  const CODE_RE = /^[STPM][ON]-\d{4}$/;
  function cleanCareer(v) {
    const num = (x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
    v = v && typeof v === 'object' ? v : {};
    const badges = {};
    if (v.badges && typeof v.badges === 'object') Object.keys(BADGES).forEach((k) => { if (Number.isFinite(v.badges[k])) badges[k] = v.badges[k]; });
    const book = Array.isArray(v.book) ? v.book.filter((e) => e && typeof e === 'object' && CODE_RE.test(e.code) && DIFFS[e.diff]).map((e) => ({
      code: e.code, diff: e.diff, at: num(e.at), right: !!e.right, hits: Math.min(3, num(e.hits)), score: num(e.score),
      rank: typeof e.rank === 'string' ? e.rank.slice(0, 40) : '', counted: !!e.counted, killer: typeof e.killer === 'string' ? e.killer.slice(0, 60) : '',
      badges: Array.isArray(e.badges) ? e.badges.filter((b) => BADGES[b]) : [] })) : [];
    return {
      points: num(v.points), closed: num(v.closed), solved: num(v.solved), best: num(v.best), badges,
      codes: Array.isArray(v.codes) ? v.codes.filter((c, i, a) => typeof c === 'string' && CODE_RE.test(c) && a.indexOf(c) === i).slice(-5000) : [],
      book: book.slice(-100),
    };
  }
  function loadCareer() {
    try { return cleanCareer(JSON.parse(localStorage.getItem(CAREER_KEY))); } catch (e) { return cleanCareer(null); }
  }
  function saveCareer() { try { localStorage.setItem(CAREER_KEY, JSON.stringify(CAREER)); } catch (e) { /* ignore */ } }
  let CAREER = loadCareer();
  function rankIndex(points) { let i = 0; RANKS.forEach((r, k) => { if (points >= r.at) i = k; }); return i; }
  const rankFor = (kind, id) => RANKS.find((r) => r.unlock && r.unlock[kind] === id);
  // Something is locked only if a rank unlocks it and you have not reached that rank.
  const isLocked = (kind, id) => { const r = rankFor(kind, id); return !!r && CAREER.points < r.at; };

  function applyPalette() {
    let p = 'moonlit';
    if (OPTS.palette !== 'auto' && !isLocked('palette', OPTS.palette)) p = OPTS.palette;
    else if (S.c && S.screen !== 'title') p = place().palette;
    document.documentElement.setAttribute('data-palette', p);
  }

  // ---------- saving ----------
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: S.c.seed, place: S.c.place, era: S.c.era, diff: S.diff, done: S.done, solved: S.solved, shoes: S.shoes, board: S.board, talk: S.talk, objs: S.objs, notes: S.notes }));
    } catch (e) { /* storage blocked */ }
  }
  function loadSave() {
    try {
      const v = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (v && typeof v.seed === 'number' && PLACES[v.place] && ERAS[v.era] && DIFFS[v.diff] && Array.isArray(v.done)) return v;
    } catch (e) { /* ignore */ }
    return null;
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function startCase(seed, placeId, era, diff) {
    S.c = assignPortraits(MC.generateCase(seed, placeId, era, genDiff(diff)));
    S.diff = diff;
    S.done = [];
    S.solved = [];
    S.shoes = [];
    S.board = freshBoard();
    S.bsel = null; S.bfrom = null; boardScroll = null;
    S.talk = {}; S.tmenu = null;
    S.objs = {}; ROOM = null;
    S.notes = []; S.noteUndo = null;
    S.draft = {};
    S.dawn = false;
    S.tab = 'ship';
    S.screen = 'briefing';
    save();
    render();
  }
  const chosenPlace = () => (OPTS.place === 'random' ? pickRandom(Object.keys(PLACES)) : OPTS.place);
  const chosenEra = () => (OPTS.era === 'random' ? pickRandom(Object.keys(ERAS)) : OPTS.era);

  // "TN-4821", "tn4821" or just "4821" (then your options decide location and era).
  function parseCode(raw) {
    const v = raw.trim().toUpperCase().replace(/\s+/g, '');
    let m = /^([STPM])([ON])-?(\d{4})$/.exec(v);
    if (m) {
      const placeId = Object.keys(PLACES).find((k) => PLACES[k].code === m[1]);
      const era = m[2] === 'O' ? 'old' : 'modern';
      return { seed: Number(m[3]), place: placeId, era };
    }
    m = /^(\d{4})$/.exec(v);
    if (m && Number(m[1]) >= 1000) return { seed: Number(m[1]), place: chosenPlace(), era: chosenEra() };
    return null;
  }

  // ---------- art ----------
  const LANTERN =
    '<svg class="lantern" viewBox="0 0 64 64" aria-hidden="true">' +
    '<defs><radialGradient id="glow"><stop offset="0" stop-color="#ffd58a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient></defs>' +
    '<circle class="lantern-glow" cx="32" cy="32" r="30" fill="url(#glow)"/>' +
    '<path d="M32 7V3" stroke="#c9a46a" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M25 15h14l-2-7H27z" fill="#7a6442"/>' +
    '<rect x="22" y="15" width="20" height="30" rx="4" fill="rgba(255,200,120,.08)" stroke="#c9a46a" stroke-width="2.5"/>' +
    '<path class="flame" d="M32 23c3.5 4.5 4.5 8 0 13-4.5-5-3.5-8.5 0-13z" fill="#ffb347"/>' +
    '<rect x="20" y="45" width="24" height="5" rx="2" fill="#7a6442"/></svg>';

  // ---------- title ----------
  function optGroup(key, items) {
    return '<div class="choices">' + items.map((it) => {
      const on = OPTS[key] === it.v && !it.locked;
      return '<button class="choice' + (on ? ' selected' : '') + (it.locked ? ' locked' : '') + '" data-act="opt" data-k="' + key + '" data-v="' + it.v + '" aria-pressed="' + on + '"' +
        (it.locked ? ' disabled' : '') + '>' +
        (it.swatch ? '<span class="swatch">' + it.swatch.map((c) => '<i style="background:' + c + '"></i>').join('') + '</span>' : '') +
        '<span>' + esc(it.label) + (it.locked ? '<small>Reach ' + esc(it.locked) + ' to unlock</small>' : '') + '</span></button>';
    }).join('') + '</div>';
  }

  function viewTitle() {
    const sv = loadSave();
    let menu = '';
    if (S.titleMode === 'new' || S.titleMode === 'number') {
      const act = S.titleMode === 'new' ? 'new' : 'number-start';
      menu =
        (S.titleMode === 'number'
          ? '<label class="field"><span>Case code (like TN-4821) or a 4-digit number</span>' +
            '<input id="case-num" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="e.g. TN-4821"></label>' +
            (S.numError ? '<p class="error">' + esc(S.numError) + '</p>' : '')
          : '<p class="menu-label">' + esc(optSummary()) + ' <button class="linkish" data-act="title-mode" data-mode="options">Change</button></p>') +
        '<p class="menu-label">Choose a difficulty</p>' +
        Object.keys(DIFFS).map((k) => {
          const locked = isLocked('diff', k);
          return '<button class="btn diff-btn' + (locked ? ' locked' : '') + '" data-act="' + act + '" data-diff="' + k + '"' + (locked ? ' disabled' : '') + '>' +
            '<strong>' + DIFFS[k].label + (locked ? ' · reach ' + rankFor('diff', k).t + ' to unlock' : '') + '</strong><span>' + DIFFS[k].desc + '</span></button>';
        }).join('') +
        '<button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else if (S.titleMode === 'options') {
      menu =
        '<div class="panel opts">' +
        '<h3>Location</h3>' + optGroup('place', [{ v: 'random', label: 'Random' }].concat(Object.keys(PLACES).map((k) => ({ v: k, label: PLACES[k].label })))) +
        '<h3>Era</h3>' + optGroup('era', [{ v: 'random', label: 'Random' }].concat(Object.keys(ERAS).map((k) => ({ v: k, label: ERAS[k].label })))) +
        '<h3>Colours</h3>' + optGroup('palette', [{ v: 'auto', label: 'Match the location' }].concat(Object.keys(PALETTES).map((k) => ({
          v: k, label: PALETTES[k].label, swatch: PALETTES[k].swatch, locked: isLocked('palette', k) ? rankFor('palette', k).t : '' })))) +
        (Atmo.available ? '<h3>Sound</h3>' + optGroup('sound', Object.keys(SOUNDS).map((k) => ({ v: k, label: SOUNDS[k].label }))) +
          '<p class="hint">Quiet ambience for each place, and a clock that strikes the hours. You can also switch sound on and off from the ' + ico('sound-off') + ' button during a case.</p>' : '') +
        '<p class="hint">Random picks a new location or era for every case. Shared case codes always play the same, whatever your options.</p>' +
        '</div><button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else if (S.titleMode === 'how') {
      menu =
        '<div class="how panel">' +
        '<p>Someone has been murdered aboard a ship, a train or a plane, or at a lonely manor. You have until the journey ends, or the police arrive, to name the killer.</p>' +
        '<ul>' +
        '<li><strong>Search rooms</strong>, <strong>question guests</strong> and <strong>go through belongings</strong>. Each takes 30 minutes, so you cannot do everything.</li>' +
        '<li>Inside a room, tap the things around you to inspect them. Looking costs no extra time, but a clue only counts once you have found it. In a hurry? Use "Search everything".</li>' +
        '<li>Receipts, photos and tickets in someone\'s belongings prove where they really were. A stain shows a room they visited.</li>' +
        '<li>Locked phone? Its code is scribbled down in one of the rooms.</li>' +
        '<li>Three rooms hide a <strong>puzzle</strong>: a locked drawer or safe, a torn letter and a coded note. Solving one costs no time. On Standard and Dread they are timed, and failing costs 30 minutes.</li>' +
        '<li>The killer left a <strong>footprint</strong> at the crime scene. Ask guests for their shoes: it is free, but on harder settings some will refuse.</li>' +
        '<li>Search the <strong>crime scene</strong> first: it tells you when and how the victim died.</li>' +
        '<li>Questioning a guest starts a <strong>conversation</strong>. Ask where they were, about the victim or the others, show them clues, and challenge a story with a clue that proves it wrong.</li>' +
        '<li>Everything you learn goes onto the <strong>timeline</strong>: who was where, hour by hour.</li>' +
        '<li>Want to keep someone\'s exact words? <strong>Highlight</strong> any text you are shown and tap Save highlight, or tap ' + ico('save-note') + ' beside it. It goes to <strong>My notes</strong> in your notebook.</li>' +
        '<li>Every clue also lands on your <strong>evidence board</strong>. Arrange it, tie clues to suspects, rooms and hours with string, and stamp them confirmed, suspicious or disproven. The board never tells you who did it.</li>' +
        '<li>Innocent people tell the truth about the time of the murder. Find the one whose story falls apart.</li>' +
        '<li>Everyone had a motive. Motives alone will not solve it.</li>' +
        '<li>Some guests lie for harmless reasons. Watch which hour the lie is about.</li>' +
        '</ul>' +
        '<p>Every case has a code, like <strong>TN-4821</strong>. Give a friend the code and they get the same mystery.</p>' +
        '</div><button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else if (S.titleMode === 'casebook') {
      menu = viewCasebook() + '<button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else {
      menu =
        (sv ? '<button class="btn primary big" data-act="continue">Continue case ' + esc(PLACES[sv.place].code + ERAS[sv.era].code + '-' + sv.seed) + '</button>' : '') +
        '<button class="btn ' + (sv ? '' : 'primary ') + 'big" data-act="title-mode" data-mode="new">New case</button>' +
        '<button class="btn" data-act="title-mode" data-mode="number">Play a case code</button>' +
        '<button class="btn" data-act="title-mode" data-mode="casebook">Casebook</button>' +
        '<button class="btn" data-act="title-mode" data-mode="options">Options</button>' +
        '<button class="btn ghost" data-act="title-mode" data-mode="how">How to play</button>';
    }
    return (
      '<section class="screen title-screen">' + LANTERN +
      '<h1 class="game-title">The Midnight<br>Crossing</h1>' +
      '<p class="tagline">A murder in the dark. A new case every night.</p>' +
      (S.titleMode ? '' : '<button class="rank-chip" data-act="title-mode" data-mode="casebook"><strong>' + RANKS[rankIndex(CAREER.points)].t + '</strong> · ' +
        CAREER.points.toLocaleString() + ' career points</button>') +
      '<div class="title-menu">' + menu + '</div></section>'
    );
  }

  // Progress toward the next rank, as a bar.
  function rankProgress(points) {
    const i = rankIndex(points);
    const cur = RANKS[i], next = RANKS[i + 1];
    if (!next) return '<p class="hint">The highest rank there is.</p>';
    const pct = Math.round(((points - cur.at) / (next.at - cur.at)) * 100);
    return '<div class="rank-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Progress to ' + next.t + '"><i style="width:' + pct + '%"></i></div>' +
      '<p class="hint">' + (next.at - points).toLocaleString() + ' points to ' + next.t + ', which unlocks ' + next.what + '.</p>';
  }

  function viewCasebook() {
    const C = CAREER;
    const ri = rankIndex(C.points);
    const fmtDate = (t) => { try { return t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; } catch (e) { return ''; } };
    const ladder = RANKS.map((r, i) => '<li class="' + (i <= ri ? 'reached' : '') + (i === ri ? ' current' : '') + '"><span class="mark ' + (i <= ri ? 'ok' : 'na') + '">' + (i <= ri ? '✓' : '') + '</span>' +
      '<div><strong>' + r.t + '</strong><span>' + (r.at ? r.at.toLocaleString() + ' points' : 'Where everyone starts') + (r.what ? ' · unlocks ' + r.what : '') + '</span></div></li>').join('');
    const badges = Object.keys(BADGES).map((k) => {
      const b = BADGES[k], got = !!C.badges[k];
      return '<li class="badge' + (got ? ' earned' : '') + '"><span class="badge-sym" aria-hidden="true">' + b[0] + '</span><div><strong>' + b[1] + '</strong><span>' + b[2] +
        (got ? ' Earned ' + fmtDate(C.badges[k]) + '.' : '') + '</span></div></li>';
    }).join('');
    const cases = C.book.slice().reverse().map((e) => '<li class="cb-case"><div class="cb-top"><strong>' + e.code + '</strong><span class="cb-score">' + e.score.toLocaleString() + '</span></div>' +
      '<div class="cb-meta"><span class="mark ' + (e.right ? 'ok' : 'bad') + '">' + (e.right ? '✓' : '✗') + '</span><span>' + (e.right ? 'Caught ' : 'Missed ') + esc(e.killer) +
      ' · ' + DIFFS[e.diff].label + ' · ' + esc(e.rank) + ' · ' + fmtDate(e.at) + (e.counted ? '' : ' · replay, not counted') + '</span>' +
      '<button class="mini-btn" data-act="replay" data-code="' + e.code + '">Play again</button></div></li>').join('');
    return '<div class="panel casebook">' +
      '<p class="kicker">Your rank</p><h2 class="cb-rank">' + RANKS[ri].t + '</h2><p class="cb-points">' + C.points.toLocaleString() + ' career points</p>' + rankProgress(C.points) +
      '<div class="cb-stats"><div><strong>' + C.closed + '</strong><span>cases closed</span></div><div><strong>' + C.solved + '</strong><span>killers caught</span></div>' +
      '<div><strong>' + C.best.toLocaleString() + '</strong><span>best score</span></div></div>' +
      '<h3>Ranks</h3><ul class="cb-ladder">' + ladder + '</ul>' +
      '<h3>Badges · ' + Object.keys(C.badges).length + ' of ' + Object.keys(BADGES).length + '</h3><ul class="badges">' + badges + '</ul>' +
      '<h3>Closed cases</h3>' + (cases ? '<ol class="cb-cases">' + cases + '</ol>' : '<p class="hint">No cases closed yet. Your first one will appear here.</p>') +
      '<p class="hint">Only the first time you close a case counts toward your career. Your casebook is kept in this browser, so clearing its data or changing device starts it over.</p></div>';
  }

  function optSummary() {
    const p = OPTS.place === 'random' ? 'Random location' : PLACES[OPTS.place].label;
    const e = OPTS.era === 'random' ? 'random era' : ERAS[OPTS.era].label.toLowerCase();
    return p + ', ' + e + '.';
  }

  // ---------- briefing ----------
  function viewBriefing() {
    const c = S.c;
    const pl = place();
    const v = person(c.victim);
    return (
      '<section class="screen briefing panel">' +
      '<p class="kicker">Case ' + caseCode(c) + ' · ' + pl.label + ' · ' + ERAS[c.era].label + ' · ' + DIFFS[S.diff].label + '</p>' +
      '<h2>' + esc(fmt(pl.briefTitle)) + '</h2>' +
      '<p>' + esc(fmt(pl.intro[c.era])) + '</p>' +
      '<p>After dinner, everyone drifted off on their own.</p>' +
      '<div class="victim-card">' + avatar(v) + '<div><strong>' + esc(v.name) + '</strong>, ' + esc(v.title) +
      '<br>Found dead in the <strong>' + esc(room(c.crimeRoom).name) + '</strong> at ' + clock(c.foundMin) + ' by ' + esc(person(c.finder).name) + '.</div></div>' +
      '<p>' + esc(fmt(pl.you)) + '</p>' +
      '<p class="clue">' + esc(cap(pl.deadlineAt)) + ' <strong>' + clock(deadlineMin()) + '</strong>. It is now <strong>' + clock(nowMin()) +
      '</strong>. Every search or question takes 30 minutes: you have <strong>' + totalLeads() + ' leads</strong>.</p>' +
      '<div class="suspect-strip">' + c.suspects.map((id) => '<span class="mini">' + avatar(person(id), true) + esc(person(id).short) + '</span>').join('') + '</div>' +
      '<button class="btn primary big" data-act="begin">Begin the investigation</button>' +
      '</section>'
    );
  }

  // ---------- investigation ----------
  function topBar() {
    const n = leadsLeft();
    return (
      '<header class="topbar">' +
      '<button class="btn ghost icon-btn" data-act="home" aria-label="Back to main menu">' + ico('menu') + '</button>' +
      '<button class="btn ghost icon-btn" data-act="nb-open" aria-label="Open the notebook">' + ico('notebook') + '</button>' +
      (Atmo.available ? '<button class="btn ghost icon-btn sound-btn" data-act="sound" aria-pressed="' + (OPTS.sound !== 'off') + '" aria-label="' +
        (OPTS.sound === 'off' ? 'Turn sound on' : 'Turn sound off') + '">' + ico(OPTS.sound === 'off' ? 'sound-off' : 'sound-on') + '</button>' : '') +
      '<div class="clockbox"><span class="clock">' + clock(nowMin()) + '</span>' +
      '<span class="leads">' + n + ' lead' + (n === 1 ? '' : 's') + ' ' + esc(place().before) + '</span></div>' +
      '<span class="case-no">Case ' + caseCode(S.c) + '</span>' +
      '<button class="btn primary" data-act="accuse">Accuse</button>' +
      '</header>'
    );
  }

  function viewInvestigate() {
    const wide = isWide();
    let tab = S.tab;
    if (wide && tab === 'timeline') tab = 'ship';
    const tabs = [['ship', 'Rooms'], ['guests', 'Guests'], ['board', 'Board'], ['timeline', 'Timeline'], ['notes', 'Notebook']]
      .filter((t) => !(wide && t[0] === 'timeline'));
    const views = { ship: viewRooms, guests: viewGuests, board: viewBoard, timeline: viewTimeline, notes: viewNotes };
    const fresh = tab === 'board' ? 0 : boardNew();
    const side = wide && tab !== 'board';
    return (
      '<section class="screen investigate">' + topBar() +
      '<nav class="tabs" aria-label="Investigation">' +
      tabs.map((t) => '<button class="tab' + (t[0] === tab ? ' active' : '') + '" data-act="tab" data-tab="' + t[0] + '"' +
        (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] +
        (t[0] === 'board' && fresh ? '<span class="tab-badge" aria-label="' + fresh + ' new">' + fresh + '</span>' : '') + '</button>').join('') +
      '</nav>' +
      '<div class="inv-body' + (side ? '' : ' solo') + '"><div class="inv-main">' + views[tab]() + '</div>' +
      (side ? '<aside class="inv-side">' + viewTimeline() + '</aside>' : '') +
      '</div></section>'
    );
  }

  function viewRooms() {
    const c = S.c;
    return (
      '<h2 class="section-title">Search ' + esc(c.name) + '</h2>' +
      '<div class="cards">' +
      c.rooms.map((r) => {
        const done = S.done.includes('s:' + r.id);
        const total = done ? roomObjects(r.id).length : 0;
        const looked = done ? roomDone(r.id) : 0;
        return (
          '<button class="card' + (done ? ' done' : '') + '" style="--room:' + r.color + '" data-act="search" data-id="' + r.id + '">' +
          '<span class="card-title"><span class="dot"></span>' + esc(r.name) + '</span>' +
          '<span class="card-sub">' + esc(r.desc) + '</span>' +
          '<span class="card-foot">' +
          (r.id === c.crimeRoom ? '<span class="tag danger">Crime scene</span>' : '') +
          '<span class="tag">' + (!done ? 'Enter · 30 min' : looked < total ? 'Go back in · ' + looked + ' of ' + total + ' looked at' : '✓ Searched · go back in') + '</span></span></button>'
        );
      }).join('') +
      '</div>'
    );
  }

  function actionBtn(act, id, doneLabel, label) {
    const done = S.done.includes(act[0] + ':' + id);
    return '<button class="mini-btn' + (done ? ' done' : '') + '" data-act="' + act + '" data-id="' + id + '">' +
      (done ? '✓ ' + doneLabel : label + ' · 30 min') + '</button>';
  }

  function viewGuests() {
    const c = S.c;
    const v = person(c.victim);
    return (
      '<h2 class="section-title">The guests</h2>' +
      '<div class="victim-card slim">' + avatar(v, true) + '<span class="grow"><strong>' + esc(v.name) + '</strong> (the victim), ' + esc(v.title) + '</span>' +
      actionBtn('belongings', c.victim, 'Belongings', 'Belongings') + '</div>' +
      '<div class="cards">' +
      c.suspects.map((id) => {
        const p = person(id);
        const allDone = S.done.includes('q:' + id) && S.done.includes('b:' + id);
        return (
          '<div class="card guest' + (allDone ? ' done' : '') + '" style="--room:' + p.color + '">' +
          '<span class="card-title">' + avatar(p) + '<span>' + esc(p.name) + '<small>' + esc(p.title) + '</small></span></span>' +
          '<span class="card-actions">' +
          actionBtn('question', id, 'Questioned', 'Question') +
          actionBtn('belongings', id, 'Belongings', 'Belongings') +
          (printFound() ? '<button class="mini-btn' + (S.shoes.includes(id) ? ' done' : '') + '" data-act="shoes" data-id="' + id + '">' +
            (S.shoes.includes(id) ? (c.puzzles.shoes[id].refuses ? '✗ Shoes refused' : '✓ Shoes') : 'Ask for shoes · free') + '</button>' : '') +
          '</span></div>'
        );
      }).join('') +
      '</div>'
    );
  }

  // ---------- timeline board ----------
  function buildBoard() {
    const c = S.c;
    const b = {};
    const dinner = c.rooms[0].id;
    [c.victim].concat(c.suspects).forEach((p) => (b[p] = [[{ room: dinner, kind: 'known' }], [], [], []]));
    S.done.forEach((a) => {
      const type = a[0], id = a.slice(2);
      if (type === 'q') {
        // Only what they have told you: their whole evening, or just what they said about someone you asked after.
        const where = heard(id, 'where');
        const askedAbout = talkKeys(id).filter((k) => k.indexOf('about:') === 0).map((k) => k.slice(6));
        c.statements[id].forEach((st) => {
          if (st.slot === 0) return;
          if (where) {
            // Once the red herring owns up, the timeline shows where they really were.
            if (id === c.H && st.slot === c.hSlot && confessed()) b[id][st.slot].push({ room: c.hTrue, kind: 'confess', src: id });
            else b[id][st.slot].push({ room: st.room, kind: 'claim', src: id, alone: st.emphaticAlone });
          }
          st.with.forEach((w) => { if (where || askedAbout.includes(w)) b[w][st.slot].push({ room: st.room, kind: 'with', src: id }); });
        });
        c.sightings.forEach((sg) => {
          if (sg.witness === id && (where || askedAbout.includes(sg.subject))) {
            b[sg.subject][sg.slot].push({ room: sg.room, kind: sg.kind === 'heading' ? 'heading' : 'seen', src: id });
          }
        });
      } else if (type === 'b') {
        const bel = c.belongings[id];
        bel.evidence.forEach((e) => { if (evidenceVisible(id, e)) b[id][e.slot].push({ room: e.room, kind: 'receipt' }); });
        if (bel.meeting) b[id][bel.meeting.slot].push({ room: bel.meeting.room, kind: 'note' });
      } else {
        const tr = c.traces[id];
        if (tr && seen(id, 'trace')) b[tr.pid][tr.slot].push({ room: id, kind: 'trace' });
        if (id === c.crimeRoom && seen(id, 'body')) {
          b[c.victim][c.T].push({ room: id, kind: 'body' });
          for (let s = c.T + 1; s <= 3; s++) b[c.victim][s].push({ room: id, kind: 'dead' });
        }
      }
    });
    // The victim's note from the locked drawer: two guests seen at the hour of the murder.
    if (S.solved.includes('drawer')) {
      c.puzzles.drawer.proof.forEach((x) => b[x.pid][c.T].push({ room: x.room, kind: 'seen', src: c.victim }));
    }
    return b;
  }

  const KINDS = {
    known: ['🍽', () => 'Everyone was at dinner'],
    claim: [ico('said'), () => 'In their own words'],
    with: ['🤝', (src) => person(src).short + ' says they were together'],
    seen: ['👁', (src) => 'Seen by ' + person(src).short],
    heading: ['➜', (src) => person(src).short + ' saw them hurrying here'],
    trace: ['🔍', () => 'A personal item was found here'],
    receipt: ['🧾', () => 'Proof from their belongings'],
    note: ['📝', () => 'The victim planned to meet someone here'],
    body: ['†', () => 'The body was found here'],
    confess: ['✋', () => 'Admitted when challenged'],
  };

  function chip(e) {
    if (e.kind === 'dead') return '<span class="chip dead">dead</span>';
    const r = room(e.room);
    const k = KINDS[e.kind];
    const tip = k[1](e.src);
    return (
      '<span class="chip k-' + e.kind + '" style="--room:' + r.color + '" title="' + esc(tip) + '">' +
      '<span class="chip-icon" aria-label="' + esc(tip) + '">' + k[0] + '</span>' + esc(r.short) +
      (e.alone ? '<em>alone</em>' : '') + (e.src && e.kind !== 'claim' ? '<small>' + esc(person(e.src).short) + '</small>' : '') +
      '</span>'
    );
  }

  function boardHTML() {
    const c = S.c;
    const b = buildBoard();
    const hl = DIFFS[S.diff].highlight;
    let h = '<div class="board-wrap"><table class="board"><thead><tr><th scope="col"><span class="sr">Guest</span></th>' +
      c.slots.map((t, i) => '<th scope="col">' + t + (i === 0 ? '<small>dinner</small>' : '') + '</th>').join('') +
      '</tr></thead><tbody>';
    [c.victim].concat(c.suspects).forEach((pid) => {
      const p = person(pid);
      const isV = pid === c.victim;
      h += '<tr' + (isV ? ' class="victim-row"' : '') + '><th scope="row"><span class="row-name">' + avatar(p, true) +
        '<span>' + esc(p.short) + (isV ? '<small>victim</small>' : '') + '</span></span></th>';
      for (let s = 0; s < 4; s++) {
        const es = b[pid][s];
        const rooms = new Set(es.filter((e) => e.kind !== 'dead').map((e) => e.room));
        const conflict = hl && rooms.size > 1;
        h += '<td' + (conflict ? ' class="conflict"' : '') + '>' + es.map(chip).join('') +
          (conflict ? '<span class="flag" title="These do not agree">!</span>' : '') + '</td>';
      }
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    h += '<p class="legend">' +
      Object.keys(KINDS).filter((k) => k !== 'known').map((k) => '<span>' + KINDS[k][0] + ' ' +
        { claim: 'own words', with: 'was with', seen: 'seen by', heading: 'hurrying to', trace: 'item found', receipt: 'proof in belongings', note: 'victim\'s plan', body: 'body', confess: 'admitted' }[k] + '</span>').join('') +
      (hl ? '<span><span class="flag inline">!</span> stories disagree</span>' : '') + '</p>';
    return h;
  }

  function viewTimeline() {
    return (
      '<h2 class="section-title">Timeline</h2>' +
      '<p class="hint">Where was everyone, hour by hour? Fill it in by searching and questioning.</p>' +
      boardHTML()
    );
  }

  // ---------- evidence board ----------
  // The player's own workspace. It only shows what has been discovered, and never says who is guilty.
  // Node ids: "p:<person>", "t:<hour 1-3>", "r:<room>", "e:<clue>". Saved with the case.
  const BW = 1500; // board width in board pixels
  const BCAT = {
    scene: ['†', 'Crime scene'], item: ['🔍', 'Found'], word: [ico('said'), 'Testimony'], proof: ['🧾', 'Proof'],
    motive: ['♠', 'Motive'], puzzle: ['🗝', 'Puzzle'], shoe: ['👞', 'Shoes'],
  };
  const EVNAME = { chit: 'bar chit', ticket: 'crossword', sketch: 'sketch', letter: 'letter', receipt: 'note', photo: 'photo', message: 'phone message' };
  const MARKS = { c: 'Confirmed', s: 'Suspicious', d: 'Disproven' };
  const ZOOMS = [0.4, 0.5, 0.6, 0.75, 0.9, 1];
  const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  let boardScroll = null;
  let curZoom = 1;
  let boardDirty = false; // new cards were given a spot and need saving

  function freshBoard() { return { pos: {}, links: [], marks: {}, seen: [], n: 0, zoom: 0 }; }
  function cleanBoard(b) {
    const f = freshBoard();
    if (!b || typeof b !== 'object') return f;
    if (b.pos && typeof b.pos === 'object') {
      Object.keys(b.pos).forEach((k) => {
        const p = b.pos[k];
        if (Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v))) f.pos[k] = [Math.max(0, p[0]), Math.max(0, p[1])];
      });
    }
    if (Array.isArray(b.links)) {
      b.links.forEach((l) => {
        if (Array.isArray(l) && l.length === 2 && typeof l[0] === 'string' && typeof l[1] === 'string' && l[0] !== l[1] &&
          !f.links.some((x) => x[0] === l[0] && x[1] === l[1])) f.links.push([l[0], l[1]]);
      });
    }
    if (b.marks && typeof b.marks === 'object') Object.keys(b.marks).forEach((k) => { if (MARKS[b.marks[k]]) f.marks[k] = b.marks[k]; });
    if (Array.isArray(b.seen)) f.seen = b.seen.filter((x) => typeof x === 'string');
    if (Number.isFinite(b.n) && b.n >= 0) f.n = Math.floor(b.n);
    if (Number.isFinite(b.zoom) && b.zoom >= 0.4 && b.zoom <= 1) f.zoom = b.zoom;
    return f;
  }

  // Every clue found so far, as board cards. Built only from the generated case and what the player has done.
  function boardEvidence() {
    const c = S.c;
    const out = [];
    const have = new Set();
    const add = (id, cat, title, text) => { if (have.has(id)) return; have.add(id); out.push({ id: 'e:' + id, cat, title, text }); };
    const w = weaponById(c.weapon);
    const motive = (pid) => add('motive:' + pid, 'motive', 'Motive: ' + esc(person(pid).short), esc(fill(c.motives[pid], pid, c.victim)));
    S.done.forEach((a) => {
      const type = a[0], id = a.slice(2);
      if (type === 's') {
        const r = room(id);
        // Each clue appears once you have inspected the object it is in.
        if (id === c.crimeRoom && seen(id, 'body')) {
          add('watch', 'scene', 'The stopped watch', 'Smashed in the struggle. Stopped at <strong>' + watchTime() + '</strong>.');
          add('wound', 'scene', 'The wound', esc(D.wounds[w.wound]));
        }
        if (id === c.crimeRoom && seen(id, 'print')) add('print', 'scene', 'The footprint', 'Left beside the body: ' + esc(treadName(c.puzzles.print.tread)) + '.');
        const hw = c.weapons.find((x) => x.home === id);
        if (hw.id === c.weapon && seen(id, 'weapon')) add('missing', 'scene', 'Missing: ' + esc(hw.name), 'Gone from its place in the ' + esc(r.name) + '.');
        if (id === c.hideRoom && seen(id, 'hide')) add('hidden', 'scene', 'Found: ' + esc(w.name), 'Hidden ' + esc(r.hide) + ' in the ' + esc(r.name) + '. Wiped, but not well enough.');
        const tr = c.traces[id];
        if (tr && seen(id, 'trace')) add('trace:' + id, 'item', esc(cap(person(tr.pid).item)), esc(person(tr.pid).name) + '\'s. Found in the ' + esc(r.name) + ', left around ' + slot(tr.slot) + '.');
      } else if (type === 'q') {
        // Only what they have actually told you, in the order you asked.
        talkKeys(id).forEach((k) => {
          if (k === 'where') {
            const lines = c.statements[id].filter((st) => st.slot > 0).map((st) => '<b>' + slot(st.slot) + '</b> ' + esc(room(st.room).name) +
              (st.with.length ? ', with ' + esc(nameList(st.with)) : st.emphaticAlone ? ', alone. “Nobody came in.”' : ''));
            add('acct:' + id, 'word', esc(person(id).short) + '\'s account', lines.join('<br>'));
          }
          if (k === 'where' || k.indexOf('about:') === 0) {
            const only = k === 'where' ? null : k.slice(6);
            c.sightings.filter((sg) => sg.witness === id && (!only || sg.subject === only)).sort((x, y) => x.slot - y.slot).forEach((sg) => {
              const rn = esc(room(sg.room).name);
              add('sight:' + id + ':' + sg.subject + ':' + sg.slot, 'word', esc(person(id).short) + ' saw ' + esc(person(sg.subject).short) + ' · ' + slot(sg.slot),
                sg.kind === 'heading' ? 'Hurrying toward the ' + rn + ' just after ' + slot(sg.slot) + '.'
                  : 'In the ' + rn + ' around ' + slot(sg.slot) + (sg.kind === 'aloneSaw' ? ', all alone' : '') + '.');
            });
          }
          if (k === 'victim:0' || (k.indexOf('about:') === 0 && c.gossip[id] === k.slice(6))) motive(c.gossip[id]);
        });
        if (id === c.H && confessed()) {
          add('confess:' + id, 'word', esc(person(id).short) + '\'s confession', 'Was really in the ' + esc(room(c.hTrue).name) + ' at ' + slot(c.hSlot) +
            ', not the ' + esc(room(c.hClaim).name) + '. ' + esc(cap(c.hSecret.split('{room}').join(room(c.hTrue).name))) + '.');
        }
        if (id === c.killer && stuck()) {
          add('stuck:' + id, 'word', esc(person(id).short) + ' won\'t explain', 'Challenged about ' + slot(c.T) + '. Still insists they were in the ' +
            esc(room(c.claimRoom).name) + ', and will say nothing more.');
        }
      } else if (type === 'b') {
        const bel = c.belongings[id];
        bel.evidence.forEach((e) => {
          if (evidenceVisible(id, e)) add('ev:' + id + ':' + e.slot, 'proof', esc(person(id).short) + '\'s ' + EVNAME[e.kind], evidenceText(id, e));
        });
        if (bel.meeting) add('meeting', 'proof', 'The victim\'s plan', 'Meeting someone in the ' + esc(room(bel.meeting.room).name) + ' at ' + slot(bel.meeting.slot) + '. “Come alone.”');
        if (!bel.victim) {
          const rr = room(bel.residueRoom);
          add('stain:' + id, 'item', 'Stain: ' + esc(person(id).short), esc(cap(rr.residue)) + ' on their things. Only the ' + esc(rr.name) + ' has that.');
          motive(id);
        }
      }
    });
    S.solved.forEach((id) => {
      const z = c.puzzles;
      if (id === 'drawer') {
        add('pz:drawer', 'puzzle', 'The victim\'s notes', 'From the ' + esc(pzName('drawer')) + '. Just after ' + slot(c.T) + ', passed ' +
          z.drawer.proof.map((x) => esc(person(x.pid).name) + ' in the ' + esc(room(x.room).name)).join(', and ') + '.');
      } else if (id === 'letter') add('pz:letter', 'puzzle', 'The torn letter', esc(cap(letterMeaning())));
      else add('pz:cipher', 'puzzle', 'The coded note', '“' + esc(cipherPlain()) + '”');
    });
    S.shoes.forEach((pid) => {
      const sh = c.puzzles.shoes[pid];
      add('shoe:' + pid, 'shoe', esc(person(pid).short) + '\'s shoes', sh.refuses ? 'Refused to show them.'
        : esc(cap(sh.name)) + ', ' + esc(treadName(sh.tread)) + '. ' + (sh.tread === c.puzzles.print.tread ? '<strong>Fits the footprint.</strong>' : 'Does not fit.'));
    });
    return out;
  }

  const boardNew = () => boardEvidence().filter((e) => !S.board.seen.includes(e.id)).length;
  function markAllSeen() {
    boardEvidence().forEach((e) => { if (!S.board.seen.includes(e.id)) S.board.seen.push(e.id); });
  }

  // Cards, hours and rooms get a starting spot the first time they appear. After that the player moves them.
  function boardPlace(ev) {
    const c = S.c, B = S.board;
    const set = (id, x, y) => { if (!B.pos[id]) { B.pos[id] = [x, y]; boardDirty = true; } };
    c.suspects.concat([c.victim]).forEach((p, i) => set('p:' + p, 24 + i * 244, 30));
    [1, 2, 3].forEach((s, i) => set('t:' + s, 24 + i * 146, 250));
    c.rooms.forEach((r, i) => set('r:' + r.id, 24 + (i + 3) * 146, 250));
    ev.forEach((e) => {
      if (B.pos[e.id]) return;
      const k = B.n++;
      B.pos[e.id] = [24 + (k % 6) * 244, 350 + Math.floor(k / 6) * 175];
      boardDirty = true;
    });
  }

  function boardNodes() {
    const c = S.c;
    const ev = boardEvidence();
    boardPlace(ev);
    const nodes = [];
    c.suspects.concat([c.victim]).forEach((p) => nodes.push({ id: 'p:' + p, type: 'person', p: person(p), victim: p === c.victim }));
    [1, 2, 3].forEach((s) => nodes.push({ id: 't:' + s, type: 'time', label: slot(s) }));
    c.rooms.forEach((r) => nodes.push({ id: 'r:' + r.id, type: 'room', r }));
    ev.forEach((e) => nodes.push(Object.assign({ type: 'ev' }, e)));
    return nodes;
  }
  function nodeName(n) {
    if (!n) return '';
    if (n.type === 'person') return esc(n.p.name);
    if (n.type === 'time') return n.label;
    if (n.type === 'room') return 'the ' + esc(n.r.name);
    return n.title;
  }
  const tilt = (id) => ((hashStr(S.c.seed + id) % 50) - 25) / 10;

  function nodeHTML(n) {
    const B = S.board;
    const pos = B.pos[n.id];
    const sel = S.bsel && S.bsel.node === n.id;
    const cls = ['bn', 'bn-' + n.type];
    if (sel) cls.push('sel');
    if (S.bfrom === n.id) cls.push('from');
    let inner, label;
    if (n.type === 'person') {
      if (n.victim) cls.push('victim');
      label = n.p.name + (n.victim ? ', the victim' : '');
      inner = '<span class="bn-photo" style="--pc:' + n.p.color + '">' + (n.p.portrait ? faceImg(n.p, 'bn-face') : avatar(n.p)) + '</span>' +
        '<strong>' + esc(n.p.name) + '</strong><small>' + (n.victim ? '† The victim' : esc(n.p.title)) + '</small>';
    } else if (n.type === 'time') {
      label = 'The hour from ' + n.label;
      inner = n.label;
    } else if (n.type === 'room') {
      label = n.r.name;
      inner = '<span class="dot" style="background:' + n.r.color + '"></span>' + esc(n.r.name);
    } else {
      cls.push('cat-' + n.cat);
      const m = B.marks[n.id];
      if (m) cls.push('mark-' + m);
      if (!B.seen.includes(n.id)) cls.push('new');
      label = plain(n.title) + (m ? ', marked ' + MARKS[m] : '');
      const pic = (n.id === 'e:missing' || n.id === 'e:hidden') ? weaponImg(weaponById(S.c.weapon), 'bn-pic')
        : CLUE_ART[n.cat] ? '<img class="bn-pic" src="art/clues/' + CLUE_ART[n.cat] + '.jpg" alt="" decoding="async" onerror="this.remove()">' : '';
      inner = pic + '<span class="bn-cat">' + (pic ? '' : '<span aria-hidden="true">' + BCAT[n.cat][0] + '</span> ') + BCAT[n.cat][1] + '</span>' +
        '<strong>' + n.title + '</strong><span class="bn-text">' + n.text + '</span>' +
        (m ? '<span class="stamp s-' + m + '"><span>' + MARKS[m] + '</span></span>' : '');
    }
    return '<div class="' + cls.join(' ') + '" data-node="' + n.id + '" tabindex="0" role="button" aria-pressed="' + sel + '" aria-label="' + esc(label) + '"' +
      ' style="left:' + pos[0] + 'px;top:' + pos[1] + 'px;--tilt:' + tilt(n.id) + 'deg">' + inner + '</div>';
  }

  function boardPanel(nodes) {
    const B = S.board;
    const byId = {};
    nodes.forEach((n) => { byId[n.id] = n; });
    const live = B.links.map((l, i) => ({ l, i })).filter((x) => byId[x.l[0]] && byId[x.l[1]]);
    if (S.bfrom && byId[S.bfrom]) {
      return '<div class="board-panel" role="status"><p>Tap another card to tie it to <strong>' + nodeName(byId[S.bfrom]) + '</strong> with string.</p>' +
        '<div class="bp-actions"><button class="btn ghost" data-act="b-cancel">Cancel</button></div></div>';
    }
    if (S.bsel && S.bsel.link !== undefined) {
      const l = B.links[S.bsel.link];
      if (l && byId[l[0]] && byId[l[1]]) {
        return '<div class="board-panel"><p>String between <strong>' + nodeName(byId[l[0]]) + '</strong> and <strong>' + nodeName(byId[l[1]]) + '</strong>.</p>' +
          '<div class="bp-actions"><button class="btn" data-act="b-unlink" data-i="' + S.bsel.link + '">Remove string</button>' +
          '<button class="btn ghost" data-act="b-close">Close</button></div></div>';
      }
    }
    const n = S.bsel && byId[S.bsel.node];
    if (n) {
      const ties = live.filter((x) => x.l[0] === n.id || x.l[1] === n.id).map((x) => {
        const other = byId[x.l[0] === n.id ? x.l[1] : x.l[0]];
        return '<li><span>' + nodeName(other) + '</span><button class="mini-btn" data-act="b-unlink" data-i="' + x.i + '" aria-label="Remove the string to ' + esc(plain(nodeName(other))) + '">✕</button></li>';
      });
      let head;
      if (n.type === 'ev') {
        head = '<p class="kicker">' + BCAT[n.cat][1] + '</p><h3>' + n.title + '</h3><p>' + n.text + '</p>' +
          '<div class="bp-marks" role="group" aria-label="Label this clue">' + Object.keys(MARKS).map((k) =>
            '<button class="mini-btn mk-' + k + '" data-act="b-mark" data-v="' + k + '" aria-pressed="' + (B.marks[n.id] === k) + '">' + MARKS[k] + '</button>').join('') + '</div>';
      } else if (n.type === 'person') {
        head = '<p class="kicker">' + (n.victim ? 'The victim' : 'Suspect') + '</p><h3>' + esc(n.p.name) + '</h3><p>' + esc(cap(n.p.title)) + '.</p>';
      } else if (n.type === 'room') {
        head = '<p class="kicker">Room</p><h3>' + esc(n.r.name) + '</h3><p>' + esc(n.r.desc) + '</p>';
      } else {
        head = '<p class="kicker">Hour</p><h3>' + n.label + ' to ' + endOfSlot(Number(n.id.slice(2))) + '</h3>';
      }
      return '<div class="board-panel">' + head +
        (ties.length ? '<p class="bp-label">Tied to:</p><ul class="bp-ties">' + ties.join('') + '</ul>' : '') +
        '<div class="bp-actions"><button class="btn" data-act="b-connect">Tie to another card</button>' +
        '<button class="btn ghost" data-act="b-close">Close</button></div></div>';
    }
    return '<div class="board-panel hint-panel"><p>Tap a card to read it, label it or tie it to another. Drag cards to arrange them, and drop one card on another to tie them together' +
      (matchMedia('(pointer: coarse)').matches ? ' (hold a card for a moment before dragging)' : '') + '.</p></div>';
  }

  function viewBoard() {
    const B = S.board;
    const nodes = boardNodes();
    const ids = new Set(nodes.map((n) => n.id));
    let H = 820;
    nodes.forEach((n) => { H = Math.max(H, B.pos[n.id][1] + 260); });
    const evCount = nodes.filter((n) => n.type === 'ev').length;
    const strings = B.links.map((l, i) => (ids.has(l[0]) && ids.has(l[1])
      ? '<g data-link="' + i + '" data-a="' + l[0] + '" data-b="' + l[1] + '"' + (S.bsel && S.bsel.link === i ? ' class="sel"' : '') +
        '><path class="hit"/><path class="str"/></g>' : '')).join('');
    return (
      '<div class="board-view">' +
      '<div class="board-tools"><h2 class="section-title">Evidence board</h2>' +
      '<span class="board-count">' + evCount + ' clue' + (evCount === 1 ? '' : 's') + ' · ' + B.links.filter((l) => ids.has(l[0]) && ids.has(l[1])).length + ' strings</span>' +
      '<div class="zoom"><button class="mini-btn" data-act="b-zoom" data-d="-1" aria-label="Zoom out">' + ico('zoom-out') + '</button>' +
      '<button class="mini-btn" data-act="b-zoom" data-d="1" aria-label="Zoom in">' + ico('zoom-in') + '</button>' +
      '<button class="mini-btn" data-act="b-tidy">Tidy up</button></div></div>' +
      (evCount ? '' : '<p class="hint">Clues appear here as you find them. Start by searching the crime scene.</p>') +
      '<div class="board-scroll"><div class="board-space"><div class="board-canvas" data-h="' + H + '" style="width:' + BW + 'px;height:' + H + 'px">' +
      '<svg class="bstrings" width="' + BW + '" height="' + H + '" viewBox="0 0 ' + BW + ' ' + H + '" aria-hidden="true">' + strings + '</svg>' +
      nodes.map(nodeHTML).join('') +
      '</div></div></div>' + boardPanel(nodes) + '</div>'
    );
  }

  function stringPath(x1, y1, x2, y2) {
    const sag = 16 + Math.hypot(x2 - x1, y2 - y1) * 0.07;
    return 'M' + x1 + ' ' + y1 + ' Q' + (x1 + x2) / 2 + ' ' + ((y1 + y2) / 2 + sag) + ' ' + x2 + ' ' + y2;
  }
  function drawStrings(canvas) {
    const centre = (id) => {
      const el = canvas.querySelector('[data-node="' + id + '"]');
      if (!el) return null;
      return [parseFloat(el.style.left) + el.offsetWidth / 2, parseFloat(el.style.top) + Math.min(el.offsetHeight / 2, 40)];
    };
    canvas.querySelectorAll('g[data-link]').forEach((g) => {
      const a = centre(g.dataset.a), b = centre(g.dataset.b);
      if (!a || !b) return;
      const d = stringPath(a[0], a[1], b[0], b[1]);
      g.querySelectorAll('path').forEach((p) => p.setAttribute('d', d));
    });
  }

  function addLink(a, b) {
    if (a === b) return false;
    const L = S.board.links;
    if (L.some((l) => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a))) return false;
    L.push([a, b]);
    return true;
  }
  function seeNode(id) { if (id.indexOf('e:') === 0 && !S.board.seen.includes(id)) S.board.seen.push(id); }

  function boardTap(id) {
    if (S.bfrom) {
      if (S.bfrom !== id) addLink(S.bfrom, id);
      S.bsel = { node: S.bfrom };
      S.bfrom = null;
    } else {
      S.bsel = S.bsel && S.bsel.node === id ? null : { node: id };
    }
    seeNode(id);
    save();
    render();
  }

  function initBoard() {
    const wrap = app.querySelector('.board-scroll');
    if (!wrap) return;
    if (boardDirty) { boardDirty = false; save(); }
    const space = wrap.querySelector('.board-space');
    const canvas = wrap.querySelector('.board-canvas');
    const H = Number(canvas.dataset.h);
    // Fit the width on big screens; on phones start at 60% so the cards stay readable, and scroll sideways.
    const auto = Math.max(0.6, Math.min(1, (wrap.clientWidth - 4) / BW));
    curZoom = S.board.zoom || auto;
    canvas.style.transform = 'scale(' + curZoom + ')';
    space.style.width = BW * curZoom + 'px';
    space.style.height = H * curZoom + 'px';
    if (boardScroll) { wrap.scrollLeft = boardScroll.l; wrap.scrollTop = boardScroll.t; }
    wrap.addEventListener('scroll', () => { boardScroll = { l: wrap.scrollLeft, t: wrap.scrollTop }; }, { passive: true });
    drawStrings(canvas);

    let drag = null;
    const boardPoint = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / curZoom, (e.clientY - r.top) / curZoom];
    };
    const targetAt = (pt, self) => {
      const all = canvas.querySelectorAll('.bn');
      for (let i = all.length - 1; i >= 0; i--) {
        const el = all[i];
        if (el === self) continue;
        const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
        if (pt[0] >= x && pt[0] <= x + el.offsetWidth && pt[1] >= y && pt[1] <= y + el.offsetHeight) return el;
      }
      return null;
    };
    const lift = () => {
      if (!drag) return;
      drag.active = true;
      drag.el.classList.add('lifted');
      try { drag.el.setPointerCapture(drag.pid); } catch (er) { /* ignore */ }
    };
    const clearDrop = () => canvas.querySelectorAll('.bn.drop').forEach((x) => x.classList.remove('drop'));

    canvas.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.bn');
      if (!el || (e.button !== undefined && e.button > 0)) return;
      const id = el.dataset.node;
      drag = {
        el, id, pid: e.pointerId, x0: e.clientX, y0: e.clientY, p0: S.board.pos[id].slice(),
        sl: wrap.scrollLeft, st: wrap.scrollTop, active: false, moved: false, cur: null, touch: e.pointerType === 'touch',
      };
      // On a touchscreen, a quick swipe scrolls the board. Holding a card picks it up.
      if (drag.touch) drag.timer = setTimeout(() => { if (drag && !drag.moved) lift(); }, 260);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.active) {
        if (Math.hypot(dx, dy) <= 6) return;
        drag.moved = true;
        if (drag.touch) { clearTimeout(drag.timer); drag = null; return; }
        lift();
      }
      // Scroll the board when a card is dragged near its edge.
      const wr = wrap.getBoundingClientRect();
      if (e.clientX > wr.right - 36) wrap.scrollLeft += 14;
      else if (e.clientX < wr.left + 36) wrap.scrollLeft -= 14;
      if (e.clientY > wr.bottom - 36) wrap.scrollTop += 14;
      else if (e.clientY < wr.top + 36) wrap.scrollTop -= 14;
      const x = Math.max(0, Math.min(BW - drag.el.offsetWidth, drag.p0[0] + (dx + wrap.scrollLeft - drag.sl) / curZoom));
      const y = Math.max(0, drag.p0[1] + (dy + wrap.scrollTop - drag.st) / curZoom);
      drag.el.style.left = x + 'px';
      drag.el.style.top = y + 'px';
      drag.cur = [x, y];
      clearDrop();
      const t = targetAt(boardPoint(e), drag.el);
      if (t) t.classList.add('drop');
      drawStrings(canvas);
    });
    const finish = (e, cancelled) => {
      if (!drag || e.pointerId !== drag.pid) return;
      clearTimeout(drag.timer);
      const d = drag;
      drag = null;
      clearDrop();
      if (!d.active) { if (!d.moved && !cancelled) boardTap(d.id); return; }
      d.el.classList.remove('lifted');
      if (!d.cur) { if (!cancelled) boardTap(d.id); return; }
      const t = cancelled ? null : targetAt(boardPoint(e), d.el);
      if (t) {
        addLink(d.id, t.dataset.node);
        S.board.pos[d.id] = d.p0; // the card goes back to where it was, tied with string
        S.bsel = { node: d.id };
      } else if (!cancelled) {
        S.board.pos[d.id] = [Math.round(d.cur[0]), Math.round(d.cur[1])];
      }
      seeNode(d.id);
      save();
      render();
    };
    canvas.addEventListener('pointerup', (e) => finish(e, false));
    canvas.addEventListener('pointercancel', (e) => finish(e, true));
    canvas.addEventListener('touchmove', (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => { if (e.target.closest('.bn')) e.preventDefault(); });
    canvas.addEventListener('click', (e) => {
      const g = e.target.closest('g[data-link]');
      if (g) { S.bfrom = null; S.bsel = { link: Number(g.dataset.link) }; render(); return; }
      if (!e.target.closest('.bn') && S.bsel && !S.bfrom) { S.bsel = null; render(); }
    });
  }

  function boardAction(d) {
    const B = S.board;
    if (d.act === 'b-mark' && S.bsel && S.bsel.node) {
      if (B.marks[S.bsel.node] === d.v) delete B.marks[S.bsel.node];
      else B.marks[S.bsel.node] = d.v;
    } else if (d.act === 'b-connect' && S.bsel && S.bsel.node) {
      S.bfrom = S.bsel.node;
    } else if (d.act === 'b-cancel') {
      S.bfrom = null;
    } else if (d.act === 'b-unlink') {
      const i = Number(d.i);
      if (B.links[i]) B.links.splice(i, 1);
      if (S.bsel && S.bsel.link !== undefined) S.bsel = null;
    } else if (d.act === 'b-close') {
      S.bsel = null; S.bfrom = null;
    } else if (d.act === 'b-zoom') {
      let k = ZOOMS.findIndex((z) => z >= curZoom - 0.001);
      if (k < 0) k = ZOOMS.length - 1;
      if (Number(d.d) > 0 && ZOOMS[k] <= curZoom + 0.001) k++;
      else if (Number(d.d) < 0) k--;
      B.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, k))];
      boardScroll = null;
    } else if (d.act === 'b-tidy') {
      B.pos = {}; B.n = 0; boardScroll = null;
    }
    save();
    render();
  }

  // ---------- notes ----------
  // The detective's notebook. Entirely automatic: it records what you have found and been told, sorted into
  // four sections. It never adds anything you have not discovered, and never says who did it.
  const NB_SECS = [['suspects', 'Suspects'], ['evidence', 'Evidence'], ['timeline', 'Timeline'], ['questions', 'Questions'], ['notes', 'My notes']];
  // Facts from rooms count only once the object holding them has been inspected.
  const bodySeen = () => seen(S.c.crimeRoom, 'body');
  // Where someone now says they were (the red herring's story changes once they own up).
  const storyRoom = (p, s) => (p === S.c.H && s === S.c.hSlot && confessed() ? S.c.hTrue : claimOf(p, s).room);

  function viewNotes() { return '<h2 class="section-title">Notebook</h2>' + notebookHTML(); }

  function notebookHTML() {
    const sec = NB_SECS.some((x) => x[0] === S.nbSec) ? S.nbSec : 'suspects';
    const open = notebookQuestions().open.length;
    const views = { suspects: nbSuspects, evidence: nbEvidence, timeline: nbTimeline, questions: nbQuestions, notes: nbNotes };
    const label = NB_SECS.find((x) => x[0] === sec)[1];
    return '<nav class="nb-tabs" aria-label="Notebook sections">' + NB_SECS.map((x) =>
      '<button class="nb-tab' + (x[0] === sec ? ' active' : '') + '" data-act="nb-sec" data-sec="' + x[0] + '" aria-pressed="' + (x[0] === sec) + '">' + x[1] +
      (x[0] === 'questions' && open ? '<span class="nb-count" aria-label="' + open + ' open">' + open + '</span>' : '') +
      (x[0] === 'notes' && S.notes.length ? '<span class="nb-count quiet" aria-label="' + S.notes.length + ' saved">' + S.notes.length + '</span>' : '') + '</button>').join('') +
      // Text in the automatic sections can be highlighted and saved. The notes page itself cannot.
      '</nav><div class="nb-body"' + (sec === 'notes' ? '' : ' data-note="Notebook: ' + label + '"') + '>' + views[sec]() + '</div>';
  }

  // What other people (and the victim's notes) have told you about where p was.
  function knownAbout(p) {
    const c = S.c;
    const told = (w) => heard(w, 'where') || heard(w, 'about:' + p);
    const out = [];
    c.sightings.filter((sg) => sg.subject === p && told(sg.witness)).forEach((sg) => {
      const rn = esc(room(sg.room).name), wn = esc(person(sg.witness).short);
      out.push([sg.slot, sg.kind === 'heading' ? 'Seen hurrying toward the ' + rn + ' by ' + wn
        : 'Seen in the ' + rn + ' by ' + wn + (sg.kind === 'aloneSaw' ? ', alone' : '')]);
    });
    c.suspects.forEach((w) => {
      if (w === p || !told(w)) return;
      c.statements[w].forEach((st) => { if (st.slot > 0 && st.with.includes(p)) out.push([st.slot, 'In the ' + esc(room(st.room).name) + ' with ' + esc(person(w).short) + ', says ' + esc(person(w).short)]); });
    });
    if (S.solved.includes('drawer')) {
      const x = c.puzzles.drawer.proof.find((y) => y.pid === p);
      if (x) out.push([c.T, 'Seen in the ' + esc(room(x.room).name) + ' by the victim (the victim\'s notes)']);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }

  function nbSuspects() {
    const c = S.c;
    const status = (text, on, warn, mark) => '<span class="nb-chip' + (on ? ' on' : '') + (warn ? ' warn' : '') + '">' + (mark || (on ? '✓ ' : '')) + text + '</span>';
    const timeLi = (s, html) => '<li><span class="time">' + slot(s) + '</span><span>' + html + '</span></li>';
    const v = person(c.victim);
    const vb = c.belongings[c.victim];
    const vLines = ['<li>Found dead in the ' + esc(room(c.crimeRoom).name) + ' at ' + clock(c.foundMin) + ' by ' + esc(person(c.finder).name) + '.</li>'];
    if (bodySeen()) vLines.push('<li>Their watch stopped at ' + watchTime() + '.</li>');
    if (S.done.includes('b:' + c.victim)) {
      vb.evidence.forEach((e) => vLines.push('<li>' + evidenceText(c.victim, e) + '</li>'));
      vLines.push('<li>Planned to meet someone in the ' + esc(room(vb.meeting.room).name) + ' at ' + slot(vb.meeting.slot) + ', alone.</li>');
    }
    const cards = ['<article class="nb-person victim" style="--pc:' + v.color + '"><header>' + avatar(v) + '<div><h3>' + esc(v.name) + '</h3><p>The victim · ' + esc(v.title) + '</p></div></header>' +
      '<ul class="nb-lines">' + vLines.join('') + '</ul></article>'];

    c.suspects.forEach((p) => {
      const P = person(p), b = c.belongings[p], sh = c.puzzles.shoes[p];
      const asked = S.done.includes('q:' + p), looked = S.done.includes('b:' + p), shoe = S.shoes.includes(p);
      const fits = shoe && !sh.refuses && sh.tread === c.puzzles.print.tread;
      const chips = [status(asked ? 'Questioned' : 'Not questioned yet', asked), status(looked ? 'Belongings searched' : 'Belongings not searched', looked)];
      if (printFound()) chips.push(status(!shoe ? 'Shoes not checked' : sh.refuses ? 'Refused to show shoes' : fits ? 'Shoes fit the footprint' : 'Shoes do not fit', shoe, fits || (shoe && sh.refuses), shoe && sh.refuses ? '✗ ' : ''));
      const parts = [];
      if (heard(p, 'where')) {
        parts.push('<p class="nb-label">Their story</p><ul class="nb-lines">' + c.statements[p].filter((st) => st.slot > 0).map((st) => {
          if (p === c.H && st.slot === c.hSlot && confessed()) {
            return timeLi(st.slot, '<s>' + esc(room(st.room).name) + '</s> Admitted they were really in the ' + esc(room(c.hTrue).name) + '.');
          }
          return timeLi(st.slot, esc(room(st.room).name) + (st.with.length ? ', with ' + esc(nameList(st.with)) : st.emphaticAlone ? ', alone. “Nobody came in.”' : ''));
        }).join('') + '</ul>');
        if (p === c.killer && stuck()) parts.push('<p class="nb-flag">Could not explain the clue you showed them about ' + slot(c.T) + ', and would not change their story.</p>');
      } else if (asked) {
        parts.push('<p class="hint">You have not asked where they were yet.</p>');
      }
      const others = knownAbout(p);
      if (others.length) parts.push('<p class="nb-label">What others say</p><ul class="nb-lines">' + others.map((x) => timeLi(x[0], x[1] + '.')).join('') + '</ul>');
      const found = [];
      Object.keys(c.traces).forEach((r) => {
        const t = c.traces[r];
        if (t.pid === p && seen(r, 'trace')) found.push(timeLi(t.slot, esc(cap(P.item)) + ', found in the ' + esc(room(r).name) + '.'));
      });
      if (looked) {
        b.evidence.forEach((e) => { if (evidenceVisible(p, e)) found.push(timeLi(e.slot, evidenceText(p, e))); });
        const rr = room(b.residueRoom);
        found.push('<li><span class="time">Stain</span><span>' + esc(cap(rr.residue)) + ', from the ' + esc(rr.name) + '.</span></li>');
        found.push('<li><span class="time">Means</span><span>' + esc(cap(b.flavor)) + '.</span></li>');
        if (b.locked) found.push('<li><span class="time">Phone</span><span>' + (phoneOpen(p) ? 'Unlocked.' : 'Locked. The code is written down in one of the rooms.') + '</span></li>');
      }
      if (found.length) parts.push('<p class="nb-label">What you found</p><ul class="nb-lines">' + found.join('') + '</ul>');
      if (motiveKnown(p)) parts.push('<p class="nb-label">Motive</p><p>' + esc(fill(c.motives[p], p, c.victim)) + '</p>');
      cards.push('<article class="nb-person" style="--pc:' + P.color + '"><header>' + avatar(P) + '<div><h3>' + esc(P.name) + '</h3><p>' + esc(cap(P.title)) + '</p></div></header>' +
        '<div class="nb-chips">' + chips.join('') + '</div>' + parts.join('') + '</article>');
    });
    return cards.join('');
  }

  function nbEvidence() {
    const c = S.c;
    const cards = boardEvidence();
    const w = weaponById(c.weapon);
    const groups = [['scene', 'Crime scene and weapon'], ['item', 'Items and stains'], ['proof', 'Proof of where people were'],
      ['word', 'What people told you'], ['motive', 'Motives'], ['puzzle', 'Puzzles'], ['shoe', 'Shoes']];
    let html = '';
    groups.forEach((g) => {
      const list = cards.filter((e) => e.cat === g[0]);
      let extra = '';
      if (g[0] === 'scene') {
        if (printFound()) extra += '<div class="print-clue nb-sole">' + soleSVG(c.puzzles.print.tread) + '<div class="hint">The footprint, as drawn in your notebook. Compare it with the guests\' shoes.</div></div>';
        const untouched = c.weapons.filter((x) => x.id !== c.weapon && seen(x.home, 'weapon')).map((x) => x.name);
        if (untouched.length) extra += '<p class="hint">Untouched, in their usual places: ' + esc(untouched.join(', ')) + '. None of these is the weapon.</p>';
        if (bodySeen() && !seen(w.home, 'weapon') && !seen(c.hideRoom, 'hide')) extra += '<p class="hint">You do not know the weapon yet. Search rooms to see what is missing.</p>';
      }
      if (g[0] === 'puzzle') {
        PUZZLE_IDS.filter((id) => seen(c.puzzles[id].room, 'pz:' + id) && !S.solved.includes(id)).forEach((id) => {
          extra += '<p class="nb-open-pz">' + esc(cap(pzName(id))) + ' in the ' + esc(room(c.puzzles[id].room).name) + ': not solved yet. ' +
            '<button class="mini-btn" data-act="puzzle" data-id="' + id + '">Try it</button></p>';
        });
      }
      if (g[0] === 'shoe' && S.shoes.some((p) => c.puzzles.shoes[p].refuses)) extra += '<p class="hint">A refusal proves nothing by itself. Some people simply love their shoes.</p>';
      if (!list.length && !extra) return;
      html += '<section class="panel nb-group cat-' + g[0] + '"><h3><span aria-hidden="true">' + BCAT[g[0]][0] + '</span> ' + g[1] + '</h3>' +
        (list.length ? '<ul class="nb-list">' + list.map((e) => '<li><strong>' + e.title + '</strong><span>' + e.text + '</span></li>').join('') + '</ul>' : '') + extra + '</section>';
    });
    return html || '<p class="hint">Nothing yet. Search the crime scene first: it tells you when and how the victim died.</p>';
  }

  function entryText(e) {
    const rn = esc(room(e.room).name);
    const by = e.src ? (e.src === S.c.victim ? 'the victim\'s notes' : esc(person(e.src).short)) : '';
    switch (e.kind) {
      case 'known': return 'dinner in the ' + rn;
      case 'claim': return 'says the ' + rn + (e.alone ? ', alone' : '');
      case 'with': return 'in the ' + rn + ', says ' + by;
      case 'seen': return 'seen in the ' + rn + ' (' + by + ')';
      case 'heading': return 'seen hurrying to the ' + rn + ' (' + by + ')';
      case 'trace': return 'left something in the ' + rn;
      case 'receipt': return 'proof of being in the ' + rn;
      case 'note': return 'planned to meet someone in the ' + rn;
      case 'body': return 'killed in the ' + rn;
      case 'confess': return 'admits being in the ' + rn;
      default: return rn;
    }
  }

  function nbTimeline() {
    const c = S.c;
    const b = buildBoard();
    const ppl = [c.victim].concat(c.suspects);
    const key = (t, html) => '<li><span class="time">' + t + '</span><span>' + html + '</span></li>';
    let html = '<section class="panel"><h3>Key times</h3><ul class="nb-lines">' +
      key(slot(0), 'Everyone has dinner together in the ' + esc(dinnerRoomName()) + '.') +
      (bodySeen() ? key(watchTime(), 'The victim\'s watch stops, smashed in the struggle.') : '') +
      key(clock(c.foundMin), esc(person(c.finder).name) + ' finds the body in the ' + esc(room(c.crimeRoom).name) + '.') +
      key(clock(startMin()), 'You begin your investigation.') +
      key(clock(deadlineMin()), esc(cap(place().deadlineAt.replace(/ at$/, ''))) + '.') +
      '</ul></section>';
    html += '<section class="panel"><h3>The evening, hour by hour</h3>';
    [1, 2, 3].forEach((s) => {
      const lines = [];
      ppl.forEach((p) => {
        const es = b[p][s].filter((e) => e.kind !== 'dead');
        if (!es.length) return;
        const seen = new Set();
        const txt = es.map(entryText).filter((x) => (seen.has(x) ? false : seen.add(x))).join('; ');
        lines.push('<li><strong>' + esc(person(p).short) + '</strong> ' + txt + '.</li>');
      });
      html += '<div class="nb-hour"><h4>' + slot(s) + ' to ' + endOfSlot(s) + '</h4>' +
        (lines.length ? '<ul class="nb-list tight">' + lines.join('') + '</ul>' : '<p class="hint">Nothing known about this hour yet.</p>') + '</div>';
    });
    html += '</section>';
    const log = S.done.map((a, i) => {
      const t = clock(startMin() + i * ACTION_MIN);
      if (a[0] === 'x') return '<li>' + t + ' · Lost half an hour on the ' + esc(pzName(a.split(':')[1])) + '</li>';
      const label = a[0] === 'q' ? 'Questioned ' + person(a.slice(2)).name
        : a[0] === 'b' ? 'Went through ' + person(a.slice(2)).name + '\'s belongings'
        : 'Searched the ' + room(a.slice(2)).name;
      return '<li><button class="linkish" data-act="view" data-id="' + a + '">' + t + ' · ' + esc(label) + '</button></li>';
    });
    html += '<section class="panel"><h3>Your investigation</h3>' + (log.length ? '<ol class="log">' + log.join('') + '</ol>' : '<p class="hint">You have not started yet.</p>') + '</section>';
    return html;
  }

  // Open questions come only from what you have found. On Dread, contradictions are left for you to spot.
  function notebookQuestions() {
    const c = S.c;
    const open = [], settled = [];
    if (S.diff === 'nightmare') return { open, settled }; // on Nightmare the notebook asks nothing
    const hl = DIFFS[S.diff].highlight;
    const w = weaponById(c.weapon);
    const crime = bodySeen();
    const Q = (list, q, a) => list.push([q, a]);

    if (crime) Q(settled, 'When did the victim die?', 'Between ' + slot(c.T) + ' and ' + endOfSlot(c.T) + '. The watch stopped at ' + watchTime() + '.');
    else Q(open, 'When and how did the victim die?', S.done.includes('s:' + c.crimeRoom) ? 'Look at the body in the ' + esc(room(c.crimeRoom).name) + '.'
      : 'Search the ' + esc(room(c.crimeRoom).name) + ', where the body was found.');

    const wHome = seen(w.home, 'weapon'), wHid = seen(c.hideRoom, 'hide');
    if (wHome || wHid) Q(settled, 'What was the weapon?', 'The ' + esc(w.name) + (wHome ? ', missing from the ' + esc(room(w.home).name) : '') + '.');
    else if (crime) Q(open, 'What was the weapon?', 'The wound points to something ' + { blunt: 'heavy', sharp: 'sharp or pointed', strangle: 'like a cord or strap' }[w.wound] + '. Search rooms to see what is missing.');
    if (wHid) Q(settled, 'Where was the weapon hidden?', 'Hidden ' + esc(room(c.hideRoom).hide) + ' in the ' + esc(room(c.hideRoom).name) + '.');
    else if (wHome) Q(open, 'Where was the weapon hidden?', 'It was taken from the ' + esc(room(w.home).name) + ' and put somewhere else.');

    if (S.done.includes('b:' + c.victim)) Q(open, 'Who was the victim meeting in the ' + esc(room(c.crimeRoom).name) + ' at ' + slot(c.T) + '?', 'Whoever it was, they have not admitted it.');
    else Q(open, 'Did the victim have plans tonight?', 'Go through the victim\'s belongings.');

    if (crime) {
      const unheard = c.suspects.filter((p) => !heard(p, 'where'));
      if (unheard.length) Q(open, 'Where was everyone at ' + slot(c.T) + '?', 'You have not heard where ' + esc(nameList(unheard)) + ' ' + (unheard.length === 1 ? 'was' : 'were') + '.');
      else Q(settled, 'Where was everyone at ' + slot(c.T) + '?', 'Every guest has told you their story. Not every story is true.');
    }

    if (hl) {
      const b = buildBoard();
      [c.victim].concat(c.suspects).forEach((p) => [1, 2, 3].forEach((s) => {
        const rooms = [...new Set(b[p][s].filter((e) => e.kind !== 'dead').map((e) => e.room))];
        if (rooms.length > 1) Q(open, 'Where was ' + esc(person(p).name) + ' at ' + slot(s) + '?', 'Your clues put them in the ' + rooms.map((r) => esc(room(r).name)).join(' and the ') + '. Not all of them can be right.');
      }));
      c.suspects.forEach((p) => {
        if (!heard(p, 'where') || !S.done.includes('b:' + p)) return;
        const rr = c.belongings[p].residueRoom;
        if (![1, 2, 3].some((s) => storyRoom(p, s) === rr)) {
          Q(open, 'Why does ' + esc(person(p).name) + ' have ' + esc(room(rr).residue) + ' on their things?', 'It comes from the ' + esc(room(rr).name) + ', but their story never takes them there.');
        }
      });
    }

    if (printFound()) {
      const checked = S.shoes.length;
      const fits = S.shoes.filter((p) => !c.puzzles.shoes[p].refuses && c.puzzles.shoes[p].tread === c.puzzles.print.tread);
      const refused = S.shoes.filter((p) => c.puzzles.shoes[p].refuses);
      Q(open, 'Whose shoe left the footprint?', 'You have checked ' + checked + ' of ' + c.suspects.length + ' guests. ' +
        (fits.length ? 'It fits ' + esc(nameList(fits)) + '. ' : '') + (refused.length ? esc(nameList(refused)) + (refused.length === 1 ? ' refused.' : ' refused.') : ''));
    }
    c.suspects.forEach((p) => {
      if (S.done.includes('b:' + p) && c.belongings[p].locked && !phoneOpen(p)) Q(open, 'Where is the code for ' + esc(person(p).name) + '\'s phone?', 'Someone wrote it down in one of the rooms.');
    });
    PUZZLE_IDS.forEach((id) => {
      if (!seen(c.puzzles[id].room, 'pz:' + id)) return;
      if (S.solved.includes(id)) return;
      Q(open, 'What does the ' + esc(pzName(id)) + ' in the ' + esc(room(c.puzzles[id].room).name) + ' hide?', 'You have not solved it yet.');
    });
    if (confessed()) Q(settled, 'Why did ' + esc(person(c.H).name) + ' lie about ' + slot(c.hSlot) + '?', 'They ' + esc(c.hSecret.split('{room}').join(room(c.hTrue).name)) + '.');
    if (stuck()) Q(open, 'Why will ' + esc(person(c.killer).name) + ' not explain ' + slot(c.T) + '?', 'They could not answer the clue you showed them.');

    const notAsked = c.suspects.filter((p) => !S.done.includes('q:' + p));
    if (notAsked.length) Q(open, 'Who have you not questioned yet?', esc(nameList(notAsked)) + '.');
    const notLooked = [c.victim].concat(c.suspects).filter((p) => !S.done.includes('b:' + p));
    if (notLooked.length) Q(open, 'Whose belongings have you not searched?', esc(nameList(notLooked)) + '.');
    return { open, settled };
  }

  function nbQuestions() {
    if (S.diff === 'nightmare') {
      return '<section class="panel"><h3>Unresolved questions</h3><p class="hint">On Nightmare, your notebook asks no questions. Everything you found is still recorded in the other sections.</p></section>';
    }
    const qs = notebookQuestions();
    const li = (x, cls) => '<li class="' + cls + '"><strong>' + x[0] + '</strong><span>' + x[1] + '</span></li>';
    return '<section class="panel"><h3>Unresolved questions</h3>' +
      (qs.open.length ? '<ul class="nb-qs">' + qs.open.map((x) => li(x, 'open')).join('') + '</ul>' : '<p class="hint">Nothing left open. Time to make your accusation.</p>') +
      (DIFFS[S.diff].highlight ? '' : '<p class="hint">On Dread, your notebook does not point out contradictions. You have to spot them yourself.</p>') + '</section>' +
      (qs.settled.length ? '<section class="panel"><h3>Settled</h3><ul class="nb-qs">' + qs.settled.map((x) => li(x, 'done')).join('') + '</ul></section>' : '');
  }

  // ---------- my notes: saved highlights ----------
  // The player can highlight text they have been shown (a conversation, a room, belongings, the notebook)
  // and keep it on a page of their own. Notes are only ever copies of text already on screen:
  // nothing can be typed in, so a note can never hold something the player has not discovered.
  // They are a record only: not evidence, not a discovery, and no part of the score.
  const NOTE_MAX = 700;    // longest single note, in characters
  const NOTE_MIN = 3;
  const NOTE_LIMIT = 60;   // most notes kept for one case
  const tidy = (s) => String(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const NOTE_BTN = '<button class="note-btn" data-act="note-save" aria-label="Save this to My notes" title="Save this to My notes">' + ico('save-note') + '</button>';
  // The one-tap button only appears on blocks short enough to save whole. Longer ones are highlighted in part.
  const noteBtnFor = (html) => (tidy(plain(html)).length <= NOTE_MAX ? NOTE_BTN : '');
  function cleanNotes(raw) {
    const out = [];
    if (!Array.isArray(raw)) return out;
    raw.forEach((n) => {
      if (!n || typeof n.t !== 'string' || out.length >= NOTE_LIMIT) return;
      const t = tidy(n.t).slice(0, NOTE_MAX);
      if (t.length < NOTE_MIN || out.some((x) => x.t === t)) return;
      out.push({ t, src: tidy(typeof n.src === 'string' ? n.src : '').slice(0, 80), at: Number.isFinite(n.at) ? n.at : 0 });
    });
    return out;
  }
  const toastEl = document.createElement('div');
  toastEl.className = 'toast hidden';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2400);
  }
  function addNote(text, src) {
    if (S.screen !== 'investigate') return;
    const t = tidy(text);
    if (t.length < NOTE_MIN) { toast('Highlight a few words first.'); return; }
    if (t.length > NOTE_MAX) { toast('That is too much to save at once. Highlight a shorter passage.'); return; }
    if (S.notes.some((n) => n.t === t)) { toast('That is already in your notes.'); return; }
    if (S.notes.length >= NOTE_LIMIT) { toast('Your notes are full (' + NOTE_LIMIT + '). Remove one to make room.'); return; }
    S.notes.push({ t, src: tidy(src || '').slice(0, 80), at: nowMin() });
    S.noteUndo = null;
    save();
    render();
    toast('Saved to My notes.');
  }
  // The text of one saveable block, without its buttons.
  function blockText(el) {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('button, svg').forEach((b) => b.remove());
    copy.querySelectorAll('p, li, div, br').forEach((n) => n.after(' '));
    return copy.textContent;
  }

  // A highlight only counts if it lies wholly inside one block of game text marked as saveable.
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'note-pill hidden';
  pill.dataset.act = 'note-sel';
  document.body.appendChild(pill);
  let noteSel = null;
  let pillTimer = null;
  function readSelection() {
    const sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || !sel.rangeCount || S.screen !== 'investigate') return null;
    const host = (n) => { const el = n && (n.nodeType === 1 ? n : n.parentElement); return el ? el.closest('[data-note]') : null; };
    const a = host(sel.anchorNode);
    if (!a || a !== host(sel.focusNode)) return null;
    const t = tidy(sel.toString());
    return t.length >= NOTE_MIN ? { t, src: a.dataset.note } : null;
  }
  document.addEventListener('selectionchange', () => {
    const s = readSelection();
    clearTimeout(pillTimer);
    if (s) {
      noteSel = s;
      pill.innerHTML = s.t.length > NOTE_MAX ? 'Too long: highlight less' : ico('save-note') + ' Save to My notes';
      pill.classList.remove('hidden');
    } else {
      // A short delay, because tapping the button can clear the highlight before the tap lands.
      pillTimer = setTimeout(() => { noteSel = null; pill.classList.add('hidden'); }, 350);
    }
  });
  pill.addEventListener('pointerdown', (e) => e.preventDefault());

  function nbNotes() {
    const undo = S.noteUndo ? '<p class="note-undo" role="status">Note removed. <button class="linkish" data-act="note-undo">Undo</button></p>' : '';
    if (!S.notes.length) {
      return undo + '<section class="panel"><h3>My notes</h3><p class="hint">Nothing saved yet.</p>' +
        '<ul class="note-how"><li>Highlight any words in a conversation, a room, someone\'s belongings or this notebook, then tap <strong>Save highlight</strong>.</li>' +
        '<li>Or tap ' + ico('save-note') + ' beside something a guest says or something you find, to keep all of it.</li></ul>' +
        '<p class="hint">Notes are your own record. They are not evidence and do not change your score.</p></section>';
    }
    return undo + '<section class="panel"><h3>My notes <small>' + S.notes.length + ' of ' + NOTE_LIMIT + '</small></h3><ol class="notes">' +
      S.notes.map((n, i) => '<li class="note"><blockquote>' + esc(n.t) + '</blockquote><div class="note-meta"><span>' + esc(n.src || 'Your investigation') + ' · saved at ' + clock(n.at) +
        '</span><button class="mini-btn" data-act="note-del" data-i="' + i + '" aria-label="Remove this note">Remove</button></div></li>').join('') +
      '</ol><p class="hint">Notes are your own record. They are not evidence and do not change your score.</p></section>';
  }

  // The notebook can also be opened as a drawer from anywhere, even in the middle of a conversation.
  const nbWrap = document.createElement('div');
  nbWrap.className = 'nb-wrap hidden';
  nbWrap.innerHTML = '<aside class="nb-drawer" role="dialog" aria-modal="true" aria-labelledby="nb-title"></aside>';
  document.body.appendChild(nbWrap);
  const nbPanel = nbWrap.firstChild;
  function drawNotebook() {
    const keep = nbPanel.scrollTop;
    nbPanel.innerHTML = '<div class="nb-head"><h2 id="nb-title">' + ico('notebook') + ' Notebook</h2><button class="btn ghost icon-btn" data-act="nb-close" aria-label="Close the notebook">✕</button></div>' + notebookHTML();
    nbPanel.scrollTop = keep;
  }
  function openNotebook() {
    if (S.screen !== 'investigate') return;
    S.nbOpen = true;
    nbWrap.classList.remove('hidden');
    document.body.classList.add('nb-open');
    drawNotebook();
    nbPanel.scrollTop = 0;
    const x = nbPanel.querySelector('[data-act="nb-close"]');
    if (x) x.focus({ preventScroll: true });
  }
  function closeNotebook() {
    S.nbOpen = false;
    nbWrap.classList.add('hidden');
    document.body.classList.remove('nb-open');
  }

  // ---------- action results ----------
  // ---------- interrogations ----------
  // A conversation is saved as the list of questions asked, in order (S.talk[pid]). Every answer is rebuilt
  // from the case, so it never changes and never contradicts the generated facts.
  // Question keys: "where", "victim:0|1" (1 = you already know their motive), "things:0|1" (1 = belongings searched),
  // "about:<suspect>", "show:<clue id>", "ch:<hour>:<clue id>".
  const TALK_KEY = /^(where|victim:[01]|things:[01]|about:p\d|show:e:[\w:-]+|ch:[123]:e:[\w:-]+)$/;
  const talkKeys = (pid) => (S.talk && S.talk[pid]) || [];
  const heard = (pid, k) => talkKeys(pid).some((x) => x === k || x.indexOf(k + ':') === 0);
  function cleanTalk(raw) {
    const out = {};
    S.c.suspects.forEach((p) => {
      if (!S.done.includes('q:' + p)) return;
      const list = raw && typeof raw === 'object' && Array.isArray(raw[p]) ? raw[p] : null;
      // Saves from before conversations existed: count the old interview as asking where they were and about the victim.
      out[p] = list ? list.filter((k, i) => typeof k === 'string' && TALK_KEY.test(k) && list.indexOf(k) === i) : ['where', 'victim:0'];
    });
    return out;
  }
  function motiveKnown(pid) {
    const c = S.c;
    return S.done.includes('b:' + pid) || c.suspects.some((q) => q !== pid && c.gossip[q] === pid && gossipHeard(q));
  }
  // Has this guest passed on their gossip (someone else's motive)?
  function gossipHeard(q) {
    return talkKeys(q).some((k) => k === 'victim:0' || k === 'about:' + S.c.gossip[q]);
  }
  function react(pid, kind, salt) {
    const lines = MC.TALK[person(pid).personality][kind];
    return esc(phrasePicker('t:' + pid + kind + salt)(lines));
  }
  const quote = (text) => '<p>“' + text + '”</p>';
  const claimOf = (pid, s) => S.c.statements[pid].find((st) => st.slot === s);
  // Did the player catch this suspect out at this hour? (Derived from the questions asked, not stored.)
  const caughtAt = (pid, s) => talkKeys(pid).some((k) => {
    const m = /^ch:(\d):(.+)$/.exec(k);
    return m && Number(m[1]) === s && MC.contradicts(S.c, pid, s, m[2]) === 'contradicts';
  });
  const confessed = () => caughtAt(S.c.H, S.c.hSlot);
  const stuck = () => caughtAt(S.c.killer, S.c.T);
  const isTimeClue = (id) => /^e:(sight|acct|trace|ev|pz:drawer)/.test(id);

  function whereLines(pid) {
    const c = S.c;
    const pk = phrasePicker('q:' + pid);
    const parts = [];
    const line = (s, text) => '<p class="clue"><span class="time">' + slot(s) + '</span>“' + text + '”</p>';
    c.statements[pid].forEach((st) => {
      const rn = esc(room(st.room).name);
      const t = slot(st.slot);
      if (st.slot === 0) { parts.push(line(0, 'We all had dinner together in the ' + esc(dinnerRoomName()) + ' at ' + t + ', of course.')); return; }
      let text;
      if (st.with.length) {
        text = pk(['At ' + t + ', I was in the ' + rn + ' with ' + esc(nameList(st.with)) + '.',
          'From ' + t + ' I was in the ' + rn + ', together with ' + esc(nameList(st.with)) + '.']);
      } else if (st.emphaticAlone) {
        text = pk(['At ' + t + ', I was in the ' + rn + '. Alone, the whole hour. Nobody else came in. I would swear to it.',
          'At ' + t + '? The ' + rn + ', and not a soul came in all hour. I would have noticed.']);
      } else {
        text = pk(['At ' + t + ', I was in the ' + rn + '.', 'Around ' + t + '? The ' + rn + ', by myself.',
          'At ' + t + ' I went to the ' + rn + ' and stayed a while.']);
      }
      parts.push(line(st.slot, text));
    });
    return parts;
  }

  function sightLines(pid, only) {
    const c = S.c;
    const pk = phrasePicker('q:' + pid);
    const parts = [];
    const line = (s, text) => '<p class="clue"><span class="time">' + slot(s) + '</span>“' + text + '”</p>';
    const sights = c.sightings.filter((sg) => sg.witness === pid && (!only || sg.subject === only)).sort((a, b) => a.slot - b.slot);
    sights.forEach((sg) => {
      const rn = esc(room(sg.room).name);
      const n = esc(person(sg.subject).name);
      const t = slot(sg.slot);
      let text;
      if (sg.kind === 'aloneSaw') text = 'When I passed the ' + rn + ' at ' + t + ', ' + n + ' was in there, all alone.';
      else if (sg.kind === 'heading') text = 'Just after ' + t + ', I saw ' + n + ' hurrying toward the ' + rn + '. In a terrible rush, too.';
      else text = pk(['Around ' + t + ', I glanced into the ' + rn + ' and saw ' + n + '.', 'I passed the ' + rn + ' at about ' + t + '. ' + n + ' was inside.']);
      parts.push(line(sg.slot, text));
    });
    return parts;
  }

  function gossipLine(pid) {
    const c = S.c;
    return '<p>“If you want someone with a real reason, ask about ' + esc(person(c.gossip[pid]).name) + '. Between you and me… ' +
      esc(fill(c.motives[c.gossip[pid]], c.gossip[pid], c.victim)) + '”</p>';
  }

  // One question and its answer. Returns { ask, say: [html], note }.
  function talkReply(pid, key, cards) {
    const c = S.c;
    const p = person(pid), v = person(c.victim);
    const say = [];
    let ask = '', note = '';
    const R = (kind) => react(pid, kind, key);
    const cardTitle = (id) => (cards[id] ? cards[id].title : 'a clue');
    const m = key.split(':');

    if (m[0] === 'where') {
      ask = 'Where were you this evening, hour by hour?';
      say.push.apply(say, whereLines(pid));
      const sl = sightLines(pid);
      if (sl.length) { say.push('<p class="aside">And did you see anyone else?</p>'); say.push.apply(say, sl); }
      say.push('<p class="eerie">' + esc(phrasePicker('q:' + pid)(place().omens.concat(D.omens))) + '</p>');
      note = 'Added to your timeline and evidence board.';
    } else if (m[0] === 'victim') {
      if (m[1] === '1') {
        ask = 'I know how things stood between you and ' + esc(v.name) + '.';
        say.push(quote(R('admit')));
        say.push('<p class="clue">' + esc(fill(c.motives[pid], pid, c.victim)) + '</p>');
      } else {
        ask = 'How did you know ' + esc(v.name) + '?';
        say.push(quote(R('coy')));
        say.push(gossipLine(pid));
        note = 'Their gossip is in your notebook and on your board.';
      }
    } else if (m[0] === 'things') {
      if (m[1] === '0') {
        ask = 'Tell me about your belongings.';
        say.push(quote(R('things')));
        note = 'Going through their belongings is a separate search, from the Guests page.';
      } else {
        const rr = room(c.belongings[pid].residueRoom);
        ask = 'Why is there ' + esc(rr.residue) + ' on your things?';
        // An honest answer if their own story puts them in that room; otherwise they cannot explain it.
        const st = c.statements[pid].find((x) => x.slot > 0 && x.room === rr.id);
        if (st) say.push(quote('That? I was in the ' + esc(rr.name) + ' at ' + slot(st.slot) + '. I told you so.'));
        else say.push(quote(R('evade')));
      }
    } else if (m[0] === 'about') {
      const q = m[1];
      const o = person(q);
      ask = 'What can you tell me about ' + esc(o.name) + '?';
      c.statements[pid].forEach((st) => {
        if (st.slot > 0 && st.with.includes(q)) say.push('<p class="clue"><span class="time">' + slot(st.slot) + '</span>“We were together in the ' + esc(room(st.room).name) + ' at ' + slot(st.slot) + '.”</p>');
      });
      say.push.apply(say, sightLines(pid, q));
      if (c.gossip[pid] === q) say.push(gossipLine(pid));
      if (!say.length) say.push(quote('I hardly saw ' + esc(o.name) + ' after dinner. I cannot tell you more than that.'));
    } else if (m[0] === 'show') {
      const id = key.slice(5);
      ask = 'You show them: <strong>' + cardTitle(id) + '</strong>.';
      say.push.apply(say, showReply(pid, id, R));
    } else if (m[0] === 'ch') {
      const s = Number(m[1]);
      const id = key.slice(5);
      const st = claimOf(pid, s);
      ask = 'You said you were in the ' + esc(room(st.room).name) + ' at ' + slot(s) + '. Then explain this: <strong>' + cardTitle(id) + '</strong>.';
      const verdict = MC.contradicts(c, pid, s, id);
      if (verdict === 'contradicts' && pid === c.H && s === c.hSlot) {
        say.push(quote(R('confess')));
        const k = D.secrets.indexOf(c.hSecret);
        say.push(quote(esc(MC.TALK.secrets[Math.max(0, k)].split('{room}').join(room(c.hTrue).name))));
        note = esc(p.name) + '\'s story at ' + slot(s) + ' has changed. Your timeline now shows where they really were.';
      } else if (verdict === 'contradicts') {
        say.push(quote(R('rattle')));
        say.push(quote('I was in the ' + esc(room(st.room).name) + ' at ' + slot(s) + '. That is all I will say.'));
        note = esc(p.name) + ' cannot explain it, and will not change their story.';
      } else if (verdict === 'supports') {
        say.push(quote(R('back')));
      } else {
        say.push(quote(R('push')));
        note = 'That clue does not contradict what they told you about ' + slot(s) + '.';
      }
    }
    return { ask, say, note };
  }

  // Their reaction to a clue you show them. Facts come only from the case; otherwise it is a personal reaction.
  function showReply(pid, id, R) {
    const c = S.c;
    const a = id.split(':');
    const own = (st) => (st ? ' I told you I was there.' : '');
    const fitsStory = (rid, s) => { const st = claimOf(pid, s); return st && st.room === rid; };
    if (a[1] === 'trace') {
      const t = c.traces[a[2]];
      if (!t) return [quote(R('shrug'))];
      if (t.pid !== pid) return [quote('That is not mine. It looks like something of ' + esc(person(t.pid).name) + '\'s.')];
      return fitsStory(a[2], t.slot)
        ? [quote('Yes, that is mine. I must have left it in the ' + esc(room(a[2]).name) + '.' + own(true))]
        : [quote('Mine? Well… yes.'), quote(R('evade'))];
    }
    if (a[1] === 'ev' && a[2] === pid) {
      const s = Number(a[3]);
      const e = c.belongings[pid].evidence.find((x) => x.slot === s);
      if (!e) return [quote(R('shrug'))];
      return fitsStory(e.room, s) ? [quote(R('back'))] : [quote(R('evade'))];
    }
    if (a[1] === 'stain' && a[2] === pid) {
      const rr = room(c.belongings[pid].residueRoom);
      const st = c.statements[pid].find((x) => x.slot > 0 && x.room === rr.id);
      return st ? [quote('I was in the ' + esc(rr.name) + ' at ' + slot(st.slot) + '. That is all it means.')] : [quote(R('evade'))];
    }
    if (a[1] === 'motive') {
      if (a[2] === pid) return [quote(R('admit'))];
      return [quote('So ' + esc(person(a[2]).name) + ' had a reason too. I am not surprised.')];
    }
    if (a[1] === 'shoe' && a[2] === pid) {
      const sh = c.puzzles.shoes[pid];
      if (sh.refuses) return [quote(esc(sh.line))];
      return sh.tread === c.puzzles.print.tread
        ? [quote('Plenty of shoes have soles like that. It proves nothing.')]
        : [quote('You saw for yourself. They do not match.')];
    }
    if (a[1] === 'print') return [quote('Then find the shoe that fits it.')];
    if (a[1] === 'watch') {
      const st = claimOf(pid, c.T);
      return [quote(R('shrug')), quote('At ' + slot(c.T) + ' I was in the ' + esc(room(st.room).name) + '.')];
    }
    if (a[1] === 'pz' && a[2] === 'drawer') {
      const x = c.puzzles.drawer.proof.find((y) => y.pid === pid);
      return x ? [quote('Yes, that was me in the ' + esc(room(x.room).name) + '. So the victim saw me. Good.')] : [quote(R('shrug'))];
    }
    if (a[1] === 'pz' && a[2] === 'letter') {
      return person(pid).wealth === c.puzzles.letter.wealth
        ? [quote('Plenty of people here could fit that description.')]
        : [quote('Then it was not me they were meeting. You can see that for yourself.')];
    }
    if (a[1] === 'acct' && a[2] === pid) return [quote('That is what I told you. I have nothing to add.')];
    if (a[1] === 'sight' && a[3] === pid) {
      const s = Number(a[4]);
      const sg = c.sightings.find((x) => x.witness === a[2] && x.subject === pid && x.slot === s);
      if (sg && fitsStory(sg.room, s)) return [quote(R('back'))];
      return [quote(esc(person(a[2]).name) + ' is mistaken.')];
    }
    if (a[1] === 'acct') {
      const st = c.statements[a[2]] && c.statements[a[2]].find((x) => x.slot > 0 && x.with.includes(pid));
      if (st) return fitsStory(st.room, st.slot) ? [quote(R('back'))] : [quote(esc(person(a[2]).name) + ' is mistaken.')];
    }
    return [quote(R('shrug'))];
  }

  // ----- the conversation screen -----
  function talkOptions(pid) {
    const c = S.c, v = person(c.victim);
    const T = S.tmenu;
    const keys = talkKeys(pid);
    const cards = boardEvidence();
    const opt = (key, label) => {
      const done = keys.includes(key);
      return '<button class="talk-opt' + (done ? ' asked' : '') + '" data-act="talk" data-k="' + esc(key) + '"' + (done ? ' disabled' : '') + '>' +
        label + (done ? '<span class="ok" aria-label="asked">✓</span>' : '') + '</button>';
    };
    const menu = (m, label, extra, off) => '<button class="talk-opt more" data-act="talk-menu" data-m="' + m + '"' + (extra || '') + (off ? ' disabled' : '') + '>' + label + '</button>';
    const back = (m) => '<button class="talk-opt back" data-act="talk-menu" data-m="' + m + '">← Back</button>';
    if (T.m === 'about') {
      return '<p class="talk-q">Who do you ask about?</p>' +
        c.suspects.filter((q) => q !== pid).map((q) => opt('about:' + q, avatar(person(q), true) + '<span>' + esc(person(q).name) + '</span>')).join('') + back('main');
    }
    if (T.m === 'show') {
      return '<p class="talk-q">Which clue do you show them?</p>' +
        cards.map((e) => opt('show:' + e.id, '<span class="ic" aria-hidden="true">' + BCAT[e.cat][0] + '</span><span>' + e.title + '</span>')).join('') + back('main');
    }
    if (T.m === 'chs') {
      return '<p class="talk-q">Which part of their story do you challenge?</p>' +
        [1, 2, 3].map((s) => menu('che', '<span class="time">' + slot(s) + '</span><span>“I was in the ' + esc(room(claimOf(pid, s).room).name) + '.”</span>', ' data-s="' + s + '"')).join('') + back('main');
    }
    if (T.m === 'che') {
      const s = T.s;
      const list = cards.filter((e) => isTimeClue(e.id) && e.id !== 'e:acct:' + pid);
      return '<p class="talk-q">At ' + slot(s) + ' they say they were in the ' + esc(room(claimOf(pid, s).room).name) + '. What proves otherwise?</p>' +
        (list.length ? list.map((e) => opt('ch:' + s + ':' + e.id, '<span class="ic" aria-hidden="true">' + BCAT[e.cat][0] + '</span><span>' + e.title + '</span>')).join('')
          : '<p class="hint">You have no clues about who was where yet.</p>') + back('chs');
    }
    const vk = 'victim:' + (motiveKnown(pid) ? 1 : 0);
    const tk = 'things:' + (S.done.includes('b:' + pid) ? 1 : 0);
    return '<p class="talk-q">What do you ask?</p>' +
      opt('where', 'Where were you this evening?') +
      opt(vk, vk === 'victim:1' ? 'I know how things stood between you and ' + esc(v.short) + '.' : 'How did you know ' + esc(v.name) + '?') +
      menu('about', 'Ask about someone else…') +
      opt(tk, tk === 'things:1' ? 'About what I found in your belongings…' : 'Tell me about your belongings.') +
      menu('show', 'Show them a clue…', '', !cards.length) +
      (heard(pid, 'where') ? menu('chs', 'Challenge their story…') : '');
  }

  function drawTalk(scrollTo) {
    const pid = S.tmenu.pid;
    const c = S.c, p = person(pid);
    const cards = {};
    boardEvidence().forEach((e) => { cards[e.id] = e; });
    const idx = S.done.indexOf('q:' + pid);
    const them = (html) => '<div class="talk-row them">' + avatar(p, true) + '<div class="bubble" data-note="' + esc(p.name) + ', when questioned">' + html + noteBtnFor(html) + '</div></div>';
    const log = [them('<p>“' + esc(p.greeting) + '”</p>')];
    talkKeys(pid).forEach((k) => {
      const r = talkReply(pid, k, cards);
      log.push('<div class="talk-row you"><div class="bubble">' + r.ask + '</div></div>');
      log.push(them(r.say.join('')));
      if (r.note) log.push('<p class="talk-note">' + r.note + '</p>');
    });
    // Coming back to someone later: how they greet you depends on how the night has gone.
    if (S.tmenu.mood) { log.push('<p class="talk-note">Later…</p>'); log.push(them('<p>“' + esc(S.tmenu.mood) + '”</p>')); }
    const body = (p.portrait ? '<div class="talk-face" style="--pc:' + p.color + '">' + faceImg(p, 'talk-face-img') + '</div>' : '') +
      '<p class="hint talk-hint">Ask as much as you like. Questions cost no extra time once you are talking.</p>' +
      '<div class="talk-log" aria-live="polite">' + log.join('') + '</div>' +
      '<div class="talk-opts" role="group" aria-label="Your questions">' + talkOptions(pid) + '</div>';
    showModal(clock(startMin() + Math.max(0, idx) * ACTION_MIN) + ' · ' + esc(p.title), 'Questioning ' + p.name, p.color, body,
      (S.tdawn ? '<p class="dawn-warn">' + esc(fmt(place().endWarn)) + '</p>' : '') +
      '<button class="btn primary" data-act="close-modal">' + (S.tdawn ? 'Make your accusation' : 'Done') + '</button>');
    const asks = modalBody.querySelectorAll('.talk-row.you');
    const target = scrollTo === 'end' ? asks[asks.length - 1] || null
      : scrollTo === 'opts' ? modalBody.querySelector('.talk-opts') : null;
    if (target) {
      const top = target.getBoundingClientRect().top - modalBody.getBoundingClientRect().top + modalBody.scrollTop - 12;
      modalBody.scrollTop = top;
    } else modalBody.scrollTop = 0;
    const first = modalBody.querySelector('.talk-opts button:not([disabled])');
    if (first && scrollTo) first.focus({ preventScroll: true });
  }

  // What a guest says when you come back to them. It reflects only what has already happened between you.
  function moodLine(pid) {
    const c = S.c;
    const pk = phrasePicker('mood:' + pid + S.done.length);
    if (pid === c.killer && stuck()) return pk(MC.TALK.mood.cold);
    if (pid === c.H && confessed()) return pk(MC.TALK.mood.relieved);
    return pk(S.done.length / totalLeads() >= 0.66 ? MC.TALK.mood.late : MC.TALK.mood.again);
  }

  function openTalk(pid, isNew) {
    stopPzTimer();
    PZ = null;
    if (!S.talk[pid]) { S.talk[pid] = []; save(); }
    S.tmenu = { pid, m: 'main', mood: talkKeys(pid).length ? moodLine(pid) : '' };
    S.tdawn = isNew && leadsLeft() <= 0;
    drawTalk(talkKeys(pid).length ? 'opts' : null);
    if (!talkKeys(pid).length) {
      const btn = modalBody.querySelector('.talk-opts button');
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  function talkAction(d) {
    if (!S.tmenu) return;
    const pid = S.tmenu.pid;
    if (d.act === 'talk-menu') {
      S.tmenu.m = d.m;
      if (d.s) S.tmenu.s = Number(d.s);
      drawTalk('opts');
      return;
    }
    const k = d.k;
    if (!TALK_KEY.test(k) || talkKeys(pid).includes(k)) return;
    S.talk[pid].push(k);
    S.tmenu.m = 'main';
    S.tmenu.mood = '';
    save();
    render();
    drawTalk('end');
    const ch = /^ch:(\d):(.+)$/.exec(k);
    if (ch && MC.contradicts(S.c, pid, Number(ch[1]), ch[2]) === 'contradicts') discovery();
  }

  // ---------- exploring a room ----------
  // Entering a room costs 30 minutes. Inside, every object can be inspected for free, but a clue only counts
  // as found once you have inspected the object it is in. S.objs[room] = keys inspected, in order.
  // Saves from before rooms could be explored have no entry, so every object in a searched room counts as inspected.
  const OBJ_SLOTS = [[50, 27], [16, 40], [84, 40], [20, 74], [80, 74]];
  // Painted rooms (art/rooms/<place>-<room>-old.jpg), old-fashioned cases only for now.
  // Each list holds where the room's five objects were painted, as [left %, top %], in the order of places.js OBJECTS.
  const ROOM_ART = {
    'manor-dininghall': [[50, 43], [33, 45], [20, 66], [85, 68], [72, 53]],
    'manor-kitchen': [[52, 54], [33, 51], [17, 63], [65, 38], [86, 62]],
    'manor-library': [[76, 44], [46, 26], [57, 55], [85, 58], [29, 60]],
    'plane-berths': [[49, 48], [27, 60], [66, 33], [40, 66], [87, 67]],
    'plane-cabin': [[55, 30], [30, 57], [21, 29], [82, 18], [74, 62]],
    'plane-cockpit': [[62, 58], [30, 57], [77, 62], [70, 44], [50, 36]],
    'plane-galley': [[51, 48], [32, 56], [22, 72], [72, 42], [79, 68]],
    'plane-hold': [[51, 40], [36, 58], [69, 57], [20, 74], [83, 76]],
    'plane-skylounge': [[46, 42], [47, 59], [20, 62], [72, 40], [80, 64]],
    'plane-washroom': [[34, 45], [35, 64], [50, 26], [77, 55], [67, 74]],
    'ship-bridge': [[49, 18], [37, 52], [22, 54], [83, 60], [66, 47]],
    'ship-engine': [[50, 32], [36, 56], [18, 60], [84, 44], [79, 75]],
    'ship-hold': [[51, 32], [29, 49], [24, 73], [74, 52], [79, 78]],
    'ship-promenade': [[14, 30], [34, 40], [32, 68], [74, 48], [84, 70]],
    'train-baggage': [[50, 50], [35, 48], [22, 78], [68, 52], [81, 78]],
    'train-cab': [[26, 45], [36, 65], [19, 70], [72, 34], [60, 16]],
    'train-dining': [[51, 38], [28, 52], [17, 75], [72, 52], [80, 70]],
    'train-kitchen': [[53, 33], [22, 40], [25, 66], [80, 75], [79, 40]],
    'train-lounge': [[34, 33], [52, 45], [22, 68], [69, 48], [83, 70]],
    'train-observation': [[53, 47], [33, 60], [12, 50], [69, 45], [85, 62]],
    'train-sleeping': [[50, 55], [35, 33], [23, 70], [78, 22], [65, 64]],
  };
  function roomArt(rid) {
    const k = S.c.place + '-' + rid;
    return S.c.era === 'old' && ROOM_ART[k] ? { src: 'art/rooms/' + k + '-old.jpg', spots: ROOM_ART[k] } : null;
  }

  function roomObjects(rid) {
    const c = S.c;
    if (!c._objs) c._objs = {};
    if (c._objs[rid]) return c._objs[rid];
    const r = room(rid);
    const art = roomArt(rid);
    // Which ordinary object holds the dropped item, the scrap of paper or the puzzle. Fixed for each case.
    const items = [];
    if (c.traces[rid]) items.push('trace');
    if (c.codeNotes[rid]) items.push('code');
    PUZZLE_IDS.forEach((id) => { if (c.puzzles[id].room === rid) items.push('pz:' + id); });
    const rng = MC.makeRng((c.seed * 977 + hashStr(c.place + rid)) >>> 0);
    const decor = [2, 3, 4];
    for (let i = decor.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = decor[i]; decor[i] = decor[j]; decor[j] = t; }
    const roleOf = {};
    items.forEach((it, i) => { roleOf[decor[i]] = it; });
    const list = r.objs.map((d, i) => ({ key: 'o' + i, label: d[0], icon: d[1], text: d[2], slot: art ? art.spots[i] : OBJ_SLOTS[i],
      role: i === 0 ? 'weapon' : i === 1 ? 'hide' : roleOf[i] || 'none' }));
    if (rid === c.crimeRoom) {
      list.push({ key: 'body', label: 'The body', icon: '†', text: '', slot: art ? [46, 82] : [50, 55], role: 'body' });
      list.push({ key: 'print', label: 'Footprint', icon: '👣', text: '', slot: art ? [63, 91] : [50, 82], role: 'print' });
    }
    c._objs[rid] = list;
    return list;
  }
  function inspected(rid, key) {
    if (!S.done.includes('s:' + rid)) return false;
    const l = S.objs[rid];
    return !l || l.includes(key);
  }
  // Has the player found what this room hides in the object with this role?
  function seen(rid, role) {
    if (!S.done.includes('s:' + rid)) return false;
    const o = roomObjects(rid).find((x) => x.role === role);
    return !!o && inspected(rid, o.key);
  }
  const roomDone = (rid) => roomObjects(rid).filter((o) => inspected(rid, o.key)).length;
  function cleanObjs(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    S.c.rooms.forEach((r) => {
      if (!S.done.includes('s:' + r.id) || !Array.isArray(raw[r.id])) return;
      const keys = roomObjects(r.id).map((o) => o.key);
      out[r.id] = raw[r.id].filter((k, i, a) => keys.includes(k) && a.indexOf(k) === i);
    });
    return out;
  }

  // What you find when you inspect one object.
  function objResult(rid, o) {
    const c = S.c;
    const r = room(rid);
    const w = weaponById(c.weapon);
    const lead = '<p class="obj-say"><strong>' + esc(o.label) + '.</strong> ' + esc(o.text) + '</p>';
    if (o.role === 'body') {
      return '<p>' + esc(person(c.victim).name) + ' lies where ' + esc(person(c.finder).name) + ' found the body at ' + clock(c.foundMin) + '.</p>' +
        '<p class="clue"><strong>The victim\'s watch:</strong> smashed in the struggle, stopped at ' + watchTime() + '.</p>' +
        '<p class="clue"><strong>The wound:</strong> ' + esc(D.wounds[w.wound]) + '</p>';
    }
    if (o.role === 'print') {
      return '<div class="clue print-clue">' + soleSVG(c.puzzles.print.tread) + '<div><strong>A footprint</strong> beside the body, left in ' +
        esc(r.residue) + '. The sole has ' + esc(treadName(c.puzzles.print.tread)) + '. It is not the victim\'s.' +
        '<br><small>Ask the guests to show you their shoes. Asking takes no time.</small></div></div>';
    }
    if (o.role === 'weapon') {
      const hw = c.weapons.find((x) => x.home === rid);
      return lead + (hw.id === c.weapon
        ? '<div class="clue wpn-clue"><span class="wpn-pic gone">' + weaponImg(hw) + '</span><p><strong>Something is missing:</strong> ' + esc(hw.empty) + '.</p></div>'
        : '<div class="clue muted wpn-clue"><span class="wpn-pic">' + weaponImg(hw) + '</span><p>The ' + esc(hw.name) + (many(hw) ? ' are in their usual place' : ' is in its usual place') + ', untouched.</p></div>');
    }
    if (o.role === 'hide') {
      return lead + (rid === c.hideRoom
        ? '<div class="clue wpn-clue"><span class="wpn-pic">' + weaponImg(w) + '</span><p><strong>Hidden ' + esc(r.hide) + ':</strong> the ' + esc(w.name) + '. Someone has wiped ' + (many(w) ? 'them' : 'it') + ', but not well enough.</p></div>'
        : '<p class="clue muted">You check ' + esc(r.hide) + '. Nothing is hidden there.</p>');
    }
    if (o.role === 'trace') {
      const tr = c.traces[rid], tp = person(tr.pid);
      return lead + '<p class="clue"><span class="time">' + slot(tr.slot) + '</span><strong>Found:</strong> ' + esc(tp.item) +
        '. It belongs to ' + esc(tp.name) + '. Left around ' + slot(tr.slot) + ', judging by ' + esc(tr.reason) + '.</p>';
    }
    if (o.role === 'code') {
      const owner = c.codeNotes[rid];
      return lead + '<p class="clue"><strong>A scrap of paper</strong>, tucked out of sight: "' + esc(person(owner).short) + ' — phone code ' +
        c.belongings[owner].code + '". ' + esc(person(owner).name) + '\'s phone can be unlocked now.' +
        (S.done.includes('b:' + owner) ? ' Open their belongings again to read it. It costs no extra time.' : '') + '</p>';
    }
    if (o.role.indexOf('pz:') === 0) {
      const id = o.role.slice(3);
      return lead + '<div class="clue"><strong>' + esc(cap(pzName(id))) + ':</strong> ' + esc(pzFound(id)) +
        '<br><button class="btn pz-open" data-act="puzzle" data-id="' + id + '" data-back="' + rid + '">' +
        (S.solved.includes(id) ? '✓ Solved · look again' : 'Take a closer look') + '</button></div>';
    }
    // Nothing here. One ordinary thing in every room carries the room's uncanny moment.
    const spooky = roomObjects(rid).filter((x) => x.role === 'none')[0];
    return lead + (spooky && spooky.key === o.key ? '<p class="eerie">' + esc(phrasePicker('s:' + rid)(r.eerie)) + '</p>' : '<p class="clue muted">Nothing of interest.</p>');
  }

  // A simple drawing of the room, in the room's colour, with the shape of the place's windows.
  function sceneBackdrop() {
    const p = S.c.place;
    let win = '';
    if (p === 'ship') win = '<circle cx="150" cy="95" r="22" class="win"/><circle cx="250" cy="95" r="22" class="win"/><circle cx="150" cy="95" r="22" class="frame"/><circle cx="250" cy="95" r="22" class="frame"/>';
    else if (p === 'train') win = '<rect x="105" y="68" width="85" height="54" rx="8" class="win"/><rect x="210" y="68" width="85" height="54" rx="8" class="win"/><rect x="105" y="68" width="85" height="54" rx="8" class="frame"/><rect x="210" y="68" width="85" height="54" rx="8" class="frame"/>';
    else if (p === 'plane') win = '<rect x="128" y="66" width="34" height="52" rx="17" class="win"/><rect x="183" y="66" width="34" height="52" rx="17" class="win"/><rect x="238" y="66" width="34" height="52" rx="17" class="win"/><rect x="128" y="66" width="34" height="52" rx="17" class="frame"/><rect x="183" y="66" width="34" height="52" rx="17" class="frame"/><rect x="238" y="66" width="34" height="52" rx="17" class="frame"/>';
    else win = '<path d="M172 150V80a28 28 0 0 1 56 0v70z" class="win"/><path d="M172 150V80a28 28 0 0 1 56 0v70zM200 52v98M172 102h56" class="frame"/>';
    let boards = '';
    for (let i = 1; i < 8; i++) boards += '<line x1="' + (70 + i * 32.5) + '" y1="170" x2="' + (i * 50) + '" y2="300" class="board-line"/>';
    return '<svg class="scene-bg" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><radialGradient id="lampglow" cx="50%" cy="10%" r="60%"><stop offset="0" stop-color="#ffd58a" stop-opacity=".28"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient></defs>' +
      '<polygon points="0,0 400,0 330,24 70,24" class="ceil"/>' +
      '<polygon points="0,0 70,24 70,170 0,300" class="wall-side"/><polygon points="400,0 330,24 330,170 400,300" class="wall-side"/>' +
      '<rect x="70" y="24" width="260" height="146" class="wall-back"/>' +
      '<polygon points="70,170 330,170 400,300 0,300" class="floor"/>' + boards +
      win + '<rect x="0" y="0" width="400" height="300" fill="url(#lampglow)"/></svg>';
  }

  // The room view. Re-drawn after each inspection; "latest" is the object just inspected.
  let ROOM = null;
  function drawRoom(latest) {
    const c = S.c;
    const rid = ROOM.rid;
    const r = room(rid);
    const objs = roomObjects(rid);
    const art = roomArt(rid);
    const done = objs.filter((o) => inspected(rid, o.key));
    const order = S.objs[rid] ? S.objs[rid].map((k) => objs.find((o) => o.key === k)).filter(Boolean) : objs;
    const idx = S.done.indexOf('s:' + rid);
    const hots = objs.map((o) => {
      const d = inspected(rid, o.key);
      return '<button class="hot' + (d ? ' looked' : '') + (o.key === latest ? ' just' : '') + (o.role === 'body' ? ' body' : '') + '" data-act="obj" data-k="' + o.key +
        '" style="left:' + o.slot[0] + '%;top:' + o.slot[1] + '%" aria-label="' + esc(o.label) + (d ? ', inspected' : '') + '">' +
        '<span class="hot-ic" aria-hidden="true">' + (art && o.role !== 'body' ? '' : o.icon) + '</span><span class="hot-label">' + esc(o.label) + '</span></button>';
    }).join('');
    const finds = order.map((o) => {
      const html = objResult(rid, o);
      return '<li class="find' + (o.key === latest ? ' just' : '') + '" id="find-' + o.key + '" data-note="The ' + esc(r.name) + ': ' + esc(o.label) + '">' + html + noteBtnFor(html) + '</li>';
    }).join('');
    const body = '<p>' + esc(r.desc) + '</p>' +
      '<div class="scene place-' + c.place + (art ? ' has-art' : '') + '" style="--room:' + r.color + '">' + sceneBackdrop() +
      (art ? '<img class="scene-art" src="' + art.src + '" alt="" decoding="async" onerror="this.parentNode.classList.remove(\'has-art\');this.remove()">' : '') + hots + '</div>' +
      '<div class="scene-bar"><span>' + (done.length === objs.length ? 'You have looked at everything here.' : 'Tap anything to inspect it · ' + done.length + ' of ' + objs.length + ' looked at') + '</span>' +
      (done.length < objs.length ? '<button class="mini-btn" data-act="obj-all">Search everything</button>' : '') + '</div>' +
      (finds ? '<ol class="finds" aria-live="polite">' + finds + '</ol>' : '<p class="hint">Nothing looked at yet. Inspecting things costs no extra time.</p>');
    showModal(clock(startMin() + Math.max(0, idx) * ACTION_MIN) + (rid === c.crimeRoom ? ' · The crime scene' : ''), 'The ' + r.name, r.color, body,
      (ROOM.dawn ? '<p class="dawn-warn">' + esc(fmt(place().endWarn)) + '</p>' : '') +
      '<button class="btn primary" data-act="close-modal">' + (ROOM.dawn ? 'Make your accusation' : 'Leave the room') + '</button>');
    const el = latest && document.getElementById('find-' + latest);
    if (el) {
      modalBody.scrollTop = el.getBoundingClientRect().top - modalBody.getBoundingClientRect().top + modalBody.scrollTop - 60;
    } else modalBody.scrollTop = 0;
  }
  function openRoom(rid, isNew) {
    stopPzTimer();
    PZ = null;
    S.tmenu = null;
    if (isNew) { S.objs[rid] = []; save(); }
    ROOM = { rid, dawn: leadsLeft() <= 0 };
    drawRoom(null);
    const first = modalBody.querySelector('.hot:not(.looked)') || modalBody.querySelector('.modal-foot .btn.primary');
    if (first) first.focus({ preventScroll: true });
  }
  function inspect(key) {
    if (!ROOM) return;
    const rid = ROOM.rid;
    const objs = roomObjects(rid);
    const keys = key === '*' ? objs.map((o) => o.key) : [key];
    if (!S.objs[rid]) return drawRoom(key === '*' ? null : key);
    const c = S.c;
    let big = false;
    keys.forEach((k) => {
      const o = objs.find((x) => x.key === k);
      if (!o || S.objs[rid].includes(k)) return;
      S.objs[rid].push(k);
      // The finds that matter most get a moment of their own.
      if (o.role === 'body' || o.role === 'print' || o.role === 'code' || (o.role === 'hide' && rid === c.hideRoom) ||
        (o.role === 'weapon' && c.weapons.find((x) => x.home === rid).id === c.weapon)) big = true;
    });
    save();
    render();
    drawRoom(key === '*' ? null : key);
    if (big) discovery();
    const again = modalBody.querySelector('[data-act="obj"][data-k="' + key + '"]');
    if (again) again.focus({ preventScroll: true });
  }

  function evidenceText(pid, e) {
    const rn = esc(room(e.room).name);
    const t = slotTime(e.slot, e.minute);
    const pk = phrasePicker('e:' + pid + e.slot);
    switch (e.kind) {
      case 'chit': return 'A signed chit for one brandy, brought to the ' + rn + ' at ' + t + '.';
      case 'ticket': return 'A crossword torn from the paper, with "' + rn + ', ' + t + '" pencilled in the margin.';
      case 'sketch': return 'A pencil sketch of the ' + rn + ', dated ' + t + ' in the corner.';
      case 'letter': return 'An unfinished letter, headed "' + rn + ', ' + t + '".';
      case 'receipt': return pk(['A delivery slip: one hot chocolate, brought to the ' + rn + ' at ' + t + '.',
        'A sticky note in their own handwriting: "' + rn + ', ' + t + '. Call Mum back."']);
      case 'photo': return pk(['A photo taken in the ' + rn + ' at ' + t + '. Mostly blur, and someone\'s elbow.',
        'A selfie in the ' + rn + ', timestamped ' + t + '.']);
      default: return pk(['A text sent at ' + t + ': "Stuck in the ' + room(e.room).short.toLowerCase() + '. So bored."',
        'A voice memo recorded in the ' + rn + ' at ' + t + '. Just rain and muttering.']);
    }
  }

  function belongingsHTML(pid) {
    const c = S.c;
    const p = person(pid);
    const b = c.belongings[pid];
    const clue = (text, s) => '<p class="clue">' + (s !== undefined ? '<span class="time">' + slot(s) + '</span>' : '') + text + '</p>';
    const parts = ['<p>You go through ' + esc(p.name) + '\'s ' + esc(b.container) + '.</p>'];
    parts.push('<p class="clue muted">Inside: ' + esc(b.flavor) + '.</p>');

    const loose = b.evidence.filter((e) => !e.inPhone);
    const inPhone = b.evidence.filter((e) => e.inPhone);
    loose.forEach((e) => parts.push(clue(evidenceText(pid, e), e.slot)));

    if (b.victim) {
      inPhone.forEach((e) => parts.push(clue(evidenceText(pid, e), e.slot)));
      const m = b.meeting;
      const text = c.era === 'old'
        ? 'The last diary entry, written this evening: "' + slot(m.slot) + ', the ' + esc(room(m.room).name) + '. They had better come alone."'
        : 'A message sent this evening, to a number that has been deleted: "' + esc(room(m.room).name) + ', ' + slot(m.slot) + '. Come alone. We settle this tonight."';
      parts.push(clue('<strong>' + text + '</strong>', m.slot));
    } else {
      if (b.phone) {
        if (phoneOpen(pid)) {
          parts.push('<p class="aside">' + (b.locked ? '🔓 You unlock the phone with the code you found in the ' + esc(room(b.codeRoom).name) + '.' : 'The phone is unlocked.') + '</p>');
          inPhone.forEach((e) => parts.push(clue(evidenceText(pid, e), e.slot)));
        } else {
          parts.push('<p class="clue muted">🔒 The phone is locked. The lock screen wants a 4-digit code. Maybe someone wrote it down in one of the rooms.</p>');
        }
      }
      const rr = room(b.residueRoom);
      parts.push(clue('<strong>A stain:</strong> ' + esc(cap(rr.residue)) + ' on ' + esc(b.residueSpot) + '. Only the ' + esc(rr.name) + ' has anything like that.'));
      parts.push('<p class="aside">Among the papers, you piece together how things stood with ' + esc(person(c.victim).name) + ':</p>');
      parts.push('<p class="clue">' + esc(fill(c.motives[pid], pid, c.victim)) + '</p>');
    }
    return { title: (b.victim ? 'The victim\'s belongings' : p.name + '\'s belongings'), sub: b.victim ? p.name : p.title, body: parts.join(''), color: p.color };
  }

  // ---------- puzzles, shoes and the footprint ----------
  const printFound = () => seen(S.c.crimeRoom, 'print');
  function treadName(id) { return MC.PEOPLE.treads.find((x) => x.id === id).name; }
  function pzName(id) {
    return id === 'drawer' ? (S.c.era === 'old' ? 'locked drawer' : 'locked safe') : id === 'letter' ? 'torn letter' : 'coded note';
  }
  function pzFound(id) {
    const v = person(S.c.victim).name;
    if (id === 'drawer') {
      return S.c.era === 'old'
        ? 'A small drawer with three brass number dials, and ' + v + '\'s initials on it. It will not open.'
        : 'A small travel safe with a three-number lock, tagged with ' + v + '\'s name. It will not open.';
    }
    if (id === 'letter') return 'Scraps of a letter in ' + v + '\'s handwriting, torn into strips and pushed out of sight.';
    return 'A scrap of paper covered in jumbled letters, dropped by someone in a hurry. It looks like a simple code.';
  }
  const fmtSecs = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  const SOLE = 'M30 4C46 4 54 20 52 40C50 58 44 66 44 78C44 88 48 96 46 106C44 116 36 118 30 118C24 118 16 116 14 106C12 96 16 88 16 78C16 66 10 58 8 40C6 20 14 4 30 4Z';
  let soleCount = 0;
  function soleSVG(tread) {
    const id = 'sole' + (++soleCount);
    let m = '';
    if (tread === 'zigzag') {
      for (let y = 14; y < 120; y += 13) m += '<polyline points="6,' + y + ' 18,' + (y - 7) + ' 30,' + y + ' 42,' + (y - 7) + ' 54,' + y + '"/>';
    } else if (tread === 'diamonds') {
      for (let y = 8, row = 0; y < 120; y += 13, row++) {
        for (let x = (row % 2 ? 18 : 12); x < 56; x += 12) m += '<path d="M' + x + ' ' + (y - 5) + 'l5 5-5 5-5-5z"/>';
      }
    } else if (tread === 'studs') {
      for (let y = 10; y < 120; y += 11) for (let x = 12; x < 56; x += 9) m += '<circle cx="' + x + '" cy="' + y + '" r="2.4"/>';
    } else if (tread === 'bars') {
      for (let y = 10; y < 120; y += 9) m += '<line x1="4" y1="' + y + '" x2="56" y2="' + y + '"/>';
    } else if (tread === 'waves') {
      for (let y = 12; y < 120; y += 12) m += '<path d="M4 ' + y + 'q6.5-8 13 0t13 0t13 0t13 0"/>';
    } else {
      [5, 11, 17].forEach((r) => { m += '<circle cx="30" cy="36" r="' + r + '"/>'; });
      [4, 9, 14].forEach((r) => { m += '<circle cx="30" cy="98" r="' + r + '"/>'; });
    }
    return '<svg class="sole" viewBox="0 0 60 122" role="img" aria-label="A shoe sole with ' + esc(treadName(tread)) + '">' +
      '<defs><clipPath id="' + id + '"><path d="' + SOLE + '"/></clipPath></defs>' +
      '<path class="sole-shape" d="' + SOLE + '"/><g class="sole-marks" clip-path="url(#' + id + ')">' + m + '</g></svg>';
  }

  function showModal(kicker, title, color, body, foot) {
    modalBody.innerHTML =
      '<div class="modal-head" style="--room:' + color + '"><p class="kicker">' + kicker + '</p>' +
      '<h2 id="modal-title">' + esc(title) + '</h2></div>' +
      '<div class="modal-content">' + body + '</div>' +
      '<div class="modal-foot"><div class="foot-row">' +
      (S.screen === 'investigate' ? '<button class="btn ghost nb-btn" data-act="nb-open" aria-label="Open the notebook">' + ico('notebook') + '<span class="nb-word"> Notebook</span></button>' : '') + foot + '</div></div>';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }
  function focusModal() {
    modalBody.scrollTop = 0;
    const btn = modalBody.querySelector('.modal-foot .btn');
    if (btn) btn.focus({ preventScroll: true });
  }

  // Asking for shoes is free. Some guests say no on harder settings.
  function askShoes(pid) {
    const c = S.c;
    if (!c.suspects.includes(pid) || !printFound()) return;
    const firstLook = !S.shoes.includes(pid);
    if (firstLook) { S.shoes.push(pid); save(); render(); }
    const p = person(pid);
    const sh = c.puzzles.shoes[pid];
    if (firstLook && !sh.refuses && sh.tread === c.puzzles.print.tread) setTimeout(discovery, 0);
    let body;
    if (sh.refuses) {
      body = '<p>You ask ' + esc(p.name) + ' to show you their shoes.</p>' +
        '<p class="say">“' + esc(sh.line) + '”</p>' +
        '<p class="clue muted">You catch a glimpse of ' + esc(sh.name) + ', but not the soles. A refusal proves nothing by itself.</p>';
    } else {
      const match = sh.tread === c.puzzles.print.tread;
      body = '<p>' + esc(p.name) + ' hands over a pair of ' + esc(sh.name) + '.</p>' +
        '<div class="shoe-compare"><figure>' + soleSVG(c.puzzles.print.tread) + '<figcaption>The footprint</figcaption></figure>' +
        '<figure>' + soleSVG(sh.tread) + '<figcaption>' + esc(p.short) + '\'s shoe</figcaption></figure></div>' +
        '<p class="clue">' + (match
          ? '<strong>The tread fits the footprint.</strong> Check whether anyone else wears the same sole.'
          : 'The sole has ' + esc(treadName(sh.tread)) + '. <strong>It does not fit the footprint.</strong>') + '</p>';
    }
    showModal(esc(p.title), p.name + '\'s shoes', p.color, '<div data-note="' + esc(p.name) + '\'s shoes">' + body + '</div>', '<button class="btn primary" data-act="close-modal">Done</button>');
    focusModal();
  }

  // The puzzle on screen right now, if any.
  let PZ = null;
  const pzLimit = (id) => (TIMERS[S.diff] ? TIMERS[S.diff][id] : 0);
  function stopPzTimer() { if (PZ && PZ.timer) { clearInterval(PZ.timer); PZ.timer = null; } }

  function riddleText(cl) {
    const v = cl[1];
    const diff = (a, b) => (v === 0 ? 'The ' + a + ' and ' + b + ' numbers are the same.'
      : 'The ' + a + ' number is ' + Math.abs(v) + (v > 0 ? ' more' : ' less') + ' than the ' + b + '.');
    switch (cl[0]) {
      case 'sum': return 'The three numbers add up to ' + v + '.';
      case 'd12': return diff('first', 'second');
      case 'd32': return diff('third', 'second');
      case 'par1': return 'The first number is ' + (v ? 'odd' : 'even') + '.';
      case 'par3': return 'The third number is ' + (v ? 'odd' : 'even') + '.';
      case 'prod13': return 'The first and third numbers multiply to make ' + v + '.';
      default: return 'The biggest of the three is ' + v + '.';
    }
  }
  function letterLines() {
    const c = S.c;
    const means = ['', 'never had two coins to rub together', 'always lived comfortably enough', 'more money than anyone needs'][c.puzzles.letter.wealth];
    return ['My dear friend, I must tell you what I', 'have learned this evening. Later tonight I am',
      'meeting someone in the ' + room(c.crimeRoom).name + ', alone. They', 'have ' + means + ', and',
      'still they want more from me. If I am not at', 'breakfast, show this letter to the police.'];
  }
  function letterMeaning() {
    const w = S.c.puzzles.letter.wealth;
    return 'the person they were meeting ' + ['', 'is poor', 'is comfortably off, neither poor nor rich', 'is rich'][w] +
      '. Jobs and belongings show how well-off each guest is.';
  }
  const cipherPlain = () => 'MOVE IT FROM THE ' + room(S.c.hideRoom).name.toUpperCase() + ' BEFORE MORNING';
  function shiftText(text, n) {
    return text.replace(/[A-Z]/g, (ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + n + 26) % 26) + 65));
  }

  function pzPlayHTML(id) {
    const c = S.c;
    const msg = PZ.msg ? '<p class="pz-msg" role="status">' + esc(PZ.msg) + '</p>' : '';
    if (id === 'drawer') {
      return '<p>A card is taped underneath, in the victim\'s handwriting: “In case I forget.”</p>' +
        '<ul class="pz-hints">' + c.puzzles.drawer.clues.map((cl) => '<li>' + esc(riddleText(cl)) + '</li>').join('') +
        '<li>Each number is from 1 to 9.</li></ul>' +
        '<div class="pz-dials">' + PZ.dials.map((d, i) =>
          '<div class="dial"><button class="dial-btn" data-act="pz-dial" data-i="' + i + '" data-d="1" aria-label="Number ' + (i + 1) + ' up">▲</button>' +
          '<span class="dial-num" aria-label="Number ' + (i + 1) + '">' + d + '</span>' +
          '<button class="dial-btn" data-act="pz-dial" data-i="' + i + '" data-d="-1" aria-label="Number ' + (i + 1) + ' down">▼</button></div>').join('') +
        '</div>' + msg + '<button class="btn primary pz-go" data-act="pz-try">Try the lock</button>';
    }
    if (id === 'letter') {
      const lines = letterLines();
      return '<p>Put the strips back in order, top to bottom. Tap two strips to swap them.</p>' +
        '<div class="strips">' + PZ.order.map((li, pos) =>
          '<button class="strip' + (PZ.sel === pos ? ' selected' : '') + '" data-act="pz-strip" data-i="' + pos + '" aria-pressed="' + (PZ.sel === pos) + '">' +
          esc(lines[li]) + '</button>').join('') + '</div>' + msg;
    }
    return '<p>Every letter has been swapped for another, a fixed number of places along the alphabet. Turn the wheel until the note makes sense.</p>' +
      '<p class="cipher-text">' + esc(shiftText(shiftText(cipherPlain(), c.puzzles.cipher.shift), -PZ.shift)) + '</p>' +
      '<div class="pz-wheel"><button class="dial-btn" data-act="pz-shift" data-d="-1" aria-label="Turn the wheel back">◀</button>' +
      '<span>Wheel at <strong>' + PZ.shift + '</strong></span>' +
      '<button class="dial-btn" data-act="pz-shift" data-d="1" aria-label="Turn the wheel forward">▶</button></div>' +
      msg + '<button class="btn primary pz-go" data-act="pz-read">It makes sense now</button>';
  }

  function pzSolvedHTML(id) {
    const c = S.c;
    if (id === 'drawer') {
      const pr = c.puzzles.drawer.proof;
      return '<p>The lock clicks open at <strong>' + c.puzzles.drawer.code.split('').join(' ') + '</strong>. Inside is a page of notes in the victim\'s handwriting, written tonight.</p>' +
        '<p class="clue"><span class="time">' + slot(c.T) + '</span>“Just after ' + slot(c.T) + ': passed ' +
        pr.map((x) => esc(person(x.pid).name) + ' in the ' + esc(room(x.room).name)).join(', and ') + '. Neither of them saw me.”</p>' +
        '<p class="aside">Both sightings are now on your timeline.</p>';
    }
    if (id === 'letter') {
      return '<p>The strips fit together. The letter was never sent.</p>' +
        '<p class="say">“' + esc(letterLines().join(' ')) + '”</p>' +
        '<p class="clue"><strong>What it tells you:</strong> ' + esc(cap(letterMeaning())) + '</p>';
    }
    return '<p>The letters fall into place.</p><p class="cipher-text solved">' + esc(cipherPlain()) + '</p>' +
      '<p class="clue"><strong>What it tells you:</strong> something is hidden in the ' + esc(room(c.hideRoom).name) + '. Search it if you have not yet.</p>';
  }

  function drawPuzzle() {
    const id = PZ.id;
    const r = room(S.c.puzzles[id].room);
    const limit = pzLimit(id);
    let body, foot;
    if (PZ.phase === 'done') {
      // Only a solved puzzle's result can be saved to notes, never the puzzle while you are working on it.
      body = '<div data-note="The ' + esc(pzName(id)) + '">' + pzSolvedHTML(id) + '</div>';
      foot = '<button class="btn primary" data-act="close-modal">Done</button>';
    } else if (PZ.phase === 'intro') {
      body = '<p>' + esc(pzFound(id)) + '</p>' +
        '<p class="clue">You will have <strong>' + fmtSecs(limit) + '</strong> once you begin. Run out of time, or walk away, and you lose 30 minutes.</p>';
      foot = '<button class="btn ghost" data-act="close-modal">Not now</button><button class="btn primary" data-act="pz-start">Begin</button>';
    } else if (PZ.phase === 'fail') {
      const out = leadsLeft() <= 0;
      body = '<p class="clue"><strong>No luck this time.</strong> ' + (PZ.lost ? 'Half an hour has slipped away while you fumbled with it.' : 'You have no time left to lose.') + '</p>';
      foot = out
        ? '<p class="dawn-warn">' + esc(fmt(place().endWarn)) + '</p><button class="btn primary" data-act="close-modal">Make your accusation</button>'
        : '<button class="btn ghost" data-act="close-modal">Leave it</button><button class="btn primary" data-act="pz-start">Try again</button>';
    } else {
      body = (limit ? '<p class="pz-clock" aria-live="off">Time left: <strong id="pz-clock">' + fmtSecs(Math.max(0, Math.ceil((PZ.deadline - Date.now()) / 1000))) + '</strong></p>'
        : '<p class="pz-clock calm">No time limit. Take as long as you like.</p>') + pzPlayHTML(id);
      foot = '<button class="btn ghost" data-act="close-modal">' + (limit ? 'Give up (lose 30 min)' : 'Come back later') + '</button>';
    }
    const scroll = PZ.phase === 'run' ? modalBody.scrollTop : 0;
    showModal(esc(r.name) + (PZ.phase === 'done' ? ' · Solved' : ''), cap(pzName(id)), r.color, body, '<div class="foot-row">' + foot + '</div>');
    modalBody.scrollTop = scroll;
  }

  // back = the room to return to when the puzzle is closed, if it was opened from inside a room.
  function openPuzzle(id, back) {
    const c = S.c;
    if (!PUZZLE_IDS.includes(id) || !seen(c.puzzles[id].room, 'pz:' + id)) return;
    stopPzTimer();
    ROOM = null;
    PZ = { id, phase: S.solved.includes(id) ? 'done' : (pzLimit(id) ? 'intro' : 'run'), timer: null, lost: false,
      back: back && c.rooms.some((r) => r.id === back) ? back : null };
    resetPuzzle();
    drawPuzzle();
    focusModal();
  }
  function resetPuzzle() {
    PZ.dials = [1, 1, 1];
    PZ.order = S.c.puzzles.letter.order.slice();
    PZ.sel = null;
    PZ.shift = 0;
    PZ.msg = '';
  }
  function startPuzzle() {
    if (!PZ || PZ.phase === 'done') return;
    resetPuzzle();
    PZ.phase = 'run';
    PZ.deadline = Date.now() + pzLimit(PZ.id) * 1000;
    stopPzTimer();
    PZ.timer = setInterval(() => {
      if (!PZ || PZ.phase !== 'run') return;
      const left = Math.ceil((PZ.deadline - Date.now()) / 1000);
      if (left <= 0) { failPuzzle(); return; }
      const el = document.getElementById('pz-clock');
      if (el) el.textContent = fmtSecs(left);
    }, 250);
    drawPuzzle();
  }
  function failPuzzle() {
    stopPzTimer();
    PZ.lost = leadsLeft() > 0;
    if (PZ.lost) {
      S.done.push('x:' + PZ.id + ':' + S.done.filter((a) => a[0] === 'x').length);
      save();
      render();
    }
    PZ.phase = 'fail';
    drawPuzzle();
    focusModal();
  }
  function solvePuzzle() {
    stopPzTimer();
    if (!S.solved.includes(PZ.id)) S.solved.push(PZ.id);
    save();
    render();
    PZ.phase = 'done';
    drawPuzzle();
    focusModal();
    discovery();
  }
  function puzzleInput(d) {
    if (!PZ || PZ.phase !== 'run') return;
    const c = S.c;
    PZ.msg = '';
    if (d.act === 'pz-dial') {
      const i = Number(d.i);
      PZ.dials[i] = ((PZ.dials[i] - 1 + Number(d.d) + 9) % 9) + 1;
    } else if (d.act === 'pz-try') {
      if (PZ.dials.join('') === c.puzzles.drawer.code) { solvePuzzle(); return; }
      PZ.msg = 'The lock holds. Those are not the numbers.';
    } else if (d.act === 'pz-strip') {
      const i = Number(d.i);
      if (PZ.sel === null) PZ.sel = i;
      else {
        const t = PZ.order[PZ.sel]; PZ.order[PZ.sel] = PZ.order[i]; PZ.order[i] = t;
        PZ.sel = null;
        if (PZ.order.every((v, k) => v === k)) { solvePuzzle(); return; }
      }
    } else if (d.act === 'pz-shift') {
      PZ.shift = (PZ.shift + Number(d.d) + 26) % 26;
    } else if (d.act === 'pz-read') {
      if (PZ.shift === c.puzzles.cipher.shift) { solvePuzzle(); return; }
      PZ.msg = 'Still nonsense. Keep turning.';
    }
    drawPuzzle();
    const again = modalBody.querySelector('[data-act="' + d.act + '"]' + (d.i !== undefined ? '[data-i="' + d.i + '"]' : '') + (d.d !== undefined ? '[data-d="' + d.d + '"]' : ''));
    if (again) again.focus({ preventScroll: true });
  }

  function openResult(id, isNew) {
    if (id[0] === 'q') { openTalk(id.slice(2), isNew); return; }
    S.tmenu = null;
    if (id[0] === 's') { openRoom(id.slice(2), isNew); return; }
    ROOM = null;
    const res = belongingsHTML(id.slice(2));
    const idx = S.done.indexOf(id);
    const when = clock(startMin() + idx * ACTION_MIN);
    const dawnNext = isNew && leadsLeft() <= 0;
    stopPzTimer();
    PZ = null;
    showModal(when + (res.sub ? ' · ' + esc(res.sub) : ''), res.title, res.color, '<div data-note="' + esc(res.title) + '">' + res.body + '</div>',
      (dawnNext ? '<p class="dawn-warn">' + esc(fmt(place().endWarn)) + '</p>' : '') +
      '<button class="btn primary" data-act="close-modal">' + (dawnNext ? 'Make your accusation' : 'Done') + '</button>');
    focusModal();
    if (isNew && id === 'b:' + S.c.victim) discovery(); // the victim's plan to meet someone
  }

  function closeModal() {
    // Walking away from a timed puzzle counts as failing it.
    if (PZ && PZ.phase === 'run' && pzLimit(PZ.id)) { failPuzzle(); return; }
    const back = PZ && PZ.back;
    stopPzTimer();
    PZ = null;
    S.tmenu = null;
    ROOM = null;
    // A puzzle opened from inside a room goes back to that room (unless the night is over).
    if (back && S.screen === 'investigate' && leadsLeft() > 0) { openRoom(back, false); return; }
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (S.screen === 'investigate' && leadsLeft() <= 0) {
      S.dawn = true;
      S.screen = 'accuse';
      render();
    }
  }

  function doAction(id) {
    if (S.done.includes(id)) { openResult(id, false); return; }
    if (leadsLeft() <= 0) return;
    S.done.push(id);
    if (id[0] === 's') S.objs[id.slice(2)] = []; // a newly entered room starts with nothing inspected
    save();
    render();
    openResult(id, true);
  }

  // ---------- accusation ----------
  function choiceGroup(key, items) {
    return '<div class="choices">' + items.map((it) =>
      '<button class="choice' + (String(S.draft[key]) === String(it.v) ? ' selected' : '') + '" data-act="pick" data-k="' + key + '" data-v="' + it.v + '"' +
      (it.color ? ' style="--room:' + it.color + '"' : '') + ' aria-pressed="' + (String(S.draft[key]) === String(it.v)) + '">' + it.html + '</button>').join('') + '</div>';
  }

  function viewAccuse() {
    const c = S.c;
    const ready = S.draft.killer && S.draft.weapon && S.draft.slot;
    return (
      '<section class="screen accuse">' +
      (S.dawn
        ? '<h2>' + esc(fmt(place().endTitle)) + '</h2><p>' + esc(fmt(place().endText)) + '</p>'
        : '<h2>Make your accusation</h2><p>Once you accuse, the case is closed. You still have ' + leadsLeft() + ' lead' + (leadsLeft() === 1 ? '' : 's') + '.</p>') +
      '<h3>Who killed ' + esc(person(c.victim).name) + ' in the ' + esc(room(c.crimeRoom).name) + '?</h3>' +
      choiceGroup('killer', c.suspects.map((id) => ({ v: id, color: person(id).color, html: avatar(person(id), true) + '<span>' + esc(person(id).name) + '</span>' }))) +
      '<h3>With what?</h3>' +
      choiceGroup('weapon', c.weapons.map((w) => ({ v: w.id, color: room(w.home).color, html: weaponImg(w, 'wpn-thumb') + '<span>' + esc(cap(w.name)) + '</span>' }))) +
      '<h3>When?</h3>' +
      choiceGroup('slot', [1, 2, 3].map((s) => ({ v: s, html: '<span>Between ' + slot(s) + ' and ' + endOfSlot(s) + '</span>' }))) +
      '<details class="panel accuse-board"><summary>Look at the timeline again</summary>' + boardHTML() + '</details>' +
      '<div class="accuse-actions">' +
      (S.dawn ? '' : '<button class="btn ghost" data-act="back-to-case">Keep investigating</button>') +
      '<button class="btn primary big" data-act="submit"' + (ready ? '' : ' disabled') + '>' + (ready ? 'Accuse' : 'Choose all three') + '</button>' +
      '</div></section>'
    );
  }

  // ---------- the ending ----------
  // Everything here is read from the generated case and from what the player actually did. Nothing is invented.

  // The key things there were to work out, and whether the player did. na = could not be done in this case.
  function deductions() {
    const c = S.c;
    const k = c.killer;
    const K = esc(person(k).name);
    const w = weaponById(c.weapon);
    const sh = c.puzzles.shoes[k];
    const hideR = room(c.hideRoom);
    return [
      { label: 'Found when the victim died', ok: bodySeen(), detail: 'The watch stopped at ' + watchTime() + '.' },
      { label: 'Identified the weapon', ok: seen(w.home, 'weapon') || seen(c.hideRoom, 'hide'), detail: 'The ' + esc(w.name) + ', missing from the ' + esc(room(w.home).name) + '.' },
      { label: 'Found where the weapon was hidden', ok: seen(c.hideRoom, 'hide'), detail: cap(esc(hideR.hide)) + ' in the ' + esc(hideR.name) + '.' },
      { label: 'Read the victim\'s plan', ok: S.done.includes('b:' + c.victim), detail: 'A meeting in the ' + esc(room(c.crimeRoom).name) + ' at ' + slot(c.T) + ', in the victim\'s belongings.' },
      { label: 'Broke the killer\'s alibi', ok: stuck(), detail: esc(person(c.W).name) + ' was alone in the ' + esc(room(c.claimRoom).name) + ' at ' + slot(c.T) + ', exactly where ' + K + ' claimed to be. Challenging ' + K + ' with that leaves them with no answer.' },
      { label: 'Got the truth out of the red herring', ok: confessed(), detail: esc(person(c.H).name) + ' lied about ' + slot(c.hSlot) + ' and owns up when challenged with a clue that places them in the ' + esc(room(c.hTrue).name) + '.' },
      { label: 'Matched the footprint to the killer\'s shoes', ok: printFound() && S.shoes.includes(k) && !sh.refuses, na: sh.refuses,
        detail: sh.refuses ? K + ' refused to show their shoes, so this could not be done.' : K + '\'s ' + esc(sh.name) + ' have ' + esc(treadName(sh.tread)) + ', the same as the print.' },
      { label: 'Found the crime scene on the killer\'s belongings', ok: S.done.includes('b:' + k), detail: cap(esc(room(c.crimeRoom).residue)) + ' from the ' + esc(room(c.crimeRoom).name) + ', on ' + K + '\'s things.' },
      { label: 'Uncovered the killer\'s motive', ok: motiveKnown(k), detail: esc(fill(c.motives[k], k, c.victim)) },
    ];
  }

  // Investigation actions that turned up nothing: the score takes a little off for each.
  function wastedEffort() {
    const c = S.c;
    const out = [];
    const fails = S.done.filter((a) => a[0] === 'x').length;
    if (fails) out.push([fails, fails === 1 ? 'a puzzle you ran out of time on' : 'puzzles you ran out of time on']);
    const empty = c.rooms.filter((r) => S.done.includes('s:' + r.id) && S.objs[r.id] && !S.objs[r.id].length).length;
    if (empty) out.push([empty, empty === 1 ? 'a room you entered without looking at anything' : 'rooms you entered without looking at anything']);
    const silent = c.suspects.filter((p) => S.done.includes('q:' + p) && !talkKeys(p).length).length;
    if (silent) out.push([silent, silent === 1 ? 'a guest you sat down with but asked nothing' : 'guests you sat down with but asked nothing']);
    return out;
  }

  function scoreCard(got) {
    const d = deductions().filter((x) => !x.na);
    const found = d.filter((x) => x.ok).length;
    const spare = Math.max(0, leadsLeft());
    // Finishing early only earns a bonus if the case was actually built on evidence, so a quick guess cannot cash in.
    const earnsTime = found * 2 >= d.length;
    const wasted = wastedEffort();
    const wCount = wasted.reduce((n, x) => n + x[0], 0);
    const mult = { cozy: 1, standard: 1.25, dread: 1.5, nightmare: 1.75 }[S.diff];
    const rows = [
      ['Named the killer', got.killer ? 500 : 0],
      ['Named the weapon', got.weapon ? 150 : 0],
      ['Named the hour', got.slot ? 150 : 0],
      ['Key discoveries · ' + found + ' of ' + d.length, found * 50],
      ['Puzzles solved · ' + S.solved.length + ' of ' + PUZZLE_IDS.length, S.solved.length * 60],
      ['Time to spare · ' + spare + ' lead' + (spare === 1 ? '' : 's') + ' unused' + (earnsTime || !spare ? '' : ' (counts once you have half the key discoveries)'), earnsTime ? spare * 15 : 0],
      ['Wasted effort · ' + (wCount ? wasted.map((x) => (x[0] > 1 ? x[0] + ' ' : '') + x[1]).join(', ') : 'none'), -40 * wCount],
    ];
    const sub = rows.reduce((n, r) => n + r[1], 0);
    const total = Math.max(0, Math.round(sub * mult));
    // "Full marks" leaves out the time bonus, so finishing early can lift you above it.
    const best = Math.round((800 + d.length * 50 + PUZZLE_IDS.length * 60) * mult);
    const ratio = total / best;
    const rank = !got.killer ? ['Outwitted', 'The killer fooled you tonight.']
      : found < 3 ? ['Lucky Guess', 'Right name, thin evidence. A jury might not agree.']
      : ratio >= 0.9 ? ['Master Detective', 'Nothing got past you.']
      : ratio >= 0.7 ? ['Seasoned Investigator', 'A solid case, built on evidence.']
      : ratio >= 0.5 ? ['Keen Amateur', 'You got your killer, with gaps in the proof.']
      : ['Lucky Guess', 'Right name, thin evidence. A jury might not agree.'];
    return { rows, mult, sub, total, best, rank, found };
  }

  // Add a closed case to the career. Called once, when the accusation is made.
  function recordCase() {
    const c = S.c;
    const got = { killer: S.draft.killer === c.killer, weapon: S.draft.weapon === c.weapon, slot: Number(S.draft.slot) === c.T };
    const sc = scoreCard(got);
    const code = caseCode(c);
    const counted = !CAREER.codes.includes(code);
    const before = CAREER.points;
    const earned = [];
    if (counted) {
      CAREER.codes.push(code);
      CAREER.points += sc.total;
      CAREER.closed++;
      if (got.killer) CAREER.solved++;
      CAREER.best = Math.max(CAREER.best, sc.total);
      const sh = c.puzzles.shoes[c.killer];
      const real = sc.found >= 3; // badges for skill need a case built on at least a little evidence, not a lucky guess
      const want = {
        first: true,
        exact: real && got.killer && got.weapon && got.slot,
        silver: stuck() && confessed(),
        light: real && got.killer && stuck() && leadsLeft() >= totalLeads() / 2,
        stone: S.solved.length === PUZZLE_IDS.length,
        hound: got.killer && printFound() && S.shoes.includes(c.killer) && !sh.refuses,
        nightmare: got.killer && S.diff === 'nightmare',
      };
      Object.keys(want).forEach((k) => { if (want[k] && !CAREER.badges[k]) { CAREER.badges[k] = Date.now(); earned.push(k); } });
    }
    CAREER.book.push({ code, diff: S.diff, at: Date.now(), right: got.killer, hits: (got.killer ? 1 : 0) + (got.weapon ? 1 : 0) + (got.slot ? 1 : 0),
      score: sc.total, rank: sc.rank[0], counted, killer: person(c.killer).name, badges: earned });
    if (CAREER.book.length > 100) CAREER.book = CAREER.book.slice(-100);
    saveCareer();
    S.record = { counted, before, after: CAREER.points, earned, score: sc.total, rank: sc.rank[0], right: got.killer };
  }

  function shareText() {
    const r = S.record;
    return 'The Midnight Crossing · Case ' + caseCode(S.c) + ' (' + DIFFS[S.diff].label + ') · ' + r.score + ' points · ' + r.rank + ' · ' +
      (r.right ? 'I caught the killer.' : 'The killer got away from me.') + ' Can you beat it?';
  }

  function careerPanel() {
    const r = S.record;
    if (!r) return '';
    let html = '<div class="panel career-panel"><h3>Your career</h3>';
    if (!r.counted) {
      html += '<p>You have closed case ' + caseCode(S.c) + ' before, so this replay adds nothing to your career. Replays are just for fun.</p>';
    } else {
      const was = rankIndex(r.before), now = rankIndex(r.after);
      html += '<p class="career-gain"><strong>+' + r.score.toLocaleString() + '</strong> career points · ' + r.after.toLocaleString() + ' in total</p>';
      for (let i = was + 1; i <= now; i++) {
        html += '<div class="promotion"><strong>Promoted to ' + RANKS[i].t + '!</strong><span>Unlocked: ' + RANKS[i].what + '.</span></div>';
      }
      html += '<p class="kicker">' + RANKS[now].t + '</p>' + rankProgress(r.after);
      if (r.earned.length) {
        html += '<ul class="badges new">' + r.earned.map((k) => '<li class="badge earned"><span class="badge-sym" aria-hidden="true">' + BADGES[k][0] + '</span><div><strong>New badge: ' +
          BADGES[k][1] + '</strong><span>' + BADGES[k][2] + '</span></div></li>').join('') + '</ul>';
      }
    }
    html += '<button class="btn ghost" data-act="title-mode" data-mode="casebook">Open your casebook</button></div>';
    html += '<div class="panel share"><h3>Challenge a friend</h3><p class="hint">Send them this. The case code gives them the same mystery, without spoiling who did it.</p>' +
      '<textarea id="share-text" class="share-text" rows="3" readonly>' + esc(shareText()) + '</textarea>' +
      '<button class="btn primary" data-act="copy-share">Copy</button></div>';
    return html;
  }

  function viewResult() {
    const c = S.c;
    const k = person(c.killer), v = person(c.victim), w = weaponById(c.weapon);
    const accused = person(S.draft.killer);
    const aw = weaponById(S.draft.weapon);
    const got = { killer: S.draft.killer === c.killer, weapon: S.draft.weapon === c.weapon, slot: Number(S.draft.slot) === c.T };
    const hits = (got.killer ? 1 : 0) + (got.weapon ? 1 : 0) + (got.slot ? 1 : 0);
    const mark = (ok) => '<span class="mark ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓' : '✗') + '</span>';
    const kicker = '<p class="kicker">Case ' + caseCode(c) + ' · ' + DIFFS[S.diff].label + '</p>';

    // The accusation plays out in three beats before the full story.
    if (S.reveal < 3) {
      const beats = [
        '<div class="beat"><p class="kicker">' + clock(nowMin()) + ' · The ' + esc(dinnerRoomName()) + '</p>' +
        '<h2>You call everyone together.</h2><p>They come in one by one and stand under the lamps. Nobody sits. Nobody speaks.</p>' +
        '<div class="suspect-strip">' + c.suspects.map((id) => '<span class="mini">' + avatar(person(id), true) + esc(person(id).short) + '</span>').join('') + '</div></div>',
        '<div class="beat accusing" style="--pc:' + accused.color + '">' + avatar(accused) + '<p class="say big">“It was you, ' + esc(accused.name) + '. With the ' + esc(aw.name) +
        ', between ' + slot(S.draft.slot) + ' and ' + endOfSlot(S.draft.slot) + '.”</p><p>Every head turns.</p></div>',
        '<div class="beat ' + (got.killer ? 'right' : 'wrong') + '" style="--pc:' + accused.color + '">' + avatar(accused) +
        '<p class="say big">“' + esc(MC.TALK[got.killer ? 'crack' : 'wronged'][accused.personality]) + '”</p>' +
        (got.killer ? '<p>The room lets out its breath. It is over.</p>' : '<p>Across the room, someone else lets out a slow breath, and almost smiles. You have the wrong person.</p>') + '</div>',
      ];
      return '<section class="screen result reveal">' + kicker + beats.slice(0, S.reveal + 1).join('') +
        '<div class="accuse-actions"><button class="btn ghost" data-act="reveal-skip">Skip to the result</button>' +
        '<button class="btn primary big" data-act="reveal-next">' + (S.reveal === 2 ? 'See the full story' : 'Continue') + '</button></div></section>';
    }

    const headline = got.killer ? (hits === 3 ? 'A perfect deduction.' : 'You caught the killer.') : 'The killer walks free, ' + place().walkFree + '.';
    const sc = scoreCard(got);
    const ded = deductions();
    const hl = person(c.H);
    const sh = c.puzzles.shoes[c.killer];
    const heading = c.sightings.find((sg) => sg.kind === 'heading');
    const hSaw = c.sightings.filter((sg) => sg.subject === c.H && sg.slot === c.hSlot).map((sg) => sg.witness);
    const step = (t, html) => '<li><span class="time">' + t + '</span><span>' + html + '</span></li>';
    return (
      '<section class="screen result">' + kicker +
      '<h2 class="' + (got.killer ? 'win' : 'lose') + '">' + esc(headline) + '</h2>' +
      '<div class="rank ' + (got.killer ? 'win' : 'lose') + '"><span class="rank-score">' + sc.total + '</span><div><strong>' + sc.rank[0] + '</strong><span>' + sc.rank[1] + '</span></div></div>' +

      '<div class="panel"><h3>Your accusation</h3><ul class="verdict">' +
      '<li>' + mark(got.killer) + 'Killer: ' + esc(accused.name) + (got.killer ? '' : ' <small>(it was ' + esc(k.name) + ')</small>') + '</li>' +
      '<li>' + mark(got.weapon) + 'Weapon: ' + esc(aw.name) + (got.weapon ? '' : ' <small>(it was the ' + esc(w.name) + ')</small>') + '</li>' +
      '<li>' + mark(got.slot) + 'Time: between ' + slot(S.draft.slot) + ' and ' + endOfSlot(S.draft.slot) +
      (got.slot ? '' : ' <small>(it was between ' + slot(c.T) + ' and ' + endOfSlot(c.T) + ')</small>') + '</li></ul></div>' +

      '<div class="panel truth"><h3>What really happened</h3>' +
      '<p><strong>The motive.</strong> ' + esc(fill(c.motives[c.killer], c.killer, c.victim)) + '</p>' +
      '<ol class="nb-lines story">' +
      step(slot(0), 'Everyone had dinner together in the ' + esc(dinnerRoomName()) + '.') +
      step('Before ' + slot(c.T), esc(k.name) + ' took the ' + esc(w.name) + ' from the ' + esc(room(w.home).name) + '. ' + esc(v.name) + ' had arranged to meet someone in the ' + esc(room(c.crimeRoom).name) + ', alone.') +
      step(watchTime(), '<strong>' + esc(k.name) + '</strong> killed ' + esc(v.name) + ' in the ' + esc(room(c.crimeRoom).name) + ' with the ' + esc(w.name) + '. The victim\'s watch was smashed in the struggle.') +
      step('Afterwards', esc(k.name) + ' hid the ' + esc(w.name) + ' ' + esc(room(c.hideRoom).hide) + ' in the ' + esc(room(c.hideRoom).name) + ', leaving a footprint by the body and ' +
        esc(room(c.crimeRoom).residue) + ' on their own belongings.') +
      step(clock(c.foundMin), esc(person(c.finder).name) + ' found the body.') +
      '</ol></div>' +

      '<div class="panel"><h3>The false alibi</h3>' +
      '<p>' + esc(k.name) + ' claimed to be in the ' + esc(room(c.claimRoom).name) + ' at ' + slot(c.T) + '. But ' + esc(person(c.W).name) +
      ' was in the ' + esc(room(c.claimRoom).name) + ' all that hour, alone, and swore nobody else came in.</p>' +
      (heading ? '<p>' + esc(person(heading.witness).name) + ' also saw ' + esc(k.name) + ' hurrying toward the ' + esc(room(c.crimeRoom).name) + ' just after ' + slot(c.T) + '.</p>' : '') +
      '<p>The footprint had ' + esc(treadName(c.puzzles.print.tread)) + ', the same as ' + esc(k.name) + '\'s ' + esc(sh.name) + '.' +
      (c.puzzles.twin ? ' ' + esc(person(c.puzzles.twin).name) + ' wears the same sole, but was somewhere else, with a witness.' : '') + '</p>' +
      '<p>Every other guest\'s story for ' + slot(c.T) + ' was backed up by someone else. Only ' + esc(k.name) + '\'s was not.</p></div>' +

      '<div class="panel"><h3>The red herring</h3>' +
      '<p>' + esc(hl.name) + ' also lied, but about ' + slot(c.hSlot) + ', not the hour of the murder. They said they were in the ' + esc(room(c.hClaim).name) +
      '. In truth, ' + esc(hl.name) + ' ' + esc(c.hSecret.split('{room}').join(room(c.hTrue).name)) + '.</p>' +
      (hSaw.length ? '<p>' + esc(nameList(hSaw)) + ' saw them in the ' + esc(room(c.hTrue).name) + ', which is how the lie could be caught.</p>' : '') +
      '<p>A lie about the wrong hour is embarrassment, not murder.</p></div>' +

      '<div class="panel"><h3>Your deductions</h3><ul class="ded">' +
      ded.map((x) => '<li class="' + (x.na ? 'na' : x.ok ? 'ok' : 'miss') + '"><span class="mark ' + (x.na ? 'na' : x.ok ? 'ok' : 'bad') + '">' + (x.na ? '–' : x.ok ? '✓' : '✗') + '</span>' +
        '<div><strong>' + x.label + '</strong><span>' + x.detail + '</span></div></li>').join('') + '</ul></div>' +

      '<div class="panel"><h3>Detective score</h3><table class="score"><tbody>' +
      sc.rows.map((r) => '<tr' + (r[1] < 0 ? ' class="neg"' : '') + '><th scope="row">' + esc(r[0]) + '</th><td>' + (r[1] > 0 ? '+' : '') + r[1] + '</td></tr>').join('') +
      (sc.mult !== 1 ? '<tr><th scope="row">' + DIFFS[S.diff].label + ' difficulty</th><td>× ' + sc.mult + '</td></tr>' : '') +
      '<tr class="total"><th scope="row">Total</th><td>' + sc.total + '</td></tr></tbody></table>' +
      '<p class="hint">Full marks before any time bonus: ' + sc.best + '.</p></div>' +

      careerPanel() +
      '<div class="accuse-actions">' +
      '<button class="btn primary big" data-act="title-mode" data-mode="new">New case</button>' +
      '<button class="btn" data-act="home">Main menu</button></div>' +
      '</section>'
    );
  }

  // ---------- rendering & input ----------
  // ---------- atmosphere ----------
  // The world reacts to how late it is: thicker fog, a darker edge to the light, a redder clock,
  // a clock that strikes each hour, and a little louder ambience. Purely for mood: it changes no rules.
  const atmoEl = document.createElement('div');
  atmoEl.className = 'atmo';
  atmoEl.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(atmoEl, document.body.firstChild);
  let lastMinute = null;   // the clock when we last drew, to notice the hour turning
  let strikeClock = false;
  let lastBadge = 0;
  let audioOn = false;     // sound can only start after the player's first tap
  function soundLevel() { return SOUNDS[OPTS.sound].v; }
  function startAudio() { if (!audioOn && OPTS.sound !== 'off') { audioOn = true; Atmo.setLevel(soundLevel()); } }
  function syncAtmo() {
    const inCase = !!S.c && (S.screen === 'investigate' || S.screen === 'accuse');
    const p = inCase ? Math.min(1, S.done.length / totalLeads()) : 0;
    document.documentElement.style.setProperty('--dread', p.toFixed(3));
    document.body.classList.toggle('late', p >= 0.5);
    document.body.classList.toggle('very-late', p >= 0.8);
    Atmo.setPlace(S.c && (inCase || S.screen === 'briefing') ? S.c.place : null);
    Atmo.setDread(p);
    if (inCase) {
      const now = nowMin();
      if (lastMinute !== null && now > lastMinute && Math.floor(now / 60) !== Math.floor(lastMinute / 60)) {
        Atmo.chime(deadlineMin() - now <= 60 ? 2 : 1);
        strikeClock = true;
      }
      lastMinute = now;
    } else lastMinute = null;
  }
  // Something important just turned up: a soft tone and a brief glow around the card.
  function discovery() {
    Atmo.discover();
    modalBody.classList.remove('flare');
    void modalBody.offsetWidth;
    modalBody.classList.add('flare');
    setTimeout(() => modalBody.classList.remove('flare'), 1300);
  }

  function render() {
    syncAtmo();
    const views = { title: viewTitle, briefing: viewBriefing, investigate: viewInvestigate, accuse: viewAccuse, result: viewResult };
    applyPalette();
    app.innerHTML = views[S.screen]();
    if (S.screen !== lastScreen) { window.scrollTo(0, 0); lastScreen = S.screen; }
    if (S.screen === 'investigate') initBoard();
    if (S.nbOpen) { if (S.screen === 'investigate') drawNotebook(); else closeNotebook(); }
    if (strikeClock) {
      strikeClock = false;
      const ck = app.querySelector('.clock');
      if (ck) ck.classList.add('strike');
    }
    // The Board tab's counter gives a little hop when new clues arrive.
    const badge = app.querySelector('.tab-badge');
    const n = badge ? Number(badge.textContent) : 0;
    if (badge && n > lastBadge) badge.classList.add('pop');
    lastBadge = n;
    if (S.screen === 'title' && S.titleMode === 'number') {
      const input = document.getElementById('case-num');
      if (input) { if (S.prefill) { input.value = S.prefill; S.prefill = ''; } input.focus(); }
    }
  }

  document.addEventListener('click', (e) => {
    startAudio();
    if (e.target === nbWrap) { closeNotebook(); return; }
    if (e.target === modal) { closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const d = el.dataset;
    switch (d.act) {
      case 'title-mode':
        S.titleMode = d.mode || null; S.numError = ''; S.screen = 'title'; render(); break;
      case 'opt':
        OPTS[d.k] = d.v;
        if (d.k === 'sound') {
          if (d.v !== 'off') OPTS.lastSound = d.v;
          audioOn = d.v !== 'off';
          Atmo.setLevel(soundLevel());
        }
        saveOpts(OPTS); render(); break;
      case 'sound':
        OPTS.sound = OPTS.sound === 'off' ? OPTS.lastSound : 'off';
        audioOn = OPTS.sound !== 'off';
        Atmo.setLevel(soundLevel());
        saveOpts(OPTS); render(); break;
      case 'new':
        startCase(randomSeed(), chosenPlace(), chosenEra(), d.diff); break;
      case 'number-start': {
        const parsed = parseCode((document.getElementById('case-num') || {}).value || '');
        if (!parsed) { S.numError = 'Enter a case code like TN-4821, or a number from 1000 to 9999.'; render(); break; }
        startCase(parsed.seed, parsed.place, parsed.era, d.diff); break;
      }
      case 'continue': {
        const sv = loadSave();
        if (!sv) { render(); break; }
        S.c = assignPortraits(MC.generateCase(sv.seed, sv.place, sv.era, genDiff(sv.diff)));
        S.diff = sv.diff;
        // Keep only actions that make sense for this case, in case the save is old or damaged.
        const valid = (a) => typeof a === 'string' && (
          (a[0] === 's' && S.c.rooms.some((r) => 's:' + r.id === a)) ||
          (a[0] === 'q' && S.c.suspects.some((p) => 'q:' + p === a)) ||
          (a[0] === 'b' && [S.c.victim].concat(S.c.suspects).some((p) => 'b:' + p === a)) ||
          /^x:(drawer|letter|cipher):\d+$/.test(a));
        S.done = sv.done.filter((a, i) => valid(a) && sv.done.indexOf(a) === i).slice(0, DIFFS[sv.diff].leads);
        S.solved = (Array.isArray(sv.solved) ? sv.solved : []).filter((id, i, arr) => PUZZLE_IDS.includes(id) && arr.indexOf(id) === i);
        S.shoes = (Array.isArray(sv.shoes) ? sv.shoes : []).filter((p, i, arr) => S.c.suspects.includes(p) && arr.indexOf(p) === i);
        S.board = cleanBoard(sv.board);
        S.bsel = null; S.bfrom = null; boardScroll = null;
        S.talk = cleanTalk(sv.talk); S.tmenu = null;
        S.objs = cleanObjs(sv.objs); ROOM = null;
        S.notes = cleanNotes(sv.notes); S.noteUndo = null;
        S.draft = {}; S.tab = 'ship';
        S.dawn = leadsLeft() <= 0;
        S.screen = S.dawn ? 'accuse' : 'investigate';
        render(); break;
      }
      case 'begin': S.screen = 'investigate'; render(); break;
      case 'tab':
        if (S.tab === 'board' && d.tab !== 'board') { markAllSeen(); save(); }
        if (d.tab !== 'board') { S.bsel = null; S.bfrom = null; }
        S.tab = d.tab; render(); break;
      case 'b-mark': case 'b-connect': case 'b-cancel': case 'b-unlink': case 'b-close': case 'b-zoom': case 'b-tidy':
        boardAction({ act: d.act, v: d.v, i: d.i, d: d.d }); break;
      case 'search': doAction('s:' + d.id); break;
      case 'question': doAction('q:' + d.id); break;
      case 'belongings': doAction('b:' + d.id); break;
      case 'view': if (S.nbOpen) closeNotebook(); openResult(d.id, false); break;
      case 'shoes': askShoes(d.id); break;
      case 'talk': case 'talk-menu': talkAction({ act: d.act, k: d.k, m: d.m, s: d.s }); break;
      case 'puzzle': if (S.nbOpen) closeNotebook(); openPuzzle(d.id, d.back); break;
      case 'obj': inspect(d.k); break;
      case 'obj-all': inspect('*'); break;
      case 'note-sel':
        if (noteSel) addNote(noteSel.t, noteSel.src);
        noteSel = null;
        pill.classList.add('hidden');
        try { window.getSelection().removeAllRanges(); } catch (er) { /* ignore */ }
        break;
      case 'note-save': {
        const host = el.closest('[data-note]');
        if (host) addNote(blockText(host), host.dataset.note);
        break;
      }
      case 'note-del': {
        const i = Number(d.i);
        if (S.notes[i]) { S.noteUndo = { i, n: S.notes[i] }; S.notes.splice(i, 1); save(); render(); }
        break;
      }
      case 'note-undo':
        if (S.noteUndo && S.notes.length < NOTE_LIMIT) { S.notes.splice(Math.min(S.noteUndo.i, S.notes.length), 0, S.noteUndo.n); S.noteUndo = null; save(); render(); }
        break;
      case 'nb-open': openNotebook(); break;
      case 'nb-close': closeNotebook(); break;
      case 'nb-sec': S.nbSec = d.sec; render(); if (S.nbOpen) nbPanel.scrollTop = 0; break;
      case 'pz-start': startPuzzle(); break;
      case 'pz-dial': case 'pz-try': case 'pz-strip': case 'pz-shift': case 'pz-read':
        puzzleInput({ act: d.act, i: d.i, d: d.d }); break;
      case 'accuse': S.screen = 'accuse'; S.dawn = false; render(); break;
      case 'back-to-case': S.screen = 'investigate'; render(); break;
      case 'pick': S.draft[d.k] = d.k === 'slot' ? Number(d.v) : d.v; render(); break;
      case 'submit':
        if (S.screen !== 'accuse') break;
        recordCase(); clearSave(); S.reveal = 0; S.screen = 'result'; render(); break;
      case 'copy-share': {
        const ta = document.getElementById('share-text');
        const done = () => toast('Copied. Paste it to a friend.');
        const fallback = () => { if (ta) { ta.focus(); ta.select(); } toast('Press and hold the text to copy it.'); };
        try { navigator.clipboard.writeText(shareText()).then(done, fallback); } catch (er) { fallback(); }
        break;
      }
      case 'replay':
        if (CODE_RE.test(d.code || '')) { S.prefill = d.code; S.titleMode = 'number'; S.numError = ''; S.screen = 'title'; render(); }
        break;
      case 'reveal-next': case 'reveal-skip': {
        S.reveal = d.act === 'reveal-skip' ? 3 : Math.min(3, S.reveal + 1);
        // The moment of truth gets a sound: a bright tone if you were right, a single bell if not.
        if (S.reveal === 2) { if (S.draft.killer === S.c.killer) Atmo.discover(); else Atmo.chime(1); }
        render();
        if (S.reveal === 3) window.scrollTo(0, 0);
        else { const beats = app.querySelectorAll('.beat'); const last = beats[beats.length - 1]; if (last) last.scrollIntoView({ block: 'center', behavior: 'auto' }); }
        const nb = app.querySelector('[data-act="reveal-next"]') || app.querySelector('h2');
        if (nb && nb.focus) nb.focus({ preventScroll: true });
        break;
      }
      case 'close-modal': closeModal(); break;
      case 'home': S.screen = 'title'; S.titleMode = null; render(); break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.nbOpen) { closeNotebook(); return; }
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    else if (e.key === 'Escape' && (S.bsel || S.bfrom)) { S.bsel = null; S.bfrom = null; render(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('bn')) {
      e.preventDefault();
      const id = e.target.dataset.node;
      boardTap(id);
      const again = app.querySelector('[data-node="' + id + '"]');
      if (again) again.focus({ preventScroll: true });
    }
    if (e.key === 'Enter' && e.target && e.target.id === 'case-num') {
      const btn = document.querySelector('[data-act="number-start"][data-diff="standard"]');
      if (btn) btn.click();
    }
  });

  const onWideChange = () => { if (S.screen === 'investigate') render(); };
  if (wideQuery.addEventListener) wideQuery.addEventListener('change', onWideChange);
  else if (wideQuery.addListener) wideQuery.addListener(onWideChange);

  // Offline support once the game is hosted (service workers do not run from a plain file).
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
})();
