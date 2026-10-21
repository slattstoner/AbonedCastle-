// Средние постройки — встречаются раз в несколько сотен блоков.
(function () {
  const STONE = [['cobblestone', 3], ['mossy_cobblestone', 2]];

  // Сруб на каменном цоколе: цоколь и пол на y = 0, стены 1..h, крыша над ними.
  function cabin(b, x1, z1, x2, z2, h, axis) {
    b.walls(x1, 0, z1, x2, 0, z2, STONE).fill(x1 + 1, 0, z1 + 1, x2 - 1, 0, z2 - 1, 'spruce_planks');
    b.logRing(x1, 1, z1, x2, h, z2);
    b.gable(x1, z1, x2, z2, h + 1, { axis });
  }

  defineStructure({
    id: 'farmstead',
    group: 'Средние постройки',
    name: 'Лесной хутор',
    rarity: 'необычная',
    set: 'rare',
    weight: 3,
    biomes: 'тайга, снежная тайга',
    states: [
      { id: 'living', label: 'Жилой' },
      { id: 'empty', label: 'Опустевший' },
      { id: 'overgrown', label: 'Заросший' },
    ],
    desc: 'Изба с русской печью, курятник с выгулом, банька, амбар с сеновалом, колодец под навесом, загон и огород с пугалом. Одна планировка генерируется в трёх состояниях. Жилой: из труб идёт дым. Опустевший: печи холодные, двери настежь, на столе нетронутый пирог. Заросший: крыши провалились, во дворе выросли ели.',
    territory: ['Двор 31×29, тропы между постройками', 'Огород: картофель, морковь, свёкла, тыквы, канавка', 'Загон с поилкой', 'Колодец с нишей у дна'],
    build(state = 'living') {
      const b = new Builder(131);
      const fires = [];
      b.ground(0, 0, 30, 28);
      // Изба
      cabin(b, 3, 3, 10, 9, 3, 'x');
      b.door(6, 1, 9, 's').set(6, 0, 10, 'spruce_stairs', { f: 'n' });
      for (const [x, z] of [[4, 9], [9, 9], [3, 6], [10, 6], [8, 3]]) b.set(x, 2, z, 'glass_pane');
      b.fill(8, 1, 4, 9, 2, 5, 'cobblestone').fill(9, 3, 4, 9, 9, 4, STONE).set(8, 1, 5, 'furnace', { f: 's' });
      b.set(9, 10, 4, 'campfire'); fires.push([9, 10, 4]);
      b.set(5, 1, 6, 'spruce_trapdoor', { h: 'top' }).set(6, 1, 6, 'spruce_trapdoor', { h: 'top' });
      for (const x of [5, 6]) b.set(x, 1, 5, 'spruce_stairs', { f: 'n' }).set(x, 1, 7, 'spruce_stairs', { f: 's' });
      b.bed(4, 1, 5, 0, -1).bed(4, 1, 7, 0, 1, 'brown_bed');
      b.set(9, 1, 8, 'chest', { f: 'w', slot: 'house_chest', theme: 'kitchen' }).set(9, 1, 7, 'barrel', { slot: 'pantry', theme: 'pantry' });
      b.set(7, 1, 8, 'loom').set(6, 2, 4, 'item_frame', { f: 'n', slot: 'icon' });
      b.fill(6, 4, 6, 6, 7, 6, 'iron_chain').set(6, 3, 6, 'lantern', { hang: 1 }); fires.push([6, 3, 6]);
      // Курятник с выгулом
      b.walls(13, 0, 3, 17, 1, 7, 'spruce_planks').corners(13, 0, 3, 17, 1, 7, 'spruce_log').clear(15, 0, 7, 15, 1, 7);
      b.gable(13, 3, 17, 7, 2, { axis: 'x', over: 0, fill: 'spruce_planks' });
      b.set(14, 0, 4, 'hay_block').set(16, 0, 4, 'hay_block').set(15, 0, 4, 'barrel', { slot: 'coop', theme: 'coop' }).set(16, 0, 6, 'composter');
      b.set(14, 0, 6, 'spruce_fence');
      b.walls(12, 0, 8, 18, 0, 12, 'spruce_fence').clear(15, 0, 8, 15, 0, 8).set(18, 0, 10, 'spruce_fence_gate', { f: 'e' });
      b.surface(13, 9, 17, 11, 'coarse_dirt', 0.6);
      // Банька
      cabin(b, 22, 3, 27, 8, 3, 'z');
      b.door(22, 1, 6, 'w').set(27, 2, 5, 'glass_pane');
      b.set(26, 1, 4, 'cobblestone').set(25, 1, 4, 'furnace', { f: 's' }).fill(26, 2, 4, 26, 8, 4, STONE).set(26, 9, 4, 'campfire'); fires.push([26, 9, 4]);
      b.set(26, 1, 6, 'cauldron', { water: 1 }).fill(23, 1, 7, 24, 1, 7, 'spruce_slab').set(26, 1, 7, 'barrel');
      b.set(23, 0, 7, 'spruce_slab').set(23, -1, 7, 'chest', { slot: 'banya', f: 'n' });
      // Амбар
      b.walls(3, 0, 15, 11, 0, 22, STONE).fill(4, 0, 16, 10, 0, 21, 'spruce_planks');
      b.walls(3, 1, 15, 11, 4, 22, 'spruce_planks').corners(3, 1, 15, 11, 4, 22, 'spruce_log');
      b.gable(3, 15, 11, 22, 5, { axis: 'z' });
      b.clear(6, 1, 15, 8, 3, 15);
      b.fill(4, 1, 16, 5, 2, 18, 'hay_block').set(4, 1, 17, 'chest', { slot: 'hay_chest', f: 'e' });
      b.fill(9, 1, 16, 10, 3, 17, 'hay_block');
      b.set(10, 1, 20, 'barrel', { theme: 'barn' }).set(10, 1, 21, 'barrel', { theme: 'barn' }).set(4, 1, 21, 'grindstone').set(4, 1, 20, 'composter');
      b.fill(7, 5, 18, 7, 9, 18, 'iron_chain').set(7, 4, 18, 'lantern', { hang: 1 }); fires.push([7, 4, 18]);
      // Колодец
      b.surface(14, 15, 16, 17, 'cobblestone').walls(14, 0, 15, 16, 0, 17, STONE);
      b.set(15, -1, 16, 'water').set(15, 0, 16, 'water').set(16, -1, 16, 'chest', { slot: 'well', f: 'w' });
      for (const [x, z] of [[14, 15], [16, 15], [14, 17], [16, 17]]) b.fill(x, 1, z, x, 2, z, 'spruce_fence');
      b.fill(14, 3, 15, 16, 3, 17, 'spruce_slab');
      // Загон
      b.walls(20, 0, 13, 29, 0, 22, 'spruce_fence').set(20, 0, 17, 'spruce_fence_gate', { f: 'w' });
      b.set(28, 0, 14, 'cauldron', { water: 1 }).set(28, 0, 21, 'hay_block').set(27, 0, 21, 'hay_block');
      // Огород
      b.walls(12, 0, 20, 19, 0, 27, 'spruce_fence').set(15, 0, 20, 'spruce_fence_gate', { f: 'n' });
      b.crops(13, 21, 18, 21, 'potatoes').crops(13, 22, 18, 22, 'carrots').surface(13, 23, 18, 23, 'water').crops(13, 24, 18, 24, 'beetroot').crops(13, 25, 18, 25, 'potatoes');
      b.set(13, 0, 26, 'pumpkin').set(15, 0, 26, 'pumpkin').set(17, 0, 26, 'pumpkin');
      b.set(18, 0, 26, 'spruce_fence').set(18, 1, 26, 'hay_block').set(18, 2, 26, 'carved_pumpkin', { f: 'n' });
      // Тропы и забор
      b.surface(6, 10, 6, 13, 'grass_path').surface(6, 13, 19, 13, 'grass_path').surface(15, 14, 15, 14, 'grass_path').surface(7, 14, 7, 14, 'grass_path');
      b.surface(21, 6, 21, 12, 'grass_path').surface(19, 10, 19, 12, 'grass_path').surface(15, 18, 15, 19, 'grass_path');
      for (let x = 0; x <= 30; x++) if (x !== 9 && b.chance(0.8)) b.set(x, 0, 28, 'spruce_fence');
      b.anchor('south', 9, 28, 's').anchor('north', 15, 0, 'n').anchor('east', 30, 10, 'e').anchor('west', 0, 12, 'w');
      b.spruce(0, 0, 11).spruce(30, 0, 9).spruce(0, 27, 10).spruce(30, 27, 12).spruce(1, 20, 9);
      b.scatter(0, 0, 30, 28, ['fern', 'large_fern', 'short_grass', 'sweet_berry_bush'], 0.05);

      if (state !== 'living') {
        for (const [x, y, z] of fires) b.set(x, y, z, b.get(x, y, z).id === 'campfire' ? 'campfire_out' : 'air');
        b.door(6, 1, 9, 's', 'spruce_door', true).door(22, 1, 6, 'w', 'spruce_door', true);
        b.set(6, 1, 6, 'cake').set(20, 0, 17, 'spruce_fence_gate', { f: 'w', open: true }).set(18, 0, 10, 'spruce_fence_gate', { f: 'e', open: true });
        b.set(6, 1, 5, 'spruce_stairs', { f: 'w' });
      }
      if (state === 'overgrown') {
        b.decay({ spruce_stairs: null, spruce_slab: null, spruce_planks: null }, 0.3, [1, 4, 1, 29, 12, 24]);
        b.decay({ spruce_fence: null, potatoes: 'short_grass', carrots: 'short_grass', beetroot: 'fern', pumpkin: null }, 0.45);
        b.decay({ cobblestone: 'mossy_cobblestone', farmland: 'dirt' }, 0.6);
        b.decay({ grass_path: 'grass_block' }, 0.85);
        b.decay({ spruce_log: null }, 0.05, [0, 2, 0, 30, 4, 28]);
        b.clear(14, 3, 15, 16, 3, 17).clear(6, 1, 6, 6, 1, 6).set(9, 10, 4, 'air').set(26, 9, 4, 'air');
        b.spruce(12, 15, 7, 0, false, true).spruce(24, 17, 8, 0, false, true).spruce(19, 2, 5, 0, false, true);
        b.each(1, 1, 1, 29, 4, 24, (x, y, z) => {
          if (b.get(x, y, z)) return;
          const below = b.get(x, y - 1, z);
          if (below && !below.env && !below.g && y === 1 && b.chance(0.25)) b.set(x, y, z, 'moss_carpet');
          else if (y >= 2 && b.chance(0.02)) b.set(x, y, z, 'cobweb');
        });
      }
      b.mark('slot', 9, 1, 7, 'Кладовая', 'Бочка у печи.');
      b.mark('slot', 15, 0, 4, 'Гнездо в курятнике', 'Бочка между соломенными гнёздами.');
      b.mark('slot', 23, -1, 7, 'Под полком в баньке', 'Нижняя половица под полком ниже остальных.');
      b.mark('slot', 4, 1, 17, 'Сундук в стоге', 'Спрятан внутри стога в амбаре.');
      b.mark('slot', 16, -1, 16, 'Ниша в колодце', 'У самого дна в кладке проём с ящиком.');
      b.mark('clue', 6, 2, 4, 'Рамка в красном углу', 'Записка или икона-оберег.');
      return b;
    },
  });

  defineStructure({
    id: 'sawmill',
    group: 'Средние постройки',
    name: 'Лесопилка с запрудой',
    rarity: 'необычная',
    set: 'rare',
    weight: 2,
    biomes: 'тайга',
    desc: 'Цех на каменном цоколе у собственной запруды. Водяное колесо крутит пилу. Внутри распиловочная линия и штабеля досок, в углу контора приказчика с кафедрой и сейфом под полом. Во дворе три штабеля брёвен, будка сторожа, опилки.',
    territory: ['Запруда с колесом, обнесённая валом', 'Будка сторожа', 'Штабеля брёвен, одно бревно полое'],
    build() {
      const b = new Builder(141);
      b.ground(0, 0, 28, 24);
      // Запруда
      b.walls(2, 0, 1, 26, 0, 6, [['mossy_cobblestone', 2], ['cobblestone', 1], ['coarse_dirt', 1]]).surface(2, 1, 26, 6, 'gravel');
      b.surface(3, 2, 25, 5, 'water').fill(3, 0, 2, 25, 0, 5, 'water');
      b.set(16, -1, 3, 'chest', { slot: 'pond', f: 'n' });
      for (let x = 9; x <= 17; x++) for (let y = -1; y <= 6; y++) {
        const d = Math.hypot(x - 13, y - 2);
        if (Math.abs(d - 3.6) < 0.55) b.set(x, y, 4, 'spruce_planks', y < 0 ? { g: 1 } : undefined);
        else if ((x === 13 || y === 2) && d < 3.2) b.set(x, y, 4, 'spruce_fence');
      }
      b.fill(13, 2, 4, 13, 2, 6, 'stripped_spruce_log', { a: 'z' });
      // Цех
      b.walls(8, 0, 7, 19, 0, 13, STONE).fill(9, 0, 8, 18, 0, 12, 'spruce_planks');
      b.walls(8, 1, 7, 19, 4, 13, 'spruce_planks');
      for (const x of [8, 11, 14, 17, 19]) for (const z of [7, 13]) b.fill(x, 1, z, x, 4, z, 'stripped_spruce_log');
      b.fill(8, 1, 10, 8, 4, 10, 'stripped_spruce_log').fill(19, 1, 10, 19, 4, 10, 'stripped_spruce_log');
      b.gable(8, 7, 19, 13, 5, { axis: 'x' });
      b.door(11, 1, 13, 's').door(12, 1, 13, 's');
      for (const [x, z] of [[9, 13], [16, 13], [8, 9], [19, 11], [10, 7], [16, 7]]) b.set(x, 2, z, 'glass_pane');
      b.fill(9, 1, 9, 12, 1, 9, 'spruce_log', { a: 'x' }).set(13, 1, 9, 'stonecutter', { f: 's' });
      b.fill(10, 1, 11, 11, 2, 12, [['spruce_planks', 2], ['spruce_slab', 1]]).set(9, 1, 12, 'grindstone').set(14, 1, 12, 'barrel', { theme: 'sawmill' });
      b.fill(12, 5, 10, 12, 8, 10, 'iron_chain').set(12, 4, 10, 'lantern', { hang: 1 });
      // Контора
      b.fill(15, 1, 8, 15, 4, 12, 'spruce_planks').door(15, 1, 10, 'w');
      b.set(18, 1, 8, 'lectern', { f: 'w', slot: 'ledger' }).set(17, 1, 11, 'spruce_trapdoor', { h: 'top' }).set(18, 1, 11, 'spruce_stairs', { f: 'e' });
      b.set(17, 0, 11, 'spruce_trapdoor', { h: 'top' }).set(17, -1, 11, 'chest', { slot: 'safe', f: 'n' });
      b.set(18, 1, 12, 'chest', { f: 'w', slot: 'office_chest', theme: 'sawmill' }).set(16, 1, 8, 'lantern');
      // Двор: штабеля, будка сторожа, опилки
      const pile = (x1, x2) => b.fill(x1, 0, 17, x2, 0, 19, 'spruce_log', { a: 'x' }).fill(x1, 1, 17, x2, 1, 18, 'spruce_log', { a: 'x' }).fill(x1, 2, 17, x2, 2, 17, 'spruce_log', { a: 'x' });
      pile(2, 7); pile(10, 15); pile(19, 24);
      b.clear(15, 0, 18, 15, 0, 18).set(14, 0, 18, 'chest', { slot: 'hollow_log', f: 'e' });
      b.logRing(22, 0, 9, 24, 2, 11).clear(23, 0, 11, 23, 1, 11).fill(21, 3, 8, 25, 3, 12, 'spruce_slab').set(23, 0, 10, 'barrel', { slot: 'watchman', theme: 'sawmill' });
      b.surface(7, 14, 20, 15, [['coarse_dirt', 2], ['podzol', 1]], 0.7);
      b.surface(11, 14, 12, 24, 'grass_path').surface(20, 15, 28, 15, 'grass_path', 0.7);
      b.anchor('south', 12, 24, 's').anchor('east', 28, 15, 'e');
      b.spruce(0, 9, 10).spruce(27, 20, 11).spruce(1, 23, 9).spruce(27, 7, 10);
      b.scatter(0, 7, 28, 24, ['fern', 'large_fern', 'short_grass'], 0.07);
      b.mark('clue', 18, 1, 8, 'Бухгалтерская книга', 'Кафедра в конторе.');
      b.mark('slot', 17, -1, 11, 'Сейф под полом', 'Люк в полу под столом приказчика.');
      b.mark('slot', 14, 0, 18, 'Полое бревно', 'Крайнее бревно в штабеле выдолблено.');
      b.mark('slot', 16, -1, 3, 'На дне запруды', 'Утопленный сундук у колеса.');
      b.mark('slot', 23, 0, 10, 'Будка сторожа', 'Бочка сторожа.');
      return b;
    },
  });

  defineStructure({
    id: 'charcoal',
    group: 'Средние постройки',
    name: 'Углежоги и смолокурня',
    rarity: 'необычная',
    set: 'rare',
    weight: 2,
    biomes: 'тайга',
    desc: 'Поляна, где жгли уголь и гнали смолу. Одна куча-печь курится, вторая вскрыта и показывает уголь, третья старая и заросла травой. Есть котлы на очаге, бочки со смолой, шалаш углежога, поленницы. Земля выжжена.',
    territory: ['Выжженная поляна', 'Три кучи-печи', 'Шалаш-навес и поленницы'],
    build() {
      const b = new Builder(151);
      b.ground(0, 0, 24, 22);
      b.surface(2, 2, 22, 20, [['coarse_dirt', 3], ['gravel', 1], ['podzol', 1]], 0.75);
      const mound = (cx, cz, r, shell, open) => {
        b.each(cx - r, 0, cz - r, cx + r, r, cz + r, (x, y, z) => {
          const d = Math.hypot(x - cx, y * 1.2, z - cz);
          if (d > r + 0.3) return;
          if (open && z > cz && y > 0) return;
          b.set(x, y, z, d > r - 0.8 ? shell : 'coal_block');
        });
      };
      mound(6, 6, 3, [['coarse_dirt', 2], ['dirt', 1]]);
      b.set(6, 3, 6, 'campfire');
      mound(14, 6, 3, [['coarse_dirt', 2], ['dirt', 1]], true);
      mound(6, 15, 3, [['grass_block', 2], ['moss_block', 1], ['dirt', 1]]);
      b.set(6, 0, 15, 'chest', { slot: 'cold_mound', f: 's' });
      b.walls(15, 0, 15, 17, 0, 17, 'cobblestone').set(16, 0, 16, 'campfire').set(16, 1, 16, 'cauldron');
      b.set(19, 0, 15, 'barrel', { theme: 'charcoal' }).set(19, 1, 15, 'barrel').set(20, 0, 15, 'barrel').set(19, 0, 16, 'barrel', { slot: 'tar_barrel' });
      b.fill(17, 0, 9, 18, 0, 10, 'coal_block');
      // Шалаш
      b.fill(18, 0, 2, 22, 2, 2, 'spruce_log', { a: 'x' }).fill(18, 3, 2, 22, 3, 3, 'spruce_slab');
      b.fill(18, 2, 4, 22, 2, 4, 'spruce_stairs', { f: 'n' }).fill(18, 1, 5, 22, 1, 5, 'spruce_stairs', { f: 'n' });
      b.fill(19, 0, 3, 20, 0, 3, 'hay_block').set(22, 0, 3, 'barrel', { slot: 'shelter' }).set(18, 0, 3, 'lantern');
      b.fill(2, 0, 2, 3, 1, 4, 'spruce_log', { a: 'z' }).fill(21, 0, 18, 22, 2, 19, 'spruce_log', { a: 'x' });
      b.surface(12, 0, 12, 3, 'grass_path', 0.5).surface(0, 11, 4, 11, 'grass_path', 0.5);
      b.anchor('north', 12, 0, 'n').anchor('west', 0, 11, 'w');
      b.spruce(0, 0, 10).spruce(24, 22, 9).spruce(0, 21, 11).spruce(24, 9, 10).spruce(11, 21, 7, 0, true, true);
      b.mark('slot', 6, 0, 15, 'В остывшей куче', 'Внутри старой заросшей кучи сундук. Нужно копать.');
      b.mark('slot', 19, 0, 16, 'Бочка с двойным дном', 'Одна из бочек со смолой.');
      b.mark('clue', 22, 0, 3, 'Ящик углежога', 'Бочка в шалаше.');
      return b;
    },
  });

  defineStructure({
    id: 'stockade',
    group: 'Средние постройки',
    name: 'Острог-застава',
    rarity: 'редкая',
    set: 'rare',
    weight: 2,
    biomes: 'тайга, снежная тайга',
    desc: 'Деревянная крепость: частокол из заострённых брёвен, ворота с надвратной площадкой, две угловые вышки и помост вдоль стены. Внутри казарма с нарами, изба командира, оружейный навес, полевая кухня, флагшток и чучела для учений. Можно занять и обустроить под себя.',
    territory: ['Частокол 25×25, высота 6', 'Плац из утоптанной земли', 'Оружейный навес с наковальней'],
    build() {
      const b = new Builder(161);
      b.ground(0, 0, 28, 28);
      b.surface(3, 3, 25, 25, [['coarse_dirt', 3], ['podzol', 1], ['grass_block', 1]], 0.8);
      b.walls(2, 0, 2, 26, 4, 26, 'spruce_log').walls(2, 5, 2, 26, 5, 26, 'spruce_fence');
      b.clear(13, 0, 26, 15, 3, 26).set(13, 0, 26, 'spruce_fence_gate', { f: 'n', open: true }).set(15, 0, 26, 'spruce_fence_gate', { f: 'n', open: true });
      b.fill(12, 5, 25, 16, 5, 27, 'spruce_slab').walls(12, 6, 25, 16, 6, 27, 'spruce_fence');
      b.corners(12, 7, 25, 16, 8, 27, 'spruce_fence').fill(12, 9, 25, 16, 9, 27, 'spruce_slab');
      b.fill(12, 0, 27, 12, 4, 27, 'spruce_log').fill(16, 0, 27, 16, 4, 27, 'spruce_log');
      const tower = (x, z, door, barrel) => {
        b.walls(x, 0, z, x + 3, 7, z + 3, 'spruce_log').fill(x, 8, z, x + 3, 8, z + 3, 'spruce_planks');
        b.walls(x - 1, 9, z - 1, x + 4, 9, z + 4, 'spruce_fence').corners(x - 1, 10, z - 1, x + 4, 11, z + 4, 'spruce_fence');
        b.gable(x - 1, z - 1, x + 4, z + 4, 12, { axis: 'x', fill: null, over: 0 });
        b.fill(x - 1, 8, z - 1, x + 4, 8, z + 4, 'spruce_planks');
        b.fill(x + 1, 0, z + 1, x + 1, 8, z + 1, 'ladder', { f: 'n' });
        b.clear(door[0], 0, door[1], door[0], 1, door[1]);
        if (barrel) b.set(barrel[0], 9, barrel[1], 'barrel', { slot: 'tower' });
      };
      tower(2, 2, [4, 5], [4, 4]); tower(23, 23, [23, 24]);
      b.fill(7, 3, 3, 21, 3, 3, 'spruce_slab', { h: 'top' }).fill(6, 0, 3, 6, 3, 3, 'ladder', { f: 'n' });
      // Казарма
      b.walls(5, 0, 8, 15, 0, 13, STONE).fill(6, 0, 9, 14, 0, 12, 'spruce_planks');
      b.logRing(5, 1, 8, 15, 3, 13).gable(5, 8, 15, 13, 4, { axis: 'x' });
      b.door(10, 1, 13, 's');
      for (const x of [7, 13]) b.set(x, 2, 13, 'glass_pane');
      for (const x of [6, 8, 12, 14]) b.bed(x, 1, 10, 0, -1, 'brown_bed');
      b.set(10, 1, 9, 'fletching_table').set(9, 1, 9, 'barrel', { theme: 'soldier' }).set(11, 1, 9, 'barrel', { theme: 'soldier' });
      b.fill(10, 4, 11, 10, 6, 11, 'iron_chain').set(10, 3, 11, 'lantern', { hang: 1 });
      b.set(13, 0, 11, 'spruce_slab').set(13, -1, 11, 'chest', { slot: 'bunk', f: 'n' });
      // Изба командира
      b.walls(19, 0, 8, 23, 0, 12, STONE).fill(20, 0, 9, 22, 0, 11, 'spruce_planks');
      b.logRing(19, 1, 8, 23, 3, 12).gable(19, 8, 23, 12, 4, { axis: 'z' });
      b.door(19, 1, 10, 'w').set(23, 2, 10, 'glass_pane');
      b.set(22, 1, 9, 'lectern', { f: 'w', slot: 'reports' }).bed(22, 1, 11, -1, 0).set(20, 1, 9, 'chest', { f: 's', slot: 'commander_chest', theme: 'soldier' });
      b.set(21, 0, 10, 'spruce_trapdoor', { h: 'top' }).set(21, 1, 10, 'red_carpet').set(21, -1, 10, 'chest', { slot: 'commander_floor', f: 'n' });
      // Оружейный навес
      b.corners(18, 0, 17, 23, 2, 20, 'spruce_fence').fill(17, 3, 16, 24, 3, 21, 'spruce_slab');
      b.set(19, 0, 18, 'chest', { f: 's', slot: 'armory', theme: 'armory' }).set(20, 0, 18, 'barrel', { theme: 'soldier' }).set(21, 0, 18, 'barrel', { theme: 'soldier' });
      b.set(22, 0, 18, 'grindstone').set(22, 0, 19, 'anvil').set(19, 0, 20, 'hay_block');
      // Кухня, чучела, флаг
      b.set(9, 0, 19, 'campfire').set(10, 0, 19, 'cauldron', { water: 1 }).set(8, 0, 19, 'smoker', { f: 'e' }).set(8, 0, 20, 'barrel', { theme: 'kitchen' });
      for (const z of [17, 21]) b.set(5, 0, z, 'spruce_fence').set(5, 1, z, 'hay_block').set(5, 2, z, 'carved_pumpkin', { f: 'e' });
      b.fill(14, 0, 17, 14, 8, 17, 'spruce_fence').set(14, 9, 17, 'red_banner', { stand: 4 });
      b.surface(14, 18, 14, 28, 'grass_path').surface(10, 14, 13, 16, 'grass_path', 0.7);
      b.anchor('gate', 14, 28, 's').anchor('north', 14, 0, 'n');
      b.spruce(0, 0, 9).spruce(28, 0, 10).spruce(0, 28, 11).spruce(28, 14, 9);
      b.mark('slot', 21, -1, 10, 'Люк под ковром', 'Красный ковёр у кровати командира лежит на люке.');
      b.mark('clue', 22, 1, 9, 'Донесения', 'Кафедра командира.');
      b.mark('slot', 13, -1, 11, 'Под нарами', 'Половица в казарме ниже остальных.');
      b.mark('slot', 4, 9, 4, 'На вышке', 'Бочка дозорного.');
      b.mark('slot', 19, 0, 18, 'Оружейная', 'Сундук под навесом.');
      return b;
    },
  });

  defineStructure({
    id: 'hermitage',
    group: 'Средние постройки',
    name: 'Скит отшельника',
    rarity: 'редкая',
    set: 'rare',
    weight: 2,
    biomes: 'старовозрастная тайга, тайга',
    desc: 'Землянка, вкопанная в собственный холм. Снаружи видны бревенчатый фасад и навес. Внутри низкая комната под бревенчатым потолком: свечи, сушёные травы, лежанка из сена, кафедра с тетрадью. За иконой стена из мха, а за ней келья. Во дворе грибной огород, улей, родник в каменной чаше и крест.',
    territory: ['Холм над землянкой', 'Грибной огород и улей', 'Родник в каменной чаше', 'Тропа из плоских камней'],
    build() {
      const b = new Builder(171);
      b.ground(0, 0, 22, 22);
      for (let x = 0; x <= 22; x++) for (let z = 0; z <= 14; z++) {
        const h = Math.floor(8 - (x - 11) ** 2 / 16 - (z - 3) ** 2 / 12);
        for (let y = 0; y < h; y++) b.set(x, y, z, y === h - 1 ? [['grass_block', 3], ['podzol', 2], ['moss_block', 1]] : y < h - 3 ? 'stone' : 'dirt');
      }
      b.clear(10, 0, 11, 12, 2, 12);
      // Комната
      b.walls(8, -1, 4, 14, 3, 10, [['rooted_dirt', 2], ['coarse_dirt', 2], ['dirt', 1]]);
      b.surface(9, 5, 13, 9, 'coarse_dirt').clear(9, 0, 5, 13, 2, 9);
      b.fill(8, 3, 4, 14, 3, 10, 'spruce_planks');
      for (const z of [4, 6, 8, 10]) b.fill(8, 3, z, 14, 3, z, 'stripped_spruce_log', { a: 'x' });
      b.fill(8, 0, 10, 14, 2, 10, 'spruce_log', { a: 'x' }).door(11, 0, 10, 's').set(9, 1, 10, 'glass_pane');
      b.fill(8, 3, 11, 14, 3, 11, 'spruce_slab').fill(8, 0, 11, 8, 2, 11, 'spruce_fence').fill(14, 0, 11, 14, 2, 11, 'spruce_fence');
      b.fill(9, 0, 5, 9, 0, 6, 'hay_block').set(9, 1, 5, 'white_carpet');
      b.set(13, 0, 5, 'lectern', { f: 's', slot: 'notebook' }).set(12, 0, 5, 'candle', { lit: 1 }).set(10, 0, 9, 'candle', { lit: 1 });
      b.set(11, 1, 5, 'item_frame', { f: 'n', slot: 'icon' });
      b.set(13, 0, 8, 'cauldron', { water: 1 }).set(13, 0, 9, 'barrel', { theme: 'hermit' }).set(9, 0, 9, 'flower_pot', { plant: 'fern' });
      b.set(10, 2, 7, 'hanging_roots').set(12, 2, 6, 'hanging_roots');
      b.each(9, 0, 5, 13, 0, 9, (x, y, z) => { if (!b.get(x, y, z) && b.chance(0.3)) b.set(x, y, z, 'moss_carpet'); });
      // Келья за стеной из мха
      b.fill(11, 0, 4, 11, 1, 4, 'moss_block');
      b.clear(10, 0, 2, 12, 1, 3).surface(10, 2, 12, 3, 'coarse_dirt');
      b.set(11, 0, 2, 'chest', { slot: 'kelya', f: 's' }).set(12, 0, 2, 'decorated_pot', { slot: 'kelya_pot' }).set(10, 0, 2, 'candle', { lit: 1 });
      // Двор
      b.surface(3, 14, 7, 17, 'podzol').fill(3, 0, 14, 7, 0, 17, [['brown_mushroom', 2], ['red_mushroom', 1], ['sweet_berry_bush', 1]]);
      b.set(17, 0, 15, 'beehive', { f: 's' }).set(17, -1, 15, 'chest', { slot: 'beehive', f: 's' }).fill(14, 0, 13, 15, 0, 13, 'spruce_log', { a: 'x' });
      b.fill(5, 0, 19, 5, 2, 19, 'spruce_fence').set(4, 1, 19, 'spruce_fence').set(6, 1, 19, 'spruce_fence');
      b.surface(14, 16, 17, 19, 'mossy_cobblestone').surface(15, 17, 16, 18, 'water');
      b.fill(17, 0, 10, 18, 1, 10, 'spruce_log', { a: 'x' });
      for (let z = 13; z <= 21; z += 2) b.set(11, -1, z, 'mossy_cobblestone', { g: 1 });
      b.anchor('path', 11, 22, 's').anchor('east', 22, 16, 'e');
      b.spruce(1, 20, 10).spruce(21, 21, 9).spruce(20, 4, 7, 2).spruce(2, 4, 8, 2);
      b.scatter(0, 12, 22, 22, ['fern', 'large_fern', 'short_grass'], 0.12);
      b.mark('secret', 11, 1, 4, 'Стена из мха', 'За иконой на задней стене участок из мха. Сними икону, сруби мох, и откроется проход.');
      b.mark('slot', 11, 0, 2, 'Келья', 'Тесная комнатка: свеча, расписной горшок, сундук.');
      b.mark('clue', 13, 0, 5, 'Тетрадь отшельника', 'Кафедра.');
      b.mark('slot', 17, -1, 15, 'Под ульем', 'Закопано под ульем.');
      return b;
    },
  });
})();
