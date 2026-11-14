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
    for name in ['rover','pragyan','yutu','lrv']:
        pg.evaluate("""async name => {
          const T=await import('/node_modules/three/build/three.module.js');
          const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
          const {DRACOLoader}=await import('/node_modules/three/examples/jsm/loaders/DRACOLoader.js');
          const {scene:root}=await new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/')).loadAsync('/models/'+name+'.glb');
          const drop=[];root.traverse(o=>{if(/^(floor|ground|plane|backdrop)/i.test(o.name))drop.push(o)});drop.forEach(o=>o.removeFromParent());
          const box=new T.Box3().setFromObject(root),e=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3());
          root.position.set(-c.x,-box.min.y,-c.z);const g=new T.Group();g.add(root);if(e.z>e.x)g.rotation.y=Math.PI/2;g.scale.setScalar(2/Math.max(e.x,e.z));
          const scene=new T.Scene();scene.background=new T.Color('#181818');scene.add(g);scene.add(new T.HemisphereLight(0xffffff,0x777777,3));
          const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,4,6);scene.add(light);
          const camera=new T.PerspectiveCamera(40,1.4,.01,100);camera.position.set(2.4,1.5,3.3);camera.lookAt(0,.6,0);
          const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(700,500);
          document.body.replaceChildren(renderer.domElement);document.body.style.margin='0';renderer.render(scene,camera);window.qaRenderer=renderer;
        }""",name)
        pg.locator('canvas').screenshot(path='qa/codex3d/model-'+name+'.png')
    b.close()
Path('qa/codex3d/wheel-points.json').write_text(json.dumps(data),encoding='utf-8')
im=Image.new('RGB',(1000,1100),'#111111'); d=ImageDraw.Draw(im)
for i,(name,pts) in enumerate(data.items()):
    d.text((10,i*270+5),name,fill='white')
    for x,y,z in pts:
        d.point((int(500+x*900),int(i*270+255-y*700)),fill=('#aaaaaa' if z>0 else '#665522'))
im.save('qa/codex3d/wheel-sideviews.png')
