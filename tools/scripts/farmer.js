// Пахарь Назар и скот (0.11.0). Назар — существо «работник» (его ведёт скрипт): ходит по огороду,
// жнёт спелое, тут же сеет заново, носит урожай в сундук у загона, заглядывает к скоту.
// Скот (коровы, овцы, куры, свинья) живёт в загоне; по утрам в сундуке прибавляются молоко,
// яйца и шерсть. Всё настоящее: грядки растут сами, как в игре, Назар берёт только спелое.
import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import { S, save, W, DIM, blockAt } from './state.js';
import { CASTLE } from './castle_data.js';

const F = () => CASTLE.farm;
const TAG = 'acastle_npc_nazar';
const CROP = { potatoes: ['minecraft:potatoes', 'minecraft:potato', 2], carrots: ['minecraft:carrots', 'minecraft:carrot', 2], beetroot: ['minecraft:beetroot', 'minecraft:beetroot', 1], wheat: ['minecraft:wheat', 'minecraft:wheat', 1] };
const STOCK = [['minecraft:cow', 2], ['minecraft:sheep', 2], ['minecraft:chicken', 3], ['minecraft:pig', 1]];
const T = { e: null, st: 'idle', until: 0, path: null, k: 0, bag: {}, scan: 0, goal: null, then: null, msg: 'отдыхает' };
export const farmerState = () => T.msg;

const PASS = /air|potatoes|carrots|beetroot|wheat|short_grass|tall_grass|fern|flower|poppy|dandelion|allium|cornflower|lily|tulip|daisy|bluet|orchid|carpet|fence_gate|torch|sapling/;
const passable = (x, y, z) => { const b = blockAt({ x, y, z }), h = blockAt({ x, y: y + 1, z }), g = blockAt({ x, y: y - 1, z }); return !!b && !!h && !!g && (b.isAir || PASS.test(b.typeId)) && (h.isAir || PASS.test(h.typeId)) && !g.isAir && !g.isLiquid; };
// Путь по огороду: поиск в ширину по клеткам внутри ограды (и на шаг вокруг)
function route(from, to) {
  const [x1, z1, x2, z2] = F().garden, o = W([x1 - 1, 0, z1 - 2]), o2 = W([x2 + 1, 0, z2 + 1]);
  const key = (c) => c.x + ',' + c.z, prev = new Map([[key(from), null]]), q = [from];
  for (let h = 0; h < q.length && h < 4000; h++) {
    const c = q[h];
    if (c.x === to.x && c.z === to.z) { const out = []; for (let t = c; t; t = prev.get(key(t))) out.unshift(t); return out; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = { x: c.x + dx, y: c.y, z: c.z + dz };
      if (nx.x < o.x || nx.x > o2.x || nx.z < o.z || nx.z > o2.z || prev.has(key(nx)) || !passable(nx.x, nx.y, nx.z)) continue;
      prev.set(key(nx), c); q.push(nx);
    }
  }
  return null;
}
const cellOf = (e) => ({ x: Math.floor(e.location.x), y: Math.round(e.location.y), z: Math.floor(e.location.z) });
const act = (n) => { try { T.e.setProperty('acastle:act', n); } catch (e) { /* ещё не готов */ } };
function goTo(to, then, msg) {
  const p = route(cellOf(T.e), to);
  if (!p) { T.st = 'idle'; T.until = system.currentTick + 100; return false; }
  T.path = p; T.k = 0; T.st = 'walk'; T.then = then; T.msg = msg; act(1);
  return true;
}
function ensureFarmer() {
  let ok = false; try { ok = !!T.e && T.e.isValid; } catch (e) { ok = false; }
  if (ok) return true;
  let list = []; try { list = DIM().getEntities({ tags: [TAG] }); } catch (e) { return false; }
  for (const x of list.slice(1)) try { x.triggerEvent('acastle:despawn'); } catch (e) { /* нет */ }
  if (list[0]) { T.e = list[0]; return true; }
  const h = W(F().home);
  if (!blockAt(h)) return false;
  try {
    const e = DIM().spawnEntity('acastle:worker', { x: h.x + 0.5, y: h.y, z: h.z + 0.5 }, { spawnEvent: 'acastle:as_nazar', initialPersistence: true });
    e.nameTag = 'Пахарь Назар'; e.addTag(TAG); e.addTag('acastle_free'); T.e = e; T.st = 'idle'; T.until = system.currentTick + 60;
    return true;
  } catch (err) { return false; }
}
// Скот в загоне: недостающих — завести
function ensureStock() {
  const [x1, z1, x2, z2] = F().pen, a = W([x1, 0, z1]);
  if (!blockAt(a)) return;
  let have = []; try { have = DIM().getEntities({ tags: ['acastle_stock'] }); } catch (e) { return; }
  for (const [type, need] of STOCK) {
    let n = have.filter((e) => e.typeId === type).length;
    for (; n < need; n++) {
      const c = W([x1 + Math.floor(Math.random() * (x2 - x1 + 1)), 0, z1 + Math.floor(Math.random() * (z2 - z1 + 1))]);
      try { const e = DIM().spawnEntity(type, { x: c.x + 0.5, y: c.y, z: c.z + 0.5 }); e.addTag('acastle_stock'); } catch (err) { /* позже */ }
    }
  }
}
function chestInv() { const b = blockAt(W(F().chest)); try { return b && b.typeId === 'minecraft:chest' ? b.getComponent('minecraft:inventory').container : null; } catch (e) { return null; } }
const put = (inv, id, n) => { try { const rest = inv.addItem(new ItemStack(id, n)); return !rest; } catch (e) { return false; } };
// Утро: скот даёт молоко, яйца и шерсть (если он есть и сундук рядом)
export function farmMorning() {
  if (!F()) return;
  const inv = chestInv(); if (!inv) return;
  let have = []; try { have = DIM().getEntities({ tags: ['acastle_stock'] }); } catch (e) { return; }
  const cnt = (t) => have.filter((e) => e.typeId === t).length;
  if (cnt('minecraft:cow')) put(inv, 'minecraft:milk_bucket', 1);
  if (cnt('minecraft:chicken')) put(inv, 'minecraft:egg', cnt('minecraft:chicken'));
  if (cnt('minecraft:sheep')) put(inv, 'minecraft:white_wool', cnt('minecraft:sheep'));
}
function nextJob() {
  const fields = F().fields, now = system.currentTick;
  // полная сума или вечер — к сундуку
  const carried = Object.values(T.bag).reduce((a, b) => a + b, 0);
  if (carried >= 12) return goTo(W([F().chest[0] + 0, 0, F().chest[2] + 1]), 'unload', 'несёт урожай в сундук');
  for (let i = 0; i < 40; i++) {
    const [x, z, kind] = fields[T.scan++ % fields.length], c = W([x, 0, z]), b = blockAt(c);
    if (!b) return false;
    const [bid] = CROP[kind];
    const ripe = b.typeId === bid && b.permutation.getState('growth') === 7, bare = b.isAir && (blockAt({ x: c.x, y: c.y - 1, z: c.z }) || {}).typeId === 'minecraft:farmland';
    if (!ripe && !bare) continue;
    T.goal = { c, kind, ripe };
    return goTo(c, 'reap', ripe ? 'идёт жать' : 'идёт сеять');
  }
  if (carried > 0) return goTo(W([F().chest[0], 0, F().chest[2] + 1]), 'unload', 'несёт урожай в сундук');
  // всё растёт — к скоту или на отдых
  if (Math.random() < 0.5) return goTo(W([F().gate[0] - 1, 0, F().gate[2]]), 'feed', 'идёт к скоту');
  T.st = 'idle'; T.until = now + 300; T.msg = 'ждёт, пока поспеет'; act(0);
  return true;
}
let n = 0;
export function farmerTick() {
  if (!S || !S.origin || !F()) return;
  n++;
  if (n % 100 === 1) ensureStock();
  if (n % 10 === 1 && !ensureFarmer()) return;
  let ok = false; try { ok = !!T.e && T.e.isValid; } catch (e) { ok = false; }
  if (!ok) return;
  const now = system.currentTick, e = T.e;
  if (T.st === 'walk') {
    const P = T.path, last = P.length - 1;
    T.k += 0.3;
    const i = Math.min(Math.floor(T.k), last), j = Math.min(i + 1, last), t = Math.min(T.k - i, 1);
    const x = P[i].x + (P[j].x - P[i].x) * t + 0.5, z = P[i].z + (P[j].z - P[i].z) * t + 0.5;
    const dx = P[j].x - P[i].x, dz = P[j].z - P[i].z;
    try { e.teleport({ x, y: P[i].y, z }, dx || dz ? { rotation: { x: 0, y: (Math.atan2(-dx, dz) * 180) / Math.PI } } : {}); } catch (err) { return; }
    if (T.k >= last) { T.st = T.then; T.until = now + (T.then === 'feed' ? 200 : 30); act(2); }
    return;
  }
  if (now < T.until) return;
  if (T.st === 'reap') {
    const g = T.goal, b = blockAt(g.c), [bid, item, cnt] = CROP[g.kind];
    if (b) {
      if (b.typeId === bid && b.permutation.getState('growth') === 7) T.bag[item] = (T.bag[item] || 0) + cnt + (Math.random() < 0.5 ? 1 : 0);
      try { b.setPermutation(BlockPermutation.resolve(bid, { growth: 0 })); } catch (err) { /* не грядка */ }
    }
    T.st = 'idle'; T.until = now + 10; T.msg = 'работает на грядках'; return;
  }
  if (T.st === 'unload') {
    const inv = chestInv();
    if (inv) for (const [id, cnt] of Object.entries(T.bag)) if (put(inv, id, cnt)) delete T.bag[id];
    S.f.harvest = (S.f.harvest || 0) + 1; save();
    T.st = 'idle'; T.until = now + 100; T.msg = 'сложил урожай'; act(0); return;
  }
  if (T.st === 'feed') { T.st = 'idle'; T.until = now + 60; T.msg = 'покормил скот'; act(0); return; }
  nextJob();
}
