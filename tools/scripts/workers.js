// Работники замка (новое ядро, docs/workers.md): рудокоп Кондрат и зодчий Мирон.
//  • Они настоящие: Кондрат ломает блоки мира и складывает добычу в сундуки у копра, Мирон
//    берёт материалы со склада и кладёт блоки по одному. Ничего не берётся из воздуха —
//    счёт (ledger) это проверяет.
//  • Ходят их ноги не сами: скрипт переносит работника маленькими шагами каждый тик (так игра
//    показывает и анимацию ходьбы — приём из вики Bedrock, «Entity Movement»). Путь Кондрата —
//    его же лесенка и штреки; путь Мирона ищет A* по блокам мира (work_core.js).
//  • Работают, только пока участок мира прогружен. Чтобы шахта и стройка шли, пока игрок
//    в другом конце замка, участок держится «тикающим» (tickingarea), это можно выключить.
//  • Состояние — отдельная запись в памяти мира (acastle:work), каждый шаг сохраняется.
// Команды: /scriptevent acastle:work help
import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { S, save, DIM, players, runCmd } from './state.js';
import { CASTLE } from './castle_data.js';
import { WORK } from './work_data.js';
import { show, guarded, storyNode, runOption } from './talk.js';
import { byRank, gearOf, equip, wanted, recruitArrive } from './garrison.js';
import * as C from './work_core.js';

const KEY = 'acastle:work';
const WORKERS = {
  kondrat: { name: 'Рудокоп Кондрат', tool: 'minecraft:stone_pickaxe' },
  miron: { name: 'Зодчий Мирон', tool: 'minecraft:iron_axe' },
  // с 0.9.3: кузня. Они же — жители сюжета (метка acastle_npc_<id>: их разговоры этапа 2 и дальше
  // встают кнопками в окно кузни)
  gordey: { name: 'Кузнец Гордей', tool: 'minecraft:mace', story: true },
  vaska: { name: 'Подмастерье Васька', tool: 'air', story: true },
};
export const workerTag = (id) => 'acastle_wk_' + id;
export function workerIdOf(e) {
  try { for (const t of e.getTags()) if (t.startsWith('acastle_wk_')) return t.slice(11); } catch (err) { /* пропал */ }
  return null;
}

// ---------- Состояние ----------
export let WS = null;
let wdirty = false;
function wfresh(origin) {
  return {
    v: 1, origin, fast: 1, label: false, keep: true,
    // phase: shaft (ствол) → gallery (рудничный двор) → drift (коридор n из 4) ↔ branch (ветка) → hdone (горизонт выработан) → done
    mine: { on: false, st: 'idle', msg: 'Ждёт кирку в бочке у копра', i: 0, h: 0, open: 1, phase: 'shaft', g: 0, n: 0, d: 0, dj: 0, side: 1, b: 0, back: null,
      bag: {}, tool: null, uses: 0, torch: 0, rails: 0, layRails: false, railShaft: 0, veins: [], skip: {}, pos: null, dug: 0, blocked: null },
    build: { st: 'idle', msg: 'Ждёт заказа', order: null, done: {}, cart: {}, scaff: [], pos: null, placed: 0, removed: 0, need: null },
    // кузнец: очередь заказов q, текущая работа job (prog — сколько тиков сделано)
    smith: { st: 'idle', msg: 'Ждёт заказа', q: [], job: null, prog: 0, pos: null, made: {}, smelted: {}, used: {} },
    // подмастерье: что несёт (bag), сколько ходок
    app: { st: 'forge', msg: 'В кузне', bag: {}, trips: 0, pos: null, moved: {} },
    led: { mined: {}, dep: {}, used: {}, given: {} },
    bled: { took: {}, placed: {}, back: {}, reclaimed: {} },
    errs: [],
  };
}
function wload() {
  try { WS = JSON.parse(world.getDynamicProperty(KEY) || 'null'); } catch (e) { WS = null; }
  if (!WS || WS.v !== 1) WS = wfresh(null);
  const f = wfresh(WS.origin); for (const k of ['smith', 'app']) if (!WS[k]) WS[k] = f[k]; // сохранение до 0.9.3
}
const wsave = () => { wdirty = true; };
function wflush() { if (wdirty && WS) { world.setDynamicProperty(KEY, JSON.stringify(WS)); wdirty = false; } }
const add = (m, k, n) => { m[k] = (m[k] || 0) + n; if (!m[k]) delete m[k]; };
const total = (m) => Object.values(m).reduce((a, b) => a + b, 0);

// ---------- Мир ----------
const Wc = (c) => ({ x: S.origin[0] + c[0], y: S.origin[1] + c[1], z: S.origin[2] + c[2] }); // замок → мир
const toC = (p) => [p.x - S.origin[0], p.y - S.origin[1], p.z - S.origin[2]]; // мир → замок
const V = (a) => ({ x: a[0], y: a[1], z: a[2] });
const A = (v) => [v.x, v.y, v.z];
const keyOf = (p) => p[0] + ',' + p[1] + ',' + p[2];
function blk(p) { try { return DIM().getBlock(Array.isArray(p) ? V(p) : p); } catch (e) { return undefined; } }
const idAt = (p) => { const b = blk(p); return b ? b.typeId : null; };
const PASS = /(^|:)(air|cave_air|short_grass|tall_grass|fern|large_fern|poppy|dandelion|cornflower|allium|azure_bluet|oxeye_daisy|lily_of_the_valley|.*tulip|blue_orchid|deadbush|sweet_berry_bush|torch|wall_torch|rail|golden_rail|.*carpet|snow_layer|vine|.*sapling|.*button|lever|.*_sign|.*pressure_plate|light_block.*|brown_mushroom|red_mushroom)$/;
const passable = (p) => { const id = idAt(p); return id !== null && PASS.test(id); };
const solidAt = (p) => { const id = idAt(p); return id !== null && !PASS.test(id) && !C.LIQUID.test(id); };
function standable(x, y, z) { return solidAt([x, y - 1, z]) && passable([x, y, z]) && passable([x, y + 1, z]); }
standable.headroom = (x, y, z) => passable([x, y, z]) || /scaffolding|ladder/.test(idAt([x, y, z]) || '');
standable.climb = (x, y, z) => /scaffolding|ladder/.test(idAt([x, y, z]) || '') && (passable([x, y + 1, z]) || /scaffolding|ladder/.test(idAt([x, y + 1, z]) || ''));
const near = (p, r) => players().some((pl) => Math.abs(pl.location.x - p[0]) < r && Math.abs(pl.location.z - p[2]) < r);
let tickMs = 50, lastNow = Date.now();
function sound(id, p) { try { DIM().playSound(id, { x: p[0] + 0.5, y: p[1] + 0.5, z: p[2] + 0.5 }, { volume: 0.7 }); } catch (e) { /* ничего */ } }
let errAt = 0;
function report(who, what, e) {
  const msg = `${who}: ${what}${e ? ' — ' + e : ''}`;
  WS.errs.unshift(msg); WS.errs.length = Math.min(WS.errs.length, 6); wsave();
  console.warn('acastle работники: ' + msg + (e && e.stack ? '\n' + e.stack : ''));
  if (system.currentTick - errAt > 1200) { errAt = system.currentTick; world.sendMessage('§c[Замок] ' + msg + ' (подробно: /scriptevent acastle:work status)'); }
}
const say = (id, text) => { for (const pl of players()) pl.sendMessage(`§e${WORKERS[id].name}:§r ${text}`); };
const speed = () => Math.max(1, WS.fast || 1);

// Контейнер: положить предметы (сначала дополняем начатые стопки), вернуть, сколько не влезло
function putItems(inv, id, n) {
  const max = (() => { try { return new ItemStack(id, 1).maxAmount || 64; } catch (e) { return 64; } })();
  for (let i = 0; i < inv.size && n > 0; i++) {
    const it = inv.getItem(i);
    if (!it || it.typeId !== id || it.amount >= max) continue;
    const t = Math.min(n, max - it.amount); it.amount += t; inv.setItem(i, it); n -= t;
  }
  for (let i = 0; i < inv.size && n > 0; i++) {
    if (inv.getItem(i)) continue;
    const t = Math.min(n, max); inv.setItem(i, new ItemStack(id, t)); n -= t;
  }
  return n;
}
function countIn(inv, test) { const out = {}; for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && test(it.typeId)) add(out, it.typeId, it.amount); } return out; }
function takeOut(inv, id, n) {
  for (let i = 0; i < inv.size && n > 0; i++) {
    const it = inv.getItem(i);
    if (!it || it.typeId !== id) continue;
    const t = Math.min(n, it.amount);
    if (it.amount === t) inv.setItem(i); else { it.amount -= t; inv.setItem(i, it); }
    n -= t;
  }
  return n;
}
// Сундуки (или бочка) в точках замка; двойной сундук — один контейнер
function containers(list, type = 'minecraft:chest') {
  const out = [];
  for (const c of list) {
    const b = blk(Wc(c));
    if (!b) return null;
    if (b.typeId !== type) { try { b.setType(type); } catch (e) { return null; } }
    const inv = b.getComponent('minecraft:inventory');
    if (inv && inv.container && !out.some((o) => o.size === inv.container.size && inv.container.size > 27)) out.push(inv.container);
    if (inv && inv.container && inv.container.size > 27) break; // двойной: вторая половина — тот же сундук
  }
  return out;
}

// ---------- Существа ----------
const ents = {};
function entOf(id) {
  const e = ents[id];
  if (e) { try { if (e.isValid) return e; } catch (err) { /* нет */ } }
  ents[id] = undefined;
  return undefined;
}
const ST = (id) => (id === 'kondrat' ? WS.mine : id === 'miron' ? WS.build : id === 'gordey' ? WS.smith : WS.app);
const posOf = (id) => ST(id).pos;
const homeOf = (id) => (id === 'kondrat' ? CASTLE.works.mine.home : id === 'miron' ? CASTLE.works.yard.home : id === 'gordey' ? CASTLE.works.forge.anvilStand : CASTLE.works.forge.apprentice);
function ensureWorkers() {
  let all = [];
  try { all = DIM().getEntities({ type: 'acastle:worker' }); } catch (e) { all = []; }
  const seen = {};
  for (const e of all) {
    const id = workerIdOf(e);
    if (!id || !WORKERS[id] || seen[id]) { try { e.triggerEvent('acastle:despawn'); } catch (err) { /* нет */ } continue; }
    seen[id] = e; ents[id] = e;
  }
  for (const id of Object.keys(WORKERS)) {
    if (seen[id]) continue;
    const p = posOf(id) || A(Wc(homeOf(id)));
    if (!blk(p)) continue; // место не прогружено — позже
    try {
      const e = DIM().spawnEntity('acastle:worker', { x: p[0] + 0.5, y: p[1], z: p[2] + 0.5 }, { spawnEvent: 'acastle:as_' + id, initialPersistence: true });
      e.addTag(workerTag(id)); if (WORKERS[id].story) e.addTag('acastle_npc_' + id); e.nameTag = WORKERS[id].name; ents[id] = e;
      ST(id).pos = p;
      hold(id, id === 'kondrat' ? (WS.mine.tool ? `minecraft:${WS.mine.tool}_pickaxe` : 'air') : WORKERS[id].tool, true);
      wsave();
    } catch (err) { report(WORKERS[id].name, 'не получается поставить', err); }
  }
}
const held = {};
function hold(id, item, force) {
  if (!force && held[id] === item) return;
  held[id] = item;
  runCmd(`replaceitem entity @e[type=acastle:worker,tag=${workerTag(id)}] slot.weapon.mainhand 0 ${item}`);
}
const acts = {};
function act(id, n) {
  if (acts[id] === n) return;
  const e = entOf(id); if (!e) return;
  try { e.setProperty('acastle:act', n); acts[id] = n; } catch (err) { /* ещё не готов */ }
}
function place(id, p, face) {
  const e = entOf(id); if (!e) return;
  const opts = face ? { facingLocation: { x: face[0] + 0.5, y: face[1] + 0.5, z: face[2] + 0.5 } } : undefined;
  try { e.teleport({ x: p[0] + 0.5, y: p[1], z: p[2] + 0.5 }, opts); } catch (err) { /* не прогружен */ }
}

// ---------- Ходьба ----------
// Путь — список клеток (ноги). Скорость — блоков за тик. Пока идёт — act 1 (3 — в вагонетке).
const movers = {};
function walk(id, path, done, { speedBpt = 0.2, ride = false } = {}) {
  if (!path || path.length < 2) { if (path && path.length) setPos(id, path[path.length - 1]); done(); return; }
  movers[id] = { path, i: 0, t: 0, v: speedBpt, done, ride, cart: null };
  ST(id).walking = true;
}
function setPos(id, p) { ST(id).pos = p; wsave(); }
function moveTick(id, dt) {
  const m = movers[id];
  if (!m) return false;
  const e = entOf(id);
  if (!e) return true; // ждём, пока существо появится
  m.t += m.v * dt * Math.min(speed(), 4);
  while (m.t >= 1 && m.i < m.path.length - 1) { m.t -= 1; m.i++; }
  const last = m.i >= m.path.length - 1;
  const a = m.path[Math.min(m.i, m.path.length - 1)], b = m.path[Math.min(m.i + 1, m.path.length - 1)];
  const t = last ? 0 : m.t;
  const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  act(id, m.ride ? 3 : 1);
  if (m.ride && !m.cart) { try { m.cart = DIM().spawnEntity('minecraft:minecart', { x: p[0] + 0.5, y: p[1], z: p[2] + 0.5 }); } catch (err) { m.cart = null; } }
  // далеко от игроков — переносим реже (дешевле для игры)
  if (last || near(p, 48) || system.currentTick % 10 === 0) {
    place(id, m.ride ? [p[0], p[1] + 0.35, p[2]] : p, b);
    if (m.cart) try { m.cart.teleport({ x: p[0] + 0.5, y: p[1], z: p[2] + 0.5 }); } catch (err) { /* нет */ }
  }
  if (last) {
    if (m.cart) try { m.cart.remove(); } catch (err) { /* нет */ }
    delete movers[id];
    ST(id).walking = false;
    setPos(id, a);
    act(id, 0);
    m.done();
  }
  return true;
}

// ======================= ШАХТЁР =======================
// Устройство шахты (work_core.js): винтовой ствол лесенкой → на каждом горизонте рудничный
// двор 9×9 вокруг ствола → из середины каждой стороны двора коридор → в коридоре через каждые
// 3 клетки ветки: сначала вправо, потом влево. Горизонты: угольный, железный, алмазный.
const MW = () => CASTLE.works.mine;
let HZ = null; // горизонты для этого замка
const hz = () => HZ || (HZ = C.horizons(S.origin[1]));
const DR = () => C.drifts(MW().ring);
const shaftW = (i) => A(Wc(C.shaftCell(MW().ring, i)));
const cornerW = (h) => shaftW(hz()[h].step);
const corner2 = (h) => { const c = C.shaftCell(MW().ring, hz()[h].step); return [c[0], c[2]]; };
const at2 = (h, [x, z]) => [S.origin[0] + x, cornerW(h)[1], S.origin[2] + z]; // клетка горизонта h (x, z замка)
const entryW = (h, n) => at2(h, DR()[n].entry);
const driftW = (h, n, d) => at2(h, C.driftAt(DR()[n], d));
const branchW = (h, n, d, side, b) => at2(h, C.branchAt(DR()[n], d, side, b));
let GO = null; // порядок копки двора
const gOrder = (h) => (GO && GO.h === h ? GO.list : (GO = { h, list: C.galleryOrder(MW().ring, corner2(h)) }).list);
const col = (c, n) => [...Array(n).keys()].map((k) => [c[0], c[1] + k, c[2]]);
const dedupe = (r) => r.filter((p, i) => !i || keyOf(p) !== keyOf(r[i - 1]));
// Прямой отрезок по клеткам (по коридору)
function line(a, b) {
  const out = [a.slice()], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[2] - a[2]));
  for (let k = 1; k <= n; k++) out.push([Math.round(a[0] + (b[0] - a[0]) * k / n), b[1], Math.round(a[2] + (b[2] - a[2]) * k / n)]);
  return dedupe(out);
}
// Своя ли это клетка хода (её не заделываем как пещеру)
function planned(p) {
  const M = WS.mine, ring = MW().ring, c = toC(V(p));
  if (c[0] >= ring[0] && c[0] <= ring[2] && c[2] >= ring[1] && c[2] <= ring[3]) {
    if (c[1] >= 0) return true;
    const P = C.ringCells(ring);
    const k = P.findIndex(([x, z]) => x === c[0] && z === c[2]);
    if (k < 0) return false; // столб
    for (let j = k; j <= M.i + 16; j += P.length) { const L = C.shaftLevel(j); if (c[1] >= L && c[1] <= L + 2) return true; if (L < c[1] - 3) break; }
    return false;
  }
  for (let h = 0; h < hz().length; h++) {
    const dy = p[1] - cornerW(h)[1];
    if (dy < 0 || dy > 2) continue;
    if (C.inGallery(ring, c[0], c[2])) return true;
    if (dy > 1) continue;
    for (const dr of DR()) {
      const rx = c[0] - dr.entry[0], rz = c[2] - dr.entry[1], r = C.rightOf(dr.v);
      const along = rx * dr.v[0] + rz * dr.v[1] - 1, perp = rx * r[0] + rz * r[1];
      if (along < 0 || along >= C.DRIFT) continue;
      if (perp === 0 || (C.hasBranch(along) && Math.abs(perp) <= C.BRANCH)) return true;
    }
  }
  return M.veins.includes(keyOf(p));
}
// Можно ли тут копать: не замок и не его подземелья
function allowed(p) {
  const c = toC(V(p)), ring = MW().ring;
  const inRing = c[0] >= ring[0] && c[0] <= ring[2] && c[2] >= ring[1] && c[2] <= ring[3];
  if (c[1] > -2 && !inRing) return false;
  const pr = CASTLE.protect[(c[0] >> 3) + ',' + (c[2] >> 3)];
  if (pr && c[1] >= pr[0] - 3 && c[1] <= pr[1] + 3) return false;
  return true;
}
// Маршрут от копра к забою (клетки, где стоят ноги); r.nShaft — сколько в начале клеток до низа ствола
function route() {
  const M = WS.mine, r = [A(Wc(MW().home)), A(Wc([MW().ring[0], 0, MW().ring[1] - 1]))], H = hz()[M.h];
  const shaftEnd = M.phase === 'shaft' || !H ? M.i : H.step;
  for (let j = 0; j <= shaftEnd; j++) r.push(shaftW(j));
  const nShaft = r.length;
  if (H && (M.phase === 'drift' || M.phase === 'branch') && M.n < 4) {
    const co = corner2(M.h);
    const gp = C.galleryPath(co, DR()[M.n].entry, (x, z) => C.inGallery(MW().ring, x, z));
    if (gp) for (const c of gp.slice(1)) r.push(at2(M.h, c));
    const dEnd = M.phase === 'branch' ? M.dj : M.d - 1;
    for (let d = 0; d <= dEnd; d++) r.push(driftW(M.h, M.n, d));
    if (M.phase === 'branch') for (let b = 0; b < M.b; b++) r.push(branchW(M.h, M.n, M.dj, M.side, b));
  }
  r.nShaft = nShaft;
  return r;
}
const railedTo = (M) => (M.phase === 'shaft' ? M.railShaft >= M.i : M.railShaft >= (hz()[M.h] ? hz()[M.h].step : 0));
// Что копать дальше: клетки, откуда (from) и куда потом встать (at)
function nextFace() {
  const M = WS.mine, H = hz()[M.h];
  if (!H) return null;
  if (M.phase === 'shaft') {
    if (M.i >= H.step) { M.phase = 'gallery'; M.g = 0; wsave(); say('kondrat', `Дошёл до горизонта «${H.title}» (y ${H.y}). Рублю рудничный двор.`); return nextFace(); }
    const c = shaftW(M.i + 1);
    return { cells: col(c, 3), from: shaftW(M.i), at: c, kind: 'shaft' };
  }
  if (M.phase === 'gallery') {
    const list = gOrder(M.h);
    if (M.g >= list.length) { galleryTorches(); M.phase = 'drift'; M.n = 0; M.d = 0; wsave(); return nextFace(); }
    const { c, from } = list[M.g];
    return { cells: col(at2(M.h, c), 3), from: at2(M.h, from), at: at2(M.h, c), kind: 'gallery' };
  }
  if (M.phase === 'drift') {
    if (M.n >= 4) { M.phase = 'hdone'; wsave(); return null; }
    if (M.d >= C.DRIFT) { driftEnd(null); return null; }
    const c = driftW(M.h, M.n, M.d);
    return { cells: col(c, 2), from: M.d ? driftW(M.h, M.n, M.d - 1) : entryW(M.h, M.n), at: c, kind: 'drift' };
  }
  if (M.phase === 'branch') {
    const c = branchW(M.h, M.n, M.dj, M.side, M.b);
    return { cells: col(c, 2), from: M.b ? branchW(M.h, M.n, M.dj, M.side, M.b - 1) : driftW(M.h, M.n, M.dj), at: c, kind: 'branch' };
  }
  return null;
}
function galleryTorches() {
  const M = WS.mine, [a, b, c, d] = C.galleryBox(MW().ring);
  for (const [x, z, w] of [[a, b, 'west'], [c, b, 'east'], [a, d, 'west'], [c, d, 'east']]) { const p = at2(M.h, [x, z]); torchAt([p[0], p[1] + 1, p[2]], w); }
}
// Ветка кончилась (длина или упёрлась): сначала правая, потом левая, потом — дальше по коридору
function branchEnd(blockedBy) {
  const M = WS.mine;
  if (blockedBy) M.msg = 'Ветка упёрлась: ' + blockedBy;
  if (M.side === 1) { M.side = -1; M.b = 0; } else M.phase = 'drift';
  M.back = 'junction'; M.st = 'back'; wsave();
}
// Коридор кончился: назад во двор и к следующему коридору
function driftEnd(blockedBy) {
  const M = WS.mine;
  if (blockedBy) say('kondrat', `Коридор ${M.n + 1} упёрся: ${blockedBy}. Иду в следующий.`);
  M.phase = 'drift'; M.back = 'entry'; M.st = 'back'; wsave();
}
// Ход упёрся (чужое, граница): что дальше
function faceDone(blockedBy) {
  const M = WS.mine;
  if (M.phase === 'shaft') {
    M.blocked = blockedBy || 'ствол дальше не идёт'; M.st = 'idle'; M.msg = 'Ствол упёрся: ' + M.blocked; say('kondrat', 'Ствол дальше не идёт: ' + M.blocked + '. Глянь сам.');
  } else if (M.phase === 'gallery') { if (blockedBy) M.msg = 'Двор: ' + blockedBy; M.g++; }
  else if (M.phase === 'branch') branchEnd(blockedBy);
  else if (M.phase === 'drift') driftEnd(blockedBy);
  wsave();
}
function goBack() {
  const M = WS.mine;
  M.st = 'work';
  let path;
  if (M.back === 'junction') path = line(M.pos, driftW(M.h, M.n, M.dj));
  else {
    path = line(M.pos, entryW(M.h, M.n));
    M.n++; M.d = 0;
    if (M.n < 4) { const gp = C.galleryPath(DR()[M.n - 1].entry, DR()[M.n].entry, (x, z) => C.inGallery(MW().ring, x, z)); if (gp) for (const c of gp.slice(1)) path.push(at2(M.h, c)); }
    else M.phase = 'hdone';
  }
  M.back = null; wsave();
  walk('kondrat', dedupe(path), () => {});
}
// Пройти по двору горизонта (по уже вынутым клеткам)
function localWalk(to) {
  const M = WS.mine, h = M.h, co = corner2(h), list = gOrder(h);
  const dug = new Set([co.join()]);
  const lim = M.phase === 'gallery' ? M.g : list.length;
  for (let k = 0; k < lim; k++) dug.add(list[k].c.join());
  const a = toC(V(M.pos)), b = toC(V(to));
  const gp = C.galleryPath([a[0], a[2]], [b[0], b[2]], (x, z) => dug.has(x + ',' + z));
  if (!gp) { place('kondrat', to); setPos('kondrat', to); return; }
  walk('kondrat', gp.map((c) => at2(h, c)), () => {});
}
const onHorizon = (p) => { const H = hz()[WS.mine.h]; return p && H && p[1] === cornerW(WS.mine.h)[1]; };
function addBag(drops) { const M = WS.mine; for (const [it, n] of drops) { add(M.bag, it, n); add(WS.led.mined, it, n); } }
function useFiller() {
  const M = WS.mine;
  for (const f of C.FILLER) if ((M.bag[f] || 0) > 0) { add(M.bag, f, -1); add(WS.led.used, f, 1); return f; }
  return null;
}
const stacks = (bag) => Object.values(bag).reduce((a, n) => a + Math.ceil(n / 64), 0);
// Вынуть один блок: добыча в сумку, износ кирки. Возвращает false, если нельзя.
function breakBlock(p) {
  const M = WS.mine, b = blk(p);
  if (!b) return false;
  const id = b.typeId;
  if (C.isAirId(id)) return true;
  if (C.LIQUID.test(id)) { b.setType('minecraft:air'); return true; }
  const tier = C.TIERS[M.tool] || 0;
  const drops = C.dropOf(id, tier);
  if (C.isOre(id) && !drops.length) add(M.skip, C.oreOf(id) + ' (сломана впустую)', 1);
  addBag(drops);
  b.setType('minecraft:air');
  M.uses--; M.dug++;
  sound(/gravel|sand|dirt|grass|clay/.test(id) ? 'dig.gravel' : 'dig.stone', p);
  if (C.oreOf(id) === 'diamond' && drops.length) say('kondrat', '§bАлмаз!§r Нашёл алмазную руду.');
  return true;
}
// Перед тем как вынуть клетку: лаву и воду рядом — заложить, сыпучее над ходом — выбрать
function prepCell(p, top) {
  const out = [];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
    const n = [p[0] + dx, p[1] + dy, p[2] + dz], id = idAt(n);
    if (!id || !C.LIQUID.test(id) || planned(n) || !allowed(n)) continue;
    const f = useFiller();
    if (!f) return { stop: 'нечем заложить ' + (/lava/.test(id) ? 'лаву' : 'воду') };
    blk(n).setType(f);
    if (/lava/.test(id)) WS.mine.msg = 'Заложил лаву';
  }
  if (top) for (let y = 1; y <= 6; y++) {
    const u = [p[0], p[1] + y, p[2]], id = idAt(u);
    if (!id || !C.FALLING.test(id)) break;
    out.push(u);
  }
  return { up: out.reverse() };
}
// После: дыры в пещеру — заделать, под ногами пусто — замостить; руда в стенах — в очередь.
// У поверхности (двор) и у замка ничего не трогаем.
function afterCell(p, isFeet, isTop) {
  const ores = [];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
    if ((dy === -1 && !isFeet) || (dy === 1 && !isTop)) continue; // свой же ход
    const n = [p[0] + dx, p[1] + dy, p[2] + dz], id = idAt(n);
    if (!id || !allowed(n) || toC(V(n))[1] >= -1) continue;
    if (C.isOre(id)) { ores.push(n); continue; }
    if ((C.isAirId(id) || C.LIQUID.test(id)) && !planned(n)) {
      const f = useFiller(); if (!f) continue;
      blk(n).setType(f);
      WS.mine.sealed = (WS.mine.sealed || 0) + 1;
    }
  }
  return ores;
}
// Жила: соседние блоки той же руды, до 12 штук, не дальше 4 от хода
function vein(start, from) {
  const out = [], seen = new Set([keyOf(start)]), q = [start];
  const ore = C.oreOf(idAt(start) || '');
  while (q.length && out.length < 12) {
    const p = q.shift();
    if (Math.max(Math.abs(p[0] - from[0]), Math.abs(p[1] - from[1]), Math.abs(p[2] - from[2])) > 4) continue;
    out.push(p);
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const n = [p[0] + dx, p[1] + dy, p[2] + dz], k = keyOf(n);
      if (seen.has(k)) continue; seen.add(k);
      const id = idAt(n);
      if (id && C.oreOf(id) === ore && allowed(n) && !planned(n)) q.push(n);
    }
  }
  return out;
}
function torchAt(p, wallSide) {
  const M = WS.mine, b = blk(p);
  if (!b || !C.isAirId(b.typeId)) return;
  const [dx, dz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[wallSide];
  if (!solidAt([p[0] + dx, p[1], p[2] + dz])) return;
  if (M.torch <= 0) {
    if ((M.bag['minecraft:coal'] || 0) > 0) { add(M.bag, 'minecraft:coal', -1); add(WS.led.used, 'minecraft:coal', 1); M.torch += 4; } else return;
  }
  try { b.setPermutation(BlockPermutation.resolve('minecraft:torch', { torch_facing_direction: wallSide })); M.torch--; } catch (e) { report('Кондрат', 'факел', e); }
}
function railAt(p, dir) {
  const M = WS.mine;
  if (M.rails <= 0) return false;
  const b = blk(p);
  if (!b || !C.isAirId(b.typeId) || !solidAt([p[0], p[1] - 1, p[2]])) return false;
  try { b.setPermutation(BlockPermutation.resolve('minecraft:rail', { rail_direction: dir })); M.rails--; return true; } catch (e) { report('Кондрат', 'рельс', e); return false; }
}
// Клетка вынута: шагнуть в неё, поставить факел и рельс, сдвинуть план
function advance(face) {
  const M = WS.mine, s = face.at;
  walk('kondrat', [face.from, s], () => {}, { speedBpt: 0.25 });
  if (face.kind === 'shaft') {
    M.i++;
    const tw = C.shaftTorch(M.i); if (tw) torchAt([s[0], s[1] + 1, s[2]], tw);
    if (M.layRails && M.railShaft === M.i - 1 && railAt(s, C.shaftRail(M.i))) M.railShaft = M.i;
  } else if (face.kind === 'gallery') M.g++;
  else if (face.kind === 'drift') {
    M.d++;
    const dr = DR()[M.n];
    if ((M.d - 1) % C.TORCH_EVERY === 0 && !C.hasBranch(M.d - 1)) torchAt([s[0], s[1] + 1, s[2]], C.wallName(C.rightOf(dr.v)));
    if (C.hasBranch(M.d - 1)) { M.phase = 'branch'; M.dj = M.d - 1; M.side = 1; M.b = 0; }
  } else {
    M.b++;
    if (M.b % C.TORCH_EVERY === 0) torchAt([s[0], s[1] + 1, s[2]], C.wallName(DR()[M.n].v));
    if (M.b >= C.BRANCH) branchEnd(null);
  }
  setPos('kondrat', s);
  wsave();
}

// Работа шахтёра: один шаг за раз (таймер — в тиках игры)
const mt = { until: 0, q: null, face: null, pending: null };
function mineTick(now) {
  const M = WS.mine;
  if (!M.on) return;
  if (moveTick('kondrat', 1)) return;
  if (now < mt.until) return;
  const e = entOf('kondrat');
  if (!e) return;
  try {
    // Наверху: сдать добычу, взять кирку и рельсы
    if (M.st === 'unload' || M.st === 'tool' || !M.tool) {
      const atHome = M.pos && keyOf(M.pos) === keyOf(A(Wc(MW().home)));
      if (!atHome) return goHome();
      unloadAndRestock();
      return;
    }
    if (M.st === 'back') { goBack(); return; }
    if (M.phase === 'hdone') { M.st = 'unload'; wsave(); return; } // горизонт выработан: наверх, там решим
    if (M.phase === 'done' || M.st === 'idle') { act('kondrat', 0); return; }
    // Сумка полна или кирка кончилась — наверх
    if (stacks(M.bag) >= 22 || M.uses <= 0) { M.st = M.uses <= 0 ? 'tool' : 'unload'; M.msg = M.uses <= 0 ? 'Кирка сломалась, иду за новой' : 'Несу добычу наверх'; wsave(); return; }
    if (mt.pending) {
      const p = mt.pending; mt.pending = null;
      const top = mt.face && keyOf(p) === keyOf(mt.face.cells[mt.face.cells.length - 1]);
      const pre = prepCell(p, top);
      if (pre.stop) { mt.q = null; faceDone(pre.stop); return; }
      if (pre.up.length) { mt.q.unshift(...pre.up, p); return; } // сначала сыпучее сверху
      breakBlock(p);
      if (mt.face) {
        const isFeet = keyOf(p) === keyOf(mt.face.at);
        for (const o of afterCell(p, isFeet, top)) {
          const tier = C.TIERS[M.tool] || 0, need = { gold: 2, redstone: 2, diamond: 2, emerald: 2 }[C.oreOf(idAt(o))] || 1;
          if (tier < need) { add(M.skip, C.oreOf(idAt(o)), 1); continue; }
          for (const v of vein(o, p)) { if (!mt.q.some((x) => keyOf(x) === keyOf(v))) { mt.q.push(v); M.veins.push(keyOf(v)); } }
          if (M.veins.length > 80) M.veins.splice(0, M.veins.length - 80);
        }
      }
      wsave();
      return;
    }
    // Очередь блоков текущего шага
    if (mt.q && mt.q.length) {
      const p = mt.q.shift();
      if (!allowed(p)) { mt.q = null; faceDone('граница участка (замок рядом)'); return; }
      const id = idAt(p);
      if (id === null) { mt.q.unshift(p); mt.until = now + 20; return; } // не прогружено
      if (C.FOREIGN.test(id)) { mt.q = null; say('kondrat', `Наткнулся на чужое: ${id.replace('minecraft:', '')}. Не трогаю — глянь сам.`); faceDone('чужое: ' + id.replace('minecraft:', '')); return; }
      if (C.isAirId(id)) return;
      act('kondrat', 2);
      try { e.teleport(e.location, { facingLocation: { x: p[0] + 0.5, y: p[1] + 0.5, z: p[2] + 0.5 } }); } catch (err) { /* нет */ }
      const hard = /deepslate/.test(id) ? 1.5 : /dirt|gravel|sand|grass|clay/.test(id) ? 0.4 : C.isOre(id) ? 1.2 : 1;
      mt.pending = p;
      mt.until = now + Math.max(1, Math.round((C.DIG_TICKS[M.tool] || 60) * hard / speed()));
      return;
    }
    if (mt.face) { advance(mt.face); mt.face = null; mt.q = null; return; }
    // Новый шаг: встать, откуда копать, и копать дальше
    const face = nextFace();
    if (!face) return;
    if (!M.pos || keyOf(M.pos) !== keyOf(face.from)) {
      if ((face.kind === 'gallery' || face.kind === 'drift') && onHorizon(M.pos) && onHorizon(face.from) && C.inGallery(MW().ring, toC(V(face.from))[0], toC(V(face.from))[2])) { localWalk(face.from); return; }
      if (face.kind === 'gallery' && M.pos && keyOf(M.pos) === keyOf(cornerW(M.h))) { localWalk(face.from); return; }
      goFace(); return;
    }
    mt.face = face; mt.q = face.cells.filter((p) => { const id = idAt(p); return id && !C.isAirId(id); });
    M.st = 'work'; M.msg = workMsg(); wsave();
  } catch (err) { report('Кондрат', 'шаг работы', err); mt.until = now + 100; mt.q = null; mt.face = null; mt.pending = null; }
}
function workMsg() {
  const M = WS.mine, H = hz()[M.h];
  if (!H) return M.msg;
  if (M.phase === 'shaft') return `Копаю ствол: глубина ${-C.shaftLevel(M.i)} из ${-C.shaftLevel(H.step)} (до горизонта «${H.title}»)`;
  if (M.phase === 'gallery') return `${H.title}: рудничный двор ${M.g}/${gOrder(M.h).length}`;
  if (M.phase === 'drift') return `${H.title}: коридор ${M.n + 1} из 4, ${M.d}/${C.DRIFT}`;
  if (M.phase === 'branch') return `${H.title}: коридор ${M.n + 1} из 4, ветка ${M.side > 0 ? 'вправо' : 'влево'} у ${M.dj + 1}-й клетки, ${M.b}/${C.BRANCH}`;
  return M.msg;
}
// Пройти по маршруту (наверх — к копру, вниз — к забою). По стволу с рельсами — на вагонетке.
function goAlong(toEnd) {
  const M = WS.mine, r = route();
  let pre = [], at = r.findIndex((p) => M.pos && keyOf(p) === keyOf(M.pos));
  // стоит во дворе горизонта — сначала по двору к стволу
  if (at < 0 && onHorizon(M.pos) && C.inGallery(MW().ring, toC(V(M.pos))[0], toC(V(M.pos))[2])) {
    const a = toC(V(M.pos)), co = corner2(M.h);
    const gp = C.galleryPath([a[0], a[2]], co, (x, z) => C.inGallery(MW().ring, x, z) || (x === co[0] && z === co[1]));
    const ci = r.findIndex((p) => keyOf(p) === keyOf(cornerW(M.h)));
    if (gp && ci >= 0) { pre = gp.map((c) => at2(M.h, c)); at = ci; }
  }
  if (at < 0) {
    // не на маршруте (перезапуск): ближайшая клетка маршрута
    let best = 0, bd = Infinity;
    r.forEach((p, i) => { const d = M.pos ? Math.abs(p[0] - M.pos[0]) + Math.abs(p[1] - M.pos[1]) * 2 + Math.abs(p[2] - M.pos[2]) : i; if (d < bd) { bd = d; best = i; } });
    at = best; if (M.pos && bd > 0) place('kondrat', r[best]);
  }
  const path = dedupe([...pre, ...(toEnd ? r.slice(at) : r.slice(0, at + 1).reverse())]);
  // куски пути: по стволу (можно ехать) и пешком
  const inShaft = new Set(r.slice(2, r.nShaft).map(keyOf));
  const canRide = M.railShaft >= 4 && railedTo(M);
  const segs = [];
  for (const p of path) {
    const ride = canRide && inShaft.has(keyOf(p));
    if (!segs.length || segs[segs.length - 1].ride !== ride) segs.push({ ride, path: segs.length ? [segs[segs.length - 1].path.slice(-1)[0]] : [] });
    segs[segs.length - 1].path.push(p);
  }
  const go = (k) => {
    if (k >= segs.length) { mt.until = system.currentTick + 5; return; }
    const sg = segs[k], ride = sg.ride && sg.path.length > 8;
    walk('kondrat', dedupe(sg.path), () => go(k + 1), { speedBpt: ride ? 0.4 : 0.2, ride });
  };
  go(0);
}
const goHome = () => { WS.mine.msg = WS.mine.st === 'tool' || !WS.mine.tool ? 'Иду за киркой' : 'Несу добычу наверх'; goAlong(false); };
const goFace = () => { WS.mine.msg = 'Иду в забой'; goAlong(true); };
// Добыча — в сундуки у копра; новая кирка и рельсы — из бочки
function unloadAndRestock() {
  const M = WS.mine;
  const chests = containers(MW().chests);
  if (!chests) return; // не прогружено
  let left = 0;
  for (const [it, n] of Object.entries({ ...M.bag })) {
    // уголь на факелы и камень на заделку оставляем себе понемногу
    const keep = it === 'minecraft:coal' ? Math.min(n, 16) : C.FILLER[0] === it ? Math.min(n, 32) : 0;
    let put = n - keep;
    for (const inv of chests) put = putItems(inv, it, put);
    const moved = n - keep - put;
    add(M.bag, it, -moved); add(WS.led.dep, it, moved); left += put;
  }
  checkLedger();
  const barrel = containers([MW().barrel], 'minecraft:barrel');
  if (!barrel) return;
  const inv = barrel[0];
  if (M.uses <= 0 || !M.tool) {
    let best = null;
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i), m = it && /^minecraft:(\w+)_pickaxe$/.exec(it.typeId);
      if (m && (!best || (C.TIERS[m[1]] || 0) > (C.TIERS[best] || 0))) best = m[1];
    }
    if (!best) {
      if (M.msg !== 'Нужна кирка: положи её в бочку у копра') { M.msg = 'Нужна кирка: положи её в бочку у копра'; say('kondrat', 'Кирка кончилась. Положи кирку в бочку у копра — каменную, а лучше железную.'); }
      M.tool = null; M.st = 'tool'; act('kondrat', 0); hold('kondrat', 'air'); mt.until = system.currentTick + 40; wsave(); return;
    }
    takeOut(inv, `minecraft:${best}_pickaxe`, 1);
    M.tool = best; M.uses = C.TOOL_USES[best] * C.WEAR;
    hold('kondrat', `minecraft:${best}_pickaxe`);
    say('kondrat', `Взял ${({ wooden: 'деревянную', stone: 'каменную', golden: 'золотую', iron: 'железную', diamond: 'алмазную', netherite: 'незеритовую' })[best]} кирку. За работу.`);
  }
  // Свет: факелы из бочки; нет — уголь из бочки; нет — свой уголь из сундуков с добычей
  if (M.torch < 24) {
    const tHave = countIn(inv, (id) => id === 'minecraft:torch')['minecraft:torch'] || 0;
    const t = Math.min(tHave, 64 - M.torch);
    if (t) { takeOut(inv, 'minecraft:torch', t); M.torch += t; }
  }
  if (M.torch < 24 && (M.bag['minecraft:coal'] || 0) < 8) {
    const want = 8 - (M.bag['minecraft:coal'] || 0);
    const fromBarrel = Math.min(want, countIn(inv, (id) => id === 'minecraft:coal' || id === 'minecraft:charcoal')['minecraft:coal'] || 0);
    if (fromBarrel) { takeOut(inv, 'minecraft:coal', fromBarrel); add(M.bag, 'minecraft:coal', fromBarrel); add(WS.led.given, 'minecraft:coal', fromBarrel); }
    let left = want - fromBarrel;
    for (const ci of chests) { if (left <= 0) break; const got = left - takeOut(ci, 'minecraft:coal', left); if (got) { add(M.bag, 'minecraft:coal', got); add(WS.led.dep, 'minecraft:coal', -got); left -= got; } }
  }
  if (M.torch <= 0 && !(M.bag['minecraft:coal'] > 0)) {
    if (!M.darkSaid) { M.darkSaid = true; say('kondrat', 'Нечем светить. Положи факелы или уголь в бочку у копра — без света в шахте нечисть заведётся.'); }
  } else M.darkSaid = false;
  if (M.layRails) {
    const have = countIn(inv, (id) => id === 'minecraft:rail')['minecraft:rail'] || 0;
    const want = Math.max(0, 64 - M.rails);
    const t = Math.min(have, want);
    if (t) { takeOut(inv, 'minecraft:rail', t); M.rails += t; }
  }
  if (left) { M.msg = 'Сундуки у копра полны — забери добычу'; if (system.currentTick % 1200 < 20) say('kondrat', 'Сундуки у копра полны. Забери добычу — тогда продолжу.'); mt.until = system.currentTick + 100; wsave(); return; }
  if (M.phase === 'hdone') {
    if (M.open > M.h + 1 && hz()[M.h + 1]) { M.h++; M.phase = 'shaft'; M.d = 0; M.n = 0; M.g = 0; M.msg = 'Копаю глубже: ' + hz()[M.h].title; say('kondrat', 'Горизонт выработан. Иду глубже — ' + hz()[M.h].title.toLowerCase() + '.'); }
    else { M.phase = 'done'; M.msg = 'Горизонт выработан. Скажи копать глубже'; say('kondrat', `${hz()[M.h].title} выработан. Скажешь копать глубже — пойду.`); }
  }
  if (M.phase === 'done') { M.st = 'idle'; act('kondrat', 0); wsave(); return; }
  M.st = 'work'; wsave();
  // рельсы — по пути вниз: на клетки ствола без рельса
  if (M.layRails && M.rails > 0) layRailsDown();
  goFace();
}
function layRailsDown() {
  const M = WS.mine, limit = M.phase === 'shaft' ? M.i : hz()[M.h] ? hz()[M.h].step : 0;
  while (M.rails > 0 && M.railShaft < limit) {
    const j = M.railShaft + 1;
    if (!railAt(shaftW(j), C.shaftRail(j))) { const id = idAt(shaftW(j)); if (id && /rail/.test(id)) { M.railShaft = j; continue; } break; }
    M.railShaft = j;
  }
  wsave();
}

// Счёт: добыто = в сумке + сдано + потрачено. Если не сходится — ошибка в чат.
export function checkLedger() {
  const L = WS.led, M = WS.mine, bad = [];
  L.given = L.given || {};
  for (const it of new Set([...Object.keys(L.mined), ...Object.keys(L.dep), ...Object.keys(L.used), ...Object.keys(M.bag), ...Object.keys(L.given)])) {
    const a = (L.mined[it] || 0) + (L.given[it] || 0), b = (M.bag[it] || 0) + (L.dep[it] || 0) + (L.used[it] || 0);
    if (a !== b) bad.push(`${it.replace('minecraft:', '')}: добыто ${a}, а учтено ${b}`);
  }
  if (bad.length) report('Кондрат', 'счёт не сходится: ' + bad.join('; '));
  return bad;
}

// ======================= СТРОИТЕЛЬ =======================
const YW = () => CASTLE.works.yard;
const ORDERS = () => CASTLE.orders;
const orderOf = (id) => ORDERS().find((o) => o.id === id);
const orderOpen = (o) => !WS.build.done[o.id] && o.needs.every((n) => WS.build.done[n]);
function storeUnits() {
  const out = {}, chests = containers(YW().store);
  if (!chests) return null;
  for (const inv of chests) for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i), u = it && C.unitsOf(it.typeId); if (u) add(out, u[0], u[1] * it.amount); }
  return out;
}
// Забрать со склада units единиц разряда cat (бревно — 4 единицы; лишнее от бревна — в тележку)
function takeUnits(cat, units) {
  const chests = containers(YW().store);
  if (!chests) return 0;
  let got = 0;
  for (const inv of chests) for (let i = 0; i < inv.size && got < units; i++) {
    const it = inv.getItem(i), u = it && C.unitsOf(it.typeId);
    if (!u || u[0] !== cat) continue;
    const need = Math.ceil((units - got) / u[1]), t = Math.min(need, it.amount);
    if (it.amount === t) inv.setItem(i); else { it.amount -= t; inv.setItem(i, it); }
    got += t * u[1];
  }
  add(WS.build.cart, cat, got); add(WS.bled.took, cat, got);
  return got;
}
const BACK_ITEM = { stone: 'minecraft:cobblestone', wood: 'minecraft:spruce_planks', glass: 'minecraft:glass', iron: 'minecraft:iron_bars' };
function returnCart() {
  const B = WS.build, chests = containers(YW().store);
  if (!chests) return false;
  for (const [cat, n] of Object.entries({ ...B.cart })) {
    if (!BACK_ITEM[cat] || n <= 0) continue;
    let left = n;
    for (const inv of chests) left = putItems(inv, BACK_ITEM[cat], left);
    add(B.cart, cat, -(n - left)); add(WS.bled.back, cat, n - left);
  }
  return true;
}
export function checkBuildLedger() {
  const L = WS.bled, B = WS.build, bad = [];
  for (const cat of new Set([...Object.keys(L.took), ...Object.keys(L.placed), ...Object.keys(L.back), ...Object.keys(L.reclaimed), ...Object.keys(B.cart)])) {
    const inn = (L.took[cat] || 0) + (L.reclaimed[cat] || 0), out = (L.placed[cat] || 0) + (L.back[cat] || 0) + (B.cart[cat] || 0);
    if (inn !== out) bad.push(`${C.CAT_NAME[cat] || cat}: взято ${inn}, а учтено ${out}`);
  }
  if (bad.length) report('Мирон', 'счёт не сходится: ' + bad.join('; '));
  return bad;
}
function startOrder(oid) {
  const B = WS.build, o = orderOf(oid);
  if (!o || !orderOpen(o)) return 'Этот заказ сейчас не взять.';
  if (B.order) return 'Я ещё прежний не закончил.';
  const have = storeUnits();
  if (!have) return 'Склад далеко, не видно, что там лежит.';
  const lack = Object.entries(o.cost).filter(([cat, n]) => cat !== 'other' && (have[cat] || 0) + (B.cart[cat] || 0) < n);
  if (lack.length) return 'На складе не хватает: ' + lack.map(([cat, n]) => `${C.CAT_NAME[cat]} ${(have[cat] || 0) + (B.cart[cat] || 0)}/${n}`).join(', ') + '.';
  for (const [cat, n] of Object.entries(o.cost)) if (cat !== 'other') takeUnits(cat, Math.max(0, n - (B.cart[cat] || 0)));
  B.order = oid; B.st = 'scan'; B.placed = 0; B.removed = 0; B.msg = 'Размечаю: ' + o.title; B.need = null;
  wsave();
  keepArea('build', o);
  return null;
}
// Разметка: читаем заплатку по блоку и сравниваем с миром. Получается список работ.
const bt = { jobs: null, gen: null, cell: 0, until: 0, stand: null, search: null, fails: {} };
// Разметка: клетки заказа (work_data.js) сравниваем с миром — получается список работ
const permCache = [];
const permOf = (i) => permCache[i] || (permCache[i] = BlockPermutation.resolve(WORK.pal[i][0], WORK.pal[i][1]));
function* scanGen(o) {
  const jobs = [], cells = WORK.cells[o.id] || [];
  if (!cells.length) report('Мирон', 'нет разметки заказа ' + o.id);
  for (let k = 0; k < cells.length; k += 4) {
    const p = A(Wc([cells[k], cells[k + 1], cells[k + 2]]));
    let b = blk(p);
    while (!b) { yield 'wait'; b = blk(p); }
    let perm;
    try { perm = permOf(cells[k + 3]); } catch (e) { report('Мирон', 'блок ' + WORK.pal[cells[k + 3]][0], e); continue; }
    if (!same(b, perm)) {
      const tid = perm.type.id;
      jobs.push({ p, perm, rm: C.isAirId(tid), cat: C.catOf(tid), att: C.ATTACHED.test(tid) });
    }
    if (k % 256 === 0) yield null;
  }
  return jobs;
}
function same(b, perm) {
  if (b.typeId !== perm.type.id) return false;
  try {
    const a = b.permutation.getAllStates(), c = perm.getAllStates();
    return Object.keys(c).every((k) => a[k] === c[k]); // порядок состояний не важен
  } catch (e) { return true; }
}
function sortJobs(o, jobs) {
  const along = o.unit.startsWith('wall_') ? (/^wall_[ns]/.test(o.unit) ? 0 : 2) : -1;
  const c = Wc(o.at);
  const key = (j) => (along >= 0 ? j.p[along] : Math.atan2(j.p[2] - c.z, j.p[0] - c.x));
  const rm = jobs.filter((j) => j.rm).sort((a, b) => b.p[1] - a.p[1] || key(a) - key(b));
  const put = jobs.filter((j) => !j.rm).sort((a, b) => (a.att - b.att) || a.p[1] - b.p[1] || key(a) - key(b));
  return [...rm, ...put];
}
const REACH = 4.5;
const reachOk = (stand, p) => Math.hypot(stand[0] - p[0], stand[1] + 1.6 - (p[1] + 0.5), stand[2] - p[2]) <= REACH;
function pendingSet() { const s = new Set(); for (const j of bt.jobs || []) if (!j.rm && !j.att) s.add(keyOf(j.p)); return s; }
// Где встать, чтобы дотянуться до клетки
function findStand(p, from) {
  const pend = pendingSet(), cand = [];
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 1; dy++) {
    const s = [p[0] + dx, p[1] + dy, p[2] + dz];
    if (!reachOk(s, p) || (dx === 0 && dz === 0 && (dy === 0 || dy === -1))) continue;
    cand.push(s);
  }
  cand.sort((a, b) => Math.hypot(a[0] - from[0], a[1] - from[1], a[2] - from[2]) - Math.hypot(b[0] - from[0], b[1] - from[1], b[2] - from[2]));
  for (const s of cand) {
    if (pend.has(keyOf(s)) || pend.has(keyOf([s[0], s[1] + 1, s[2]]))) continue;
    if (standable(...s)) return s;
  }
  return null;
}
// Леса: столбик лесов рядом, наверху — место, откуда достать
function findScaffold(p) {
  const pend = pendingSet();
  let best = null;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (!dx && !dz) continue;
    const x = p[0] + dx, z = p[2] + dz, feet = p[1] - 2;
    let g = null;
    for (let y = feet + 1; y >= feet - 16; y--) { if (solidAt([x, y, z])) { g = y; break; } if (!passable([x, y, z]) || pend.has(keyOf([x, y, z]))) { g = undefined; break; } }
    if (g === null || g === undefined || g >= feet - 1) continue;
    if (!passable([x, feet, z]) || !passable([x, feet + 1, z]) || pend.has(keyOf([x, feet, z])) || pend.has(keyOf([x, feet + 1, z]))) continue;
    if (!reachOk([x, feet, z], p)) continue;
    const n = feet - 1 - g;
    if (!best || n < best.n) best = { n, x, z, g, feet };
  }
  if (!best) return null;
  const cells = [];
  for (let y = best.g + 1; y < best.feet; y++) cells.push([best.x, y, best.z]);
  return { cells, stand: [best.x, best.feet, best.z] };
}
function buildTick(now) {
  const B = WS.build;
  if (!B.order) { if (B.st !== 'idle') { B.st = 'idle'; wsave(); } return; }
  if (moveTick('miron', 1)) return;
  if (bt.search) { walkTo(bt.goal.to, bt.goal.then); return; } // путь ещё ищется
  if (now < bt.until) return;
  const o = orderOf(B.order);
  if (!o) { B.order = null; return; }
  const e = entOf('miron');
  if (!e) return;
  try {
    if (B.st === 'scan') {
      if (tickMs > 75) return;
      if (!bt.gen) { bt.gen = scanGen(o); bt.jobs = null; }
      for (let k = 0; k < 40; k++) {
        const r = bt.gen.next();
        if (r.done) { bt.jobs = sortJobs(o, r.value); bt.gen = null; B.st = 'work'; B.msg = `${o.title}: ${bt.jobs.length} блоков`; wsave(); say('miron', `Берусь: ${o.title.toLowerCase()}. Работы — на ${bt.jobs.length} блоков.`); return; }
        if (r.value === 'wait') { B.msg = 'Место работ далеко — жду, пока прогрузится'; bt.until = now + 40; return; }
      }
      return;
    }
    if (!bt.jobs) { B.st = 'scan'; return; } // после перезапуска — разметить заново
    if (B.st === 'need') {
      if (!atHome()) return walkTo(A(Wc(YW().home)));
      const cat = B.need, got = takeUnits(cat, 64);
      if (!got) { B.msg = `Жду ${C.CAT_NAME[cat]} на складе`; if (now % 1200 < 20) say('miron', `Кончился ${C.CAT_NAME[cat]}. Положи на склад у двора строителя.`); bt.until = now + 100; wsave(); return; }
      B.need = null; B.st = 'work'; wsave(); return;
    }
    if (B.st === 'scaff') {
      const sc = bt.scaff;
      if (sc && sc.cells.length) {
        const c = sc.cells.shift(), b = blk(c);
        if (b && passable(c)) { b.setType('minecraft:scaffolding'); B.scaff.push(c); B.scaffTotal = (B.scaffTotal || 0) + 1; sound('block.scaffold.place', c); }
        act('miron', 2); bt.until = now + Math.max(1, Math.round(6 / speed())); wsave(); return;
      }
      // залезть наверх
      const s = sc.stand; bt.scaff = null; B.st = 'work';
      walk('miron', [B.pos, [s[0], B.pos[1], s[2]], s].filter((p, i, r) => !i || keyOf(p) !== keyOf(r[i - 1])), () => { bt.stand = s; }, { speedBpt: 0.15 });
      return;
    }
    if (B.st === 'clean') {
      if (B.scaff.length) {
        if (!bt.down) { // сначала спуститься на землю
          bt.down = true;
          const base = B.scaff[0];
          let g = base[1];
          for (let y = base[1]; y > base[1] - 20; y--) if (solidAt([base[0], y - 1, base[2]]) && idAt([base[0], y - 1, base[2]]) !== 'minecraft:scaffolding') { g = y; break; }
          const s = findStand([base[0], g, base[2]], [base[0], g, base[2]]) || [base[0] + 1, g, base[2]];
          walk('miron', [B.pos, s], () => {}, { speedBpt: 0.15 });
          return;
        }
        const c = B.scaff.pop(), b = blk(c);
        if (b && b.typeId === 'minecraft:scaffolding') b.setType('minecraft:air');
        act('miron', 2); bt.until = now + Math.max(1, Math.round(4 / speed())); wsave(); return;
      }
      bt.down = false;
      if (!atHome()) return walkTo(A(Wc(YW().home)));
      if (!returnCart()) return;
      B.done[o.id] = 1;
      if (o.step === 'stone' && S.rep) { S.rep[o.unit] = { st: 'done' }; save(); }
      say('miron', `Готово: ${o.title.toLowerCase()}. Поставил ${B.placed} блоков, разобрал ${B.removed}.`);
      for (const pl of players()) pl.onScreenDisplay.setTitle('§6Работа готова', { subtitle: o.title, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 });
      checkBuildLedger();
      B.order = null; B.st = 'idle'; B.msg = 'Ждёт заказа'; bt.jobs = null; keepArea('build', null); act('miron', 0);
      wsave(); return;
    }
    // Работа: следующий блок
    while (bt.jobs.length && same(blk(bt.jobs[0].p) || { typeId: '?' }, bt.jobs[0].perm)) bt.jobs.shift();
    if (!bt.jobs.length) { B.st = 'clean'; B.msg = 'Разбираю леса, иду домой'; wsave(); return; }
    const j = bt.jobs[0];
    if (!blk(j.p)) { bt.until = now + 40; return; }
    // Игрок стоит в клетке — подождать (переставить работу в конец)
    if (players().some((pl) => Math.floor(pl.location.x) === j.p[0] && Math.abs(Math.floor(pl.location.y) - j.p[1]) <= 1 && Math.floor(pl.location.z) === j.p[2])) {
      bt.jobs.push(bt.jobs.shift()); bt.until = now + 10; return;
    }
    const here = B.pos;
    if (!here || !reachOk(here, j.p) || keyOf(here) === keyOf(j.p) || keyOf([here[0], here[1] + 1, here[2]]) === keyOf(j.p)) {
      const s = findStand(j.p, here || j.p);
      if (s) { walkTo(s); return; }
      const sc = findScaffold(j.p);
      if (sc) {
        const base = [sc.stand[0], sc.cells.length ? sc.cells[0][1] : sc.stand[1], sc.stand[2]];
        const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [base[0] + dx, base[1], base[2] + dz]).find((c) => standable(...c) && !pendingSet().has(keyOf(c)));
        bt.scaff = sc; walkTo(side || base, () => { B.st = 'scaff'; }); return;
      }
      const f = (bt.fails[keyOf(j.p)] = (bt.fails[keyOf(j.p)] || 0) + 1);
      if (f > 3) { report('Мирон', `не достать блок (${j.p.join(' ')}), пропускаю`); bt.jobs.shift(); return; }
      bt.jobs.push(bt.jobs.shift()); return;
    }
    // Хватает ли материала
    if (!j.rm && j.cat !== 'other' && (B.cart[j.cat] || 0) <= 0) { B.need = j.cat; B.st = 'need'; B.msg = `Не хватило: ${C.CAT_NAME[j.cat]}, иду на склад`; wsave(); return; }
    // Удар молотком — потом блок
    if (!bt.swing) {
      bt.swing = true; act('miron', 2);
      try { e.teleport(e.location, { facingLocation: { x: j.p[0] + 0.5, y: j.p[1] + 0.5, z: j.p[2] + 0.5 } }); } catch (err) { /* нет */ }
      if (!j.rm) hold('miron', j.cat === 'stone' ? 'minecraft:stone_bricks' : j.cat === 'wood' ? 'minecraft:spruce_log' : j.cat === 'glass' ? 'minecraft:glass' : WORKERS.miron.tool);
      bt.until = now + Math.max(1, Math.round((j.rm ? 14 : 20) / speed()));
      return;
    }
    bt.swing = false;
    const b = blk(j.p);
    const old = b.typeId, rec = C.reclaimOf(old);
    if (rec && !C.isAirId(old)) { add(B.cart, rec, 1); add(WS.bled.reclaimed, rec, 1); }
    if (j.rm) { b.setType('minecraft:air'); B.removed++; sound(/gravel/.test(old) ? 'dig.gravel' : 'dig.stone', j.p); }
    else {
      b.setPermutation(j.perm);
      if (j.cat !== 'other') { add(B.cart, j.cat, -1); add(WS.bled.placed, j.cat, 1); }
      B.placed++; sound(j.cat === 'wood' ? 'use.wood' : 'use.stone', j.p);
    }
    bt.jobs.shift();
    B.msg = `${o.title}: осталось ${bt.jobs.length}`;
    wsave();
  } catch (err) { report('Мирон', 'шаг работы', err); bt.until = now + 100; }
}
const atHome = () => WS.build.pos && keyOf(WS.build.pos) === keyOf(A(Wc(YW().home)));
// Дойти до клетки: путь ищет A* понемногу каждый тик; не нашёл — идёт напрямик
function walkTo(to, then) {
  const B = WS.build, from = B.pos || to;
  if (keyOf(from) === keyOf(to)) { if (then) then(); return; }
  if (!bt.search || bt.searchTo !== keyOf(to)) { bt.search = C.makeSearch(from, to, standable, { maxNodes: 3000, near: 0 }); bt.searchTo = keyOf(to); bt.goal = { to, then }; }
  const r = bt.search.step(tickMs > 75 ? 30 : 120);
  if (r === undefined) return; // ещё ищем
  bt.search = null;
  let path = r;
  if (!path) {
    // напрямик: по прямой, по клеткам
    WS.dbgDirect = (WS.dbgDirect || 0) + 1;
    WS.dbgLast = [from.join(' ') + ' → ' + to.join(' '), ...(WS.dbgLast || [])].slice(0, 6);
    // вверх — сначала лезет, потом идёт; вниз — сначала идёт, потом слезает (как по лесам)
    const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2])));
    const up = to[1] > from[1], y0 = up ? to[1] : from[1];
    path = [];
    if (up) for (let y = from[1]; y < to[1]; y++) path.push([from[0], y, from[2]]);
    for (let k = 0; k <= n; k++) path.push([Math.round(from[0] + (to[0] - from[0]) * k / n), y0, Math.round(from[2] + (to[2] - from[2]) * k / n)]);
    if (!up) for (let y = from[1] - 1; y >= to[1]; y--) path.push([to[0], y, to[2]]);
  } else if (keyOf(path[path.length - 1]) !== keyOf(to)) path.push(to);
  walk('miron', path, () => { if (then) then(); }, { speedBpt: 0.2 });
}


// ======================= КУЗНЯ =======================
// Кузнец Гордей плавит руду в печи и куёт у наковальни по заказам игрока (окно кузни): броню и
// мечи страже по званию, мечи новобранцам (их просит капитан), кирки шахтёру, рельсы. Всё берёт
// из сундука кузни; готовое — сразу на стражника (garrison.equip) или в сундук. Что он куёт,
// видно в рамке на верстаке, а рядом с кузней внизу экрана — сколько осталось.
// Подмастерье Васька носит добычу: из сундуков у копра руду, уголь и алмазы — в кузню, камень —
// на склад строителя; из кузни в бочку у копра — кирки, рельсы и факелы.
const FG = () => CASTLE.forge;
const ARMOR = { head: ['helmet', 5, 'шлем', 'ый'], chest: ['chestplate', 8, 'нагрудник', 'ый'], legs: ['leggings', 7, 'поножи', 'ые'], feet: ['boots', 4, 'сапоги', 'ые'] };
const MAT = { iron: 'minecraft:iron_ingot', diamond: 'minecraft:diamond' };
const MAT_RU = { 'minecraft:iron_ingot': 'железо', 'minecraft:diamond': 'алмазы' };
const TIER_RU = { iron: 'железн', diamond: 'алмазн' };
const TIER_N = (item) => (!item ? 0 : /diamond|netherite/.test(item) ? 3 : /iron|chainmail/.test(item) ? 2 : 1);
const SMELT = { 'minecraft:raw_iron': 'minecraft:iron_ingot', 'minecraft:raw_gold': 'minecraft:gold_ingot', 'minecraft:raw_copper': 'minecraft:copper_ingot' };
const FUEL = ['minecraft:coal', 'minecraft:charcoal'];
const guardName = (id) => { const g = byRank().find((q) => q.id === id); return g ? g.name : id; };
function makeOrder(kind, tier, guard, slot, recruit) {
  if (kind === 'armor') { const a = ARMOR[slot]; return { kind, tier, guard, slot, item: `minecraft:${tier}_${a[0]}`, n: 1, cost: { [MAT[tier]]: a[1] }, title: `${TIER_RU[tier]}${a[3]} ${a[2]} — ${guardName(guard)}` }; }
  if (kind === 'sword') return { kind, tier, guard, slot: 'hand', recruit: !!recruit, item: `minecraft:${tier}_sword`, n: 1, cost: { [MAT[tier]]: 2 }, title: `${TIER_RU[tier]}ый меч — ${recruit ? 'новобранцу ' : ''}${guardName(guard)}` };
  if (kind === 'pick') return { kind, tier, item: `minecraft:${tier}_pickaxe`, n: 1, cost: { [MAT[tier]]: 3 }, title: `${TIER_RU[tier]}ая кирка — Кондрату` };
  return { kind: 'rails', tier: 'iron', item: 'minecraft:rail', n: 16, cost: { [MAT.iron]: 6 }, title: 'рельсы для шахты, 16 шт.' };
}
const forgeChests = () => containers(CASTLE.works.forge.chests);
function forgeStock() { const out = {}, ch = forgeChests(); if (!ch) return null; for (const inv of ch) for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) add(out, it.typeId, it.amount); } return out; }
function takeForge(id, n) { const ch = forgeChests(); if (!ch) return n; for (const inv of ch) n = takeOut(inv, id, n); return n; }
function putForge(id, n) { const ch = forgeChests(); if (!ch) return n; for (const inv of ch) n = putItems(inv, id, n); return n; }
function showFrame(item) {
  const f = CASTLE.works.forge.frame, w = Wc(f);
  const name = item && FG().show.includes(item.replace('minecraft:', '')) ? item.replace('minecraft:', '') : 'empty';
  if (WS.smith.frame === name) return;
  if (runCmd(`structure load acastle:forge_show_${name} ${w.x} ${w.y} ${w.z}`)) WS.smith.frame = name;
}
function furnaceLit(on) {
  const b = blk(Wc(CASTLE.works.forge.furnace));
  if (!b || !/furnace/.test(b.typeId)) return;
  const want = on ? 'minecraft:lit_furnace' : 'minecraft:furnace';
  if (b.typeId === want) return;
  try { b.setPermutation(BlockPermutation.resolve(want, b.permutation.getAllStates())); } catch (e) { try { b.setType(want); } catch (err) { /* нет */ } }
}
const sm = { until: 0 };
const forgeAt = (c) => A(Wc(c));
function smithTick(now) {
  const M = WS.smith;
  if (moveTick('gordey', 1)) return;
  if (now < sm.until) return;
  const e = entOf('gordey');
  if (!e) return;
  try {
    const stock = forgeStock();
    if (!stock) { sm.until = now + 40; return; }
    if (!M.job) {
      const queued = new Set([...M.q.map((o) => o.kind + o.guard), ...(M.job ? [M.job.kind + M.job.guard] : [])]);
      const w = wanted().find((id) => !queued.has('sword' + id));
      M.job = w ? makeOrder('sword', 'iron', w, 'hand', true) : M.q.shift() || null;
      M.prog = 0; M.said = null;
      if (!M.job) {
        // без заказов — переплавляет сырую руду про запас
        const raw = Object.keys(SMELT).find((r) => (stock[r] || 0) >= 8);
        if (raw && FUEL.some((f) => stock[f] > 0)) { M.job = { kind: 'smelt', raw, item: SMELT[raw], n: 8, cost: {}, title: 'переплавка руды' }; }
        else { if (M.st !== 'idle') { M.st = 'idle'; M.msg = 'Ждёт заказа'; showFrame(null); act('gordey', 0); hold('gordey', WORKERS.gordey.tool); wsave(); } sm.until = now + 40; return; }
      }
      wsave();
    }
    const J = M.job;
    // переплавка: сырая руда + уголь → слитки (1 уголь на 8)
    if (J.kind === 'smelt' || M.st === 'smelt') return smeltStep(now, J, stock);
    const [mat, need] = Object.entries(J.cost)[0];
    if (M.st !== 'forge') {
      if ((stock[mat] || 0) < need) {
        const raw = Object.keys(SMELT).find((r) => SMELT[r] === mat && stock[r] > 0);
        if (raw && FUEL.some((f) => stock[f] > 0)) { M.st = 'smelt'; M.smeltFor = { raw, item: mat, n: Math.min(need - (stock[mat] || 0), stock[raw], 8 * FUEL.reduce((a, f) => a + (stock[f] || 0), 0)) }; wsave(); return; }
        M.st = 'wait'; M.msg = `Не хватает: ${MAT_RU[mat]} ${stock[mat] || 0} из ${need} (${J.title})`;
        if (M.said !== J.title) { M.said = J.title; say('gordey', `Для «${J.title}» нужно ${MAT_RU[mat]}: ${need}, а в сундуке кузни ${stock[mat] || 0}${mat === MAT.iron ? '. Сырое железо и уголь тоже переплавлю' : ''}.`); }
        act('gordey', 0); sm.until = now + 60; wsave(); return;
      }
      // к наковальне, забрать материал, положить заготовку в рамку
      if (!M.pos || keyOf(M.pos) !== keyOf(forgeAt(CASTLE.works.forge.anvilStand))) { walk('gordey', line(M.pos || forgeAt(CASTLE.works.forge.anvilStand), forgeAt(CASTLE.works.forge.anvilStand)), () => {}); return; }
      const left = takeForge(mat, need);
      if (left) { putForge(mat, need - left); sm.until = now + 20; return; } // кто-то забрал из сундука
      add(M.used, mat, need);
      M.st = 'forge'; M.prog = 0; M.total = need * 30; M.msg = 'Куёт: ' + J.title;
      showFrame(J.item); hold('gordey', WORKERS.gordey.tool);
      try { e.teleport(e.location, { facingLocation: { ...Wc(CASTLE.works.forge.anvil), y: Wc(CASTLE.works.forge.anvil).y + 0.5 } }); } catch (err) { /* нет */ }
      wsave(); return;
    }
    // ковка: удары молотом
    act('gordey', 2);
    M.prog += 5 * speed(); sm.until = now + 5;
    if (now % 15 < 5) sound('random.anvil_use', A(Wc(CASTLE.works.forge.anvil)));
    if (M.prog < M.total) return;
    // готово
    act('gordey', 0); showFrame(null);
    if (J.kind === 'armor' || J.kind === 'sword') {
      if (J.recruit) recruitArrive(J.guard);
      equip(J.guard, J.slot, J.item);
      say('gordey', `Готово: ${J.title}. Надел на ${guardName(J.guard).split(' ').pop()}.`);
    } else {
      const lost = putForge(J.item, J.n);
      if (lost) { try { DIM().spawnItem(new ItemStack(J.item, lost), Wc(CASTLE.works.forge.anvilStand)); } catch (err) { /* нет */ } }
      say('gordey', `Готово: ${J.title}. В сундуке кузни — Васька отнесёт к копру.`);
    }
    add(M.made, J.item, J.n);
    M.job = null; M.st = 'idle'; M.msg = 'Готово: ' + J.title; wsave();
  } catch (err) { report('Гордей', 'шаг работы', err); sm.until = now + 100; }
}
function smeltStep(now, J, stock) {
  const M = WS.smith, sf = J.kind === 'smelt' ? { raw: J.raw, item: J.item, n: J.n } : M.smeltFor;
  const fs = forgeAt(CASTLE.works.forge.furnaceStand);
  if (!M.pos || keyOf(M.pos) !== keyOf(fs)) { walk('gordey', line(M.pos || fs, fs), () => {}); return; }
  if (!M.smelting) {
    const n = Math.min(sf.n, stock[sf.raw] || 0, 8 * FUEL.reduce((a, f) => a + (stock[f] || 0), 0));
    if (n <= 0) { M.st = 'idle'; if (J.kind === 'smelt') M.job = null; wsave(); return; }
    const fuelN = Math.ceil(n / 8);
    let fleft = fuelN;
    for (const f of FUEL) { const t = Math.min(fleft, stock[f] || 0); if (t) { takeForge(f, t); add(M.used, f, t); fleft -= t; } }
    takeForge(sf.raw, n); add(M.used, sf.raw, n);
    M.smelting = { item: sf.item, n, until: now + Math.max(5, Math.round(n * 20 / speed())) };
    M.msg = `Плавит: ${n} шт.`; furnaceLit(true); showFrame('minecraft:iron_ingot'); act('gordey', 2);
    try { const e = entOf('gordey'); e.teleport(e.location, { facingLocation: { ...Wc(CASTLE.works.forge.furnace), y: Wc(CASTLE.works.forge.furnace).y + 0.5 } }); } catch (err) { /* нет */ }
    wsave(); sm.until = now + 10; return;
  }
  if (now < M.smelting.until) { sm.until = now + 10; if (now % 40 < 10) sound('fire.fire', A(Wc(CASTLE.works.forge.furnace))); return; }
  const lost = putForge(M.smelting.item, M.smelting.n);
  add(M.smelted, M.smelting.item, M.smelting.n - lost);
  M.smelting = null; furnaceLit(false); showFrame(null); act('gordey', 0);
  M.st = 'idle'; if (J.kind === 'smelt') M.job = null;
  wsave();
}
// ---------- Подмастерье ----------
const FORGE_GOODS = /raw_(iron|gold|copper)$|:coal$|charcoal$|:diamond$|:emerald$|:redstone$|lapis_lazuli$|flint$/;
const STONE_GOODS = /^minecraft:(cobblestone|cobbled_deepslate|andesite|diorite|granite|tuff|stone)$/;
const MINE_GOODS = /_pickaxe$|^minecraft:rail$|^minecraft:torch$/;
const BAG_STACKS = 8;
const ap = { until: 0 };
const flatPath = (flat) => { const out = []; for (let k = 0; k < (flat || []).length; k += 3) out.push(A(Wc([flat[k], flat[k + 1], flat[k + 2]]))); return out; };
function bagStacks(bag) { return Object.entries(bag).reduce((a, [, n]) => a + Math.ceil(n / 64), 0); }
function grab(invs, test, bag, limit) {
  let got = 0;
  for (const inv of invs) for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!it || !test(it.typeId) || bagStacks(bag) >= limit) continue;
    add(bag, it.typeId, it.amount); got += it.amount; inv.setItem(i);
  }
  return got;
}
const freeSlots = (invs) => invs.reduce((a, inv) => { let n = 0; for (let i = 0; i < inv.size; i++) if (!inv.getItem(i)) n++; return a + n; }, 0);
function drop(invs, test, bag, cap) {
  for (const [id, n] of Object.entries({ ...bag })) {
    if (!test(id)) continue;
    let left = n;
    // cap — сколько ячеек оставить свободными (на складе строителя — под дерево и стекло)
    if (cap !== undefined) { const room = Math.max(0, (freeSlots(invs) - cap) * 64); left = Math.min(n, room); const keep = n - left; for (const inv of invs) left = putItems(inv, id, left); left += keep; }
    else for (const inv of invs) left = putItems(inv, id, left);
    add(bag, id, -(n - left)); add(WS.app.moved, id, n - left);
  }
}
function appTick(now) {
  const A2 = WS.app;
  if (moveTick('vaska', 1)) return;
  if (now < ap.until) return;
  if (!entOf('vaska')) return;
  try {
    const go = (flat, rev, st, msg) => { let p = flatPath(flat); if (rev) p = p.reverse(); if (!p.length) { p = [A2.pos || A(Wc(CASTLE.works.forge.apprentice))]; } A2.st = st; A2.msg = msg; wsave(); walk('vaska', dedupe([A2.pos || p[0], ...p]), () => { ap.until = system.currentTick + 10; }, { speedBpt: 0.18 }); };
    if (A2.st === 'forge') {
      const fch = forgeChests(); if (!fch) { ap.until = now + 40; return; }
      drop(fch, (id) => FORGE_GOODS.test(id), A2.bag);
      if (!A2.storeFull && Object.keys(A2.bag).some((id) => STONE_GOODS.test(id))) return go(FG().toYard, false, 'toYard', 'Несёт камень на склад строителя');
      if (A2.rest && now < A2.rest) { act('vaska', 0); ap.until = now + 20; return; }
      grab(fch, (id) => MINE_GOODS.test(id), A2.bag, BAG_STACKS);
      return go(FG().toMine, false, 'toMine', 'Идёт к шахте');
    }
    if (A2.st === 'toMine') {
      const barrel = containers([CASTLE.works.mine.barrel], 'minecraft:barrel'), mch = containers(CASTLE.works.mine.chests);
      if (!barrel || !mch) { ap.until = now + 40; return; }
      drop(barrel, (id) => MINE_GOODS.test(id), A2.bag);
      // склад строителя полон — камень, что не влез, возвращаем к копру и пока не носим
      if (A2.storeFull && now > A2.storeFull) A2.storeFull = 0;
      if (A2.storeFull) { for (const [id, n] of Object.entries({ ...A2.bag })) if (STONE_GOODS.test(id)) { let left = n; for (const inv of mch) left = putItems(inv, id, left); add(A2.bag, id, -(n - left)); add(WS.app.fromMine = WS.app.fromMine || {}, id, -(n - left)); } }
      const before = { ...A2.bag };
      grab(mch, (id) => FORGE_GOODS.test(id), A2.bag, BAG_STACKS / 2);
      if (!A2.storeFull) grab(mch, (id) => STONE_GOODS.test(id), A2.bag, BAG_STACKS);
      for (const [id, n] of Object.entries(A2.bag)) { const d = n - (before[id] || 0); if (d > 0) add(WS.app.fromMine = WS.app.fromMine || {}, id, d); }
      A2.trips++;
      const empty = !Object.keys(A2.bag).length;
      if (empty) A2.rest = now + 600; // у копра пусто — передохнуть полминуты
      return go(FG().toMine, true, 'forge', empty ? 'У копра пусто, возвращается в кузню' : 'Несёт добычу в кузню');
    }
    if (A2.st === 'toYard') {
      const store = containers(CASTLE.works.yard.store);
      if (!store) { ap.until = now + 40; return; }
      drop(store, (id) => STONE_GOODS.test(id), A2.bag, 10);
      if (Object.keys(A2.bag).some((id) => STONE_GOODS.test(id))) { A2.storeFull = now + 12000; A2.msg = 'Склад строителя полон'; say('vaska', 'У Мирона на складе камня под завязку — остальное верну к копру. Пусть строит!'); }
      return go(FG().toYard, true, 'forge', 'Возвращается в кузню');
    }
    A2.st = 'forge';
  } catch (err) { report('Васька', 'шаг работы', err); ap.until = now + 100; }
}

// ---------- Тикающие участки ----------
function keepArea(what, o) {
  const name = 'acastle_' + what;
  runCmd(`tickingarea remove ${name}`);
  if (!WS.keep || !o) return;
  if (what === 'mine') {
    const r = MW().ring, e = C.GALLERY + C.DRIFT + C.BRANCH + 2, a = Wc([r[0] - e, 0, r[1] - e]), b = Wc([r[2] + e, 0, r[3] + e]);
    runCmd(`tickingarea add ${a.x} 0 ${a.z} ${b.x} 0 ${b.z} ${name}`);
  } else {
    let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity];
    for (const [, x1, , z1, x2, , z2] of o.pieces) { mn = [Math.min(mn[0], x1), Math.min(mn[1], z1)]; mx = [Math.max(mx[0], x2), Math.max(mx[1], z2)]; }
    const a = Wc([mn[0] - 3, 0, mn[1] - 3]), b = Wc([mx[0] + 3, 0, mx[1] + 3]);
    runCmd(`tickingarea add ${a.x} 0 ${a.z} ${b.x} 0 ${b.z} ${name}`);
  }
}

// ======================= РАЗГОВОР =======================
const TOOLS_RU = { wooden: 'деревянная', stone: 'каменная', golden: 'золотая', iron: 'железная', diamond: 'алмазная', netherite: 'незеритовая' };
function mineReport() {
  const M = WS.mine, chests = containers(MW().chests);
  const inChest = {};
  if (chests) for (const inv of chests) for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) add(inChest, it.typeId.replace('minecraft:', ''), it.amount); }
  const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k.replace('minecraft:', '')} ${n}`).join(', ') || 'пусто';
  return [
    `§7Сейчас:§r ${M.on ? (M.st === 'work' ? workMsg() : M.msg) : 'отдыхает'}`,
    `§7Кирка:§r ${M.tool ? `${TOOLS_RU[M.tool]}, хватит ещё на ${Math.max(0, M.uses)} блоков` : 'нет'}. §7Факелов:§r ${M.torch}${M.bag['minecraft:coal'] ? `, угля на факелы ${M.bag['minecraft:coal']}` : ''}`,
    `§7Горизонты:§r ${hz().map((h, k) => `${h.title} (y ${h.y})${k < M.open ? '' : ' — закрыт'}`).join('; ')}`,
    `§7Выкопано блоков:§r ${M.dug}. §7В сумке:§r ${top(M.bag)}`,
    `§7В сундуках у копра:§r ${top(inChest)}`,
    ...(Object.keys(M.skip).length ? [`§7Оставил руду (нужна кирка лучше):§r ${Object.entries(M.skip).map(([k, n]) => `${k} ${n}`).join(', ')}`] : []),
    ...(M.layRails ? [`§7Рельсы:§r уложено в ствол ${M.railShaft} шагов, в запасе ${M.rails}`] : []),
  ].join('\n');
}
async function minerTalk(pl) {
  const M = WS.mine;
  const btn = [];
  const f = new ActionFormData().title(WORKERS.kondrat.name);
  let intro = M.on ? '' : 'Рудокоп я. Шахту дадите — накопаю. В бочку у копра положите кирку, а для света — факелы или уголь. Добычу я сам в сундуки сложу.\n\n';
  f.body(intro + mineReport());
  if (!M.on) btn.push(['Начинай копать', () => { M.on = true; M.st = M.tool ? 'work' : 'tool'; keepArea('mine', true); say('kondrat', 'Ну, с богом. Пошёл.'); }]);
  else btn.push(['Передохни', () => { M.on = false; act('kondrat', 0); keepArea('mine', null); say('kondrat', 'Передохну. Скажешь — продолжу.'); }]);
  const H = hz();
  if (M.open < H.length) btn.push([`Копать глубже: ${H[M.open].title} (y ${H[M.open].y})`, () => {
    M.open++; if (M.phase === 'done') { M.phase = 'hdone'; M.st = 'unload'; }
    say('kondrat', `Добро. Как выработаю этот горизонт — пойду на ${H[M.open - 1].title.toLowerCase()}.`);
  }]);
  if (!M.layRails) btn.push(['Клади рельсы в ствол (рельсы — в бочку)', () => { M.layRails = true; say('kondrat', 'Положи рельсы в бочку у копра — буду класть по пути. Как уложу до горизонта — поеду на вагонетке.'); }]);
  btn.push(['Пока', () => {}]);
  for (const [t] of btn) f.button(t);
  const r = await show(pl, f);
  if (r.canceled) return;
  btn[r.selection][1]();
  wsave(); wflush();
}
async function builderTalk(pl) {
  const B = WS.build, have = storeUnits() || {};
  const stock = ['stone', 'wood', 'glass', 'iron'].map((c) => `${C.CAT_NAME[c]} ${have[c] || 0}`).join(', ');
  const list = ORDERS().filter(orderOpen);
  const f = new ActionFormData().title(WORKERS.miron.name + ' — книга работ');
  const cost = (o) => Object.entries(o.cost).filter(([c]) => c !== 'other').map(([c, n]) => `${C.CAT_NAME[c]} ${n}`).join(', ');
  const ready = (o) => Object.entries(o.cost).every(([c, n]) => c === 'other' || (have[c] || 0) + (B.cart[c] || 0) >= n);
  const body = [
    B.order ? `§7Сейчас:§r ${B.msg}` : 'Зодчий я. Стены ваши катапультами биты, да ничего — сложим. Выбирай, с чего начать: сначала частокол, чтобы нечисть не лезла, потом камень.',
    `§7На складе:§r ${stock} (камень — булыжник, кирпич, андезит; дерево — брёвна и доски)`,
    `§7Сделано работ:§r ${Object.keys(B.done).length} из ${ORDERS().length}`,
  ].join('\n');
  f.body(body);
  const btn = [];
  if (!B.order) for (const o of list.slice(0, 10)) btn.push([`${ready(o) ? '§2' : '§8'}${o.title}§r\n${cost(o)}`, o]);
  btn.push(['Пока', null]);
  for (const [t] of btn) f.button(t);
  const r = await show(pl, f);
  if (r.canceled || !btn[r.selection][1]) return;
  const o = btn[r.selection][1];
  const c = new ActionFormData().title(o.title).body(`Нужно: ${cost(o)}.\nНа складе: ${stock}.\n\nВзять заказ? Материалы я заберу со склада сразу.`).button('Берись').button('Не сейчас');
  const r2 = await show(pl, c);
  if (r2.canceled || r2.selection !== 0) return;
  const err = startOrder(o.id);
  say('miron', err || 'Добро. Беру материал и иду размечать.');
  wflush();
}

// Кнопки сюжета в окне работника (кузнец, подмастерье): всё, кроме «прощай»
function storyButtons(pl, id) {
  const node = storyNode(pl, id);
  if (!node) return { text: null, opts: [] };
  const opts = (node.options || []).filter((o) => o.run || o.next);
  return { text: opts.length ? node.text : null, opts };
}
const forgeLines = () => {
  const M = WS.smith, st = forgeStock() || {};
  const show2 = (id) => `${({ 'minecraft:iron_ingot': 'железо', 'minecraft:raw_iron': 'сырое железо', 'minecraft:coal': 'уголь', 'minecraft:diamond': 'алмазы', 'minecraft:gold_ingot': 'золото', 'minecraft:raw_gold': 'сырое золото' })[id]} ${st[id] || 0}`;
  return [
    `§7Сейчас:§r ${M.job ? (M.st === 'forge' ? `куёт ${M.job.title} — ${Math.min(99, Math.floor(100 * M.prog / (M.total || 1)))}%` : M.st === 'smelt' ? 'плавит руду' : M.msg) : 'ждёт заказа'}`,
    `§7Очередь (${M.q.length}):§r ${M.q.map((o) => o.title).slice(0, 6).join('; ') || 'пусто'}${wanted().length ? `\n§7Мечи новобранцам (просит капитан):§r ${wanted().map(guardName).join(', ')}` : ''}`,
    `§7В сундуке кузни:§r ${['minecraft:iron_ingot', 'minecraft:raw_iron', 'minecraft:coal', 'minecraft:diamond', 'minecraft:gold_ingot', 'minecraft:raw_gold'].map(show2).join(', ')}`,
  ].join('\n');
};
const queued = (guard, slot, tier) => [WS.smith.job, ...WS.smith.q].some((o) => o && o.guard === guard && o.slot === slot && o.tier === tier);
// Следующие куски брони по званию (не больше 4 за раз)
function byRankOrders(tier) {
  const out = [];
  for (const g of byRank()) for (const slot of ['head', 'chest', 'legs', 'feet']) {
    if (out.length >= 4) return out;
    if (TIER_N(gearOf(g.id)[slot]) >= TIER_N(tier) || queued(g.id, slot, tier)) continue;
    out.push(makeOrder('armor', tier, g.id, slot));
  }
  return out;
}
async function forgeTalk(pl) {
  const M = WS.smith, sb = storyButtons(pl, 'gordey');
  const f = new ActionFormData().title(WORKERS.gordey.name + ' — кузня')
    .body((sb.text ? `§e${sb.text}§r\n\n` : 'Кузнец я. Железо и уголь — в сундук кузни, остальное Васька от шахты принесёт. Что ковать?\n\n') + forgeLines());
  const btn = [];
  const full = M.q.length >= 12;
  if (!full) {
    btn.push(['Железная броня страже — по званию', () => { const o = byRankOrders('iron'); M.q.push(...o); return o.length ? `В очередь: ${o.map((q) => q.title).join('; ')}.` : 'Все уже в железе (или очередь занята).'; }]);
    btn.push(['Алмазная броня страже — по званию', () => { const o = byRankOrders('diamond'); M.q.push(...o); return o.length ? `В очередь: ${o.map((q) => q.title).join('; ')}.` : 'Все уже в алмазах.'; }]);
    btn.push(['Снарядить одного…', 'one']);
    btn.push(['Железная кирка — Кондрату (3 железа)', () => { M.q.push(makeOrder('pick', 'iron')); return 'Скую кирку, Васька отнесёт к копру.'; }]);
    btn.push(['Алмазная кирка — Кондрату (3 алмаза)', () => { M.q.push(makeOrder('pick', 'diamond')); return 'Алмазная — добро. Скую.'; }]);
    btn.push(['Рельсы для шахты — 16 шт. (6 железа)', () => { M.q.push(makeOrder('rails')); return 'Рельсы скую, Васька отнесёт.'; }]);
  }
  if (M.q.length) btn.push([`Очистить очередь (${M.q.length})`, () => { M.q = []; return 'Очередь пуста.'; }]);
  for (const o of sb.opts) btn.push([o.text, { story: o }]);
  btn.push(['Пока', null]);
  for (const [t] of btn) f.button(t);
  const r = await show(pl, f);
  if (r.canceled || !btn[r.selection][1]) return;
  const act2 = btn[r.selection][1];
  if (act2.story) return runOption(pl, 'gordey', act2.story);
  if (act2 === 'one') return forgeOne(pl);
  say('gordey', act2()); wsave(); wflush();
}
async function forgeOne(pl) {
  const M = WS.smith, list = byRank();
  const f = new ActionFormData().title('Кого снарядить').body('Стражники по званию. В скобках — что на нём сейчас.');
  for (const g of list) f.button(`${g.name}\n§8${['head', 'chest', 'legs', 'feet', 'hand'].map((k) => (gearOf(g.id)[k] ? gearOf(g.id)[k].replace('minecraft:', '').replace(/_.*/, '') : '—')).join(' ')}`);
  f.button('Назад');
  const r = await show(pl, f);
  if (r.canceled || r.selection >= list.length) return;
  const g = list[r.selection], opts = [];
  for (const tier of ['iron', 'diamond']) {
    for (const slot of ['head', 'chest', 'legs', 'feet']) if (TIER_N(gearOf(g.id)[slot]) < TIER_N(tier)) opts.push(makeOrder('armor', tier, g.id, slot));
    if (TIER_N(gearOf(g.id).hand) < TIER_N(tier)) opts.push(makeOrder('sword', tier, g.id, 'hand'));
  }
  const f2 = new ActionFormData().title(g.name).body(opts.length ? 'Что ковать?' : 'На нём уже всё лучшее.');
  for (const o of opts) f2.button(`${o.title.split(' — ')[0]}\n§8${Object.entries(o.cost).map(([m, n]) => MAT_RU[m] + ' ' + n).join(', ')}`);
  f2.button('Назад');
  const r2 = await show(pl, f2);
  if (r2.canceled || r2.selection >= opts.length) return;
  M.q.push(opts[r2.selection]); say('gordey', 'В очередь: ' + opts[r2.selection].title + '.'); wsave(); wflush();
}
async function appTalk(pl) {
  const A2 = WS.app, sb = storyButtons(pl, 'vaska');
  const moved = Object.entries(A2.moved).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => k.replace('minecraft:', '') + ' ' + n).join(', ') || 'пока ничего';
  const f = new ActionFormData().title(WORKERS.vaska.name)
    .body((sb.text ? `§e${sb.text}§r\n\n` : 'Я ношу! От копра — руду и уголь в кузню, камень — Мирону на склад, а из кузни Кондрату — кирки и рельсы.\n\n') +
      `§7Сейчас:§r ${A2.msg}. §7Ходок к шахте:§r ${A2.trips}.\n§7В руках:§r ${Object.entries(A2.bag).map(([k, n]) => k.replace('minecraft:', '') + ' ' + n).join(', ') || 'пусто'}\n§7Всего перенёс:§r ${moved}`);
  const btn = sb.opts.map((o) => [o.text, o]);
  btn.push(['Пока', null]);
  for (const [t] of btn) f.button(t);
  const r = await show(pl, f);
  if (r.canceled || !btn[r.selection][1]) return;
  return runOption(pl, 'vaska', btn[r.selection][1]);
}
export const workerTalk = guarded(async (pl, id) => { if (!WS) wload(); if (id === 'kondrat') await minerTalk(pl); else if (id === 'miron') await builderTalk(pl); else if (id === 'gordey') await forgeTalk(pl); else await appTalk(pl); });

// ======================= КОМАНДЫ ОТЛАДКИ =======================
export function workCommand(msg, src) {
  if (!WS) wload();
  const [cmd, arg] = (msg || '').trim().split(/\s+/);
  const out = [];
  if (cmd === 'save') { wflush(); return; } // сохранить сразу (для проверочного прогона)
  if (!cmd || cmd === 'help') out.push('§6acastle:work§r status | fast N | tp kondrat|miron | label | pause | resume | keep on|off | ledger | fill (склад и бочка для проверки) | order <id> | orders | reset kondrat|miron | spawn');
  else if (!S || !S.origin) out.push('Замок ещё не поставлен.');
  else if (cmd === 'status') {
    const M = WS.mine, B = WS.build;
    out.push(`§6[Работники]§r скорость ×${WS.fast}, участки держатся: ${WS.keep ? 'да' : 'нет'}, тик игры ≈${Math.round(tickMs)} мс`);
    for (const id of Object.keys(WORKERS)) { const e = entOf(id); out.push(`${WORKERS[id].name}: ${e ? 'на месте (' + [e.location.x, e.location.y, e.location.z].map(Math.floor).join(' ') + ')' : 'нет существа'}${movers[id] ? ', идёт' : ''}`); }
    out.push(`Кондрат: ${M.on ? 'работает' : 'отдыхает'}, сост. ${M.st}, фаза ${M.phase}, шаг ствола ${M.i}, горизонт ${M.h + 1}/${M.open}, двор ${M.g}, коридор ${M.n + 1}: ${M.d}, ветка ${M.side > 0 ? 'вправо' : 'влево'} ${M.b}; ${M.msg}`);
    out.push(mineReport());
    out.push(`Мирон: сост. ${B.st}, заказ ${B.order || 'нет'}, осталось ${bt.jobs ? bt.jobs.length : '?'}, поставлено ${B.placed}, разобрано ${B.removed}, лесов ${B.scaff.length}, переходов напрямик ${WS.dbgDirect || 0}; ${B.msg}`);
    out.push(`Гордей: ${WS.smith.st}, ${WS.smith.msg}; очередь ${WS.smith.q.length}; сделано: ${Object.entries(WS.smith.made).map(([k, n]) => k.replace('minecraft:', '') + ' ' + n).join(', ') || 'ничего'}`);
    out.push(`Васька: ${WS.app.st}, ${WS.app.msg}; ходок ${WS.app.trips}; в руках ${Object.entries(WS.app.bag).map(([k, n]) => k.replace('minecraft:', '') + ' ' + n).join(', ') || 'пусто'}`);
    out.push(`Тележка Мирона: ${Object.entries(B.cart).map(([c, n]) => C.CAT_NAME[c] + ' ' + n).join(', ') || 'пусто'}`);
    if (WS.errs.length) out.push('§cОшибки:§r ' + WS.errs.join(' | '));
  } else if (cmd === 'fast') { WS.fast = Math.max(1, Math.min(50, parseInt(arg, 10) || 1)); out.push('Скорость работы ×' + WS.fast); }
  else if (cmd === 'tp') { const e = entOf(arg === 'miron' ? 'miron' : 'kondrat'); if (e && src) { src.teleport(e.location); out.push('Перенёс к ' + WORKERS[arg === 'miron' ? 'miron' : 'kondrat'].name); } else out.push('Работника не видно.'); }
  else if (cmd === 'label') { WS.label = !WS.label; if (!WS.label) for (const id of Object.keys(WORKERS)) { const e = entOf(id); if (e) e.nameTag = WORKERS[id].name; } out.push('Подписи над головой: ' + (WS.label ? 'вкл' : 'выкл')); }
  else if (cmd === 'pause') { WS.paused = true; out.push('Работники стоят.'); }
  else if (cmd === 'resume') { WS.paused = false; out.push('Работники продолжают.'); }
  else if (cmd === 'keep') { WS.keep = arg !== 'off'; keepArea('mine', WS.keep && WS.mine.on); keepArea('build', WS.keep && WS.build.order ? orderOf(WS.build.order) : null); out.push('Участки держатся прогруженными: ' + (WS.keep ? 'да' : 'нет')); }
  else if (cmd === 'ledger') {
    const L = WS.led;
    out.push('Добыто: ' + (Object.entries(L.mined).map(([k, n]) => k.replace('minecraft:', '') + ' ' + n).join(', ') || 'ничего'));
    out.push('Сдано в сундуки: ' + (Object.entries(L.dep).map(([k, n]) => k.replace('minecraft:', '') + ' ' + n).join(', ') || 'ничего'));
    out.push('Потрачено (заделка, факелы): ' + (Object.entries(L.used).map(([k, n]) => k.replace('minecraft:', '') + ' ' + n).join(', ') || 'ничего'));
    const bad = checkLedger(), bb = checkBuildLedger();
    out.push(bad.length || bb.length ? '§cСчёт НЕ сходится§r' : '§aСчёт сходится§r: добыто = в сумке + сдано + потрачено; у Мирона взято = поставлено + возвращено + в тележке');
  } else if (cmd === 'fill') {
    const st = containers(YW().store), br = containers([MW().barrel], 'minecraft:barrel');
    if (st) { for (const inv of st) { putItems(inv, 'minecraft:cobblestone', 1280); putItems(inv, 'minecraft:spruce_log', 256); putItems(inv, 'minecraft:glass', 64); putItems(inv, 'minecraft:iron_ingot', 32); } }
    if (br) { putItems(br[0], 'minecraft:iron_pickaxe', 3); putItems(br[0], 'minecraft:rail', 64); putItems(br[0], 'minecraft:torch', 64); }
    const fc = forgeChests(); if (fc) { putItems(fc[0], 'minecraft:iron_ingot', 64); putItems(fc[0], 'minecraft:raw_iron', 32); putItems(fc[0], 'minecraft:coal', 16); putItems(fc[0], 'minecraft:diamond', 24); }
    out.push('Положил на склад строителя камень, брёвна, стекло, железо; в бочку у копра — 3 железные кирки, рельсы и факелы; в сундук кузни — железо, сырое железо, уголь, алмазы.');
  } else if (cmd === 'orders') out.push(ORDERS().map((o) => `${WS.build.done[o.id] ? '✓' : orderOpen(o) ? '•' : '·'} ${o.id}: ${o.title}`).join('\n'));
  else if (cmd === 'order') { const err = startOrder(arg); out.push(err || 'Заказ начат: ' + arg); }
  else if (cmd === 'reset') {
    if (arg === 'miron') { WS.build = wfresh(null).build; WS.bled = wfresh(null).bled; bt.jobs = null; bt.gen = null; delete movers.miron; keepArea('build', null); }
    else { const keepOpen = WS.mine.open; WS.mine = wfresh(null).mine; WS.mine.open = keepOpen; WS.led = wfresh(null).led; mt.q = null; mt.face = null; mt.pending = null; delete movers.kondrat; keepArea('mine', null); }
    out.push('Сброшено. Работник начнёт с начала (уже выкопанное и построенное в мире остаётся).');
  } else if (cmd === 'spawn') { for (const id of Object.keys(WORKERS)) { const e = entOf(id); if (e) try { e.triggerEvent('acastle:despawn'); } catch (err) { /* нет */ } ents[id] = undefined; } ensureWorkers(); out.push('Работники поставлены заново.'); }
  else out.push('Не знаю такой команды. /scriptevent acastle:work help');
  wsave(); wflush();
  const text = out.join('\n');
  if (src && src.sendMessage) src.sendMessage(text); else world.sendMessage(text);
}

// ======================= ГЛАВНЫЙ ЦИКЛ =======================
let lastTick = 0, every = 0;
export function workTick() {
  const now = system.currentTick;
  const dtMs = Date.now() - lastNow; lastNow = Date.now(); tickMs = tickMs * 0.9 + dtMs * 0.1;
  if (!S || !S.origin || S.build) return;
  if (!WS) wload();
  if (!CASTLE.works) return;
  // Новый замок — работа с начала
  if (!WS.origin || WS.origin.join() !== S.origin.join()) { WS = wfresh(S.origin.slice()); HZ = null; wsave(); }
  if (++every % 20 === 0) ensureWorkers();
  if (WS.paused) { wflush(); return; }
  const dt = Math.max(1, Math.min(20, now - (lastTick || now))); lastTick = now;
  // В игре цикл идёт каждый тик (dt = 1); если тики пропущены — догоняем шагами
  for (let k = 0; k < dt; k++) {
    const t = now - dt + 1 + k;
    try { mineTick(t); } catch (e) { report('Кондрат', 'цикл', e); }
    try { buildTick(t); } catch (e) { report('Мирон', 'цикл', e); }
    try { smithTick(t); } catch (e) { report('Гордей', 'цикл', e); }
    try { appTick(t); } catch (e) { report('Васька', 'цикл', e); }
  }
  if (WS.label && every % 20 === 0) {
    const M = WS.mine, B = WS.build;
    const ek = entOf('kondrat'); if (ek) ek.nameTag = `${WORKERS.kondrat.name}\n§7${M.on ? (M.st === 'work' ? workMsg() : M.msg) : 'отдыхает'}`;
    const em = entOf('miron'); if (em) em.nameTag = `${WORKERS.miron.name}\n§7${B.msg}`;
    const eg = entOf('gordey'); if (eg) eg.nameTag = `${WORKERS.gordey.name}\n§7${WS.smith.msg}`;
    const ev = entOf('vaska'); if (ev) ev.nameTag = `${WORKERS.vaska.name}\n§7${WS.app.msg}`;
  }
  // рядом с кузней — ход работы кузнеца внизу экрана
  if (every % 20 === 0 && WS.smith.job && CASTLE.works.forge) {
    const a = Wc(CASTLE.works.forge.anvil), M = WS.smith;
    const text = M.st === 'forge' ? `§6Гордей куёт: ${M.job.title} — ${Math.min(99, Math.floor(100 * M.prog / (M.total || 1)))}%` : M.st === 'smelt' ? '§6Гордей плавит руду' : `§7Гордей: ${M.msg}`;
    for (const pl of players()) if (Math.hypot(pl.location.x - a.x, pl.location.z - a.z) < 10 && Math.abs(pl.location.y - a.y) < 6) pl.onScreenDisplay.setActionBar(text);
  }
  if (every % 40 === 0) wflush();
}
