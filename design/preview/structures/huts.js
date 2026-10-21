// Хижины лесника — частые постройки, главный «носитель» сюжетов биома.
(function () {
  const STONE = [['cobblestone', 3], ['mossy_cobblestone', 2]];

  // Хижина А: жилая, ухоженная, с подполом и огородом.
  defineStructure({
    id: 'hut_living',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Жилая',
    rarity: 'частая',
    biomes: 'тайга, снежная тайга',
    desc: 'Добротный сруб на каменном фундаменте. Крыльцо под свесом крыши, печь с коптильней, спальная антресоль. Рядом поленница под навесом, огород с ягодой и собачья будка. Хозяин будто ушёл утром на обход.',
    territory: ['Тропинка от крыльца уходит в лес', 'Поленница под навесом с восточной стены', 'Огород за забором: сладкие ягоды и компостер', 'Пень-колода, будка, ели вокруг'],
    build() {
      const b = new Builder(11);
      b.ground(0, 0, 16, 18);
      // Фундамент, пол, стены сруба
      b.walls(4, 0, 3, 10, 0, 11, STONE).fill(5, 0, 4, 9, 0, 10, 'spruce_planks');
      b.walls(4, 1, 3, 10, 3, 11, 'spruce_log').corners(4, 1, 3, 10, 3, 11, 'stripped_spruce_log');
      b.door(7, 1, 11, 's');
      for (const [x, z] of [[4, 6], [4, 8], [10, 6], [10, 8], [8, 3], [5, 11], [9, 11]]) b.set(x, 2, z, 'glass_pane', { f: x === 4 || x === 10 ? 'e' : 'n' });
      // Крыша с выносом над крыльцом
      b.gable(4, 3, 10, 11, 4, { axis: 'z' });
      for (const blk of [...b.blocks.values()]) if (blk.z === 12 && blk.y >= 4) b.set(blk.x, blk.y, 13, blk.id, { f: blk.f });
      b.set(7, 5, 3, 'glass_pane', { f: 'n' }).set(7, 5, 11, 'glass_pane', { f: 'n' });
      // Крыльцо
      b.fill(5, 0, 12, 9, 0, 13, 'spruce_slab', { h: 'top' });
      b.fill(5, 1, 13, 5, 3, 13, 'spruce_fence').fill(9, 1, 13, 9, 3, 13, 'spruce_fence');
      b.set(7, 0, 14, 'spruce_stairs', { f: 'n' });
      // Печь и дымоход
      b.fill(5, 1, 4, 5, 9, 4, STONE);
      b.set(6, 1, 4, 'furnace').set(5, 1, 5, 'smoker');
      // Обстановка первого этажа
      b.set(8, 1, 4, 'crafting_table').set(9, 1, 4, 'barrel');
      b.set(7, 1, 7, 'spruce_trapdoor', { h: 'top' });
      b.set(6, 1, 7, 'spruce_stairs', { f: 'w' }).set(8, 1, 7, 'spruce_stairs', { f: 'e' });
      b.fill(6, 1, 8, 8, 1, 9, 'brown_carpet');
      b.set(7, 3, 7, 'lantern');
      b.set(5, 1, 8, 'lectern', { f: 'e' });
      b.set(5, 2, 7, 'item_frame', { f: 'w' });
      b.set(9, 1, 9, 'barrel').set(9, 1, 10, 'chest');
      // Антресоль
      b.fill(6, 4, 4, 9, 4, 6, 'spruce_planks').fill(5, 4, 5, 5, 4, 6, 'spruce_planks');
      b.fill(9, 1, 7, 9, 4, 7, 'ladder', { f: 'e' });
      b.bed(7, 5, 4, 0, 1, 'brown_bed').set(8, 5, 4, 'barrel').set(6, 5, 5, 'candle');
      // Подпол: люк спрятан под бочкой
      b.walls(4, -4, 7, 8, -1, 11, STONE).fill(5, -4, 8, 7, -4, 10, 'cobblestone').clear(5, -3, 8, 7, -1, 10);
      b.set(5, 0, 10, 'spruce_trapdoor', { h: 'top' }).set(5, 1, 10, 'barrel');
      b.fill(5, -3, 10, 5, -1, 10, 'ladder', { f: 's' });
      b.set(7, -3, 9, 'barrel').set(7, -3, 10, 'hay_block').set(6, -3, 8, 'candle');
      // Двор
      b.fill(12, 0, 4, 12, 1, 9, 'spruce_log').fill(12, 2, 4, 13, 2, 9, 'spruce_slab');
      b.fill(13, 0, 4, 13, 1, 4, 'spruce_fence').fill(13, 0, 9, 13, 1, 9, 'spruce_fence');
      b.set(13, 0, 11, 'spruce_log');
      b.walls(12, 0, 12, 16, 0, 16, 'spruce_fence').set(14, 0, 12, 'spruce_fence_gate', { f: 'n' });
      b.fill(13, 0, 13, 15, 0, 15, 'sweet_berry_bush').set(16, 0, 17, 'composter');
      b.fill(1, 0, 5, 2, 1, 6, 'spruce_planks').clear(2, 0, 6, 2, 0, 6).fill(1, 2, 5, 2, 2, 6, 'spruce_slab');
      b.set(2, 0, 14, 'spruce_log').set(2, -1, 14, 'coarse_dirt');
      b.surface(7, 12, 7, 15, 'grass_path').surface(6, 16, 6, 18, 'grass_path').surface(8, 14, 12, 14, 'grass_path', 0.7);
      b.spruce(1, 1, 11).spruce(15, 1, 9).spruce(1, 17, 10).spruce(15, 18, 8).spruce(0, 10, 9);
      b.scatter(0, 0, 16, 18, ['fern', 'fern', 'large_fern', 'brown_mushroom', 'sweet_berry_bush'], 0.12);
      // Метки
      b.mark('secret', 5, 1, 10, 'Бочка на люке', 'Бочка стоит прямо на люке в полу. Сдвинь её — под ней лаз в подпол.');
      b.mark('slot', 5, -3, 8, 'Подпол', 'Сухой каменный погреб. Место для тайника с припасами или личными вещами.');
      b.mark('slot', 2, -2, 14, 'Под пнём', 'Под колодой у тропы закопан ящик. Подсказка в записке: «где колю дрова».');
      b.mark('clue', 5, 1, 8, 'Журнал лесника', 'Кафедра с журналом обходов: даты, приметы, странные записи.');
      b.mark('clue', 5, 2, 7, 'Карта участка', 'Рамка на стене. Здесь будет карта или рисунок с ориентирами.');
      b.mark('slot', 8, 5, 4, 'Бочка на антресоли', 'Запасной слот: личные вещи хозяина.');
      return b;
    },
  });

  // Хижина Б: заброшенная, с дырявой крышей и елью, проросшей сквозь пол.
  defineStructure({
    id: 'hut_abandoned',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Заброшенная',
    rarity: 'частая',
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Небольшой сруб 7×7, брошенный давно. Крыша провалилась, сквозь пол проросла ель, в углах паутина и мох. Дверь висит открытой. В пристройке остались дрова и точило.',
    territory: ['Тропа почти заросла', 'Остатки забора', 'Пристройка-дровник на столбах'],
    build() {
      const b = new Builder(23);
      b.ground(0, 0, 14, 14);
      b.walls(3, 0, 3, 9, 0, 9, STONE).fill(4, 0, 4, 8, 0, 8, 'spruce_planks');
      b.walls(3, 1, 3, 9, 3, 9, 'spruce_log').corners(3, 1, 3, 9, 3, 9, 'stripped_spruce_log');
      b.door(6, 1, 9, 's', 'spruce_door', true);
      b.clear(3, 2, 6, 3, 2, 6).clear(9, 2, 6, 9, 2, 6).clear(6, 2, 3, 6, 2, 3);
      b.gable(3, 3, 9, 9, 4, { axis: 'x' });
      // Печь: один замшелый камень среди чистого булыжника — фальш-кладка
      b.fill(4, 1, 4, 5, 3, 5, 'cobblestone').fill(4, 4, 4, 4, 7, 4, 'cobblestone');
      b.set(5, 1, 5, 'furnace').set(4, 1, 4, 'chest').set(4, 1, 5, 'mossy_cobblestone');
      // Скрипучая доска
      b.set(7, 0, 7, 'spruce_slab').set(7, -1, 7, 'chest');
      b.bed(8, 1, 4, 0, 1).set(6, 1, 7, 'spruce_trapdoor', { f: 'w', open: true });
      b.set(5, 1, 8, 'spruce_stairs', { f: 'n' }).set(8, 1, 8, 'barrel').set(8, 1, 7, 'barrel');
      b.set(8, 2, 6, 'item_frame', { f: 'e' });
      // Пристройка
      b.fill(12, 0, 4, 12, 2, 4, 'spruce_fence').fill(12, 0, 8, 12, 2, 8, 'spruce_fence');
      b.fill(10, 3, 4, 12, 3, 8, 'spruce_slab').fill(10, 0, 5, 11, 1, 7, 'spruce_log').set(11, 0, 4, 'grindstone');
      // Время
      b.decay({ spruce_stairs: null, spruce_slab: null, spruce_planks: null }, 0.3, [2, 4, 2, 10, 9, 10]);
      b.decay({ spruce_log: null }, 0.1, [3, 2, 3, 9, 3, 9]);
      b.decay({ cobblestone: 'mossy_cobblestone' }, 0.4, [3, 0, 3, 9, 0, 9]);
      b.decay({ spruce_slab: null }, 0.3, [10, 3, 4, 12, 3, 8]);
      b.clear(6, 4, 6, 7, 7, 7);
      b.spruce(6, 6, 7, 1);
      b.each(4, 1, 4, 8, 3, 8, (x, y, z) => {
        if (b.get(x, y, z)) return;
        if (y === 1 && b.chance(0.3)) b.set(x, y, z, 'moss_carpet');
        else if (y === 3 && b.chance(0.25)) b.set(x, y, z, 'cobweb');
      });
      for (let z = 4; z <= 8; z++) for (let y = 1; y <= 3; y++) if (b.chance(0.35)) b.set(2, y, z, 'vine', { f: 'e' });
      for (let x = 4; x <= 8; x++) for (let y = 1; y <= 3; y++) if (b.chance(0.3)) b.set(x, y, 2, 'vine', { f: 's' });
      for (const x of [1, 2, 4, 10, 11]) b.set(x, 0, 12, 'spruce_fence');
      b.surface(6, 10, 6, 14, 'grass_path', 0.45);
      b.spruce(1, 1, 10).spruce(12, 12, 9).spruce(1, 13, 11).spruce(13, 1, 8);
      b.scatter(0, 0, 14, 14, ['fern', 'large_fern', 'brown_mushroom', 'red_mushroom', 'deadbush'], 0.16);
      b.mark('secret', 4, 1, 5, 'Замшелый камень в печи', 'Печь сложена из чистого булыжника, и только этот камень зарос мхом. Если его выбить, откроется ниша.');
      b.mark('slot', 4, 1, 4, 'Ниша в печи', 'Замурованный сундук внутри печной кладки.');
      b.mark('slot', 7, -1, 7, 'Под скрипучей доской', 'Одна доска в полу ниже соседних: это плита, а не блок. Под ней ящик.');
      b.mark('clue', 8, 2, 6, 'Рамка над кроватью', 'Выцветшая записка или карта над кроватью.');
      return b;
    },
  });

  // Хижина В: сгоревшая. Уцелели печная труба и каменный погреб.
  defineStructure({
    id: 'hut_burned',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Сгоревшая',
    rarity: 'необычная',
    biomes: 'тайга',
    desc: 'На месте дома чёрный остов из обугленных брёвен. Высокая каменная труба торчит, как памятник. Пол засыпан золой, вход в погреб открыт. У края пепелища стоит крест, к нему кто-то до сих пор приносит цветы.',
    territory: ['Выжженное пятно: гравий и каменистая земля', 'Сухие ели рядом с пожарищем', 'Могильный крест с маком и свечой'],
    build() {
      const b = new Builder(37);
      b.ground(0, 0, 16, 16);
      b.surface(2, 1, 12, 13, [['coarse_dirt', 3], ['gravel', 2], ['podzol', 1]], 0.75);
      b.walls(4, 0, 3, 10, 0, 11, STONE).fill(5, 0, 4, 9, 0, 10, [['coarse_dirt', 2], ['gravel', 1]]);
      b.each(4, 1, 3, 10, 1, 11, (x, y, z, ax, bx, az, bz) => {
        if (!(x === ax || x === bx || z === az || z === bz) || (x === 7 && z === 11)) return;
        const h = Math.floor(b.r() * 3.4);
        for (let i = 0; i < h; i++) b.set(x, 1 + i, z, [['dark_oak_log', 4], ['coal_block', 1]]);
      });
      for (const [x, z, h] of [[4, 3, 4], [10, 3, 3], [4, 11, 2], [10, 11, 4]]) b.fill(x, 1, z, x, h, z, 'dark_oak_log');
      b.fill(5, 4, 3, 9, 4, 3, 'dark_oak_log').fill(5, 1, 9, 8, 1, 9, 'dark_oak_log');
      // Уцелевшая труба
      b.fill(6, 1, 2, 8, 3, 3, STONE).fill(7, 4, 2, 7, 10, 3, STONE);
      b.set(7, 1, 3, 'suspicious_gravel');
      b.each(5, 1, 4, 9, 1, 10, (x, y, z) => { if (!b.get(x, y, z) && b.chance(0.5)) b.set(x, y, z, 'light_gray_carpet'); });
      // Погреб, люк сгорел — открытый лаз
      b.walls(4, -4, 7, 8, -1, 11, [['mossy_stone_bricks', 1], ['stone_bricks', 1], ['cracked_stone_bricks', 1]]);
      b.fill(5, -4, 8, 7, -4, 10, 'cobblestone').clear(5, -3, 8, 7, -1, 10).clear(5, 0, 10, 5, 1, 10);
      b.fill(5, -3, 10, 5, 0, 10, 'ladder', { f: 's' });
      b.set(7, -3, 8, 'chest').set(6, -3, 10, 'candle').set(7, -3, 10, 'barrel');
      // Могила
      b.fill(13, 0, 14, 13, 2, 14, 'spruce_fence').set(12, 1, 14, 'spruce_fence').set(14, 1, 14, 'spruce_fence');
      b.surface(13, 15, 13, 16, 'coarse_dirt').set(12, 0, 15, 'poppy').set(14, 0, 15, 'candle');
      for (const [x, z] of [[2, 4], [2, 8], [12, 2], [12, 9], [3, 13]]) b.set(x, 0, z, 'dark_oak_log');
      b.spruce(2, 15, 8, 0, true).spruce(14, 4, 9, 0, true).spruce(1, 1, 11).spruce(15, 10, 10);
      b.scatter(0, 0, 16, 16, ['deadbush', 'fern'], 0.08);
      b.mark('slot', 7, 1, 3, 'Зола в очаге', 'Подозрительный гравий в топке. Расчищается кистью, внутри то, что хозяин успел спрятать в огне.');
      b.mark('slot', 7, -3, 8, 'Уцелевший сундук', 'Каменный погреб огонь не тронул.');
      b.mark('clue', 6, -3, 10, 'Свеча в погребе', 'Свеча кем-то зажжена после пожара. Место для записки.');
      b.mark('clue', 13, 1, 14, 'Крест у пепелища', 'Табличка с именем и датой. Цветы свежие, а значит, кто-то сюда ходит.');
      return b;
    },
  });

  // Хижина Г: двухэтажный дом картографа с потайной комнатой за книжным шкафом.
  defineStructure({
    id: 'hut_cartographer',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Дом картографа',
    rarity: 'редкая',
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Двухэтажный дом. Низ каменный, верх бревенчатый и нависает над низом. Внизу кухня и рабочая комната со столом картографа. Наверху кабинет: стена книжных полок скрывает узкую потайную комнату с картами.',
    territory: ['Огороженный двор с калиткой', 'Каменная труба на восточной стене', 'Скамья у крыльца и горшки с травами'],
    build() {
      const b = new Builder(41);
      b.ground(0, 0, 16, 16);
      const LOWER = [['cobblestone', 2], ['mossy_cobblestone', 2], ['stone_bricks', 1]];
      b.walls(3, 0, 3, 11, 3, 9, LOWER).fill(4, 0, 4, 10, 0, 8, 'spruce_planks');
      b.corners(3, 0, 3, 11, 3, 9, 'stone_bricks');
      b.fill(3, 4, 3, 11, 4, 9, 'spruce_planks');
      b.walls(3, 5, 3, 11, 7, 9, 'spruce_planks').corners(3, 5, 3, 11, 7, 9, 'spruce_log');
      b.fill(7, 5, 3, 7, 7, 3, 'stripped_spruce_log').fill(7, 5, 9, 7, 7, 9, 'stripped_spruce_log');
      b.walls(3, 4, 3, 11, 4, 9, 'stripped_spruce_log');
      b.gable(3, 3, 11, 9, 8, { axis: 'x' });
      b.door(7, 1, 9, 's').set(7, 0, 10, 'stone_brick_stairs', { f: 'n' });
      for (const [x, y, z] of [[5, 2, 9], [9, 2, 9], [3, 2, 6], [5, 6, 9], [9, 6, 9], [5, 6, 3], [3, 6, 6], [11, 6, 6], [3, 9, 6], [11, 9, 6]])
        b.set(x, y, z, 'glass_pane', { f: x === 3 || x === 11 ? 'e' : 'n' });
      b.fill(12, 0, 6, 12, 13, 6, STONE);
      // Первый этаж
      b.set(4, 1, 4, 'barrel').set(5, 1, 4, 'cartography_table').set(6, 1, 4, 'lectern', { f: 's' });
      b.set(10, 1, 6, 'furnace').set(10, 1, 5, 'smoker').set(10, 1, 8, 'barrel').set(10, 1, 4, 'crafting_table');
      b.set(7, 1, 6, 'spruce_trapdoor', { h: 'top' }).set(6, 1, 6, 'spruce_stairs', { f: 'w' }).set(8, 1, 6, 'spruce_stairs', { f: 'e' });
      b.set(7, 3, 6, 'lantern');
      // Лестница наверх вдоль западной стены
      b.clear(4, 4, 6, 4, 4, 8);
      b.set(4, 1, 8, 'spruce_stairs', { f: 'n' }).set(4, 2, 7, 'spruce_stairs', { f: 'n' }).set(4, 3, 6, 'spruce_stairs', { f: 'n' }).set(4, 4, 5, 'spruce_stairs', { f: 'n' });
      // Второй этаж: кабинет
      b.bed(5, 5, 4, 1, 0, 'brown_bed');
      b.set(7, 5, 4, 'spruce_trapdoor', { h: 'top' }).set(7, 5, 5, 'spruce_stairs', { f: 's' });
      b.set(5, 5, 8, 'bookshelf').set(6, 5, 8, 'bookshelf').set(8, 5, 8, 'chest');
      b.fill(6, 5, 6, 8, 5, 7, 'green_carpet');
      b.set(7, 7, 6, 'lantern');
      // Потайная комната за стеной полок
      b.fill(9, 5, 4, 9, 6, 8, 'bookshelf').fill(9, 7, 4, 9, 7, 8, 'spruce_planks');
      b.set(9, 5, 5, 'chiseled_bookshelf');
      b.set(10, 5, 4, 'chest').set(10, 5, 8, 'barrel').set(10, 6, 6, 'item_frame', { f: 'e' }).set(10, 5, 6, 'candle');
      // Двор
      b.walls(1, 0, 11, 13, 0, 15, 'spruce_fence').clear(7, 0, 15, 7, 0, 15).set(7, 0, 15, 'spruce_fence_gate', { f: 'n' });
      b.clear(1, 0, 11, 13, 0, 11);
      b.set(10, 0, 12, 'spruce_stairs', { f: 'n' }).set(11, 0, 12, 'spruce_stairs', { f: 'n' });
      b.set(5, 0, 10, 'flower_pot').set(9, 0, 10, 'flower_pot').set(8, 3, 10, 'spruce_hanging_sign', { f: 'n' });
      b.fill(2, 0, 12, 4, 0, 14, 'sweet_berry_bush');
      b.surface(7, 10, 7, 16, 'grass_path');
      b.spruce(1, 1, 12).spruce(14, 2, 10).spruce(15, 14, 9).spruce(0, 8, 9);
      b.scatter(0, 0, 16, 16, ['fern', 'large_fern', 'brown_mushroom'], 0.1);
      b.mark('secret', 9, 5, 5, 'Резная полка-замок', 'В резной полке не хватает одной книги. Поставь нужную книгу, и часть стены отъедет.');
      b.mark('slot', 10, 5, 4, 'Потайная комната', 'Узкий чулан за полками. Снаружи у него есть окно, а изнутри дома комнаты не видно. Внимательный игрок это заметит.');
      b.mark('clue', 10, 6, 6, 'Карта на стене чулана', 'Большая карта округи с пометками. Ведёт к внешнему схрону.');
      b.mark('clue', 6, 1, 4, 'Полевой журнал', 'Кафедра у стола картографа: замеры, наброски, недописанная глава.');
      b.mark('slot', 8, 5, 8, 'Сундук в кабинете', 'Открытый слот: обычный лут или часть сюжетной цепочки.');
      return b;
    },
  });
})();
