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
  };
  // Seconds allowed for each puzzle. Cozy has no entry: no time limit and nothing to lose.
  const TIMERS = {
    standard: { drawer: 150, letter: 90, cipher: 75 },
    dread: { drawer: 90, letter: 60, cipher: 45 },
  };
  const PUZZLE_IDS = ['drawer', 'letter', 'cipher'];
  const ERAS = { old: { label: 'Old-fashioned', code: 'O' }, modern: { label: 'Present day', code: 'N' } };
  const PALETTES = {
    moonlit: { label: 'Moonlit Frost', swatch: ['#0d1420', '#7fc4c4', '#c3cad3', '#f2e9b0'] },
    gaslight: { label: 'Gaslight Express', swatch: ['#4a1c1c', '#c9a46a', '#6b6866', '#efe6d2'] },
    seance: { label: 'Séance Lilac', swatch: ['#1a1620', '#9a86b0', '#c98b95', '#ece4d6'] },
    orchard: { label: 'Autumn Orchard', swatch: ['#3b2a1e', '#d9792b', '#56663a', '#e8b65a'] },
  };
  const DEFAULT_OPTS = { place: 'random', era: 'random', palette: 'auto' };

  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const wideQuery = window.matchMedia('(min-width: 1100px)');

  const S = {
    screen: 'title', titleMode: null, numError: '',
    c: null, diff: 'standard', done: [], solved: [], shoes: [], tab: 'ship',
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
  const avatar = (p, small) =>
    '<span class="avatar' + (small ? ' sm' : '') + '" style="--pc:' + p.color + '" aria-hidden="true">' + initials(p) + '</span>';
  const fill = (tpl, s, v) => tpl.split('{s}').join(person(s).name).split('{v}').join(person(v).name);
  const nameList = (ids) => {
    const n = ids.map((id) => person(id).name);
    return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  };
  const watchTime = () => clock((S.c.dinnerHour + S.c.T) * 60 + S.c.watchMinute);
  const slotTime = (s, minute) => clock((S.c.dinnerHour + s) * 60 + minute);
  // A locked phone opens once you have searched the room where its code is hidden.
  const phoneOpen = (pid) => { const b = S.c.belongings[pid]; return !b.locked || S.done.includes('s:' + b.codeRoom); };
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
        };
      }
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULT_OPTS);
  }
  function saveOpts(o) { try { localStorage.setItem(OPT_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } }
  let OPTS = loadOpts();

  function applyPalette() {
    let p = 'moonlit';
    if (OPTS.palette !== 'auto') p = OPTS.palette;
    else if (S.c && S.screen !== 'title') p = place().palette;
    document.documentElement.setAttribute('data-palette', p);
  }

  // ---------- saving ----------
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: S.c.seed, place: S.c.place, era: S.c.era, diff: S.diff, done: S.done, solved: S.solved, shoes: S.shoes }));
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
    S.c = MC.generateCase(seed, placeId, era, diff);
    S.diff = diff;
    S.done = [];
    S.solved = [];
    S.shoes = [];
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
      const on = OPTS[key] === it.v;
      return '<button class="choice' + (on ? ' selected' : '') + '" data-act="opt" data-k="' + key + '" data-v="' + it.v + '" aria-pressed="' + on + '">' +
        (it.swatch ? '<span class="swatch">' + it.swatch.map((c) => '<i style="background:' + c + '"></i>').join('') + '</span>' : '') +
        '<span>' + esc(it.label) + '</span></button>';
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
        Object.keys(DIFFS).map((k) =>
          '<button class="btn diff-btn" data-act="' + act + '" data-diff="' + k + '">' +
          '<strong>' + DIFFS[k].label + '</strong><span>' + DIFFS[k].desc + '</span></button>').join('') +
        '<button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else if (S.titleMode === 'options') {
      menu =
        '<div class="panel opts">' +
        '<h3>Location</h3>' + optGroup('place', [{ v: 'random', label: 'Random' }].concat(Object.keys(PLACES).map((k) => ({ v: k, label: PLACES[k].label })))) +
        '<h3>Era</h3>' + optGroup('era', [{ v: 'random', label: 'Random' }].concat(Object.keys(ERAS).map((k) => ({ v: k, label: ERAS[k].label })))) +
        '<h3>Colours</h3>' + optGroup('palette', [{ v: 'auto', label: 'Match the location' }].concat(Object.keys(PALETTES).map((k) => ({ v: k, label: PALETTES[k].label, swatch: PALETTES[k].swatch })))) +
        '<p class="hint">Random picks a new location or era for every case. Shared case codes always play the same, whatever your options.</p>' +
        '</div><button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else if (S.titleMode === 'how') {
      menu =
        '<div class="how panel">' +
        '<p>Someone has been murdered aboard a ship, a train or a plane, or at a lonely manor. You have until the journey ends, or the police arrive, to name the killer.</p>' +
        '<ul>' +
        '<li><strong>Search rooms</strong>, <strong>question guests</strong> and <strong>go through belongings</strong>. Each takes 30 minutes, so you cannot do everything.</li>' +
        '<li>Receipts, photos and tickets in someone\'s belongings prove where they really were. A stain shows a room they visited.</li>' +
        '<li>Locked phone? Its code is scribbled down in one of the rooms.</li>' +
        '<li>Three rooms hide a <strong>puzzle</strong>: a locked drawer or safe, a torn letter and a coded note. Solving one costs no time. On Standard and Dread they are timed, and failing costs 30 minutes.</li>' +
        '<li>The killer left a <strong>footprint</strong> at the crime scene. Ask guests for their shoes: it is free, but on harder settings some will refuse.</li>' +
        '<li>Search the <strong>crime scene</strong> first: it tells you when and how the victim died.</li>' +
        '<li>Everything you learn goes onto the <strong>timeline</strong>: who was where, hour by hour.</li>' +
        '<li>Innocent people tell the truth about the time of the murder. Find the one whose story falls apart.</li>' +
        '<li>Everyone had a motive. Motives alone will not solve it.</li>' +
        '<li>Some guests lie for harmless reasons. Watch which hour the lie is about.</li>' +
        '</ul>' +
        '<p>Every case has a code, like <strong>TN-4821</strong>. Give a friend the code and they get the same mystery.</p>' +
        '</div><button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else {
      menu =
        (sv ? '<button class="btn primary big" data-act="continue">Continue case ' + esc(PLACES[sv.place].code + ERAS[sv.era].code + '-' + sv.seed) + '</button>' : '') +
        '<button class="btn ' + (sv ? '' : 'primary ') + 'big" data-act="title-mode" data-mode="new">New case</button>' +
        '<button class="btn" data-act="title-mode" data-mode="number">Play a case code</button>' +
        '<button class="btn" data-act="title-mode" data-mode="options">Options</button>' +
        '<button class="btn ghost" data-act="title-mode" data-mode="how">How to play</button>';
    }
    return (
      '<section class="screen title-screen">' + LANTERN +
      '<h1 class="game-title">The Midnight<br>Crossing</h1>' +
      '<p class="tagline">A murder in the dark. A new case every night.</p>' +
      '<div class="title-menu">' + menu + '</div></section>'
    );
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
      '<button class="btn ghost icon-btn" data-act="home" aria-label="Back to main menu">☰</button>' +
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
    const tabs = [['ship', 'Rooms'], ['guests', 'Guests'], ['timeline', 'Timeline'], ['notes', 'Notes']]
      .filter((t) => !(wide && t[0] === 'timeline'));
    const views = { ship: viewRooms, guests: viewGuests, timeline: viewTimeline, notes: viewNotes };
    return (
      '<section class="screen investigate">' + topBar() +
      '<nav class="tabs" aria-label="Investigation">' +
      tabs.map((t) => '<button class="tab' + (t[0] === tab ? ' active' : '') + '" data-act="tab" data-tab="' + t[0] + '"' +
        (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</button>').join('') +
      '</nav>' +
      '<div class="inv-body"><div class="inv-main">' + views[tab]() + '</div>' +
      (wide ? '<aside class="inv-side">' + viewTimeline() + '</aside>' : '') +
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
        return (
          '<button class="card' + (done ? ' done' : '') + '" style="--room:' + r.color + '" data-act="search" data-id="' + r.id + '">' +
          '<span class="card-title"><span class="dot"></span>' + esc(r.name) + '</span>' +
          '<span class="card-sub">' + esc(r.desc) + '</span>' +
          '<span class="card-foot">' +
          (r.id === c.crimeRoom ? '<span class="tag danger">Crime scene</span>' : '') +
          '<span class="tag">' + (done ? '✓ Searched · read again' : 'Search · 30 min') + '</span></span></button>'
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
        c.statements[id].forEach((st) => {
          if (st.slot === 0) return;
          b[id][st.slot].push({ room: st.room, kind: 'claim', src: id, alone: st.emphaticAlone });
          st.with.forEach((w) => b[w][st.slot].push({ room: st.room, kind: 'with', src: id }));
        });
        c.sightings.forEach((sg) => {
          if (sg.witness === id) b[sg.subject][sg.slot].push({ room: sg.room, kind: sg.kind === 'heading' ? 'heading' : 'seen', src: id });
        });
      } else if (type === 'b') {
        const bel = c.belongings[id];
        bel.evidence.forEach((e) => { if (evidenceVisible(id, e)) b[id][e.slot].push({ room: e.room, kind: 'receipt' }); });
        if (bel.meeting) b[id][bel.meeting.slot].push({ room: bel.meeting.room, kind: 'note' });
      } else {
        const tr = c.traces[id];
        if (tr) b[tr.pid][tr.slot].push({ room: id, kind: 'trace' });
        if (id === c.crimeRoom) {
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
    claim: ['🗣', () => 'In their own words'],
    with: ['🤝', (src) => person(src).short + ' says they were together'],
    seen: ['👁', (src) => 'Seen by ' + person(src).short],
    heading: ['➜', (src) => person(src).short + ' saw them hurrying here'],
    trace: ['🔍', () => 'A personal item was found here'],
    receipt: ['🧾', () => 'Proof from their belongings'],
    note: ['📝', () => 'The victim planned to meet someone here'],
    body: ['†', () => 'The body was found here'],
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
        { claim: 'own words', with: 'was with', seen: 'seen by', heading: 'hurrying to', trace: 'item found', receipt: 'proof in belongings', note: 'victim\'s plan', body: 'body' }[k] + '</span>').join('') +
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

  // ---------- notes ----------
  function viewNotes() {
    const c = S.c;
    const searched = S.done.filter((a) => a[0] === 's').map((a) => a.slice(2));
    const questioned = S.done.filter((a) => a[0] === 'q').map((a) => a.slice(2));
    const w = weaponById(c.weapon);

    const facts = [];
    if (searched.includes(c.crimeRoom)) {
      facts.push('The victim\'s watch stopped at <strong>' + watchTime() + '</strong>.');
      facts.push('The wound: ' + esc(D.wounds[w.wound]));
    } else {
      facts.push('Search the crime scene (' + esc(room(c.crimeRoom).name) + ') to learn when and how the victim died.');
    }
    const accounted = [];
    searched.forEach((r) => {
      const hw = c.weapons.find((x) => x.home === r);
      if (hw.id === c.weapon) facts.push('The <strong>' + esc(hw.name) + '</strong> ' + (many(hw) ? 'are' : 'is') + ' missing from the ' + esc(room(r).name) + '.');
      else accounted.push(hw.name);
      if (r === c.hideRoom) facts.push('The <strong>' + esc(w.name) + '</strong> ' + (many(w) ? 'were' : 'was') + ' found hidden in the ' + esc(room(r).name) + '.');
    });
    if (accounted.length) facts.push('Untouched, in their usual places: ' + esc(accounted.join(', ')) + '.');

    const items = searched.filter((r) => c.traces[r]).map((r) => {
      const t = c.traces[r];
      return '<li>' + esc(person(t.pid).item) + ' (' + esc(person(t.pid).short) + ') in the ' + esc(room(r).name) + ', around ' + slot(t.slot) + '</li>';
    });
    const gossip = questioned.map((q) => '<li>' + esc(fill(c.motives[c.gossip[q]], c.gossip[q], c.victim)) + ' <small>(told by ' + esc(person(q).short) + ')</small></li>');
    const looked = S.done.filter((a) => a[0] === 'b').map((a) => a.slice(2));
    looked.forEach((pid) => {
      if (pid !== c.victim) gossip.push('<li>' + esc(fill(c.motives[pid], pid, c.victim)) + ' <small>(note in ' + esc(person(pid).short) + '\'s belongings)</small></li>');
    });
    const stains = looked.filter((pid) => pid !== c.victim).map((pid) => {
      const rr = room(c.belongings[pid].residueRoom);
      return '<li><strong>' + esc(person(pid).short) + ':</strong> ' + esc(rr.residue) + ' (the ' + esc(rr.name) + ')</li>';
    });
    const phones = looked.filter((pid) => c.belongings[pid].locked).map((pid) =>
      '<li>' + esc(person(pid).short) + '\'s phone: ' + (phoneOpen(pid) ? 'unlocked' : 'locked. The code is hidden in one of the rooms.') + '</li>');
    if (looked.includes(c.victim)) {
      const m = c.belongings[c.victim].meeting;
      facts.push('The victim planned to meet someone in the <strong>' + esc(room(m.room).name) + '</strong> at ' + slot(m.slot) + '.');
    }
    if (S.solved.includes('letter')) facts.push('The victim\'s torn letter: ' + esc(letterMeaning()));
    if (S.solved.includes('cipher')) facts.push('The coded note: something is hidden in the <strong>' + esc(room(c.hideRoom).name) + '</strong>.');
    if (S.solved.includes('drawer')) {
      facts.push('The victim\'s note from the ' + esc(pzName('drawer')) + ': at ' + slot(c.T) + ', ' +
        c.puzzles.drawer.proof.map((x) => esc(person(x.pid).name) + ' was in the ' + esc(room(x.room).name)).join(' and ') + '.');
    }
    const found = PUZZLE_IDS.filter((id) => searched.includes(c.puzzles[id].room));
    const puzzleRows = found.map((id) => '<li><button class="linkish" data-act="puzzle" data-id="' + id + '">' + esc(cap(pzName(id))) +
      ' (' + esc(room(c.puzzles[id].room).name) + ')</button>: ' + (S.solved.includes(id) ? 'solved' : 'not solved yet') + '</li>');
    const shoeRows = S.shoes.map((pid) => {
      const sh = c.puzzles.shoes[pid];
      return '<li><strong>' + esc(person(pid).short) + ':</strong> ' + (sh.refuses ? 'refused to show them'
        : esc(sh.name) + ', ' + esc(treadName(sh.tread)) + '. ' + (sh.tread === c.puzzles.print.tread ? '<strong>Fits the footprint.</strong>' : 'Does not fit.')) + '</li>';
    });
    const log = S.done.map((a, i) => {
      const t = clock(startMin() + i * ACTION_MIN);
      if (a[0] === 'x') return '<li>' + t + ' · Lost half an hour on the ' + esc(pzName(a.split(':')[1])) + '</li>';
      const label = a[0] === 'q' ? 'Questioned ' + person(a.slice(2)).name
        : a[0] === 'b' ? 'Went through ' + person(a.slice(2)).name + '\'s belongings'
        : 'Searched the ' + room(a.slice(2)).name;
      return '<li><button class="linkish" data-act="view" data-id="' + a + '">' + t + ' · ' + esc(label) + '</button></li>';
    });

    return (
      '<h2 class="section-title">Notebook</h2>' +
      '<div class="panel"><h3>Key facts</h3><ul class="facts">' + facts.map((f) => '<li>' + f + '</li>').join('') + '</ul></div>' +
      '<div class="panel"><h3>Items found</h3>' + (items.length ? '<ul>' + items.join('') + '</ul>' : '<p class="hint">Nothing yet.</p>') + '</div>' +
      (printFound() ? '<div class="panel"><h3>The footprint</h3><div class="print-clue">' + soleSVG(c.puzzles.print.tread) +
        '<div>Left beside the body: ' + esc(treadName(c.puzzles.print.tread)) + '.</div></div>' +
        (shoeRows.length ? '<ul>' + shoeRows.join('') + '</ul>' + (S.shoes.some((p) => c.puzzles.shoes[p].refuses) ? '<p class="hint">A refusal proves nothing. Some people simply love their shoes.</p>' : '')
          : '<p class="hint">Ask guests for their shoes on the Guests page. It takes no time.</p>') + '</div>' : '') +
      (puzzleRows.length ? '<div class="panel"><h3>Puzzles</h3><ul>' + puzzleRows.join('') + '</ul></div>' : '') +
      '<div class="panel"><h3>Stains on belongings</h3>' + (stains.length ? '<ul>' + stains.join('') + '</ul>' +
        '<p class="hint">A stain from a room someone never mentioned means they lied about something.</p>' : '<p class="hint">Look through guests\' belongings to find them.</p>') + '</div>' +
      (phones.length ? '<div class="panel"><h3>Locked phones</h3><ul>' + phones.join('') + '</ul></div>' : '') +
      '<div class="panel"><h3>Motives you have heard</h3>' + (gossip.length ? '<ul>' + gossip.join('') + '</ul>' : '<p class="hint">Question guests to hear the gossip.</p>') + '</div>' +
      '<div class="panel"><h3>Your night so far</h3>' + (log.length ? '<ol class="log">' + log.join('') + '</ol>' : '<p class="hint">You have not started yet.</p>') + '</div>'
    );
  }

  // ---------- action results ----------
  function interviewHTML(pid) {
    const c = S.c;
    const p = person(pid);
    const pk = phrasePicker('q:' + pid);
    const parts = ['<p class="say">“' + esc(p.greeting) + '”</p>'];
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

    const sights = c.sightings.filter((sg) => sg.witness === pid).sort((a, b) => a.slot - b.slot);
    if (sights.length) parts.push('<p class="aside">Did you see anyone else?</p>');
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

    parts.push('<p class="aside">And the victim?</p>');
    parts.push('<p class="say">“Between you and me… ' + esc(fill(c.motives[c.gossip[pid]], c.gossip[pid], c.victim)) + '”</p>');
    parts.push('<p class="eerie">' + esc(pk(place().omens.concat(D.omens))) + '</p>');
    return { title: 'Questioning ' + p.name, sub: p.title, body: parts.join(''), color: p.color };
  }

  function searchHTML(rid) {
    const c = S.c;
    const r = room(rid);
    const pk = phrasePicker('s:' + rid);
    const parts = ['<p>' + esc(r.desc) + '</p>'];
    const w = weaponById(c.weapon);

    if (rid === c.crimeRoom) {
      parts.push('<p>' + esc(person(c.victim).name) + ' lies where ' + esc(person(c.finder).name) + ' found the body at ' + clock(c.foundMin) + '.</p>');
      parts.push('<p class="clue"><strong>The victim\'s watch:</strong> smashed in the struggle, stopped at ' + watchTime() + '.</p>');
      parts.push('<p class="clue"><strong>The wound:</strong> ' + esc(D.wounds[w.wound]) + '</p>');
    }
    const hw = c.weapons.find((x) => x.home === rid);
    if (hw.id === c.weapon) parts.push('<p class="clue"><strong>Something is missing:</strong> ' + esc(hw.empty) + '.</p>');
    else parts.push('<p class="clue muted">The ' + esc(hw.name) + (many(hw) ? ' are in their usual place' : ' is in its usual place') + ', untouched.</p>');
    if (rid === c.hideRoom) {
      parts.push('<p class="clue"><strong>Hidden ' + esc(r.hide) + ':</strong> the ' + esc(w.name) + '. Someone has wiped ' + (many(w) ? 'them' : 'it') + ', but not well enough.</p>');
    }
    const tr = c.traces[rid];
    if (tr) {
      const tp = person(tr.pid);
      parts.push('<p class="clue"><span class="time">' + slot(tr.slot) + '</span><strong>Found:</strong> ' + esc(tp.item) +
        '. It belongs to ' + esc(tp.name) + '. Left around ' + slot(tr.slot) + ', judging by ' + esc(tr.reason) + '.</p>');
    }
    const codeOwner = c.codeNotes[rid];
    if (codeOwner) {
      parts.push('<p class="clue"><strong>A scrap of paper</strong>, tucked out of sight: "' + esc(person(codeOwner).short) + ' — phone code ' +
        c.belongings[codeOwner].code + '". ' + esc(person(codeOwner).name) + '\'s phone can be unlocked now.' +
        (S.done.includes('b:' + codeOwner) ? ' Open their belongings again to read it. It costs no extra time.' : '') + '</p>');
    }
    if (rid === c.crimeRoom) {
      parts.push('<div class="clue print-clue">' + soleSVG(c.puzzles.print.tread) + '<div><strong>A footprint</strong> beside the body, left in ' +
        esc(r.residue) + '. The sole has ' + esc(treadName(c.puzzles.print.tread)) + '. It is not the victim\'s.' +
        '<br><small>Ask the guests to show you their shoes. Asking takes no time.</small></div></div>');
    }
    const here = PUZZLE_IDS.filter((id) => c.puzzles[id].room === rid);
    here.forEach((id) => {
      parts.push('<div class="clue"><strong>' + esc(cap(pzName(id))) + ':</strong> ' + esc(pzFound(id)) +
        '<br><button class="btn pz-open" data-act="puzzle" data-id="' + id + '">' +
        (S.solved.includes(id) ? '✓ Solved · look again' : 'Take a closer look') + '</button></div>');
    });
    if (rid !== c.crimeRoom && !tr && rid !== c.hideRoom && !codeOwner && !here.length) parts.push('<p>Nothing else seems out of place.</p>');
    parts.push('<p class="eerie">' + esc(pk(r.eerie)) + '</p>');
    return { title: 'Searching the ' + r.name, sub: rid === c.crimeRoom ? 'The crime scene' : '', body: parts.join(''), color: r.color };
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
  const printFound = () => S.done.includes('s:' + S.c.crimeRoom);
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
      '<div class="modal-foot">' + foot + '</div>';
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
    if (!S.shoes.includes(pid)) { S.shoes.push(pid); save(); render(); }
    const p = person(pid);
    const sh = c.puzzles.shoes[pid];
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
    showModal(esc(p.title), p.name + '\'s shoes', p.color, body, '<button class="btn primary" data-act="close-modal">Done</button>');
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
      body = pzSolvedHTML(id);
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

  function openPuzzle(id) {
    const c = S.c;
    if (!PUZZLE_IDS.includes(id) || !S.done.includes('s:' + c.puzzles[id].room)) return;
    stopPzTimer();
    PZ = { id, phase: S.solved.includes(id) ? 'done' : (pzLimit(id) ? 'intro' : 'run'), timer: null, lost: false };
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
    const res = id[0] === 'q' ? interviewHTML(id.slice(2)) : id[0] === 'b' ? belongingsHTML(id.slice(2)) : searchHTML(id.slice(2));
    const idx = S.done.indexOf(id);
    const when = clock(startMin() + idx * ACTION_MIN);
    const dawnNext = isNew && leadsLeft() <= 0;
    stopPzTimer();
    PZ = null;
    showModal(when + (res.sub ? ' · ' + esc(res.sub) : ''), res.title, res.color, res.body,
      (dawnNext ? '<p class="dawn-warn">' + esc(fmt(place().endWarn)) + '</p>' : '') +
      '<button class="btn primary" data-act="close-modal">' + (dawnNext ? 'Make your accusation' : 'Done') + '</button>');
    focusModal();
  }

  function closeModal() {
    // Walking away from a timed puzzle counts as failing it.
    if (PZ && PZ.phase === 'run' && pzLimit(PZ.id)) { failPuzzle(); return; }
    stopPzTimer();
    PZ = null;
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
      choiceGroup('weapon', c.weapons.map((w) => ({ v: w.id, color: room(w.home).color, html: '<span>' + esc(cap(w.name)) + '</span>' }))) +
      '<h3>When?</h3>' +
      choiceGroup('slot', [1, 2, 3].map((s) => ({ v: s, html: '<span>Between ' + slot(s) + ' and ' + endOfSlot(s) + '</span>' }))) +
      '<details class="panel accuse-board"><summary>Look at the timeline again</summary>' + boardHTML() + '</details>' +
      '<div class="accuse-actions">' +
      (S.dawn ? '' : '<button class="btn ghost" data-act="back-to-case">Keep investigating</button>') +
      '<button class="btn primary big" data-act="submit"' + (ready ? '' : ' disabled') + '>' + (ready ? 'Accuse' : 'Choose all three') + '</button>' +
      '</div></section>'
    );
  }

  function viewResult() {
    const c = S.c;
    const k = person(c.killer), v = person(c.victim), w = weaponById(c.weapon);
    const got = { killer: S.draft.killer === c.killer, weapon: S.draft.weapon === c.weapon, slot: Number(S.draft.slot) === c.T };
    const score = (got.killer ? 1 : 0) + (got.weapon ? 1 : 0) + (got.slot ? 1 : 0);
    const headline = got.killer
      ? (score === 3 ? 'A perfect deduction.' : 'You caught the killer.')
      : 'The killer walks free, ' + place().walkFree + '.';
    const mark = (ok) => '<span class="mark ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓' : '✗') + '</span>';
    const hl = person(c.H);
    const secret = c.hSecret.split('{room}').join(room(c.hTrue).name);
    return (
      '<section class="screen result">' +
      '<p class="kicker">Case ' + caseCode(c) + ' · ' + DIFFS[S.diff].label + '</p>' +
      '<h2 class="' + (got.killer ? 'win' : 'lose') + '">' + esc(headline) + '</h2>' +
      '<div class="panel"><h3>Your accusation</h3><ul class="verdict">' +
      '<li>' + mark(got.killer) + 'Killer: ' + esc(person(S.draft.killer).name) + '</li>' +
      '<li>' + mark(got.weapon) + 'Weapon: ' + esc(weaponById(S.draft.weapon).name) + '</li>' +
      '<li>' + mark(got.slot) + 'Time: between ' + slot(S.draft.slot) + ' and ' + endOfSlot(S.draft.slot) + '</li></ul></div>' +
      '<div class="panel truth"><h3>What really happened</h3>' +
      '<p>At ' + watchTime() + ', in the ' + esc(room(c.crimeRoom).name) + ', <strong>' + esc(k.name) + '</strong> killed ' + esc(v.name) + ' with the ' + esc(w.name) + '.</p>' +
      '<p>' + esc(k.name) + ' claimed to be in the ' + esc(room(c.claimRoom).name) + ' at ' + slot(c.T) + '. But ' + esc(person(c.W).name) +
      ' was in the ' + esc(room(c.claimRoom).name) + ' all that hour, and nobody else came in.</p>' +
      '<p>The ' + esc(w.name) + (many(w) ? ' were' : ' was') + ' taken from the ' + esc(room(w.home).name) + ' and hidden ' + esc(room(c.hideRoom).hide) + ' in the ' + esc(room(c.hideRoom).name) + '.</p>' +
      '<p>The motive: ' + esc(fill(c.motives[c.killer], c.killer, c.victim)) + '</p>' +
      '<p class="aside">The red herring: ' + esc(hl.name) + ' lied about ' + slot(c.hSlot) + ', but only because ' + esc(hl.name) + ' ' + esc(secret) + '.</p>' +
      '</div>' +
      '<p class="hint">Share this case: <strong>' + caseCode(c) + '</strong></p>' +
      '<div class="accuse-actions">' +
      '<button class="btn primary big" data-act="title-mode" data-mode="new">New case</button>' +
      '<button class="btn" data-act="home">Main menu</button></div>' +
      '</section>'
    );
  }

  // ---------- rendering & input ----------
  function render() {
    const views = { title: viewTitle, briefing: viewBriefing, investigate: viewInvestigate, accuse: viewAccuse, result: viewResult };
    applyPalette();
    app.innerHTML = views[S.screen]();
    if (S.screen !== lastScreen) { window.scrollTo(0, 0); lastScreen = S.screen; }
    if (S.screen === 'title' && S.titleMode === 'number') {
      const input = document.getElementById('case-num');
      if (input) input.focus();
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target === modal) { closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const d = el.dataset;
    switch (d.act) {
      case 'title-mode':
        S.titleMode = d.mode || null; S.numError = ''; S.screen = 'title'; render(); break;
      case 'opt':
        OPTS[d.k] = d.v; saveOpts(OPTS); render(); break;
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
        S.c = MC.generateCase(sv.seed, sv.place, sv.era, sv.diff);
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
        S.draft = {}; S.tab = 'ship';
        S.dawn = leadsLeft() <= 0;
        S.screen = S.dawn ? 'accuse' : 'investigate';
        render(); break;
      }
      case 'begin': S.screen = 'investigate'; render(); break;
      case 'tab': S.tab = d.tab; render(); break;
      case 'search': doAction('s:' + d.id); break;
      case 'question': doAction('q:' + d.id); break;
      case 'belongings': doAction('b:' + d.id); break;
      case 'view': openResult(d.id, false); break;
      case 'shoes': askShoes(d.id); break;
      case 'puzzle': openPuzzle(d.id); break;
      case 'pz-start': startPuzzle(); break;
      case 'pz-dial': case 'pz-try': case 'pz-strip': case 'pz-shift': case 'pz-read':
        puzzleInput({ act: d.act, i: d.i, d: d.d }); break;
      case 'accuse': S.screen = 'accuse'; S.dawn = false; render(); break;
      case 'back-to-case': S.screen = 'investigate'; render(); break;
      case 'pick': S.draft[d.k] = d.k === 'slot' ? Number(d.v) : d.v; render(); break;
      case 'submit': clearSave(); S.screen = 'result'; render(); break;
      case 'close-modal': closeModal(); break;
      case 'home': S.screen = 'title'; S.titleMode = null; render(); break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
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
