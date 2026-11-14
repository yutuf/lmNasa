import json
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
points={}
with sync_playwright() as p:
    b=p.chromium.launch(channel='msedge',args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    pg=b.new_page()
    for name in ['viper','pragyan','yutu','lrv']:
        pg.goto('http://127.0.0.1:5174/qa3d.html?id='+name)
        pg.wait_for_function("window.__modelQA && window.__modelQA.scene.children.some(o=>o.userData.model)",timeout=60000)
        points[name]=pg.evaluate('''async () => {
          const T=await import('/node_modules/three/build/three.module.js'), pts=[], v=new T.Vector3();
          const root=window.__modelQA.scene.children.find(o=>o.userData.model);root.updateMatrixWorld(true);
          root.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){
            v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);if(v.y<.4)pts.push(v.toArray());}}});return pts;
        }''')
    b.close()
Path('qa/codex3d/rig-points.json').write_text(json.dumps(points),encoding='utf-8')
im=Image.new('RGB',(1200,1200),'#111111');d=ImageDraw.Draw(im)
for k,(name,pts) in enumerate(points.items()):
    d.text((10,k*300+5),name,fill='white')
    scale=500/(3.1 if name in ('lrv','viper') else 1.2)
    for x,y,z in pts:
        d.point((int(300+x*scale),int(k*300+240-y*scale)),fill='#aaaaaa')
        d.point((int(900+x*scale),int(k*300+150+z*scale)),fill='#aaaaaa')
im.save('qa/codex3d/rig-points.png')
