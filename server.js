// Googly P-Ball — lobby + match server. Up to 8 googlies per lobby (players + computer players).
// The server owns ammo, hits, scores and the computer players; browsers move themselves and draw everything.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MAPS } from './public/js/maps.js';
import * as S from './public/js/sim.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const MAX = 8, TICK = 1 / 30, END_SEC = 12, COUNT_SEC = 3.5;

// ---------------------------------------------------------------- static files
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  const file = url.startsWith('/three/addons/') ? path.join(ROOT, 'node_modules/three/examples/jsm', path.normalize(url.slice(14)))
    : url.startsWith('/three/') ? path.join(ROOT, 'node_modules/three/build', path.basename(url))
    : path.join(ROOT, 'public', path.normalize(url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- shared helpers
const PAINT = ['#ff2d55', '#ff9500', '#ffd60a', '#34c759', '#00c7be', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#64d2ff', '#ff6b00', '#b4ff00'];
const rpaint = () => PAINT[Math.floor(Math.random() * PAINT.length)];
const BOTS = [['RICK', '#e8452c'], ['GUS', '#8a5a2b'], ['SUNNY', '#ffc53a'], ['VIOLET', '#9b59ff'], ['PICKLE', '#7bd13b'], ['DOTTIE', '#ff6fb5'], ['NOODLE', '#f2e2b8'], ['BLOBBY', '#3ad0ff']];
const DIFF = [
  { name: 'Easy', react: 1.1, err: 0.095, gap: 0.7, lead: 0, drop: 0.5, strafe: 0.3, view: 24, cover: 0.15, burst: 2 },
  { name: 'Normal', react: 0.58, err: 0.046, gap: 0.36, lead: 0.5, drop: 0.88, strafe: 0.65, view: 36, cover: 0.5, burst: 3 },
  { name: 'Hard', react: 0.27, err: 0.019, gap: 0.2, lead: 0.9, drop: 1, strafe: 1, view: 55, cover: 0.85, burst: 5 },
];
const NAV = MAPS.map(m => S.buildNav(m));
const rooms = new Map();
let nextId = 1, nextBall = 1;
const CHAMP_FILE = path.join(ROOT, 'champion.json');
let champion = null;
try { champion = JSON.parse(fs.readFileSync(CHAMP_FILE, 'utf8')); } catch { }
const clean = (s, n) => String(s ?? '').replace(/[<>&"]/g, '').trim().slice(0, n);
const r2 = v => Math.round(v * 100) / 100;
const now = () => performance.now() / 1000;

function send(ws, m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
function bcast(room, m) { const s = JSON.stringify(m); for (const p of room.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s); }
function code() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c; do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c)); return c; }

function newEntity(o) {
  return {
    id: nextId++, name: 'GOOGLY', color: '#34c759', skin: 'none', bot: false, ws: null,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: false, onGround: true, aim: false,
    hp: S.HP, alive: true, respawnT: 0, shieldT: 0, hopper: S.HOPPER, reserve: S.START_RESERVE, reloadT: 0, lastFire: 0,
    score: 0, deaths: 0, shots: 0, hits: 0, hist: [], rtt: 0.1, ...o,
  };
}

// ---------------------------------------------------------------- rooms
function makeRoom(opts = {}) {
  const r = {
    code: code(), public: !!opts.public, name: clean(opts.name, 24), hostId: 0, players: new Map(), balls: [], crates: [],
    settings: { map: 0, cpus: 3, diff: 1, time: 240, score: 15, ...(opts.settings || {}) },
    state: 'lobby', t: 0, timeLeft: 0, lastWinner: null, solo: !!opts.solo, snapAcc: 0, hudAcc: 0,
  };
  rooms.set(r.code, r);
  syncBots(r);
  return r;
}
const humans = r => [...r.players.values()].filter(p => !p.bot);
function syncBots(r) {
  const s = r.settings;
  const want = Math.max(0, Math.min(s.cpus, MAX - humans(r).length));
  const bots = [...r.players.values()].filter(p => p.bot);
  while (bots.length > want) { const b = bots.pop(); r.players.delete(b.id); if (r.state !== 'lobby') bcast(r, { t: 'gone', id: b.id }); }
  const used = new Set(bots.map(b => b.name));
  for (const [name, color] of BOTS) {
    if (bots.length >= want) break;
    if (used.has(name)) continue;
    const b = newEntity({ name, color, bot: true, skin: ['none', 'camo', 'tiger', 'none'][bots.length % 4], brain: newBrain() });
    r.players.set(b.id, b); bots.push(b);
    if (r.state === 'play' || r.state === 'count') { spawn(r, b); bcast(r, { t: 'join', p: pubPlayer(r, b) }); }
  }
  for (const b of bots) b.diff = s.diff;
}
function pubPlayer(r, p) { return { id: p.id, name: p.name, color: p.color, skin: p.skin, bot: p.bot, score: p.score, deaths: p.deaths, champ: r.lastWinner?.id === p.id, host: r.hostId === p.id }; }
function roomInfo(r) {
  return { code: r.code, public: r.public, name: r.name, host: r.hostId, state: r.state, settings: r.settings, solo: r.solo, lastWinner: r.lastWinner, players: [...r.players.values()].map(p => pubPlayer(r, p)) };
}
function pushLobby(r) { bcast(r, { t: 'room', room: roomInfo(r) }); }
function listRooms() {
  return [...rooms.values()].filter(r => r.public && humans(r).length > 0).map(r => ({
    code: r.code, name: r.name || (humans(r)[0]?.name + "'s lobby"), map: MAPS[r.settings.map].name, humans: humans(r).length, total: r.players.size, state: r.state, diff: DIFF[r.settings.diff].name,
  }));
}
function leave(p) {
  const r = p.room; if (!r) return;
  r.players.delete(p.id); p.room = null;
  bcast(r, { t: 'gone', id: p.id });
  if (!humans(r).length) { rooms.delete(r.code); return; }
  if (r.hostId === p.id) r.hostId = humans(r)[0].id;
  syncBots(r);
  sys(r, `${p.name} left`);
  pushLobby(r);
}
function join(p, r) {
  if (p.room) leave(p);
  if (humans(r).length >= MAX) return send(p.ws, { t: 'err', msg: 'That lobby is full (8 googlies).' });
  p.room = r; r.players.set(p.id, p);
  if (!r.hostId || !r.players.has(r.hostId)) r.hostId = p.id;
  Object.assign(p, { score: 0, deaths: 0, shots: 0, hits: 0 });
  syncBots(r);
  send(p.ws, { t: 'joined', code: r.code });
  pushLobby(r);
  sys(r, `${p.name} joined`);
  if (r.state === 'play' || r.state === 'count') { spawn(r, p); send(p.ws, startMsg(r)); bcast(r, { t: 'join', p: pubPlayer(r, p) }); }
}
function sys(r, text) { bcast(r, { t: 'chat', sys: true, text }); }

// ---------------------------------------------------------------- match
function spawnPoint(r, p) {
  const map = MAPS[r.settings.map];
  const alive = [...r.players.values()].filter(q => q !== p && q.alive);
  let best = null, bestD = -1;
  for (const [x, z] of map.spawns) {
    const d = alive.length ? Math.min(...alive.map(q => Math.hypot(q.x - x, q.z - z))) : Math.random() * 10;
    const score = d + Math.random() * 4;
    if (score > bestD) { bestD = score; best = [x, z]; }
  }
  return best;
}
function spawn(r, p) {
  const [x, z] = spawnPoint(r, p);
  Object.assign(p, { x, y: S.groundAt(MAPS[r.settings.map], x, z, S.PR, 20), z, vx: 0, vy: 0, vz: 0, hp: S.HP, alive: true, shieldT: S.SHIELD_T, hopper: S.HOPPER, reserve: S.START_RESERVE, reloadT: 0, hist: [] });
  p.yaw = Math.atan2(x, z); // face the middle (yaw 0 looks down -z)
  if (p.brain) p.brain = newBrain();
  bcast(r, { t: 'spawn', id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw) });
  send(p.ws, { t: 'ammo', h: p.hopper, r: p.reserve, rl: 0 });
}
function startMsg(r) {
  return { t: 'start', map: r.settings.map, state: r.state, timeLeft: r.timeLeft, count: r.state === 'count' ? r.t : 0, settings: r.settings, players: [...r.players.values()].map(p => ({ ...pubPlayer(r, p), x: p.x, y: p.y, z: p.z, yaw: p.yaw, hp: p.hp, alive: p.alive })), crates: r.crates.map(c => c.on ? 1 : 0), lastWinner: r.lastWinner };
}
function startMatch(r) {
  const map = MAPS[r.settings.map];
  r.state = 'count'; r.t = COUNT_SEC; r.timeLeft = r.settings.time; r.balls = [];
  r.crates = map.ammo.map(([x, z, y]) => ({ x, z, y: y ?? 0, on: true, t: 0 }));
  syncBots(r);
  for (const p of r.players.values()) { Object.assign(p, { score: 0, deaths: 0, shots: 0, hits: 0 }); spawn(r, p); }
  bcast(r, startMsg(r));
  pushLobby(r);
}
function endMatch(r) {
  r.state = 'end'; r.t = END_SEC;
  const st = [...r.players.values()].sort((a, b) => b.score - a.score || a.deaths - b.deaths || b.hits - a.hits);
  const w = st[0];
  r.lastWinner = w ? { id: w.id, name: w.name, color: w.color, bot: w.bot, score: w.score } : null;
  if (w && !w.bot) {
    champion = { name: w.name, color: w.color, skin: w.skin, score: w.score, map: MAPS[r.settings.map].name, at: Date.now() };
    fs.writeFile(CHAMP_FILE, JSON.stringify(champion), () => { });
  }
  bcast(r, { t: 'end', winner: r.lastWinner, standings: st.map(p => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, score: p.score, deaths: p.deaths })) });
}

function paintOut(r, tg, by, col) {
  tg.alive = false; tg.hp = 0; tg.respawnT = S.RESPAWN_T; tg.deaths++;
  if (by && by !== tg) by.score++;
  bcast(r, { t: 'out', tg: tg.id, by: by?.id ?? 0, col });
  if (by && r.settings.score && by.score >= r.settings.score && r.state === 'play') endMatch(r);
}

function fire(r, p, o, d, col) {
  if (!p.alive || r.state !== 'play' || p.hopper <= 0 || p.reloadT > 0) return false;
  const t = now(); if (t - p.lastFire < S.FIRE_GAP * 0.8) return false;
  p.lastFire = t; p.hopper--; p.shots++; p.shieldT = 0;
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const b = { id: nextBall++, by: p.id, x: o[0], y: o[1], z: o[2], vx: d[0] / L * S.BALL_SPEED, vy: d[1] / L * S.BALL_SPEED, vz: d[2] / L * S.BALL_SPEED, age: 0, col: col || rpaint(), lag: p.bot ? 0 : Math.min(0.25, p.rtt / 2 + 0.1) };
  r.balls.push(b);
  bcast(r, { t: 'shot', id: b.id, by: p.id, o: [r2(b.x), r2(b.y), r2(b.z)], v: [r2(b.vx), r2(b.vy), r2(b.vz)], col: b.col });
  send(p.ws, { t: 'ammo', h: p.hopper, r: p.reserve, rl: 0 });
  if (p.hopper === 0 && p.bot) startReload(p);
  return true;
}
function startReload(p) {
  if (p.reloadT > 0 || p.hopper >= S.HOPPER || p.reserve <= 0 || !p.alive) return;
  p.reloadT = S.RELOAD_T;
  send(p.ws, { t: 'ammo', h: p.hopper, r: p.reserve, rl: S.RELOAD_T });
}
// where was this googly `ago` seconds ago? (so shots are judged against what the shooter saw)
function past(p, ago) {
  if (!p.hist.length || ago <= 0) return p;
  const want = now() - ago;
  for (let i = p.hist.length - 1; i >= 0; i--) if (p.hist[i][0] <= want) { const h = p.hist[i]; return { x: h[1], y: h[2], z: h[3], crouch: h[4] }; }
  const h = p.hist[0]; return { x: h[1], y: h[2], z: h[3], crouch: h[4] };
}

function tick(r, dt) {
  const map = MAPS[r.settings.map];
  if (r.state === 'count') { r.t -= dt; if (r.t <= 0) { r.state = 'play'; bcast(r, { t: 'go' }); } }
  else if (r.state === 'end') { r.t -= dt; if (r.t <= 0) { r.state = 'lobby'; r.balls = []; pushLobby(r); } return; }
  else if (r.state !== 'play') return;
  if (r.state === 'play') { r.timeLeft -= dt; if (r.timeLeft <= 0) { r.timeLeft = 0; endMatch(r); return; } }
  const t = now();
  for (const p of r.players.values()) {
    if (!p.alive) { p.respawnT -= dt; if (p.respawnT <= 0 && r.state === 'play') spawn(r, p); continue; }
    p.shieldT = Math.max(0, p.shieldT - dt);
    if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; const n = Math.min(S.HOPPER - p.hopper, p.reserve); p.hopper += n; p.reserve -= n; send(p.ws, { t: 'ammo', h: p.hopper, r: p.reserve, rl: 0 }); } }
    if (p.bot && r.state === 'play') botThink(r, p, dt, map);
    else if (p.bot) { p.vx = p.vz = 0; }
    p.hist.push([t, p.x, p.y, p.z, p.crouch]); while (p.hist.length && p.hist[0][0] < t - 1) p.hist.shift();
    // crates
    for (let i = 0; i < r.crates.length; i++) {
      const c = r.crates[i];
      if (c.on && p.reserve < S.RESERVE_MAX && Math.hypot(p.x - c.x, p.z - c.z) < 1.15 && Math.abs(p.y - c.y) < 1.3) {
        c.on = false; c.t = 14; p.reserve = Math.min(S.RESERVE_MAX, p.reserve + S.CRATE_AMMO);
        send(p.ws, { t: 'ammo', h: p.hopper, r: p.reserve, rl: p.reloadT, got: S.CRATE_AMMO });
        bcast(r, { t: 'crate', i, on: 0, by: p.id });
      }
    }
  }
  for (let i = 0; i < r.crates.length; i++) { const c = r.crates[i]; if (!c.on) { c.t -= dt; if (c.t <= 0) { c.on = true; bcast(r, { t: 'crate', i, on: 1 }); } } }
  // paintballs
  const keep = [];
  for (const b of r.balls) {
    let done = false;
    for (const sg of S.stepBall(b, dt)) {
      const wall = S.segMap(map, ...sg);
      let hit = null, hitT = wall ? wall.t : 1;
      for (const q of r.players.values()) {
        if (q.id === b.by || !q.alive || q.shieldT > 0) continue;
        const pos = past(q, q.bot ? 0 : b.lag);
        const h = S.segBody(...sg, pos);
        if (h && h.t < hitT) { hitT = h.t; hit = { q, h, pos }; }
      }
      if (hit) {
        const { q, h, pos } = hit, by = r.players.get(b.by);
        const dmg = h.head ? S.HEAD_DMG : S.BODY_DMG;
        q.hp -= dmg; if (by) by.hits++;
        bcast(r, { t: 'hit', tg: q.id, by: b.by, ball: b.id, x: r2(h.x - pos.x), y: r2(h.y - pos.y), z: r2(h.z - pos.z), col: b.col, head: h.head ? 1 : 0, hp: Math.max(0, q.hp) });
        if (q.brain) { q.brain.hurtBy = b.by; q.brain.hurtT = t; }
        if (q.hp <= 0) paintOut(r, q, by, b.col);
        done = true; break;
      }
      if (wall) { done = true; break; }
    }
    if (!done && b.age < 3 && b.y > -1) keep.push(b);
  }
  r.balls = keep;
  if (r.state !== 'play') return;
  r.snapAcc += dt;
  if (r.snapAcc >= 0.05) {
    r.snapAcc = 0;
    const e = [];
    for (const p of r.players.values()) e.push([p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), r2(p.pitch), (p.crouch ? 1 : 0) | (p.onGround ? 2 : 0) | (p.aim ? 4 : 0) | (p.reloadT > 0 ? 8 : 0) | (p.shieldT > 0 ? 16 : 0) | (p.alive ? 32 : 0), Math.max(0, Math.round(p.hp)), r2(p.vx), r2(p.vz)]);
    bcast(r, { t: 'snap', tl: Math.ceil(r.timeLeft), e });
  }
  r.hudAcc += dt;
  if (r.hudAcc >= 1) { r.hudAcc = 0; bcast(r, { t: 'score', s: [...r.players.values()].map(p => [p.id, p.score, p.deaths]) }); }
}

// ---------------------------------------------------------------- computer players
function newBrain() { return { target: null, seen: 0, lastSeen: null, lastSeenT: -9, visT: 0, path: null, pathT: 0, goal: null, strafe: 1, strafeT: 0, nextShot: 0, burst: 0, stuckT: 0, lastPos: null, cover: null, coverT: 0, jump: false, hurtBy: 0, hurtT: -9, aimYaw: 0, aimPitch: 0, crouchT: 0, wander: null }; }
const eye = p => [p.x, p.y + (p.crouch ? S.EYEC : S.EYE), p.z];
const chest = p => [p.x, p.y + (p.crouch ? 0.8 : 1.05), p.z];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function botThink(r, p, dt, map) {
  const B = p.brain, D = DIFF[p.diff ?? 1], t = now(), nav = NAV[r.settings.map];
  const foes = [...r.players.values()].filter(q => q !== p && q.alive);
  // look around every 0.2 s
  B.visT -= dt;
  if (B.visT <= 0) {
    B.visT = 0.18 + Math.random() * 0.06;
    let best = null, bd = 1e9;
    for (const q of foes) {
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > D.view) continue;
      // can't see behind (unless just shot by them)
      const ang = Math.atan2(-(q.x - p.x), -(q.z - p.z)), da = Math.abs(((ang - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da > 1.4 && !(B.hurtBy === q.id && t - B.hurtT < 2)) continue;
      const e = eye(p);
      if (!S.canSee(map, e, chest(q)) && !S.canSee(map, e, [q.x, q.y + (q.crouch ? 1.1 : 1.5), q.z])) continue;
      const score = d - (B.target === q ? 6 : 0) - (B.hurtBy === q.id ? 8 : 0);
      if (score < bd) { bd = score; best = q; }
    }
    if (best) { if (B.target !== best) { B.target = best; B.seen = 0; } B.lastSeen = [best.x, best.z]; B.lastSeenT = t; }
    else B.target = null;
  }
  const q = B.target && B.target.alive ? B.target : null;
  if (q) B.seen += dt;
  let wantX = 0, wantZ = 0, sprint = false, crouch = false;
  const empty = p.hopper === 0 && p.reserve === 0;
  const needAmmo = empty || (p.reserve < 12 && !q);
  // reloading under fire: duck behind something
  const hide = q && (p.reloadT > 0 || (p.hp < 50 && Math.random() < D.cover * dt * 4) || empty);
  if (hide && (!B.cover || t - B.coverT > 3)) { B.cover = findCover(map, nav, p, q); B.coverT = t; B.path = null; }
  if (!hide && t - B.coverT > 3.5) B.cover = null;
  let goal = null;
  if (empty || needAmmo) goal = nearestCrate(r, p);
  if (!goal && B.cover) goal = B.cover;
  if (!goal && !q) {
    if (B.lastSeen && t - B.lastSeenT < 6) goal = B.lastSeen;
    else {
      if (!B.wander || Math.hypot(B.wander[0] - p.x, B.wander[1] - p.z) < 1.5) { const pts = [...map.spawns, ...map.ammo]; const k = pts[Math.floor(Math.random() * pts.length)]; B.wander = [k[0], k[1]]; B.path = null; }
      goal = B.wander;
    }
  }
  if (goal) {
    if (!B.goal || Math.hypot(goal[0] - B.goal[0], goal[1] - B.goal[1]) > 1.5 || t - B.pathT > 2 || !B.path) { B.goal = goal; B.path = S.findPath(nav, p.x, p.z, goal[0], goal[1]); B.pathT = t; }
    const path = B.path;
    if (path && path.length) {
      while (path.length > 1 && Math.hypot(path[0][0] - p.x, path[0][1] - p.z) < 0.6) path.shift();
      const [gx, gz] = path[0], dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
      if (d > 0.35) { wantX = dx / d; wantZ = dz / d; }
      sprint = !q || empty;
    }
    if (B.cover && goal === B.cover && Math.hypot(goal[0] - p.x, goal[1] - p.z) < 0.9) { wantX = wantZ = 0; crouch = true; }
  }
  if (q && !goal) {
    // fight: keep a comfortable range and strafe
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
    B.strafeT -= dt; if (B.strafeT <= 0) { B.strafe = Math.random() < 0.5 ? -1 : 1; B.strafeT = 0.6 + Math.random() * 1.4; }
    const side = D.strafe * B.strafe, fwd = d > 20 ? 0.8 : d < 7 ? -0.6 : 0;
    wantX = (dx / d) * fwd + (-dz / d) * side; wantZ = (dz / d) * fwd + (dx / d) * side;
    B.crouchT -= dt; if (B.crouchT <= 0) { B.crouchT = 1 + Math.random() * 2; B.crouching = Math.random() < D.cover * 0.4; }
    crouch = B.crouching && D.strafe < 0.5;
  }
  // stuck? hop, then pick another way
  if (!B.lastPos) B.lastPos = [p.x, p.z];
  B.stuckT += dt;
  if (B.stuckT > 0.8) {
    const moved = Math.hypot(p.x - B.lastPos[0], p.z - B.lastPos[1]);
    if (moved < 0.3 && (wantX || wantZ)) { B.jump = true; B.stuck = (B.stuck || 0) + 1; if (B.stuck > 2) { B.path = null; B.wander = null; B.stuck = 0; } } else B.stuck = 0;
    B.stuckT = 0; B.lastPos = [p.x, p.z];
  }
  const wl = Math.hypot(wantX, wantZ);
  const moveYaw = wl > 0.01 ? Math.atan2(-wantX, -wantZ) : p.yaw;
  S.stepPlayer(p, { mx: 0, mz: Math.min(1, wl), yaw: moveYaw, jump: B.jump, sprint, crouch }, dt, map);
  B.jump = false;
  // aim + shoot
  if (q) {
    const o = [p.x, p.y + (p.crouch ? 1.0 : 1.3), p.z];
    const aimH = q.crouch ? 0.75 : 1.0;
    const dist = Math.hypot(q.x - o[0], q.z - o[2]), tof = dist / (S.BALL_SPEED * 0.85);
    const tx = q.x + (q.vx || 0) * tof * D.lead, tz = q.z + (q.vz || 0) * tof * D.lead, ty = q.y + aimH;
    let dir = S.aimAt(o[0], o[1], o[2], tx, ty, tz);
    // weaker bots under-correct for drop
    const flat = Math.atan2(ty - o[1], dist), ideal = Math.asin(Math.max(-1, Math.min(1, dir[1])));
    let pitch = flat + (ideal - flat) * D.drop, yaw = Math.atan2(-(tx - o[0]), -(tz - o[2]));
    // turn toward the target smoothly
    const turn = 1 - Math.exp(-(6 + 10 * (p.diff ?? 1)) * dt);
    let dy = ((yaw - B.aimYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    B.aimYaw += dy * turn; B.aimPitch += (pitch - B.aimPitch) * turn;
    p.yaw = B.aimYaw; p.pitch = B.aimPitch;
    p.aim = true;
    if (B.seen > D.react && Math.abs(dy) < 0.25 && t >= B.nextShot && p.hopper > 0 && p.reloadT <= 0) {
      const e = D.err * (1 + Math.hypot(p.vx, p.vz) * 0.08) * (dist > 18 ? 1.3 : 1);
      const yy = B.aimYaw + gauss() * e, pp = B.aimPitch + gauss() * e * 0.8;
      const d3 = [-Math.sin(yy) * Math.cos(pp), Math.sin(pp), -Math.cos(yy) * Math.cos(pp)];
      fire(r, p, [o[0] + d3[0] * 0.6, o[1] + d3[1] * 0.6, o[2] + d3[2] * 0.6], d3);
      B.burst++;
      if (B.burst >= D.burst) { B.burst = 0; B.nextShot = t + D.gap * 2.5 + Math.random() * 0.4; }
      else B.nextShot = t + Math.max(S.FIRE_GAP, D.gap * (0.7 + Math.random() * 0.6));
    }
  } else {
    p.aim = false;
    if (wl > 0.01) { const dy = ((moveYaw - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; p.yaw += dy * (1 - Math.exp(-8 * dt)); }
    B.aimYaw = p.yaw; p.pitch *= 0.9; B.aimPitch = p.pitch;
    if (p.hopper < S.HOPPER && p.reserve > 0) startReload(p);
  }
}
function nearestCrate(r, p) {
  let best = null, bd = 1e9;
  for (const c of r.crates) if (c.on) { const d = Math.hypot(c.x - p.x, c.z - p.z) + Math.abs(c.y - p.y) * 3; if (d < bd) { bd = d; best = [c.x, c.z]; } }
  return best;
}
function findCover(map, nav, p, q) {
  const qe = eye(q);
  let best = null, bd = 1e9;
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, d = 1.5 + Math.random() * 8;
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, c = S.navCell(nav, x, z);
    if (!nav.open[c]) continue;
    const g = nav.floor[c];
    if (S.canSee(map, qe, [x, g + 0.95, z])) continue;
    const score = d + Math.hypot(x - q.x, z - q.z) * -0.15;
    if (score < bd) { bd = score; best = [x, z]; }
  }
  return best;
}

// ---------------------------------------------------------------- sockets
const wss = new WebSocketServer({ server, maxPayload: 16384 });
wss.on('connection', ws => {
  const p = newEntity({ ws });
  send(ws, { t: 'hello', id: p.id, champion, maps: MAPS.map(m => ({ name: m.name, blurb: m.blurb })) });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const r = p.room;
    switch (m.t) {
      case 'me':
        p.name = clean(m.name, 14) || 'GOOGLY'; p.color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#34c759'; p.skin = clean(m.skin, 16) || 'none';
        if (r) pushLobby(r);
        break;
      case 'list': send(ws, { t: 'list', rooms: listRooms(), champion }); break;
      case 'create': { const nr = makeRoom({ public: m.public, name: m.name }); join(p, nr); break; }
      case 'quick': {
        const nr = makeRoom({ solo: true, settings: { map: clampI(m.map, 0, MAPS.length - 1), cpus: clampI(m.cpus, 1, 7), diff: clampI(m.diff, 0, 2), time: clampI(m.time ?? 240, 60, 900), score: clampI(m.score ?? 15, 0, 50) } });
        join(p, nr); startMatch(nr); break;
      }
      case 'join': {
        const nr = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!nr) send(ws, { t: 'err', msg: 'No lobby with that code. Check the letters and try again.' });
        else join(p, nr);
        break;
      }
      case 'leave': leave(p); send(ws, { t: 'left' }); break;
      case 'set':
        if (r && r.hostId === p.id && r.state === 'lobby') {
          const s = m.settings || {};
          if (s.map !== undefined) r.settings.map = clampI(s.map, 0, MAPS.length - 1);
          if (s.cpus !== undefined) r.settings.cpus = clampI(s.cpus, 0, 7);
          if (s.diff !== undefined) r.settings.diff = clampI(s.diff, 0, 2);
          if (s.time !== undefined) r.settings.time = clampI(s.time, 60, 900);
          if (s.score !== undefined) r.settings.score = clampI(s.score, 0, 50);
          if (s.public !== undefined) r.public = !!s.public;
          syncBots(r); pushLobby(r);
        }
        break;
      case 'start': if (r && r.hostId === p.id && r.state === 'lobby') startMatch(r); break;
      case 'chat': if (r) { const text = clean(m.text, 120); if (text) bcast(r, { t: 'chat', from: p.name, color: p.color, text }); } break;
      case 'st':
        if (r && p.alive && (r.state === 'play' || r.state === 'count')) {
          const map = MAPS[r.settings.map];
          const x = +m.x, y = +m.y, z = +m.z;
          if ([x, y, z].every(Number.isFinite)) {
            // a gentle leash: nobody moves faster than a sprinting jump
            const d = Math.hypot(x - p.x, z - p.z);
            if (r.state === 'count' && d > 0.5) break;
            if (d < 12) { p.x = Math.max(-map.W / 2, Math.min(map.W / 2, x)); p.z = Math.max(-map.D / 2, Math.min(map.D / 2, z)); p.y = Math.max(0, Math.min(12, y)); }
            else send(ws, { t: 'tp', x: r2(p.x), y: r2(p.y), z: r2(p.z) });
            p.vx = +m.vx || 0; p.vz = +m.vz || 0;
          }
          p.yaw = +m.yaw || 0; p.pitch = +m.pitch || 0; p.crouch = !!m.cr; p.onGround = !!m.g; p.aim = !!m.a;
        }
        break;
      case 'fire':
        if (r && Array.isArray(m.o) && Array.isArray(m.d)) {
          const o = m.o.map(Number), d = m.d.map(Number);
          const ok = [...o, ...d].every(Number.isFinite) && Math.hypot(o[0] - p.x, o[1] - p.y - 1.2, o[2] - p.z) < 3 && fire(r, p, o, d, PAINT.includes(m.col) ? m.col : null);
          if (!ok) send(ws, { t: 'ammo', h: p.hopper, r: p.reserve, rl: p.reloadT, rej: 1 });
        }
        break;
      case 'reload': startReload(p); break;
      case 'ping': send(ws, { t: 'pong', c: m.c }); if (Number.isFinite(m.rtt)) p.rtt = Math.min(1, Math.max(0, m.rtt)); break;
    }
  });
  ws.on('close', () => leave(p));
});
function clampI(v, a, b) { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a; }

let last = now();
setInterval(() => {
  const t = now(), dt = Math.min(0.1, t - last); last = t;
  for (const r of rooms.values()) { try { tick(r, dt); } catch (e) { console.error('tick', e); } }
}, TICK * 1000);
server.listen(PORT, () => console.log(`Googly P-Ball on http://localhost:${PORT}`));
