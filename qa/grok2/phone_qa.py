# Read-only phone QA for LunaNav. Writes screenshots and run.json in this folder.
# Launch: Edge, --use-angle=d3d11, touch + mobile contexts at 390x844 and 360x740.
import json
import re
import time
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
URL = "http://localhost:5174/"
UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
)

RAF_JS = """
(() => {
  const orig = window.requestAnimationFrame.bind(window);
  window.__raf = 0;
  window.requestAnimationFrame = function (cb) {
    return orig(function (t) {
      window.__raf++;
      return cb(t);
    });
  };
})();
"""

AUDIT_JS = """
() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const de = document.documentElement;
  function shown(el) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function label(el) {
    const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '')
      .replace(/\\s+/g, ' ').trim();
    return t.slice(0, 140);
  }
  const controls = [];
  const sel = 'button, a, input, textarea, select, [role="button"], [role="radio"]';
  for (const el of document.querySelectorAll(sel)) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    const yHits = r.bottom > 0 && r.top < vh;
    if (!yHits) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const offX = r.left < -1 || r.right > vw + 1;
    const centerIn = cx >= 0 && cx <= vw && cy >= 0 && cy <= vh;
    let covered = null;
    if (centerIn) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !(hit.contains && hit.contains(el))) {
        covered = {
          hit: hit.tagName + '.' + String(hit.className || '').slice(0, 80),
          text: label(hit).slice(0, 80),
        };
      }
    }
    if (offX || covered) {
      controls.push({
        problem: covered ? 'covered' : 'off-screen-x',
        text: label(el),
        cls: String(el.className || '').slice(0, 80),
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        covered,
      });
    }
    if (controls.length >= 25) break;
  }
  const cut = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,button,a,label,li,td,th,span,b,small')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.width < 4) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    const s = getComputedStyle(el);
    const t = el.innerText.replace(/\\s+/g, ' ').trim();
    if (t.length < 2) continue;
    const clipX = (s.overflowX === 'hidden' || s.overflowX === 'clip' || s.textOverflow === 'ellipsis')
      && el.scrollWidth > el.clientWidth + 3;
    const clipY = (s.overflowY === 'hidden' || s.overflowY === 'clip')
      && el.scrollHeight > el.clientHeight + 3 && el.clientHeight < 80;
    if (clipX || clipY) {
      cut.push({
        text: t.slice(0, 120), cls: String(el.className || '').slice(0, 60),
        clipX, clipY, sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight,
      });
    }
    if (cut.length >= 20) break;
  }
  const boxes = [];
  for (const el of document.querySelectorAll('h1,h2,h3,p,button,label,li,td,th,span,b,small')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.width < 10 || r.height < 8) continue;
    const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (t.length < 2) continue;
    if ([...el.children].some((c) => (c.innerText || '').replace(/\\s+/g, ' ').trim() === t)) continue;
    boxes.push({ el, t: t.slice(0, 90), r, cls: String(el.className || '').slice(0, 40) });
    if (boxes.length >= 70) break;
  }
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
      const y = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
      const area = x * y;
      const minA = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if (area > 50 && area / minA > 0.4) {
        overlaps.push({ a: a.t, b: b.t, acls: a.cls, bcls: b.cls, frac: Math.round(100 * area / minA) });
      }
      if (overlaps.length >= 12) break;
    }
    if (overlaps.length >= 12) break;
  }
  const aria = [];
  for (const el of document.querySelectorAll('[aria-label], [title]')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) continue;
    aria.push({
      label: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      cls: String(el.className || '').slice(0, 40),
    });
    if (aria.length >= 30) break;
  }
  const lines = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const p = node.parentElement;
    if (!p || !shown(p)) continue;
    const r = p.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const t = node.textContent.replace(/\\s+/g, ' ').trim();
    if (t.length > 1) lines.push(t.slice(0, 180));
    if (lines.length >= 160) break;
  }
  const bg = [];
  for (const q of ['.profile', '.workshop', '.mi-panel', '.mi-root', '.luna', '.film', '.drive', '.src-body', '.lib']) {
    const el = document.querySelector(q);
    if (!el || !shown(el)) continue;
    const s = getComputedStyle(el);
    bg.push({ sel: q, bg: s.backgroundColor, opacity: s.opacity, z: s.zIndex });
  }
  const nav = document.querySelector('.nav');
  let navInfo = null;
  if (nav) {
    const kids = [];
    let maxR = 0;
    for (const el of nav.children) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      maxR = Math.max(maxR, r.right);
      kids.push({ text: label(el).slice(0, 40), x: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) });
    }
    const nr = nav.getBoundingClientRect();
    navInfo = { w: Math.round(nr.width), right: Math.round(nr.right), maxChildRight: Math.round(maxR), kids };
  }
  const overlay = document.querySelector('vite-error-overlay');
  return {
    overflow: {
      scrollWidth: de.scrollWidth,
      innerWidth: vw,
      innerHeight: vh,
      clientWidth: de.clientWidth,
      delta: de.scrollWidth - vw,
    },
    nav: navInfo,
    controls, cut, overlaps, aria, lines, bg,
    coarse: matchMedia('(pointer: coarse)').matches,
    hoverNone: matchMedia('(hover: none)').matches,
    viteError: overlay ? (overlay.shadowRoot ? overlay.shadowRoot.textContent : overlay.textContent || '').slice(0, 400) : null,
  };
}
"""

FPS_JS = """
async () => {
  const a = window.__raf || 0;
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 3000));
  const frames = (window.__raf || 0) - a;
  const seconds = (performance.now() - t0) / 1000;
  const canvases = [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top) };
  }).filter((c) => c.w > 2 && c.h > 2);
  return {
    frames, seconds: Math.round(seconds * 100) / 100,
    fps: seconds > 0 ? Math.round((frames / seconds) * 10) / 10 : 0,
    canvases,
  };
}
"""


class Run:
    def __init__(self):
        self.n = 0
        self.rows = []
        self.log = []

    def shot(self, page, lang, size, flow):
        self.n += 1
        name = f"{self.n:03d}-{lang}-{size}-{flow}.png"
        page.screenshot(path=str(OUT / name), animations="disabled")
        print(f"SHOT {name}", flush=True)
        return name

    def add(self, row):
        self.rows.append(row)
        (OUT / "run.json").write_text(json.dumps({"rows": self.rows, "log": self.log}, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"ROW {row.get('id')} overflow={row.get('audit', {}).get('overflow', {}).get('delta')}", flush=True)


def audit(page):
    return page.evaluate(AUDIT_JS)


def fps(page):
    return page.evaluate(FPS_JS)


def hit(page, selector):
    return page.evaluate(
        """(sel) => {
          const el = document.querySelector(sel);
          if (!el) return { missing: true, sel };
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          const r = el.getBoundingClientRect();
          const vw = innerWidth, vh = innerHeight;
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const inView = cx >= 1 && cx <= vw - 1 && cy >= 1 && cy <= vh - 1;
          let covered = false, hitName = null, hitText = null;
          if (inView) {
            const h = document.elementFromPoint(cx, cy);
            covered = !(h && (h === el || el.contains(h) || h.contains(el)));
            if (h) {
              hitName = h.tagName + '.' + String(h.className || '').slice(0, 60);
              hitText = (h.innerText || h.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
            }
          }
          return {
            sel, missing: false,
            text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 100),
            x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
            inView, covered, hitName, hitText,
            offX: r.left < -1 || r.right > vw + 1,
          };
        }""",
        selector,
    )


def wait_results(page, timeout=180000):
    page.wait_for_function(
        """() => {
          const busy = [...document.querySelectorAll('button')].some((b) => /Searching|Aranıyor/.test(b.innerText));
          const cards = document.querySelectorAll('.site-card').length;
          const empty = !!document.querySelector('.s-empty');
          const table = document.querySelectorAll('table tbody tr').length;
          return !busy && (cards > 0 || empty || table > 0);
        }""",
        timeout=timeout,
    )


def wait_search_cycle(page, timeout=180000):
    try:
        page.wait_for_function(
            """() => [...document.querySelectorAll('button')].some((b) => /Searching|Aranıyor/.test(b.innerText))""",
            timeout=12000,
        )
    except Exception:
        pass
    wait_results(page, timeout=timeout)


def click_text(page, pattern, scope="button"):
    loc = page.locator(scope).filter(has_text=re.compile(pattern))
    loc.first.click(timeout=8000)
    return loc.first.inner_text()[:80]


def main():
    run = Run()
    combos = [("en", 390, 844), ("en", 360, 740), ("tr", 390, 844), ("tr", 360, 740)]
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", args=["--use-angle=d3d11"])
        probe = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        probe.add_init_script(RAF_JS)
        pg = probe.new_page()
        pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
        gl = pg.evaluate(
            """() => {
              const c = document.createElement('canvas');
              const gl = c.getContext('webgl2') || c.getContext('webgl');
              if (!gl) return 'no-webgl';
              const ext = gl.getExtension('WEBGL_debug_renderer_info');
              return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            }"""
        )
        coarse = pg.evaluate("() => matchMedia('(pointer: coarse)').matches")
        run.log.append({"webgl": gl, "coarse_on_blank": coarse})
        print(f"WEBGL {gl} coarse={coarse}", flush=True)
        pg.close()
        probe.close()

        for lang, w, h in combos:
            size = f"{w}x{h}"
            print(f"BEGIN {lang} {size}", flush=True)
            context = browser.new_context(
                viewport={"width": w, "height": h},
                has_touch=True,
                is_mobile=True,
                device_scale_factor=1,
                locale="tr-TR" if lang == "tr" else "en-US",
                user_agent=UA,
            )
            context.add_init_script(RAF_JS)
            page = context.new_page()
            page.set_default_timeout(20000)
            bag = {"console": [], "pageerror": [], "net": [], "flow": "boot"}

            def on_console(msg, bag=bag):
                if msg.type in ("error", "warning"):
                    bag["console"].append({"flow": bag["flow"], "type": msg.type, "text": msg.text[:400]})

            def on_pageerror(err, bag=bag):
                bag["pageerror"].append({"flow": bag["flow"], "text": str(err)[:500]})

            def on_response(resp, bag=bag):
                if resp.status >= 400:
                    bag["net"].append({"flow": bag["flow"], "status": resp.status, "url": resp.url[:220]})

            def on_fail(req, bag=bag):
                fail = req.failure
                bag["net"].append({"flow": bag["flow"], "status": "failed", "url": req.url[:220], "error": str(fail)[:200]})

            page.on("console", on_console)
            page.on("pageerror", on_pageerror)
            page.on("response", on_response)
            page.on("requestfailed", on_fail)

            def flow(name):
                bag["flow"] = f"{lang}-{size}-{name}"

            def record(name, extra=None, do_fps=False):
                flow(name)
                time.sleep(0.4)
                data = {"id": f"{lang}-{size}-{name}", "shot": run.shot(page, lang, size, name)}
                try:
                    data["audit"] = audit(page)
                except Exception as e:
                    data["audit_error"] = str(e)[:300]
                if do_fps:
                    try:
                        data["fps"] = fps(page)
                    except Exception as e:
                        data["fps_error"] = str(e)[:300]
                if extra:
                    data["extra"] = extra
                run.add(data)
                return data

            try:
                flow("load")
                page.goto(f"{URL}#ui=simple&lang={lang}", wait_until="domcontentloaded", timeout=60000)
                wait_results(page)
                record("home")
                # 1. site card
                flow("site")
                page.locator(".site-card").first.click()
                page.wait_for_selector(".profile", timeout=15000)
                page.wait_for_timeout(800)
                stats = page.evaluate(
                    """() => ({
                      first: document.querySelector('.ph-first')?.innerText || '',
                      last: document.querySelector('.ph-last')?.innerText || '',
                      region: document.querySelector('.ph-region')?.innerText || '',
                      verdict: document.querySelector('.ph-verdict')?.innerText || '',
                      stats: [...document.querySelectorAll('.ph-stat')].slice(0, 12).map((s) => s.innerText.replace(/\\s+/g, ' ').trim().slice(0, 100)),
                    })"""
                )
                record("site", extra=stats)
                page.locator(".ph-actions").scroll_into_view_if_needed()
                actions = {
                    "watch": hit(page, ".ph-actions .btn.primary"),
                    "stand": hit(page, ".ph-actions .btn:nth-of-type(2)"),
                    "walk": hit(page, ".ph-actions .btn:nth-of-type(3)"),
                    "drive": hit(page, ".ph-actions .btn:nth-of-type(4)"),
                }
                record("site-actions", extra=actions)

                # 2. landing
                flow("landing")
                page.locator(".ph-actions .btn.primary").click()
                page.wait_for_selector(".drive canvas", timeout=60000)
                page.wait_for_timeout(2000)
                hud = page.evaluate("() => document.getElementById('landing-hud')?.textContent || ''")
                exit_hit = hit(page, ".descent-exit")
                record("landing", extra={"hud": hud, "exit": exit_hit}, do_fps=True)
                if page.locator(".descent-exit").count():
                    page.locator(".descent-exit").click()
                else:
                    page.locator(".hud.bottom-right button").filter(has_text=re.compile(r"Exit|Çık")).first.click()
                page.wait_for_selector(".drive", state="detached", timeout=15000)

                # 3. drive
                flow("drive")
                page.locator(".site-card").first.click()
                page.wait_for_selector(".ph-actions")
                page.locator(".ph-actions .btn").filter(has_text=re.compile(r"Drive a rover|Gezgin sür")).click()
                page.wait_for_selector(".drive canvas", timeout=60000)
                try:
                    page.wait_for_selector(".drive-loading", state="detached", timeout=60000)
                except Exception:
                    pass
                page.wait_for_timeout(600)
                before = page.evaluate("() => document.querySelector('.hud.bottom-left')?.innerText?.slice(0, 240) || ''")
                stick = page.locator(".stick").count()
                drag = None
                if stick:
                    box = page.locator(".stick").bounding_box()
                    if box:
                        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
                        page.mouse.move(cx, cy)
                        page.mouse.down()
                        page.mouse.move(cx, cy - 36, steps=5)
                        page.wait_for_timeout(700)
                        page.mouse.up()
                        drag = "dragged stick up"
                after = page.evaluate("() => document.querySelector('.hud.bottom-left')?.innerText?.slice(0, 240) || ''")
                exit_d = hit(page, ".hud.bottom-right button:last-of-type")
                record("drive", extra={"before": before, "after": after, "stick": stick, "drag": drag, "exit": exit_d, "coarse": page.evaluate("() => matchMedia('(pointer: coarse)').matches")}, do_fps=True)
                page.locator(".hud.bottom-right button").filter(has_text=re.compile(r"Exit|Çık")).first.click()
                page.wait_for_selector(".drive", state="detached", timeout=15000)

                # 4. walk
                flow("walk")
                page.locator(".site-card").first.click()
                page.wait_for_selector(".ph-actions")
                page.locator(".ph-actions .btn").filter(has_text=re.compile(r"Walk on the Moon|Ay’da yürü|Ay'da yürü")).click()
                page.wait_for_selector(".drive canvas", timeout=60000)
                try:
                    page.wait_for_selector(".drive-loading", state="detached", timeout=60000)
                except Exception:
                    pass
                page.wait_for_timeout(600)
                walk_txt = page.evaluate(
                    """() => ({
                      title: document.querySelector('.hud-title')?.innerText || '',
                      bl: document.querySelector('.hud.bottom-left')?.innerText?.slice(0, 300) || '',
                      br: document.querySelector('.hud.bottom-right')?.innerText?.slice(0, 400) || '',
                      stick: !!document.querySelector('.stick'),
                    })"""
                )
                record("walk", extra=walk_txt, do_fps=True)
                page.locator(".hud.bottom-right button").filter(has_text=re.compile(r"Exit|Çık")).first.click()
                page.wait_for_selector(".drive", state="detached", timeout=15000)

                # 5. what next
                flow("next")
                page.locator(".s-next h3").scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                next_hits = page.evaluate(
                    """() => [...document.querySelectorAll('.s-next-grid button')].map((el, i) => {
                      el.scrollIntoView({ block: 'center' });
                      const r = el.getBoundingClientRect();
                      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                      const h = document.elementFromPoint(cx, cy);
                      const covered = !(h && (h === el || el.contains(h)));
                      return {
                        i, text: el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 80),
                        x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height),
                        offX: r.left < -1 || r.right > innerWidth + 1, covered,
                        hit: h ? (h.tagName + '.' + String(h.className||'').slice(0, 40)) : null,
                      };
                    })"""
                )
                record("next", extra={"buttons": next_hits})
                page.locator(".s-next-grid button").nth(1).click()
                page.wait_for_selector(".workshop", timeout=10000)
                page.wait_for_timeout(400)
                record("next-compare")
                page.locator(".workshop .icon-btn").first.click()
                page.wait_for_selector(".workshop", state="detached", timeout=8000)

                # 6. sources
                flow("sources")
                page.locator(".s-src").click()
                page.wait_for_selector(".sources", timeout=10000)
                page.wait_for_timeout(300)
                record("sources", extra={"close": hit(page, ".sources .icon-btn")})
                page.locator(".sources .icon-btn").click()
                page.wait_for_selector(".sources", state="detached", timeout=8000)

                # 7. libration
                flow("lib")
                page.locator(".s-hero-links button").nth(1).click()
                page.wait_for_selector(".lib", timeout=10000)
                page.wait_for_timeout(500)
                lib = page.evaluate(
                    """() => ({
                      title: document.querySelector('.lib h1')?.innerText || '',
                      close: document.querySelector('.lib .icon-btn')?.getAttribute('aria-label') || '',
                    })"""
                )
                record("libration", extra={**lib, "closeHit": hit(page, ".lib .icon-btn")})
                page.locator(".lib .icon-btn").click()
                page.wait_for_selector(".lib", state="detached", timeout=8000)

                # 9. interview before Luna has messages, so the plan chip is still there
                flow("interview")
                page.locator(".luna-fab").click()
                page.wait_for_selector(".luna-plan", timeout=8000)
                plan_hit = hit(page, ".luna-plan")
                record("luna-open", extra={"plan": plan_hit})
                page.locator(".luna-plan").click()
                page.wait_for_selector(".mi-chip", timeout=10000)
                page.wait_for_timeout(300)
                record("interview-open")
                steps = []
                reached = False
                for _ in range(8):
                    state = page.evaluate(
                        """() => ({
                          go: !!document.querySelector('.mi-go'),
                          goText: document.querySelector('.mi-go')?.innerText?.replace(/\\s+/g,' ').trim() || '',
                          chips: [...document.querySelectorAll('.mi-chip')].map((c) => ({
                            text: c.innerText.replace(/\\s+/g,' ').trim().slice(0, 90),
                            disabled: c.disabled,
                          })),
                          bubbles: document.querySelectorAll('.mi-bubble').length,
                          last: [...document.querySelectorAll('.mi-bubble')].slice(-1)[0]?.innerText?.replace(/\\s+/g,' ').trim().slice(0, 180) || '',
                        })"""
                    )
                    if state["go"]:
                        reached = True
                        steps.append({"summary": state})
                        break
                    page.wait_for_function(
                        """() => {
                          if (document.querySelector('.mi-go')) return true;
                          const chips = [...document.querySelectorAll('.mi-chip')];
                          return chips.length > 0 && chips.some((c) => !c.disabled) && !document.querySelector('.mi-typing');
                        }""",
                        timeout=20000,
                    )
                    fresh = page.evaluate(
                        """() => [...document.querySelectorAll('.mi-chip')].map((c) => c.innerText.replace(/\\s+/g, ' ').trim())"""
                    )
                    chip_hit = hit(page, ".mi-chip:not([disabled])")
                    before_chips = "|".join(fresh)
                    err = None
                    try:
                        page.locator(".mi-chip:not([disabled])").first.click(timeout=5000)
                    except Exception as e:
                        err = str(e)[:300]
                    steps.append({"before": state, "hit": chip_hit, "clickError": err})
                    if err:
                        break
                    try:
                        page.wait_for_function(
                            """(before) => {
                              if (document.querySelector('.mi-go')) return true;
                              if (document.querySelector('.mi-typing')) return false;
                              const chips = [...document.querySelectorAll('.mi-chip')];
                              if (!chips.length || chips.every((c) => c.disabled)) return false;
                              const now = chips.map((c) => c.innerText.replace(/\\s+/g, ' ').trim()).join('|');
                              return now !== before;
                            }""",
                            arg=before_chips,
                            timeout=20000,
                        )
                    except Exception as e:
                        steps[-1]["waitError"] = str(e)[:200]
                        break
                go_hit = hit(page, ".mi-go") if page.locator(".mi-go").count() else {"missing": True}
                record("interview-summary", extra={"reached": reached, "steps": steps, "go": go_hit})
                if page.locator(".mi-go").count() and not go_hit.get("covered") and go_hit.get("inView"):
                    page.locator(".mi-go").click()
                    page.wait_for_selector(".mi-root", state="detached", timeout=10000)
                    wait_search_cycle(page)
                    record("interview-ran")
                elif page.locator(".mi-root").count():
                    page.locator(".mi-x").click()
                    page.wait_for_timeout(300)

                # 8. one Luna suggestion
                flow("luna")
                if page.locator(".luna").count() == 0:
                    page.locator(".luna-fab").click()
                page.wait_for_selector(".luna-suggest button", timeout=8000)
                sugg = page.locator(".luna-suggest button").first.inner_text()
                sugg_hit = hit(page, ".luna-suggest button")
                page.locator(".luna-suggest button").first.click()
                page.wait_for_function(
                    """() => [...document.querySelectorAll('.msg.luna')].some((m) => !m.classList.contains('typing') && m.innerText.trim().length > 8)""",
                    timeout=25000,
                )
                reply = page.evaluate(
                    """() => {
                      const m = [...document.querySelectorAll('.msg.luna')].find((x) => !x.classList.contains('typing'));
                      return m ? m.innerText.replace(/\\s+/g, ' ').trim().slice(0, 500) : '';
                    }"""
                )
                note = page.locator(".luna-note").inner_text()[:240]
                record("luna", extra={"suggestion": sugg, "hit": sugg_hit, "reply": reply, "note": note})
                page.locator(".luna-fab").click()
                page.wait_for_timeout(200)

                # 10. advanced search
                flow("advanced")
                page.locator(".ui-switch button").filter(has_text=re.compile(r"^Advanced$|^Gelişmiş$")).click()
                page.wait_for_timeout(400)
                record("advanced")
                run_btn = page.locator(".side-foot .btn.primary")
                run_hit = hit(page, ".side-foot .btn.primary")
                label = run_btn.inner_text()[:80]
                run_btn.click()
                wait_search_cycle(page)
                meta = page.evaluate("() => document.querySelector('.side-foot .meta')?.innerText?.slice(0, 200) || ''")
                record("advanced-search", extra={"button": label, "hit": run_hit, "meta": meta})

                # 11. film
                flow("film")
                page.locator(".nav-story").click()
                page.wait_for_selector(".film-scene", timeout=15000)
                page.wait_for_function(
                    """() => /^\\s*02/.test((document.querySelector('.film-scene')?.innerText || ''))""",
                    timeout=20000,
                )
                record("film-02", do_fps=True)
                page.wait_for_function(
                    """() => /^\\s*03/.test((document.querySelector('.film-scene')?.innerText || ''))""",
                    timeout=20000,
                )
                record("film-03")
                page.locator(".film-ctl button[aria-label='Next']").click()
                page.wait_for_timeout(400)
                record("film-next")
                page.locator(".film-progress button").last.click()
                page.wait_for_function(
                    """() => /VERDICT|KARAR/.test(document.querySelector('.film-scene')?.innerText || '')""",
                    timeout=10000,
                )
                page.wait_for_timeout(500)
                end_txt = page.evaluate(
                    """() => ({
                      scene: document.querySelector('.film-scene')?.innerText || '',
                      sub: document.querySelector('.film-sub')?.innerText || '',
                      actions: document.querySelector('.fs-actions')?.innerText?.replace(/\\s+/g,' ').trim().slice(0, 200) || '',
                    })"""
                )
                record("film-end", extra=end_txt)
                page.locator(".film-ctl button[aria-label='Close']").click()
                page.wait_for_selector(".film-scene", state="detached", timeout=8000)

                # 12. whole moon
                flow("moon")
                page.locator(".ui-switch button").filter(has_text=re.compile(r"^Simple$|^Basit$")).click()
                page.wait_for_timeout(300)
                page.locator(".s-more").click()
                page.wait_for_selector(".st-scope")
                page.locator(".st-scope button").filter(has_text=re.compile(r"Whole Moon|Tüm Ay")).click()
                wait_search_cycle(page, timeout=240000)
                pill = page.evaluate(
                    """() => ({
                      pill: document.querySelector('.scope-pill')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
                      on: document.querySelector('.st-scope button[aria-checked="true"]')?.innerText?.replace(/\\s+/g, ' ').trim() || '',
                    })"""
                )
                heads = page.evaluate("() => [...document.querySelectorAll('.s-head h2')].map((h) => h.innerText)")
                cards_n = page.locator(".site-card").count()
                page.locator(".scope-pill, .nav").first.scroll_into_view_if_needed()
                record("moon", extra={"pill": pill, "heads": heads, "cards": cards_n})

                # 13. sunlight map play
                flow("sun")
                page.locator(".map-card").scroll_into_view_if_needed()
                page.locator(".map-tools .seg button").filter(has_text=re.compile(r"Sunlight|Güneş ışığı")).click()
                page.wait_for_selector(".map-time", timeout=20000)
                clock0 = page.locator(".map-time .num").inner_text()
                play_hit = hit(page, ".map-time .icon-btn")
                page.locator(".map-time .icon-btn").click()
                page.wait_for_timeout(2500)
                clock1 = page.locator(".map-time .num").inner_text()
                play_label = page.locator(".map-time .icon-btn").get_attribute("aria-label")
                record("sun", extra={"clock0": clock0, "clock1": clock1, "playHit": play_hit, "aria": play_label}, do_fps=True)
            except Exception:
                err = traceback.format_exc()
                print(f"FAIL {lang} {size}\n{err}", flush=True)
                try:
                    name = run.shot(page, lang, size, "error")
                except Exception:
                    name = None
                run.log.append({"fail": f"{lang}-{size}", "error": err[-1500:], "shot": name})
                (OUT / "run.json").write_text(json.dumps({"rows": run.rows, "log": run.log}, ensure_ascii=False, indent=2), encoding="utf-8")
            bag_path = {"lang": lang, "size": size, "console": bag["console"], "pageerror": bag["pageerror"], "net": bag["net"]}
            run.log.append(bag_path)
            (OUT / "run.json").write_text(json.dumps({"rows": run.rows, "log": run.log}, ensure_ascii=False, indent=2), encoding="utf-8")
            page.close()
            context.close()
            print(f"END {lang} {size}", flush=True)
        browser.close()
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
