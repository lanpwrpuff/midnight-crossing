// Builds a complete, solvable mystery from a case number.
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

  MC.SLOT_LABELS = ['8 PM', '9 PM', '10 PM', '11 PM'];

  MC.generateCase = function (seed, difficulty) {
    const D = MC.DATA;
    const rng = MC.makeRng(seed);
    const R = (n) => Math.floor(rng() * n);
    const pick = (a) => a[R(a.length)];
    const chance = (p) => rng() < p;
    const shuffle = (a) => {
      a = a.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = R(i + 1);
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    };
    const roomIds = D.rooms.map((r) => r.id);

    // Cast: one victim and five suspects.
    const cast = shuffle(D.characters.map((c) => c.id)).slice(0, 6);
    const victim = cast[0];
    const suspects = cast.slice(1);
    const killer = pick(suspects);
    const innocents = suspects.filter((s) => s !== killer);

    // Slots: 0 = 8 PM (dinner, everyone together), 1 = 9 PM, 2 = 10 PM, 3 = 11 PM.
    const T = 1 + R(3); // hour of the murder
    const crimeRoom = pick(roomIds);
    const W = pick(innocents); // key witness
    const claimRoom = pick(roomIds.filter((r) => r !== crimeRoom)); // where the killer says they were

    // True whereabouts of everyone, hour by hour.
    const sched = {};
    cast.forEach((p) => (sched[p] = ['saloon', null, null, null]));
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
      const list = [{ slot: 0, room: 'saloon', with: [] }];
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
    const weapon = pick(D.weapons);
    const hideRoom = pick(roomIds.filter((r) => r !== weapon.home));

    // Motives (everyone has one) and gossip (each guest tells you someone else's).
    const motiveTpl = shuffle(D.motives);
    const motives = {};
    suspects.forEach((p, i) => (motives[p] = motiveTpl[i]));
    const order = shuffle(suspects);
    const gossip = {};
    order.forEach((p, i) => (gossip[p] = order[(i + 1) % order.length]));

    return {
      seed, difficulty, victim, suspects, killer, innocents, T, crimeRoom, W, claimRoom, sched,
      H, hSlot, hTrue, hClaim, hSecret, statements, sightings, traces,
      weapon: weapon.id, hideRoom, motives, gossip,
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
    return errs;
  };
})();
