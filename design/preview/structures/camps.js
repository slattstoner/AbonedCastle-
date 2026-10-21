// Охотничьи лагеря — частые постройки без капитальных стен.
(function () {
  // Палатка-шалаш шириной w (5 или 7), вход с юга, задняя стенка закрыта.
  function tent(b, x, z, len, wool, w = 5) {
    const half = (w - 1) / 2;
    for (let dz = 0; dz < len; dz++)
      for (let i = 0; i <= half; i++) {
        b.set(x + i, i, z + dz, wool).set(x + w - 1 - i, i, z + dz, wool);
      }
    for (let y = 0; y < half; y++) b.fill(x + y + 1, y, z, x + w - 2 - y, y, z, wool);
    b.fill(x + half, 0, z + len, x + half, half - 1, z + len, 'spruce_fence');
  }

  function campfireRing(b, cx, cz, fire) {
    b.set(cx, 0, cz, fire);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) b.set(cx + dx, -1, cz + dz, ['cobblestone', 'mossy_cobblestone'], { g: 1 });
  }

  defineStructure({
    id: 'camp_hunters',
    group: 'Охотничьи лагеря',
    name: 'Стан охотничьей артели',
    rarity: 'частая',
    set: 'common',
    weight: 3,
    biomes: 'тайга, снежная тайга',
    desc: 'Большой шатёр старшего и две палатки вокруг каменного кострища с лавками из брёвен. Есть сушилки для шкур, бревенчатая коптильня, клетка для зверя, поленница, кадка с водой и стрельбище с мишенью. На краю стана кол с черепом: охотничья примета, здесь что-то зарыто.',
    territory: ['Утоптанная площадка 25×23', 'Коптильня из брёвен', 'Стрельбище с мишенью на соломе', 'Кол с черепом и зарытый свёрток'],
    build() {
      const b = new Builder(53);
      b.ground(0, 0, 24, 22);
      b.surface(4, 4, 20, 18, [['coarse_dirt', 3], ['podzol', 2], ['grass_path', 1]], 0.75);
      campfireRing(b, 12, 10, 'campfire');
      b.fill(9, 0, 9, 9, 0, 11, 'spruce_log', { a: 'z' }).fill(15, 0, 9, 15, 0, 11, 'spruce_log', { a: 'z' }).fill(11, 0, 13, 13, 0, 13, 'spruce_log', { a: 'x' });
      // Шатёр старшего
      tent(b, 9, 1, 5, 'brown_wool', 7);
      b.fill(10, 0, 3, 14, 0, 4, 'white_carpet').set(10, 0, 2, 'chest', { f: 's', slot: 'elder_chest', theme: 'hunter' });
      b.set(14, 0, 2, 'barrel', { theme: 'hunter' }).set(12, 0, 2, 'fletching_table').set(13, 0, 3, 'lantern');
      // Палатки
      tent(b, 2, 5, 5, 'white_wool');
      b.fill(3, 0, 7, 5, 0, 8, 'brown_carpet').set(3, 0, 6, 'barrel', { slot: 'tent_white', theme: 'hunter' });
      tent(b, 18, 5, 5, [['green_wool', 2], ['brown_wool', 1]]);
      b.fill(19, 0, 7, 21, 0, 8, 'white_carpet').set(21, 0, 6, 'barrel', { slot: 'tent_green', theme: 'hunter' });
      // Сушилки шкур
      for (const x of [3, 7]) {
        b.fill(x, 0, 15, x, 2, 15, 'spruce_fence').fill(x + 2, 0, 15, x + 2, 2, 15, 'spruce_fence').set(x + 1, 2, 15, 'spruce_fence');
        b.set(x + 1, 3, 15, 'brown_carpet');
      }
      // Коптильня
      b.logRing(17, 0, 13, 20, 2, 16).clear(18, 0, 16, 18, 1, 16).fill(16, 3, 12, 21, 3, 17, 'spruce_slab');
      b.set(19, 0, 14, 'smoker', { f: 'w' }).set(18, 0, 14, 'campfire').set(19, 0, 15, 'barrel', { slot: 'smokehouse', theme: 'smoked' });
      b.fill(18, 2, 14, 19, 2, 15, 'iron_chain');
      // Клетка, поленница, кадка, стрельбище
      b.walls(2, 0, 18, 4, 1, 20, 'iron_bars').clear(3, 0, 18, 3, 1, 18).fill(2, 2, 18, 4, 2, 20, 'spruce_slab');
      b.fill(8, 0, 18, 10, 1, 20, 'spruce_log', { a: 'z' });
      b.set(16, 0, 10, 'cauldron', { water: 1 }).set(14, 0, 12, 'barrel', { slot: 'fire_barrel', theme: 'hunter' });
      b.set(22, 0, 19, 'hay_block').set(22, 1, 19, 'target').set(16, 0, 20, 'spruce_fence').set(16, 1, 20, 'spruce_fence');
      // Кол с черепом и зарытый свёрток
      b.fill(22, 0, 2, 22, 1, 2, 'spruce_fence').set(22, 2, 2, 'skeleton_skull').set(21, -1, 2, 'suspicious_gravel', { slot: 'stake_gravel' });
      b.surface(12, 0, 12, 3, 'grass_path', 0.6).surface(12, 14, 12, 22, 'grass_path', 0.7).surface(21, 10, 24, 10, 'grass_path', 0.6);
      b.anchor('deep', 12, 0, 'n').anchor('east', 24, 10, 'e').anchor('south', 12, 22, 's');
      b.spruce(0, 1, 10).spruce(24, 0, 9).spruce(0, 22, 11).spruce(24, 22, 9).spruce(6, 0, 8);
      b.scatter(0, 0, 24, 22, ['fern', 'large_fern', 'sweet_berry_bush', 'short_grass'], 0.1);
      b.mark('slot', 10, 0, 2, 'Сундук старшего', 'В большом шатре.');
      b.mark('slot', 21, -1, 2, 'Под колом с черепом', 'Подозрительный гравий у кола. Нужна кисть.');
      b.mark('clue', 14, 0, 12, 'Бочка у костра', 'Общая бочка артели.');
      b.mark('slot', 19, 0, 15, 'Коптильня', 'Бочка с копчёностями.');
      return b;
    },
  });

  defineStructure({
    id: 'camp_treestand',
    group: 'Охотничьи лагеря',
    name: 'Засидка на ели',
    rarity: 'частая',
    set: 'common',
    weight: 2,
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Помост с перилами и навесом на огромной ели, лестница по стволу. Внизу солонец, сено-приманка и шалаш охотника для ночёвки. Под помостом, в хвое, подвешен ящик. Сверху видно далеко.',
    territory: ['Своя большая ель, 18 блоков', 'Шалаш с лежанкой', 'Солонец и звериная тропа'],
    build() {
      const b = new Builder(61);
      b.ground(0, 0, 16, 16);
      b.spruce(8, 8, 18, 0, false, true);
      b.each(6, 8, 6, 10, 11, 10, (x, y, z) => { if (!(x === 8 && z === 8)) b.clear(x, y, z, x, y, z); });
      b.each(6, 7, 6, 10, 7, 10, (x, y, z) => { if (!(x === 8 && z === 8)) b.set(x, y, z, 'spruce_planks'); });
      b.walls(6, 8, 6, 10, 8, 10, 'spruce_fence');
      b.corners(6, 9, 6, 10, 10, 10, 'spruce_fence').fill(6, 11, 6, 10, 11, 10, 'spruce_slab').set(8, 11, 8, 'spruce_log');
      b.fill(8, 0, 9, 8, 7, 9, 'ladder', { f: 'n' });
      b.set(6, 8, 7, 'barrel', { slot: 'platform', theme: 'hunter' }).set(7, 8, 6, 'lantern');
      b.set(10, 6, 10, 'chest', { slot: 'under_platform', f: 's' });
      // Шалаш
      b.fill(2, 0, 11, 5, 1, 11, 'spruce_log', { a: 'x' }).fill(2, 2, 12, 5, 2, 12, 'spruce_stairs', { f: 'n' }).fill(2, 1, 13, 5, 1, 13, 'spruce_stairs', { f: 'n' });
      b.fill(3, 0, 12, 4, 0, 12, 'white_carpet').set(5, 0, 12, 'barrel', { slot: 'shalash', theme: 'hunter' }).set(2, 0, 12, 'campfire_out');
      b.fill(12, 0, 12, 13, 0, 12, 'calcite').set(12, 0, 4, 'hay_block');
      b.surface(10, 9, 16, 13, 'coarse_dirt', 0.6).surface(0, 5, 6, 8, 'coarse_dirt', 0.5);
      b.anchor('game_trail', 16, 12, 'e').anchor('north', 8, 0, 'n');
      b.spruce(1, 1, 11).spruce(15, 1, 9).spruce(1, 16, 10).spruce(15, 16, 12);
      b.scatter(0, 0, 16, 16, ['fern', 'large_fern', 'sweet_berry_bush'], 0.12);
      b.mark('slot', 10, 6, 10, 'Ящик под настилом', 'Подвешен к помосту снизу, его скрывает хвоя. Виден только с земли, если смотреть прямо вверх.');
      b.mark('clue', 6, 8, 7, 'Бочка на помосте', 'Записка охотника.');
      b.mark('slot', 5, 0, 12, 'Шалаш', 'Бочка у лежанки.');
      return b;
    },
  });

  defineStructure({
    id: 'camp_abandoned',
    group: 'Охотничьи лагеря',
    name: 'Брошенный стан',
    rarity: 'необычная',
    set: 'common',
    weight: 2,
    biomes: 'тайга',
    desc: 'Стан, из которого уходили в спешке. Одна палатка рухнула, на вторую упала ель. Бочки опрокинуты, кострище остыло, клетка сломана. От стана в чащу уходит цепочка следов.',
    territory: ['Поваленная ель с вывороченным корнем', 'Следы уходят на юг', 'Разбросанные бочки'],
    build() {
      const b = new Builder(71);
      b.ground(0, 0, 24, 22);
      b.surface(4, 5, 20, 16, [['coarse_dirt', 2], ['podzol', 2]], 0.6);
      campfireRing(b, 12, 11, 'campfire_out');
      b.fill(9, 0, 10, 9, 0, 11, 'spruce_log', { a: 'z' }).set(14, 0, 14, 'spruce_log', { a: 'x' });
      // Рухнувшая палатка
      b.each(2, 0, 2, 7, 0, 7, (x, y, z) => { if (b.chance(0.7)) b.set(x, 0, z, b.chance(0.6) ? 'white_wool' : 'white_carpet'); });
      b.set(4, 0, 4, 'white_wool').set(4, -1, 4, 'chest', { slot: 'under_tent', f: 's' });
      b.set(6, 1, 3, 'cobweb').set(2, 0, 8, 'spruce_fence');
      // Палатка под упавшей елью
      for (let dz = 0; dz < 3; dz++) b.set(14, 0, 2 + dz, 'brown_wool').set(18, 0, 2 + dz, 'brown_wool').set(15, 1, 2 + dz, 'brown_wool');
      b.fill(11, 1, 3, 21, 1, 3, 'spruce_log', { a: 'x' }).fill(22, 0, 2, 22, 2, 4, 'rooted_dirt').set(23, 0, 3, 'rooted_dirt');
      b.fill(9, 1, 2, 11, 2, 4, 'spruce_leaves').fill(8, 1, 3, 8, 1, 3, 'spruce_leaves');
      // Разброс
      b.set(13, 0, 7, 'barrel', { slot: 'medkit', f: 'e' }).set(16, 0, 12, 'barrel', { f: 'w', theme: 'junk' }).set(17, 0, 10, 'barrel', { f: 'n', theme: 'junk' });
      b.set(6, 0, 12, 'smoker', { f: 's' }).set(20, 0, 15, 'fletching_table');
      b.walls(6, 0, 16, 8, 0, 18, 'iron_bars').clear(7, 0, 18, 7, 0, 18).clear(8, 0, 17, 8, 0, 17);
      b.set(5, -1, 17, 'suspicious_gravel', { slot: 'bundle' });
      // Следы в чащу
      for (let z = 13; z <= 22; z++) if (z % 2) b.set(12, -1, z, 'coarse_dirt', { g: 1 }); else b.set(13, -1, z, 'coarse_dirt', { g: 1 });
      b.anchor('tracks', 12, 22, 's').anchor('west', 0, 11, 'w');
      b.spruce(0, 8, 10).spruce(24, 12, 11).spruce(6, 0, 9).spruce(0, 21, 9).spruce(24, 21, 10);
      b.scatter(0, 0, 24, 22, ['fern', 'deadbush', 'brown_mushroom', 'short_grass'], 0.1);
      b.mark('slot', 4, -1, 4, 'Под рухнувшей палаткой', 'Сундук вкопан в землю и накрыт шерстью.');
      b.mark('slot', 5, -1, 17, 'Закопанный свёрток', 'Подозрительный гравий у сломанной клетки. Нужна кисть.');
      b.mark('clue', 13, 0, 7, 'Бочка-аптечка', 'Опрокинутая бочка с бинтами и запиской.');
      b.mark('clue', 12, -1, 21, 'Следы в чащу', 'Цепочка следов ведёт к дальнему тайнику.');
      return b;
    },
  });
})();
