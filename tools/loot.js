// Таблицы лута: тематические наборы для обычных контейнеров и сборка таблиц
// для сюжетных слотов (записки + гарантированные предметы + случайный добор).
'use strict';

// [предмет, вес, количество]. Количество — число или [мин, макс].
const THEMES = {
  forester: [['bread', 4, [1, 3]], ['cooked_mutton', 3, [1, 2]], ['arrow', 3, [3, 8]], ['stick', 3, [2, 6]], ['spruce_sapling', 2, [1, 3]], ['torch', 3, [2, 5]], ['coal', 2, [1, 4]], ['string', 2, [1, 3]], ['leather', 2, [1, 2]], ['iron_axe', 1, 1, { damage: [0.3, 0.7] }]],
  kitchen: [['bread', 5, [1, 3]], ['baked_potato', 4, [2, 4]], ['cooked_rabbit', 2, [1, 2]], ['cooked_salmon', 2, [1, 2]], ['sweet_berries', 4, [3, 8]], ['bowl', 2, [1, 2]], ['mushroom_stew', 1, 1], ['honey_bottle', 1, 1], ['egg', 2, [1, 3]], ['pumpkin_pie', 1, 1]],
  pantry: [['potato', 5, [2, 6]], ['carrot', 4, [2, 5]], ['beetroot', 3, [2, 5]], ['beetroot_seeds', 2, [2, 5]], ['wheat_seeds', 2, [2, 6]], ['pumpkin_seeds', 1, [1, 3]], ['sweet_berries', 3, [3, 8]], ['dried_kelp', 1, [2, 4]]],
  coop: [['egg', 6, [2, 6]], ['feather', 4, [2, 5]], ['wheat_seeds', 3, [2, 6]], ['cooked_chicken', 1, 1]],
  hunter: [['leather', 5, [1, 4]], ['rabbit_hide', 4, [1, 3]], ['arrow', 4, [4, 12]], ['cooked_rabbit', 3, [1, 3]], ['cooked_mutton', 2, [1, 2]], ['string', 3, [2, 4]], ['bone', 2, [1, 3]], ['flint', 2, [1, 3]], ['rabbit_foot', 1, 1], ['bow', 1, 1, { damage: [0.3, 0.8] }]],
  smoked: [['cooked_porkchop', 3, [1, 3]], ['cooked_beef', 3, [1, 3]], ['cooked_salmon', 3, [1, 3]], ['cooked_mutton', 3, [1, 3]], ['cooked_rabbit', 2, [1, 2]]],
  junk: [['stick', 4, [1, 4]], ['string', 3, [1, 3]], ['bone', 3, [1, 2]], ['paper', 2, [1, 3]], ['leather', 2, 1], ['iron_nugget', 2, [1, 4]], ['coal', 2, [1, 2]], ['bowl', 1, 1], ['glass_bottle', 1, 1]],
  barn: [['wheat', 4, [2, 6]], ['potato', 3, [2, 5]], ['lead', 2, 1], ['shears', 1, 1], ['bucket', 1, 1], ['saddle', 1, 1], ['leather', 2, [1, 2]], ['stick', 2, [2, 5]]],
  soldier: [['arrow', 5, [4, 12]], ['bread', 4, [1, 3]], ['cooked_beef', 3, [1, 2]], ['iron_nugget', 3, [2, 6]], ['torch', 3, [2, 6]], ['leather_helmet', 1, 1, { damage: [0.4, 0.9] }], ['iron_sword', 1, 1, { damage: [0.3, 0.7] }], ['string', 2, [1, 3]]],
  armory: [['arrow', 5, [8, 16]], ['iron_ingot', 3, [1, 3]], ['iron_helmet', 1, 1, { damage: [0.4, 0.9] }], ['iron_chestplate', 1, 1, { damage: [0.4, 0.9] }], ['crossbow', 1, 1, { damage: [0.5, 0.9] }], ['shield', 1, 1], ['bow', 2, 1, { damage: [0.5, 1] }], ['iron_sword', 1, 1, { damage: [0.6, 1] }]],
  sawmill: [['spruce_log', 4, [2, 6]], ['spruce_planks', 4, [4, 12]], ['stick', 3, [3, 8]], ['iron_nugget', 2, [2, 5]], ['coal', 2, [1, 4]], ['paper', 2, [1, 3]], ['iron_axe', 1, 1, { damage: [0.2, 0.6] }], ['emerald', 1, 1]],
  charcoal: [['charcoal', 6, [3, 10]], ['coal', 3, [2, 6]], ['flint_and_steel', 1, 1], ['torch', 3, [3, 8]], ['bread', 2, [1, 2]], ['stick', 2, [2, 5]]],
  cartographer: [['paper', 5, [2, 6]], ['empty_map', 2, 1], ['compass', 1, 1], ['book', 3, [1, 2]], ['ink_sac', 2, [1, 3]], ['feather', 2, [1, 3]], ['glass_bottle', 1, 1], ['candle', 2, [1, 2]]],
  // Замок
  crypt: [['bone', 5, [1, 4]], ['candle', 3, [1, 2]], ['gold_nugget', 3, [2, 7]], ['rotten_flesh', 2, [1, 2]], ['string', 2, [1, 3]], ['iron_nugget', 2, [1, 4]], ['book', 1, 1], ['golden_sword', 1, 1, { damage: [0.2, 0.6] }]],
  treasure: [['gold_ingot', 5, [1, 4]], ['gold_nugget', 4, [3, 9]], ['emerald', 3, [1, 3]], ['iron_ingot', 3, [2, 5]], ['diamond', 1, 1], ['golden_apple', 1, 1], ['clock', 1, 1], ['golden_helmet', 1, 1]],
  hermit: [['candle', 4, [1, 3]], ['honey_bottle', 3, 1], ['honeycomb', 2, [1, 3]], ['brown_mushroom', 3, [1, 3]], ['red_mushroom', 2, [1, 2]], ['sweet_berries', 3, [2, 6]], ['book', 1, 1], ['glistering_melon_slice', 1, 1]],
};

const count = (c) => (Array.isArray(c) ? { min: c[0], max: c[1] } : c);

function itemEntry(name, weight, cnt = 1, opt = {}) {
  const functions = [];
  if (cnt !== 1) functions.push({ function: 'set_count', count: count(cnt) });
  if (opt.damage) functions.push({ function: 'set_damage', damage: count(opt.damage) });
  if (opt.ench) functions.push({ function: 'enchant_randomly' });
  if (opt.levels) functions.push({ function: 'enchant_with_levels', levels: count(opt.levels), treasure: false });
  if (opt.data !== undefined) functions.push({ function: 'set_data', data: opt.data });
  if (opt.name) functions.push({ function: 'set_name', name: opt.name });
  if (opt.lore) functions.push({ function: 'set_lore', lore: opt.lore });
  const e = { type: 'item', name: 'minecraft:' + name, weight };
  if (functions.length) e.functions = functions;
  return e;
}

function bookEntry(book) {
  return {
    type: 'item',
    name: 'minecraft:written_book',
    weight: 1,
    functions: [{ function: 'set_book_contents', author: book.author || '', title: book.title, pages: book.pages }],
  };
}

// spec: { books: [...], items: [[name, count, opt]], theme, rolls }
function table(spec) {
  const pools = [];
  for (const b of spec.books || []) pools.push({ rolls: 1, entries: [bookEntry(b)] });
  for (const [name, cnt, opt] of spec.items || []) pools.push({ rolls: 1, entries: [itemEntry(name, 1, cnt, opt)] });
  if (spec.theme) {
    const theme = THEMES[spec.theme];
    if (!theme) throw new Error('Нет темы лута ' + spec.theme);
    pools.push({ rolls: count(spec.rolls || [2, 4]), entries: theme.map(([n, w, c, o]) => itemEntry(n, w, c, o)) });
  }
  return { pools };
}

module.exports = { THEMES, table };
