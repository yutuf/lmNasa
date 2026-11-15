# Results list for the 390px Whole Moon searches. The first attempt clicked
# the radio and the search finished, then the More panel closed and the
# results were left below the screenshot.
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

from phone_qa import RAF_JS, UA, URL, wait_results, wait_search_cycle

OUT = Path(__file__).resolve().parent


def main():
    rows = []
    n = 142
    moon = re.compile(r"^(Whole Moon|Tüm Ay)$")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", args=["--use-angle=d3d11"])
        for lang, w, h in (("en", 390, 844), ("tr", 390, 844)):
            size = f"{w}x{h}"
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
            page.goto(f"{URL}#ui=simple&lang={lang}", wait_until="domcontentloaded", timeout=60000)
            wait_results(page, timeout=180000)
            page.locator(".s-more").click()
            page.locator(".st-scope button", has_text=moon).click()
            print(f"CLICKED {lang}", flush=True)
            wait_search_cycle(page, timeout=180000)
            page.wait_for_function(
                """() => /41[,.]276/.test(document.body.innerText)""",
                timeout=180000,
            )
            page.locator("#results").scroll_into_view_if_needed()
            page.wait_for_timeout(400)
            n += 1
            name = f"{n:03d}-{lang}-{size}-moon-results.png"
            page.screenshot(path=str(OUT / name), animations="disabled")
            facts = page.evaluate(
                """() => {
                  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
                  return {
                    heads: [...document.querySelectorAll('.s-head')].map((e) => clean(e.innerText).slice(0, 180)),
                    cardCount: document.querySelectorAll('.site-card').length,
                    cards: [...document.querySelectorAll('.site-card')].slice(0, 3).map((c) => clean(c.innerText).slice(0, 120)),
                    points: (document.body.innerText.match(/41[,.]276/) || [null])[0],
                    overflow: {
                      scrollWidth: document.documentElement.scrollWidth,
                      innerWidth: innerWidth,
                      clientWidth: document.documentElement.clientWidth,
                    },
                  };
                }"""
            )
            print(f"SHOT {name} {facts}", flush=True)
            rows.append({"id": f"{lang}-{size}-moon-results", "shot": name, "facts": facts})
            context.close()
        browser.close()
    (OUT / "run3b.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
