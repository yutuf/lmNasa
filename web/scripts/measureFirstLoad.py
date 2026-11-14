"""Run with ..\\.venv\\Scripts\\python scripts/measureFirstLoad.py before|after.

Serve an unmodified/modified production build on port 4173 first. Only localhost is fetched.
Print JSON; redirect to a report attachment if desired. No packages or browser downloads.
"""
import json
import sys
from playwright.sync_api import sync_playwright

ORIGIN = "http://localhost:" + (sys.argv[2] if len(sys.argv) > 2 else "4173")
URL = ORIGIN + "/#ui=simple&lang=en&start=2027-09-01&window=30&days=14&sun=70&earth=50&shadow=48&batt=2000&slope=8&zone=1000&zslope=12&ice=0&dsn=1"


def measure(page, label):
    page.goto("about:blank")
    session = page.context.new_cdp_session(page)
    session.send("Network.enable")
    rows = {}
    session.on("Network.responseReceived", lambda e: rows.setdefault(e["requestId"], {}).update(
        url=e["response"]["url"], encoding=e["response"].get("headers", {}).get("Content-Encoding"),
        cached=e["response"].get("fromDiskCache", False), sw=e["response"].get("fromServiceWorker", False)))
    session.on("Network.dataReceived", lambda e: rows.setdefault(e["requestId"], {}).update(
        received=rows.get(e["requestId"], {}).get("received", 0) + e.get("encodedDataLength", 0)))
    session.on("Network.loadingFinished", lambda e: rows.setdefault(e["requestId"], {}).update(
        received=e["encodedDataLength"]))
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_selector(".site-card", timeout=120000)
    # Flush the browser's paint; includes bytes received on requests still in flight.
    page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    result = {"label": label, "first_card_ms": page.evaluate("performance.now()"),
              "wire_bytes_through_first_card": sum(r.get("received", 0) for r in rows.values()),
              "requests_through_first_card": [dict(r) for r in rows.values() if r.get("url", "").startswith(ORIGIN)]}
    page.wait_for_timeout(5000)
    result["requests_after_5s"] = [dict(r) for r in rows.values() if r.get("url", "").startswith(ORIGIN)]
    session.detach()
    return result


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge")
        context = browser.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
        context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(ORIGIN + "/") else route.abort())
        page = context.new_page()
        result = [measure(page, sys.argv[1] + " cold")]
        context.close()
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(ORIGIN + "/") else route.abort())
        page = context.new_page()
        measure(page, sys.argv[1] + " SW prime")
        page.evaluate("navigator.serviceWorker.ready.then(() => navigator.serviceWorker.controller || new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, {once:true})))")
        result.append(measure(page, sys.argv[1] + " warm SW"))
        context.set_offline(True)
        result.append(measure(page, sys.argv[1] + " offline SW"))
        print(json.dumps(result, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
