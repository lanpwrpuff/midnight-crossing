// Atmosphere: quiet ambient sound for each place, clock chimes and a soft tone for big discoveries.
// Everything is synthesised with the Web Audio API, so there are no sound files.
// Sound only starts after the player turns it on (browsers block sound until a tap anyway).
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const AC = window.AudioContext || window.webkitAudioContext;

  let ctx = null;        // audio context, made on first use
  let master = null;     // overall volume
  let ambBus = null;     // ambient volume (rises as the night goes on)
  let amb = null;        // the running ambient sound: { place, stop() }
  let level = 0;         // 0 = off, otherwise master volume
  let dread = 0;         // 0..1, how close the deadline is
  let wantPlace = null;  // which ambience should play

  function ensure() {
    if (!AC) return false;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        ambBus = ctx.createGain();
        ambBus.gain.value = 0.5;
        ambBus.connect(master);
      } catch (e) { ctx = null; return false; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let last = 0;
      // Slightly "brown" noise: softer and less hissy than pure white noise.
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.2 + w * 0.12; }
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }
  function filter(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    return f;
  }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function lfo(rate, depth, target) {
    const o = ctx.createOscillator(); o.frequency.value = rate;
    const g = gain(depth); o.connect(g); g.connect(target); o.start();
    return o;
  }

  // One ambient bed per place. Returns a stop() function.
  function buildAmbience(place) {
    const nodes = [];
    const keep = (n) => { nodes.push(n); return n; };
    const out = keep(gain(1));
    out.connect(ambBus);
    let timer = null;
    if (place === 'ship') {
      // Slow swell of the sea and a low hull rumble.
      const n = keep(noise()), f = keep(filter('lowpass', 420)), g = keep(gain(0.35));
      n.connect(f); f.connect(g); g.connect(out); n.start();
      keep(lfo(0.11, 0.25, g.gain));
      const hum = keep(ctx.createOscillator()); hum.type = 'sine'; hum.frequency.value = 48;
      const hg = keep(gain(0.05)); hum.connect(hg); hg.connect(out); hum.start();
    } else if (place === 'train') {
      // Rumble, and the clack of wheels over the rail joints.
      const n = keep(noise()), f = keep(filter('lowpass', 160)), g = keep(gain(0.45));
      n.connect(f); f.connect(g); g.connect(out); n.start();
      const c = keep(noise()), cf = keep(filter('bandpass', 1100, 3)), cg = keep(gain(0));
      c.connect(cf); cf.connect(cg); cg.connect(out); c.start();
      const clack = () => {
        const t = ctx.currentTime;
        [0, 0.16].forEach((dt) => {
          cg.gain.setValueAtTime(0, t + dt);
          cg.gain.linearRampToValueAtTime(0.22, t + dt + 0.008);
          cg.gain.exponentialRampToValueAtTime(0.0008, t + dt + 0.12);
        });
      };
      clack();
      timer = setInterval(clack, 1150);
    } else if (place === 'plane') {
      // A steady engine drone with a slow beat between two propellers.
      [55, 55.6, 110.3].forEach((fq, i) => {
        const o = keep(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = fq;
        const f = keep(filter('lowpass', 260)), g = keep(gain(i === 2 ? 0.02 : 0.05));
        o.connect(f); f.connect(g); g.connect(out); o.start();
      });
      const n = keep(noise()), f = keep(filter('bandpass', 700, 0.6)), g = keep(gain(0.12));
      n.connect(f); f.connect(g); g.connect(out); n.start();
    } else {
      // Rain on the windows and wind in the chimneys.
      const r = keep(noise()), rf = keep(filter('highpass', 2400)), rg = keep(gain(0.09));
      r.connect(rf); rf.connect(rg); rg.connect(out); r.start();
      const w = keep(noise()), wf = keep(filter('bandpass', 380, 1.4)), wg = keep(gain(0.22));
      w.connect(wf); wf.connect(wg); wg.connect(out); w.start();
      keep(lfo(0.07, 160, wf.frequency));
      keep(lfo(0.05, 0.14, wg.gain));
    }
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
    return {
      place,
      stop() {
        if (timer) clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + 1.2);
        setTimeout(() => nodes.forEach((n) => { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { /* ignore */ } }), 1400);
      },
    };
  }

  function syncAmbience() {
    if (!ctx) return;
    const place = level > 0 ? wantPlace : null;
    if (amb && amb.place === place) return;
    if (amb) { amb.stop(); amb = null; }
    if (place) amb = buildAmbience(place);
  }
  function syncLevels() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(level, t + 0.6);
    // The ambience grows a little louder as the deadline nears.
    ambBus.gain.setTargetAtTime(0.4 + 0.5 * dread, t, 2);
  }

  // A struck bell: a few inharmonic partials with a long decay.
  function bell(freq, at, vol) {
    [[1, 1], [2.76, 0.45], [5.4, 0.22], [0.5, 0.35]].forEach((p) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * p[0];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol * p[1], at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2 / Math.sqrt(p[0]));
      o.connect(g); g.connect(master);
      o.start(at); o.stop(at + 3.5);
    });
  }

  MC.Atmo = {
    available: !!AC,
    // v: 0 (off) to 1. Call from a tap so the browser allows sound to start.
    setLevel(v) {
      level = Math.max(0, Math.min(1, v || 0));
      if (level > 0 && !ensure()) return;
      syncLevels();
      syncAmbience();
    },
    // Which place's ambience to play (null = none, e.g. on the title screen).
    setPlace(place) { wantPlace = place || null; syncAmbience(); },
    setDread(p) { dread = Math.max(0, Math.min(1, p || 0)); syncLevels(); },
    // The clock striking the hour: one deep stroke, two when the deadline is close.
    chime(strokes) {
      if (!ctx || level <= 0) return;
      const t = ctx.currentTime + 0.05;
      for (let i = 0; i < (strokes || 1); i++) bell(196, t + i * 1.6, 0.16);
    },
    // A soft rising tone when something important turns up.
    discover() {
      if (!ctx || level <= 0) return;
      const t = ctx.currentTime + 0.02;
      [[392, 0], [587.3, 0.14]].forEach((n) => bell(n[0], t + n[1], 0.07));
    },
  };
})();
