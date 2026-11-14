# Second phone pass: film, whole Moon, sunlight map, and the Turkish 390px flows
# the first pass lost when the dev server dropped. Read-only apart from this folder.
import json
import re
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright

from phone_qa import AUDIT_JS, FPS_JS, RAF_JS, UA, URL, hit, wait_results, wait_search_cycle

OUT = Path(__file__).resolve().parent


class Run:
    def __init__(self):
        self.n = 100
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
        self.save()
        ov = (row.get("audit") or {}).get("overflow", {}).get("delta")
        print(f"ROW {row.get('id')} overflow={ov}", flush=True)

    def save(self):
        (OUT / "run2.json").write_text(json.dumps({"rows": self.rows, "log": self.log}, ensure_ascii=False, indent=2), encoding="utf-8")


def audit(page):
    return page.evaluate(AUDIT_JS)


def main():
    run = Run()
    combos = [("en", 390, 844), ("en", 360, 740), ("tr", 390, 844), ("tr", 360, 740)]
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", args=["--use-angle=d3d11"])
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
                bag["net"].append({"flow": bag["flow"], "status": "failed", "url": req.url[:220], "error": str(req.failure)[:200]})

            page.on("console", on_console)
            page.on("pageerror", on_pageerror)
            page.on("response", on_response)
            page.on("requestfailed", on_fail)

            def flow(name):
                bag["flow"] = f"{lang}-{size}-{name}"

            def record(name, extra=None, do_fps=False):
                flow(name)
                data = {"id": f"{lang}-{size}-{name}", "shot": run.shot(page, lang, size, name)}
                try:
                    data["audit"] = audit(page)
                except Exception as e:
                    data["audit_error"] = str(e)[:300]
                if do_fps:
                    try:
                        data["fps"] = page.evaluate(FPS_JS)
                    except Exception as e:
                        data["fps_error"] = str(e)[:300]
                if extra:
                    data["extra"] = extra
                run.add(data)
                return data

            def guard(name, fn):
                try:
                    fn()
                except Exception:
                    err = traceback.format_exc()
                    print(f"FAIL {lang} {size} {name}\n{err[-800:]}", flush=True)
                    try:
                        shot = run.shot(page, lang, size, name + "-error")
                    except Exception:
                        shot = None
                    run.log.append({"fail": f"{lang}-{size}-{name}", "error": err[-1200:], "shot": shot})
                    run.save()

            flow("load")
            page.goto(f"{URL}#ui=simple&lang={lang}", wait_until="domcontentloaded", timeout=60000)
            wait_results(page)

            # Site page width, and the Turkish 390px flows the first pass lost.
            def site_block():
                flow("site")
                page.locator(".site-card").first.click()
                page.wait_for_selector(".profile", timeout=15000)
                page.wait_for_timeout(600)
                measure = page.evaluate(
                    """() => {
                      const p = document.querySelector('.profile');
                      const btns = [...document.querySelectorAll('.ph-actions .btn')].map((el) => {
                        const r = el.getBoundingClientRect();
                        return { text: el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40), x: Math.round(r.left), w: Math.round(r.width), y: Math.round(r.top) };
                      });
                      return {
                        first: document.querySelector('.ph-first')?.innerText || '',
                        last: document.querySelector('.ph-last')?.innerText || '',
                        verdict: document.querySelector('.ph-verdict')?.innerText || '',
                        profileW: p ? p.scrollWidth : null,
                        profileClient: p ? p.clientWidth : null,
                        buttons: btns,
                      };
                    }"""
                )
                record("site2", extra=measure)
                if lang == "tr" and w == 390:
                    page.locator(".ph-actions .btn").filter(has_text=re.compile(r"İnişi izle|Watch")).first.click()
                    page.wait_for_selector(".drive canvas", timeout=60000)
                    page.wait_for_timeout(1500)
                    hud = page.evaluate("() => document.getElementById('landing-hud')?.textContent || ''")
                    record("landing", extra={"hud": hud, "exit": hit(page, ".descent-exit")}, do_fps=True)
                    page.locator(".descent-exit").click()
                    page.wait_for_selector(".drive", state="detached", timeout=15000)
                    page.locator(".site-card").first.click()
                    page.wait_for_selector(".ph-actions")
                    page.locator(".ph-actions .btn").filter(has_text=re.compile(r"Gezgin sür")).click()
                    page.wait_for_selector(".drive canvas", timeout=60000)
                    page.wait_for_timeout(1500)
                    stick = page.evaluate(
                        """() => {
                          const el = document.querySelector('.stick');
                          if (!el) return { missing: true };
                          const r = el.getBoundingClientRect();
                          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                          const h = document.elementFromPoint(cx, cy);
                          return {
                            x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
                            hit: h ? (h.tagName + '.' + String(h.className || '').slice(0, 40)) : null,
                            onStick: !!(h && (h === el || el.contains(h))),
                          };
                        }"""
                    )
                    record("drive", extra={"stick": stick, "bl": page.evaluate("() => document.querySelector('.hud.bottom-left')?.innerText?.slice(0, 220) || ''")}, do_fps=True)
                    page.locator(".hud.bottom-right button").filter(has_text=re.compile(r"Çık")).first.click()
                    page.wait_for_selector(".drive", state="detached", timeout=15000)
                    page.locator(".site-card").first.click()
                    page.wait_for_selector(".ph-actions")
                    page.locator(".ph-actions .btn").filter(has_text=re.compile(r"yürü")).click()
                    page.wait_for_selector(".drive canvas", timeout=60000)
                    page.wait_for_timeout(800)
                    record("walk", extra={"title": page.evaluate("() => document.querySelector('.hud-title')?.innerText || ''"), "br": page.evaluate("() => document.querySelector('.hud.bottom-right')?.innerText?.slice(0, 300) || ''")}, do_fps=True)
                    page.locator(".hud.bottom-right button").filter(has_text=re.compile(r"Çık")).first.click()
                    page.wait_for_selector(".drive", state="detached", timeout=15000)

            guard("site", site_block)

            def film_block():
                flow("film")
                if page.locator(".drive").count():
                    page.locator("button").filter(has_text=re.compile(r"Çık|Exit")).first.click()
                    page.wait_for_timeout(400)
                if page.locator(".profile").count():
                    page.locator(".profile-back").click()
                    page.wait_for_timeout(300)
                page.locator(".nav-story").click(timeout=8000)
                page.wait_for_selector(".film-scene", timeout=15000)
                page.wait_for_function(
                    """() => /^\\s*02/.test(document.querySelector('.film-scene')?.innerText || '')""",
                    timeout=20000,
                )
                record("film-02", do_fps=True)
                page.locator(".film-ctl button[aria-label='Next']").click()
                page.wait_for_timeout(400)
                scene = page.locator(".film-scene").inner_text()[:40]
                record("film-next", extra={"scene": scene})
                page.locator(".film-progress button").last.click()
                page.wait_for_function(
                    """() => /VERDICT|KARAR/.test(document.querySelector('.film-scene')?.innerText || '')""",
                    timeout=10000,
                )
                page.wait_for_timeout(400)
                end = page.evaluate(
                    """() => ({
                      scene: document.querySelector('.film-scene')?.innerText || '',
                      sub: document.querySelector('.film-sub')?.innerText || '',
                      actions: document.querySelector('.fs-actions')?.innerText?.replace(/\\s+/g, ' ').trim().slice(0, 180) || '',
                      scroll: document.documentElement.scrollWidth,
                      inner: window.innerWidth,
                    })"""
                )
                record("film-end", extra=end)
                page.locator(".film-ctl button[aria-label='Close']").click()
                page.wait_for_selector(".film-scene", state="detached", timeout=8000)

            guard("film", film_block)

            def moon_block():
                flow("moon")
                if page.locator(".ui-switch button.on").inner_text().strip().lower() not in ("simple", "basit"):
                    page.locator(".ui-switch button").filter(has_text=re.compile(r"^Simple$|^Basit$")).click()
                page.locator(".s-more").click()
                page.wait_for_selector(".st-scope")
                page.locator(".st-scope button").filter(has_text=re.compile(r"Whole Moon|Tüm Ay")).click()
                wait_search_cycle(page, timeout=240000)
                info = page.evaluate(
                    """() => ({
                      pill: document.querySelector('.scope-pill')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
                      on: document.querySelector('.st-scope button[aria-checked="true"]')?.innerText?.replace(/\\s+/g, ' ').trim() || '',
                      heads: [...document.querySelectorAll('.s-head h2')].map((h) => h.innerText),
                      cards: document.querySelectorAll('.site-card').length,
                      empty: document.querySelector('.s-empty')?.innerText || '',
                    })"""
                )
                page.locator(".s-head h2").first.scroll_into_view_if_needed()
                record("moon", extra=info)

            guard("moon", moon_block)

            def sun_block():
                flow("sun")
                page.locator(".map-card").scroll_into_view_if_needed()
                page.wait_for_timeout(400)
                sun_hit = None
                buttons = page.locator(".map-tools .seg button")
                for i in range(buttons.count()):
                    t = buttons.nth(i).inner_text()
                    if re.search(r"Sunlight|Güneş ışığı", t):
                        sun_hit = hit(page, f".map-tools .seg button:nth-of-type({i + 1})")
                        buttons.nth(i).click()
                        break
                page.wait_for_selector(".map-time", timeout=20000)
                clock0 = page.locator(".map-time .num").inner_text()
                play_hit = hit(page, ".map-time .icon-btn")
                page.locator(".map-time .icon-btn").click()
                page.wait_for_timeout(2500)
                clock1 = page.locator(".map-time .num").inner_text()
                aria = page.locator(".map-time .icon-btn").get_attribute("aria-label")
                fab = hit(page, ".luna-fab")
                record("sun", extra={"clock0": clock0, "clock1": clock1, "playHit": play_hit, "sunHit": sun_hit, "aria": aria, "fab": fab}, do_fps=True)

            guard("sun", sun_block)

            # Turkish 390 also still needs sources, libration, interview, Luna, advanced.
            if lang == "tr" and w == 390:
                def rest_tr():
                    flow("sources")
                    if page.locator(".s-src").count() == 0:
                        page.locator(".ui-switch button").filter(has_text=re.compile(r"^Basit$")).click()
                        page.wait_for_timeout(300)
                    page.locator(".s-src").click()
                    page.wait_for_selector(".sources")
                    record("sources", extra={"close": hit(page, ".sources .icon-btn")})
                    page.locator(".sources .icon-btn").click()
                    page.locator(".s-hero-links button").nth(1).click()
                    page.wait_for_selector(".lib")
                    record("libration", extra={"title": page.evaluate("() => document.querySelector('.lib h1')?.innerText || ''"), "close": hit(page, ".lib .icon-btn")})
                    page.locator(".lib .icon-btn").click()
                    page.locator(".luna-fab").click()
                    page.wait_for_selector(".luna-plan")
                    record("luna-open", extra={"plan": hit(page, ".luna-plan")})
                    page.locator(".luna-plan").click()
                    page.wait_for_selector(".mi-chip")
                    record("interview-open")
                    for _ in range(8):
                        if page.locator(".mi-go").count():
                            break
                        page.wait_for_function(
                            """() => document.querySelector('.mi-go') || ([...document.querySelectorAll('.mi-chip')].some((c) => !c.disabled) && !document.querySelector('.mi-typing'))""",
                            timeout=20000,
                        )
                        if page.locator(".mi-go").count():
                            break
                        fresh = page.evaluate("() => [...document.querySelectorAll('.mi-chip')].map((c) => c.innerText.replace(/\\s+/g,' ').trim()).join('|')")
                        page.locator(".mi-chip:not([disabled])").first.click()
                        page.wait_for_function(
                            """(before) => document.querySelector('.mi-go') || (!document.querySelector('.mi-typing') && [...document.querySelectorAll('.mi-chip')].map((c) => c.innerText.replace(/\\s+/g,' ').trim()).join('|') !== before)""",
                            arg=fresh,
                            timeout=20000,
                        )
                    go = hit(page, ".mi-go")
                    record("interview-summary", extra={"go": go})
                    page.locator(".mi-go").click()
                    page.wait_for_selector(".mi-root", state="detached", timeout=10000)
                    wait_search_cycle(page)
                    record("interview-ran")
                    page.locator(".luna-fab").click()
                    page.wait_for_selector(".luna-suggest button")
                    sugg = page.locator(".luna-suggest button").first.inner_text()
                    page.locator(".luna-suggest button").first.click()
                    page.wait_for_function(
                        """() => [...document.querySelectorAll('.msg.luna')].some((m) => !m.classList.contains('typing') && m.innerText.trim().length > 8)""",
                        timeout=25000,
                    )
                    reply = page.evaluate("() => [...document.querySelectorAll('.msg.luna')].find((m) => !m.classList.contains('typing'))?.innerText?.replace(/\\s+/g,' ').trim().slice(0, 400) || ''")
                    record("luna", extra={"suggestion": sugg, "reply": reply, "note": page.locator(".luna-note").inner_text()[:200]})
                    page.locator(".luna-fab").click()
                    page.locator(".ui-switch button").filter(has_text=re.compile(r"^Gelişmiş$")).click()
                    page.wait_for_timeout(400)
                    nav = page.evaluate(
                        """() => {
                          const nav = document.querySelector('.nav');
                          const kids = [...nav.children].filter((el) => getComputedStyle(el).display !== 'none').map((el) => {
                            const r = el.getBoundingClientRect();
                            return { text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\\s+/g,' ').trim().slice(0, 30), x: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) };
                          });
                          return { kids, scroll: document.documentElement.scrollWidth, inner: innerWidth };
                        }"""
                    )
                    record("advanced", extra={"nav": nav})
                    btn = page.locator(".side-foot .btn.primary")
                    label = btn.inner_text()[:80]
                    btn.click()
                    wait_search_cycle(page)
                    meta = page.evaluate("() => document.querySelector('.side-foot .meta')?.innerText?.slice(0, 180) || ''")
                    record("advanced-search", extra={"button": label, "meta": meta})

                guard("tr-rest", rest_tr)

            run.log.append({"lang": lang, "size": size, "console": bag["console"], "pageerror": bag["pageerror"], "net": bag["net"]})
            run.save()
            page.close()
            context.close()
            print(f"END {lang} {size}", flush=True)
        browser.close()
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
