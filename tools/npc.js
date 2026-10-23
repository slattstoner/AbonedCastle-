// Жители замка в аддоне. Пока один вид — стражник (acastle:guard): стоит на посту,
// бьёт монстров рядом (кроме крипера и эндермена), игрока не трогает и от него
// урона не получает, сам потихоньку лечится. Внешность — модель игрока и скин
// из tools/skins.js, скин выбирается номером варианта.
'use strict';

const NS = 'acastle';

// Стражники: событие призыва → скин и имя. Номер в списке — номер варианта.
const GUARDS = [
  { id: 'ostap', name: 'Стражник Остап' },
  { id: 'mitka', name: 'Стражник Митька' },
  { id: 'zhdan', name: 'Стражник Ждан' },
  { id: 'gavrila', name: 'Стражник Гаврила' },
  { id: 'luka', name: 'Стражник Лука' },
];

// Посты в координатах замка (как в castle.js): x — восток, z — юг; f — поворот (0 — лицом на юг, наружу).
// Этап 0: Остап и Митька в проезде ворот по обе стороны, у внешнего края арки.
// Этап 1: трое стражников гарнизона у ворот со стороны двора и на площади.
const POSTS = [
  { stage: 0, guard: 'ostap', at: [61, 0, 128], f: 0 },
  { stage: 0, guard: 'mitka', at: [65, 0, 128], f: 0 },
  { stage: 1, guard: 'zhdan', at: [59, 0, 121], f: 0 },
  { stage: 1, guard: 'gavrila', at: [67, 0, 121], f: 0 },
  { stage: 1, guard: 'luka', at: [63, 0, 114], f: 0 },
];
const GUARD_SEL = `@e[type=${NS}:guard]`;

const monster = { test: 'is_family', subject: 'other', value: 'monster' };
function behavior() {
  const groups = { [`${NS}:despawn`]: { 'minecraft:instant_despawn': {} } };
  const events = {
    // Из яйца призыва — один из стражников гарнизона
    'minecraft:entity_spawned': { randomize: GUARDS.slice(2).map((g) => ({ weight: 1, add: { component_groups: [`${NS}:skin_${g.id}`] } })) },
    [`${NS}:despawn`]: { add: { component_groups: [`${NS}:despawn`] } },
  };
  GUARDS.forEach((g, i) => {
    groups[`${NS}:skin_${g.id}`] = { 'minecraft:variant': { value: i } };
    const others = GUARDS.filter((o) => o !== g).map((o) => `${NS}:skin_${o.id}`);
    events[`${NS}:as_${g.id}`] = { remove: { component_groups: others }, add: { component_groups: [`${NS}:skin_${g.id}`] } };
  });
  return {
    format_version: '1.21.0',
    'minecraft:entity': {
      description: { identifier: `${NS}:guard`, is_spawnable: true, is_summonable: true, is_experimental: false },
      component_groups: groups,
      components: {
        // irongolem — чтобы зомби и скелеты сами шли драться со стражей, как с железным големом
        'minecraft:type_family': { family: [`${NS}_guard`, `${NS}_npc`, 'irongolem', 'mob'] },
        'minecraft:variant': { value: 0 },
        'minecraft:collision_box': { width: 0.6, height: 1.9 },
        'minecraft:health': { value: 40, max: 40 },
        'minecraft:attack': { damage: 6 },
        'minecraft:movement': { value: 0.3 },
        'minecraft:movement.basic': {},
        'minecraft:jump.static': {},
        'minecraft:can_climb': {},
        'minecraft:navigation.walk': { can_walk: true, avoid_water: true, avoid_damage_blocks: true, can_pass_doors: true, can_open_doors: false },
        'minecraft:physics': {},
        'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: true },
        'minecraft:persistent': {},
        'minecraft:nameable': { always_show: false, allow_name_tag_renaming: false },
        'minecraft:knockback_resistance': { value: 0.4 },
        'minecraft:follow_range': { value: 24, max: 24 },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
        'minecraft:conditional_bandwidth_optimization': {},
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
        'minecraft:behavior.float': { priority: 0 },
        'minecraft:behavior.hurt_by_target': { priority: 1, entity_types: { filters: monster } },
        'minecraft:behavior.melee_box_attack': { priority: 2, track_target: true, speed_multiplier: 1.2 },
        'minecraft:behavior.nearest_attackable_target': {
          priority: 3, must_see: true, reselect_targets: true, within_radius: 20, must_see_forget_duration: 5,
          entity_types: [{
            filters: { all_of: [monster,
              { test: 'is_family', subject: 'other', operator: '!=', value: 'creeper' },
              { test: 'is_family', subject: 'other', operator: '!=', value: 'enderman' }] },
            max_dist: 20,
          }],
        },
        'minecraft:behavior.move_towards_home_restriction': { priority: 4 },
        'minecraft:behavior.random_stroll': { priority: 7, speed_multiplier: 0.6, xz_dist: 2, y_dist: 1, interval: 400 },
        'minecraft:behavior.look_at_player': { priority: 8, look_distance: 8, probability: 0.6 },
        'minecraft:behavior.random_look_around': { priority: 9 },
      },
      events,
    },
  };
}

function client(textures) {
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:guard`,
        materials: { default: 'entity_alphatest' },
        textures,
        geometry: { default: 'geometry.humanoid.custom' },
        render_controllers: [`controller.render.${NS}.guard`],
        spawn_egg: { base_color: '#8a1e1e', overlay_color: '#d8b040' },
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

// writeBP / writeRP(rel, data); skinPng(id) → Buffer; checkTable(t, where) — сверка предметов
function writePacks(writeBP, writeRP, skinPng, checkTable) {
  writeBP('entities/guard.json', behavior());
  const gear = { pools: [{ rolls: 1, entries: [{ type: 'item', name: 'minecraft:iron_sword', weight: 1 }] }] };
  checkTable(gear, 'снаряжение стражника');
  writeBP(`loot_tables/${NS}/npc/guard_gear.json`, gear);
  const textures = {};
  for (const g of GUARDS) {
    textures[g.id] = `textures/entity/${NS}/${g.id}`;
    writeRP(`textures/entity/${NS}/${g.id}.png`, skinPng(g.id));
  }
  writeRP(`entity/guard.entity.json`, client(textures));
  writeRP(`render_controllers/${NS}.render_controllers.json`, {
    format_version: '1.8.0',
    render_controllers: {
      [`controller.render.${NS}.guard`]: {
        arrays: { textures: { 'Array.skins': GUARDS.map((g) => `Texture.${g.id}`) } },
        geometry: 'Geometry.default',
        materials: [{ '*': 'Material.default' }],
        textures: ['Array.skins[query.variant]'],
      },
    },
  });
  const lang = [
    `entity.${NS}:guard.name=Стражник замка`,
    `item.spawn_egg.entity.${NS}:guard.name=Призвать стражника замка`,
  ].join('\n') + '\n';
  writeRP('texts/ru_RU.lang', lang);
  writeRP('texts/en_US.lang', lang);
  writeRP('texts/languages.json', ['ru_RU', 'en_US']);
}

// Команды призыва стражи этапа. pos(x, y, z) → строка «~dx ~dy ~dz» от точки, где выполняется функция.
function summonLines(stage, pos) {
  const lines = [];
  for (const p of POSTS.filter((q) => q.stage === stage)) {
    const g = GUARDS.find((q) => q.id === p.guard);
    lines.push(`summon ${NS}:guard ${pos(...p.at)} ${p.f} 0 ${NS}:as_${g.id} "${g.name}"`);
  }
  return lines;
}

module.exports = { GUARDS, POSTS, GUARD_SEL, writePacks, summonLines };
