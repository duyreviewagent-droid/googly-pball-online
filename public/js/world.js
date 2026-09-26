// Draws the arenas: textures are painted on canvases at load, nothing to download.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAPS } from './maps.js';
import { paintMat } from './googly.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const texCache = new Map();
function tex(key, w, h, draw, rep = [1, 1]) {
  let base = texCache.get(key);
  if (!base) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    base = new THREE.CanvasTexture(c); base.colorSpace = THREE.SRGBColorSpace; base.anisotropy = 8;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    texCache.set(key, base);
  }
  const t = base.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true;
  return t;
}
const noiseFill = (g, w, h, n, cols, size = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, size, size); } };
const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

// ------------------------------------------------------------------ textures
const T = {
  turf: rep => tex('turf', 512, 512, (g, w, h) => {
    g.fillStyle = '#2f7a2a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = (x / 64) % 2 ? '#34832e' : '#2b7026'; g.fillRect(x, 0, 64, h); }
    for (let i = 0; i < 26000; i++) { const x = Math.random() * w, y = Math.random() * h; g.strokeStyle = ['#3d9a35', '#256320', '#4aa83f', '#1f5a1c'][i % 4]; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4); g.stroke(); }
    g.globalAlpha = 1; noiseFill(g, w, h, 1500, ['#111a', '#5c4a2a55'], 2);
  }, rep),
  concrete: rep => tex('concrete', 512, 512, (g, w, h) => {
    g.fillStyle = '#8a8a86'; g.fillRect(0, 0, w, h);
    noiseFill(g, w, h, 30000, ['#7a7a76', '#9a9a95', '#6e6e6a', '#a3a39e'], 2);
    for (let i = 0; i < 14; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,36,30,.28)'); gr.addColorStop(1, 'rgba(40,36,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.strokeStyle = 'rgba(40,40,40,.5)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30,30,30,.35)'; g.lineWidth = 1; g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (Math.random() - 0.5) * 30; y += 10 + Math.random() * 20; g.lineTo(x, y); } g.stroke();
  }, rep),
  forest: rep => tex('forest', 512, 512, (g, w, h) => {
    g.fillStyle = '#4a3a24'; g.fillRect(0, 0, w, h);
    noiseFill(g, w, h, 16000, ['#3a2c1a', '#5a4a30', '#6b5436', '#2e2416'], 3);
    for (let i = 0; i < 2200; i++) { const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6.28; g.strokeStyle = ['#8a5a2a', '#a06a30', '#6a4020', '#b58a4a'][i % 4]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke(); }
    for (let i = 0; i < 90; i++) { g.fillStyle = ['#3f6a2a', '#2f5a22', '#56803a'][i % 3]; g.globalAlpha = 0.7; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 12, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }, rep),
  vinyl: (col, stripe) => tex('vinyl' + col + stripe, 256, 256, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe; g.fillRect(0, h * 0.42, w, h * 0.16);
    g.fillStyle = '#fff'; g.font = '900 34px Futura, "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('GOOGLY', w / 2, h * 0.3); g.font = '900 22px Futura, sans-serif'; g.fillText('P-BALL', w / 2, h * 0.78);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (const y of [3, h - 3]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    noiseFill(g, w, h, 900, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.05)'], 3);
  }),
  corrugated: col => tex('corr' + col, 512, 256, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); }
    for (let i = 0; i < 60; i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = `rgba(${110 + Math.random() * 40},${50 + Math.random() * 20},20,${0.15 + Math.random() * 0.3})`; g.beginPath(); g.ellipse(x, y, 2 + Math.random() * 14, 2 + Math.random() * 30, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '700 22px "Avenir Next", sans-serif'; g.fillText(['GPBU 204811 7', 'MSKU 553012 4', 'GGLY 900122 0'][Math.floor(Math.random() * 3)], 30, 40);
  }),
  crate: () => tex('crate', 256, 256, (g, w, h) => {
    g.fillStyle = '#a0763e'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = `rgb(${140 + Math.random() * 40},${100 + Math.random() * 25},${55 + Math.random() * 20})`; g.fillRect(0, y + 1, w, 30); for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(70,40,15,.25)'; g.fillRect(Math.random() * w, y + Math.random() * 30, 20 + Math.random() * 40, 1); } }
    g.strokeStyle = '#5a3a18'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
    g.beginPath(); g.moveTo(18, 18); g.lineTo(w - 18, h - 18); g.stroke();
    g.fillStyle = '#2a1a0a'; for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  }),
  planks: (rep, tone = 0) => tex('planks' + tone, 512, 256, (g, w, h) => {
    const base = tone ? [95, 70, 45] : [135, 98, 60];
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = `rgb(${base[0] + Math.random() * 25},${base[1] + Math.random() * 18},${base[2] + Math.random() * 12})`; g.fillRect(0, y, w, 31);
      for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(50,30,12,${Math.random() * 0.3})`; g.fillRect(Math.random() * w, y + Math.random() * 31, 30 + Math.random() * 80, 1); }
      g.fillStyle = 'rgba(20,12,5,.7)'; g.fillRect(0, y + 31, w, 1.5);
      g.fillStyle = '#333'; for (let x = 20 + Math.random() * 60; x < w; x += 160) { g.fillRect(x, y + 6, 2.5, 2.5); g.fillRect(x, y + 23, 2.5, 2.5); }
    }
  }, rep),
  bark: () => tex('bark', 128, 512, (g, w, h) => {
    g.fillStyle = '#4a3322'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = Math.random() * w; g.strokeStyle = ['#2a1c12', '#5e4430', '#3a2818'][i % 3]; g.lineWidth = 2 + Math.random() * 5; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y < h; y += 30) g.lineTo(x + (Math.random() - 0.5) * 8, y); g.stroke(); }
  }),
  logEnd: () => tex('logEnd', 128, 128, (g, w) => { g.fillStyle = '#c89a62'; g.fillRect(0, 0, w, w); for (let r = 60; r > 2; r -= 5) { g.strokeStyle = r % 10 ? '#a87a48' : '#8a5e34'; g.lineWidth = 1.5; g.beginPath(); g.arc(w / 2 + (Math.random() - .5) * 3, w / 2, r, 0, 7); g.stroke(); } g.strokeStyle = '#4a3322'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, w / 2, 60, 0, 7); g.stroke(); }),
  hay: () => tex('hay', 256, 256, (g, w, h) => { g.fillStyle = '#c9a44a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { const x = Math.random() * w, y = Math.random() * h, a = (Math.random() - 0.5) * 0.8; g.strokeStyle = ['#e2c064', '#a88432', '#d8b556', '#8a6a22'][i % 4]; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); } g.fillStyle = '#6a4a1a'; g.fillRect(0, h * 0.3, w, 3); g.fillRect(0, h * 0.7, w, 3); }),
  rock: () => tex('rock', 256, 256, (g, w, h) => { g.fillStyle = '#7a7670'; g.fillRect(0, 0, w, h); noiseFill(g, w, h, 12000, ['#6a665f', '#8c8880', '#5a5650', '#9a968e', '#5c6a4a'], 3); }),
  brick: rep => tex('brick', 512, 512, (g, w, h) => {
    g.fillStyle = '#5a4a40'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) { const x = col * 64 + (row % 2) * 32, y = row * 32; g.fillStyle = `rgb(${120 + Math.random() * 40},${50 + Math.random() * 20},${38 + Math.random() * 15})`; g.fillRect(x + 2, y + 2, 60, 28); noiseFill(g, 0, 0, 0, []); }
    noiseFill(g, w, h, 8000, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.06)'], 2);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, rep),
  steel: rep => tex('steel', 256, 256, (g, w, h) => { g.fillStyle = '#6c7078'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) { g.fillStyle = '#8a8f98'; g.save(); g.translate(x, y); g.rotate(0.7); g.fillRect(-5, -1.5, 10, 3); g.restore(); } noiseFill(g, w, h, 2000, ['rgba(0,0,0,.1)', 'rgba(120,70,30,.15)'], 2); }, rep),
  net: () => tex('net', 128, 128, (g, w) => { g.clearRect(0, 0, w, w); g.strokeStyle = 'rgba(20,20,20,.95)'; g.lineWidth = 3; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }),
  splat: () => {
    const cs = []; for (let k = 0; k < 4; k++) cs.push(tex('splat' + k, 256, 256, (g, w) => {
      g.fillStyle = '#fff'; g.beginPath();
      const n = 22; for (let i = 0; i <= n; i++) { const a = i / n * 6.283, r = 60 + Math.random() * 30 * (i % 2 ? 1 : 0.5); g.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r); } g.fill();
      for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, d = 70 + Math.random() * 50, r = 3 + Math.random() * 11; g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d, r, 0, 7); g.fill(); g.lineWidth = r * 0.8; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 55, w / 2 + Math.sin(a) * 55); g.lineTo(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d); g.stroke(); }
      // a drip or two running down
      for (let i = 0; i < 2; i++) { const x = w / 2 + (Math.random() - 0.5) * 70; g.fillRect(x - 3, w / 2, 6, 60 + Math.random() * 50); g.beginPath(); g.arc(x, w / 2 + 110, 5, 0, 7); g.fill(); }
    }));
    return cs;
  },
};

// sky dome with a painted gradient + sun glow
function sky(kind) {
  const top = { day: '#3f86d8', dusk: '#1c2a5a', indoor: '#111' }[kind], mid = { day: '#9cc8ee', dusk: '#e0845a', indoor: '#222' }[kind], low = { day: '#dfeaf2', dusk: '#f5c07a', indoor: '#222' }[kind];
  const t = tex('sky' + kind, 16, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(0.42, mid); gr.addColorStop(0.5, low); gr.addColorStop(1, '#5a5a50'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
  return m;
}

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: /shot|icon/.test(location.search) });
    this.lq = /lq=1/.test(location.search);
    // phones: cap the pixel ratio and use cheaper, smaller shadows
    this.mobile = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
    this.renderer.setPixelRatio(this.lq ? 0.6 : Math.min(devicePixelRatio, this.mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.env;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 900);
    this.canvas = canvas;
    this.decals = []; this.parts = []; this.splatTex = T.splat();
    this.resize();
    addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(canvas);
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  clear() { if (this.level) { this.scene.remove(this.level); this.level.traverse(o => { o.geometry?.dispose?.(); }); } this.decals = []; this.parts = []; }

  load(id) {
    this.clear();
    const map = this.map = MAPS[id];
    const L = this.level = new THREE.Group(); this.scene.add(L);
    this.fx = new THREE.Group(); L.add(this.fx);
    const S = this.scene;
    // light + air
    const kind = map.sky;
    S.background = new THREE.Color(kind === 'dusk' ? 0x1c2a5a : kind === 'day' ? 0x9cc8ee : 0x16161a);
    S.fog = kind === 'indoor' ? new THREE.Fog(0x1e1d1c, 25, 80) : kind === 'dusk' ? new THREE.FogExp2(0x9a7a6a, 0.018) : new THREE.Fog(0xcfe0ee, 60, 260);
    if (kind !== 'indoor') L.add(sky(kind));
    const hemi = new THREE.HemisphereLight(kind === 'dusk' ? 0xffc9a0 : kind === 'day' ? 0xdcecff : 0xfff2dc, kind === 'indoor' ? 0x2a2622 : 0x3a4a2a, kind === 'indoor' ? 0.9 : 1.1);
    L.add(hemi);
    const sun = new THREE.DirectionalLight(kind === 'dusk' ? 0xffb070 : kind === 'day' ? 0xfff4e0 : 0xfff0d8, kind === 'indoor' ? 1.4 : kind === 'dusk' ? 2.1 : 2.8);
    sun.position.set(kind === 'dusk' ? -40 : 30, kind === 'dusk' ? 22 : 60, kind === 'dusk' ? 18 : 25);
    sun.castShadow = true; { const ms = this.lq ? 1024 : this.mobile ? 2048 : 4096; sun.shadow.mapSize.set(ms, ms); } sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    const R = Math.max(map.W, map.D) * 0.62;
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 200 });
    L.add(sun); L.add(sun.target);
    this.renderer.toneMappingExposure = kind === 'indoor' ? 1.15 : kind === 'dusk' ? 1.05 : 0.95;
    this.scene.environmentIntensity = kind === 'indoor' ? 0.35 : 0.5;
    // ground
    const gt = map.ground === 'turf' ? T.turf([map.W / 6, map.D / 6]) : map.ground === 'concrete' ? T.concrete([map.W / 6, map.D / 6]) : T.forest([map.W / 5, map.D / 5]);
    const outer = map.ground === 'forest' ? 3.2 : map.ground === 'turf' ? 3 : 1.02;
    const gw = map.W * outer, gd = map.D * outer;
    if (map.ground === 'turf' || map.ground === 'forest') gt.repeat.set(gw / 6, gd / 6);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), std({ map: gt, roughness: map.ground === 'concrete' ? 0.75 : 0.95, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; L.add(ground);
    if (map.ground === 'turf') this.fieldLines(L, map);
    for (const c of map.colliders) this.drawCollider(L, c, map);
    this.dressing(L, map);
    // ammo crates
    this.crates = map.ammo.map(([x, z, y]) => { const g = this.ammoCrate(); g.position.set(x, y ?? 0, z); L.add(g); return g; });
    return map;
  }

  fieldLines(L, map) {
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.9 });
    const line = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), white); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.005, z); m.receiveShadow = true; L.add(m); };
    line(0.12, map.D, 0, 0); line(map.W, 0.12, 0, map.D / 2 - 0.2); line(map.W, 0.12, 0, -map.D / 2 + 0.2);
    for (const s of [-1, 1]) { line(0.12, map.D, s * (map.W / 2 - 0.2), 0); line(0.12, map.D, s * map.W / 4, 0); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.62, 64), white); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; L.add(ring);
  }

  drawCollider(L, c, map) {
    const m = c.m;
    const place = (mesh, y = c.y + c.h / 2) => { mesh.position.set(c.x, y, c.z); mesh.castShadow = mesh.receiveShadow = true; L.add(mesh); return mesh; };
    const boxMat = (map2) => std({ map: map2, roughness: 0.8 });
    const bunker = (col, stripe) => phys({ map: T.vinyl(col, stripe), roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.4 });
    switch (m) {
      case 'cakeR': case 'cakeB': case 'canY': case 'canR': case 'canB': case 'dorito': {
        const col = { cakeR: ['#c8102e', '#ffffff'], cakeB: ['#1450c8', '#ffffff'], canY: ['#f2b705', '#111111'], canR: ['#c8102e', '#111111'], canB: ['#1450c8', '#f2b705'], dorito: ['#111111', '#34c759'] }[m];
        const geo = m === 'dorito' ? new THREE.CylinderGeometry(c.r * 0.55, c.r, c.h - 0.2, 36) : new THREE.CylinderGeometry(c.r * 0.97, c.r, c.h - 0.15, 36);
        place(new THREE.Mesh(geo, bunker(...col)), c.y + (c.h - 0.15) / 2);
        const top = new THREE.Mesh(new THREE.SphereGeometry(m === 'dorito' ? c.r * 0.55 : c.r * 0.97, 36, 10, 0, 6.283, 0, Math.PI / 2), bunker(col[0], col[0]));
        top.scale.y = m === 'dorito' ? 0.5 : 0.16; place(top, c.y + c.h - (m === 'dorito' ? 0.2 : 0.15));
        // tie-down straps + stakes
        const strap = std({ color: 0x111111, roughness: 0.9 });
        for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28 + 0.4, s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5), strap); s.position.set(c.x + Math.cos(a) * (c.r + 0.18), 0.12, c.z + Math.sin(a) * (c.r + 0.18)); s.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); L.add(s); }
        break;
      }
      case 'snake': case 'temple': case 'templeB': case 'mini': {
        const col = { snake: ['#1450c8', '#f2b705'], temple: ['#c8102e', '#ffffff'], templeB: ['#111111', '#34c759'], mini: ['#f2b705', '#111111'] }[m];
        const mat = bunker(...col);
        const geo = new RoundedBoxGeometry(c.w, c.h, c.d, 5, Math.min(c.w, c.d, c.h) * 0.3);
        const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * Math.max(1, Math.round(Math.max(c.w, c.d) / 1.5)));
        mat.map.wrapS = THREE.RepeatWrapping;
        place(new THREE.Mesh(geo, mat));
        break;
      }
      case 'net': case 'fence': {
        const len = Math.max(c.w, c.d), along = c.w > c.d, h = c.h;
        if (m === 'net') {
          const t = T.net(); t.repeat.set(len / 0.25, h / 0.25);
          const net = new THREE.Mesh(new THREE.PlaneGeometry(len, h), std({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }));
          net.position.set(c.x, h / 2, c.z); if (!along) net.rotation.y = Math.PI / 2; net.castShadow = true; L.add(net);
          const pole = std({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.4 });
          for (let k = -len / 2; k <= len / 2 + 0.01; k += 5) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h + 0.4), pole); p.position.set(along ? c.x + k : c.x, (h + 0.4) / 2, along ? c.z : c.z + k); p.castShadow = true; L.add(p); }
          // skirt at the bottom
          const skirt = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.6), std({ color: 0x14141a, roughness: 0.9, side: THREE.DoubleSide })); skirt.position.set(c.x, 0.3, c.z); if (!along) skirt.rotation.y = Math.PI / 2; L.add(skirt);
        } else {
          const wood = std({ map: T.planks([len / 3, 1], 1), roughness: 0.9 });
          const f = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.15, 2.2, along ? 0.15 : len), wood); f.position.set(c.x, 1.1, c.z); f.castShadow = f.receiveShadow = true; L.add(f);
        }
        break;
      }
      case 'brick': {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), std({ map: T.brick([Math.max(c.w, c.d) / 6, c.h / 6]), roughness: 0.9 }));
        place(wall); break;
      }
      case 'contR': case 'contB': case 'contG': case 'contO': {
        const col = { contR: '#9a2a1e', contB: '#1f4e8a', contG: '#2e6a3a', contO: '#c8741e' }[m];
        const t = T.corrugated(col);
        const side = std({ map: t, roughness: 0.55, metalness: 0.45 });
        const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
        const mesh = place(new THREE.Mesh(geo, side));
        // door end with lock bars
        const bar = std({ color: 0x777777, metalness: 0.9, roughness: 0.4 }), along = c.w > c.d;
        for (let k = -1; k <= 1; k += 0.66) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, c.h - 0.2), bar); b.position.set(c.x + (along ? c.w / 2 + 0.03 : k * 0.8), c.y + c.h / 2, c.z + (along ? k * 0.8 : c.d / 2 + 0.03)); L.add(b); }
        void mesh; break;
      }
      case 'crate': place(new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), boxMat(T.crate()))); break;
      case 'pallet': {
        // stack of pallets with sacks
        const n = Math.round(c.h / 0.15), wood = std({ map: T.planks([1, 0.4]), roughness: 0.9 });
        for (let i = 0; i < n; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.13, c.d), wood); p.position.set(c.x, c.y + 0.07 + i * 0.15, c.z); p.castShadow = p.receiveShadow = true; L.add(p); }
        break;
      }
      case 'barrier': {
        const g = new THREE.Shape(); const w = c.d / 2; g.moveTo(-w, 0); g.lineTo(w, 0); g.lineTo(w * 0.6, c.h * 0.25); g.lineTo(w * 0.3, c.h); g.lineTo(-w * 0.3, c.h); g.lineTo(-w * 0.6, c.h * 0.25); g.closePath();
        const geo = new THREE.ExtrudeGeometry(g, { depth: c.w, bevelEnabled: false }); geo.translate(0, 0, -c.w / 2); geo.rotateY(Math.PI / 2);
        const mesh = new THREE.Mesh(geo, std({ map: T.concrete([0.5, 0.5]), roughness: 0.85 })); mesh.position.set(c.x, c.y, c.z); mesh.castShadow = mesh.receiveShadow = true; L.add(mesh);
        break;
      }
      case 'drum': {
        const mat = std({ color: 0x1f5aa0, metalness: 0.6, roughness: 0.45 });
        place(new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 28), mat));
        for (const y of [0.3, 0.7]) { const r = new THREE.Mesh(new THREE.TorusGeometry(c.r + 0.005, 0.015, 6, 28), mat); r.rotation.x = Math.PI / 2; r.position.set(c.x, c.y + y * c.h, c.z); L.add(r); }
        break;
      }
      case 'shelf': {
        const orange = std({ color: 0xd8621a, metalness: 0.6, roughness: 0.5 }), blue = std({ color: 0x1f4e8a, metalness: 0.6, roughness: 0.5 });
        const H = 5;
        for (const dz of [-c.d / 2, 0, c.d / 2]) for (const dx of [-c.w / 2, c.w / 2]) { const u = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, 0.08), blue); u.position.set(c.x + dx, H / 2, c.z + dz); u.castShadow = true; L.add(u); }
        for (const y of [c.h, 2.8, 4.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.1, c.d), orange); b.position.set(c.x, y, c.z); b.castShadow = b.receiveShadow = true; L.add(b); }
        const box1 = new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.9, c.h - 0.1, c.d * 0.95), boxMat(T.crate())); box1.position.set(c.x, (c.h - 0.1) / 2, c.z); box1.castShadow = true; L.add(box1);
        for (const y of [2.85, 4.45]) for (let k = -3; k <= 3; k += 1.5) { const bx = new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.8, 0.9, 1.2), std({ color: 0xb08a5a, roughness: 0.9 })); bx.position.set(c.x, y + 0.5, c.z + k); bx.castShadow = true; L.add(bx); }
        break;
      }
      case 'steel': case 'steelStair': {
        const mat = std({ map: T.steel([c.w / 1.5, c.d / 1.5]), metalness: 0.75, roughness: 0.45 });
        if (m === 'steelStair') { const tread = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.06, c.d), mat); tread.position.set(c.x, c.y + c.h - 0.03, c.z); tread.castShadow = tread.receiveShadow = true; L.add(tread); const riser = new THREE.Mesh(new THREE.BoxGeometry(0.04, c.h, c.d), std({ color: 0x3a3e44, metalness: 0.7, roughness: 0.5 })); riser.position.set(c.x - c.w / 2, c.y + c.h / 2, c.z); L.add(riser); for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, 0.05), std({ color: 0xd8b41a, metalness: 0.6, roughness: 0.5 })); st.position.set(c.x, c.y + c.h / 2, c.z + s * c.d / 2); st.castShadow = true; L.add(st); } }
        else place(new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), mat));
        break;
      }
      case 'rail': {
        const y = std({ color: 0xe0b418, metalness: 0.6, roughness: 0.4 }), along = c.w > c.d, len = Math.max(c.w, c.d);
        for (const h of [0.5, 1.0]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len), y); r.rotation.z = along ? Math.PI / 2 : 0; if (!along) r.rotation.x = Math.PI / 2; r.position.set(c.x, c.y + h, c.z); r.castShadow = true; L.add(r); }
        for (let k = -len / 2; k <= len / 2 + 0.01; k += 1.5) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1), y); p.position.set(along ? c.x + k : c.x, c.y + 0.5, along ? c.z : c.z + k); L.add(p); }
        // kick plate stops shots at your feet
        const kick = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.02, 0.15, along ? 0.02 : len), y); kick.position.set(c.x, c.y + 0.075, c.z); L.add(kick);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), std({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.1, metalness: 0, depthWrite: false })); mesh.position.set(c.x, c.y + c.h / 2, c.z); L.add(mesh);
        break;
      }
      case 'post': place(new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, 16), std({ color: 0x3a3e44, metalness: 0.8, roughness: 0.4 }))); break;
      case 'plank': case 'plankwall': case 'plankstep': {
        const long = Math.max(c.w, c.d), t = T.planks([long / 3, Math.max(c.h, Math.min(c.w, c.d)) / 1.5]);
        if (c.d > c.w) { t.rotation = Math.PI / 2; }
        place(new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), std({ map: t, roughness: 0.85 }))); break;
      }
      case 'logpost': place(new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r * 1.1, c.h, 14), std({ map: T.bark(), roughness: 0.95 }))); break;
      case 'log': {
        // stacked logs along the long axis
        const along = c.w > c.d, len = Math.max(c.w, c.d), r = c.h / 3.6, bark = std({ map: T.bark(), roughness: 0.95 }), end = std({ map: T.logEnd(), roughness: 0.9 });
        for (const [dx, dy] of [[-r, r], [r, r], [0, r * 2.7]]) {
          const lg = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), [bark, end, end]);
          lg.rotation.set(along ? 0 : Math.PI / 2, 0, along ? Math.PI / 2 : 0);
          lg.position.set(c.x + (along ? 0 : dx), c.y + dy, c.z + (along ? dx : 0)); lg.castShadow = lg.receiveShadow = true; L.add(lg);
        }
        break;
      }
      case 'hay': {
        const h = new THREE.Mesh(new RoundedBoxGeometry(c.w, c.h, c.d, 3, 0.08), std({ map: T.hay(), roughness: 1 })); place(h); break;
      }
      case 'rock': {
        const r = rng(Math.floor(c.x * 100 + c.z * 7 + 999)), geo = new THREE.IcosahedronGeometry(1, 2), p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) { const k = 0.8 + r() * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
        geo.computeVertexNormals();
        const rock = new THREE.Mesh(geo, std({ map: T.rock(), roughness: 0.95, flatShading: true })); rock.scale.set(c.r * 1.05, c.h * 0.62, c.r * 1.05);
        place(rock, c.y + c.h * 0.42); break;
      }
      case 'tree': this.tree(L, c); break;
      default: place(new THREE.Mesh(new THREE.BoxGeometry(c.w || 1, c.h, c.d || 1), std({ color: 0x888888 })));
    }
  }

  tree(L, c) {
    const r = rng(c.seed || 1);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.55, c.r * 1.15, c.h, 12), std({ map: T.bark(), roughness: 0.95 }));
    trunk.position.set(c.x, c.h / 2, c.z); trunk.castShadow = trunk.receiveShadow = true; L.add(trunk);
    this.treeMat ||= [0x1f3a1c, 0x264a22, 0x2c5226].map(col => std({ color: col, roughness: 0.9 }));
    const layers = 5 + Math.floor(r() * 3);
    for (let i = 0; i < layers; i++) {
      const k = i / layers, rad = (2.6 - k * 2.0) * (0.9 + r() * 0.2), y = c.h * 0.32 + k * c.h * 0.72;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, 2.4, 9), this.treeMat[i % 3]);
      cone.position.set(c.x + (r() - 0.5) * 0.3, y, c.z + (r() - 0.5) * 0.3); cone.rotation.y = r() * 6; cone.castShadow = true; L.add(cone);
    }
  }

  dressing(L, map) {
    const r = rng(map.id * 77 + 5);
    if (map.sky === 'day') {
      // stadium lights, a scoreboard hut and a ring of trees far out
      for (const [x, z] of [[-map.W / 2 - 4, -map.D / 2 - 4], [map.W / 2 + 4, -map.D / 2 - 4], [-map.W / 2 - 4, map.D / 2 + 4], [map.W / 2 + 4, map.D / 2 + 4]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 16), std({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.4 })); pole.position.set(x, 8, z); pole.castShadow = true; L.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.3), std({ color: 0x333333, emissive: 0xfff6dd, emissiveIntensity: 0.6 })); head.position.set(x, 16, z); head.lookAt(0, 0, 0); L.add(head);
      }
      for (let i = 0; i < 70; i++) { const a = r() * Math.PI * 2, d = 50 + r() * 60; this.tree(L, { x: Math.cos(a) * d * 1.3, z: Math.sin(a) * d, r: 0.4, h: 10 + r() * 8, seed: i + 50 }); }
      // bleachers
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 0.8), std({ color: 0xb0b6be, metalness: 0.7, roughness: 0.4 })); b.position.set(s * 8, 0.35 + k * 0.45, map.D / 2 + 2.5 + k * 0.8); b.castShadow = true; L.add(b); }
    }
    if (map.sky === 'indoor') {
      // roof, trusses, hanging lamps, skylights
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(map.W, map.D), std({ color: 0x3a3a3c, roughness: 0.9, side: THREE.DoubleSide })); roof.rotation.x = Math.PI / 2; roof.position.y = map.roof; L.add(roof);
      const steel = std({ color: 0x2c3036, metalness: 0.8, roughness: 0.5 });
      for (let x = -map.W / 2 + 4; x < map.W / 2; x += 6) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, map.D), steel); t.position.set(x, map.roof - 0.4, 0); L.add(t);
      }
      for (let x = -18; x <= 18; x += 12) for (const z of [-9, 9]) {
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.45, 20, 1, true), std({ color: 0x2a4a3a, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide })); shade.position.set(x, map.roof - 2.2, z); L.add(shade);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); bulb.position.set(x, map.roof - 2.4, z); L.add(bulb);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2), steel); cord.position.set(x, map.roof - 1.1, z); L.add(cord);
        const pl = new THREE.PointLight(0xffe2b0, 60, 24, 1.8); pl.position.set(x, map.roof - 2.6, z); L.add(pl);
      }
      // painted floor markings
      const y = std({ color: 0xe0b418, roughness: 0.8 });
      for (const s of [-1, 1]) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(map.W - 4, 0.15), y); ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.004, s * 7.5); L.add(ln); }
      // big roller doors
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), std({ map: T.corrugated('#6a6e74'), metalness: 0.6, roughness: 0.5 })); d.position.set(s * (map.W / 2 - 0.01), 2.5, 8); d.rotation.y = -s * Math.PI / 2; L.add(d); }
    }
    if (map.sky === 'dusk') {
      for (let i = 0; i < 110; i++) { const a = r() * Math.PI * 2, d = 36 + r() * 60; this.tree(L, { x: Math.cos(a) * d * 1.2, z: Math.sin(a) * d, r: 0.4, h: 11 + r() * 9, seed: i + 300 }); }
      // lanterns on the forts
      for (const s of [-1, 1]) { const l = new THREE.PointLight(0xffa040, 25, 14, 1.6); l.position.set(s * 20, 4, 0); L.add(l); const g = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc070 })); g.position.copy(l.position); L.add(g); }
      // ferns and grass clumps
      const fern = std({ color: 0x3a6a2a, roughness: 0.9, side: THREE.DoubleSide });
      for (let i = 0; i < 160; i++) { const x = (r() - 0.5) * map.W, z = (r() - 0.5) * map.D; const f = new THREE.Mesh(new THREE.ConeGeometry(0.25 + r() * 0.2, 0.35, 5, 1, true), fern); f.position.set(x, 0.17, z); f.rotation.y = r() * 6; L.add(f); }
    }
  }

  ammoCrate() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.42, 0.5, 3, 0.04), std({ map: tex('ammo', 256, 128, (c, w, h) => { c.fillStyle = '#3d4a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8d24a'; c.fillRect(0, h * 0.38, w, h * 0.24); c.fillStyle = '#111'; c.font = '900 28px Futura, "Arial Black", sans-serif'; c.textAlign = 'center'; c.fillText('PAINT +40', w / 2, h * 0.58); noiseFill(c, w, h, 900, ['rgba(0,0,0,.15)'], 2); }), roughness: 0.7 }));
    box.position.y = 0.21; box.castShadow = true; g.add(box);
    // open lid with paint pods sticking out
    const cols = ['#ff2d55', '#ffd60a', '#0a84ff', '#34c759', '#bf5af2'];
    for (let i = 0; i < 5; i++) {
      const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 10), phys({ color: 0xffffff, transmission: 0.5, roughness: 0.1, transparent: true, opacity: 0.7 }));
      pod.position.set(-0.24 + i * 0.12, 0.52, 0); pod.rotation.z = (i - 2) * 0.12; g.add(pod);
      const inside = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.16, 4, 8), std({ color: cols[i], roughness: 0.3 })); inside.position.copy(pod.position); inside.rotation.copy(pod.rotation); g.add(inside);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 40), new THREE.MeshBasicMaterial({ color: 0xffe04a, transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    g.userData.ring = ring;
    return g;
  }
  setCrate(i, on) { const c = this.crates?.[i]; if (c) c.visible = !!on; }

  // ------------------------------------------------------------------ paint effects
  /** A splat decal on a wall/floor at p with surface normal n. */
  splat(p, n, col, size = 1) {
    const m = new THREE.MeshStandardMaterial({ color: col, map: this.splatTex[Math.floor(Math.random() * 4)], transparent: true, alphaTest: 0.35, roughness: 0.22, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 - this.decals.length % 8 * 0.1, depthWrite: false });
    m.map.colorSpace = THREE.NoColorSpace;
    const s = (0.34 + Math.random() * 0.25) * size;
    const d = new THREE.Mesh(new THREE.PlaneGeometry(s, s), m);
    const N = new THREE.Vector3(...n);
    d.position.set(p[0] + N.x * 0.012, p[1] + N.y * 0.012, p[2] + N.z * 0.012);
    d.lookAt(d.position.clone().add(N));
    // keep drips pointing down on walls
    if (Math.abs(N.y) < 0.7) { const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(); d.updateMatrixWorld(); const ly = new THREE.Vector3(0, 1, 0).applyQuaternion(d.quaternion); const ang = Math.atan2(ly.clone().cross(up).dot(N), ly.dot(up)); q.setFromAxisAngle(N, ang + Math.PI); d.quaternion.premultiply(q); }
    else d.rotation.z = Math.random() * 6.28;
    d.receiveShadow = true;
    this.fx.add(d); this.decals.push(d);
    if (this.decals.length > 350) { const o = this.decals.shift(); this.fx.remove(o); o.geometry.dispose(); o.material.dispose(); }
    this.burst(p, n, col, 10);
  }
  burst(p, n, col, count = 10) {
    const mat = paintMat(col);
    this.dropGeo ||= new THREE.SphereGeometry(1, 6, 4);
    for (let i = 0; i < count; i++) {
      const d = new THREE.Mesh(this.dropGeo, mat); const s = 0.01 + Math.random() * 0.025; d.scale.setScalar(s);
      d.position.set(p[0], p[1], p[2]);
      const v = new THREE.Vector3(n[0] + (Math.random() - 0.5) * 1.6, n[1] + (Math.random() - 0.3) * 1.2, n[2] + (Math.random() - 0.5) * 1.6).multiplyScalar(2 + Math.random() * 3);
      this.fx.add(d); this.parts.push({ m: d, v, life: 0.5 + Math.random() * 0.4 });
    }
    // a puff of paint mist
    const mist = new THREE.Mesh(this.dropGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false }));
    mist.position.set(p[0], p[1], p[2]); mist.scale.setScalar(0.1); this.fx.add(mist); this.parts.push({ m: mist, v: new THREE.Vector3(n[0], n[1], n[2]).multiplyScalar(0.6), life: 0.35, mist: true });
  }
  puff(p, dir) {
    // compressed air out of the barrel
    const mist = new THREE.Mesh(this.dropGeo ||= new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }));
    mist.position.copy(p); mist.scale.setScalar(0.04); this.fx.add(mist); this.parts.push({ m: mist, v: dir.clone().multiplyScalar(2.5), life: 0.22, mist: true });
  }
  update(dt, t) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life -= dt;
      if (q.life <= 0) { this.fx.remove(q.m); if (q.mist) q.m.material.dispose(); this.parts.splice(i, 1); continue; }
      if (q.mist) { q.m.scale.multiplyScalar(1 + dt * 7); q.m.material.opacity *= 1 - dt * 5; q.m.position.addScaledVector(q.v, dt); continue; }
      q.v.y -= 9.8 * dt; q.m.position.addScaledVector(q.v, dt);
      if (q.m.position.y < 0.01) { q.m.position.y = 0.01; q.v.set(0, 0, 0); }
    }
    if (this.crates) for (const c of this.crates) { const rg = c.userData.ring; rg.material.opacity = 0.35 + Math.sin(t * 4) * 0.25; rg.scale.setScalar(1 + Math.sin(t * 4) * 0.05); }
  }
}
