/* SlopGames game-file validator + kernel assembler.
   Shared by the platform (browser, window.SG) and tools/build.mjs (Node, via vm). No dependencies. */
(function (root) {
  'use strict';
  const KERNEL_RE = /\/\/#KERNEL-BEGIN[^\n]*\n[\s\S]*?\/\/#KERNEL-END[^\n]*/;
  const VERSION_RE = /\/\/#KERNEL-BEGIN\s+([0-9][\w.\-]*)/;

  function kernelVersion(html) { const m = VERSION_RE.exec(html); return m ? m[1] : null; }
  function hasKernelBlock(html) { return KERNEL_RE.test(html); }
  function kernelIsEmpty(html) { const m = KERNEL_RE.exec(html); return !m || m[0].split('\n').length <= 3; }
  // Replace the kernel block (empty placeholder or full) with the given kernel source (which carries its own markers).
  function assemble(html, kernelSrc) {
    if (!hasKernelBlock(html)) return html;
    const k = kernelSrc.trim();
    return html.replace(KERNEL_RE, () => k);
  }
  function stripKernel(html) { return html.replace(KERNEL_RE, '//#KERNEL-BEGIN ' + (kernelVersion(html) || '') + '\n//#KERNEL-END'); }
  function slug(s) { return String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'game'; }

  function manifestInfo(html) {
    const i = html.indexOf('const MANIFEST');
    if (i < 0) return {};
    const block = html.slice(i, i + 4000);
    const get = k => { const m = new RegExp('\\b' + k + "\\s*:\\s*['\"`]([^'\"`]+)['\"`]").exec(block); return m ? m[1] : undefined; };
    return { id: get('id'), title: get('title'), version: get('version'), theme: get('theme'), orientation: get('orientation'), genre: get('genre') };
  }

  // Returns { ok, errors[], warnings[], info{} }
  function validate(html) {
    const errors = [], warnings = [];
    const game = html.replace(KERNEL_RE, '');            // only judge the generated parts
    const info = manifestInfo(html);
    info.kernel = kernelVersion(html);
    info.sizeKB = Math.round((typeof Blob !== 'undefined' ? new Blob([html]).size : html.length) / 1024);
    info.gameKB = Math.round(game.length / 1024);
    info.scenes = (game.match(/K\.scenes\.add\(\s*['"`]([\w\-]+)/g) || []).map(s => s.replace(/.*['"`]/, ''));

    if (!/<!doctype html>/i.test(html)) warnings.push('Missing <!DOCTYPE html>.');
    if (!/const\s+MANIFEST\s*=/.test(game)) errors.push('No `const MANIFEST = {...}` found.');
    if (!info.id) errors.push('MANIFEST.id is missing.');
    if (!hasKernelBlock(html)) errors.push('Kernel markers //#KERNEL-BEGIN … //#KERNEL-END not found.');
    if (!/K\.boot\s*\(/.test(game)) errors.push('Game never calls K.boot(...).');
    if (info.scenes.length < 2) warnings.push('Fewer than 2 scenes — expected title → play → over loop.');
    if (!/gameplay\s*:\s*true/.test(game)) warnings.push('No scene declares `gameplay: true` (platform analytics & ads rely on it).');
    if (!/pausable\s*:\s*true/.test(game)) warnings.push('No pausable scene.');
    if (!/pauseButton\s*\(/.test(game)) warnings.push('No K.ui.pauseButton() — mobile players cannot pause.');

    const forbid = [
      [/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i, 'External src/href URL (games must be self-contained).'],
      [/url\(\s*['"]?\s*(?:https?:)?\/\//i, 'External url() in CSS.'],
      [/<script[^>]+\bsrc\s*=/i, 'External <script src> is not allowed.'],
      [/<link[^>]+\bhref\s*=/i, 'External <link> (fonts/styles) is not allowed.'],
      [/\bfetch\s*\(/, 'fetch() is not allowed (no network).'],
      [/XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon/, 'Network APIs are not allowed.'],
      [/\bimport\s*\(|^\s*import\s.+from\s/m, 'ES module imports are not allowed.'],
      [/document\.cookie/, 'Cookies are not allowed.'],
      [/window\.top|parent\.location|top\.location/, 'Touching the parent/top window is not allowed.'],
      [/<iframe/i, 'Nested iframes are not allowed.'],
    ];
    for (const [re, msg] of forbid) if (re.test(game)) errors.push(msg);
    const warn = [
      [/localStorage|sessionStorage|indexedDB/, 'Direct storage access — use K.store / K.save (games run in an opaque-origin sandbox).'],
      [/\beval\s*\(|new\s+Function\s*\(/, 'eval/new Function used.'],
      [/\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(/, 'Blocking alert/confirm/prompt — use K.ui.dialog.'],
      [/document\.createElement\(\s*['"](?:button|input|div)/, 'Creates DOM UI — use K.ui widgets instead.'],
      [/requestAnimationFrame\s*\(/, 'Own requestAnimationFrame loop — the kernel already runs the loop.'],
    ];
    for (const [re, msg] of warn) if (re.test(game)) warnings.push(msg);
    // Sim purity heuristic: Math.random inside an object/section named Sim
    const simIdx = game.search(/const\s+Sim\s*=|class\s+Sim\b/);
    if (simIdx >= 0) { const simBlock = game.slice(simIdx, simIdx + 20000).split(/\n\/\*\s*-{3,}|\nK\.scenes\.add/)[0]; if (/Math\.random/.test(simBlock)) warnings.push('Math.random inside Sim — use state.rng for deterministic simulation.'); }
    if (info.sizeKB > 5000) errors.push('File is over 5 MB.'); else if (info.sizeKB > 1500) warnings.push('File is over 1.5 MB.');
    return { ok: errors.length === 0, errors, warnings, info };
  }

  const api = { KERNEL_RE, kernelVersion, hasKernelBlock, kernelIsEmpty, assemble, stripKernel, manifestInfo, validate, slug };
  root.SG = Object.assign(root.SG || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
