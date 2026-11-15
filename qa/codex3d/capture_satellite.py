from capture import BASE, HASH, out, sequence
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    for size,w,h in [('desktop',1440,900),('phone',390,844)]:
        pg=b.new_page(viewport=dict(width=w,height=h),device_scale_factor=1)
        pg.goto(BASE+HASH.replace('ui=simple','ui=advanced'))
        pg.wait_for_selector('.table tbody tr',timeout=120000)
        pg.get_by_role('button',name='Workshop',exact=True).evaluate('(e)=>e.click()')
        pg.get_by_role('button',name='Satellite',exact=True).click()
        pg.get_by_role('button',name='Elliptical frozen orbit',exact=False).click()
        pg.get_by_role('button',name='Put it in orbit',exact=False).click()
        pg.wait_for_timeout(2000)
        pg.locator('.map-card').scroll_into_view_if_needed()
        sequence(pg,f'{size}-satellite-elfo',12)
        pg.close()
    b.close()
    (out/'metrics-satellite.json').write_text((out/'metrics.json').read_text(encoding='utf-8'),encoding='utf-8')
