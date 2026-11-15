import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
results=[]
with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport=dict(width=900,height=700))
    errors=[]
    pg.on('pageerror',lambda e:errors.append(str(e)))
    for kind,ids in [('rover',['viper','pragyan','yutu','lrv']),('lander',['vikram','apollo','hls'])]:
        for id in ids:
            pg.goto(f'http://127.0.0.1:5174/qa3d.html?kind={kind}&id={id}&moving')
            pg.wait_for_function("window.__modelQA && window.__modelQA.scene.getObjectByName('vehicle-' + (['viper','pragyan','yutu','lrv'].includes(new URLSearchParams(location.search).get('id')) ? ({viper:'rover',pragyan:'pragyan',yutu:'yutu',lrv:'lrv'}[new URLSearchParams(location.search).get('id')]+'.glb') : ({vikram:'vikram',apollo:'lander',hls:'starship'}[new URLSearchParams(location.search).get('id')]+'.glb')))",timeout=60000)
            pg.wait_for_timeout(1500)
            def measure():
                return pg.evaluate('''async () => {
                  const T=await import('/node_modules/three/build/three.module.js');
                  const {scene,motion}=window.__modelQA; const root=scene.children.find(o=>o.userData.model);
                  const box=new T.Box3().setFromObject(root,true); const wheels=[];
                  root.traverse(o=>{if(o.name==='wheel-spin')wheels.push({r:o.userData.radius,angle:o.rotation.z,parts:o.children.length,
                    box:new T.Box3().setFromObject(o,true).getSize(new T.Vector3()).toArray(), centre:o.parent.position.toArray()})});
                  return {model:root.userData.model,min:box.min.toArray(),max:box.max.toArray(),wheels,travel:motion.travel,heading:motion.heading};
                }''')
            a=measure()
            pg.wait_for_timeout(1000)
            c=measure()
            pg.screenshot(path=str(ROOT/f'model-fixed-{id}.png'))
            (ROOT/f'model-debug-{id}.json').write_text(json.dumps(a,indent=2),encoding='utf-8')
            for w0,w1 in zip(a['wheels'],c['wheels']):
                expected=-(c['travel']-a['travel'])/w0['r']
                assert abs((w1['angle']-w0['angle'])-expected)<1e-6,(id,w0,w1,expected)
                assert w0['parts']>0,(id,w0)
                assert w0['box'][0] < w0['r']*2.2 and w0['box'][1] < w0['r']*2.2,(id,w0)
            results.append(dict(kind=kind,id=id,first=a,second=c))
            print(id, 'parts', [w['parts'] for w in a['wheels']],flush=True)
    b.close()
(ROOT/'model-checks.json').write_text(json.dumps(dict(results=results,errors=errors),indent=2),encoding='utf-8')
assert not errors,errors
