"""Record the ~60 s demo video (docs/demo/lunanav-demo.mp4) from a local run of the app, with captions.

Needs `pip install playwright` and Microsoft Edge (or change `channel`). Start the app first:
  streamlit run app.py --server.port 8502
then:
  python scripts/record_demo.py out/video
  ffmpeg -ss <printed start> -i out/video/<file>.webm -c:v libx264 -crf 28 -pix_fmt yuv420p -an docs/demo/lunanav-demo.mp4
"""
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:8502/"
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

CAPTION_JS = """
(text) => {
  let el = document.getElementById('demo-caption');
  if (!el) {
    el = document.createElement('div'); el.id = 'demo-caption';
    el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1100px;z-index:99999;'
      + 'background:rgba(8,10,18,.88);color:#fff;font:600 24px/1.35 system-ui,Segoe UI,sans-serif;padding:14px 22px;'
      + 'border-radius:14px;border:1px solid rgba(242,183,5,.6);text-align:center;box-shadow:0 6px 30px rgba(0,0,0,.5)';
    document.body.appendChild(el);
  }
  el.style.display = text ? 'block' : 'none';
  el.innerHTML = text;
}
"""
CARD_JS = """
([title, sub]) => {
  let el = document.getElementById('demo-card');
  if (!title) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'demo-card'; document.body.appendChild(el); }
  el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:radial-gradient(circle at 70% 30%,#1b2440,#05060a 70%);'
    + 'display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:system-ui,Segoe UI,sans-serif;text-align:center;padding:40px';
  el.innerHTML = '<div style="font:800 64px/1.1 system-ui">' + title + '</div>'
    + '<div style="font:500 28px/1.45 system-ui;margin-top:22px;max-width:1000px;opacity:.9">' + sub + '</div>';
}
"""


def wait_ready(page, extra=0.5):
    """Wait until Streamlit is no longer running the script."""
    time.sleep(0.6)
    for _ in range(120):
        if page.locator('[data-testid="stStatusWidget"]').count() == 0:
            break
        time.sleep(0.25)
    time.sleep(extra)


def caption(page, text):
    page.evaluate(CAPTION_JS, text)


def card(page, title, sub=""):
    page.evaluate(CARD_JS, [title, sub])


def scroll_to(page, locator):
    locator.first.scroll_into_view_if_needed()
    page.evaluate("window.scrollBy(0, 0)")


with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, record_video_dir=str(OUT),
                              record_video_size={"width": 1280, "height": 720}, color_scheme="dark")
    page = ctx.new_page()
    T0 = time.time()
    page.goto(BASE + "?site=malapert_massif&start=2027-09-09T00:00")
    page.wait_for_selector("text=Can a solar lander survive here?", timeout=120_000)
    wait_ready(page, 2)
    page.add_style_tag(content='[data-testid="stHeader"],[data-testid="stToolbar"],[data-testid="stStatusWidget"]'
                               '{visibility:hidden !important}')
    t_start = time.time()

    # 1. title card
    card(page, "LunaNav", "Where and when should a lander touch down at the Moon's south pole?<br>"
                          "Sunlight for power, Earth in the sky to call home.")
    time.sleep(4.0)
    card(page, "")

    # 2. the published spot: NO-GO
    page.locator("text=NO-GO").first.scroll_into_view_if_needed()
    page.mouse.wheel(0, -260)
    caption(page, "Malapert Massif, the spot NASA lists for this Artemis III region. Landing 9 Sept 2027: "
                  "<span style='color:#ff6b6b'>NO-GO</span>. The battery dies after 10 hours.")
    time.sleep(5.5)

    # 3. the animation: the Sun hides behind the terrain
    scroll_to(page, page.locator("text=What the lander sees"))
    page.mouse.wheel(0, 120)
    caption(page, "What the lander sees: near the pole the Sun circles the horizon and hides behind a hill for days.")
    time.sleep(1.2)
    page.locator(".updatemenu-button").first.click()
    time.sleep(7.5)

    # 4. waiting does not help, other spots do
    scroll_to(page, page.locator("text=If the launch slips"))
    caption(page, "Waiting a month doesn't save it. But on the same date, two other spots are "
                  "<span style='color:#4ade80'>GO</span>.")
    time.sleep(5.5)

    # 5. 5 km away: GO
    page.evaluate("window.scrollTo(0, 0)")
    caption(page, "")
    page.get_by_text("Malapert: 5 km away", exact=True).first.click()
    wait_ready(page)
    page.locator("text=GO").first.scroll_into_view_if_needed()
    page.mouse.wheel(0, -260)
    caption(page, "Only 5 km away on the same mountain: <span style='color:#4ade80'>GO</span>. "
                  "Sunlight and contact with Earth 100% of the time.")
    time.sleep(5.5)

    # 6. 3D terrain with real shadows
    page.locator(".js-plotly-plot").nth(1).evaluate("el => el.scrollIntoView({block: 'center'})")
    page.mouse.wheel(0, 60)
    caption(page, "40 km of NASA LOLA terrain in 3D, with the shadows the real Sun casts hour by hour.")
    time.sleep(3.0)
    slider = page.locator('[data-testid="stSlider"]').filter(has_text="Hour of the mission").get_by_role("slider")
    slider.focus()
    for _ in range(4):
        for _ in range(30):
            page.keyboard.press("ArrowRight")
        wait_ready(page, 0.6)
    time.sleep(1.0)

    # 7. any point
    page.evaluate("window.scrollTo(0, 0)")
    caption(page, "")
    page.get_by_text("Any point", exact=False).first.click()
    wait_ready(page)
    scroll_to(page, page.locator(".js-plotly-plot").first)
    caption(page, "Or pick any point near the pole: its horizon is traced live from NASA terrain.")
    time.sleep(5.0)

    # 8. Türkçe
    page.evaluate("window.scrollTo(0, 0)")
    page.get_by_text("Türkçe", exact=True).first.click()
    wait_ready(page)
    caption(page, "English / Türkçe")
    time.sleep(3.0)

    # 9. closing card
    caption(page, "")
    card(page, "LunaNav", "limitlessapps.streamlit.app<br>github.com/yutuf/lmNasa<br><br>"
                          "<span style='font-size:22px;opacity:.75'>NASA LOLA terrain · JPL DE440 ephemeris, checked "
                          "against JPL Horizons · NASA Deep Space Network geometry · open source</span>")
    time.sleep(4.5)
    print("content starts at", round(t_start - T0, 2), "s")
    video = page.video.path()
    ctx.close()
    browser.close()
    print("video:", video)
