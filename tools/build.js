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
  description: 'Постройки хвойного биома: хижины, лагеря, ориентиры, хутора, острог и скит. С тайниками и историями.',
  header: '6f3d2a8e-4c1b-4f7a-9e2d-5b8c1a7f3e90',
  module: 'a2c94e17-8b3f-4d6a-b1e5-0f7d9c3a2b48',
  version: [0, 2, 1],
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
      entities: T.list(TYPE.COMPOUND, []),
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
const NEEDS_FLOOR = /fern|grass$|bush|mushroom|poppy|sapling|candle|carpet|flower_pot|cake|potatoes|carrots|beetroot|deadbush|suspicious_gravel|spruce_door|campfire|lantern|stand/;
const ATTACHED = new Set(['ladder', 'item_frame', 'vine', 'spruce_sign', 'brown_banner', 'red_banner', 'painting']);
const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function checkSupport(sid, blocks, get) {
  for (const v of blocks) {
    const at = `${sid} (${v.x},${v.y},${v.z}) ${v.id}`;
    if (v.y === -1) continue;
    const below = get(v.x, v.y - 1, v.z);
    if (v.id === 'lantern' && v.hang) { if (!get(v.x, v.y + 1, v.z)) warn(`${at}: висит в воздухе`); continue; }
    if (ATTACHED.has(v.id) && v.stand === undefined) {
      const [dx, dz] = STEP[v.f || 'n'];
      if (!get(v.x + dx, v.y, v.z + dz)) warn(`${at}: не к чему крепиться`);
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
    elements.push({ element: { element_type: 'minecraft:single_pool_element', location: `${NS}/taiga/${s.id}_${story.id}`, processors: `${NS}:taiga_weathering`, projection: 'minecraft:rigid' }, weight: story.weight || 1 });
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
      max_distance_from_center: { horizontal: 64, vertical: 64 },
      liquid_settings: 'ignore_waterlogging',
    },
  });
  docs.push(docEntry);
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
