/* SlopGames platform app — hash-routed SPA, no build step. */
(function () {
  'use strict';
  const { GameHost, Saves, Scores, Stats, LS } = window.SGHost;
  const DB = window.SGDB;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const view = $('#view');
  let cleanup = [];
  const onLeave = fn => cleanup.push(fn);

  /* ---------- icons ---------- */
  const I = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    home: I('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
    lab: I('<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 001.3 2h13.4A1.5 1.5 0 0020 19l-6-10V3"/><path d="M7 15h10"/>'),
    spark: I('<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>'),
    gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
    play: `<svg width="44" height="44" viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 001.5.9l10.4-6.5a1 1 0 000-1.8L9.5 4.6A1 1 0 008 5.5z" fill="#0d2a14"/></svg>`,
    full: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    reload: I('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    vol: I('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>'),
    mute: I('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
    link: I('<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>'),
    down: I('<path d="M12 3v13M6 11l6 6 6-6M4 21h16"/>'),
    up: I('<path d="M12 21V8M6 13l6-6 6 6M4 3h16"/>'),
    trash: I('<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>'),
    cam: I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 011-1h10"/>'),
    drafts: I('<path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6"/>'),
    pause: I('<path d="M8 5v14M16 5v14"/>'),
    resume: I('<path d="M7 5l12 7-12 7z"/>'),
    bolt: I('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    gh: I('<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 00-1-2.6c3.1-.4 6.4-1.6 6.4-7A5.4 5.4 0 0020 4.8 5 5 0 0019.9 1S18.7.7 16 2.5a13.4 13.4 0 00-7 0C6.3.6 5.1 1 5.1 1A5 5 0 005 4.8a5.4 5.4 0 00-1.5 3.7c0 5.4 3.3 6.6 6.4 7a3.4 3.4 0 00-1 2.6V22"/>'),
  };
  const GENRE_EMOJI = Object.fromEntries((window.SGPrompt ? SGPrompt.GENRES : []).map(g => [g.id, g.emoji]));
  const emojiFor = g => GENRE_EMOJI[g.genre] || ({ showcase: '🧪', draft: '📝' })[g.genre] || '🎮';
  const GENRE_LABEL = Object.fromEntries((window.SGPrompt ? SGPrompt.GENRES : []).map(g => [g.id, g.label]));
  const genreLabel = g => GENRE_LABEL[g.genre] || g.genre || '';
  const isListed = g => g.source === 'repo' && g.status !== 'lab';   // public "live" games
  const isLabBuild = g => g.source === 'repo' && g.status === 'lab';

  /* ---------- toast / modal ---------- */
  function toast(msg, kind = '') {
    const box = $('#toasts'); const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; box.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
  }
  function modal(html) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
    return { el: bg.firstElementChild, close };
  }
  const settings = () => Object.assign({ preroll: false, adMode: 'grant' }, LS.get('sg:settings', {}));

  /* ---------- cards ---------- */
  function thumb(g, cls = '') {
    if (g.thumb) return `<img class="${cls}" src="${esc(g.thumb)}" alt="" loading="lazy">`;
    const c = g.color || '#8f5bff';
    return `<div class="ph ${cls}" style="background:linear-gradient(140deg, ${c}, #1b1b3a)" aria-hidden="true">${emojiFor(g)}</div>`;
  }
  function card(g) {
    const badges = [g.source === 'draft' ? '<span class="badge draft">draft</span>' : '', g.status === 'lab' ? '<span class="badge lab">lab</span>' : ''].join('');
    return `<a class="card" data-id="${esc(g.id)}" href="#/g/${encodeURIComponent(g.id)}" title="${esc(g.description || '')}">
      <div class="thumb">${thumb(g)}<div class="badges">${badges}</div></div>
      <div class="meta"><b>${esc(g.title)}</b><span>${emojiFor(g)} ${esc(genreLabel(g))}</span></div></a>`;
  }
  /* Auto-thumbnails: drafts saved without a thumbnail get one by booting the game in a hidden frame
     and snapshotting its title screen. Runs one draft at a time; each draft is tried once per page load. */
  const thumbTried = new Set();
  let thumbBusy = false;
  async function captureThumb(d) {
    const f = makeFrame();
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:390px;height:844px;opacity:0;pointer-events:none;z-index:-1;border:0';
    document.body.appendChild(f);
    let h = null;
    try {
      const ready = new Promise(res => { h = new GameHost(f, { gameId: d.id, container: document.body, muted: true, onState: s => s.ready && res() }); });
      f.srcdoc = await DB.playableHTML(Object.assign({ source: 'draft' }, d), null);
      await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
      await new Promise(r => setTimeout(r, 1200));                      // let the title screen animate in
      return await h.snapshot(600);
    } catch (e) { return null; }
    finally { if (h) h.destroy(); f.remove(); }
  }
  async function backfillThumbs() {
    if (thumbBusy) return; thumbBusy = true;
    try {
      const todo = (await DB.drafts.list()).filter(d => !d.thumb && d.html && !thumbTried.has(d.id));
      for (const d of todo) {
        thumbTried.add(d.id);
        const shot = await captureThumb(d);
        if (!shot) continue;
        const dr = await DB.drafts.get(d.id); if (!dr || dr.thumb) continue;
        dr.thumb = shot; await DB.drafts.put(dr);
        document.querySelectorAll(`.card[data-id="${CSS.escape(d.id)}"] .ph`).forEach(ph => { const img = new Image(); img.src = shot; img.alt = ''; ph.replaceWith(img); });
      }
    } finally { thumbBusy = false; }
  }
  const grid = list => list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="empty">Nothing here yet.</div>`;

  /* ---------- sidebar ---------- */
  async function renderSide() {
    const all = await DB.all();
    const live = all.filter(isListed);
    const counts = {};
    live.forEach(g => (g.tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));
    const tags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 18);
    const drafts = all.filter(g => g.source === 'draft').length;
    $('#side').innerHTML = `
      <a href="#/" data-r="home"><span class="ico">${ICON.home}</span>Home<span class="count">${live.length}</span></a>
      <a href="#/create" data-r="create"><span class="ico">${ICON.spark}</span>Create with AI</a>
      <a href="#/lab" data-r="lab"><span class="ico">${ICON.lab}</span>Kernel Lab</a>
      <a href="#/drafts" data-r="drafts"><span class="ico">${ICON.drafts}</span>My drafts<span class="count">${drafts}</span></a>
      <h4>Categories</h4>
      ${tags.map(([t, n]) => `<a href="#/t/${encodeURIComponent(t)}" data-r="t/${esc(t)}"><span class="ico">${emojiFor({ genre: t })}</span>${esc(t)}<span class="count">${n}</span></a>`).join('')}
      <h4>Platform</h4>
      <a href="lab/tests.html" target="_blank" rel="noopener"><span class="ico">${ICON.bolt}</span>Kernel unit tests</a>
      <a href="https://github.com/${esc(DB.gh.cfg.repo)}" target="_blank" rel="noopener"><span class="ico">${ICON.gh}</span>Repository</a>`;
    markActive();
  }
  function markActive() {
    const h = (location.hash || '#/').slice(2);
    const key = h === '' ? 'home' : h.startsWith('lab') ? 'lab' : h.startsWith('t/') ? decodeURIComponent(h) : h.split('/')[0];
    $$('#side a[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === key));
    $$('.top nav a').forEach(a => a.classList.toggle('on', a.dataset.r === key));
  }

  /* ======================================================================
     HOME / LISTS
     ====================================================================== */
  async function home() {
    const all = await DB.all();
    const live = all.filter(isListed);
    const labBuilds = all.filter(isLabBuild);
    const drafts = all.filter(g => g.source === 'draft');
    const feat = live.find(g => g.featured) || live[0];
    const byGenre = {};
    live.forEach(g => (byGenre[g.genre] = byGenre[g.genre] || []).push(g));
    view.innerHTML = `
      ${feat ? `<section class="hero">
        <div class="bg" style="background-image:url('${esc(feat.thumb || '')}')"></div>
        ${feat.thumb ? `<img class="shot" src="${esc(feat.thumb)}" alt="">` : ''}
        <div><span class="badge k">featured</span><h1 style="margin-top:10px">${esc(feat.title)}</h1><p>${esc(feat.description)}</p>
          <div class="row"><a class="btn go big" href="#/g/${esc(feat.id)}">▶ Play now</a><a class="btn ghost" href="#/lab/${esc(feat.id)}">${ICON.lab} Open in Lab</a></div></div>
      </section>` : ''}
      <section class="sec"><div class="sec-head"><h2>🔥 All games</h2><span class="muted small">${live.length} live</span></div>${grid(live)}</section>
      ${drafts.length ? `<section class="sec"><div class="sec-head"><h2>📝 Your drafts</h2><a class="more" href="#/drafts">See all</a></div>${grid(drafts.slice(0, 8))}</section>` : ''}
      ${labBuilds.length ? `<section class="sec"><div class="sec-head"><h2>🧪 Lab builds</h2><span class="muted small">test pages · not listed</span></div>${grid(labBuilds)}</section>` : ''}
      <section class="sec"><div class="hero" style="min-height:180px;background:linear-gradient(120deg,#2b1b6b,#5f33c4 50%,#c42d84)">
        <div><h1>Make a game with AI</h1><p>Pick a genre, controls and art direction. We build the prompt around the kernel contract — paste the result back and it runs in the Lab.</p>
        <a class="btn pri big" href="#/create">${ICON.spark} Start creating</a></div></div></section>
      ${Object.entries(byGenre).filter(([, l]) => l.length > 1).map(([gname, l]) => `<section class="sec"><div class="sec-head"><h2>${emojiFor({ genre: gname })} ${esc(gname)}</h2></div>${grid(l)}</section>`).join('')}`;
    if (drafts.some(d => !d.thumb)) backfillThumbs();
  }
  async function listView(title, filter) {
    const all = await DB.all();
    const list = all.filter(filter);
    view.innerHTML = `<div class="sec-head"><h1>${title}</h1><span class="muted">${list.length} game${list.length === 1 ? '' : 's'}</span></div>${grid(list)}`;
  }
  const tagView = t => listView(`${emojiFor({ genre: t })} ${esc(t)}`, g => isListed(g) && ((g.tags || []).includes(t) || g.genre === t));
  const searchView = q => { q = q.toLowerCase(); return listView(`Search: “${esc(q)}”`, g => [g.title, g.description, g.genre, ...(g.tags || [])].join(' ').toLowerCase().includes(q)); };
  async function draftsView() {
    const d = (await DB.all()).filter(g => g.source === 'draft');
    view.innerHTML = `<div class="sec-head"><h1>📝 My drafts</h1><span class="muted">Stored in this browser only · publish from the Lab</span><a class="btn pri" style="margin-left:auto" href="#/create">${ICON.spark} New</a></div>
      ${d.length ? grid(d) : `<div class="empty"><h2 style="justify-content:center">No drafts yet</h2><p>Generate a game on the Create page, paste it back, and it lands here.</p><a class="btn pri" href="#/create">Create a game</a></div>`}`;
    if (d.some(x => !x.thumb)) backfillThumbs();
  }

  /* ======================================================================
     GAME PAGE — sandboxed player, ad wrapper, leaderboard
     ====================================================================== */
  function makeFrame() {
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts allow-pointer-lock');      // no allow-same-origin: opaque origin, isolated from the platform
    f.setAttribute('allow', 'autoplay; fullscreen; gamepad');
    f.setAttribute('title', 'game');
    return f;
  }
  async function gamePage(id) {
    const g = await DB.find(id);
    if (!g) { view.innerHTML = `<div class="empty"><h2 style="justify-content:center">Game not found</h2><a class="btn" href="#/">Back home</a></div>`; return; }
    const portrait = (g.orientation || 'portrait') !== 'landscape';
    const all = await DB.all();
    const more = all.filter(x => x.id !== g.id && x.source === 'repo').slice(0, 8);
    const scores = Scores.get(g.id), st = Stats.get(g.id);
    view.innerHTML = `
      <div class="gp">
        <div class="adslot sky">Ad · 160×600</div>
        <div>
          <div class="player ${portrait ? 'portrait' : 'landscape'}" id="player">
            <div class="cover" id="cover" style="${g.thumb ? `background-image:url('${esc(g.thumb)}')` : `background:linear-gradient(140deg, ${esc(g.color || '#8f5bff')}, #1b1b3a)`}">
              <div><h2>${esc(g.title)}</h2><button class="playbig" aria-label="Play">${ICON.play}</button><p class="muted small" style="margin-top:14px">kernel ${esc(g.kernel || '?')} · ${portrait ? 'portrait' : 'landscape'}</p></div>
            </div>
          </div>
          <div class="toolbar">
            <h1>${emojiFor(g)} ${esc(g.title)}</h1>
            ${g.source === 'draft' ? '<span class="badge draft">draft</span>' : ''}<span class="badge k">k${esc(g.kernel || '?')}</span>
            <button class="icon-btn" id="b-mute" title="Mute">${ICON.vol}</button>
            <button class="icon-btn" id="b-reload" title="Restart">${ICON.reload}</button>
            <button class="icon-btn" id="b-full" title="Fullscreen">${ICON.full}</button>
            <button class="icon-btn" id="b-link" title="Copy link">${ICON.link}</button>
            <a class="btn sm" href="#/lab/${esc(g.id)}">${ICON.lab} Lab</a>
          </div>
          <div class="adslot leader">Ad · 728×90</div>
          <div class="info">
            <div class="box"><h3>About</h3><p class="muted" style="margin-top:0">${esc(g.description || 'No description.')}</p>
              <div class="row" style="margin:12px 0">${(g.tags || []).map(t => `<a class="tagchip" href="#/t/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>
              <div class="kv"><b>Genre</b><span>${esc(g.genre || '—')}</span><b>Kernel</b><span>${esc(g.kernel || '—')}</span><b>Size</b><span>${g.sizeKB ? g.sizeKB + ' KB' : '—'}</span>
              <b>Added</b><span>${esc(g.added || (g.created ? new Date(g.created).toISOString().slice(0, 10) : '—'))}</span><b>Your plays</b><span>${st.plays}</span></div></div>
            <div class="box"><h3>🏆 Your top scores</h3>
              ${scores.length ? `<ol class="lb">${scores.map((s, i) => `<li><span>${i + 1}</span><span>${new Date(s.at).toLocaleDateString()}</span><span>${s.value.toLocaleString()}</span></li>`).join('')}</ol>` : '<p class="muted small">Play to post a score.</p>'}
              <div class="row" style="margin-top:12px"><span class="muted small">Save data: ${Saves.bytes(g.id)} bytes</span><button class="btn sm ghost" id="b-clear">Clear save</button></div></div>
          </div>
          ${more.length ? `<section class="sec"><div class="sec-head"><h2>More games</h2></div>${grid(more)}</section>` : ''}
        </div>
        <div class="adslot sky">Ad · 160×600</div>
      </div>`;
    const player = $('#player');
    let host = null, frame = null, muted = false;
    async function start() {
      $('#cover').remove();
      frame = makeFrame(); player.appendChild(frame);
      host = new GameHost(frame, { gameId: g.id, container: player, adMode: settings().adMode, muted });
      onLeave(() => host.destroy());
      if (settings().preroll) await host.showAd('preroll');
      if (g.source === 'repo') frame.src = `games/${encodeURIComponent(g.id)}/index.html`;
      else frame.srcdoc = await DB.playableHTML(g, null);
      frame.focus();
    }
    $('#cover').addEventListener('click', start);
    $('#b-reload').onclick = async () => { if (!frame) return start(); host.ready = false; if (g.source === 'repo') frame.src = frame.src; else frame.srcdoc = await DB.playableHTML(g, null); };
    $('#b-full').onclick = () => { (player.requestFullscreen || player.webkitRequestFullscreen || (() => {})).call(player); };
    $('#b-mute').onclick = e => { muted = !muted; if (host) host.mute(muted); e.currentTarget.innerHTML = muted ? ICON.mute : ICON.vol; };
    $('#b-link').onclick = () => { navigator.clipboard.writeText(location.href).then(() => toast('Link copied', 'good')); };
    $('#b-clear').onclick = () => { Saves.clear(g.id); Scores.clear(g.id); toast('Save & scores cleared'); gamePage(id); };
  }

  /* ======================================================================
     KERNEL LAB
     ====================================================================== */
  const DEVICES = {
    phone: { label: 'Phone · 390×844', w: 390, h: 844 },
    small: { label: 'Small phone · 360×640', w: 360, h: 640 },
    phoneL: { label: 'Phone landscape · 844×390', w: 844, h: 390 },
    tablet: { label: 'Tablet · 820×1180', w: 820, h: 1180 },
    desktop: { label: 'Desktop · 1366×768', w: 1366, h: 768, flat: true },
    fill: { label: 'Fill stage', fill: true, flat: true },
  };
  async function labView(id) {
    const [all, ver] = await Promise.all([DB.all(), DB.versions()]);
    if (!all.length) { view.innerHTML = '<div class="empty">No games yet.</div>'; return; }
    const S = Object.assign({ device: 'phone', kernel: 'pinned', adMode: 'grant', debug: true, muted: false, tab: 'log' }, LS.get('sg:lab', {}));
    const saveS = () => LS.set('sg:lab', S);
    let g = all.find(x => x.id === id) || all.find(x => x.id === S.last) || all[0];
    S.last = g.id; saveS();
    if (id !== g.id) history.replaceState(null, '', '#/lab/' + encodeURIComponent(g.id));
    const opt = (v, l, sel) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`;
    view.innerHTML = `
      <div class="lab">
        <div class="lab-ctl">
          <div class="row"><h1 style="font-size:24px">${ICON.lab} Kernel Lab</h1></div>
          <div class="field"><label>Game</label><select id="l-game">
            ${all.some(x => x.source === 'draft') ? `<optgroup label="Drafts">${all.filter(x => x.source === 'draft').map(x => opt(x.id, x.title, g.id)).join('')}</optgroup>` : ''}
            <optgroup label="Repository">${all.filter(x => x.source === 'repo').map(x => opt(x.id, x.title, g.id)).join('')}</optgroup></select></div>
          <div class="field"><label>Kernel</label><select id="l-kernel">${opt('pinned', 'Pinned in file', S.kernel)}${ver.versions.map(v => opt(v.version, `v${v.version}${v.version === ver.latest ? ' (latest)' : ''} · ${v.status}`, S.kernel)).join('')}</select></div>
          <div class="field"><label>Device</label><select id="l-device">${Object.entries(DEVICES).map(([k, d]) => opt(k, d.label, S.device)).join('')}</select></div>
          <div class="field"><label>Ad behaviour</label><select id="l-ad">${opt('grant', 'Fill · rewarded granted', S.adMode)}${opt('deny', 'Fill · user closes early (no reward)', S.adMode)}${opt('nofill', 'No fill', S.adMode)}</select></div>
          <div class="toggles"><label class="tg"><input type="checkbox" id="l-debug" ${S.debug ? 'checked' : ''}> Debug overlay</label><label class="tg"><input type="checkbox" id="l-muted" ${S.muted ? 'checked' : ''}> Muted</label></div>
          <div class="row">
            <button class="btn sm go" id="l-reload">${ICON.reload} Reload</button>
            <button class="btn sm" id="l-pause" title="Platform pause">${ICON.pause}</button>
            <button class="btn sm" id="l-resume" title="Platform resume">${ICON.resume}</button>
            <button class="btn sm" id="l-snap" title="Snapshot">${ICON.cam}</button>
            <button class="btn sm" id="l-dl" title="Download assembled HTML">${ICON.down}</button>
          </div>
          <div class="box"><h3>Validation</h3><ul class="checks" id="l-checks"><li class="o">running…</li></ul></div>
          <div class="box"><h3>Game</h3><div class="kv" id="l-info"></div></div>
          ${g.source === 'draft' ? `<div class="box"><h3>Draft</h3><p class="muted small" style="margin-top:0">Lives in this browser. Snapshot to set a thumbnail, then publish to the repo.</p>
            <div class="field" style="margin-bottom:10px"><label>Genre</label><select id="d-genre">${(window.SGPrompt ? SGPrompt.GENRES : []).map(x => opt(x.id, `${x.emoji} ${x.label}`, g.genre)).join('')}</select></div>
            <div class="row"><button class="btn sm pri" id="d-pub">${ICON.up} Publish</button><button class="btn sm" id="d-thumb">${ICON.cam} Set thumbnail</button><button class="btn sm warn" id="d-del">${ICON.trash}</button></div>
            ${g.thumb ? `<img src="${esc(g.thumb)}" style="width:100%;border-radius:12px;margin-top:12px" alt="">` : ''}</div>`
          : `<a class="btn" href="#/g/${esc(g.id)}">▶ Open game page</a>`}
        </div>
        <div class="lab-main">
          <div class="stage" id="stage"><div class="device" id="device"></div><div class="dims" id="dims"></div><div class="state" id="lstate"></div></div>
          <div class="dock"><div class="tabs" id="ltabs">
            ${['log', 'saves', 'scores', 'tests'].map(t => `<button data-t="${t}" class="${S.tab === t ? 'on' : ''}">${{ log: 'SDK log', saves: 'Save data', scores: 'Scores', tests: 'Unit tests' }[t]}</button>`).join('')}
            <span class="sp"></span><button id="l-clearlog" title="Clear">${ICON.trash}</button></div>
            <div class="pane" id="lpane"></div></div>
        </div>
      </div>`;
    const device = $('#device'), stage = $('#stage');
    let host = null, frame = null, html = '', effVer = '?';
    const log = [];
    const t0 = performance.now();
    function fit() {
      const d = DEVICES[S.device] || DEVICES.phone, sw = stage.clientWidth, sh = stage.clientHeight;
      device.classList.toggle('flat', !!d.flat);
      if (d.fill) { device.style.width = sw + 'px'; device.style.height = sh + 'px'; device.style.transform = 'none'; $('#dims').textContent = `${sw}×${sh} · 100%`; return; }
      const sc = Math.min((sw - 60) / d.w, (sh - 60) / d.h, 1);
      device.style.width = d.w + 'px'; device.style.height = d.h + 'px'; device.style.transform = `scale(${sc})`;
      $('#dims').textContent = `${d.w}×${d.h} · ${Math.round(sc * 100)}%`;
    }
    function renderState(s) {
      $('#lstate').innerHTML = `<span class="badge ${s.ready ? 'k' : ''}">${s.ready ? 'ready' : 'loading'}</span>${s.playing ? '<span class="badge lab">gameplay</span>' : ''}${s.errors ? `<span class="badge err">${s.errors} error${s.errors > 1 ? 's' : ''}</span>` : ''}<span class="badge">k${esc(effVer)}</span>`;
    }
    function renderPane() {
      const pane = $('#lpane');
      if (S.tab === 'log') {
        pane.innerHTML = `<div class="log">${log.slice(-300).map(l => `<div class="${l.dir}${l.type === 'error' ? ' err' : ''}"><span class="t">${l.t}</span><span class="ty">${l.dir === 'in' ? '←' : l.dir === 'out' ? '→' : '◆'} ${esc(l.type)}</span>${esc(l.p)}</div>`).join('') || '<span class="muted">Messages between the game and the platform appear here.</span>'}</div>`;
        pane.scrollTop = pane.scrollHeight;
      } else if (S.tab === 'saves') {
        pane.innerHTML = `<div class="row" style="margin-bottom:8px"><span class="muted">${Saves.bytes(g.id)} bytes in platform storage for <b>${esc(g.id)}</b></span><button class="btn sm ghost" id="l-csave">Clear save</button></div><pre style="margin:0">${esc(JSON.stringify(Saves.get(g.id), null, 2))}</pre>`;
        $('#l-csave').onclick = () => { Saves.clear(g.id); toast('Save cleared — reload to start fresh'); renderPane(); };
      } else if (S.tab === 'scores') {
        const sc = Scores.get(g.id);
        pane.innerHTML = sc.length ? `<ol class="lb">${sc.map((s, i) => `<li><span>${i + 1}</span><span>${new Date(s.at).toLocaleString()}</span><span>${s.value.toLocaleString()}</span></li>`).join('')}</ol>` : '<span class="muted">No scores posted yet.</span>';
      } else if (S.tab === 'tests') {
        pane.innerHTML = `<iframe src="lab/tests.html?k=${encodeURIComponent(effVer)}" style="width:100%;height:100%;border:0;border-radius:8px;min-height:180px"></iframe>`;
      }
    }
    function addLog(dir, type, payload) {
      const p = payload && Object.keys(payload).length ? JSON.stringify(payload).slice(0, 400) : '';
      log.push({ dir, type, p, t: ((performance.now() - t0) / 1000).toFixed(2) + 's' });
      if (log.length > 1000) log.splice(0, 200);
      if (S.tab === 'log') renderPane();
    }
    async function mount() {
      if (host) host.destroy();
      device.innerHTML = '';
      log.length = 0;
      html = await DB.playableHTML(g, S.kernel === 'pinned' ? null : S.kernel);
      effVer = SG.kernelVersion(html) || '?';
      renderPane();
      const v = SG.validate(html);
      $('#l-checks').innerHTML = [...v.errors.map(e => `<li class="e">${esc(e)}</li>`), ...v.warnings.map(w => `<li class="w">${esc(w)}</li>`)].join('') || '<li class="o">All checks passed</li>';
      $('#l-info').innerHTML = `<b>id</b><span>${esc(v.info.id)}</span><b>kernel</b><span>${esc(effVer)}${S.kernel !== 'pinned' ? ' (override)' : ''}</span><b>size</b><span>${v.info.sizeKB} KB (game ${v.info.gameKB} KB)</span><b>scenes</b><span>${esc(v.info.scenes.join(', '))}</span><b>theme</b><span>${esc(v.info.theme || '—')}</span><b>source</b><span>${g.source}</span>`;
      frame = makeFrame(); device.appendChild(frame);
      host = new GameHost(frame, { gameId: g.id, container: device, adMode: S.adMode, muted: S.muted, debug: S.debug, onLog: addLog, onState: s => { renderState(s); if (s.ready && g.source === 'draft' && !g.thumb && !thumbTried.has(g.id)) { thumbTried.add(g.id); setTimeout(async () => { const shot = host && await host.snapshot(600); if (!shot) return; const dr = await DB.drafts.get(g.id); if (dr && !dr.thumb) { dr.thumb = shot; await DB.drafts.put(dr); g.thumb = shot; } }, 1500); } } });
      renderState({}); fit();
      frame.srcdoc = html;
    }
    onLeave(() => { if (host) host.destroy(); window.removeEventListener('resize', fit); });
    window.addEventListener('resize', fit);
    $('#l-game').onchange = e => { location.hash = '#/lab/' + encodeURIComponent(e.target.value); };
    $('#l-kernel').onchange = e => { S.kernel = e.target.value; saveS(); mount(); };
    $('#l-device').onchange = e => { S.device = e.target.value; saveS(); fit(); };
    $('#l-ad').onchange = e => { S.adMode = e.target.value; saveS(); if (host) host.o.adMode = S.adMode; };
    $('#l-debug').onchange = e => { S.debug = e.target.checked; saveS(); if (host) host.debug(S.debug); };
    $('#l-muted').onchange = e => { S.muted = e.target.checked; saveS(); if (host) host.mute(S.muted); };
    $('#l-reload').onclick = mount;
    $('#l-pause').onclick = () => host && host.pause();
    $('#l-resume').onclick = () => host && host.resume();
    $('#l-clearlog').onclick = () => { log.length = 0; renderPane(); };
    $('#l-dl').onclick = () => download(`${g.id}.html`, html, 'text/html');
    $('#l-snap').onclick = async () => { const d = host && await host.snapshot(600); if (!d) return toast('Snapshot failed (is the game running kernel ≥ 1.1?)', 'bad'); const m = modal(`<h2>Snapshot</h2><img src="${d}" style="width:100%;border-radius:12px"><div class="row"><a class="btn" download="${esc(g.id)}.jpg" href="${d}">${ICON.down} Download</a><button class="btn ghost" id="m-x">Close</button></div>`); $('#m-x', m.el).onclick = m.close; };
    $$('#ltabs button[data-t]').forEach(b => b.onclick = () => { S.tab = b.dataset.t; saveS(); $$('#ltabs button[data-t]').forEach(x => x.classList.toggle('on', x === b)); renderPane(); });
    if (g.source === 'draft') {
      $('#d-del').onclick = async () => { if (!confirm(`Delete draft “${g.title}”?`)) return; await DB.drafts.del(g.id); toast('Draft deleted'); renderSide(); location.hash = '#/drafts'; };
      $('#d-genre').onchange = async e => { const dr = await DB.drafts.get(g.id); const ng = SGPrompt.GENRES.find(x => x.id === e.target.value);
        dr.tags = [ng.id, ...(dr.tags || []).filter(t => t !== dr.genre && t !== ng.id)]; dr.genre = ng.id; dr.emoji = ng.emoji;
        await DB.drafts.put(dr); toast(`Genre set to ${ng.label}`, 'good'); renderSide(); };
      $('#d-thumb').onclick = async () => { const d = host && await host.snapshot(600); if (!d) return toast('Snapshot failed', 'bad'); const dr = await DB.drafts.get(g.id); dr.thumb = d; await DB.drafts.put(dr); toast('Thumbnail saved', 'good'); labView(g.id); };
      $('#d-pub').onclick = () => publishDialog(g);
    }
    await mount();
  }

  async function publishDialog(g) {
    const dr = await DB.drafts.get(g.id);
    const cfg = DB.gh.cfg;
    const m = modal(`<h2>${ICON.up} Publish to repository</h2>
      <p class="muted small" style="margin-top:0">Commits <code>games/${esc(g.id)}/index.html</code>${dr.thumb ? ', a thumbnail' : ''} and a registry entry to <b>${esc(cfg.repo)}</b>@${esc(cfg.branch)} using your token. GitHub Pages redeploys in about a minute.</p>
      ${cfg.token ? '' : `<p class="small" style="color:var(--yellow)">No GitHub token yet — add one in Settings (fine-grained, Contents: read & write on this repo).</p>`}
      <div class="field"><label>Title</label><input type="text" id="p-title" value="${esc(dr.title)}"></div>
      <div class="field" style="margin-top:10px"><label>Description</label><textarea id="p-desc" rows="3" style="font-family:var(--font);font-size:14px">${esc(dr.description || '')}</textarea></div>
      <div class="field" style="margin-top:10px"><label>Tags (comma separated)</label><input type="text" id="p-tags" value="${esc((dr.tags || []).join(', '))}"></div>
      <div class="toggles" style="margin-top:10px"><label class="tg"><input type="checkbox" id="p-live" checked> List as live</label><label class="tg"><input type="checkbox" id="p-feat"> Featured</label></div>
      <p class="small mono" id="p-step" style="color:var(--accent2)"></p>
      <div class="row"><button class="btn ghost" id="p-x">Cancel</button><button class="btn pri" id="p-go" ${cfg.token ? '' : 'disabled'}>${ICON.up} Publish</button></div>`);
    $('#p-x', m.el).onclick = m.close;
    $('#p-go', m.el).onclick = async e => {
      e.target.disabled = true;
      const entry = { id: g.id, title: $('#p-title', m.el).value.trim() || dr.title, description: $('#p-desc', m.el).value.trim(), genre: dr.genre || 'arcade',
        tags: $('#p-tags', m.el).value.split(',').map(s => s.trim()).filter(Boolean), orientation: dr.orientation || 'portrait', theme: dr.theme || 'candy', color: dr.color || '#8f5bff',
        version: '1.0.0', author: 'SlopGames AI', added: new Date().toISOString().slice(0, 10), featured: $('#p-feat', m.el).checked, status: $('#p-live', m.el).checked ? 'live' : 'lab' };
      try {
        await DB.publish(dr, entry, s => { $('#p-step', m.el).textContent = s; });
        toast('Published! Pages will update shortly.', 'good');
        $('#p-step', m.el).innerHTML = `Done. Committed to ${esc(DB.gh.cfg.repo)}. Keep the draft until the live copy appears, then delete it.`;
      } catch (err) { $('#p-step', m.el).textContent = '✘ ' + err.message; e.target.disabled = false; }
    };
  }

  /* ======================================================================
     CREATE — option menu → prompt → paste result → draft
     ====================================================================== */
  async function createView() {
    const P = window.SGPrompt;
    const [ver, guide] = await Promise.all([DB.versions(), DB.guide().catch(() => '(KERNEL_GUIDE.md failed to load)')]);
    const sel = Object.assign(P.defaults('arcade'), LS.get('sg:create', {}));
    const persist = () => LS.set('sg:create', sel);
    view.innerHTML = `
      <div class="sec-head"><h1>${ICON.spark} Create a game</h1><span class="muted">Kernel ${esc(ver.latest)} · every option maps to kernel systems</span></div>
      <div class="create">
        <div class="steps">
          <div class="step"><h3>Describe it</h3>
            <div class="field"><label>Title</label><input type="text" id="c-title" placeholder="e.g. Comet Courier" value="${esc(sel.title)}"></div>
            <div class="field" style="margin-top:12px"><label>Pitch / hook</label><textarea id="c-pitch" rows="3" style="font-family:var(--font);font-size:14px" placeholder="One or two sentences: what makes it fun? Leave blank to let the AI invent one.">${esc(sel.pitch)}</textarea></div>
          </div>
          <div class="step"><h3>Genre</h3><div class="chips" id="c-genre">${P.GENRES.map(g => `<button data-id="${g.id}" class="${g.id === sel.genre ? 'on' : ''}" title="${esc(g.brief)}">${g.emoji} ${esc(g.label)}</button>`).join('')}</div>
            <p class="hint muted small" id="c-gbrief"></p></div>
          <div class="step"><h3>Tune it</h3><div id="c-opts"></div>
            <div class="field"><label>Extra requirements</label><textarea id="c-extra" rows="3" style="font-family:var(--font);font-size:14px" placeholder="Bosses every 5 waves, a dash ability, co-op not needed…">${esc(sel.extra)}</textarea></div>
          </div>
        </div>
        <div class="steps sticky">
          <div class="step"><h3>Copy the prompt</h3>
            <textarea id="c-prompt" rows="12" readonly></textarea>
            <div class="row" style="margin-top:10px"><button class="btn pri" id="c-copy">${ICON.copy} Copy prompt</button><button class="btn ghost" id="c-dlp">${ICON.down} .txt</button><span class="muted small" id="c-len"></span></div>
            <p class="muted small">Paste into Claude (or another strong model). The in-platform generator + credit ledger plugs in here later.</p>
          </div>
          <div class="step"><h3>Paste the result</h3>
            <textarea id="c-out" rows="8" placeholder="Paste the generated HTML here (or import a file)…"></textarea>
            <div class="row" style="margin-top:10px"><button class="btn" id="c-val">Validate</button><label class="btn ghost">${ICON.up} Import file<input type="file" id="c-file" accept=".html,.htm,text/html" hidden></label><button class="btn go" id="c-save" style="margin-left:auto">Save draft & test ▶</button></div>
            <ul class="checks" id="c-checks" style="margin-top:12px"></ul>
          </div>
        </div>
      </div>`;
    function renderOpts() {
      $('#c-opts').innerHTML = Object.entries(P.OPTS).map(([k, o]) => {
        if (k === 'theme') return `<div class="opt"><label>${esc(o.label)}</label><div class="swatches" data-k="theme">${o.items.map(it => { const sw = P.THEME_SWATCH[it.id]; return `<button data-id="${it.id}" class="${sel.theme === it.id ? 'on' : ''}" style="background:linear-gradient(${sw[0]},${sw[1]})"><div class="dots">${sw.slice(2).map(c => `<i style="background:${c}"></i>`).join('')}</div>${it.label}</button>`; }).join('')}</div></div>`;
        const cur = sel[k];
        return `<div class="opt"><label>${esc(o.label)}${o.single ? '' : ' <span style="text-transform:none;letter-spacing:0">· pick any</span>'}</label><div class="chips" data-k="${k}">${o.items.map(it => `<button data-id="${it.id}" class="${(o.single ? cur === it.id : (cur || []).includes(it.id)) ? 'on' : ''}" title="${esc(it.brief || '')}">${esc(it.label)}</button>`).join('')}</div></div>`;
      }).join('');
      $$('#c-opts [data-k]').forEach(box => box.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        const k = box.dataset.k, o = P.OPTS[k];
        if (o.single) sel[k] = b.dataset.id;
        else { const a = sel[k] = sel[k] || []; const i = a.indexOf(b.dataset.id); i >= 0 ? a.splice(i, 1) : a.push(b.dataset.id); }
        renderOpts(); update();
      });
    }
    function update() {
      sel.title = $('#c-title').value; sel.pitch = $('#c-pitch').value; sel.extra = $('#c-extra').value;
      persist();
      const g = P.GENRES.find(x => x.id === sel.genre);
      $('#c-gbrief').textContent = g ? g.brief : '';
      const txt = P.compose(sel, guide, ver.latest);
      $('#c-prompt').value = txt;
      $('#c-len').textContent = `${(txt.length / 1000).toFixed(1)}k chars · ~${Math.round(txt.length / 4 / 1000)}k tokens`;
    }
    $('#c-genre').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = P.defaults(b.dataset.id);
      Object.assign(sel, { genre: d.genre, orientation: d.orientation, controls: d.controls, camera: d.camera, session: d.session });
      $$('#c-genre button').forEach(x => x.classList.toggle('on', x === b));
      renderOpts(); update();
    };
    ['#c-title', '#c-pitch', '#c-extra'].forEach(s => $(s).addEventListener('input', update));
    $('#c-copy').onclick = () => { $('#c-prompt').select(); navigator.clipboard.writeText($('#c-prompt').value).then(() => toast('Prompt copied', 'good'), () => { document.execCommand('copy'); toast('Prompt copied', 'good'); }); };
    $('#c-dlp').onclick = () => download(SG.slug(sel.title || 'game') + '-prompt.txt', $('#c-prompt').value, 'text/plain');
    const clean = s => s.replace(/^\s*```(?:html)?\s*\n/i, '').replace(/\n```\s*$/, '').trim();
    function validateOut() {
      const html = clean($('#c-out').value);
      if (!html) { $('#c-checks').innerHTML = ''; return null; }
      const v = SG.validate(html);
      $('#c-checks').innerHTML = [...v.errors.map(e => `<li class="e">${esc(e)}</li>`), ...v.warnings.map(w => `<li class="w">${esc(w)}</li>`)].join('') + (v.ok ? `<li class="o">Looks valid — ${esc(v.info.id)} · ${v.info.gameKB} KB of game code · scenes: ${esc(v.info.scenes.join(', '))}</li>` : '');
      return { html, v };
    }
    $('#c-val').onclick = validateOut;
    $('#c-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#c-out').value = await f.text(); validateOut(); };
    $('#c-save').onclick = async () => {
      const r = validateOut(); if (!r) return toast('Paste a game first', 'bad');
      const { v } = r; let { html } = r;
      if (!v.info.id || !SG.hasKernelBlock(html)) return toast('Needs a MANIFEST id and kernel markers', 'bad');
      const reg = await DB.registry();
      let id = SG.slug(v.info.id);
      if (reg.games.some(x => x.id === id)) { const nid = id + '-' + Date.now().toString(36).slice(-4); html = html.replace(/(const\s+MANIFEST\s*=\s*\{[\s\S]*?\bid\s*:\s*['"`])[^'"`]+/, '$1' + nid); id = nid; }
      const g = P.GENRES.find(x => x.id === sel.genre);
      await DB.drafts.put({ id, title: v.info.title || sel.title || id, description: sel.pitch || '', genre: sel.genre, tags: [sel.genre, ...(sel.controls || [])], orientation: v.info.orientation || sel.orientation,
        theme: v.info.theme || sel.theme, color: (P.THEME_SWATCH[sel.theme] || [])[1] || '#8f5bff', html, kernel: v.info.kernel, created: Date.now(), prompt: Object.assign({}, sel), emoji: g && g.emoji });
      toast('Draft saved — opening the Lab', 'good');
      renderSide();
      location.hash = '#/lab/' + encodeURIComponent(id);
    };
    renderOpts(); update();
  }

  /* ======================================================================
     SETTINGS
     ====================================================================== */
  function settingsDialog() {
    const s = settings(), gh = DB.gh.cfg;
    const m = modal(`<h2>${ICON.gear} Settings</h2>
      <h3 style="margin:14px 0 8px">Ads (simulated)</h3>
      <div class="toggles"><label class="tg"><input type="checkbox" id="s-pre" ${s.preroll ? 'checked' : ''}> Pre-roll before games</label>
        <label class="tg">Rewarded: <select id="s-ad" style="padding:4px 6px;width:auto"><option value="grant" ${s.adMode === 'grant' ? 'selected' : ''}>grant</option><option value="deny" ${s.adMode === 'deny' ? 'selected' : ''}>deny</option><option value="nofill" ${s.adMode === 'nofill' ? 'selected' : ''}>no fill</option></select></label></div>
      <h3 style="margin:18px 0 8px">${ICON.gh} GitHub publishing</h3>
      <p class="muted small" style="margin-top:0">Used only by “Publish” in the Lab. The token stays in this browser's localStorage. Use a fine-grained token limited to this repo with <b>Contents: read and write</b>.</p>
      <div class="field"><label>Repository</label><input type="text" id="s-repo" value="${esc(gh.repo)}"></div>
      <div class="field" style="margin-top:10px"><label>Branch</label><input type="text" id="s-branch" value="${esc(gh.branch)}"></div>
      <div class="field" style="margin-top:10px"><label>Token</label><input type="password" id="s-token" value="${esc(gh.token)}" placeholder="github_pat_…" autocomplete="off"></div>
      <h3 style="margin:18px 0 8px">Local data</h3>
      <button class="btn sm warn" id="s-wipe">${ICON.trash} Clear all saves & scores</button>
      <div class="row"><button class="btn ghost" id="s-x">Cancel</button><button class="btn pri" id="s-ok">Save</button></div>`);
    $('#s-x', m.el).onclick = m.close;
    $('#s-wipe', m.el).onclick = () => { Object.keys(localStorage).filter(k => /^sg:(save|scores|stats)/.test(k)).forEach(k => localStorage.removeItem(k)); toast('Local saves & scores cleared'); };
    $('#s-ok', m.el).onclick = () => {
      LS.set('sg:settings', { preroll: $('#s-pre', m.el).checked, adMode: $('#s-ad', m.el).value });
      DB.gh.save({ repo: $('#s-repo', m.el).value.trim(), branch: $('#s-branch', m.el).value.trim() || 'main', token: $('#s-token', m.el).value.trim() });
      toast('Settings saved', 'good'); m.close();
    };
  }

  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ======================================================================
     ROUTER
     ====================================================================== */
  const routes = [
    [/^#?\/?$/, () => home()],
    [/^#\/t\/(.+)$/, m => tagView(decodeURIComponent(m[1]))],
    [/^#\/s\/(.*)$/, m => searchView(decodeURIComponent(m[1]))],
    [/^#\/g\/(.+)$/, m => gamePage(decodeURIComponent(m[1]))],
    [/^#\/lab(?:\/(.+))?$/, m => labView(m[1] && decodeURIComponent(m[1]))],
    [/^#\/create$/, () => createView()],
    [/^#\/drafts$/, () => draftsView()],
  ];
  async function route() {
    cleanup.forEach(fn => { try { fn(); } catch (e) {} }); cleanup = [];
    document.body.classList.remove('menu');
    const h = location.hash || '#/';
    markActive();
    for (const [re, fn] of routes) { const m = h.match(re); if (m) { try { await fn(m); } catch (err) { console.error(err); view.innerHTML = `<div class="empty"><h2 style="justify-content:center">Something broke</h2><p class="mono">${esc(err.message)}</p></div>`; } window.scrollTo(0, 0); return; } }
    view.innerHTML = `<div class="empty"><h2 style="justify-content:center">404</h2><a class="btn" href="#/">Home</a></div>`;
  }
  window.addEventListener('hashchange', route);
  $('#burger').onclick = () => document.body.classList.toggle('menu');
  $('#settings').onclick = settingsDialog;
  let st = null;
  $('#q').addEventListener('input', e => { clearTimeout(st); const q = e.target.value.trim(); st = setTimeout(() => { location.hash = q ? '#/s/' + encodeURIComponent(q) : '#/'; }, 250); });
  document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); $('#q').focus(); } });
  renderSide().then(route);
})();
