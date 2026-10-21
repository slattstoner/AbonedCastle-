// Ориентиры — маленькие постройки. Записки ссылаются на них:
// «от турия двадцать шагов к восходу». Часть внешних схронов прячется рядом.
(function () {
  const ROCK = [['cobblestone', 2], ['mossy_cobblestone', 3], ['andesite', 1]];

  defineStructure({
    id: 'mark_cairn',
    group: 'Ориентиры',
    name: 'Турий (каменная пирамидка)',
    rarity: 'частая',
    biomes: 'тайга, снежная тайга, холмы',
    desc: 'Пирамидка из замшелых камней высотой с человека. Такие складывают охотники и лесники, чтобы отметить путь. Издалека видна над папоротником, и записки удобно отсчитывают шаги от неё.',
    territory: ['Несколько отдельных камней вокруг', 'Без тропы: стоит прямо в лесу'],
    build() {
      const b = new Builder(81);
      b.ground(0, 0, 8, 8);
      b.fill(3, 0, 3, 5, 0, 5, ROCK);
      b.fill(4, 1, 3, 4, 1, 5, ROCK).fill(3, 1, 4, 5, 1, 4, ROCK);
      b.set(4, 2, 4, 'mossy_cobblestone').set(4, 3, 4, 'cobblestone_wall');
      b.set(4, -2, 4, 'chest');
      for (const [x, z] of [[1, 2], [7, 6], [2, 7]]) b.set(x, 0, z, 'mossy_cobblestone_stairs', { f: 'n' });
      b.spruce(0, 0, 9).spruce(8, 1, 10);
      b.scatter(0, 0, 8, 8, ['fern', 'large_fern', 'brown_mushroom'], 0.2);
      b.mark('slot', 4, -2, 4, 'Под турием', 'Ящик закопан прямо под пирамидкой, надо разобрать камни. Классический схрон.');
      b.mark('clue', 4, 3, 4, 'Верхний камень', 'Отсюда записки считают шаги. Сам турий может ничего не хранить: он только точка отсчёта.');
      return b;
    },
  });

  defineStructure({
    id: 'mark_signpost',
    group: 'Ориентиры',
    name: 'Указатель на развилке',
    rarity: 'частая',
    biomes: 'тайга',
    desc: 'Развилка трёх троп. Старый столб с табличками стоит на замшелом камне, на верхушке висит фонарь. Одна табличка сорвана и лежит в траве. Надписи можно делать под историю: «К заимке», «К озеру», и одна стёрта.',
    territory: ['Три тропы: на север, на запад и на юг', 'Лавка-бревно у столба'],
    build() {
      const b = new Builder(91);
      b.ground(0, 0, 12, 12);
      b.surface(6, 0, 6, 12, 'grass_path').surface(0, 6, 6, 6, 'grass_path');
      b.surface(5, 2, 5, 5, 'grass_path', 0.4).surface(1, 5, 4, 5, 'grass_path', 0.4);
      b.set(7, 0, 7, 'mossy_cobblestone').fill(7, 1, 7, 7, 2, 7, 'spruce_fence').set(7, 3, 7, 'lantern');
      b.set(7, 2, 6, 'spruce_sign', { f: 's' }).set(6, 2, 7, 'spruce_sign', { f: 'e' }).set(7, 1, 8, 'spruce_sign', { f: 'n' });
      b.set(8, 0, 8, 'spruce_sign', { f: 'n', h: 'flat' });
      b.fill(9, 0, 9, 9, 0, 10, 'spruce_log');
      b.set(7, -1, 7, 'chest');
      b.spruce(1, 1, 10).spruce(10, 2, 9).spruce(2, 10, 11).spruce(11, 11, 9);
      b.scatter(0, 0, 12, 12, ['fern', 'large_fern', 'sweet_berry_bush'], 0.15);
      b.mark('slot', 7, -1, 7, 'Под камнем у столба', 'Камень-основание можно выбить, под ним ящик.');
      b.mark('clue', 6, 2, 7, 'Стёртая табличка', 'Одна надпись стёрта. Полный текст найдётся в записке из другой постройки.');
      b.mark('clue', 8, 0, 8, 'Сорванная табличка', 'Лежит в траве. Указывает в сторону, где тропы нет.');
      return b;
    },
  });

  defineStructure({
    id: 'mark_grave',
    group: 'Ориентиры',
    name: 'Одинокая могила',
    rarity: 'частая',
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Холмик под старой елью, деревянный крест и низкая оградка с калиткой. На кресте табличка. Мак и свеча говорят, что сюда ходят. Разные могилы будут хранить разные имена из историй.',
    territory: ['Оградка из ели', 'Старая ель над могилой'],
    build() {
      const b = new Builder(101);
      b.ground(0, 0, 8, 9);
      b.walls(2, 0, 2, 6, 0, 7, 'spruce_fence').clear(4, 0, 7, 4, 0, 7).set(4, 0, 7, 'spruce_fence_gate', { f: 'n' });
      b.fill(4, 0, 4, 4, 0, 5, 'coarse_dirt');
      b.fill(4, 0, 3, 4, 2, 3, 'spruce_fence').set(3, 1, 3, 'spruce_fence').set(5, 1, 3, 'spruce_fence');
      b.set(4, 1, 4, 'item_frame', { f: 'n' });
      b.set(3, 0, 5, 'poppy').set(5, 0, 5, 'candle').set(5, 0, 4, 'moss_carpet');
      b.set(4, -2, 4, 'chest');
      b.spruce(7, 1, 12).spruce(0, 8, 9);
      b.scatter(0, 0, 8, 9, ['fern', 'large_fern'], 0.15);
      b.mark('clue', 4, 1, 4, 'Табличка на кресте', 'Имя, даты и строчка эпитафии. Ключ к истории.');
      b.mark('slot', 4, -2, 4, 'Вещи покойного', 'Слот можно включать не везде, а только в историях, где это уместно.');
      return b;
    },
  });

  defineStructure({
    id: 'mark_deadtree',
    group: 'Ориентиры',
    name: 'Сухое дерево-великан',
    rarity: 'необычная',
    biomes: 'старовозрастная тайга',
    desc: 'Мёртвая ель в два обхвата, без хвои, с обломанной верхушкой и кривыми сучьями. Её видно поверх леса, поэтому это лучший ориентир в биоме. Внизу дупло и вывороченные корни.',
    territory: ['Корнистая земля и свисающие корни у основания', 'Грибы вокруг ствола'],
    build() {
      const b = new Builder(111);
      b.ground(0, 0, 12, 12);
      const BARK = [['spruce_log', 3], ['stripped_spruce_log', 1]];
      b.fill(5, 0, 5, 6, 17, 6, BARK).fill(5, 18, 5, 5, 19, 5, BARK).set(6, 18, 6, 'spruce_log');
      b.fill(7, 8, 5, 9, 8, 5, 'spruce_log').fill(2, 11, 6, 4, 11, 6, 'spruce_log').fill(5, 14, 7, 5, 14, 9, 'spruce_log').fill(7, 16, 6, 8, 16, 6, 'spruce_log');
      b.set(9, 9, 5, 'spruce_log').set(2, 12, 6, 'spruce_log');
      for (const [x, z] of [[4, 5], [7, 6], [5, 4], [6, 7], [4, 6], [7, 5]]) b.set(x, 0, z, 'rooted_dirt').set(x, -1, z, 'rooted_dirt');
      b.set(7, 1, 6, 'hanging_roots').set(4, 1, 5, 'hanging_roots');
      b.clear(6, 2, 6, 6, 3, 6).set(6, 2, 6, 'chest');
      b.set(7, -1, 7, 'chest');
      b.spruce(0, 0, 10).spruce(12, 2, 11).spruce(1, 12, 9).spruce(11, 11, 10);
      b.scatter(0, 0, 12, 12, ['brown_mushroom', 'red_mushroom', 'fern', 'large_fern'], 0.2);
      b.mark('slot', 6, 2, 6, 'Дупло', 'Ниша в стволе на высоте груди, открыта на юго-восток.');
      b.mark('slot', 7, -1, 7, 'Между корнями', 'Ящик под корнем. Подсказка: «где дерево держится за землю».');
      return b;
    },
  });

  defineStructure({
    id: 'mark_shrine',
    group: 'Ориентиры',
    name: 'Капище',
    rarity: 'редкая',
    biomes: 'старовозрастная тайга',
    desc: 'Кольцо из восьми стоячих камней разной высоты на моховой поляне. В центре низкий алтарь с расписным горшком и свечами. На одном из камней вырезана руна. Место древнее любого дома в округе.',
    territory: ['Мох кругом радиусом 4', 'Ели стоят стеной вокруг поляны'],
    build() {
      const b = new Builder(121);
      b.ground(0, 0, 16, 16);
      b.each(0, -1, 0, 16, -1, 16, (x, y, z) => { if ((x - 8) ** 2 + (z - 8) ** 2 <= 20) b.set(x, y, z, 'moss_block', { env: 1 }); });
      const STONES = [['mossy_cobblestone', 3], ['tuff', 2], ['andesite', 1], ['cobblestone', 1]];
      const heights = [3, 2, 4, 2, 3, 2, 4, 3];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = Math.round(8 + Math.cos(a) * 6), z = Math.round(8 + Math.sin(a) * 6);
        b.fill(x, 0, z, x, heights[i] - 1, z, STONES);
        if (i === 2) b.set(x, 1, z, 'chiseled_stone_bricks');
      }
      b.fill(7, 0, 8, 9, 0, 8, 'tuff').set(7, 1, 8, 'stone_brick_slab').set(9, 1, 8, 'stone_brick_slab').set(8, 1, 8, 'decorated_pot');
      b.set(7, 0, 7, 'candle').set(9, 0, 9, 'candle').set(8, 0, 10, 'candle');
      b.set(8, -2, 8, 'chest');
      for (const [x, z] of [[1, 1], [15, 1], [1, 15], [15, 15], [8, 0], [0, 8], [16, 9], [8, 16]]) b.spruce(x, z, 10 + ((x + z) % 4));
      b.scatter(0, 0, 16, 16, ['fern', 'large_fern', 'red_mushroom'], 0.1);
      b.mark('secret', 8, 1, 14, 'Камень с руной', 'Резной камень. Руна повторяется в записках и указывает, где искать схрон.');
      b.mark('clue', 8, 1, 8, 'Чаша подношений', 'Расписной горшок на алтаре. Его можно разбить, внутри находка.');
      b.mark('slot', 8, -2, 8, 'Под алтарём', 'Глубокий слот, для финала цепочки.');
      return b;
    },
  });
})();
