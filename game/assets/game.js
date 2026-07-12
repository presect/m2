// Maxi Coast Rush - Couch Edition. Two players, one screen, zero network.
// One shared THREE scene is re-laid per viewport pass (world positions are
// relative to each viewer), rendered twice with scissors when both play.
import { STR } from './strings.js';

/* =================== ASSET URLS (Higgsfield CDN, loaded at runtime) =================== */
const CDN='./assets/cdn/';
const ASSETS = {
  can_label:  CDN+'hf_20260707_152734_938a9b77-fb03-4951-87da-60859e37b68b.png',
  tile_seabed:CDN+'hf_20260707_152746_5fb55845-7477-40ea-acec-dca8805de14f.png',
  tile_beach: CDN+'hf_20260707_152755_3b482363-012c-4a1d-9a17-86e215d05f4e.png',
  tile_desert:CDN+'hf_20260707_180620_084e6bb7-7ddb-47a5-8f3a-3941227738c2.png',
  tile_necro: CDN+'hf_20260707_201358_232701be-ceec-48f1-af5f-7c4e41e92213.png',
  spr_coral:  CDN+'hf_20260707_184220_51693c13-1892-4958-8b36-fdaaccbf44bf.png',
  spr_coral2: CDN+'hf_20260707_184455_3966b0cd-79f8-4f2d-8d54-1756181f233c.png',
  spr_palm:   CDN+'hf_20260707_152821_916e9273-21ea-483c-9bde-29582dd7531d.png',
  spr_rock:   CDN+'hf_20260707_152831_cf463bf6-a327-4a70-b2fe-0e3eedc5028b.png',
  sfx_pickup: CDN+'hf_20260707_152917_7ada5403-a7b5-4b0f-90fa-d18ed4fb53a0.mp3',
  sfx_rotten: CDN+'hf_20260707_152925_c1dc2918-6fcf-4d62-8610-d65eed931acd.mp3',
  sfx_boost:  CDN+'hf_20260707_152936_ae308f1a-e785-42fc-860a-2f6ac8ae76a0.mp3',
  sfx_finish: CDN+'hf_20260707_152943_b7ef29a5-1ffe-4e26-b2ee-5a5052a1ecbf.mp3',
  sfx_surf:   CDN+'hf_20260707_152952_2f6d0ab4-9a63-4d95-a7de-916ba17761ae.mp3'
};

/* =================== tunables =================== */
const MIN_SPEED=20, MAX_SPEED=58, LANE=4.2, STAGE_LEN=720;
const RACE_SECONDS=163, ITEM_HIT_D=6.0, ITEM_HIT_X=1.7;

/* =================== deterministic world (seeded) =================== */
function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function buildItems(seed){const rng=mulberry32(seed);const items=[];let d=40;while(d<18000){d+=14+rng()*16;const x=(rng()*2-1)*LANE;const r=rng();const kind=r<0.30?0:r<0.55?1:r<0.70?2:3;items.push({d,x,kind});}return items;}
function buildPatches(seed){const rng=mulberry32(seed^0x9e3779b9);const p=[];for(let c=0;c<9;c++){const base=c*6*STAGE_LEN+STAGE_LEN;for(let i=0;i<6;i++)p.push({d:base+60+rng()*(STAGE_LEN-140),x:(rng()*2-1)*(LANE-0.8),r:2.2+rng()*1.4});}return p;}
function buildWeeds(seed){const rng=mulberry32(seed^0x51ed270b);const w=[];for(let c=0;c<9;c++){const base=c*6*STAGE_LEN+2*STAGE_LEN;for(let i=0;i<5;i++)w.push({d:base+80+rng()*(STAGE_LEN-160),amp:2.0+rng()*2.0,w:0.8+rng()*0.9,ph:rng()*6.283});}return w;}
const weedX=(w,t)=>Math.sin(t*w.w+w.ph)*w.amp;
const biomeAt=d=>Math.floor(Math.max(0,d)/STAGE_LEN)%6;

/* ============ context-loss airbag v2: restore-first, bounded retries, black box ======= */
let _phaseTag='boot';
function _overlay(txt){
  let o=document.getElementById('ctxlost');
  if(!o){o=document.createElement('div');o.id='ctxlost';
    o.style.cssText='position:fixed;inset:0;z-index:998;background:#1c1008;color:#f6e2ad;display:flex;align-items:center;justify-content:center;font:700 2.4vw system-ui;letter-spacing:.2em;text-align:center;';
    document.body.appendChild(o);}
  o.textContent=txt;o.style.display='flex';return o;
}
try{ // black box: report why the last session restarted
  const last=sessionStorage.getItem('mx_lastloss');
  if(last)window.onerror&&window.onerror('prev session: GPU context lost @'+last,'',0,0);
}catch(_){}
document.getElementById('c').addEventListener('webglcontextlost',(e)=>{
  e.preventDefault(); // allow the browser to restore it
  try{sessionStorage.setItem('mx_lastloss',_phaseTag);}catch(_){}
  const o=_overlay('GPU HICCUP - RECOVERING...');
  let n=0;try{n=+(sessionStorage.getItem('mx_restarts')||0);}catch(_){}
  const t=setTimeout(()=>{
    if(n>=2){ // stop looping: hand control to a human
      _overlay('GPU ERROR - PRESS ANY BUTTON / KEY TO RETRY');
      const retry=()=>{try{sessionStorage.setItem('mx_restarts','0');}catch(_){}location.reload();};
      addEventListener('keydown',retry,{once:true});
      addEventListener('pointerdown',retry,{once:true});
      const poll=setInterval(()=>{const gp=(navigator.getGamepads?navigator.getGamepads():[])[0];
        if(gp&&gp.buttons.some(b=>b.pressed)){clearInterval(poll);retry();}},250);
    }else{
      try{sessionStorage.setItem('mx_restarts',String(n+1));}catch(_){}
      location.reload();
    }
  },4000);
  document.getElementById('c').addEventListener('webglcontextrestored',()=>{
    clearTimeout(t);o.style.display='none';
    try{sessionStorage.setItem('mx_restarts','0');}catch(_){}
  },{once:true});
},false);
/* =================== error reporter (visible on screen) =================== */
window.onerror=function(msg,src,line,col){
  let e=document.getElementById('errbox');
  if(!e){e=document.createElement('div');e.id='errbox';
    e.style.cssText='position:fixed;top:4px;left:4px;z-index:999;background:rgba(120,0,0,.9);color:#fff;font:12px monospace;padding:6px 10px;border-radius:6px;max-width:80vw;';
    document.body.appendChild(e);}
  const t='ERR: '+msg+' @'+(src||'').split('/').pop()+':'+line+':'+col;
  if(!e.textContent)e.textContent=t;
  else if(e.textContent.split(' || ').length<3&&!e.textContent.includes(t))e.textContent+=' || '+t;
};
/* =================== DOM + strings =================== */
const $=id=>document.getElementById(id);
const frame=$('frame'), canvas=$('c');
$('tagline').textContent=STR.tagline;
$('slotName0').textContent='PLAYER 1';$('slotName1').textContent='PLAYER 2';
$('slotSt0').textContent=STR.pressJoin;$('slotSt1').textContent=STR.pressJoin;
$('startHint').textContent=STR.pressStart;
$('hints').innerHTML=[STR.padHint,STR.kbHintP1,STR.kbHintP2].join('<br>');
$('ver').textContent=STR.version;
$('tag0').textContent=STR.p1;$('tag1').textContent=STR.p2;
$('scoreCap0').textContent=STR.hudScore;$('scoreCap1').textContent=STR.hudScore;
$('timeCap').textContent=STR.hudTime;
$('finishTitle').textContent=STR.finishTitle;
$('againPrompt').textContent=STR.again;$('lobbyPrompt').textContent=STR.toLobby;
$('thead').innerHTML=['',STR.colPlayer,STR.colScore,STR.colDist,STR.colTotal].map(s=>`<th>${s}</th>`).join('');

/* =================== renderer + 16:9 frame lock =================== */
const IS_XBOX=/Xbox/i.test(navigator.userAgent);
const _q=new URLSearchParams(location.search);
const ULTRA=(IS_XBOX||_q.has('ultra'))&&!_q.has('full')&&!_q.has('lite');
const LITE=ULTRA||(_q.has('lite')&&!_q.has('full'));
const renderer=new THREE.WebGLRenderer({canvas,antialias:!IS_XBOX,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
const DPR_CAP=ULTRA?0.8:LITE?1.0:2.0;
let DPR=Math.min(window.devicePixelRatio||1,DPR_CAP);
let VW=1280,VH=720;
function resize(){
  const W=innerWidth,H=innerHeight,t=16/9;
  if(W/H>t){VH=H;VW=H*t;}else{VW=W;VH=W/t;}
  frame.style.width=VW+'px';frame.style.height=VH+'px';
  renderer.setPixelRatio(DPR);renderer.setSize(VW,VH,false);
  updateCameras();
}
addEventListener('resize',resize);addEventListener('orientationchange',resize);

/* =================== scene =================== */
const scene=new THREE.Scene();
if(!ULTRA){ // image-based lighting: gives metals (the cans!) something to reflect
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new THREE.RoomEnvironment(),0.04).texture;
  pmrem.dispose();
}
scene.background=new THREE.Color(0x0a3d62);
scene.fog=new THREE.Fog(0x0a3d62,26,220);
const cams=[new THREE.PerspectiveCamera(62,16/9,0.1,400),new THREE.PerspectiveCamera(62,16/9,0.1,400)];
cams.forEach(c=>{c.position.set(0,4.4,8.6);});
function updateCameras(){
  const split=P[0].joined&&P[1].joined;
  for(const c of cams){c.aspect=split?(16/9)*2:(16/9);c.fov=split?46:62;c.updateProjectionMatrix();}
}
const hemi=new THREE.HemisphereLight(0x88bbff,0x224455,0.95);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.1);sun.position.set(-6,12,4);scene.add(sun);
scene.add(new THREE.AmbientLight(0x4477bb,ULTRA?0.9:0.62));

/* biome palettes - teal deep / golden hour / bright amber, per the style formula */
const BIO=[
 {bg:0x0a3a5c,fog:0x0a3a5c,hs:0x2a7ea8,hg:0x061826,sun:0xaad4e8,si:0.95,near:12,far:160},
 {bg:0x8fd2f0,fog:0xcfeaff,hs:0xcdeeff,hg:0xe8d6a8,sun:0xffffff,si:1.45,near:45,far:250},
 {bg:0xf6b070,fog:0xf0a26a,hs:0xffcf95,hg:0x8a5a34,sun:0xffab55,si:1.3,near:40,far:240},
 {bg:0x191231,fog:0x191231,hs:0x4a3a78,hg:0x0e0818,sun:0x9a7fd0,si:0.6,near:14,far:130},
 {bg:0xe8541a,fog:0xd94e14,hs:0xff9a5a,hg:0x3a1408,sun:0xffb040,si:1.2,near:30,far:220},
 {bg:0x2fd0e4,fog:0x7fd8e4,hs:0xcaf6f2,hg:0x2a7a8a,sun:0xffffff,si:1.45,near:70,far:320}
];
const _c1=new THREE.Color(),_c2=new THREE.Color();
function applyBiome(dist){
  const cyc=dist/STAGE_LEN,idx=Math.floor(cyc)%6,nxt=(idx+1)%6,f=cyc-Math.floor(cyc);
  const b=f>0.84?(f-0.84)/0.16:0;const A=BIO[idx],B=BIO[nxt];
  scene.background.copy(_c1.setHex(A.bg)).lerp(_c2.setHex(B.bg),b);
  scene.fog.color.copy(_c1.setHex(A.fog)).lerp(_c2.setHex(B.fog),b);
  hemi.color.copy(_c1.setHex(A.hs)).lerp(_c2.setHex(B.hs),b);
  hemi.groundColor.copy(_c1.setHex(A.hg)).lerp(_c2.setHex(B.hg),b);
  sun.color.copy(_c1.setHex(A.sun)).lerp(_c2.setHex(B.sun),b);
  sun.intensity=A.si+(B.si-A.si)*b;
  const _ff=ULTRA?0.8:LITE?0.85:1;
  scene.fog.near=A.near+(B.near-A.near)*b;scene.fog.far=(A.far+(B.far-A.far)*b)*_ff;
  return {idx,nxt,b};
}

/* =================== asset loading, chroma key, fallbacks =================== */
function loadImage(url){return new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=url;});}
function readable(img){try{const c=document.createElement('canvas');c.width=c.height=2;
  const x=c.getContext('2d');x.drawImage(img,0,0,2,2);x.getImageData(0,0,1,1);return true;}catch(e){return false;}}
function chromaKey(img,key){
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
  const x=c.getContext('2d');x.drawImage(img,0,0);
  const d=x.getImageData(0,0,c.width,c.height),p=d.data;
  const kr=(key>>16)&255,kg=(key>>8)&255,kb=key&255;
  for(let i=0;i<p.length;i+=4){
    const dr=p[i]-kr,dg=p[i+1]-kg,db=p[i+2]-kb;
    const dist=Math.sqrt(dr*dr+dg*dg+db*db);
    if(dist<110)p[i+3]=Math.max(0,Math.min(255,(dist-60)*5));
    // despill: pull edge pixels away from the key color so no halo remains
    if(p[i+3]<255){
      if(kg===255){const m=p[i+1]-Math.max(p[i],p[i+2]);if(m>0)p[i+1]-=m*0.85;}      // green key
      else{const m=(p[i]+p[i+2])/2-p[i+1];if(m>0){p[i]-=m*0.8;p[i+2]-=m*0.8;}}       // magenta key
    }
  }
  x.putImageData(d,0,0);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function tileTexture(img){
  let src=img;
  if(LITE&&img.width>512){ // console VRAM diet: repeated tiles never need more than 512
    const c=document.createElement('canvas');c.width=c.height=512;
    c.getContext('2d').drawImage(img,0,0,512,512);src=c;
  }
  const t=new THREE.Texture(src);t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;t.anisotropy=LITE?4:(renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():8);return t; // seam-proof wrap
}
function fbTile(hex,hex2){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  x.fillStyle=hex;x.fillRect(0,0,256,256);x.fillStyle=hex2;
  for(let i=0;i<420;i++){x.globalAlpha=0.12+Math.random()*0.15;
    x.beginPath();x.arc(Math.random()*256,Math.random()*256,1+Math.random()*2.5,0,7);x.fill();}
  x.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;return t;}
function fbSprite(painter){const c=document.createElement('canvas');c.width=c.height=256;
  painter(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const paintCoral=x=>{
  // realistic mixed reef silhouette: branching coral + brain lumps + sea fan
  const palette=['#b84a2e','#c98a3a','#7a4b7a','#5b8a6b','#d97a4a','#8a3b52'];
  const pick=()=>palette[(Math.random()*palette.length)|0];
  // dark base shadow
  x.fillStyle='rgba(6,20,32,0.55)';x.beginPath();x.ellipse(128,246,110,14,0,0,7);x.fill();
  // brain coral lumps at base
  for(let i=0;i<7;i++){const c=pick();x.fillStyle=c;
    const bx=40+i*28+(Math.random()*10-5),by=236-Math.random()*18;
    x.beginPath();x.arc(bx,by,14+Math.random()*10,0,7);x.fill();
    // highlight
    x.fillStyle='rgba(255,240,220,0.18)';x.beginPath();x.arc(bx-4,by-5,5+Math.random()*3,0,7);x.fill();}
  // branching coral fingers
  for(let i=0;i<6;i++){const c=pick();x.fillStyle=c;
    const rx=60+i*28+(Math.random()*8-4);
    const h=90+Math.random()*90;
    x.beginPath();x.ellipse(rx,240-h*0.5,10+Math.random()*4,h,(Math.random()*0.4-0.2),0,7);x.fill();
    // little branches
    for(let j=0;j<3;j++){x.beginPath();
      x.ellipse(rx+(Math.random()*24-12),240-h*0.7-j*18,5,18+Math.random()*10,(Math.random()*1.2-0.6),0,7);x.fill();}}
  // sea fan (translucent)
  x.globalAlpha=0.7;x.fillStyle='#a04868';
  x.beginPath();x.moveTo(180,240);
  for(let a=-1.1;a<=1.1;a+=0.08){const r=70+Math.random()*10;
    x.lineTo(180+Math.sin(a)*r,240-Math.cos(a)*r);}
  x.closePath();x.fill();
  x.globalAlpha=1;
  // sparse algae strands
  x.strokeStyle='#3d6a4a';x.lineWidth=3;
  for(let i=0;i<5;i++){x.beginPath();const sx=30+Math.random()*200;
    x.moveTo(sx,250);x.quadraticCurveTo(sx+10,180,sx+(Math.random()*20-10),120+Math.random()*40);x.stroke();}
};
const paintPalm=x=>{x.fillStyle='#8a5a2b';x.fillRect(118,90,20,166);x.fillStyle='#2f9e4f';
  for(let a=0;a<6;a++){x.save();x.translate(128,95);x.rotate(a*1.05-2.6);
  x.beginPath();x.ellipse(55,0,60,16,0,0,7);x.fill();x.restore();}};
const paintRock=x=>{x.fillStyle='#b0603a';x.beginPath();x.moveTo(30,256);x.lineTo(60,90);
  x.lineTo(120,40);x.lineTo(190,80);x.lineTo(226,256);x.closePath();x.fill();
  x.fillStyle='#8a4426';x.fillRect(90,120,60,136);};
function fbWater(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  x.fillStyle='#1e5fd0';x.fillRect(0,0,256,256);
  x.strokeStyle='rgba(120,190,255,.5)';x.lineWidth=2;
  for(let i=0;i<26;i++){x.beginPath();const y=Math.random()*256;
    x.moveTo(Math.random()*40,y);
    for(let px=0;px<256;px+=24)x.quadraticCurveTo(px+12,y+(Math.random()*8-4),px+24,y);
    x.stroke();}
  x.fillStyle='rgba(40,90,200,.35)';
  for(let i=0;i<30;i++){x.beginPath();x.arc(Math.random()*256,Math.random()*256,8+Math.random()*20,0,7);x.fill();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;return t;}
function fbLabel(){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#cfe25a');g.addColorStop(1,'#8fae2a');
  x.fillStyle=g;x.fillRect(0,0,512,256);x.fillStyle='#e9c877';x.font='bold 84px Segoe UI, Arial';
  x.textAlign='center';x.fillText('MAXI',256,110);x.font='bold 64px Segoe UI, Arial';x.fillText('RUSH',256,180);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const TEX={};
/* splash preloader: real progress across every asset, gate the lobby */
let assetsReady=false;let _ldDone=0,_ldTotal=28; // recalculated per mode at load
const _splashT0=performance.now();
function tick(){_ldDone++;const p=Math.min(100,Math.round(100*_ldDone/_ldTotal));
  const b=document.getElementById('spBar'),t=document.getElementById('spTxt');
  if(b)b.style.width=p+'%';if(t)t.textContent='LOADING '+p+'%';}
async function warmUp(){
  const frame=()=>new Promise(r=>requestAnimationFrame(r));
  const t=document.getElementById('spTxt');
  const say=(x)=>{if(t)t.textContent=x;};
  try{
    _phaseTag='warmup:textures';say('OPTIMIZING GPU... 1/3');
    // textures in small chunks, one chunk per frame
    const texes=[TEX.seabed,TEX.beach,TEX.desert,TEX.necro,TEX.lavaT,TEX.waterT,TEX.label,TEX.coral,TEX.coral2,TEX.palm,TEX.rock,PATH_STONE,PATH_COBBLE,SPARK_TEX,BUB_TEX,...BB_TEXES].filter(Boolean);
    scene.traverse(o=>{if(o.material){const m=o.material;
      for(const k of ['map','normalMap','emissiveMap','roughnessMap','metalnessMap','aoMap'])
        if(m[k])texes.push(m[k]);}});
    for(let i=0;i<texes.length;i+=6){
      for(let j=i;j<Math.min(texes.length,i+6);j++)renderer.initTexture(texes[j]);
      await frame();
    }
    _phaseTag='warmup:shaders';say('OPTIMIZING GPU... 2/3');
    renderer.compile(scene,cams[0]);
    await frame();
    _phaseTag='warmup:worlds';say('OPTIMIZING GPU... 3/3');
    // render the scene in SMALL visibility batches - never one giant submission
    const groups=[];
    const kids=scene.children.slice();
    for(let i=0;i<kids.length;i+=12)groups.push(kids.slice(i,i+12));
    for(const g of groups){
      const saved=g.map(o=>[o,o.visible]);
      for(const o of g)o.visible=true;
      renderer.render(scene,cams[0]);
      for(const [o,v] of saved)o.visible=v;
      await frame();
    }
    // each ground tile once, one per frame
    for(const idx of [0,1,2,3,4,5]){
      setGroundTex(matA,idx);renderer.render(scene,cams[0]);await frame();
    }
    matA.map=null;setGroundTex(matA,0);
    _phaseTag='race-ready';
    try{sessionStorage.setItem('mx_restarts','0');}catch(_){}
  }catch(e){}
}
function finishSplash(){
  try{if(LITE){const st=document.getElementById('spSub');if(st)st.textContent='COAST RUSH - CONSOLE MODE';}}catch(_){}
  const wait=Math.max(0,1400-(performance.now()-_splashT0));
  setTimeout(()=>{assetsReady=true;
    const sp=document.getElementById('splash');if(sp)sp.className='layer done';},wait);
}
/* real 3D desert environment (user-licensed pack) - flanks Amber Rush */
let envReady=false;const ENV_S=0.0578,ENV_L=2595*ENV_S,ENV_X=92,ENV_Y=2.43;
const envPool=[];
/* town corridor (user-licensed city street slice) - mid-desert landmark */
let cityReady=false;const CITY_S=0.775,CITY_LEN=206*CITY_S,CITY_NEARZ=0.75,CITY_Y=2.41*CITY_S-0.6;
const cityInst=[];
const CYCLE=6*STAGE_LEN;
function townCenterFor(dist){ // nearest town center (one per world cycle, mid-desert)
  const k=Math.round((dist-(2*STAGE_LEN+360))/CYCLE);
  return k*CYCLE+2*STAGE_LEN+360;
}
function buildCityPool(gltfScene){
  gltfScene.traverse(o=>{if(o.isMesh){o.frustumCulled=true;if(o.material)o.material.fog=true;}});
  for(const side of[-1,1]){
    const inst=gltfScene.clone();
    inst.scale.setScalar(CITY_S);
    inst.rotation.y=side>0?-Math.PI/2:Math.PI/2;
    inst.visible=false;scene.add(inst);
    cityInst.push({g:inst,side});
  }
  cityReady=true;
}
/* desert-wide scatter props (palms, trees, rocks, stalls from the user's pack) */
let scatterReady=false;const SCAT_N=30,SCAT_GAP=11;
const scatPool=[];
const SCAT_DEF=[ // name, per-variant scale (normalizes to game size), weight
  ['s_palm',0.55,30],['s_tree',0.70,15],['s_rock',0.50,10],
  ['s_propA',0.50,15],['s_propB',0.90,15],['s_stall',0.85,15]
];
function buildScatterPool(gltfScene){
  const protos={};
  gltfScene.traverse(o=>{if(o.isMesh){o.frustumCulled=true;if(o.material)o.material.fog=true;}});
  for(const[name]of SCAT_DEF){const n=gltfScene.getObjectByName(name);if(n)protos[name]=n;}
  if(!Object.keys(protos).length)return;
  const totalW=SCAT_DEF.reduce((a,d)=>a+d[2],0);
  for(let i=0;i<SCAT_N;i++){
    const holder=new THREE.Group();
    const variants=[];
    for(const[name,s]of SCAT_DEF){
      if(!protos[name])continue;
      const c=protos[name].clone();c.position.set(0,0,0);c.scale.setScalar(s);
      c.visible=false;holder.add(c);variants.push(c);
    }
    holder.visible=false;scene.add(holder);
    scatPool.push({holder,variants});
  }
  scatPool.totalW=totalW;
  scatterReady=true;
}
function scatVariantIdx(r){let acc=0;const tw=scatPool.totalW||100;
  for(let i=0;i<SCAT_DEF.length;i++){acc+=SCAT_DEF[i][2];if(r*tw<acc)return i;}return 0;}
/* generic world environments: measured at load, flanked along the track */
const WENVS=[];
function buildWorldEnv(gltfScene,biome,target,nearX,alt,byDepth,slotCap,yOff,maxY){
  gltfScene.traverse(o=>{if(o.isMesh&&o.material){o.material.fog=true;}});
  const b0=new THREE.Box3().setFromObject(gltfScene);
  const sy=Math.max(0.0001,b0.max.y-b0.min.y);
  const sx=b0.max.x-b0.min.x,szz=b0.max.z-b0.min.z;
  const rotBase=sx>szz?Math.PI/2:0;
  const across=Math.max(0.0001,Math.min(sx,szz)); // depth after rotation
  const sc=byDepth?target/across:target/sy;
  const mk=(extra)=>{
    const g=new THREE.Group();const c=gltfScene.clone();g.add(c);
    g.rotation.y=rotBase+extra;g.scale.setScalar(sc);
    g.updateMatrixWorld(true);
    g.userData.bb=new THREE.Box3().setFromObject(g);
    g.visible=false;scene.add(g);return g;
  };
  const probe=mk(0);
  const len=Math.max(20,probe.userData.bb.max.z-probe.userData.bb.min.z);
  const slotN=Math.min(slotCap||3,Math.max(2,Math.ceil(240/len)+1));
  const insts=[];
  for(let slot=0;slot<slotN;slot++){
    const L=slot===0?probe:mk(0);
    L.userData.slot=slot;L.userData.side=-1;insts.push(L);
    const R=mk(Math.PI);
    R.userData.slot=slot;R.userData.side=1;insts.push(R);
  }
  WENVS.push({biome,insts,len,nearX,alt,yOff:yOff||0,maxY});
}
/* necropolis environment (user's catacombs pack) - world 4 graveyard flanks */
let cataReady=false;const CATA_S=0.29,CATA_LEN=207.3*CATA_S,CATA_GAP=CATA_LEN*1.25,CATA_X=39,CATA_Y=0.5;
const cataPool=[];
function buildCataPool(gltfScene){
  gltfScene.traverse(o=>{if(o.isMesh){o.frustumCulled=true;if(o.material)o.material.fog=true;}});
  for(let i=0;i<5;i++){
    const inst=gltfScene.clone();
    inst.scale.setScalar(CATA_S);
    inst.visible=false;scene.add(inst);
    cataPool.push({g:inst,slot:i});
  }
  cataReady=true;
}
/* animated octopus swimmers (user's underwater pack) - Coral Reach ambience */
let octoReady=false;const OCTO_N=3,OCTO_GAP=210;
const octoPool=[];let octoMixers=[];let octoClip=null;
function buildOctoPool(gltf){
  octoClip=gltf.animations&&gltf.animations[0];
  for(let i=0;i<OCTO_N;i++){
    const inst=THREE.SkeletonUtils.clone(gltf.scene);
    inst.traverse(o=>{if(o.isMesh||o.isSkinnedMesh){o.frustumCulled=false;if(o.material)o.material.fog=true;}});
    inst.scale.setScalar(4.2);
    inst.visible=false;scene.add(inst);
    const mx=new THREE.AnimationMixer(inst);
    if(octoClip){const a=mx.clipAction(octoClip);a.play();a.time=i*0.7;}
    octoMixers.push(mx);
    octoPool.push({g:inst});
  }
  octoReady=true;
}
function buildEnvPool(gltfScene){
  gltfScene.traverse(o=>{if(o.isMesh){o.frustumCulled=true;if(o.material)o.material.fog=true;}});
  for(let i=0;i<6;i++){
    const inst=gltfScene.clone();
    inst.scale.setScalar(ENV_S);
    inst.visible=false;scene.add(inst);
    envPool.push({g:inst,side:i%2?1:-1,slot:Math.floor(i/2)});
  }
  envReady=true;
}
async function loadAssets(){
  const T=(pr)=>Promise.resolve(pr).finally(tick);
  const img=async(url)=>{const i=await loadImage(url);return readable(i)?i:null;};
  const JOBS=[

    T(img(ASSETS.tile_seabed).then(i=>TEX.seabed=i?tileTexture(i):fbTile('#0d3247','#154b62')).catch(()=>TEX.seabed=fbTile('#0d3247','#154b62'))),
    T(img(ASSETS.tile_beach ).then(i=>TEX.beach =i?tileTexture(i):fbTile('#efe0bd','#d9c391')).catch(()=>TEX.beach =fbTile('#efe0bd','#d9c391'))),
    T(img(ASSETS.tile_desert).then(i=>TEX.desert=i?tileTexture(i):fbTile('#d8a85a','#b9843c')).catch(()=>TEX.desert=fbTile('#d8a85a','#b9843c'))),
    T(img(ASSETS.tile_necro ).then(i=>TEX.necro=i?tileTexture(i):fbTile('#2b2540','#3d3358')).catch(()=>TEX.necro=fbTile('#2b2540','#3d3358'))),
    T(img('./assets/tex/lava.png' ).then(i=>TEX.lavaT=i?tileTexture(i):fbTile('#e85a10','#ffa020')).catch(()=>TEX.lavaT=fbTile('#e85a10','#ffa020'))),
    T(Promise.resolve().then(()=>{TEX.waterT=fbWater();})),
    T(img(ASSETS.can_label  ).then(i=>{if(i){const t=new THREE.Texture(i);t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;TEX.label=t;}else TEX.label=fbLabel();}).catch(()=>TEX.label=fbLabel())),
    // Use procedural reef painter (skip the cartoony pink CDN PNGs) for a more realistic look
    T(Promise.resolve().then(()=>{TEX.coral=fbSprite(paintCoral);TEX.coral2=fbSprite(paintCoral);})),
    T(img(ASSETS.spr_palm   ).then(i=>TEX.palm =i?chromaKey(i,0xFF00FF):fbSprite(paintPalm)).catch(()=>TEX.palm =fbSprite(paintPalm))),
    T(img('./assets/brand/logo.png').then(i=>{if(i){const t=new THREE.Texture(i);t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;buildBillboards(t);}}).catch(()=>{})),
    ...['ad_orange','ad_cola','ad_mint','ad_apple','ad_pome'].map((n,k)=>
      T(img('./assets/brand/'+n+'.jpg').then(i=>{if(i){const t=new THREE.Texture(i);t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;BB_TEXES[k+1]=t;}}).catch(()=>{}))),
    T(img(ASSETS.spr_rock   ).then(i=>TEX.rock =i?chromaKey(i,0xFF00FF):fbSprite(paintRock)).catch(()=>TEX.rock =fbSprite(paintRock))),
    ...(ULTRA?[]:[T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/dunes.glb');
      buildEnvPool(g.scene);}catch(e){/* keep rock billboards */}})())]),
    ...(LITE?[]:[T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/city.glb');
      buildCityPool(g.scene);}catch(e){/* town simply absent */}})())]),
    ...(ULTRA?[]:[T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/scatter.glb');
      buildScatterPool(g.scene);}catch(e){/* scatter simply absent */}})())]),
    ...(LITE?[]:[T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/octopus.glb');
      buildOctoPool(g);}catch(e){/* swimmers simply absent */}})())]),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/cans.glb');
      buildCanProtos(g.scene);}catch(e){/* fallback cylinder can */}})()),
    ...(LITE?[]:[T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/cata.glb');
      buildCataPool(g.scene);}catch(e){/* necropolis env simply absent */}})())]),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/fruits.glb');
      buildFruitProtos(g.scene);}catch(e){/* keep procedural pickups */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/ice.glb');
      buildIce(g.scene);}catch(e){/* keep the melon */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/pome.glb');
      buildFruitOverride(1,g.scene,1.0);}catch(e){/* keep the banana */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/lemon.glb');
      buildFruitOverride(2,g.scene,0.9);}catch(e){/* keep the avocado */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/apple.glb');
      buildFruitOverride(3,g.scene,0.9,0x8a9a40);}catch(e){/* keep the mangosteen */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/fish.glb');
      buildFish(g);}catch(e){/* fast villain simply absent */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/jelly.glb');
      buildJelly(g);}catch(e){/* gentle bonus simply absent */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/pome.glb');
      buildFruitOverride(1,g.scene,1.0);}catch(e){/* keep the banana */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/lemon.glb');
      buildFruitOverride(2,g.scene,0.9);}catch(e){/* keep the avocado */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/apple.glb');
      buildFruitOverride(3,g.scene,0.92,0x8a9a40);}catch(e){/* keep the mangosteen */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/kawaii.glb');
      buildKawaii(g.scene);}catch(e){/* special simply absent */}})()),
    T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/zombie.glb');
      buildZombie(g.scene);}catch(e){/* villain simply absent */}})()),
    ...(ULTRA?[]:[T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/lava.glb');
      buildWorldEnv(g.scene,4,80,12,false,true);}catch(e){}})())]),
    ...(ULTRA?[]:[T((async()=>{try{const g=await new THREE.GLTFLoader().loadAsync('./assets/models/water.glb');
      buildWorldEnv(g.scene,5,100,11,false,true);}catch(e){}})())])
    ,
    ...(ULTRA?[]:[T((async()=>{try{
      const g=await new THREE.GLTFLoader().loadAsync('./assets/models/the_gentle_sea.glb');
      // "The Gentle Sea" reef scene — heavy pack, strip PBR maps + shadows.
      g.scene.traverse(o=>{
        if(!o.isMesh) return;
        o.castShadow=false; o.receiveShadow=false; o.frustumCulled=true;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        for(const m of mats){ if(!m) continue;
          m.fog=true;
          if(m.roughnessMap){m.roughnessMap=null;}
          if(m.metalnessMap){m.metalnessMap=null;}
          if(m.aoMap){m.aoMap=null;}
          if(m.normalMap){m.normalMap=null;}
          const t=m.map;
          if(t){t.anisotropy=1;t.minFilter=THREE.LinearMipmapNearestFilter;t.generateMipmaps=true;}
          m.needsUpdate=true;
        }
      });
      buildWorldEnv(g.scene,0,70,22,false,true,2,-1.5);
    }catch(e){}})())])
    ,
    ...(ULTRA?[]:[T((async()=>{try{
      const g=await new THREE.GLTFLoader().loadAsync('./assets/models/beach_props.glb');
      // perf pass: same lightweight treatment as reef
      g.scene.traverse(o=>{
        if(!o.isMesh) return;
        o.castShadow=false; o.receiveShadow=false; o.frustumCulled=true;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        for(const m of mats){ if(!m) continue;
          m.fog=true;
          if(m.roughnessMap){m.roughnessMap=null;}
          if(m.metalnessMap){m.metalnessMap=null;}
          if(m.aoMap){m.aoMap=null;}
          if(m.normalMap){m.normalMap=null;}
          const t=m.map;
          if(t){t.anisotropy=1;t.minFilter=THREE.LinearMipmapNearestFilter;t.generateMipmaps=true;}
          m.needsUpdate=true;
        }
      });
      buildWorldEnv(g.scene,1,70,14,false,true,2,-1.2);
    }catch(e){}})())])
  ];
  _ldTotal=JOBS.length;
  await Promise.allSettled(JOBS);
}

/* =================== audio (WebAudio, HTMLAudio fallback) =================== */
const AC=window.AudioContext||window.webkitAudioContext;let actx=null;const BUF={};const EL={};
let surfSrc=null,surfGain=null,surfFilter=null,surfEl=null;
async function loadAudio(){
  actx=new AC();
  const load=async(k,url)=>{
    try{const r=await fetch(url);if(!r.ok)throw 0;const b=await r.arrayBuffer();BUF[k]=await actx.decodeAudioData(b);}
    catch(e){const a=new Audio(url);a.preload='auto';EL[k]=a;}
  };
  await Promise.allSettled([
load('pickup',ASSETS.sfx_pickup),load('rotten',ASSETS.sfx_rotten),
    load('boost',ASSETS.sfx_boost),load('finish',ASSETS.sfx_finish),load('surf',ASSETS.sfx_surf)]);
}
function play(k,vol=0.5){
  if(actx&&BUF[k]){const s=actx.createBufferSource();s.buffer=BUF[k];
    const g=actx.createGain();g.gain.value=vol;s.connect(g);g.connect(actx.destination);s.start();return;}
  if(EL[k]){const a=EL[k].cloneNode();a.volume=vol;a.play().catch(()=>{});}
}
function startSurf(){
  if(actx&&BUF.surf&&!surfSrc){
    surfSrc=actx.createBufferSource();surfSrc.buffer=BUF.surf;surfSrc.loop=true;
    surfFilter=actx.createBiquadFilter();surfFilter.type='lowpass';surfFilter.frequency.value=1500;
    surfGain=actx.createGain();surfGain.gain.value=0.10;
    surfSrc.connect(surfFilter);surfFilter.connect(surfGain);surfGain.connect(actx.destination);surfSrc.start();return;}
  if(EL.surf&&!surfEl){surfEl=EL.surf;surfEl.loop=true;surfEl.volume=0.10;surfEl.play().catch(()=>{});}
}
function tuneSurf(biome){ // both players share the room speaker: use P1's biome
  if(surfFilter){const f=biome===0?500:biome===1?4500:biome===3?700:biome===4?420:biome===5?3600:2500;
    surfFilter.frequency.linearRampToValueAtTime(f,actx.currentTime+0.8);return;}
  if(surfEl)surfEl.volume=biome===0?0.12:0.16;
}
let musicEl=null;
function startMusic(){
  if(!musicEl){musicEl=new Audio('./assets/audio/music.mp3');musicEl.volume=0.42;musicEl.preload='auto';}
  try{musicEl.currentTime=0;musicEl.play().catch(()=>{});}catch(e){}
}
function stopMusic(){if(musicEl){musicEl.pause();try{musicEl.currentTime=0;}catch(e){}}}
let audioUnlocked=false;
function goFullscreen(){
  try{const el=document.documentElement;
    if(!document.fullscreenElement&&el.requestFullscreen)el.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
  }catch(e){}
}
function unlockAudio(){if(audioUnlocked)return;audioUnlocked=true;goFullscreen();loadAudio().then(()=>{if(phase==='race')startSurf();});}
addEventListener('pointerdown',unlockAudio);addEventListener('keydown',unlockAudio);

/* =================== world objects (shared, re-laid per viewer) =================== */
const groundGeo=new THREE.PlaneGeometry(64,260,1,1);
const matA=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.95});
const matB=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.95,transparent:true,opacity:0});
const groundA=new THREE.Mesh(groundGeo,matA);groundA.rotation.x=-Math.PI/2;groundA.position.z=-100;scene.add(groundA);
const groundB=new THREE.Mesh(groundGeo,matB);groundB.rotation.x=-Math.PI/2;groundB.position.set(0,0.01,-100);scene.add(groundB);
const TILES=()=>[TEX.seabed,TEX.beach,TEX.desert,TEX.necro,TEX.lavaT,TEX.waterT];
function setGroundTex(mat,idx){const t=TILES()[idx];if(t&&mat.map!==t){
  const first=!mat.map;mat.map=t;t.repeat.set(4,16);
  if(first)mat.needsUpdate=true; // same shader afterwards: swap is free
}}

/* lane path strip (stone path in LAVA FIELDS, cobbles in THE VILLAGE) */
function paintPathTex(stone){const c=document.createElement('canvas');c.width=128;c.height=256;const x=c.getContext('2d');
  x.fillStyle=stone?'#3a3f46':'#7a5a3a';x.fillRect(0,0,128,256);
  for(let i=0;i<46;i++){
    const w=18+Math.random()*26,h=12+Math.random()*16;
    const px=Math.random()*128,py=Math.random()*256;
    x.fillStyle=stone?('hsl(210,6%,'+(30+Math.random()*16)+'%)'):('hsl(36,18%,'+(58+Math.random()*20)+'%)');
    x.beginPath();x.ellipse(px,py,w/2,h/2,Math.random(),0,7);x.fill();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;t.repeat.set(1,14);return t;}
const PATH_STONE=paintPathTex(true),PATH_COBBLE=paintPathTex(false);
const pathMat=new THREE.MeshStandardMaterial({map:PATH_STONE,roughness:0.95});
const pathMesh=new THREE.Mesh(new THREE.PlaneGeometry(9.5,260,1,1),pathMat);
pathMesh.rotation.x=-Math.PI/2;pathMesh.position.set(0,0.02,-100);pathMesh.visible=false;scene.add(pathMesh);
/* Maxi roadside billboards: logo panels on poles, both sides, all worlds */
let bbReady=false;const BB_GAP=170,BB_N=3;
const BB_TEXES=[]; // [0]=logo board, then the flavor ads
const bbPool=[];
function buildBillboards(tex){
  BB_TEXES[0]=tex;
  const frameMat=new THREE.MeshStandardMaterial({color:0xe9c877,metalness:0.7,roughness:0.35});
  const backMat=new THREE.MeshStandardMaterial({color:0x2a1a10,roughness:0.9});
  const poleMat=new THREE.MeshStandardMaterial({color:0x8a8f96,metalness:0.85,roughness:0.3});
  const H=3.0,W=4.0; // unified 4:3 boards
  const panelMat=null;
  for(let i=0;i<BB_N;i++){
    const g=new THREE.Group();
    const back=new THREE.Mesh(new THREE.BoxGeometry(W+0.5,H+0.5,0.16),backMat);back.position.y=4.4;g.add(back);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(W+0.7,H+0.7,0.10),frameMat);frame.position.set(0,4.4,-0.05);g.add(frame);
    const pm=new THREE.MeshStandardMaterial({map:tex,roughness:0.5,metalness:0.1});
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(W,H),pm);panel.position.set(0,4.4,0.09);g.add(panel);
    for(const px of [-W*0.35,W*0.35]){
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,4.2,8),poleMat);
      pole.position.set(px,2.1,0);g.add(pole);
    }
    g.visible=false;scene.add(g);
    bbPool.push({g,panel});
  }
  bbReady=true;
}
const SCN=[];
{const geo=new THREE.PlaneGeometry(1,1);
 for(let i=0;i<26;i++){const m=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,fog:true});
  const s=new THREE.Mesh(geo,m);s.visible=false;scene.add(s);
  SCN.push({mesh:s,side:i%2?1:-1,slot:Math.floor(i/2)});}}
function sceneryTexFor(b,slot){if(b===2&&envReady)return null;if(b===3)return cataReady?null:TEX.rock;if(b>=4)return WENVS.some(w=>w.biome===b)?null:TEX.rock;if(b===0)return null;if(b===1)return WENVS.some(w=>w.biome===1)?null:TEX.palm;return TEX.rock;}

const BUB_N=120;const bubGeo=new THREE.BufferGeometry();
const bubPos=new Float32Array(BUB_N*3);
for(let i=0;i<BUB_N;i++){bubPos[i*3]=(Math.random()-0.5)*50;bubPos[i*3+1]=Math.random()*20;bubPos[i*3+2]=-Math.random()*200;}
bubGeo.setAttribute('position',new THREE.BufferAttribute(bubPos,3));
const bubTexC=document.createElement('canvas');bubTexC.width=bubTexC.height=32;
{const bx=bubTexC.getContext('2d');const bg=bx.createRadialGradient(16,16,2,16,16,16);
 bg.addColorStop(0,'rgba(255,255,255,.95)');bg.addColorStop(0.55,'rgba(255,255,255,.45)');bg.addColorStop(1,'rgba(255,255,255,0)');
 bx.fillStyle=bg;bx.fillRect(0,0,32,32);}
const BUB_TEX=new THREE.CanvasTexture(bubTexC);
const bubMat=new THREE.PointsMaterial({color:0xbfeaff,size:0.5,map:BUB_TEX,transparent:true,opacity:0,depthWrite:false});
scene.add(new THREE.Points(bubGeo,bubMat));
const rayMat=new THREE.MeshBasicMaterial({color:0xaee6ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
for(let i=0;i<5;i++){const r=new THREE.Mesh(new THREE.PlaneGeometry(3.5,40),rayMat);
  r.position.set((Math.random()-0.5)*30,12,-30-i*30);r.rotation.z=(Math.random()-0.5)*0.5;scene.add(r);}

const patchMat=new THREE.MeshBasicMaterial({color:0x9a8a68,transparent:true,opacity:0.55,depthWrite:false});
const patchPool=[];for(let i=0;i<10;i++){const m=new THREE.Mesh(new THREE.CircleGeometry(1,18),patchMat);
  m.rotation.x=-Math.PI/2;m.position.y=0.02;m.visible=false;scene.add(m);patchPool.push(m);}
const weedMat=new THREE.MeshStandardMaterial({color:0x8a6b32,roughness:1});
const weedGeo=new THREE.IcosahedronGeometry(0.8,1);
const weedPool=[];for(let i=0;i<8;i++){const m=new THREE.Mesh(weedGeo,weedMat);m.visible=false;scene.add(m);weedPool.push(m);}

/* pickups - procedural primitives in the formula palette */
const iceMat=new THREE.MeshStandardMaterial({color:0xcdeeff,roughness:0.05,metalness:0.1,transparent:true,opacity:0.75,emissive:0x224455});
const lemMat=new THREE.MeshStandardMaterial({color:0xf6e21a,roughness:0.4,emissive:0x332c00});
const lemRim=new THREE.MeshStandardMaterial({color:0xfff7c0,roughness:0.5});
const mntMat=new THREE.MeshStandardMaterial({color:0x3fae5a,roughness:0.55,emissive:0x06220c});
const rotMat=new THREE.MeshStandardMaterial({color:0x4a5a20,roughness:0.9,emissive:0x182600});
const rotBlb=new THREE.MeshStandardMaterial({color:0x20300a,roughness:1});
function mkIce(){return new THREE.Mesh(new THREE.BoxGeometry(0.85,0.85,0.85),iceMat);}
function mkLemon(){const g=new THREE.Group();const s=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.18,18),lemMat);
  s.rotation.z=Math.PI/2;g.add(s);const r=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.07,8,18),lemRim);g.add(r);return g;}
function mkMint(){const g=new THREE.Group();for(const sx of[-0.18,0.18]){const l=new THREE.Mesh(new THREE.ConeGeometry(0.28,0.7,6),mntMat);
  l.position.x=sx;l.rotation.z=sx>0?-0.5:0.5;g.add(l);}return g;}
function mkRotten(){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.SphereGeometry(0.55,14,12),rotMat);
  b.scale.set(1.05,0.9,1.05);g.add(b);for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(0.17,8,8),rotBlb);
  const a=Math.random()*6.28;m.position.set(Math.cos(a)*0.42,(Math.random()-0.5)*0.4,Math.sin(a)*0.42);g.add(m);}return g;}
const ITEM_POOL=24;const itemPool=[];
for(let i=0;i<ITEM_POOL;i++){
  const holder=new THREE.Group();const kinds=[mkIce(),mkLemon(),mkMint(),mkRotten()];
  kinds.forEach(k=>{k.visible=false;holder.add(k);});holder.scale.setScalar(1.45);holder.visible=false;scene.add(holder);
  itemPool.push({holder,kinds});
}

/* real Maxi cans: 4 flavors from the brand model, with fallback cylinder */
const FLAVORS=[
  {node:'Orange_Can',    col:'#ff8a2a', img:'./assets/brand/can_orange.png'},
  {node:'Lemon_Can',     col:'#9fd41e', img:'./assets/brand/can_lemon.png'},
  {node:'Cola_Can',      col:'#3f8fe8', img:'./assets/brand/can_cola.png'},
  {node:'Lemon_Mint_Can',col:'#cede2a', img:'./assets/brand/can_mint.png'}
];
const RING_COL=[0xe9c877,0x7fd0ff]; // P1 gold, P2 cyan base ring
let canProtos=null;
function buildCanProtos(gltfScene){
  canProtos={};
  for(const f of FLAVORS){
    let found=null;
    gltfScene.traverse(o=>{if(!found&&(o.name||'').startsWith(f.node)&&(o.isMesh||o.children.length))found=o;});
    if(found)canProtos[f.node]=found;
  }
  if(!Object.keys(canProtos).length)canProtos=null;
}
/* ZOMBIE AVOCADO: hostile chaser, 5 encounters per race, -500 on touch */
const ZOMBIE_D=[600,1800,3200,5000,6800];
const Z_SPAWN_GAP=150,Z_RUN=13,Z_TURN=3.2,Z_HIT_D=2.2,Z_HIT_X=1.35;
let zombieProto=null;const zombieInst=[null,null];
function buildZombie(gltfScene){
  gltfScene.traverse(o=>{if(o.isMesh&&o.material){o.material.fog=true;o.material.envMapIntensity=1.1;}});
  const mk=()=>{
    const wrap=new THREE.Group();
    const m=gltfScene.clone();
    const box=new THREE.Box3().setFromObject(m);
    const h=Math.max(0.0001,box.max.y-box.min.y);
    m.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);
    wrap.scale.setScalar(2.3/h); // slightly taller than the can = menacing
    wrap.add(m);
    wrap.visible=false;scene.add(wrap);
    return wrap;
  };
  zombieInst[0]=mk();zombieInst[1]=mk();
  zombieProto=true;
}
/* CUTE FISH: fast sweeping striker, 6 encounters per race, -200 on touch */
const FISH_D=[1000,2200,3400,4600,5800,7000];
const F_SPAWN_GAP=140,F_RUN=34,F_HIT_D=1.8,F_HIT_X=1.1,F_SWEEP=4.6;
let fishReady=false;const fishInst=[null,null],fishMix=[null,null];
function buildFish(gltf){
  const src=gltf.scene;
  src.traverse(o=>{if(o.isMesh&&o.material){o.material.fog=true;o.material.envMapIntensity=1.1;}});
  const clip=(gltf.animations&&gltf.animations[0])||null;
  const mk=(vi)=>{
    const wrap=new THREE.Group();
    const m=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(src):src.clone();
    const box=new THREE.Box3().setFromObject(m);
    const dim=Math.max(box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z);
    m.position.set(-(box.min.x+box.max.x)/2,-(box.min.y+box.max.y)/2,-(box.min.z+box.max.z)/2);
    wrap.scale.setScalar(1.7/Math.max(0.0001,dim));
    wrap.add(m);wrap.visible=false;scene.add(wrap);
    if(clip){const mx=new THREE.AnimationMixer(m);mx.clipAction(clip).play();mx.timeScale=2.2;fishMix[vi]=mx;}
    return wrap;
  };
  fishInst[0]=mk(0);fishInst[1]=mk(1);
  fishReady=true;
}
/* KAWAII SPECIAL: rare flying apple, +1000, appears ~4x per race */
const SPECIAL_D=[800,2400,4400,6600]; // shared, deterministic
const SP_HIT_D=4.0,SP_HIT_X=1.25;
let kawaiiProto=null,kawaiiInst=null;
function specialPos(t){ // playful weave: fast figure-drift, hard to pin down
  return{x:Math.sin(t*1.7)*3.4+Math.sin(t*0.9)*0.7,
         y:2.1+Math.sin(t*2.3)*1.0+Math.cos(t*1.1)*0.35};
}
function buildKawaii(gltfScene){
  gltfScene.traverse(o=>{if(o.isMesh&&o.material){o.material.fog=true;o.material.envMapIntensity=1.3;}});
  const wrap=new THREE.Group();
  const m=gltfScene.clone();
  const box=new THREE.Box3().setFromObject(m);
  const dim=Math.max(box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z);
  m.position.set(-(box.min.x+box.max.x)/2,-(box.min.y+box.max.y)/2,-(box.min.z+box.max.z)/2);
  wrap.scale.setScalar(1.5/Math.max(0.0001,dim));
  wrap.add(m);
  kawaiiProto=wrap;
  kawaiiInst=wrap;wrap.visible=false;scene.add(wrap);
}
/* JELLYFISH: friendly drifting bonus, +300, 5 gentle encounters per race */
const JELLY_D=[1400,2800,4200,5500,7100];
const JL_HIT_D=4.0,JL_HIT_X=1.5;
let jellyInst=null,jellyMix=null;
function jellyPos(t){ // slow serene drift - the easy catch, for the kids
  return{x:Math.sin(t*0.7)*2.6,y:1.6+Math.sin(t*1.1)*0.8};
}
function buildJelly(gltf){
  const src=gltf.scene;
  src.traverse(o=>{if(o.isMesh&&o.material){
    o.material.fog=true;o.material.transparent=true;o.material.opacity=0.85;
    o.material.color.set(0x9fd8f0);
    o.material.emissive&&o.material.emissive.set(0x2fb8e8);
    if('emissiveIntensity' in o.material)o.material.emissiveIntensity=0.8;
  }});
  const wrap=new THREE.Group();
  const m=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(src):src.clone();
  const box=new THREE.Box3().setFromObject(m);
  const dim=Math.max(box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z);
  m.position.set(-(box.min.x+box.max.x)/2,-(box.min.y+box.max.y)/2,-(box.min.z+box.max.z)/2);
  wrap.scale.setScalar(1.6/Math.max(0.0001,dim));
  wrap.add(m);wrap.visible=false;scene.add(wrap);
  const clip=(gltf.animations&&gltf.animations[0])||null;
  if(clip){jellyMix=new THREE.AnimationMixer(m);jellyMix.clipAction(clip).play();}
  jellyInst=wrap;
}
/* real fruit pickups (user's pack) - swap in over the procedural primitives */
let fruitProtos=null;
const OVR=[null,null,null,null]; // per-kind model overrides
const FRUIT_NODES=['SM_Fruits_Watermelon_2','SM_Fruits_Banana_Y1','SM_Fruits_Avocado_1','SM_Fruits_Mangostan_1'];
const FRUIT_SIZE=[0.95,1.0,0.9,0.85];
function makeIceMaterial(){
  return new THREE.MeshPhysicalMaterial?new THREE.MeshPhysicalMaterial({
    color:0xcfeeff,transparent:true,opacity:0.72,roughness:0.05,metalness:0.0,
    envMapIntensity:1.6,emissive:0x224455,emissiveIntensity:0.25
  }):new THREE.MeshStandardMaterial({color:0xcfeeff,transparent:true,opacity:0.72,roughness:0.05});
}
function swapKind(k,proto,size,tint){
  for(const slot of itemPool){
    const old=slot.kinds[k];const vis=old.visible;
    slot.holder.remove(old);
    const wrap=new THREE.Group();
    const m=proto.clone();
    if(tint)m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material._cloned=true;o.material.color.set(tint);}});
    const box=new THREE.Box3().setFromObject(m);
    const dim=Math.max(box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z);
    m.position.set(-(box.min.x+box.max.x)/2,-(box.min.y+box.max.y)/2,-(box.min.z+box.max.z)/2);
    wrap.scale.setScalar(size/Math.max(0.0001,dim));
    wrap.add(m);wrap.visible=vis;
    slot.holder.add(wrap);
    slot.kinds[k]=wrap;
  }
}
function buildIce(gltfScene){
  const mat=makeIceMaterial();
  gltfScene.traverse(o=>{if(o.isMesh){o.material=mat;o.material.fog=true;}});
  OVR[0]=gltfScene;
  try{swapKind(0,OVR[0],0.95);}catch(e){}
}
function buildFruitOverride(k,gltfScene,size,tint){
  gltfScene.traverse(o=>{if(o.isMesh&&o.material)o.material.fog=true;});
  OVR[k]=gltfScene;
  try{if(itemPool.length&&itemPool[0].kinds)swapKind(k,OVR[k],size,tint);}catch(e){}
}
function buildFruitProtos(gltfScene){
  gltfScene.traverse(o=>{if(o.isMesh&&o.material)o.material.fog=true;});
  const protos=[];
  for(let k=0;k<4;k++){
    let found=null;
    gltfScene.traverse(o=>{if(!found&&(o.name||'').startsWith(FRUIT_NODES[k]))found=o;});
    if(!found)return;
    protos.push(found);
  }
  fruitProtos=protos;
  try{
  for(const slot of itemPool){
    slot.kinds.forEach((old,k)=>{
      if(OVR[k])return; // a user-supplied model owns this slot
      const vis=old.visible;
      slot.holder.remove(old);
      const wrap=new THREE.Group();
      const m=fruitProtos[k].clone();
      if(k===3)m.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.color.set(0x8a9a40);}}); // toxic-olive tint
      const box=new THREE.Box3().setFromObject(m);
      const dim=Math.max(box.max.x-box.min.x,box.max.y-box.min.y,box.max.z-box.min.z);
      wrap.scale.setScalar(FRUIT_SIZE[k]/Math.max(0.0001,dim));
      wrap.add(m);wrap.visible=vis;
      slot.holder.add(wrap);
      slot.kinds[k]=wrap;
    });
  }
  }catch(e){}
}
/* player cans - P1 lemon-lime gold, P2 cyan-tinted for instant readability */
const canGeo=new THREE.CylinderGeometry(0.7,0.7,2.0,24);
const topGeo=new THREE.CylinderGeometry(0.66,0.7,0.12,24);
const silver=new THREE.MeshStandardMaterial({color:0xd8dde2,metalness:0.95,roughness:0.22});
function makeCan(tint,flavorIdx=0,playerIdx=0){
  const g=new THREE.Group();
  const f=FLAVORS[flavorIdx]||FLAVORS[0];
  if(canProtos&&canProtos[f.node]){
    const can=canProtos[f.node].clone();
    can.traverse(o=>{if(o.isMesh){o.frustumCulled=true;if(o.material){
      o.material=o.material.clone();o.material._cloned=true;
      o.material.fog=true;
      o.material.envMapIntensity=1.35;
      if(o.material.metalness!==undefined&&o.material.metalness>0.9)o.material.metalness=0.85;
      if(o.material.roughness!==undefined)o.material.roughness=Math.min(o.material.roughness,0.45);
    }}});
    const wrap=new THREE.Group();wrap.add(can);
    // normalize whatever the model's true size is: height -> 2.0, feet at y=0
    const box=new THREE.Box3().setFromObject(can);
    const h=Math.max(0.0001,box.max.y-box.min.y);
    const S=2.0/h;
    can.position.x-=(box.min.x+box.max.x)/2;
    can.position.y-=box.min.y;
    can.position.z-=(box.min.z+box.max.z)/2;
    wrap.scale.setScalar(S);
    g.add(wrap);
  }else{
    const label=TEX.label?new THREE.MeshStandardMaterial({map:TEX.label,metalness:0.55,roughness:0.3})
                         :new THREE.MeshStandardMaterial({color:0xb9d445,metalness:0.6,roughness:0.3});
    if(tint)label.color=new THREE.Color(tint);
    const body=new THREE.Mesh(canGeo,label);body.position.y=1;g.add(body);
    const top=new THREE.Mesh(topGeo,silver);top.position.y=2.02;g.add(top);
    const bot=new THREE.Mesh(topGeo,silver);bot.position.y=-0.02;g.add(bot);
  }
  // player identity ring at the base
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.09,10,28),
    new THREE.MeshStandardMaterial({color:RING_COL[playerIdx],emissive:RING_COL[playerIdx],
      emissiveIntensity:0.35,metalness:0.6,roughness:0.35}));
  ring.rotation.x=Math.PI/2;ring.position.y=0.08;g.add(ring);
  return g;
}
function makeTag(txt,color){
  const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');
  x.fillStyle='rgba(8,12,14,.7)';x.fillRect(14,8,100,48);
  x.font='bold 36px Segoe UI, Arial';x.textAlign='center';x.fillStyle=color;x.fillText(txt,64,44);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false}));
  s.scale.set(1.5,0.75,1);s.position.y=2.9;return s;
}
const canHolders=[new THREE.Group(),new THREE.Group()];
canHolders.forEach(h=>scene.add(h));
function disposeHolder(h){
  h.traverse(o=>{if(o.isMesh){
    if(o.material&&o.material._cloned){if(o.material.map)o.material.map.dispose&&0;o.material.dispose();}
    if(o.geometry&&o.geometry._own)o.geometry.dispose();
  }});
  h.clear();
}
function buildCans(){
  disposeHolder(canHolders[0]);canHolders[0].clear();canHolders[0].add(makeCan(null,P[0].flavor,0));canHolders[0].add(makeTag(STR.p1,'#f6e2ad'));
  disposeHolder(canHolders[1]);canHolders[1].add(makeCan(0xbfe8ff,P[1].flavor,1));canHolders[1].add(makeTag(STR.p2,'#9fe2ff'));
}

/* sparkles - owned per player, shown only in the owner's viewport pass */
const sparkTexC=document.createElement('canvas');sparkTexC.width=sparkTexC.height=64;
{const x=sparkTexC.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);
 g.addColorStop(0,'rgba(255,245,210,1)');g.addColorStop(0.4,'rgba(243,200,120,.85)');g.addColorStop(1,'rgba(243,200,120,0)');
 x.fillStyle=g;x.fillRect(0,0,64,64);}
const SPARK_TEX=new THREE.CanvasTexture(sparkTexC);
const sparks=[];for(let i=0;i<60;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:SPARK_TEX,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  s.visible=false;s.userData={v:new THREE.Vector3(),life:0,owner:0,rel:new THREE.Vector3()};scene.add(s);sparks.push(s);}
let sparkCur=0;
function burst(owner,x,y,hex){for(let i=0;i<10;i++){const s=sparks[sparkCur];sparkCur=(sparkCur+1)%sparks.length;
  s.userData.owner=owner;s.userData.rel.set(x,y,0);s.material.color.setHex(hex);
  s.userData.v.set((Math.random()-0.5)*7,Math.random()*6+1,(Math.random()-0.5)*7);s.userData.life=0.55;s.visible=false;}}

/* =================== game state =================== */
function newPlayer(){return{joined:false,flavor:0,stage:0,spCaught:new Set(),zDone:new Set(),z:null,fDone:new Set(),f:null,jlCaught:new Set(),x:0,dist:0,score:0,boost:0,oxy:100,boostT:0,speed:MIN_SPEED,
  claimed:new Set(),weedHits:new Set(),steer:0,rt:0,red:0,shake:0};}
const P=[newPlayer(),newPlayer()];
let phase='lobby'; // lobby | count | race | results
let seed=0,items=null,patches=null,weeds=null;
let countEnd=0,raceEnd=0,raceStart=0,raceT=0;

function enterLobby(){_phaseTag='lobby';
  phase='lobby';stopMusic();
  $('lobby').style.display='flex';$('results').style.display='none';
  $('hud').style.display='none';$('bigCount').style.display='none';
  P[0].joined=false;P[1].joined=false;P[0].stage=0;P[1].stage=0;P[0]._armed=false;P[1]._armed=false;refreshSlots();
}
function refreshSlots(){
  for(const i of[0,1]){
    const p=P[i];
    $('slot'+i).className='slot s'+(i+1)+(p.stage===2?' in':'');
    const flv=$('flv'+i),fn=$('fname'+i);
    const ci=$('canimg'+i);
    if(p.stage===0){flv.style.display='none';if(ci)ci.style.display='none';$('slotSt'+i).textContent=STR.pressJoin;}
    else{
      if(ci){ci.style.display='block';ci.src=FLAVORS[p.flavor].img;}
      flv.style.display='block';
      flv.className='flv'+(p.stage===2?' locked':'');
      fn.textContent=STR.flavors[p.flavor];
      fn.style.color=FLAVORS[p.flavor].col;
      $('slotSt'+i).textContent=p.stage===1?STR.lockIn:STR.lockedIn;
    }
  }
  const anyLocked=[0,1].some(i=>P[i].stage===2);
  const allReady=[0,1].every(i=>!P[i].joined||P[i].stage===2)&&anyLocked;
  $('startHint').style.visibility=allReady?'visible':'hidden';
}
function startRace(){_phaseTag='race';
  seed=(Math.random()*2**31)|0;
  items=buildItems(seed);patches=buildPatches(seed);weeds=buildWeeds(seed);
  for(const p of P){Object.assign(p,{x:0,dist:0,score:0,boost:0,oxy:100,boostT:0,speed:MIN_SPEED,red:0,shake:0});
    p.claimed.clear();p.weedHits.clear();p.spCaught.clear();p.zDone.clear();p.z=null;p.fDone.clear();p.f=null;p.jlCaught.clear();}
  // If only one pad joined, run full-screen solo; if both, split.
  buildCans();
  for(const i of[0,1])if(P[i].joined)$('tag'+i).style.color=FLAVORS[P[i].flavor].col;
  const both=P[0].joined&&P[1].joined;
  $('halfBot').style.display=both?'block':'none';
  $('splitLine').style.display=both?'block':'none';
  $('feed0').innerHTML='';$('feed1').innerHTML='';
  updateCameras();
  phase='count';countEnd=performance.now()+3000;
  $('lobby').style.display='none';$('results').style.display='none';
  $('hud').style.display='block';$('bigCount').style.display='flex';
}
function finishRace(){
  phase='results';stopMusic();play('finish',0.6);
  $('hud').style.display='none';
  const rows=[0,1].filter(i=>P[i].joined).map(i=>({i,name:i===0?'PLAYER 1':'PLAYER 2',
    score:P[i].score,dist:Math.round(P[i].dist),total:P[i].score+Math.floor(P[i].dist/10)}))
    .sort((a,b)=>b.total-a.total);
  const both=rows.length===2;
  $('winBanner').textContent=!both?STR.soloDone:
    rows[0].total===rows[1].total?STR.draw:rows[0].name+' '+STR.winner;
  const tb=$('tbody');tb.innerHTML='';
  rows.forEach((r,k)=>{
    const tr=document.createElement('tr');if(both&&k===0&&rows[0].total!==rows[1].total)tr.className='win';
    tr.innerHTML=`<td>${k+1}${STR.posSuffix[k]||'th'}</td><td>${r.name}</td><td>${r.score}</td><td>${r.dist}</td><td>${r.total}</td>`;
    tb.appendChild(tr);
  });
  $('results').style.display='flex';
}

/* =================== input: two pads + two keyboard sets =================== */
const kb=[new Set(),new Set()];
const KMAP=[
  {L:['KeyA'],R:['KeyD'],T:['KeyW'],A:['Space'],B:['KeyQ']},
  {L:['ArrowLeft'],R:['ArrowRight'],T:['ArrowUp'],A:['Enter'],B:['Backspace']}
];
addEventListener('keydown',e=>{for(const i of[0,1])for(const k in KMAP[i])
  if(KMAP[i][k].includes(e.code)){kb[i].add(k);e.preventDefault();}},{passive:false});
addEventListener('keyup',e=>{for(const i of[0,1])for(const k in KMAP[i])
  if(KMAP[i][k].includes(e.code))kb[i].delete(k);});
const prevA=[false,false],prevB=[false,false];
const _inp=[{steer:0,rt:0,aEdge:false,bEdge:false},{steer:0,rt:0,aEdge:false,bEdge:false}];
function readInput(i){
  let steer=0,rt=0,a=false,b=false;
  const gp=(navigator.getGamepads?navigator.getGamepads():[])[i];
  if(gp&&gp.connected){
    const ax=gp.axes[0]||0;if(Math.abs(ax)>0.16)steer=ax;
    rt=gp.buttons[7]?gp.buttons[7].value:0;
    if(gp.buttons[6]&&gp.buttons[6].value>rt)rt=gp.buttons[6].value; // LT fallback
    a=gp.buttons[0]&&gp.buttons[0].pressed;
    b=gp.buttons[1]&&gp.buttons[1].pressed;
    if(gp.buttons[14]&&gp.buttons[14].pressed)steer=-1;
    if(gp.buttons[15]&&gp.buttons[15].pressed)steer=1;
  }
  if(kb[i].has('L'))steer=-1;if(kb[i].has('R'))steer=1;
  if(kb[i].has('T'))rt=1;if(kb[i].has('A'))a=true;if(kb[i].has('B'))b=true;
  const o=_inp[i];
  o.steer=steer;o.rt=rt;
  o.aEdge=a&&!prevA[i];o.bEdge=b&&!prevB[i];prevA[i]=a;prevB[i]=b;
  return o;
}

/* =================== simulation (fixed timestep, per player) =================== */
function simPlayer(p,i,dt,inp){
  p.steer=inp.steer;p.rt=inp.rt;
  p.x=Math.max(-LANE,Math.min(LANE,p.x+inp.steer*dt*12));
  let target=MIN_SPEED+inp.rt*(MAX_SPEED-MIN_SPEED);
  const biome=biomeAt(p.dist);
  if(biome===0){p.oxy=Math.max(0,p.oxy-6*dt);if(p.oxy<=0)target*=0.5;}
  else p.oxy=Math.min(100,p.oxy+25*dt);
  if(biome===1)for(const w of patches){if(Math.abs(p.dist-w.d)<w.r&&Math.abs(p.x-w.x)<w.r){target*=0.6;break;}}
  p.speed+=(target-p.speed)*Math.min(1,2.2*dt);
  p.speed=Math.max(MIN_SPEED*0.5,p.speed);
  const boosting=p.boostT>performance.now();
  p.dist+=p.speed*(boosting?1.5:1)*dt;
  p.boost=Math.min(100,p.boost+1.2*dt);
  if(inp.aEdge&&p.boost>=100){p.boost=0;p.boostT=performance.now()+3000;play('boost',0.5);}
  // pickups - each player collects independently from the shared field
  for(let k=0;k<items.length;k++){
    const it=items[k];
    if(it.d<p.dist-8)continue;if(it.d>p.dist+ITEM_HIT_D)break;
    if(p.claimed.has(k))continue;
    if(Math.abs(p.dist-it.d)<=ITEM_HIT_D*0.7&&Math.abs(p.x-it.x)<=ITEM_HIT_X){
      p.claimed.add(k);
      if(it.kind===0){p.score+=100;p.speed=Math.min(MAX_SPEED+6,p.speed+5);}
      else if(it.kind===1){p.score+=100;p.boost=Math.min(100,p.boost+25);}
      else if(it.kind===2){p.score+=50;p.oxy=Math.min(100,p.oxy+30);}
      else{p.score=Math.max(0,p.score-50);p.speed*=0.45;}
      fx(p,i,it);
    }
  }
  // zombie avocado: spawn, chase, touch or be dodged
  try{
  if(!p.z)for(let zi=0;zi<ZOMBIE_D.length;zi++){
    if(p.zDone.has(zi))continue;
    const sd=ZOMBIE_D[zi];
    if(p.dist>sd-Z_SPAWN_GAP&&p.dist<sd+40){
      const r=mulberry32((sd*131)^seed)();
      p.z={zi,zd:p.dist+130,zx:(r*2-1)*3.2};break;
    }
  }
  if(p.z){
    const z=p.z;
    z.zd-=Z_RUN*dt; // he runs at you while you run at him
    if(z.zd-p.dist>18){ // tracking phase - then he COMMITS and charges straight
      const dx=p.x-z.zx;
      z.zx+=Math.sign(dx)*Math.min(Math.abs(dx),Z_TURN*dt);
    }
    if(Math.abs(z.zd-p.dist)<Z_HIT_D&&Math.abs(z.zx-p.x)<Z_HIT_X){
      p.score=Math.max(0,p.score-500);
      p.red=1.0;p.shake=1.1;play('rotten',0.7);
      addFeed(i,STR.feedZombie,false);
      p.zDone.add(z.zi);p.z=null;
    }else if(z.zd<p.dist-8){ // dodged!
      p.zDone.add(z.zi);p.z=null;
    }
  }
  }catch(e){}
  // cute fish: spawns at the fog line, then streaks at you sweeping the lane
  try{
  if(!p.f)for(let fi=0;fi<FISH_D.length;fi++){
    if(p.fDone.has(fi))continue;
    const sd=FISH_D[fi];
    if(p.dist>sd-F_SPAWN_GAP&&p.dist<sd+40){
      p.f={fi,fd:p.dist+120,t0:raceT,fx:0};break;
    }
  }
  if(p.f){
    const f=p.f;
    f.fd-=F_RUN*dt; // ~2.5x the zombie's closing speed
    f.fx=Math.sin((raceT-f.t0)*F_SWEEP)*3.6; // full-lane fast sweep
    if(Math.abs(f.fd-p.dist)<F_HIT_D&&Math.abs(f.fx-p.x)<F_HIT_X){
      p.score=Math.max(0,p.score-200);
      p.red=0.8;p.shake=0.8;play('rotten',0.6);
      addFeed(i,STR.feedFish,false);
      p.fDone.add(f.fi);p.f=null;
    }else if(f.fd<p.dist-6){ // it shot past - dodged
      p.fDone.add(f.fi);p.f=null;
    }
  }
  }catch(e){}
  // kawaii special: moving target, tight window, +1000
  try{
  for(let si=0;si<SPECIAL_D.length;si++){
    if(p.spCaught.has(si))continue;
    const sd=SPECIAL_D[si];
    if(Math.abs(p.dist-sd)<=SP_HIT_D*0.7){
      const sp=specialPos(raceT);
      if(Math.abs(p.x-sp.x)<=SP_HIT_X&&sp.y<3.0){
        p.spCaught.add(si);p.score+=1000;
        play('finish',0.45);burst(i,p.x,sp.y,0xffd700);burst(i,p.x,1.2,0xffd700);
        addFeed(i,STR.feedKawaii,true);
        const el=$('score'+i);el.style.transform='scale(1.35)';setTimeout(()=>el.style.transform='scale(1)',180);
      }
    }
  }
  }catch(e){}
  // jellyfish: serene drifter, generous catch window, +300
  try{
  for(let ji=0;ji<JELLY_D.length;ji++){
    if(p.jlCaught.has(ji))continue;
    const jd=JELLY_D[ji];
    if(Math.abs(p.dist-jd)<=JL_HIT_D*0.7){
      const jp=jellyPos(raceT);
      if(Math.abs(p.x-jp.x)<=JL_HIT_X&&jp.y<3.2){
        p.jlCaught.add(ji);p.score+=300;
        play('pickup',0.7);burst(i,p.x,jp.y,0x8fe8ff);
        addFeed(i,STR.feedJelly,true);
      }
    }
  }
  }catch(e){}
  if(biome===2)weeds.forEach((w,wi)=>{
    if(p.weedHits.has(wi))return;
    if(Math.abs(p.dist-w.d)<2.2&&Math.abs(p.x-weedX(w,raceT))<1.6){
      p.weedHits.add(wi);p.score=Math.max(0,p.score-30);p.speed*=0.55;
      p.red=0.7;p.shake=0.7;play('rotten',0.4);addFeed(i,STR.feedWeed,false);}
  });
}
function fx(p,i,it){
  if(it.kind===3){p.red=0.85;p.shake=0.9;play('rotten',0.5);addFeed(i,STR.feedRotten,false);}
  else{play('pickup',0.45);
    burst(i,p.x,1.3,it.kind===0?0xbfeaff:it.kind===1?0xff7a8a:0xf6e21a);
    addFeed(i,it.kind===0?STR.feedIce:it.kind===1?STR.feedLemon:STR.feedMint,true);
    const el=$('score'+i);el.style.transform='scale(1.2)';setTimeout(()=>el.style.transform='scale(1)',120);}
}
function addFeed(i,txt,good){const f=$('feed'+i);const d=document.createElement('div');
  d.className='feedRow '+(good?'good':'bad');d.textContent=txt;f.appendChild(d);
  setTimeout(()=>d.remove(),2100);if(f.children.length>4)f.firstChild.remove();}

/* =================== per-viewer world layout + render =================== */
function layoutWorld(viewer,vi,dt){
  const me=P[viewer];
  const bio=applyBiome(me.dist);
  setGroundTex(matA,bio.idx);setGroundTex(matB,bio.nxt);
  matB.opacity=bio.b;
  const rep=16/260;
  if(matA.map)matA.map.offset.y=-me.dist*rep;
  if(matB.map)matB.map.offset.y=-me.dist*rep;
  // lane path strip for the corridor worlds
  const wantPath=bio.idx===4?PATH_STONE:null;
  if(wantPath){
    if(pathMat.map!==wantPath){pathMat.map=wantPath;}
    pathMat.map.offset.y=-me.dist*(14/260);
    pathMesh.visible=true;
  }else pathMesh.visible=false;
  bubMat.opacity=bio.idx===0?(1-bio.b)*0.85:(bio.nxt===0?bio.b*0.85:0);
  rayMat.opacity=(bio.idx===0?(1-bio.b):bio.nxt===0?bio.b:0)*0.26;
  // scenery
  SCN.forEach(sc=>{
    const gap=18;const base=Math.floor(me.dist/gap)*gap;
    const d=base+sc.slot*gap+(sc.side>0?9:0);
    const z=-(d-me.dist);
    if(z>6||z<-230){sc.mesh.visible=false;return;}
    const b=biomeAt(d);const tex=sceneryTexFor(b,sc.slot);
    if(!tex){sc.mesh.visible=false;return;}
    if(sc.mesh.material.map!==tex){sc.mesh.material.map=tex;sc.mesh.material.needsUpdate=true;}
    const h=b===1?9:b===0?6:7;
    sc.mesh.scale.set(h,h,1);
    const jr=mulberry32(((d*7919)|0)^seed)();
    sc.mesh.position.set(sc.side*(9.5+jr*6),h/2-0.1,z);
    sc.mesh.visible=true;
  });
  // town corridor: one per desert cycle, buildings facing the lane on both sides
  const townC=townCenterFor(me.dist);
  const townZ=-(townC-me.dist);
  const townVisible=cityReady&&townC>0&&townZ<CITY_LEN&&townZ>-320&&biomeAt(townC)===2;
  for(const c of cityInst){
    if(!townVisible){c.g.visible=false;continue;}
    // rotated so facades face the lane; near facade lands at |x| ~= 16
    c.g.position.set(c.side*(16+CITY_NEARZ*CITY_S),CITY_Y,townZ);
    c.g.visible=true;
  }
  // real dune environment: segment-tiled flanks, desert biome only
  for(const e of envPool){
    const base=Math.floor(me.dist/ENV_L)*ENV_L;
    const d=base+e.slot*ENV_L;
    const z=-(d-me.dist);
    const inDesert=biomeAt(Math.max(0,d))===2||biomeAt(Math.max(0,d+ENV_L*0.5))===2;
    const nearTown=townVisible&&Math.abs((d+ENV_L/2)-townC)<CITY_LEN*0.5+ENV_L*0.5;
    if(!inDesert||nearTown||z>ENV_L||z<-320){e.g.visible=false;continue;}
    e.g.position.set(e.side*ENV_X,ENV_Y,z-ENV_L/2);
    e.g.rotation.y=e.side>0?Math.PI:0;
    e.g.visible=true;
  }
  // zombie avocado: each viewer sees only their own chaser
  try{
  if(zombieProto){
    const zin=zombieInst[viewer];
    if(me.z){
      const zrel=-(me.z.zd-me.dist);
      const hop=Math.abs(Math.sin(raceT*9))*0.45;
      zin.position.set(me.z.zx,hop,zrel);
      zin.rotation.y=Math.PI+Math.atan2(me.x-me.z.zx,Math.max(0.5,me.z.zd-me.dist))*0.6;
      zin.rotation.x=0.16; // forward lean = running
      zin.rotation.z=Math.sin(raceT*9)*0.12; // waddle
      zin.visible=zrel<8&&zrel>-160;
    }else zin.visible=false;
  }
  }catch(e){}
  // cute fish: each viewer sees only their own striker
  try{
  if(fishReady){
    const fin=fishInst[viewer];
    if(me.f){
      const frel=-(me.f.fd-me.dist);
      fin.position.set(me.f.fx||0,1.1+Math.sin(raceT*6)*0.25,frel);
      fin.rotation.y=Math.PI/2+Math.cos((raceT-me.f.t0)*F_SWEEP)*0.9; // banks through the sweep
      fin.rotation.z=Math.sin((raceT-me.f.t0)*F_SWEEP)*0.25;
      fin.visible=frel<8&&frel>-150;
    }else fin.visible=false;
  }
  }catch(e){}
  // kawaii special: show the nearest uncaught one for this viewer
  try{
  if(kawaiiInst){
    let shown=false;
    for(let si=0;si<SPECIAL_D.length&&!shown;si++){
      if(me.spCaught.has(si))continue;
      const z=-(SPECIAL_D[si]-me.dist);
      if(z>8||z<-160)continue;
      const sp=specialPos(raceT);
      kawaiiInst.position.set(sp.x,sp.y,z);
      kawaiiInst.rotation.y=raceT*3.0;
      kawaiiInst.rotation.z=Math.sin(raceT*4)*0.18;
      const pulse=1+Math.sin(raceT*6)*0.08;
      kawaiiInst.scale.setScalar(kawaiiInst.userData.baseS?kawaiiInst.userData.baseS*pulse:(kawaiiInst.userData.baseS=kawaiiInst.scale.x)*pulse);
      kawaiiInst.visible=true;shown=true;
    }
    if(!shown)kawaiiInst.visible=false;
  }
  }catch(e){}
  // jellyfish: show the nearest uncaught one for this viewer
  try{
  if(jellyInst){
    let jshown=false;
    for(let ji=0;ji<JELLY_D.length&&!jshown;ji++){
      if(me.jlCaught.has(ji))continue;
      const z=-(JELLY_D[ji]-me.dist);
      if(z>8||z<-160)continue;
      const jp=jellyPos(raceT);
      jellyInst.position.set(jp.x,jp.y,z);
      jellyInst.rotation.y=raceT*0.8;
      jellyInst.visible=true;jshown=true;
    }
    if(!jshown)jellyInst.visible=false;
  }
  }catch(e){}
  // generic world environments (lava / village / lagoon)
  for(const we of WENVS){
    for(const inst of we.insts){
      const base=Math.floor(me.dist/we.len)*we.len;
      const d=base+inst.userData.slot*we.len;
      const z=-(d-me.dist);
      let show=biomeAt(Math.max(0,d))===we.biome&&z<=we.len&&z>-240;
      if(show&&we.alt){const par=(Math.floor(d/we.len)%2)?1:-1;show=inst.userData.side===par;}
      if(!show){inst.visible=false;continue;}
      const g=inst,bb=g.userData.bb;
      g.position.x=g.userData.side<0?(-we.nearX-bb.max.x):(we.nearX-bb.min.x);
      let gy=-0.3-bb.min.y+(we.yOff||0);
      if(Number.isFinite(we.maxY)) gy=Math.min(gy,we.maxY-bb.max.y);
      g.position.y=gy;
      g.position.z=z-bb.max.z;
      g.visible=true;
    }
  }
  // necropolis graveyard clusters: alternating sides through the fog
  if(cataReady)for(const cp of cataPool){
    const base=Math.floor(me.dist/CATA_GAP)*CATA_GAP;
    const d=base+cp.slot*CATA_GAP;
    const z=-(d-me.dist);
    if(biomeAt(Math.max(0,d))!==3||z>CATA_LEN||z<-150){cp.g.visible=false;continue;}
    const side=(Math.floor(d/CATA_GAP)%2)?1:-1;
    cp.g.position.set(side*CATA_X,CATA_Y,z-CATA_LEN/2);
    cp.g.rotation.y=side>0?-Math.PI/2:Math.PI/2;
    cp.g.visible=true;
  }
  // octopus swimmers: drift beside the lane, underwater biome only
  if(octoReady)for(let i=0;i<octoPool.length;i++){
    const op=octoPool[i];
    const base=Math.floor(me.dist/OCTO_GAP)*OCTO_GAP;
    const d=base+i*OCTO_GAP+60;
    const z=-(d-me.dist);
    if(biomeAt(Math.max(0,d))!==0||z>10||z<-190){op.g.visible=false;continue;}
    const r=mulberry32(((d*8887)|0)^seed)();
    const side=r<0.5?-1:1;
    op.g.position.set(side*(9+r*7)+Math.sin(raceT*0.4+i*2)*2.5,
                      4.2+Math.sin(raceT*0.6+i)*1.3,z);
    op.g.rotation.y=raceT*0.25+i;
    op.g.visible=true;
  }
  // scattered desert props (from the user's pack), deterministic by distance
  if(scatterReady)for(let i=0;i<scatPool.length;i++){
    const sp=scatPool[i];
    const base=Math.floor(me.dist/SCAT_GAP)*SCAT_GAP;
    const d=base+i*SCAT_GAP;
    const z=-(d-me.dist);
    const inDesert=biomeAt(Math.max(0,d))===2;
    const nearTown=townVisible&&Math.abs(d-townC)<CITY_LEN*0.55+8;
    if(!inDesert||nearTown||z>8||z<-260){sp.holder.visible=false;continue;}
    const r1=mulberry32(((d*2654435761)|0)^seed)();
    const r2=mulberry32(((d*40503)|0)^seed^0x5ca77e4)();
    const r3=mulberry32(((d*97)|0)^seed^0x1f123bb5)();
    const vi=scatVariantIdx(r1);
    sp.variants.forEach((v,k)=>v.visible=k===vi);
    const side=r2<0.5?-1:1;
    sp.holder.position.set(side*(10+r3*38),0,z);
    sp.holder.rotation.y=r1*6.283;
    const js=0.85+r2*0.45;
    sp.holder.scale.setScalar(js);
    sp.holder.visible=true;
  }
  // Maxi signage: one board every ~170m, alternating sides, content rotates
  if(bbReady)for(let bi=0;bi<bbPool.length;bi++){
    const bb=bbPool[bi];
    const base=Math.floor(me.dist/BB_GAP)*BB_GAP;
    const d=base+bi*BB_GAP+60;
    const z=-(d-me.dist);
    if(z>6||z<-220){bb.g.visible=false;continue;}
    const chunk=Math.round(d/BB_GAP);
    const side=(chunk%2)?1:-1;
    const tex=BB_TEXES[chunk%Math.max(1,BB_TEXES.length)];
    if(tex&&bb.panel.material.map!==tex){bb.panel.material.map=tex;}
    bb.g.position.set(side*10.5,0,z);
    bb.g.rotation.y=side>0?-0.35:0.35;
    bb.g.visible=true;
  }
  // wet patches
  let pi=0;
  for(const w of patches){const z=-(w.d-me.dist);if(z>4||z<-160)continue;if(pi>=patchPool.length)break;
    const m=patchPool[pi++];m.position.set(w.x,0.02,z);m.scale.setScalar(w.r);m.visible=true;}
  for(;pi<patchPool.length;pi++)patchPool[pi].visible=false;
  // tumbleweeds
  let wi2=0;
  weeds.forEach(w=>{const z=-(w.d-me.dist);if(z>4||z<-160)return;if(wi2>=weedPool.length)return;
    const m=weedPool[wi2++];m.position.set(weedX(w,raceT),0.8,z);
    m.rotation.x+=dt*2;m.rotation.z+=dt*1.5;m.visible=true;});
  for(;wi2<weedPool.length;wi2++)weedPool[wi2].visible=false;
  // items - the viewer's unclaimed items only
  let cursor=0;
  for(let k=0;k<items.length&&cursor<ITEM_POOL;k++){
    const it=items[k];const z=-(it.d-me.dist);
    if(z>6)continue;if(z<-200)continue;
    const slot=itemPool[cursor++];
    if(me.claimed.has(k)){slot.holder.visible=false;continue;}
    slot.kinds.forEach((m,ki)=>m.visible=ki===it.kind);
    slot.holder.position.set(it.x,1.1+Math.sin(raceT*2+k)*0.22,z);
    slot.holder.rotation.y=raceT*2.5+k;
    slot.holder.visible=true;
  }
  for(;cursor<ITEM_POOL;cursor++)itemPool[cursor].holder.visible=false;
  // both cans, relative to the viewer
  for(const j of[0,1]){
    const h=canHolders[j];
    if(!P[j].joined){h.visible=false;continue;}
    const z=-(P[j].dist-me.dist);
    h.visible=z<10&&z>-220;
    h.position.set(P[j].x,Math.sin(P[j].dist*0.25)*0.06,z);
    h.rotation.z=-P[j].steer*0.25;
    h.rotation.y=Math.sin(P[j].dist*0.12)*0.15;
  }
  // sparkles: only the viewer's own
  for(const s of sparks){
    if(s.userData.life<=0){s.visible=false;continue;}
    s.visible=s.userData.owner===viewer;
    if(s.visible)s.position.set(s.userData.rel.x,s.userData.rel.y,s.userData.rel.z);
  }
  // camera
  const cam=cams[vi];
  me.shake*=Math.pow(0.02,dt);me.red*=Math.pow(0.05,dt);
  cam.position.x=me.x*0.45+(Math.random()-0.5)*me.shake;
  cam.position.y=4.4+(Math.random()-0.5)*me.shake;
  const boosting=me.boostT>performance.now();
  const split=P[0].joined&&P[1].joined;
  cam.fov=(split?46:62)+(boosting?5:0);cam.updateProjectionMatrix();
  cam.lookAt(me.x*0.3,1.4,-8);
  $('rf'+viewer).style.opacity=me.red.toFixed(2);
}
function updateSparks(dt){
  for(const m of octoMixers)m.update(dt);
  for(const m of fishMix)if(m)m.update(dt);
  if(jellyMix)jellyMix.update(dt);
  for(const s of sparks){if(s.userData.life<=0)continue;
    s.userData.life-=dt;
    s.userData.rel.addScaledVector(s.userData.v,dt);s.userData.v.y-=dt*9;
    const k=Math.max(0,s.userData.life/0.55);s.scale.setScalar(0.3+k*0.7);s.material.opacity=k;}
}
function renderAll(dt){
  const both=P[0].joined&&P[1].joined;
  const pw=Math.floor(VW*DPR),ph=Math.floor(VH*DPR);
  renderer.setScissorTest(true);
  if(!both){
    const v=P[0].joined?0:1;
    renderer.setViewport(0,0,VW,VH);renderer.setScissor(0,0,VW,VH);
    layoutWorld(v,v,dt);renderer.render(scene,cams[v]);
  }else{
    // top half = P1
    renderer.setViewport(0,VH/2,VW,VH/2);renderer.setScissor(0,VH/2,VW,VH/2);
    layoutWorld(0,0,dt);renderer.render(scene,cams[0]);
    // bottom half = P2
    renderer.setViewport(0,0,VW,VH/2);renderer.setScissor(0,0,VW,VH/2);
    layoutWorld(1,1,dt);renderer.render(scene,cams[1]);
  }
  renderer.setScissorTest(false);
}

/* =================== HUD =================== */
function fmtTime(s){const m=Math.floor(s/60),ss=Math.floor(s%60);return String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');}
function updateHud(){
  const both=P[0].joined&&P[1].joined;
  const tLeft=phase==='race'?Math.max(0,(raceEnd-performance.now())/1000):RACE_SECONDS;
  $('timeVal').textContent=fmtTime(tLeft);
  $('timeVal').className=tLeft<=10&&phase==='race'?'low':'';
  const lead=both?(P[0].dist>=P[1].dist?0:1):(P[0].joined?0:1);
  $('stagePill').textContent=STR.stageNames[biomeAt(P[lead].dist)];
  for(const i of[0,1]){
    if(!P[i].joined)continue;
    const p=P[i];
    $('score'+i).textContent=p.score;
    const tot=p.score+Math.floor(p.dist/10);
    if(both){const oth=P[1-i].score+Math.floor(P[1-i].dist/10);
      const r=tot>=oth?1:2;$('pos'+i).textContent=r+STR.posSuffix[r-1];}
    else $('pos'+i).textContent='1'+STR.posSuffix[0];
    const under=biomeAt(p.dist)===0;
    const ow=$('oxy'+i);ow.style.display=under?'block':'none';
    if(under){ow.querySelector('.oxyArc').style.strokeDashoffset=264*(1-p.oxy/100);
      ow.querySelector('.oxyPct').textContent=Math.round(p.oxy);}
    const boosting=p.boostT>performance.now();
    const kmh=Math.round(p.speed*(boosting?1.5:1));
    $('spd'+i).textContent='[ '+String(kmh).padStart(2,'0')+' KM/H ]';
    $('bf'+i).style.width=p.boost+'%';
    const bl=$('bl'+i);const ready=p.boost>=100;
    bl.className='boostLbl'+(ready?' ready':'');
    bl.children[0].textContent=ready?STR.hudBoostReady:STR.hudBoostCharging;
    bl.children[1].textContent=ready?'A':Math.round(p.boost)+'%';
  }
  if(phase==='count'){
    const c=Math.ceil((countEnd-performance.now())/1000);
    $('bigCount').textContent=c>=1?STR.countdown[3-c]||'':STR.countdown[3];
  }
}

/* =================== main loop =================== */
/* dynamic resolution: if real frames run slow, step DPR down until stable */
let _ftAcc=0,_ftN=0,_lastGov=performance.now();
function governFrame(dtMs){
  _ftAcc+=dtMs;_ftN++;
  const now=performance.now();
  if(now-_lastGov>2000&&_ftN>30){
    const avg=_ftAcc/_ftN;
    const floor=ULTRA?0.55:0.7;
    const slow=LITE?22:26;
    if(avg>slow&&DPR>floor){ // struggling -> drop a step
      DPR=Math.max(floor,DPR*0.85);
      renderer.setPixelRatio(DPR);renderer.setSize(VW,VH,false);
    }else if(avg<14&&DPR<DPR_CAP){ // comfortably fast -> restore quality
      DPR=Math.min(DPR_CAP,DPR/0.85);
      renderer.setPixelRatio(DPR);renderer.setSize(VW,VH,false);
    }
    _ftAcc=0;_ftN=0;_lastGov=now;
  }
}
const STEP=1000/60;let acc=0,lastT=performance.now(),paused=false;
addEventListener('blur',()=>paused=true);
addEventListener('focus',()=>{paused=false;lastT=performance.now();});
const dev=new URLSearchParams(location.search).has('dev');
if(dev)$('dev').style.display='block';
let frames=0,fpsAt=performance.now(),lastRender=performance.now();

function loop(now){
  requestAnimationFrame(loop);
  if(paused){lastT=now;lastRender=now;return;}
  const inp=[readInput(0),readInput(1)];
  if(phase==='lobby'){
    if(!assetsReady){lastT=now;requestAnimationFrame&&0;}
    else for(const i of[0,1]){
      const p=P[i];
      // flavor cycling while picking
      if(p.stage===1){
        const sgn=inp[i].steer>0.5?1:inp[i].steer<-0.5?-1:0;
        if(sgn!==0&&p._psgn===0){p.flavor=(p.flavor+sgn+FLAVORS.length)%FLAVORS.length;refreshSlots();}
        p._psgn=sgn;
      }
      if(inp[i].aEdge){
        if(p.stage===0){p.joined=true;p.stage=1;p._armed=false;p._psgn=0;refreshSlots();updateCameras();}
        else if(p.stage===1&&p._armed){p.stage=2;p._armed=false;refreshSlots();}
        else if(p.stage===2&&p._armed){
          const ready=[0,1].every(k=>!P[k].joined||P[k].stage===2);
          if(ready)startRace();
        }
      }
      if(p.joined&&!inp[i].aEdge)p._armed=true;
    }
  }
  else if(phase==='count'){
    if(performance.now()>=countEnd){phase='race';raceStart=performance.now();
      raceEnd=raceStart+RACE_SECONDS*1000;$('bigCount').style.display='none';startSurf();startMusic();}
  }
  else if(phase==='race'){
    raceT=(performance.now()-raceStart)/1000;
    acc+=now-lastT;
    while(acc>=STEP){const dt=STEP/1000;
      for(const i of[0,1])if(P[i].joined)simPlayer(P[i],i,dt,inp[i]);
      // edges are one-shot: clear them after the first sim step of the frame
      inp[0].aEdge=false;inp[1].aEdge=false;
      acc-=STEP;}
    tuneSurf(biomeAt(P[P[0].joined?0:1].dist));
    if(performance.now()>=raceEnd)finishRace();
  }
  else if(phase==='results'){
    if(inp[0].aEdge||inp[1].aEdge)startRace();
    else if(inp[0].bEdge||inp[1].bEdge)enterLobby();
  }
  lastT=now;
  const rdt=Math.min(0.05,(now-lastRender)/1000);
  if(phase==='race')governFrame(now-lastRender);
  lastRender=now;
  updateSparks(rdt);
  if(phase==='race'||phase==='count')renderAll(rdt);
  if(phase!=='lobby'&&phase!=='results')updateHud();
  if(dev&&(frames++,now-fpsAt>=500)){
    const inf=renderer.info;
    const heap=(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576)+'MB heap ':'');
    $('dev').textContent=Math.round(frames*1000/(now-fpsAt))+'fps | tex '+inf.memory.textures+' geo '+inf.memory.geometries+' prog '+(inf.programs?inf.programs.length:0)+' | calls '+inf.render.calls+' tris '+Math.round(inf.render.triangles/1000)+'k | '+heap+'| world '+biomeAt(P[0].joined?P[0].dist:P[1].dist);
    frames=0;fpsAt=now;
  }
}

/* =================== boot =================== */
resize();
enterLobby();
loadAssets().then(async()=>{if(phase!=='lobby')buildCans();await warmUp();finishSplash();});
requestAnimationFrame(loop);
