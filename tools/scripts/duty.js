// Служба стражи у ворот: кого бить, когда выходить, распорядок дня.
//  • Зона ворот — проезд, площадка перед воротами (около 20 блоков в поле) и площадь за ними
//    (около 20 блоков во двор), по высоте — только земля, без стен и башен. Монстр или враждебный
//    разбойник в зоне получает метку acastle_intruder: только таких стражник и бьёт (tools/npc.js,
//    группа acastle:alert). За монстром на стене, в башне, под землёй или в лесу он не тянется —
//    раньше из-за этого стражники топтались на месте и смотрели вверх.
//  • Нарушителя нет — у стражника нет боевых привычек вовсе: стоит на посту лицом к полю,
//    смотрит на проходящих, после боя сам возвращается на место.
//  • Распорядок (с конца «Ночи у ворот», этап 0): на закате Остап и Митька опускают решётку
//    и уходят в караулки надвратных башен; поле ночью не охраняют — только двор у ворот.
//    На рассвете поднимают решётку и встают на пост. Ночью решётка поднимается перед игроком
//    («Свои!») и опускается за ним. В бою у ворот (ночь этапа 0, осада) ворота открыты.
import { world, system } from '@minecraft/server';
import { S, W, DIM, flat, blockAt, players, save } from './state.js';
import { CASTLE } from './castle_data.js';
import { NPCS } from './story.js';
import { npcIdOf, findNpc, whereOf, npcSpot, despawn } from './people.js';

export const EVENING = 12000, MORNING = 23300; // закат (до темноты, когда идёт нежить) и рассвет
const TAG = 'acastle_intruder';
// Решётка: клетки проезда под поднятой решёткой (в координатах замка)
const BARS = { x1: 61, x2: 65, y1: 0, y2: 3, z: 129 };
// Зоны ворот: [x1, z1, x2, z2, y1, y2] в координатах замка
const PASS = [60, 124, 66, 131, -2, 5];
const INSIDE = [48, 104, 78, 123, -3, 5];
const OUTSIDE = [46, 131, 80, 152, -10, 6];
const inBox = (p, [x1, z1, x2, z2, y1, y2]) => {
  const a = W([x1, y1, z1]), b = W([x2 + 1, y2 + 1, z2 + 1]);
  return p.x >= a.x && p.x < b.x && p.z >= a.z && p.z < b.z && p.y >= a.y && p.y < b.y;
};

const closingTime = () => { const t = world.getTimeOfDay(); return t >= EVENING && t < MORNING; };
// Бой у ворот: в эти ночи ворота открыты и стража на постах
export const hold = () => S.q.s0_night !== 'done' || S.q.s8_siege === 'active' || !!S.f.wave || !!S.f.siege;
export const nightShift = () => closingTime() && !hold();

// ---------- Нарушители и тревога ----------
const mode = {}; // id существа → 'alert' | 'calm' (что ему уже сказано)
export const guardMode = (e) => mode[e.id];
function intruders() {
  const gate = W(CASTLE.gate);
  let mobs = [];
  try { mobs = DIM().getEntities({ location: gate, maxDistance: 56, families: ['monster'] }); } catch (e) { mobs = []; }
  const night = nightShift(), out = [];
  for (const m of mobs) {
    const l = m.location;
    const inside = inBox(l, PASS) || inBox(l, INSIDE) || (!night && inBox(l, OUTSIDE));
    try { if (inside) { m.addTag(TAG); out.push(m); } else if (m.hasTag(TAG)) m.removeTag(TAG); } catch (e) { /* пропал */ }
  }
  return out;
}
// Лицом к полю (пост f: 0 — на юг, наружу)
const YAW = [0, 90, 180, -90];
function faceOut(id, e, at) {
  const p = CASTLE.posts.find((q) => q.guard === id);
  if (!p || whereOf(id) !== 'post' || flat(e.location, { x: at.x + 0.5, z: at.z + 0.5 }) > 1.2) return;
  if (players().some((pl) => flat(pl.location, e.location) < 6)) return; // рядом человек — пусть смотрит на него
  try {
    const yaw = YAW[(p.f || 0) % 4], r = e.getRotation();
    if (Math.abs(((r.y - yaw + 540) % 360) - 180) > 20) e.setRotation({ x: 0, y: yaw });
  } catch (err) { /* старая версия игры */ }
}
export function alertTick() {
  const list = intruders();
  let guards = [];
  try { guards = DIM().getEntities({ type: 'acastle:guard' }); } catch (e) { guards = []; }
  for (const e of guards) {
    const id = npcIdOf(e);
    if (!id || !NPCS[id] || CASTLE.posts.some((p) => p.guard === id && p.archer)) continue; // лучник стреляет сам, со своей башни
    const at = npcSpot(id);
    const want = at && list.some((m) => flat(m.location, at) < 28) ? 'alert' : 'calm';
    if (mode[e.id] !== want) { try { e.triggerEvent('acastle:' + want); mode[e.id] = want; } catch (err) { /* пропал */ } }
    if (want === 'calm' && at) faceOut(id, e, at);
  }
}

// ---------- Решётка ----------
function setBars(closed) {
  for (let x = BARS.x1; x <= BARS.x2; x++) for (let y = BARS.y1; y <= BARS.y2; y++) if (!blockAt(W([x, y, BARS.z]))) return false;
  for (let x = BARS.x1; x <= BARS.x2; x++) for (let y = BARS.y1; y <= BARS.y2; y++) {
    const b = blockAt(W([x, y, BARS.z]));
    try {
      if (closed && b.isAir) b.setType('minecraft:iron_bars');
      else if (!closed && b.typeId === 'minecraft:iron_bars') b.setType('minecraft:air');
    } catch (e) { /* ничего */ }
  }
  const c = W([63, 1, BARS.z]);
  for (const pl of players()) if (flat(pl.location, c) < 24) try { pl.playSound(closed ? 'random.door_close' : 'random.door_open'); } catch (e) { /* ничего */ }
  return true;
}
// Под решёткой кто-то стоит — опускать нельзя
function underBars() {
  const c = W([63, 0, BARS.z]);
  let list = [];
  try { list = DIM().getEntities({ location: { x: c.x + 0.5, y: c.y + 1, z: c.z + 0.5 }, maxDistance: 4 }); } catch (e) { list = []; }
  return list.some((e) => e.typeId !== 'minecraft:item' && Math.abs(e.location.z - (c.z + 0.5)) < 0.8 && Math.abs(e.location.x - (c.x + 0.5)) < 3.2);
}
// Игрок у решётки (с любой стороны) — ночью ему открывают
const atGate = () => players().some((pl) => inBox(pl.location, [59, 125, 67, 134, -2, 4]));

// Реплика стражника тем, кто рядом с воротами
function call(id, text) {
  const e = findNpc(id), gate = W(CASTLE.gate);
  for (const pl of players()) if (flat(pl.location, e ? e.location : gate) < 40) pl.sendMessage(`§e${NPCS[id].name}:§r ${text}`);
}

// ---------- Смена караула ----------
const pending = {}; // id → тик, с которого житель должен перейти на новое место
let passUntil = 0, passSaid = 0;
export function dutyTick() {
  const night = nightShift();
  // Вечером — в караулку, утром — на пост (только Остап и Митька: у них есть караулка)
  for (const p of CASTLE.posts) {
    if (!p.rest) continue;
    const id = p.guard, where = whereOf(id);
    if (where !== 'post' && where !== 'rest') continue; // ушёл на пир, к воротам и т. п.
    const want = night ? 'rest' : 'post';
    if (where !== want) { S.npcs[id] = want; pending[id] = system.currentTick; save(); }
  }
  for (const id of Object.keys(pending)) {
    const e = findNpc(id);
    if (!e) { delete pending[id]; continue; }
    const seen = players().some((pl) => flat(pl.location, e.location) < 14);
    if (!seen || system.currentTick - pending[id] > 400) { despawn(id, e); delete pending[id]; }
  }
  if (night !== !!S.f.night_watch) {
    S.f.night_watch = night ? 1 : 0; save();
    if (night) call('ostap', 'Солнце садится. Опускаем решётку — до утра ворота на запоре. Надо войти или выйти — подойди к решётке, откроем.');
    else call('mitka', 'Рассвело! Поднимаем решётку. По местам!');
  }
  // Решётка: ночью опущена, перед игроком поднимается, за ним опускается
  const now = system.currentTick;
  if (night && atGate()) {
    if (S.f.gate === 'closed' && now - passSaid > 1200) { passSaid = now; call(S.npcs.ostap === 'rest' ? 'ostap' : 'mitka', 'Свои! Поднимаем решётку.'); }
    passUntil = now + 60;
  }
  const closed = night && now > passUntil;
  if (closed !== (S.f.gate === 'closed')) {
    if (closed && underBars()) return;
    if (setBars(closed)) { S.f.gate = closed ? 'closed' : null; save(); }
  }
}

// Для /scriptevent acastle:status
export function dutyStatus() {
  const g = [];
  for (const p of CASTLE.posts) {
    const e = findNpc(p.guard);
    if (e) g.push(`${NPCS[p.guard].name}: ${whereOf(p.guard) === 'rest' ? 'в караулке' : 'на посту'}${mode[e.id] === 'alert' ? ', в бою' : ''}`);
  }
  return `Ворота: ${S.f.gate === 'closed' ? 'решётка опущена' : 'открыты'}${hold() ? ' (бой у ворот — открыты всю ночь)' : ''}. ${g.join('; ')}`;
}
