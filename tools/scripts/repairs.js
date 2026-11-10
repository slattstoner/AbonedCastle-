// Ремонт замка: сундуки-подряды и утро.
//  • подряд (S.rep[unit].st): 'open' — сундук и табличка у места работ, игрок кладёт материалы;
//    'paid' — всё собрано, ждём утра; 'due' — утро наступило, заплатки ставятся, когда их участки
//    загружены; 'done' — починено (сундук убран, лишнее выпало рядом);
//  • утро — сменился день (world.getDay()): после сна или просто наутро;
//  • наутро приходят жители (S.arrive) и прибираются их комнаты (единица rooms_N).
import { world } from '@minecraft/server';
import { S, save, W, DIM, center, blockAt, loaded } from './state.js';
import { CASTLE } from './castle_data.js';
import { CONTRACTS, onEvent } from './story.js';
import { api } from './api.js';

function signText(unit) {
  const c = CONTRACTS[unit], have = S.rep[unit].have || {};
  return [`§l${c.title}`, ...c.items.map(([id, n, name]) => `${name}: ${Math.min(have[id] || 0, n)}/${n}`)].join('\n');
}
// Забрать из контейнера нужное количество предметов
function takeFrom(inv, items) {
  for (const [id, need] of items) {
    let left = need;
    for (let i = 0; i < inv.size && left > 0; i++) {
      const it = inv.getItem(i);
      if (!it || it.typeId !== id) continue;
      if (it.amount <= left) { left -= it.amount; inv.setItem(i); } else { it.amount -= left; left = 0; inv.setItem(i, it); }
    }
  }
}

export function contractTick() {
  for (const [unit, st] of Object.entries(S.rep)) {
    if (st.st !== 'open') continue;
    const u = CASTLE.units[unit], c = CONTRACTS[unit];
    if (!u || !u.chest || !c) continue;
    const cb = blockAt(W(u.chest)), sb = blockAt(W(u.sign));
    if (!cb || !sb) continue;
    if (cb.typeId !== 'minecraft:chest') cb.setType('minecraft:chest');
    if (sb.typeId !== 'minecraft:standing_sign') { sb.setType('minecraft:standing_sign'); st.sign = ''; }
    const inv = cb.getComponent('minecraft:inventory').container;
    const have = {};
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) have[it.typeId] = (have[it.typeId] || 0) + it.amount; }
    st.have = have;
    const text = signText(unit);
    if (st.sign !== text) { try { const sc = sb.getComponent('minecraft:sign'); sc.setText(text); sc.setWaxed(true); st.sign = text; save(); } catch (e) { /* табличка ещё не готова */ } }
    if (!c.items.every(([id, n]) => (have[id] || 0) >= n)) continue;
    // Забираем нужное, лишнее остаётся в сундуке до починки и потом выпадает рядом
    takeFrom(inv, c.items);
    S.rep[unit] = { st: 'paid', day: world.getDay() }; save();
    try { sb.getComponent('minecraft:sign').setText(`§l${c.title}\nВсё собрано!\nК утру сделаем.`); } catch (e) { /* ничего */ }
    if (c.who) api.say(c.who, c.done || 'Всё собрано. Ночью поработаем — к утру сделаем.', 64);
    onEvent('paid:' + unit, api);
  }
}

// Заплатки единицы ставятся, когда их участки загружены (иначе игра отложит их)
function applyRepair(unit) {
  const u = CASTLE.units[unit], st = S.rep[unit];
  st.pieces = st.pieces || {};
  for (const [name, x1, y1, z1, x2, y2, z2] of u.pieces) {
    if (st.pieces[name]) continue;
    const a = W([x1, y1, z1]), b = W([x2, y2, z2]);
    if (!loaded(a) || !loaded(b) || !loaded({ x: a.x, y: a.y, z: b.z }) || !loaded({ x: b.x, y: a.y, z: a.z })) continue;
    try { DIM().runCommand(`structure load acastle:${name} ${a.x} ${a.y} ${a.z}`); st.pieces[name] = 1; save(); } catch (e) { /* позже */ }
  }
  if (!u.pieces.every(([name]) => st.pieces[name])) return;
  // Второй проход: факел или фонарь на шве двух заплаток падает, если его стена встала позже.
  // Когда встали все заплатки, ставим их ещё раз — теперь всё, к чему крепится свет, на месте.
  if (!st.again) { st.again = 1; st.pieces = {}; save(); return; }
  const c = u.pieces.reduce((m, q) => [Math.min(m[0], q[1]), Math.min(m[1], q[2]), Math.min(m[2], q[3]), Math.max(m[3], q[4]), Math.max(m[4], q[5]), Math.max(m[5], q[6])], [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
  if (u.pieces.length) {
    // осыпавшиеся при починке факелы и фонари — убрать с пола
    try {
      for (const e of DIM().getEntities({ type: 'minecraft:item', location: W([c[0], c[1], c[2]]), volume: { x: c[3] - c[0] + 1, y: c[4] - c[1] + 1, z: c[5] - c[2] + 1 } })) {
        const it = e.getComponent('minecraft:item');
        if (it && /torch|lantern|ladder|banner|carpet|frame/.test(it.itemStack.typeId)) e.remove();
      }
    } catch (e) { /* участок не загружен */ }
  }
  // Сундук-подряд и табличка больше не нужны; лишнее выпадает рядом
  if (u.chest) {
    const cb = blockAt(W(u.chest)), sb = blockAt(W(u.sign));
    if (cb && cb.typeId === 'minecraft:chest') {
      const inv = cb.getComponent('minecraft:inventory').container;
      for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) DIM().spawnItem(it, center(W(u.chest))); }
      inv.clearAll(); cb.setType('minecraft:air');
    }
    if (sb && sb.typeId === 'minecraft:standing_sign') sb.setType('minecraft:air');
  }
  S.rep[unit] = { st: 'done' }; save();
  onEvent('repaired:' + unit, api);
}

export function morningTick() {
  const today = world.getDay();
  for (const [unit, st] of Object.entries(S.rep)) {
    if (st.st === 'paid' && st.day < today) { st.st = 'due'; save(); }
    if (st.st === 'due') applyRepair(unit);
  }
  for (const a of [...S.arrive]) {
    if (a.day >= today) continue;
    S.arrive.splice(S.arrive.indexOf(a), 1);
    api.live(a.npc, 'home');
    // комнаты жителя прибираются один раз (повторный приход не ставит их заново)
    if (a.unit) {
      if (!(S.rep[a.unit] && S.rep[a.unit].st === 'done')) S.rep[a.unit] = { st: 'due' };
      S.f['tidy_' + a.npc] = 1; // «я тут порядок навёл» и дела, которые житель даёт после уборки
    }
    save();
    onEvent('arrived:' + a.npc, api);
  }
  if (S.day !== today) { S.day = today; save(); onEvent('morning', api); }
}
