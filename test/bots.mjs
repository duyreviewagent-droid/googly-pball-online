// Headless check: a quick match of CPUs vs an idle observer; reports hits, tags, winner.
import WebSocket from 'ws';
const url = process.env.URL || 'ws://localhost:8123';
const map = +(process.argv[2] || 0), diff = +(process.argv[3] ?? 1), time = +(process.argv[4] || 60);
const ws = new WebSocket(url);
const c = { shot: 0, hit: 0, out: 0, crate: 0 }; let me, started = Date.now(), pos = null;
ws.on('open', () => { ws.send(JSON.stringify({ t: 'me', name: 'TESTER', color: '#34c759' })); ws.send(JSON.stringify({ t: 'quick', map, cpus: 7, diff, time, score: 0 })); });
ws.on('message', raw => {
  const m = JSON.parse(raw);
  if (m.t === 'hello') me = m.id;
  if (m.t in c) c[m.t]++;
  if (m.t === 'spawn' && m.id === me) pos = m;
  // park the observer on its spawn (stay put so it can be shot too)
  if (m.t === 'snap' && pos) ws.send(JSON.stringify({ t: 'st', x: pos.x, y: pos.y, z: pos.z, yaw: 0, pitch: 0, g: 1 }));
  if (m.t === 'end') {
    console.log(`map ${map} diff ${diff}:`, JSON.stringify(c), 'winner', m.winner.name, m.winner.score);
    console.log(m.standings.map(s => `${s.name}:${s.score}/${s.deaths} ${s.acc}%`).join('  '));
    process.exit(0);
  }
});
setTimeout(() => { console.log('TIMEOUT', c); process.exit(1); }, (time + 20) * 1000);
