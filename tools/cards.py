#!/usr/bin/env python3
"""SlopGames title cards: render each game's `card` scene to games/<id>/thumb.jpg (1200x900, 4:3).

  python3 tools/cards.py                # every game in the registry that has a card scene
  python3 tools/cards.py orbit-hop      # specific ids
  python3 tools/cards.py --out /tmp/c   # write previews elsewhere instead of games/<id>/thumb.jpg

Contract for games: when the URL has ?card, boot into a scene named 'card' that paints finished key art
for the WHOLE canvas (gutters included: x from -K.view.ox to K.view.w + K.view.ox, y from -K.view.oy to
K.view.h + K.view.oy) — background world, hero, enemies/pickups mid-action, the game logo, and no buttons.
Keep it deterministic (seeded rng, fixed time). The card is captured 1.6 s after boot, rendered at 1.5x
and downsampled for crisp edges.
"""
import asyncio, sys, functools, http.server, socketserver, threading, pathlib, json, io

ROOT = pathlib.Path(__file__).resolve().parent.parent

def serve(port):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

async def main():
    from playwright.async_api import async_playwright
    from PIL import Image
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = None
    if "--out" in sys.argv: out = pathlib.Path(sys.argv[sys.argv.index("--out") + 1]); args = [a for a in args if a != str(out)]; out.mkdir(parents=True, exist_ok=True)
    reg = json.loads((ROOT / "games/registry.json").read_text())
    ids = args or [g["id"] for g in reg["games"] if "K.scenes.add('card'" in (ROOT / "games" / g["id"] / "index.html").read_text()]
    httpd = None
    for port in range(8900, 8990):
        try: httpd = serve(port); break
        except OSError: continue
    bad = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for gid in ids:
            ctx = await browser.new_context(viewport={"width": 1200, "height": 900}, device_scale_factor=1.5)
            page = await ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            await page.goto(f"http://127.0.0.1:{port}/games/{gid}/index.html?card")
            await page.wait_for_timeout(1600)
            scene = await page.evaluate("K.scenes.name")
            png = await page.screenshot(type="png")
            img = Image.open(io.BytesIO(png)).convert("RGB").resize((1200, 900), Image.LANCZOS)
            dest = (out / f"{gid}.jpg") if out else (ROOT / "games" / gid / "thumb.jpg")
            img.save(dest, "JPEG", quality=86, optimize=True, progressive=True)
            ok = scene == "card" and not errs
            bad += 0 if ok else 1
            print(f"{'✔' if ok else '✘'} {gid:22} scene={scene} → {dest}")
            for e in errs[:3]: print("    " + e.splitlines()[0][:200])
            await ctx.close()
        await browser.close()
    httpd.shutdown()
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    asyncio.run(main())
