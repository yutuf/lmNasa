"""Screenshots of the web app for the README (needs the dev server: cd web && npm run dev).

Run: .venv/Scripts/python scripts/web_screenshots.py [http://localhost:5173]
Writes docs/web-search.png, docs/web-site.png, docs/web-lander.png, docs/web-rover.png.
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
DOCS = Path(__file__).resolve().parents[1] / "docs"
HASH = "#lang=en&start=2027-09-01&window=30&days=14&sun=70&earth=50&shadow=48&batt=2000&slope=8&dsn=1"


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", args=["--use-angle=d3d11", "--enable-gpu"])
        pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        pg.goto(URL + "/" + HASH)
        pg.wait_for_selector(".table tbody tr", timeout=60000)
        pg.wait_for_timeout(6000)
        pg.screenshot(path=str(DOCS / "web-search.png"))
        pg.locator("#site").scroll_into_view_if_needed()
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(DOCS / "web-site.png"))
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
