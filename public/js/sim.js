// Shared physics: googly movement, paintball flight and ray tests. Runs the same in the browser and on the server.
export const GRAV = 20;            // players (snappy jumps)
export const BALL_G = 9.81;        // paintballs fall like real ones
export const BALL_SPEED = 62;      // m/s — a touch under a real marker's 90 so you can see them fly
export const BALL_DRAG = 0.0045;   // quadratic drag per metre
export const PR = 0.38;            // body radius
export const PH = 1.66, PHC = 1.18;// standing / crouching height
export const STEP = 0.47;          // highest ledge you walk up without jumping
export const EYE = 1.42, EYEC = 0.98;
export const HOPPER = 20, RESERVE_MAX = 100, START_RESERVE = 60, CRATE_AMMO = 40;
export const RELOAD_T = 1.6, FIRE_GAP = 0.13, HP = 100, BODY_DMG = 34, HEAD_DMG = 60;
export const RESPAWN_T = 3, SHIELD_T = 2;

const lo = (c, k) => c[k] - (k === 'x' ? c.w : c.d) / 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// highest walkable top under a circle at (x,z) that is at most maxY
export function groundAt(map, x, z, r, maxY) {
  let g = 0;
  for (const c of map.colliders) {
    const top = c.y + c.h;
    if (top > maxY || top <= g) continue;
    if (c.t === 'b') {
      const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0), dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
      if (dx * dx + dz * dz < r * r * 0.5) g = top;
    } else if (Math.hypot(x - c.x, z - c.z) < c.r + r * 0.5) g = top;
  }
  return g;
}

// push a body out of everything it overlaps (horizontal), ceiling bumps (vertical)
function resolve(p, map, h) {
  for (const c of map.colliders) {
    const top = c.y + c.h;
    if (p.y + h <= c.y + 0.01 || p.y >= top - 0.01) continue;         // no vertical overlap
    if (p.onGround && top - p.y <= STEP) continue;                     // it's a step: groundAt lifts us
    if (c.t === 'b') {
      const nx = clamp(p.x, lo(c, 'x'), lo(c, 'x') + c.w), nz = clamp(p.z, lo(c, 'z'), lo(c, 'z') + c.d);
      let dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= PR * PR) continue;
      // head bump on something above us
      if (p.vy > 0 && p.y + h - p.vy * 0.04 <= c.y + 0.05) { p.y = c.y - h; p.vy = 0; continue; }
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * PR; p.z = nz + dz / d * PR; }
      else { // centre inside the box: leave by the nearest face
        const ex = [p.x - lo(c, 'x'), lo(c, 'x') + c.w - p.x, p.z - lo(c, 'z'), lo(c, 'z') + c.d - p.z];
        const m = Math.min(...ex), i = ex.indexOf(m);
        if (i === 0) p.x = lo(c, 'x') - PR; else if (i === 1) p.x = lo(c, 'x') + c.w + PR; else if (i === 2) p.z = lo(c, 'z') - PR; else p.z = lo(c, 'z') + c.d + PR;
      }
    } else {
      let dx = p.x - c.x, dz = p.z - c.z; const d = Math.hypot(dx, dz), m = c.r + PR;
      if (d >= m) continue;
      if (p.vy > 0 && p.y + h - p.vy * 0.04 <= c.y + 0.05) { p.y = c.y - h; p.vy = 0; continue; }
      if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      p.x = c.x + dx * m; p.z = c.z + dz * m;
    }
  }
}

/** One movement step. p: {x,y,z,vx,vy,vz,onGround,crouch}. inp: {mx,mz (local, -1..1), yaw, jump, sprint, crouch}. */
export function stepPlayer(p, inp, dt, map) {
  p.crouch = !!inp.crouch;
  const h = p.crouch ? PHC : PH;
  const sp = p.crouch ? 2.5 : inp.sprint ? 6.4 : 4.5;
  let mx = inp.mx || 0, mz = inp.mz || 0; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const s = Math.sin(inp.yaw), c = Math.cos(inp.yaw);
  // yaw 0 looks down -z; mz = forward, mx = right
  const wx = (mx * c - mz * s) * sp, wz = (-mx * s - mz * c) * sp;
  const k = 1 - Math.exp(-(p.onGround ? 14 : 2.2) * dt);
  p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;
  if (inp.jump && p.onGround && !p.crouch) { p.vy = 6.6; p.onGround = false; p.jumped = true; }
  p.vy -= GRAV * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vz) * dt / 0.18));
  for (let i = 0; i < n; i++) {
    p.x += p.vx * dt / n; p.z += p.vz * dt / n;
    resolve(p, map, h);
  }
  const was = p.onGround;
  p.y += p.vy * dt;
  const g = groundAt(map, p.x, p.z, PR, p.y + (was ? STEP : 0.05) + Math.max(0, -p.vy * dt));
  if (p.y <= g) { if (!was && p.vy < -9) p.landed = -p.vy; p.y = g; p.vy = 0; p.onGround = true; }
  else if (was && p.y - g < STEP && p.vy <= 0) { p.y = g; p.vy = 0; p.onGround = true; }         // walk down steps
  else p.onGround = false;
  resolve(p, map, h);
  const hw = map.W / 2 - PR, hd = map.D / 2 - PR;
  p.x = clamp(p.x, -hw, hw); p.z = clamp(p.z, -hd, hd);
}

// ------------------------------------------------------------------ rays
/** First hit of the segment a→b against the map. Returns {t (0..1), n:[x,y,z]} or null. */
export function segMap(map, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let best = null;
  if (by < 0 && ay >= 0) { const t = ay / (ay - by); best = { t, n: [0, 1, 0], c: null }; }
  if (map.roof && by > map.roof && ay <= map.roof) { const t = (map.roof - ay) / dy; if (!best || t < best.t) best = { t, n: [0, -1, 0], c: null }; }
  for (const c of map.colliders) {
    if (c.t === 'b') {
      let t0 = 0, t1 = best ? best.t : 1, axis = -1, sign = 0;
      const mins = [c.x - c.w / 2, c.y, c.z - c.d / 2], maxs = [c.x + c.w / 2, c.y + c.h, c.z + c.d / 2], o = [ax, ay, az], d = [dx, dy, dz];
      let ok = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mins[i] || o[i] > maxs[i]) { ok = false; break; } continue; }
        let ta = (mins[i] - o[i]) / d[i], tb = (maxs[i] - o[i]) / d[i], sg = -1;
        if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; }
        if (ta > t0) { t0 = ta; axis = i; sign = sg; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && axis >= 0) { const n = [0, 0, 0]; n[axis] = sign; best = { t: t0, n, c }; }
    } else {
      // vertical cylinder: side then top cap
      const fx = ax - c.x, fz = az - c.z, A = dx * dx + dz * dz, Bq = 2 * (fx * dx + fz * dz), Cq = fx * fx + fz * fz - c.r * c.r;
      const lim = best ? best.t : 1;
      if (A > 1e-9) {
        const disc = Bq * Bq - 4 * A * Cq;
        if (disc >= 0) {
          const t = (-Bq - Math.sqrt(disc)) / (2 * A);
          if (t >= 0 && t <= lim) { const y = ay + dy * t; if (y >= c.y && y <= c.y + c.h) { const nx = (fx + dx * t) / c.r, nz = (fz + dz * t) / c.r; best = { t, n: [nx, 0, nz], c }; continue; } }
        }
      }
      const top = c.y + c.h;
      if (dy < 0 && ay >= top && by <= top) { const t = (ay - top) / (ay - by); if (t <= lim) { const x = ax + dx * t - c.x, z = az + dz * t - c.z; if (x * x + z * z <= c.r * c.r) best = { t, n: [0, 1, 0], c }; } }
    }
  }
  return best;
}
export const canSee = (map, a, b) => !segMap(map, a[0], a[1], a[2], b[0], b[1], b[2]);

/** Segment vs a googly's hit capsule. Returns {t, head} or null. */
export function segBody(ax, ay, az, bx, by, bz, p) {
  const h = p.crouch ? PHC : PH, r = PR + 0.04;
  const y0 = p.y + 0.22 + r, y1 = p.y + h - r;
  // closest points between segment AB and the capsule's axis (vertical line segment)
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const steps = 8; let best = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
    const cy = clamp(y, y0, y1), d = Math.hypot(x - p.x, y - cy, z - p.z);
    if (d < r) { best = t; break; }
  }
  if (best === null) return null;
  // refine backwards to the surface
  let t0 = Math.max(0, best - 1 / steps), t1 = best;
  for (let k = 0; k < 10; k++) {
    const t = (t0 + t1) / 2, x = ax + dx * t, y = ay + dy * t, z = az + dz * t, cy = clamp(y, y0, y1);
    if (Math.hypot(x - p.x, y - cy, z - p.z) < r) t1 = t; else t0 = t;
  }
  const hy = ay + dy * t1;
  return { t: t1, head: hy > p.y + h - 0.42, x: ax + dx * t1, y: hy, z: az + dz * t1 };
}

/** Advance a paintball; returns the list of substep segments [ax,ay,az,bx,by,bz] travelled. */
export function stepBall(b, dt) {
  const segs = [], n = 3;
  for (let i = 0; i < n; i++) {
    const h = dt / n, sp = Math.hypot(b.vx, b.vy, b.vz), drag = BALL_DRAG * sp;
    b.vx -= b.vx * drag * h; b.vy -= b.vy * drag * h + BALL_G * h; b.vz -= b.vz * drag * h;
    const ax = b.x, ay = b.y, az = b.z;
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    segs.push([ax, ay, az, b.x, b.y, b.z]);
  }
  b.age += dt;
  return segs;
}

/** Launch direction that lands a paintball on target (drop compensated, drag approximated). Low arc. */
export function aimAt(ox, oy, oz, tx, ty, tz, speed = BALL_SPEED) {
  const dx = tx - ox, dz = tz - oz, dy = ty - oy, R = Math.hypot(dx, dz);
  const v = speed * (1 - Math.min(0.35, BALL_DRAG * R * 0.55));      // average speed after drag
  const g = BALL_G, v2 = v * v, disc = v2 * v2 - g * (g * R * R + 2 * dy * v2);
  const ang = disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (g * R || 1e-6));
  const ch = Math.cos(ang);
  return [dx / (R || 1) * ch, Math.sin(ang), dz / (R || 1) * ch];
}

// ------------------------------------------------------------------ navigation grid for the computer players
export function buildNav(map, cell = 0.7) {
  const nx = Math.floor(map.W / cell), nz = Math.floor(map.D / cell);
  const floor = new Float32Array(nx * nz), open = new Uint8Array(nx * nz);
  const cx = i => -map.W / 2 + (i + 0.5) * cell, cz = j => -map.D / 2 + (j + 0.5) * cell;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = cx(i), z = cz(j);
    let ok = true, g = 0;
    // walkable if the ground reached from below is clear of anything within body height above it
    g = groundAt(map, x, z, PR, 50);
    for (const c of map.colliders) {
      const top = c.y + c.h;
      if (c.y >= g + PH || top <= g + 0.01) continue;
      const pad = PR + 0.12;
      const inside = c.t === 'b' ? Math.abs(x - c.x) < c.w / 2 + pad && Math.abs(z - c.z) < c.d / 2 + pad : Math.hypot(x - c.x, z - c.z) < c.r + pad;
      if (inside) { ok = false; break; }
    }
    floor[j * nx + i] = g; open[j * nx + i] = ok && Math.abs(x) < map.W / 2 - 0.8 && Math.abs(z) < map.D / 2 - 0.8 ? 1 : 0;
  }
  return { nx, nz, cell, floor, open, cx, cz, W: map.W, D: map.D };
}
export function navCell(nav, x, z) {
  const i = clamp(Math.floor((x + nav.W / 2) / nav.cell), 0, nav.nx - 1), j = clamp(Math.floor((z + nav.D / 2) / nav.cell), 0, nav.nz - 1);
  return j * nav.nx + i;
}
function nearestOpen(nav, k) {
  if (nav.open[k]) return k;
  const i0 = k % nav.nx, j0 = (k / nav.nx) | 0;
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) continue;
    if (nav.open[j * nav.nx + i]) return j * nav.nx + i;
  }
  return k;
}
/** A* over the grid; steps up at most STEP between neighbours. Returns [[x,z],...] or null. */
export function findPath(nav, x0, z0, x1, z1) {
  const s = nearestOpen(nav, navCell(nav, x0, z0)), e = nearestOpen(nav, navCell(nav, x1, z1));
  if (s === e) return [[x1, z1]];
  const N = nav.nx * nav.nz, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], ex = e % nav.nx, ez = (e / nav.nx) | 0;
  const hfn = k => { const i = k % nav.nx, j = (k / nav.nx) | 0; return Math.hypot(i - ex, j - ez); };
  const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[s] = 0; push(s, hfn(s));
  let it = 0;
  while (heap.length && it++ < 20000) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === e) break;
    const i = k % nav.nx, j = (k / nav.nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nav.nx || b >= nav.nz) continue;
      const n = b * nav.nx + a; if (!nav.open[n] || closed[n]) continue;
      if (di && dj && (!nav.open[j * nav.nx + a] || !nav.open[b * nav.nx + i])) continue;
      if (Math.abs(nav.floor[n] - nav.floor[k]) > STEP + 0.02) continue;
      const ng = g[k] + (di && dj ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; from[n] = k; push(n, ng + hfn(n)); }
    }
  }
  if (from[e] < 0) return null;
  const path = []; let k = e;
  while (k !== s && k >= 0) { path.push([nav.cx(k % nav.nx), nav.cz((k / nav.nx) | 0)]); k = from[k]; }
  path.reverse();
  // string-pull: drop points we can walk straight past
  const out = [];
  let prev = [x0, z0];
  for (let q = 0; q < path.length; q++) {
    const nxt = path[q + 1];
    if (nxt && straight(nav, prev, nxt)) continue;
    out.push(path[q]); prev = path[q];
  }
  if (out.length) out[out.length - 1] = [x1, z1];
  return out.length ? out : [[x1, z1]];
}
function straight(nav, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / (nav.cell * 0.5));
  let last = nav.floor[navCell(nav, a[0], a[1])];
  for (let i = 1; i <= n; i++) {
    const t = i / n, k = navCell(nav, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    if (!nav.open[k] || Math.abs(nav.floor[k] - last) > STEP) return false;
    last = nav.floor[k];
  }
  return true;
}
