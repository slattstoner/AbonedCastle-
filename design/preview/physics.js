// «Физика» постройки для проверок без игры: где можно стоять и пройти,
// сколько света в каждой клетке, и автоподсветка тёмных мест факелами.
// Работает и в просмотрщике, и в сборщике (tools/build.js).
(function () {
  // Сквозь эти блоки не видно и свет не проходит — как у сплошных блоков игры.
  const NOT_SOLID = /leaves|glass|slab|stairs|fence|wall|pane|bars|door|trapdoor|carpet|sign|banner|ladder|frame|lantern|candle|torch|chain|bed|chest|campfire|cauldron|lectern|pot|skull|plant|fern|grass$|bush|mushroom|poppy|roots|web|sapling|potatoes|carrots|beetroot|water|cake|vine|plate|shelf$|lever|button|bell|stand|anvil|grindstone|enchanting|composter|azalea|dandelion|cornflower|allium|lily|daisy|bluet/;
  // Сквозь эти блоки можно пройти (ковры, свечи, факелы, двери и т. п.).
  const PASS = /carpet|_door$|banner|ladder|vine|candle|torch|poppy|dandelion|cornflower|allium|lily_of_the_valley|oxeye_daisy|azure_bluet|fern|short_grass|sapling|button|pressure_plate|sign|frame|cobweb|water|lantern|hanging_roots|mushroom|lever|iron_chain/;

  // Ниже слоя земли пустая клетка шаблона — это грунт мира, а не воздух.
  const EARTH = { id: 'dirt' };
  const cell = (b, x, y, z) => b.get(x, y, z) || (y <= -2 ? EARTH : undefined);

  function isOpaque(v) {
    if (!v || v.id === 'air') return false;
    const def = (window.BLOCKS || {})[v.id] || {};
    return (!def.s || def.s === 'shelf') && !def.t && !NOT_SOLID.test(v.id);
  }
  function passable(v) {
    if (!v || v.id === 'air') return true;
    if (/trapdoor|fence_gate/.test(v.id)) return !!v.open;
    return PASS.test(v.id);
  }
  // Сила света источника, как в Bedrock.
  function lightOf(v) {
    if (!v) return 0;
    const id = v.id;
    if (id === 'lantern' || id === 'copper_lantern' || id === 'campfire' || id === 'glowstone' || id === 'sea_lantern' || id === 'shroomlight') return 15;
    if (id === 'torch' || id === 'end_rod') return 14;
    if (id === 'soul_lantern' || id === 'soul_torch' || id === 'soul_campfire') return 10;
    if (/candle$/.test(id)) return v.lit ? 3 * (v.n || 1) : 0;
    if (id === 'brewing_stand') return 1;
    return 0;
  }

  // Освещение в коробке box = [x1, y1, z1, x2, y2, z2]: заливка от каждого источника.
  function makeLight(b, box) {
    const [x1, y1, z1, x2, y2, z2] = box;
    const X = x2 - x1 + 1, Y = y2 - y1 + 1, Z = z2 - z1 + 1;
    const L = new Uint8Array(X * Y * Z);
    const idx = (x, y, z) => ((x - x1) * Y + (y - y1)) * Z + (z - z1);
    const inBox = (x, y, z) => x >= x1 && x <= x2 && y >= y1 && y <= y2 && z >= z1 && z <= z2;
    const spread = (sx, sy, sz, lvl) => {
      if (!inBox(sx, sy, sz) || L[idx(sx, sy, sz)] >= lvl) return;
      const q = [[sx, sy, sz, lvl]];
      L[idx(sx, sy, sz)] = lvl;
      for (let h = 0; h < q.length; h++) {
        const [x, y, z, l] = q[h];
        if (l <= 1) continue;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (!inBox(nx, ny, nz)) continue;
          const i = idx(nx, ny, nz);
          if (L[i] >= l - 1 || isOpaque(cell(b, nx, ny, nz))) continue;
          L[i] = l - 1;
          q.push([nx, ny, nz, l - 1]);
        }
      }
    };
    for (const v of b.blocks.values()) { const l = lightOf(v); if (l && inBox(v.x, v.y, v.z)) spread(v.x, v.y, v.z, l); }
    return { at: (x, y, z) => (inBox(x, y, z) ? L[idx(x, y, z)] : 0), add: spread };
  }

  // Где может стоять игрок (клетка ног) и куда он дойдёт от стартовых клеток.
  function walk(b, box, starts) {
    const [x1, y1, z1, x2, y2, z2] = box;
    const get = (x, y, z) => cell(b, x, y, z);
    const pass = (x, y, z) => passable(get(x, y, z));
    const ladder = (x, y, z) => { const v = get(x, y, z); return !!v && (v.id === 'ladder' || v.id === 'water'); };
    const support = (x, y, z) => { const v = get(x, y, z); return !!v && v.id !== 'air' && (!passable(v) || v.id === 'ladder' || v.id === 'water'); };
    const stand = (x, y, z) => x >= x1 && x <= x2 && y >= y1 && y <= y2 && z >= z1 && z <= z2 &&
      pass(x, y, z) && pass(x, y + 1, z) && (support(x, y - 1, z) || ladder(x, y, z));
    const seen = new Set();
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const q = [];
    for (const [x, y, z] of starts) if (stand(x, y, z)) { seen.add(key(x, y, z)); q.push([x, y, z]); }
    const push = (x, y, z) => { const k = key(x, y, z); if (!seen.has(k)) { seen.add(k); q.push([x, y, z]); } };
    for (let h = 0; h < q.length; h++) {
      const [x, y, z] = q[h];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (pass(x, y + 2, z) && stand(nx, y + 1, nz)) push(nx, y + 1, nz);
        if (stand(nx, y, nz)) { push(nx, y, nz); continue; }
        if (pass(nx, y, nz) && pass(nx, y + 1, nz)) {
          for (let ny = y - 1; ny >= y - 6; ny--) { if (stand(nx, ny, nz)) { push(nx, ny, nz); break; } if (!pass(nx, ny, nz)) break; }
        }
      }
      if (ladder(x, y, z) || ladder(x, y + 1, z)) { if (stand(x, y + 1, z) || (pass(x, y + 1, z) && pass(x, y + 2, z))) push(x, y + 1, z); }
      if (ladder(x, y - 1, z) || (pass(x, y - 1, z) && ladder(x, y, z))) if (pass(x, y - 1, z)) push(x, y - 1, z);
      if (!support(x, y - 1, z) && !ladder(x, y, z) && pass(x, y - 1, z)) push(x, y - 1, z);
    }
    const cells = [...seen].map((k) => k.split(',').map(Number)).filter(([x, y, z]) => stand(x, y, z));
    return { cells, has: (x, y, z) => seen.has(key(x, y, z)) && stand(x, y, z), stand };
  }

  // Под крышей ли клетка: сверху до верха коробки есть сплошной блок.
  function roofed(b, x, y, z, top) {
    for (let yy = y + 2; yy <= Math.min(top, y + 12); yy++) if (isOpaque(cell(b, x, yy, z))) return true;
    return false;
  }

  const NO_TORCH = /barrel|bookshelf|chest|wool|hay_block|furnace|smoker|noteblock|jukebox|crafting|cartography|fletching|smithing|loom|packed_ice|target|gold_block|brick_block/;

  // Автоподсветка: пока в доступных клетках под крышей темнее порога,
  // вешаем настенный факел на ближайшую стену (на высоте двух блоков над полом).
  function autoLight(b, o) {
    const { box, starts, need, max = 1500 } = o;
    const W = walk(b, box, starts);
    const light = makeLight(b, box);
    const inside = W.cells.filter(([x, y, z]) => { const v = b.get(x, y, z); return !(v && v.id === 'water') && roofed(b, x, y, z, box[4]) && (!o.skip || !o.skip(x, y, z)); });
    const placed = [];
    const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
    const free = (x, y, z) => { const v = cell(b, x, y, z); return !v || v.id === 'air'; };
    for (let round = 0; round < max; round++) {
      let worst = null, wl = 99;
      for (const c of inside) { const l = light.at(...c); const n = need(...c); if (l < n && l < wl) { wl = l; worst = c; } }
      if (!worst) break;
      const [cx, cy, cz] = worst;
      let best = null, bd = 99;
      for (let r = 0; r <= 4 && !best; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (const ty of [cy + 2, cy + 1]) {
          const tx = cx + dx, tz = cz + dz;
          if (!free(tx, ty, tz) || (o.placeOk && !o.placeOk(tx, ty, tz))) continue;
          // не в дверном проёме и не в узком лазе
          if ((isOpaque(cell(b, tx + 1, ty, tz)) && isOpaque(cell(b, tx - 1, ty, tz))) || (isOpaque(cell(b, tx, ty, tz + 1)) && isOpaque(cell(b, tx, ty, tz - 1)))) continue;
          for (const [f, [sx, sz]] of Object.entries(STEP)) {
            const wall = b.get(tx + sx, ty, tz + sz);
            if (!isOpaque(wall) || NO_TORCH.test(wall.id)) continue; // крепим только к настоящей стене, не к бочке или шкафу
            const d = Math.abs(dx) + Math.abs(dz) + (ty === cy + 2 ? 0 : 0.5);
            if (d < bd) { bd = d; best = [tx, ty, tz, f]; }
          }
        }
      }
      if (!best) {
        // Нет стены рядом — фонарь под потолком
        for (let yy = cy + 3; yy <= cy + 8; yy++) if (isOpaque(cell(b, cx, yy, cz))) { if (free(cx, yy - 1, cz) && b.get(cx, yy, cz) && (!o.placeOk || o.placeOk(cx, yy - 1, cz))) best = [cx, yy - 1, cz, null]; break; }
        if (!best) { inside.splice(inside.indexOf(worst), 1); continue; }
        b.set(best[0], best[1], best[2], 'lantern', { hang: 1 });
        light.add(best[0], best[1], best[2], 15);
      } else {
        b.set(best[0], best[1], best[2], 'torch', { f: best[3] });
        light.add(best[0], best[1], best[2], 14);
      }
      placed.push(best);
    }
    return { placed, light, walk: W, inside };
  }

  // Пол, а не мебель: на крышке шкафа, столе или кровати игрок не живёт.
  const FURNITURE = /barrel|bookshelf|wool|chest|_bed|hay_block|packed_ice|brick_block|fence|lectern|cauldron|anvil|composter|furnace|smoker|noteblock|jukebox|target|gold_block|chiseled_stone_bricks|crafting|cartography|fletching|smithing|loom|grindstone|bell|enchanting|campfire|decorated_pot|skull|spruce_stairs|dark_oak_stairs|stripped_spruce_log|^cobblestone$|bone_block|polished_deepslate|polished_blackstone|smooth_stone_slab|iron_bars|leaves|bed/;
  function isFloor(v) {
    if (!v || v.id === 'air') return false;
    if (/slab/.test(v.id) && v.h === 'top') return false;
    return !FURNITURE.test(v.id);
  }
  window.CastlePhysics = { isOpaque, passable, lightOf, makeLight, walk, roofed, autoLight, isFloor };
})();
