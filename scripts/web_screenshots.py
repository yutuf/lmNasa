"""Screenshots of the web app for the README (needs the dev server: cd web && npm run dev).

Run: .venv/Scripts/python scripts/web_screenshots.py [http://localhost:5173]
Writes docs/web-simple.png, web-profile.png, web-search.png, web-site.png, web-route.png, web-tradeoff.png, web-artemis.png, web-scenarios.png,
web-lander.png and web-rover.png.
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
DOCS = Path(__file__).resolve().parents[1] / "docs"
HASH = ("#ui=advanced&lang=en&start=2027-09-01&window=30&days=14&sun=70&earth=50&shadow=48&batt=2000&slope=8"
        "&zone=1000&zslope=12&ice=0&dsn=1")


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", args=["--use-angle=d3d11", "--enable-gpu"])
        pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        # the simple interface and a site profile
        pg.goto(URL + "/" + HASH.replace("ui=advanced", "ui=simple"))
        pg.wait_for_selector(".site-card", timeout=60000)
        pg.wait_for_timeout(6000)
        pg.screenshot(path=str(DOCS / "web-simple.png"))
        pg.locator(".site-card").first.click()
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(DOCS / "web-profile.png"))
        pg.keyboard.press("Escape")
        pg.goto("about:blank")
        pg.goto(URL + "/" + HASH)
        pg.wait_for_selector(".table tbody tr", timeout=60000)
        pg.wait_for_timeout(6000)
        pg.screenshot(path=str(DOCS / "web-search.png"))
        pg.locator("#site").scroll_into_view_if_needed()
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(DOCS / "web-site.png"))
        for card, name in (("#tradeoff", "web-tradeoff.png"), ("#artemis", "web-artemis.png")):
            pg.locator(card).scroll_into_view_if_needed()
            pg.wait_for_timeout(800)
            pg.locator(card).screenshot(path=str(DOCS / name))
        pg.locator(".map-card").scroll_into_view_if_needed()
        pg.get_by_role("button", name="Route", exact=True).click()
        pg.wait_for_timeout(6000)
        pg.locator(".map-card").screenshot(path=str(DOCS / "web-route.png"))
        pg.get_by_role("button", name="Results", exact=True).click()
        pg.get_by_role("button", name="Simulate all scenarios").click()
        pg.wait_for_selector("#scenarios", timeout=60000)
        pg.wait_for_timeout(1000)
        pg.locator("#scenarios").screenshot(path=str(DOCS / "web-scenarios.png"))
        pg.locator("#site").scroll_into_view_if_needed()
        pg.get_by_role("button", name="Stand on the lander").click()
        pg.wait_for_timeout(12000)
        pg.screenshot(path=str(DOCS / "web-lander.png"))
        pg.get_by_role("button", name="Deploy the rover").click()
        pg.keyboard.down("w")
        pg.wait_for_timeout(4000)
        pg.keyboard.up("w")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(DOCS / "web-rover.png"))
        b.close()
    print("ok")


if __name__ == "__main__":
    main()
