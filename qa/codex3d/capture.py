"""Production-preview Edge capture: six frames and four seconds of RAF per mode."""
import json
import re
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parent
PHASE=sys.argv[1] if len(sys.argv)>1 else 'before'
BASE='http://127.0.0.1:4173/'
HASH='#ui=simple&lang=en&start=2027-09-01&window=30&days=14&sun=70&earth=50&shadow=48&batt=2000&slope=8&zone=5000&zslope=12&ice=0&dsn=1'
DUR=dict(title=5,launch=10,window=6,coast=6,descent=7,landing=30,site=9,ellipse=6,rover=13,odds=7,verdict=9)
if PHASE!='before':
    profile=(ROOT.parent.parent/'web/src/filmProfile.ts').read_text(encoding='utf-8')
    block=re.search(r'export const FILM_DUR\s*=\s*\{([^}]+)',profile).group(1)
    DUR={k:float(v) for k,v in re.findall(r'(\w+):\s*([\d.]+)',block)}
out=ROOT/PHASE
out.mkdir(parents=True,exist_ok=True)
results=[]
errors=[]

def sequence(pg,name,span):
    pg.evaluate('''() => {window.qaFPS={n:0,start:performance.now(),fps:null};
      const tick=now=>{const m=window.qaFPS;m.n++;if(now-m.start<4000)requestAnimationFrame(tick);
      else m.fps=(m.n-1)*1000/(now-m.start);};requestAnimationFrame(tick);}''')
    start=time.monotonic()
    frames=[]
    for i,fraction in enumerate([.06,.22,.38,.54,.70,.88]):
        delay=start+span*fraction-time.monotonic()
        if delay>0:pg.wait_for_timeout(delay*1000)
        path=out/f'{name}-{i+1:02}.png'
        pg.screenshot(path=str(path))
        frames.append(str(path.relative_to(ROOT)))
    pg.wait_for_function('window.qaFPS.fps !== null',timeout=10000)
    m=pg.evaluate('window.qaFPS')
    results.append(dict(mode=name,fps=m['fps'],frames=frames,hud=pg.locator('#landing-hud,#flight-hud').all_text_contents()))
    (out/'metrics.json').write_text(json.dumps(dict(results=results,errors=errors),indent=2,ensure_ascii=False),encoding='utf-8')
    print(f"{PHASE} {name}: {m['fps']:.1f} fps",flush=True)

def enable_technical(pg):
    # Supported component prop, enabled only in this QA session. The shared App entry is untouched.
    pg.evaluate('''() => {
      const enable=()=>{const el=document.querySelector('.film');if(!el)return;
        const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let f=el[key];
        while(f){const p=f.memoizedProps;if(p&&p.card&&p.globe&&p.chapters){p.technical=true;return;}f=f.return;}};
      enable();window.qaTechnical=setInterval(enable,20);
    }''')
    pg.wait_for_function("document.querySelectorAll('.film-progress button').length>=10")

if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch(channel='msedge',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
        for size,w,h in [('desktop',1440,900),('phone',390,844)]:
            pg=b.new_page(viewport=dict(width=w,height=h),device_scale_factor=1)
            pg.on('pageerror',lambda e:errors.append(str(e)))
            pg.goto(BASE+HASH)
            pg.wait_for_selector('.site-card',timeout=120000)
            pg.wait_for_timeout(6000)
            pg.evaluate('scrollTo(0,0)')
            sequence(pg,f'{size}-hero',4.7)
            pg.get_by_role('button',name='Tell me the mission',exact=True).click()
            pg.wait_for_selector('.film-stage',timeout=30000)
            if PHASE!='before':enable_technical(pg)
            scenes=pg.locator('.film-progress button').evaluate_all('els=>els.map(e=>e.title)')
            for title in scenes:
                pg.locator(f'.film-progress button[title="{title}"]').click()
                if title in ('Touchdown','On the surface'):
                    pg.wait_for_function("!document.querySelector('.fs-ground-loading')",timeout=30000)
                pg.wait_for_timeout(80)
                scene=pg.locator('.film-stage').get_attribute('class').split('s-')[-1]
                sequence(pg,f'{size}-film-{scene}',DUR[scene]*.97)
            pg.locator('.film-ctl button[aria-label="Close"]').click()
            pg.evaluate('clearInterval(window.qaTechnical)')
            pg.get_by_role('button',name='Route',exact=True).click()
            pg.locator('.map-card').scroll_into_view_if_needed()
            pg.wait_for_timeout(2000)
            sequence(pg,f'{size}-route-overview',16)
            buttons=pg.locator('.map-card button').all_text_contents()
            (out/f'{size}-route-buttons.json').write_text(json.dumps(buttons,ensure_ascii=False),encoding='utf-8')
            pg.get_by_role('button',name='Results',exact=True).click()
            for label,mode,span in [('Watch the landing','landing',29),('Drive a rover','rover',7),('Walk on the Moon','walk',7)]:
                pg.locator('.site-card').first.click()
                pg.wait_for_timeout(400)
                button=pg.get_by_role('button',name=label,exact=False)
                if not button.count():raise RuntimeError(f'Missing {label}')
                # Entry is a handler invocation while the independently-owned profile decoration intercepts clicks.
                button.evaluate('(e)=>e.click()')
                pg.wait_for_selector('.drive canvas',timeout=60000)
                pg.wait_for_selector('.drive-loading',state='hidden',timeout=30000)
                pg.wait_for_timeout(200)
                if mode in ('rover','walk'):pg.keyboard.down('w')
                sequence(pg,f'{size}-{mode}',span)
                if mode=='landing' and PHASE!='before':
                    pg.wait_for_function("document.querySelector('#landing-hud')?.dataset.done==='1'",timeout=15000)
                    pg.wait_for_timeout(1800)
                    pg.screenshot(path=str(out/f'{size}-touchdown-settled.png'))
                if mode in ('rover','walk'):pg.keyboard.up('w')
                pg.get_by_role('button',name='Exit',exact=False).first.click()
                pg.wait_for_timeout(400)
            pg.close()
        b.close()
    (out/'metrics-main.json').write_text((out/'metrics.json').read_text(encoding='utf-8'),encoding='utf-8')
