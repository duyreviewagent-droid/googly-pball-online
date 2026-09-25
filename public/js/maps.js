// Googly P-Ball — the three arenas. Shared by the server (collisions, bots) and the browser (drawing).
// Every collider is axis-aligned: boxes {t:'b', x, z, w, d, h, y} and upright cylinders {t:'c', x, z, r, h, y}.
// x/z are the centre on the ground plane, y is the bottom, h the height. `m` is the look.

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const B = (x, z, w, d, h, m, y = 0, extra = {}) => ({ t: 'b', x, z, w, d, h, y, m, ...extra });
const C = (x, z, r, h, m, y = 0, extra = {}) => ({ t: 'c', x, z, r, h, y, m, ...extra });
// mirror a list of colliders through the centre (point symmetry keeps both halves fair)
const mirror = list => list.flatMap(c => [c, { ...c, x: -c.x, z: -c.z }]);
function perimeter(W, D, h, m) {
  const t = 1;
  return [B(0, -D / 2 - t / 2, W + 2 * t, t, h, m), B(0, D / 2 + t / 2, W + 2 * t, t, h, m), B(-W / 2 - t / 2, 0, t, D, h, m), B(W / 2 + t / 2, 0, t, D, h, m)];
}
// stairs of 0.44 m risers climbing along +x (dir 1) or -x (dir -1) up to height top
function stairs(x, z, dir, top, width, m) {
  const n = Math.ceil(top / 0.44), out = [];
  for (let i = 0; i < n; i++) out.push(B(x + dir * i * 0.55, z, 0.55, width, Math.min(top, (i + 1) * 0.44), m));
  return out;
}

// ------------------------------------------------------------------ 1. speedball field
function speedball() {
  const W = 50, D = 32;
  const half = [
    C(8, 0, 1.15, 1.15, 'cakeR'), C(4, 7, 1.15, 1.15, 'cakeB'), C(4, -7, 1.15, 1.15, 'cakeB'),
    C(11.5, 4.5, 0.62, 1.7, 'canY'), C(11.5, -4.5, 0.62, 1.7, 'canY'), C(2.5, 3, 0.62, 1.7, 'canR'),
    B(12, 12, 8, 1, 0.9, 'snake'), B(6, -12.5, 6, 1, 0.9, 'snake'),
    B(16.5, 3.5, 1.2, 2.4, 1.9, 'temple'), B(16.5, -5, 1.2, 2.4, 1.9, 'temple'),
    B(7, 11.2, 2.2, 1.1, 1.8, 'temple'), B(19.5, 10.5, 2.4, 1.2, 1.9, 'templeB'),
    B(14.5, 0, 1.6, 1.6, 1.2, 'mini'), B(21.5, 0, 1.6, 1.6, 1.2, 'mini'), B(21, -8, 1.6, 1.6, 1.2, 'mini'),
    C(19, 5.5, 0.62, 1.7, 'canB'), B(9.5, -9, 2.6, 1.1, 1.3, 'mini'),
  ];
  const colliders = [
    C(0, 0, 1.0, 2.8, 'dorito'), B(0, 12.5, 3, 1.2, 1.9, 'templeB'), B(0, -12.5, 3, 1.2, 1.9, 'templeB'),
    ...mirror(half), ...perimeter(W, D, 3.2, 'net'),
  ];
  return {
    id: 0, name: 'SPEEDBALL FIELD', blurb: 'Inflatable bunkers on turf. Fast, open, loud.', W, D, sky: 'day', ground: 'turf',
    colliders,
    spawns: [[-23, 0], [23, 0], [-22, 12], [22, -12], [-22, -12], [22, 12], [0, 14.5], [0, -14.5], [-12, 0], [12, 7]],
    ammo: [[0, 7], [0, -7], [-18, 0], [18, 0], [-13, -8], [13, 8], [-23, 14], [23, -14]],
  };
}

// ------------------------------------------------------------------ 2. warehouse
function warehouse() {
  const W = 52, D = 36;
  const cont = (x, z, rot, m, y = 0) => rot ? B(x, z, 2.44, 6.1, 2.6, m, y) : B(x, z, 6.1, 2.44, 2.6, m, y);
  const half = [
    cont(8, 5, 0, 'contR'), cont(8, 5, 0, 'contB', 2.6), cont(16, -4, 1, 'contG'), cont(3, -9, 0, 'contO'),
    cont(19, 11, 0, 'contB'), cont(-3, 12.5, 0, 'contG'),
    B(12.5, 0.5, 1.2, 1.2, 1.2, 'crate'), B(13.7, 0.5, 1.2, 1.2, 1.2, 'crate'), B(13.1, 0.5, 1.2, 1.2, 1.2, 'crate', 1.2),
    B(22, -6, 1.3, 1.1, 0.45, 'pallet'), B(22, -4.6, 1.3, 1.1, 0.9, 'pallet'), B(22, -3.2, 1.3, 1.1, 1.35, 'pallet'),
    B(4.5, 1, 2.4, 1.1, 1.1, 'barrier'), B(11, 13.5, 1.2, 1.2, 1.2, 'crate'),
    C(20.5, 3, 0.45, 1.0, 'drum'), C(21.4, 3.6, 0.45, 1.0, 'drum'), C(1, -4.5, 0.45, 1.0, 'drum'),
    B(24.2, 12, 1.2, 8, 1.4, 'shelf'),
  ];
  // mezzanine catwalk across the middle, reached by stairs at both ends
  const deck = B(0, 0, 12, 3, 0.3, 'steel', 3.0);
  const colliders = [
    ...mirror(half), deck,
    ...stairs(-9.8, 0, 1, 3.3, 2.2, 'steelStair'), ...stairs(9.8, 0, -1, 3.3, 2.2, 'steelStair'),
    B(0, 1.45, 12, 0.08, 1.0, 'rail', 3.3), B(0, -1.45, 12, 0.08, 1.0, 'rail', 3.3),
    C(-3, 0, 0.18, 3.0, 'post'), C(3, 0, 0.18, 3.0, 'post'),
    ...perimeter(W, D, 9, 'brick'),
  ];
  return {
    id: 1, name: 'THE WAREHOUSE', blurb: 'Shipping containers, crates and a catwalk. Tight corners.', W, D, sky: 'indoor', ground: 'concrete', roof: 9,
    colliders,
    spawns: [[-24, 0], [24, 0], [-23, -15], [23, 15], [-10, 15.5], [10, -15.5], [0, 8], [0, -8], [-16, 6], [16, -6]],
    ammo: [[0, 0.1, 3.3], [-14, 8], [14, -8], [-24, -9], [24, 9], [-6, -15], [6, 15], [0, 10]],
  };
}

// ------------------------------------------------------------------ 3. pine woods with two forts
function woods() {
  const W = 58, D = 40, r = rng(9001);
  const fort = (cx, dir) => {
    const s = 6, top = 2.2, out = [];
    out.push(B(cx, 0, s, s, 0.25, 'plank', top - 0.25));
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.push(C(cx + px * (s / 2 - 0.25), pz * (s / 2 - 0.25), 0.2, top - 0.25, 'logpost'));
    // railings with an opening facing the stairs
    out.push(B(cx - dir * (s / 2 - 0.05), 0, 0.12, s, 1.05, 'plankwall', top));
    out.push(B(cx, s / 2 - 0.05, s, 0.12, 1.05, 'plankwall', top));
    out.push(B(cx, -(s / 2 - 0.05), s, 0.12, 1.05, 'plankwall', top));
    out.push(B(cx + dir * (s / 2 - 0.05), 1.9, 0.12, 2.2, 1.05, 'plankwall', top));
    out.push(...stairs(cx + dir * (s / 2 + 2.475), -1.6, -dir, top, 1.6, 'plankstep'));
    // cover underneath
    out.push(B(cx, 0, 2.4, 0.9, 1.1, 'hay'));
    return out;
  };
  const colliders = [...fort(-20, 1), ...fort(20, -1)];
  const half = [
    B(10, 6, 5, 0.8, 1.05, 'log'), B(6, -8, 0.8, 5, 1.05, 'log'), B(14, -12, 4, 0.8, 1.05, 'log'), B(3, 14, 4.5, 0.8, 1.05, 'log'),
    B(12, 1, 1.8, 0.9, 1.1, 'hay'), B(8, 13, 1.8, 0.9, 1.1, 'hay'), B(23, 12, 1.8, 0.9, 1.1, 'hay'),
    C(5, 2.5, 1.2, 1.5, 'rock'), C(17, 9, 1.4, 1.8, 'rock'), C(25, -8, 1.1, 1.3, 'rock'), C(-2, -15, 1.3, 1.6, 'rock'),
  ];
  colliders.push(...mirror(half));
  // trees: seeded so the server and every browser grow the same forest
  const clear = (x, z) => colliders.every(c => {
    if (c.t === 'c') return Math.hypot(x - c.x, z - c.z) > c.r + 1.6;
    return Math.abs(x - c.x) > c.w / 2 + 1.6 || Math.abs(z - c.z) > c.d / 2 + 1.6;
  });
  const trees = [];
  for (let tries = 0; tries < 900 && trees.length < 34; tries++) {
    const x = (r() - 0.5) * (W - 4), z = (r() - 0.5) * (D - 4);
    if (Math.abs(x) > 27 || Math.abs(z) > 18) continue;
    if (Math.abs(z) < 3 && Math.abs(x) < 26 && r() < 0.8) continue;           // keep the middle lane open-ish
    if (!clear(x, z) || trees.some(t => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
    const t = C(x, z, 0.28 + r() * 0.16, 9 + r() * 5, 'tree'); t.seed = Math.floor(r() * 1e6);
    trees.push(t, { ...t, x: -x, z: -z, seed: t.seed + 1 });
  }
  colliders.push(...trees, ...perimeter(W, D, 3, 'fence'));
  return {
    id: 2, name: 'PINE WOODS', blurb: 'Trees, log walls and two wooden forts to hold.', W, D, sky: 'dusk', ground: 'forest',
    colliders,
    spawns: [[-26, 0], [26, 0], [-24, -16], [24, 16], [-24, 16], [24, -16], [0, 17], [0, -17], [-10, 0], [10, 0]],
    ammo: [[-20, 0, 2.2], [20, 0, 2.2], [0, 0], [-10, 10], [10, -10], [-12, -14], [12, 14], [0, 16]],
  };
}

export const MAPS = [speedball(), warehouse(), woods()];
