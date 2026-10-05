# SlopGames Kernel 1.1 — Game Contract & API

A game is ONE `index.html` with three `<script>` blocks: **§1 MANIFEST**, **§2 KERNEL** (injected by the platform between `//#KERNEL-BEGIN` / `//#KERNEL-END` — never write or edit it), **§3 GAME**. The kernel creates its own full-screen `<canvas>`, CSS, loop, input, audio and UI; the game only defines a MANIFEST, scenes, and calls `K.boot('title')`.

## Hard rules
1. No external anything: no `src`/`href` URLs, `fetch`, fonts, CDNs, images, `<link>`, iframes, modules. Art = `K.draw.*` + Canvas2D paths; sound = `K.audio` / `K.music`.
2. **Sim is pure.** Game rules live in a `Sim` object: `Sim.create(seed, …) → state`, `Sim.step(state, dt, cmd)`. Inside Sim: no `K.draw`, `K.audio`, `K.fx`, `K.ui`, DOM, `Date`, or `Math.random` — use `state.rng = K.rng(seed)`. Sim reports what happened by pushing to `state.events`.
3. **Presentation never mutates sim state.** Scenes read input → build `cmd` → `Sim.step` → drain `state.events` into fx/sfx/haptics.
4. UI only through `K.ui.*` widgets (no DOM, no `alert`). Storage only through `K.store` / `K.save` (games run in an opaque-origin sandbox; the platform persists saves).
5. Moving things keep `px, py` (previous position, set at the start of each step); draw at `K.M.lerp(px, x, alpha)`.
6. HUD respects `K.view.safe` (notches). Logical coordinates: the design short axis is guaranteed (720 for portrait 720×1280); the long axis expands. Use `K.view.w/h`, never pixel sizes.
7. Flow: title → play → game over (score count-up, best, retry in ≤1 tap). Gameplay scenes set `gameplay: true, pausable: true`, add `K.ui.pauseButton()` and define `onQuit()`.

## MANIFEST
```js
const MANIFEST = {
  id: 'my-game', title: 'My Game', version: '1.0.0',
  genre: 'arcade',                  // platform genre id from the prompt — keep it as given
  theme: 'candy',                    // candy | neon | pastel | jungle | ocean | retro | ink
  orientation: 'portrait',           // portrait | landscape | any  (shows a rotate prompt on phones if wrong)
  design: { w: 720, h: 1280, maxW: 900 },   // landscape: { w: 1280, h: 720, maxH: 900 }
  touch: { stick: false, buttons: [] },     // default on-screen controls; scenes can override with scene.touch
  keys: { /* optional extra bindings: action: ['Space','Enter','PadA'] */ },
};
```
Default actions: `up down left right` (arrows/WASD/d-pad), `action` (Space/Enter/PadA), `alt` (Shift/X/PadB), `pause` (Esc/P/Start).

## Scenes
```js
K.scenes.add('play', {
  gameplay: true, pausable: true,          // analytics, ads and the pause menu rely on these
  music: 'upbeat',                         // song name, null = stop, omit = keep current
  touch: { stick: true, buttons: [{ action: 'action', icon: 'arrowU', color: 'green' }] }, // null = none
  enter(params) {}, exit() {}, layout(view) {}, onQuit() { K.scenes.go('title'); }, onPause() {}, onResume() {},
  update(dt) {},            // fixed 60 Hz: build cmd, Sim.step, drain events
  frame(dt) {},             // per-frame cosmetic (optional)
  backdrop(ctx, alpha) {},  // screen-space background (fills gutters; use K.draw.sky, K.camera.parallax)
  render(ctx, alpha) {},    // world layer: camera transform + shake applied; K.fx world particles drawn after
  hud(ctx, alpha) {},       // screen layer (stable): score, bars, prompts
});
K.scenes.go('over', { score }, { instant: false });  // fades; widgets/fx/camera/input reset on swap
```

## Canonical pattern (copy this shape)
```js
const Sim = {
  create(seed, W, H) { return { rng: K.rng(seed), t: 0, score: 0, over: false, events: [], player: { x: W / 2, y: H - 200, px: W / 2, py: H - 200 }, foes: [] }; },
  step(s, dt, cmd) {
    if (s.over) return;
    s.t += dt;
    const p = s.player; p.px = p.x; p.py = p.y;
    p.x += cmd.mx * 600 * dt;
    if (s.rng.chance(dt * 2)) s.foes.push({ x: s.rng.range(40, 680), y: -40, px: 0, py: -40, r: 30 });
    for (const f of s.foes) { f.px = f.x; f.py = f.y; f.y += 300 * dt; if (K.col.circleCircle(f.x, f.y, f.r, p.x, p.y, 34)) { s.over = true; s.events.push({ type: 'dead', x: p.x, y: p.y }); } }
    K.compact(s.foes, f => f.y < 1400);
  },
};
K.scenes.add('play', {
  gameplay: true, pausable: true, music: 'upbeat',
  enter() { this.s = Sim.create((Math.random() * 1e9) | 0, K.view.w, K.view.h); K.ui.pauseButton(); },
  onQuit() { K.scenes.go('title'); },
  update(dt) {
    Sim.step(this.s, dt, { mx: K.input.axisX() });
    for (const e of this.s.events) if (e.type === 'dead') { K.fx.shake(20, 0.4); K.audio.play('explode'); K.scenes.go('over', { score: this.s.score }); }
    this.s.events.length = 0;
  },
  backdrop() { K.draw.sky(); },
  render(ctx, a) { const p = this.s.player; K.draw.critter(K.M.lerp(p.px, p.x, a), K.M.lerp(p.py, p.y, a), 34, 'green'); for (const f of this.s.foes) K.draw.blobS(f.x, K.M.lerp(f.py, f.y, a), f.r, 'red'); },
  hud() { K.draw.text(this.s.score, K.view.w / 2, 120 + K.view.safe.top, { size: 80 }); },
});
K.boot('title');
```

## Core
- `K.M`: `clamp lerp invLerp remap smoothstep dist dist2 len norm dot cross rotate angle angleDiff approach damp(a,b,λ,dt) wrap sign TAU`
- `K.rng(seed)` → `r()` plus `r.range(a,b) r.int(a,b) r.pick(arr) r.chance(p) r.sign() r.shuffle(arr) r.weighted(items, it => it.w)`. `K.hashSeed(str)`, `K.dailySeed()` (same seed for everyone today).
- `K.noise(seed)` → `{ n1(x), n2(x,y), fbm1(x,oct), fbm2(x,y,oct) }` in −1..1 (terrain, clouds, wobble).
- `K.color`: `mix(a,b,t) shade(hex,±amt) alpha(hex,a) pal(hex)→[light,base,dark] hsl(h,s,l)`.
- `K.fmt(n)` → `1.25K / 3.4M`; `K.fmtTime(sec)` → `1:05`; `K.compact(arr, keep)` in-place filter; `K.clone(obj)`.
- `K.fsm({ idle: { enter(){}, update(dt, t){}, exit(){} }, … }, 'idle', self)` → `.go(state) .update(dt) .is(state) .state .t`.
- `K.tween(obj, { x: 10, s: 1 }, dur, K.Ease.outBack, delay).then(fn)`; `K.tween.killOf(obj)`; `await K.wait(sec)`; `K.spring(s={v,vel}, target, dt, k, damping)`. Easings: `linear inQuad outQuad inOutQuad inCubic outCubic inOutCubic outQuart inBack outBack outElastic outBounce pingPong`.
- `K.time` (seconds, pauses with game), `K.view { w, h, fullW, fullH, ox, oy, safe{top,right,bottom,left}, portrait }`.

## Input
- `K.input.down(a) / pressed(a) / released(a)` for actions; `axisX() axisY()` (keys + stick + gamepad), `move()` → normalized `{x,y}`; `aim(fromX, fromY)` → `{x,y,active}` (right stick or pointer, world space).
- `K.input.pointer`: `x y` (screen) `wx wy` (world), `down pressed released tap dragging startX startY dx dy vx vy holdTime`. `pressed`/`released`/`tap` are true for exactly one sim step.
- `K.input.pointers` (Map of all active touches: multitouch), `K.input.typed` (chars typed this step; `'\b'` backspace, `'\n'` enter), `K.input.wheel`, `K.input.pad { connected, x, y, ax, ay }`, `K.input.touch` (true on touch devices).
- Touch overlay: `scene.touch = { stick: true, buttons: [{ action: 'action', icon: 'bolt', label: 'A', color: 'purple' }] }` (shown only on touch devices in gameplay scenes; left half = floating stick).

## Camera
`K.camera.follow(target, { lerp: 8, offX, offY, deadW, deadH, snap: true })`, `.setBounds(x, y, w, h)`, `.moveTo(x, y)`, `.zoom`, `.rot`, `.snap()`, `.toWorld(sx, sy)`, `.toScreen(wx, wy)`, `.rect {x0,y0,x1,y1}` (visible world, for culling/spawning), `.parallax(ctx, factor, c => draw)` inside `backdrop`. Default (auto) camera: world units = screen units. Reset on every scene change.

## Collision — `K.col`
Booleans: `pointInRect pointInCircle circleCircle rectRect circleRect pointInPoly(px,py,flatPts)`. Contacts `{nx, ny, depth}` (normal pushes the first shape out): `circleCircleHit circleRectHit rectRectHit circleSegHit`. Rays (return t ≥ 0 or null): `rayCircle raySeg rayRect`; `segSeg` → point; `closestOnSeg`; `reflect(vx,vy,nx,ny,e)`. Rects are top-left `x,y,w,h`.
`new K.SpatialHash(cell)`: `clear() insert(obj, x, y, r) query(x, y, r, out) queryRect(x0,y0,x1,y1,out)` — rebuild each step for hundreds of objects.

## Physics — `new K.Physics({ gravity: [0, 1400], iterations: 4, bounds: {x,y,w,h} })`
Deterministic circle dynamics (auto sub-stepping, no tunneling). `addCircle({ x, y, r, vx, vy, mass, restitution, friction, isStatic, sensor, gravityScale, damping, data })`, `addBox(x, y, w, h, opts)` / `addSegment(ax, ay, bx, by, { oneWay })` / `addPolyline(flatPts, opts, closed)` (statics; you may move them each step for kinematic platforms/flippers), `addJoint(a, bOrPoint, { len, stiffness, rope })`, `remove(obj)`, `step(dt)`, `contacts` (this step: `{a, b, nx, ny, impulse, sensor}`), `predict(x, y, vx, vy, steps, dt, r, withStatics)` → flat points for aim dots. Use `data` to tag bodies.

## Tilemap — `new K.Tilemap({ rows: ['#...', …], size: 64, legend: { '#': { solid: true, color: 'purple' }, '-': { oneWay: true }, 'o': { coin: true }, '^': { hazard: true } }, edge: 'solid'|'open' })`
`get/set(tx, ty)`, `info(ch)`, `solid(tx, ty)`, `find(ch)` → spawn points, `tileAt(x, y)`, `pw ph`. `move(body, dt)` with `body = { x, y (center), w, h, vx, vy, dropThrough }` → sets `onGround onCeil onWall` and returns touched non-solid legend tiles `[{ ch, tx, ty, info }]`. `raycast(x, y, dx, dy, max)`. `draw(ctx, drawTile?)` culls to the camera; `defaultTile(ch, x, y, size, tx, ty)` draws chunky ground/one-way tiles.

## Grid & pathfinding
`new K.Grid(w, h, fill | (x,y) => v)`: `get set swap in forEach map clone count neighbors(x,y,diag) flood(x,y,match) matches(minRun, keyFn) → { runs, cells:Set<index> } collapse(empty) → moves rotate(cw) transpose`.
`K.path.astar(w, h, passable(x,y) → bool|cost, sx, sy, gx, gy, { diag })` → `[[x,y],…]|null`; `K.path.flowfield(w, h, passable, goals)` → `{ at(x,y), next(x,y) → [dx,dy] }` (swarms, tower defense); `K.path.los(x0,y0,x1,y1,passable)`. `new K.Heap(scoreFn)`.

## Drawing — `K.draw` (use these for a consistent, outlined, glossy mobile look)
`text(str, x, y, { size, color, align, maxW, stroke:false, sw, shadow:false })` outlined display text · `label(str, x, y, opts)` plain ink text for paper surfaces · `paragraph(str, x, y, maxW, opts)` · `wrap(str, maxW, size)` · `measure(str, size)`
Shapes: `blob(x, y, r, pal)` glossy ball · `critter(x, y, r, pal, { mood: 'happy'|'sad'|'angry'|'dead'|'blink', look: {x,y} })` character with eyes · `block(x, y, w, h, pal, { r, depth })` 3D tile/brick · `capsule` · `star(x, y, R, color)` · `poly(flatPts, fill)` · `line(flatPts, color, width)` outlined stroke · `arrow(x0,y0,x1,y1,color,w)` · `dots(flatPts, color, r)` trajectory · `glow(x, y, r, color, a)` · `hearts(x, y, n, max, size)`.
UI surfaces: `panel(x, y, w, h, { title, color })` centered dialog card · `card(x, y, w, h, { selected })` top-left list card · `bar(x, y, w, h, 0..1, pal)` · `pill(x, y, str, { icon, size, minW })` counters · `sky(top?, bottom?)` · `vignette(s)`.
`icon(name, x, y, size, color)`: `pause play sound mute music home retry video star close check heart lock gear cart trophy bolt gem skull coin plus arrowL arrowR arrowU arrowD`.
`pal` = a theme color name (`'green' 'blue' 'yellow' 'red' 'purple' 'orange' 'pink' 'gray'`), a `[light, base, dark]` array, or a hex.
Performance: `blobS(x, y, r, pal, { mood, rot, alpha })` is a cached sprite — use it for anything drawn 50+ times per frame. Custom caching: `const s = K.draw.sprite(key, w, h, ctx => { …draw with K.draw… })` then `K.draw.drawSprite(s, x, y, { rot, scale, alpha, ax, ay })`.
Theme: `K.THEME { ink, paper, paperText, bg, sky:[top,bottom], colors{…}, glow, font, name }`, `K.setTheme(name)`, `K.THEMES`.

## Juice — `K.fx` (cosmetic only, never affects the sim)
`burst(x, y, { count, colors, speed:[a,b], size:[a,b], life, gravity, shape:'circle'|'square'|'star'|'spark', spread, angle, screen })`, `puff(x, y)` dust, `trail(x, y, { color })`, `ring(x, y, { r0, r1, color, width })`, `text(x, y, '+10', { size, color, rise, screen })`, `shake(amp, dur)`, `flash(color, a)`, `hitstop(sec)`. Particles are in world space unless `screen: true`. `K.haptic('light'|'medium'|'heavy'|'success'|'fail')`.

## Audio
`K.audio.play(name, pitch?)`: `click pop coin jump land shoot laser whoosh hit hurt explode bounce swap error power levelup tick win lose`. `K.audio.define(name, () => K.audio.tone({ wave, f0, f1, dur, vol, noise, filter, hp, delay }))`.
Music: `K.music.play('upbeat'|'chill'|'tense'|'retro'|'victory')`, `K.music.stop()`, or `scene.music`. Custom: `K.music.define('boss', { bpm: 140, loop: true, tracks: [{ inst: 'kick'|'snare'|'hat'|'bass'|'lead'|'pluck'|'bell'|'pad', p: 'C3 - . E3 . . G3 .', v: 0.8 }] })` — one token per 16th note, `.` rest, `-` hold, `x` drum hit. Settings: `audio.setMuted setMusicOn setMusicVol setSfxVol`.

## UI — `K.ui` (retained widgets; positions are centers; `place: v => ({ x, y })` re-runs every frame)
`button({ label, icon, color, w, h, onTap, place, pulse, key: 'action', badge, locked, sub, popIn: delay, iconFn, labelFn, offFn })`, `toggle({ value, label, onChange })`, `slider({ value, label, onChange, onEnd, step })`, `tabs({ items, value, onChange })`, `list({ items, itemH, cols, gap, drawItem(ctx, item, i, x, y, w, h, pressed), onItem(item, i) })` (scrolling, momentum, wheel), `soundButton() musicButton() pauseButton()`, `remove(widget)`. Set `widget.visible/enabled` to show/hide.
`await K.ui.dialog({ title, text, icon, color, buttons: [{ label, icon, color }], dismiss, vertical, extraH, draw(ctx, x, y) })` → index (or −1) — pauses the sim while open. `K.ui.toast(text, { icon })`.

## Save & meta-progression
`K.store.get(key, def) / set(key, val)` for small values (best score). Structured save: `const SAVE = K.save.define({ version: 2, defaults: { … }, migrate: { 2: d => { …; return d; } } })` → live object; mutate then `K.save.commit()` (or `K.save.later()`); `K.save.reset()`.
`K.meta.wallet.get/add/can/spend(currency, n)` · `K.meta.upgrades.define({ id: { max, base, growth, currency, value: lvl => … } })` → `level cost value buy isMax` · `K.meta.levels.complete(i, stars, score) stars best done unlocked totalStars` · `K.meta.unlocks.has grant select selected` · `K.meta.daily.status() → { available, streak }`, `.claim()`.

## Platform
`await K.adBreak('midgame' | 'rewarded')` → `{ shown, granted }` (kernel pauses + mutes around it; never call mid-action). `K.sdk.send('score', { value })` on game over; `K.sdk.track(name, data)` for analytics. Errors are caught, reported to the platform and shown as a restart screen. Press backtick or add `?debug` for the debug overlay.

## Genre → kernel map
| Genre | Systems |
|---|---|
| Arcade / score attack | Sim arrays + `K.col`, `state.rng` waves, heavy `K.fx` |
| Runner / hyper-casual | `K.camera.moveTo` auto-scroll, `K.noise` terrain, `camera.parallax` |
| Platformer | `K.Tilemap.move`, legend tiles, `camera.follow + setBounds`, `scene.touch` stick + jump |
| Shooter / survivors | `input.move/aim`, `K.SpatialHash`, `K.fsm` enemies, `blobS` sprites, `ui.dialog` level-ups |
| Physics / pinball / golf / merge | `K.Physics` statics, joints, sensors, `contacts`, `predict` + `draw.dots` |
| Match-3 / grid puzzles | `K.Grid.matches/collapse/rotate/flood`, sim timers for cascades, per-id tween offsets |
| Tower defense / swarms | `K.path.flowfield`, `K.SpatialHash`, `ui.tabs/list` build menus |
| Dungeon / tactics | `K.Grid` + `state.rng` generation, `K.path.astar`, `K.path.los` |
| Racing | `K.col.circleSegHit` track walls, waypoints + `K.fsm` AI, camera follow (+rot) |
| Rhythm | `K.music.define` + the same pattern data for note spawns |
| Idle / clicker | `K.meta.wallet/upgrades`, `K.fmt`, `ui.list` shop, `K.save` |
| Card / board / word | `K.fsm` turns, `rng.shuffle`, `draw.card/label`, `input.typed`, `ui.button` grids |
