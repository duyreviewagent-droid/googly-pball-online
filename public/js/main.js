// Googly P-Ball — browser client: menus, lobbies, controls, prediction, drawing.
import * as THREE from 'three';
import { World } from './world.js';
import { Googly, SKINS, CHAMP } from './googly.js';
import { MAPS } from './maps.js';
import * as S from './sim.js';
import { sfx, music, unlockAudio, setMusic, setSfx, audioState, setListener } from './sfx.js';

const Q = new URLSearchParams(location.search);
if (Q.has('shim')) window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('gp.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gp.' + k, JSON.stringify(v)); } catch { } },
};
const COLORS = ['#34c759', '#2f7bff', '#ff3b30', '#ffcc00', '#ff6fb5', '#9b59ff', '#00c7be', '#ff9500', '#f2f2f7', '#3a3a3c'];
const PAINT = ['#ff2d55', '#ff9500', '#ffd60a', '#34c759', '#00c7be', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#64d2ff', '#ff6b00', '#b4ff00'];
const prof = { name: store.get('name', ''), color: store.get('color', '#34c759'), skin: store.get('skin', 'none'), wins: store.get('wins', 0), sens: store.get('sens', 1), invy: store.get('invy', false) };
const unlocked = () => SKINS.slice(0, 1 + Math.min(prof.wins, SKINS.length - 1)).map(s => s.id);
const isMac = !!window.webkit?.messageHandlers?.gp;
const mobile = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
if (mobile) document.body.classList.add('mobile');

const world = new World($('view'));
const clock = new THREE.Clock();
let G = null;             // current match
let room = null, myId = 0, champion = null, mapsInfo = MAPS.map(m => ({ name: m.name, blurb: m.blurb }));
let pendingRoom = (Q.get('room') || '').toUpperCase().slice(0, 4);

// ------------------------------------------------------------------ screens
const SCREENS = ['scr-title', 'scr-cpu', 'scr-online', 'scr-lobby', 'scr-pause', 'scr-end', 'scr-help'];
let screen = 'scr-title', prevScreen = 'scr-title';
function show(id) { if (id !== screen) prevScreen = screen; screen = id; for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
function toast(t, ms = 2400) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.opacity = 0, ms); }
document.querySelectorAll('.back').forEach(b => b.onclick = () => { sfx.click(); show(screen === 'scr-help' ? prevScreen : 'scr-title'); });
document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
document.addEventListener('keydown', () => unlockAudio(), { capture: true });

// title: name, colour, skins
$('nm').value = prof.name;
$('nm').oninput = () => { prof.name = $('nm').value.replace(/[<>&"]/g, '').slice(0, 14); store.set('name', prof.name); sendMe(); };
function drawSwatches() {
  $('swatches').innerHTML = COLORS.map(c => `<div data-c="${c}" style="background:${c}" class="${c === prof.color ? 'on' : ''}"></div>`).join('');
  $('swatches').querySelectorAll('div').forEach(d => d.onclick = () => { prof.color = d.dataset.c; store.set('color', prof.color); sfx.click(); drawSwatches(); drawSkins(); sendMe(); refreshPreview(); });
}
const skinDot = { none: c => c, camo: () => 'radial-gradient(#6b7a3a 30%, #3a2e1c 60%)', tiger: () => 'repeating-linear-gradient(60deg,#ff8a1c 0 5px,#1a1008 5px 8px)', galaxy: () => 'radial-gradient(#ff4fd8, #3a0a6a 50%, #001a3a)', chrome: () => 'linear-gradient(135deg,#fff,#8a96a8,#fff)', rainbow: () => 'linear-gradient(90deg,#ff2d55,#ffd60a,#34c759,#0a84ff,#bf5af2)', lava: () => 'radial-gradient(#ff5a00 20%, #1a0a06 70%)' };
function drawSkins() {
  const un = unlocked();
  $('skins').innerHTML = SKINS.map(s => `<div class="skin ${s.id === prof.skin ? 'on' : ''} ${un.includes(s.id) ? '' : 'locked'}" data-s="${s.id}"><i style="background:${skinDot[s.id](prof.color)}"></i>${s.name}<small>${un.includes(s.id) ? 'unlocked' : '🔒 ' + s.desc}</small></div>`).join('');
  $('skins').querySelectorAll('.skin').forEach(d => d.onclick = () => { if (!unlocked().includes(d.dataset.s)) { sfx.empty(); return toast('Win more matches to unlock ' + d.textContent.replace(/unlocked|🔒.*/, '')); } prof.skin = d.dataset.s; store.set('skin', prof.skin); sfx.click(); drawSkins(); sendMe(); refreshPreview(); });
  $('skinnote').textContent = `· ${prof.wins} win${prof.wins === 1 ? '' : 's'} · ${un.length}/${SKINS.length} unlocked`;
}
drawSwatches(); drawSkins();
function needName() { if (!prof.name.trim()) { $('nm').focus(); toast('Type your name first'); sfx.empty(); return true; } return false; }
$('b-online').onclick = () => { if (needName()) return; sfx.click(); if (pendingRoom) { send({ t: 'join', code: pendingRoom }); pendingRoom = ''; drawInvite(); return; } show('scr-online'); send({ t: 'list' }); };
$('b-cpu').onclick = () => { if (needName()) return; sfx.click(); show('scr-cpu'); };
$('b-help').onclick = () => { sfx.click(); show('scr-help'); };
const fsToggle = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen not available here')); };
$('b-fs').onclick = $('p-fs').onclick = () => { sfx.click(); fsToggle(); };
function drawAudioBtns() { const a = audioState(); for (const id of ['b-music', 'p-music']) $(id).textContent = a.music ? '♪ Music: on' : '♪ Music: off'; for (const id of ['b-sfx', 'p-sfx']) $(id).textContent = a.sfx ? '🔊 Sound: on' : '🔈 Sound: off'; }
$('b-music').onclick = $('p-music').onclick = () => { setMusic(!audioState().music); drawAudioBtns(); };
$('b-sfx').onclick = $('p-sfx').onclick = () => { setSfx(!audioState().sfx); drawAudioBtns(); sfx.click(); };
drawAudioBtns();
function drawInvite() {
  $('invite').classList.toggle('hidden', !pendingRoom);
  $('invite').innerHTML = `You've been invited to lobby <b>${esc(pendingRoom)}</b> — type your name and press JOIN`;
  $('b-online').textContent = pendingRoom ? 'JOIN ' + pendingRoom : 'PLAY ONLINE';
}
drawInvite();
function drawChamp() {
  const c = champion;
  $('champ').classList.toggle('hidden', !c);
  if (c) $('champ').innerHTML = `👑 Reigning champion: <span style="color:${esc(c.color)}">${esc(c.name)}</span> — ${c.score} tags on ${esc(c.map)}`;
}

// map picker cards with a little top-down drawing of each arena
function mapThumb(m, cv) {
  const g = cv.getContext('2d'), W = cv.width = 240, H = cv.height = 140, k = Math.min(W / m.W, H / m.D);
  g.fillStyle = { turf: '#2f7a2a', concrete: '#77776f', forest: '#4a3a24' }[m.ground]; g.fillRect(0, 0, W, H);
  const col = { cakeR: '#c8102e', cakeB: '#1450c8', canY: '#f2b705', canR: '#c8102e', canB: '#1450c8', dorito: '#111', snake: '#1450c8', temple: '#c8102e', templeB: '#111', mini: '#f2b705', contR: '#9a2a1e', contB: '#1f4e8a', contG: '#2e6a3a', contO: '#c8741e', tree: '#1f3a1c', rock: '#8a8680', log: '#6a4a2a', hay: '#c9a44a', plank: '#a07a4a' };
  for (const c of m.colliders) {
    if (['net', 'fence', 'brick'].includes(c.m)) continue;
    g.fillStyle = col[c.m] || '#bbb';
    const x = W / 2 + c.x * k, y = H / 2 + c.z * k;
    if (c.t === 'c') { g.beginPath(); g.arc(x, y, Math.max(1.5, (c.m === 'tree' ? 1.4 : c.r) * k), 0, 7); g.fill(); }
    else g.fillRect(x - c.w * k / 2, y - c.d * k / 2, c.w * k, c.d * k);
  }
  g.fillStyle = '#ffe04a'; for (const [x, z] of m.ammo) { g.beginPath(); g.arc(W / 2 + x * k, H / 2 + z * k, 2.5, 0, 7); g.fill(); }
}
function mapCards(el, sel, onPick, small) {
  el.innerHTML = MAPS.map((m, i) => `<div class="mapc ${i === sel ? 'on' : ''}" data-i="${i}"><canvas></canvas><b>${m.name}</b><small>${m.blurb}</small></div>`).join('');
  el.querySelectorAll('.mapc').forEach((d, i) => { mapThumb(MAPS[i], d.querySelector('canvas')); d.onclick = () => onPick(i); });
  el.classList.toggle('small', !!small);
}
let cpuMap = store.get('cpuMap', 0);
const drawCpuMaps = () => mapCards($('cpu-maps'), cpuMap, i => { cpuMap = i; store.set('cpuMap', i); sfx.click(); drawCpuMaps(); });
drawCpuMaps();
for (const id of ['cpu-n', 'cpu-d', 'cpu-t', 'cpu-s']) { const v = store.get(id, null); if (v !== null) $(id).value = v; $(id).onchange = () => store.set(id, $(id).value); }
$('cpu-go').onclick = () => { sfx.click(); send({ t: 'quick', map: cpuMap, cpus: +$('cpu-n').value, diff: +$('cpu-d').value, time: +$('cpu-t').value, score: +$('cpu-s').value }); };

// online browser
$('on-pub').onclick = () => { sfx.click(); send({ t: 'create', public: true }); };
$('on-priv').onclick = () => { sfx.click(); send({ t: 'create', public: false }); };
$('on-join').onclick = () => { const c = $('on-code').value.trim().toUpperCase(); if (c.length !== 4) return toast('Lobby codes are 4 letters'); sfx.click(); send({ t: 'join', code: c }); };
$('on-code').onkeydown = e => { if (e.key === 'Enter') $('on-join').click(); };
$('on-ref').onclick = () => { sfx.click(); send({ t: 'list' }); };
function drawRooms(list) {
  $('rooms').innerHTML = list.length ? list.map(r => `<div class="roomrow"><div><b>${esc(r.name)}</b><small>${esc(r.map)} · ${r.total}/8 googlies (${r.humans} human) · CPUs ${esc(r.diff)} · ${r.state === 'lobby' ? 'waiting' : 'match on — jump in'}</small></div><button class="green" data-c="${r.code}">JOIN</button></div>`).join('')
    : `<div class="empty">No open lobbies right now. Make one and send your friends the code!</div>`;
  $('rooms').querySelectorAll('button').forEach(b => b.onclick = () => { sfx.click(); send({ t: 'join', code: b.dataset.c }); });
}
setInterval(() => { if (screen === 'scr-online' && !G) send({ t: 'list' }); }, 4000);

// lobby
const amHost = () => room && room.host === myId;
function drawLobby() {
  if (!room) return;
  $('lb-code').textContent = room.code;
  const n = room.players.length;
  $('lb-count').textContent = `· ${n}/8`;
  $('lb-players').innerHTML = room.players.map(p => `<div class="pl"><span class="dot" style="background:${esc(p.color)}"></span>${p.champ ? '👑 ' : ''}${esc(p.name)}${p.id === myId ? ' (you)' : ''}<span class="tag">${p.bot ? 'CPU' : p.host ? 'HOST' : 'PLAYER'}</span></div>`).join('');
  const s = room.settings, h = amHost();
  mapCards($('lb-maps'), s.map, i => { if (!amHost()) return; sfx.click(); send({ t: 'set', settings: { map: i } }); }, true);
  $('lb-maps').classList.toggle('locked', !h);
  for (const [id, k] of [['lb-cpus', 'cpus'], ['lb-diff', 'diff'], ['lb-time', 'time'], ['lb-score', 'score']]) { $(id).value = String(s[k]); $(id).disabled = !h; }
  $('lb-pub').checked = room.public; $('lb-pub').disabled = !h;
  $('lb-start').classList.toggle('hidden', !h);
  $('lb-start').textContent = room.state === 'lobby' ? 'START MATCH' : 'MATCH RUNNING…';
  $('lb-start').disabled = room.state !== 'lobby';
  const hostName = room.players.find(p => p.id === room.host)?.name || 'the host';
  $('lb-wait').textContent = h ? 'You are the host. Invite friends with the code or link, then press START.' : `Waiting for ${hostName} to start the match…`;
}
for (const [id, k] of [['lb-cpus', 'cpus'], ['lb-diff', 'diff'], ['lb-time', 'time'], ['lb-score', 'score']]) $(id).onchange = () => send({ t: 'set', settings: { [k]: +$(id).value } });
$('lb-pub').onchange = () => send({ t: 'set', settings: { public: $('lb-pub').checked } });
$('lb-start').onclick = () => { sfx.click(); send({ t: 'start' }); };
$('lb-leave').onclick = () => { sfx.click(); send({ t: 'leave' }); room = null; show('scr-title'); };
const inviteLink = () => `${location.origin}/?room=${room.code}`;
$('lb-copy').onclick = async () => {
  sfx.click();
  const link = inviteLink();
  try { await navigator.clipboard.writeText(link); toast('Invite link copied! Paste it to your friends: ' + link, 4000); }
  catch { prompt('Send this link to your friends:', link); }
};
if (navigator.share) { $('lb-share').classList.remove('hidden'); $('lb-share').onclick = () => navigator.share({ title: 'Googly P-Ball', text: `Join my paintball lobby — code ${room.code}`, url: inviteLink() }).catch(() => { }); }
$('lb-form').onsubmit = e => { e.preventDefault(); const t = $('lb-msg').value.trim(); if (t) send({ t: 'chat', text: t }); $('lb-msg').value = ''; };
function addChat(m) {
  const line = m.sys ? `<div class="sys">${esc(m.text)}</div>` : `<div><b style="color:${esc(m.color)}">${esc(m.from)}:</b> ${esc(m.text)}</div>`;
  for (const id of ['lb-log', 'log']) { const el = $(id); el.insertAdjacentHTML('beforeend', line); while (el.children.length > 40) el.firstChild.remove(); el.scrollTop = 1e6; }
  if (!m.sys) sfx.chat();
}

// ------------------------------------------------------------------ network
let ws = null, pingT = 0, rtt = 0.1, wasConnected = false;
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
function sendMe() { send({ t: 'me', name: prof.name.trim() || 'GOOGLY', color: prof.color, skin: prof.skin }); }
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { wasConnected = true; sendMe(); if (Q.has('quick')) autoQuick(); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
  ws.onclose = () => {
    if (wasConnected) toast('Lost connection to the server — reconnecting…', 4000);
    wasConnected = false;
    if (G) leaveMatch(); room = null; if (screen === 'scr-lobby' || screen === 'scr-end') show('scr-title');
    setTimeout(connect, 1500);
  };
}
function autoQuick() {
  if (!prof.name) { prof.name = 'TESTER'; }
  sendMe();
  send({ t: 'quick', map: +Q.get('quick') || 0, cpus: +(Q.get('cpus') || 3), diff: +(Q.get('diff') || 1), time: +(Q.get('time') || 240), score: 0 });
}
setInterval(() => { pingT = performance.now(); send({ t: 'ping', c: pingT, rtt }); }, 2000);

function onMsg(m) {
  switch (m.t) {
    case 'hello': myId = m.id; champion = m.champion; drawChamp(); break;
    case 'list': drawRooms(m.rooms); champion = m.champion; drawChamp(); break;
    case 'pong': rtt = rtt * 0.7 + (performance.now() - m.c) / 1000 * 0.3; break;
    case 'err': toast(m.msg, 3500); sfx.empty(); break;
    case 'joined': sfx.join(); $('lb-log').innerHTML = ''; if (!G) show('scr-lobby'); history.replaceState(null, '', '?room=' + m.code); break;
    case 'left': history.replaceState(null, '', location.pathname); break;
    case 'room':
      room = m.room; drawLobby();
      if (room.state === 'lobby' && G && G.state === 'end') { leaveMatch(true); show('scr-lobby'); }
      break;
    case 'chat': addChat(m); break;
    case 'start': enterMatch(m); break;
    case 'go': if (G) { G.state = 'play'; center('GO!', 900); sfx.horn(); } break;
    default: if (G) onGameMsg(m);
  }
}

// ------------------------------------------------------------------ match
const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true, crouch: false, yaw: 0, pitch: 0, alive: true, hp: 100, hopper: 20, reserve: 40, reloadT: 0, pending: 0, lastFire: 0, deadT: 0, aimK: 0, shake: 0, stepT: 0 };
function enterMatch(m) {
  if (G) leaveMatch(true);
  const map = world.load(m.map);
  G = { mapId: m.map, map, ents: new Map(), balls: [], state: m.state, timeLeft: m.timeLeft, countT: m.count, settings: m.settings, sendT: 0, lastBeep: 99, paintov: [] };
  for (const p of m.players) addEnt(p);
  m.crates.forEach((on, i) => world.setCrate(i, on));
  const mine = m.players.find(p => p.id === myId);
  if (mine) Object.assign(me, { x: mine.x, y: mine.y, z: mine.z, yaw: mine.yaw, pitch: 0, vx: 0, vy: 0, vz: 0, alive: mine.alive, hp: mine.hp, hopper: S.HOPPER, reserve: S.START_RESERVE, reloadT: 0, pending: 0 });
  $('hud').classList.remove('hidden'); show(null); $('dead').classList.add('hidden');
  $('log').innerHTML = ''; $('feed').innerHTML = '';
  music.play('match');
  beepAt = 99;
  hidePreview();
  if (!mobile && !Q.has('bot')) askLock();
  paintOv.clear();
}
function leaveMatch(keepRoom) {
  if (!G) return;
  for (const e of G.ents.values()) world.level.remove(e.fig.group);
  G = null;
  $('hud').classList.add('hidden'); $('clickto').classList.add('hidden'); $('board').classList.add('hidden');
  unlock();
  music.play('menu');
  showPreview();
  if (!keepRoom) room = null;
}
function addEnt(p) {
  const fig = new Googly({ color: p.color, name: p.name, skin: p.skin, champ: p.champ, local: p.id === myId });
  fig.group.position.set(p.x, p.y, p.z); fig.group.rotation.y = p.yaw + Math.PI;
  world.level.add(fig.group);
  const e = { id: p.id, name: p.name, color: p.color, bot: p.bot, champ: p.champ, score: p.score || 0, deaths: p.deaths || 0, fig, buf: [], x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: 0, flags: 32, hp: p.hp ?? 100, alive: p.alive !== false, vx: 0, vz: 0 };
  if (p.id === myId) fig.onStep = v => sfx.step(null, G.map.ground, v * 0.6);
  else fig.onStep = v => sfx.step([e.x, e.y, e.z], G.map.ground, v);
  if (!e.alive) fig.group.visible = false;
  G.ents.set(p.id, e);
  return e;
}
function entName(id) { const e = G?.ents.get(id); return e ? e.name : '???'; }
function center(text, ms = 1500, color = '#fff') { const c = $('center'); c.textContent = text; c.style.color = color; c.style.opacity = 1; clearTimeout(center.t); center.t = setTimeout(() => c.style.opacity = 0, ms); }
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); while ($('feed').children.length > 6) $('feed').lastChild.remove(); }
const nameSpan = id => { const e = G.ents.get(id); return e ? `<span style="color:${esc(e.color)}">${esc(e.name)}</span>` : '???'; };

const dbgLog = [];
function onGameMsg(m) {
  if (Q.has('debug') && !['snap', 'shot', 'score', 'crate'].includes(m.t)) { dbgLog.push(`${(performance.now() / 1000).toFixed(1)} ${m.t} ${m.tg ?? m.id ?? ''} ${m.hp ?? ''}`); const d = document.getElementById('dbg') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'dbg' })); d.textContent = JSON.stringify({ myId, alive: me.alive, hp: me.hp, hop: me.hopper, res: me.reserve }) + '\n' + dbgLog.slice(-40).join('\n'); }
  const t = performance.now() / 1000;
  switch (m.t) {
    case 'snap':
      G.timeLeft = m.tl;
      for (const a of m.e) {
        const e = G.ents.get(a[0]); if (!e) continue;
        e.buf.push({ t, x: a[1], y: a[2], z: a[3], yaw: a[4], pitch: a[5], flags: a[6], hp: a[7], vx: a[8], vz: a[9] });
        if (e.buf.length > 30) e.buf.shift();
        e.hp = a[7];
        if (a[0] === myId) { me.hp = a[7]; }
      }
      break;
    case 'spawn': {
      const e = G.ents.get(m.id); if (!e) break;
      e.alive = true; e.buf = []; Object.assign(e, { x: m.x, y: m.y, z: m.z, yaw: m.yaw }); e.hp = 100;
      e.fig.reset(); e.fig.group.position.set(m.x, m.y, m.z);
      if (m.id === myId) { Object.assign(me, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0, yaw: m.yaw, pitch: 0, alive: true, hp: 100, reloadT: 0, pending: 0 }); $('dead').classList.add('hidden'); paintOv.clear(); }
      break;
    }
    case 'tp': Object.assign(me, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0 }); break;
    case 'join': if (!G.ents.has(m.p.id)) { addEnt({ ...m.p, x: 0, y: -50, z: 0, yaw: 0, alive: false }); feed(`${nameSpan(m.p.id)} joined`); } break;
    case 'gone': { const e = G.ents.get(m.id); if (e) { world.level.remove(e.fig.group); G.ents.delete(m.id); feed(`<span>${esc(e.name)} left</span>`); } break; }
    case 'shot': {
      if (m.by === myId) { me.pending = Math.max(0, me.pending - 1); break; }
      const e = G.ents.get(m.by);
      addBall(m.o, m.v, m.col, m.by, m.id);
      if (e) { e.fig.fire(); }
      sfx.shot(m.o, false);
      break;
    }
    case 'hit': {
      const e = G.ents.get(m.tg); if (!e) break;
      e.fig.splat(m.x, m.y, m.z, m.tg === myId ? me.yaw : e.yaw, m.col, m.head);
      removeBall(m.ball);
      if (m.tg === myId) { me.hp = m.hp; me.shake = 0.35; sfx.hurt(); paintOv.hit(m.col, m.head); }
      else sfx.hitBody([e.x, e.y + 1, e.z], m.head);
      if (m.by === myId) { hitmark(m.head); sfx.hitmark(m.head); }
      break;
    }
    case 'out': {
      const e = G.ents.get(m.tg); if (!e) break;
      e.alive = false; e.fig.paintOut(m.col); e.outAt = t;
      world.burst([e.x, e.y + 1, e.z], [0, 1, 0], m.col, 26);
      sfx.out([e.x, e.y + 1, e.z], m.tg === myId || m.by === myId);
      const col = `<b style="color:${esc(m.col)}">●</b>`;
      feed(m.by && m.by !== m.tg ? `${nameSpan(m.by)} ${col} painted ${nameSpan(m.tg)}` : `${nameSpan(m.tg)} ${col} got painted`);
      if (m.tg === myId) { me.alive = false; me.deadT = S.RESPAWN_T; $('dead').classList.remove('hidden'); $('dead-by').innerHTML = m.by && m.by !== myId ? `PAINTED BY ${nameSpan(m.by)}` : 'PAINTED!'; $('dead-by').style.color = m.col; paintOv.flood(m.col); }
      if (m.by === myId && m.tg !== myId) { center(`YOU PAINTED ${e.name}!`, 1400, m.col); sfx.tagged(); }
      break;
    }
    case 'ammo':
      if (m.rej) me.pending = Math.max(0, me.pending - 1);
      me.hopper = Math.max(0, m.h - me.pending); me.reserve = m.r;
      if (m.rl > 0 && me.reloadT <= 0) { me.reloadT = m.rl; sfx.reload(); }
      if (!m.rl) me.reloadT = 0;
      if (m.got) { sfx.pickup(); center(`+${m.got} PAINT`, 900, '#ffe04a'); }
      break;
    case 'crate': world.setCrate(m.i, m.on); break;
    case 'score': for (const [id, s, d] of m.s) { const e = G.ents.get(id); if (e) { e.score = s; e.deaths = d; } } break;
    case 'end': showEnd(m); break;
  }
}

// paintballs in flight (visual; the server decides hits)
const ballGeo = new THREE.SphereGeometry(0.034, 10, 8);
const ballMats = new Map();
const ballMat = c => { if (!ballMats.has(c)) ballMats.set(c, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, emissive: c, emissiveIntensity: 0.25 })); return ballMats.get(c); };
function addBall(o, v, col, by, id) {
  const mesh = new THREE.Mesh(ballGeo, ballMat(col)); mesh.position.set(...o); world.level.add(mesh);
  G.balls.push({ x: o[0], y: o[1], z: o[2], vx: v[0], vy: v[1], vz: v[2], age: 0, col, by, mesh, serverId: id, whiz: false });
}
function removeBall(id) { if (!G) return; const i = G.balls.findIndex(b => b.serverId === id); if (i >= 0) { world.level.remove(G.balls[i].mesh); G.balls.splice(i, 1); } }
function updateBalls(dt) {
  const keep = [];
  for (const b of G.balls) {
    let dead = false;
    for (const sg of S.stepBall(b, dt)) {
      const w = S.segMap(G.map, ...sg);
      let bodyT = 2;
      for (const e of G.ents.values()) {
        if (e.id === b.by || !e.alive) continue;
        const p = e.id === myId ? me : e;
        const h = S.segBody(...sg, { x: p.x, y: p.y, z: p.z, crouch: e.id === myId ? me.crouch : !!(e.flags & 1) });
        if (h && h.t < bodyT) bodyT = h.t;
      }
      if (w && w.t < bodyT) {
        const p = [sg[0] + (sg[3] - sg[0]) * w.t, sg[1] + (sg[4] - sg[1]) * w.t, sg[2] + (sg[5] - sg[2]) * w.t];
        world.splat(p, w.n, b.col); sfx.splat(p, w.n[1] > 0.5); if (w.c && /steel|drum|cont|post|rail/.test(w.c.m)) sfx.steel(p);
        dead = true; break;
      }
      if (bodyT <= 1) { dead = true; break; }
      if (!b.whiz && b.by !== myId && me.alive) {
        const hx = me.x, hy = me.y + 1.3, hz = me.z, d = Math.hypot(b.x - hx, b.y - hy, b.z - hz);
        if (d < 1.6) { b.whiz = true; sfx.whiz([b.x, b.y, b.z]); }
      }
    }
    if (dead || b.age > 3 || b.y < -1) { world.level.remove(b.mesh); continue; }
    b.mesh.position.set(b.x, b.y, b.z);
    keep.push(b);
  }
  G.balls = keep;
}

// ------------------------------------------------------------------ input
const keys = new Set(); let mouseL = false, mouseR = false, locked = false, macLocked = false, chatting = false;
const look = { dx: 0, dy: 0 };
addEventListener('keydown', e => {
  if (chatting) { if (e.key === 'Escape') closeChat(); return; }
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  if (G && ['Tab', ' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  keys.add(e.code);
  if (!G) return;
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyM') { setMusic(!audioState().music); drawAudioBtns(); toast(audioState().music ? 'Music on' : 'Music off', 900); }
  if (e.code === 'KeyT' || e.code === 'Enter') { e.preventDefault(); openChat(); }
  if (e.code === 'Escape' && macLocked) { unlock(); pause(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseL = mouseR = false; });
const canvas = $('view');
canvas.addEventListener('mousedown', e => {
  if (!G) return;
  if (!locked && !macLocked && !mobile) { askLock(); return; }
  if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
addEventListener('contextmenu', e => { if (G) e.preventDefault(); });
addEventListener('mousemove', e => { if (locked) { look.dx += e.movementX; look.dy += e.movementY; } });
window.__look = (dx, dy) => { if (macLocked) { look.dx += dx; look.dy += dy; } };
window.__unlocked = () => { if (macLocked) { macLocked = false; if (G) pause(); } };
window.__mouse = (b, down) => { if (!macLocked) return; if (b === 0) mouseL = down; if (b === 2) mouseR = down; };
function askLock() {
  if (isMac) { window.webkit.messageHandlers.gp.postMessage('lock'); macLocked = true; $('clickto').classList.add('hidden'); show(null); return; }
  $('clickto').classList.remove('hidden');
}
$('clickto').onclick = () => { unlockAudio(); if (isMac) return askLock(); canvas.requestPointerLock?.(); };
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { $('clickto').classList.add('hidden'); show(null); }
  else if (G && !chatting) pause();
});
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); if (macLocked) { macLocked = false; window.webkit?.messageHandlers?.gp?.postMessage('unlock'); } }
function pause() { if (!G) return; mouseL = mouseR = false; keys.clear(); show('scr-pause'); $('clickto').classList.add('hidden'); }
$('p-resume').onclick = () => { sfx.click(); show(null); if (isMac) askLock(); else canvas.requestPointerLock?.(); };
$('p-leave').onclick = () => { sfx.click(); send({ t: 'leave' }); leaveMatch(); show('scr-title'); };
$('sens').value = prof.sens; $('sens').oninput = () => { prof.sens = +$('sens').value; store.set('sens', prof.sens); };
$('invy').checked = prof.invy; $('invy').onchange = () => { prof.invy = $('invy').checked; store.set('invy', prof.invy); };
function openChat() { chatting = true; keys.clear(); mouseL = false; $('chatform').classList.remove('hidden'); $('chatin').focus(); }
function closeChat() { chatting = false; $('chatform').classList.add('hidden'); $('chatin').blur(); $('chatin').value = ''; }
$('chatform').onsubmit = e => { e.preventDefault(); const t = $('chatin').value.trim(); if (t) send({ t: 'chat', text: t }); closeChat(); };
function reload() { if (!G || !me.alive || me.reloadT > 0 || me.hopper >= S.HOPPER) return; if (me.reserve <= 0) { center('NO PAINT LEFT — FIND A CRATE', 1500, '#ff9500'); sfx.empty(); return; } send({ t: 'reload' }); }

// touch controls
const touch = { mx: 0, mz: 0, fire: false, jump: false, crouch: false, stickId: null, lookId: null, lx: 0, ly: 0 };
if (mobile) {
  const stick = $('stick'), knob = $('knob');
  stick.addEventListener('touchstart', e => { touch.stickId = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) { const r = stick.getBoundingClientRect(), dx = (t.clientX - r.left - r.width / 2) / (r.width / 2), dy = (t.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); touch.mx = Math.cos(a) * l; touch.mz = -Math.sin(a) * l; knob.style.left = 45 + Math.cos(a) * l * 45 + 'px'; knob.style.top = 45 + Math.sin(a) * l * 45 + 'px'; }
      if (t.identifier === touch.lookId) { look.dx += (t.clientX - touch.lx) * 2.2; look.dy += (t.clientY - touch.ly) * 2.2; touch.lx = t.clientX; touch.ly = t.clientY; }
    }
  }, { passive: false });
  addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === touch.stickId) { touch.stickId = null; touch.mx = touch.mz = 0; knob.style.left = knob.style.top = '45px'; } if (t.identifier === touch.lookId) touch.lookId = null; } });
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t.clientX > innerWidth * 0.35) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; } }, { passive: true });
  const hold = (id, k) => { const b = $(id); b.addEventListener('touchstart', e => { e.preventDefault(); touch[k] = true; const t = e.changedTouches[0]; if (k === 'fire' && touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; } }, { passive: false }); b.addEventListener('touchend', () => { touch[k] = false; }); };
  hold('t-fire', 'fire'); hold('t-jump', 'jump');
  $('t-cr').addEventListener('touchstart', e => { e.preventDefault(); touch.crouch = !touch.crouch; }, { passive: false });
  $('t-rl').addEventListener('touchstart', e => { e.preventDefault(); reload(); }, { passive: false });
  $('t-menu').addEventListener('touchstart', e => { e.preventDefault(); pause(); }, { passive: false });
}

// ------------------------------------------------------------------ local player
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
const camPos = new THREE.Vector3(), camFwd = new THREE.Vector3();
let botT = 0; const botState = { yawT: 0, wantX: 0, wantZ: 0, target: null };
function localInput(dt) {
  if (Q.has('bot')) return botInput(dt);
  const k = c => keys.has(c);
  const inp = {
    mx: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.mx,
    mz: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) + touch.mz,
    jump: k('Space') || touch.jump, sprint: k('ShiftLeft') || k('ShiftRight'), crouch: k('KeyC') || k('ControlLeft') || touch.crouch,
    fire: mouseL || touch.fire, aim: mouseR,
  };
  if (inp.aim || inp.crouch) inp.sprint = false;
  return inp;
}
// ?bot=1: the local googly plays itself (for testing and screenshots)
function botInput(dt) {
  botT -= dt;
  let tgt = null, bd = 1e9;
  for (const e of G.ents.values()) { if (e.id === myId || !e.alive) continue; const d = Math.hypot(e.x - me.x, e.z - me.z); if (d < bd && S.canSee(G.map, [me.x, me.y + 1.4, me.z], [e.x, e.y + 1, e.z])) { bd = d; tgt = e; } }
  if (botT <= 0) { botT = 1 + Math.random() * 2; botState.mx = Math.random() * 2 - 1; botState.mz = Math.random() < 0.7 ? 1 : -0.5; }
  let fire = false;
  if (tgt) { const ya = Math.atan2(-(tgt.x - me.x), -(tgt.z - me.z)), pa = Math.atan2(tgt.y + 1 - me.y - 1.4, bd) + bd * 0.004; me.yaw += (((ya - me.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 6); me.pitch += (pa - me.pitch) * Math.min(1, dt * 6); fire = Math.random() < 0.3; }
  else me.yaw += dt * 0.6;
  if (me.hopper === 0) reload();
  return { mx: botState.mx, mz: botState.mz, jump: Math.random() < 0.01, sprint: !tgt, crouch: false, fire, aim: !!tgt };
}

function updateLocal(dt) {
  const canMove = me.alive && G.state === 'play';
  const inp = localInput(dt);
  // mouse look
  const sens = 0.0022 * prof.sens * (1 - me.aimK * 0.45);
  me.yaw -= look.dx * sens; me.pitch -= look.dy * sens * (prof.invy ? -1 : 1); look.dx = look.dy = 0;
  me.pitch = Math.max(-1.35, Math.min(1.35, me.pitch));
  me.aimK += ((inp.aim && me.alive ? 1 : 0) - me.aimK) * (1 - Math.exp(-14 * dt));
  if (canMove) {
    const p = me;
    const n = Math.ceil(dt / (1 / 90));
    const wasG = p.onGround;
    for (let i = 0; i < n; i++) S.stepPlayer(p, { mx: inp.mx, mz: inp.mz, yaw: me.yaw, jump: inp.jump && i === 0, sprint: inp.sprint && inp.mz > 0, crouch: inp.crouch }, dt / n, G.map);
    if (p.jumped) { p.jumped = false; sfx.jump(); }
    if (p.landed) { sfx.land(Math.min(1, p.landed / 14)); p.landed = 0; }
    void wasG;
  } else { me.vx = me.vz = 0; }
  // fire
  if (me.reloadT > 0) me.reloadT = Math.max(0, me.reloadT - dt);
  const t = performance.now() / 1000;
  if (inp.fire && canMove && t - me.lastFire >= S.FIRE_GAP) {
    if (me.reloadT > 0) { }
    else if (me.hopper <= 0) { if (t - me.lastFire > 0.35) { me.lastFire = t; sfx.empty(); if (me.reserve > 0) reload(); else center('NO PAINT — FIND A CRATE', 1200, '#ff9500'); } }
    else { me.lastFire = t; shoot(); }
  }
  G.sendT -= dt;
  if (G.sendT <= 0 && me.alive) { G.sendT = 1 / 30; send({ t: 'st', x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), vx: +me.vx.toFixed(2), vz: +me.vz.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), cr: me.crouch ? 1 : 0, g: me.onGround ? 1 : 0, a: me.aimK > 0.5 ? 1 : 0 }); }
  if (!me.alive) me.deadT = Math.max(0, me.deadT - dt);
  return inp;
}
const spreadNow = () => { const sp = Math.hypot(me.vx, me.vz); return (0.007 + Math.min(1, sp / 6) * 0.03 + (me.onGround ? 0 : 0.045)) * (1 - me.aimK * 0.55) * (me.crouch ? 0.7 : 1); };
function shoot() {
  const e = G.ents.get(myId); if (!e) return;
  // aim point: whatever is under the crosshair
  const start = V.copy(camPos).addScaledVector(camFwd, camPos.distanceTo(V2.set(me.x, me.y + 1.3, me.z)) * 0.9);
  const far = V3.copy(start).addScaledVector(camFwd, 150);
  let tHit = 1;
  const w = S.segMap(G.map, start.x, start.y, start.z, far.x, far.y, far.z); if (w) tHit = w.t;
  for (const o of G.ents.values()) { if (o.id === myId || !o.alive) continue; const h = S.segBody(start.x, start.y, start.z, far.x, far.y, far.z, { x: o.x, y: o.y, z: o.z, crouch: !!(o.flags & 1) }); if (h && h.t < tHit) tHit = h.t; }
  const P = start.clone().lerp(far, tHit);
  const muzzle = e.fig.muzzleWorld(new THREE.Vector3());
  // don't shoot through the wall we're hugging
  const chest = [me.x, me.y + (me.crouch ? 0.9 : 1.25), me.z];
  const block = S.segMap(G.map, chest[0], chest[1], chest[2], muzzle.x, muzzle.y, muzzle.z);
  if (block) muzzle.set(chest[0] + (muzzle.x - chest[0]) * block.t * 0.8, chest[1] + (muzzle.y - chest[1]) * block.t * 0.8, chest[2] + (muzzle.z - chest[2]) * block.t * 0.8);
  const dir = P.clone().sub(muzzle); if (dir.length() < 1.2) dir.copy(camFwd); dir.normalize();
  const sp = spreadNow(), a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
  const side = V2.set(dir.z, 0, -dir.x).normalize(), up = V3.crossVectors(side, dir).normalize();
  dir.addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
  const col = PAINT[Math.floor(Math.random() * PAINT.length)];
  send({ t: 'fire', o: [muzzle.x, muzzle.y, muzzle.z].map(v => +v.toFixed(3)), d: [dir.x, dir.y, dir.z].map(v => +v.toFixed(4)), col });
  me.pending++; me.hopper--;
  addBall([muzzle.x, muzzle.y, muzzle.z], [dir.x * S.BALL_SPEED, dir.y * S.BALL_SPEED, dir.z * S.BALL_SPEED], col, myId);
  e.fig.fire(); world.puff(muzzle, dir); sfx.shot(null, true);
  me.kick = (me.kick || 0) + 0.012;
  if (me.hopper === 0 && me.reserve > 0) setTimeout(reload, 150);
}

// ------------------------------------------------------------------ remote googlies
function updateEnts(dt) {
  const rt = performance.now() / 1000 - 0.1;
  for (const e of G.ents.values()) {
    if (e.id === myId) {
      e.x = me.x; e.y = me.y; e.z = me.z; e.yaw = me.yaw; e.alive = me.alive;
      const f = e.fig;
      f.group.position.set(me.x, me.y, me.z); f.group.rotation.y = me.yaw + Math.PI;
      f.update(dt, { speed: Math.hypot(me.vx, me.vz), crouch: me.crouch, pitch: me.pitch, reload: me.reloadT > 0, onGround: me.onGround, hopper: me.hopper });
      // fade out when the camera is inside us
      const d = camPos.distanceTo(V.set(me.x, me.y + 1.1, me.z));
      f.group.visible = me.alive || f.outT < 3.6;
      f.root.visible = d > 0.75;
      continue;
    }
    const b = e.buf;
    if (b.length) {
      let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
      const B = b[i], A = b[Math.max(0, i - 1)];
      const k = B.t === A.t ? 1 : Math.max(0, Math.min(1.2, (rt - A.t) / (B.t - A.t)));
      e.x = A.x + (B.x - A.x) * k; e.y = A.y + (B.y - A.y) * k; e.z = A.z + (B.z - A.z) * k;
      const dy = ((B.yaw - A.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      e.yaw = A.yaw + dy * Math.min(1, k); e.pitch = A.pitch + (B.pitch - A.pitch) * Math.min(1, k);
      e.flags = B.flags; e.vx = B.vx; e.vz = B.vz;
      if (!(B.flags & 32) && e.alive && !e.outAt) { /* server says dead; wait for 'out' */ }
    }
    const f = e.fig;
    f.group.position.set(e.x, e.y, e.z); f.group.rotation.y = e.yaw + Math.PI;
    f.update(dt, { speed: Math.hypot(e.vx, e.vz), crouch: !!(e.flags & 1), pitch: e.pitch, reload: !!(e.flags & 8), onGround: !!(e.flags & 2), hopper: 14 });
    f.group.visible = e.alive || (f.outT >= 0 && f.outT < 3.6);
    // spawn shield shimmer
    f.bodyMesh.material.opacity = 1;
    if (e.alive) e.outAt = 0;
  }
}

// ------------------------------------------------------------------ camera + HUD
function updateCamera(dt) {
  const eyeH = me.crouch ? S.EYEC + 0.12 : S.EYE + 0.1;
  const pivot = V.set(me.x, me.y + eyeH, me.z);
  const cp = Math.cos(me.pitch), fwd = camFwd.set(-Math.sin(me.yaw) * cp, Math.sin(me.pitch), -Math.cos(me.yaw) * cp);
  const right = V2.set(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
  const ak = me.aimK, dead = !me.alive;
  const back = dead ? 4.5 : 2.6 - 1.25 * ak, side = dead ? 0 : 0.62 - 0.2 * ak, up = dead ? 1.2 : 0.2;
  const base = pivot.clone().addScaledVector(right, side * 0.5);
  const want = base.clone().addScaledVector(right, side * 0.5).addScaledVector(fwd, -back); want.y += up;
  const hit = S.segMap(G.map, base.x, base.y, base.z, want.x, want.y, want.z);
  const pos = hit ? base.clone().lerp(want, Math.max(0, hit.t - 0.12)) : want;
  // recoil kick + hit shake
  me.kick = (me.kick || 0) * Math.exp(-12 * dt);
  me.shake = Math.max(0, me.shake - dt);
  const sh = me.shake * 0.12;
  camPos.copy(pos).add(V3.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
  world.camera.position.copy(camPos);
  const lookAt = camPos.clone().addScaledVector(fwd, 10); lookAt.y += me.kick * 10;
  world.camera.lookAt(lookAt);
  world.camera.fov += ((mobile ? 72 : 70) - 24 * ak - world.camera.fov) * (1 - Math.exp(-14 * dt));
  world.camera.updateProjectionMatrix();
  setListener(camPos.x, camPos.y, camPos.z, me.yaw);
}
let hitmT = 0;
function hitmark(head) { const h = $('hitm'); h.classList.toggle('head', !!head); h.style.opacity = 1; hitmT = 0.25; }
const paintOv = {
  cv: $('paintov'), blobs: [],
  clear() { this.blobs = []; this.draw(); },
  hit(col, head) { for (let i = 0; i < (head ? 3 : 2); i++) this.blobs.push({ x: Math.random(), y: Math.random() * 0.8, r: 0.06 + Math.random() * 0.1, col, a: 0.8, drip: Math.random() * 0.1 }); this.draw(); },
  flood(col) { for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283, d = 0.32 + Math.random() * 0.2; this.blobs.push({ x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d, r: 0.1 + Math.random() * 0.12, col, a: 0.75, drip: 0.1 }); } this.draw(); },
  update(dt) { if (!this.blobs.length) return; for (const b of this.blobs) { b.a -= dt * (me.alive ? 0.22 : 0.05); b.drip += dt * 0.02; } this.blobs = this.blobs.filter(b => b.a > 0); this.draw(); },
  draw() {
    const c = this.cv, w = c.width = innerWidth / 2, h = c.height = innerHeight / 2, g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    for (const b of this.blobs) {
      g.globalAlpha = Math.max(0, Math.min(1, b.a)); g.fillStyle = b.col;
      const x = b.x * w, y = b.y * h, r = b.r * Math.min(w, h);
      g.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * 6.283, rr = r * (0.8 + ((i * 7919 + Math.floor(b.x * 1000)) % 10) / 25); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
      g.fillRect(x - r * 0.12, y, r * 0.24, r + b.drip * h);
    }
  },
};
let beepAt = 99;
function updateHUD(dt) {
  const tl = Math.max(0, G.timeLeft | 0);
  $('timer').textContent = G.state === 'count' ? 'GET READY' : `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
  $('timer').style.color = tl <= 10 && G.state === 'play' ? '#ff3b3b' : '#fff';
  if (G.state === 'count') {
    G.countT -= dt;
    const n = Math.ceil(G.countT);
    if (n !== beepAt && n > 0 && n <= 3) { beepAt = n; sfx.beep(false); center(String(n), 800); }
  }
  if (G.state === 'play' && tl <= 5 && tl > 0 && tl !== G.lastBeep) { G.lastBeep = tl; sfx.beep(false); }
  $('a-h').textContent = Math.max(0, me.hopper); $('a-r').textContent = me.reserve;
  $('ammo').classList.toggle('low', me.hopper > 0 && me.hopper <= 5); $('ammo').classList.toggle('out', me.hopper === 0);
  $('rl').classList.toggle('hidden', !(me.reloadT > 0));
  if (me.reloadT > 0) $('rlfill').style.width = (1 - me.reloadT / S.RELOAD_T) * 100 + '%';
  $('a-note').textContent = me.reloadT > 0 ? 'RELOADING…' : me.hopper === 0 && me.reserve === 0 ? 'OUT OF PAINT' : 'HOPPER · RESERVE';
  $('paintfill').style.width = (100 - Math.max(0, me.hp)) + '%';
  // prompt
  let pr = '';
  if (me.alive && G.state === 'play') {
    if (me.hopper === 0 && me.reserve === 0) pr = 'Out of paint! Grab a yellow PAINT +40 crate';
    else if (me.hopper <= 4 && me.reserve > 0 && me.reloadT <= 0) pr = 'Press R to reload';
  }
  $('prompt').textContent = pr;
  if (!me.alive) $('dead-t').textContent = me.deadT > 0 ? `Back in ${Math.ceil(me.deadT)}…` : 'Respawning…';
  // crosshair spread
  const s = 6 + spreadNow() * 420, ch = $('xhair').children;
  ch[0].style.top = -s - 9 + 'px'; ch[1].style.top = s + 'px'; ch[2].style.left = -s - 9 + 'px'; ch[3].style.left = s + 'px';
  $('xhair').style.opacity = me.alive ? 1 : 0;
  hitmT -= dt; if (hitmT <= 0) $('hitm').style.opacity = 0;
  // mini board
  const list = [...G.ents.values()].sort((a, b) => b.score - a.score || a.deaths - b.deaths);
  const top = list.slice(0, 5); if (!top.find(e => e.id === myId)) { const m = list.find(e => e.id === myId); if (m) top.push(m); }
  const lim = G.settings.score ? ` / ${G.settings.score}` : '';
  $('mini').innerHTML = `<small style="opacity:.7;font-size:10px;letter-spacing:1.5px">TAGS${lim}</small>` + top.map(e => `<div class="${e.id === myId ? 'me' : ''}"><span class="n"><span class="dot" style="background:${esc(e.color)}"></span>${e.champ ? '👑' : ''}${esc(e.name)}</span><b>${e.score}</b></div>`).join('');
  const showBoard = keys.has('Tab');
  $('board').classList.toggle('hidden', !showBoard);
  if (showBoard) $('board').innerHTML = `<table><tr><th>GOOGLY</th><th class="r">TAGS</th><th class="r">PAINTED</th><th class="r">PING</th></tr>${list.map(e => `<tr class="${e.id === myId ? 'me' : ''}"><td><span class="dot" style="background:${esc(e.color)}"></span> ${e.champ ? '👑 ' : ''}${esc(e.name)}${e.bot ? ' <small>(CPU)</small>' : ''}</td><td class="r">${e.score}</td><td class="r">${e.deaths}</td><td class="r">${e.id === myId ? Math.round(rtt * 1000) + 'ms' : e.bot ? '—' : ''}</td></tr>`).join('')}</table><p class="tiny">${esc(MAPS[G.mapId].name)} · lobby ${esc(room?.code || '')}</p>`;
  paintOv.update(dt);
}

// ------------------------------------------------------------------ end of match
function showEnd(m) {
  G.state = 'end';
  unlock();
  const won = m.winner && m.winner.id === myId;
  $('end-title').innerHTML = m.winner ? `👑 <span style="color:${esc(m.winner.color)}">${esc(m.winner.name)}</span> WINS!` : 'MATCH OVER';
  $('end-list').innerHTML = `<div class="stand head"><span>#</span><span>GOOGLY</span><span class="r">TAGS</span><span class="r">PAINTED</span></div>` + m.standings.map((s, i) => `<div class="stand ${i === 0 ? 'first' : ''}"><span>${i + 1}</span><span class="n"><span class="dot" style="background:${esc(s.color)}"></span>${esc(s.name)}${s.bot ? ' <small>(CPU)</small>' : ''}${s.id === myId ? ' <small>(you)</small>' : ''}</span><span class="r">${s.score}</span><span class="r">${s.deaths}</span></div>`).join('');
  const un = $('end-unlock'); un.classList.add('hidden');
  if (won) {
    const before = unlocked().length;
    prof.wins++; store.set('wins', prof.wins); drawSkins();
    const after = unlocked();
    un.classList.remove('hidden');
    un.innerHTML = `You won! You'll wear <b>Champion Gold</b> with a crown next match.` + (after.length > before ? `<br>New skin unlocked: <b>${SKINS.find(s => s.id === after[after.length - 1]).name}</b> — pick it on the title screen.` : '');
    sfx.win(); setTimeout(() => sfx.unlock(), 1200);
  } else sfx.lose();
  music.play('end');
  show('scr-end');
  let n = 12; $('end-t').textContent = `Back to the lobby in ${n}…`;
  clearInterval(showEnd.iv); showEnd.iv = setInterval(() => { n--; $('end-t').textContent = n > 0 ? `Back to the lobby in ${n}…` : 'Back to the lobby…'; if (n <= 0 || !G) clearInterval(showEnd.iv); }, 1000);
}
$('end-leave').onclick = () => { sfx.click(); send({ t: 'leave' }); leaveMatch(); show('scr-title'); };

// ------------------------------------------------------------------ menu backdrop: your googly in its locker
let preview = null, previewT = 0;
function showPreview() {
  world.load(0);
  if (preview) world.level.remove(preview.group);
  preview = new Googly({ color: prof.color, skin: prof.skin, champ: false, local: true });
  preview.group.position.set(-20, 0, 3); world.level.add(preview.group);
}
function hidePreview() { preview = null; }
function refreshPreview() { if (!G && preview) preview.setLook(prof.color, prof.skin, false); }
function menuUpdate(dt) {
  if (!preview) return;
  previewT += dt;
  const a = previewT * 0.18;
  preview.group.rotation.y = Math.PI / 2 + Math.sin(previewT * 0.5) * 0.5;
  preview.update(dt, { speed: 0, pitch: Math.sin(previewT * 0.7) * 0.15, hopper: 20 });
  if (Math.random() < dt * 0.6) { preview.fire(); const mz = preview.muzzleWorld(new THREE.Vector3()); world.puff(mz, new THREE.Vector3(1, 0, 0)); }
  const c = world.camera, fx = -20, fz = 3;
  c.position.set(fx + Math.cos(a) * 3.4, 1.45, fz + Math.sin(a) * 3.4);
  c.fov = 48; c.updateProjectionMatrix();
  // keep the googly on the right third of the screen (the menu card sits on the left)
  const f = new THREE.Vector3(fx - c.position.x, 0, fz - c.position.z).normalize(), off = innerWidth > 900 ? 1.25 : 0;
  c.lookAt(fx + f.z * off, 1.0, fz - f.x * off);
}

// ------------------------------------------------------------------ main loop
function frame() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (G) {
    const paused = screen === 'scr-pause';
    updateLocal(paused ? 0.0001 : dt);
    updateEnts(dt);
    updateBalls(dt);
    updateCamera(dt);
    if (G.state !== 'end') updateHUD(dt);
  } else menuUpdate(dt);
  world.update(dt, t);
  world.renderer.render(world.scene, world.camera);
  requestAnimationFrame(frame);
}
if (!Q.has('icon')) { showPreview(); connect(); frame(); }

// test hooks
window.__gp = { get G() { return G; }, me, world, send, get room() { return room; } };
if (Q.has('icon')) import('./icon.js').then(m => m.renderIcon(world));
