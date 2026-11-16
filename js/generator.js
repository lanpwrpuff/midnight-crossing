// Builds a complete, solvable mystery from a case code (location + era + number).
//
// How every case is guaranteed solvable:
//  - The killer is alone with the victim in the crime room at the time of death.
//  - The killer lies about that hour, claiming to be in another room.
//  - An innocent guest (the "key witness") really was in that room, alone, all hour, and says so.
//  - Every innocent's whereabouts at the time of death is backed up by someone else.
//  - So the killer is the only guest with a broken alibi at the time of death.
//  - One innocent (the "red herring") also lies, but about a different hour.
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  // 19 -> "7 PM", 24 -> "midnight"
  MC.hourLabel = function (h) {
    h = ((h % 24) + 24) % 24;
    if (h === 0) return 'midnight';
    if (h === 12) return 'noon';
    return (h % 12) + ' ' + (h < 12 ? 'AM' : 'PM');
  };

  // Hints for the three-number lock. Each hint is [kind, value]; a, b, c are the three numbers (1-9).
  MC.riddleFits = function (cl, a, b, c) {
    switch (cl[0]) {
      case 'sum': return a + b + c === cl[1];
      case 'd12': return a - b === cl[1];
      case 'd32': return c - b === cl[1];
      case 'par1': return a % 2 === cl[1];
      case 'par3': return c % 2 === cl[1];
      case 'prod13': return a * c === cl[1];
      case 'max': return Math.max(a, b, c) === cl[1];
      default: return false;
    }
  };
  MC.riddleSolutions = function (clues) {
    let n = 0;
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) {
      if (clues.every((cl) => MC.riddleFits(cl, a, b, c))) n++;
    }
    return n;
  };

  // ---------- Challenging a suspect's story ----------
  // Clue ids match the evidence board: "e:sight:<witness>:<subject>:<hour>", "e:acct:<suspect>",
  // "e:trace:<room>", "e:ev:<owner>:<hour>", "e:pz:drawer".
  // Where does this clue put suspect p at hour s? {room} = they were there, {notIn} = they were not there.
  MC.placeBy = function (c, evid, p, s) {
    const a = String(evid).split(':');
    if (a[0] !== 'e') return null;
    if (a[1] === 'sight' && a[3] === p && Number(a[4]) === s) {
      const sg = c.sightings.find((x) => x.witness === a[2] && x.subject === p && x.slot === s);
      return sg ? { room: sg.room } : null;
    }
    if (a[1] === 'acct' && a[2] !== p && c.statements[a[2]]) {
      const st = c.statements[a[2]].find((x) => x.slot === s);
      if (!st) return null;
      if (st.with.includes(p)) return { room: st.room };
      if (st.emphaticAlone) return { notIn: st.room };
      return null;
    }
    if (a[1] === 'trace') {
      const t = c.traces[a[2]];
      return t && t.pid === p && t.slot === s ? { room: a[2] } : null;
    }
    if (a[1] === 'ev' && a[2] === p && Number(a[3]) === s) {
      const e = c.belongings[p] && c.belongings[p].evidence.find((x) => x.slot === s);
      return e ? { room: e.room } : null;
    }
    if (a[1] === 'pz' && a[2] === 'drawer' && s === c.T) {
      const x = c.puzzles.drawer.proof.find((y) => y.pid === p);
      return x ? { room: x.room } : null;
    }
    return null;
  };
  // 'contradicts', 'supports' or 'none': what a clue does to p's own account of hour s.
  MC.contradicts = function (c, p, s, evid) {
    const st = c.statements[p] && c.statements[p].find((x) => x.slot === s);
    const r = st ? MC.placeBy(c, evid, p, s) : null;
    if (!r) return 'none';
    if (r.room) return r.room === st.room ? 'supports' : 'contradicts';
    return r.notIn === st.room ? 'contradicts' : 'none';
  };
  // Every clue a case can produce that places someone at a time.
  MC.clueIds = function (c) {
    const ids = ['e:pz:drawer'];
    c.sightings.forEach((sg) => ids.push('e:sight:' + sg.witness + ':' + sg.subject + ':' + sg.slot));
    c.suspects.forEach((p) => ids.push('e:acct:' + p));
    Object.keys(c.traces).forEach((r) => ids.push('e:trace:' + r));
    Object.keys(c.belongings).forEach((p) => c.belongings[p].evidence.forEach((e) => ids.push('e:ev:' + p + ':' + e.slot)));
    return ids;
  };

  function makeTools(seed) {
    const rng = MC.makeRng(seed);
    const R = (n) => Math.floor(rng() * n);
    return {
      R,
      pick: (a) => a[R(a.length)],
      chance: (p) => rng() < p,
      shuffle: (a) => {
        a = a.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = R(i + 1);
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
    };
  }

  // Six brand-new people: one victim and five suspects.
  function buildCast(t, era, place) {
    const P = MC.PEOPLE;
    const firsts = t.shuffle(P.firstNames[era]);
    const lasts = t.shuffle(P.lastNames);
    const jobs = t.shuffle(P.jobs[era]);
    const items = t.shuffle(P.items[era]);
    const colors = t.shuffle(P.colors);
    const personalityKeys = Object.keys(P.personalities);
    const staffSlot = t.chance(0.6) ? t.R(6) : -1; // sometimes one of them works here
    const staffJob = t.pick(place.staff[era]);

    const people = {};
    for (let i = 0; i < 6; i++) {
      const f = firsts[i];
      const first = typeof f === 'string' ? f : f.n;
      const last = lasts[i];
      const job = i === staffSlot ? staffJob : jobs[i];
      let hon = job.hon || '';
      if (!hon && era === 'old' && typeof f !== 'string') {
        if (f.g === 'f') hon = job.w === 3 && t.chance(0.4) ? 'Lady' : t.pick(['Mrs.', 'Miss']);
        else if (f.g === 'm') hon = job.w === 3 && t.chance(0.4) ? 'Lord' : 'Mr.';
      }
      const personality = t.pick(personalityKeys);
      people['p' + i] = {
        id: 'p' + i,
        first, last,
        name: [hon, first, last].filter(Boolean).join(' '),
        short: last,
        title: job.t,
        wealth: job.w,
        staff: i === staffSlot,
        item: items[i],
        color: colors[i % colors.length],
        personality,
        greeting: t.pick(P.personalities[personality]),
      };
    }
    return people;
  }

  MC.generateCase = function (seed, placeId, era, difficulty) {
    const D = MC.DATA;
    const place = MC.PLACES[placeId];
    // Mix the location and era into the seed so "S-1234" and "T-1234" are different cases.
    const t = makeTools((seed * 31 + placeId.charCodeAt(0) * 7 + era.charCodeAt(0)) >>> 0);
    const { R, pick, chance, shuffle } = t;

    const rooms = place.rooms.map((r) => Object.assign({}, r));
    const roomIds = rooms.map((r) => r.id);
    const dinnerRoom = roomIds[0];
    const weapons = place.weapons.map((w) => {
      const base = { id: w.id, name: w.name, home: w.home, wound: w.wound, empty: w.empty };
      return era === 'modern' && w.modern ? Object.assign(base, w.modern) : base;
    });

    const people = buildCast(t, era, place);
    const cast = shuffle(Object.keys(people));
    const victim = cast[0];
    const suspects = cast.slice(1);
    const killer = pick(suspects);
    const innocents = suspects.filter((s) => s !== killer);

    // Times: slot 0 = dinner, slots 1-3 = the following hours. The body is found an hour after slot 3.
    const dinnerHour = pick(place.dinnerHours);
    const slots = [0, 1, 2, 3].map((i) => MC.hourLabel(dinnerHour + i));
    const foundMin = (dinnerHour + 4) * 60;

    const T = 1 + R(3); // hour of the murder
    const crimeRoom = pick(roomIds);
    const W = pick(innocents); // key witness
    const claimRoom = pick(roomIds.filter((r) => r !== crimeRoom)); // where the killer says they were

    // True whereabouts of everyone, hour by hour.
    const sched = {};
    cast.forEach((p) => (sched[p] = [dinnerRoom, null, null, null]));
    for (let s = 1; s <= 3; s++) {
      if (s === T) {
        sched[victim][s] = crimeRoom;
        sched[killer][s] = crimeRoom;
        sched[W][s] = claimRoom;
        const open = roomIds.filter((r) => r !== crimeRoom && r !== claimRoom);
        innocents.forEach((p) => { if (p !== W) sched[p][s] = pick(open); });
      } else {
        // After the murder nobody enters the crime room, or the body would be found early.
        const open = s > T ? roomIds.filter((r) => r !== crimeRoom) : roomIds;
        suspects.forEach((p) => (sched[p][s] = pick(open)));
        sched[victim][s] = s > T ? crimeRoom : pick(roomIds);
      }
    }
    const alive = (p, s) => !(p === victim && s > T);
    const occupants = (room, s) => cast.filter((p) => alive(p, s) && sched[p][s] === room);

    // Red herring: an innocent who lies about a different hour.
    const H = pick(innocents.filter((p) => p !== W));
    const hSlot = pick([1, 2, 3].filter((s) => s !== T));
    const hTrue = sched[H][hSlot];
    const hClaim = pick(roomIds.filter((r) => r !== hTrue && r !== crimeRoom));
    const hSecret = pick(D.secrets);

    // What each suspect says about their own evening.
    const statements = {};
    suspects.forEach((p) => {
      const list = [{ slot: 0, room: dinnerRoom, with: [] }];
      for (let s = 1; s <= 3; s++) {
        if (p === killer && s === T) { list.push({ slot: s, room: claimRoom, with: [], lie: true }); continue; }
        if (p === H && s === hSlot) { list.push({ slot: s, room: hClaim, with: [], lie: true }); continue; }
        const here = sched[p][s];
        const comp = occupants(here, s).filter((q) => q !== p);
        const st = { slot: s, room: here, with: comp };
        // "I was alone, nobody came in." Always for the key witness, sometimes for others as cover.
        if (comp.length === 0 && innocents.includes(p) && ((p === W && s === T) || chance(0.25))) st.emphaticAlone = true;
        list.push(st);
      }
      statements[p] = list;
    });

    // Sightings: "I glanced into the Galley at 9 and saw..."
    const sightings = [];
    const seenKeys = new Set();
    const addSight = (w, subj, s, kind) => {
      const k = w + '|' + subj + '|' + s;
      if (seenKeys.has(k)) return false;
      seenKeys.add(k);
      sightings.push({ witness: w, subject: subj, slot: s, room: kind === 'heading' ? crimeRoom : sched[subj][s], kind });
      return true;
    };

    // Back up every innocent's whereabouts at the time of death.
    innocents.forEach((I) => {
      const here = sched[I][T];
      const companions = innocents.filter((q) => q !== I && sched[q][T] === here);
      const witnesses = innocents.filter((q) => q !== I && sched[q][T] !== here);
      if (I === W) addSight(pick(witnesses), W, T, 'aloneSaw');
      else if ((companions.length === 0 || chance(0.4)) && witnesses.length) addSight(pick(witnesses), I, T, 'seen');
    });

    // A helpful extra clue on easier settings: someone saw the killer hurrying toward the crime room.
    if (difficulty !== 'dread') addSight(pick(innocents), killer, T, 'heading');

    // Make sure the red herring's lie can be caught.
    const hWitnesses = suspects.filter((q) => q !== H && sched[q][hSlot] !== hTrue);
    if (hWitnesses.length) addSight(pick(hWitnesses), H, hSlot, 'seen');

    // A few true sightings for texture.
    for (let tries = 0, added = 0; added < 4 && tries < 80; tries++) {
      const subj = pick(cast);
      const s = 1 + R(3);
      const w = pick(suspects);
      if (s === T || !alive(subj, s) || w === subj) continue;
      if ((subj === H || w === H) && s === hSlot) continue;
      if (sched[w][s] === sched[subj][s]) continue;
      if (addSight(w, subj, s, 'seen')) added++;
    }

    // Traces: personal items found while searching rooms.
    const traces = {};
    const addTrace = (room, pid, s) => {
      if (room === crimeRoom || traces[room]) return;
      traces[room] = { pid, slot: s, reason: pick(D.traceReasons) };
    };
    if (chance(0.7)) addTrace(hTrue, H, hSlot);
    innocents.forEach((I) => { if (chance(0.5)) addTrace(sched[I][T], I, T); });
    roomIds.forEach((room) => {
      if (traces[room] || room === crimeRoom || !chance(0.5)) return;
      const cands = [];
      suspects.forEach((p) => {
        for (let s = 1; s <= 3; s++) if (sched[p][s] === room && !(p === killer && s === T)) cands.push([p, s]);
      });
      if (cands.length) { const c = pick(cands); addTrace(room, c[0], c[1]); }
    });

    // The weapon: missing from its usual place, hidden somewhere else.
    const weapon = pick(weapons);
    const hideRoom = pick(roomIds.filter((r) => r !== weapon.home));

    // Motives (everyone has one) and gossip (each guest tells you someone else's).
    const motiveTpl = shuffle(D.motives);
    const motives = {};
    suspects.forEach((p, i) => (motives[p] = motiveTpl[i]));
    const order = shuffle(suspects);
    const gossip = {};
    order.forEach((p, i) => (gossip[p] = order[(i + 1) % order.length]));

    // ---------- Belongings ----------
    // Only true evidence goes in here, so it can add clues but never break a case.
    const P = MC.PEOPLE;
    const evKinds = era === 'old' ? ['chit', 'ticket', 'sketch', 'letter'] : null;
    // Present day: some phones are locked. The code is hidden in a room (none on Cozy).
    const lockedCount = era === 'modern' ? ({ cozy: 0, standard: 1, dread: 2 }[difficulty] || 0) : 0;
    const locked = shuffle(suspects).slice(0, lockedCount);
    const codeNotes = {}; // room -> owner of the phone whose code is written there
    const belongings = {};
    const hExposed = chance(0.3); // sometimes the red herring's own receipt gives the lie away

    suspects.forEach((p) => {
      const avoid = (s) => (p === killer && s === T) || (p === H && s === hSlot && !hExposed);
      const options = [1, 2, 3].filter((s) => !avoid(s));
      const chosen = [];
      if (innocents.includes(p) && options.includes(T) && chance(0.5)) chosen.push(T);
      shuffle(options).forEach((s) => { if (chosen.length < 2 && !chosen.includes(s)) chosen.push(s); });
      chosen.sort((a, b) => a - b);
      const evidence = chosen.map((s, i) => ({
        slot: s, room: sched[p][s], minute: 5 + R(50),
        kind: era === 'old' ? pick(evKinds) : (i === 0 ? 'receipt' : pick(['photo', 'message'])),
        inPhone: era === 'modern' && i > 0,
      }));

      // A stain from a room they really were in. The killer always carries a trace of the crime scene.
      let residueRoom;
      if (p === killer) residueRoom = crimeRoom;
      else if (p === H && chance(0.6)) residueRoom = hTrue;
      else residueRoom = pick([1, 2, 3].map((s) => sched[p][s]));

      const isLocked = locked.includes(p);
      let code = null;
      let codeRoom = null;
      if (isLocked) {
        code = String(1000 + R(9000));
        codeRoom = pick(roomIds.filter((r) => r !== crimeRoom && !codeNotes[r]));
        codeNotes[codeRoom] = p;
      }
      belongings[p] = {
        container: pick(P.containers[era]),
        flavor: pick(P.wealthItems[era][people[p].wealth]),
        evidence, residueRoom, residueSpot: pick(P.residueSpots),
        phone: era === 'modern', locked: isLocked, code, codeRoom,
      };
    });

    // The victim's own diary or phone: where they had been, and a plan to meet someone.
    const victimEvidence = [];
    for (let s = 1; s < T; s++) {
      if (chance(0.7)) victimEvidence.push({ slot: s, room: sched[victim][s], minute: 5 + R(50), kind: era === 'old' ? pick(evKinds) : 'photo', inPhone: era === 'modern' });
    }
    belongings[victim] = {
      victim: true,
      container: era === 'old' ? 'pocket diary and wallet' : 'phone and wallet',
      flavor: pick(P.wealthItems[era][people[victim].wealth]),
      evidence: victimEvidence,
      meeting: { slot: T, room: crimeRoom },
      phone: era === 'modern', locked: false,
    };

    // ---------- Room puzzles, shoes and the footprint ----------
    // These use their own dice, so adding them never changes the rest of a case.
    // Like belongings, they only ever hold the truth.
    const pz = makeTools((seed * 131 + placeId.charCodeAt(0) * 17 + era.charCodeAt(0) * 3 + 99991) >>> 0);
    const treadIds = pz.shuffle(P.treads.map((x) => x.id));
    // On Cozy the footprint fits one guest only. Otherwise one innocent guest wears the same tread.
    const twin = difficulty === 'cozy' ? null : pz.pick(innocents);
    const shoes = {};
    let nextTread = 1;
    suspects.forEach((p) => {
      shoes[p] = {
        name: pz.pick(P.shoes[era][people[p].wealth]),
        tread: p === killer || p === twin ? treadIds[0] : treadIds[nextTread++],
        rich: people[p].wealth === 3,
        refuses: false,
      };
    });
    // Who will not hand their shoes over.
    //  Cozy: nobody. Standard: rich guests, unless their shoe matters. Dread: rich guests, sometimes the killer,
    //  and sometimes one proud innocent (so a refusal alone never gives the killer away).
    if (difficulty === 'standard') {
      suspects.forEach((p) => { if (shoes[p].rich && p !== killer && p !== twin) shoes[p].refuses = true; });
    } else if (difficulty === 'dread') {
      suspects.forEach((p) => { if (shoes[p].rich) shoes[p].refuses = true; });
      if (pz.chance(0.5)) shoes[killer].refuses = true;
      const plain = innocents.filter((p) => !shoes[p].refuses);
      if (plain.length && pz.chance(0.5)) shoes[pz.pick(plain)].refuses = true;
    }
    suspects.forEach((p) => { shoes[p].line = pz.pick(P.shoeRefusals[shoes[p].rich ? 'rich' : 'proud']); });

    const puzzleRooms = pz.shuffle(roomIds.filter((r) => r !== crimeRoom));

    // Locked drawer or safe: three numbers, worked out from a card of hints.
    const d1 = 1 + pz.R(9), d2 = 1 + pz.R(9), d3 = 1 + pz.R(9);
    const allClues = pz.shuffle([['sum', d1 + d2 + d3], ['d12', d1 - d2], ['d32', d3 - d2], ['par1', d1 % 2],
      ['par3', d3 % 2], ['prod13', d1 * d3], ['max', Math.max(d1, d2, d3)]]);
    let clues = [];
    for (let i = 0; i < allClues.length; i++) {
      clues.push(allClues[i]);
      if (MC.riddleSolutions(clues) === 1) break;
    }
    // Drop any hint that turned out not to be needed.
    for (let i = clues.length - 1; i >= 0 && clues.length > 2; i--) {
      const fewer = clues.filter((x, j) => j !== i);
      if (MC.riddleSolutions(fewer) === 1) clues = fewer;
    }
    // Inside: the victim's note of two innocent guests seen at the hour of the murder.
    const proof = pz.shuffle(innocents).slice(0, 2).map((p) => ({ pid: p, room: sched[p][T] }));

    // Torn letter: six strips to put back in order.
    let strips = pz.shuffle([0, 1, 2, 3, 4, 5]);
    if (strips.every((v, i) => v === i)) strips = [1, 0, 3, 2, 5, 4];

    const puzzles = {
      print: { tread: treadIds[0] },
      shoes, twin,
      drawer: { room: puzzleRooms[0], code: '' + d1 + d2 + d3, clues, proof },
      letter: { room: puzzleRooms[1], wealth: people[killer].wealth, order: strips },
      cipher: { room: puzzleRooms[2], shift: 3 + pz.R(20) },
    };

    return {
      puzzles,
      seed, place: placeId, era, difficulty,
      name: pick(place.names[era]), region: pick(place.regions),
      rooms, weapons, people, dinnerHour, slots, foundMin,
      victim, suspects, killer, innocents, T, crimeRoom, W, claimRoom, sched,
      H, hSlot, hTrue, hClaim, hSecret, statements, sightings, traces,
      weapon: weapon.id, hideRoom, motives, gossip, belongings, codeNotes,
      finder: pick(innocents),
      watchMinute: 5 + R(50),
    };
  };

  // Checks that a generated case follows the rules above. Returns a list of problems (empty = good).
  MC.validateCase = function (c) {
    const errs = [];
    const cast = [c.victim].concat(c.suspects);
    const occ = (room, s) => cast.filter((p) => !(p === c.victim && s > c.T) && c.sched[p][s] === room);

    const atCrime = occ(c.crimeRoom, c.T);
    if (atCrime.length !== 2 || !atCrime.includes(c.killer)) errs.push('crime room should hold only killer and victim');
    for (let s = c.T + 1; s <= 3; s++) if (occ(c.crimeRoom, s).length) errs.push('someone entered the crime room after the murder');

    c.suspects.forEach((p) => c.statements[p].forEach((st) => {
      const truth = c.sched[p][st.slot];
      const planned = (p === c.killer && st.slot === c.T) || (p === c.H && st.slot === c.hSlot);
      if (planned && st.room === truth) errs.push('a planned lie is accidentally true');
      if (!planned && st.room !== truth) errs.push('unplanned lie by ' + p + ' at slot ' + st.slot);
      if (st.emphaticAlone && occ(st.room, st.slot).length !== 1) errs.push('false "I was alone" claim by ' + p);
      st.with.forEach((q) => { if (c.sched[q][st.slot] !== st.room) errs.push('false "with" claim by ' + p); });
    }));

    c.sightings.forEach((sg) => {
      if (sg.kind === 'heading') return;
      if (c.sched[sg.subject][sg.slot] !== sg.room) errs.push('false sighting');
      if (sg.subject === c.victim && sg.slot > c.T) errs.push('victim seen after death');
      if (sg.witness === c.killer && sg.slot === c.T) errs.push('killer gave a sighting at the murder hour');
    });
    Object.keys(c.traces).forEach((room) => {
      const t = c.traces[room];
      if (c.sched[t.pid][t.slot] !== room) errs.push('false trace');
    });

    const wst = c.statements[c.W].find((s) => s.slot === c.T);
    if (!(wst.emphaticAlone && wst.room === c.claimRoom)) errs.push("killer's alibi is not contradicted");
    const kst = c.statements[c.killer].find((s) => s.slot === c.T);
    if (kst.room !== c.claimRoom) errs.push('killer claims the wrong room');

    c.innocents.forEach((I) => {
      const byCompany = c.innocents.some((q) => q !== I && c.statements[q].some((st) => st.slot === c.T && st.with.includes(I)));
      const bySight = c.sightings.some((sg) => sg.subject === I && sg.slot === c.T && sg.kind !== 'heading');
      if (!byCompany && !bySight) errs.push('alibi of ' + I + ' is not backed up');
    });

    const hCaught =
      c.sightings.some((sg) => sg.subject === c.H && sg.slot === c.hSlot) ||
      c.suspects.some((q) => q !== c.H && c.statements[q].some((st) => st.slot === c.hSlot && st.with.includes(c.H)));
    if (!hCaught) errs.push("red herring's lie cannot be caught");

    // Belongings must only hold the truth.
    Object.keys(c.belongings).forEach((p) => {
      const b = c.belongings[p];
      b.evidence.forEach((e) => {
        if (c.sched[p][e.slot] !== e.room) errs.push('false evidence in belongings of ' + p);
        if (p === c.killer && e.slot === c.T) errs.push("killer's belongings place them somewhere at the murder hour");
        if (p === c.victim && e.slot >= c.T) errs.push("victim's belongings after death");
      });
      if (!b.victim && !c.sched[p].slice(1).includes(b.residueRoom)) errs.push('stain from a room ' + p + ' never visited');
      if (b.locked && (!b.code || !b.codeRoom || c.codeNotes[b.codeRoom] !== p || b.codeRoom === c.crimeRoom)) errs.push('locked phone with no findable code');
    });
    if (c.belongings[c.killer].residueRoom !== c.crimeRoom) errs.push('killer is missing the crime-scene stain');

    // Puzzles, shoes and the footprint.
    const z = c.puzzles;
    const fits = c.suspects.filter((p) => z.shoes[p].tread === z.print.tread);
    if (!fits.includes(c.killer)) errs.push("footprint does not fit the killer's shoe");
    if (c.difficulty === 'cozy') {
      if (fits.length !== 1) errs.push('cozy footprint should fit one guest only');
      if (c.suspects.some((p) => z.shoes[p].refuses)) errs.push('someone refuses their shoes on cozy');
    } else if (fits.length !== 2 || !fits.includes(z.twin) || !c.innocents.includes(z.twin)) errs.push('footprint should fit the killer and one innocent');
    if (c.difficulty === 'standard' && fits.some((p) => z.shoes[p].refuses)) errs.push('a shoe that matters is refused on standard');
    const pr = [z.drawer.room, z.letter.room, z.cipher.room];
    if (new Set(pr).size !== 3 || pr.includes(c.crimeRoom) || pr.some((r) => !c.rooms.some((x) => x.id === r))) errs.push('puzzle rooms are wrong');
    const dc = z.drawer.code.split('').map(Number);
    if (MC.riddleSolutions(z.drawer.clues) !== 1 || !z.drawer.clues.every((cl) => MC.riddleFits(cl, dc[0], dc[1], dc[2]))) errs.push('lock hints do not give exactly one answer');
    z.drawer.proof.forEach((x) => {
      if (!c.innocents.includes(x.pid) || c.sched[x.pid][c.T] !== x.room) errs.push('false note in the locked drawer');
    });
    if (z.letter.wealth !== c.people[c.killer].wealth) errs.push('torn letter describes the wrong person');
    if (z.letter.order.slice().sort().join('') !== '012345' || z.letter.order.every((v, i) => v === i)) errs.push('torn letter is not shuffled');
    if (!(z.cipher.shift >= 1 && z.cipher.shift <= 25)) errs.push('coded note has no code');

    // Challenges: only the two planned lies can ever be caught out, and both always can be.
    const clues = MC.clueIds(c);
    let kHit = false, hHit = false;
    c.suspects.forEach((p) => [1, 2, 3].forEach((s) => clues.forEach((id) => {
      if (MC.contradicts(c, p, s, id) !== 'contradicts') return;
      if (p === c.killer && s === c.T) kHit = true;
      else if (p === c.H && s === c.hSlot) hHit = true;
      else errs.push('a true statement can be challenged: ' + p + ' at ' + s + ' by ' + id);
    })));
    if (!kHit) errs.push("the killer's lie cannot be challenged");
    if (!hHit) errs.push("the red herring's lie cannot be challenged");

    // Cast must have unique names, and every weapon must live in a real room.
    const names = new Set(cast.map((p) => c.people[p].name));
    if (names.size !== cast.length) errs.push('duplicate guest names');
    c.weapons.forEach((w) => { if (!c.rooms.some((r) => r.id === w.home)) errs.push('weapon with no room: ' + w.id); });
    return errs;
  };
})();
