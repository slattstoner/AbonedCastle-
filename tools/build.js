#!/usr/bin/env node
// Сборка аддона: постройки (design/preview/structures) + истории (design/stories)
// → behavior pack с .mcstructure, jigsaw-генерацией, таблицами лута и манифестом,
// упакованный в dist/*.mcaddon. Запуск: node tools/build.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { T, TYPE, encode } = require('./nbt');
const { toBedrock, jigsaw, paletteEntry } = require('./bedrock');
const loot = require('./loot');

const ROOT = path.resolve(__dirname, '..');
const NS = 'acastle';
const PACK = {
  name: 'Abandoned Castle: Тайга',
  description: 'Постройки хвойного биома: хижины, лагеря, ориентиры, хутора, острог и скит. С тайниками и историями. Пробный замок: /function castle',
  header: '6f3d2a8e-4c1b-4f7a-9e2d-5b8c1a7f3e90',
  module: 'a2c94e17-8b3f-4d6a-b1e5-0f7d9c3a2b48',
  version: [0, 5, 0],
  minEngine: [1, 21, 120],
};
// Частота: spacing — размер ячейки в чанках (одна попытка на ячейку), separation — минимальный зазор.
const SETS = {
  common: { spacing: 12, separation: 4, salt: 731221 },
  landmarks: { spacing: 9, separation: 3, salt: 552097 },
  rare: { spacing: 24, separation: 8, salt: 918342 },
};
const BIOMES = [{ test: 'has_biome_tag', operator: '==', value: 'taiga' }];
const TRAIL_LEN = 18;

// ---------- Загрузка описаний ----------
global.window = global;
const STORIES = {};
global.defineStories = (id, list) => { STORIES[id] = list; };
global.book = (title, author, pages) => ({ book: { title, author, pages } });
global.sign = (text) => ({ sign: text });
global.loot = (spec) => ({ loot: spec });

const load = (rel) => vm.runInThisContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), { filename: rel });
for (const f of ['blocks.js', 'builder.js']) load('design/preview/' + f);
for (const f of fs.readdirSync(path.join(ROOT, 'design/preview/structures')).sort()) load('design/preview/structures/' + f);
for (const f of fs.readdirSync(path.join(ROOT, 'design/stories')).sort()) load('design/stories/' + f);

const OUT = path.join(ROOT, 'build/AbandonedCastle_BP');
fs.rmSync(path.join(ROOT, 'build'), { recursive: true, force: true });
const write = (rel, data) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2));
};
const warnings = [];
const warn = (m) => { if (!warnings.includes(m)) warnings.push(m); };

// Сверка с данными игры 1.26.50: неверное имя или состояние блока ломает шаблон.
const VANILLA_BLOCKS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/blocks-1.26.50.json'), 'utf8'));
const VANILLA_ITEMS = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'data/items-1.26.50.json'), 'utf8')));
function checkBlock(b) {
  const ref = VANILLA_BLOCKS[b.name];
  if (!ref) return warn(`неизвестный блок ${b.name}`);
  for (const [k, v] of Object.entries(b.states)) {
    if (!(k in ref)) warn(`${b.name}: лишнее состояние ${k}`);
    else if (ref[k].length && !ref[k].includes(v)) warn(`${b.name}: ${k}=${v} нет в игре`);
  }
  for (const k of Object.keys(ref)) if (!(k in b.states)) warn(`${b.name}: не задано состояние ${k}`);
}
function checkTable(t, where) {
  for (const pool of t.pools) for (const e of pool.entries) if (!VANILLA_ITEMS.has(e.name)) warn(`${where}: неизвестный предмет ${e.name}`);
}

// ---------- .mcstructure ----------
function mcstructure(size, cells) {
  const [X, Y, Z] = size;
  const palette = [], paletteIndex = new Map(), indices = new Array(X * Y * Z).fill(-1), positionData = {};
  for (const { x, y, z, block } of cells) {
    const key = JSON.stringify([block.name, block.states]);
    if (!paletteIndex.has(key)) { paletteIndex.set(key, palette.length); palette.push(block); checkBlock(block); }
    const i = (x * Y + y) * Z + z;
    indices[i] = paletteIndex.get(key);
    if (block.entity) positionData[String(i)] = T.compound({ block_entity_data: block.entity });
  }
  return encode(T.compound({
    format_version: T.int(1),
    size: T.list(TYPE.INT, size.map(T.int)),
    structure: T.compound({
      block_indices: T.list(TYPE.LIST, [T.list(TYPE.INT, indices.map(T.int)), T.list(TYPE.INT, indices.map(() => T.int(-1)))]),
      entities: T.list(TYPE.END, []),
      palette: T.compound({ default: T.compound({ block_palette: T.list(TYPE.COMPOUND, palette.map(paletteEntry)), block_position_data: T.compound(positionData) }) }),
    }),
    structure_world_origin: T.list(TYPE.INT, [T.int(0), T.int(0), T.int(0)]),
  }));
}

// ---------- Лут ----------
const writtenThemes = new Set();
function themeTable(theme, rolls) {
  const id = rolls ? `${theme}_small` : theme;
  if (!writtenThemes.has(id)) {
    const t = loot.table({ theme, rolls: rolls || [2, 4] });
    checkTable(t, 'тема ' + theme);
    write(`loot_tables/${NS}/themes/${id}.json`, t);
    writtenThemes.add(id);
  }
  return `loot_tables/${NS}/themes/${id}.json`;
}
function storyTable(rel, v) {
  const spec = v.loot ? { ...v.loot } : { books: [v.book] };
  spec.books = (spec.books || []).map((b) => (b.book ? b.book : b));
  for (const b of spec.books) checkBook(b, rel);
  const t = loot.table(spec);
  checkTable(t, rel);
  write(`loot_tables/${NS}/${rel}.json`, t);
  return `loot_tables/${NS}/${rel}.json`;
}
function checkBook(b, where) {
  b.pages.forEach((p, i) => { if (p.length > 256) warn(`${where}: «${b.title}», стр. ${i + 1} длиннее 256 символов (${p.length})`); });
  if (b.title.length > 32) warn(`${where}: заголовок «${b.title}» длиннее 32 символов`);
}

const CONTAINERS = new Set(['chest', 'barrel', 'decorated_pot', 'suspicious_gravel']);

// Опора: растения, свечи, ковры и сыпучие блоки должны на чём-то стоять, висячие
// фонари — висеть, лестницы и рамки — крепиться к стене. Иначе в игре они осыплются.
const NEEDS_FLOOR = /fern|grass$|bush|mushroom|poppy|sapling|candle|carpet|flower_pot|cake|potatoes|carrots|beetroot|deadbush|suspicious_gravel|spruce_door|campfire|lantern|stand|torch|lever|pressure_plate/;
const ATTACHED = new Set(['ladder', 'item_frame', 'vine', 'spruce_sign', 'brown_banner', 'red_banner', 'blue_banner', 'white_banner', 'painting']);
const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };
const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function checkSupport(sid, blocks, get) {
  for (const v of blocks) {
    const at = `${sid} (${v.x},${v.y},${v.z}) ${v.id}`;
    if (v.y === -1) continue;
    const below = get(v.x, v.y - 1, v.z);
    if ((v.id === 'lantern' || v.id === 'soul_lantern') && v.hang) { if (!get(v.x, v.y + 1, v.z)) warn(`${at}: висит в воздухе`); continue; }
    if ((v.id === 'torch' && v.f) || v.id.endsWith('_shelf')) {
      const [dx, dz] = STEP[v.id === 'torch' ? v.f : OPPOSITE[v.f || 's']];
      if (!get(v.x + dx, v.y, v.z + dz)) warn(`${at}: не к чему крепиться`);
      continue;
    }
    if (v.id === 'item_frame' && v.f === 'u') { if (!below) warn(`${at}: нет опоры снизу`); continue; }
    if ((ATTACHED.has(v.id) || v.id.endsWith('_banner')) && v.stand === undefined) {
      const [dx, dz] = STEP[v.f || 'n'];
      const wall = get(v.x + dx, v.y, v.z + dz);
      if (!wall) warn(`${at}: не к чему крепиться`);
      else if (v.id === 'ladder' && /glass|pane|bars/.test(wall.id)) warn(`${at}: лестница на стекле или решётке — в игре отвалится`);
      continue;
    }
    if ((NEEDS_FLOOR.test(v.id) || v.stand !== undefined) && !(v.id === 'spruce_door' && v.top) && !below) warn(`${at}: нет опоры снизу`);
  }
}

// ---------- Тропа к дальнему тайнику ----------
function trailCells(sid, story, poolTrail) {
  const t = story.trail;
  const b = new Builder(sid.length * 97 + story.id.length);
  const cells = [];
  const put = (x, y, z, id, p = {}) => b.set(x, y, z, id, p);
  if (t.path !== false) for (let z = 1; z < TRAIL_LEN - 3; z++) if (b.chance(0.75)) put(2 + Math.round(Math.sin(z / 3) * 1), 0, z, [['grass_path', 2], ['coarse_dirt', 2], ['podzol', 1]]);
  const cz = TRAIL_LEN - 2;
  const chest = { slot: 'cache', f: 'n' };
  switch (t.cache) {
    case 'stump': put(2, 0, cz, 'chest', chest); put(2, 1, cz, 'spruce_log'); put(3, 1, cz + 1, 'spruce_log', { a: 'x' }); break;
    case 'cairn': put(2, 0, cz, 'chest', chest); for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) put(2 + dx, 1, cz + dz, ['mossy_cobblestone', 'cobblestone']); put(2, 2, cz, 'mossy_cobblestone'); put(2, 3, cz, 'cobblestone_wall'); break;
    case 'mound': put(2, 0, cz, 'chest', chest); put(2, 1, cz, 'coarse_dirt'); put(1, 1, cz, 'moss_carpet'); put(3, 1, cz, 'moss_carpet'); put(2, 1, cz + 1, 'moss_carpet'); break;
    case 'stake': put(2, 0, cz, 'chest', chest); put(2, 1, cz, 'spruce_fence'); put(2, 2, cz, 'spruce_fence'); put(2, 3, cz, 'skeleton_skull'); break;
    case 'gravel': put(2, 0, cz, 'suspicious_gravel', { slot: 'cache' }); put(3, 1, cz, 'mossy_cobblestone_slab'); put(1, 1, cz + 1, 'mossy_cobblestone_slab'); break;
    case 'roots': put(2, 0, cz, 'chest', chest); put(2, 1, cz, 'rooted_dirt'); put(1, 1, cz, 'fern'); put(3, 1, cz + 1, 'short_grass'); break;
    case 'stone': put(2, 0, cz, 'chest', chest); b.fill(2, 1, cz, 3, 1, cz + 1, 'mossy_cobblestone'); put(2, 2, cz, 'mossy_cobblestone'); break;
    case 'cross': put(2, 0, cz, 'chest', chest); b.fill(2, 1, cz, 2, 3, cz, 'spruce_fence'); put(1, 2, cz, 'spruce_fence'); put(3, 2, cz, 'spruce_fence'); break;
    default: throw new Error(`${sid}/${story.id}: неизвестный тип тайника ${t.cache}`);
  }
  const lootPath = storyTable(`${sid}/${story.id}/cache`, t.loot);
  const get = (x, y, z) => b.get(x, y, z);
  for (const blk of b.blocks.values()) cells.push({ x: blk.x, y: blk.y, z: blk.z, block: toBedrock(blk, get, BLOCKS, blk.slot ? { lootTable: lootPath } : {}) });
  cells.push({ x: 2, y: 0, z: 0, block: jigsaw('n', { name: `${NS}:trail_entry`, target: 'minecraft:empty', pool: 'minecraft:empty', final: t.path === false ? 'minecraft:podzol' : 'minecraft:grass_path' }) });
  return mcstructure([5, 4, TRAIL_LEN], cells);
}

// ---------- Постройки ----------
const pools = {};
const docs = [];
for (const s of STRUCTURES) {
  const stories = STORIES[s.id];
  if (!stories || !stories.length) { warn(`${s.id}: нет историй — постройка пропущена`); continue; }
  const elements = [];
  const docEntry = { s, stories: [] };
  for (const story of stories) {
    const b = s.build(story.state);
    const tmpl = [...b.blocks.values()].filter((v) => !v.env);
    const slotsHere = new Set(tmpl.filter((v) => v.slot).map((v) => v.slot));
    for (const k of Object.keys(story.slots || {})) if (!slotsHere.has(k)) warn(`${s.id}/${story.id}: слота «${k}» нет в постройке`);
    if (story.trail && !b.anchors[story.trail.anchor]) warn(`${s.id}/${story.id}: нет якоря «${story.trail.anchor}»`);
    const map0 = new Map(tmpl.map((v) => [v.x + ',' + v.y + ',' + v.z, v]));
    const [ax1, az1, ax2, az2] = b.area;
    let minX = ax1, maxX = ax2, minZ = az1, maxZ = az2, maxY = 0;
    for (const v of tmpl) {
      if (v.y < -1) throw new Error(`${s.id}: блок ниже уровня земли (${v.x},${v.y},${v.z})`);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z); maxY = Math.max(maxY, v.y);
    }
    if (minX < ax1 || maxX > ax2 || minZ < az1 || maxZ > az2) warn(`${s.id}: блоки выходят за участок земли`);
    checkSupport(s.id, tmpl, (x, y, z) => map0.get(x + ',' + y + ',' + z));
    const size = [maxX - minX + 1, maxY + 2, maxZ - minZ + 1];
    const map = new Map(tmpl.map((v) => [v.x + ',' + v.y + ',' + v.z, v]));
    const get = (x, y, z) => map.get(x + ',' + y + ',' + z);
    const cells = [];
    const rel = `${s.id}/${story.id}`;
    for (let x = 0; x < size[0]; x++) for (let y = 0; y < size[1]; y++) for (let z = 0; z < size[2]; z++) {
      const wx = x + minX, wy = y - 1, wz = z + minZ;
      const blk = get(wx, wy, wz);
      if (!blk) { if (wy >= 0) cells.push({ x, y, z, block: { name: 'minecraft:air', states: {} } }); continue; }
      if (blk.anchor) {
        if (story.trail && story.trail.anchor === blk.anchor) {
          cells.push({ x, y, z, block: jigsaw(blk.f, { name: `${NS}:anchor`, target: `${NS}:trail_entry`, pool: `${NS}:taiga/${rel}/trail`, final: 'minecraft:grass_path' }) });
          continue;
        }
      }
      const v = blk.slot ? (story.slots || {})[blk.slot] : undefined;
      const slotData = {};
      if (CONTAINERS.has(blk.id)) {
        if (v) slotData.lootTable = storyTable(`${rel}/${blk.slot}`, v);
        else if (blk.theme) slotData.lootTable = themeTable(blk.theme);
        else if (blk.slot) slotData.lootTable = themeTable('junk', [1, 3]);
      } else if (v && v.book) { checkBook(v.book, rel); slotData.book = v.book; }
      else if (v && v.sign !== undefined) slotData.sign = v.sign;
      cells.push({ x, y, z, block: toBedrock(blk, get, BLOCKS, slotData) });
    }
    write(`structures/${NS}/taiga/${s.id}_${story.id}.mcstructure`, mcstructure(size, cells));
    if (story.trail) {
      write(`structures/${NS}/taiga/trail/${s.id}_${story.id}.mcstructure`, trailCells(s.id, story));
      pools[`${s.id}_${story.id}_trail`] = {
        identifier: `${NS}:taiga/${rel}/trail`,
        elements: [{ element: { element_type: 'minecraft:single_pool_element', location: `${NS}/taiga/trail/${s.id}_${story.id}`, projection: 'minecraft:terrain_matching' }, weight: 1 }],
      };
    }
    elements.push({ element: { element_type: 'minecraft:single_pool_element', location: `${NS}/taiga/${s.id}_${story.id}`, processors: `${NS}:taiga_weathering` }, weight: story.weight || 1 });
    docEntry.stories.push({ story, size });
  }
  pools[s.id] = { identifier: `${NS}:taiga/${s.id}`, elements };
  write(`worldgen/structures/${s.id}.json`, {
    format_version: '1.21.100',
    'minecraft:jigsaw': {
      description: { identifier: `${NS}:${s.id}` },
      biome_filters: BIOMES,
      step: 'surface_structures',
      terrain_adaptation: 'beard_thin',
      start_pool: `${NS}:taiga/${s.id}`,
      max_depth: 1,
      start_height: { type: 'constant', value: { absolute: 0 } },
      heightmap_projection: 'world_surface',
    },
  });
  docs.push(docEntry);
}

// ---------- Замок для проверки командой ----------
// Пока без генерации в мире: замок режется на куски 64×64 (больше одного куска
// игра не загружает), а функция castle ставит их все вокруг игрока.
{
  const n = STRUCTURES.length;
  load('design/preview/physics.js');
  load('design/preview/castle/castle.js');
  const castle = STRUCTURES.splice(n)[0];
  const b = castle.build();
  // Проверки донжона: дойти до каждой комнаты, двери не упираются в стену, нет тёмных мест.
  {
    const { placed, light, walk, inside } = b.lighting;
    const P = CastlePhysics;
    const near = (m) => { for (let dy = 0; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (walk.has(m.x + dx, m.y + dy, m.z + dz)) return true; return false; };
    const BEHIND_SECRET = ['Древнее святилище'];
    for (const m of b.marks) if (m.type === 'room' && !BEHIND_SECRET.includes(m.title) && (m.y < -1 || b.keepArea(m.x, m.z)) && !near(m)) warn(`замок: не дойти до «${m.title}» (${m.x},${m.y},${m.z})`);
    let doors = 0;
    for (const v of b.blocks.values()) {
      if (!v.id.endsWith('_door') || v.top || !(v.y < -1 || b.keepArea(v.x, v.z))) continue;
      const [dx, dz] = v.f === 'e' || v.f === 'w' ? [1, 0] : [0, 1];
      const sides = [[v.x - dx, v.z - dz], [v.x + dx, v.z + dz]].map(([x, z]) => walk.stand(x, v.y, z));
      if (!sides[0] || !sides[1]) warn(`замок: дверь (${v.x},${v.y},${v.z}) ${v.id} упирается в стену или мебель`);
      doors++;
    }
    const dark = inside.filter(([x, y, z]) => light.at(x, y, z) < (y <= -2 ? 6 : 8));
    const levels = {};
    for (const [x, y, z] of inside) { const k = y <= -2 ? 'подземелье' : 'y' + y; const l = light.at(x, y, z); const e = levels[k] || (levels[k] = { n: 0, min: 99, sum: 0 }); e.n++; e.min = Math.min(e.min, l); e.sum += l; }
    console.log(`Замок: проверено дверей ${doors}, комнат ${b.marks.filter((m) => m.type === 'room').length}; клеток пола под крышей ${inside.length}, автофакелов ${placed.length}, тёмных клеток ${dark.length}`);
    console.log('Свет по уровням: ' + Object.entries(levels).sort().map(([k, e]) => `${k}: мин ${e.min}, ср ${(e.sum / e.n).toFixed(1)}`).join('; '));
    for (const [x, y, z] of dark.slice(0, 15)) warn(`замок: темно (${light.at(x, y, z)}) в (${x},${y},${z})`);
    // Тайники под сюжеты: имена слотов должны быть разными, иначе история не поймёт, куда класть
    const slots = {};
    for (const v of b.blocks.values()) if (v.slot) (slots[v.slot] = slots[v.slot] || []).push(`${v.id} (${v.x},${v.y},${v.z})`);
    for (const [k, list] of Object.entries(slots)) if (list.length > 1) warn(`замок: слот «${k}» встречается ${list.length} раза: ${list.join(', ')}`);
    console.log(`Тайники замка: ${Object.keys(slots).length} слотов — ${Object.keys(slots).join(', ')}`);
  }
  // Восстановленный замок (конец сюжета) — для проверок и заплаток этапов
  const tmplFull = [...b.blocks.values()].filter((v) => !v.env);
  const mapFull = new Map(tmplFull.map((v) => [v.x + ',' + v.y + ',' + v.z, v]));
  const getFull = (x, y, z) => { const v = mapFull.get(x + ',' + y + ',' + z); return v && v.id !== 'air' ? v : undefined; };
  checkSupport('castle', tmplFull.filter((v) => v.id !== 'air'), getFull);
  // В мире замок встаёт в упадке (castle.js: ruins), этапы сюжета накладывают заплатки
  const R = b.ruin;
  const tmpl = [...R.blocks.values()].filter((v) => !v.env);
  const map = new Map(tmpl.map((v) => [v.x + ',' + v.y + ',' + v.z, v]));
  const get = (x, y, z) => { const v = map.get(x + ',' + y + ',' + z); return v && v.id !== 'air' ? v : undefined; };
  checkSupport('замок в упадке', tmpl.filter((v) => v.id !== 'air'), get);
  {
    // В упадке до жилых помещений этапа 0 и по главному пути всё равно можно дойти
    const W = CastlePhysics.walk({ get: (x, y, z) => map.get(x + ',' + y + ',' + z) }, b.walkOpts.box, b.walkOpts.starts);
    const near = (m) => { for (let dy = 0; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (W.has(m.x + dx, m.y + dy, m.z + dz)) return true; return false; };
    for (const t of castle.startRooms) {
      const m = b.marks.find((mk) => mk.type === 'room' && mk.title === t);
      if (!m) warn(`замок: нет помещения «${t}»`);
      else if (!near(m)) warn(`замок в упадке: не дойти до «${t}»`);
    }
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of tmpl) [v.x, v.y, v.z].forEach((c, k) => { lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c); });
  // Основание: толща грунта под территорией и склон вокруг неё (castle.js, foundation).
  // Над склоном шаблон пуст — там остаётся рельеф мира, явный воздух только над территорией.
  const F = castle.foundation;
  const [fx1, fz1, fx2, fz2] = F.rect;
  lo[0] = Math.min(lo[0], fx1 - F.skirt); hi[0] = Math.max(hi[0], fx2 + F.skirt);
  lo[2] = Math.min(lo[2], fz1 - F.skirt); hi[2] = Math.max(hi[2], fz2 + F.skirt);
  lo[1] = Math.min(lo[1], F.depth);
  const inTerritory = (x, z) => x >= fx1 && x <= fx2 && z >= fz1 && z <= fz2;
  const foundCount = {};
  const PART = 64, ORIGIN = [63, 0, 98]; // игрок стоит на площади у ворот, замок к северу
  const lines = [
    '# Замок из замшелого камня: ставит все куски вокруг игрока.',
    '# Встаньте в обычном мире (не в плоском: подземелье и основание уходят на 25 блоков вниз).',
  ];
  let parts = 0;
  for (let x0 = lo[0]; x0 <= hi[0]; x0 += PART) for (let z0 = lo[2]; z0 <= hi[2]; z0 += PART) {
    const size = [Math.min(PART, hi[0] - x0 + 1), hi[1] - lo[1] + 1, Math.min(PART, hi[2] - z0 + 1)];
    const cells = [];
    for (let x = 0; x < size[0]; x++) for (let y = 0; y < size[1]; y++) for (let z = 0; z < size[2]; z++) {
      const wx = x0 + x, wy = lo[1] + y, wz = z0 + z;
      const blk = map.get(wx + ',' + wy + ',' + wz);
      if (!blk || blk.env) {
        if (wy >= 0) { if (inTerritory(wx, wz)) cells.push({ x, y, z, block: { name: 'minecraft:air', states: {} } }); continue; }
        const id = F.at(wx, wy, wz);
        if (id) { foundCount[id] = (foundCount[id] || 0) + 1; cells.push({ x, y, z, block: toBedrock({ x: wx, y: wy, z: wz, id }, get, BLOCKS) }); }
        continue;
      }
      if (blk.id === 'air') { cells.push({ x, y, z, block: { name: 'minecraft:air', states: {} } }); continue; }
      const slotData = CONTAINERS.has(blk.id) && blk.theme ? { lootTable: themeTable(blk.theme) } : {};
      cells.push({ x, y, z, block: toBedrock(blk, get, BLOCKS, slotData) });
    }
    const name = `castle_${parts}`;
    write(`structures/${NS}/${name}.mcstructure`, mcstructure(size, cells));
    lines.push(`structure load ${NS}:${name} ~${x0 - ORIGIN[0]} ~${lo[1] - ORIGIN[1]} ~${z0 - ORIGIN[2]}`);
    parts++;
  }
  // «Сердце замка» — метка в каменной камере под площадью, от неё работают функции этапов
  const HEART = [ORIGIN[0], -20, ORIGIN[2]];
  const HEART_SEL = '@e[type=armor_stand,name=acastle_heart]';
  lines.push(`kill ${HEART_SEL}`, `summon armor_stand acastle_heart ~ ~${HEART[1] - ORIGIN[1]} ~`);
  lines.push(`tellraw @s {"rawtext":[{"text":"Замок поставлен в упадке: ${parts} кусков. Ворота у вас за спиной, донжон впереди к северу. Восстановление по этапам: /function castle_stage_1 … castle_stage_9, всё сразу: /function castle_full"}]}`);
  write('functions/castle.mcfunction', lines.join('\n') + '\n');

  // ---------- Этапы восстановления ----------
  // Заплатка этапа: клетки его зон в восстановленном виде, остальные клетки куска пустые
  // (не трогают мир). Режется на куски 64×64, как и сам замок.
  const stageReport = [];
  for (const st of castle.stagesInfo) {
    if (!st.n) continue;
    const groups = new Map();
    for (const [k, i] of R.owner) {
      if (R.zones[i].stage !== st.n) continue;
      const [x, y, z] = k.split(',').map(Number);
      const g = Math.floor((x - lo[0]) / PART) + ',' + Math.floor((z - lo[2]) / PART);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push([x, y, z, mapFull.get(k)]);
    }
    const fl = [
      `# Этап ${st.n} «${st.title}». Приходят: ${st.npc}.`,
      `# Восстанавливается: ${st.rooms}.`,
      `execute unless entity ${HEART_SEL} run tellraw @s {"rawtext":[{"text":"Сначала поставьте замок: /function castle"}]}`,
    ];
    let k = 0, n = 0;
    for (const list of groups.values()) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const c of list) for (let q = 0; q < 3; q++) { mn[q] = Math.min(mn[q], c[q]); mx[q] = Math.max(mx[q], c[q]); }
      const cells = [];
      for (const [x, y, z, blk] of list) {
        if (!blk && y <= -2) continue; // ниже земли пусто — это грунт, его не трогаем
        const at = { x: x - mn[0], y: y - mn[1], z: z - mn[2] };
        if (!blk || blk.env || blk.id === 'air') cells.push({ ...at, block: { name: 'minecraft:air', states: {} } });
        else cells.push({ ...at, block: toBedrock(blk, getFull, BLOCKS, CONTAINERS.has(blk.id) && blk.theme ? { lootTable: themeTable(blk.theme) } : {}) });
      }
      const name = `castle_s${st.n}_${k++}`;
      write(`structures/${NS}/${name}.mcstructure`, mcstructure([mx[0] - mn[0] + 1, mx[1] - mn[1] + 1, mx[2] - mn[2] + 1], cells));
      fl.push(`execute as ${HEART_SEL} at @s run structure load ${NS}:${name} ~${mn[0] - HEART[0]} ~${mn[1] - HEART[1]} ~${mn[2] - HEART[2]}`);
      n += cells.length;
    }
    fl.push(`execute if entity ${HEART_SEL} run tellraw @s {"rawtext":[{"text":"Этап ${st.n} «${st.title}»: восстановлено — ${st.rooms}. Если где-то не встало, подойдите ближе и повторите."}]}`);
    write(`functions/castle_stage_${st.n}.mcfunction`, fl.join('\n') + '\n');
    stageReport.push(`${st.n} ${st.title} — ${n} блоков, кусков ${k}`);
  }
  write('functions/castle_full.mcfunction', ['# Весь замок сразу восстановленным (для проверки)', ...castle.stagesInfo.filter((st) => st.n).map((st) => `function castle_stage_${st.n}`)].join('\n') + '\n');
  console.log('Этапы восстановления: ' + stageReport.join('; '));
  console.log(`Замок: ${tmpl.length} блоков, ${parts} кусков, размер ${hi[0] - lo[0] + 1}×${hi[2] - lo[2] + 1}, высота ${hi[1] - lo[1] + 1}`);
  const ores = Object.entries(foundCount).filter(([k]) => k.endsWith('_ore')).map(([k, n]) => `${k.replace('_ore', '')} ${n}`).join(', ');
  console.log(`Основание: ${Object.values(foundCount).reduce((a, n) => a + n, 0)} блоков грунта, руда: ${ores}`);
}

for (const [file, p] of Object.entries(pools)) {
  write(`worldgen/template_pools/${file}.json`, { format_version: '1.21.100', 'minecraft:template_pool': { description: { identifier: p.identifier }, elements: p.elements } });
}

for (const [set, cfg] of Object.entries(SETS)) {
  const members = STRUCTURES.filter((s) => s.set === set && STORIES[s.id]);
  if (!members.length) continue;
  write(`worldgen/structure_sets/${set}.json`, {
    format_version: '1.21.100',
    'minecraft:structure_set': {
      description: { identifier: `${NS}:taiga_${set}` },
      placement: { type: 'minecraft:random_spread', salt: cfg.salt, separation: cfg.separation, spacing: cfg.spacing, spread_type: 'linear' },
      structures: members.map((s) => ({ structure: `${NS}:${s.id}`, weight: s.weight || 1 })),
    },
  });
}

// Выветривание: часть камня зарастает мхом или трескается — каждая копия чуть другая.
write('worldgen/processors/weathering.json', {
  format_version: '1.21.100',
  'minecraft:processor_list': {
    description: { identifier: `${NS}:taiga_weathering` },
    processors: [{
      processor_type: 'minecraft:rule',
      rules: [
        { input_predicate: { predicate_type: 'minecraft:random_block_match', block: 'minecraft:cobblestone', probability: 0.15 }, output_state: { name: 'minecraft:mossy_cobblestone' } },
        { input_predicate: { predicate_type: 'minecraft:random_block_match', block: 'minecraft:stone_bricks', probability: 0.15 }, output_state: { name: 'minecraft:mossy_stone_bricks' } },
        { input_predicate: { predicate_type: 'minecraft:random_block_match', block: 'minecraft:stone_bricks', probability: 0.08 }, output_state: { name: 'minecraft:cracked_stone_bricks' } },
        { input_predicate: { predicate_type: 'minecraft:random_block_match', block: 'minecraft:grass_block', probability: 0.1 }, output_state: { name: 'minecraft:podzol' } },
      ],
    }],
  },
});

write('manifest.json', {
  format_version: 2,
  header: { name: PACK.name, description: PACK.description, uuid: PACK.header, version: PACK.version, min_engine_version: PACK.minEngine },
  modules: [{ type: 'data', uuid: PACK.module, version: PACK.version }],
  metadata: { authors: ['Abandoned Castle'] },
});

// ---------- Документ с историями ----------
const md = ['# Тайга: постройки и истории', '', 'Файл собирается автоматически из `design/stories`. Внимание: спойлеры.', ''];
for (const { s, stories } of docs) {
  md.push(`## ${s.name}`, '', `${s.rarity}; ${s.biomes}. ${s.desc}`, '');
  for (const { story, size } of stories) {
    md.push(`### «${story.title}»${story.state ? ` (${s.states.find((x) => x.id === story.state).label.toLowerCase()})` : ''}`, '', story.summary, '');
    if (story.chain) { md.push('**Как найти:**', ''); story.chain.forEach((c, i) => md.push(`${i + 1}. ${c}`)); md.push(''); }
    md.push(`Шаблон \`${NS}:taiga/${s.id}_${story.id}\`, ${size[0]}×${size[2]}, высота ${size[1]}.`, '');
  }
}
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/taiga-stories.md'), md.join('\n'));

// ---------- Упаковка ----------
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const addon = path.join(ROOT, 'dist/AbandonedCastle_Taiga.mcaddon');
fs.rmSync(addon, { force: true });
execFileSync('python3', ['-c', `
import os, sys, zipfile
root, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for d, _, files in os.walk(root):
        for f in sorted(files):
            p = os.path.join(d, f)
            z.write(p, os.path.relpath(p, os.path.dirname(root)))
`, OUT, addon]);

const count = (dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => !fs.statSync(path.join(dir, f)).isDirectory()).length;
console.log(`Готово: ${path.relative(ROOT, addon)} (${(fs.statSync(addon).size / 1024).toFixed(0)} КБ, файлов: ${count(OUT)})`);
console.log(`Построек: ${docs.length}, историй: ${docs.reduce((n, d) => n + d.stories.length, 0)}`);
if (warnings.length) { console.log('\nПредупреждения:'); for (const w of warnings) console.log(' - ' + w); }
