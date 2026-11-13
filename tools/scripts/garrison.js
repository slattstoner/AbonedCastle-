// Гарнизон замка (docs/workers.md, «Стража»). Список — CASTLE.garrison.roster (tools/npc.js).
//  • Посты: ворота ×2, вход в донжон ×2, дозор по двору (пара), обход донжона (один) — их держат
//    две смены по 7 человек, у каждого своя койка в казарме. Днём стоит дневная смена, ночью —
//    ночная. На пересменке новый идёт от своей койки на пост; прежний, когда его сменили, идёт
//    к своей койке и ложится спать (пропадает до своей смены). Пока у поста нет сменщика,
//    стражник стоит обе смены. Без смен: дозорные угловых башен и лучники надвратных башен.
//  • Ходят стражники по готовым путям (сборщик считает их по клеткам, где можно пройти):
//    от койки к посту, обходы — по петле через двор. Скрипт переносит их шагами; если рядом
//    монстр — не мешает: стражник дерётся сам, потом возвращается на пост или на обход.
//  • Набор: капитан Демьян (кнопка «Гарнизон» в разговоре). Новобранцу нужен меч — его
//    куёт кузнец (workers.js), наутро новобранец на посту.
//  • Снаряжение: кузнец куёт броню и мечи, garrison.equip надевает (видно на стражнике).
//  • Сюжет, ведущий стражника (пир, осада), — главнее: если S.npcs[id] не 'post', гарнизон
//    стражника не трогает. Свои истории стражников — заготовки в guard_stories.js.
//  • С 0.9.4: бьют только «нарушителей» — монстров на земле двора, у ворот, на этаже гридня в
//    донжоне (скрипт метит их раз в секунду). За монстром на стене, в башне, под землёй стражник
//    не тянется. Без тревоги — стоит смирно; ходит только по найденному пути (сквозь стены не
//    проходит, двери открывает). Обходы — не без конца, а раз в несколько минут, между ними
//    дозор стоит на своём месте. Ворота: на закате стража опускает решётку, ночной караул сидит
//    в караулках надвратных башен и поднимает решётку перед игроком; на рассвете — снова на пост.
//    Гридни — личная стража короля у двери опочивальни (днём Ратибор, ночью Твердята).
// Команды: /scriptevent acastle:guard status | all | day | night | tp <id>
import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { show } from './ui.js';
import { S, save, DIM, players, runCmd } from './state.js';
import { CASTLE } from './castle_data.js';
import { NPCS, HOOKS } from './story.js';
import { GUARD_STORIES } from './guard_stories.js';
import { makeSearch } from './work_core.js';
import { toggleGate, gateClosed, gateMoving, gateManual, clearManual } from './gate.js';

const KEY = 'acastle:garrison';
const GR = () => CASTLE.garrison;
const ROSTER = () => GR().roster;
const byId = (id) => ROSTER().find((g) => g.id === id);
export const GARRISON_IDS = new Set((CASTLE.garrison ? CASTLE.garrison.roster : []).map((g) => g.id));
// Новые стражники — тоже жители (для разговора и книги)
for (const g of (CASTLE.garrison ? CASTLE.garrison.roster : [])) if (!NPCS[g.id]) NPCS[g.id] = { name: g.name, guard: true, start: null, garrison: true };

export let G = null;
function gload() {
  try { G = JSON.parse(world.getDynamicProperty(KEY) || 'null'); } catch (e) { G = null; }
  if (!G || G.v !== 1) G = { v: 1, origin: null, rec: {}, st: {}, gear: {}, want: {}, ri: {}, since: {} };
}
let gdirty = false;
const gsave = () => { gdirty = true; };
function gflush() { if (gdirty && G) { world.setDynamicProperty(KEY, JSON.stringify(G)); gdirty = false; } }

// ---------- Кто где ----------
const Wc = (c) => ({ x: S.origin[0] + c[0], y: S.origin[1] + c[1], z: S.origin[2] + c[2] });
const W3 = (flat, k) => Wc([flat[k], flat[k + 1], flat[k + 2]]);
const pts = (flat) => { const out = []; for (let k = 0; k < flat.length; k += 3) out.push(W3(flat, k)); return out; };
const blk = (p) => { try { return DIM().getBlock(p); } catch (e) { return undefined; } };
const tag = (id) => 'acastle_npc_' + id;
const whereOf = (id) => (id in S.npcs ? S.npcs[id] : NPCS[id] && NPCS[id].start);
const recruited = (id) => whereOf(id) === 'post';
export const managed = (id) => GARRISON_IDS.has(id) && recruited(id);
const isNight = () => { const t = world.getTimeOfDay(); return t >= 12000; };
const RANK_ORDER = { десятник: 0, гридень: 1, стражник: 2, лучник: 3, дозорный: 4 };
// Капитан и стражники по званию — в таком порядке кузнец их и одевает
export function byRank() {
  const list = ROSTER().filter((g) => recruited(g.id)).sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || ROSTER().indexOf(a) - ROSTER().indexOf(b));
  return [...(S.npcs.demyan !== null ? [{ id: 'demyan', name: 'Капитан Демьян Беляк', rank: 'капитан' }] : []), ...list];
}
const slotKey = (g) => g.post + ':' + (g.slot || 0);
function slots() {
  const out = {};
  for (const g of ROSTER()) (out[slotKey(g)] = out[slotKey(g)] || []).push(g);
  return out;
}
// Кто сейчас должен стоять на посту
function onDuty(list) {
  const rec = list.filter((g) => recruited(g.id));
  if (!rec.length) return null;
  const want = isNight() ? 'night' : 'day';
  return (rec.find((g) => !g.shift || g.shift === want) || rec[0]).id;
}
const POST_TITLE = {
  dungeon: 'темница', cells: 'нижние казематы', hall: 'Большой зал',
  gate_l: 'ворота', gate_r: 'ворота', keep_l: 'вход в донжон', keep_r: 'вход в донжон', patrol_yard: 'дозор по двору', patrol_keep: 'обход донжона',
  king: 'у покоев короля', tower_nw: 'башня за амбаром', tower_ne: 'башня за домом управителя', tower_sw: 'башня у шахты', tower_se: 'башня у двора строителя', arch_l: 'левая надвратная башня', arch_r: 'правая надвратная башня',
};
const isPatrol = (g) => g.post.startsWith('patrol_');
const routeOf = (g) => pts(GR().routes[g.post].path);
// Ночью (решётка опущена по распорядку) ночной караул ворот сидит в караулке надвратной башни
const gateNight = () => !!G && G.sched === 'night';
// Место поста (для обхода — где дозор сейчас должен быть)
function postAt(g) {
  if (isPatrol(g)) return patrolSpot(g);
  const P = GR().posts;
  if (gateNight() && g.shift === 'night' && P[g.post + '_night']) return Wc(P[g.post + '_night']);
  return Wc(P[g.post]);
}
const bedAt = (g) => (g.bed !== undefined && GR().beds[g.bed] ? Wc(GR().beds[g.bed]) : g.kbed !== undefined && GR().posts.kbeds && GR().posts.kbeds[g.kbed] ? Wc(GR().posts.kbeds[g.kbed]) : null);

// ---------- Существа ----------
const ents = {};
function entOf(id) {
  const e = ents[id];
  try { if (e && e.isValid) return e; } catch (err) { /* нет */ }
  ents[id] = undefined;
  return undefined;
}
function findAll() {
  let list = [];
  try { list = DIM().getEntities({ type: 'acastle:guard' }); } catch (e) { list = []; }
  const out = {};
  for (const e of list) { let id = null; try { for (const t of e.getTags()) if (t.startsWith('acastle_npc_')) id = t.slice(12); } catch (err) { /* нет */ } if (id) (out[id] = out[id] || []).push(e); }
  return out;
}
function standable(p) {
  const below = blk({ x: p.x, y: p.y - 1, z: p.z }), feet = blk(p), head = blk({ x: p.x, y: p.y + 1, z: p.z });
  if (!below || !feet || !head || below.isAir || below.isLiquid) return false;
  const open = (b) => b.isAir || /grass|fern|flower|carpet|torch|rail|snow_layer|light_block/.test(b.typeId);
  return open(feet) && open(head);
}
function spawn(g, at) {
  if (!blk(at) || !standable(at)) return null;
  try {
    const e = DIM().spawnEntity('acastle:guard', { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }, { spawnEvent: 'acastle:as_' + g.id, initialPersistence: true });
    e.nameTag = g.name; e.addTag(tag(g.id));
    if (!g.archer && g.post !== 'arch_l') e.triggerEvent('acastle:patrol');
    ents[g.id] = e; applied.delete(g.id);
    return e;
  } catch (err) { report(g.name + ': не встал', err); return null; }
}
function despawn(id) { const e = entOf(id); if (e) try { e.triggerEvent('acastle:despawn'); e.removeTag(tag(id)); } catch (err) { /* нет */ } ents[id] = undefined; }
let errAt = 0;
function report(what, e) {
  console.warn('acastle гарнизон: ' + what + ' ' + (e || ''));
  if (system.currentTick - errAt > 1200) { errAt = system.currentTick; world.sendMessage('§c[Замок] Гарнизон: ' + what + (e ? ' — ' + e : '')); }
}

// ---------- Снаряжение ----------
const SLOT_CMD = { head: 'slot.armor.head', chest: 'slot.armor.chest', legs: 'slot.armor.legs', feet: 'slot.armor.feet', hand: 'slot.weapon.mainhand' };
const applied = new Map(); // id → снаряжение, которое уже надето на это существо
export const gearOf = (id) => (G ? G.gear[id] || {} : {});
export function equip(id, slot, item) {
  if (!G) gload();
  (G.gear[id] = G.gear[id] || {})[slot] = item; gsave(); gflush();
  applied.delete(id);
}
function applyGear(id, e) {
  const gear = G.gear[id];
  if (!gear) return;
  const key = JSON.stringify(gear) + ':' + e.id;
  if (applied.get(id) === key) return;
  for (const [slot, item] of Object.entries(gear)) runCmd(`replaceitem entity @e[tag=${tag(id)}] ${SLOT_CMD[slot]} 0 ${item}`);
  applied.set(id, key);
}

// ---------- Набор ----------
function needsMet(g) {
  if (!g.needs) return true;
  if (g.needs === 'barracks') return !CASTLE.units.barracks || !!(S.rep.barracks && S.rep.barracks.st === 'done'); // с 0.11.0 казарма цела с начала
  let done = {};
  try { done = (JSON.parse(world.getDynamicProperty('acastle:work') || '{}').build || {}).done || {}; } catch (e) { done = {}; }
  return !!done[g.needs];
}
const NEEDS_TEXT = { barracks: 'казарма во дворе перекрыта', tower_nw: 'башня за амбаром сложена', tower_ne: 'башня за домом управителя сложена', tower_sw: 'башня у шахты сложена', tower_se: 'башня у двора строителя сложена' };
// Новобранцы, для которых кузнец должен сковать меч
export const wanted = () => Object.keys(G ? G.want : {}).filter((id) => !recruited(id));
export function recruitArrive(id) {
  if (!G) gload();
  const g = byId(id);
  if (!g) return;
  delete G.want[id];
  S.npcs[id] = 'post'; save();
  G.st[id] = 'rest'; gsave(); gflush();
  world.sendMessage(`§6${g.name} принял меч и заступает в гарнизон: ${POST_TITLE[g.post]}${g.shift ? (g.shift === 'night' ? ', ночная смена' : ', дневная смена') : ''}.`);
}

// ---------- Ходьба ----------
const movers = {};
function walk(id, path, done, v = 0.15) {
  if (!path || path.length < 2) { done && done(); return; }
  movers[id] = { path, i: 0, t: 0, v, done };
}
// Поворот: 0 — лицом на юг (+z), 90 — на запад (−x); x — наклон головы (0 — прямо)
const yawOf = (a, b) => Math.atan2(-(b.x - a.x), b.z - a.z) * 180 / Math.PI;
const yaws = {}; // id → куда смотрит, когда стоит
const nearPlayer = (p, r) => players().some((pl) => Math.abs(pl.location.x - p.x) < r && Math.abs(pl.location.z - p.z) < r);
// Двери на пути: открыть, когда стражник входит, закрыть, когда отошёл
const opened = []; // { p, by }
function door(p, open) {
  const b = blk(p);
  if (!b || !/_door$/.test(b.typeId)) return false;
  try {
    const low = b.permutation.getState('upper_block_bit') ? blk({ x: p.x, y: p.y - 1, z: p.z }) : b;
    if (!!low.permutation.getState('open_bit') === open) return true;
    low.setPermutation(low.permutation.withState('open_bit', open));
    try { DIM().playSound(open ? 'random.door_open' : 'random.door_close', p, { volume: 0.6 }); } catch (e) { /* ничего */ }
  } catch (e) { /* нет состояния */ }
  return true;
}
function closeDoors() {
  for (let k = opened.length - 1; k >= 0; k--) {
    const o = opened[k], e = entOf(o.by);
    const far = !e || Math.hypot(e.location.x - o.p.x - 0.5, e.location.z - o.p.z - 0.5) > 2.2;
    if (far) { door(o.p, false); opened.splice(k, 1); }
  }
}
function moveTick(id, dt) {
  const m = movers[id], e = entOf(id);
  if (!m) return false;
  if (!e) { delete movers[id]; return false; }
  const i0 = m.i;
  m.t += m.v * dt;
  while (m.t >= 1 && m.i < m.path.length - 1) { m.t -= 1; m.i++; }
  const a = m.path[m.i], b = m.path[Math.min(m.i + 1, m.path.length - 1)];
  const last = m.i >= m.path.length - 1;
  const t = last ? 0 : m.t;
  // дверь впереди — открыть
  if (m.i !== i0 || !m.dk) { m.dk = 1; for (const c of [a, b]) if (door(c, true) && !opened.some((o) => o.p.x === c.x && o.p.y === c.y && o.p.z === c.z)) opened.push({ p: c, by: id }); }
  // далеко от игроков переносим реже: так дешевле для игры
  if (last || m.i !== i0 || nearPlayer(e.location, 48) || system.currentTick % 10 === 0) {
    // взгляд — ровно по ходу (раньше смотрел в точку над следующей клеткой и задирал голову)
    if (b.x !== a.x || b.z !== a.z) yaws[id] = yawOf(a, b);
    try { e.teleport({ x: a.x + (b.x - a.x) * t + 0.5, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t + 0.5 }, { rotation: { x: 0, y: yaws[id] || 0 } }); } catch (err) { /* нет */ }
  }
  if (last) { delete movers[id]; if (m.done) m.done(); }
  return true;
}
// ---------- Путь по миру (A*): сквозь стены не ходим ----------
const PASS = /(^|:)(air|cave_air|short_grass|tall_grass|fern|large_fern|poppy|dandelion|cornflower|allium|azure_bluet|oxeye_daisy|lily_of_the_valley|.*tulip|blue_orchid|deadbush|torch|wall_torch|.*carpet|snow_layer|vine|.*_sign|.*pressure_plate|light_block.*|.*_door|.*fence_gate|lever|.*button|brown_mushroom|red_mushroom)$/;
const pass = (x, y, z) => { const b = blk({ x, y, z }); return !!b && PASS.test(b.typeId) && !b.isLiquid; };
const solid = (x, y, z) => { const b = blk({ x, y, z }); return !!b && !b.isAir && !b.isLiquid && !PASS.test(b.typeId); };
const standFn = (x, y, z) => solid(x, y - 1, z) && pass(x, y, z) && pass(x, y + 1, z) && !/_door$/.test((blk({ x, y: y - 1, z }) || {}).typeId || '');
standFn.headroom = (x, y, z) => pass(x, y, z);
standFn.climb = (x, y, z) => /ladder|scaffolding/.test((blk({ x, y, z }) || {}).typeId || '');
const seek = {}; // id → { s: поиск, to, retry }
let budget = 0;
function goTo(id, e, at) {
  const q = seek[id];
  if (q && q.retry && system.currentTick < q.retry) return;
  const from = fl(e.location), to = [at.x, at.y, at.z];
  if (!q || !q.s || q.to !== to.join()) seek[id] = { s: makeSearch([from.x, from.y, from.z], to, standFn, { maxNodes: 2500, near: 0 }), to: to.join() };
  const r = seek[id].s.step(Math.min(60, Math.max(0, budget))); budget -= 60;
  if (r === undefined) return;
  if (r) { delete seek[id]; walk(id, r.map(([x, y, z]) => ({ x, y, z })), null, 0.15); return; }
  // пути нет (завал, дверь заперта): на глазах у игрока не телепортируем — ждём; вдали — переносим
  if (!nearPlayer(e.location, 32) && !nearPlayer(at, 32)) { try { e.teleport({ x: at.x + 0.5, y: at.y, z: at.z + 0.5 }); } catch (err) { /* нет */ } delete seek[id]; }
  else seek[id] = { retry: system.currentTick + 100 };
}
const line = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z))); const out = []; for (let k = 0; k <= n; k++) out.push({ x: Math.round(a.x + (b.x - a.x) * k / n), y: k < n ? Math.floor(a.y) : b.y, z: Math.round(a.z + (b.z - a.z) * k / n) }); return out; };
const fl = (l) => ({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });
const busy = {}; // id → тик, когда рядом был нарушитель
const mode = {}; // id → 'alert' | 'calm' (что сказано существу)

// ---------- Каждую секунду: смены, посты, появление ----------
let shiftAt = {};
export function garrisonTick() {
  if (!S || !S.origin || S.build || !CASTLE.garrison) return;
  if (!G) gload();
  if (!G.origin || G.origin.join() !== S.origin.join()) { const keep = G.gear; gload(); G = { v: 1, origin: S.origin.slice(), rec: {}, st: {}, gear: keep || {}, want: {}, ri: {}, since: {} }; gsave(); }
  const found = findAll();
  for (const [id, list] of Object.entries(found)) {
    if (!GARRISON_IDS.has(id)) continue;
    if (!managed(id)) continue; // сюжет ведёт сам (пир, осада) — не трогаем
    const keep = entOf(id) || list[0];
    for (const e of list) if (e !== keep) try { e.triggerEvent('acastle:despawn'); e.removeTag(tag(id)); } catch (err) { /* нет */ }
    if (!ents[id]) { ents[id] = keep; try { keep.triggerEvent('acastle:patrol'); } catch (err) { /* нет */ } }
  }
  // броня и мечи — всем, на ком они должны быть (и капитану)
  for (const id of [...GARRISON_IDS, 'demyan']) { const e = entOf(id) || (found[id] && found[id][0]); if (e && G.gear[id]) applyGear(id, e); }
  if (G.gear.demyan) { let d = null; try { d = DIM().getEntities({ tags: [tag('demyan')] })[0]; } catch (e) { d = null; } if (d) applyGear('demyan', d); }
  try { gateSchedule(); } catch (e) { report('решётка', e); }
  const now = system.currentTick;
  for (const [key, list] of Object.entries(slots())) {
    const duty = onDuty(list);
    if (shiftAt[key] !== duty) { shiftAt[key] = duty; G.since[key] = now; }
    for (const g of list) {
      if (!managed(g.id)) continue;
      const st = G.st[g.id] || 'rest', e = entOf(g.id);
      if (g.id === duty) {
        if (st === 'rest' || st === 'toBed') {
          delete movers[g.id];
          const bed = bedAt(g), path = GR().paths[g.id];
          if (e) { G.st[g.id] = 'duty'; } // ещё не ушёл — остаётся
          else if (bed && path && blk(bed) && standable(bed)) {
            const ne = spawn(g, bed);
            if (ne) { G.st[g.id] = 'toPost'; walk(g.id, pts(path), () => { G.st[g.id] = 'duty'; G.ri[g.id] = 0; gsave(); }); }
          } else G.st[g.id] = 'duty';
          gsave();
        } else if (st === 'duty' && !e) {
          const at = postAt(g);
          if (blk(at)) spawn(g, at);
        } else if (st === 'toPost' && !e) G.st[g.id] = 'duty';
      } else {
        // не его смена: дождаться сменщика (или минуты), потом к койке и спать
        if (st === 'duty' || st === 'toPost') {
          const rel = duty && (G.st[duty] === 'duty' || now - (G.since[key] || now) > 1200);
          if (!duty) continue; // сменщика нет — стоит дальше
          if (!rel) continue;
          const bed = bedAt(g), path = GR().paths[g.id];
          if (e && bed && path) { G.st[g.id] = 'toBed'; delete movers[g.id]; delete seek[g.id]; } // путь к койке — в garrisonMove
          else { despawn(g.id); G.st[g.id] = 'rest'; }
          gsave();
        } else if (st === 'toBed' && !e) G.st[g.id] = 'rest';
      }
    }
  }
  gflush();
}

// ---------- Нарушители ----------
// Раз в секунду: монстры у замка. Нарушитель — тот, до кого стража может дойти по земле:
// на земле двора (высота от −2 до +3), перед воротами днём (ночью решётка опущена и поле не
// охраняют) или на жилом этаже донжона (там стоит гридень). Остальных стража не трогает.
let intr = [];
const KEEP = () => GR().keep || [44, 17];
function scanIntruders() {
  const o = S.origin, [KX, KZ] = KEEP();
  let list = [];
  try { list = DIM().getEntities({ location: Wc([64, 0, 72]), maxDistance: 120, families: ['monster'] }); } catch (e) { list = []; }
  intr = [];
  for (const m of list) {
    let l; try { l = m.location; } catch (e) { continue; }
    const x = l.x - o[0], y = l.y - o[1], z = l.z - o[2];
    const terr = x >= -1 && x < 129 && z >= -1 && z < 133, front = x >= 44 && x < 83 && z >= 133 && z < 153;
    let kind = null;
    if ((terr || (front && !gateNight())) && y >= -2 && y < 4) kind = 'yard';
    else if (x >= KX && x < KX + 39 && z >= KZ && z < KZ + 39 && y >= 17 && y < 21) kind = 'keep';
    try {
      for (const t of ['acastle_intruder', 'acastle_intruder_keep']) { const want = (t === 'acastle_intruder' && kind === 'yard') || (t === 'acastle_intruder_keep' && kind === 'keep'); if (want && !m.hasTag(t)) m.addTag(t); else if (!want && m.hasTag(t)) m.removeTag(t); }
    } catch (e) { /* пропал */ }
    if (kind) intr.push({ x: l.x, y: l.y, z: l.z, kind });
  }
}
// Есть ли нарушитель для этого стражника: рядом с ним и недалеко от его поста
function foeFor(g, e) {
  const kind = g.post === 'king' ? 'keep' : 'yard', home = postAt(g), l = e.location, r = isPatrol(g) ? 16 : 12;
  return intr.some((m) => m.kind === kind && Math.hypot(m.x - l.x, m.z - l.z) < r && Math.abs(m.y - l.y) < 4 && Math.hypot(m.x - home.x, m.z - home.z) < 24);
}
function setMode(id, e, want, g) {
  if (mode[id] === want) return;
  try { e.triggerEvent(want === 'calm' ? 'acastle:calm' : g.post === 'king' ? 'acastle:alert_keep' : 'acastle:alert'); mode[id] = want; } catch (err) { /* пропал */ }
}

// ---------- Обходы: раз в несколько минут ----------
// Дозор стоит на своём месте (начало петли), в свой час идёт по петле один круг и возвращается.
// Второй в паре идёт за первым на три шага позади, а на месте стоит рядом с ним.
const ROUND_DAY = 6000, ROUND_NIGHT = 4800; // 5 и 4 минуты между обходами
const leadOf = (g) => (g.slot ? ROSTER().find((q) => q.post === g.post && !q.slot && q.shift === g.shift) : g);
function roundOf(g) {
  if (!G.pr) G.pr = {};
  const lead = leadOf(g) || g, abs = world.getAbsoluteTime();
  let P = G.pr[lead.id];
  if (!P || P.next - abs > 2 * ROUND_DAY) P = G.pr[lead.id] = { on: false, next: abs + 1200 + (g.post === 'patrol_keep' ? 1800 : 0) };
  return { P, lead };
}
function patrolSpot(g) {
  const r = routeOf(g), { P, lead } = roundOf(g);
  if (!P.on) return r[g.slot ? r.length - 2 : 0];
  let i = G.ri[lead.id] || 0;
  if (g.slot && lead !== g) i = (i - 3 + r.length) % r.length;
  return r[i % r.length];
}
function patrolStep(g, e, dt, scan) {
  const r = routeOf(g), { P, lead } = roundOf(g), abs = world.getAbsoluteTime(), here = e.location;
  const at = patrolSpot(g), d = Math.hypot(here.x - at.x - 0.5, here.z - at.z - 0.5);
  if (!P.on || lead !== g && !(entOf(lead.id) && G.st[lead.id] === 'duty')) {
    // на месте: ждёт своего часа
    if (d > 1.5 || Math.abs(here.y - at.y) > 1.5) { if (scan) goTo(g.id, e, at); return; }
    if (lead === g && abs >= P.next) { P.on = true; G.ri[g.id] = 0; G.pt = G.pt || {}; G.pt[g.id] = 0; gsave(); }
    return;
  }
  if (d > 3) { if (scan) goTo(g.id, e, at); return; }
  if (lead !== g) { // второй — за первым
    if (d > 0.8) walk(g.id, line(fl(here), at), null, 0.15);
    return;
  }
  const i = G.ri[g.id] || 0, nx = r[(i + 1) % r.length];
  G.pt = G.pt || {}; G.pt[g.id] = (G.pt[g.id] || 0) + 0.1 * dt;
  if (G.pt[g.id] >= 1) {
    G.pt[g.id] = 0; G.ri[g.id] = (i + 1) % r.length;
    if (G.ri[g.id] === 0) { P.on = false; P.next = abs + (isNight() ? ROUND_NIGHT : ROUND_DAY); } // круг пройден
    gsave();
  }
  const t = G.pt[g.id];
  door(nx, true);
  if (nearPlayer(here, 48) || system.currentTick % 10 === 0) try { e.teleport({ x: at.x + (nx.x - at.x) * t + 0.5, y: at.y + (nx.y - at.y) * t, z: at.z + (nx.z - at.z) * t + 0.5 }, { rotation: { x: 0, y: (yaws[g.id] = nx.x !== at.x || nx.z !== at.z ? yawOf(at, nx) : yaws[g.id] || 0) } }); } catch (err) { /* нет */ }
}

// ---------- Ворота: решётка по распорядку ----------
// Распорядок — с конца «Ночи у ворот» (этап 0). В ночь боя у ворот (этап 0, осада) решётка поднята.
const EVENING = 12000, MORNING = 23300;
const closing = () => { const t = world.getTimeOfDay(); return t >= EVENING && t < MORNING; };
const battleAtGate = () => S.q.s0_night !== 'done' || S.q.s8_siege === 'active' || !!S.f.wave || !!S.f.siege;
let passAt = 0, passSaid = 0;
function callOut(ids, text) {
  const id = ids.find((q) => entOf(q)) || ids[0], e = entOf(id), gate = Wc(CASTLE.gate);
  const n = NPCS[id] ? NPCS[id].name : id;
  for (const pl of players()) if (Math.hypot(pl.location.x - (e ? e.location.x : gate.x), pl.location.z - (e ? e.location.z : gate.z)) < 40) pl.sendMessage(`§e${n}:§r ${text}`);
}
const gateGuards = (shift) => ROSTER().filter((g) => g.post.startsWith('gate_') && (!shift || g.shift === shift) && recruited(g.id)).map((g) => g.id);
function gateSchedule() {
  if (!CASTLE.portcullis) return;
  const want = battleAtGate() ? 'hold' : closing() ? 'night' : 'day';
  if (G.sched !== want) {
    const was = G.sched; G.sched = want; gsave(); clearManual();
    if (want === 'night') { toggleGate(true, true); callOut(gateGuards('day'), 'Солнце садится — опускаем решётку. До утра ворота на запоре. Надо войти или выйти — подойди к решётке, откроем.'); }
    else if (gateClosed()) { toggleGate(false, true); if (was === 'night') callOut(gateGuards('night'), 'Рассвело! Поднимаем решётку. Смена, по местам!'); }
    return;
  }
  if (want !== 'night' || gateManual() || gateMoving()) return;
  // ночью: игрок у решётки (с любой стороны) — поднять, ушёл — опустить
  const now = system.currentTick, o = S.origin;
  const at = players().some((pl) => { const x = pl.location.x - o[0], y = pl.location.y - o[1], z = pl.location.z - o[2]; return x >= 58 && x < 69 && z >= 124 && z < 136 && y > -3 && y < 4; });
  if (at) {
    passAt = now;
    if (gateClosed()) { toggleGate(false, true); if (now - passSaid > 1200) { passSaid = now; callOut(gateGuards('night'), 'Свои! Поднимаем решётку.'); } }
  } else if (!gateClosed() && now - passAt > 80) toggleGate(true, true);
}

// ---------- Каждый тик: шаги, обходы, возврат на пост ----------
let lastMove = 0, lastScan = 0;
export function garrisonMove() {
  if (!S || !S.origin || !G || !CASTLE.garrison) return;
  const now = system.currentTick;
  // сколько тиков прошло (в игре — 1; если игра пропустила тики — догоняем)
  const dt = Math.max(1, Math.min(20, now - (lastMove || now))); lastMove = now;
  const scan = now - lastScan >= 10; if (scan) { lastScan = now; closeDoors(); }
  if (now % 20 === 0 || !intr.length && scan) scanIntruders();
  budget = 240; // узлов поиска пути на всех за тик
  for (const g of ROSTER()) {
    const e = entOf(g.id);
    if (!e) continue;
    if (g.archer || g.post.startsWith('arch')) continue; // лучник стоит и стреляет сам
    // бой: нарушитель рядом — стражник дерётся сам (скрипт не мешает), потом возвращается
    if (scan) {
      if (foeFor(g, e)) { busy[g.id] = now; if (mode[g.id] !== 'alert') { delete movers[g.id]; delete seek[g.id]; setMode(g.id, e, 'alert', g); } }
      else if (mode[g.id] !== 'calm' && now - (busy[g.id] || 0) > 40) setMode(g.id, e, 'calm', g);
    }
    if (mode[g.id] === 'alert') continue;
    if (moveTick(g.id, dt)) continue;
    if (G.st[g.id] === 'toBed' && managed(g.id)) {
      // к койке: сначала по найденному пути до начала дороги, потом по дороге в казарму
      const back = pts(GR().paths[g.id] || []).reverse();
      if (!back.length) { despawn(g.id); G.st[g.id] = 'rest'; gsave(); continue; }
      const h = e.location, bedP = back[back.length - 1];
      // уже у своей койки (смена кончилась раньше, чем он ушёл на пост) — ложится сразу
      if (Math.hypot(h.x - bedP.x - 0.5, h.z - bedP.z - 0.5) < 1.6 && Math.abs(h.y - bedP.y) < 1.5) { despawn(g.id); G.st[g.id] = 'rest'; gsave(); continue; }
      // стоит где-то на своей дороге (смена кончилась на полпути) — возвращается по ней же, без поиска пути
      let ki = -1, kd = 1.6;
      for (let k = 0; k < back.length; k++) { const d = Math.hypot(h.x - back[k].x - 0.5, h.z - back[k].z - 0.5); if (d < kd && Math.abs(h.y - back[k].y) < 1.5) { kd = d; ki = k; } }
      if (ki >= 0) walk(g.id, back.slice(ki), () => { despawn(g.id); G.st[g.id] = 'rest'; gsave(); });
      else if (scan || seek[g.id]) goTo(g.id, e, back[0]);
      continue;
    }
    if (G.st[g.id] !== 'duty' || !managed(g.id)) continue;
    if (isPatrol(g)) { patrolStep(g, e, dt, scan); continue; }
    if (!scan && !seek[g.id]) continue;
    const at = postAt(g), here = e.location;
    const d = Math.hypot(here.x - at.x - 0.5, here.z - at.z - 0.5);
    if (d > 1.2 || Math.abs(here.y - at.y) > 1.5) { goTo(g.id, e, at); continue; }
    // стоит на посту: смотрит прямо, туда, куда пришёл (у ворот — в поле); рядом игрок — пусть глядит на него
    if (scan && !nearPlayer(here, 6)) {
      const want = g.post.startsWith('gate_') && !(gateNight() && g.shift === 'night') ? 0 : (yaws[g.id] || 0);
      try { const r = e.getRotation(); if (Math.abs(r.x) > 10 || Math.abs(((r.y - want + 540) % 360) - 180) > 15) e.setRotation({ x: 0, y: want }); } catch (err) { /* нет */ }
    }
  }
}

// ---------- Разговор: карточка службы ----------
const RANK_RU = { десятник: 'десятник', гридень: 'гридень, личная стража короля', стражник: 'стражник', лучник: 'лучник', дозорный: 'дозорный' };
const ITEM_RU = (it) => (it || '').replace('minecraft:', '').replace(/^iron_/, 'железн. ').replace(/^diamond_/, 'алмазн. ').replace('helmet', 'шлем').replace('chestplate', 'нагрудник').replace('leggings', 'поножи').replace('boots', 'сапоги').replace('sword', 'меч');
export function gearText(id) { const g = gearOf(id); const list = ['head', 'chest', 'legs', 'feet', 'hand'].filter((k) => g[k]).map((k) => ITEM_RU(g[k])); return list.length ? list.join(', ') : 'своё (без брони)'; }
export function card(id) {
  if (!G) gload();
  const g = byId(id);
  if (!g) return '';
  const st = G.st[id] || 'rest';
  const P = isPatrol(g) && G.pr ? G.pr[(leadOf(g) || g).id] : null;
  const now = { duty: isPatrol(g) ? (P && P.on ? 'на обходе' : `ждёт обхода (через ${P ? Math.max(0, Math.round((P.next - world.getAbsoluteTime()) / 1200)) : '?'} мин)`) : gateNight() && g.shift === 'night' && GR().posts[g.post + '_night'] ? 'в караулке надвратной башни' : 'на посту', toPost: 'идёт на пост', toBed: 'идёт спать', rest: 'спит в казарме' }[st];
  return [`§l${g.name}§r, ${RANK_RU[g.rank]}.`, `§7Пост:§r ${POST_TITLE[g.post]}${isPatrol(g) ? ' (' + GR().routes[g.post].title + ')' : ''}.`,
    `§7Смена:§r ${g.shift ? (g.shift === 'day' ? 'дневная' : 'ночная') + (g.bed !== undefined ? `, койка №${g.bed + 1} в казарме` : '') : 'без смены, живёт у своего поста'}. §7Сейчас:§r ${now}.`,
    `§7Снаряжение:§r ${gearText(id)}.`].join('\n');
}
// Узел разговора стражника: своя история (заготовка) или карточка службы
export function guardNode(id, node) {
  if (!GARRISON_IDS.has(id) || !S || !S.origin) return node;
  const story = GUARD_STORIES[id];
  const c = card(id);
  const own = story && story.talk ? story.talk(null, null, c) : null;
  if (own) return own;
  const cardNode = { text: c + (story ? `\n\n§7Своя история: «${story.title}» — скоро.§r` : ''), options: [{ text: 'Служи' }] };
  if (!node || node.text === '…') return cardNode;
  return { ...node, options: [...(node.options || []), { text: 'Как служба?', next: cardNode }] };
}

// ---------- Капитан: окно гарнизона ----------
export async function garrisonMenu(pl) {
  if (!G) gload();
  const lines = [];
  for (const [key, list] of Object.entries(slots())) {
    const g0 = list[0];
    lines.push(`§7${POST_TITLE[g0.post]}:§r ` + list.map((g) => `${g.name.split(' ').pop()}${g.shift ? (g.shift === 'day' ? ' (д)' : ' (н)') : ''} — ${recruited(g.id) ? { duty: 'служит', toPost: 'идёт на пост', toBed: 'идёт спать', rest: 'спит' }[G.st[g.id] || 'rest'] : G.want[g.id] ? 'ждёт меч' : 'нет'}`).join('; '));
  }
  const free = ROSTER().filter((g) => !recruited(g.id) && !G.want[g.id] && g.from !== 'story');
  const f = new ActionFormData().title('Гарнизон').body(`Сейчас ${isNight() ? 'ночь — стоит ночная смена' : 'день — стоит дневная смена'}. Набрано ${ROSTER().filter((g) => recruited(g.id)).length} из ${ROSTER().length}.\n` +
    'Новобранцу нужен меч — его скуёт кузнец Гордей, наутро человек на посту.\n\n' + lines.join('\n'));
  const btn = [];
  for (const g of free.slice(0, 8)) btn.push([`${needsMet(g) ? '§2' : '§8'}Набрать: ${g.name}§r\n${POST_TITLE[g.post]}${g.shift ? (g.shift === 'day' ? ', днём' : ', ночью') : ''}${needsMet(g) ? '' : ' — когда ' + (NEEDS_TEXT[g.needs.split(':')[0]] || g.needs)}`, g]);
  btn.push(['Пока', null]);
  for (const [t] of btn) f.button(t);
  const r = await show(pl, f);
  if (r.canceled || !btn[r.selection][1]) return;
  const g = btn[r.selection][1];
  if (!needsMet(g)) { pl.sendMessage(`§eКапитан Демьян:§r Рано. Сперва чтоб ${NEEDS_TEXT[g.needs.split(':')[0]] || g.needs}.`); return; }
  G.want[g.id] = 'sword'; gsave(); gflush();
  pl.sendMessage(`§eКапитан Демьян:§r ${g.name.split(' ').pop()} придёт, как будет меч. Скажу Гордею — скуёт.`);
}
if (HOOKS) HOOKS.garrisonMenu = (pl) => system.runTimeout(() => garrisonMenu(pl).catch((e) => report('окно', e)), 2);

// ---------- Команды ----------
export function guardCommand(msg, src) {
  if (!G) gload();
  const [cmd, arg] = (msg || '').trim().split(/\s+/);
  const out = [];
  if (!S || !S.origin) out.push('Замок ещё не поставлен.');
  else if (!cmd || cmd === 'status') {
    out.push(`§7Ворота: ${gateClosed() ? 'решётка опущена' : 'решётка поднята'}${G.sched === 'hold' ? ' (бой у ворот — открыто)' : G.sched === 'night' ? ' (ночь, караул в башнях)' : ''}${gateManual() ? ', рычаг повернул игрок' : ''}. Нарушителей у замка: ${intr.length}.`);
    out.push(`§6[Гарнизон]§r ${isNight() ? 'ночь' : 'день'}, набрано ${ROSTER().filter((g) => recruited(g.id)).length} из ${ROSTER().length}`);
    for (const g of ROSTER()) if (recruited(g.id) || G.want[g.id]) { const e = entOf(g.id); out.push(`${g.name}: ${G.want[g.id] && !recruited(g.id) ? 'ждёт меч' : (G.st[g.id] || 'rest')}${mode[g.id] === 'alert' ? ', в бою' : ''}${e ? ' (' + [e.location.x, e.location.y, e.location.z].map(Math.floor).join(' ') + ')' : ''}${movers[g.id] ? ', идёт' : ''}; ${gearText(g.id)}`); }
  } else if (cmd === 'all') { for (const g of ROSTER()) if (!recruited(g.id)) { S.npcs[g.id] = 'post'; G.st[g.id] = 'rest'; } save(); gsave(); out.push('Весь гарнизон набран (для проверки).'); }
  else if (cmd === 'dismiss') { const g = byId(arg); if (!g) out.push('Нет такого стражника.'); else { S.npcs[arg] = null; delete G.st[arg]; save(); gsave(); const e = entOf(arg); if (e) try { e.triggerEvent('acastle:despawn'); } catch (err) { /* нет */ } out.push('Отпущен: ' + g.name + ' (набрать снова — у капитана).'); } }
  else if (cmd === 'day') { runCmd('time set 1000'); out.push('Утро: дневная смена.'); }
  else if (cmd === 'night') { runCmd('time set 13000'); out.push('Ночь: ночная смена.'); }
  else if (cmd === 'tp') { const e = entOf(arg); if (e && src) { src.teleport(e.location); out.push('Перенёс к ' + byId(arg).name); } else out.push('Стражника не видно.'); }
  else out.push('Команды: status | all | dismiss <id> | day | night | tp <id>');
  gflush();
  const text = out.join('\n');
  if (src && src.sendMessage) src.sendMessage(text); else world.sendMessage(text);
}
