// Ориентиры — маленькие постройки. У каждой своя короткая история и тайник.
(function () {
  const ROCK = [['cobblestone', 2], ['mossy_cobblestone', 3], ['andesite', 1]];

  defineStructure({
    id: 'mark_cairn',
    group: 'Ориентиры',
    name: 'Турий (каменная пирамидка)',
    rarity: 'частая',
    set: 'landmarks',
    weight: 3,
    biomes: 'тайга, снежная тайга',
    desc: 'Пирамидка из замшелых камней высотой с человека. Такие складывали землемеры и охотники, чтобы отметить путь. На верхнем камне табличка с номером. Под пирамидкой тайник.',
    territory: ['Несколько отдельных камней вокруг', 'Тропа мимо'],
    build() {
      const b = new Builder(81);
      b.ground(0, 0, 10, 10);
      b.fill(4, 0, 4, 6, 0, 6, ROCK).fill(5, 1, 4, 5, 1, 6, ROCK).fill(4, 1, 5, 6, 1, 5, ROCK);
      b.set(5, 2, 5, 'mossy_cobblestone').set(5, 3, 5, 'cobblestone_wall');
      b.set(5, 1, 7, 'spruce_sign', { f: 'n', slot: 'plate' });
      b.set(5, -1, 5, 'chest', { slot: 'under', f: 's' });
      for (const [x, z] of [[1, 2], [8, 7], [2, 8], [9, 1]]) b.set(x, 0, z, 'mossy_cobblestone_slab');
      b.surface(0, 5, 3, 5, 'grass_path', 0.5).surface(7, 5, 10, 5, 'grass_path', 0.5);
      b.spruce(0, 0, 9).spruce(10, 10, 10);
      b.scatter(0, 0, 10, 10, ['fern', 'large_fern', 'brown_mushroom'], 0.2);
      b.mark('slot', 5, -1, 5, 'Под турием', 'Ящик под пирамидкой. Надо разобрать камни.');
      b.mark('clue', 5, 1, 7, 'Табличка', 'Номер знака и короткая надпись.');
      return b;
    },
  });

  defineStructure({
    id: 'mark_signpost',
    group: 'Ориентиры',
    name: 'Указатель на развилке',
    rarity: 'частая',
    set: 'landmarks',
    weight: 3,
    biomes: 'тайга',
    desc: 'Развилка трёх троп. Старый столб с табличками стоит на замшелом камне, на верхушке фонарь. Одна табличка сорвана и валяется у лавки. Под камнем-основанием тайник.',
    territory: ['Три тропы: на север, на запад и на юг', 'Лавка-бревно у столба'],
    build() {
      const b = new Builder(91);
      b.ground(0, 0, 14, 14);
      b.surface(7, 0, 7, 14, 'grass_path').surface(0, 7, 7, 7, 'grass_path');
      b.surface(6, 2, 6, 6, 'grass_path', 0.4).surface(1, 6, 5, 6, 'grass_path', 0.4);
      b.set(8, 0, 8, 'mossy_cobblestone').fill(8, 1, 8, 8, 2, 8, 'spruce_fence').set(8, 3, 8, 'lantern');
      b.set(8, 2, 7, 'spruce_sign', { f: 's', slot: 'sign_north' }).set(7, 2, 8, 'spruce_sign', { f: 'e', slot: 'sign_west' }).set(8, 1, 9, 'spruce_sign', { f: 'n', slot: 'sign_south' });
      b.set(10, 0, 9, 'spruce_sign', { stand: 3, slot: 'sign_fallen' });
      b.fill(10, 0, 10, 10, 0, 11, 'spruce_log', { a: 'z' });
      b.set(8, -1, 8, 'chest', { slot: 'under_stone', f: 's' });
      b.anchor('north', 7, 0, 'n');
      b.spruce(1, 1, 10).spruce(12, 2, 9).spruce(2, 12, 11).spruce(13, 13, 9);
      b.scatter(0, 0, 14, 14, ['fern', 'large_fern', 'sweet_berry_bush'], 0.15);
      b.mark('slot', 8, -1, 8, 'Под камнем у столба', 'Камень-основание можно выбить, под ним ящик.');
      b.mark('clue', 7, 2, 8, 'Таблички', 'Направления, одно из них стёрто.');
      b.mark('clue', 10, 0, 9, 'Сорванная табличка', 'Лежит у лавки.');
      return b;
    },
  });

  defineStructure({
    id: 'mark_grave',
    group: 'Ориентиры',
    name: 'Одинокая могила',
    rarity: 'частая',
    set: 'landmarks',
    weight: 2,
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Холмик, деревянный крест и низкая оградка с калиткой. В изножье табличка с именем. Мак и горящая свеча говорят, что сюда ходят.',
    territory: ['Оградка из ели', 'Мох и мак на холмике'],
    build() {
      const b = new Builder(101);
      b.ground(0, 0, 10, 11);
      b.walls(3, 0, 3, 7, 0, 8, 'spruce_fence').clear(5, 0, 8, 5, 0, 8).set(5, 0, 8, 'spruce_fence_gate', { f: 'n' });
      b.set(5, -1, 5, 'chest', { slot: 'grave', f: 's' }).fill(5, 0, 5, 5, 0, 6, 'coarse_dirt');
      b.fill(5, 0, 4, 5, 2, 4, 'spruce_fence').set(4, 1, 4, 'spruce_fence').set(6, 1, 4, 'spruce_fence');
      b.set(5, 0, 7, 'spruce_sign', { stand: 0, slot: 'grave_sign' });
      b.set(4, 0, 6, 'poppy').set(6, 0, 6, 'candle', { lit: 1 }).set(6, 0, 5, 'moss_carpet').set(4, 0, 5, 'moss_carpet');
      b.spruce(9, 1, 12).spruce(0, 10, 9);
      b.scatter(0, 0, 10, 11, ['fern', 'large_fern'], 0.15);
      b.mark('clue', 5, 0, 7, 'Табличка', 'Имя, даты и строчка.');
      b.mark('slot', 5, -1, 5, 'В могиле', 'Под холмиком.');
      return b;
    },
  });

  defineStructure({
    id: 'mark_deadtree',
    group: 'Ориентиры',
    name: 'Сухое дерево-великан',
    rarity: 'необычная',
    set: 'landmarks',
    weight: 2,
    biomes: 'старовозрастная тайга, тайга',
    desc: 'Мёртвая ель в два обхвата без хвои, с обломанной верхушкой и кривыми сучьями. Видна поверх леса. Внизу дупло на уровне груди и вывороченные корни.',
    territory: ['Корнистая земля и свисающие корни у основания', 'Грибы вокруг ствола'],
    build() {
      const b = new Builder(111);
      b.ground(0, 0, 14, 14);
      const BARK = [['spruce_log', 3], ['stripped_spruce_log', 1]];
      b.fill(6, 0, 6, 7, 17, 7, BARK).fill(6, 18, 6, 6, 19, 6, BARK).set(7, 18, 7, 'spruce_log');
      b.fill(8, 8, 6, 10, 8, 6, 'spruce_log', { a: 'x' }).fill(3, 11, 7, 5, 11, 7, 'spruce_log', { a: 'x' }).fill(6, 14, 8, 6, 14, 10, 'spruce_log', { a: 'z' }).fill(8, 16, 7, 9, 16, 7, 'spruce_log', { a: 'x' });
      b.set(10, 9, 6, 'spruce_log').set(3, 12, 7, 'spruce_log');
      for (const [x, z] of [[5, 6], [8, 7], [6, 5], [7, 8], [5, 7], [8, 6]]) b.set(x, 0, z, 'rooted_dirt').set(x, -1, z, 'rooted_dirt', { g: 1 });
      b.set(8, 1, 7, 'fern').set(5, 1, 6, 'brown_mushroom');
      b.clear(7, 2, 7, 7, 3, 7).set(7, 2, 7, 'chest', { slot: 'hollow', f: 'e' });
      b.set(8, -1, 8, 'chest', { slot: 'roots', f: 's' }).set(8, 0, 8, 'rooted_dirt');
      b.surface(10, 9, 14, 10, 'grass_path', 0.4);
      b.anchor('east', 14, 9, 'e');
      b.spruce(0, 0, 10).spruce(14, 2, 11).spruce(1, 14, 9).spruce(13, 13, 10);
      b.scatter(0, 0, 14, 14, ['brown_mushroom', 'red_mushroom', 'fern', 'large_fern'], 0.2);
      b.mark('slot', 7, 2, 7, 'Дупло', 'Ниша в стволе на высоте груди.');
      b.mark('slot', 8, -1, 8, 'Между корнями', 'Ящик под корнем.');
      return b;
    },
  });

  defineStructure({
    id: 'mark_shrine',
    group: 'Ориентиры',
    name: 'Капище',
    rarity: 'редкая',
    set: 'landmarks',
    weight: 1,
    biomes: 'старовозрастная тайга, тайга',
    desc: 'Кольцо из восьми стоячих камней разной высоты на моховой поляне. В центре низкий алтарь с расписным горшком и свечами. На одном камне вырезана руна. Место старше любого дома в округе.',
    territory: ['Мох кругом радиусом 4', 'Ели стоят стеной'],
    build() {
      const b = new Builder(121);
      b.ground(0, 0, 18, 18);
      b.each(0, -1, 0, 18, -1, 18, (x, y, z) => { if ((x - 9) ** 2 + (z - 9) ** 2 <= 20) b.set(x, y, z, 'moss_block', { g: 1 }); });
      const STONES = [['mossy_cobblestone', 3], ['tuff', 2], ['andesite', 1], ['cobblestone', 1]];
      const heights = [3, 2, 4, 2, 3, 2, 4, 3];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = Math.round(9 + Math.cos(a) * 6), z = Math.round(9 + Math.sin(a) * 6);
        b.fill(x, 0, z, x, heights[i] - 1, z, STONES);
        if (i === 2) b.set(x, 1, z, 'chiseled_stone_bricks');
      }
      b.fill(8, 0, 9, 10, 0, 9, 'tuff').set(8, 1, 9, 'stone_brick_slab').set(10, 1, 9, 'stone_brick_slab').set(9, 1, 9, 'decorated_pot', { slot: 'pot' });
      b.set(8, 0, 8, 'candle', { lit: 1 }).set(10, 0, 10, 'candle', { lit: 1 }).set(9, 0, 11, 'candle', { lit: 1 });
      b.set(9, -1, 9, 'chest', { slot: 'under_altar', f: 's' });
      b.anchor('south', 9, 18, 's');
      for (const [x, z] of [[1, 1], [17, 1], [1, 17], [17, 17], [9, 0], [0, 9], [18, 10]]) b.spruce(x, z, 10 + ((x + z) % 4));
      b.scatter(0, 0, 18, 18, ['fern', 'large_fern', 'red_mushroom'], 0.1);
      b.mark('secret', 9, 1, 15, 'Камень с руной', 'Резной камень. Руна повторяется в записках.');
      b.mark('clue', 9, 1, 9, 'Чаша подношений', 'Расписной горшок на алтаре. Его можно разбить.');
      b.mark('slot', 9, -1, 9, 'Под алтарём', 'Ящик под средним камнем алтаря.');
      return b;
    },
  });
})();
