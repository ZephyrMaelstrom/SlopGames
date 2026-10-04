# SlopGames — notes for Claude sessions

Static site on GitHub Pages (main branch, repo root). No bundler, no npm dependencies.

## Layout
- `kernel/kernel-<v>.js` is the source of truth for the kernel. Never hand-edit the kernel copy inside `games/*/index.html`; edit the kernel file and run `node tools/build.mjs`.
- `games/registry.json` is the game database. Every `games/<id>/` needs an entry; `MANIFEST.id` must equal the folder name.
- `platform/validate.js` is shared by the browser and `tools/build.mjs` (loaded with `vm`). Keep it dependency-free and browser-safe.
- `kernel/KERNEL_GUIDE.md` is embedded verbatim in every generation prompt (`platform/prompt.js`). Keep it accurate and compact; when you add a kernel API, document it there and, if it serves a genre, in the genre map and in `prompt.js` GENRES briefs.

## Rules for game files
Three scripts: MANIFEST → `//#KERNEL-BEGIN <v>` … `//#KERNEL-END` → game. Sim must be pure (state.rng, no Math.random/Date/K.draw/K.audio inside Sim). UI only via `K.ui`, storage only via `K.store`/`K.save` (games run without allow-same-origin, so browser storage throws).

## Before committing
```bash
node tools/build.mjs            # must report 0 with errors
python3 tools/qa.py             # headless smoke test; needs playwright + chromium
# kernel changes: open lab/tests.html?k=<v> (or run it headless) — all tests must pass
```

## Kernel versioning
Additive changes can go into the current version during early development; anything that changes behaviour games rely on gets a new version file + `versions.json` entry. Old kernel files stay in the repo so the Lab can run any game against any version.
