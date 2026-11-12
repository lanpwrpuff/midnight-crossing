// Screens, controls and saving for The Midnight Crossing.
(function () {
  'use strict';
  const MC = window.MC;
  const D = MC.DATA;
  const SLOT = MC.SLOT_LABELS;

  const SAVE_KEY = 'midnight-crossing-save-v1';
  const ACTION_MIN = 30;
  const DAWN_MIN = 360; // 6:00 AM, in minutes after midnight
  const DIFFS = {
    cozy: { label: 'Cozy', startMin: 0, highlight: true,
      desc: 'Time to follow every lead. Contradictions are highlighted on the timeline.' },
    standard: { label: 'Standard', startMin: 30, highlight: true,
      desc: 'Time for all but one lead. Contradictions are highlighted.' },
    dread: { label: 'Dread', startMin: 120, highlight: false,
      desc: 'Only eight leads before dawn. No highlights and fewer helpful witnesses.' },
  };

  const app = document.getElementById('app');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const wideQuery = window.matchMedia('(min-width: 1100px)');

  const S = {
    screen: 'title', titleMode: null, numError: '',
    c: null, diff: 'standard', done: [], tab: 'ship',
    draft: {}, dawn: false,
  };
  let lastScreen = null;

  // ---------- helpers ----------
  const room = (id) => D.rooms.find((r) => r.id === id);
  const person = (id) => D.characters.find((p) => p.id === id);
  const weaponById = (id) => D.weapons.find((w) => w.id === id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // Same case + same action = same wording every time you re-read it.
  function phrasePicker(id) {
    const r = MC.makeRng((S.c.seed * 7919 + hashStr(id)) >>> 0);
    return (a) => a[Math.floor(r() * a.length)];
  }
  function clock(min) {
    const h = Math.floor(min / 60) % 24, m = min % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  const totalLeads = () => (DAWN_MIN - DIFFS[S.diff].startMin) / ACTION_MIN;
  const nowMin = () => DIFFS[S.diff].startMin + S.done.length * ACTION_MIN;
  const leadsLeft = () => totalLeads() - S.done.length;
  const randomSeed = () => 1000 + Math.floor(Math.random() * 9000);
  const isWide = () => wideQuery.matches;

  function initials(p) {
    const parts = p.name.replace(/^(Mrs\.|Mr\.|Miss|Dr\.|Lady|Colonel|Captain|Professor)\s+/, '').split(' ');
    return parts[0][0] + parts[parts.length - 1][0];
  }
  const avatar = (p, small) =>
    '<span class="avatar' + (small ? ' sm' : '') + '" style="--pc:' + p.color + '" aria-hidden="true">' + initials(p) + '</span>';
  const fill = (tpl, s, v) => tpl.split('{s}').join(person(s).name).split('{v}').join(person(v).name);
  const nameList = (ids) => {
    const n = ids.map((id) => person(id).name);
    return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  };
  const watchTime = () => (S.c.T + 8) + ':' + String(S.c.watchMinute).padStart(2, '0') + ' PM';

  // ---------- saving ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: S.c.seed, diff: S.diff, done: S.done })); } catch (e) { /* storage blocked */ }
  }
  function loadSave() {
    try {
      const v = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (v && typeof v.seed === 'number' && DIFFS[v.diff] && Array.isArray(v.done)) return v;
    } catch (e) { /* ignore */ }
    return null;
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function startCase(seed, diff) {
    S.c = MC.generateCase(seed, diff);
    S.diff = diff;
    S.done = [];
    S.draft = {};
    S.dawn = false;
    S.tab = 'ship';
    S.screen = 'briefing';
    save();
    render();
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
  function viewTitle() {
    const sv = loadSave();
    let menu = '';
    if (S.titleMode === 'new' || S.titleMode === 'number') {
      const act = S.titleMode === 'new' ? 'new' : 'number-start';
      menu =
        (S.titleMode === 'number'
          ? '<label class="field"><span>Case number (4 digits)</span>' +
            '<input id="case-num" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="e.g. 4821"></label>' +
            (S.numError ? '<p class="error">' + esc(S.numError) + '</p>' : '')
          : '') +
        '<p class="menu-label">Choose a difficulty</p>' +
        Object.keys(DIFFS).map((k) =>
          '<button class="btn diff-btn" data-act="' + act + '" data-diff="' + k + '">' +
          '<strong>' + DIFFS[k].label + '</strong><span>' + DIFFS[k].desc + '</span></button>').join('') +
        '<button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else if (S.titleMode === 'how') {
      menu =
        '<div class="how panel">' +
        '<p>A guest has been murdered aboard the steamer <em>Wren</em>. You have until the ship docks at dawn to name the killer.</p>' +
        '<ul>' +
        '<li><strong>Search rooms</strong> and <strong>question guests</strong>. Each takes 30 minutes, so you cannot do everything.</li>' +
        '<li>Search the <strong>crime scene</strong> first: it tells you when and how the victim died.</li>' +
        '<li>Everything you learn goes onto the <strong>timeline</strong>: who was where, hour by hour.</li>' +
        '<li>Innocent people tell the truth about the time of the murder. Find the one whose story falls apart.</li>' +
        '<li>Everyone had a motive. Motives alone will not solve it.</li>' +
        '<li>Some guests lie for harmless reasons. Watch which hour the lie is about.</li>' +
        '</ul>' +
        '<p>Every case has a number. Give a friend the number and they get the same mystery.</p>' +
        '</div><button class="btn ghost" data-act="title-mode" data-mode="">Back</button>';
    } else {
      menu =
        (sv ? '<button class="btn primary big" data-act="continue">Continue case #' + sv.seed + '</button>' : '') +
        '<button class="btn ' + (sv ? '' : 'primary ') + 'big" data-act="title-mode" data-mode="new">New case</button>' +
        '<button class="btn" data-act="title-mode" data-mode="number">Play a case number</button>' +
        '<button class="btn ghost" data-act="title-mode" data-mode="how">How to play</button>';
    }
    return (
      '<section class="screen title-screen">' + LANTERN +
      '<h1 class="game-title">The Midnight<br>Crossing</h1>' +
      '<p class="tagline">A murder aboard a ferry lost in fog. A new case every night.</p>' +
      '<div class="title-menu">' + menu + '</div></section>'
    );
  }

  // ---------- briefing ----------
  function viewBriefing() {
    const c = S.c;
    const v = person(c.victim);
    return (
      '<section class="screen briefing panel">' +
      '<p class="kicker">Case #' + c.seed + ' · ' + DIFFS[S.diff].label + '</p>' +
      '<h2>Fog on Hollow Sound</h2>' +
      '<p>The old steamer <em>Wren</em> left harbour at dusk with six passengers aboard. By eight o\'clock the fog had swallowed the lights of the shore, and everyone sat down to dinner together in the Dining Saloon.</p>' +
      '<p>After dinner, the guests drifted off around the ship.</p>' +
      '<div class="victim-card">' + avatar(v) + '<div><strong>' + esc(v.name) + '</strong>, ' + esc(v.title) +
      '<br>Found dead in the <strong>' + esc(room(c.crimeRoom).name) + '</strong> at midnight by ' + esc(person(c.finder).name) + '.</div></div>' +
      '<p>You spent the whole evening seasick in your cabin, which makes you the one passenger nobody suspects. The first mate has asked you to find the killer before the <em>Wren</em> docks.</p>' +
      '<p class="clue">Dawn is at <strong>6:00 AM</strong>. It is now <strong>' + clock(nowMin()) + '</strong>. Every search or question takes 30 minutes: you have <strong>' + totalLeads() + ' leads</strong>.</p>' +
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
      '<span class="leads">' + n + ' lead' + (n === 1 ? '' : 's') + ' until dawn</span></div>' +
      '<span class="case-no">Case #' + S.c.seed + '</span>' +
      '<button class="btn primary" data-act="accuse">Accuse</button>' +
      '</header>'
    );
  }

  function viewInvestigate() {
    const wide = isWide();
    let tab = S.tab;
    if (wide && tab === 'timeline') tab = 'ship';
    const tabs = [['ship', 'Ship'], ['guests', 'Guests'], ['timeline', 'Timeline'], ['notes', 'Notes']]
      .filter((t) => !(wide && t[0] === 'timeline'));
    const views = { ship: viewShip, guests: viewGuests, timeline: viewTimeline, notes: viewNotes };
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

  function viewShip() {
    const c = S.c;
    return (
      '<h2 class="section-title">Search the ship</h2>' +
      '<div class="cards">' +
      D.rooms.map((r) => {
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

  function viewGuests() {
    const c = S.c;
    const v = person(c.victim);
    return (
      '<h2 class="section-title">Question the guests</h2>' +
      '<div class="victim-card slim">' + avatar(v, true) + '<span><strong>' + esc(v.name) + '</strong> (the victim), ' + esc(v.title) + '</span></div>' +
      '<div class="cards">' +
      c.suspects.map((id) => {
        const p = person(id);
        const done = S.done.includes('q:' + id);
        return (
          '<button class="card guest' + (done ? ' done' : '') + '" style="--room:' + p.color + '" data-act="question" data-id="' + id + '">' +
          '<span class="card-title">' + avatar(p) + '<span>' + esc(p.name) + '<small>' + esc(p.title) + '</small></span></span>' +
          '<span class="card-foot"><span class="tag">' + (done ? '✓ Questioned · read again' : 'Question · 30 min') + '</span></span></button>'
        );
      }).join('') +
      '</div>'
    );
  }

  // ---------- timeline board ----------
  function buildBoard() {
    const c = S.c;
    const b = {};
    [c.victim].concat(c.suspects).forEach((p) => (b[p] = [[{ room: 'saloon', kind: 'known' }], [], [], []]));
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
      } else {
        const tr = c.traces[id];
        if (tr) b[tr.pid][tr.slot].push({ room: id, kind: 'trace' });
        if (id === c.crimeRoom) {
          b[c.victim][c.T].push({ room: id, kind: 'body' });
          for (let s = c.T + 1; s <= 3; s++) b[c.victim][s].push({ room: id, kind: 'dead' });
        }
      }
    });
    return b;
  }

  const KINDS = {
    known: ['🍽', () => 'Everyone was at dinner'],
    claim: ['🗣', () => 'In their own words'],
    with: ['👥', (src) => person(src).short + ' says they were together'],
    seen: ['👁', (src) => 'Seen by ' + person(src).short],
    heading: ['➜', (src) => person(src).short + ' saw them hurrying here'],
    trace: ['🔍', () => 'A personal item was found here'],
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
      SLOT.map((t, i) => '<th scope="col">' + t + (i === 0 ? '<small>dinner</small>' : '') + '</th>').join('') +
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
        { claim: 'own words', with: 'was with', seen: 'seen by', heading: 'hurrying to', trace: 'item found', body: 'body' }[k] + '</span>').join('') +
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
      facts.push('The victim\'s pocket watch stopped at <strong>' + watchTime() + '</strong>.');
      facts.push('The wound: ' + esc(D.wounds[w.wound]));
    } else {
      facts.push('Search the crime scene (' + esc(room(c.crimeRoom).name) + ') to learn when and how the victim died.');
    }
    const accounted = [];
    searched.forEach((r) => {
      const hw = D.weapons.find((x) => x.home === r);
      if (hw.id === c.weapon) facts.push('The <strong>' + esc(hw.name) + '</strong> is missing from the ' + esc(room(r).name) + '.');
      else accounted.push(hw.name);
      if (r === c.hideRoom) facts.push('The <strong>' + esc(w.name) + '</strong> was found hidden in the ' + esc(room(r).name) + '.');
    });
    if (accounted.length) facts.push('Untouched, in their usual places: ' + esc(accounted.join(', ')) + '.');

    const items = searched.filter((r) => c.traces[r]).map((r) => {
      const t = c.traces[r];
      return '<li>' + esc(person(t.pid).item) + ' (' + esc(person(t.pid).short) + ') in the ' + esc(room(r).name) + ', around ' + SLOT[t.slot] + '</li>';
    });
    const gossip = questioned.map((q) => '<li>' + esc(fill(c.motives[c.gossip[q]], c.gossip[q], c.victim)) + ' <small>(told by ' + esc(person(q).short) + ')</small></li>');
    const log = S.done.map((a, i) => {
      const t = clock(DIFFS[S.diff].startMin + i * ACTION_MIN);
      const label = a[0] === 'q' ? 'Questioned ' + person(a.slice(2)).name : 'Searched the ' + room(a.slice(2)).name;
      return '<li><button class="linkish" data-act="view" data-id="' + a + '">' + t + ' · ' + esc(label) + '</button></li>';
    });

    return (
      '<h2 class="section-title">Notebook</h2>' +
      '<div class="panel"><h3>Key facts</h3><ul class="facts">' + facts.map((f) => '<li>' + f + '</li>').join('') + '</ul></div>' +
      '<div class="panel"><h3>Items found</h3>' + (items.length ? '<ul>' + items.join('') + '</ul>' : '<p class="hint">Nothing yet.</p>') + '</div>' +
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
    const line = (slot, text) => '<p class="clue"><span class="time">' + SLOT[slot] + '</span>“' + text + '”</p>';

    c.statements[pid].forEach((st) => {
      const rn = esc(room(st.room).name);
      const t = SLOT[st.slot];
      if (st.slot === 0) { parts.push(line(0, 'We all had dinner together in the Dining Saloon at eight, of course.')); return; }
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
      const t = SLOT[sg.slot];
      let text;
      if (sg.kind === 'aloneSaw') text = 'When I passed the ' + rn + ' at ' + t + ', ' + n + ' was in there, all alone.';
      else if (sg.kind === 'heading') text = 'Just after ' + t + ', I saw ' + n + ' hurrying toward the ' + rn + '. In a terrible rush, too.';
      else text = pk(['Around ' + t + ', I glanced into the ' + rn + ' and saw ' + n + '.', 'I passed the ' + rn + ' at about ' + t + '. ' + n + ' was inside.']);
      parts.push(line(sg.slot, text));
    });

    parts.push('<p class="aside">And the victim?</p>');
    parts.push('<p class="say">“Between you and me… ' + esc(fill(c.motives[c.gossip[pid]], c.gossip[pid], c.victim)) + '”</p>');
    parts.push('<p class="eerie">' + esc(pk(D.omens)) + '</p>');
    return { title: 'Questioning ' + p.name, sub: p.title, body: parts.join(''), color: p.color };
  }

  function searchHTML(rid) {
    const c = S.c;
    const r = room(rid);
    const pk = phrasePicker('s:' + rid);
    const parts = ['<p>' + esc(r.desc) + '</p>'];
    const w = weaponById(c.weapon);

    if (rid === c.crimeRoom) {
      parts.push('<p>' + esc(person(c.victim).name) + ' lies where ' + esc(person(c.finder).name) + ' found the body at midnight.</p>');
      parts.push('<p class="clue"><strong>Pocket watch:</strong> smashed in the struggle, stopped at ' + watchTime() + '.</p>');
      parts.push('<p class="clue"><strong>The wound:</strong> ' + esc(D.wounds[w.wound]) + '</p>');
    }
    const hw = D.weapons.find((x) => x.home === rid);
    if (hw.id === c.weapon) parts.push('<p class="clue"><strong>Something is missing:</strong> ' + esc(hw.empty) + '.</p>');
    else parts.push('<p class="clue muted">The ' + esc(hw.name) + ' is in its usual place, untouched.</p>');
    if (rid === c.hideRoom) {
      parts.push('<p class="clue"><strong>Hidden ' + esc(r.hide) + ':</strong> the ' + esc(w.name) + '. Someone has wiped it, but not well enough.</p>');
    }
    const tr = c.traces[rid];
    if (tr) {
      const tp = person(tr.pid);
      parts.push('<p class="clue"><span class="time">' + SLOT[tr.slot] + '</span><strong>Found:</strong> ' + esc(tp.item) +
        '. It belongs to ' + esc(tp.name) + '. Left around ' + SLOT[tr.slot] + ', judging by ' + esc(tr.reason) + '.</p>');
    }
    if (rid !== c.crimeRoom && !tr && rid !== c.hideRoom) parts.push('<p>Nothing else seems out of place.</p>');
    parts.push('<p class="eerie">' + esc(pk(r.eerie)) + '</p>');
    return { title: 'Searching the ' + r.name, sub: rid === c.crimeRoom ? 'The crime scene' : '', body: parts.join(''), color: r.color };
  }

  function openResult(id, isNew) {
    const res = id[0] === 'q' ? interviewHTML(id.slice(2)) : searchHTML(id.slice(2));
    const idx = S.done.indexOf(id);
    const when = clock(DIFFS[S.diff].startMin + idx * ACTION_MIN);
    const dawnNext = isNew && leadsLeft() <= 0;
    modalBody.innerHTML =
      '<div class="modal-head" style="--room:' + res.color + '"><p class="kicker">' + when + (res.sub ? ' · ' + esc(res.sub) : '') + '</p>' +
      '<h2 id="modal-title">' + esc(res.title) + '</h2></div>' +
      '<div class="modal-content">' + res.body + '</div>' +
      '<div class="modal-foot">' +
      (dawnNext ? '<p class="dawn-warn">The sky is turning grey. The <em>Wren</em> is coming into port.</p>' : '') +
      '<button class="btn primary" data-act="close-modal">' + (dawnNext ? 'Make your accusation' : 'Done') + '</button></div>';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    modalBody.scrollTop = 0;
    const btn = modalBody.querySelector('[data-act="close-modal"]');
    if (btn) btn.focus({ preventScroll: true });
  }

  function closeModal() {
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
        ? '<h2>Dawn breaks over Hollow Sound</h2><p>The <em>Wren</em> is docking. Name the killer before anyone steps ashore.</p>'
        : '<h2>Make your accusation</h2><p>Once you accuse, the case is closed. You still have ' + leadsLeft() + ' lead' + (leadsLeft() === 1 ? '' : 's') + '.</p>') +
      '<h3>Who killed ' + esc(person(c.victim).name) + ' in the ' + esc(room(c.crimeRoom).name) + '?</h3>' +
      choiceGroup('killer', c.suspects.map((id) => ({ v: id, color: person(id).color, html: avatar(person(id), true) + '<span>' + esc(person(id).name) + '</span>' }))) +
      '<h3>With what?</h3>' +
      choiceGroup('weapon', D.weapons.map((w) => ({ v: w.id, color: room(w.home).color, html: '<span>' + esc(w.name[0].toUpperCase() + w.name.slice(1)) + '</span>' }))) +
      '<h3>When?</h3>' +
      choiceGroup('slot', [1, 2, 3].map((s) => ({ v: s, html: '<span>Between ' + SLOT[s] + ' and ' + (s === 3 ? 'midnight' : SLOT[s + 1]) + '</span>' }))) +
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
      : 'The killer walks free into the fog.';
    const mark = (ok) => '<span class="mark ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓' : '✗') + '</span>';
    const hl = person(c.H);
    const secret = c.hSecret.split('{room}').join(room(c.hTrue).name);
    return (
      '<section class="screen result">' +
      '<p class="kicker">Case #' + c.seed + ' · ' + DIFFS[S.diff].label + '</p>' +
      '<h2 class="' + (got.killer ? 'win' : 'lose') + '">' + headline + '</h2>' +
      '<div class="panel"><h3>Your accusation</h3><ul class="verdict">' +
      '<li>' + mark(got.killer) + 'Killer: ' + esc(person(S.draft.killer).name) + '</li>' +
      '<li>' + mark(got.weapon) + 'Weapon: ' + esc(weaponById(S.draft.weapon).name) + '</li>' +
      '<li>' + mark(got.slot) + 'Time: ' + SLOT[S.draft.slot] + '</li></ul></div>' +
      '<div class="panel truth"><h3>What really happened</h3>' +
      '<p>At ' + watchTime() + ', in the ' + esc(room(c.crimeRoom).name) + ', <strong>' + esc(k.name) + '</strong> killed ' + esc(v.name) + ' with the ' + esc(w.name) + '.</p>' +
      '<p>' + esc(k.name) + ' claimed to be in the ' + esc(room(c.claimRoom).name) + ' at ' + SLOT[c.T] + '. But ' + esc(person(c.W).name) +
      ' was in the ' + esc(room(c.claimRoom).name) + ' all that hour, and nobody else came in.</p>' +
      '<p>The ' + esc(w.name) + ' was taken from the ' + esc(room(w.home).name) + ' and hidden ' + esc(room(c.hideRoom).hide) + ' in the ' + esc(room(c.hideRoom).name) + '.</p>' +
      '<p>The motive: ' + esc(fill(c.motives[c.killer], c.killer, c.victim)) + '</p>' +
      '<p class="aside">The red herring: ' + esc(hl.name) + ' lied about ' + SLOT[c.hSlot] + ', but only because ' + esc(hl.name) + ' ' + esc(secret) + '.</p>' +
      '</div>' +
      '<div class="accuse-actions">' +
      '<button class="btn primary big" data-act="title-mode" data-mode="new">New case</button>' +
      '<button class="btn" data-act="home">Main menu</button></div>' +
      '</section>'
    );
  }

  // ---------- rendering & input ----------
  function render() {
    const views = { title: viewTitle, briefing: viewBriefing, investigate: viewInvestigate, accuse: viewAccuse, result: viewResult };
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
      case 'new':
        startCase(randomSeed(), d.diff); break;
      case 'number-start': {
        const val = (document.getElementById('case-num') || {}).value || '';
        const n = Number(val.trim());
        if (!/^\d{4}$/.test(val.trim()) || n < 1000) { S.numError = 'Enter a case number from 1000 to 9999.'; render(); break; }
        startCase(n, d.diff); break;
      }
      case 'continue': {
        const sv = loadSave();
        if (!sv) { render(); break; }
        S.c = MC.generateCase(sv.seed, sv.diff);
        S.diff = sv.diff;
        S.done = sv.done.filter((a) => typeof a === 'string');
        S.draft = {}; S.tab = 'ship';
        S.dawn = leadsLeft() <= 0;
        S.screen = S.dawn ? 'accuse' : 'investigate';
        render(); break;
      }
      case 'begin': S.screen = 'investigate'; render(); break;
      case 'tab': S.tab = d.tab; render(); break;
      case 'search': doAction('s:' + d.id); break;
      case 'question': doAction('q:' + d.id); break;
      case 'view': openResult(d.id, false); break;
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
