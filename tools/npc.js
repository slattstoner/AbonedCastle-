// Жители в аддоне. Три вида существ, все — модель игрока со скином из tools/skins.js
// (скин выбирается номером варианта, событие acastle:as_<id>):
//  acastle:guard  — стражник: стоит на посту, бьёт монстров и враждебных разбойников рядом
//                   (кроме крипера и эндермена), игрока не трогает и урона от него не получает,
//                   сам лечится. Лучник Савва (as_savva) стреляет из лука и не сходит с башни;
//  acastle:npc    — мирный житель: живёт у своего дома, не дерётся, не погибает;
//  acastle:bandit — человек шайки Рыжего и Ножов. Состояния: мирный (по умолчанию),
//                   враждебный (acastle:hostile — нападает на игрока и стражу, стража бьёт его),
//                   бегущий (acastle:flee — убегает от игрока), пленный (acastle:captive — можно
//                   вести на поводке). Рыжий не погибает: когда ранен до половины, урон больше
//                   не проходит и срабатывает событие acastle:yield. Ножов от удара игрока
//                   не получает урона, а сдаётся (событие acastle:caught).
// У всех кнопка «Говорить»: разговоры и задания ведут скрипты (tools/scripts).
'use strict';

const NS = 'acastle';
const { NPC, png } = require('./skins');

// Стражники с постами. Номер варианта — место скина в общем списке NPC.
const GUARDS = [
  { id: 'ostap', name: 'Стражник Остап' },
  { id: 'mitka', name: 'Стражник Митька' },
  { id: 'zhdan', name: 'Стражник Ждан' },
  { id: 'gavrila', name: 'Стражник Гаврила' },
  { id: 'luka', name: 'Стражник Лука' },
  { id: 'savva', name: 'Лучник Савва' },
];
// Посты в координатах замка (как в castle.js): x — восток, z — юг; f — поворот (0 — лицом на юг, наружу).
// Этап 0: Остап и Митька в проезде ворот по обе стороны, у внешнего края арки.
// Этап 1: трое стражников гарнизона у ворот со стороны двора и на площади.
// Лучник Савва — на верху левой надвратной башни, стреляет по нежити перед воротами.
const POSTS = [
  { stage: 0, guard: 'ostap', at: [61, 0, 128], f: 0 },
  { stage: 0, guard: 'mitka', at: [65, 0, 128], f: 0 },
  { stage: 1, guard: 'zhdan', at: [59, 0, 121], f: 0 },
  { stage: 1, guard: 'gavrila', at: [67, 0, 121], f: 0 },
  { stage: 1, guard: 'luka', at: [63, 0, 114], f: 0 },
  { stage: 1, guard: 'savva', at: [55, 16, 127], f: 0, archer: true },
];
// Дома мирных жителей замка: помещение (метка room в castle.js). near — точка, к которой
// жителя поставить ближе (иначе — к метке помещения).
const HOMES = {
  vsevolod: 'Опочивальня хозяина', agafya: 'Кухня', frol: 'Конюшня', demyan: 'Комната капитана',
  gordey: 'Кузница', vaska: 'Кузница', ignat: 'Дом управителя', dunya: 'Комната служанок',
  varlaam: 'Часовня', evsey: 'Скрипторий', lenz: 'Комната звездочёта', semka: 'Голубятня',
  marfa: 'Лекарская', prokhor: 'Караульня', timosha: 'Музыкантская', nozhov: 'Темница',
  trader: 'Колодец', ryzhy: { room: 'Большой зал', near: [63, 6, 25] },
};
const GUARD_SEL = `@e[type=${NS}:guard]`;
// Скины шайки: из них же набираются безымянные «люди Рыжего» в набегах и осаде
const GANG = ['sych', 'voron', 'grinya', 'kunitsa', 'pakhom', 'shilo', 'ryzhy'];
// Оружие людей Рыжего по роли (кроме каменного топора по умолчанию)
const BANDIT_GEAR = { ryzhy: 'sword', voron: 'bow', kunitsa: 'light', sych: 'light', pakhom: 'none', shilo: 'none', nozhov: 'none' };

const SKIN_IDS = NPC.map((n) => n.id);
const variantOf = (id) => { const i = SKIN_IDS.indexOf(id); if (i < 0) throw new Error('нет скина ' + id); return i; };

const monster = { test: 'is_family', subject: 'other', value: 'monster' };
// Кнопка «Говорить» (на iPhone нажатие на существо — удар, поэтому нужна кнопка)
const TALK = {
  'minecraft:interact': {
    interactions: [{
      cooldown: 0.5, swing: false, interact_text: `action.interact.${NS}_talk`,
      on_interact: { filters: { test: 'is_family', subject: 'other', value: 'player' }, event: `${NS}:talked`, target: 'self' },
    }],
  },
};

function skinGroups(ids, groups, events) {
  for (const id of ids) {
    groups[`${NS}:skin_${id}`] = { 'minecraft:variant': { value: variantOf(id) } };
    events[`${NS}:as_${id}`] = { remove: { component_groups: ids.filter((o) => o !== id).map((o) => `${NS}:skin_${o}`) }, add: { component_groups: [`${NS}:skin_${id}`] } };
  }
}
const common = (family) => ({
  'minecraft:type_family': { family: [...family, `${NS}_person`] },
  'minecraft:variant': { value: 0 },
  'minecraft:collision_box': { width: 0.6, height: 1.9 },
  'minecraft:movement.basic': {},
  'minecraft:jump.static': {},
  'minecraft:can_climb': {},
  'minecraft:physics': {},
  'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: true },
  'minecraft:persistent': {},
  'minecraft:nameable': { always_show: false, allow_name_tag_renaming: false },
  'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
  'minecraft:conditional_bandwidth_optimization': {},
  'minecraft:behavior.float': { priority: 0 },
  'minecraft:behavior.look_at_player': { priority: 8, look_distance: 8, probability: 0.6 },
  'minecraft:behavior.random_look_around': { priority: 9 },
  ...TALK,
});

// Лучник: лук вместо меча, стреляет издали и стоит на месте
const ARCHER = {
  'minecraft:shooter': { def: 'minecraft:arrow' },
  'minecraft:behavior.ranged_attack': { priority: 1, attack_interval_min: 1.5, attack_interval_max: 3, attack_radius: 18 },
  'minecraft:equipment': { table: `loot_tables/${NS}/npc/archer_gear.json`, slot_drop_chance: [{ slot: 'slot.weapon.mainhand', drop_chance: 0 }] },
  'minecraft:home': { restriction_type: 'all_movement', restriction_radius: 2 },
  'minecraft:behavior.nearest_attackable_target': {
    priority: 3, must_see: true, reselect_targets: true, within_radius: 24, must_see_forget_duration: 5,
    entity_types: [{ filters: { all_of: [monster, { test: 'is_family', subject: 'other', operator: '!=', value: 'creeper' }, { test: 'is_family', subject: 'other', operator: '!=', value: 'enderman' }] }, max_dist: 24 }],
  },
};
function guardEntity() {
  const groups = { [`${NS}:despawn`]: { 'minecraft:instant_despawn': {} }, [`${NS}:talked`]: {}, [`${NS}:archer`]: ARCHER };
  const events = {
    // Из яйца призыва — один из стражников гарнизона
    'minecraft:entity_spawned': { randomize: GUARDS.slice(2, 5).map((g) => ({ weight: 1, add: { component_groups: [`${NS}:skin_${g.id}`] } })) },
    [`${NS}:despawn`]: { add: { component_groups: [`${NS}:despawn`] } },
    [`${NS}:talked`]: { add: { component_groups: [`${NS}:talked`] } },
  };
  skinGroups(GUARDS.map((g) => g.id), groups, events);
  events[`${NS}:as_savva`].add.component_groups.push(`${NS}:archer`);
  return {
    format_version: '1.21.0',
    'minecraft:entity': {
      description: { identifier: `${NS}:guard`, is_spawnable: true, is_summonable: true, is_experimental: false },
      component_groups: groups,
      components: {
        // irongolem — чтобы зомби и скелеты сами шли драться со стражей, как с железным големом
        ...common([`${NS}_guard`, `${NS}_npc`, 'irongolem', 'mob']),
        'minecraft:health': { value: 40, max: 40 },
        'minecraft:attack': { damage: 6 },
        'minecraft:movement': { value: 0.3 },
        'minecraft:navigation.walk': { can_walk: true, avoid_water: true, avoid_damage_blocks: true, can_pass_doors: true, can_open_doors: false },
        'minecraft:knockback_resistance': { value: 0.4 },
        'minecraft:follow_range': { value: 24, max: 24 },
        // Пост: место появления. Дальше 12 блоков сам не уходит, после боя возвращается.
        'minecraft:home': { restriction_type: 'random_movement', restriction_radius: 12 },
        'minecraft:equipment': {
          table: `loot_tables/${NS}/npc/guard_gear.json`,
          slot_drop_chance: [{ slot: 'slot.weapon.mainhand', drop_chance: 0 }],
        },
        // Медленное лечение: стражник не погибает от череды мелких стычек
        'minecraft:spell_effects': { add_effects: [{ effect: 'regeneration', duration: 1000000, amplifier: 0, visible: false }] },
        'minecraft:damage_sensor': {
          triggers: [
            { cause: 'fall', deals_damage: 'no' },
            { cause: 'suffocation', deals_damage: 'no' },
            { on_damage: { filters: { test: 'is_family', subject: 'other', value: 'player' } }, deals_damage: 'no' },
            { on_damage: { filters: { test: 'is_family', subject: 'other', value: `${NS}_npc` } }, deals_damage: 'no' },
          ],
        },
        'minecraft:behavior.hurt_by_target': { priority: 1, entity_types: { filters: monster } },
        'minecraft:behavior.melee_box_attack': { priority: 2, track_target: true, speed_multiplier: 1.2 },
        // must_reach — как у железного голема: не гонится за тем, до кого не дойти (скелет на стене)
        'minecraft:behavior.nearest_attackable_target': {
          priority: 3, must_see: true, must_reach: true, reselect_targets: true, within_radius: 20, must_see_forget_duration: 5,
          entity_types: [{
            filters: { all_of: [monster,
              { test: 'is_family', subject: 'other', operator: '!=', value: 'creeper' },
              { test: 'is_family', subject: 'other', operator: '!=', value: 'enderman' }] },
            max_dist: 20,
          }],
        },
        'minecraft:behavior.move_towards_home_restriction': { priority: 4 },
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.6, xz_dist: 2, y_dist: 1, interval: 400 },
      },
      events,
    },
  };
}

// Мирный житель: ходит у своего дома, не дерётся и не получает урона
function npcEntity() {
  const groups = { [`${NS}:despawn`]: { 'minecraft:instant_despawn': {} }, [`${NS}:talked`]: {} };
  const events = { [`${NS}:despawn`]: { add: { component_groups: [`${NS}:despawn`] } }, [`${NS}:talked`]: { add: { component_groups: [`${NS}:talked`] } } };
  skinGroups(SKIN_IDS, groups, events);
  return {
    format_version: '1.21.0',
    'minecraft:entity': {
      description: { identifier: `${NS}:npc`, is_spawnable: false, is_summonable: true, is_experimental: false },
      component_groups: groups,
      components: {
        ...common([`${NS}_npc`, 'mob']),
        'minecraft:health': { value: 20, max: 20 },
        'minecraft:movement': { value: 0.22 },
        'minecraft:navigation.walk': { can_walk: true, avoid_water: true, avoid_damage_blocks: true, can_pass_doors: true, can_open_doors: false },
        'minecraft:home': { restriction_type: 'random_movement', restriction_radius: 4 },
        'minecraft:damage_sensor': { triggers: [{ cause: 'all', deals_damage: 'no' }] },
        'minecraft:behavior.move_towards_home_restriction': { priority: 4 },
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.5, xz_dist: 2, y_dist: 1, interval: 300 },
      },
      events,
    },
  };
}

// Шайка Рыжего и Ножов: мирные в лагере, враждебные в набегах и осаде
const bandit = (o) => ({ test: 'is_family', subject: 'other', value: o });
// Касание пригнувшегося игрока — это разговор, а не удар: урона нет
const BANDIT_SENSOR = [
  { on_damage: { filters: { all_of: [bandit('player'), { test: 'is_sneak_held', subject: 'other', value: true }] } }, deals_damage: 'no' },
  { cause: 'fall', deals_damage: 'no' },
  { cause: 'suffocation', deals_damage: 'no' },
  { on_damage: { filters: bandit(`${NS}_bandit`) }, deals_damage: 'no' },
];
function banditEntity() {
  const g = (name) => `${NS}:${name}`;
  const groups = {
    [g('despawn')]: { 'minecraft:instant_despawn': {} },
    [g('talked')]: {},
    [g('hostile')]: {
      'minecraft:type_family': { family: [`${NS}_bandit`, `${NS}_hostile`, `${NS}_person`, 'monster', 'mob'] },
      'minecraft:behavior.hurt_by_target': { priority: 1 },
      'minecraft:behavior.nearest_attackable_target': {
        priority: 2, must_see: true, reselect_targets: true, within_radius: 20,
        entity_types: [{ filters: { any_of: [bandit('player'), bandit(`${NS}_guard`)] }, max_dist: 20 }],
      },
      'minecraft:home': { restriction_type: 'none' },
    },
    [g('flee')]: {
      'minecraft:behavior.avoid_mob_type': { priority: 1, entity_types: [{ filters: bandit('player'), max_dist: 24, walk_speed_multiplier: 1.1, sprint_speed_multiplier: 1.4 }] },
      'minecraft:home': { restriction_type: 'none' },
    },
    [g('captive')]: {
      'minecraft:leashable': {},
      'minecraft:movement': { value: 0.25 },
      'minecraft:home': { restriction_type: 'none' },
    },
    // Рыжий: ранен до половины — урон не проходит, бой стихает (скрипт ловит acastle:yield)
    [g('unbeaten')]: { 'minecraft:damage_sensor': { triggers: [...BANDIT_SENSOR,
      { on_damage: { filters: { test: 'actor_health', subject: 'self', operator: '<=', value: 30 }, event: g('yield') }, deals_damage: 'no' }] } },
    // Ножов: от удара игрока не ранен, а сдаётся (скрипт ловит acastle:caught)
    [g('coward')]: { 'minecraft:damage_sensor': { triggers: [...BANDIT_SENSOR,
      { on_damage: { filters: bandit('player'), event: g('caught') }, deals_damage: 'no' }] } },
  };
  const states = ['hostile', 'flee', 'captive'].map(g);
  const to = (state) => ({ remove: { component_groups: states.filter((x) => x !== state) }, ...(state ? { add: { component_groups: [state] } } : {}) });
  const events = {
    [g('despawn')]: { add: { component_groups: [g('despawn')] } },
    [g('talked')]: { add: { component_groups: [g('talked')] } },
    [g('hostile')]: to(g('hostile')), [g('flee')]: to(g('flee')), [g('captive')]: to(g('captive')), [g('peaceful')]: to(null),
    [g('yield')]: to(null), [g('caught')]: {},
  };
  skinGroups(SKIN_IDS, groups, events);
  events[g('as_ryzhy')].add.component_groups.push(g('unbeaten'));
  events[g('as_nozhov')].add.component_groups.push(g('coward'));
  // Оружие по роли (по умолчанию — каменный топор): атаман с мечом, Ворон с луком и стреляет,
  // если лагерь враждебен; у кашевара, мальчишки, «торговки» и Ножова оружия нет
  const gear = (table) => ({ 'minecraft:equipment': { table: `loot_tables/${NS}/npc/${table}.json`, slot_drop_chance: [{ slot: 'slot.weapon.mainhand', drop_chance: 0 }] } });
  groups[g('gear_sword')] = gear('bandit_sword');
  groups[g('gear_light')] = gear('bandit_light');
  groups[g('gear_none')] = gear('empty');
  groups[g('gear_bow')] = { ...gear('archer_gear'), 'minecraft:shooter': { def: 'minecraft:arrow' },
    'minecraft:behavior.ranged_attack': { priority: 2, attack_interval_min: 1.5, attack_interval_max: 3, attack_radius: 16 } };
  for (const [id, kind] of Object.entries(BANDIT_GEAR)) events[g('as_' + id)].add.component_groups.push(g('gear_' + kind));
  // Куница под видом торговки на площади: тот же облик, но без оружия
  events[g('as_trader')] = { remove: events[g('as_kunitsa')].remove, add: { component_groups: [g('skin_kunitsa'), g('gear_none')] } };
  return {
    format_version: '1.21.0',
    'minecraft:entity': {
      description: { identifier: `${NS}:bandit`, is_spawnable: false, is_summonable: true, is_experimental: false },
      component_groups: groups,
      components: {
        ...common([`${NS}_bandit`, 'mob']),
        'minecraft:health': { value: 60, max: 60 },
        'minecraft:attack': { damage: 4 },
        'minecraft:movement': { value: 0.3 },
        'minecraft:navigation.walk': { can_walk: true, avoid_water: true, avoid_damage_blocks: true, can_pass_doors: true, can_open_doors: false },
        'minecraft:follow_range': { value: 20, max: 20 },
        'minecraft:home': { restriction_type: 'random_movement', restriction_radius: 8 },
        'minecraft:equipment': { table: `loot_tables/${NS}/npc/bandit_gear.json`, slot_drop_chance: [{ slot: 'slot.weapon.mainhand', drop_chance: 0 }] },
        'minecraft:damage_sensor': { triggers: BANDIT_SENSOR },
        'minecraft:behavior.melee_box_attack': { priority: 3, track_target: true, speed_multiplier: 1.15 },
        'minecraft:behavior.move_towards_home_restriction': { priority: 4 },
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.5, xz_dist: 3, y_dist: 1, interval: 300 },
      },
      events,
    },
  };
}

function client(id, egg) {
  const textures = Object.fromEntries(SKIN_IDS.map((s) => [s, `textures/entity/${NS}/${s}`]));
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${id}`,
        materials: { default: 'entity_alphatest' },
        textures,
        geometry: { default: 'geometry.humanoid.custom' },
        render_controllers: [`controller.render.${NS}.person`],
        ...(egg ? { spawn_egg: egg } : {}),
        enable_attachables: true,
        scripts: {
          initialize: ['v.gliding_speed_value = 1.0;'],
          pre_animation: ['v.tcos0 = Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / v.gliding_speed_value * 57.3;'],
          animate: ['look_at_target_controller', 'move_controller', 'holding_controller', 'attack_controller', 'bob_controller'],
        },
        // Стандартные анимации человека (как у зомби и игрока)
        animations: {
          look_at_target_default: 'animation.humanoid.look_at_target.default',
          look_at_target_gliding: 'animation.humanoid.look_at_target.gliding',
          look_at_target_swimming: 'animation.humanoid.look_at_target.swimming',
          move: 'animation.humanoid.move',
          holding: 'animation.humanoid.holding',
          'attack.rotations': 'animation.humanoid.attack.rotations',
          bob: 'animation.humanoid.bob',
          look_at_target_controller: 'controller.animation.humanoid.look_at_target',
          move_controller: 'controller.animation.humanoid.move',
          holding_controller: 'controller.animation.humanoid.holding',
          attack_controller: 'controller.animation.humanoid.attack',
          bob_controller: 'controller.animation.humanoid.bob',
        },
      },
    },
  };
}

// Значок книги заданий 16×16: кожаный переплёт, золотая башня замка
function bookIcon() {
  const P = { '.': null, k: [74, 42, 26], K: [52, 28, 16], l: [104, 62, 36], g: [216, 176, 64], G: [168, 128, 40], p: [236, 226, 200], r: [160, 40, 34] };
  const rows = [
    '................',
    '..KKKKKKKKKKKK..',
    '..KlllllllllkK..',
    '..KlkkkkkkkkkKp.',
    '..KlkkggggkkkKp.',
    '..KlkkgGGgkkkKp.',
    '..KlkkkggkkkkKp.',
    '..KlkkkggkkkkKp.',
    '..KlkkggggkkkKp.',
    '..KlkkkkkkkkkKp.',
    '..KlkkkkkkkkkKp.',
    '..KlkkkkkkkkkKp.',
    '..KlrrkkkkkkkKp.',
    '..KlrrkkkkkkkK..',
    '..KKKKKKKKKKKK..',
    '................',
  ];
  const buf = Buffer.alloc(16 * 16 * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = P[ch]; if (c) buf.set([...c, 255], (y * 16 + x) * 4); }));
  return png(16, 16, buf);
}

// writeBP / writeRP(rel, data); skinPng(id) → Buffer; checkTable(t, where) — сверка предметов
function writePacks(writeBP, writeRP, skinPng, checkTable) {
  writeBP('entities/guard.json', guardEntity());
  writeBP('entities/npc.json', npcEntity());
  writeBP('entities/bandit.json', banditEntity());
  for (const [name, item, what] of [['guard_gear', 'iron_sword', 'стражника'], ['archer_gear', 'bow', 'лучника'], ['bandit_gear', 'stone_axe', 'разбойника'],
    ['bandit_sword', 'iron_sword', 'атамана'], ['bandit_light', 'stone_sword', 'разведчика'], ['empty', null, 'мирного']]) {
    const gear = { pools: item ? [{ rolls: 1, entries: [{ type: 'item', name: 'minecraft:' + item, weight: 1 }] }] : [] };
    checkTable(gear, 'снаряжение ' + what);
    writeBP(`loot_tables/${NS}/npc/${name}.json`, gear);
  }
  writeBP('items/quest_book.json', {
    format_version: '1.21.40',
    'minecraft:item': {
      description: { identifier: `${NS}:quest_book`, menu_category: { category: 'items' } },
      components: {
        'minecraft:icon': `${NS}_quest_book`,
        'minecraft:display_name': { value: 'Книга заданий' },
        'minecraft:max_stack_size': 1,
      },
    },
  });
  for (const s of SKIN_IDS) writeRP(`textures/entity/${NS}/${s}.png`, skinPng(s));
  writeRP(`textures/items/${NS}/quest_book.png`, bookIcon());
  writeRP('textures/item_texture.json', { resource_pack_name: NS, texture_name: 'atlas.items', texture_data: { [`${NS}_quest_book`]: { textures: `textures/items/${NS}/quest_book` } } });
  writeRP(`entity/guard.entity.json`, client('guard', { base_color: '#8a1e1e', overlay_color: '#d8b040' }));
  writeRP(`entity/npc.entity.json`, client('npc'));
  writeRP(`entity/bandit.entity.json`, client('bandit'));
  writeRP(`render_controllers/${NS}.render_controllers.json`, {
    format_version: '1.8.0',
    render_controllers: {
      [`controller.render.${NS}.person`]: {
        arrays: { textures: { 'Array.skins': SKIN_IDS.map((s) => `Texture.${s}`) } },
        geometry: 'Geometry.default',
        materials: [{ '*': 'Material.default' }],
        textures: ['Array.skins[query.variant]'],
      },
    },
  });
  const lang = [
    `entity.${NS}:guard.name=Стражник замка`,
    `entity.${NS}:npc.name=Житель замка`,
    `entity.${NS}:bandit.name=Человек Рыжего`,
    `item.spawn_egg.entity.${NS}:guard.name=Призвать стражника замка`,
    `item.${NS}:quest_book=Книга заданий`,
    `action.interact.${NS}_talk=Говорить`,
  ].join('\n') + '\n';
  writeRP('texts/ru_RU.lang', lang);
  writeRP('texts/en_US.lang', lang);
  writeRP('texts/languages.json', ['ru_RU', 'en_US']);
}

// Команды призыва стражи этапа. pos(x, y, z) → строка «~dx ~dy ~dz» от точки, где выполняется функция.
// Стражник получает метку acastle_npc_<id>, по ней его узнают скрипты.
function summonLines(stage, pos) {
  const lines = [];
  for (const p of POSTS.filter((q) => q.stage === stage)) {
    const g = GUARDS.find((q) => q.id === p.guard);
    lines.push(`summon ${NS}:guard ${pos(...p.at)} ${p.f} 0 ${NS}:as_${g.id} "${g.name}"`);
    lines.push(`tag @e[type=${NS}:guard,name="${g.name}"] add ${NS}_npc_${g.id}`);
  }
  return lines;
}

module.exports = { GUARDS, POSTS, HOMES, GANG, GUARD_SEL, SKIN_IDS, variantOf, writePacks, summonLines };
