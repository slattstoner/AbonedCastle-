// Места сюжета замка, которых нет среди построек тайги: лагерь Рыжего у Чёрной гари,
// рудник в квадрате Г-7, Старая гать на болоте. В обычной генерации мира не участвуют
// (set: 'quest'), их ставит задание, когда игрок подходит по компасу.
// b.host — где встанет хозяин места (иначе — свободный пол ближе к середине двора).
(function () {
  const BURNT = [['coarse_dirt', 4], ['podzol', 3], ['gravel', 1], ['dirt', 2]];

  // Шалаш-палатка: двускатный полог из шерсти, вход с торца. Длина вдоль z.
  function tent(b, x, z, len, wool, opts = {}) {
    for (let dz = 0; dz < len; dz++) {
      b.set(x, 0, z + dz, wool).set(x + 4, 0, z + dz, wool);
      b.set(x + 1, 1, z + dz, wool).set(x + 3, 1, z + dz, wool);
      b.set(x + 2, 2, z + dz, 'spruce_log', { a: 'z' });
    }
    // задняя стенка
    b.set(x + 1, 0, z + len - 1, wool).set(x + 2, 0, z + len - 1, wool).set(x + 3, 0, z + len - 1, wool).set(x + 2, 1, z + len - 1, wool);
    if (opts.rug) b.fill(x + 1, 0, z + 1, x + 3, 0, z + len - 2, opts.rug);
    return b;
  }

  defineStructure({
    id: 'outlaw',
    group: 'Места сюжета',
    name: 'Лагерь Рыжего у Чёрной гари',
    rarity: 'по заданию',
    set: 'quest',
    weight: 1,
    biomes: 'тайга (гарь)',
    desc: 'Стан шайки на старой гари: сухие обгорелые ели, частокол с воротцами, шатёр атамана с красным пологом, шалаши, общий костёр с котлом кашевара и дозорный помост. В шатре — сундук атамана.',
    territory: ['Гарь: сухие ели и пни', 'Тропа к воротцам частокола'],
    build() {
      const b = new Builder(701);
      b.ground(0, 0, 28, 26, BURNT);
      // частокол с воротцами (вход — с южной стороны)
      b.walls(2, 0, 2, 26, 1, 24, 'spruce_fence');
      b.each(2, 2, 2, 26, 2, 24, (x, y, z) => { if ((x === 2 || x === 26 || z === 2 || z === 24) && (x + z) % 3 === 0) b.set(x, y, z, 'spruce_fence'); });
      b.clear(13, 0, 24, 15, 2, 24);
      b.set(12, 0, 24, 'spruce_log').set(12, 1, 24, 'spruce_log').set(12, 2, 24, 'skeleton_skull', { f: 's' });
      b.set(16, 0, 24, 'spruce_log').set(16, 1, 24, 'spruce_log').set(16, 2, 24, 'lantern');
      b.surface(13, 14, 15, 26, 'grass_path', 0.8);
      // общий костёр, котёл кашевара, брёвна-лавки
      b.surface(11, 11, 17, 17, 'coarse_dirt');
      b.set(14, 0, 14, 'campfire');
      b.set(16, 0, 12, 'cauldron', { water: 1 }).set(17, 0, 12, 'barrel', { f: 'u', slot: 'pakhom', theme: 'kitchen' });
      b.fill(11, 0, 13, 11, 0, 15, 'spruce_log', { a: 'z' }).fill(13, 0, 17, 15, 0, 17, 'spruce_log', { a: 'x' });
      b.set(17, 0, 15, 'spruce_slab').set(17, 0, 16, 'spruce_slab');
      // шатёр атамана: красный полог, ковёр, сундук и стол
      tent(b, 12, 4, 6, 'red_wool', { rug: 'brown_carpet' });
      b.set(14, 0, 8, 'chest', { slot: 'ataman', f: 'n' }).set(13, 0, 8, 'barrel', { f: 'u', theme: 'soldier' });
      b.set(15, 0, 6, 'spruce_slab').set(15, 1, 6, 'candle', { lit: 1, n: 2 });
      b.set(14, 0, 4, 'air').set(14, 1, 4, 'air'); // вход с торца
      b.set(14, 3, 4, 'red_banner', { stand: 8 });
      // шалаши шайки
      tent(b, 4, 6, 5, 'brown_wool', { rug: 'brown_carpet' });
      b.set(6, 0, 6, 'air').set(6, 1, 6, 'air');
      b.set(5, 0, 9, 'brown_bed', { f: 'n' }).set(5, 0, 8, 'brown_bed', { f: 'n', head: 1 });
      tent(b, 20, 6, 5, 'gray_wool');
      b.set(22, 0, 6, 'air').set(22, 1, 6, 'air');
      b.set(23, 0, 9, 'chest', { f: 'w', theme: 'soldier' });
      tent(b, 4, 15, 5, 'black_wool', { rug: 'brown_carpet' });
      b.set(6, 0, 15, 'air').set(6, 1, 15, 'air');
      // дозорный помост Ворона
      b.corners(21, 0, 17, 23, 3, 19, 'spruce_log');
      b.fill(21, 4, 17, 23, 4, 19, 'spruce_planks');
      b.walls(21, 5, 17, 23, 5, 19, 'spruce_fence');
      for (let y = 0; y <= 4; y++) b.set(21, y, 20, 'ladder', { f: 'n' });
      b.set(22, 5, 18, 'barrel', { f: 'u', theme: 'hunter' });
      // добыча: ящики, сено, мишени
      b.set(20, 0, 22, 'hay_block').set(21, 0, 22, 'barrel', { f: 'u', theme: 'soldier' }).set(19, 0, 22, 'hay_block');
      b.set(7, 0, 22, 'target').set(8, 0, 22, 'hay_block').set(9, 0, 21, 'chest', { f: 'n', theme: 'junk' });
      b.set(25, 0, 14, 'grindstone', { f: 'w' }).set(25, 0, 12, 'anvil', { f: 'w' });
      // гарь вокруг: сухие ели
      for (const [x, z, h] of [[0, 0, 7], [27, 1, 6], [1, 25, 8], [27, 25, 5], [9, 1, 6], [26, 11, 7], [0, 13, 5]]) b.spruce(x, z, h, 0, true, true);
      b.scatter(3, 3, 25, 23, ['deadbush', 'brown_mushroom'], 0.04, true);
      b.host = { x: 14, z: 11 };
      b.mark('slot', 14, 0, 8, 'Сундук атамана', 'Письма Ножова и доля Рыжего.');
      b.mark('slot', 17, 0, 12, 'Бочка кашевара', 'Запасы Пахома.');
      return b;
    },
  });

  defineStructure({
    id: 'mine',
    group: 'Места сюжета',
    name: 'Рудник в квадрате Г-7',
    rarity: 'по заданию',
    set: 'quest',
    weight: 1,
    biomes: 'тайга (каменистый холм)',
    desc: 'Каменный холм со штольней в еловой крепи. Внутри, в десятке шагов от входа, свод обвалился: гравий и булыжник до потолка. За завалом — каморка, где прячется картограф Ленц. В стенах видна золотая жила.',
    territory: ['Отвал пустой породы у входа', 'Брошенная тачка и инструменты'],
    build() {
      const b = new Builder(702);
      b.ground(0, 0, 22, 22);
      const ROCK = [['stone', 5], ['andesite', 3], ['cobblestone', 1], ['mossy_cobblestone', 1], ['tuff', 1]];
      // холм: слои всё меньше к верху
      for (let y = 0; y <= 6; y++) {
        const r = 10 - y;
        b.each(11 - r, y, 9 - r + 1, 11 + r, y, 21, (x, yy, z) => {
          const d = Math.hypot((x - 11) / (r + 0.5), (z - 14) / (r + 2.5));
          if (d <= 1) b.set(x, yy, z, ROCK);
        });
      }
      b.each(0, 7, 0, 22, 7, 22, (x, y, z) => { if (b.get(x, 6, z) && b.chance(0.5)) b.set(x, y, z, ['moss_block', 'grass_block']); });
      // штольня: вход с юга? нет — с севера (z = 4), идёт вглубь холма
      const T1 = 4, T2 = 19;
      b.clear(10, 0, T1, 12, 2, T2);
      for (let z = T1; z <= T2; z += 3) {
        b.set(10, 0, z, 'spruce_fence').set(10, 1, z, 'spruce_fence').set(12, 0, z, 'spruce_fence').set(12, 1, z, 'spruce_fence');
        b.fill(10, 2, z, 12, 2, z, 'spruce_planks');
        if (z > T1 && z < 13) b.set(11, 1, z, 'lantern', { hang: 1 });
      }
      b.surface(10, T1, 12, T2, 'gravel', 0.4);
      // жила в стенах
      for (const [x, y, z] of [[9, 1, 8], [13, 0, 10], [9, 2, 11], [13, 1, 16], [9, 0, 17], [13, 2, 18]]) b.set(x, y, z, 'gold_ore');
      // обвал: гравий и булыжник поперёк штольни
      b.fill(10, 0, 13, 12, 2, 14, ['gravel', 'cobblestone', 'gravel', 'andesite']);
      b.set(11, 0, 12, 'cobblestone_slab').set(10, 0, 12, 'gravel');
      // каморка за завалом
      b.clear(9, 0, 15, 13, 2, 19);
      b.set(9, 0, 19, 'chest', { slot: 'lenz', f: 'e' }).set(13, 0, 19, 'barrel', { f: 'u', theme: 'kitchen' });
      b.set(13, 0, 15, 'spruce_slab').set(13, 1, 15, 'candle', { lit: 1, n: 3 });
      b.set(11, 2, 17, 'lantern', { hang: 1 });
      b.set(10, 0, 18, 'brown_carpet').set(11, 0, 18, 'brown_carpet');
      b.set(12, 0, 19, 'cartography_table');
      // вход: крепь, табличка, отвал и тачка
      b.fill(9, 0, T1 - 1, 9, 3, T1 - 1, 'spruce_log').fill(13, 0, T1 - 1, 13, 3, T1 - 1, 'spruce_log').fill(9, 3, T1 - 1, 13, 3, T1 - 1, 'spruce_log', { a: 'x' });
      b.clear(10, 0, T1 - 1, 12, 2, T1 - 1);
      b.set(11, 3, T1 - 2, 'spruce_sign', { f: 's', slot: 'plate' });
      b.set(9, 0, T1 - 2, 'torch').set(13, 0, T1 - 2, 'torch');
      b.fill(3, 0, 2, 6, 0, 4, ['gravel', 'cobblestone', 'andesite']).fill(4, 1, 3, 5, 1, 3, 'gravel');
      b.set(16, 0, 2, 'composter').set(17, 0, 2, 'grindstone', { f: 'n' }).set(16, 0, 1, 'barrel', { f: 'u', theme: 'junk' });
      b.surface(10, 0, 12, T1 - 1, 'grass_path', 0.8);
      b.spruce(1, 9, 9).spruce(21, 3, 10).spruce(20, 21, 8);
      b.host = { x: 11, z: 17 };
      b.mark('secret', 11, 0, 13, 'Обвал', 'Гравий и булыжник поперёк штольни: разобрать.');
      b.mark('slot', 9, 0, 19, 'Сундук Ленца', 'Карта квадрата Г-7 и записи о жиле.');
      return b;
    },
  });

  defineStructure({
    id: 'gat',
    group: 'Места сюжета',
    name: 'Старая гать на болоте',
    rarity: 'по заданию',
    set: 'quest',
    weight: 1,
    biomes: 'тайга (болото)',
    desc: 'Топь с окнами чёрной воды, кувшинки, сухие ели. Через болото ведёт старая гать — настил из досок на кочках. На дальней кочке крест углежогов, под ним Прохор двадцать лет назад зарыл серебряный оберег княжича.',
    territory: ['Окна воды и грязь', 'Сухие ели по краю'],
    build() {
      const b = new Builder(703);
      b.ground(0, 0, 24, 24, [['grass_block', 2], ['mud', 3], ['moss_block', 2], ['podzol', 1]]);
      // окна воды
      b.each(1, -1, 1, 23, -1, 23, (x, y, z) => {
        const n = Math.sin(x * 0.7) + Math.cos(z * 0.6) + Math.sin((x + z) * 0.35);
        if (n > 0.2 && !(x >= 11 && x <= 13) && !(z <= 7 && x >= 9 && x <= 15)) { b.set(x, y, z, 'water', { g: 1 }); if (b.chance(0.25)) b.set(x, 0, z, 'waterlily'); }
      });
      // гать: настил по кочкам с края до креста
      for (let z = 24; z >= 6; z--) {
        b.set(12, -1, z, 'spruce_planks', { g: 1 });
        if (z % 2) { b.set(11, -1, z, 'spruce_planks', { g: 1 }); b.set(13, -1, z, 'mud', { g: 1 }); }
        else { b.set(13, -1, z, 'spruce_planks', { g: 1 }); b.set(11, -1, z, 'mud', { g: 1 }); }
        if (z % 6 === 0) { b.set(10, 0, z, 'spruce_fence'); b.set(14, 0, z, 'spruce_fence'); }
      }
      // кочка с крестом
      b.each(9, -1, 2, 15, -1, 7, (x, y, z) => b.set(x, y, z, ['moss_block', 'grass_block', 'podzol'], { g: 1 }));
      b.set(12, -1, 4, 'chest', { slot: 'amulet', f: 's' });
      b.fill(12, 0, 4, 12, 2, 4, 'spruce_fence').set(11, 1, 4, 'spruce_fence').set(13, 1, 4, 'spruce_fence');
      b.set(12, 0, 5, 'spruce_sign', { stand: 0, slot: 'cross_sign' });
      b.set(11, 0, 5, 'candle', { lit: 1 }).set(13, 0, 3, 'moss_carpet').set(10, 0, 4, 'fern');
      for (const [x, z, h] of [[2, 3, 7], [21, 2, 6], [3, 20, 5], [22, 19, 8], [7, 11, 6], [18, 13, 5]]) b.spruce(x, z, h, 0, true, true);
      b.scatter(0, 0, 24, 24, ['short_grass', 'fern', 'brown_mushroom'], 0.12);
      b.host = { x: 12, z: 6 };
      b.mark('slot', 12, -1, 4, 'Под крестом', 'Серебряный оберег-башня в тряпице.');
      return b;
    },
  });
})();
