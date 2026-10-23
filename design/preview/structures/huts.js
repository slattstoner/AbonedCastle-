// Хижины лесника — частые постройки, главный «носитель» сюжетов биома.
// Слоты (slot) — контейнеры и места для записок; что в них лежит, решает история.
// Якоря (anchor) — точки на краю двора, откуда тропа ведёт к дальнему тайнику.
(function () {
  const STONE = [['cobblestone', 3], ['mossy_cobblestone', 2]];

  // Хижина А: жилая. Дом на каменном подклете, курятник, огород, дровник.
  defineStructure({
    id: 'hut_living',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Жилая',
    rarity: 'частая',
    set: 'common',
    weight: 3,
    biomes: 'тайга, снежная тайга',
    desc: 'Сруб на высоком каменном подклете с крыльцом и печной трубой, из которой идёт дым. Внутри кухня, стол, кафедра с журналом обходов и спальная антресоль. Во дворе дровник, будка, курятник с выгулом, огород с картошкой и морковью, пугало, улей и пень-колода.',
    territory: ['Двор 23×23, вокруг дома отмостка из гравия: деревья не вырастут вплотную к стенам', 'Курятник с огороженным выгулом', 'Огород: грядки, канавка с водой, пугало', 'Четыре тропы со двора: к дальнему тайнику ведёт одна из них'],
    build() {
      const b = new Builder(11);
      b.ground(0, 0, 22, 22);
      b.surface(4, 3, 14, 16, [['gravel', 2], ['coarse_dirt', 2], ['grass_path', 1]]);
      // Подклет и сруб
      b.walls(6, 0, 5, 12, 1, 13, STONE).surface(7, 6, 11, 12, 'coarse_dirt');
      b.set(6, 1, 9, 'iron_bars').set(12, 1, 9, 'iron_bars');
      b.fill(7, 2, 6, 11, 2, 12, 'spruce_planks');
      b.logRing(6, 2, 5, 12, 5, 13);
      b.door(9, 3, 13, 's');
      for (const [x, z] of [[6, 8], [6, 10], [12, 8], [12, 10], [10, 5], [7, 13], [11, 13]]) b.set(x, 4, z, 'glass_pane');
      b.gable(6, 5, 12, 13, 6, { axis: 'z' });
      for (const blk of [...b.blocks.values()]) if (blk.z === 14 && blk.y >= 6) b.set(blk.x, blk.y, 15, blk.id, { f: blk.f, h: blk.h });
      b.set(9, 7, 5, 'glass_pane').set(9, 7, 13, 'glass_pane');
      // Крыльцо со ступенями
      b.fill(8, 2, 14, 10, 2, 15, 'spruce_slab', { h: 'top' }).fill(8, 0, 14, 10, 1, 15, STONE);
      b.fill(8, 3, 15, 8, 5, 15, 'spruce_fence').fill(10, 3, 15, 10, 5, 15, 'spruce_fence');
      // Навес над крыльцом: лежит на столбах, края скошены ступенями
      b.fill(7, 6, 14, 11, 6, 15, 'spruce_slab').fill(7, 6, 16, 11, 6, 16, 'spruce_stairs', { f: 'n' });
      b.fill(7, 6, 14, 7, 6, 15, 'spruce_stairs', { f: 'e' }).fill(11, 6, 14, 11, 6, 15, 'spruce_stairs', { f: 'w' });
      b.set(9, 5, 15, 'lantern', { hang: 1 });
      // Три ступени до пола крыльца, без зазора
      b.fill(9, 0, 16, 9, 1, 16, 'cobblestone').set(9, 2, 16, 'spruce_stairs', { f: 'n' });
      b.set(9, 0, 17, 'cobblestone').set(9, 1, 17, 'spruce_stairs', { f: 'n' }).set(9, 0, 18, 'spruce_stairs', { f: 'n' });
      // Печь, труба с дымком
      b.fill(7, 0, 6, 7, 11, 6, STONE).set(7, 12, 6, 'campfire');
      b.set(8, 3, 6, 'furnace', { f: 's' }).set(7, 3, 7, 'smoker', { f: 'e' });
      // Горница
      b.set(10, 3, 6, 'crafting_table').set(11, 3, 6, 'barrel', { slot: 'pantry', theme: 'kitchen' });
      b.set(9, 3, 9, 'spruce_trapdoor', { h: 'top' }).set(8, 3, 9, 'spruce_stairs', { f: 'w' }).set(10, 3, 9, 'spruce_stairs', { f: 'e' });
      b.fill(8, 3, 10, 10, 3, 11, 'brown_carpet');
      b.set(7, 3, 10, 'lectern', { f: 'e', slot: 'journal' });
      b.set(7, 4, 9, 'item_frame', { f: 'w', slot: 'frame_map' });
      b.set(11, 3, 11, 'chest', { f: 'w', slot: 'chest_main', theme: 'forester' });
      b.fill(9, 6, 9, 9, 9, 9, 'iron_chain').set(9, 5, 9, 'lantern', { hang: 1 });
      // Люк в подклет под бочкой
      b.set(10, 2, 12, 'spruce_trapdoor', { h: 'top' }).set(10, 3, 12, 'barrel', { slot: 'hatch_barrel', theme: 'pantry' });
      b.fill(10, 0, 12, 10, 1, 12, 'ladder', { f: 's' });
      b.set(8, 0, 7, 'barrel', { theme: 'pantry' }).set(9, 0, 7, 'barrel', { theme: 'pantry' }).set(11, 0, 7, 'hay_block');
      b.set(7, 0, 12, 'chest', { f: 'e', slot: 'podklet' }).set(9, 0, 10, 'candle');
      // Антресоль
      // Антресоль. Лаз посередине у задней стены: у боковых стен мешает скат крыши.
      b.fill(8, 6, 6, 11, 6, 8, 'spruce_planks');
      b.fill(9, 3, 6, 9, 6, 6, 'ladder', { f: 'n' });
      b.bed(8, 7, 8, 0, -1, 'brown_bed').set(10, 7, 6, 'barrel', { slot: 'loft' }).set(10, 8, 6, 'candle', { lit: 1 });
      // Дровник
      b.fill(15, 0, 6, 16, 1, 11, 'spruce_log', { a: 'z' }).fill(14, 2, 5, 17, 2, 12, 'spruce_slab');
      b.fill(17, 0, 5, 17, 1, 5, 'spruce_fence').fill(17, 0, 12, 17, 1, 12, 'spruce_fence').fill(14, 0, 5, 14, 1, 5, 'spruce_fence').fill(14, 0, 12, 14, 1, 12, 'spruce_fence');
      b.set(16, 0, 14, 'stripped_spruce_log');
      // Будка
      b.fill(2, 0, 6, 3, 1, 7, 'spruce_planks').clear(3, 0, 7, 3, 0, 7).fill(2, 2, 6, 3, 2, 7, 'spruce_slab');
      // Курятник и выгул
      b.walls(1, 0, 11, 4, 1, 14, 'spruce_planks').corners(1, 0, 11, 4, 1, 14, 'spruce_log').clear(3, 0, 14, 3, 1, 14);
      b.gable(1, 11, 4, 14, 2, { axis: 'x', over: 0, fill: null });
      b.set(2, 0, 12, 'hay_block').set(3, 0, 12, 'barrel', { slot: 'coop', theme: 'coop' }).set(2, 0, 13, 'composter');
      b.walls(1, 0, 15, 6, 0, 19, 'spruce_fence').clear(3, 0, 15, 3, 0, 15).set(6, 0, 17, 'spruce_fence_gate', { f: 'e' });
      b.set(5, 0, 18, 'hay_block').surface(2, 16, 5, 18, 'coarse_dirt', 0.6);
      // Огород
      b.walls(14, 0, 15, 20, 0, 21, 'spruce_fence').set(17, 0, 15, 'spruce_fence_gate', { f: 'n' });
      b.crops(15, 16, 19, 16, 'potatoes').crops(15, 17, 19, 17, 'carrots').crops(15, 19, 19, 19, 'beetroot').crops(15, 20, 18, 20, 'potatoes');
      b.surface(15, 18, 19, 18, 'water');
      b.set(19, 0, 20, 'spruce_fence').set(19, 1, 20, 'hay_block').set(19, 2, 20, 'carved_pumpkin', { f: 'n' });
      b.fill(13, 0, 17, 13, 0, 20, 'sweet_berry_bush');
      // Улей, пень с тайником, тропы
      b.set(20, 0, 4, 'beehive', { f: 's' }).set(19, 0, 3, 'poppy').set(21, 0, 5, 'poppy');
      b.set(3, 0, 3, 'spruce_log').set(3, -1, 3, 'chest', { slot: 'under_stump', f: 's' });
      b.surface(9, 17, 9, 21, 'grass_path').surface(10, 14, 17, 14, 'grass_path', 0.8).surface(7, 17, 8, 17, 'grass_path');
      b.surface(9, 1, 9, 2, 'grass_path', 0.6).surface(18, 9, 21, 9, 'grass_path', 0.6).surface(1, 9, 3, 9, 'grass_path', 0.6);
      b.anchor('front', 9, 22, 's').anchor('back', 9, 0, 'n').anchor('east', 22, 9, 'e').anchor('west', 0, 9, 'w');
      b.spruce(1, 1, 11).spruce(21, 1, 9).spruce(1, 21, 10).spruce(22, 21, 8).spruce(0, 3, 9);
      b.scatter(0, 0, 22, 22, ['fern', 'large_fern', 'short_grass', 'sweet_berry_bush'], 0.1);
      b.mark('secret', 10, 3, 12, 'Бочка на люке', 'Тяжёлая бочка стоит прямо на люке в полу. Под ней лаз в подклет.');
      b.mark('slot', 7, 0, 12, 'Подклет', 'Каменный подклет под домом: припасы, сено и сундук.');
      b.mark('clue', 7, 3, 10, 'Журнал обходов', 'Кафедра с журналом лесника.');
      b.mark('clue', 7, 4, 9, 'Рамка на стене', 'Рамка с запиской или картой.');
      b.mark('slot', 3, 0, 12, 'Гнездо в курятнике', 'Бочка-гнездо между соломой.');
      b.mark('slot', 3, -1, 3, 'Под пнём', 'Сундук закопан под колодой в углу двора.');
      b.mark('slot', 10, 7, 6, 'Бочка на антресоли', 'Личные вещи хозяина.');
      return b;
    },
  });

  // Хижина Б: заброшенная изба с лабазом на столбах.
  defineStructure({
    id: 'hut_abandoned',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Заброшенная',
    rarity: 'частая',
    set: 'common',
    weight: 3,
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Сруб 7×7, брошенный давно. Крыша провалилась, сквозь пол проросла ель, дверь распахнута. Рядом дровник и лабаз: маленький амбар на столбах, куда таёжники прятали припасы от зверя. От забора остались отдельные столбики.',
    territory: ['Лабаз на трёх столбах с лестницей', 'Дровник с точилом', 'Тропа почти заросла'],
    build() {
      const b = new Builder(23);
      b.ground(0, 0, 18, 18);
      b.walls(1, 0, 1, 17, 0, 17, 'spruce_fence').decay({ spruce_fence: null }, 0.55);
      b.clear(8, 0, 17, 8, 0, 17);
      b.walls(5, 0, 5, 11, 0, 11, STONE).fill(6, 0, 6, 10, 0, 10, 'spruce_planks');
      b.logRing(5, 1, 5, 11, 3, 11);
      b.door(8, 1, 11, 's', 'spruce_door', true);
      b.clear(5, 2, 8, 5, 2, 8).clear(11, 2, 8, 11, 2, 8).clear(8, 2, 5, 8, 2, 5);
      b.gable(5, 5, 11, 11, 4, { axis: 'x' });
      // Печь с фальш-камнем
      b.fill(6, 1, 6, 7, 3, 7, 'cobblestone').fill(6, 4, 6, 6, 8, 6, 'cobblestone');
      b.set(7, 1, 7, 'furnace', { f: 's' }).set(6, 1, 6, 'chest', { slot: 'stove', f: 's' }).set(6, 1, 7, 'mossy_cobblestone');
      // Скрипучая доска
      b.set(9, 0, 9, 'spruce_slab').set(9, -1, 9, 'chest', { slot: 'floorboard', f: 'n' });
      b.bed(10, 1, 7, 0, -1).set(8, 1, 8, 'spruce_trapdoor', { open: true, f: 'w' }).set(7, 1, 9, 'spruce_stairs', { f: 'n' });
      b.set(10, 1, 10, 'barrel', { theme: 'junk' }).set(10, 1, 9, 'barrel', { theme: 'junk' });
      b.set(10, 2, 7, 'item_frame', { f: 'e', slot: 'frame' });
      // Дровник
      b.fill(14, 0, 6, 14, 2, 6, 'spruce_fence').fill(14, 0, 10, 14, 2, 10, 'spruce_fence');
      b.fill(12, 3, 6, 14, 3, 10, 'spruce_slab').fill(12, 0, 7, 13, 1, 9, 'spruce_log', { a: 'z' });
      b.set(13, 0, 6, 'grindstone').set(12, 0, 10, 'barrel', { slot: 'shed', theme: 'junk' });
      // Лабаз
      for (const [x, z] of [[1, 12], [4, 12], [1, 15], [4, 15], [3, 15]]) b.fill(x, 0, z, x, 2, z, 'spruce_log');
      b.fill(1, 3, 12, 4, 3, 15, 'spruce_planks').walls(1, 4, 12, 4, 5, 15, 'spruce_planks').clear(3, 4, 15, 3, 5, 15);
      b.gable(1, 12, 4, 15, 6, { axis: 'x', fill: 'spruce_planks' });
      b.fill(3, 0, 16, 3, 3, 16, 'ladder', { f: 'n' });
      b.set(3, 4, 13, 'chest', { slot: 'labaz', f: 's' }).set(2, 4, 13, 'barrel', { theme: 'pantry' });
      // Время: провалы крыши, мох, паутина, лоза, ель сквозь пол
      b.decay({ spruce_stairs: null, spruce_slab: null, spruce_planks: null }, 0.3, [4, 4, 4, 12, 10, 12]);
      b.decay({ spruce_log: null }, 0.08, [5, 2, 5, 11, 3, 11]);
      b.decay({ cobblestone: 'mossy_cobblestone' }, 0.4, [5, 0, 5, 11, 0, 11]);
      b.decay({ spruce_slab: null }, 0.3, [12, 3, 6, 14, 3, 10]);
      b.set(6, 1, 7, 'mossy_cobblestone').set(6, 2, 7, 'cobblestone').set(6, 1, 6, 'chest', { slot: 'stove', f: 's' });
      b.clear(7, 4, 6, 9, 8, 8).set(8, 0, 7, 'moss_block');
      b.spruce(8, 7, 7, 1, false, true);
      b.each(6, 1, 6, 10, 3, 10, (x, y, z) => {
        if (b.get(x, y, z)) return;
        if (y === 1 && b.chance(0.3)) b.set(x, y, z, 'moss_carpet');
        else if (y === 3 && b.chance(0.2)) b.set(x, y, z, 'cobweb');
      });
      for (let z = 6; z <= 10; z++) for (let y = 1; y <= 3; y++) if (b.get(5, y, z) && b.chance(0.35)) b.set(4, y, z, 'vine', { f: 'e' });
      for (let x = 6; x <= 10; x++) for (let y = 1; y <= 3; y++) if (b.get(x, y, 5) && b.chance(0.3)) b.set(x, y, 4, 'vine', { f: 's' });
      b.surface(8, 12, 8, 18, 'grass_path', 0.45).surface(8, 0, 8, 4, 'grass_path', 0.4);
      b.anchor('front', 8, 18, 's').anchor('back', 8, 0, 'n').anchor('west', 0, 9, 'w');
      b.spruce(1, 1, 10).spruce(17, 15, 9).spruce(17, 1, 8).spruce(0, 6, 11);
      b.scatter(0, 0, 18, 18, ['fern', 'large_fern', 'brown_mushroom', 'red_mushroom', 'short_grass'], 0.16);
      b.mark('secret', 6, 1, 7, 'Замшелый камень в печи', 'Печь из чистого булыжника, и только этот камень зарос мхом. Выбей его, за ним ниша.');
      b.mark('slot', 6, 1, 6, 'Ниша в печи', 'Замурованный сундук внутри кладки.');
      b.mark('slot', 9, -1, 9, 'Под скрипучей доской', 'Одна половица ниже остальных: это плита. Под ней ящик.');
      b.mark('clue', 10, 2, 7, 'Рамка над кроватью', 'Выцветшая записка в рамке.');
      b.mark('slot', 3, 4, 13, 'Лабаз', 'Сундук в амбарчике на столбах.');
      return b;
    },
  });

  // Хижина В: пепелище. Уцелели труба, земляной погреб-погребица и могила.
  defineStructure({
    id: 'hut_burned',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Пепелище',
    rarity: 'необычная',
    set: 'common',
    weight: 2,
    biomes: 'тайга',
    desc: 'На месте дома обугленный остов и высокая каменная труба. Пол засыпан золой. Рядом уцелела погребица: земляной холм с каменной дверью, огонь её не взял. У края пепелища могила с крестом и свежими цветами.',
    territory: ['Выжженное пятно: гравий, каменистая земля, зола', 'Две сухие ели-скелета', 'Погребица в земляном холме', 'Могила с табличкой'],
    build() {
      const b = new Builder(37);
      b.ground(0, 0, 20, 18);
      b.surface(3, 2, 13, 14, [['coarse_dirt', 3], ['gravel', 2], ['podzol', 1]], 0.8);
      b.walls(5, 0, 4, 11, 0, 12, STONE).fill(6, 0, 5, 10, 0, 11, [['coarse_dirt', 2], ['gravel', 1]]);
      b.each(5, 1, 4, 11, 1, 12, (x, y, z, ax, bx, az, bz) => {
        const ex = x === ax || x === bx, ez = z === az || z === bz;
        if (!(ex || ez) || (x === 8 && z === 12)) return;
        const h = Math.floor(b.r() * 3.4);
        for (let i = 0; i < h; i++) b.set(x, 1 + i, z, [['dark_oak_log', 4], ['coal_block', 1]], { a: ez ? 'x' : 'z' });
      });
      for (const [x, z, h] of [[5, 4, 4], [11, 4, 3], [5, 12, 2], [11, 12, 4]]) b.fill(x, 1, z, x, h, z, 'dark_oak_log');
      b.fill(6, 4, 4, 10, 4, 4, 'dark_oak_log', { a: 'x' }).fill(6, 1, 10, 9, 1, 10, 'dark_oak_log', { a: 'x' });
      // Труба и очаг с золой
      b.fill(7, 1, 3, 9, 3, 4, STONE).fill(8, 4, 3, 8, 10, 4, STONE);
      b.set(8, 1, 4, 'suspicious_gravel', { slot: 'ash' });
      b.each(6, 1, 5, 10, 1, 11, (x, y, z) => { if (!b.get(x, y, z) && b.chance(0.5)) b.set(x, y, z, 'light_gray_carpet'); });
      b.set(10, 1, 6, 'barrel', { slot: 'ruins', f: 'w' });
      // Погребица
      b.walls(14, 0, 3, 18, 1, 8, [['stone_bricks', 2], ['mossy_stone_bricks', 2], ['cracked_stone_bricks', 1]]);
      b.surface(15, 4, 17, 7, 'coarse_dirt');
      b.fill(14, 2, 3, 18, 2, 8, 'dirt').fill(15, 3, 4, 17, 3, 7, [['grass_block', 3], ['moss_block', 1]]);
      b.each(14, 2, 3, 18, 2, 8, (x, y, z, ax, bx, az, bz) => { if (x === ax || x === bx || z === az || z === bz) b.set(x, y, z, [['grass_block', 2], ['podzol', 1]]); });
      b.door(16, 0, 8, 's').set(16, 2, 8, 'stone_bricks');
      b.set(15, 0, 4, 'chest', { slot: 'pogreb', f: 'e' }).set(17, 0, 4, 'barrel', { theme: 'pantry' }).set(17, 0, 5, 'barrel', { theme: 'pantry' }).set(16, 0, 4, 'candle', { lit: 1 });
      // Могила
      b.surface(13, 14, 13, 15, 'coarse_dirt');
      b.fill(13, 0, 13, 13, 2, 13, 'spruce_fence').set(12, 1, 13, 'spruce_fence').set(14, 1, 13, 'spruce_fence');
      b.set(13, 0, 16, 'spruce_sign', { stand: 0, slot: 'grave_sign' });
      b.set(12, 0, 15, 'poppy').set(14, 0, 15, 'poppy').set(14, 0, 14, 'candle', { lit: 1 });
      for (const [x, z] of [[3, 5], [3, 9], [13, 2], [12, 10], [4, 14]]) b.set(x, 0, z, 'dark_oak_log');
      b.spruce(2, 15, 7, 0, true, true).spruce(19, 13, 9, 0, true, true);
      b.surface(8, 13, 8, 18, 'grass_path', 0.5).surface(15, 9, 16, 12, 'grass_path', 0.6);
      b.anchor('front', 8, 18, 's').anchor('back', 8, 0, 'n').anchor('side', 20, 11, 'e');
      b.spruce(1, 1, 11).spruce(19, 1, 10);
      b.scatter(0, 0, 20, 18, ['deadbush', 'fern'], 0.08);
      b.mark('slot', 8, 1, 4, 'Зола в очаге', 'Подозрительный гравий в топке. Расчищается кистью.');
      b.mark('slot', 15, 0, 4, 'Погребица', 'Земляной погреб уцелел. Внутри сундук и горящая свеча.');
      b.mark('clue', 13, 0, 16, 'Табличка на могиле', 'Надпись на табличке у креста.');
      b.mark('slot', 10, 1, 6, 'Бочка в руинах', 'Полуобгоревшая бочка в углу дома.');
      return b;
    },
  });

  // Хижина Г: двухэтажный дом картографа с потайным чуланом.
  defineStructure({
    id: 'hut_cartographer',
    group: 'Хижины лесника',
    name: 'Хижина лесника · Дом картографа',
    rarity: 'редкая',
    set: 'rare',
    weight: 2,
    biomes: 'тайга, старовозрастная тайга',
    desc: 'Двухэтажный дом: низ каменный, верх бревенчатый. Внизу кухня и рабочий стол картографа. Наверху кабинет, а стена книжных полок скрывает узкий чулан. Снаружи у чулана есть окно, а изнутри его не видно. Перед домом палисадник с грядками, почтовый ящик у калитки и межевой столб.',
    territory: ['Палисадник с калиткой, скамья, грядки с канавкой', 'Почтовый ящик на столбе у дороги', 'Межевой столб с фонарём', 'Труба с дымком'],
    build() {
      const b = new Builder(41);
      b.ground(0, 0, 22, 20);
      b.surface(4, 2, 16, 12, [['gravel', 2], ['coarse_dirt', 1]]);
      const LOWER = [['cobblestone', 2], ['mossy_cobblestone', 2], ['stone_bricks', 1]];
      b.walls(6, 0, 4, 14, 3, 10, LOWER).fill(7, 0, 5, 13, 0, 9, 'spruce_planks').corners(6, 0, 4, 14, 3, 10, 'stone_bricks');
      b.fill(6, 4, 4, 14, 4, 10, 'spruce_planks').logRing(6, 4, 4, 14, 4, 10, 'stripped_spruce_log', 'spruce_log');
      b.walls(6, 5, 4, 14, 7, 10, 'spruce_planks').corners(6, 5, 4, 14, 7, 10, 'spruce_log');
      b.fill(10, 5, 4, 10, 7, 4, 'stripped_spruce_log').fill(10, 5, 10, 10, 7, 10, 'stripped_spruce_log');
      b.gable(6, 4, 14, 10, 8, { axis: 'x' });
      b.door(10, 1, 10, 's').set(10, 0, 11, 'stone_brick_stairs', { f: 'n' });
      for (const [x, y, z] of [[8, 2, 10], [12, 2, 10], [6, 2, 7], [14, 2, 6], [8, 6, 10], [12, 6, 10], [8, 6, 4], [6, 6, 7], [14, 6, 8], [6, 9, 7], [14, 9, 7]]) b.set(x, y, z, 'glass_pane');
      b.fill(15, 0, 7, 15, 13, 7, STONE).set(15, 14, 7, 'campfire');
      // Первый этаж
      b.set(7, 1, 5, 'barrel', { theme: 'cartographer' }).set(8, 1, 5, 'cartography_table').set(9, 1, 5, 'lectern', { f: 's', slot: 'field_journal' });
      b.set(13, 1, 7, 'furnace', { f: 'w' }).set(13, 1, 6, 'smoker', { f: 'w' }).set(13, 1, 5, 'crafting_table').set(13, 1, 9, 'barrel', { theme: 'kitchen' });
      b.set(10, 1, 7, 'spruce_trapdoor', { h: 'top' }).set(9, 1, 7, 'spruce_stairs', { f: 'w' }).set(11, 1, 7, 'spruce_stairs', { f: 'e' });
      b.set(10, 3, 7, 'lantern', { hang: 1 }).set(12, 1, 9, 'chest', { f: 'w', slot: 'desk', theme: 'cartographer' });
      b.clear(7, 4, 7, 7, 4, 9);
      b.set(7, 1, 9, 'spruce_stairs', { f: 'n' }).set(7, 2, 8, 'spruce_stairs', { f: 'n' }).set(7, 3, 7, 'spruce_stairs', { f: 'n' }).set(7, 4, 6, 'spruce_stairs', { f: 'n' });
      // Второй этаж: кабинет
      b.bed(9, 5, 5, -1, 0, 'brown_bed');
      b.set(10, 5, 5, 'spruce_trapdoor', { h: 'top' }).set(10, 5, 6, 'spruce_stairs', { f: 's' });
      b.set(8, 5, 9, 'bookshelf').set(9, 5, 9, 'bookshelf').set(8, 6, 9, 'lantern').set(11, 5, 9, 'chest', { f: 'n', slot: 'study', theme: 'cartographer' });
      b.fill(9, 5, 7, 11, 5, 8, 'green_carpet');
      // Стена полок и чулан
      b.fill(12, 5, 5, 12, 6, 9, 'bookshelf').fill(12, 7, 5, 12, 7, 9, 'spruce_planks');
      b.set(12, 5, 7, 'chiseled_bookshelf', { f: 'w', books: 59 });
      b.set(13, 5, 5, 'chest', { f: 's', slot: 'closet' }).set(13, 6, 6, 'item_frame', { f: 'e', slot: 'closet_frame' });
      b.set(13, 5, 9, 'barrel', { theme: 'cartographer' }).set(13, 5, 8, 'candle');
      // Палисадник
      b.walls(2, 0, 12, 18, 0, 18, 'spruce_fence').clear(2, 0, 12, 18, 0, 12).set(10, 0, 18, 'spruce_fence_gate', { f: 'n' });
      b.crops(3, 14, 8, 14, 'carrots').surface(3, 15, 8, 15, 'water').crops(3, 16, 8, 16, 'beetroot');
      b.set(14, 0, 13, 'spruce_stairs', { f: 'n' }).set(15, 0, 13, 'spruce_stairs', { f: 'n' });
      b.set(9, 0, 11, 'flower_pot', { plant: 'fern' }).set(11, 0, 11, 'flower_pot', { plant: 'red_mushroom' });
      b.fill(12, 0, 19, 12, 0, 19, 'spruce_fence').set(12, 1, 19, 'barrel', { f: 's', slot: 'mailbox' });
      b.set(19, 0, 14, 'stone_brick_wall').set(19, 1, 14, 'lantern');
      b.fill(14, 0, 15, 17, 0, 17, 'sweet_berry_bush');
      b.surface(10, 11, 10, 20, 'grass_path').surface(1, 15, 2, 15, 'grass_path', 0.6).surface(10, 1, 10, 3, 'grass_path', 0.6);
      b.anchor('back', 10, 0, 'n').anchor('garden', 0, 15, 'w').anchor('east', 22, 10, 'e');
      b.spruce(1, 1, 12).spruce(20, 2, 10).spruce(21, 18, 9).spruce(0, 8, 9);
      b.scatter(0, 0, 22, 20, ['fern', 'large_fern', 'short_grass'], 0.08);
      b.mark('secret', 12, 5, 7, 'Резная полка', 'Единственная резная полка в стене, и в ней не хватает книги. Сломай её: за ней проход в чулан.');
      b.mark('slot', 13, 5, 5, 'Чулан', 'Узкий чулан за полками. Снаружи у него есть окно.');
      b.mark('clue', 13, 6, 6, 'Рамка в чулане', 'Главная записка картографа.');
      b.mark('clue', 9, 1, 5, 'Полевой журнал', 'Кафедра у стола картографа.');
      b.mark('slot', 12, 1, 19, 'Почтовый ящик', 'Бочка на столбе у калитки. Письма, которые никто не забрал.');
      return b;
    },
  });
})();
