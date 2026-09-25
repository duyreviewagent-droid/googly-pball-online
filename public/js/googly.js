// The googly paintballer: a glossy jelly bean with wobbly googly eyes, a paintball marker, skins and paint splats.
import * as THREE from 'three';

export const SCALE = 1.2;
const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function textSprite(text, { size = 44, color = '#fff', bg = 'rgba(0,0,0,.55)', border = null, pad = 12 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `900 ${size}px "Avenir Next", system-ui, sans-serif`;
  g.font = font;
  const w = g.measureText(text).width + pad * 2, h = size * 1.25 + pad * 2;
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  g.font = font;
  if (bg) { g.fillStyle = bg; rr(g, 0, 0, c.width, c.height, 16); g.fill(); }
  if (border) { g.strokeStyle = border; g.lineWidth = 5; rr(g, 3, 3, c.width - 6, c.height - 6, 14); g.stroke(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(c.width / 200, c.height / 200, 1); s.renderOrder = 10;
  return s;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x, y, r); g.closePath(); }

// ------------------------------------------------------------------ skins
export const SKINS = [
  { id: 'none', name: 'Classic', desc: 'Your colour, nice and shiny' },
  { id: 'camo', name: 'Camo', desc: 'Win 1 match' },
  { id: 'tiger', name: 'Tiger', desc: 'Win 2 matches' },
  { id: 'galaxy', name: 'Galaxy', desc: 'Win 3 matches' },
  { id: 'chrome', name: 'Chrome', desc: 'Win 4 matches' },
  { id: 'rainbow', name: 'Rainbow', desc: 'Win 5 matches' },
  { id: 'lava', name: 'Lava', desc: 'Win 6 matches' },
];
export const CHAMP = { id: 'champion', name: 'Champion Gold', desc: 'Worn by whoever won the last match' };
const skinCache = new Map();
function skinTex(id, color) {
  const key = id + color;
  if (skinCache.has(key)) return skinCache.get(key);
  const base = new THREE.Color(color), hex = '#' + base.getHexString();
  const dk = '#' + base.clone().multiplyScalar(0.45).getHexString(), lt = '#' + base.clone().lerp(new THREE.Color('#fff'), 0.35).getHexString();
  let t = null;
  if (id === 'camo') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#6b7a3a'; g.fillRect(0, 0, w, w);
    for (const [c, n] of [['#4a5a2a', 26], ['#3a2e1c', 18], ['#8f9a5a', 16], [hex, 8]]) for (let i = 0; i < n; i++) {
      g.fillStyle = c; g.beginPath(); const x = Math.random() * w, y = Math.random() * w;
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, r = 12 + Math.random() * 22; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7); }
      g.fill();
    }
  });
  if (id === 'tiger') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#ff8a1c'; g.fillRect(0, 0, w, w); g.fillStyle = '#1a1008';
    for (let i = 0; i < 14; i++) { const y = i * 19 + Math.random() * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(60, y - 12, 100, y + 18, 140 + Math.random() * 60, y + 3); g.lineTo(130, y + 8); g.bezierCurveTo(90, y + 16, 50, y + 2, 0, y + 9); g.fill(); }
  });
  if (id === 'galaxy') t = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#12002e'); gr.addColorStop(0.5, '#3a0a6a'); gr.addColorStop(1, '#001a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const x = Math.random() * w, y = Math.random() * h, r = 40 + Math.random() * 70; const n = g.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, ['#ff4fd8aa', '#4fc3ffaa', '#b388ffaa'][i % 3]); n.addColorStop(1, '#0000'); g.fillStyle = n; g.fillRect(0, 0, w, h); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() < 0.1 ? 2 : 1, 1); }
  });
  if (id === 'rainbow') t = canvasTex(512, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); ['#ff2d55', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d55'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  if (id === 'lava') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#1a0a06'; g.fillRect(0, 0, w, w); g.strokeStyle = '#ff5a00'; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { g.lineWidth = 1 + Math.random() * 4; g.beginPath(); let x = Math.random() * w, y = Math.random() * w; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  });
  if (id === 'none') t = canvasTex(128, 128, (g, w) => { g.fillStyle = hex; g.fillRect(0, 0, w, w); for (let i = 0; i < 600; i++) { g.fillStyle = Math.random() < 0.5 ? lt + '18' : dk + '18'; g.fillRect(Math.random() * w, Math.random() * w, 3, 3); } });
  skinCache.set(key, t);
  return t;
}
function skinMaterial(id, color) {
  const c = new THREE.Color(color);
  switch (id) {
    case 'champion': return new THREE.MeshPhysicalMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 });
    case 'chrome': return new THREE.MeshPhysicalMaterial({ color: 0xe8eef5, metalness: 1, roughness: 0.08, clearcoat: 1 });
    case 'lava': return new THREE.MeshPhysicalMaterial({ map: skinTex('lava', color), emissive: 0xff4a00, emissiveMap: skinTex('lava', color), emissiveIntensity: 1.8, roughness: 0.5 });
    case 'galaxy': return new THREE.MeshPhysicalMaterial({ map: skinTex('galaxy', color), emissive: 0xffffff, emissiveMap: skinTex('galaxy', color), emissiveIntensity: 0.35, roughness: 0.25, clearcoat: 1 });
    case 'camo': case 'tiger': case 'rainbow': return new THREE.MeshPhysicalMaterial({ map: skinTex(id, color), roughness: id === 'camo' ? 0.7 : 0.35, clearcoat: id === 'camo' ? 0 : 0.6 });
    default: return new THREE.MeshPhysicalMaterial({ color: c, map: skinTex('none', color), roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.5) });
  }
}

// ------------------------------------------------------------------ paint splat geometry (shared)
const splatGeo = (() => { const g = new THREE.SphereGeometry(1, 14, 8); g.scale(1, 1, 0.22); return g; })();
const dropGeo = new THREE.SphereGeometry(1, 8, 6);
export const paintMat = (() => { const cache = new Map(); return col => { if (!cache.has(col)) cache.set(col, new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 })); return cache.get(col); }; })();

// ------------------------------------------------------------------ the marker (paintball gun)
export function makeMarker(style = 'black') {
  const g = new THREE.Group();
  const body = std(style === 'gold' ? 0xd4a52a : 0x1d1f24, 0.35, style === 'gold' ? 1 : 0.5);
  const accent = std(style === 'gold' ? 0x2a2a2a : 0x2f8f4a, 0.3, 0.6);
  const alu = std(0xc8ccd4, 0.25, 1);
  const rubber = std(0x0e0e10, 0.85);
  const b = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  const cy = (r, l, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  b(0.06, 0.11, 0.34, body, 0, 0, 0.12);               // receiver
  b(0.062, 0.03, 0.2, accent, 0, 0.045, 0.12);           // top rail
  cy(0.021, 0.46, alu, 0, 0.02, 0.5, 18);                // barrel
  cy(0.026, 0.06, body, 0, 0.02, 0.3, 18);               // barrel collar
  for (let i = 0; i < 4; i++) cy(0.0225, 0.012, rubber, 0, 0.02, 0.4 + i * 0.07, 14); // porting rings
  const grip = b(0.045, 0.14, 0.06, rubber, 0, -0.1, 0.04); grip.rotation.x = 0.28;
  const fore = b(0.042, 0.12, 0.05, rubber, 0, -0.09, 0.21); fore.rotation.x = 0.1;
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 16, Math.PI), body); guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.055, 0.1); g.add(guard);
  // air tank under the stock
  const tank = cy(0.045, 0.3, alu, 0, -0.07, -0.16, 20);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), alu); cap.position.set(0, -0.07, -0.31); g.add(cap);
  cy(0.03, 0.05, accent, 0, -0.07, -0.0, 16);
  // hopper: translucent plastic shell with paintballs inside
  const hop = new THREE.Group(); hop.position.set(0, 0.17, 0.08); g.add(hop);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.11, 22, 14), new THREE.MeshPhysicalMaterial({ color: style === 'gold' ? 0xffd66a : 0xa8f0c0, roughness: 0.1, transmission: 0.65, thickness: 0.02, transparent: true, opacity: 0.55, clearcoat: 1 }));
  shell.scale.set(0.85, 0.75, 1.25); hop.add(shell);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.08, 12), body); neck.position.y = -0.1; hop.add(neck);
  const ballsIn = new THREE.InstancedMesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.25 }), 20);
  const m = new THREE.Matrix4(), cols = ['#ff2d55', '#ffd60a', '#0a84ff', '#34c759', '#bf5af2', '#ff9500'];
  for (let i = 0; i < 20; i++) {
    const a = i * 2.4, rr = 0.03 + (i % 3) * 0.018, y = -0.05 + Math.floor(i / 5) * 0.03;
    m.makeTranslation(Math.cos(a) * rr * 0.9, y, Math.sin(a) * rr * 1.3); ballsIn.setMatrixAt(i, m); ballsIn.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  }
  hop.add(ballsIn);
  g.userData = { ballsIn, muzzle: new THREE.Vector3(0, 0.02, 0.74), grip: new THREE.Vector3(0, -0.1, 0.03), fore: new THREE.Vector3(0, -0.09, 0.22) };
  g.setFill = n => { ballsIn.count = Math.max(0, Math.min(20, n)); };
  return g;
}

// ------------------------------------------------------------------ googly
export class Googly {
  constructor({ color = '#34c759', name = '', skin = 'none', champ = false, local = false } = {}) {
    this.group = new THREE.Group();
    this.root = new THREE.Group(); this.root.scale.setScalar(SCALE); this.group.add(this.root);
    this.color = color; this.local = local;
    this.pelvis = new THREE.Group(); this.pelvis.position.y = 0.5; this.root.add(this.pelvis);
    this.body = new THREE.Group(); this.pelvis.add(this.body);
    this.bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.38, 10, 24), std(0xffffff));
    this.bodyMesh.position.y = 0.4; this.bodyMesh.castShadow = true; this.bodyMesh.receiveShadow = true; this.body.add(this.bodyMesh);
    this.belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), std(0xffffff));
    this.belly.scale.set(1, 1.3, 0.4); this.belly.position.set(0, 0.25, 0.19); this.body.add(this.belly);
    // googly eyes
    this.eyes = [];
    for (const side of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(side * 0.125, 0.66, 0.27); e.rotation.set(-0.08, side * 0.28, 0);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.134, 0.134, 0.03, 28), std(0x15151a, 0.5)); rim.rotation.x = Math.PI / 2; e.add(rim);
      const white = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.036, 28), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 })); white.rotation.x = Math.PI / 2; e.add(white);
      const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.012, 20), std(0x050505, 0.2)); pupil.rotation.x = Math.PI / 2; pupil.position.set(0, -0.03, 0.022); e.add(pupil);
      this.body.add(e);
      this.eyes.push({ node: e, pupil, p: new THREE.Vector2(0, -0.03), v: new THREE.Vector2(), last: null, lastV: new THREE.Vector3() });
    }
    // goggles strap (paintball safety first) — a band behind the eyes
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.022, 8, 40), std(0x111114, 0.8));
    strap.rotation.x = Math.PI / 2; strap.position.y = 0.66; this.body.add(strap);
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI), std(0x2a0c12, 0.4));
    this.mouth.position.set(0, 0.49, 0.29); this.mouth.rotation.z = Math.PI; this.body.add(this.mouth);
    // aim rig: gun + arms follow the aim pitch
    this.aim = new THREE.Group(); this.aim.position.set(0, 0.42, 0.05); this.body.add(this.aim);
    this.gun = makeMarker(champ ? 'gold' : 'black'); this.gun.position.set(0.17, -0.02, 0.2); this.aim.add(this.gun);
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 1, 4, 8), std(0xffffff)); arm.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), std(0xffffff, 0.5)); hand.castShadow = true;
      this.body.add(arm); this.body.add(hand);
      this.arms.push({ arm, hand, sh: new THREE.Vector3(side * 0.28, 0.42, 0) });
    }
    // legs
    this.hips = []; this.knees = []; this.legMeshes = [];
    const shoe = new THREE.MeshPhysicalMaterial({ color: 0x1c1c22, roughness: 0.35, clearcoat: 0.8 });
    for (const side of [-1, 1]) {
      const hp = new THREE.Group(); hp.position.set(side * 0.13, 0.02, 0); this.pelvis.add(hp);
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.17, 4, 8), std(0xffffff)); th.position.y = -0.12; hp.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.23; hp.add(kn);
      const sn = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.17, 4, 8), std(0xffffff)); sn.position.y = -0.11; kn.add(sn);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), shoe); sh.scale.set(0.85, 0.55, 1.45); sh.position.set(0, -0.24, 0.06); kn.add(sh);
      th.castShadow = sn.castShadow = sh.castShadow = true;
      this.hips.push(hp); this.knees.push(kn); this.legMeshes.push(th, sn);
    }
    this.paint = new THREE.Group(); this.body.add(this.paint);
    this.extras = new THREE.Group(); this.body.add(this.extras);
    this.phase = 0; this.gait = 0; this.t = Math.random() * 10; this.crouchK = 0; this.recoil = 0; this.hurtT = 0; this.outT = -1; this.hopY = 0;
    this.lastSide = 0; this.onStep = null; this.pitch = 0; this.shieldT = 0;
    this.setLook(color, skin, champ);
    if (name) this.setName(name, champ);
  }
  setLook(color, skin, champ) {
    const key = color + skin + champ;
    if (key === this.lookKey) return;
    this.lookKey = key; this.color = color; this.skin = champ ? 'champion' : skin;
    const mat = skinMaterial(this.skin, color);
    const c = new THREE.Color(color);
    const dark = this.skin === 'none' ? std(c.clone().multiplyScalar(0.62), 0.45) : mat;
    const bel = this.skin === 'none' ? std(c.clone().lerp(new THREE.Color('#fff'), 0.2), 0.4) : mat;
    this.bodyMesh.material = mat; this.belly.material = bel;
    for (const a of this.arms) a.arm.material = mat;
    for (const l of this.legMeshes) l.material = dark;
    this.mats = [mat, dark, bel];
    this.baseColors = this.mats.map(m => m.color.clone());
    this.extras.clear();
    if (champ) {
      // a little golden crown with gems
      const crown = new THREE.Group(); crown.position.y = 0.9;
      const gold = new THREE.MeshPhysicalMaterial({ color: 0xffd23a, metalness: 1, roughness: 0.15, clearcoat: 1 });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 24, 1, true), gold); ring.material.side = THREE.DoubleSide; crown.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.11, 8), gold);
        sp.position.set(Math.cos(a) * 0.17, 0.1, Math.sin(a) * 0.17); crown.add(sp);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshPhysicalMaterial({ color: ['#ff2d55', '#0a84ff', '#34c759'][i % 3], roughness: 0.05, transmission: 0.5, emissive: ['#ff2d55', '#0a84ff', '#34c759'][i % 3], emissiveIntensity: 0.4 }));
        gem.position.set(Math.cos(a) * 0.185, 0.02, Math.sin(a) * 0.185); crown.add(gem);
      }
      crown.rotation.z = 0.12; this.extras.add(crown); this.crown = crown;
    } else this.crown = null;
    if (this.gunStyle !== (champ ? 'gold' : 'black')) {
      this.gunStyle = champ ? 'gold' : 'black';
      this.aim.remove(this.gun); this.gun = makeMarker(this.gunStyle); this.gun.position.set(0.17, -0.02, 0.2); this.aim.add(this.gun);
    }
    if (this.name) this.setName(this.name, champ);
  }
  setName(name, champ) {
    this.name = name;
    if (this.tag) this.group.remove(this.tag);
    if (this.local) return;
    this.tag = textSprite((champ ? '👑 ' : '') + name, { size: 38, border: this.color });
    this.tag.position.y = 2.25; this.group.add(this.tag);
  }
  /** Stick a blob of paint where a ball hit. (lx,ly,lz): hit point relative to the feet, world axes; yaw: body yaw. */
  splat(lx, ly, lz, yaw, col, big = false) {
    // world offset → figure space
    const s = Math.sin(-(yaw + Math.PI)), c = Math.cos(-(yaw + Math.PI));
    let x = (lx * c + lz * s) / SCALE, z = (-lx * s + lz * c) / SCALE, y = ly / SCALE;
    // → body space (the body sits on the pelvis)
    y -= this.pelvis.position.y;
    const ay = Math.max(0.21, Math.min(0.59, y));
    const n = new THREE.Vector3(x, y - ay, z); if (n.lengthSq() < 1e-6) n.set(0, 0, 1); n.normalize();
    const pos = new THREE.Vector3(0, ay, 0).addScaledVector(n, 0.3);
    const mat = paintMat(col), r = big ? 0.16 : 0.08 + Math.random() * 0.04;
    const blob = new THREE.Mesh(splatGeo, mat);
    blob.position.copy(pos); blob.lookAt(pos.clone().add(n)); blob.scale.setScalar(r);
    this.paint.add(blob);
    for (let i = 0; i < (big ? 9 : 5); i++) {
      const d = new THREE.Mesh(dropGeo, mat), a = Math.random() * Math.PI * 2, rr = r * (1.1 + Math.random() * 0.9);
      const off = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(rr).applyQuaternion(blob.quaternion);
      const q = pos.clone().add(off), m = new THREE.Vector3(0, Math.max(0.21, Math.min(0.59, q.y)), 0), nn = q.clone().sub(m).normalize();
      d.position.copy(m).addScaledVector(nn, 0.3); d.scale.setScalar(0.012 + Math.random() * 0.02);
      this.paint.add(d);
    }
    // a drip that slides down
    const drip = new THREE.Mesh(dropGeo, mat); drip.position.copy(pos); drip.scale.set(0.022, 0.035, 0.022); drip.userData.drip = { n, life: 1.5 + Math.random() };
    this.paint.add(drip);
    while (this.paint.children.length > 160) this.paint.remove(this.paint.children[0]);
    this.hurtT = 0.35;
  }
  /** Painted out: flood the whole googly in the ball's colour. */
  paintOut(col) { this.outT = 0; this.outCol = new THREE.Color(col); for (const e of this.eyes) e.v.set((Math.random() - 0.5) * 8, 5); }
  reset() { this.paint.clear(); this.outT = -1; this.mats.forEach((m, i) => m.color.copy(this.baseColors[i])); this.group.rotation.set(0, this.group.rotation.y, 0); this.root.position.set(0, 0, 0); this.group.visible = true; }
  fire() { this.recoil = 1; }

  /** speed: ground speed; crouch: bool; pitch: aim pitch; reloading: bool; onGround. */
  update(dt, { speed = 0, crouch = false, pitch = 0, reload = false, onGround = true, hopper = 20 } = {}) {
    this.t += dt;
    this.gait += (Math.min(1, speed / 3.5) - this.gait) * (1 - Math.exp(-8 * dt));
    this.phase += speed / 1.25 * Math.PI * 2 * dt;
    this.crouchK += ((crouch ? 1 : 0) - this.crouchK) * (1 - Math.exp(-12 * dt));
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.hurtT = Math.max(0, this.hurtT - dt);
    const g = this.gait * (1 - this.crouchK * 0.5), s = Math.sin(this.phase), c = Math.cos(this.phase), ck = this.crouchK;
    for (let i = 0; i < 2; i++) {
      const ph = this.phase + (i ? Math.PI : 0), swing = Math.max(0, Math.cos(ph));
      const air = onGround ? 0 : (i ? 0.5 : -0.3);
      this.hips[i].rotation.set(-0.7 * Math.sin(ph) * g - ck * 1.1 + air, 0, (i ? 1 : -1) * (0.07 + ck * 0.1));
      this.knees[i].rotation.x = 1.3 * Math.pow(swing, 1.3) * g + 0.08 + ck * 1.9 + (onGround ? 0 : 0.6);
    }
    const side = s > 0 ? 0 : 1;
    if (side !== this.lastSide && g > 0.3 && onGround) this.onStep?.(side === 0 ? 1 : 0.7);
    this.lastSide = side;
    this.pelvis.position.y = 0.5 + (0.06 * Math.max(0, s) + 0.02 * Math.abs(c)) * g - ck * 0.24;
    const hurt = Math.sin(this.hurtT / 0.35 * Math.PI) * 0.35;
    this.body.rotation.set(0.1 * g + ck * 0.25 - hurt, 0.12 * c * g, 0.09 * s * g + Math.sin(this.t * 0.9) * 0.02);
    const breath = 1 + Math.sin(this.t * 2.2) * 0.012 + this.hurtT * 0.2;
    this.bodyMesh.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    // aim: pitch the gun; reload tilts it and pumps the off-hand to the hopper
    this.pitch += (pitch - this.pitch) * (1 - Math.exp(-20 * dt));
    const rl = reload ? Math.sin(this.t * 10) * 0.5 + 0.5 : 0;
    this.aim.rotation.set(-this.pitch + (this.body.rotation.x) * -1 + (reload ? 0.55 : 0) - this.recoil * 0.12, reload ? -0.3 : 0, reload ? 0.35 : 0);
    this.gun.position.z = 0.2 - this.recoil * 0.05;
    this.gun.setFill?.(hopper);
    this.body.updateMatrix(); this.aim.updateMatrix(); this.gun.updateMatrix();
    const toBody = new THREE.Matrix4().multiplyMatrices(this.aim.matrix, this.gun.matrix);
    const grip = this.gun.userData.grip.clone().applyMatrix4(toBody);
    const fore = reload ? new THREE.Vector3(0.02, 0.27 + rl * 0.07, 0.06).applyMatrix4(toBody) : this.gun.userData.fore.clone().applyMatrix4(toBody);
    const targets = [fore, grip];
    for (let i = 0; i < 2; i++) {
      const a = this.arms[i], tgt = targets[i], d = tgt.clone().sub(a.sh), L = d.length();
      a.arm.position.copy(a.sh).addScaledVector(d, 0.5);
      a.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      a.arm.scale.set(1, Math.max(0.05, (L - 0.09) / 1.09), 1);
      a.hand.position.copy(tgt);
    }
    this.mouth.rotation.z = this.hurtT > 0 || this.outT >= 0 ? 0 : Math.PI;
    this.mouth.position.y = this.hurtT > 0 ? 0.45 : 0.49;
    // drips crawl down
    for (const d of this.paint.children) { const u = d.userData.drip; if (u && u.life > 0) { u.life -= dt; d.position.y -= dt * 0.05; d.scale.y += dt * 0.01; } }
    // painted out: colour floods in and he flops over
    if (this.outT >= 0) {
      this.outT += dt;
      const k = Math.min(1, this.outT / 0.45);
      this.mats.forEach((m, i) => m.color.copy(this.baseColors[i]).lerp(this.outCol, k));
      for (const m of this.paint.children) m.visible = k < 0.9;
      const f = Math.min(1, this.outT / 0.7);
      this.root.rotation.x = -f * f * 1.45; this.root.position.y = 0.05 * f;
    } else { this.root.rotation.x = 0; }
    if (this.crown) this.crown.rotation.y += dt * 0.8;
    // googly eyes: pupils rattle around under gravity and head motion
    this.root.updateMatrixWorld(true);
    const E = new THREE.Vector3(), q = new THREE.Quaternion(), ux = new THREE.Vector3(), uy = new THREE.Vector3();
    for (const e of this.eyes) {
      e.node.getWorldPosition(E); e.node.getWorldQuaternion(q);
      ux.set(1, 0, 0).applyQuaternion(q); uy.set(0, 1, 0).applyQuaternion(q);
      if (!e.last) { e.last = E.clone(); e.lastV.set(0, 0, 0); }
      const ve = E.clone().sub(e.last).divideScalar(Math.max(dt, 1e-3));
      const ae = ve.clone().sub(e.lastV).divideScalar(Math.max(dt, 1e-3)); if (ae.length() > 250) ae.setLength(250);
      e.last.copy(E); e.lastV.copy(ve);
      const a3 = new THREE.Vector3(0, -22, 0).sub(ae), ax = a3.dot(ux), ay = a3.dot(uy);
      for (let k = 0; k < 3; k++) {
        const h = dt / 3;
        e.v.x += ax * h; e.v.y += ay * h; e.v.multiplyScalar(1 - 1.6 * h);
        e.p.x += e.v.x * h; e.p.y += e.v.y * h;
        const maxD = 0.061, d = e.p.length();
        if (d > maxD) { const nx = e.p.x / d, ny = e.p.y / d; e.p.set(nx * maxD, ny * maxD); const vn = e.v.x * nx + e.v.y * ny; if (vn > 0) { e.v.x -= nx * vn * 1.55; e.v.y -= ny * vn * 1.55; } }
      }
      e.pupil.position.set(e.p.x, e.p.y, 0.022);
    }
  }
  /** muzzle position in world space */
  muzzleWorld(out = new THREE.Vector3()) { return out.copy(this.gun.userData.muzzle).applyMatrix4(this.gun.matrixWorld); }
}
