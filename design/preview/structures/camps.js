// Охотничьи лагеря — частые постройки без стен.
(function () {
  // Палатка-шалаш 5 блоков шириной, вход с юга.
  function tent(b, x, z, len, wool) {
    for (let dz = 0; dz < len; dz++) {
      b.set(x, 0, z + dz, wool).set(x + 4, 0, z + dz, wool);
      b.set(x + 1, 1, z + dz, wool).set(x + 3, 1, z + dz, wool);
      b.set(x + 2, 2, z + dz, wool);
    }
    b.fill(x + 1, 0, z, x + 3, 0, z, wool).set(x + 2, 1, z, wool);
    b.fill(x + 2, 0, z + len, x + 2, 1, z + len, 'spruce_fence');
  }

  function campfireRing(b, cx, cz, fire) {
    b.set(cx, 0, cz, fire);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) b.set(cx + dx, 0, cz + dz, ['cobblestone_slab', 'mossy_cobblestone_stairs'], { f: 'n' });
  }

  defineStructure({
    id: 'camp_hunters',
    group: 'Охотничьи лагеря',
    name: 'Лагерь охотников',
    rarity: 'частая',
    biomes: 'тайга, снежная тайга',
    desc: 'Две палатки вокруг каменного кострища, лавки из брёвен. Сушилка для шкур, коптильня, поленница и пустая клетка для зверя. Лагерь временный, но охотники возвращаются сюда каждый сезон.',
    territory: ['Утоптанная площадка без травы', 'Тропа к ручью и в чащу', 'Закопанная заначка под колом с черепом'],
    build() {
      const b = new Builder(53);
      b.ground(0, 0, 18, 16);
      b.surface(4, 5, 14, 12, [['coarse_dirt', 2], ['podzol', 2], ['grass_path', 1]], 0.7);
      campfireRing(b, 9, 8, 'campfire');
      b.fill(6, 0, 7, 6, 0, 9, 'spruce_log').fill(12, 0, 7, 12, 0, 9, 'spruce_log').fill(8, 0, 11, 10, 0, 11, 'spruce_log');
      tent(b, 2, 1, 5, 'white_wool');
      b.fill(3, 0, 3, 5, 0, 4, 'white_carpet').set(3, 0, 2, 'chest').set(5, 0, 2, 'barrel');
      tent(b, 12, 1, 5, [['brown_wool', 3], ['green_wool', 1]]);
      b.fill(13, 0, 3, 15, 0, 4, 'brown_carpet').set(13, 0, 2, 'fletching_table').set(15, 0, 2, 'barrel');
      // Сушилка шкур
      b.fill(13, 0, 12, 13, 2, 12, 'spruce_fence').fill(15, 0, 12, 15, 2, 12, 'spruce_fence').set(14, 2, 12, 'spruce_fence');
      b.set(14, 1, 12, 'brown_banner', { f: 'n' });
      b.set(3, 0, 11, 'smoker').set(2, 0, 11, 'barrel').set(2, 1, 11, 'barrel');
      b.fill(2, 0, 13, 3, 1, 14, 'spruce_log');
      b.walls(6, 0, 12, 8, 1, 14, 'iron_bars').fill(6, 2, 12, 8, 2, 14, 'spruce_slab').clear(7, 0, 14, 7, 1, 14);
      b.set(11, 0, 10, 'barrel');
      b.set(16, 0, 14, 'spruce_fence').set(16, 1, 14, 'skeleton_skull').set(16, -1, 14, 'suspicious_gravel');
      b.surface(9, 12, 9, 16, 'grass_path');
      b.spruce(0, 8, 10).spruce(17, 8, 11).spruce(8, 0, 9).spruce(1, 16, 9).spruce(18, 1, 8);
      b.scatter(0, 0, 18, 16, ['fern', 'large_fern', 'sweet_berry_bush'], 0.1);
      b.mark('slot', 3, 0, 2, 'Сундук в белой палатке', 'Личный сундук старшего охотника.');
      b.mark('slot', 16, -1, 14, 'Под колом с черепом', 'Подозрительный гравий, кисть. Охотничья примета: кол с черепом отмечает заначку.');
      b.mark('clue', 11, 0, 10, 'Бочка у костра', 'Сюда положим записку или охотничий дневник.');
      b.mark('clue', 14, 1, 12, 'Шкура на сушилке', 'На шкуре вырезан знак. Повторяется на других постройках цепочки.');
      return b;
    },
  });

  defineStructure({
    id: 'camp_treestand',
    group: 'Охотничьи лагеря',
    name: 'Засидка на ели',
    rarity: 'частая',
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Помост на высокой ели с перилами и навесом. Наверх ведёт лестница по стволу. Внизу солонец и сено как приманка для зверя. Сверху хороший обзор, отсюда видны другие ориентиры.',
    territory: ['Солонец из кальцита', 'Сено-приманка', 'Звериная тропа из каменистой земли'],
    build() {
      const b = new Builder(61);
      b.ground(0, 0, 12, 12);
      b.spruce(6, 6, 17);
      b.each(4, 8, 4, 8, 11, 8, (x, y, z) => { if (!(x === 6 && z === 6)) b.clear(x, y, z, x, y, z); });
      b.each(4, 7, 4, 8, 7, 8, (x, y, z) => { if (!(x === 6 && z === 6)) b.set(x, y, z, 'spruce_planks'); });
      b.walls(4, 8, 4, 8, 8, 8, 'spruce_fence');
      b.corners(4, 9, 4, 8, 10, 8, 'spruce_fence').fill(4, 11, 4, 8, 11, 8, 'spruce_slab').set(6, 11, 6, 'spruce_log');
      b.fill(6, 1, 7, 6, 7, 7, 'ladder', { f: 'n' });
      b.set(4, 8, 4, 'barrel').set(5, 8, 5, 'lantern');
      b.set(8, 6, 8, 'chest');
      b.fill(9, 0, 9, 10, 0, 9, 'calcite').set(3, 0, 9, 'hay_block');
      b.surface(9, 6, 12, 10, 'coarse_dirt', 0.6).surface(0, 9, 4, 12, 'coarse_dirt', 0.5);
      b.spruce(0, 1, 11).spruce(12, 0, 9).spruce(1, 12, 10).spruce(11, 12, 12);
      b.scatter(0, 0, 12, 12, ['fern', 'large_fern', 'sweet_berry_bush'], 0.12);
      b.mark('slot', 8, 6, 8, 'Ящик под настилом', 'Подвешен снизу к помосту, его скрывает хвоя. Виден только если смотреть с земли прямо вверх.');
      b.mark('clue', 4, 8, 4, 'Бочка на помосте', 'Подзорная труба и записка: «С засидки видно…» Направление на другой ориентир.');
      return b;
    },
  });

  defineStructure({
    id: 'camp_abandoned',
    group: 'Охотничьи лагеря',
    name: 'Брошенный лагерь',
    rarity: 'необычная',
    biomes: 'тайга',
    desc: 'Тот же охотничий лагерь, но уходили из него в спешке. Одна палатка рухнула, на вторую упала ель. Бочки опрокинуты, костёр давно остыл. От лагеря в чащу уходит цепочка следов.',
    territory: ['Поваленная ель с вывернутым корнем', 'Следы уходят на юг', 'Разбросанные бочки'],
    build() {
      const b = new Builder(71);
      b.ground(0, 0, 18, 16);
      b.surface(4, 5, 14, 12, [['coarse_dirt', 2], ['podzol', 2]], 0.6);
      campfireRing(b, 9, 8, 'campfire_out');
      b.decay({ cobblestone_slab: null, mossy_cobblestone_stairs: null }, 0.35);
      b.fill(6, 0, 7, 6, 0, 8, 'spruce_log').set(11, 0, 11, 'spruce_log');
      // Рухнувшая палатка: шерсть лежит на земле
      b.each(2, 0, 1, 6, 0, 6, (x, y, z) => { if (b.chance(0.7)) b.set(x, 0, z, b.chance(0.6) ? 'white_wool' : 'white_carpet'); });
      b.set(3, 0, 3, 'chest').set(4, 1, 3, 'cobweb');
      // Вторая палатка, раздавленная елью
      for (let dz = 0; dz < 3; dz++) {
        b.set(12, 0, 1 + dz, 'brown_wool').set(16, 0, 1 + dz, 'brown_wool').set(13, 1, 1 + dz, 'brown_wool');
      }
      b.fill(10, 1, 4, 17, 1, 4, 'spruce_log').fill(18, 0, 3, 18, 2, 5, 'rooted_dirt').set(18, 0, 6, 'hanging_roots');
      b.fill(10, 2, 3, 12, 2, 5, 'spruce_leaves').fill(9, 1, 3, 9, 1, 5, 'spruce_leaves');
      b.set(11, 0, 5, 'barrel').set(13, 0, 10, 'barrel').set(14, 0, 9, 'barrel').set(5, 0, 10, 'smoker');
      b.walls(6, 0, 12, 8, 0, 14, 'iron_bars').clear(7, 0, 14, 7, 0, 14);
      b.surface(9, 11, 9, 16, 'coarse_dirt').surface(10, 13, 10, 16, 'coarse_dirt', 0.5);
      b.set(4, -1, 13, 'suspicious_gravel');
      b.spruce(0, 8, 10).spruce(17, 10, 11).spruce(8, 0, 9).spruce(1, 16, 9);
      b.scatter(0, 0, 18, 16, ['fern', 'deadbush', 'brown_mushroom'], 0.1);
      b.mark('slot', 3, 0, 3, 'Под рухнувшей палаткой', 'Сундук накрыт шерстью и почти не виден.');
      b.mark('slot', 4, -1, 13, 'Закопанный свёрток', 'Подозрительный гравий у старой клетки. Нужна кисть.');
      b.mark('clue', 11, 0, 5, 'Аптечка-бочка', 'Бинты, пустые склянки и записка, написанная второпях.');
      b.mark('clue', 9, 0, 14, 'Следы в чащу', 'Тропа из каменистой земли ведёт к следующему месту истории.');
      return b;
    },
  });
})();
