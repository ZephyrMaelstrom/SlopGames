/* SlopGames platform ↔ game bridge (kernel SDK protocol v1).
   One GameHost per mounted iframe. Games run in a sandbox WITHOUT allow-same-origin, so they have an
   opaque origin: no access to platform cookies/storage. Saves therefore live here, keyed by game id,
   and are handed back in the `hello` message. */
(function (root) {
  'use strict';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const Saves = {
    get: id => LS.get('sg:save:' + id, {}),
    set(id, key, value) { const s = Saves.get(id); if (value == null) delete s[key]; else s[key] = value; LS.set('sg:save:' + id, s); },
    clear: id => LS.del('sg:save:' + id),
    bytes: id => (localStorage.getItem('sg:save:' + id) || '').length,
  };
  const Scores = {
    get: id => LS.get('sg:scores:' + id, []),
    add(id, value) {
      if (typeof value !== 'number' || !isFinite(value)) return;
      const s = Scores.get(id); s.push({ value, at: Date.now() }); s.sort((a, b) => b.value - a.value); LS.set('sg:scores:' + id, s.slice(0, 10));
    },
    clear: id => LS.del('sg:scores:' + id),
  };
  const Stats = {
    bump(id, field) { const s = LS.get('sg:stats', {}); (s[id] || (s[id] = { plays: 0, errors: 0, last: 0 }))[field]++; s[id].last = Date.now(); LS.set('sg:stats', s); },
    get: id => (LS.get('sg:stats', {})[id] || { plays: 0, errors: 0, last: 0 }),
  };

  class GameHost {
    /* opts: { gameId, container (element that receives the ad overlay), adMode: 'grant'|'deny'|'nofill',
               muted, debug, onLog(dir, type, payload), onState(state) } */
    constructor(iframe, opts = {}) {
      this.iframe = iframe; this.o = Object.assign({ adMode: 'grant', muted: false, debug: false }, opts);
      this.ready = false; this.playing = false; this.errors = 0; this.info = null; this.pendingSnap = new Map(); this.snapSeq = 0;
      this.onMsg = e => this.receive(e);
      window.addEventListener('message', this.onMsg);
    }
    destroy() { window.removeEventListener('message', this.onMsg); if (this.adEl) this.adEl.remove(); }
    log(dir, type, payload) { if (this.o.onLog) this.o.onLog(dir, type, payload); }
    state() { if (this.o.onState) this.o.onState({ ready: this.ready, playing: this.playing, errors: this.errors, info: this.info }); }
    post(type, payload = {}) {
      const w = this.iframe.contentWindow; if (!w) return;
      w.postMessage({ __kernel: 1, type, payload }, '*');      // opaque-origin frame: '*' is the only valid target
      this.log('out', type, payload);
    }
    reply(id, payload) { const w = this.iframe.contentWindow; if (w) w.postMessage({ __kernel: 1, replyTo: id, payload }, '*'); this.log('out', 'reply#' + id, payload); }
    receive(e) {
      if (e.source !== this.iframe.contentWindow) return;     // only our frame
      const d = e.data; if (!d || d.__kernel !== 1) return;
      const p = d.payload || {}, id = this.o.gameId;
      if (d.type !== 'save' && d.type !== 'snapshot') this.log('in', d.type, p);
      switch (d.type) {
        case 'ready':
          this.ready = true; this.info = p; Stats.bump(id, 'plays');
          this.post('hello', { save: Saves.get(id), muted: !!this.o.muted, debug: !!this.o.debug, platform: 'slopgames', host: 1 });
          break;
        case 'save': Saves.set(id, p.key, p.value); this.log('in', 'save', { key: p.key }); break;
        case 'score': Scores.add(id, p.value); break;
        case 'gameplayStart': this.playing = true; break;
        case 'gameplayStop': this.playing = false; break;
        case 'error': this.errors++; Stats.bump(id, 'errors'); break;
        case 'adBreak': this.showAd(p.kind || 'midgame').then(r => this.reply(p.id, r)); break;
        case 'snapshot': { const r = this.pendingSnap.get(p.id); if (r) { this.pendingSnap.delete(p.id); r(p.data || null); } break; }
      }
      this.state();
    }
    pause() { this.post('pause'); }
    resume() { this.post('resume'); }
    mute(m) { this.o.muted = !!m; this.post('mute', { muted: !!m }); }
    debug(on) { this.o.debug = !!on; this.post('debug', { on: !!on }); }
    snapshot(width = 480) {
      return new Promise(res => {
        const id = ++this.snapSeq; this.pendingSnap.set(id, res); this.post('snapshot', { id, width });
        setTimeout(() => { if (this.pendingSnap.has(id)) { this.pendingSnap.delete(id); res(null); } }, 3000);
      });
    }
    // Simulated ad creative. Real ad SDK integration replaces this one method.
    showAd(kind) {
      const mode = this.o.adMode;
      if (mode === 'nofill') { this.log('ad', 'nofill', { kind }); return Promise.resolve({ shown: false, granted: false }); }
      return new Promise(res => {
        const box = this.o.container || this.iframe.parentElement;
        const dur = kind === 'rewarded' ? 5 : 3;
        const el = document.createElement('div'); el.className = 'adov';
        el.innerHTML = `<div class="lbl">Advertisement · ${kind}</div>
          <button class="btn sm ghost skip" ${kind === 'rewarded' ? '' : 'disabled'}>${kind === 'rewarded' ? 'Close' : 'Skip'}</button>
          <div class="creative"><h3>Your ad here</h3><div class="small">${kind === 'rewarded' ? 'Watch to the end for your reward' : 'Simulated interstitial'} · ${dur}s</div><div class="bar"><i></i></div></div>`;
        box.appendChild(el); this.adEl = el; this.log('ad', 'adBreak', { kind });
        const bar = el.querySelector('.bar i'), skip = el.querySelector('.skip');
        void bar.offsetWidth; bar.style.transitionDuration = dur + 's'; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '100%'; }));
        let done = false;
        const finish = full => {
          if (done) return; done = true; el.remove(); this.adEl = null;
          const r = { shown: true, granted: kind === 'rewarded' && full && mode !== 'deny' };
          this.log('ad', 'adDone', r); res(r);
        };
        if (kind !== 'rewarded') setTimeout(() => { skip.disabled = false; }, 1500);
        skip.onclick = () => finish(false);
        setTimeout(() => finish(true), dur * 1000);
      });
    }
  }
  root.SGHost = { GameHost, Saves, Scores, Stats, LS };
})(window);
