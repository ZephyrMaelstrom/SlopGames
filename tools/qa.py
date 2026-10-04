#!/usr/bin/env python3
"""SlopGames QA: smoke-test every game in headless Chromium and refresh thumbnails.

  python3 tools/qa.py                 # all games in games/registry.json
  python3 tools/qa.py pop-rush        # specific ids
  python3 tools/qa.py --no-thumbs     # skip writing games/<id>/thumb.jpg

For each game: loads it at phone + desktop sizes, waits for boot, taps around for a few seconds,
and fails on page errors, kernel-reported errors, crash overlays, or a frozen frame loop.
Requires: pip install playwright && playwright install chromium
"""
import asyncio, json, sys, threading, functools, http.server, socketserver, pathlib, random

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8799

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

async def check_game(browser, gid, thumbs):
    from playwright.async_api import Error
    results = []
    for name, vp, touch in [("phone", {"width": 390, "height": 844}, True), ("desktop", {"width": 1366, "height": 768}, False)]:
        ctx = await browser.new_context(viewport=vp, has_touch=touch, device_scale_factor=2 if touch else 1)
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(f"http://127.0.0.1:{PORT}/games/{gid}/index.html")
        await page.wait_for_timeout(1500)
        if thumbs and name == "phone":
            await page.set_viewport_size({"width": 600, "height": 800})
            await page.wait_for_timeout(400)
            await page.screenshot(path=str(ROOT / "games" / gid / "thumb.jpg"), type="jpeg", quality=82)
            await page.set_viewport_size(vp)
        t0 = await page.evaluate("K.time")
        rnd = random.Random(gid)
        for _ in range(40):
            x, y = rnd.uniform(0.1, 0.9) * vp["width"], rnd.uniform(0.15, 0.9) * vp["height"]
            await page.mouse.click(x, y)
            await page.wait_for_timeout(120)
        state = await page.evaluate("({ errors: K.errors.slice(0, 5), time: K.time, scene: K.scenes.name, fps: K.debug.fps })")
        if state["time"] <= t0:
            errs.append("frame loop did not advance")
        errs += state["errors"]
        results.append((name, state, errs))
        await ctx.close()
    return results

async def main():
    from playwright.async_api import async_playwright
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    thumbs = "--no-thumbs" not in sys.argv
    reg = json.loads((ROOT / "games/registry.json").read_text())
    ids = args or [g["id"] for g in reg["games"]]
    httpd = serve()
    failed = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for gid in ids:
            for name, state, errs in await check_game(browser, gid, thumbs):
                ok = not errs
                failed += 0 if ok else 1
                print(f"{'✔' if ok else '✘'} {gid:22} {name:8} scene={state['scene']:<12} fps={state['fps']:.0f}")
                for e in errs[:5]:
                    print("    " + str(e).splitlines()[0][:200])
        await browser.close()
    httpd.shutdown()
    print(f"\n{len(ids)} game(s), {failed} failing run(s).")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    asyncio.run(main())
