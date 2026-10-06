/* SlopGames data layer.
   - Repo games: games/registry.json + games/<id>/index.html (the canonical database, versioned in git)
   - Drafts: IndexedDB in this browser (AI generations you're testing before publishing)
   - Kernels: kernel/versions.json + kernel/kernel-<v>.js
   - Publish: commits a draft into the repo through the GitHub Contents API with the user's own token. */
(function (root) {
  'use strict';
  const LS = root.SGHost.LS;
  const cache = {};
  async function getJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url + ' → ' + r.status); return r.json(); }
  async function getText(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url + ' → ' + r.status); return r.text(); }

  /* ---------- IndexedDB drafts ---------- */
  let dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const req = indexedDB.open('slopgames', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('drafts', { keyPath: 'id' });
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction('drafts', mode), st = t.objectStore('drafts'); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
  }

  const DB = {
    async registry(force) { if (!cache.reg || force) cache.reg = await getJSON('games/registry.json'); return cache.reg; },
    async versions() { if (!cache.ver) cache.ver = await getJSON('kernel/versions.json'); return cache.ver; },
    async kernel(v) { cache['k' + v] = cache['k' + v] || await getText(`kernel/kernel-${v}.js`); return cache['k' + v]; },
    async guide() { cache.guide = cache.guide || await getText('kernel/KERNEL_GUIDE.md'); return cache.guide; },

    drafts: {
      list: () => tx('readonly', st => st.getAll()).then(a => (a || []).sort((x, y) => y.updated - x.updated)),
      get: id => tx('readonly', st => st.get(id)),
      put: d => { d.updated = Date.now(); return tx('readwrite', st => st.put(d)); },
      del: id => tx('readwrite', st => st.delete(id)),
    },

    async all() {
      const reg = await DB.registry();
      let drafts = [];
      try { drafts = await DB.drafts.list(); } catch (e) {}
      return [
        ...drafts.map(d => Object.assign({ source: 'draft', status: 'draft', tags: d.tags || [], genre: d.genre || 'draft' }, d, { html: undefined })),
        ...reg.games.map(g => Object.assign({ source: 'repo' }, g)),
      ];
    },
    async find(id) {
      const d = await DB.drafts.get(id).catch(() => null);
      if (d) return Object.assign({ source: 'draft', status: 'draft' }, d);
      const reg = await DB.registry();
      const g = reg.games.find(x => x.id === id);
      return g ? Object.assign({ source: 'repo' }, g) : null;
    },
    async rawHTML(g) { return g.source === 'draft' ? (g.html || (await DB.drafts.get(g.id)).html) : getText(`games/${g.id}/index.html`); },
    // Returns HTML ready to run. kernelVer: null = keep pinned kernel (inject it if the block is empty).
    async playableHTML(g, kernelVer) {
      let html = await DB.rawHTML(g);
      const pinned = SG.kernelVersion(html), ver = await DB.versions();
      const want = kernelVer || (SG.kernelIsEmpty(html) ? (pinned && ver.versions.some(v => v.version === pinned) ? pinned : ver.latest) : null);
      if (want) html = SG.assemble(html.replace(/\/\/#KERNEL-BEGIN[^\n]*/, '//#KERNEL-BEGIN ' + want), await DB.kernel(want));
      return html;
    },

    /* ---------- GitHub publishing ---------- */
    gh: {
      get cfg() { return Object.assign({ repo: 'ZephyrMaelstrom/SlopGames', branch: 'main', token: '' }, LS.get('sg:gh', {})); },
      save(c) { LS.set('sg:gh', c); },
      async api(path, opts = {}) {
        const c = DB.gh.cfg;
        if (!c.token) throw new Error('Add a GitHub token in Settings first.');
        const r = await fetch(`https://api.github.com/repos/${c.repo}/${path}`, Object.assign({}, opts, {
          headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + c.token, 'X-GitHub-Api-Version': '2022-11-28' }, opts.headers || {}) }));
        if (!r.ok && r.status !== 404) { let m = r.status + ''; try { m += ' ' + (await r.json()).message; } catch (e) {} throw new Error('GitHub: ' + m); }
        return r.status === 404 ? null : r.json();
      },
      async putFile(path, base64, message) {
        const c = DB.gh.cfg;
        const cur = await DB.gh.api(`contents/${path}?ref=${encodeURIComponent(c.branch)}`);
        return DB.gh.api(`contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: base64, branch: c.branch, sha: cur && cur.sha }) });
      },
      async getJSONFile(path) {
        const c = DB.gh.cfg;
        const cur = await DB.gh.api(`contents/${path}?ref=${encodeURIComponent(c.branch)}`);
        if (!cur) return null;
        return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(cur.content.replace(/\n/g, '')), ch => ch.charCodeAt(0))));
      },
    },
    // Change a committed game's status (draft → live, live → lab …) with one registry commit.
    async setStatus(id, status, extra = {}, onStep = () => {}) {
      const b64 = str => { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
      onStep('Reading games/registry.json…');
      const reg = await DB.gh.getJSONFile('games/registry.json');
      const g = reg && reg.games.find(x => x.id === id);
      if (!g) throw new Error(id + ' is not in the repo registry');
      Object.assign(g, extra, { status });
      reg.updated = new Date().toISOString().slice(0, 10);
      onStep('Committing…');
      await DB.gh.putFile('games/registry.json', b64(JSON.stringify(reg, null, 2) + '\n'), `Registry: ${id} → ${status}`);
      cache.reg = null;
      onStep('Done. ' + g.title + ' is ' + status + '.');
      return reg;
    },
    // Publish a draft: game file (kernel inlined), thumbnail, registry entry. One commit per file (Contents API).
    async publish(draft, entry, onStep = () => {}) {
      const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
      const id = entry.id;
      onStep('Assembling game file…');
      const html = await DB.playableHTML(Object.assign({ source: 'draft' }, draft), null);
      const v = SG.validate(html);
      if (!v.ok) throw new Error('Validation failed: ' + v.errors[0]);
      onStep('Uploading games/' + id + '/index.html…');
      await DB.gh.putFile(`games/${id}/index.html`, b64(html), `Add game: ${entry.title}`);
      if (draft.thumb) { onStep('Uploading thumbnail…'); await DB.gh.putFile(`games/${id}/thumb.jpg`, draft.thumb.split(',')[1], `Thumbnail: ${entry.title}`); entry.thumb = `games/${id}/thumb.jpg`; }
      onStep('Updating games/registry.json…');
      const reg = (await DB.gh.getJSONFile('games/registry.json')) || { version: 1, games: [] };
      entry.kernel = SG.kernelVersion(html); entry.sizeKB = v.info.sizeKB;
      const i = reg.games.findIndex(g => g.id === id);
      if (i >= 0) reg.games[i] = Object.assign(reg.games[i], entry); else reg.games.push(entry);
      reg.updated = new Date().toISOString().slice(0, 10);
      await DB.gh.putFile('games/registry.json', b64(JSON.stringify(reg, null, 2) + '\n'), `Registry: ${i >= 0 ? 'update' : 'add'} ${id}`);
      onStep('Published.');
      return reg;
    },
  };
  root.SGDB = DB;
})(window);
