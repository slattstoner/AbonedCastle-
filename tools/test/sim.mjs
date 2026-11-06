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
mod('@minecraft/server', 'const M = globalThis.SIM.server; export const world = M.world, system = M.system, ItemStack = M.ItemStack, BlockPermutation = M.BlockPermutation;');
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
class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId.includes(':') ? typeId : 'minecraft:' + typeId; this.amount = amount; this.nameTag = undefined; }
  setLore(l) { this.lore = l; }
  get maxAmount() { return /_pickaxe|_axe|_sword|_shovel|saddle|bucket|compass|quest_book/.test(this.typeId) ? 1 : 64; }
}
// Блок с состояниями (для работников: рельсы, факелы, заплатки строителя)
const perm = (id, states = {}) => ({ type: { id }, states, getAllStates: () => ({ ...states }), getState: (k) => states[k] });
const BlockPermutation = { resolve: (id, states = {}) => perm(id.includes(':') ? id : 'minecraft:' + id, { ...states }) };
// Недра мира ниже y 50 (для шахтёра): камень и глубинный сланец, руда по глубине, гравий,
// пещеры (иногда с водой, внизу — с лавой), коренная порода на дне. Всё — от координат.
const hash = (x, y, z, s = 0) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function underground(x, y, z) {
  if (y <= -64) return 'minecraft:bedrock';
  // пещера: шар радиусом 2–3 вокруг центра в ячейке 12×12×12
  const cx = Math.floor(x / 12), cy = Math.floor(y / 12), cz = Math.floor(z / 12);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const gx = cx + dx, gy = cy + dy, gz = cz + dz;
    if (hash(gx, gy, gz, 7) > 0.12) continue;
    const ox = gx * 12 + 6, oy = gy * 12 + 6, oz = gz * 12 + 6, r = 2 + hash(gx, gy, gz, 8) * 1.5;
    if ((x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2 <= r * r) {
      if (oy < -45 && y <= oy) return 'minecraft:lava';
      if (oy > 0 && hash(gx, gy, gz, 9) < 0.3 && y <= oy - 1) return 'minecraft:water';
      return 'minecraft:air';
    }
  }
  const deep = y < 0, q = hash(x, y, z, 1);
  const ore = (n) => 'minecraft:' + (deep ? 'deepslate_' : '') + n + '_ore';
  if (q < 0.012 && y > 0) return ore('coal');
  if (q < 0.02 && y < 60) return ore('iron');
  if (q < 0.025 && y > 0 && y < 50) return ore('copper');
  if (q < 0.0265 && y < 30) return ore('gold');
  if (q < 0.03 && y < 10) return ore('redstone');
  if (q < 0.031 && y < 30) return ore('lapis');
  if (q < 0.0325 && y < -40) return ore('diamond');
  if (q < 0.04) return 'minecraft:gravel';
  return deep ? 'minecraft:deepslate' : 'minecraft:stone';
}
const container = (size) => {
  const slots = new Array(size).fill(undefined);
  return { size, getItem: (i) => slots[i], setItem: (i, it) => { slots[i] = it; }, addItem: (it) => { const i = slots.findIndex((s) => !s); if (i < 0) return it; slots[i] = it; return undefined; }, clearAll: () => slots.fill(undefined), slots };
};
function blockAt(p) {
  const k = K(p);
  if (!blocks.has(k)) blocks.set(k, { typeId: p.y >= 64 ? 'minecraft:air' : p.y >= 50 ? 'minecraft:stone' : underground(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)), states: {} });
  const b = blocks.get(k);
  return {
    get typeId() { return b.typeId; }, location: { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) },
    get isLiquid() { return /water|lava/.test(b.typeId); },
    get isAir() { return b.typeId === 'minecraft:air'; },
    get permutation() { return perm(b.typeId, b.states); },
    setType(t) { b.typeId = t.includes(':') ? t : 'minecraft:' + t; b.states = {}; if (/chest|barrel/.test(t)) b.inv = container(27); },
    setPermutation(pm) { b.typeId = pm.type.id; b.states = { ...pm.states }; if (/chest|barrel/.test(pm.type.id)) b.inv = container(27); },
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
    setProperty(k, v) { (this.props = this.props || {})[k] = v; }, getProperty(k) { return (this.props || {})[k]; },
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
  playSound: () => {},
  runCommand: (c) => {
    log.push(c);
    // место тайги встало: в нём лежит метка хозяина (невидимый блок света) рядом с точкой
    const m = /^place structure \S+ (-?\d+) (-?\d+) (-?\d+)/.exec(c);
    if (m) blockAt({ x: +m[1] + 2, y: +m[2], z: +m[3] + 2 }).setType('minecraft:light_block_0');
    return { successCount: 1 };
  },
};
let particles = 0;
// Заплатки строителя: сборщик выкладывает их в build/sim/structures.json
const DUMP = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/sim/structures.json'), 'utf8'));
const structCache = {};
function simStructure(id) {
  const name = id.split(':')[1];
  if (structCache[name]) return structCache[name];
  const d = DUMP[name];
  if (!d) return undefined;
  const cells = new Map(d.cells.map(([x, y, z, n, st]) => [x + ',' + y + ',' + z, perm(n, st)]));
  return (structCache[name] = { size: { x: d.size[0], y: d.size[1], z: d.size[2] }, getBlockPermutation: ({ x, y, z }) => cells.get(x + ',' + y + ',' + z) });
}
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
    ItemStack, BlockPermutation,
    world: {
      getDynamicProperty: (k) => props[k], setDynamicProperty: (k, v) => { props[k] = v; },
      getDay: () => day, getTimeOfDay: () => time, getDifficulty: () => difficulty, getAbsoluteTime: () => day * 24000 + time,
      getPlayers: () => [player], getDimension: () => dim, sendMessage: (m) => msgs.push(m),
      structureManager: { place: (n, d, l) => placeStructure(n, d, l), get: (id) => simStructure(id) },
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
expect(q('s1_barracks') === 'active' && q('s1_ostrog') === 'active', 'капитан дал задания');
ticks(4);
fillChest('barracks', [['minecraft:spruce_planks', 32], ['minecraft:spruce_stairs', 16]]);
ticks(4);
morning(); ticks(4);
expect(q('s1_barracks') === 'done', 'казарма починена');
expect(state().npcs.demyan === 'home' && state().rep.rooms_1 && state().rep.rooms_1.st === 'done', 'Демьян переехал, его комнаты прибраны');
ticks(8);
expect(npc('demyan') && Math.hypot(npc('demyan').location.x - W(CASTLE.homes.demyan).x, npc('demyan').location.z - W(CASTLE.homes.demyan).z) < 2, 'Демьян в своей комнате');
await talk('demyan', 'Прощай'); // «я тут порядок навёл»
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
expect(Object.entries(state().rep).every(([u, r]) => r.st === 'done' || (CASTLE.units[u] && CASTLE.units[u].kind === 'build')), 'все единицы ремонта починены: ' + Object.entries(state().rep).filter(([, r]) => r.st !== 'done').map(([k]) => k).join(', '));
const missing = Object.keys(CASTLE.units).filter((u) => CASTLE.units[u].kind !== 'build' && !state().rep[u]);
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
// ===== Работники: рудокоп Кондрат и зодчий Мирон (docs/workers.md) =====
{
  const work = (m) => { for (const h of handlers.script) h({ id: 'acastle:work', message: m, sourceEntity: player }); };
  const ws = () => { for (const h of handlers.script) h({ id: 'acastle:work', message: 'save' }); return JSON.parse(props['acastle:work']); };
  const wk = (id) => entities.find((e) => e.hasTag('acastle_wk_' + id));
  async function talkW(id, ...say) {
    ticks(1); answers.push(...say);
    for (const h of handlers.interact) h({ player, target: wk(id) });
    await new Promise((r) => setTimeout(r, 5)); ticks(2);
    if (answers.length) { problems.push(`${id}: не все ответы использованы: ${answers.join(', ')}`); answers.length = 0; }
  }
  const runUntil = (cond, max, what) => { let n = 0; while (!cond() && n < max) { ticks(1); n++; } if (!cond()) problems.push('не дождались: ' + what + ` (за ${n} шагов)`); return n; };
  const inv = (c) => blockAt(W(c)).getComponent('minecraft:inventory').container;
  ticks(25);
  expect(wk('kondrat') && wk('miron'), 'работники появились у копра и на дворе строителя');
  // --- Шахтёр ---
  const M = CASTLE.works.mine;
  blockAt(W(M.barrel)).setType('minecraft:barrel');
  inv(M.barrel).addItem(new ItemStack('minecraft:stone_pickaxe', 1));
  for (let k = 0; k < 4; k++) inv(M.barrel).addItem(new ItemStack('minecraft:iron_pickaxe', 1));
  work('fast 20');
  await talkW('kondrat', 'Начинай');
  expect(ws().mine.on, 'Кондрат взялся за работу');
  runUntil(() => ws().mine.tool, 200, 'Кондрат взял кирку');
  expect(ws().mine.tool === 'iron', 'взял лучшую кирку из бочки (железную): ' + ws().mine.tool);
  const H = (await import(pathToFileURL(path.join(DIR, 'work_core.js')))).horizons(O.y);
  const C = await import(pathToFileURL(path.join(DIR, 'work_core.js')));
  expect(H.length === 3 && H[0].y < O.y - 15 && Math.abs(H[1].y - 16) <= 12 && H[2].y >= -60 && H[2].y <= -48, 'горизонты: ' + H.map((h) => h.title + ' y ' + h.y).join(', '));
  let n = runUntil(() => ws().mine.phase === 'done', 40000, '1-й горизонт выработан');
  const st = ws();
  console.log(`Шахтёр, 1-й горизонт: ${n} шагов прогона, выкопано ${st.mine.dug}, добыто: ${Object.entries(st.led.mined).map(([k, v]) => k.replace('minecraft:', '') + ' ' + v).join(', ')}; заделано дыр ${st.mine.sealed || 0}`);
  expect(st.mine.dug > 400, 'выкопано больше 400 блоков: ' + st.mine.dug);
  // Ствол: в каждой клетке спуска три блока воздуха, столб цел
  const ring = M.ring;
  for (let i = 1; i <= H[0].step; i++) {
    const [x, y, z] = C.shaftCell(ring, i), w = W([x, y, z]);
    for (let dy = 0; dy < 3; dy++) { const id = blockAt({ ...w, y: w.y + dy }).typeId; if (!/air|torch|rail/.test(id)) { problems.push(`ствол: шаг ${i} занят (${id})`); break; } }
  }
  for (let x = ring[0] + 1; x < ring[2]; x++) for (let z = ring[1] + 1; z < ring[3]; z++) if (blockAt(W([x, -5, z])).typeId === 'minecraft:air') problems.push('столб ствола выкопан');
  // У поверхности ничего лишнего не тронуто: воздух на уровне земли — только в кольце ствола
  for (const [k, b] of blocks) {
    const [x, y, z] = k.split(',').map(Number);
    if (y !== O.y - 1 || b.typeId !== 'minecraft:air') continue;
    const c = [x - (O.x - CASTLE.origin[0]), z - (O.z - CASTLE.origin[2])];
    if (!(c[0] >= ring[0] && c[0] <= ring[2] && c[1] >= ring[1] && c[1] <= ring[3])) problems.push(`дыра в земле двора у (${c[0]}, ${c[1]})`);
  }
  // Лава и вода не у хода: у каждой клетки штрека и веток соседи — не жидкость
  const corner = W(C.shaftCell(ring, H[0].step));
  let liquidNear = 0, tunnel = 0;
  for (let d = 0; d < C.DRIFT; d++) {
    const cells = [C.driftCell([corner.x, corner.y, corner.z], d)];
    if (C.hasBranch(d)) for (const side of [-1, 1]) for (let b = 0; b < C.BRANCH; b++) cells.push(C.branchCell([corner.x, corner.y, corner.z], d, side, b));
    for (const c of cells) for (let dy = 0; dy < 2; dy++) {
      const p = { x: c[0], y: c[1] + dy, z: c[2] };
      if (blockAt(p).typeId !== 'minecraft:air' && !/torch|rail/.test(blockAt(p).typeId)) continue;
      tunnel++;
      for (const [dx, ey, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) if (/water|lava/.test(blockAt({ x: p.x + dx, y: p.y + ey, z: p.z + dz }).typeId)) liquidNear++;
    }
  }
  expect(tunnel > 300 && !liquidNear, `ходы горизонта сухие: клеток хода ${tunnel}, жидкость рядом ${liquidNear}`);
  // Счёт сходится, а в сундуках у копра — ровно сданное
  msgs.length = 0; work('ledger');
  expect(msgs.some((m) => /Счёт сходится/.test(m)), 'счёт шахтёра сходится: ' + msgs.join(' / ').slice(0, 300));
  const chest = {};
  for (const c of M.chests) { const ci = inv(c); for (let i = 0; i < ci.size; i++) { const it = ci.getItem(i); if (it) chest[it.typeId] = (chest[it.typeId] || 0) + it.amount; } }
  const dep = ws().led.dep;
  expect(Object.keys(dep).every((k) => chest[k] === dep[k]), 'в сундуках у копра ровно сданное');
  expect(Object.values(chest).reduce((a, b) => a + b, 0) > 300, 'добыча в сундуках');
  // Рельсы и вагонетка, второй горизонт
  for (let k = 0; k < 3; k++) inv(M.barrel).addItem(new ItemStack('minecraft:rail', 64));
  await talkW('kondrat', 'рельсы');
  await talkW('kondrat', 'глубже');
  expect(ws().mine.open === 2, 'открыт 2-й горизонт');
  n = runUntil(() => ws().mine.h === 1 && ws().mine.phase !== 'shaft', 60000, '2-й горизонт: ствол дошёл');
  const sw = ws().mine;
  console.log(`Шахтёр, ствол до 2-го горизонта: ${n} шагов прогона, рельсов уложено на ${sw.railShaft} шагов ствола`);
  expect(sw.railShaft >= 20, 'рельсы уложены в ствол: ' + sw.railShaft);
  { const [x, y, z] = C.shaftCell(ring, 5), b = blockAt(W([x, y, z])); expect(b.typeId === 'minecraft:rail' && b.permutation.getState('rail_direction') === C.shaftRail(5), 'рельс на 5-м шаге ствола с подъёмом: ' + b.typeId + ' ' + b.permutation.getState('rail_direction')); }
  expect(!entities.some((e) => e.typeId === 'minecraft:minecart'), 'вагонетки после поездок убраны');
  // Опасности на 2-м горизонте: лава у штрека, гравий над ходом, чужой сундук в ветке, алмаз в стене
  const c2 = W(C.shaftCell(ring, H[1].step)), co = [c2.x, c2.y, c2.z];
  const at = (c, dy = 0, dz = 0) => ({ x: c[0], y: c[1] + dy, z: c[2] + dz });
  const lava = at(C.driftCell(co, 5), 0, 1), gravelAt = C.driftCell(co, 6), chestAt = C.branchCell(co, 7, -1, 5), dia = at(C.driftCell(co, 9), 1, -1);
  blockAt(lava).setType('minecraft:lava');
  for (let dy = 2; dy <= 4; dy++) blockAt(at(gravelAt, dy)).setType('minecraft:gravel');
  blockAt(at(gravelAt, 5)).setType('minecraft:stone');
  blockAt(at(chestAt)).setType('minecraft:chest');
  blockAt(dia).setType('minecraft:deepslate_diamond_ore');
  const dia0 = ws().led.mined['minecraft:diamond'] || 0;
  n = runUntil(() => ws().mine.phase === 'done', 60000, '2-й горизонт выработан');
  console.log(`Шахтёр, 2-й горизонт: ${n} шагов прогона, всего выкопано ${ws().mine.dug}`);
  expect(blockAt(lava).typeId !== 'minecraft:lava', 'лава у штрека заложена: ' + blockAt(lava).typeId);
  expect([2, 3, 4].every((dy) => blockAt(at(gravelAt, dy)).typeId !== 'minecraft:gravel') && blockAt(at(gravelAt, 2)).typeId === 'minecraft:cobblestone' && blockAt(at(gravelAt, 5)).typeId === 'minecraft:stone',
    'гравий над ходом выбран, потолок заделан булыжником, камень выше цел: ' + [2, 3, 4, 5].map((dy) => blockAt(at(gravelAt, dy)).typeId.replace('minecraft:', '')).join(','));
  expect(blockAt(at(chestAt)).typeId === 'minecraft:chest' && blockAt(at(C.branchCell(co, 7, -1, 4))).typeId !== 'minecraft:stone', 'чужой сундук не тронут, ветка остановилась перед ним');
  expect((ws().led.mined['minecraft:diamond'] || 0) > dia0 && blockAt(dia).typeId === 'minecraft:air', 'алмаз из стены хода добыт');
  expect(ws().errs.length === 0, 'без ошибок: ' + ws().errs.join(' | '));
  msgs.length = 0; work('ledger');
  expect(msgs.some((m) => /Счёт сходится/.test(m)), 'счёт сходится после второго горизонта');
  // Глубинный горизонт: глубинный сланец, пещеры с лавой, алмазы
  await talkW('kondrat', 'глубже');
  n = runUntil(() => ws().mine.h === 2 && ws().mine.phase === 'done', 120000, 'глубинный горизонт выработан');
  { const L = ws().led.mined, m = ws().mine;
    console.log(`Шахтёр, глубинный горизонт (y ${H[2].y}): ${n} шагов прогона, всего выкопано ${m.dug}, заделано дыр ${m.sealed || 0}, алмазов ${L['minecraft:diamond'] || 0}, красной пыли ${L['minecraft:redstone'] || 0}, глубинного булыжника ${L['minecraft:cobbled_deepslate'] || 0}, кирка ${m.tool} (${m.uses})`);
    const c3 = W(C.shaftCell(ring, H[2].step)), k3 = [c3.x, c3.y, c3.z];
    let wet = 0;
    for (let d = 0; d < C.DRIFT; d++) for (const c of [C.driftCell(k3, d), ...(C.hasBranch(d) ? [-1, 1].flatMap((sd) => [...Array(C.BRANCH).keys()].map((b) => C.branchCell(k3, d, sd, b))) : [])])
      for (let dy = 0; dy < 2; dy++) for (const [dx, ey, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) if (/lava|water/.test(blockAt({ x: c[0] + dx, y: c[1] + dy + ey, z: c[2] + dz }).typeId) && !dx && !dz && !ey) wet++;
    expect(!wet, 'в ходах глубинного горизонта нет лавы: ' + wet);
    expect(ws().errs.length === 0, 'глубинный горизонт без ошибок: ' + ws().errs.join(' | '));
  }
  msgs.length = 0; work('ledger');
  expect(msgs.some((m) => /Счёт сходится/.test(m)), 'счёт сходится после глубинного горизонта');
  await talkW('kondrat', 'Передохни');
  // --- Строитель ---
  work('fill');
  const O1 = CASTLE.orders.find((o) => o.step === 'wood');
  await talkW('miron', O1.title, 'Берись');
  expect(ws().build.order === O1.id, 'Мирон взял заказ ' + O1.title + ': ' + ws().build.order + ' / ' + (ws().errs || []).join('; '));
  n = runUntil(() => ws().build.done[O1.id], 20000, 'частокол поставлен');
  const match = (o) => { let bad = 0, all = 0; for (const [name, x1, y1, z1] of o.pieces) for (const [x, y, z, nm, sts] of DUMP[name].cells) { all++; const b = blockAt(W([x1 + x, y1 + y, z1 + z])); if (b.typeId !== nm || JSON.stringify(b.permutation.getAllStates()) !== JSON.stringify(sts)) bad++; } return [bad, all]; };
  let [bad, all] = match(O1);
  console.log(`Строитель, ${O1.title}: ${n} шагов прогона, поставлено ${ws().build.placed}, клеток заплатки ${all}, не совпало ${bad}, лесов ${ws().build.scaff.length}`);
  expect(!bad, `частокол совпадает с заплаткой (${bad} из ${all} не так)`);
  const O2 = CASTLE.orders.find((o) => o.id === O1.unit + ':stone');
  await talkW('miron', O2.title, 'Берись');
  n = runUntil(() => ws().build.done[O2.id], 60000, 'каменный пролёт сложен');
  [bad, all] = match(O2);
  console.log(`Строитель, ${O2.title}: ${n} шагов прогона, поставлено ${ws().build.placed}, разобрано ${ws().build.removed}, клеток ${all}, не совпало ${bad}, лесов поставлено ${ws().build.scaffTotal || 0}, переходов напрямик ${ws().dbgDirect || 0}`);
  console.log('  напрямик (последние): ' + (ws().dbgLast || []).map((t) => t.split(' → ').map((q) => q.split(' ').map(Number).map((v, i) => v - [O.x - CASTLE.origin[0], O.y, O.z - CASTLE.origin[2]][i]).join(',')).join(' → ')).join(' | '));
  expect(!bad, `каменный пролёт совпадает с заплаткой (${bad} из ${all} не так)`);
  expect(![...blocks.values()].some((b) => b.typeId === 'minecraft:scaffolding'), 'леса разобраны');
  msgs.length = 0; work('ledger');
  expect(msgs.some((m) => /Счёт сходится/.test(m)), 'счёт строителя сходится: ' + msgs.join(' / ').slice(0, 300));
  msgs.length = 0; work('status');
  expect(msgs.some((m) => /Работники/.test(m)) && !(ws().errs || []).length, 'status без ошибок: ' + (ws().errs || []).join(' | '));
}
console.log(dialogLog.slice(0, 6).join('\n'));
console.log('…');
console.log(`Сообщений игроку: ${msgs.length}, команд: ${log.length}, жителей: ${entities.filter((e) => /acastle/.test(e.typeId)).length}`);
fs.rmSync(DIR, { recursive: true, force: true });
if (problems.length) { console.log('\nОшибки:'); for (const p of problems) console.log(' - ' + p); process.exit(1); }
console.log('Проверочный прогон этапов 0–9 и перехода к этапу: всё сработало.');
