// Средние постройки — встречаются раз в несколько километров.
(function () {
  const STONE = [['cobblestone', 3], ['mossy_cobblestone', 2]];

  // Сруб: фундамент, пол, бревенчатые стены, двускатная крыша.
  function cabin(b, x1, z1, x2, z2, h, axis) {
    b.walls(x1, 0, z1, x2, 0, z2, STONE).fill(x1 + 1, 0, z1 + 1, x2 - 1, 0, z2 - 1, 'spruce_planks');
    b.walls(x1, 1, z1, x2, h, z2, 'spruce_log').corners(x1, 1, z1, x2, h, z2, 'stripped_spruce_log');
    b.gable(x1, z1, x2, z2, h + 1, { axis });
  }

  defineStructure({
    id: 'farmstead',
    group: 'Средние постройки',
    name: 'Лесной хутор',
    rarity: 'необычная',
    biomes: 'тайга, снежная тайга',
    states: [
      { id: 'living', label: 'Жилой' },
      { id: 'empty', label: 'Опустевший' },
      { id: 'overgrown', label: 'Заросший' },
    ],
    desc: 'Изба, банька, амбар, колодец и загон, а вокруг лес. Одна планировка генерируется в трёх состояниях. Жилой хутор с хозяевами. Опустевший: двери открыты, на столе нетронутый пирог, людей нет. Заросший: крыши провалились, во дворе растут ели. Состояние выбирается при генерации.',
    territory: ['Тропы от избы к колодцу, баньке и амбару', 'Загон и огород с ягодой', 'Низкий забор по краю двора'],
    build(state = 'living') {
      const b = new Builder(131);
      const lamps = [];
      b.ground(0, 0, 26, 24);
      // Изба
      cabin(b, 2, 2, 9, 8, 3, 'x');
      b.door(5, 1, 8, 's');
      for (const [x, z] of [[3, 8], [8, 8], [2, 5], [9, 5], [7, 2]]) b.set(x, 2, z, 'glass_pane', { f: x === 2 || x === 9 ? 'e' : 'n' });
      b.fill(8, 1, 3, 8, 9, 3, STONE).set(7, 1, 3, 'furnace');
      b.set(5, 1, 5, 'spruce_trapdoor', { h: 'top' }).set(6, 1, 5, 'spruce_trapdoor', { h: 'top' });
      for (const x of [5, 6]) b.set(x, 1, 4, 'spruce_stairs', { f: 'n' }).set(x, 1, 6, 'spruce_stairs', { f: 's' });
      b.bed(3, 1, 3, 0, 1).bed(3, 1, 6, 0, 1, 'brown_bed');
      b.set(8, 1, 7, 'chest').set(8, 1, 6, 'barrel').set(5, 2, 3, 'painting', { f: 'n' }).set(4, 1, 7, 'loom');
      b.set(5, 3, 5, 'lantern'); lamps.push([5, 3, 5]);
      b.walls(5, -4, 4, 9, -1, 8, STONE).fill(6, -4, 5, 8, -4, 7, 'cobblestone').clear(6, -3, 5, 8, -1, 7);
      b.set(7, 0, 6, 'spruce_trapdoor', { h: 'top' }).fill(7, -3, 7, 7, -1, 7, 'ladder', { f: 's' });
      b.set(8, -3, 5, 'chest').set(6, -3, 5, 'barrel').set(6, -3, 6, 'barrel');
      // Банька
      cabin(b, 14, 3, 19, 8, 3, 'z');
      b.door(14, 1, 6, 'w').set(19, 2, 5, 'glass_pane', { f: 'e' });
      b.set(18, 1, 4, 'cobblestone').fill(18, 2, 4, 18, 8, 4, STONE).set(17, 1, 4, 'furnace').set(18, 1, 6, 'cauldron');
      b.fill(15, 1, 7, 16, 1, 7, 'spruce_slab').fill(17, 1, 7, 18, 1, 7, 'spruce_slab', { h: 'top' });
      b.set(15, -1, 7, 'chest');
      // Амбар
      b.walls(3, 0, 14, 11, 0, 21, STONE).fill(4, 0, 15, 10, 0, 20, 'spruce_planks');
      b.walls(3, 1, 14, 11, 4, 21, 'spruce_planks').corners(3, 1, 14, 11, 4, 21, 'spruce_log');
      b.gable(3, 14, 11, 21, 5, { axis: 'z' });
      b.clear(6, 1, 14, 8, 3, 14);
      b.fill(4, 1, 15, 5, 2, 17, 'hay_block').fill(9, 1, 15, 10, 2, 16, 'hay_block').set(5, 1, 16, 'chest');
      b.set(10, 1, 19, 'barrel').set(10, 1, 20, 'barrel').set(4, 1, 20, 'grindstone').set(4, 1, 19, 'composter');
      // Колодец с подводной нишей
      b.walls(13, -7, 11, 15, 0, 13, STONE).fill(14, -6, 12, 14, -1, 12, 'water').set(14, -7, 12, 'gravel');
      b.fill(16, -6, 11, 17, -4, 13, 'stone').set(15, -5, 12, 'water').set(16, -5, 12, 'chest');
      for (const [x, z] of [[13, 11], [15, 11], [13, 13], [15, 13]]) b.fill(x, 1, z, x, 2, z, 'spruce_fence');
      b.fill(13, 3, 11, 15, 3, 13, 'spruce_slab');
      // Загон и огород
      b.walls(15, 0, 15, 24, 0, 22, 'spruce_fence').set(15, 0, 18, 'spruce_fence_gate', { f: 'e' });
      b.set(23, 0, 21, 'hay_block').set(22, 0, 21, 'composter');
      b.walls(20, 0, 2, 25, 0, 9, 'spruce_fence').fill(21, 0, 3, 24, 0, 8, 'sweet_berry_bush');
      // Тропы и забор
      b.surface(5, 9, 5, 12, 'grass_path').surface(5, 12, 12, 12, 'grass_path').surface(7, 13, 7, 13, 'grass_path');
      b.surface(13, 6, 13, 10, 'grass_path').surface(12, 12, 12, 23, 'grass_path');
      for (let x = 0; x <= 26; x++) if (x !== 12 && b.chance(0.8)) b.set(x, 0, 24, 'spruce_fence');
      b.spruce(0, 0, 11).spruce(26, 0, 9).spruce(0, 12, 10).spruce(26, 13, 12).spruce(1, 23, 9);
      b.scatter(0, 0, 26, 24, ['fern', 'large_fern', 'sweet_berry_bush'], 0.06);

      if (state !== 'living') {
        for (const [x, y, z] of lamps) b.clear(x, y, z, x, y, z);
        b.door(5, 1, 8, 's', 'spruce_door', true).door(14, 1, 6, 'w', 'spruce_door', true);
        b.set(6, 1, 5, 'cake').set(15, 0, 18, 'spruce_fence_gate', { f: 'e', open: true });
        b.set(6, 1, 4, 'spruce_stairs', { f: 'w' });
      }
      if (state === 'overgrown') {
        b.decay({ spruce_stairs: null, spruce_slab: null, spruce_planks: null }, 0.3, [1, 4, 1, 21, 12, 22]);
        b.decay({ spruce_fence: null, sweet_berry_bush: 'large_fern' }, 0.4);
        b.decay({ cobblestone: 'mossy_cobblestone' }, 0.6);
        b.decay({ spruce_log: null }, 0.06, [0, 2, 0, 26, 4, 24]);
        b.clear(13, 3, 11, 15, 3, 13).clear(6, 1, 5, 6, 1, 5);
        for (const blk of [...b.blocks.values()]) if (blk.id === 'grass_path') b.set(blk.x, blk.y, blk.z, 'grass_block', { env: 1 });
        b.spruce(11, 10, 6).spruce(17, 17, 7).spruce(20, 11, 5);
        b.each(1, 1, 1, 21, 4, 22, (x, y, z) => {
          if (b.get(x, y, z)) return;
          const below = b.get(x, y - 1, z);
          if (below && !below.env && y === 1 && b.chance(0.25)) b.set(x, y, z, 'moss_carpet');
          else if (y >= 3 && b.chance(0.03)) b.set(x, y, z, 'cobweb');
        });
      }
      b.mark('slot', 8, -3, 5, 'Погреб избы', 'Люк в полу у печи. Припасы и семейный сундук.');
      b.mark('slot', 15, -1, 7, 'Под полком в баньке', 'Под нижней лавкой отходит доска.');
      b.mark('slot', 5, 1, 16, 'Сундук в стоге', 'Спрятан между снопами сена в амбаре.');
      b.mark('slot', 16, -5, 12, 'Ниша в колодце', 'На глубине пяти блоков в кладке есть проём. Нужно нырнуть.');
      b.mark('clue', 5, 2, 3, 'Картина в избе', 'За картиной надпись или записка.');
      b.mark('clue', 6, 1, 5, 'Стол', state === 'living' ? 'Обычный обеденный стол.' : 'Накрытый стол с нетронутым пирогом. Что случилось с хозяевами?');
      return b;
    },
  });

  defineStructure({
    id: 'sawmill',
    group: 'Средние постройки',
    name: 'Заброшенная лесопилка',
    rarity: 'необычная',
    biomes: 'тайга у рек',
    desc: 'Цех на каменном фундаменте у реки. Водяное колесо крутит пилу. Внутри распиловочная линия и штабеля досок, в восточном углу контора приказчика. Во дворе штабеля брёвен, на воде мостки. Генерируется только у воды.',
    territory: ['Река с гравийным дном', 'Мостки для сплава брёвен', 'Три штабеля брёвен во дворе'],
    build() {
      const b = new Builder(141);
      b.ground(0, 0, 24, 22);
      b.each(0, -4, 0, 24, -1, 5, (x, y, z) => {
        if (z === 0) return;
        b.set(x, y, z, y === -4 ? 'gravel' : 'water', { env: 1 });
      });
      b.surface(0, 0, 24, 0, [['gravel', 1], ['coarse_dirt', 1]]).surface(0, 6, 24, 6, [['gravel', 1], ['coarse_dirt', 2]], 0.6);
      // Цех
      b.walls(6, 0, 6, 15, 0, 12, STONE).fill(7, 0, 7, 14, 0, 11, 'spruce_planks');
      b.walls(6, 1, 6, 15, 4, 12, 'spruce_planks');
      for (const x of [6, 9, 12, 15]) for (const z of [6, 12]) b.fill(x, 1, z, x, 4, z, 'stripped_spruce_log');
      b.fill(6, 1, 9, 6, 4, 9, 'stripped_spruce_log').fill(15, 1, 9, 15, 4, 9, 'stripped_spruce_log');
      b.gable(6, 6, 15, 12, 5, { axis: 'x' });
      b.door(9, 1, 12, 's').door(10, 1, 12, 's');
      for (const [x, z] of [[7, 12], [13, 12], [6, 7], [6, 11], [8, 6], [15, 10]]) b.set(x, 2, z, 'glass_pane', { f: x === 6 || x === 15 ? 'e' : 'n' });
      // Колесо
      for (let x = 7; x <= 15; x++) for (let y = -2; y <= 6; y++) {
        const d = Math.hypot(x - 11, y - 2);
        if (Math.abs(d - 3.6) < 0.55) b.set(x, y, 4, 'spruce_planks');
        else if ((x === 11 || y === 2) && d < 3.2) b.set(x, y, 4, 'spruce_fence');
      }
      b.set(11, 2, 4, 'stripped_spruce_log').set(11, 2, 5, 'stripped_spruce_log');
      // Цех внутри
      b.fill(7, 1, 8, 10, 1, 8, 'spruce_log').set(11, 1, 8, 'stonecutter');
      b.fill(8, 1, 10, 9, 2, 11, [['spruce_planks', 2], ['spruce_slab', 1]]).set(7, 1, 11, 'grindstone').set(11, 1, 11, 'barrel');
      b.set(9, 4, 9, 'lantern');
      // Контора
      b.fill(12, 1, 7, 12, 4, 11, 'spruce_planks').door(12, 1, 9, 'w');
      b.set(14, 1, 7, 'lectern', { f: 'w' }).set(14, 1, 11, 'chest').set(13, 1, 10, 'spruce_trapdoor', { h: 'top' }).set(14, 1, 10, 'spruce_stairs', { f: 'e' });
      b.set(13, 0, 10, 'spruce_trapdoor', { h: 'top' }).set(13, -1, 10, 'chest').set(13, 3, 8, 'lantern');
      // Мостки
      b.fill(2, 0, 1, 4, 0, 5, 'spruce_slab').fill(2, -3, 1, 2, -1, 1, 'spruce_fence').fill(4, -3, 1, 4, -1, 1, 'spruce_fence');
      // Штабеля
      const pile = (x1, x2) => { b.fill(x1, 0, 15, x2, 0, 17, 'spruce_log').fill(x1, 1, 15, x2, 1, 16, 'spruce_log').fill(x1, 2, 15, x2, 2, 15, 'spruce_log'); };
      pile(2, 7); pile(12, 17); pile(19, 23);
      b.clear(17, 0, 16, 17, 0, 16).set(16, 0, 16, 'chest');
      b.set(11, -4, 3, 'chest');
      b.surface(9, 13, 10, 22, 'grass_path').surface(4, 14, 22, 14, 'coarse_dirt', 0.7);
      b.spruce(0, 9, 10).spruce(22, 8, 11).spruce(1, 21, 9).spruce(24, 20, 10).spruce(18, 9, 8);
      b.scatter(0, 7, 24, 22, ['fern', 'large_fern'], 0.07);
      b.mark('clue', 14, 1, 7, 'Бухгалтерская книга', 'В конторе. Цифры не сходятся: кто-то воровал лес. С этого начинается история.');
      b.mark('slot', 13, -1, 10, 'Сейф под полом конторы', 'Люк в полу прямо под столом приказчика. Стол надо убрать.');
      b.mark('slot', 16, 0, 16, 'Полое бревно', 'Крайнее бревно в штабеле выдолблено внутри.');
      b.mark('slot', 11, -4, 3, 'На дне под колесом', 'Утопленный сундук. Видно только сверху, если стоять на колесе.');
      return b;
    },
  });

  defineStructure({
    id: 'charcoal',
    group: 'Средние постройки',
    name: 'Углежоги и смолокурня',
    rarity: 'необычная',
    biomes: 'тайга',
    desc: 'Поляна, где жгли уголь и гнали смолу. Две кучи-печи под землёй, одна из них вскрыта, и в ней виден уголь. Есть котлы на очаге, бочки со смолой и шалаш углежога. Земля выжжена, мха нет. Третья куча старая, заросшая и давно остывшая.',
    territory: ['Выжженная поляна', 'Поленницы для кучных печей', 'Шалаш-навес'],
    build() {
      const b = new Builder(151);
      b.ground(0, 0, 20, 18);
      b.surface(2, 2, 18, 16, [['coarse_dirt', 3], ['gravel', 1], ['podzol', 1]], 0.75);
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
      mound(13, 6, 3, [['coarse_dirt', 2], ['dirt', 1]], true);
      mound(5, 13, 3, [['grass_block', 2], ['moss_block', 1], ['dirt', 1]]);
      b.set(5, 1, 13, 'chest');
      b.walls(11, 0, 11, 13, 0, 13, 'cobblestone').set(12, 0, 12, 'campfire').set(12, 1, 12, 'cauldron').set(14, 0, 13, 'cauldron');
      b.set(15, 0, 11, 'barrel').set(15, 1, 11, 'barrel').set(15, 0, 12, 'barrel').set(16, 0, 11, 'barrel');
      // Шалаш
      b.fill(15, 0, 2, 18, 2, 2, 'spruce_log').fill(15, 3, 2, 18, 3, 3, 'spruce_slab');
      b.fill(15, 2, 4, 18, 2, 4, 'spruce_stairs', { f: 'n' }).fill(15, 1, 5, 18, 1, 5, 'spruce_stairs', { f: 'n' });
      b.fill(16, 0, 3, 17, 0, 3, 'hay_block').set(18, 0, 3, 'barrel').set(15, 0, 3, 'lantern');
      b.fill(2, 0, 2, 3, 1, 4, 'spruce_log').fill(17, 0, 14, 18, 2, 15, 'spruce_log');
      b.spruce(0, 0, 10).spruce(20, 18, 9).spruce(0, 17, 11).spruce(20, 8, 10).spruce(10, 0, 7, 0, true);
      b.mark('slot', 5, 1, 13, 'В остывшей куче', 'Внутри старой заросшей кучи вместо угля сундук. Нужно копать.');
      b.mark('slot', 15, 0, 12, 'Бочка с двойным дном', 'Одна из бочек смолы. Снаружи такая же, как все.');
      b.mark('clue', 18, 0, 3, 'Ящик углежога', 'Счёт мешков угля и записка заказчику.');
      return b;
    },
  });

  defineStructure({
    id: 'stockade',
    group: 'Средние постройки',
    name: 'Острог-застава',
    rarity: 'редкая',
    biomes: 'тайга, снежная тайга',
    desc: 'Деревянная крепость: частокол из заострённых брёвен, ворота с надвратной площадкой, две угловые вышки. Внутри казарма с нарами, изба командира, навес с припасами, кострище и чучела для учений. Это «младший брат» замка, можно занять и обустроить под себя.',
    territory: ['Частокол 23×23 высотой 6 блоков', 'Плац из каменистой земли', 'Флагшток с красным флагом'],
    build() {
      const b = new Builder(161);
      b.ground(0, 0, 26, 26);
      b.surface(3, 3, 23, 23, [['coarse_dirt', 3], ['podzol', 1], ['grass_block', 1]], 0.8);
      b.walls(2, 0, 2, 24, 4, 24, 'spruce_log').walls(2, 5, 2, 24, 5, 24, 'spruce_fence');
      b.clear(12, 0, 24, 14, 3, 24).set(12, 0, 24, 'spruce_fence_gate', { open: true }).set(14, 0, 24, 'spruce_fence_gate', { open: true });
      b.fill(11, 5, 23, 15, 5, 25, 'spruce_slab').walls(11, 6, 23, 15, 6, 25, 'spruce_fence');
      b.corners(11, 6, 23, 15, 8, 25, 'spruce_fence').fill(11, 9, 23, 15, 9, 25, 'spruce_slab');
      b.fill(11, 0, 25, 11, 4, 25, 'spruce_log').fill(15, 0, 25, 15, 4, 25, 'spruce_log');
      const tower = (x, z) => {
        b.walls(x, 0, z, x + 3, 7, z + 3, 'spruce_log').fill(x, 8, z, x + 3, 8, z + 3, 'spruce_planks');
        b.walls(x - 1, 9, z - 1, x + 4, 9, z + 4, 'spruce_fence').corners(x - 1, 10, z - 1, x + 4, 11, z + 4, 'spruce_fence');
        b.gable(x - 1, z - 1, x + 4, z + 4, 12, { axis: 'x', fill: null, over: 0 });
        b.fill(x - 1, 8, z - 1, x + 4, 8, z + 4, 'spruce_planks');
        b.fill(x + 1, 0, z + 1, x + 1, 8, z + 1, 'ladder', { f: 'n' });
      };
      tower(2, 2); tower(21, 21);
      b.clear(4, 0, 5, 4, 1, 5).clear(21, 0, 22, 21, 1, 22);
      b.set(5, 9, 5, 'barrel');
      // Помост вдоль северной стены
      b.fill(7, 3, 3, 20, 3, 3, 'spruce_slab', { h: 'top' }).fill(6, 0, 3, 6, 3, 3, 'ladder', { f: 'n' });
      // Казарма
      b.walls(5, 0, 8, 15, 0, 13, STONE).fill(6, 0, 9, 14, 0, 12, 'spruce_planks');
      b.walls(5, 1, 8, 15, 3, 13, 'spruce_log').corners(5, 1, 8, 15, 3, 13, 'stripped_spruce_log');
      b.gable(5, 8, 15, 13, 4, { axis: 'x' });
      b.door(10, 1, 13, 's');
      for (const x of [7, 13]) b.set(x, 2, 13, 'glass_pane', { f: 'n' });
      for (const x of [6, 8, 12, 14]) b.bed(x, 1, 9, 0, 1, 'brown_bed');
      b.set(10, 1, 9, 'fletching_table').set(9, 1, 9, 'barrel').set(11, 1, 9, 'barrel').set(10, 3, 11, 'lantern');
      b.set(13, -1, 9, 'chest');
      // Изба командира
      b.walls(18, 0, 8, 22, 0, 12, STONE).fill(19, 0, 9, 21, 0, 11, 'spruce_planks');
      b.walls(18, 1, 8, 22, 3, 12, 'spruce_log').gable(18, 8, 22, 12, 4, { axis: 'z' });
      b.door(18, 1, 10, 'w').set(22, 2, 10, 'glass_pane', { f: 'e' });
      b.set(21, 1, 9, 'lectern', { f: 'w' }).bed(21, 1, 11, -1, 0).set(19, 1, 9, 'chest');
      b.set(20, 0, 10, 'spruce_trapdoor', { h: 'top' }).set(20, 1, 10, 'red_carpet').set(20, -1, 10, 'chest');
      // Двор
      b.set(9, 0, 18, 'campfire');
      for (const z of [17, 20]) b.set(5, 0, z, 'spruce_fence').set(5, 1, z, 'hay_block');
      b.corners(17, 0, 17, 21, 2, 19, 'spruce_fence').fill(17, 3, 17, 21, 3, 19, 'spruce_slab');
      b.fill(18, 0, 18, 20, 0, 18, 'barrel').set(18, 1, 18, 'hay_block').set(20, 0, 17, 'hay_block');
      b.fill(13, 0, 16, 13, 8, 16, 'spruce_fence').fill(14, 6, 16, 14, 8, 16, 'red_banner', { f: 'w' });
      b.surface(13, 14, 13, 23, 'grass_path').surface(10, 14, 12, 14, 'grass_path');
      b.spruce(0, 0, 9).spruce(26, 0, 10).spruce(0, 26, 11).spruce(26, 14, 9);
      b.mark('slot', 20, -1, 10, 'Люк под ковром', 'Красный ковёр в избе командира лежит на люке, под ним сундук.');
      b.mark('clue', 21, 1, 9, 'Донесения', 'Кафедра командира: последние приказы и донесение о чём-то в лесу.');
      b.mark('slot', 13, -1, 9, 'Под нарами', 'Солдатская заначка под половицей казармы.');
      b.mark('slot', 5, 9, 5, 'На северо-западной вышке', 'Бочка дозорного на верхней площадке.');
      return b;
    },
  });

  defineStructure({
    id: 'hermitage',
    group: 'Средние постройки',
    name: 'Скит отшельника',
    rarity: 'редкая',
    biomes: 'старовозрастная тайга, холмы',
    desc: 'Землянка, вкопанная в склон холма. Снаружи видны только бревенчатый фасад и навес над дверью. Внутри низкая комната под бревенчатым потолком: свечи, сушёные травы, лежанка из сена, кафедра с тетрадью. Задняя стена из мха скрывает келью.',
    territory: ['Холм над землянкой', 'Огород с грибами и улей', 'Каменная «молитвенная» тропа'],
    build() {
      const b = new Builder(171);
      b.ground(0, 0, 18, 18);
      for (let x = 0; x <= 18; x++) for (let z = 0; z <= 12; z++) {
        const h = Math.floor(7 - (x - 9) ** 2 / 14 - (z - 2) ** 2 / 10);
        for (let y = 0; y < h; y++) b.set(x, y, z, y === h - 1 ? [['grass_block', 3], ['podzol', 2], ['moss_block', 1]] : y < h - 3 ? 'stone' : 'dirt', { env: 1 });
      }
      // Комната
      b.walls(6, -1, 3, 12, 3, 9, [['rooted_dirt', 2], ['coarse_dirt', 2], ['dirt', 1]]);
      b.fill(7, -1, 4, 11, -1, 8, 'coarse_dirt').clear(7, 0, 4, 11, 2, 8);
      b.fill(6, 3, 3, 12, 3, 9, 'spruce_planks');
      for (const z of [3, 5, 7, 9]) b.fill(6, 3, z, 12, 3, z, 'stripped_spruce_log');
      b.fill(6, 0, 9, 12, 2, 9, [['spruce_log', 2], ['stripped_spruce_log', 1]]).door(9, 0, 9, 's').set(7, 1, 9, 'glass_pane', { f: 'n' });
      b.fill(6, 3, 10, 12, 3, 10, 'spruce_slab').fill(6, 0, 10, 6, 2, 10, 'spruce_fence').fill(12, 0, 10, 12, 2, 10, 'spruce_fence');
      b.fill(7, 0, 4, 7, 0, 5, 'hay_block').set(7, 1, 4, 'white_carpet');
      b.set(11, 0, 4, 'lectern', { f: 's' }).set(10, 0, 4, 'candle').set(8, 0, 8, 'candle');
      b.set(9, 1, 4, 'painting', { f: 'n' }).set(11, 0, 7, 'cauldron').set(11, 0, 8, 'barrel').set(7, 0, 8, 'flower_pot');
      b.set(8, 2, 6, 'hanging_roots').set(10, 2, 5, 'hanging_roots');
      b.each(7, 0, 4, 11, 0, 8, (x, y, z) => { if (!b.get(x, y, z) && b.chance(0.3)) b.set(x, y, z, 'moss_carpet'); });
      // Келья за стеной мха
      b.fill(9, 0, 3, 9, 1, 3, 'moss_block');
      b.clear(8, 0, 1, 10, 1, 2).fill(8, -1, 1, 10, -1, 2, 'coarse_dirt');
      b.set(9, 0, 1, 'chest').set(8, 0, 1, 'candle').set(10, 0, 2, 'decorated_pot');
      // Двор
      b.fill(13, 0, 11, 13, 0, 12, 'spruce_log').set(14, 0, 12, 'beehive').set(14, -1, 12, 'chest').set(13, 0, 13, 'cauldron');
      b.fill(14, 0, 9, 15, 1, 9, 'spruce_log');
      b.fill(3, 0, 12, 6, 0, 15, [['brown_mushroom', 2], ['red_mushroom', 1], ['sweet_berry_bush', 1]]);
      b.fill(5, 0, 16, 5, 2, 16, 'spruce_fence').set(4, 1, 16, 'spruce_fence').set(6, 1, 16, 'spruce_fence');
      for (let z = 11; z <= 18; z++) if (z % 2) b.set(9, -1, z, 'mossy_cobblestone', { env: 1 });
      b.spruce(1, 14, 10).spruce(17, 16, 9).spruce(16, 4, 7, 3).spruce(2, 3, 8, 3);
      b.scatter(0, 10, 18, 18, ['fern', 'large_fern'], 0.12);
      b.mark('secret', 9, 1, 3, 'Стена из мха', 'Задняя стена земляная, а за картиной на ней участок из мха. Сними картину, сруби мох, и откроется проход.');
      b.mark('slot', 9, 0, 1, 'Келья', 'Тесная комнатка за стеной: свеча, расписной горшок и сундук отшельника.');
      b.mark('clue', 11, 0, 4, 'Тетрадь отшельника', 'Кафедра. Обрывки мыслей, молитвы и карта к капищу.');
      b.mark('slot', 14, -1, 12, 'Под ульем', 'Закопано под ульем. Без дымаря полезешь — пчёлы покусают.');
      return b;
    },
  });
})();
