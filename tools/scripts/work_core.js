// Работники замка: чистые правила без обращения к игре (их проверяет tools/test/sim.mjs).
//  • добыча — что даёт блок при добыче киркой без чар, как в игре;
//  • план шахты — винтовой ствол лесенкой, горизонты, штрек и ветки;
//  • рельсы — направление рельса на каждой клетке ствола;
//  • материалы строителя — какой блок к какому разряду склада относится;
//  • поиск пути (A*) — по клеткам, где можно стоять.
// Подход «лесенка + ветки» — как копают игроки (branch mining); A* — обычный, по сетке блоков.

const bare = (id) => id.replace(/^minecraft:/, '');

// ---------- Добыча ----------
// Какая кирка нужна для руды: 1 — каменная, 2 — железная, 3 — алмазная
export const TIERS = { wooden: 0, stone: 1, golden: 0, iron: 2, diamond: 3, netherite: 4 };
// Сколько блоков служит кирка у мастера (в 5 раз дольше обычного, см. docs/workers.md)
export const TOOL_USES = { wooden: 59, stone: 131, golden: 32, iron: 250, diamond: 1561, netherite: 2031 };
export const WEAR = 5;
// Время на блок, тиков (20 тиков — секунда): чем лучше кирка, тем быстрее
export const DIG_TICKS = { wooden: 80, stone: 60, golden: 50, iron: 40, diamond: 20, netherite: 15 };
const ORE = {
  coal: ['coal', 1, 1, 1], iron: ['raw_iron', 1, 1, 1], copper: ['raw_copper', 2, 5, 1], gold: ['raw_gold', 1, 1, 2],
  redstone: ['redstone', 4, 5, 2], lapis: ['lapis_lazuli', 4, 9, 1], diamond: ['diamond', 1, 1, 2], emerald: ['emerald', 1, 1, 2],
};
export function oreOf(id) {
  const m = /^(?:lit_)?(?:deepslate_)?(?:lit_)?(coal|iron|copper|gold|redstone|lapis|diamond|emerald)_ore$/.exec(bare(id));
  return m ? m[1] : null;
}
export const isOre = (id) => !!oreOf(id);
// Что выпадает. rnd() — случайное число 0…1. tier — уровень кирки.
// Возвращает [[предмет, сколько], …]; пусто — ничего не выпало (не та кирка, трава, вода).
export function dropOf(id, tier, rnd = Math.random) {
  const b = bare(id), ore = oreOf(id);
  if (ore) {
    const [item, lo, hi, need] = ORE[ore];
    if (tier < need) return [];
    return [['minecraft:' + item, lo + Math.floor(rnd() * (hi - lo + 1))]];
  }
  if (/^(air|cave_air|void_air|water|flowing_water|lava|flowing_lava|light_block.*|short_grass|tall_grass|fern|large_fern|deadbush|vine|glow_lichen|snow_layer|moss_carpet|cobweb|.*infested.*|fire|hanging_roots|small_dripleaf_block|big_dripleaf|sculk_vein)$/.test(b)) return [];
  if (b === 'stone') return [['minecraft:cobblestone', 1]];
  if (b === 'deepslate') return [['minecraft:cobbled_deepslate', 1]];
  if (/^(grass_block|podzol|mycelium|dirt_with_roots|farmland|grass_path)$/.test(b)) return [['minecraft:dirt', 1]];
  if (b === 'gravel') return [[rnd() < 0.1 ? 'minecraft:flint' : 'minecraft:gravel', 1]];
  if (b === 'clay') return [['minecraft:clay_ball', 4]];
  if (b === 'obsidian') return tier >= 3 ? [['minecraft:obsidian', 1]] : [];
  if (/^(lit_)?redstone_ore$/.test(b)) return [];
  return [['minecraft:' + b, 1]];
}
// Сыпучее: сверху над ходом его нужно выбрать, иначе осыплется
export const FALLING = /(^|:)(sand|red_sand|gravel|suspicious_sand|suspicious_gravel|.*concrete_powder|pointed_dripstone)$/;
export const LIQUID = /(^|:)(flowing_)?(water|lava)$/;
export const isAirId = (id) => /(^|:)(air|cave_air|void_air)$/.test(id);
// Чужое: на такое шахтёр не копает, а останавливается (старая шахта, древний город, крепость,
// сундук, клетка с монстрами, коренная порода)
export const FOREIGN = /(^|:)(bedrock|barrier|mob_spawner|trial_spawner|vault|chest|trapped_chest|barrel|rail|golden_rail|detector_rail|activator_rail|.*_planks|.*_fence|cobweb|sculk.*|reinforced_deepslate|.*_tiles|.*bricks|bookshelf|end_portal_frame|crying_obsidian|budding_amethyst|amethyst_block|structure_block|command_block|.*_door|torch|.*lantern)$/;
// Чем шахтёр заделывает дыры (лава, вода, пещеры): что есть в сумке из этого — тем и кладёт
export const FILLER = ['minecraft:cobblestone', 'minecraft:cobbled_deepslate', 'minecraft:andesite', 'minecraft:diorite', 'minecraft:granite', 'minecraft:tuff', 'minecraft:dirt'];

// ---------- План шахты ----------
// Кольцо ствола 5×5 вокруг столба 3×3. Шаг i: клетка кольца P[i % 16]; углы (i % 4 == 0) —
// ровные площадки, на сторонах — по блоку вниз за шаг. Уровень шага: −(i − ⌊i/4⌋), за виток
// −12. Клетка ствола — 3 блока высотой (чтобы и человек прошёл, и вагонетка).
export function ringCells([x1, z1, x2, z2]) {
  const P = [];
  for (let x = x1; x < x2; x++) P.push([x, z1]);
  for (let z = z1; z < z2; z++) P.push([x2, z]);
  for (let x = x2; x > x1; x--) P.push([x, z2]);
  for (let z = z2; z > z1; z--) P.push([x1, z]);
  return P;
}
export const shaftLevel = (i) => -(i - Math.floor(i / 4));
export function shaftCell(ring, i) { const P = ringCells(ring); const [x, z] = P[i % P.length]; return [x, shaftLevel(i), z]; }
// Номер шага ствола, на котором начинается горизонт: угол на стороне x1 (оттуда штрек идёт
// наружу, прочь от донжона) с уровнем не выше depth (depth — отрицательный, от поверхности).
export function horizonStep(depth) {
  for (let i = 0; i < 4000; i += 4) { const k = i % 16; if ((k === 0 || k === 12) && shaftLevel(i) <= depth) return i; }
  return -1;
}
// Горизонты: 1-й — 16 блоков под двором; 2-й — y мира 16; 3-й — y мира −58 (не ниже −60).
// surfaceY — высота пола двора в мире. Возвращает шаги ствола для каждого горизонта.
export function horizons(surfaceY) {
  const out = [];
  const add = (worldY, title) => {
    let i = horizonStep(worldY - surfaceY);
    if (i < 0) return;
    while (i > 0 && surfaceY + shaftLevel(i) < -60) i -= 4;
    while (i > 0 && ![0, 12].includes(i % 16)) i -= 4;
    if (out.length && i <= out[out.length - 1].step + 8) return; // слишком близко к прежнему
    out.push({ step: i, y: surfaceY + shaftLevel(i), title });
  };
  add(surfaceY - 16, '1-й горизонт');
  add(16, '2-й горизонт');
  add(-58, 'Глубинный горизонт');
  return out;
}
// Штрек: от угла горизонта на запад (−x), длина DRIFT; ветки — через каждые 4 клетки штрека,
// на север и юг, длиной BRANCH. Высота хода — 2.
export const DRIFT = 32, BRANCH = 12, BRANCH_EVERY = 4;
export const driftCell = (corner, d) => [corner[0] - 1 - d, corner[1], corner[2]];
export const branchCell = (corner, d, side, b) => [corner[0] - 1 - d, corner[1], corner[2] + side * (1 + b)];
export const hasBranch = (d) => d % BRANCH_EVERY === BRANCH_EVERY - 1;
// Факел: на стене хода у головы (стена — сбоку), через каждые 6 клеток
export const TORCH_EVERY = 6;

// ---------- Рельсы ----------
// Направления рельса в игре: 0 — север-юг, 1 — восток-запад, 2…5 — подъём на восток, запад,
// север, юг, 6…9 — поворот юг-восток, юг-запад, север-запад, север-восток.
// На стороне ствола рельс поднимается к предыдущей (более высокой) клетке, на углу — поворот.
export function shaftRail(i) {
  const k = i % 16;
  if (k === 0) return 6; if (k === 4) return 7; if (k === 8) return 8; if (k === 12) return 9;
  return k < 4 ? 3 : k < 8 ? 4 : k < 12 ? 2 : 5;
}
// Факел у столба на середине стороны ствола: в какой стороне стена (столб)
export function shaftTorch(i) {
  const k = i % 16;
  if (k !== 2 && k !== 6 && k !== 10 && k !== 14) return null;
  return k === 2 ? 'south' : k === 6 ? 'west' : k === 10 ? 'north' : 'east';
}

// ---------- Материалы строителя ----------
// Разряды склада: камень, дерево, стекло, железо; мелочь (фонари, факелы, знамёна) — бесплатно
export function catOf(id) {
  const b = bare(id);
  if (/glass/.test(b)) return 'glass';
  if (/bars|chain/.test(b)) return 'iron';
  if (/log|plank|fence|spruce|oak|birch|_wood$|trapdoor|_door|ladder|scaffolding/.test(b)) return 'wood';
  if (/stone|brick|cobble|andesite|diorite|granite|tuff|deepslate|calcite|polished|blackstone/.test(b)) return 'stone';
  return 'other';
}
export const CAT_NAME = { stone: 'камень', wood: 'дерево', glass: 'стекло', iron: 'железо', other: 'мелочь' };
// Сколько единиц разряда даёт предмет со склада: бревно — 4 доски, слиток — 2 решётки
export function unitsOf(itemId) {
  const b = bare(itemId);
  if (/(^|_)(log|wood|stem)$/.test(b)) return ['wood', 4];
  if (/planks$/.test(b)) return ['wood', 1];
  if (b === 'stick') return null;
  if (/^(cobblestone|mossy_cobblestone|stone|stone_bricks|mossy_stone_bricks|cracked_stone_bricks|cobbled_deepslate|deepslate|andesite|diorite|granite|tuff|polished_andesite|smooth_stone|blackstone)$/.test(b)) return ['stone', 1];
  if (/^(glass|glass_pane)$/.test(b)) return ['glass', 1];
  if (b === 'iron_ingot') return ['iron', 2];
  if (b === 'iron_bars') return ['iron', 1];
  return null;
}
// Что возвращается на склад, когда строитель разбирает блок (завал, частокол, леса)
export function reclaimOf(id) {
  const b = bare(id);
  if (/^(cobblestone|mossy_cobblestone|stone|stone_bricks|mossy_stone_bricks|cracked_stone_bricks|andesite|tuff|cobbled_deepslate)$/.test(b)) return 'stone';
  if (/(cobblestone|stone_brick)_slab$/.test(b)) return null; // половинки бьются
  if (/^spruce_log$|^spruce_planks$/.test(b)) return 'wood';
  return null;
}
// Что лучше ставить после всего остального (держится за соседей)
export const ATTACHED = /torch|lantern|ladder|banner|vine|carpet|sign|button|lever|rail|flower|short_grass|fern|candle|chain|frame|pressure_plate|trapdoor|_door/;

// ---------- Поиск пути ----------
// A* по клеткам, где можно стоять. stand(x, y, z) → можно ли стоять (пол внизу, ноги и голова
// свободны). Шаги: на соседнюю клетку (4 стороны), вверх на 1, вниз до 3. Работает по кускам:
// search.step(budget) возвращает путь, null (пути нет) или undefined (ещё ищем).
// stand.climb(x, y, z) — клетка лесов или лестницы: по ней можно лезть вверх и вниз.
export function makeSearch(from, to, stand, { maxNodes = 4000, near = 1.5 } = {}) {
  const K = (p) => p[0] + ',' + p[1] + ',' + p[2];
  const h = (p) => Math.abs(p[0] - to[0]) + Math.abs(p[2] - to[2]) + Math.abs(p[1] - to[1]) * 1.5;
  const open = [[h(from), 0, from]], came = new Map([[K(from), null]]), cost = new Map([[K(from), 0]]);
  let seen = 0;
  const pop = () => { let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; return open.splice(bi, 1)[0]; };
  return {
    step(budget) {
      while (budget-- > 0) {
        if (!open.length || seen > maxNodes) return null;
        const [, g, p] = pop();
        seen++;
        if (Math.abs(p[0] - to[0]) + Math.abs(p[2] - to[2]) <= near && Math.abs(p[1] - to[1]) <= 1) {
          const path = [];
          for (let c = p; c; c = came.get(K(c))) path.push(c);
          return path.reverse();
        }
        // по лесам и лестницам — вверх и вниз
        if (stand.climb) for (const dy of [1, -1]) {
          const n = [p[0], p[1] + dy, p[2]];
          if (!stand.climb(...n) && !(dy === 1 && stand.climb(...p) && stand(...n))) continue;
          const k = K(n), ng = g + 1.2;
          if (cost.has(k) && cost.get(k) <= ng) continue;
          cost.set(k, ng); came.set(k, p); open.push([ng + h(n), ng, n]);
        }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          for (const dy of [0, 1, -1, -2, -3]) {
            const n = [p[0] + dx, p[1] + dy, p[2] + dz];
            if (!stand(...n) && !(dy === 0 && stand.climb && stand.climb(...n))) continue;
            // подъём: над головой на старой клетке должно быть свободно
            if (dy === 1 && !stand.headroom(p[0], p[1] + 2, p[2])) continue;
            const k = K(n), ng = g + 1 + (dy ? 0.5 : 0);
            if (cost.has(k) && cost.get(k) <= ng) break;
            cost.set(k, ng); came.set(k, p); open.push([ng + h(n), ng, n]);
            break;
          }
        }
      }
      return undefined;
    },
  };
}
