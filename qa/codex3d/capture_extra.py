import json
from capture import BASE, HASH, PHASE, ROOT, out, sequence, errors
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    for size,w,h in [('desktop',1440,900),('phone',390,844)]:
        pg=b.new_page(viewport=dict(width=w,height=h),device_scale_factor=1)
        pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.goto(BASE+HASH)
        pg.wait_for_selector('.site-card',timeout=120000)
        pg.wait_for_timeout(5000)
        pg.locator('.map-card').scroll_into_view_if_needed()
        sequence(pg,f'{size}-orbiter',8)
        pg.get_by_role('button',name='Route',exact=True).click()
        for label,mode in [('Chase','chase'),('Pilot','pilot'),('From the site','site')]:
            pg.get_by_role('button',name=label,exact=True).click()
            pg.wait_for_timeout(300)
            sequence(pg,f'{size}-route-{mode}',32 if mode!='site' else 22)
        pg.get_by_role('button',name='Results',exact=True).click()
        pg.locator('.site-card').first.click()
        pg.get_by_role('button',name='Drive a rover',exact=False).click()
        pg.wait_for_selector('.drive canvas',timeout=60000)
        pg.wait_for_timeout(2000)
        pg.get_by_role('button',name='Plan a sunlit route',exact=False).click()
        pg.wait_for_timeout(5000)
        sequence(pg,f'{size}-autopilot',10)
        # Every surface HUD button must actually receive the hit at its centre.
        hits=pg.locator('.hud.bottom-right button').evaluate_all('''els => els.map(e=>{const r=e.getBoundingClientRect();
          const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:e.textContent,rect:r.toJSON(),clickable:hit===e||e.contains(hit)}})''')
        (out/f'{size}-hud-hits.json').write_text(json.dumps(hits,indent=2),encoding='utf-8')
        pg.close()
    b.close()
    # Keep the main capture metrics separate.
    (out/'metrics-extra.json').write_text((out/'metrics.json').read_text(encoding='utf-8'),encoding='utf-8')
