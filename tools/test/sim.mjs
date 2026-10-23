// Проверочный прогон скриптов заданий без игры: макет мира Minecraft (@minecraft/server и
// @minecraft/server-ui) и игрок, который проходит этапы 0 и 1. Ловит ошибки в коде и сюжете.
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
const handlers = { interact: [], itemUse: [], script: [], die: [], block: [] };
let interval = null;
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
    id: ++eid, typeId, location: { ...loc }, nameTag: '', valid: true, event: opts.spawnEvent,
    addTag: (t) => tags.add(t), removeTag: (t) => tags.delete(t), hasTag: (t) => tags.has(t), getTags: () => [...tags],
    triggerEvent(ev) { if (ev === 'acastle:despawn') this.remove(); },
    remove() { this.valid = false; entities.splice(entities.indexOf(this), 1); },
  };
  entities.push(e);
  return e;
}
const dim = {
  getBlock: (p) => blockAt(p),
  getTopmostBlock: ({ x, z }) => { const b = blockAt({ x, y: 63, z }); if (b.typeId === 'minecraft:stone') b.setType('minecraft:grass_block'); return b; },
  getEntities(o = {}) {
    return entities.filter((e) => (!o.tags || o.tags.every((t) => e.hasTag(t))) && (!o.type || e.typeId === o.type) && (!o.name || e.nameTag === o.name)
      && (!o.location || Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z) <= (o.maxDistance || Infinity)));
  },
  spawnEntity: (t, loc, o) => makeEntity(t, loc, o),
  spawnItem: (it, loc) => makeEntity('minecraft:item', loc),
  spawnParticle: () => { particles++; },
  runCommand: (c) => { log.push(c); return { successCount: 1 }; },
};
let particles = 0;
const inv = container(36);
const msgs = [];
const player = {
  typeId: 'minecraft:player', name: 'Игрок', location: { x: 1000, y: 64, z: 1000 },
  getViewDirection: () => ({ x: 0, y: 0, z: 1 }),
  getComponent(c) { if (c === 'minecraft:inventory') return { container: inv }; if (c === 'minecraft:equippable') return { getEquipment: () => inv.getItem(0) }; },
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
      getDay: () => day, getTimeOfDay: () => time, getDifficulty: () => difficulty,
      getPlayers: () => [player], getDimension: () => dim, sendMessage: (m) => msgs.push(m),
      afterEvents: { playerInteractWithEntity: ev(handlers.interact), itemUse: ev(handlers.itemUse), entityDie: ev(handlers.die), playerInteractWithBlock: ev(handlers.block) },
    },
    system: {
      runInterval: (fn) => { interval = fn; return 1; }, run: (fn) => fn(), runTimeout: (fn) => fn(),
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

// ---------- Сценарий ----------
await import(pathToFileURL(path.join(DIR, 'main.js')));
const { CASTLE } = await import(pathToFileURL(path.join(DIR, 'castle_data.js')));
const state = () => JSON.parse(props['acastle:state']);
const ticks = (n) => { for (let i = 0; i < n; i++) interval(); };
const O = { x: 5000, y: 64, z: 5000 }; // где игрок ставит замок (площадь у ворот)
const W = (c) => ({ x: O.x - CASTLE.origin[0] + c[0], y: O.y + c[1], z: O.z - CASTLE.origin[2] + c[2] });
const goTo = (c) => { player.location = { ...W(c) }; };
const npc = (id) => entities.find((e) => e.hasTag('acastle_npc_' + id));
async function talk(id, ...say) {
  const e = npc(id);
  if (!e) { problems.push(`нет жителя ${id}`); return; }
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

// 0. Замок поставлен
player.location = { ...O };
for (const h of handlers.script) h({ id: 'acastle:castle_placed', sourceEntity: player });
ticks(8);
expect(q('s0_halt') === 'active', 'задание «Стой, кто идёт?»');
expect(npc('ostap') && npc('mitka'), 'стражники у ворот');
expect(npc('vsevolod') && npc('agafya') && npc('frol'), 'король, Агафья, Фрол на местах');
// 1. Остап
goTo([63, 0, 122]); ticks(4);
await talk('ostap', 'Путник', 'доказать', 'Договорились');
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

console.log(dialogLog.slice(0, 6).join('\n'));
console.log('…');
console.log(`Сообщений игроку: ${msgs.length}, команд: ${log.length}, жителей: ${entities.filter((e) => /acastle/.test(e.typeId)).length}`);
fs.rmSync(DIR, { recursive: true, force: true });
if (problems.length) { console.log('\nОшибки:'); for (const p of problems) console.log(' - ' + p); process.exit(1); }
console.log('Проверочный прогон этапов 0 и 1: всё сработало.');
