// Проверочный прогон скриптов заданий без игры: макет мира Minecraft (@minecraft/server и
// @minecraft/server-ui) и игрок, который проходит все этапы 0–9 и переход командой
// acastle:jump. Ловит ошибки в коде и сюжете.
// Запуск после сборки: node tools/test/sim.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'acastle-sim-'));
for (const f of fs.readdirSync(path.join(ROOT, 'build/AbandonedCastle_BP/scripts'))) fs.copyFileSync(path.join(ROOT, 'build/AbandonedCastle_BP/scripts', f), path.join(DIR, f));
fs.writeFileSync(path.join(DIR, 'package.json'), '{"type":"module"}');
const mod = (name, code) => { const d = path.join(DIR, 'node_modules', name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'package.json'), '{"type":"module","main":"index.js"}'); fs.writeFileSync(path.join(d, 'index.js'), code); };
mod('@minecraft/server', 'const M = globalThis.SIM.server; export const world = M.world, system = M.system, ItemStack = M.ItemStack;');
mod('@minecraft/server-ui', 'export const ActionFormData = globalThis.SIM.ActionFormData;');

// ---------- Макет мира ----------
const log = [], problems = [];
const K = (p) => `${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;
const blocks = new Map(); // key → { typeId, states, inv, text }
let time = 1000, day = 0, difficulty = 'Normal';
const props = {};
const handlers = { interact: [], itemUse: [], script: [], die: [], block: [], hurt: [], trigger: [], hit: [], spawn: [] };
const intervals = [];
let tickNo = 0;
const entities = [];
let eid = 0;
class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId.includes(':') ? typeId : 'minecraft:' + typeId; this.amount = amount; this.nameTag = undefined; } setLore(l) { this.lore = l; } }
const container = (size) => {
  const slots = new Array(size).fill(undefined);
  return { size, getItem: (i) => slots[i], setItem: (i, it) => { slots[i] = it; }, addItem: (it) => { const i = slots.findIndex((s) => !s); if (i < 0) return it; slots[i] = it; return undefined; }, clearAll: () => slots.fill(undefined), slots };
};
function blockAt(p) {
  const k = K(p);
  if (!blocks.has(k)) blocks.set(k, { typeId: p.y < 64 ? 'minecraft:stone' : 'minecraft:air', states: {} });
  const b = blocks.get(k);
  return {
    get typeId() { return b.typeId; }, location: { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) },
    get isLiquid() { return /water|lava/.test(b.typeId); },
    get isAir() { return b.typeId === 'minecraft:air'; },
    permutation: { getState: (s) => b.states[s] },
    setType(t) { b.typeId = t; b.states = {}; if (t === 'minecraft:chest') b.inv = container(27); },
    getComponent(c) {
      if (c === 'minecraft:inventory') { if (!b.inv) b.inv = container(27); return { container: b.inv }; }
      if (c === 'minecraft:sign') return { setText: (t) => { b.text = t; }, setWaxed() {} };
      return undefined;
    },
  };
}
function makeEntity(typeId, loc, opts = {}) {
  const tags = new Set();
  const e = {
    id: ++eid, typeId, location: { ...loc }, nameTag: '', isValid: true, event: opts.spawnEvent, state: null, events: [],
    addTag: (t) => tags.add(t), removeTag: (t) => tags.delete(t), hasTag: (t) => tags.has(t), getTags: () => [...tags],
    triggerEvent(ev) { this.events.push(ev); if (ev === 'acastle:despawn') this.remove(); const m = /^acastle:(hostile|flee|captive|peaceful)$/.exec(ev); if (m) this.state = m[1] === 'peaceful' ? null : m[1]; },
    teleport(l) { this.location = { ...l }; },
    remove() { if (!this.isValid) return; this.isValid = false; entities.splice(entities.indexOf(this), 1); },
    getComponent(c) { if (c === 'minecraft:health') return { currentValue: this.hp ?? 60, effectiveMax: 60 }; return undefined; },
  };
  entities.push(e);
  return e;
}
// Стройка: куски замка ставятся скриптом. В макете кусок «встаёт» так: на местах жителей внутри
// него появляется пол, а на уровне ног и головы — воздух. До этого жителям стоять негде.
const placed = [];
let CASTLE_SPOTS = [];
function placeStructure(name, d, loc) {
  placed.push(name);
  const q = CASTLE_SPOTS.length && CASTLE.build.find((p) => p[0] === name);
  if (!q) return;
  for (const c of CASTLE_SPOTS) {
    const w = W(c);
    if (w.x < loc.x || w.x >= loc.x + q[4] || w.z < loc.z || w.z >= loc.z + q[6]) continue;
    blockAt({ ...w, y: w.y - 1 }).setType('minecraft:stone');
    blockAt(w).setType('minecraft:air'); blockAt({ ...w, y: w.y + 1 }).setType('minecraft:air');
  }
}
const dim = {
  isChunkLoaded: () => true,
  getBlock: (p) => blockAt(p),
  getTopmostBlock: ({ x, z }) => { const b = blockAt({ x, y: 63, z }); if (b.typeId === 'minecraft:stone') b.setType('minecraft:grass_block'); return b; },
  getEntities(o = {}) {
    return entities.filter((e) => (!o.tags || o.tags.every((t) => e.hasTag(t))) && (!o.type || e.typeId === o.type) && (!o.name || e.nameTag === o.name)
      && (!o.families || o.families.every((f) => famOf(e).includes(f)))
      && (!o.location || Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z) <= (o.maxDistance || Infinity)));
  },
  spawnEntity: (t, loc, o) => makeEntity(t, loc, o),
  spawnItem: (it, loc) => makeEntity('minecraft:item', loc),
  spawnParticle: () => { particles++; },
  runCommand: (c) => {
    log.push(c);
    // место тайги встало: в нём лежит метка хозяина (невидимый блок света) рядом с точкой
    const m = /^place structure \S+ (-?\d+) (-?\d+) (-?\d+)/.exec(c);
    if (m) blockAt({ x: +m[1] + 2, y: +m[2], z: +m[3] + 2 }).setType('minecraft:light_block_0');
    return { successCount: 1 };
  },
};
let particles = 0;
// Семейства существ: жители аддона — acastle_person, нежить и враждебные разбойники — monster
const famOf = (e) => [...(e.typeId.startsWith('acastle:') ? ['acastle_person'] : []), ...(/zombie|skeleton|spider|husk/.test(e.typeId) || e.state === 'hostile' ? ['monster'] : [])];
const inv = container(36);
const msgs = [];
const player = {
  typeId: 'minecraft:player', name: 'Игрок', id: 'p1', isSneaking: false, location: { x: 1000, y: 64, z: 1000 },
  getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
  getComponent(c) {
    if (c === 'minecraft:inventory') return { container: inv };
    if (c === 'minecraft:equippable') return { getEquipment: () => inv.getItem(0), setEquipment: (slot, it) => inv.setItem(0, it) };
  },
  onScreenDisplay: { setTitle: (t, o) => msgs.push(`[титр] ${t} ${o && o.subtitle || ''}`), setActionBar: (t) => { lastBar = t; } },
  sendMessage: (m) => msgs.push(m), playSound() {}, getTags: () => [],
};
let lastBar = '';
const ev = (arr) => ({ subscribe: (fn) => arr.push(fn) });
globalThis.SIM = {
  server: {
    ItemStack,
    world: {
      getDynamicProperty: (k) => props[k], setDynamicProperty: (k, v) => { props[k] = v; },
      getDay: () => day, getTimeOfDay: () => time, getDifficulty: () => difficulty, getAbsoluteTime: () => day * 24000 + time,
      getPlayers: () => [player], getDimension: () => dim, sendMessage: (m) => msgs.push(m),
      structureManager: { place: (n, d, l) => placeStructure(n, d, l) },
      afterEvents: { playerInteractWithEntity: ev(handlers.interact), itemUse: ev(handlers.itemUse), entityDie: ev(handlers.die), playerInteractWithBlock: ev(handlers.block), entityHurt: ev(handlers.hurt), dataDrivenEntityTrigger: ev(handlers.trigger), entityHitEntity: ev(handlers.hit), playerSpawn: ev(handlers.spawn) },
    },
    system: {
      runInterval: (fn, every = 1) => { intervals.push({ fn, every }); return intervals.length; }, run: (fn) => fn(), runTimeout: (fn) => fn(),
      get currentTick() { return tickNo * 10; },
      runJob(gen) { for (const _ of gen); return 1; }, // eslint-disable-line no-unused-vars
      afterEvents: { scriptEventReceive: ev(handlers.script) },
    },
  },
  ActionFormData: class {
    constructor() { this.btns = []; }
    title(t) { this.t = t; return this; } body(b) { this.b = b; return this; } button(x) { this.btns.push(x); return this; }
    async show() {
      const want = answers.shift();
      dialogLog.push(`${this.t}: ${this.b.slice(0, 90).replace(/\n/g, ' ')}…`);
      if (want === undefined) return { canceled: true };
      const i = this.btns.findIndex((x) => x.includes(want));
      if (i < 0) { problems.push(`нет кнопки «${want}» в окне «${this.t}»: ${this.btns.join(' | ')}`); return { canceled: true }; }
      return { canceled: false, selection: i };
    }
  },
};
const answers = [], dialogLog = [];
process.on('uncaughtException', (e) => { console.log('Ошибка прогона:', e.stack); for (const p of problems) console.log(' - ' + p); process.exit(1); });
process.on('unhandledRejection', (e) => { console.log('Ошибка прогона:', e && e.stack); for (const p of problems) console.log(' - ' + p); process.exit(1); });

// ---------- Сценарий ----------
await import(pathToFileURL(path.join(DIR, 'main.js')));
const { CASTLE } = await import(pathToFileURL(path.join(DIR, 'castle_data.js')));
const state = () => JSON.parse(props['acastle:state']);
CASTLE_SPOTS = [...Object.values(CASTLE.homes).filter(Boolean), ...CASTLE.posts.map((p) => p.at), ...CASTLE.feast, ...CASTLE.lairs.crypt, ...CASTLE.lairs.catacombs, [63, 0, 121], [63, 0, 118]];
// /function castle: стройка скриптом до конца
async function buildCastle() {
  placed.length = 0;
  for (const h of handlers.script) h({ id: 'acastle:castle_build', sourceEntity: player });
  for (let i = 0; i < 2000 && !(props['acastle:state'] && state().origin); i++) ticks(1);
}
// Один «тик» прогона — полсекунды игры (10 игровых тиков): общий цикл каждый раз, реплики реже
const ticks = (n) => { for (let i = 0; i < n; i++) { tickNo++; for (const it of intervals) if ((tickNo * 10) % it.every === 0) it.fn(); } };
const O = { x: 5000, y: 64, z: 5000 }; // где игрок ставит замок (площадь у ворот)
const W = (c) => ({ x: O.x - CASTLE.origin[0] + c[0], y: O.y + c[1], z: O.z - CASTLE.origin[2] + c[2] });
const goTo = (c) => { player.location = { ...W(c) }; };
const npc = (id) => entities.find((e) => e.hasTag('acastle_npc_' + id));
async function talk(id, ...say) {
  const e = npc(id);
  if (!e) { problems.push(`нет жителя ${id}`); return; }
  ticks(1); // живой игрок не открывает окна в один и тот же тик
  answers.push(...say);
  for (const h of handlers.interact) h({ player, target: e });
  await new Promise((r) => setTimeout(r, 5));
  ticks(2); // прогресс записывается в память мира в общем цикле
  if (answers.length) { problems.push(`${id}: не все ответы использованы: ${answers.join(', ')}`); answers.length = 0; }
}
const give = (id, n, name) => { const it = new ItemStack(id, n); if (name) it.nameTag = name; inv.addItem(it); };
const q = (id) => state().q[id];
const expect = (cond, what) => { if (!cond) problems.push('не выполнено: ' + what); };
function fillChest(unit, items) {
  const u = CASTLE.units[unit];
  const b = blockAt(W(u.chest));
  expect(b.typeId === 'minecraft:chest', `сундук-подряд ${unit} стоит`);
  for (const [id, n] of items) b.getComponent('minecraft:inventory').container.addItem(new ItemStack(id, n));
}
const morning = () => { day++; time = 100; ticks(4); };
const nightFall = () => { time = 14000; };

// Приветствие при входе в мир
for (const h of handlers.spawn) h({ player, initialSpawn: true });
expect(msgs.some((m) => /Аддон \d+\.\d+\.\d+: скрипты работают/.test(m)), 'приветствие с версией при входе');
// Сигнал от /function castle не дошёл: скрипты находят замок по «сердцу замка»
makeEntity('minecraft:armor_stand', W(CASTLE.heart)).nameTag = 'acastle_heart';
ticks(24);
{ const st = props['acastle:state'] && state(); expect(st && st.origin && st.origin.join() === [O.x - CASTLE.origin[0], O.y - CASTLE.origin[1], O.z - CASTLE.origin[2]].join(), 'замок найден по «сердцу замка»: ' + (st && st.origin)); }
// 0. Замок поставлен
player.location = { ...O };
for (const h of handlers.script) h({ id: 'acastle:castle_build', sourceEntity: player });
ticks(30);
expect(!npc('vsevolod') && state().build && !state().origin, 'пока замок строится, жителей нет и сюжет не начат');
expect(placed.length >= 1 && placed.length < CASTLE.build.length, 'куски ставятся по одному: ' + placed.length);
for (let i = 0; i < 2000 && !state().origin; i++) ticks(1);
expect(placed.length === CASTLE.build.length && new Set(placed).size === placed.length, `все куски замка поставлены по разу (${placed.length} из ${CASTLE.build.length})`);
expect(placed[0] === CASTLE.build[0][0] && log.some((c) => c.startsWith('tickingarea add')) && log.some((c) => c.startsWith('summon armor_stand acastle_heart')), 'стройка от площади, участки держатся, «сердце замка» поставлено');
expect(log.filter((c) => c.startsWith('tickingarea add')).length === CASTLE.build.length, 'на каждый кусок — свой участок');
ticks(8);
expect(q('s0_halt') === 'active', 'задание «Стой, кто идёт?»');
expect(npc('ostap') && npc('mitka'), 'стражники у ворот');
expect(npc('vsevolod') && npc('agafya') && npc('frol'), 'король, Агафья, Фрол на местах');
// 1. Остап
goTo([63, 0, 122]); ticks(4);
// в бою касание стражника — удар мимо, окно не открывается
{ const z = makeEntity('minecraft:zombie', { ...player.location, x: player.location.x + 2 }); answers.push('Путник');
  for (const h of handlers.hit) h({ damagingEntity: player, hitEntity: npc('ostap') });
  await new Promise((r) => setTimeout(r, 5)); expect(answers.length === 1, 'посреди боя касание стражника не открывает окно'); answers.length = 0; z.remove(); ticks(2); }
// с Остапом — касанием (на iPhone касание — удар, стражник от него не ранен, а заговорит)
answers.push('Путник', 'доказать', 'Договорились');
for (const h of handlers.hit) h({ damagingEntity: player, hitEntity: npc('ostap') });
await new Promise((r) => setTimeout(r, 5)); ticks(2);
expect(!answers.length, 'разговор с Остапом касанием'); answers.length = 0;
expect(q('s0_night') === 'active', 'ночь у ворот началась');
expect(inv.slots.some((s) => s && s.typeId === 'acastle:quest_book'), 'книга заданий выдана');
// 2. Ночь у ворот: три волны
nightFall();
for (let w = 0; w < 3; w++) {
  ticks(12);
  const mobs = entities.filter((e) => e.hasTag('acastle_wave'));
  expect(mobs.length > 0, `волна ${w + 1} пришла`);
  for (const m of mobs) m.remove();
}
ticks(12);
expect(q('s0_night') === 'done', 'ночь у ворот пройдена');
expect(q('s0_king') === 'active', 'идти к королю');
// огоньки до короля
goTo(CASTLE.paths.home_vsevolod.slice(0, 3)); particles = 0; ticks(2);
expect(particles > 0, 'огоньки-путеводители видны');
time = 1000;
// 3. Король
goTo(CASTLE.homes.vsevolod);
await talk('vsevolod', 'служить', 'начать');
expect(q('s0_roof') === 'active' && q('s0_kitchen') === 'active' && q('s0_mare') === 'active', 'король дал задания');
// 4. Агафья
give('minecraft:wheat', 16); give('minecraft:milk_bucket', 1); give('minecraft:beef', 2); give('minecraft:chicken', 2);
await talk('agafya', 'принёс');
expect(q('s0_kitchen') === 'done', 'Агафья накормлена');
// 5. Фрол
give('minecraft:hay_block', 8);
await talk('frol', 'сено');
expect(q('s0_mare') === 'done' && entities.some((e) => e.typeId === 'minecraft:horse'), 'кобыла Ласточка');
// 6. Крыша над головой
ticks(4);
fillChest('shell', [['minecraft:stone_bricks', 64], ['minecraft:glass', 32], ['minecraft:spruce_planks', 32]]);
ticks(4);
expect(state().rep.shell.st === 'paid', 'подряд корпуса оплачен');
const before = log.length;
morning();
expect(log.slice(before).some((c) => c.startsWith('structure load acastle:castle_u_shell_')), 'заплатка корпуса поставлена');
expect(q('s0_roof') === 'done', 'крыша над головой готова');
expect(blockAt(W(CASTLE.units.shell.chest)).typeId === 'minecraft:air', 'сундук-подряд убран');
// 7. Сигнальный огонь
await talk('vsevolod', 'Зажгу');
expect(q('s0_signal') === 'active', 'сигнальный огонь');
const sb = blockAt(W(CASTLE.signal)); sb.setType('minecraft:campfire'); blocks.get(K(W(CASTLE.signal))).states.extinguished = false;
ticks(4);
expect(q('s0_signal') === 'done' && q('s0_wait') === 'active', 'огонь горит, ждём подмогу');
morning(); ticks(8);
expect(q('s1_captain') === 'active' && npc('demyan'), 'капитан Демьян у ворот');
expect(npc('zhdan') && npc('gavrila') && npc('luka'), 'стражники этапа 1 на постах');
// ===== Этап 1 =====
await talk('demyan', 'защита');
expect(q('s1_breaches') === 'active' && q('s1_barracks') === 'active' && q('s1_ostrog') === 'active', 'капитан дал задания');
ticks(4);
for (const u of ['breach_1', 'breach_2', 'breach_3']) fillChest(u, [['minecraft:cobblestone', 48], ['minecraft:stone_bricks', 16]]);
fillChest('barracks', [['minecraft:spruce_planks', 32], ['minecraft:spruce_stairs', 16]]);
ticks(4);
morning(); ticks(4);
expect(q('s1_breaches') === 'done' && q('s1_barracks') === 'done', 'бреши и казарма починены');
expect(state().npcs.demyan === 'home' && state().rep.rooms_1 && state().rep.rooms_1.st === 'done', 'Демьян переехал, его комнаты прибраны');
ticks(8);
expect(npc('demyan') && Math.hypot(npc('demyan').location.x - W(CASTLE.homes.demyan).x, npc('demyan').location.z - W(CASTLE.homes.demyan).z) < 2, 'Демьян в своей комнате');
await talk('demyan', 'Прощай'); // «я тут порядок навёл»
expect(q('s1_walls') === 'active', 'зубцы и башни');
ticks(4);
fillChest('walls', [['minecraft:stone_bricks', 64], ['minecraft:spruce_planks', 24]]);
ticks(4); morning(); ticks(4);
expect(q('s1_walls') === 'done', 'зубцы и башни починены');
// Острог по компасу
const place = state().places.stockade_hunt;
expect(place && !place.placed, 'место острога выбрано');
inv.setItem(0, new ItemStack('minecraft:compass'));
lastBar = ''; ticks(2);
expect(/Острог — \d+ бл\./.test(lastBar), 'компас показывает путь к острогу: ' + lastBar);
player.location = { x: place.x + 30, y: 64, z: place.z + 10 }; ticks(10);
expect(state().places.stockade_hunt.placed && log.some((c) => c.startsWith('place structure acastle:q_stockade_hunt')), 'острог встал');
ticks(8);
expect(npc('yaroslav'), 'сотник Ярослав в остроге');
await talk('yaroslav', 'Донесение');
expect(state().f.copy, 'копия приказа получена');
await talk('demyan', 'Копию');
expect(q('s1_ostrog') === 'done' && q('s1_seal') === 'active', 'чужая печать');
for (const h of handlers.block) h({ player, block: blockAt(W(CASTLE.slots.gatehouse)) });
ticks(2);
expect(q('s1_seal') === 'done', 'печать сравнена');
await talk('demyan', 'дальше');
expect(state().f.stage1_done && state().rank === 'Оруженосец', 'этап 1 пройден, звание Оруженосец');
// Книга заданий открывается
answers.push('Закрыть'); for (const h of handlers.itemUse) h({ source: player, itemStack: new ItemStack('acastle:quest_book') }); await new Promise((r) => setTimeout(r, 5)); answers.length = 0;

// ===== Помощники для этапов 2–9 =====
const placeOf = (id) => state().places[id];
async function goPlace(id, label) {
  const p = placeOf(id);
  expect(p, `место «${label}» выбрано`);
  if (!p) return;
  player.location = { x: p.x + 20, y: 64, z: p.z + 10 }; ticks(10);
  expect(placeOf(id).placed && log.some((c) => c.startsWith('place structure ' + (id.startsWith('mark_') || id.includes('_') ? 'acastle:q_' + id : ''))), `«${label}» встало`);
  ticks(8);
  const h = placeOf(id).host;
  if (h) player.location = { x: h[0] + 1, y: h[1], z: h[2] + 1 };
  ticks(6);
}
const morningAt = (c) => { if (c) goTo(c); morning(); ticks(8); };
const hasItem = (name) => inv.slots.some((s) => s && s.nameTag === name);
// У каждого жителя в описании существа есть событие появления со своим обликом
{
  const { NPCS } = await import(pathToFileURL(path.join(DIR, 'story.js')));
  const ev = (t) => JSON.parse(fs.readFileSync(path.join(ROOT, 'build/AbandonedCastle_BP/entities', t + '.json'), 'utf8'))['minecraft:entity'].events;
  const EV = { 'acastle:guard': ev('guard'), 'acastle:npc': ev('npc'), 'acastle:bandit': ev('bandit') };
  for (const [id, n] of Object.entries(NPCS)) {
    const type = n.bandit ? 'acastle:bandit' : n.guard ? 'acastle:guard' : 'acastle:npc';
    expect(EV[type]['acastle:as_' + (n.skin || id)], `у жителя ${id} есть событие acastle:as_${n.skin || id} (${type})`);
  }
}
const ITEMS = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/items-1.26.50.json'), 'utf8')));
const { CONTRACTS, QUESTS } = await import(pathToFileURL(path.join(DIR, 'story.js')));
for (const [u, c] of Object.entries(CONTRACTS)) {
  for (const [id] of c.items) expect(ITEMS.has(id), `подряд ${u}: предмет ${id} есть в игре`);
  expect(CASTLE.units[u] && CASTLE.units[u].chest, `подряд ${u}: есть место для сундука`);
}
for (const [q, v] of Object.entries(QUESTS)) { const t = v.target && v.target({ S: state(), castle: CASTLE, flag: () => 0, repaired: () => false }); if (t && t.path) expect(CASTLE.paths[t.path], `путь «${t.path}» для задания ${q}`); }
const stage = (n) => state().f[`stage${n}_done`];
const fill = (unit) => fillChest(unit, CONTRACTS[unit].items.map(([id, n]) => [id, n]));
async function fight(tag, waves) {
  for (let w = 0; w < waves; w++) {
    ticks(12);
    const mobs = entities.filter((e) => e.hasTag(tag));
    expect(mobs.length > 0, `бой ${tag}: волна ${w + 1}`);
    for (const m of mobs) m.remove();
  }
  ticks(12);
}

// ===== Этап 2. Кузня =====
await talk('demyan', 'Схожу');
expect(q('s2_smith') === 'active', 'этап 2 начат');
await goPlace('camp_hunters_bear', 'стан охотников');
expect(npc('kuzma') && npc('gordey') && npc('vaska') && npc('hunter'), 'в стане Кузьма, Ерофей, Гордей и Васька');
await talk('kuzma', 'Помогу');
expect(q('s2_bear') === 'active', 'шатун');
ticks(4);
const bear = entities.find((e) => e.hasTag('acastle_shatun'));
expect(bear && bear.typeId === 'minecraft:polar_bear', 'шатун вышел');
if (bear) { for (const h of handlers.die) h({ deadEntity: bear }); bear.remove(); }
ticks(2);
expect(q('s2_bear') === 'done' && q('s2_knife') === 'active', 'шатун убит, нож с клеймом');
await talk('kuzma', 'Спасибо');
await talk('hunter', 'воз');
await talk('gordey', 'Жду');
expect(q('s2_wait') === 'active', 'Гордей идёт в замок');
morningAt([63, 0, 110]);
expect(state().npcs.gordey === 'home' && q('s2_forge') === 'active' && q('s2_hammer') === 'active', 'Гордей в замке, подряды кузни');
ticks(8);
expect(entities.filter((e) => e.hasTag('acastle_npc_gordey')).length === 1, 'Гордей один (без двойника)');
// старая копия Гордея осталась в стане (переезд случился, пока стан был далеко) — исчезает
{ const h = placeOf('camp_hunters_bear').host; const old = makeEntity('acastle:npc', { x: h[0], y: h[1], z: h[2] }); old.addTag('acastle_npc_gordey'); ticks(8);
  expect(!old.isValid && entities.filter((e) => e.hasTag('acastle_npc_gordey')).length === 1, 'старая копия Гордея в стане убрана'); }
for (const h of handlers.block) h({ player, block: blockAt(W(CASTLE.rooms['Арсенал'])) }); ticks(2);
// в макете любой блок в арсенале — камень; сундук ставим
{ const c = W(CASTLE.rooms['Арсенал']); blockAt(c).setType('minecraft:chest'); for (const h of handlers.block) h({ player, block: blockAt(c) }); ticks(2); }
expect(hasItem('Молот деда'), 'молот деда найден');
await talk('vaska', 'Держи');
ticks(4);
fill('forge'); fill('tiltyard'); ticks(4);
morningAt(); ticks(4);
expect(stage(2), 'этап 2 пройден');
expect(hasItem('Меч замковой ковки'), 'меч от Гордея');
inv.setItem(0, Object.assign(new ItemStack('minecraft:iron_sword'), { getComponent: (c) => (c === 'minecraft:durability' ? { damage: 40 } : undefined) }));
give('minecraft:iron_ingot', 2);
await talk('gordey', 'Почини');

// ===== Этап 3. Хозяйство =====
goTo(CASTLE.homes.agafya); ticks(2);
await talk('agafya', 'Приведу');
await goPlace('farmstead_voronin', 'хутор Ворониных');
await talk('ignat', 'прогоню');
expect(q('s3_lights') === 'active', 'огни в лесу');
nightFall();
await fight('acastle_farm', 2);
expect(q('s3_lights') === 'done', 'люди Рыжего прогнаны с хутора');
time = 1000;
await talk('nastya', 'Спасибо');
await talk('ignat', 'Жду');
morningAt([63, 0, 110]);
expect(q('s3_works') === 'active' && q('s3_books') === 'active' && npc('trader'), 'Игнат в замке, торговка на площади');
for (const k of ['ledger', 'steward_book']) for (const h of handlers.block) h({ player, block: blockAt(W(CASTLE.slots[k])) }); ticks(2);
expect(q('s3_books') === 'done', 'книга податей и бумаги управителя');
for (const u of ['steward', 'barn', 'square', 'yard']) fill(u);
ticks(4); morningAt(); ticks(4);
expect(stage(3), 'этап 3 пройден');
for (let i = 0; i < 3; i++) await talk('trader', 'Прощай');
expect(state().f.trader_spy, 'торговка выспрашивает');

// ===== Этап 4. Вера =====
await talk('ignat', 'Позову');
await goPlace('hermitage_nikodim', 'скит');
await talk('varlaam', 'Хорошо');
await talk('nikodim', 'Бог простит');
morningAt([63, 0, 110]);
expect(state().npcs.varlaam === 'home' && q('s4_crypt') === 'active', 'Варлаам в часовне, склеп');
goTo(CASTLE.lairs.crypt[0]);
await fight('acastle_crypt', 2);
expect(q('s4_crypt') === 'done', 'склеп очищен');
for (const h of handlers.block) h({ player, block: blockAt(W(CASTLE.slots.priest)) }); ticks(2);
fill('chapel'); ticks(4); morningAt(); ticks(4);
expect(stage(4) && state().rank === 'Рыцарь', 'этап 4 пройден, звание Рыцарь');

// ===== Этап 5. Знание =====
await talk('varlaam', 'Евсея');
await goPlace('hut_cartographer_liza', 'дом картографа');
await talk('liza', 'Прощай');
await talk('evsey', 'Найду');
await goPlace('mine_g7', 'рудник Г-7');
await talk('lenz', 'Идём');
expect(hasItem('Карта квадрата Г-7'), 'карта Ленца');
await goPlace('hut_living_grach', 'хижина лесника');
await talk('grach', 'Возьму');
morningAt([63, 0, 110]);
expect(['evsey', 'lenz', 'semka'].every((id) => state().npcs[id] === 'home'), 'Евсей, Ленц, Сёмка в замке');
morningAt();
expect(state().f.pigeon, 'голубь с письмом');
await talk('semka', 'Иду');
expect(q('s5_camp') === 'active' && !npc('trader'), 'логово; торговка ушла с площади');
await goPlace('outlaw_camp', 'лагерь Рыжего');
expect(['ryzhy', 'sych', 'pakhom', 'shilo', 'kunitsa'].every((id) => npc(id) && npc(id).typeId === 'acastle:bandit'), 'шайка в лагере');
await talk('sych', 'атаману');
await talk('ryzhy', 'Зачем', 'песня');
expect(q('s5_lullaby') === 'active', 'колыбельная');
// Шило ворует из сумки
inv.setItem(20, new ItemStack('minecraft:bread', 5));
{ const sh = npc('shilo'); player.location = { ...sh.location }; ticks(8); }
expect(q('x_shilo') === 'active', 'Шило стащил мелочь');
await talk('shilo', 'балуй');
expect(q('x_shilo') === 'done', 'пропажа возвращена');
// нападение на лагерь и мир через Пахома
for (const h of handlers.hurt) h({ hurtEntity: npc('grinya'), damageSource: { damagingEntity: player } }); ticks(2);
ticks(2);
expect(q('x_peace') === 'active' && npc('grinya').state === 'hostile' && !npc('ryzhy'), 'лагерь враждебен, атаман ушёл');
give('minecraft:bread', 8); give('minecraft:cooked_beef', 8);
await talk('pakhom', 'дар');
ticks(6);
expect(q('x_peace') === 'done' && !npc('grinya').state && npc('ryzhy'), 'мир с атаманом');
goTo(CASTLE.homes.agafya); ticks(2);
await talk('agafya', 'Насвистеть');
await talk('evsey', 'Найду');
for (const h of handlers.block) h({ player, block: blockAt(W(CASTLE.slots.vault)) }); ticks(2);
await talk('evsey', 'договоре');
expect(stage(5), 'этап 5 пройден');

// ===== Этап 6. Исцеление =====
morningAt([63, 0, 110]);
goTo(CASTLE.homes.vsevolod); ticks(4);
await talk('vsevolod', 'лекаря');
await goPlace('hermitage_nikodim', 'скит');
await talk('nikodim', 'Спасибо');
await goPlace('hut_burned_marfa', 'пепелище');
await talk('marfa', 'Будет');
morningAt([63, 0, 110]);
for (const h of handlers.block) h({ player, block: blockAt(W(CASTLE.slots.master_diary)) }); ticks(2);
goTo(CASTLE.homes.marfa); ticks(4);
await talk('marfa', 'лечить');
give('minecraft:sweet_berries', 8); give('minecraft:honey_bottle', 1); give('minecraft:glistering_melon_slice', 1);
await talk('marfa', 'Вот всё');
expect(q('s6_cure') === 'done' && state().npcs.vsevolod === 'feast:0', 'король встал и спустился в зал');
goTo(CASTLE.feast[0]); ticks(8);
{ const k = npc('vsevolod'), c = W(CASTLE.feast[0]); expect(k && Math.hypot(k.location.x - c.x - 0.5, k.location.z - c.z - 0.5) < 2 && Math.abs(k.location.y - c.y) < 1, 'король правда перешёл в Большой зал'); }
await talk('marfa', 'Помогу');
fill('garden'); ticks(4); morningAt(); ticks(4);
expect(stage(6) && state().rank === 'Кастелян', 'этап 6 пройден, звание Кастелян');

// ===== Этап 7. Подземелье =====
goTo(CASTLE.homes.demyan); ticks(4);
await talk('demyan', 'Найду');
await goPlace('charcoal_prokhor', 'углежоги');
await talk('prokhor', 'гать');
await goPlace('gat_amulet', 'Старая гать');
{ const h = placeOf('gat_amulet').host; const c = { x: h[0], y: h[1] - 1, z: h[2] - 2 }; blockAt(c).setType('minecraft:chest'); for (const f of handlers.block) f({ player, block: blockAt(c) }); ticks(2); }
expect(hasItem('Оберег-башня'), 'оберег найден');
morningAt([63, 0, 110]);
goTo(CASTLE.homes.prokhor); ticks(4);
await talk('prokhor', 'Возьмусь');
fill('catacombs');
goTo(CASTLE.lairs.catacombs[0]);
await fight('acastle_cata', 2);
for (const h of handlers.block) h({ player, block: blockAt(W(CASTLE.slots.sealed)) }); ticks(2);
expect(hasItem('Письмо королевы'), 'письмо королевы');
morningAt(); ticks(4);
expect(stage(7) && !npc('ryzhy'), 'этап 7 пройден, лагерь опустел');

// ===== Этап 8. Пир и осада =====
goTo(CASTLE.homes.ignat); ticks(4);
await talk('ignat', 'Созываем');
await goPlace('sawmill_books', 'лесопилка');
await talk('watchman', 'Спасибо');
expect(hasItem('Счета Ножова'), 'счета Ножова');
give('minecraft:bread', 16); give('minecraft:cooked_mutton', 16); give('minecraft:cake', 2);
goTo(CASTLE.homes.agafya); ticks(2);
await talk('agafya', 'для пира');
expect(q('s8_siege') === 'active', 'осада');
morningAt([63, 0, 110]);
expect(state().npcs.timosha === 'home', 'Тимоша пришёл');
goTo([63, 0, 130]); nightFall(); ticks(12);
expect(state().npcs.vsevolod.startsWith('feast:') && state().npcs.agafya.startsWith('feast:'), 'жители собрались в Большом зале');
expect(entities.some((e) => e.hasTag('acastle_siege') && e.state === 'hostile'), 'шайка идёт на ворота');
ticks(4);
expect(npc('ryzhy') && npc('nozhov'), 'Рыжий у костра, Ножов позади');
await talk('ryzhy', 'оберег', 'Буду ждать');
expect(q('s8_siege') === 'done' && q('s8_nozhov') === 'active' && npc('nozhov').state === 'flee', 'Рыжий уводит шайку, Ножов бежит');
expect(!entities.some((e) => e.hasTag('acastle_siege')), 'нападающие ушли');
for (const h of handlers.trigger) h({ entity: npc('nozhov'), eventId: 'acastle:caught' }); ticks(2);
expect(npc('nozhov').state === 'captive', 'Ножов сдался');
npc('nozhov').location = { ...W(CASTLE.homes.prokhor) }; ticks(4);
expect(q('s8_nozhov') === 'done' && stage(8), 'Ножов в темнице, этап 8 пройден');

// ===== Этап 9. Наследие =====
time = 1000; morningAt([63, 6, 30]);
expect(q('s9_heir') === 'active' && state().npcs.ryzhy === 'home', 'Рыжий в замке');
ticks(8);
expect(npc('ryzhy') && npc('ryzhy').typeId === 'acastle:bandit', 'Рыжий у трона');
await talk('vsevolod', 'говорит', 'Отнесу');
expect(hasItem('Перстень основателя'), 'перстень основателя');
await goPlace('mark_shrine_master', 'капище');
ticks(4);
expect(q('s9_shrine') === 'done' && q('s9_return') === 'active', 'белый лось');
goTo([63, 6, 28]); ticks(6);
await talk('vsevolod', 'подведу');
expect(state().rank === 'Хозяин замка' && q('s9_heritage') === 'active', 'замок передан игроку');
fill('heritage'); ticks(4); morningAt(); ticks(6);
expect(state().f.king_dead && !npc('vsevolod'), 'король умер на рассвете');
expect(state().f.stage9_done, 'сюжет пройден');
expect(Object.values(state().rep).every((r) => r.st === 'done'), 'все единицы ремонта починены: ' + Object.entries(state().rep).filter(([, r]) => r.st !== 'done').map(([k]) => k).join(', '));
const missing = Object.keys(CASTLE.units).filter((u) => !state().rep[u]);
expect(!missing.length, 'все единицы ремонта задействованы: не хватает ' + missing.join(', '));

// ===== Книга рядом с жителем: «Говорить» =====
goTo(CASTLE.homes.agafya); ticks(4);
ticks(1); answers.push('Говорить: Повариха', 'Прощай'); for (const h of handlers.itemUse) h({ source: player, itemStack: new ItemStack('acastle:quest_book') });
await new Promise((r) => setTimeout(r, 5)); expect(!answers.length, 'книга рядом с Агафьей предлагает поговорить'); answers.length = 0;
// ===== Команда status =====
msgs.length = 0; for (const h of handlers.script) h({ id: 'acastle:status', message: '' });
expect(msgs.some((m) => /аддон \d+\.\d+\.\d+, скрипты работают/.test(m)), 'acastle:status отвечает');
// ===== Переход к этапу командой =====
player.location = { ...O };
await buildCastle();
ticks(4);
for (const h of handlers.script) h({ id: 'acastle:jump', message: '5', sourceEntity: player });
ticks(6);
expect(q('s5_carto') === 'active' && q('s4_crypt') === 'done' && state().rank === 'Рыцарь', 'переход к этапу 5');
morning(); ticks(4);
expect(state().rep.chapel && state().rep.chapel.st === 'done', 'после перехода починка прежних этапов встала');
console.log(dialogLog.slice(0, 6).join('\n'));
console.log('…');
console.log(`Сообщений игроку: ${msgs.length}, команд: ${log.length}, жителей: ${entities.filter((e) => /acastle/.test(e.typeId)).length}`);
fs.rmSync(DIR, { recursive: true, force: true });
if (problems.length) { console.log('\nОшибки:'); for (const p of problems) console.log(' - ' + p); process.exit(1); }
console.log('Проверочный прогон этапов 0–9 и перехода к этапу: всё сработало.');
