// Помощники для сюжета (story.js, stages.js): задания, флаги, предметы игрока, реплики,
// ремонт, переезд жителей, места тайги. Сюжет получает этот объект в каждом вызове.
import { world, ItemStack } from '@minecraft/server';
import { S, save, W, DIM, dist, flat, blockAt, loaded, players, nearest, topAt } from './state.js';
import { CASTLE } from './castle_data.js';
import { NPCS, QUESTS, onEvent } from './story.js';
import { tagOf, npcIdOf, findNpc, whereOf, npcSpot, relocate } from './people.js';

const inventory = (pl) => pl.getComponent('minecraft:inventory').container;

export const api = {
  get S() { return S; },
  castle: CASTLE,
  // ---------- Задания ----------
  has: (q) => S.q[q] === 'active',
  done: (q) => S.q[q] === 'done',
  seen: (q) => !!S.q[q],
  start(q) {
    if (S.q[q]) return;
    S.q[q] = 'active'; S.guide = q; save();
    for (const pl of players()) { pl.onScreenDisplay.setTitle('§6Новое задание', { subtitle: QUESTS[q].title, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 }); pl.playSound('random.orb'); }
  },
  finish(q) {
    if (S.q[q] === 'done') return;
    S.q[q] = 'done';
    // путь переходит к другому открытому заданию с целью
    if (S.guide === q) S.guide = Object.keys(S.q).find((k) => S.q[k] === 'active' && QUESTS[k] && QUESTS[k].target) || null;
    save();
    for (const pl of players()) { pl.onScreenDisplay.setTitle('§aЗадание выполнено', { subtitle: QUESTS[q].title, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 }); pl.playSound('random.levelup'); }
    onEvent('done:' + q, api);
  },
  // Закрыть задание без титров (когда оно потеряло смысл по сюжету)
  drop(q) { if (S.q[q] === 'active') { S.q[q] = 'done'; if (S.guide === q) S.guide = null; save(); } },
  flag: (k, v) => { if (v === undefined) return S.f[k]; S.f[k] = v; save(); return v; },
  rank(r) { S.rank = r; save(); for (const pl of players()) pl.sendMessage(`§6Ваше звание: §e${r}`); },
  // ---------- Предметы игрока ----------
  count(pl, id) {
    const inv = inventory(pl); let n = 0;
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && it.typeId === id) n += it.amount; }
    return n;
  },
  hasAll: (pl, items) => items.every(([id, n]) => api.count(pl, id) >= n),
  take(pl, items) {
    if (!api.hasAll(pl, items)) return false;
    const inv = inventory(pl);
    for (const [id, need] of items) {
      let left = need;
      for (let i = 0; i < inv.size && left > 0; i++) {
        const it = inv.getItem(i);
        if (!it || it.typeId !== id) continue;
        if (it.amount <= left) { left -= it.amount; inv.setItem(i); } else { it.amount -= left; left = 0; inv.setItem(i, it); }
      }
    }
    return true;
  },
  give(pl, id, n = 1, name, lore) {
    const it = new ItemStack(id, n);
    if (name) it.nameTag = name;
    if (lore) it.setLore(lore);
    const rest = inventory(pl).addItem(it);
    if (rest) DIM().spawnItem(rest, pl.location);
  },
  // Именной предмет (донесение, приказ, оберег)
  hasNamed(pl, id, name) {
    const inv = inventory(pl);
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && it.typeId === id && it.nameTag === name) return true; }
    return false;
  },
  takeNamed(pl, id, name) {
    const inv = inventory(pl);
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && it.typeId === id && it.nameTag === name) { inv.setItem(i); return true; } }
    return false;
  },
  // Починить предмет в руке (кузнец)
  repairHeld(pl) {
    try {
      const eq = pl.getComponent('minecraft:equippable'), it = eq.getEquipment('Mainhand');
      const d = it && it.getComponent('minecraft:durability');
      if (!d || d.damage === 0) return false;
      d.damage = 0; eq.setEquipment('Mainhand', it); return true;
    } catch (e) { return false; }
  },
  // ---------- Реплики ----------
  // Реплика жителя всем рядом с ним (если житель не прогружен — всем)
  say(npcId, text, radius = 24) {
    const e = findNpc(npcId); const at = e ? e.location : null;
    for (const pl of players()) if (!at || dist(pl.location, at) < radius) pl.sendMessage(`§e${NPCS[npcId].name}:§r ${text}`);
  },
  tell: (text) => { for (const pl of players()) pl.sendMessage(text); },
  // ---------- Ремонт ----------
  openContract(unit) { if (!S.rep[unit]) { S.rep[unit] = { st: 'open' }; save(); } },
  repaired: (unit) => !!S.rep[unit] && S.rep[unit].st === 'done',
  // ---------- Жители ----------
  // Где живёт сейчас ('home', 'gate', 'place:<id>', …; null — ушёл) и переезд наутро
  live(npcId, where) { S.npcs[npcId] = where; save(); relocate(npcId); },
  where: (npcId) => whereOf(npcId),
  spot: (npcId) => npcSpot(npcId),
  arriveNextMorning(npcId, unit) {
    if (S.arrive.some((a) => a.npc === npcId)) return; // уже идёт
    S.arrive.push({ npc: npcId, unit, day: world.getDay() }); save();
  },
  // Состояние разбойника: 'hostile', 'flee', 'captive' или null (мирный). Запоминается и для новых появлений.
  setState(npcId, st) {
    S.st[npcId] = st || null; save();
    const e = findNpc(npcId); if (e) try { e.triggerEvent('acastle:' + (st || 'peaceful')); } catch (err) { /* ничего */ }
  },
  stageGuards(stage) { for (const p of CASTLE.posts) if (p.stage === stage && !p.archer) S.npcs[p.guard] = 'post'; save(); },
  tagOf, npcIdOf, findNpc: (id) => findNpc(id),
  // ---------- Места и точки ----------
  // Места тайги: выбрать точку для задания в стороне от замка
  setPlace(id, min, max) {
    if (S.places[id]) return;
    const o = W(CASTLE.origin), a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min);
    S.places[id] = { x: Math.round(o.x + Math.cos(a) * d), z: Math.round(o.z + Math.sin(a) * d), placed: false };
    save();
  },
  placeAt(id) { const p = S.places[id]; return p && p.host ? { x: p.host[0], y: p.host[1], z: p.host[2] } : null; },
  isSlot(block, name) { const c = CASTLE.slots[name]; if (!c || !block) return false; const at = W(c), l = block.location; return l.x === at.x && l.y === at.y && l.z === at.z; },
  // Игрок рядом с точкой замка
  near(pl, c, r = 6, dy = 3) { const p = W(c); return flat(pl.location, p) < r && Math.abs(pl.location.y - p.y) < dy; },
  absTime: () => world.getAbsoluteTime(),
  W: (c) => W(c), dim: () => DIM(), players: () => players(), nearest: (p) => nearest(p), topAt,
  loaded: (p) => loaded(p), blockAt: (p) => blockAt(p), dist, flat, save: () => save(),
};
