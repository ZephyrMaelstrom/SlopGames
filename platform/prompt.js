/* SlopGames generation menu → generator prompt.
   Every option here maps to kernel systems; if you add an option, make sure the kernel covers it
   (and add a line to KERNEL_GUIDE.md's genre map). */
(function (root) {
  'use strict';
  const GENRES = [
    { id: 'arcade', label: 'Arcade score-attack', emoji: '🎯', orient: 'portrait', controls: ['tap'], camera: 'fixed', session: 'sprint',
      brief: 'Fixed-screen, spawn waves from state.rng, combo multiplier, escalating speed, 30–90 s rounds. K.col circle/rect tests, heavy K.fx juice.' },
    { id: 'runner', label: 'Endless runner', emoji: '🏃', orient: 'portrait', controls: ['swipe', 'tap'], camera: 'autoscroll', session: 'endless',
      brief: 'Auto-forward world built from chunks picked with state.rng (or K.noise terrain). Lanes or jump/slide. Speed ramps over time. Parallax backdrop with K.camera.parallax.' },
    { id: 'platformer', label: 'Platformer', emoji: '🍄', orient: 'landscape', controls: ['joystick+buttons', 'keyboard'], camera: 'follow', session: 'levels',
      brief: 'K.Tilemap levels authored as row strings + legend (solid, oneWay, coin, hazard, goal). tilemap.move(body, dt) for collision. Coyote time + jump buffer + variable jump height. K.camera.follow + setBounds. scene.touch = { stick: true, buttons: [{ action: "action", icon: "arrowU" }] }.' },
    { id: 'shooter', label: 'Twin-stick shooter', emoji: '🔫', orient: 'landscape', controls: ['joystick+buttons', 'keyboard'], camera: 'follow', session: 'runs',
      brief: 'K.input.move() for movement, K.input.aim(x, y) for aim (right stick or pointer). Bullets/enemies in arrays, K.SpatialHash for hit tests, enemy brains with K.fsm. Auto-fire on touch.' },
    { id: 'survivors', label: 'Survivors-like arena', emoji: '🧟', orient: 'portrait', controls: ['joystick'], camera: 'follow', session: 'runs',
      brief: 'Hundreds of enemies (draw with K.draw.blobS sprite cache), auto-attacking weapons, XP gems, level-up choice via K.ui.dialog with 3 upgrade buttons. K.SpatialHash every step.' },
    { id: 'physics', label: 'Physics launcher', emoji: '🪃', orient: 'landscape', controls: ['drag-aim'], camera: 'fixed', session: 'levels',
      brief: 'K.Physics: circles vs static boxes/segments/circles, joints (ropes, chains), sensors for goals. Drag-back-and-release aiming with K.draw.dots(world.predict(...)). Read world.contacts for scoring/FX.' },
    { id: 'pinball', label: 'Pinball / bumpers', emoji: '🎱', orient: 'portrait', controls: ['tap', 'keyboard'], camera: 'fixed', session: 'runs',
      brief: 'K.Physics with segment walls, bumpers (restitution > 1), sensors for lanes/targets. Flippers = segments you rotate each step (set ax/ay/bx/by) and add impulse to touching balls.' },
    { id: 'golf', label: 'Mini-golf / flick sports', emoji: '⛳', orient: 'portrait', controls: ['drag-aim'], camera: 'fixed', session: 'levels',
      brief: 'Drag-aim-release with power meter, K.Physics with higher friction/airDrag, holes/hoops as sensors, par/stroke scoring, levels as data + K.meta.levels stars.' },
    { id: 'match3', label: 'Match-3', emoji: '💎', orient: 'portrait', controls: ['swipe', 'tap'], camera: 'fixed', session: 'levels',
      brief: 'K.Grid with { k, id } cells, grid.matches(3, c => c && c.k), grid.collapse(null), refill from state.rng. Cascades driven by sim timers; presentation animates per-tile offsets keyed by id. Moves or timer limit, level goals.' },
    { id: 'puzzle', label: 'Grid puzzle', emoji: '🧩', orient: 'portrait', controls: ['swipe', 'tap'], camera: 'fixed', session: 'levels',
      brief: 'Sliding/2048/block-fit/lights-out style on K.Grid (rotate, transpose, flood). Levels as data arrays, undo stack in sim, K.meta.levels for stars and unlocks.' },
    { id: 'merge', label: 'Merge / drop-merge', emoji: '🍉', orient: 'portrait', controls: ['tap', 'drag'], camera: 'fixed', session: 'endless',
      brief: 'Either grid merges (K.Grid) or Suika-style drop-merge with K.Physics circles: on contact of two equal tiers, remove both and spawn the next tier. Danger line ends the run.' },
    { id: 'idle', label: 'Idle / clicker', emoji: '🍪', orient: 'portrait', controls: ['tap'], camera: 'fixed', session: 'idle',
      brief: 'Big numbers with K.fmt, K.meta.wallet + K.meta.upgrades cost curves, generators producing per second, offline earnings (compute from a saved timestamp in presentation, apply via sim command), K.ui.list shop with tabs, prestige reset.' },
    { id: 'td', label: 'Tower defense', emoji: '🏰', orient: 'portrait', controls: ['tap', 'drag'], camera: 'fixed', session: 'levels',
      brief: 'Grid map, enemies follow K.path.flowfield (or a fixed path polyline). Tap a cell → build menu (K.ui.dialog or bottom K.ui.tabs). Towers target via K.SpatialHash queries. Waves defined as data. Prevent fully blocking the path.' },
    { id: 'snake', label: 'Snake / .io-style', emoji: '🐍', orient: 'portrait', controls: ['joystick', 'swipe'], camera: 'follow', session: 'runs',
      brief: 'Free-steering snake with body trail, food pellets, growing, bots driven by K.fsm, K.SpatialHash for body collisions, large world with K.camera.follow + bounds, minimap in hud.' },
    { id: 'stack', label: 'Hyper-casual timing', emoji: '🧱', orient: 'portrait', controls: ['tap'], camera: 'autoscroll', session: 'endless',
      brief: 'One-tap timing (stacker, perfect-drop, knife-throw, color switch). Perfect-hit streaks with escalating pitch K.audio.play(name, pitch), camera rising with the stack.' },
    { id: 'rhythm', label: 'Rhythm / tap-timing', emoji: '🥁', orient: 'portrait', controls: ['tap', 'keyboard'], camera: 'fixed', session: 'runs',
      brief: 'Author a song with K.music.define(name, { bpm, tracks }) and spawn notes from the same pattern data so they line up with the beat. Lanes, judgement windows (perfect/good/miss), combo meter.' },
    { id: 'racing', label: 'Top-down racer', emoji: '🏎️', orient: 'portrait', controls: ['joystick', 'tap'], camera: 'follow', session: 'levels',
      brief: 'Car with heading/speed/drift, track as a closed polyline: walls via K.col.circleSegHit, checkpoints as segments, laps, AI cars following waypoints with K.fsm. K.camera.follow (optionally rot = heading).' },
    { id: 'brick', label: 'Brick breaker', emoji: '🧱', orient: 'portrait', controls: ['drag'], camera: 'fixed', session: 'levels',
      brief: 'Paddle follows pointer x, ball reflection with K.col.circleRectHit + K.col.reflect, bricks as K.draw.block with HP, power-ups falling. Levels as row strings.' },
    { id: 'card', label: 'Card / board (turn-based)', emoji: '🃏', orient: 'portrait', controls: ['tap', 'drag'], camera: 'fixed', session: 'runs',
      brief: 'Turn phases with K.fsm, deck/hand as arrays shuffled with state.rng.shuffle, cards drawn with K.draw.card + K.draw.label, motion via K.tween. Simple AI opponent. Results via K.ui.dialog.' },
    { id: 'word', label: 'Word / letters', emoji: '🔤', orient: 'portrait', controls: ['tap', 'keyboard'], camera: 'fixed', session: 'levels',
      brief: 'On-screen letter keys as K.ui.button grid + physical keyboard via K.input.typed. Keep any word list small and embedded (≤ 2,000 words). Daily puzzle via K.dailySeed().' },
    { id: 'dungeon', label: 'Roguelike dungeon', emoji: '🗝️', orient: 'portrait', controls: ['swipe', 'joystick', 'keyboard'], camera: 'follow', session: 'runs',
      brief: 'Turn-based grid: K.Grid map generated with state.rng (rooms + corridors), monsters path with K.path.astar, field of view with K.path.los, items/inventory, permadeath runs with meta unlocks.' },
    { id: 'fishing', label: 'Collect / catch', emoji: '🎣', orient: 'portrait', controls: ['tap', 'hold'], camera: 'follow', session: 'runs',
      brief: 'Timing/tension minigame to catch things, rarity tables via state.rng.weighted, collection book with K.meta.unlocks, sell for coins, rod/boat upgrades via K.meta.upgrades.' },
  ];
  const OPTS = {
    orientation: { label: 'Orientation', single: true, items: [
      { id: 'portrait', label: 'Portrait (phone-first)', design: '{ w: 720, h: 1280, maxW: 900 }' },
      { id: 'landscape', label: 'Landscape', design: '{ w: 1280, h: 720, maxH: 900 }' } ] },
    controls: { label: 'Controls', items: [
      { id: 'tap', label: 'Tap', brief: 'Tap: K.input.pointer.pressed / .tap with pointer.x/y (or .wx/.wy in world space).' },
      { id: 'swipe', label: 'Swipe', brief: 'Swipe: on pointer.down, once |pointer.dx| or |dy| passes ~40 units, fire one directional command per touch.' },
      { id: 'drag-aim', label: 'Drag-aim-release', brief: 'Drag-aim: pull back from the object, show K.draw.dots trajectory, launch on pointer.released && pointer.dragging.' },
      { id: 'drag', label: 'Drag / follow finger', brief: 'Drag: object follows pointer.x (or x/y) while pointer.down, with smoothing.' },
      { id: 'hold', label: 'Hold & release', brief: 'Hold: charge while pointer.down (pointer.holdTime), act on release.' },
      { id: 'joystick', label: 'Virtual joystick', brief: 'Joystick: scene.touch = { stick: true }; read K.input.move() (also WASD/arrows/gamepad).' },
      { id: 'joystick+buttons', label: 'Joystick + buttons', brief: 'Joystick + buttons: scene.touch = { stick: true, buttons: [{ action: "action", icon: "bolt" }, { action: "alt", icon: "star" }] }; read K.input.pressed("action").' },
      { id: 'keyboard', label: 'Keyboard-first', brief: 'Keyboard: arrows/WASD + Space/Enter/Shift via actions up/down/left/right/action/alt; still playable by touch.' } ] },
    camera: { label: 'Camera', single: true, items: [
      { id: 'fixed', label: 'Fixed screen', brief: 'Fixed screen: leave K.camera alone (auto mode, world = screen units). Lay out from K.view.w/h.' },
      { id: 'follow', label: 'Follow player', brief: 'Follow: K.camera.follow(player, { lerp: 8, deadW, deadH }) + K.camera.setBounds(world). Player needs px/py for smooth interpolation.' },
      { id: 'autoscroll', label: 'Auto-scroll', brief: 'Auto-scroll: move K.camera with K.camera.moveTo each frame at the run speed; spawn content ahead of camera.rect.' },
      { id: 'board', label: 'Pan / zoom board', brief: 'Pan/zoom: drag pans K.camera (moveTo), wheel/pinch adjusts K.camera.zoom with bounds.' } ] },
    session: { label: 'Session shape', single: true, items: [
      { id: 'sprint', label: '30–90 s sprint', brief: 'Short timed rounds with a big end-of-round score screen and instant retry.' },
      { id: 'runs', label: '1–5 min runs', brief: 'Runs that end on death/fail; difficulty ramps within the run.' },
      { id: 'levels', label: 'Levels (12+)', brief: 'At least 12 hand-designed levels stored as compact data, a level-select grid (K.ui.list cols 4) with stars from K.meta.levels, and unlocks.' },
      { id: 'endless', label: 'Endless + ramp', brief: 'Endless with a smooth difficulty ramp and best-score chasing.' },
      { id: 'idle', label: 'Idle / persistent', brief: 'Persistent progress across sessions with K.save, offline gains and frequent autosave.' } ] },
    meta: { label: 'Meta-progression', items: [
      { id: 'shop', label: 'Coins + upgrade shop', brief: 'Earn coins (K.meta.wallet), spend in an upgrade shop (K.meta.upgrades + K.ui.list) that changes gameplay numbers.' },
      { id: 'stars', label: 'Level map + stars', brief: '1–3 stars per level via K.meta.levels.complete; locked levels shown with the lock icon.' },
      { id: 'skins', label: 'Unlockable skins', brief: 'Cosmetic skins unlocked with coins or milestones (K.meta.unlocks + select/selected).' },
      { id: 'daily', label: 'Daily reward', brief: 'Daily reward dialog with streak (K.meta.daily).' },
      { id: 'achievements', label: 'Achievements', brief: 'A handful of achievements announced with K.ui.toast and stored in the save.' } ] },
    monetization: { label: 'Monetization hooks', items: [
      { id: 'continue', label: 'Rewarded continue', brief: 'Once per run, offer "Continue" via await K.adBreak("rewarded") on the game-over screen.' },
      { id: 'double', label: 'Rewarded 2× reward', brief: 'End-of-round "2× coins" button via rewarded ad.' },
      { id: 'interstitial', label: 'Interstitial every 3 rounds', brief: 'await K.adBreak("midgame") before every 3rd retry — never mid-action.' } ] },
    theme: { label: 'Art direction', single: true, items: ['candy', 'neon', 'pastel', 'jungle', 'ocean', 'retro', 'ink'].map(id => ({ id, label: id })) },
    music: { label: 'Music', single: true, items: [
      { id: 'upbeat', label: 'Upbeat' }, { id: 'chill', label: 'Chill' }, { id: 'tense', label: 'Tense' }, { id: 'retro', label: 'Retro' },
      { id: 'custom', label: 'Custom song', brief: 'Compose an original loop with K.music.define(...) that fits the theme.' }, { id: 'none', label: 'None' } ] },
    difficulty: { label: 'Difficulty curve', single: true, items: [
      { id: 'gentle', label: 'Gentle', brief: 'Gentle: forgiving hitboxes, slow ramp, generous continues.' },
      { id: 'standard', label: 'Standard', brief: 'Standard: easy first minute, then steady ramp.' },
      { id: 'brutal', label: 'Brutal', brief: 'Brutal: fast ramp, tight timing, high skill ceiling.' } ] },
  };
  const THEME_SWATCH = {
    candy: ['#4fc3ff', '#8a6cff', '#ff4b5c', '#ffc21a', '#2fbf4a'], neon: ['#1a0f3d', '#05030f', '#ff2e63', '#ffe600', '#22ff88'],
    pastel: ['#ffe1ec', '#d9e8ff', '#ff9eac', '#ffe08a', '#9be3ad'], jungle: ['#9be58e', '#2e8b57', '#e8573a', '#f2c230', '#6cc23a'],
    ocean: ['#5ee7ff', '#1b6ca8', '#ff5a5f', '#ffd23f', '#2ee6a6'], retro: ['#1a0033', '#000000', '#f83800', '#f8d800', '#00d800'],
    ink: ['#faf7f0', '#e6dfcf', '#e8402e', '#ffd84d', '#bdbdbd'],
  };
  function defaults(genreId) {
    const g = GENRES.find(x => x.id === genreId) || GENRES[0];
    return { genre: g.id, orientation: g.orient, controls: g.controls.slice(), camera: g.camera, session: g.session, meta: ['shop'], monetization: ['continue'], theme: 'candy', music: 'upbeat', difficulty: 'standard', title: '', pitch: '', extra: '' };
  }
  const pick = (k, id) => OPTS[k].items.find(i => i.id === id);
  function compose(sel, guide, kernelVersion) {
    const g = GENRES.find(x => x.id === sel.genre) || GENRES[0];
    const title = (sel.title || '').trim() || 'Untitled ' + g.label;
    const id = SG.slug(title);
    const orient = pick('orientation', sel.orientation) || OPTS.orientation.items[0];
    const lines = (k, arr) => arr.map(id => pick(k, id)).filter(Boolean).map(o => '- ' + (o.brief || o.label));
    const touch = sel.controls.includes('joystick+buttons') ? '{ stick: true, buttons: [{ action: \'action\', icon: \'bolt\' }] }' : sel.controls.includes('joystick') ? '{ stick: true, buttons: [] }' : '{ stick: false, buttons: [] }';
    return `You are an expert HTML5 game developer. Generate a complete, release-ready browser game for the SlopGames platform using the SlopGames Kernel ${kernelVersion}.

# OUTPUT FORMAT (strict)
Return exactly ONE complete HTML document and nothing else — no explanations, no markdown code fences.
Use this exact skeleton. Leave the kernel block EMPTY: the platform injects kernel ${kernelVersion} between the markers.

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${title}</title>
</head>
<body>
<script>
"use strict";
/* §1 MANIFEST */
const MANIFEST = {
  id: '${id}',
  title: '${title.replace(/'/g, "\\'")}',
  version: '1.0.0',
  genre: '${g.id}',
  theme: '${sel.theme}',
  orientation: '${orient.id}',
  design: ${orient.design},
  touch: ${touch},
};
</script>
<script>
//#KERNEL-BEGIN ${kernelVersion}
//#KERNEL-END
</script>
<script>
"use strict";
/* §3 GAME */
// 3a. Sim — pure, deterministic (state.rng), emits events
// 3b. Presentation — drawing helpers, juice
// 3c. Scenes — title → play → over (+ any menus) + 'card' (title-card key art), then:
K.boot('title');
</script>
</body>
</html>

# GAME BRIEF
- Title: ${title}
- Pitch: ${(sel.pitch || '').trim() || '(invent a fresh, specific hook that fits the genre — not a clone of an existing game)'}
- Genre: ${g.label}. ${g.brief}
- Orientation: ${orient.label} — design ${orient.design}.
- Camera: ${(pick('camera', sel.camera) || {}).brief || sel.camera}
- Session: ${(pick('session', sel.session) || {}).brief || sel.session}
- Difficulty: ${(pick('difficulty', sel.difficulty) || {}).brief || sel.difficulty}
- Art direction: kernel theme "${sel.theme}" (MANIFEST.theme). Use K.THEME colors and K.draw helpers so the look stays on-theme.
- Music: ${sel.music === 'none' ? 'none (sfx only).' : sel.music === 'custom' ? pick('music', 'custom').brief : `set scene.music = '${sel.music}' on gameplay scenes and a calmer track on menus.`}

## Controls
${lines('controls', sel.controls).join('\n') || '- Tap.'}
- Desktop keyboard and gamepad must also work (the kernel maps them to the same actions).

## Meta-progression
${lines('meta', sel.meta).join('\n') || '- None: pure score chasing with a saved best score (K.store).'}

## Monetization hooks
${lines('monetization', sel.monetization).join('\n') || '- None.'}
${(sel.extra || '').trim() ? '\n## Extra requirements\n' + sel.extra.trim() + '\n' : ''}
# QUALITY BAR (all required)
- Content depth: a real game, not a toy. Multiple enemy/obstacle/item types, a difficulty ramp, and at least 5 minutes of varied play before it repeats.
- Juice: every player action has an sfx AND a visual response; scoring shows K.fx.text + a counter bounce; hits/fails use K.fx.shake + flash (+ hitstop on big hits); menus pop in.
- Title card: a 'card' scene with full-bleed key art (hero mid-action, game elements, big logo, no buttons) as described in the kernel reference — the platform renders it as the game's thumbnail.
- Flow: title → play → game over with score count-up, best score, and instant retry (≤ 1 tap). Pause via K.ui.pauseButton(); onQuit returns to title.
- Mobile-first: thumb-reachable controls, HUD inside K.view.safe, readable at phone size.
- Performance: 60 fps on a mid phone; use K.draw.blobS / K.draw.sprite for anything drawn more than ~50 times per frame.
- No external URLs, fetch, DOM UI, alert(), localStorage, or own requestAnimationFrame loop.

# KERNEL REFERENCE
${guide}
`;
  }
  root.SGPrompt = { GENRES, OPTS, THEME_SWATCH, defaults, compose };
})(window);
