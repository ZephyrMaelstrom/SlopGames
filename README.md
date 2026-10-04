# SlopGames

A CrazyGames-style web game portal whose catalog — and consumer creation tool — runs on AI-generated, single-file HTML5 games built on one shared **kernel**.

**Live:** https://zephyrmaelstrom.github.io/SlopGames/ (GitHub Pages, main branch)

## What's here

| Path | What it is |
|---|---|
| `index.html`, `platform/` | The platform: catalog, game pages with ad wrappers, **Kernel Lab**, **Create** flow. Static, no build step. |
| `kernel/kernel-<version>.js` | The game kernel, versioned. Source of truth — game files carry an inlined copy. |
| `kernel/versions.json` | Kernel version index (`latest`, notes, status). |
| `kernel/KERNEL_GUIDE.md` | The game contract + API reference. Also embedded in every generation prompt. |
| `games/registry.json` | **The game database**: one entry per published game. |
| `games/<id>/index.html` | A release-ready single-file game (kernel inlined). `thumb.jpg` beside it. |
| `lab/tests.html` | Kernel unit tests (`?k=1.1.0`), also shown inside the Lab. |
| `tools/build.mjs` | Re-inline kernels into games, validate, sync the registry. |
| `tools/qa.py` | Headless smoke test of every game + thumbnail refresh. |

## Architecture

- **Container platform** (this site) handles discovery, game pages, ad slots, the AI creation flow and (later) accounts and the credit ledger.
- **Sandboxed games** run in `<iframe sandbox="allow-scripts allow-pointer-lock">` — deliberately **without** `allow-same-origin`, so every game gets an opaque origin and can't read platform storage, cookies or other games' saves, even on the same domain. Before third-party creators go live, also serve games from a separate asset domain with per-game subdomains.
- **Bridge:** games talk to the platform only through `postMessage` (kernel SDK protocol v1: `ready/hello`, `save`, `score`, `gameplayStart/Stop`, `adBreak` request/reply, `error`, `snapshot`, `pause/resume/mute`). Because games can't keep their own storage, saves live on the platform and are handed back in `hello`. See `platform/host.js`.
- **Single-file games:** `MANIFEST` script → kernel block between `//#KERNEL-BEGIN <v>` and `//#KERNEL-END` → game script. AI output leaves the kernel block empty; the platform or `tools/build.mjs` injects the kernel.

## Workflows

**Run locally**
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

**Make a game with AI:** open **Create** → choose genre, controls, camera, session, meta, monetization, theme, music → copy the prompt into Claude → paste the HTML back → *Save draft & test* opens it in the **Lab** (device presets, kernel override, ad simulation, SDK log, saves, unit tests) → **Publish** commits it here (needs a fine-grained GitHub token with Contents read/write, set in Settings).

**Add or update a game by hand**
```bash
# put games/<id>/index.html in place (kernel block may be empty), add an entry to games/registry.json, then:
node tools/build.mjs <id>          # inline the pinned kernel + validate
python3 tools/qa.py <id>           # headless smoke test + thumbnail
```

**Ship a new kernel version**
1. Copy `kernel/kernel-1.1.0.js` → `kernel/kernel-1.2.0.js`, bump the version in both marker lines and `KERNEL_VERSION`, make changes.
2. Add it to `kernel/versions.json` (set `latest` when ready). Update `KERNEL_GUIDE.md`.
3. Run unit tests: open `lab/tests.html?k=1.2.0` (or the Lab's *Unit tests* tab). Add tests for new modules.
4. Try existing games against it in the Lab (Kernel → v1.2.0) before migrating: `node tools/build.mjs --upgrade` moves every game to `latest`.

## Kernel 1.1 coverage

Fixed-step deterministic sim loop · seeded RNG + value noise · camera (follow, bounds, zoom, parallax) · collision (circles, rects, segments, rays, polygons) · spatial hash · circle physics with statics, joints, sensors, contacts and trajectory prediction · tilemaps with platformer collision, one-way tiles and DDA raycasts · grids with match finding, collapse, flood fill, rotation · A*, flow fields, line of sight · FSM · tweens and springs · particles, rings, floating text, shake, flash, hitstop · procedural SFX + step-sequencer music · UI widgets (buttons, toggles, sliders, tabs, momentum scroll lists, dialogs, toasts) · save migrations · meta-progression (wallet, upgrades, levels/stars, unlocks, daily rewards) · keyboard, pointer, multitouch, gamepad, typed text, per-scene touch overlays · 7 art-direction themes · sprite cache + adaptive resolution · crash screen + error reporting · ads, scores, snapshots via the platform SDK.
