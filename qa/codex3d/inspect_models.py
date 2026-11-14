import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--use-angle=d3d11','--ignore-gpu-blocklist'])
    pg = b.new_page()
    pg.goto('http://127.0.0.1:5174/')
    data = pg.evaluate('''async () => {
      const T=await import('/node_modules/three/build/three.module.js');
      const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const {DRACOLoader}=await import('/node_modules/three/examples/jsm/loaders/DRACOLoader.js');
      const l=new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
      const out={};
      for(const file of ['rover','pragyan','yutu','lrv']) {
        const {scene}=await l.loadAsync('/models/'+file+'.glb');
        const drops=[]; scene.traverse(o=>{if(/^(floor|ground|plane|backdrop)/i.test(o.name))drops.push(o)}); drops.forEach(o=>o.removeFromParent());
        scene.updateMatrixWorld(true); const box=new T.Box3().setFromObject(scene), c=box.getCenter(new T.Vector3()), e=box.getSize(new T.Vector3());
        const turn=e.z>e.x, len=Math.max(e.x,e.z), pts=[], v=new T.Vector3();
        scene.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position; for(let i=0;i<p.count;i++){
          v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld); const x=(v.x-c.x)/len, y=(v.y-box.min.y)/len,z=(v.z-c.z)/len;
          if(y<.32 && Math.abs(turn?x:z)>.16)pts.push([turn?z:x,y,turn?-x:z]);
        }}}); out[file]=pts;
      } return out;
    }''')
    b.close()
Path('qa/codex3d/wheel-points.json').write_text(json.dumps(data),encoding='utf-8')
im=Image.new('RGB',(1000,1100),'#111111'); d=ImageDraw.Draw(im)
for i,(name,pts) in enumerate(data.items()):
    d.text((10,i*270+5),name,fill='white')
    for x,y,z in pts:
        d.point((int(500+x*900),int(i*270+255-y*700)),fill=('#aaaaaa' if z>0 else '#665522'))
im.save('qa/codex3d/wheel-sideviews.png')
