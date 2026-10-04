//#KERNEL-BEGIN 1.0.0
/* =========================================================================
   §2  KERNEL v1.0  — shared by every game. Do not edit per game.
   ========================================================================= */
const K = (() => {
  const KERNEL_VERSION = '1.0.0';
  const TAU = Math.PI * 2;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  /* ---------- math ---------- */
  const M = {
    TAU,
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (v - a) / (b - a),
    remap: (v, a, b, c, d) => c + (d - c) * ((v - a) / (b - a)),
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    len: (x, y) => Math.hypot(x, y),
    norm: (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; },
    angle: (x, y) => Math.atan2(y, x),
    approach: (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t),
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    wrap: (v, max) => ((v % max) + max) % max,
  };

  /* ---------- seeded RNG (simulation must use this, never Math.random) ---------- */
  function rng(seed = 1) {
    let s = (seed >>> 0) || 1;
    const r = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.chance = p => r() < p;
    r.state = () => s;
    return r;
  }
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  /* ---------- easing + tweens (cosmetic, real-time) ---------- */
  const Ease = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
    outBounce: t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
      return n * (t -= 2.625 / d) * t + .984375;
    },
  };
  const tweens = [];
  function tween(obj, to, dur = 0.3, ease = Ease.outQuad, delay = 0) {
    const tw = { obj, to, from: {}, dur: Math.max(dur, 1e-4), ease, t: -delay, started: false, done: false, _then: null,
      then(fn) { this._then = fn; return this; }, kill() { this.done = true; } };
    tweens.push(tw);
    return tw;
  }
  function wait(sec) { return new Promise(res => tween({}, {}, sec).then(res)); }
  function updateTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.done) { tweens.splice(i, 1); continue; }
      tw.t += dt;
      if (tw.t < 0) continue;
      if (!tw.started) { tw.started = true; for (const k in tw.to) tw.from[k] = tw.obj[k]; }
      const p = Math.min(1, tw.t / tw.dur), e = tw.ease(p);
      for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (p >= 1) { tw.done = true; tweens.splice(i, 1); if (tw._then) tw._then(); }
    }
  }

  /* ---------- view / resize ---------- */
  const view = { w: 720, h: 1280, fullW: 720, ox: 0, scale: 1, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  function resize() {
    const D = MANIFEST.design;
    const cw = window.innerWidth, ch = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const scale = Math.min(cw / D.w, ch / D.h);
    view.scale = scale; view.dpr = dpr;
    view.fullW = cw / scale; view.h = ch / scale;
    view.w = Math.min(view.fullW, D.maxW || Infinity);
    view.ox = (view.fullW - view.w) / 2;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    const cs = getComputedStyle(probe);
    view.safe.top = (parseFloat(cs.paddingTop) || 0) / scale;
    view.safe.right = (parseFloat(cs.paddingRight) || 0) / scale;
    view.safe.bottom = (parseFloat(cs.paddingBottom) || 0) / scale;
    view.safe.left = (parseFloat(cs.paddingLeft) || 0) / scale;
    input.layoutTouch();
    scenes.layout();
  }

  /* ---------- theme ---------- */
  const THEME = {
    ink: '#1b1b3a',
    paper: '#fff7e8',
    font: '"Arial Rounded MT Bold","Nunito","Baloo 2",ui-rounded,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
    // each color = [light, base, dark]
    colors: {
      green:  ['#8af59a', '#2fbf4a', '#1d8a33'],
      blue:   ['#86d0ff', '#2b8cff', '#1a5fc0'],
      yellow: ['#fff08a', '#ffc21a', '#d48a00'],
      red:    ['#ff9a9a', '#ff4b5c', '#c0283a'],
      purple: ['#d2b0ff', '#8f5bff', '#5f33c4'],
      orange: ['#ffc48a', '#ff8a1f', '#c45c00'],
      pink:   ['#ffb0dc', '#ff5cb4', '#c42d84'],
      gray:   ['#eef0f6', '#aab2c8', '#6f7891'],
    },
  };

  /* ---------- storage (namespaced, never throws, mirrors to platform) ---------- */
  const store = (() => {
    const ns = 'k:' + MANIFEST.id + ':';
    const mem = {};
    return {
      get(k, def) {
        if (k in mem) return mem[k];
        try { const v = localStorage.getItem(ns + k); if (v != null) return (mem[k] = JSON.parse(v)); } catch (e) {}
        return def;
      },
      set(k, v) {
        mem[k] = v;
        try { localStorage.setItem(ns + k, JSON.stringify(v)); } catch (e) {}
        sdk.send('save', { key: k, value: v });
      },
      import(obj) { if (obj && typeof obj === 'object') for (const k in obj) mem[k] = obj[k]; },
    };
  })();

  /* ---------- platform SDK bridge (postMessage) ---------- */
  const sdk = (() => {
    const V = 1, inFrame = window.parent !== window, handlers = {}, pending = {};
    let seq = 0;
    const api = {
      version: V, inFrame, connected: false,
      send(type, payload = {}) {
        if (!inFrame) return;
        try { window.parent.postMessage({ __kernel: V, game: MANIFEST.id, type, payload }, '*'); } catch (e) {}
      },
      on(type, fn) { (handlers[type] || (handlers[type] = [])).push(fn); },
      request(type, payload = {}, timeoutMs = 60000) {
        return new Promise(res => {
          if (!inFrame) return res(null);
          const id = ++seq;
          pending[id] = res;
          api.send(type, Object.assign({}, payload, { id }));
          setTimeout(() => { if (pending[id]) { delete pending[id]; res(null); } }, timeoutMs);
        });
      },
    };
    window.addEventListener('message', e => {
      if (e.source !== window.parent) return;
      const allowed = MANIFEST.platformOrigins;
      if (allowed.length && !allowed.includes(e.origin)) return;
      const d = e.data;
      if (!d || d.__kernel !== V) return;
      if (d.replyTo != null && pending[d.replyTo]) { const r = pending[d.replyTo]; delete pending[d.replyTo]; r(d.payload); return; }
      (handlers[d.type] || []).forEach(fn => fn(d.payload));
    });
    return api;
  })();

  /* ---------- audio (procedural Web Audio, zero assets) ---------- */
  const audio = (() => {
    let ac = null, master = null, noiseBuf = null, duck = 1;
    let muted = store.get('muted', false);
    const last = {};
    function apply() { if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6 * duck, ac.currentTime, 0.02); }
    function unlock() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain(); master.connect(ac.destination);
          noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          apply();
        } catch (e) { ac = null; return; }
      }
      if (ac.state === 'suspended') ac.resume();
    }
    function tone({ wave = 'sine', f0 = 440, f1 = f0, dur = 0.15, vol = 0.4, attack = 0.005, noise = false, filter = 0, delay = 0 } = {}) {
      if (!ac || muted || duck === 0) return;
      const t = ac.currentTime + delay;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let src;
      if (noise) { src = ac.createBufferSource(); src.buffer = noiseBuf; }
      else {
        src = ac.createOscillator(); src.type = wave;
        src.frequency.setValueAtTime(f0, t);
        src.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      }
      let node = src;
      if (filter) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; src.connect(fl); node = fl; }
      node.connect(g); g.connect(master);
      src.start(t); src.stop(t + dur + 0.05);
    }
    const presets = {
      click:  () => tone({ wave: 'square', f0: 900, f1: 600, dur: 0.06, vol: 0.12 }),
      pop:    (p = 1) => tone({ wave: 'sine', f0: 480 * p, f1: 1150 * p, dur: 0.09, vol: 0.35 }),
      coin:   () => { tone({ wave: 'square', f0: 988, dur: 0.08, vol: 0.14 }); tone({ wave: 'square', f0: 1319, dur: 0.22, vol: 0.14, delay: 0.07 }); },
      whoosh: () => tone({ noise: true, dur: 0.28, vol: 0.22, filter: 1600, attack: 0.07 }),
      hit:    () => { tone({ noise: true, dur: 0.22, vol: 0.4, filter: 900 }); tone({ wave: 'triangle', f0: 180, f1: 55, dur: 0.22, vol: 0.4 }); },
      power:  () => tone({ wave: 'sawtooth', f0: 220, f1: 1400, dur: 0.35, vol: 0.14, filter: 3000 }),
      tick:   () => tone({ wave: 'square', f0: 1400, dur: 0.05, vol: 0.1 }),
      win:    () => [523, 659, 784, 1047].forEach((f, i) => tone({ wave: 'triangle', f0: f, dur: 0.28, vol: 0.25, delay: i * 0.09 })),
      lose:   () => [392, 330, 262].forEach((f, i) => tone({ wave: 'triangle', f0: f, f1: f * 0.97, dur: 0.3, vol: 0.25, delay: i * 0.14 })),
    };
    return {
      unlock, tone,
      play(name, ...args) {
        const now = performance.now();
        if (last[name] && now - last[name] < 30) return;     // anti-stack
        last[name] = now;
        if (presets[name]) presets[name](...args);
      },
      define(name, fn) { presets[name] = fn; },
      get muted() { return muted; },
      setMuted(m) { muted = !!m; store.set('muted', muted); apply(); },
      setDuck(d) { duck = d; apply(); },
    };
  })();

  /* ---------- drawing kit (consistent mobile-casual look) ---------- */
  const fontStr = (size, weight = 900) => `${weight} ${size}px ${THEME.font}`;
  function rrp(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); rrp(x, y, w, h, r); }
  function starPath(x, y, R, r, n = 5) {
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R;
      i ? ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d) : ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
  }
  function text(str, x, y, o = {}) {
    str = String(str);
    let size = o.size || 48;
    ctx.font = fontStr(size, o.weight);
    if (o.maxW) { const w = ctx.measureText(str).width; if (w > o.maxW) { size *= o.maxW / w; ctx.font = fontStr(size, o.weight); } }
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    ctx.lineJoin = 'round';
    const sw = o.stroke === false ? 0 : (o.sw != null ? o.sw : Math.max(2, size * 0.15));
    if (sw) {
      if (o.shadow !== false) {
        const off = size * 0.08;
        ctx.lineWidth = sw; ctx.strokeStyle = THEME.ink; ctx.strokeText(str, x, y + off);
        ctx.fillStyle = THEME.ink; ctx.fillText(str, x, y + off);
      }
      ctx.lineWidth = sw; ctx.strokeStyle = o.strokeColor || THEME.ink; ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, x, y);
  }
  function measure(str, size = 48, weight) { ctx.font = fontStr(size, weight); return ctx.measureText(String(str)).width; }
  function blob(x, y, r, pal, o = {}) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, pal[0]); g.addColorStop(0.7, pal[1]); g.addColorStop(1, pal[2]);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = o.outline != null ? o.outline : Math.max(3, r * 0.1);
    ctx.strokeStyle = THEME.ink; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x - r * 0.33, y - r * 0.42, r * 0.3, r * 0.17, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  }
  function star(x, y, R, color = '#ffe680', o = {}) {
    ctx.beginPath(); starPath(x, y, R, R * (o.inner || 0.45), o.points || 5);
    ctx.lineJoin = 'round'; ctx.lineWidth = o.outline != null ? o.outline : Math.max(3, R * 0.16);
    ctx.strokeStyle = THEME.ink; ctx.stroke(); ctx.fillStyle = color; ctx.fill();
  }
  function panel(x, y, w, h, o = {}) {
    const pal = THEME.colors[o.color || 'blue'], r = o.r || 44, X = x - w / 2, Y = y - h / 2;
    rr(X, Y + 14, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    rr(X, Y, w, h, r); ctx.fillStyle = THEME.paper; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = THEME.ink; ctx.stroke();
    rr(X + 14, Y + 14, w - 28, h - 28, r - 12); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(27,27,58,0.08)'; ctx.stroke();
    if (o.title) {
      const rw = Math.min(w * 0.82, measure(o.title, 56) + 120), rh = 96, ry = Y - rh / 2;
      rr(x - rw / 2, ry + 10, rw, rh, 32); ctx.fillStyle = pal[2]; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = THEME.ink; ctx.stroke();
      rr(x - rw / 2, ry, rw, rh, 32);
      const g = ctx.createLinearGradient(0, ry, 0, ry + rh); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
      ctx.fillStyle = g; ctx.fill(); ctx.stroke();
      text(o.title, x, ry + rh / 2, { size: 56, maxW: rw - 50 });
    }
  }
  function bar(x, y, w, h, p, color = 'green') {
    const pal = THEME.colors[color], X = x - w / 2, Y = y - h / 2;
    rr(X, Y, w, h, h / 2); ctx.fillStyle = 'rgba(27,27,58,0.55)'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = THEME.ink; ctx.stroke();
    p = M.clamp(p, 0, 1);
    if (p > 0) {
      const ih = h - 10, fw = Math.max(ih, (w - 10) * p);
      rr(X + 5, Y + 5, fw, ih, ih / 2);
      const g = ctx.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
      ctx.fillStyle = g; ctx.fill();
      rr(X + 12, Y + 8, Math.max(0, fw - 14), ih * 0.3, ih * 0.15); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    }
  }
  function pill(x, y, str, o = {}) {
    const size = o.size || 40, h = size * 1.5, tw = measure(str, size), w = tw + h * (o.icon ? 1.5 : 0.9);
    rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(27,27,58,0.55)'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = THEME.ink; ctx.stroke();
    if (o.icon) { icon(o.icon, x - w / 2 + h / 2, y, h * 0.9, o.iconColor || '#ffe680'); text(str, x + h * 0.3, y, { size, color: o.color }); }
    else text(str, x, y, { size, color: o.color });
  }
  function sky(top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, view.h); g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(-view.ox - 4, -4, view.fullW + 8, view.h + 8);
  }
  function icon(name, x, y, s, color = '#fff') {
    const u = s / 2;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const fillShape = fn => { ctx.beginPath(); fn(); ctx.lineWidth = s * 0.16; ctx.strokeStyle = THEME.ink; ctx.stroke(); ctx.fillStyle = color; ctx.fill(); };
    const strokeShape = (fn, w) => { ctx.beginPath(); fn(); ctx.lineWidth = w + s * 0.14; ctx.strokeStyle = THEME.ink; ctx.stroke(); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke(); };
    switch (name) {
      case 'pause': fillShape(() => { rrp(-u * 0.7, -u * 0.75, u * 0.5, u * 1.5, u * 0.12); rrp(u * 0.2, -u * 0.75, u * 0.5, u * 1.5, u * 0.12); }); break;
      case 'play': fillShape(() => { ctx.moveTo(-u * 0.5, -u * 0.78); ctx.lineTo(u * 0.8, 0); ctx.lineTo(-u * 0.5, u * 0.78); ctx.closePath(); }); break;
      case 'sound': case 'mute':
        fillShape(() => { ctx.moveTo(-u * 0.9, -u * 0.3); ctx.lineTo(-u * 0.45, -u * 0.3); ctx.lineTo(u * 0.05, -u * 0.78); ctx.lineTo(u * 0.05, u * 0.78); ctx.lineTo(-u * 0.45, u * 0.3); ctx.lineTo(-u * 0.9, u * 0.3); ctx.closePath(); });
        if (name === 'sound') strokeShape(() => {
          ctx.arc(u * 0.15, 0, u * 0.42, -0.9, 0.9);
          ctx.moveTo(u * 0.15 + u * 0.78 * Math.cos(-0.9), u * 0.78 * Math.sin(-0.9)); ctx.arc(u * 0.15, 0, u * 0.78, -0.9, 0.9);
        }, s * 0.1);
        else strokeShape(() => { ctx.moveTo(u * 0.35, -u * 0.32); ctx.lineTo(u * 0.95, u * 0.32); ctx.moveTo(u * 0.95, -u * 0.32); ctx.lineTo(u * 0.35, u * 0.32); }, s * 0.12);
        break;
      case 'home': fillShape(() => { ctx.moveTo(0, -u * 0.9); ctx.lineTo(u * 0.92, 0); ctx.lineTo(u * 0.6, 0); ctx.lineTo(u * 0.6, u * 0.8); ctx.lineTo(-u * 0.6, u * 0.8); ctx.lineTo(-u * 0.6, 0); ctx.lineTo(-u * 0.92, 0); ctx.closePath(); }); break;
      case 'retry': {
        const R = u * 0.6, a = Math.PI * 1.45;
        strokeShape(() => ctx.arc(0, 0, R, -Math.PI * 0.3, a), s * 0.15);
        const px = Math.cos(a) * R, py = Math.sin(a) * R, tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
        fillShape(() => { ctx.moveTo(px + tx * u * 0.45, py + ty * u * 0.45); ctx.lineTo(px + nx * u * 0.36, py + ny * u * 0.36); ctx.lineTo(px - nx * u * 0.36, py - ny * u * 0.36); ctx.closePath(); });
        break;
      }
      case 'video': fillShape(() => { rrp(-u * 0.92, -u * 0.6, u * 1.25, u * 1.2, u * 0.22); ctx.moveTo(u * 0.4, 0); ctx.lineTo(u * 0.95, -u * 0.5); ctx.lineTo(u * 0.95, u * 0.5); ctx.closePath(); }); break;
      case 'star': fillShape(() => starPath(0, 0, u * 0.95, u * 0.43, 5)); break;
      case 'close': strokeShape(() => { ctx.moveTo(-u * 0.55, -u * 0.55); ctx.lineTo(u * 0.55, u * 0.55); ctx.moveTo(u * 0.55, -u * 0.55); ctx.lineTo(-u * 0.55, u * 0.55); }, s * 0.18); break;
      case 'check': strokeShape(() => { ctx.moveTo(-u * 0.6, 0); ctx.lineTo(-u * 0.15, u * 0.5); ctx.lineTo(u * 0.65, -u * 0.5); }, s * 0.18); break;
      case 'heart': fillShape(() => { ctx.moveTo(0, u * 0.8); ctx.bezierCurveTo(-u * 1.2, -u * 0.1, -u * 0.6, -u * 1.0, 0, -u * 0.4); ctx.bezierCurveTo(u * 0.6, -u * 1.0, u * 1.2, -u * 0.1, 0, u * 0.8); ctx.closePath(); }); break;
      case 'coin': ctx.restore(); blob(x, y, u * 0.85, THEME.colors.yellow, { outline: s * 0.08 }); return;
    }
    ctx.restore();
  }

  /* ---------- FX (cosmetic only — never affects simulation) ---------- */
  let hitstopT = 0;
  const fx = (() => {
    const P = [], F = [];
    const sh = { t: 1, dur: 1, amp: 0, x: 0, y: 0 };
    const fl = { a: 0, c: '#fff' };
    const R = a => Array.isArray(a) ? a[0] + Math.random() * (a[1] - a[0]) : a;
    return {
      burst(x, y, o = {}) {
        const n = o.count != null ? o.count : 14;
        for (let i = 0; i < n && P.length < 700; i++) {
          const ang = (o.angle || 0) + (Math.random() - 0.5) * (o.spread != null ? o.spread : TAU);
          const spd = R(o.speed || [180, 520]);
          const c = o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : '#fff';
          P.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, t: 0, life: R(o.life || [0.4, 0.8]),
            size: R(o.size || [6, 14]), c, g: o.gravity != null ? o.gravity : 900, drag: o.drag != null ? o.drag : 1.5,
            shape: o.shape || 'circle', rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, outline: o.outline !== false });
        }
      },
      ring(x, y, o = {}) { P.push({ kind: 'ring', x, y, t: 0, life: o.life || 0.35, r0: o.r0 || 10, r1: o.r1 || 120, c: o.color || '#fff', w: o.width || 10 }); },
      text(x, y, str, o = {}) { F.push({ x, y, str, t: 0, life: o.life || 0.9, size: o.size || 54, color: o.color || '#fff', rise: o.rise != null ? o.rise : 140 }); },
      shake(amp = 14, dur = 0.3) { const cur = sh.t < sh.dur ? sh.amp * (1 - sh.t / sh.dur) : 0; if (amp >= cur) { sh.amp = amp; sh.dur = dur; sh.t = 0; } },
      flash(c = '#fff', a = 0.5) { fl.c = c; fl.a = Math.max(fl.a, a); },
      hitstop(sec) { hitstopT = Math.max(hitstopT, sec); },
      update(dt) {
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.t += dt;
          if (p.t >= p.life) { P.splice(i, 1); continue; }
          if (p.kind === 'ring') continue;
          const k = Math.exp(-p.drag * dt);
          p.vx *= k; p.vy *= k; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        }
        for (let i = F.length - 1; i >= 0; i--) { F[i].t += dt; if (F[i].t >= F[i].life) F.splice(i, 1); }
        if (sh.t < sh.dur) { sh.t += dt; const k = Math.max(0, 1 - sh.t / sh.dur), a = sh.amp * k * k; sh.x = (Math.random() * 2 - 1) * a; sh.y = (Math.random() * 2 - 1) * a; }
        else sh.x = sh.y = 0;
        fl.a = Math.max(0, fl.a - dt * 2.5);
      },
      draw() {
        for (const p of P) {
          const k = 1 - p.t / p.life;
          if (p.kind === 'ring') {
            const e = Ease.outCubic(p.t / p.life);
            ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * e, 0, TAU);
            ctx.lineWidth = p.w * k + 1; ctx.strokeStyle = p.c; ctx.stroke(); continue;
          }
          const s = p.size * (0.4 + 0.6 * k);
          ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.c;
          ctx.beginPath();
          if (p.shape === 'circle') ctx.arc(p.x, p.y, s, 0, TAU);
          else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); if (p.shape === 'star') starPath(0, 0, s * 1.3, s * 0.55, 5); else rrp(-s, -s * 0.6, s * 2, s * 1.2, s * 0.3); ctx.restore(); }
          ctx.fill();
          if (p.outline) { ctx.lineWidth = 3; ctx.strokeStyle = THEME.ink; ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
        for (const f of F) {
          const p = f.t / f.life, sc = p < 0.15 ? Ease.outBack(p / 0.15) : 1, a = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x, f.y - f.rise * Ease.outCubic(p)); ctx.scale(sc, sc);
          text(f.str, 0, 0, { size: f.size, color: f.color }); ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
      drawFlash() { if (fl.a > 0) { ctx.globalAlpha = fl.a; ctx.fillStyle = fl.c; ctx.fillRect(-view.ox, 0, view.fullW, view.h); ctx.globalAlpha = 1; } },
      clear() { P.length = 0; F.length = 0; sh.t = sh.dur; fl.a = 0; },
      offset: sh,
      get count() { return P.length + F.length; },
    };
  })();

  /* ---------- system state (pause / ads / visibility) ---------- */
  const sys = {
    paused: false, hidden: false, ad: false, platformPause: false, platformMute: false,
    get frozen() { return this.hidden || this.ad || this.platformPause; },
  };
  function updateDuck() { audio.setDuck(sys.ad || sys.platformMute || sys.hidden ? 0 : 1); }
  function pauseGame() {
    const sc = scenes.current;
    if (sys.paused || !sc || !sc.pausable) return;
    sys.paused = true; input.reset();
    sdk.send('gameplayStop');
    if (sc.onPause) sc.onPause();
  }
  function resumeGame() {
    if (!sys.paused) return;
    sys.paused = false; input.reset();
    if (scenes.current && scenes.current.gameplay) sdk.send('gameplayStart');
  }

  /* ---------- UI buttons (retained, juicy, consistent) ---------- */
  const ui = (() => {
    const list = [];
    const active = b => b.visible && b.enabled && b.s > 0.5 && (b.group === 'sys' ? sys.paused : !sys.paused);
    const hit = (b, x, y) => Math.abs(x - b.x) <= b.w * b.s / 2 + 12 && Math.abs(y - b.y) <= b.h * b.s / 2 + 12;
    const bounce = (b, to, d, e) => { if (b._tw) b._tw.kill(); b._tw = tween(b, { s: to }, d, e); };
    function fire(b) { if (b.sfx) audio.play(b.sfx); if (b.onTap) b.onTap(b); }
    function drawButton(b) {
      const pal = THEME.colors[b.color] || THEME.colors.green, lift = 10, press = b.pressed ? 7 : 0;
      const pulse = b.pulse && !b.pressed ? 1 + 0.035 * Math.sin(clock * 5) : 1;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.s * pulse, b.s * pulse);
      if (!b.enabled) ctx.globalAlpha = 0.45;
      const w = b.w, h = b.h, x = -w / 2, y = -h / 2 - lift / 2, r = Math.min(h * 0.34, 44);
      rr(x, y + lift, w, h, r); ctx.fillStyle = pal[2]; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = THEME.ink; ctx.stroke();
      const by = y + press;
      rr(x, by, w, h, r);
      const g = ctx.createLinearGradient(0, by, 0, by + h); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
      ctx.fillStyle = g; ctx.fill(); ctx.stroke();
      rr(x + 12, by + 9, w - 24, h * 0.34, r * 0.6); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
      const cy = by + h / 2, ic = b.iconFn ? b.iconFn() : b.icon;
      if (ic && b.label) {
        const isz = h * 0.46, fs = b.fontSize || h * 0.38, tw = measure(b.label, fs), total = isz + 16 + tw;
        icon(ic, -total / 2 + isz / 2, cy, isz);
        text(b.label, -total / 2 + isz + 16 + tw / 2, cy, { size: fs, maxW: w - isz - 50 });
      } else if (ic) icon(ic, 0, cy, h * 0.5);
      else text(b.label, 0, cy, { size: b.fontSize || h * 0.4, maxW: w - 36 });
      if (b.badge) { blob(w / 2 - 6, y + 4, 26, THEME.colors.red, { outline: 5 }); text(b.badge, w / 2 - 6, y + 6, { size: 28, shadow: false }); }
      ctx.restore();
    }
    return {
      button(o) {
        const b = Object.assign({ x: 0, y: 0, w: 320, h: 112, label: '', icon: null, iconFn: null, color: 'green', group: 'scene',
          visible: true, enabled: true, s: 1, pressed: false, pid: null, place: null, onTap: null, sfx: 'click', pulse: false, key: null, badge: null }, o);
        list.push(b);
        if (o.popIn != null) { b.s = 0; tween(b, { s: 1 }, 0.45, Ease.outBack, o.popIn); }
        return b;
      },
      soundButton(o = {}) {
        return this.button(Object.assign({ icon: 'sound', color: 'blue', w: 110, h: 110, iconFn: () => audio.muted ? 'mute' : 'sound',
          onTap: () => audio.setMuted(!audio.muted) }, o));
      },
      pauseButton(o = {}) {
        return this.button(Object.assign({ icon: 'pause', color: 'yellow', w: 96, h: 96, sfx: 'click',
          place: v => ({ x: v.w - 66 - v.safe.right, y: 70 + v.safe.top }), onTap: pauseGame }, o));
      },
      remove(b) { const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); },
      clearScene() { for (let i = list.length - 1; i >= 0; i--) if (list[i].group === 'scene') list.splice(i, 1); },
      place() { for (const b of list) if (b.place) { const r = b.place(view); b.x = r.x; b.y = r.y; if (r.w) b.w = r.w; if (r.h) b.h = r.h; } },
      draw(group) { for (const b of list) if (b.group === group && b.visible && b.s > 0.01) drawButton(b); },
      down(x, y, id) {
        for (let i = list.length - 1; i >= 0; i--) {
          const b = list[i];
          if (active(b) && hit(b, x, y)) { b.pressed = true; b.pid = id; bounce(b, 0.93, 0.08); return true; }
        }
        return false;
      },
      move(x, y, id) { for (const b of list) if (b.pid === id) b.pressed = hit(b, x, y); },
      up(x, y, id) {
        for (const b of list) if (b.pid === id) {
          const go = b.pressed && active(b);
          b.pressed = false; b.pid = null; bounce(b, 1, 0.4, Ease.outElastic);
          if (go) fire(b);
          return true;
        }
        return false;
      },
      keys() {
        for (const b of list) if (b.key && active(b) && input.pressed(b.key)) {
          bounce(b, 0.9, 0.06); b._tw.then(() => bounce(b, 1, 0.35, Ease.outElastic)); fire(b); return;
        }
      },
    };
  })();

  /* ---------- input (keyboard + unified pointer + optional touch overlay) ---------- */
  const input = (() => {
    const keyMap = {};
    for (const a in MANIFEST.keys) for (const c of MANIFEST.keys[a]) keyMap[c] = a;
    const held = new Set(), pr = new Set(), rl = new Set(), vHeld = new Set();
    const axis = { x: 0, y: 0 };
    const p = { x: 0, y: 0, down: false, pressed: false, released: false, tap: false, dragging: false,
      startX: 0, startY: 0, dx: 0, dy: 0, downAt: 0, id: null };
    let touchMode = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    const stick = { id: null, ox: 0, oy: 0, kx: 0, ky: 0, r: 90 };
    const tbtn = (MANIFEST.touch.buttons || []).map(b => ({ action: b.action, label: b.label || '', x: 0, y: 0, r: 72, id: null }));
    const toL = e => ({ x: e.clientX / view.scale - view.ox, y: e.clientY / view.scale });
    const overlayOn = () => touchMode && (MANIFEST.touch.stick || tbtn.length) && scenes.current && scenes.current.gameplay && !sys.paused;

    window.addEventListener('keydown', e => {
      audio.unlock();
      if (e.code === 'Backquote') { debug.on = !debug.on; return; }
      const a = keyMap[e.code];
      if (!a) return;
      e.preventDefault(); touchMode = false;
      if (e.repeat || sys.ad) return;
      if (a === 'pause') { sys.paused ? resumeGame() : pauseGame(); return; }
      held.add(a); pr.add(a);
    });
    window.addEventListener('keyup', e => { const a = keyMap[e.code]; if (!a) return; held.delete(a); rl.add(a); });
    window.addEventListener('blur', () => held.clear());

    canvas.addEventListener('pointerdown', e => {
      e.preventDefault(); audio.unlock(); canvas.focus();
      if (e.pointerType === 'touch' || e.pointerType === 'pen') touchMode = true; else if (e.pointerType === 'mouse') touchMode = false;
      if (sys.ad) return;
      const q = toL(e);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      if (ui.down(q.x, q.y, e.pointerId)) return;
      if (overlayOn()) {
        for (const b of tbtn) if (b.id == null && M.dist(q.x, q.y, b.x, b.y) < b.r * 1.25) { b.id = e.pointerId; vHeld.add(b.action); pr.add(b.action); return; }
        if (MANIFEST.touch.stick && stick.id == null && q.x < view.w * 0.5) { stick.id = e.pointerId; stick.ox = q.x; stick.oy = q.y; stick.kx = stick.ky = 0; return; }
      }
      if (p.id != null || sys.paused) return;
      p.id = e.pointerId; p.down = true; p.pressed = true; p.dragging = false;
      p.x = p.startX = q.x; p.y = p.startY = q.y; p.dx = p.dy = 0; p.downAt = performance.now();
    });
    canvas.addEventListener('pointermove', e => {
      const q = toL(e);
      if (e.pointerId === stick.id) {
        let dx = q.x - stick.ox, dy = q.y - stick.oy; const d = Math.hypot(dx, dy);
        if (d > stick.r) { dx *= stick.r / d; dy *= stick.r / d; }
        stick.kx = dx; stick.ky = dy; axis.x = dx / stick.r; axis.y = dy / stick.r; return;
      }
      ui.move(q.x, q.y, e.pointerId);
      if (e.pointerId === p.id || p.id == null) { p.x = q.x; p.y = q.y; }
      if (e.pointerId === p.id) { p.dx = p.x - p.startX; p.dy = p.y - p.startY; if (!p.dragging && Math.hypot(p.dx, p.dy) > 14) p.dragging = true; }
    });
    const up = (e, cancel) => {
      const q = toL(e);
      if (ui.up(q.x, q.y, e.pointerId)) return;
      for (const b of tbtn) if (b.id === e.pointerId) { b.id = null; vHeld.delete(b.action); rl.add(b.action); return; }
      if (e.pointerId === stick.id) { stick.id = null; axis.x = axis.y = 0; return; }
      if (e.pointerId === p.id) {
        p.x = q.x; p.y = q.y; p.dx = p.x - p.startX; p.dy = p.y - p.startY;
        p.down = false; p.released = !cancel; p.tap = !cancel && !p.dragging && performance.now() - p.downAt < 350; p.id = null;
      }
    };
    canvas.addEventListener('pointerup', e => up(e, false));
    canvas.addEventListener('pointercancel', e => up(e, true));
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    return {
      pointer: p,
      get touch() { return touchMode; },
      down: a => held.has(a) || vHeld.has(a),
      pressed: a => pr.has(a),
      released: a => rl.has(a),
      axisX() { let x = axis.x; if (held.has('left')) x -= 1; if (held.has('right')) x += 1; return M.clamp(x, -1, 1); },
      axisY() { let y = axis.y; if (held.has('up')) y -= 1; if (held.has('down')) y += 1; return M.clamp(y, -1, 1); },
      endStep() { pr.clear(); rl.clear(); p.pressed = p.released = p.tap = false; },
      reset() {
        held.clear(); vHeld.clear(); pr.clear(); rl.clear(); axis.x = axis.y = 0; stick.id = null;
        tbtn.forEach(b => b.id = null); p.down = p.pressed = p.released = p.tap = p.dragging = false; p.id = null;
      },
      layoutTouch() {
        tbtn.forEach((b, i) => { b.x = view.w - 110 - view.safe.right - (i % 2) * 165; b.y = view.h - 140 - view.safe.bottom - (i % 2) * 70 - Math.floor(i / 2) * 170; });
      },
      drawTouch() {
        if (!overlayOn()) return;
        if (MANIFEST.touch.stick) {
          const ox = stick.id != null ? stick.ox : 150 + view.safe.left, oy = stick.id != null ? stick.oy : view.h - 170 - view.safe.bottom;
          ctx.globalAlpha = stick.id != null ? 0.55 : 0.25;
          ctx.beginPath(); ctx.arc(ox, oy, stick.r + 20, 0, TAU); ctx.fillStyle = 'rgba(27,27,58,0.5)'; ctx.fill();
          ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
          ctx.globalAlpha = stick.id != null ? 0.9 : 0.35;
          blob(ox + (stick.id != null ? stick.kx : 0), oy + (stick.id != null ? stick.ky : 0), 48, THEME.colors.gray);
          ctx.globalAlpha = 1;
        }
        for (const b of tbtn) {
          ctx.globalAlpha = b.id != null ? 0.95 : 0.6;
          blob(b.x, b.y + (b.id != null ? 4 : 0), b.r * (b.id != null ? 0.92 : 1), THEME.colors.purple);
          text(b.label, b.x, b.y, { size: 44 }); ctx.globalAlpha = 1;
        }
      },
    };
  })();

  /* ---------- scenes ---------- */
  const scenes = (() => {
    const reg = {};
    let cur = null, name = null, busy = false;
    const fade = { a: 0 };
    function swap(n, params) {
      if (!reg[n]) throw new Error('Unknown scene: ' + n);
      if (cur) { if (cur.gameplay) sdk.send('gameplayStop'); if (cur.exit) cur.exit(); }
      ui.clearScene(); fx.clear(); input.reset(); sys.paused = false; hitstopT = 0; acc = 0;
      name = n; cur = reg[n];
      if (cur.enter) cur.enter(params || {});
      if (cur.layout) cur.layout(view);
      ui.place();
      if (cur.gameplay) sdk.send('gameplayStart');
    }
    return {
      add(n, def) { reg[n] = def; },
      go(n, params, opts = {}) {
        if (busy) return;
        if (!cur || opts.instant) { swap(n, params); return; }
        busy = true;
        tween(fade, { a: 1 }, 0.16, Ease.inQuad).then(() => { swap(n, params); tween(fade, { a: 0 }, 0.22, Ease.outQuad).then(() => busy = false); });
      },
      get current() { return cur; },
      get name() { return name; },
      fade,
      layout() { if (cur && cur.layout) cur.layout(view); ui.place(); },
    };
  })();

  /* ---------- ads ---------- */
  const devAd = { on: false, t: 0, kind: '', res: null };
  async function adBreak(kind = 'midgame') {
    if (sys.ad) return { shown: false, granted: false };
    sys.ad = true; input.reset(); updateDuck(); sdk.send('gameplayStop');
    let r = null;
    if (sdk.connected) r = await sdk.request('adBreak', { kind }, 90000);
    else if (!sdk.inFrame) r = await new Promise(res => { Object.assign(devAd, { on: true, t: kind === 'rewarded' ? 2 : 1, kind, res }); });
    sys.ad = false; updateDuck(); last = performance.now();
    if (scenes.current && scenes.current.gameplay && !sys.paused) sdk.send('gameplayStart');
    r = r || {};
    return { shown: !!r.shown, granted: kind === 'rewarded' && !!r.granted };
  }

  /* ---------- debug ---------- */
  const debug = { on: /[?&]debug/.test(location.search), fps: 60, steps: 0 };

  /* ---------- system pause overlay buttons ---------- */
  ui.button({ group: 'sys', label: 'RESUME', icon: 'play', color: 'green', w: 400, h: 120, key: 'action', pulse: true,
    place: v => ({ x: v.w / 2, y: v.h / 2 + 20 }), onTap: resumeGame });
  ui.soundButton({ group: 'sys', place: v => ({ x: v.w / 2 - 80, y: v.h / 2 + 175 }) });
  const sysHome = ui.button({ group: 'sys', icon: 'home', color: 'red', w: 110, h: 110,
    place: v => ({ x: v.w / 2 + 80, y: v.h / 2 + 175 }),
    onTap: () => { const sc = scenes.current; sys.paused = false; if (sc && sc.onQuit) sc.onQuit(); } });

  /* ---------- main loop: fixed-step sim, per-frame presentation ---------- */
  const STEP = 1 / 60, MAX_STEPS = 6;
  let last = 0, acc = 0, clock = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
    if (dt > 0) debug.fps += (1 / dt - debug.fps) * 0.05;
    if (devAd.on) { devAd.t -= dt; if (devAd.t <= 0) { devAd.on = false; devAd.res({ shown: true, granted: true }); } }
    const sc = scenes.current;
    if (!sys.frozen && sc) {
      clock += dt;
      updateTweens(dt);
      ui.keys();
      if (!sys.paused) {
        let steps = 0;
        if (hitstopT > 0) hitstopT -= dt;
        else {
          acc += dt;
          while (acc >= STEP && steps < MAX_STEPS) { if (sc.update) sc.update(STEP); input.endStep(); acc -= STEP; steps++; if (scenes.current !== sc) break; }
          if (steps === MAX_STEPS) acc = 0;
        }
        debug.steps = steps;
        if (sc.frame) sc.frame(dt);
        fx.update(dt);
      }
    }
    ui.place();
    render();
  }

  function render() {
    const s = view.dpr * view.scale, sc = scenes.current, alpha = M.clamp(acc / STEP, 0, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = MANIFEST.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ox = view.ox;
    // world layer (shakes)
    ctx.setTransform(s, 0, 0, s, (ox + fx.offset.x) * s, fx.offset.y * s);
    if (sc && sc.backdrop) sc.backdrop(ctx);
    if (sc && sc.render) sc.render(ctx, alpha);
    fx.draw();
    // screen layer (stable)
    ctx.setTransform(s, 0, 0, s, ox * s, 0);
    if (sc && sc.hud) sc.hud(ctx, alpha);
    input.drawTouch();
    ui.draw('scene');
    fx.drawFlash();
    if (sys.paused) {
      ctx.fillStyle = 'rgba(20,18,50,0.62)'; ctx.fillRect(-ox, 0, view.fullW, view.h);
      panel(view.w / 2, view.h / 2 + 60, 520, 470, { title: 'PAUSED', color: 'purple' });
      sysHome.visible = !!(sc && sc.onQuit);
      ui.draw('sys');
    }
    if (devAd.on) {
      ctx.fillStyle = '#0d0c22'; ctx.fillRect(-ox, 0, view.fullW, view.h);
      text('AD BREAK', view.w / 2, view.h / 2 - 50, { size: 72, color: '#ffe680' });
      text(`${devAd.kind} · dev stub · ${Math.ceil(devAd.t)}`, view.w / 2, view.h / 2 + 40, { size: 32, color: '#aab2c8' });
    }
    if (scenes.fade.a > 0) { ctx.globalAlpha = scenes.fade.a; ctx.fillStyle = MANIFEST.bg; ctx.fillRect(-ox, 0, view.fullW, view.h); ctx.globalAlpha = 1; }
    if (debug.on) text(`${debug.fps | 0} fps · ${debug.steps} steps · ${fx.count} fx · ${view.w | 0}×${view.h | 0}`, 12, 24 + view.safe.top, { size: 22, align: 'left', shadow: false });
  }

  /* ---------- boot ---------- */
  function boot(startScene, params) {
    resize();
    window.addEventListener('resize', resize);
    if (window.visualViewport) visualViewport.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      sys.hidden = document.hidden;
      if (document.hidden) { pauseGame(); input.reset(); }
      updateDuck(); last = performance.now();
    });
    sdk.on('hello', d => {
      sdk.connected = true;
      if (d && d.save) store.import(d.save);
      if (d && typeof d.muted === 'boolean') { sys.platformMute = d.muted; updateDuck(); }
    });
    sdk.on('pause', () => { sys.platformPause = true; pauseGame(); updateDuck(); });
    sdk.on('resume', () => { sys.platformPause = false; updateDuck(); last = performance.now(); });
    sdk.on('mute', d => { sys.platformMute = !!(d && d.muted); updateDuck(); });
    sdk.send('loadProgress', { p: 1 });
    scenes.go(startScene, params);
    sdk.send('ready', { game: MANIFEST.id, version: MANIFEST.version, kernel: KERNEL_VERSION });
    last = performance.now();
    requestAnimationFrame(frame);
  }

  return {
    VERSION: KERNEL_VERSION, M, rng, hashSeed, Ease, tween, wait, view, THEME, store, sdk, audio, input, fx, ui, scenes, adBreak, boot,
    pause: pauseGame, resume: resumeGame,
    draw: { text, measure, rr, rrp, starPath, blob, star, panel, bar, pill, sky, icon },
    get time() { return clock; },
    get paused() { return sys.paused; },
  };
})();
//#KERNEL-END
