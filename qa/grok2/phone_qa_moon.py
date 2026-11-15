# Whole-Moon scope only. The second pass died before the click because
# ".ui-switch button.on" matches both Simple and the checked rank radio.
# Read-only apart from this folder.
import json
import re
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright

from phone_qa import AUDIT_JS, FPS_JS, RAF_JS, UA, URL, hit, wait_results, wait_search_cycle

OUT = Path(__file__).resolve().parent


class Run:
    def __init__(self):
        self.n = 136
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
        (OUT / "run3.json").write_text(
            json.dumps({"rows": self.rows, "log": self.log}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def audit(page):
    return page.evaluate(AUDIT_JS)


FACTS_JS = """
() => {
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const scope = [...document.querySelectorAll('.st-scope button')].map((b) => ({
    text: clean(b.innerText).slice(0, 40),
    checked: b.getAttribute('aria-checked'),
  }));
  const more = clean(document.querySelector('.s-more')?.textContent || '').slice(0, 160);
  const heads = [...document.querySelectorAll('.s-head')].map((e) => clean(e.innerText).slice(0, 180));
  const cards = [...document.querySelectorAll('.site-card')].slice(0, 4).map((c) => clean(c.innerText).slice(0, 140));
  const empty = document.querySelector('.s-empty');
  return {
    scope,
    more,
    heads,
    cardCount: document.querySelectorAll('.site-card').length,
    cards,
    empty: empty ? clean(empty.innerText).slice(0, 200) : null,
    searching: [...document.querySelectorAll('button')].some((b) => /Searching|Aranıyor/.test(b.innerText)),
  };
}
"""


def main():
    run = Run()
    combos = [("en", 390, 844), ("en", 360, 740), ("tr", 390, 844), ("tr", 360, 740)]
    moon = re.compile(r"^(Whole Moon|Tüm Ay)$")
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

            try:
                bag["flow"] = "load"
                page.goto(f"{URL}#ui=simple&lang={lang}", wait_until="domcontentloaded", timeout=60000)
                wait_results(page, timeout=180000)
                page.locator(".s-more").click()
                page.wait_for_selector(".st-scope", timeout=8000)
                radio = page.locator(".st-scope button", has_text=moon)
                radio.scroll_into_view_if_needed()
                before = hit(page, ".st-scope button:nth-child(2)")
                print(f"RADIO {lang} {size} {before}", flush=True)
                bag["flow"] = "moon"
                radio.click(timeout=8000)
                print(f"CLICKED {lang} {size}", flush=True)
                wait_search_cycle(page, timeout=300000)
                page.wait_for_timeout(400)
                facts = page.evaluate(FACTS_JS)
                page.locator(".st-scope").scroll_into_view_if_needed()
                scope_shot = run.shot(page, lang, size, "moon-scope")
                page.locator("#results").scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                data = {
                    "id": f"{lang}-{size}-moon",
                    "shot": run.shot(page, lang, size, "moon"),
                    "scopeShot": scope_shot,
                    "before": before,
                    "facts": facts,
                }
                try:
                    data["audit"] = audit(page)
                except Exception as e:
                    data["audit_error"] = str(e)[:300]
                try:
                    data["fps"] = page.evaluate(FPS_JS)
                except Exception as e:
                    data["fps_error"] = str(e)[:300]
                data["console"] = bag["console"]
                data["pageerror"] = bag["pageerror"]
                data["net"] = bag["net"]
                run.add(data)
                print(f"FACTS {lang} {size} cards={facts.get('cardCount')} scope={facts.get('scope')}", flush=True)
            except Exception:
                err = traceback.format_exc()
                print(f"FAIL {lang} {size}\n{err[-900:]}", flush=True)
                try:
                    shot = run.shot(page, lang, size, "moon-error")
                except Exception:
                    shot = None
                run.log.append({
                    "fail": f"{lang}-{size}-moon",
                    "error": err[-1500:],
                    "shot": shot,
                    "console": bag["console"][-12:],
                    "pageerror": bag["pageerror"],
                    "net": bag["net"][-8:],
                })
                run.save()
            context.close()
        browser.close()
        run.log.append({"console_tail": "see rows"})
        # console lives on the last page only if we stored it; store per combo above via rows.
        run.save()
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
