// Перевод блоков из описаний построек в блоки Bedrock 1.26: имя, состояния и
// данные блока-сущности (сундуки, кафедры, таблички, кровати).
// Состояния сверены с metadata/vanilladata_modules/mojang-blocks.json (1.26.50).
'use strict';

const { T, TYPE, states } = require('./nbt');

const BLOCK_VERSION = 18168865; // версия палитры блоков, которую пишет игра в .mcstructure

const DIR6 = { d: 0, u: 1, n: 2, s: 3, w: 4, e: 5 };
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const CARD = { n: 'north', s: 'south', e: 'east', w: 'west' };
const WEIRDO = { e: 0, w: 1, s: 2, n: 3 }; // ступени: высокая сторона
const LEGACY4 = { s: 0, w: 1, n: 2, e: 3 }; // кровати, точило, улей, горшки
const VINE_BIT = { s: 1, w: 2, n: 4, e: 8 };
const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const BED_COLOR = { red_bed: 14, brown_bed: 12 };
const BANNER_BASE = { red_banner: 1, brown_banner: 3 };

const RENAME = {
  rooted_dirt: 'dirt_with_roots',
  cobweb: 'web',
  stonecutter: 'stonecutter_block',
  item_frame: 'frame',
  large_fern: 'fern',
  cobblestone_stairs: 'stone_stairs',
};
const AXIS = new Set(['spruce_log', 'stripped_spruce_log', 'dark_oak_log', 'iron_chain']);
const SLABS = new Set(['spruce_slab', 'cobblestone_slab', 'stone_brick_slab', 'dark_oak_slab', 'mossy_cobblestone_slab']);
const STAIRS = new Set(['spruce_stairs', 'stone_brick_stairs', 'mossy_cobblestone_stairs', 'cobblestone_stairs']);
const WALLS = new Set(['cobblestone_wall', 'mossy_cobblestone_wall', 'stone_brick_wall']);
const PANES = new Set(['glass_pane', 'iron_bars']);
const CARDINAL = new Set(['furnace', 'smoker', 'anvil', 'pumpkin', 'carved_pumpkin', 'stonecutter']);
const NOT_SOLID = /leaves|glass|slab|stairs|fence|wall|pane|bars|door|trapdoor|carpet|sign|banner|ladder|frame|lantern|candle|torch|chain|bed|chest|campfire|cauldron|lectern|pot|skull|plant|fern|grass$|bush|mushroom|poppy|roots|web|sapling|potatoes|carrots|beetroot|water|cake|vine/;

function isSolid(b, BLOCKS) {
  if (!b) return false;
  const def = BLOCKS[b.id] || {};
  return !def.s && !def.t && !NOT_SOLID.test(b.id);
}

// Текст записки → предмет «Написанная книга» для кафедры или рамки.
function bookItem(book) {
  return T.compound({
    Name: T.string('minecraft:written_book'),
    Count: T.byte(1),
    Damage: T.short(0),
    WasPickedUp: T.byte(0),
    tag: T.compound({
      author: T.string(book.author || ''),
      title: T.string(book.title),
      generation: T.int(0),
      pages: T.list(TYPE.COMPOUND, book.pages.map((p) => T.compound({ photoname: T.string(''), text: T.string(p) }))),
    }),
  });
}

function signText(text) {
  return T.compound({
    Text: T.string(text || ''),
    TextOwner: T.string(''),
    SignTextColor: T.int(-16777216),
    IgnoreLighting: T.byte(0),
    HideGlowOutline: T.byte(0),
    PersistFormatting: T.byte(1),
  });
}

function be(id, fields) {
  return T.compound({ id: T.string(id), x: T.int(0), y: T.int(0), z: T.int(0), ...fields });
}

// blk — блок из Builder; get — доступ к соседям; slot — содержимое слота из истории:
// { lootTable } для контейнеров, { book } для кафедры и рамки, { sign } для табличек.
function toBedrock(blk, get, BLOCKS, slot = {}) {
  const id = blk.id;
  const f = blk.f;
  let name = RENAME[id] || id;
  let st = {};
  let entity = null;

  const connections = (kind) => {
    const out = {};
    for (const [d, [dx, dz]] of Object.entries(STEP)) {
      const nb = get(blk.x + dx, blk.y, blk.z + dz);
      const ok = nb && (isSolid(nb, BLOCKS) || kind(nb.id));
      out[d] = !!ok;
    }
    return out;
  };

  if (AXIS.has(id)) st.pillar_axis = blk.a || 'y';
  else if (id === 'hay_block' || id === 'bone_block') st = { deprecated: 0, pillar_axis: blk.a || 'y' };
  else if (SLABS.has(id)) st['minecraft:vertical_half'] = blk.h === 'top' ? 'top' : 'bottom';
  else if (STAIRS.has(id)) st = { 'minecraft:corner': 'none', upside_down_bit: blk.h === 'top', weirdo_direction: WEIRDO[f || 'n'] };
  else if (id === 'spruce_fence') {
    const c = connections((n) => n === 'spruce_fence' || n === 'spruce_fence_gate');
    for (const d of 'nsew') st['minecraft:connection_' + CARD[d]] = c[d];
  } else if (PANES.has(id)) {
    const c = connections((n) => PANES.has(n) || WALLS.has(n));
    for (const d of 'nsew') st['minecraft:connection_' + CARD[d]] = c[d];
  } else if (WALLS.has(id)) {
    const c = connections((n) => WALLS.has(n) || PANES.has(n) || n === 'spruce_fence_gate');
    for (const d of 'nsew') st['wall_connection_type_' + CARD[d]] = c[d] ? 'short' : 'none';
    st.wall_post_bit = true;
  } else if (id === 'spruce_fence_gate') st = { in_wall_bit: false, 'minecraft:cardinal_direction': CARD[f || 'n'], open_bit: !!blk.open };
  else if (id === 'spruce_trapdoor') st = { direction: WEIRDO[f || 'n'], open_bit: !!blk.open, upside_down_bit: blk.h === 'top' };
  else if (id === 'spruce_door') st = { door_hinge_bit: false, 'minecraft:cardinal_direction': CARD[f || 's'], open_bit: !!blk.open, upper_block_bit: !!blk.top };
  else if (id === 'spruce_leaves') st = { persistent_bit: true, update_bit: false };
  else if (id === 'spruce_sign') {
    if (blk.stand !== undefined) {
      name = 'spruce_standing_sign';
      st.ground_sign_direction = blk.stand;
    } else {
      name = 'spruce_wall_sign';
      st.facing_direction = DIR6[OPP[f || 'n']];
    }
    entity = be('Sign', { FrontText: signText(slot.sign || blk.text), BackText: signText(''), IsWaxed: T.byte(1) });
  } else if (id === 'red_banner' || id === 'brown_banner') {
    if (blk.stand !== undefined) {
      name = 'standing_banner';
      st.ground_sign_direction = blk.stand;
    } else {
      name = 'wall_banner';
      st.facing_direction = DIR6[OPP[f || 'n']];
    }
    entity = be('Banner', { Base: T.int(BANNER_BASE[id]), Type: T.int(0) });
  } else if (id === 'ladder') st.facing_direction = DIR6[OPP[f || 'n']];
  else if (id === 'item_frame') {
    st = { facing_direction: DIR6[OPP[f || 'n']], item_frame_map_bit: false, item_frame_photo_bit: false };
    const fields = { ItemRotation: T.float(0), ItemDropChance: T.float(1) };
    if (slot.book) fields.Item = bookItem(slot.book);
    entity = be('ItemFrame', fields);
  } else if (id === 'vine') st.vine_direction_bits = VINE_BIT[f || 'n'];
  else if (id === 'lantern') st.hanging = !!blk.hang;
  else if (id === 'candle') st = { candles: 0, lit: !!blk.lit };
  else if (id === 'campfire' || id === 'campfire_out') {
    name = 'campfire';
    st = { extinguished: id === 'campfire_out', 'minecraft:cardinal_direction': 'south' };
  } else if (id === 'chest' || id === 'barrel') {
    if (id === 'chest') st['minecraft:cardinal_direction'] = CARD[f || 's'];
    else st = { facing_direction: f ? DIR6[f] : DIR6.u, open_bit: false };
    const fields = { Findable: T.byte(0), Items: T.list(TYPE.COMPOUND, []) };
    if (slot.lootTable) {
      fields.LootTable = T.string(slot.lootTable);
      fields.LootTableSeed = T.int(0);
    }
    entity = be(id === 'chest' ? 'Chest' : 'Barrel', fields);
  } else if (CARDINAL.has(id)) st['minecraft:cardinal_direction'] = CARD[f || 's'];
  else if (id === 'lectern') {
    st = { 'minecraft:cardinal_direction': CARD[f || 's'], powered_bit: false };
    const fields = {};
    if (slot.book) Object.assign(fields, { book: bookItem(slot.book), hasBook: T.byte(1), page: T.int(0), totalPages: T.int(slot.book.pages.length) });
    entity = be('Lectern', fields);
  } else if (id === 'grindstone') st = { attachment: 'standing', direction: LEGACY4[f || 's'] };
  else if (id === 'loom') st.direction = LEGACY4[f || 's'];
  else if (id === 'beehive') st = { direction: LEGACY4[f || 's'], honey_level: 0 };
  else if (id === 'decorated_pot') {
    st.direction = LEGACY4[f || 's'];
    const fields = { sherds: T.list(TYPE.STRING, []) };
    if (slot.lootTable) {
      fields.LootTable = T.string(slot.lootTable);
      fields.LootTableSeed = T.int(0);
    }
    entity = be('DecoratedPot', fields);
  } else if (id === 'cauldron') st = { cauldron_liquid: 'water', fill_level: blk.water ? 6 : 0 };
  else if (id === 'composter') st.composter_fill_level = 0;
  else if (id === 'red_bed' || id === 'brown_bed') {
    name = 'bed';
    st = { direction: LEGACY4[f || 's'], head_piece_bit: !!blk.head, occupied_bit: false };
    entity = be('Bed', { color: T.byte(BED_COLOR[id]) });
  } else if (id === 'flower_pot') {
    st.update_bit = false;
    if (blk.plant) entity = be('FlowerPot', { PlantBlock: T.compound({ name: T.string('minecraft:' + blk.plant), states: T.compound({}), version: T.int(BLOCK_VERSION) }) });
  } else if (id === 'skeleton_skull') {
    st.facing_direction = 1;
    entity = be('Skull', { SkullType: T.byte(0), Rotation: T.float(0) });
  } else if (id === 'suspicious_gravel') {
    st = { brushed_progress: 0, hanging: false };
    const fields = { type: T.string('minecraft:suspicious_gravel'), brush_count: T.int(0), brush_direction: T.byte(6) };
    if (slot.lootTable) {
      fields.LootTable = T.string(slot.lootTable);
      fields.LootTableSeed = T.int(0);
    }
    entity = be('BrushableBlock', fields);
  } else if (id === 'chiseled_bookshelf') {
    const books = blk.books || 0;
    st = { books_stored: books, direction: LEGACY4[f || 's'] };
    const items = [];
    for (let i = 0; i < 6; i++) {
      items.push(books & (1 << i)
        ? T.compound({ Name: T.string('minecraft:book'), Count: T.byte(1), Damage: T.short(0), WasPickedUp: T.byte(0) })
        : T.compound({ Name: T.string(''), Count: T.byte(0), Damage: T.short(0), WasPickedUp: T.byte(0) }));
    }
    entity = be('ChiseledBookshelf', { Items: T.list(TYPE.COMPOUND, items), LastInteractedSlot: T.int(0) });
  } else if (id === 'water') st.liquid_depth = 0;
  else if (id === 'farmland') st.moisturized_amount = 7;
  else if (id === 'potatoes' || id === 'carrots' || id === 'beetroot') st.growth = 7;
  else if (id === 'sweet_berry_bush') st.growth = 3;
  else if (id === 'spruce_sapling') st.age_bit = false;
  else if (id === 'cake') st.bite_counter = 0;
  else if (id === 'large_fern') st = {};

  return { name: 'minecraft:' + name, states: st, entity };
}

function jigsaw(f, data) {
  return {
    name: 'minecraft:jigsaw',
    states: { facing_direction: DIR6[f], rotation: 0 },
    entity: be('JigsawBlock', {
      name: T.string(data.name),
      target: T.string(data.target),
      target_pool: T.string(data.pool),
      final_state: T.string(data.final),
      joint: T.string('rollable'),
    }),
  };
}

function paletteEntry(b) {
  return T.compound({ name: T.string(b.name), states: states(b.states), version: T.int(BLOCK_VERSION) });
}

module.exports = { toBedrock, jigsaw, paletteEntry, DIR6, BLOCK_VERSION };
