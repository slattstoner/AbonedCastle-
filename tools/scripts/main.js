// Движок заданий замка. Только стабильные модули игры (@minecraft/server, @minecraft/server-ui),
// без экспериментальных настроек. Сюжет (разговоры и задания) — в story.js, данные замка
// и мест тайги собирает tools/build.js (castle_data.js, places_data.js).
//
// Как устроено:
//  • прогресс — одна запись в памяти мира (S), общая для всех игроков;
//  • /function castle шлёт acastle:castle_placed — отсюда известно, где стоит замок
//    (все координаты замка в данных — относительно его угла, S.origin — этот угол в мире);
//  • жители появляются сами, когда их место загружено (и возвращаются, если пропали);
//  • сундуки-подряды, утренний ремонт, волны у ворот, места тайги — в общем цикле раз в секунду;
//  • раненый житель (погиб в бою) возвращается на место через пару минут, а не сразу;
//  • короткие реплики, когда игрок проходит рядом с жителем (story.js: bark);
//  • /scriptevent acastle:jump <этап> — перейти сразу к началу этапа (для проверки в игре).
import { world, system, ItemStack } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { CASTLE } from './castle_data.js';
import { PLACES } from './places_data.js';
import { NPCS, QUESTS, CONTRACTS, dialog, onEvent, bark, jump } from './story.js';

const KEY = 'acastle:state';
const DIM = () => world.getDimension('overworld');
let S = null, dirty = false;

function fresh() {
  return { v: 1, origin: null, q: {}, f: {}, n: {}, rep: {}, arrive: [], npcs: {}, places: {}, down: {}, st: {}, day: world.getDay(), guide: null, rank: 'Гость' };
}
function load() {
  try { S = JSON.parse(world.getDynamicProperty(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = fresh();
  S.down = S.down || {}; S.st = S.st || {};
}
const save = () => { dirty = true; };
function flush() { if (dirty && S) { world.setDynamicProperty(KEY, JSON.stringify(S)); dirty = false; } }

// ---------- Координаты ----------
const W = (c) => ({ x: S.origin[0] + c[0], y: S.origin[1] + c[1], z: S.origin[2] + c[2] });
const center = (p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function blockAt(p) { try { return DIM().getBlock(p); } catch (e) { return undefined; } }
const loaded = (p) => !!blockAt(p);
const players = () => world.getPlayers();
const nearest = (p) => { let best = null, bd = Infinity; for (const pl of players()) { const d = flat(pl.location, p); if (d < bd) { bd = d; best = pl; } } return [best, bd]; };

// ---------- Задания ----------
const api = {
  get S() { return S; },
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
    if (S.guide === q) S.guide = Object.keys(S.q).find((k) => S.q[k] === 'active' && QUESTS[k].target) || null;
    save();
    for (const pl of players()) { pl.onScreenDisplay.setTitle('§aЗадание выполнено', { subtitle: QUESTS[q].title, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 }); pl.playSound('random.levelup'); }
    onEvent('done:' + q, api);
  },
  flag: (k, v) => { if (v === undefined) return S.f[k]; S.f[k] = v; save(); return v; },
  rank(r) { S.rank = r; save(); for (const pl of players()) pl.sendMessage(`§6Ваше звание: §e${r}`); },
  // Предметы игрока
  count(pl, id) {
    const inv = pl.getComponent('minecraft:inventory').container; let n = 0;
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && it.typeId === id) n += it.amount; }
    return n;
  },
  hasAll: (pl, items) => items.every(([id, n]) => api.count(pl, id) >= n),
  take(pl, items) {
    if (!api.hasAll(pl, items)) return false;
    const inv = pl.getComponent('minecraft:inventory').container;
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
    const rest = pl.getComponent('minecraft:inventory').container.addItem(it);
    if (rest) DIM().spawnItem(rest, pl.location);
  },
  // Именной предмет (донесение, приказ) — есть ли у игрока
  hasNamed(pl, id, name) {
    const inv = pl.getComponent('minecraft:inventory').container;
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && it.typeId === id && it.nameTag === name) return true; }
    return false;
  },
  takeNamed(pl, id, name) {
    const inv = pl.getComponent('minecraft:inventory').container;
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it && it.typeId === id && it.nameTag === name) { inv.setItem(i); return true; } }
    return false;
  },
  // Реплика жителя всем рядом с ним
  say(npcId, text, radius = 24) {
    const e = findNpc(npcId); const at = e ? e.location : null;
    for (const pl of players()) if (!at || dist(pl.location, at) < radius) pl.sendMessage(`§e${NPCS[npcId].name}:§r ${text}`);
  },
  tell: (text) => { for (const pl of players()) pl.sendMessage(text); },
  // Ремонт
  openContract(unit) { if (!S.rep[unit]) { S.rep[unit] = { st: 'open' }; save(); } },
  repairNextMorning(unit) { if (!S.rep[unit] || S.rep[unit].st === 'open') { S.rep[unit] = { st: 'paid', day: world.getDay() }; save(); } },
  repaired: (unit) => !!S.rep[unit] && S.rep[unit].st === 'done',
  // Жители: где живут сейчас ('home', 'gate', место тайги 'place:<id>') и переезд наутро
  live(npcId, where) { S.npcs[npcId] = where; save(); relocate(npcId); },
  // Состояние разбойника: 'hostile', 'flee', 'captive' или null (мирный). Запоминается и для новых появлений.
  setState(npcId, st) {
    S.st[npcId] = st || null; save();
    const e = findNpc(npcId); if (e) try { e.triggerEvent('acastle:' + (st || 'peaceful')); } catch (err) { /* ничего */ }
  },
  where: (npcId) => (npcId in S.npcs ? S.npcs[npcId] : NPCS[npcId].start),
  spot: (npcId) => npcSpot(npcId),
  absTime: () => world.getAbsoluteTime(),
  // Починить предмет в руке (кузнец)
  repairHeld(pl) {
    try {
      const eq = pl.getComponent('minecraft:equippable'), it = eq.getEquipment('Mainhand');
      const d = it && it.getComponent('minecraft:durability');
      if (!d || d.damage === 0) return false;
      d.damage = 0; eq.setEquipment('Mainhand', it); return true;
    } catch (e) { return false; }
  },
  isSlot(block, name) { const c = CASTLE.slots[name]; if (!c || !block) return false; const at = W(c), l = block.location; return l.x === at.x && l.y === at.y && l.z === at.z; },
  // Игрок в комнате или рядом с точкой замка
  near(pl, c, r = 6, dy = 3) { const p = W(c); return flat(pl.location, p) < r && Math.abs(pl.location.y - p.y) < dy; },
  placeAt(id) { const p = S.places[id]; return p && p.host ? { x: p.host[0], y: p.host[1], z: p.host[2] } : null; },
  topAt(x, z) { try { return DIM().getTopmostBlock({ x, z }); } catch (e) { return undefined; } },
  arriveNextMorning(npcId, unit) { S.arrive.push({ npc: npcId, unit, day: world.getDay() }); save(); },
  // Места тайги: выбрать точку для задания в стороне от замка
  setPlace(id, min, max) {
    if (S.places[id]) return;
    const o = W(CASTLE.origin), a = Math.random() * Math.PI * 2, d = min + Math.random() * (max - min);
    S.places[id] = { x: Math.round(o.x + Math.cos(a) * d), z: Math.round(o.z + Math.sin(a) * d), placed: false };
    save();
  },
  placeReady: (id) => !!S.places[id] && !!S.places[id].host,
  castleAt: (c) => W(c),
  stageGuards(stage) { for (const p of CASTLE.posts) if (p.stage === stage && !p.archer) S.npcs[p.guard] = 'post'; save(); },
  // Помощники для сюжета
  castle: CASTLE,
  W: (c) => W(c), dim: () => DIM(), players: () => players(), nearest: (p) => nearest(p),
  findNpc: (id) => findNpc(id), loaded: (p) => loaded(p), blockAt: (p) => blockAt(p), dist, flat, save: () => save(),
};

// ---------- Жители ----------
function npcSpot(id) {
  const where = (id in S.npcs ? S.npcs[id] : NPCS[id].start);
  if (!where) return null;
  if (where === 'post') { const p = CASTLE.posts.find((q) => q.guard === id); return p ? W(p.at) : null; }
  if (where === 'home') return CASTLE.homes[id] ? W(CASTLE.homes[id]) : null;
  if (where === 'gate') return W(NPCS[id].gate || [63, 0, 121]);
  if (where.startsWith('place:')) {
    const pl = S.places[where.slice(6)]; if (!pl || !pl.host) return null;
    const o = NPCS[id].off || [0, 0];
    return { x: pl.host[0] + o[0], y: pl.host[1], z: pl.host[2] + o[1] };
  }
  if (where.startsWith('feast:')) { const c = CASTLE.feast[+where.slice(6) % CASTLE.feast.length]; return c ? W(c) : null; }
  if (where.startsWith('at:')) return W(where.slice(3).split(',').map(Number));
  // Перед воротами: на поверхности, за спинами нападающих
  if (where.startsWith('field:')) {
    const [x, z] = where.slice(6).split(',').map(Number), p = W([x, 0, z]);
    let top; try { top = DIM().getTopmostBlock({ x: p.x, z: p.z }); } catch (e) { top = undefined; }
    return top ? { x: p.x, y: top.location.y + 1, z: p.z } : null;
  }
  return null;
}
const tagOf = (id) => 'acastle_npc_' + id;
api.tagOf = tagOf; api.npcIdOf = (e) => npcIdOf(e);
function findNpc(id) { try { return DIM().getEntities({ tags: [tagOf(id)] })[0]; } catch (e) { return undefined; } }
const typeOf = (id) => (NPCS[id].bandit ? 'acastle:bandit' : NPCS[id].guard ? 'acastle:guard' : 'acastle:npc');
function spawnNpc(id, at) {
  const n = NPCS[id];
  const e = DIM().spawnEntity(typeOf(id), center(at), { spawnEvent: 'acastle:as_' + (n.skin || id), initialPersistence: true });
  e.nameTag = n.name;
  e.addTag(tagOf(id));
  if (S.st[id]) e.triggerEvent('acastle:' + S.st[id]);
  return e;
}
// Переезд: прежнего убрать, на новом месте появится сам
function relocate(id) {
  const e = findNpc(id); const where = (id in S.npcs ? S.npcs[id] : NPCS[id].start);
  const at = where && !where.startsWith('field:') ? npcSpot(id) : null;
  if (e && (!where || (at && dist(e.location, at) > 16))) { e.triggerEvent('acastle:despawn'); e.removeTag(tagOf(id)); }
}
let ensureTick = 0;
function ensureNpcs() {
  const now = world.getAbsoluteTime();
  for (const id of Object.keys(NPCS)) {
    if (S.down[id] && S.down[id] > now) continue; // ранен — отлёживается
    const at = npcSpot(id);
    if (!at || !loaded(at)) continue;
    // Двойники: житель переехал, пока прежнее место было не прогружено, — лишних убираем.
    // Далеко от места (больше 40 блоков) житель тоже возвращается, если он не бежит и не на поводке.
    let all = [];
    try { all = DIM().getEntities({ tags: [tagOf(id)] }); } catch (err) { all = []; }
    if (!S.st[id]) all.sort((p, q) => dist(p.location, at) - dist(q.location, at));
    for (const extra of all.slice(1)) { extra.triggerEvent('acastle:despawn'); extra.removeTag(tagOf(id)); }
    const e = all[0];
    if (e && !S.st[id] && dist(e.location, at) > 40) { e.triggerEvent('acastle:despawn'); e.removeTag(tagOf(id)); continue; }
    if (e) continue;
    // Стражник мог встать по функции castle без метки — узнаём его по имени
    const named = DIM().getEntities({ type: typeOf(id), name: NPCS[id].name, location: at, maxDistance: 40 }).find((x) => !npcIdOf(x));
    if (named) { named.addTag(tagOf(id)); continue; }
    try { spawnNpc(id, at); } catch (err) { /* участок ещё не готов — попробуем позже */ }
  }
}

// ---------- Разговоры ----------
function npcIdOf(e) { for (const t of e.getTags()) if (t.startsWith('acastle_npc_')) return t.slice(12); return null; }
// Окно не показывается, пока у игрока открыт другой экран (игра отвечает «занят»):
// повторяем несколько раз с паузой — так окно откроется сразу после нажатия «Говорить».
const wait = (t) => new Promise((r) => system.runTimeout(r, t));
async function show(pl, form) {
  for (let i = 0; i < 10; i++) {
    const r = await form.show(pl);
    if (!r.canceled || r.cancelationReason !== 'UserBusy') return r;
    await wait(5);
  }
  return { canceled: true };
}
const talking = new Set();
async function talk(pl, id) {
  if (talking.has(pl.id)) return;
  talking.add(pl.id);
  try { await talkInner(pl, id); } finally { talking.delete(pl.id); }
}
async function talkInner(pl, id) {
  let node = dialog(id, api, pl);
  for (let guard = 0; node && guard < 20; guard++) {
    const opts = node.options && node.options.length ? node.options : [{ text: 'Прощай' }];
    const form = new ActionFormData().title(node.title || NPCS[id].name).body(node.text);
    for (const o of opts) form.button(o.text);
    const r = await show(pl, form);
    if (r.canceled || r.selection === undefined) return;
    const o = opts[r.selection];
    if (o.run) o.run(api, pl);
    node = o.next ? (typeof o.next === 'function' ? o.next(api, pl) : o.next) : null;
  }
}
world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  if (!S || !S.origin) return;
  const id = npcIdOf(target);
  if (id && NPCS[id]) system.run(() => talk(player, id));
});

// ---------- Книга заданий ----------
async function questBook(pl) {
  const active = Object.keys(S.q).filter((q) => S.q[q] === 'active');
  const doneN = Object.values(S.q).filter((v) => v === 'done').length;
  const lines = active.map((q) => `§l${QUESTS[q].title}§r${q === S.guide ? ' §a(путь показан)§r' : ''}\n${typeof QUESTS[q].hint === 'function' ? QUESTS[q].hint(api) : QUESTS[q].hint}`);
  const form = new ActionFormData().title('Книга заданий')
    .body(`Звание: §6${S.rank}§r · выполнено заданий: ${doneN}\n\n${lines.length ? lines.join('\n\n') : 'Заданий нет. Поговорите с жителями замка.'}\n\nКнопка задания включает огоньки-путеводители к цели (в замке) или указатель с расстоянием (в лесу — держите в руке компас или эту книгу).`);
  const opts = active.filter((q) => QUESTS[q].target);
  for (const q of opts) form.button((q === S.guide ? '§a» ' : '') + QUESTS[q].title);
  form.button(S.guide ? 'Погасить огоньки' : 'Закрыть');
  const r = await show(pl, form);
  if (r.canceled || r.selection === undefined) return;
  S.guide = r.selection < opts.length ? opts[r.selection] : null; save();
}
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (itemStack.typeId === 'acastle:quest_book' && S && S.origin) system.run(() => questBook(source));
});
// Запасной путь: книгу «применили» к блоку (на телефоне долгое нажатие по земле)
world.afterEvents.playerInteractWithBlock.subscribe(({ player, itemStack }) => {
  if (itemStack && itemStack.typeId === 'acastle:quest_book' && S && S.origin) system.run(() => questBook(player));
});

// ---------- Замок поставлен ----------
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === 'acastle:jump' && S && S.origin) { jump(parseInt(ev.message, 10) || 0, api); flush(); return; }
  if (ev.id !== 'acastle:castle_placed' || !ev.sourceEntity) return;
  const p = ev.sourceEntity.location;
  // Игрок стоит на площади у ворот — это точка CASTLE.origin в координатах замка
  S = fresh();
  S.origin = [Math.floor(p.x) - CASTLE.origin[0], Math.floor(p.y) - CASTLE.origin[1], Math.floor(p.z) - CASTLE.origin[2]];
  for (const p2 of CASTLE.posts) if (p2.stage === 0) S.npcs[p2.guard] = 'post';
  save();
  onEvent('castle', api);
  flush();
  world.sendMessage('§6Замок ждёт. Подойдите к воротам — стража окликнет вас.');
});

// ---------- Подряды ----------
function signText(unit) {
  const c = CONTRACTS[unit], st = S.rep[unit];
  const have = st.have || {};
  return [`§l${c.title}`, ...c.items.map(([id, n, name]) => `${name}: ${Math.min(have[id] || 0, n)}/${n}`)].join('\n');
}
function contractTick() {
  for (const [unit, st] of Object.entries(S.rep)) {
    if (st.st !== 'open') continue;
    const u = CASTLE.units[unit], c = CONTRACTS[unit];
    if (!u || !u.chest || !c) continue;
    const cp = W(u.chest), sp = W(u.sign);
    const cb = blockAt(cp), sb = blockAt(sp);
    if (!cb || !sb) continue;
    if (cb.typeId !== 'minecraft:chest') cb.setType('minecraft:chest');
    if (sb.typeId !== 'minecraft:standing_sign') { sb.setType('minecraft:standing_sign'); st.sign = ''; }
    const inv = cb.getComponent('minecraft:inventory').container;
    const have = {};
    for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) have[it.typeId] = (have[it.typeId] || 0) + it.amount; }
    st.have = have;
    const text = signText(unit);
    if (st.sign !== text) { try { const sc = sb.getComponent('minecraft:sign'); sc.setText(text); sc.setWaxed(true); st.sign = text; save(); } catch (e) { /* табличка ещё не готова — в следующий раз */ } }
    if (c.items.every(([id, n]) => (have[id] || 0) >= n)) {
      // Забираем нужное, лишнее остаётся в сундуке до починки
      for (const [id, need] of c.items) {
        let left = need;
        for (let i = 0; i < inv.size && left > 0; i++) {
          const it = inv.getItem(i);
          if (!it || it.typeId !== id) continue;
          if (it.amount <= left) { left -= it.amount; inv.setItem(i); } else { it.amount -= left; left = 0; inv.setItem(i, it); }
        }
      }
      S.rep[unit] = { st: 'paid', day: world.getDay() }; save();
      try { sb.getComponent('minecraft:sign').setText(`§l${c.title}\nВсё собрано!\nК утру сделаем.`); } catch (e) { /* ничего */ }
      if (c.who) api.say(c.who, c.done || 'Всё собрано. Ночью поработаем — к утру сделаем.', 64);
      onEvent('paid:' + unit, api);
    }
  }
}
// Утром: заплатки единиц ставятся, когда их участки загружены
function applyRepair(unit) {
  const u = CASTLE.units[unit], st = S.rep[unit];
  st.pieces = st.pieces || {};
  for (const [name, x1, y1, z1, x2, y2, z2] of u.pieces) {
    if (st.pieces[name]) continue;
    const a = W([x1, y1, z1]), b = W([x2, y2, z2]);
    if (!loaded(a) || !loaded(b) || !loaded({ x: a.x, y: a.y, z: b.z }) || !loaded({ x: b.x, y: a.y, z: a.z })) continue;
    try { DIM().runCommand(`structure load acastle:${name} ${a.x} ${a.y} ${a.z}`); st.pieces[name] = 1; save(); } catch (e) { /* позже */ }
  }
  if (u.pieces.every(([name]) => st.pieces[name])) {
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
    return true;
  }
  return false;
}
function morningTick() {
  const today = world.getDay();
  for (const [unit, st] of Object.entries(S.rep)) if ((st.st === 'paid' && st.day < today) || st.st === 'due') { if (st.st === 'paid') { st.st = 'due'; save(); } applyRepair(unit); }
  for (const a of [...S.arrive]) {
    if (a.day >= today) continue;
    S.arrive.splice(S.arrive.indexOf(a), 1);
    api.live(a.npc, 'home');
    if (a.unit) { S.rep[a.unit] = { st: 'due' }; S.f['tidy_' + a.npc] = 1; }
    save();
    onEvent('arrived:' + a.npc, api);
  }
  if (S.day !== today) { S.day = today; save(); onEvent('morning', api); }
}

// ---------- Места тайги ----------
const scans = {};
function placesTick() {
  for (const [id, p] of Object.entries(S.places)) {
    const info = PLACES[id];
    if (!info) continue;
    if (!p.placed) {
      const [pl, d] = nearest({ x: p.x, y: 0, z: p.z });
      if (!pl || d > 72) continue;
      const top = (() => { try { return DIM().getTopmostBlock({ x: p.x, z: p.z }); } catch (e) { return undefined; } })();
      if (!top) continue;
      if (top.isLiquid || /water|lava|ice/.test(top.typeId)) {
        // В воду не ставим: точка уходит дальше от замка
        const o = W(CASTLE.origin), dx = p.x - o.x, dz = p.z - o.z, k = 40 / Math.max(1, Math.hypot(dx, dz));
        p.x = Math.round(p.x + dx * k); p.z = Math.round(p.z + dz * k); save();
        pl.sendMessage('§7Следы ведут дальше…');
        continue;
      }
      try { DIM().runCommand(`place structure ${info.structure} ${p.x} ${top.location.y + 1} ${p.z}`); } catch (e) { continue; }
      p.placed = true; p.y = top.location.y + 1; save();
      scans[id] = { t: 0 };
    } else if (!p.host && !scans[id]) scans[id] = { t: 0 };
  }
  // Поиск метки жителя (невидимый блок света) вокруг поставленного места
  for (const [id, sc] of Object.entries(scans)) {
    const p = S.places[id];
    if (!p || p.host) { delete scans[id]; continue; }
    sc.t++;
    if (sc.t < 3) continue; // постройка встаёт не сразу
    const r = Math.max(...PLACES[id].size) + 2;
    if (!sc.job) sc.job = system.runJob((function* () {
      for (let dy = -8; dy <= 16; dy++) for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const b = blockAt({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
          if (b && b.typeId === 'minecraft:light_block_0') {
            p.host = [b.location.x, b.location.y, b.location.z]; b.setType('minecraft:air'); save();
            onEvent('placed:' + id, api); return;
          }
        }
        yield;
      }
      // метки нет — житель встанет посреди места
      p.host = [p.x, p.y, p.z]; save(); onEvent('placed:' + id, api);
    })());
  }
}

// ---------- Путеводитель ----------
function bearing(pl, to) {
  const v = pl.getViewDirection(), dx = to.x - pl.location.x, dz = to.z - pl.location.z, len = Math.hypot(dx, dz) || 1;
  const tx = dx / len, tz = dz / len, cross = v.x * tz - v.z * tx, dot = v.x * tx + v.z * tz;
  const ang = Math.atan2(cross, dot) * 180 / Math.PI;
  if (Math.abs(ang) < 20) return 'прямо';
  if (Math.abs(ang) > 135) return 'позади';
  return (Math.abs(ang) < 70 ? 'чуть ' : '') + (ang < 0 ? 'левее' : 'правее');
}
function holdingGuide(pl) {
  try { const it = pl.getComponent('minecraft:equippable').getEquipment('Mainhand'); return !!it && (it.typeId === 'minecraft:compass' || it.typeId === 'acastle:quest_book'); } catch (e) { return false; }
}
function guideTick() {
  if (!S.guide || !QUESTS[S.guide] || !QUESTS[S.guide].target) return;
  const t = QUESTS[S.guide].target(api);
  if (!t) return;
  for (const pl of players()) {
    if (t.tag) {
      const e = DIM().getEntities({ tags: [t.tag] })[0];
      const to = e ? e.location : t.near ? (t.near.place ? api.placeAt(t.near.place) : W(t.near)) : null;
      if (to && holdingGuide(pl)) pl.onScreenDisplay.setActionBar(`${t.label} — ${Math.round(flat(pl.location, to))} бл., ${bearing(pl, to)}`);
      continue;
    }
    if (t.place) {
      const p = S.places[t.place];
      if (!p) continue;
      const to = p.host ? { x: p.host[0], y: p.host[1], z: p.host[2] } : { x: p.x, y: pl.location.y, z: p.z };
      if (holdingGuide(pl)) pl.onScreenDisplay.setActionBar(`${t.label} — ${Math.round(flat(pl.location, to))} бл., ${bearing(pl, to)}`);
      continue;
    }
    const path = t.path && CASTLE.paths[t.path];
    const goal = W(t.at || (path ? path.slice(-3) : CASTLE.square));
    if (flat(pl.location, goal) < 3 && Math.abs(pl.location.y - goal.y) < 3) continue;
    if (!path) { if (holdingGuide(pl)) pl.onScreenDisplay.setActionBar(`${t.label} — ${Math.round(dist(pl.location, goal))} бл., ${bearing(pl, goal)}`); continue; }
    // Огоньки: от ближайшей к игроку точки пути на несколько шагов вперёд
    let bi = -1, bd = Infinity;
    for (let i = 0; i < path.length; i += 3) { const d = dist(pl.location, W([path[i], path[i + 1], path[i + 2]])); if (d < bd) { bd = d; bi = i; } }
    if (bd > 8) { if (holdingGuide(pl)) pl.onScreenDisplay.setActionBar(`${t.label} — ${Math.round(dist(pl.location, goal))} бл., ${bearing(pl, W([path[bi], path[bi + 1], path[bi + 2]]))}`); continue; }
    for (let k = 1; k <= 10; k++) {
      const i = bi + k * 3; if (i >= path.length) break;
      const c = W([path[i], path[i + 1], path[i + 2]]);
      try { DIM().spawnParticle('minecraft:villager_happy', { x: c.x + 0.5, y: c.y + 0.6, z: c.z + 0.5 }); } catch (e) { /* участок не загружен */ }
    }
  }
}

// ---------- Общий цикл ----------
let tick = 0;
system.runInterval(() => {
  if (!S) load();
  if (!S.origin) return;
  tick++;
  try { guideTick(); } catch (e) { console.warn('acastle guide: ' + e); }
  if (tick % 2) { flush(); return; }
  for (const fn of [morningTick, contractTick, placesTick, () => { for (const q of Object.keys(S.q)) if (S.q[q] === 'active' && QUESTS[q].tick) QUESTS[q].tick(api); }, () => { if (++ensureTick % 3 === 0) ensureNpcs(); }]) {
    try { fn(); } catch (e) { console.warn('acastle: ' + e + (e.stack ? '\n' + e.stack : '')); }
  }
  flush();
}, 10);

// Короткие реплики, когда игрок проходит рядом (не чаще раза в полминуты от жителя)
const barked = {};
function barkTick() {
  const now = system.currentTick;
  for (const pl of players()) {
    let near;
    try { near = DIM().getEntities({ location: pl.location, maxDistance: 5, families: ['acastle_person'] }); } catch (e) { continue; }
    for (const e of near) {
      const id = npcIdOf(e);
      if (!id || (barked[id] && now - barked[id] < 600)) continue;
      const line = bark(id, api, pl);
      barked[id] = now;
      if (line) { pl.onScreenDisplay.setActionBar(`§e${NPCS[id].name}:§r ${line}`); break; }
    }
  }
}
system.runInterval(() => { if (S && S.origin) try { barkTick(); } catch (e) { console.warn('acastle bark: ' + e); } }, 40);

world.afterEvents.entityDie.subscribe((ev) => {
  if (!S || !S.origin) return;
  // Житель погиб в бою: он ранен и вернётся на своё место через пару минут
  let id = null;
  try { id = npcIdOf(ev.deadEntity); } catch (e) { id = null; }
  if (id && NPCS[id]) {
    S.down[id] = world.getAbsoluteTime() + 2400; save();
    if (NPCS[id].guard) api.tell(`§7${NPCS[id].name} ранен, его унесли в казарму. Через пару минут вернётся на пост.`);
  }
  onEvent('die', api, ev);
});
world.afterEvents.entityHurt.subscribe((ev) => { if (S && S.origin) try { onEvent('hurt', api, ev); } catch (e) { console.warn('acastle hurt: ' + e); } });
world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
  if (!S || !S.origin || !ev.eventId.startsWith('acastle:')) return;
  try { onEvent('trigger', api, ev); } catch (e) { console.warn('acastle trigger: ' + e); }
});
world.afterEvents.playerInteractWithBlock.subscribe((ev) => { if (S && S.origin) onEvent('block', api, ev); });
