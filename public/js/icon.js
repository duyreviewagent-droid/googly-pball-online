// ?icon=1 — draws the app icon: a green googly firing its marker at the bottom-left corner.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Googly } from './googly.js';

export function renderIcon() {
  const N = 1024;
  document.body.innerHTML = '';
  document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent';
  const out = document.createElement('canvas'); out.width = out.height = N; out.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px';
  document.body.appendChild(out);
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(N, N, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x224422, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff66aa, 1.6); rim.position.set(-4, 2, -3); scene.add(rim);
  const fig = new Googly({ color: '#2fd35a', skin: 'none', local: true });
  // action pose: mid-jump, whole body tilted along the diagonal the paint flies
  const pose = new THREE.Group(); scene.add(pose); pose.add(fig.group);
  fig.group.rotation.y = -0.62;
  pose.position.set(0.25, 0.55, 0); pose.rotation.z = 0.42;
  // angry brows
  const browM = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6 });
  for (const side of [-1, 1]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.05, 0.05), browM); br.position.set(side * 0.11, 0.8, 0.29); br.rotation.set(-0.25, side * 0.3, side * 0.5); fig.body.add(br); }
  for (let i = 0; i < 90; i++) fig.update(1 / 60, { speed: 0, pitch: -0.62, hopper: 16, onGround: false });
  fig.recoil = 0.7; fig.update(1 / 60, { speed: 0, pitch: -0.62, hopper: 16, onGround: false });
  // pupils locked on the target, gritted frown
  fig.eyes.forEach((e, i) => { e.pupil.position.set(i ? -0.035 : -0.02, -0.035, 0.022); });
  fig.mouth.rotation.z = 0; fig.mouth.position.y = 0.46; fig.mouth.scale.set(1.3, 0.8, 1);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0.55, 1.45, 5.3); cam.lookAt(-0.05, 1.2, 0);
  scene.updateMatrixWorld(true);
  r.render(scene, cam);
  const muzzle = fig.muzzleWorld(new THREE.Vector3()).project(cam);
  const mx = (muzzle.x * 0.5 + 0.5) * N, my = (-muzzle.y * 0.5 + 0.5) * N;

  const g = out.getContext('2d');
  // macOS icon tile
  const M = 100, S = N - 2 * M, R = 185;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
  tile(g, M, M, S, S, R); const bg = g.createLinearGradient(0, M, 0, M + S); bg.addColorStop(0, '#2a0610'); bg.addColorStop(0.5, '#5a0e1e'); bg.addColorStop(1, '#12040a'); g.fillStyle = bg; g.fill();
  g.restore();
  g.save(); tile(g, M, M, S, S, R); g.clip();
  // floor + wall splats (the bottom-left corner is getting hammered)
  const fl = g.createLinearGradient(0, 720, 0, N); fl.addColorStop(0, '#1a3a18'); fl.addColorStop(1, '#081a0a'); g.fillStyle = fl; g.fillRect(0, 760, N, N);
  const splat = (x, y, rad, col, seed) => {
    let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.283, rr = rad * (0.7 + rnd() * 0.5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
    for (let i = 0; i < 12; i++) { const a = rnd() * 6.283, d = rad * (1.1 + rnd() * 0.9), q = rad * (0.06 + rnd() * 0.12); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, q, 0, 7); g.fill(); }
    for (let i = 0; i < 3; i++) { const dx = (rnd() - 0.5) * rad; g.fillRect(x + dx - rad * 0.06, y, rad * 0.12, rad * (0.8 + rnd())); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - rad * 0.3, y - rad * 0.3, rad * 0.25, rad * 0.12, -0.6, 0, 7); g.fill();
  };
  const glow = g.createRadialGradient(620, 420, 20, 620, 420, 520); glow.addColorStop(0, 'rgba(255,120,40,.55)'); glow.addColorStop(1, 'rgba(255,60,40,0)'); g.fillStyle = glow; g.fillRect(0, 0, N, N);
  const sh = g.createRadialGradient(600, 880, 5, 600, 880, 150); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.beginPath(); g.ellipse(600, 880, 170, 34, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineCap = 'round';
  for (const [x, y, l] of [[760, 700, 120], [800, 600, 90], [720, 790, 80], [830, 500, 60]]) { g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l * 0.6, y + l * 0.8); g.stroke(); }
  splat(215, 800, 95, '#ff2d55', 7); splat(330, 900, 70, '#ffd60a', 11); splat(170, 640, 52, '#0a84ff', 23); splat(420, 790, 40, '#bf5af2', 31);
  g.restore();
  // the googly (3D render)
  g.drawImage(r.domElement, 0, 0);
  // paintballs streaking out of the barrel toward the corner
  const balls = [[0.25, '#ff2d55'], [0.5, '#ffd60a'], [0.75, '#0a84ff']];
  const tx = 250, ty = 790;
  for (const [k, col] of balls) {
    const x = mx + (tx - mx) * k, y = my + (ty - my) * k + Math.sin(k * Math.PI) * -10;
    const ang = Math.atan2(ty - my, tx - mx);
    const tr = g.createLinearGradient(x, y, x - Math.cos(ang) * 110, y - Math.sin(ang) * 110); tr.addColorStop(0, col + 'cc'); tr.addColorStop(1, col + '00');
    g.strokeStyle = tr; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(ang) * 110, y - Math.sin(ang) * 110); g.stroke();
    const bb = g.createRadialGradient(x - 6, y - 6, 2, x, y, 20); bb.addColorStop(0, '#fff'); bb.addColorStop(0.3, col); bb.addColorStop(1, shade(col)); g.fillStyle = bb; g.beginPath(); g.arc(x, y, 19, 0, 7); g.fill();
  }
  // air puff at the muzzle
  const pf = g.createRadialGradient(mx, my, 0, mx, my, 70); pf.addColorStop(0, 'rgba(255,255,255,.75)'); pf.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = pf; g.beginPath(); g.arc(mx, my, 70, 0, 7); g.fill();
  document.title = 'ICON READY';
  window.__iconReady = true;
}
function tile(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function shade(hex) { const n = parseInt(hex.slice(1), 16); const f = v => Math.round(v * 0.45).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); }
