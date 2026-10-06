#!/usr/bin/env python3
"""SlopGames playtest harness: boot a game in headless Chromium, drive it with a bot, take screenshots.

  python3 tools/playtest.py <id> [--view phone|desktop|tablet] [--seconds 40] [--bot path.js]
                                 [--out DIR] [--every 5] [--url-args "card"]

The bot file is plain JS that defines   window.__bot = function (K, api, t) { ... }
It is called every 50 ms (real time). t = seconds since the bot started. `api`:
  api.tap(x, y)            press+release at LOGICAL coords (the game's K.view space, e.g. 720x1280)
  api.down(x, y) / api.move(x, y) / api.up()   pointer hold / drag / release
  api.key(code, 'down'|'up'|'press')            e.g. api.key('Space','press'), api.key('ArrowLeft','down')
  api.shot(name)           request a screenshot right now (saved as <out>/<name>.png)
  api.log(msg)             message shown in the report
  api.stop()               end the run early
Scene changes, kernel errors, page errors, fps and the bot's logs are reported as JSON at the end.
Default output dir: /tmp/playtest/<id>-<view>. Screenshots: 00-title.png, then every --every seconds.
Note: fps numbers are unreliable when several browsers run at once on this 2-CPU box.
"""
import asyncio, json, sys, threading, functools, http.server, socketserver, pathlib, argparse, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIEWS = {
    "phone": ({"width": 390, "height": 844}, True, 2),
    "phone-land": ({"width": 844, "height": 390}, True, 2),
    "tablet": ({"width": 820, "height": 1180}, True, 2),
    "desktop": ({"width": 1366, "height": 768}, False, 1),
}

API_JS = r"""
(() => {
  const c = () => document.querySelector('canvas');
  const toC = (x, y) => ({ clientX: (x + K.view.ox) * K.view.scale, clientY: (y + K.view.oy) * K.view.scale });
  let held = false, lx = 0, ly = 0, pid = 7;
  const fire = (type, x, y) => { const q = toC(x, y); c().dispatchEvent(new PointerEvent(type, Object.assign({ pointerId: pid, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }, q))); };
  window.__api = {
    shots: [], logs: [], stopped: false, queue: [],
    down(x, y) { if (held) this.up(); held = true; lx = x; ly = y; fire('pointerdown', x, y); },
    move(x, y) { lx = x; ly = y; if (held) fire('pointermove', x, y); },
    up() { if (!held) return; held = false; fire('pointerup', lx, ly); },
    tap(x, y) { this.down(x, y); this.queue.push(() => this.up()); },
    key(code, mode = 'press') {
      if (mode !== 'up') window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
      if (mode === 'up') window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
      if (mode === 'press') this.queue.push(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })));
    },
    shot(name) { this.shots.push(name); },
    log(m) { this.logs.push((performance.now() / 1000).toFixed(1) + 's ' + m); },
    stop() { this.stopped = true; },
  };
})();
"""

def serve(port):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

async def run(a):
    from playwright.async_api import async_playwright
    vp, touch, dpr = VIEWS[a.view]
    out = pathlib.Path(a.out or f"/tmp/playtest/{a.id}-{a.view}")
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.png"): f.unlink()
    httpd = None
    for port in range(8810, 8900):
        try: httpd = serve(port); break
        except OSError: continue
    report = {"id": a.id, "view": a.view, "errors": [], "scenes": [], "logs": [], "shots": [], "fps": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport=vp, has_touch=touch, device_scale_factor=dpr)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: report["errors"].append("pageerror: " + str(e).splitlines()[0][:300]))
        page.on("console", lambda m: m.type == "error" and report["errors"].append("console: " + m.text[:300]))
        q = ("?" + a.url_args) if a.url_args else ""
        await page.goto(f"http://127.0.0.1:{port}/games/{a.id}/index.html{q}")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(out / "00-title.png")); report["shots"].append("00-title.png")
        await page.evaluate(API_JS)
        if a.bot:
            await page.evaluate("(() => {\n" + pathlib.Path(a.bot).read_text() + "\n})(); 0")
        t0 = time.time(); last_shot = t0; n = 1; last_scene = None
        while time.time() - t0 < a.seconds:
            st = await page.evaluate("""(t) => { const A = window.__api; const q = A.queue.splice(0); q.forEach(f => f());
                try { if (window.__bot && !A.stopped) window.__bot(K, A, t); } catch (e) { A.logs.push('BOT ERROR ' + e.message); }
                const s = A.shots.splice(0), l = A.logs.splice(0);
                return { scene: K.scenes.name, fps: K.debug.fps, errors: K.errors.slice(0, 5).map(String), shots: s, logs: l, stopped: A.stopped }; }""", time.time() - t0)
            if st["scene"] != last_scene:
                report["scenes"].append(f"{time.time() - t0:.1f}s {st['scene']}"); last_scene = st["scene"]
            report["logs"] += st["logs"]; report["fps"].append(st["fps"])
            for e in st["errors"]:
                if e not in report["errors"]: report["errors"].append(e)
            for name in st["shots"]:
                fn = f"{n:02d}-{name}.png"; n += 1
                await page.screenshot(path=str(out / fn)); report["shots"].append(fn)
            if time.time() - last_shot >= a.every:
                fn = f"{n:02d}-t{int(time.time() - t0)}.png"; n += 1; last_shot = time.time()
                await page.screenshot(path=str(out / fn)); report["shots"].append(fn)
            if st["stopped"]: break
            await page.wait_for_timeout(50)
        fps = [f for f in report["fps"] if f]
        report["fps"] = {"min": round(min(fps)) if fps else 0, "avg": round(sum(fps) / len(fps)) if fps else 0}
        await browser.close()
    httpd.shutdown()
    report["out"] = str(out)
    print(json.dumps(report, indent=1))
    return 1 if report["errors"] else 0

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("id"); ap.add_argument("--view", default="phone", choices=list(VIEWS))
    ap.add_argument("--seconds", type=float, default=40); ap.add_argument("--bot")
    ap.add_argument("--out"); ap.add_argument("--every", type=float, default=5)
    ap.add_argument("--url-args", default="")
    sys.exit(asyncio.run(run(ap.parse_args())))
