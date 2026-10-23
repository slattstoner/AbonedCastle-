// Замок из замшелого камня — эскиз архитектуры (без историй и тайников).
// Лежит отдельно от structures/, чтобы сборщик аддона его пока не трогал.
// Главное здание — квадратный донжон с четырьмя угловыми башнями (второй образец),
// остальные постройки двора — в стиле первого образца: каменный каркас,
// заполнение булыжником, серые крыши с еловой окантовкой, фонари на кронштейнах.
(function () {
  const STONE = [['stone_bricks', 6], ['mossy_stone_bricks', 3], ['cracked_stone_bricks', 2]];
  const MOSSY = [['mossy_stone_bricks', 4], ['stone_bricks', 3], ['mossy_cobblestone', 2], ['cracked_stone_bricks', 1]];
  const RUBBLE = [['cobblestone', 4], ['mossy_cobblestone', 3], ['andesite', 2], ['stone', 1]];
  const FRAME = [['stone_bricks', 5], ['mossy_stone_bricks', 2]];
  const ROOF = [['cobblestone_stairs', 3], ['stone_brick_stairs', 2], ['mossy_cobblestone_stairs', 2]];
  // Камень подземелья: серый кирпич, замшелый и треснувший, булыжник. Пол — булыжник с гравием.
  const CATA = [['stone_bricks', 5], ['mossy_stone_bricks', 3], ['cracked_stone_bricks', 2], ['cobblestone', 1], ['mossy_cobblestone', 1]];
  const CATA_FLOOR = [['cobblestone', 3], ['stone_bricks', 2], ['mossy_cobblestone', 2], ['gravel', 1], ['andesite', 1], ['cracked_stone_bricks', 1]];
  const PAVE = [['polished_andesite', 3], ['stone_bricks', 2], ['andesite', 1]];
  const PLANKS = [['spruce_planks', 3], ['dark_oak_planks', 1]];
  const YARD = [['gravel', 3], ['cobblestone', 2], ['coarse_dirt', 2], ['mossy_cobblestone', 1], ['grass_path', 1]];
  const S = (y) => (y < 3 ? MOSSY : STONE);

  // ---------- Простые формы ----------
  function box(x1, y1, z1, x2, y2, z2, fn) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) fn(x, y, z);
  }
  const solid = (w, x1, y1, z1, x2, y2, z2, pal) => box(x1, y1, z1, x2, y2, z2, (x, y, z) => w.set(x, y, z, pal || S(y)));
  const air = (w, x1, y1, z1, x2, y2, z2) => box(x1, y1, z1, x2, y2, z2, (x, y, z) => w.set(x, y, z, 'air'));
  const ring = (w, x1, y1, z1, x2, y2, z2, pal) => box(x1, y1, z1, x2, y2, z2, (x, y, z) => {
    if (x === x1 || x === x2 || z === z1 || z === z2) w.set(x, y, z, pal || S(y));
  });
  // Зубцы: сплошной парапет на y и зубцы через один на y + 1.
  function crenel(w, x1, z1, x2, z2, y, pal = STONE) {
    ring(w, x1, y, z1, x2, y, z2, pal);
    box(x1, y + 1, z1, x2, y + 1, z2, (x, yy, z) => {
      if ((x === x1 || x === x2 || z === z1 || z === z2) && (x + z) % 2 === 0) w.set(x, yy, z, pal);
    });
  }
  // Консоли (перевёрнутые ступени) — верх стены выступает на блок наружу.
  function corbels(w, x1, z1, x2, z2, y) {
    const st = 'stone_brick_stairs';
    for (let x = x1; x <= x2; x++) { w.set(x, y, z1 - 1, st, { h: 'top', f: 's' }); w.set(x, y, z2 + 1, st, { h: 'top', f: 'n' }); }
    for (let z = z1; z <= z2; z++) { w.set(x1 - 1, y, z, st, { h: 'top', f: 'e' }); w.set(x2 + 1, y, z, st, { h: 'top', f: 'w' }); }
    for (const [x, z] of [[x1 - 1, z1 - 1], [x2 + 1, z1 - 1], [x1 - 1, z2 + 1], [x2 + 1, z2 + 1]]) w.set(x, y, z, STONE);
  }
  // Верх башни: консоли, площадка, зубчатый парапет на выступе.
  function battlements(w, x1, z1, x2, z2, top) {
    corbels(w, x1, z1, x2, z2, top);
    solid(w, x1, top, z1, x2, top, z2, STONE);
    crenel(w, x1 - 1, z1 - 1, x2 + 1, z2 + 1, top + 1);
  }
  // Шатровая крыша: кольца ступеней сходятся к верху, нижний ряд — еловый.
  function pyramid(w, x1, z1, x2, z2, y, o = {}) {
    for (let i = 0; ; i++) {
      const ax = x1 + i, bx = x2 - i, az = z1 + i, bz = z2 - i, yy = y + i;
      if (ax > bx || az > bz) break;
      if (ax === bx || az === bz) { box(ax, yy, az, bx, yy, bz, (x, _, z) => w.set(x, yy, z, o.top || 'spruce_slab')); break; }
      const st = i === 0 ? 'spruce_stairs' : o.stair || ROOF;
      for (let x = ax; x <= bx; x++) { w.set(x, yy, az, st, { f: 's' }); w.set(x, yy, bz, st, { f: 'n' }); }
      for (let z = az + 1; z < bz; z++) { w.set(ax, yy, z, st, { f: 'e' }); w.set(bx, yy, z, st, { f: 'w' }); }
    }
  }
  // Двускатная крыша первого образца: серый камень, еловые свесы и конёк.
  function roof(b, x1, z1, x2, z2, y, axis = 'x', over = 1) {
    const changed = [];
    const orig = b.set;
    b.set = function (x, yy, z, id, p) { changed.push([x, yy, z]); return orig.call(this, x, yy, z, id, p); };
    b.gable(x1, z1, x2, z2, y, { axis, stair: ROOF, slab: 'spruce_slab', fill: RUBBLE, over });
    b.set = orig;
    for (const [x, yy, z] of changed) {
      const v = b.get(x, yy, z);
      if (!v || !/stairs/.test(v.id)) continue;
      const verge = axis === 'x' ? x === x1 - over || x === x2 + over : z === z1 - over || z === z2 + over;
      if (yy === y || verge) v.id = 'spruce_stairs';
    }
    // Заделать щель между верхом стены и скатом.
    if (axis === 'x') for (let x = x1; x <= x2; x++) { b.set(x, y, z1, FRAME); b.set(x, y, z2, FRAME); }
    else for (let z = z1; z <= z2; z++) { b.set(x1, y, z, FRAME); b.set(x2, y, z, FRAME); }
  }
  // Фонарь на кронштейне: забор торчит из стены, фонарь висит под ним.
  const lamp = (w, x, y, z) => { w.set(x, y + 1, z, 'spruce_fence'); w.set(x, y, z, 'lantern', { hang: 1 }); };
  // Окно в стене: стекло или решётка высотой h.
  const win = (w, x, y, z, h = 2, id = 'glass_pane') => { for (let i = 0; i < h; i++) w.set(x, y + i, z, id); };
  const doorway = (w, x, y, z, h = 2) => { for (let i = 0; i < h; i++) w.set(x, y + i, z, 'air'); };

  // Клетки кольца вокруг столба по часовой стрелке, начиная с (x, z).
  function ringCells(x1, z1, x2, z2, start, ccw) {
    const out = [];
    for (let x = x1; x < x2; x++) out.push([x, z1]);
    for (let z = z1; z < z2; z++) out.push([x2, z]);
    for (let x = x2; x > x1; x--) out.push([x, z2]);
    for (let z = z2; z > z1; z--) out.push([x1, z]);
    if (ccw) out.reverse();
    const k = out.findIndex(([x, z]) => x === start[0] && z === start[1]);
    return out.slice(k).concat(out.slice(0, k));
  }

  // Плющ и кусты: лоза свисает со стен, листва у подножия.
  function overgrow(b, x1, z1, x2, z2, yTop, n) {
    const faces = [];
    for (let x = x1; x <= x2; x++) { faces.push([x, z1 - 1, 's']); faces.push([x, z2 + 1, 'n']); }
    for (let z = z1; z <= z2; z++) { faces.push([x1 - 1, z, 'e']); faces.push([x2 + 1, z, 'w']); }
    for (let i = 0; i < n; i++) {
      const [x, z, f] = faces[Math.floor(b.r() * faces.length)];
      const top = 2 + Math.floor(b.r() * (yTop - 2));
      const len = 2 + Math.floor(b.r() * 6);
      const [dx, dz] = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[f];
      for (let y = top; y > top - len && y >= 0; y--) {
        const wall = b.get(x + dx, y, z + dz);
        if (b.get(x, y, z) || !wall || /pane|bars|door|air/.test(wall.id)) break;
        b.set(x, y, z, 'vine', { f });
      }
      // куст у подножия, но не перед дверью
      const nearDoor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, az]) => { const n = b.get(x + ax, 0, z + az); return n && /_door$/.test(n.id); });
      if (b.chance(0.5) && !b.get(x, 0, z) && !nearDoor) b.set(x, 0, z, ['oak_leaves', 'azalea_leaves', 'azalea_leaves_flowered']);
    }
  }

  // Дом первого образца: каменный каркас (углы и столбы через step),
  // заполнение булыжником, двускатная крыша. open — открытые стороны (навес).
  function house(b, x1, z1, x2, z2, h, o = {}) {
    const open = o.open || '', step = o.step || 4;
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
      const ex = x === x1 || x === x2, ez = z === z1 || z === z2;
      if (!ex && !ez) { b.set(x, -1, z, o.floor || PLANKS); continue; }
      b.set(x, -1, z, FRAME);
      const side = z === z1 ? 'n' : z === z2 ? 's' : x === x1 ? 'w' : 'e';
      const pillar = (ex && ez) || (ez && (x - x1) % step === 0) || (ex && (z - z1) % step === 0);
      for (let y = 0; y <= h; y++) {
        if (open.includes(side) && !pillar && y < h) continue;
        b.set(x, y, z, pillar || y === h ? FRAME : RUBBLE);
      }
    }
    if (o.mid) b.fill(x1 + 1, o.mid, z1 + 1, x2 - 1, o.mid, z2 - 1, PLANKS);
    if (o.roof !== false) roof(b, x1, z1, x2, z2, h + 1, o.axis || 'x');
  }

  // Смещённый «вид» на конструктор: донжон удобно описывать от своего угла.
  function at(b, ox, oz) {
    return {
      set: (x, y, z, id, p) => b.set(x + ox, y, z + oz, id, p),
      get: (x, y, z) => b.get(x + ox, y, z + oz),
      fill: (x1, y1, z1, x2, y2, z2, id, p) => b.fill(x1 + ox, y1, z1 + oz, x2 + ox, y2, z2 + oz, id, p),
      door: (x, y, z, f, id, open) => b.door(x + ox, y, z + oz, f, id, open),
      bed: (x, y, z, dx, dz, id) => b.bed(x + ox, y, z + oz, dx, dz, id),
      room: (x, y, z, title, desc) => b.mark('room', x + ox, y, z + oz, title, desc),
      mark: (t, x, y, z, title, desc) => b.mark(t, x + ox, y, z + oz, title, desc),
    };
  }

  // Винтовая лестница шириной в два блока вокруг столба 5×5 в башне 9×9.
  // a..b, c..d — внутренность башни; laps — пары [откуда, куда] (высота, на которой стоит игрок).
  function spiral2(w, a, c, b, d, start, ccw, laps, floorY) {
    const inner = ringCells(a + 1, c + 1, b - 1, d - 1, start, ccw);
    const group = {};
    for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) {
      if (x > a && x < b && z > c && z < d) continue;
      const k = Math.min(Math.max(x, a + 1), b - 1) + ',' + Math.min(Math.max(z, c + 1), d - 1);
      (group[k] = group[k] || []).push([x, z]);
    }
    const steps = [];
    for (const [s0, s1] of laps) inner.forEach(([x, z], k) => steps.push({ x, z, s: s0 + Math.round((k * (s1 - s0)) / (inner.length - 1)) }));
    const dir = (p, q) => (q.x > p.x ? 'e' : q.x < p.x ? 'w' : q.z > p.z ? 's' : 'n');
    const cellsOf = (st) => [[st.x, st.z], ...(group[st.x + ',' + st.z] || [])];
    steps.forEach((st) => cellsOf(st).forEach(([x, z]) => { for (let y = st.s; y <= st.s + 2; y++) w.set(x, y, z, 'air'); }));
    const last = {};
    steps.forEach((st, i) => {
      const p = steps[i - 1];
      let id = 'stone_bricks', f;
      if (p && p.s !== st.s) { id = 'stone_brick_stairs'; f = st.s > p.s ? dir(p, st) : dir(st, p); }
      cellsOf(st).forEach(([x, z]) => {
        const key = x + ',' + z;
        const from = last[key] !== undefined ? last[key] + 3 : floorY;
        for (let y = from; y <= st.s - 2; y++) w.set(x, y, z, STONE);
        last[key] = st.s;
        w.set(x, st.s - 1, z, id, f ? { f } : undefined);
      });
    });
    return steps;
  }

  // Перенос куска, построенного в своих координатах, на место (часовня с кладбищем).
  function stamp(b, dx, dz, fn) {
    const t = new Builder(17);
    t.r = b.r;
    t.carve = true;
    fn(t);
    for (const v of t.blocks.values()) { const { x, y, z, id, ...p } = v; b.set(x + dx, y, z + dz, id, p); }
    for (const m of t.marks) b.mark(m.type, m.x + dx, m.y, m.z + dz, m.title, m.desc);
  }

  const hangL = (w, x, y, z) => w.set(x, y, z, 'lantern', { hang: 1 });
  const chandL = (w, x, top, z, len = 3) => { w.fill(x, top - len + 1, z, x, top, z, 'iron_chain'); hangL(w, x, top - len, z); };
  const tableL = (w, x1, y, z1, x2, z2, id = 'dark_oak_slab') => w.fill(x1, y, z1, x2, y, z2, id, { h: 'top' });
  const INNER = [['stone_bricks', 6], ['cracked_stone_bricks', 1], ['mossy_stone_bricks', 1]];
  const BEAMS = (x) => (x % 4 === 1 ? ['dark_oak_log', { a: 'z' }] : [PLANKS]);

  // ---------- Мебель и свет (донжон, библиотека) ----------
  // Сила света в игре: фонарь и костёр 15, факел 14, фонарь душ 10,
  // свеча 3 на каждую свечку в пучке (до 12). С каждым блоком свет слабеет на 1.
  const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
  const HERALD = [['bo', 11], ['flo', 11]]; // герб рода: жёлтая кайма и цветок на красном
  const kit = (w) => ({
    // Стул-ступень: look — куда смотрит сидящий
    chair: (x, y, z, look, wood = 'dark_oak') => w.set(x, y, z, wood + '_stairs', { f: OPP[look], fur: 1 }),
    bench: (x1, z1, x2, z2, y, look, wood = 'spruce') => box(x1, y, z1, x2, y, z2, (x, yy, z) => w.set(x, yy, z, wood + '_stairs', { f: OPP[look], fur: 1 })),
    // Столешница из верхних плит
    table: (x1, y, z1, x2, z2, id = 'dark_oak_slab') => w.fill(x1, y, z1, x2, y, z2, id, { h: 'top', fur: 1 }),
    // Столик на ножке: забор и нажимная плита
    stand: (x, y, z, plate = 'dark_oak_pressure_plate') => { w.set(x, y, z, 'dark_oak_fence', { fur: 1 }); w.set(x, y + 1, z, plate); },
    candle: (x, y, z, n = 3, id = 'candle') => w.set(x, y, z, id, { lit: 1, n }),
    // Подсвечник: забор с пучком свечей сверху
    candlestand: (x, y, z, n = 4) => { w.set(x, y, z, 'dark_oak_fence', { fur: 1 }); w.set(x, y + 1, z, 'candle', { lit: 1, n }); },
    torch: (x, y, z, wall) => w.set(x, y, z, 'torch', { f: wall }),
    hang: (x, y, z, id = 'lantern') => w.set(x, y, z, id, { hang: 1 }),
    // Люстра: цепь от потолка (ceil — высота блока потолка), крестовина из забора,
    // фонари на концах и в центре
    chandelier: (x, ceil, z, drop = 1, arm = 1, center = true) => {
      for (let y = ceil - drop; y < ceil; y++) w.set(x, y, z, 'iron_chain');
      const y0 = ceil - drop - 1;
      w.set(x, y0, z, 'dark_oak_fence');
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = 1; k <= arm; k++) w.set(x + dx * k, y0, z + dz * k, 'dark_oak_fence');
        w.set(x + dx * arm, y0 - 1, z + dz * arm, 'lantern', { hang: 1 });
      }
      if (center) w.set(x, y0 - 1, z, 'lantern', { hang: 1 });
    },
    // Шкаф: две бочки дверцами наружу
    wardrobe: (x, y, z, look) => { w.set(x, y, z, 'barrel', { f: look }); w.set(x, y + 1, z, 'barrel', { f: look }); },
    shelf: (x, y, z, look) => w.set(x, y, z, 'dark_oak_shelf', { f: look, fur: 1 }),
    // Ковёр с каймой: только на пустой пол (или поверх другого ковра), мебель не затирает
    rug: (x1, z1, x2, z2, y, inner, border) => box(x1, y, z1, x2, y, z2, (x, yy, z) => {
      const v = w.get(x, yy, z);
      if (v && v.id !== 'air' && !/carpet/.test(v.id)) return;
      w.set(x, yy, z, border && (x === x1 || x === x2 || z === z1 || z === z2) ? border : inner);
    }),
    // Гербовое знамя на стене (wall — сторона стены)
    herald: (x, y, z, wall) => w.set(x, y, z, 'red_banner', { f: wall, pat: HERALD }),
    // Оружие или доспех в рамке на стене
    arms: (x, y, z, wall, item) => w.set(x, y, z, 'item_frame', { f: wall, item }),
    // Кровать под балдахином: x1..x2, z1..z2 — столбики по углам, сверху ткань
    canopy: (x1, z1, x2, z2, y, wool) => {
      for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) w.fill(x, y, z, x, y + 2, z, 'dark_oak_fence', { fur: 1 });
      w.fill(x1, y + 3, z1, x2, y + 3, z2, wool, { fur: 1 });
    },
    pot: (x, y, z, plant) => w.set(x, y, z, 'flower_pot', { plant }),
  });

  // ======================= ДОНЖОН =======================
  // Корпус 39×39 со стенами в три блока (в их толще — тайные ходы), четыре
  // угловые башни 11×11, средняя башня на северной стене с нишей для трона.
  // Пять этажей: подклет, парадный, галерейный, жилой, караульный; крыша на y = 29.
  // i — восток, j — юг от северо-западного угла корпуса.
  function keep(b, KX, KZ) {
    const w = at(b, KX, KZ);
    const ST = [0, 6, 12, 18, 24, 30]; // на этой высоте стоит игрок: этажи 0–4 и крыша
    const inside = (x, z) => x >= 3 && x <= 35 && z >= 3 && z <= 35;

    // ---------- Корпус ----------
    box(0, -1, 0, 38, 28, 38, (x, y, z) => { if (!inside(x, z)) w.set(x, y, z, S(y)); });
    solid(w, 3, -1, 3, 35, -1, 35, PAVE);
    solid(w, 3, 5, 3, 35, 5, 35, PAVE);
    for (const y of [11, 17, 23]) box(3, y, 3, 35, y, 35, (x, yy, z) => { const [id, p] = BEAMS(x); w.set(x, yy, z, id, p); });
    solid(w, 0, 29, 0, 38, 29, 38, STONE);
    corbels(w, 0, 0, 38, 38, 29); crenel(w, -1, -1, 39, 39, 30);
    for (const i of [9, 29]) solid(w, i, -1, -1, i, 28, -1);
    for (const i of [10, 28]) solid(w, i, -1, 39, i, 28, 39);
    for (const j of [11, 17, 25]) solid(w, -1, -1, j, -1, 28, j);

    // Окна-бойницы: стекло снаружи, глубокая ниша в толще стены
    const emb = (face, a, y, h, id = 'glass_pane') => {
      for (let k = 0; k < h; k++) {
        const yy = y + k;
        if (face === 'n') { w.set(a, yy, 0, id); w.set(a, yy, 1, 'air'); w.set(a, yy, 2, 'air'); }
        if (face === 's') { w.set(a, yy, 38, id); w.set(a, yy, 37, 'air'); w.set(a, yy, 36, 'air'); }
        if (face === 'w') { w.set(0, yy, a, id); w.set(1, yy, a, 'air'); w.set(2, yy, a, 'air'); }
      }
    };
    for (const [y, h] of [[2, 1], [7, 2], [13, 2], [19, 2], [25, 1]]) {
      for (const i of [7, 31]) emb('n', i, y, h);
      for (const i of [7, 12, 26, 31]) emb('s', i, y, h);
      for (const j of [8, 13, 21, 29]) emb('w', j, y, h);
      if (y !== 7 && y !== 13) for (const i of [12, 25]) emb('n', i, y, h);
    }
    for (const i of [12, 25]) emb('n', i, 7, 8); // высокие окна Большого зала

    // ---------- Перегородки по этажам ----------
    const walls = (L, rects, top) => {
      for (const [i1, j1, i2, j2] of rects) box(i1, ST[L], j1, i2, top ?? ST[L] + 4, j2, (x, y, z) => {
        if (!inside(x, z)) return;
        if (x === i1 || x === i2 || z === j1 || z === j2) w.set(x, y, z, INNER);
      });
    };
    const dr = (L, i, j, f, id = 'spruce_door') => w.door(i, ST[L], j, f, id);
    const hole = (L, i, j, h = 2) => doorway(w, i, ST[L], j, h);

    // Подклет (0): пекарня, кухня, кладовые под сводами, винный погреб, караульня
    walls(0, [[2, 2, 14, 19], [2, 19, 14, 36], [14, 2, 24, 36], [24, 2, 36, 19], [24, 19, 36, 36]]);
    dr(0, 14, 10, 'e'); dr(0, 14, 28, 'e'); dr(0, 24, 10, 'w'); dr(0, 24, 34, 'w'); dr(0, 8, 19, 's'); dr(0, 30, 19, 's');
    for (const i of [8, 30]) { air(w, i, 0, 36, i, 1, 37); w.door(i, 0, 38, 's', 'spruce_door'); lamp(w, i, 3, 39); }

    // Парадный этаж (1)
    walls(1, [[10, 2, 28, 27]], 16); // стены Большого зала на два этажа
    walls(1, [[10, 27, 28, 31], [14, 31, 24, 36], [2, 2, 10, 13], [2, 13, 10, 23], [2, 23, 10, 36], [10, 31, 14, 36],
      [24, 31, 28, 36], [28, 2, 36, 13], [28, 13, 36, 24], [28, 24, 36, 36]]);
    box(11, 6, 27, 27, 10, 27, (x, y, z) => w.set(x, y, z, 'dark_oak_planks')); // резная перегородка у входа в зал
    for (const i of [13, 19, 25]) air(w, i, 6, 27, i, 7, 27);
    for (let i = 11; i <= 27; i += 2) w.set(i, 10, 27, 'dark_oak_fence');
    dr(1, 10, 7, 'e', 'dark_oak_door'); dr(1, 10, 18, 'e', 'dark_oak_door'); dr(1, 28, 7, 'w', 'dark_oak_door'); dr(1, 28, 18, 'w', 'dark_oak_door');
    dr(1, 10, 29, 'e'); dr(1, 28, 29, 'w'); dr(1, 6, 13, 's'); dr(1, 6, 23, 's'); dr(1, 32, 13, 's'); dr(1, 32, 24, 's');
    dr(1, 10, 33, 'e'); dr(1, 24, 33, 'w'); dr(1, 28, 33, 'e');
    air(w, 18, 6, 31, 20, 8, 31);
    air(w, 18, 6, 36, 20, 9, 38); for (let j = 36; j <= 38; j++) { w.set(18, 9, j, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(20, 9, j, 'stone_brick_stairs', { h: 'top', f: 'e' }); }
    air(w, 36, 6, 18, 38, 8, 20); // проход в библиотеку
    air(w, 16, 7, 0, 22, 14, 2); solid(w, 16, 6, 0, 22, 6, 2, PAVE); for (let j = 0; j <= 2; j++) { w.set(16, 14, j, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(22, 14, j, 'stone_brick_stairs', { h: 'top', f: 'e' }); }

    // Галерейный этаж (2): над залом пустота, по бокам часовня, солар, кабинет
    air(w, 11, 11, 3, 27, 11, 26);
    walls(2, [[2, 2, 10, 15], [2, 15, 10, 31], [6, 15, 10, 21], [2, 31, 14, 36], [14, 31, 24, 36], [10, 27, 28, 31],
      [28, 2, 36, 13], [28, 13, 36, 24], [28, 24, 36, 31], [24, 31, 36, 36]]);
    air(w, 11, 12, 27, 27, 16, 27); for (let i = 11; i <= 27; i++) w.set(i, 12, 27, 'dark_oak_fence'); // галерея менестрелей
    dr(2, 4, 15, 's'); dr(2, 6, 31, 's'); dr(2, 10, 29, 'e'); dr(2, 28, 29, 'w'); dr(2, 19, 31, 's', 'dark_oak_door');
    dr(2, 14, 33, 'e'); dr(2, 24, 33, 'w'); dr(2, 31, 31, 's'); dr(2, 32, 24, 's'); dr(2, 32, 13, 's');
    for (const j of [15, 16, 18, 19, 21, 22]) { air(w, 28, 12, j, 28, 14, j); w.set(28, 12, j, 'dark_oak_fence'); } // аркада на зал
    air(w, 36, 12, 17, 38, 13, 17); // переход на галерею библиотеки

    // Жилой этаж (3)
    walls(3, [[2, 2, 14, 14], [14, 2, 28, 14], [28, 2, 36, 14], [2, 14, 36, 24], [2, 24, 14, 36], [14, 24, 24, 36], [24, 24, 36, 36]]);
    dr(3, 14, 12, 'e'); dr(3, 28, 8, 'w'); dr(3, 8, 14, 's'); dr(3, 21, 14, 's', 'dark_oak_door'); dr(3, 32, 14, 's');
    dr(3, 8, 24, 's'); dr(3, 19, 24, 's'); dr(3, 30, 24, 's');
    air(w, 19, 18, 0, 19, 19, 2);

    // Караульный этаж (4)
    walls(4, [[2, 2, 36, 20], [2, 20, 14, 36], [14, 20, 24, 36], [24, 20, 36, 36]]);
    dr(4, 8, 20, 's'); dr(4, 19, 20, 's'); dr(4, 30, 20, 's'); dr(4, 14, 28, 'e'); dr(4, 24, 28, 'w');
    air(w, 19, 24, 0, 19, 25, 2);
    w.fill(19, 24, 21, 19, 29, 21, 'ladder', { f: 'n' }); // люк на крышу

    // ---------- Башни ----------
    const T = { nw: [-5, -5, 5, 5], ne: [33, -5, 43, 5], sw: [-5, 33, 5, 43], se: [33, 33, 43, 43] };
    const slits = { nw: [[-5, 0], [0, -5]], ne: [[43, 0], [38, -5]], sw: [[-5, 38], [0, 43]], se: [[43, 38], [38, 43]] };
    for (const [k, [x1, z1, x2, z2]] of Object.entries(T)) {
      ring(w, x1, -1, z1, x2, 36, z2); air(w, x1 + 1, 0, z1 + 1, x2 - 1, 36, z2 - 1);
      solid(w, x1 + 1, -1, z1 + 1, x2 - 1, -1, z2 - 1, PAVE);
      battlements(w, x1, z1, x2, z2, 37);
      for (const [x, z] of slits[k]) for (const y of [2, 7, 13, 19, 25, 32]) win(w, x, y, z, 2);
      w.fill((x1 + x2) / 2, 38, (z1 + z2) / 2, (x1 + x2) / 2, 39, (z1 + z2) / 2, 'spruce_fence'); w.set((x1 + x2) / 2, 40, (z1 + z2) / 2, 'red_banner', { stand: 0 });
    }
    for (const k of ['nw', 'ne']) { const [x1, z1, x2, z2] = T[k]; for (const y of [5, 11, 17, 23, 29]) solid(w, x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, PLANKS); }
    for (const L of [0, 1, 2, 3, 4, 5]) { hole(L, 3, 5); hole(L, 35, 5); hole(L, 5, 35); hole(L, 33, 35); }
    for (const i of [3, 35]) hole(5, i, 5, 2);
    air(w, 5, 30, 3, 5, 31, 3); air(w, 33, 30, 3, 33, 31, 3);
    for (const [x, z, f] of [[-4, 1, 'w'], [42, 1, 'e']]) w.fill(x, 30, z, x, 37, z, 'ladder', { f }); // рядом с бойницей, не на стекле

    // Средняя башня: ниша трона, гардеробная хозяина, дозорные
    ring(w, 14, -1, -6, 24, 38, 0); air(w, 15, 0, -5, 23, 38, -1);
    solid(w, 15, -1, -5, 23, -1, -1, PAVE); solid(w, 15, 5, -5, 23, 5, -1, PAVE);
    for (const y of [17, 23, 29]) solid(w, 15, y, -5, 23, y, -1, PLANKS);
    battlements(w, 14, -6, 24, 0, 39);
    air(w, 19, 0, 0, 19, 1, 2); air(w, 19, 30, 0, 19, 31, 2);
    // Стена средней башни идёт по линии j = 0 — проходы в неё прорезаем после неё
    air(w, 16, 7, 0, 22, 14, 0); w.set(16, 14, 0, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(22, 14, 0, 'stone_brick_stairs', { h: 'top', f: 'e' });
    air(w, 19, 18, 0, 19, 19, 0); air(w, 19, 24, 0, 19, 25, 0);
    win(w, 19, 7, -6, 8); for (const y of [2, 19, 25, 32]) win(w, 19, y, -6, 2);
    for (const i of [14, 24]) for (const y of [2, 8, 19, 25, 32]) win(w, i, y, -3, 2);
    w.fill(19, 40, -3, 19, 41, -3, 'spruce_fence'); w.set(19, 42, -3, 'red_banner', { stand: 0 });

    // Парадная винтовая лестница (юго-восток) на все этажи и на верх башни.
    // В сердцевине столба — тайная комната.
    solid(w, 36, -1, 36, 40, 36, 40, STONE);
    air(w, 37, 13, 37, 39, 15, 39);
    const steps = spiral2(w, 34, 34, 42, 42, [35, 35], false, [[0, 6], [6, 12], [12, 18], [18, 24], [24, 30], [30, 38]], -1);
    const door = steps.find((s) => s.s === 13 && s.x !== 35 && s.x !== 41 && s.z !== 35 && s.z !== 41) || steps.find((s) => s.s === 13 && (s.x === 35 || s.z === 35) && !(s.x === 35 && s.z === 35));
    {
      const inX = door.x === 35 ? 36 : door.x === 41 ? 40 : door.x;
      const inZ = door.z === 35 ? 36 : door.z === 41 ? 40 : door.z;
      w.set(inX, 13, inZ, 'cracked_stone_bricks'); w.set(inX, 14, inZ, 'cracked_stone_bricks');
      w.set(38, 13, 38, 'chest', { f: 's', slot: 'stair_heart', theme: 'crypt' }); w.set(37, 13, 37, 'candle', { lit: 1, n: 2 }); w.set(39, 13, 39, 'skeleton_skull');
      w.mark('secret', inX, 13, inZ, 'Комната в сердце лестницы', 'Посреди винтовой лестницы, между вторым и третьим этажом, два треснувших камня в столбе. За ними — каморка 3×3 внутри столба.');
    }
    // Служебная винтовая лестница (юго-запад): из подклета к буфетной и наверх
    solid(w, -2, -1, 36, 2, 36, 40, STONE);
    spiral2(w, -4, 34, 4, 42, [3, 35], true, [[0, 6], [6, 12], [12, 18], [18, 24], [24, 30], [30, 30]], -1);
    w.fill(-4, 30, 39, -4, 37, 39, 'ladder', { f: 'w' });
    w.room(3, 0, 35, 'Служебная лестница', 'Винтовая лестница для слуг в юго-западной башне: из кухни в буфетную у Большого зала и выше, до крыши.');
    w.room(35, 0, 35, 'Парадная лестница', 'Широкая винтовая лестница юго-восточной башни: все этажи, крыша и верх башни.');

    // ======== Убранство ========
    // Свободными оставлены клетки у каждой двери с обеих сторон.
    const K = kit(w);
    const table = K.table;
    // Камин: топка с костром, каменные щёки, полка-перемычка и колпак до потолка.
    // На концах полки — свечи.
    const hearth = (x, y, z, f, top) => {
      const along = f === 'e' || f === 'w' ? 'z' : 'x';
      const P = (a, b) => (along === 'z' ? [x + a * (f === 'e' ? 1 : -1), z + b] : [x + b, z + a * (f === 's' ? 1 : -1)]);
      for (const b2 of [-2, 2]) for (let yy = y; yy <= y + 2; yy++) { const [px, pz] = P(0, b2); w.set(px, yy, pz, 'stone_bricks'); }
      for (let b2 = -2; b2 <= 2; b2++) { const [px, pz] = P(0, b2); w.set(px, y + 3, pz, 'stone_brick_stairs', { h: 'top', f: { e: 'w', w: 'e', s: 'n', n: 's' }[f] }); }
      for (let yy = y + 4; yy <= top; yy++) for (let b2 = -1; b2 <= 1; b2++) { const [px, pz] = P(0, b2); w.set(px, yy, pz, 'stone_bricks'); }
      for (const b2 of [-1, 1]) { const [px, pz] = P(0, b2); w.set(px, y, pz, 'iron_bars'); }
      const [cx, cz] = P(0, 0); w.set(cx, y, cz, 'campfire');
      if (y + 4 <= top) for (const b2 of [-2, 2]) { const [px, pz] = P(0, b2); w.set(px, y + 4, pz, 'candle', { lit: 1, n: 2 }); }
    };
    const SWORDS = ['iron_sword', 'shield', 'iron_axe', 'crossbow', 'iron_spear', 'bow', 'iron_sword'];

    // ---------- Подклет ----------
    // Пекарня и пивоварня: кирпичная хлебная печь, квашни, мука, пивные котлы
    solid(w, 7, 0, 3, 11, 2, 4, 'brick_block'); solid(w, 8, 3, 3, 10, 4, 3, 'brick_block');
    w.set(8, 0, 4, 'furnace', { f: 's' }); w.set(10, 0, 4, 'furnace', { f: 's' }); w.set(9, 0, 4, 'campfire');
    table(7, 0, 8, 10, 9, 'spruce_slab'); w.set(8, 1, 8, 'decorated_pot'); K.candle(10, 1, 9, 2);
    K.bench(7, 10, 10, 10, 0, 'n');
    solid(w, 12, 0, 15, 13, 1, 17, 'white_wool'); w.set(12, 0, 13, 'hay_block'); w.set(13, 0, 13, 'hay_block');
    for (const z of [10, 12]) w.set(3, 0, z, 'cauldron', { water: 1 });
    for (let z = 13; z <= 17; z++) { w.set(3, 0, z, 'barrel', { f: 'e' }); if (z % 2) w.set(3, 1, z, 'barrel', { f: 'e' }); }
    w.set(3, 0, 8, 'composter'); for (let z = 4; z <= 7; z++) K.shelf(13, 2, z, 'w');
    K.chandelier(8, 5, 13, 0, 1); K.hang(11, 4, 6);
    w.room(9, 0, 12, 'Пекарня и пивоварня', 'Кирпичная хлебная печь, квашни на столе, мешки с мукой, пивные котлы и бочки.');
    // Кухня: очаг на две топки с котлом и вертелом, разделочный стол, печи
    for (const z of [24, 30]) w.fill(3, 0, z, 4, 2, z, 'stone_bricks');
    w.fill(3, 3, 24, 4, 3, 30, 'stone_bricks'); w.fill(3, 4, 25, 3, 4, 29, 'stone_bricks');
    w.set(3, 0, 25, 'campfire'); w.set(3, 0, 29, 'campfire'); w.set(3, 0, 27, 'cauldron', { water: 1 });
    w.fill(3, 2, 25, 3, 2, 29, 'iron_chain', { a: 'z' });
    table(7, 0, 25, 10, 29, 'spruce_slab'); K.bench(6, 25, 6, 29, 0, 'e'); K.bench(11, 25, 11, 29, 0, 'w');
    w.set(8, 1, 26, 'cake'); K.candle(9, 1, 28, 3); w.set(10, 1, 25, 'decorated_pot');
    for (let x = 9; x <= 12; x++) { w.set(x, 0, 35, x % 2 ? 'furnace' : 'smoker', { f: 'n' }); if (x !== 12) K.shelf(x, 2, 35, 'n'); }
    for (const z of [21, 22, 23]) w.set(13, 0, z, 'barrel', { f: 'w', theme: 'kitchen' });
    w.set(13, 0, 31, 'stripped_spruce_log'); w.set(13, 0, 33, 'chest', { f: 'w', theme: 'kitchen' }); w.set(12, 0, 20, 'cauldron', { water: 1 });
    for (const [x, z] of [[5, 23], [5, 31], [6, 27]]) w.set(x, 4, z, 'hanging_roots');
    K.chandelier(8, 5, 22, 0, 1); K.chandelier(8, 5, 32, 0, 1);
    w.room(8, 0, 27, 'Кухня', 'Большой очаг на две топки с котлом и вертелом, разделочный стол со скамьями, печи и коптильни, сушёные травы под потолком. Отсюда служебная лестница наверх.');
    // Кладовые: столбы, вдоль стен товары, люстры между столбами
    for (const i of [17, 21]) for (const j of [8, 14, 20, 26, 32]) solid(w, i, 0, j, i, 4, j, STONE);
    const goods = ['barrel', 'hay_block', 'white_wool', 'barrel', 'decorated_pot', 'chest'];
    for (let j = 4; j <= 35; j++) {
      if (j < 9 || (j > 11 && j < 27) || j > 29) { const g = goods[j % goods.length]; w.set(15, 0, j, g, g === 'barrel' ? { f: 'e' } : g === 'chest' ? { f: 'e' } : undefined); if (g !== 'decorated_pot' && g !== 'chest' && j % 2) w.set(15, 1, j, g === 'barrel' ? 'barrel' : g, g === 'barrel' ? { f: 'e' } : undefined); }
      if (j < 9 || (j > 11 && j < 33)) { const g = goods[(j + 3) % goods.length]; w.set(23, 0, j, g, g === 'barrel' || g === 'chest' ? { f: 'w' } : undefined); }
    }
    for (const j of [5, 11, 17, 23, 29]) K.chandelier(19, 5, j, 0, 1);
    w.room(19, 0, 18, 'Кладовые', 'Длинный зал под Большим залом: столбы, бочки, сено, мешки, сундуки. С северного конца дверь в ледник под нишей трона.');
    w.fill(15, 0, -5, 23, 1, -5, 'packed_ice'); for (let i = 15; i <= 23; i++) if (i !== 19) w.set(i, 0, -3, 'barrel', { f: 's' });
    K.chandelier(19, 5, -3, 0, 2, false);
    w.room(19, 0, -3, 'Ледник', 'Холодный погреб под нишей трона: лёд и бочки с солониной.');
    // Винный погреб: ряды бочек в два яруса, дегустационный столик
    for (const j of [7, 11, 15]) for (let i = 26; i <= 34; i++) { w.set(i, 0, j, 'barrel', { f: 's' }); w.set(i, 1, j, 'barrel', { f: 's' }); }
    K.stand(32, 0, 17); K.chair(33, 0, 17, 'w'); K.chair(31, 0, 17, 'e');
    for (const j of [5, 9, 13]) K.chandelier(30, 5, j, 0, 1, false);
    w.room(30, 0, 9, 'Винный погреб', 'Ряды бочек в два яруса и столик для пробы вина.');
    w.fill(35, 0, -4, 41, 1, -4, 'packed_ice'); for (let z = -2; z <= 2; z++) w.set(41, 0, z, 'barrel', { f: 'w' }); K.chandelier(38, 5, 0, 0, 2, false);
    w.room(38, 0, 0, 'Погреб-холодильник', 'Нижняя комната северо-восточной башни: лёд и бочки.');
    // Караульня и тюремный спуск (решётка вокруг лестницы, вход с северного конца)
    w.fill(25, 0, 23, 25, 0, 32, 'iron_bars'); w.fill(28, 0, 22, 28, 0, 32, 'iron_bars'); w.fill(26, 0, 32, 27, 0, 32, 'iron_bars');
    table(31, 0, 24, 32, 26); for (let z = 24; z <= 26; z++) { K.chair(30, 0, z, 'e'); K.chair(33, 0, z, 'w'); }
    K.candle(31, 1, 25, 3); w.set(32, 1, 24, 'skeleton_skull');
    w.bed(35, 0, 21, 0, 1, 'brown_bed'); w.set(34, 0, 21, 'chest', { f: 'w', theme: 'forester' });
    for (let z = 28; z <= 31; z++) { w.set(35, 0, z, 'dark_oak_fence'); K.arms(35, 1, z, 'e', SWORDS[z % SWORDS.length]); }
    w.set(34, 0, 32, 'barrel', { f: 'n' }); K.chandelier(31, 5, 29, 0, 1);
    w.room(30, 0, 27, 'Караульня', 'Стража подклета: стол, койка, оружие на стене. Решётка огораживает лестницу в темницу.');
    // Колодезная (СЗ башня)
    ring(w, -1, 0, -1, 1, 0, 1, 'mossy_cobblestone'); w.set(0, 0, 0, 'air'); w.set(0, -1, 0, 'water');
    for (const x of [-1, 1]) w.fill(x, 1, 0, x, 2, 0, 'spruce_fence'); w.fill(-1, 3, 0, 1, 3, 0, 'spruce_slab'); w.set(0, 2, 0, 'iron_chain');
    w.set(-3, 0, -3, 'barrel', { f: 's' }); w.set(-3, 0, 2, 'cauldron', { water: 1 }); K.chandelier(0, 5, 0, 0, 2, false);
    w.room(0, 0, 2, 'Колодезная', 'Колодец внутри донжона: в осаду вода своя. Шахта уходит вниз, в подземную цистерну.');

    // ---------- Парадный этаж ----------
    // Большой зал
    solid(w, 11, 6, 3, 27, 6, 5, PAVE); for (let i = 11; i <= 27; i++) w.set(i, 6, 6, 'stone_brick_stairs', { f: 'n' });
    solid(w, 15, 6, -5, 23, 6, -1, 'polished_andesite');
    K.rug(16, -4, 22, -1, 7, 'red_carpet', 'yellow_carpet'); w.fill(17, 7, 0, 21, 7, 5, 'red_carpet'); w.fill(18, 6, 7, 20, 6, 26, 'red_carpet'); w.fill(18, 6, 28, 20, 6, 35, 'red_carpet'); w.set(19, 6, 27, 'red_carpet'); // дорожка не режет перегородку
    K.chair(19, 7, -4, 's'); w.set(19, 7, -5, 'chiseled_stone_bricks'); w.set(19, 8, -5, 'gold_block'); w.set(19, 9, -5, 'chiseled_stone_bricks');
    for (const x of [18, 20]) { w.set(x, 7, -5, 'dark_oak_fence'); K.candle(x, 8, -5, 4, 'white_candle'); }
    w.set(15, 7, -5, 'campfire'); w.set(23, 7, -5, 'campfire');
    K.herald(15, 11, -3, 'w'); K.herald(23, 11, -3, 'e'); K.herald(15, 11, -1, 'w'); K.herald(23, 11, -1, 'e');
    table(12, 7, 4, 16, 4); table(22, 7, 4, 26, 4);
    for (let i = 12; i <= 26; i++) if (i <= 16 || i >= 22) K.chair(i, 7, 3, 's');
    for (const i of [13, 15, 23, 25]) K.candle(i, 8, 4, 3);
    for (const i of [13, 25]) for (const j of [8, 18, 23]) { solid(w, i, 6, j, i, 15, j, STONE); w.set(i, 16, j, 'chiseled_stone_bricks'); }
    for (const [x1, x2] of [[15, 16], [22, 23]]) {
      table(x1, 6, 9, x2, 24, 'spruce_slab');
      K.bench(x1 - 1, 9, x1 - 1, 24, 6, 'e'); K.bench(x2 + 1, 9, x2 + 1, 24, 6, 'w');
      for (const j of [10, 14, 18, 22]) K.candle(x1 + (j % 4 ? 1 : 0), 7, j, 3);
      w.set(x1, 7, 12, 'cake'); w.set(x2, 7, 20, 'cake');
    }
    hearth(11, 6, 13, 'e', 16); hearth(27, 6, 13, 'w', 16);
    for (const j of [9, 15, 21]) K.chandelier(19, 17, j, 3, 2);
    for (const j of [5, 20, 24]) { K.herald(11, 12, j, 'w'); K.herald(27, 12, j, 'e'); }
    K.herald(14, 12, 3, 'n'); K.herald(24, 12, 3, 'n');
    for (const i of [15, 23]) w.set(i, 9, 28, 'red_banner', { f: 'n', pat: HERALD });
    w.room(19, 6, 14, 'Большой зал', 'Сердце замка, высотой в два этажа. На возвышении высокий стол, за ним трон в нише средней башни между двух жаровен. Вдоль зала столы с лавками, свечи, пироги; по бокам два камина, колонны, гербовые знамёна, три большие люстры. Сверху на зал смотрят галереи.');
    w.mark('slot', 19, 6, 6, 'Под ступенью трона', 'Средняя ступень возвышения перед троном вынимается: за ней сундук в теле возвышения.');
    w.mark('slot', 11, 6, 13, 'Камень в очаге', 'Треснувший камень в задней стенке западного камина, над огнём. За ним бочка в толще стены.');
    // Сени за перегородкой: скамьи вдоль южной стены, проход посередине свободен
    K.bench(12, 30, 16, 30, 6, 'n'); K.bench(22, 30, 26, 30, 6, 'n');
    K.hang(15, 10, 29); K.hang(23, 10, 29);
    w.room(19, 6, 29, 'Сени за перегородкой', 'Проход между резной перегородкой зала и входом: скамьи для слуг, двери в буфетную и к парадной лестнице.');
    // Входные сени
    K.bench(15, 33, 15, 34, 6, 'e'); K.herald(16, 9, 35, 's'); K.herald(22, 9, 35, 's');
    K.pot(15, 6, 35, 'fern'); K.pot(23, 6, 35, 'fern'); K.chandelier(19, 11, 33, 0, 1);
    w.room(19, 6, 33, 'Входные сени', 'Сюда приводит лестница пристройки. Гербы рода, скамья для ожидающих, люстра.');
    // Зал совета
    table(5, 6, 8, 7, 10);
    for (let z = 8; z <= 10; z++) { K.chair(4, 6, z, 'e'); K.chair(8, 6, z, 'w'); }
    for (let x = 5; x <= 7; x++) { K.chair(x, 6, 7, 's'); K.chair(x, 6, 11, 'n'); }
    K.candle(6, 7, 9, 4); w.set(5, 7, 8, 'decorated_pot');
    K.arms(3, 8, 9, 'w', 'filled_map'); K.herald(3, 9, 11, 'w'); K.herald(7, 9, 3, 'n');
    w.fill(3, 6, 12, 4, 8, 12, 'bookshelf'); w.fill(8, 6, 12, 9, 8, 12, 'bookshelf'); w.set(9, 6, 4, 'lectern', { f: 'w' });
    K.chandelier(6, 11, 9, 0, 1);
    w.room(6, 6, 9, 'Зал совета', 'Круглый стол на двенадцать мест под люстрой, карта владений на стене, книжные шкафы.');
    // Парадная оружейная: оружие и доспехи в рамах, стойки, сундуки
    for (let z = 14; z <= 20; z++) { w.set(3, 6, z, 'dark_oak_fence'); K.arms(3, 7, z, 'w', SWORDS[z - 14]); K.arms(3, 8, z, 'w', z % 2 ? 'iron_helmet' : 'iron_chestplate'); }
    w.set(9, 6, 15, 'chest', { f: 'w', theme: 'forester' }); w.set(9, 6, 21, 'barrel', { f: 'w' }); w.set(8, 6, 21, 'grindstone'); w.set(9, 6, 16, 'anvil', { f: 'e' });
    K.herald(5, 9, 14, 'n'); K.herald(8, 9, 14, 'n'); K.chandelier(6, 11, 18, 0, 1);
    w.room(6, 6, 18, 'Парадная оружейная', 'Мечи, щиты, топоры, арбалеты и доспехи рода в рамах на стене, сундуки, наковальня.');
    // Буфетная
    for (let z = 24; z <= 31; z++) if (z !== 29) { w.set(3, 6, z, 'barrel', { f: 'e' }); w.set(3, 7, z, 'barrel', { f: 'e' }); K.shelf(3, 8, z, 'e'); }
    table(6, 6, 27, 7, 30, 'spruce_slab'); K.candle(6, 7, 28, 2); w.set(7, 7, 30, 'decorated_pot'); w.set(8, 6, 25, 'cauldron', { water: 1 });
    K.chandelier(6, 11, 29, 0, 1);
    w.room(6, 6, 28, 'Буфетная', 'Бочки с вином и пивом в два ряда, стойка для разлива. Сюда поднимаются слуги по винтовой лестнице.');
    for (let z = 32; z <= 35; z++) w.set(13, 6, z, 'barrel', { f: 'w' });
    table(11, 6, 35, 12, 35, 'spruce_slab'); w.set(11, 7, 35, 'cake'); w.set(12, 7, 35, 'decorated_pot'); K.hang(12, 10, 33);
    w.room(12, 6, 34, 'Хлебная', 'Кладовая для хлеба и сыра рядом с залом.');
    w.bed(26, 6, 34, 0, 1, 'brown_bed'); w.set(25, 6, 35, 'barrel', { f: 'n' }); w.set(27, 6, 35, 'dark_oak_fence'); K.arms(27, 7, 35, 's', 'iron_spear'); K.hang(26, 10, 33);
    w.room(26, 6, 33, 'Караул у входа', 'Комнатка стражи рядом со входными сенями.');
    // Счётная палата
    table(30, 6, 9, 32, 9); K.chair(31, 6, 10, 'n'); w.set(33, 6, 9, 'lectern', { f: 's', slot: 'ledger' }); K.candle(30, 7, 9, 2);
    for (let z = 8; z <= 11; z++) { w.set(35, 6, z, 'chest', { f: 'w' }); w.fill(35, 7, z, 35, 8, z, 'bookshelf'); }
    K.stand(33, 6, 11, 'heavy_weighted_pressure_plate'); w.set(29, 6, 11, 'cartography_table'); w.set(34, 6, 11, 'gold_block');
    K.chandelier(32, 11, 7, 0, 1);
    w.room(32, 6, 9, 'Счётная палата', 'Здесь управитель вёл счета замка: конторка, кафедра с книгой податей, весы, сундуки, золото.');
    // Сени библиотеки
    for (const x of [30, 31, 33, 34]) { K.chair(x, 6, 15, 's'); K.chair(x, 6, 22, 'n'); }
    w.set(34, 6, 17, 'lectern', { f: 'w', slot: 'catalog' }); K.herald(29, 9, 16, 'w'); K.herald(29, 9, 21, 'w');
    K.pot(35, 6, 16, 'allium'); K.pot(35, 6, 21, 'cornflower'); K.chandelier(32, 11, 18, 0, 1);
    w.room(32, 6, 19, 'Сени библиотеки', 'Прохожая перед библиотекой: скамьи, кафедра с каталогом книг. В восточной стене широкий проём в книжную пристройку.');
    K.herald(35, 9, 28, 'e'); K.bench(35, 30, 35, 31, 6, 'w'); K.pot(35, 6, 26, 'fern'); K.chandelier(32, 11, 29, 0, 1);
    w.room(31, 6, 30, 'Лестничный зал', 'Дверь на парадную винтовую лестницу, скамья, герб.');
    // Архив грамот (СЗ башня)
    for (let z = -4; z <= 2; z++) w.fill(-4, 6, z, -4, 8, z, z % 3 ? 'bookshelf' : 'chiseled_bookshelf');
    for (let x = -3; x <= 2; x++) w.fill(x, 6, -4, x, 8, -4, 'bookshelf');
    w.set(0, 6, 0, 'lectern', { f: 's', slot: 'archive_book' }); table(-2, 6, 2, -1, 2); K.chair(-1, 6, 3, 'n'); K.candle(-2, 7, 2, 2); w.set(-3, 6, 3, 'chest', { f: 'e', slot: 'archive' });
    K.chandelier(0, 11, 0, 0, 2, false);
    w.room(0, 6, 0, 'Архив грамот', 'Полки со свитками и грамотами рода в северо-западной башне, кафедра, стол писаря.');
    // Казна (СВ башня): решётка с железной дверью, рычаги у двери
    w.fill(34, 6, 0, 42, 7, 0, 'iron_bars'); w.door(38, 6, 0, 's', 'iron_door'); w.set(38, 6, 1, 'lever'); w.set(38, 6, -1, 'lever');
    for (const x of [35, 37, 39, 41]) w.set(x, 6, -3, 'chest', { f: 's', theme: 'treasure' }); w.set(38, 6, -4, 'gold_block'); w.set(36, 6, -4, 'decorated_pot'); w.set(40, 6, -4, 'decorated_pot');
    K.chandelier(38, 11, 2, 0, 2, false); K.hang(38, 10, -2);
    w.room(38, 6, 1, 'Казна', 'За решёткой с железной дверью сундуки с серебром. Дверь открывает рычаг на полу.');

    // ---------- Галерейный этаж ----------
    // Часовня с тайником священника
    w.set(9, 12, 9, 'chiseled_stone_bricks'); w.set(9, 12, 8, 'polished_andesite'); w.set(9, 12, 10, 'polished_andesite');
    K.candle(9, 13, 8, 3, 'white_candle'); K.candle(9, 13, 10, 3, 'white_candle'); w.set(9, 13, 9, 'decorated_pot');
    w.set(9, 15, 9, 'white_banner', { f: 'e', pat: [['sc', 1]] });
    K.candlestand(8, 12, 7); K.candlestand(8, 12, 11);
    for (const i of [5, 7]) { K.bench(i, 6, i, 7, 12, 'e'); K.bench(i, 11, i, 12, 12, 'e'); }
    K.rug(3, 8, 8, 10, 12, 'red_carpet', 'yellow_carpet'); w.set(8, 12, 13, 'lectern', { f: 'e', slot: 'chapel_book' });
    air(w, 1, 12, 9, 2, 13, 9); air(w, 1, 12, 10, 1, 13, 10); w.set(3, 14, 9, 'white_banner', { f: 'w', pat: [['sc', 1]] });
    w.set(1, 12, 10, 'chest', { f: 'n', slot: 'priest' }); K.candle(1, 13, 10, 1);
    K.chandelier(6, 17, 9, 1, 1);
    w.room(6, 12, 9, 'Часовня донжона', 'Домашняя часовня хозяина: алтарь со свечами под знаменем с крестом, подсвечники, скамьи, кафедра.');
    w.mark('secret', 2, 12, 9, 'Тайник священника', 'За знаменем с крестом у западной стены — лаз в нишу внутри толстой стены. Там прятали священника и церковное серебро.');
    for (const z of [-3, -2]) K.wardrobe(-4, 12, z, 'e'); w.set(-2, 12, -4, 'chest', { f: 's' }); w.set(2, 12, -4, 'lectern', { f: 's' });
    K.candlestand(0, 12, -3); K.chandelier(0, 17, 0, 0, 2, false);
    w.room(0, 12, 0, 'Ризница', 'Облачения в шкафах и церковная утварь при часовне.');
    // Солар и «ухо хозяина»
    hearth(3, 12, 25, 'e', 16);
    K.rug(4, 22, 8, 28, 12, 'red_carpet', 'brown_carpet');
    K.chair(6, 12, 24, 'w'); K.chair(6, 12, 26, 'w'); K.stand(6, 12, 25);
    w.fill(9, 12, 23, 9, 14, 26, 'bookshelf'); w.set(8, 12, 30, 'chest', { f: 'n' }); w.set(4, 12, 30, 'lectern', { f: 'n' });
    K.wardrobe(9, 12, 22, 'w'); K.pot(3, 12, 19, 'allium'); K.herald(3, 14, 17, 'w');
    K.chandelier(6, 17, 26, 1, 1);
    w.room(6, 12, 25, 'Солар', 'Личная гостиная хозяина: камин со свечами на полке, два кресла и столик, книги, ковёр.');
    w.set(6, 12, 18, 'air'); w.set(6, 13, 18, 'air'); w.set(5, 14, 18, 'red_banner', { f: 'e', pat: HERALD });
    for (const z of [17, 18, 19]) w.set(10, 13, z, 'iron_bars');
    K.chair(8, 12, 18, 'e'); K.candle(7, 12, 16, 1);
    w.mark('secret', 8, 12, 18, 'Ухо хозяина', 'За гербовым знаменем в соларе — каморка в стене над Большим залом. Через решётку слышно и видно всё, что говорят в зале.');
    // Гостевые покои
    w.bed(9, 12, 34, 0, 1, 'blue_bed'); w.bed(10, 12, 34, 0, 1, 'blue_bed'); K.canopy(8, 33, 11, 35, 12, 'blue_wool');
    K.stand(7, 12, 35); K.stand(12, 12, 35); w.set(13, 12, 35, 'chest', { f: 'n', slot: 'guest' }); K.wardrobe(13, 12, 32, 'w');
    w.fill(7, 12, 32, 12, 12, 32, 'blue_carpet'); K.hang(9, 16, 32);
    w.room(10, 12, 33, 'Гостевые покои', 'Кровать под синим балдахином для знатных гостей, шкаф, сундук, столики.');
    // Музыкантская
    for (const i of [16, 17, 18]) { w.set(i, 12, 35, 'noteblock'); K.chair(i, 12, 34, 's'); }
    w.set(21, 12, 35, 'jukebox'); K.chair(21, 12, 34, 's'); K.herald(22, 14, 35, 's'); K.rug(16, 32, 22, 33, 12, 'red_carpet', null); K.hang(19, 16, 34);
    w.room(19, 12, 33, 'Музыкантская', 'Комната менестрелей: инструменты, стулья. Дверь ведёт на галерею над залом.');
    // Галерея менестрелей
    K.bench(12, 30, 17, 30, 12, 'n'); K.bench(21, 30, 26, 30, 12, 'n');
    K.hang(14, 16, 29); K.hang(24, 16, 29); K.herald(16, 14, 30, 's'); K.herald(22, 14, 30, 's');
    w.room(19, 12, 29, 'Галерея менестрелей', 'Балкон над входом в Большой зал: отсюда играли музыканты на пирах.');
    // Кабинет хозяина
    table(31, 12, 7, 33, 7); K.chair(32, 12, 8, 'n'); K.candle(31, 13, 7, 3); K.candle(33, 13, 7, 2);
    w.fill(35, 12, 7, 35, 14, 11, 'bookshelf'); K.arms(29, 14, 9, 'w', 'filled_map'); w.set(30, 12, 11, 'chest', { f: 'n', slot: 'study' });
    w.set(29, 12, 4, 'cartography_table'); K.chair(33, 12, 10, 'w'); K.rug(30, 9, 34, 11, 12, 'red_carpet', 'brown_carpet');
    K.chandelier(32, 17, 8, 1, 1);
    w.room(32, 12, 9, 'Кабинет хозяина', 'Письменный стол со свечами, книги, карта владений на стене, стол картографа.');
    // Галерея над залом
    w.set(35, 12, 15, 'lectern', { f: 'w' }); w.set(35, 12, 22, 'lectern', { f: 'w' });
    K.herald(35, 14, 16, 'e'); K.herald(35, 14, 21, 'e'); K.pot(35, 12, 19, 'fern'); K.chandelier(32, 17, 18, 1, 1);
    w.room(32, 12, 19, 'Галерея над залом', 'Аркада на Большой зал и проход на верхнюю галерею библиотеки.');
    // Лекарская
    w.bed(34, 12, 26, 0, 1, 'white_bed'); table(29, 12, 26, 30, 26); w.set(29, 13, 26, 'brewing_stand'); w.set(30, 13, 26, 'candle', { lit: 1, n: 2 });
    w.set(31, 12, 27, 'cauldron', { water: 1 }); K.pot(35, 12, 29, 'fern'); K.pot(35, 12, 30, 'allium'); w.set(33, 12, 30, 'chest', { f: 'n', slot: 'healer' });
    for (const z of [26, 27, 28]) K.shelf(35, 14, z, 'w');
    K.hang(32, 16, 28);
    w.room(32, 12, 28, 'Лекарская', 'Комната лекаря: койка, стол с зельеваркой, котёл, травы в горшках, полки.');
    K.bench(28, 35, 29, 35, 12, 'n'); K.herald(28, 14, 35, 's'); K.hang(29, 16, 33);
    w.room(30, 12, 34, 'Площадка второго этажа', 'Выход с парадной лестницы на галерейный этаж.');
    // Сокровищница (СВ башня)
    w.fill(34, 12, 0, 42, 13, 0, 'iron_bars'); w.door(38, 12, 0, 's', 'iron_door'); w.set(38, 12, 1, 'lever'); w.set(38, 12, -1, 'lever');
    for (const x of [36, 38, 40]) w.set(x, 12, -3, 'decorated_pot'); w.set(38, 12, -4, 'chest', { f: 's', slot: 'jewels', theme: 'treasure' }); w.set(35, 12, -4, 'gold_block'); w.set(41, 12, -4, 'gold_block');
    K.chandelier(38, 17, 2, 0, 2, false); K.hang(38, 16, -2);
    w.room(38, 12, 1, 'Сокровищница', 'Дорогая утварь, кубки и драгоценности рода за второй решёткой. Дверь открывает рычаг.');

    // ---------- Жилой этаж ----------
    // Покои хозяйки
    w.bed(9, 18, 4, 0, -1, 'green_bed'); w.bed(10, 18, 4, 0, -1, 'green_bed'); K.canopy(8, 3, 11, 5, 18, 'green_wool');
    w.set(9, 18, 6, 'chest', { f: 's', slot: 'lady' }); K.wardrobe(13, 18, 4, 'w'); K.wardrobe(13, 18, 5, 'w');
    w.set(3, 18, 9, 'loom'); K.stand(12, 18, 8); K.pot(3, 18, 11, 'lily_of_the_valley'); K.pot(3, 18, 12, 'allium');
    K.rug(6, 8, 11, 11, 18, 'green_carpet', 'white_carpet'); K.chair(11, 18, 10, 'w');
    K.chandelier(9, 23, 9, 1, 1);
    w.room(9, 18, 9, 'Покои хозяйки', 'Кровать под зелёным балдахином, шкафы, ткацкий станок, цветы, сундук с приданым.');
    // Опочивальня хозяина
    w.bed(23, 18, 4, 0, -1, 'red_bed'); w.bed(24, 18, 4, 0, -1, 'red_bed'); K.canopy(22, 3, 25, 5, 18, 'red_wool');
    w.set(23, 18, 6, 'chest', { f: 's', slot: 'master' }); K.stand(21, 18, 3); K.stand(26, 18, 3);
    hearth(15, 18, 9, 'e', 22);
    K.rug(17, 7, 26, 12, 18, 'red_carpet', 'yellow_carpet');
    K.chair(17, 18, 8, 'w'); K.chair(17, 18, 10, 'w'); K.stand(17, 18, 9);
    K.wardrobe(16, 18, 3, 's'); K.wardrobe(17, 18, 3, 's');
    table(26, 18, 10, 26, 11); K.chair(25, 18, 10, 'e'); K.candle(26, 19, 11, 2); w.set(26, 18, 12, 'lectern', { f: 'w', slot: 'master_diary' });
    K.herald(15, 20, 5, 'w'); K.herald(27, 20, 6, 'e');
    w.set(27, 20, 3, 'red_banner', { f: 'n', pat: HERALD }); air(w, 27, 18, 2, 27, 19, 2);
    K.chandelier(21, 23, 9, 1, 1);
    w.room(21, 18, 9, 'Опочивальня хозяина', 'Кровать под красным балдахином, камин с креслами, шкафы, письменный стол. Дверь в нише средней башни ведёт в гардеробную.');
    w.mark('secret', 27, 18, 2, 'Потайной спуск хозяина', 'За гербовым знаменем в углу опочивальни — шахта с лестницей внутри северной стены. Она идёт через все этажи прямо в запечатанную сокровищницу под замком.');
    for (const x of [15, 16, 17, 18, 20, 21, 22, 23]) K.wardrobe(x, 18, -5, 's');
    w.set(15, 18, -2, 'chest', { f: 'e' }); K.chair(23, 18, -2, 'w'); w.set(23, 18, -1, 'spruce_trapdoor'); K.chandelier(19, 23, -3, 0, 2, false);
    w.room(19, 18, -3, 'Гардеробная', 'Шкафы с одеждой хозяина в нише средней башни, тут же уборная.');
    // Детская
    w.bed(30, 18, 4, 0, -1, 'white_bed'); w.bed(32, 18, 4, 0, -1, 'blue_bed'); w.set(34, 18, 8, 'chest', { f: 'w' });
    w.set(34, 18, 10, 'noteblock'); K.rug(30, 7, 34, 11, 18, 'yellow_carpet', null); K.hang(32, 22, 9);
    w.room(32, 18, 9, 'Детская', 'Две маленькие кровати, сундук с игрушками, ковёр.');
    // Горница
    table(9, 18, 18, 29, 19); for (let i = 9; i <= 29; i += 2) { K.chair(i, 18, 17, 's'); K.chair(i, 18, 20, 'n'); }
    K.chair(30, 18, 18, 'w'); K.chair(30, 18, 19, 'w');
    for (const i of [11, 15, 19, 23, 27]) K.candle(i, 19, i % 4 === 3 ? 18 : 19, 3);
    hearth(3, 18, 19, 'e', 22);
    for (const i of [12, 13, 25, 26]) K.wardrobe(i, 18, 15, 's');
    for (const i of [12, 19, 26]) K.chandelier(i, 23, 18, 1, 1);
    for (const i of [10, 28]) { K.herald(i, 21, 15, 'n'); K.herald(i, 21, 23, 's'); }
    w.room(19, 18, 19, 'Горница', 'Семейный зал на жилом этаже: длинный стол со свечами, камин, буфеты, люстры. Здесь ели без гостей.');
    // Комната служанок
    for (const i of [4, 6, 10, 12]) { w.bed(i, 18, 26, 0, -1, 'brown_bed'); w.set(i, 18, 27, 'chest', { f: 's' }); }
    table(10, 18, 31, 11, 31, 'spruce_slab'); K.chair(9, 18, 31, 'e'); w.set(13, 18, 30, 'cauldron', { water: 1 }); K.chandelier(8, 23, 31, 0, 1);
    w.room(8, 18, 30, 'Комната служанок', 'Простые кровати с сундучками, стол, умывальный котёл. Рядом служебная лестница.');
    // Покои гостя
    w.bed(18, 18, 34, 0, 1, 'blue_bed'); w.bed(19, 18, 34, 0, 1, 'blue_bed'); K.canopy(17, 33, 20, 35, 18, 'blue_wool');
    w.set(21, 18, 35, 'chest', { f: 'n' }); K.wardrobe(23, 18, 30, 'w'); K.wardrobe(23, 18, 31, 'w');
    table(15, 18, 28, 15, 29); K.chair(16, 18, 28, 'w'); K.candle(15, 19, 29, 2); K.rug(17, 28, 21, 31, 18, 'blue_carpet', 'white_carpet'); K.hang(19, 22, 29);
    w.room(19, 18, 30, 'Покои гостя', 'Опочивальня для почётного гостя: кровать под балдахином, шкаф, столик.');
    for (const z of [26, 27, 28]) w.set(35, 18, z, 'barrel', { f: 'w' }); K.bench(26, 35, 27, 35, 18, 'n'); K.herald(35, 20, 31, 'e'); K.chandelier(30, 23, 30, 0, 1);
    w.room(30, 18, 30, 'Бельевая', 'Бочки с бельём у выхода с парадной лестницы.');
    // Комната звездочёта (СЗ башня)
    w.set(0, 18, -1, 'cartography_table'); w.set(-2, 18, 2, 'lectern', { f: 'e', slot: 'astronomer_book' }); w.set(2, 18, -3, 'chest', { f: 's', slot: 'astronomer' });
    w.fill(-3, 18, -3, -3, 19, -3, 'dark_oak_fence'); K.arms(-4, 19, -1, 'w', 'spyglass'); K.arms(-4, 19, -2, 'w', 'clock'); K.arms(-4, 19, 2, 'w', 'compass');
    K.candle(0, 19, -1, 2); K.chandelier(0, 23, 0, 0, 2, false);
    w.room(0, 18, 0, 'Комната звездочёта', 'Звёздные карты, подзорная труба, часы и компас в северо-западной башне.');
    // Лаборатория (СВ башня)
    table(35, 18, -4, 38, -4); for (const x of [35, 37]) w.set(x, 19, -4, 'brewing_stand'); K.candle(36, 19, -4, 2);
    w.set(41, 18, -3, 'cauldron', { water: 1 }); w.set(41, 18, -1, 'cauldron'); for (const z of [-3, -2, -1]) K.shelf(42, 20, z, 'w');
    for (const x of [37, 38, 39]) K.pot(x, 18, 3, ['fern', 'allium', 'red_mushroom'][x - 37]);
    w.set(39, 18, 0, 'enchanting_table'); K.chandelier(38, 23, 0, 0, 2, false);
    w.room(38, 18, 0, 'Лаборатория', 'Алхимик рода: зельеварки, котлы, травы, стол чар.');

    // ---------- Караульный этаж ----------
    for (const i of [8, 10, 12, 14, 16, 22, 24, 26, 28, 30]) { w.bed(i, 24, 4, 0, -1, 'brown_bed'); if (i % 4 === 0) w.set(i, 24, 5, 'chest', { f: 's' }); }
    for (const i of [7, 9, 11, 13, 15, 17, 21, 23, 25, 27, 29, 31]) w.bed(i, 24, 17, 0, 1, 'brown_bed');
    table(12, 24, 10, 26, 11, 'spruce_slab'); for (let i = 12; i <= 26; i += 2) { K.chair(i, 24, 9, 's', 'spruce'); K.chair(i, 24, 12, 'n', 'spruce'); }
    for (const i of [14, 19, 24]) K.candle(i, 25, 10, 3);
    for (let z = 9; z <= 12; z++) { w.set(3, 24, z, 'dark_oak_fence'); K.arms(3, 25, z, 'w', SWORDS[z % SWORDS.length]); }
    for (const [i, j] of [[12, 7], [26, 7], [12, 14], [26, 14], [19, 11]]) K.chandelier(i, 29, j, 0, 1, false);
    w.room(19, 24, 11, 'Казарма', 'Спальня гарнизона: два ряда коек с сундуками, общий стол, стойка с оружием.');
    w.bed(4, 24, 31, 0, 1, 'red_bed'); table(9, 24, 26, 11, 26); K.chair(10, 24, 27, 'n'); K.candle(9, 25, 26, 2);
    K.arms(10, 26, 21, 'n', 'filled_map'); w.set(12, 24, 34, 'chest', { f: 'w', slot: 'captain', theme: 'soldier' }); K.wardrobe(3, 24, 25, 'e'); K.wardrobe(3, 24, 26, 'e');
    for (const z of [27, 28]) K.arms(3, 25, z, 'w', z % 2 ? 'shield' : 'iron_sword'); K.herald(3, 26, 23, 'w'); K.chandelier(8, 29, 29, 0, 1);
    w.room(8, 24, 28, 'Комната капитана', 'Кровать, стол с картой обороны, шкаф, оружие капитана.');
    for (const z of [22, 23, 24, 25, 26, 30, 31, 32, 33, 34]) { w.set(15, 24, z, 'dark_oak_fence'); K.arms(15, 25, z, 'w', SWORDS[z % SWORDS.length]); w.set(23, 24, z, 'barrel', { f: 'w' }); }
    w.set(18, 24, 34, 'fletching_table'); w.set(19, 24, 34, 'grindstone'); w.set(20, 24, 34, 'anvil', { f: 'e' }); w.set(21, 24, 34, 'smithing_table');
    K.chandelier(19, 29, 28, 0, 1);
    w.room(19, 24, 28, 'Арсенал', 'Запас оружия гарнизона на стойках, бочки со стрелами, верстаки оружейника. Отсюда лестница-люк на крышу.');
    solid(w, 33, 24, 21, 35, 25, 23, 'cobblestone'); for (const x of [26, 28]) w.set(x, 24, 22, 'cauldron');
    w.fill(26, 24, 33, 27, 24, 35, 'hay_block'); w.set(35, 24, 29, 'target'); w.set(34, 24, 31, 'fletching_table');
    for (let z = 25; z <= 27; z++) w.set(35, 24, z, 'barrel', { f: 'w' }); K.chandelier(30, 29, 28, 0, 1);
    w.room(30, 24, 28, 'Осадный склад', 'Камни для метания, котлы для смолы, солома, бочки стрел.');
    w.fill(-4, 24, -4, -4, 24, 3, 'hay_block'); for (let z = -4; z <= 3; z++) w.set(-4, 25, z, 'spruce_trapdoor', { open: 1, f: 'e' });
    w.set(2, 24, -3, 'composter'); K.chandelier(0, 29, 0, 0, 2);
    w.room(0, 24, 0, 'Голубятня', 'Гнёзда почтовых голубей: так замок слал вести.');
    w.fill(35, 24, -4, 41, 24, -4, 'barrel'); for (const x of [36, 37, 39, 40]) K.arms(x, 25, -4, 'n', x === 37 || x === 39 ? 'crossbow' : 'bow'); // 38 — бойница K.chandelier(38, 29, 0, 0, 2, false);
    w.room(38, 24, 0, 'Башенная оружейная', 'Запас стрел и арбалетов у бойниц.');
    // Верхние комнаты башен и средней башни
    w.set(0, 30, 0, 'stone_bricks'); w.set(0, 31, 0, 'campfire'); w.set(-2, 30, -3, 'bell'); K.bench(1, -3, 2, -3, 30, 's');
    w.room(0, 30, 0, 'Сигнальная', 'Верх северо-западной башни: сигнальный костёр на каменном постаменте и колокол.');
    w.set(38, 30, 0, 'stone_bricks'); w.set(38, 31, 0, 'campfire'); K.bench(35, -3, 37, -3, 30, 's'); w.set(41, 30, 2, 'barrel', { f: 'w' });
    w.room(38, 30, 0, 'Дозорная', 'Верх северо-восточной башни: дозорный костёр, скамья для часовых.');
    K.chair(19, 24, -5, 'n'); table(17, 24, -3, 18, -3); K.chair(16, 24, -3, 'e'); w.set(23, 24, -2, 'chest', { f: 'w' }); K.chandelier(19, 29, -3, 0, 2, false);
    w.room(19, 24, -3, 'Дозорная средней башни', 'Комната дозорного над нишей трона: окно на север, стол, сундук.');
    w.set(19, 30, -3, 'bell'); w.fill(15, 30, -2, 15, 39, -2, 'ladder', { f: 'w' }); K.hang(21, 38, -3); K.hang(17, 38, -3);
    w.room(19, 30, -3, 'Колокольня', 'Верхняя комната средней башни с набатным колоколом. Лестница ведёт на смотровую площадку.');
    K.hang(3, 36, 38); w.set(-3, 30, 36, 'barrel', { f: 'e' });
    w.room(19, 30, 19, 'Крыша', 'Плоская кровля за зубцами, над ней четыре угловые башни и средняя колокольня.');

    // ======== Оживление: обшивка, карнизы, подоконники, мелочи на столах ========
    // Всё ставится только в пустые клетки, поэтому ничего из расставленного выше не затирает.
    const isAir = (x, y, z) => { const v = w.get(x, y, z); return !v || v.id === 'air'; };
    const put = (x, y, z, id, p) => { if (isAir(x, y, z)) w.set(x, y, z, id, p); };
    // Еда, книги, монеты на столе: рамка лицом вверх на столешнице
    const dish = (x, y, z, item) => put(x, y, z, 'item_frame', { f: 'u', item });
    const web = (x, y, z) => put(x, y, z, 'cobweb');
    const WALLISH = /^(stone_bricks|cracked_stone_bricks|mossy_stone_bricks|mossy_cobblestone|cobblestone)$/;
    // Деревянная обшивка до пояса: доски и обтёсанные столбики через три блока
    const panel = (L, x1, z1, x2, z2) => box(x1, ST[L], z1, x2, ST[L] + 1, z2, (x, y, z) => {
      const v = w.get(x, y, z);
      if (v && WALLISH.test(v.id)) w.set(x, y, z, (x1 === x2 ? z : x) % 3 === 0 ? 'stripped_dark_oak_log' : 'dark_oak_planks');
    });
    // Карниз под потолком: перевёрнутые ступени вдоль стен комнаты (рамка стен x1..x2, z1..z2)
    const cornice = (y, x1, z1, x2, z2, id) => {
      const cells = [];
      for (let x = x1 + 1; x < x2; x++) { cells.push([x, z1 + 1, 'n']); cells.push([x, z2 - 1, 's']); }
      for (let z = z1 + 2; z < z2 - 1; z++) { cells.push([x1 + 1, z, 'w']); cells.push([x2 - 1, z, 'e']); }
      for (const [x, z, f] of cells) {
        const [dx, dz] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[f];
        if (isAir(x, y, z) && CastlePhysics.isOpaque(w.get(x + dx, y, z + dz))) w.set(x, y, z, id, { h: 'top', f });
      }
    };
    const SB = 'stone_brick_stairs', DO = 'dark_oak_stairs', SP = 'spruce_stairs';
    const CORNICE = [
      [0, [[2, 2, 14, 19, SB], [2, 19, 14, 36, SB], [14, 2, 24, 36, SB], [24, 2, 36, 19, SB], [24, 19, 36, 36, SB]]],
      [1, [[2, 2, 10, 13, DO], [2, 13, 10, 23, SB], [2, 23, 10, 36, SB], [10, 31, 14, 36, SB], [24, 31, 28, 36, SB], [28, 2, 36, 13, DO],
        [28, 13, 36, 24, DO], [28, 24, 36, 36, SB], [14, 31, 24, 36, SB]]],
      [2, [[2, 2, 10, 15, SB], [2, 31, 14, 36, DO], [14, 31, 24, 36, DO], [28, 2, 36, 13, DO], [28, 13, 36, 24, SB], [28, 24, 36, 31, SB], [24, 31, 36, 36, SB]]],
      [3, [[2, 2, 14, 14, DO], [14, 2, 28, 14, DO], [28, 2, 36, 14, DO], [2, 14, 36, 24, DO], [2, 24, 14, 36, SP], [14, 24, 24, 36, DO], [24, 24, 36, 36, SP]]],
      [4, [[2, 2, 36, 20, SP], [2, 20, 14, 36, DO], [14, 20, 24, 36, SB], [24, 20, 36, 36, SB]]],
    ];
    // Обшивка в господских комнатах (по наружным стенам и между соседними покоями)
    for (const [L, segs] of [
      [1, [[2, 3, 2, 12], [3, 2, 9, 2], [36, 3, 36, 12], [29, 2, 35, 2], [36, 14, 36, 23]]],
      [2, [[2, 16, 2, 30], [36, 3, 36, 12], [29, 2, 35, 2], [6, 36, 13, 36], [15, 36, 23, 36]]],
      [3, [[2, 3, 2, 13], [3, 2, 13, 2], [14, 3, 14, 13], [15, 2, 27, 2], [28, 3, 28, 13], [29, 2, 35, 2], [36, 3, 36, 13],
        [2, 15, 2, 23], [36, 15, 36, 23], [3, 14, 35, 14], [3, 24, 35, 24], [15, 36, 23, 36]]],
      [4, [[2, 21, 2, 32], [3, 20, 13, 20]]],
    ]) for (const [x1, z1, x2, z2] of segs) panel(L, x1, z1, x2, z2);
    for (const [L, rooms] of CORNICE) for (const [x1, z1, x2, z2, id] of rooms) cornice(ST[L] + 4, x1, z1, x2, z2, id);
    cornice(16, 10, 2, 28, 27, SB); // Большой зал — под самым потолком

    // Подоконники: свеча или цветок в глубине каждой оконной ниши жилых этажей
    {
      const PLANTS = ['fern', 'allium', 'lily_of_the_valley', 'cornflower'];
      let k = 0;
      const sill = (x, y, z) => { if (!isAir(x, y, z)) return; if (k++ % 3 === 2) K.pot(x, y, z, PLANTS[k % 4]); else K.candle(x, y, z, 1 + (k % 3)); };
      for (const y of [7, 13, 19]) {
        for (const i of [7, 31]) sill(i, y, 2);
        if (y === 19) for (const i of [12, 25]) sill(i, y, 2);
        for (const i of [7, 12, 26, 31]) sill(i, y, 36);
        for (const j of [8, 13, 21, 29]) sill(2, y, j);
      }
    }

    // ---- Подклет ----
    // Пекарня: стол для теста с хлебом, жернова, пучки трав под потолком
    table(6, 0, 13, 8, 15, 'spruce_slab'); dish(6, 1, 13, 'bread'); dish(7, 1, 14, 'wheat'); dish(8, 1, 15, 'bread'); K.candle(8, 1, 13, 2);
    put(11, 0, 17, 'grindstone'); for (const [x, z] of [[5, 6], [10, 16], [6, 11]]) put(x, 4, z, 'hanging_roots');
    web(3, 4, 3); web(13, 4, 18);
    // Кухня: мясо и рыба на разделочном столе, поленница у очага, тесак на колоде
    dish(7, 1, 27, 'beef'); dish(10, 1, 28, 'cod'); dish(8, 1, 29, 'carrot'); dish(7, 1, 25, 'potato'); dish(10, 1, 27, 'bread');
    put(3, 0, 32, 'stripped_spruce_log', { a: 'x' }); put(4, 0, 32, 'stripped_spruce_log', { a: 'x' }); put(3, 1, 32, 'stripped_spruce_log', { a: 'x' });
    dish(13, 1, 31, 'iron_axe');
    // Кладовые: штабеля посреди прохода между столбами, паутина по углам
    for (const [j, g] of [[11, 'barrel'], [17, 'hay_block'], [23, 'barrel'], [29, 'white_wool']]) { put(19, 0, j, g); if (g !== 'barrel') put(19, 1, j, g); }
    web(15, 4, 3); web(23, 4, 35); web(15, 4, 35);
    // Винный погреб: свечи на бочках
    for (const [x, z] of [[27, 7], [31, 11], [29, 15], [33, 7]]) K.candle(x, 2, z, 1); web(25, 4, 3); web(35, 4, 18);
    // Караульня: кости-игра на столе
    dish(31, 1, 26, 'gold_nugget'); dish(32, 1, 25, 'bread'); web(35, 4, 35);
    web(16, 4, -5); web(22, 4, -5); // ледник

    // ---- Парадный этаж ----
    // Большой зал: узорный пол, блюда на столах, поставцы со свечами у стен
    box(11, 5, 7, 27, 5, 26, (x, y, z) => {
      if (x >= 18 && x <= 20) return;
      const edge = x === 11 || x === 27 || z === 7 || z === 26 || x === 17 || x === 21;
      w.set(x, y, z, edge ? 'stone_bricks' : (x + z) % 2 ? 'polished_andesite' : 'andesite');
    });
    const FEAST = ['cooked_beef', 'bread', 'apple', 'cooked_chicken', 'pumpkin_pie', 'cooked_porkchop', 'baked_potato', 'sweet_berries'];
    for (const [x1, x2] of [[15, 16], [22, 23]]) {
      [11, 15, 19, 23].forEach((j, n) => dish(x1, 7, j, FEAST[(n + x1) % FEAST.length]));
      [12, 16, 20, 24].forEach((j, n) => dish(x2, 7, j, FEAST[(n + x2 + 3) % FEAST.length]));
    }
    [12, 14, 16, 22, 24, 26].forEach((i, n) => dish(i, 8, 4, FEAST[(n + 2) % FEAST.length]));
    for (const x of [11, 27]) for (const z of [9, 10, 21, 22]) { put(x, 6, z, 'barrel', { f: 'u' }); K.candle(x, 7, z, z % 2 ? 2 : 3); }
    // Входные сени: сундук для оружия гостей, шлемы на стене, ковёр
    K.rug(17, 33, 21, 35, 6, 'red_carpet', 'brown_carpet');
    put(23, 6, 34, 'chest', { f: 'w' }); K.arms(23, 8, 34, 'e', 'iron_helmet'); K.arms(23, 8, 35, 'e', 'leather_helmet');
    // Лестничный зал: столик для ожидающих, знамёна вассалов, подсвечник
    K.rug(29, 26, 33, 28, 6, 'blue_carpet', 'white_carpet'); K.stand(31, 6, 27); K.chair(30, 6, 27, 'e'); K.chair(32, 6, 27, 'w');
    put(29, 9, 26, 'blue_banner', { f: 'w', pat: [['bo', 15]] }); put(29, 9, 31, 'green_banner', { f: 'w', pat: [['bo', 11]] });
    K.candlestand(30, 6, 35);
    // Зал совета, буфетная, счётная палата: вещи на столах
    dish(7, 7, 10, 'filled_map'); dish(5, 7, 10, 'writable_book'); dish(7, 7, 8, 'paper');
    dish(7, 7, 28, 'glass_bottle'); dish(6, 7, 30, 'sweet_berries'); dish(7, 7, 29, 'bread');
    dish(31, 7, 9, 'gold_nugget'); dish(32, 7, 9, 'paper');

    // ---- Галерейный этаж ----
    // Галерея над залом: скамьи у аркады, откуда смотрели на пир
    for (const j of [15, 16, 21, 22]) K.chair(29, 12, j, 'w');
    K.candlestand(29, 12, 19);
    // Площадка: уголок для чтения
    put(25, 12, 35, 'bookshelf'); put(25, 13, 35, 'bookshelf'); K.chair(26, 12, 34, 'w'); K.candlestand(30, 12, 35); K.pot(25, 12, 32, 'fern');
    dish(32, 13, 7, 'writable_book'); // кабинет: раскрытая книга на столе

    // ---- Жилой этаж ----
    // Горница: кресла у камина на медвежьей шкуре, поставец со свечами, знамёна
    K.rug(4, 17, 7, 21, 18, 'brown_carpet', null);
    K.chair(6, 18, 18, 'w'); K.chair(6, 18, 20, 'w'); K.stand(6, 18, 19);
    for (let z = 17; z <= 21; z++) put(35, 18, z, 'barrel', { f: 'w' });
    K.candle(35, 19, 18, 3); K.candle(35, 19, 20, 3); w.set(35, 19, 19, 'decorated_pot'); K.shelf(35, 20, 19, 'w');
    put(16, 21, 23, 'green_banner', { f: 's', pat: [['bo', 11]] }); put(22, 21, 23, 'blue_banner', { f: 's', pat: [['bo', 15]] });
    for (let i = 9; i <= 29; i++) {
      if (i % 3 === 0) dish(i, 19, 19, FEAST[i % FEAST.length]);
      else if (i % 4 === 1) dish(i, 19, 18, FEAST[(i + 5) % FEAST.length]);
    }
    // Детская: столик с пирогом и печеньем, книжки, синее знамя
    table(30, 18, 10, 31, 11); w.set(30, 19, 11, 'cake'); dish(31, 19, 10, 'cookie'); K.chair(32, 18, 10, 'w'); K.chair(32, 18, 11, 'w');
    put(29, 18, 12, 'bookshelf'); put(29, 18, 13, 'bookshelf'); K.pot(29, 19, 13, 'cornflower'); put(30, 20, 3, 'blue_banner', { f: 'n', pat: [['flo', 11]] });
    // Бельевая: ткацкий станок, корыта, стопки белья на бочках и столе
    put(25, 18, 25, 'loom'); w.set(25, 18, 27, 'cauldron', { water: 1 }); w.set(25, 18, 28, 'cauldron', { water: 1 });
    put(35, 19, 26, 'white_wool'); put(35, 19, 28, 'white_wool');
    table(28, 18, 31, 29, 32, 'spruce_slab'); put(28, 19, 31, 'white_carpet'); put(29, 19, 32, 'white_carpet');

    // ---- Караульный этаж ----
    for (const [i, it] of [[13, 'bread'], [16, 'cooked_beef'], [20, 'bread'], [23, 'apple'], [26, 'cooked_chicken']]) dish(i, 25, 11, it);
    dish(17, 25, 10, 'gold_nugget');
    // Верх башен: паутина, тут давно никто не дежурит
    for (const [x, z] of [[-4, -4], [4, 4], [42, -4], [34, 4]]) web(x, 35, z);

    // ======== Тайники под сюжеты ========
    // Сундуки, бочки и кафедры с именем slot: что в них лежит, решает история.
    // Под ступенью трона: сундук в теле возвышения, лицом к ступени
    w.set(19, 6, 5, 'chest', { f: 's', slot: 'throne' });
    // Камень в очаге: треснувший камень в задней стенке западного камина, за ним бочка
    // в толще стены; со стороны оружейной её закрывают обычные бочки
    w.set(10, 7, 13, 'cracked_stone_bricks'); w.set(9, 7, 13, 'barrel', { f: 'e', slot: 'hearth' });
    w.set(9, 6, 14, 'barrel', { f: 'n' }); w.set(9, 7, 14, 'barrel', { f: 'n' });
    // Ухо хозяина: журнал подслушанного и бочка в каморке
    w.set(9, 12, 16, 'lectern', { f: 'w', slot: 'ear_book' }); w.set(7, 12, 20, 'barrel', { f: 'e', slot: 'ear' });
    // Кабинет: за знаменем в углу — ниша в толще наружной стены
    air(w, 36, 12, 6, 36, 12, 6); w.set(37, 12, 6, 'chest', { f: 'w', slot: 'study_niche' });
    w.set(35, 13, 6, 'black_banner', { f: 'e', pat: [['bo', 11], ['mc', 11]] });
    w.mark('slot', 36, 12, 6, 'Ниша за чёрным знаменем', 'В кабинете хозяина, в углу у книжных полок, чёрное знамя закрывает низкую нишу в толще наружной стены. Внутри сундук.');
    // Голубятня: гнездо-бочка среди сена, куда голуби приносили письма
    w.set(-4, 24, 0, 'barrel', { f: 'e', slot: 'dovecote' });
    w.mark('slot', -4, 24, 0, 'Гнездо почтовых голубей', 'В голубятне среди гнёзд из сена одна бочка: сюда складывали письма, которые приносили голуби.');
    w.mark('slot', 9, 12, 16, 'Журнал в ухе хозяина', 'Кафедра и бочка в каморке за решёткой над Большим залом.');
  }

  // ======================= БИБЛИОТЕКА =======================
  // Пристройка к восточной стене донжона между двух башен. Внизу скрипторий,
  // над ним зал библиотеки в два этажа с галереей и тайным хранилищем.
  function library(b, KX, KZ) {
    const w = at(b, KX, KZ);
    const K = kit(w);
    const lampHang = (x, y, z) => hangL(w, x, y, z);
    const chand = (x, top, z, len) => chandL(w, x, top, z, len);
    const table = (x1, y, z1, x2, z2, id) => tableL(w, x1, y, z1, x2, z2, id);
    // Стены (западной стеной служит стена донжона)
    box(39, -1, 8, 57, 17, 30, (x, y, z) => { if (z === 8 || z === 30 || x === 57) w.set(x, y, z, S(y)); });
    solid(w, 39, -1, 9, 56, -1, 29, PAVE);
    box(39, 5, 9, 56, 5, 29, (x, y, z) => w.set(x, y, z, z % 4 === 1 ? 'dark_oak_log' : 'dark_oak_planks', z % 4 === 1 ? { a: 'x' } : undefined));
    solid(w, 39, 17, 9, 56, 17, 29, PLANKS);
    roof(b, KX + 39, KZ + 8, KX + 57, KZ + 30, 18, 'z');
    // Окна: высокие в два этажа, внизу маленькие; круглые окна в щипцах
    for (const j of [11, 15, 19, 23, 27]) { win(w, 57, 7, j, 9); win(w, 57, 1, j, 2); }
    for (const i of [43, 53]) for (const j of [8, 30]) { win(w, i, 7, j, 9); win(w, i, 1, j, 2); }
    for (const j of [8, 30]) { box(47, 20, j, 49, 22, j, (x, y, z) => w.set(x, y, z, 'glass_pane')); w.set(48, 23, j, 'glass_pane'); w.set(48, 19, j, 'glass_pane'); }
    for (const j of [9, 13, 17, 21, 25, 29]) { solid(w, 58, -1, j, 58, 14, j, MOSSY); w.set(58, 15, j, 'stone_brick_stairs', { f: 'w' }); }
    air(w, 48, 0, 30, 48, 1, 30); w.door(48, 0, 30, 's', 'dark_oak_door'); lamp(w, 47, 3, 31); lamp(w, 49, 3, 31);

    // Скрипторий
    for (const j of [11, 15, 19, 23, 27]) { w.set(55, 0, j, 'lectern', { f: 'e' }); w.set(54, 0, j, 'spruce_stairs', { f: 'w' }); w.set(56, 1, j - 1, 'candle', { lit: 1 }); w.set(56, 0, j - 1, 'barrel'); }
    table(44, 0, 18, 50, 20); w.set(44, 0, 17, 'cartography_table'); w.set(50, 0, 21, 'cartography_table');
    for (let i = 45; i <= 49; i += 2) { w.set(i, 0, 17, 'spruce_stairs', { f: 'n' }); w.set(i, 0, 21, 'spruce_stairs', { f: 's' }); w.set(i, 1, 19, 'candle', { lit: 1 }); }
    for (let j = 9; j <= 27; j++) w.fill(39, 0, j, 39, 3, j, j % 5 ? 'bookshelf' : 'chiseled_bookshelf');
    for (const j of [10, 11, 12]) w.set(41, 0, j, 'barrel'); for (const j of [24, 25, 26]) w.set(41, 0, j, 'chest', { f: 'e' });
    w.fill(39, 0, 29, 39, 5, 29, 'ladder', { f: 'w' });
    for (const j of [12, 19, 26]) K.chandelier(47, 5, j, 0, 2);
    w.room(47, 0, 19, 'Скрипторий', 'Мастерская переписчиков под библиотекой: конторки у окон, столы картографов, чернила, пергамент. Вход со двора и лестница в зал библиотеки.');

    // Зал библиотеки (y 6..16) и галерея (пол y = 11)
    w.fill(47, 6, 9, 47, 6, 29, 'red_carpet');
    for (let j = 9; j <= 27; j++) if (j < 18 || j > 20) w.fill(39, 6, j, 39, 10, j, j % 4 ? 'bookshelf' : 'chiseled_bookshelf');
    solid(w, 39, 11, 9, 42, 11, 29, 'dark_oak_planks'); solid(w, 43, 11, 9, 51, 11, 12, 'dark_oak_planks'); solid(w, 43, 11, 26, 56, 11, 29, 'dark_oak_planks');
    for (let j = 13; j <= 25; j++) if (j !== 20) w.set(42, 12, j, 'dark_oak_fence');
    for (let i = 42; i <= 51; i++) w.set(i, 12, 12, 'dark_oak_fence');
    for (let i = 42; i <= 56; i++) w.set(i, 12, 26, 'dark_oak_fence');
    for (let k = 0; k <= 5; k++) { w.fill(43, 6 + k, 25 - k, 44, 6 + k, 25 - k, 'dark_oak_stairs', { f: 'n' }); if (k) solid(w, 43, 6, 25 - k, 44, 5 + k, 25 - k, 'dark_oak_planks'); }
    for (let j = 9; j <= 29; j++) if (j !== 17) w.fill(39, 12, j, 39, 15, j, j % 4 ? 'bookshelf' : 'chiseled_bookshelf');
    w.fill(39, 14, 17, 39, 15, 17, 'bookshelf');
    for (let i = 40; i <= 51; i++) if (i !== 43) w.fill(i, 12, 9, i, 15, 9, 'bookshelf');
    for (let i = 40; i <= 56; i++) if (i !== 43 && i !== 53) w.fill(i, 12, 29, i, 15, 29, 'bookshelf');
    for (const j of [13, 17, 21, 25]) { w.fill(51, 6, j, 56, 9, j, 'bookshelf'); w.fill(51, 10, j, 56, 10, j, 'dark_oak_slab'); }
    for (const j of [17, 21]) w.set(50, 6, j, 'lectern', { f: 'w' });
    for (const jc of [14, 23]) {
      table(46, 6, jc - 1, 48, jc + 1);
      for (let j = jc - 1; j <= jc + 1; j++) { w.set(45, 6, j, 'dark_oak_stairs', { f: 'w' }); w.set(49, 6, j, 'dark_oak_stairs', { f: 'e' }); }
      w.set(47, 7, jc, 'candle', { lit: 1 }); w.set(46, 7, jc - 1, 'candle', { lit: 1 });
    }
    w.set(47, 6, 19, 'lectern', { f: 's', slot: 'library_book' });
    for (const j of [13, 19, 25]) K.chandelier(47, 17, j, 3, 2);
    for (const j of [10, 28]) K.candlestand(41, 12, j);
    w.room(46, 6, 19, 'Библиотека', 'Главный зал библиотеки в два этажа: книжные шкафы-стойла между высокими окнами, столы для чтения со свечами, люстры. Лестница ведёт на галерею вдоль трёх стен, где полки до самого потолка.');
    w.room(40, 12, 20, 'Галерея библиотеки', 'Верхний ярус полок. С западной стороны дверь на галерею донжона.');
    // Тайное хранилище за полкой-дверью и чердак над ним
    w.fill(52, 12, 9, 52, 16, 12, 'bookshelf'); w.fill(53, 12, 12, 56, 16, 12, 'bookshelf'); air(w, 53, 12, 9, 56, 16, 11); solid(w, 52, 11, 9, 56, 11, 12, 'dark_oak_planks');
    w.set(55, 12, 11, 'lectern', { f: 's', slot: 'vault_book' }); w.set(54, 12, 9, 'chest', { f: 's', slot: 'vault' }); w.set(53, 12, 9, 'candle', { lit: 1 }); w.fill(56, 12, 9, 56, 17, 9, 'ladder', { f: 'e' });
    w.mark('secret', 52, 12, 10, 'Тайное хранилище', 'Конец северной галереи упирается в шкаф. Два блока полок — дверь на поршнях; рычаг спрятан под кафедрой у окна. За ней комнатка с запретными книгами и лестница на чердак.');
    w.set(53, 18, 12, 'lectern', { f: 'w', slot: 'attic_book' }); w.set(55, 18, 14, 'chest', { f: 'w', slot: 'attic' }); w.fill(53, 18, 16, 56, 18, 16, 'bookshelf'); w.set(54, 18, 13, 'candle', { lit: 1 });
    w.bed(50, 18, 12, 0, 1, 'brown_bed');
    w.mark('secret', 54, 18, 13, 'Чердак переписчика', 'Под крышей библиотеки жил и прятался последний переписчик. Попасть сюда можно только из тайного хранилища.');
  }

  // Пристройка с парадной лестницей ко входу на второй этаж
  function forebuilding(b, KX, KZ) {
    const w = at(b, KX, KZ);
    solid(w, 15, -1, 39, 15, 12, 48); solid(w, 23, -1, 39, 23, 12, 48); solid(w, 15, -1, 48, 23, 12, 48);
    air(w, 17, 0, 48, 21, 4, 48); w.set(17, 4, 48, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(21, 4, 48, 'stone_brick_stairs', { h: 'top', f: 'e' });
    solid(w, 16, -1, 39, 22, 5, 41, PAVE);
    for (let k = 0; k <= 5; k++) { if (k) solid(w, 16, -1, 47 - k, 22, k - 1, 47 - k, MOSSY); w.fill(16, k, 47 - k, 22, k, 47 - k, 'stone_brick_stairs', { f: 'n' }); }
    roof(b, KX + 15, KZ + 39, KX + 23, KZ + 48, 13, 'z');
    for (const x of [15, 23]) win(w, x, 7, 44, 3);
    box(16, 12, 39, 22, 12, 47, (x, y, z) => w.set(x, y, z, z % 3 === 0 ? 'dark_oak_log' : 'dark_oak_planks', z % 3 === 0 ? { a: 'x' } : undefined));
    kit(w).chandelier(19, 12, 43, 1, 1); banner2(w, 16, 9, 40, 'w'); banner2(w, 22, 9, 40, 'e');
    lamp(w, 16, 3, 49); lamp(w, 22, 3, 49);
    // Каморка под лестницей: из кладовых подклета за бочками в нише южной стены
    air(w, 17, 0, 39, 21, 1, 44); air(w, 19, 0, 37, 19, 1, 38);
    w.set(19, 0, 36, 'barrel', { f: 'n' }); w.set(19, 1, 36, 'barrel', { f: 'n' });
    w.set(21, 0, 44, 'chest', { f: 'w', slot: 'under_stairs' }); w.set(17, 0, 44, 'barrel', { f: 'e', theme: 'pantry' }); w.set(17, 0, 43, 'barrel', { f: 'e' });
    w.set(17, 1, 43, 'candle', { lit: 1, n: 2 }); w.set(20, 0, 39, 'cobweb'); w.set(17, 1, 39, 'cobweb'); w.set(21, 0, 40, 'hay_block');
    w.mark('secret', 19, 0, 41, 'Каморка под парадной лестницей', 'В южной стене кладовых подклета ниша, заставленная двумя бочками. За ними узкий проход в каморку под лестницей пристройки: сундук, бочки, огарок свечи.');
    w.room(19, 6, 40, 'Парадная лестница ко входу', 'Каменная пристройка с широкой лестницей: в донжон входят сразу на второй, парадный этаж. Так строили настоящие донжоны: внизу двери нет, чтобы врагу было труднее.');
  }
  const banner2 = (w, x, y, z, f) => w.set(x, y, z, 'red_banner', { f });

  // ======================= КАТАКОМБЫ =======================
  // Пол y = -11, стоять на y = -10. Описаны внутренности залов: стены
  // между соседними залами общие, проходы прорезаются отдельно.
  function catacombs(b, KX, KZ) {
    const w = at(b, KX, KZ);
    const K = kit(w);
    const FLOOR = CATA_FLOOR;
    const NATURAL = [['stone', 3], ['mossy_cobblestone', 2], ['tuff', 2], ['cobblestone', 1], ['moss_block', 1]];
    const rooms = [
      [6, 31, 54, 33, 4], // 0 южный ход
      [53, 34, 55, 59, 4], // 1 ход к склепу часовни
      [18, -8, 20, 30, 4], // 2 средний ход
      [9, 5, 29, 15, 7], // 3 усыпальница
      [23, 19, 33, 29, 4], // 4 темница
      [5, 19, 15, 29, 4], // 5 костница
      [-9, 18, 2, 28, 6, NATURAL], // 6 древнее святилище
      [-5, -5, 7, 1, 5], // 7 цистерна
      [8, -1, 17, -1, 4], // 8 ход от цистерны
      [23, -7, 31, 1, 4], // 9 запечатанная сокровищница
      [19, -18, 19, -9, 3], // 10 лаз за стену
    ];
    for (const [x1, z1, x2, z2, h, pal] of rooms) solid(w, x1 - 1, -11, z1 - 1, x2 + 1, -10 + h, z2 + 1, pal || CATA);
    solid(w, 5, -15, -5, 25, -12, -3, CATA); // сифон
    solid(w, 29, -22, 18, 33, -12, 22, CATA); // каменный мешок
    solid(w, 25, -12, 21, 28, -1, 32, CATA); // тюремный спуск
    solid(w, 26, -5, 0, 28, -2, 2, CATA); solid(w, 18, -11, -20, 20, -2, -18, CATA);
    for (const [x1, z1, x2, z2, h, pal] of rooms) {
      air(w, x1, -10, z1, x2, -11 + h, z2);
      if (!pal) box(x1, -11, z1, x2, -11, z2, (x, y, z) => w.set(x, y, z, FLOOR));
      const top = -11 + h;
      if (h >= 4) {
        if (x2 - x1 <= z2 - z1) for (let z = z1; z <= z2; z++) { w.set(x1, top, z, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(x2, top, z, 'stone_brick_stairs', { h: 'top', f: 'e' }); }
        else for (let x = x1; x <= x2; x++) { w.set(x, top, z1, 'stone_brick_stairs', { h: 'top', f: 'n' }); w.set(x, top, z2, 'stone_brick_stairs', { h: 'top', f: 's' }); }
      }
    }
    const cut = (x1, z1, x2, z2, h = 2) => air(w, x1, -10, z1, x2, -11 + h, z2);
    cut(30, 30, 30, 30); cut(21, 24, 22, 24); cut(16, 24, 17, 24); cut(10, 30, 10, 30);
    const isAir = (x, y, z) => { const v = w.get(x, y, z); return v && v.id === 'air'; };
    const put = (x, y, z, id, p) => { if (isAir(x, y, z)) w.set(x, y, z, id, p); };

    // Своды ходов: каждые четыре блока поперёк хода арка — замковый камень посередине
    // свода; под каждой второй аркой фонарь на цепи.
    const ribs = (list) => list.forEach(([x, z], k) => {
      if (!isAir(x, -7, z)) return;
      w.set(x, -7, z, 'stone_brick_slab', { h: 'top' });
      if (k % 2 === 0) put(x, -8, z, 'lantern', { hang: 1 });
    });
    { const r = []; for (let x = 8; x <= 52; x += 4) r.push([x, 32]); ribs(r); }
    { const r = []; for (let z = 36; z <= 58; z += 4) r.push([54, z]); ribs(r); }
    { const r = []; for (let z = -6; z <= 30; z += 4) if (z < 4 || z > 16) r.push([19, z]); ribs(r); }

    // Ниши-локулы в стенах ходов: в каждой останки, череп, свеча или паутина
    const NICHE = [['bone_block', 'skeleton_skull'], ['skeleton_skull', 'candle'], ['cobweb', 'skeleton_skull'], ['bone_block', 'bone_block'], ['decorated_pot', 'candle'], ['skeleton_skull', 'cobweb']];
    let nk = 0;
    const niche = (x, z, dx, dz, ax, len = 2, slot) => {
      // (x, z) — первая клетка в стене, (dx, dz) — вдоль стены, ax — внутрь стены
      const cells = [];
      for (let k = 0; k < len; k++) cells.push([x + dx * k, z + dz * k]);
      for (const [cx, cz] of cells) {
        const v = w.get(cx, -9, cz), back = w.get(cx + ax[0], -9, cz + ax[1]);
        if (!v || v.id === 'air' || (back && back.id === 'air')) return false;
        if (isAir(cx - ax[0], -9, cz - ax[1]) === false) return false; // перед нишей — ход
      }
      const kind = NICHE[nk++ % NICHE.length];
      cells.forEach(([cx, cz], k) => {
        if (!w.get(cx + ax[0], -9, cz + ax[1])) w.set(cx + ax[0], -9, cz + ax[1], CATA);
        if (!w.get(cx + ax[0], -10, cz + ax[1])) w.set(cx + ax[0], -10, cz + ax[1], CATA);
        if (slot && k === 0) { w.set(cx, -9, cz, 'chest', { f: { n: 's', s: 'n', e: 'w', w: 'e' }[ax[2]], slot, theme: 'crypt' }); return; }
        const id = kind[k];
        const p = id === 'candle' ? { lit: 1, n: 1 + (nk % 2) } : id === 'bone_block' ? { a: dx ? 'x' : 'z' } : undefined;
        w.set(cx, -9, cz, id, p);
      });
      return true;
    };
    // южный ход: северная стена z = 30, южная z = 34
    for (let x = 8; x <= 50; x += 5) { niche(x, 30, 1, 0, [0, -1, 'n']); niche(x + 2, 34, 1, 0, [0, 1, 's'], 2, x === 38 ? 'loculus' : undefined); }
    // ход к склепу: стены x = 52 и x = 56
    for (let z = 37; z <= 57; z += 5) { niche(52, z, 0, 1, [-1, 0, 'w']); niche(56, z + 2, 0, 1, [1, 0, 'e']); }
    // средний ход вне усыпальницы: стены x = 17 и x = 21
    for (const z of [-6, -1, 19, 27]) { niche(17, z, 0, 1, [-1, 0, 'w']); niche(21, z + 1, 0, 1, [1, 0, 'e']); }
    w.mark('slot', 40, -9, 34, 'Локул с сундуком', 'Одна из ниш южной стены южного хода: за черепами вместо останков стоит сундук.');

    // Тюремный спуск из караульни подклета
    for (let k = 0; k <= 9; k++) { air(w, 26, -1 - k, 22 + k, 27, -1, 22 + k); w.fill(26, -2 - k, 22 + k, 27, -2 - k, 22 + k, 'stone_brick_stairs', { f: 'n' }); }
    w.mark('room', 26, -6, 27, 'Тюремный спуск', 'Лестница из караульни подклета вниз, к темнице. Сверху огорожена решёткой.');

    // Усыпальница рода: колоннада с арками, саркофаги, гробница основателя
    box(9, -11, 5, 29, -11, 15, (x, y, z) => w.set(x, y, z, x === 9 || x === 29 || z === 5 || z === 15 || x === 17 || x === 21 ? 'stone_bricks' : (x + z) % 2 ? 'polished_andesite' : 'andesite'));
    for (const j of [7, 13]) {
      for (const i of [12, 16, 22, 26]) { solid(w, i, -10, j, i, -4, j, 'stone_bricks'); w.set(i, -10, j, 'chiseled_stone_bricks'); w.set(i, -5, j, 'chiseled_stone_bricks'); }
      for (const [a, c] of [[12, 16], [22, 26], [16, 22]]) {
        w.set(a + 1, -5, j, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(c - 1, -5, j, 'stone_brick_stairs', { h: 'top', f: 'e' });
        for (let i = a + 1; i < c; i++) w.set(i, -4, j, 'stone_bricks');
      }
    }
    for (const i of [10, 14, 24, 28]) for (const j of [8, 11]) {
      w.fill(i, -10, j, i, -10, j + 1, 'polished_andesite');
      w.set(i, -9, j, (i + j) % 3 ? 'candle' : 'skeleton_skull', { lit: 1, n: 2 }); w.set(i, -9, j + 1, 'candle', { lit: 1, n: 1 });
    }
    w.fill(17, -10, 5, 21, -10, 6, 'polished_andesite'); w.fill(17, -10, 5, 17, -10, 6, 'chiseled_stone_bricks'); w.fill(21, -10, 5, 21, -10, 6, 'chiseled_stone_bricks');
    w.fill(18, -9, 5, 20, -9, 6, 'stone_bricks'); w.set(19, -8, 5, 'skeleton_skull'); K.candle(18, -8, 5, 3, 'white_candle'); K.candle(20, -8, 5, 3, 'white_candle');
    w.set(19, -10, 5, 'chest', { f: 's', slot: 'founder', theme: 'crypt' }); // под плитой гробницы
    banner2(w, 19, -6, 5, 'n'); K.herald(9, -6, 10, 'w'); K.herald(29, -6, 10, 'e');
    for (const x of [14, 24]) chandL(w, x, -4, 10, 1);
    chandL(w, 19, -4, 10, 1);
    w.mark('room', 19, -10, 10, 'Усыпальница рода', 'Высокий зал с колоннадой и арками: каменные саркофаги хозяев замка со свечами и черепами, у северной стены главная гробница основателя под гербовым знаменем.');
    w.mark('slot', 19, -10, 5, 'Гробница основателя', 'Верхний камень гробницы основателя снимается: под ним в теле гробницы сундук.');

    // Темница: три камеры за решёткой, угол тюремщика, каменный мешок
    for (const j of [22, 26]) w.fill(29, -10, j, 33, -8, j, CATA);
    w.fill(28, -10, 19, 28, -8, 29, 'iron_bars'); for (const j of [20, 24, 28]) { w.door(28, -10, j, 'e', 'iron_door'); w.set(27, -10, j, 'lever'); }
    for (const j of [19, 23, 27]) { w.fill(33, -9, j, 33, -8, j, 'iron_chain'); w.set(32, -10, j + 2, 'hay_block'); }
    for (const j of [21, 25, 29]) put(29, -8, j, 'cobweb');
    put(33, -10, 24, 'cauldron'); w.set(29, -10, 27, 'skeleton_skull');
    air(w, 31, -18, 20, 31, -12, 20); air(w, 30, -21, 19, 32, -19, 21); w.set(31, -11, 20, 'spruce_trapdoor'); w.set(31, -10, 20, 'hay_block');
    w.set(30, -21, 19, 'skeleton_skull'); w.fill(32, -20, 21, 32, -19, 21, 'iron_chain'); w.set(31, -21, 21, 'cobweb');
    // выбраться можно: лестница по столбу в яме и дальше по стенке лаза
    solid(w, 31, -21, 19, 31, -19, 19, CATA); w.fill(31, -21, 20, 31, -12, 20, 'ladder', { f: 'n' });
    w.set(30, -20, 20, 'spruce_sign', { f: 'w', slot: 'prisoner_marks', text: '||||  ||||  ||||\n||||  ||||  ||||\n||||  ||' });
    w.set(32, -21, 19, 'decorated_pot', { slot: 'prisoner_pot' });
    // угол тюремщика у лестницы
    K.stand(24, -10, 20); K.chair(23, -10, 20, 'e'); put(23, -10, 19, 'barrel', { f: 'e', theme: 'soldier' }); K.candle(24, -9, 20, 2);
    K.arms(23, -8, 22, 'w', 'iron_sword');
    for (const j of [21, 27]) put(25, -7, j, 'lantern', { hang: 1 });
    w.mark('room', 28, -10, 24, 'Темница', 'Три камеры за решётками с железными дверями, цепи, солома. У лестницы угол тюремщика: столик, бочка, меч на стене.');
    w.mark('secret', 31, -11, 20, 'Каменный мешок', 'Под охапкой соломы в первой камере — люк. Под ним яма-одиночка в восемь блоков глубиной, куда бросали «навсегда». На стене узник считал дни зарубками, в углу его горшок. Вниз и обратно — по лестнице.');

    // Костница: стены из костей и черепов, ложная стена
    for (let j = 19; j <= 29; j++) {
      w.fill(5, -10, j, 5, -8, j, 'bone_block'); if (j % 2) w.set(5, -9, j, 'skeleton_skull'); w.fill(4, -10, j, 4, -8, j, 'bone_block');
      if (j !== 24) { w.fill(15, -10, j, 15, -8, j, 'bone_block'); if (j % 2 === 0) w.set(15, -9, j, 'skeleton_skull'); }
    }
    air(w, 3, -10, 23, 3, -9, 23); air(w, 5, -10, 23, 5, -9, 23);
    for (let i = 6; i <= 14; i++) for (const j of [19, 29]) w.set(i, -7, j, 'bone_block', { a: 'x' });
    w.fill(9, -10, 22, 11, -10, 26, 'bone_block'); w.set(10, -9, 24, 'skeleton_skull'); w.set(9, -9, 22, 'candle', { lit: 1, n: 3 }); w.set(11, -9, 26, 'candle', { lit: 1, n: 3 });
    chandL(w, 12, -7, 24, 1);
    w.mark('room', 10, -10, 24, 'Костница', 'Стены сложены из костей, в них черепа рядами. Посередине груда костей со свечами.');
    w.mark('secret', 4, -10, 23, 'Ложная стена костницы', 'Один «костяной» блок в западной стене — кладка в один слой. За ним проход в древнее святилище.');

    // Древнее святилище (старше замка)
    w.fill(-9, -11, 18, 2, -11, 28, ['moss_block', 'stone', 'mossy_cobblestone']);
    w.fill(-7, -10, 23, -7, -10, 23, 'chiseled_stone_bricks'); w.set(-7, -9, 23, 'skeleton_skull');
    for (const [y, z] of [[-9, 22], [-8, 21], [-9, 24], [-8, 25], [-7, 20], [-7, 26]]) w.set(-7, y, z, 'bone_block');
    for (const z of [21, 25]) w.set(-5, -10, z, 'candle', { lit: 1 });
    w.set(-6, -10, 23, 'decorated_pot', { slot: 'shrine' });
    for (const [x, z] of [[-3, 19], [0, 27], [-6, 27], [1, 20], [-8, 19]]) w.fill(x, -6, z, x, -6, z, 'hanging_roots');
    w.fill(-2, -10, 22, 0, -10, 24, 'moss_carpet');
    w.mark('room', -4, -10, 23, 'Древнее святилище', 'Пещера, которая старше замка: алтарь с черепом и рогами из кости, у его подножия глиняный горшок с подношением, корни свисают с потолка.');

    // Цистерна: столбы в воде, сифон в сокровищницу
    w.fill(-4, -10, -4, 6, -10, 0, 'water'); air(w, 0, -5, 0, 0, -2, 0); w.fill(0, -5, 0, 0, -2, 0, 'water');
    ring(w, -1, -4, -1, 1, -2, 1, CATA); w.fill(0, -4, 0, 0, -2, 0, 'water');
    w.set(1, -3, 0, 'chest', { f: 'w', slot: 'well' }); w.set(2, -3, 0, CATA[0][0]); w.set(1, -3, 1, CATA[0][0]);
    w.mark('slot', 1, -3, 0, 'Сундук в колодце', 'Если нырнуть в колодец донжона, на полпути к цистерне в стенке шахты стоит сундук.');
    for (const x of [-2, 3]) { solid(w, x, -10, -2, x, -7, -2, 'stone_bricks'); w.set(x, -6, -2, 'chiseled_stone_bricks'); }
    w.fill(6, -13, -4, 6, -11, -4, 'water'); w.fill(6, -14, -4, 24, -13, -4, 'water'); w.fill(24, -13, -4, 24, -11, -4, 'water');
    chandL(w, 1, -6, -4, 1); chandL(w, 5, -6, 0, 1);
    w.mark('room', 2, -10, -2, 'Цистерна', 'Подземный водоём со столбами, сюда спускается шахта колодца.');
    w.mark('secret', 6, -11, -4, 'Подводный лаз', 'В дальнем углу цистерны дно уходит вниз. Лаз под водой ныряет под средний ход и выходит в запечатанную сокровищницу. Плыть около 20 блоков.');

    // Запечатанная сокровищница
    box(23, -11, -7, 31, -11, 1, (x, y, z) => w.set(x, y, z, (x + z) % 2 ? 'polished_andesite' : 'stone_bricks'));
    for (const x of [24, 26, 28, 30]) w.set(x, -10, -6, 'chest', { f: 's', theme: 'treasure', ...(x === 28 ? { slot: 'sealed' } : {}) });
    w.set(27, -10, -3, 'gold_block'); w.set(29, -10, -3, 'gold_block'); w.set(25, -10, 0, 'decorated_pot'); w.set(30, -10, 0, 'decorated_pot');
    K.herald(23, -8, -3, 'w'); K.herald(31, -8, -3, 'e'); K.candle(27, -9, -3, 3); K.candle(29, -9, -3, 3);
    air(w, 27, -6, 1, 27, 19, 1); w.fill(27, -6, 1, 27, 19, 1, 'ladder', { f: 'n' });
    w.mark('room', 27, -10, -3, 'Запечатанная сокровищница', 'Глухой зал без дверей. Попасть сюда можно двумя путями: по потайной шахте из опочивальни хозяина или вплавь через сифон из цистерны.');
    w.mark('slot', 28, -10, -6, 'Сундук рода', 'Средний сундук у северной стены запечатанной сокровищницы.');

    // Лаз за стену
    air(w, 19, -10, -19, 19, -2, -19); w.fill(19, -10, -19, 19, -2, -19, 'ladder', { f: 'n' }); w.set(19, -1, -19, 'spruce_trapdoor');
    w.mark('secret', 19, -10, -14, 'Потайной лаз', 'Узкий ход из подземелья под крепостной стеной. Выходит люком в лесу за северной стеной.');

    // Запустение: паутина по углам, мох и корни, завалы у стен
    for (const [i, j] of [[6, 31], [54, 58], [18, -8], [20, 30], [19, -17], [23, -7], [6, 33], [53, 34], [9, 5], [29, 15], [5, 19]]) put(i, -10, j, 'cobweb');
    for (const [i, j] of [[20, -8], [6, 32], [55, 59], [9, 15], [29, 5], [-5, 1], [7, -5]]) put(i, -11 + 3, j, 'cobweb');
    for (const [i, j] of [[12, 33], [27, 31], [44, 33], [53, 45], [55, 52], [18, 22], [20, -3]]) put(i, -10, j, 'moss_carpet');
    for (const [i, j] of [[15, 32], [31, 32], [47, 32], [54, 41], [54, 50], [19, 24], [19, -3]]) put(i, -7, j, 'hanging_roots');
    for (const [i, j, id] of [[36, 33, 'mossy_cobblestone_slab'], [37, 33, 'cobblestone_slab'], [55, 44, 'mossy_cobblestone_slab'], [53, 55, 'cobblestone'], [53, 56, 'mossy_cobblestone_slab'], [7, 31, 'cobblestone_slab']]) put(i, -10, j, id);
    w.mark('room', 30, -10, 32, 'Южный ход', 'Главный коридор подземелья под сводами с арками, в стенах ниши-локулы с останками. На восточном конце поворачивает к склепу часовни.');
  }

  // ======================= КРЕПОСТНЫЕ СТЕНЫ =======================
  // X2, Z2 — дальние углы; CX — середина ворот.
  function curtain(b, X2, Z2, CX) {
    const WT = 8;
    const wall = (x1, z1, x2, z2, outer) => {
      solid(b, x1, -1, z1, x2, WT, z2);
      const line = outer === 'n' ? [x1, z1, x2, z1] : outer === 's' ? [x1, z2, x2, z2] : outer === 'w' ? [x1, z1, x1, z2] : [x2, z1, x2, z2];
      box(line[0], WT + 1, line[1], line[2], WT + 1, line[3], (x, y, z) => b.set(x, y, z, STONE));
      box(line[0], WT + 2, line[1], line[2], WT + 2, line[3], (x, y, z) => { if ((x + z) % 2 === 0) b.set(x, y, z, STONE); });
      const [dx, dz] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[outer];
      box(line[0], 0, line[1], line[2], 0, line[3], (x, _, z) => {
        if ((x + z) % 10 !== 0) return;
        solid(b, x + dx, -1, z + dz, x + dx, WT - 2, z + dz, MOSSY);
        b.set(x + dx, WT - 1, z + dz, 'stone_brick_stairs', { f: { n: 's', s: 'n', w: 'e', e: 'w' }[outer] });
      });
    };
    const E = X2 - 4, SZ = Z2 - 4;
    wall(9, 3, X2 - 9, 4, 'n'); wall(3, 9, 4, Z2 - 9, 'w'); wall(E, 9, E + 1, Z2 - 9, 'e');
    wall(9, SZ, CX - 10, SZ + 1, 's'); wall(CX + 10, SZ, X2 - 9, SZ + 1, 's');
    for (const [x1, z1] of [[0, 0], [X2 - 8, 0], [0, Z2 - 8], [X2 - 8, Z2 - 8]]) {
      const x2 = x1 + 8, z2 = z1 + 8;
      ring(b, x1, -1, z1, x2, 15, z2); air(b, x1 + 1, 0, z1 + 1, x2 - 1, 15, z2 - 1);
      solid(b, x1 + 1, -1, z1 + 1, x2 - 1, -1, z2 - 1, PAVE); solid(b, x1 + 1, 8, z1 + 1, x2 - 1, 8, z2 - 1, PLANKS);
      corbels(b, x1, z1, x2, z2, 15); solid(b, x1, 15, z1, x2, 15, z2, PLANKS);
      ring(b, x1 - 1, 16, z1 - 1, x2 + 1, 16, z2 + 1, STONE);
      for (const [x, z] of [[x1 - 1, z1 - 1], [x2 + 1, z1 - 1], [x1 - 1, z2 + 1], [x2 + 1, z2 + 1]]) solid(b, x, 17, z, x, 18, z, FRAME);
      pyramid(b, x1 - 2, z1 - 2, x2 + 2, z2 + 2, 19);
      b.fill(x1 + 4, 26, z1 + 4, x1 + 4, 27, z1 + 4, 'spruce_fence'); b.set(x1 + 4, 28, z1 + 4, 'red_banner', { stand: 0 });
      for (const y of [2, 10]) { win(b, x1 + 4, y, z1, 2, 'iron_bars'); win(b, x1 + 4, y, z2, 2, 'iron_bars'); win(b, x1, y, z1 + 4, 2, 'iron_bars'); win(b, x2, y, z1 + 4, 2, 'iron_bars'); }
      b.fill(x1 + 1, 0, z1 + 2, x1 + 1, 15, z1 + 2, 'ladder', { f: 'w' });
      lamp(b, x1 + 4, 14, z1 - 2); lamp(b, x1 + 4, 14, z2 + 2);
    }
    for (const [x, z, f] of [[8, 6, 'e'], [X2 - 8, 6, 'w'], [8, Z2 - 6, 'e'], [X2 - 8, Z2 - 6, 'w']]) b.door(x, 0, z, f, 'spruce_door');
    for (const [x, z] of [[8, 4], [4, 8], [X2 - 8, 4], [E, 8], [8, SZ], [4, Z2 - 8], [X2 - 8, SZ], [E, Z2 - 8]]) doorway(b, x, 9, z);
    // Надвратные башни
    const GZ1 = SZ - 3, GZ2 = SZ + 3;
    for (const x1 of [CX - 9, CX + 3]) {
      const x2 = x1 + 6, west = x1 < CX;
      ring(b, x1, -1, GZ1, x2, 14, GZ2); air(b, x1 + 1, 0, GZ1 + 1, x2 - 1, 14, GZ2 - 1);
      solid(b, x1 + 1, -1, GZ1 + 1, x2 - 1, -1, GZ2 - 1, PAVE); solid(b, x1 + 1, 8, GZ1 + 1, x2 - 1, 8, GZ2 - 1, PLANKS);
      battlements(b, x1, GZ1, x2, GZ2, 15);
      for (const y of [2, 10]) win(b, x1 + 3, y, GZ2, 2, 'iron_bars');
      win(b, west ? x2 : x1, 2, SZ, 2, 'iron_bars');
      b.fill(west ? x1 + 1 : x2 - 1, 0, SZ + 1, west ? x1 + 1 : x2 - 1, 15, SZ + 1, 'ladder', { f: west ? 'w' : 'e' });
      b.door(x1 + 3, 0, GZ1, 'n', 'spruce_door');
      doorway(b, west ? x1 : x2, 9, SZ);
    }
    const g1 = CX - 2, g2 = CX + 2;
    solid(b, g1, 6, GZ1, g2, 13, GZ2); solid(b, g1, -1, GZ1, g2, -1, GZ2, PAVE); air(b, g1, 0, GZ1, g2, 5, GZ2);
    for (let z = GZ1; z <= GZ2; z++) { b.set(g1, 5, z, 'stone_brick_stairs', { h: 'top', f: 'w' }); b.set(g2, 5, z, 'stone_brick_stairs', { h: 'top', f: 'e' }); }
    for (let x = g1; x <= g2; x++) { b.set(x, 5, GZ2 - 1, 'iron_bars'); b.set(x, 4, GZ2 - 1, 'iron_bars'); }
    box(g1, 14, GZ1, g2, 14, GZ2, (x, y, z) => { if (z === GZ1 || z === GZ2) b.set(x, y, z, STONE); });
    box(g1, 15, GZ1, g2, 15, GZ2, (x, y, z) => { if ((z === GZ1 || z === GZ2) && (x + z) % 2 === 0) b.set(x, y, z, STONE); });
    b.door(g1, 0, GZ1 + 1, 'w', 'dark_oak_door', true); b.door(g2, 0, GZ1 + 1, 'e', 'dark_oak_door', true);
    for (const x of [g1 - 1, g2 + 1]) { lamp(b, x, 4, GZ2 + 1); lamp(b, x, 4, GZ1 - 1); b.set(x, 6, GZ2 + 1, 'red_banner', { f: 'n' }); }
    b.mark('room', CX, 0, SZ, 'Ворота', 'Проезд между двух надвратных башен, поднятая решётка, тяжёлые створки. Над аркой — каменный переход.');
    for (let k = 0; k <= 8; k++) {
      b.set(CX - 21 + k, k, SZ - 1, 'stone_brick_stairs', { f: 'e' }); solid(b, CX - 21 + k, -1, SZ - 1, CX - 21 + k, k - 1, SZ - 1, MOSSY);
      b.set(CX + 21 - k, k, SZ - 1, 'stone_brick_stairs', { f: 'w' }); solid(b, CX + 21 - k, -1, SZ - 1, CX + 21 - k, k - 1, SZ - 1, MOSSY);
    }
    for (const [x1, z1, x2, z2] of [[9, 3, X2 - 9, 4], [3, 9, 4, Z2 - 9], [E, 9, E + 1, Z2 - 9], [9, SZ, CX - 10, SZ + 1], [CX + 10, SZ, X2 - 9, SZ + 1]]) overgrow(b, x1, z1, x2, z2, 9, 22);
  }

  // ======================= ДВОР =======================
  function yard(b, CX, SZ) {
    b.surface(CX - 2, 66, CX + 2, SZ + 10, YARD);
    b.surface(CX - 13, 100, CX + 13, 118, YARD, 0.7);
    b.surface(35, 74, CX - 3, 76, YARD, 0.8); b.surface(CX + 3, 80, 87, 82, YARD, 0.8);
    for (let z = 72; z <= 120; z += 12) for (const x of [CX - 3, CX + 3]) { solid(b, x, 0, z, x, 1, z, 'stone_brick_wall'); b.set(x, 2, z, 'lantern'); }
    // Колодец
    ring(b, CX + 7, 0, 108, CX + 9, 0, 110, 'mossy_cobblestone'); b.set(CX + 8, 0, 109, 'air'); b.set(CX + 8, -1, 109, 'water');
    solid(b, CX + 7, 1, 109, CX + 7, 2, 109, 'spruce_fence'); solid(b, CX + 9, 1, 109, CX + 9, 2, 109, 'spruce_fence');
    pyramid(b, CX + 6, 108, CX + 10, 110, 3); b.set(CX + 8, 2, 109, 'iron_chain');
    b.mark('room', CX + 8, 0, 109, 'Колодец', 'Колодец на площади у ворот, под шатровой крышей.');

    // Казарма
    house(b, 10, 70, 34, 80, 9, { axis: 'x', mid: 4 });
    b.door(34, 0, 75, 'e', 'dark_oak_door');
    for (let x = 13; x <= 31; x += 4) { win(b, x, 1, 70); win(b, x, 1, 80); win(b, x, 6, 70); win(b, x, 6, 80); }
    for (let x = 12; x <= 30; x += 3) { b.bed(x, 0, 71, 0, 1, 'brown_bed'); b.bed(x, 5, 71, 0, 1, 'brown_bed'); }
    for (let x = 14; x <= 26; x += 6) { b.fill(x, 0, 77, x + 2, 0, 77, 'spruce_slab', { h: 'top' }); b.set(x, 0, 78, 'spruce_stairs', { f: 's' }); }
    b.fill(11, 0, 79, 11, 4, 79, 'ladder', { f: 'w' }); b.set(12, 0, 79, 'barrel'); b.set(32, 0, 79, 'barrel');
    solid(b, 30, 10, 75, 30, 18, 75, STONE); b.set(30, 19, 75, 'cobblestone_slab');
    lamp(b, 35, 4, 73); lamp(b, 35, 4, 77); for (const x of [16, 28]) { lamp(b, x, 4, 69); lamp(b, x, 4, 81); }
    overgrow(b, 10, 70, 34, 80, 9, 14);
    b.mark('room', 22, 0, 75, 'Казарма', 'Два этажа коек для гарнизона, столы, бочки.');
    // Кузница
    house(b, 10, 86, 20, 96, 5, { axis: 'x', open: 'se', floor: [['coarse_dirt', 2], ['gravel', 1]] });
    solid(b, 11, 0, 87, 13, 1, 88, STONE); b.set(12, 1, 88, 'campfire'); solid(b, 11, 2, 87, 13, 12, 88, STONE); b.set(12, 13, 87, 'campfire');
    b.set(14, 0, 87, 'blast_furnace', { f: 's' }); b.set(15, 0, 87, 'furnace', { f: 's' });
    b.set(15, 0, 91, 'anvil', { f: 'e' }); b.set(17, 0, 91, 'grindstone'); b.set(11, 0, 92, 'cauldron'); b.set(11, 0, 94, 'smithing_table'); b.set(14, 0, 95, 'chest', { f: 'n' });
    lamp(b, 21, 4, 90); overgrow(b, 10, 86, 20, 96, 5, 6);
    b.mark('room', 15, 0, 91, 'Кузница', 'Навес с горном и трубой, плавильня, наковальня, точило.');
    // Конюшня
    house(b, 26, 86, 38, 100, 4, { axis: 'z', open: 'e', floor: [['coarse_dirt', 2], ['podzol', 1]] });
    for (const z of [89, 92, 95, 98]) b.fill(27, 0, z, 31, 0, z, 'spruce_fence');
    for (const z of [87, 90, 93, 96, 99]) { b.set(27, 0, z, 'hay_block'); b.set(31, 0, z, 'spruce_fence_gate', { f: 'e' }); }
    for (const z of [88, 91, 94, 97]) { b.set(27, 0, z, 'composter'); b.set(31, 0, z, 'spruce_fence'); }
    b.set(36, 0, 88, 'hay_block'); b.set(36, 1, 88, 'hay_block'); b.set(36, 0, 99, 'barrel');
    lamp(b, 39, 3, 92); lamp(b, 39, 3, 96); overgrow(b, 26, 86, 38, 100, 4, 8);
    b.mark('room', 32, 0, 93, 'Конюшня', 'Пять стойл с кормушками и сеном.');
    // Амбар
    house(b, 8, 12, 22, 24, 6, { axis: 'x' });
    b.door(15, 0, 24, 's', 'spruce_door'); b.door(16, 0, 24, 's', 'spruce_door');
    for (let x = 9; x <= 21; x++) for (const z of [13, 23]) if (x % 3 && !(z === 23 && (x === 15 || x === 16))) { b.set(x, 0, z, 'barrel'); if (x % 2) b.set(x, 1, z, 'hay_block'); }
    b.fill(18, 0, 16, 21, 2, 19, 'hay_block'); for (const x of [11, 19]) { win(b, x, 2, 12); win(b, x, 2, 24); }
    lamp(b, 14, 4, 25); lamp(b, 17, 4, 25); overgrow(b, 8, 12, 22, 24, 6, 10);
    b.mark('room', 15, 0, 18, 'Амбар', 'Склад зерна и сена.');
    // Огород
    b.walls(8, 0, 30, 30, 0, 58, 'spruce_fence'); b.set(19, 0, 30, 'spruce_fence_gate', { f: 'n' });
    for (const [z, c] of [[33, 'potatoes'], [34, 'carrots'], [36, 'beetroot'], [37, 'potatoes'], [39, 'carrots'], [40, 'beetroot'], [42, 'potatoes'], [43, 'carrots']]) b.crops(10, z, 28, z, c);
    for (const z of [35, 38, 41]) b.surface(10, z, 28, z, 'water');
    b.set(19, 0, 47, 'spruce_fence'); b.set(19, 1, 47, 'hay_block'); b.set(19, 2, 47, 'carved_pumpkin', { f: 's' });
    for (const x of [10, 12, 14, 16]) b.set(x, 0, 56, 'beehive', { f: 'n' });
    for (let x = 20; x <= 28; x++) for (const z of [52, 54]) b.set(x, 0, z, ['allium', 'cornflower', 'dandelion', 'lily_of_the_valley', 'poppy']);
    b.mark('room', 19, 0, 44, 'Огород', 'Грядки с канавками, пугало, ульи, цветник.');
    // Дом управителя
    house(b, 96, 6, 108, 18, 9, { axis: 'z', mid: 4 });
    b.door(102, 0, 18, 's', 'dark_oak_door');
    b.fill(99, 4, 19, 105, 4, 20, 'spruce_slab', { h: 'top' }); for (let x = 99; x <= 105; x++) b.set(x, 5, 20, 'spruce_fence'); b.set(99, 5, 19, 'spruce_fence'); b.set(105, 5, 19, 'spruce_fence');
    for (const x of [99, 105]) b.fill(x, 0, 20, x, 3, 20, 'stripped_spruce_log');
    b.door(102, 5, 18, 's', 'spruce_door');
    for (const x of [98, 106]) { win(b, x, 1, 18); win(b, x, 6, 18); win(b, x, 1, 6); win(b, x, 6, 6); }
    for (const z of [8, 12, 16]) for (const x of [96, 108]) { win(b, x, 1, z); win(b, x, 6, z); }
    b.fill(98, 0, 8, 100, 1, 8, 'bookshelf'); b.fill(101, 0, 11, 104, 0, 12, 'spruce_slab', { h: 'top' }); b.set(106, 0, 8, 'chest', { f: 's', slot: 'steward' });
    b.bed(98, 5, 9, 0, -1, 'red_bed'); b.set(106, 5, 8, 'barrel'); b.fill(107, 0, 14, 107, 4, 14, 'ladder', { f: 'e' }); // у глухого простенка, не у окна
    lamp(b, 98, 4, 19); lamp(b, 106, 4, 19); overgrow(b, 96, 6, 108, 18, 9, 12);
    b.mark('room', 102, 0, 12, 'Дом управителя', 'Двухэтажный дом с балконом над входом.');
    // Ристалище
    b.walls(104, 0, 26, 120, 0, 52, 'spruce_fence'); b.set(104, 0, 39, 'spruce_fence_gate', { f: 'w' });
    b.surface(105, 27, 119, 51, [['coarse_dirt', 2], ['gravel', 1], ['grass_path', 1]]);
    for (const z of [30, 36, 42, 48]) { b.set(119, 0, z, 'hay_block'); b.set(119, 1, z, 'target'); }
    for (const x of [108, 112]) for (const z of [34, 44]) { b.set(x, 0, z, 'spruce_fence'); b.set(x, 1, z, 'hay_block'); b.set(x, 2, z, 'carved_pumpkin', { f: 'w' }); }
    b.set(106, 0, 28, 'barrel'); b.set(106, 0, 29, 'grindstone');
    b.mark('room', 112, 0, 39, 'Ристалище', 'Двор для учений: мишени, чучела.');
    for (const [x, z] of [[24, 7], [34, 8], [30, 63], [100, 60]]) b.spruce(x, z, 9, 0, false, true);
  }
  // ======================= ЧАСОВНЯ =======================
  // Крестообразная, с башенкой-шатром и крестом на средокрестии — как первый образец.
  function chapel(b) {
    house(b, 58, 54, 78, 64, 7, { axis: 'x', step: 4 });
    house(b, 66, 50, 70, 68, 7, { axis: 'z', step: 6, roof: false });
    // Средокрестие: убрать внутренние стены, оставить четыре опоры
    air(b, 67, 0, 54, 69, 6, 54); air(b, 67, 0, 64, 69, 6, 64);
    air(b, 66, 0, 55, 66, 7, 63); air(b, 70, 0, 55, 70, 7, 63);
    for (const [x, z] of [[66, 55], [70, 55], [66, 63], [70, 63]]) solid(b, x, 0, z, x, 7, z, FRAME);
    b.fill(67, -1, 55, 69, -1, 63, PLANKS);
    roof(b, 66, 50, 70, 58, 8, 'z'); roof(b, 66, 60, 70, 68, 8, 'z');
    roof(b, 58, 54, 78, 64, 8, 'x');
    // Апсида
    house(b, 79, 57, 81, 61, 5, { axis: 'x', roof: false }); air(b, 78, 0, 58, 79, 4, 60);
    roof(b, 79, 57, 81, 61, 6, 'x');
    // Башня над средокрестием
    ring(b, 66, 8, 57, 70, 18, 61, FRAME); air(b, 67, 8, 58, 69, 18, 60);
    for (const [x, z] of [[68, 57], [68, 61], [66, 59], [70, 59]]) air(b, x, 14, z, x, 16, z);
    b.set(68, 14, 59, 'bell'); b.fill(67, 13, 58, 69, 13, 60, PLANKS);
    // Балкон с перилами вокруг башни
    box(65, 12, 56, 71, 12, 62, (x, y, z) => { if (x === 65 || x === 71 || z === 56 || z === 62) b.set(x, y, z, 'spruce_slab', { h: 'top' }); });
    box(65, 13, 56, 71, 13, 62, (x, y, z) => { if (x === 65 || x === 71 || z === 56 || z === 62) b.set(x, y, z, 'spruce_fence'); });
    pyramid(b, 65, 56, 71, 62, 19);
    b.fill(68, 23, 59, 68, 26, 59, 'spruce_fence'); b.set(67, 25, 59, 'spruce_fence'); b.set(69, 25, 59, 'spruce_fence');
    for (const [x, z] of [[65, 56], [71, 56], [65, 62], [71, 62]]) b.set(x, 11, z, 'lantern', { hang: 1 });
    // Вход: арка и крыльцо под навесом
    b.door(58, 0, 59, 'w', 'dark_oak_door'); b.set(58, 2, 59, 'chiseled_stone_bricks');
    solid(b, 55, 0, 57, 55, 4, 57, FRAME); solid(b, 55, 0, 61, 55, 4, 61, FRAME); b.fill(55, -1, 57, 57, -1, 61, PAVE);
    roof(b, 55, 57, 57, 61, 5, 'x');
    win(b, 58, 6, 59, 2); lamp(b, 57, 4, 56); lamp(b, 57, 4, 62);
    // Окна нефа и трансепта
    for (const x of [60, 63, 73, 76]) { win(b, x, 2, 54, 3); win(b, x, 2, 64, 3); }
    for (const z of [51, 67]) { win(b, 66, 2, z, 3); win(b, 70, 2, z, 3); }
    win(b, 68, 3, 50, 3); win(b, 68, 3, 68, 3); win(b, 81, 2, 59, 3);
    for (const x of [62, 74]) { lamp(b, x, 5, 53); lamp(b, x, 5, 65); }
    // Скамьи, алтарь, свечи
    for (let x = 60; x <= 64; x += 2) for (const z of [55, 56, 57, 61, 62, 63]) b.set(x, 0, z, 'spruce_stairs', { f: 'w' });
    for (let x = 72; x <= 74; x += 2) for (const z of [56, 57, 61, 62]) b.set(x, 0, z, 'spruce_stairs', { f: 'w' });
    b.fill(77, 0, 58, 77, 0, 60, 'chiseled_stone_bricks'); b.fill(77, 1, 58, 77, 1, 60, 'smooth_stone_slab');
    b.set(77, 2, 58, 'candle', { lit: 1 }); b.set(77, 2, 60, 'candle', { lit: 1 }); b.set(80, 0, 59, 'lectern', { f: 'w', slot: 'chapel_yard_book' });
    b.fill(59, 0, 59, 76, 0, 59, 'red_carpet');
    b.set(68, 7, 59, 'lantern', { hang: 1 }); b.fill(68, 8, 59, 68, 12, 59, 'iron_chain');
    // Убранство: витражи в апсиде и торцах, знамёна с крестом, подсвечники у алтаря,
    // купель в северном рукаве, люстры в нефе
    const K = kit(b);
    for (let y = 2; y <= 4; y++) b.set(81, y, 59, ['red_stained_glass_pane', 'yellow_stained_glass_pane', 'blue_stained_glass_pane'][y - 2]);
    for (let y = 3; y <= 5; y++) { b.set(68, y, 50, y === 4 ? 'yellow_stained_glass_pane' : 'blue_stained_glass_pane'); b.set(68, y, 68, y === 4 ? 'yellow_stained_glass_pane' : 'red_stained_glass_pane'); }
    for (let y = 6; y <= 7; y++) b.set(58, y, 59, 'yellow_stained_glass_pane');
    for (const x of [61, 75]) { b.set(x, 5, 55, 'white_banner', { f: 'n', pat: [['sc', 1]] }); b.set(x, 5, 63, 'white_banner', { f: 's', pat: [['sc', 1]] }); }
    K.candlestand(77, 0, 57); K.candlestand(77, 0, 61); K.pot(78, 0, 57, 'lily_of_the_valley'); K.pot(78, 0, 61, 'lily_of_the_valley');
    b.set(68, -1, 52, 'chiseled_stone_bricks'); b.set(68, 0, 52, 'cauldron', { water: 1 }); K.candle(67, 0, 51, 3); K.candle(69, 0, 51, 3);
    K.pot(67, 0, 66, 'allium'); K.pot(69, 0, 66, 'allium');
    for (const x of [62, 74]) K.chandelier(x, 14, 59, 4, 1);
    // Спуск в склеп в южном рукаве трансепта
    b.fill(68, -10, 67, 68, -1, 67, 'ladder', { f: 's' });
    b.mark('room', 68, 0, 59, 'Часовня', 'Крестообразная часовня: неф со скамьями, алтарь в апсиде, над средокрестием башенка с колоколом и крестом. В южном рукаве — лаз в склеп.');
    overgrow(b, 58, 54, 78, 64, 7, 22);
    // Склеп под часовней
    // Склеп в том же камне, что катакомбы: саркофаги со свечами и черепами, столбы
    // с резными капителями, ниши с останками, фонари на цепях
    solid(b, 59, -11, 54, 77, -5, 68, CATA); air(b, 60, -10, 55, 76, -6, 63); air(b, 67, -10, 64, 69, -7, 67);
    air(b, 64, -10, 54, 66, -7, 54); solid(b, 68, -4, 68, 68, -2, 68, CATA);
    b.fill(60, -11, 55, 76, -11, 63, CATA_FLOOR); b.fill(67, -11, 64, 69, -11, 67, CATA_FLOOR);
    b.fill(68, -10, 67, 68, -1, 67, 'ladder', { f: 's' });
    for (const x of [62, 66, 70, 74]) for (const z of [56, 62]) {
      b.fill(x, -10, z, x + 1, -10, z, 'polished_andesite');
      b.set(x, -9, z, 'candle', { lit: 1, n: 2 }); b.set(x + 1, -9, z, (x + z) % 4 ? 'skeleton_skull' : 'candle', { lit: 1 });
    }
    for (const x of [64, 72]) for (const z of [55, 63]) { b.fill(x, -10, z, x, -6, z, 'stone_bricks'); b.set(x, -10, z, 'chiseled_stone_bricks'); b.set(x, -6, z, 'chiseled_stone_bricks'); }
    for (const [x, z] of [[60, 54], [61, 54], [73, 54], [74, 54], [61, 64], [62, 64], [74, 64], [75, 64]]) {
      b.set(x, -9, z, (x + z) % 3 ? 'skeleton_skull' : 'bone_block', { a: 'x' }); b.set(x, -9, z < 59 ? z - 1 : z + 1, CATA);
    }
    for (const x of [63, 73]) chandL(b, x, -6, 59, 1);
    b.set(77, -9, 59, 'chest', { f: 'w', slot: 'crypt_tomb', theme: 'crypt' }); b.set(78, -9, 59, CATA);
    K.candle(76, -10, 58, 3, 'white_candle'); K.candle(76, -10, 60, 3, 'white_candle');
    for (const [x, z] of [[60, 55], [76, 63], [60, 63], [76, 55]]) b.set(x, -7, z, 'cobweb');
    b.mark('room', 68, -10, 59, 'Склеп часовни', 'Под полом часовни: саркофаги в два ряда со свечами и черепами, ниши с останками. Отсюда длинный ход ведёт к катакомбам донжона.');
    b.mark('slot', 77, -9, 59, 'Ниша в торце склепа', 'В дальней стене склепа, между двух белых свечей, ниша с сундуком.');
      // Кладбище у часовни
    b.walls(60, 0, 70, 84, 0, 84, 'mossy_cobblestone_wall'); b.set(60, 0, 77, 'air');
    for (let x = 63; x <= 81; x += 3) for (let z = 73; z <= 81; z += 4) {
      b.surface(x, z, x, z + 1, 'coarse_dirt');
      if ((x + z) % 2) { b.fill(x, 0, z, x, 1, z, 'spruce_fence'); b.set(x, 1, z - 1, 'spruce_fence'); b.set(x, 1, z + 1, 'spruce_fence'); b.set(x, 1, z, 'spruce_fence'); }
      else b.set(x, 0, z, 'mossy_stone_brick_wall');
      if (b.chance(0.4)) b.set(x + 1, 0, z + 1, ['poppy', 'candle', 'lily_of_the_valley']);
    }
    // Свечи на надгробиях, фонари у входа, скамья, сухое дерево, свежая могила
    for (let x = 63; x <= 81; x += 6) for (let z = 73; z <= 81; z += 8) if (b.get(x, 0, z) && b.get(x, 0, z).id === 'mossy_stone_brick_wall') K.candle(x, 1, z, 2);
    b.set(60, 1, 76, 'lantern'); b.set(60, 1, 78, 'lantern');
    K.bench(62, 71, 64, 71, 0, 's'); b.spruce(82, 72, 6, 0, true, true);
    b.set(66, -1, 78, 'suspicious_gravel', { slot: 'grave', theme: 'crypt' });
    b.mark('room', 72, 0, 77, 'Кладбище', 'Низкая каменная ограда, кресты и надгробия рядами, на некоторых горят свечи. У входа фонари, у ограды скамья и сухое дерево.');
    b.mark('slot', 66, -1, 78, 'Свежая могила', 'Одна из могил присыпана гравием, а не землёй: если смахнуть его кистью, найдётся спрятанное.');

  }

  // ======================= ЖИЗНЬ ДВОРА =======================
  // Дорожки к каждой двери, фонари на перекрёстках, лавки у площади, клумбы,
  // обстановка дворовых зданий и башен. Мировые координаты шаблона.
  // Всё ставится только в пустые клетки (put), чтобы не затереть постройки.
  function yardLife(b, CX, SZ) {
    const K = kit(b);
    const isAir = (x, y, z) => { const v = b.get(x, y, z); return !v || v.id === 'air'; };
    const put = (x, y, z, id, p) => { if (isAir(x, y, z)) b.set(x, y, z, id, p); };
    const dish = (x, y, z, item) => put(x, y, z, 'item_frame', { f: 'u', item });
    const arms = (x, y, z, wall, item) => put(x, y, z, 'item_frame', { f: wall, item });

    // ---------- Дорожки и фонари ----------
    const PATH = [['gravel', 3], ['coarse_dirt', 2], ['grass_path', 3], ['cobblestone', 1], ['mossy_cobblestone', 1]];
    // Полоса шириной 3 по ломаной; края местами зарастают. Только по земле двора,
    // мимо грядок и воды.
    const trail = (pts) => {
      for (let k = 1; k < pts.length; k++) {
        const [ax, az] = pts[k - 1], [bx, bz] = pts[k];
        const n = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
        for (let st = 0; st <= n; st++) {
          const x = Math.round(ax + ((bx - ax) * st) / n), z = Math.round(az + ((bz - az) * st) / n);
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            const g = b.get(x + dx, -1, z + dz);
            if (!g || !g.g || /farmland|water/.test(g.id)) continue;
            if ((dx || dz) && b.chance(0.3)) continue;
            b.set(x + dx, -1, z + dz, PATH, { g: 1 });
          }
        }
      }
    };
    trail([[42, 76], [42, 102], [23, 102], [23, 95]]); // к конюшне и кузнице
    trail([[16, 25], [18, 29]]); trail([[18, 27], [34, 28], [37, 40], [38, 62], [42, 73]]); // амбар, огород
    trail([[52, 57], [52, 73]]); trail([[74, 57], [74, 79]]); // двери подклета донжона
    trail([[92, 49], [92, 60], [90, 78]]); // библиотека
    trail([[102, 20], [102, 38], [103, 39]]); trail([[102, 30], [94, 32], [92, 46]]); // дом управителя, ристалище
    trail([[89, 85], [89, 99], [92, 99]]); // кладбище
    trail([[19, 44], [24, 46]]); // в огороде к сарайчику
    // Фонарь на каменном столбике у развилок
    const post = (x, z) => {
      const g = b.get(x, -1, z);
      if (!g || !g.g || !isAir(x, 0, z) || !isAir(x, 1, z) || !isAir(x, 2, z)) return;
      b.set(x, 0, z, 'stone_brick_wall'); b.set(x, 1, z, 'stone_brick_wall'); b.set(x, 2, z, 'lantern');
    };
    for (const [x, z] of [[44, 78], [44, 100], [21, 104], [54, 71], [76, 77], [94, 62], [100, 28], [36, 30], [91, 97], [14, 27]]) post(x, z);

    // ---------- Площадь у ворот ----------
    // Две торговые лавки: столбы, полосатый навес, прилавок с товаром, бочки сзади
    const stall = (x0, z0, colors, goods, back) => {
      for (const [x, z] of [[x0, z0], [x0 + 2, z0], [x0, z0 + 3], [x0 + 2, z0 + 3]]) { put(x, 0, z, 'spruce_fence'); put(x, 1, z, 'spruce_fence'); }
      for (let x = x0; x <= x0 + 2; x++) for (let z = z0; z <= z0 + 3; z++) put(x, 2, z, colors[(z - z0) % 2]);
      for (const z of [z0 + 1, z0 + 2]) put(x0 + 2, 0, z, 'spruce_slab', { h: 'top' });
      dish(x0 + 2, 1, z0 + 1, goods[0]); dish(x0 + 2, 1, z0 + 2, goods[1]);
      put(x0, 0, z0 + 1, 'barrel', { f: 'e' }); put(x0, 0, z0 + 2, back);
    };
    stall(52, 101, ['red_wool', 'white_wool'], ['apple', 'bread'], 'hay_block');
    stall(52, 113, ['yellow_wool', 'white_wool'], ['leather', 'rabbit_hide'], 'white_wool');
    for (const [x, y, z, id] of [[51, 0, 107, 'barrel'], [51, 1, 107, 'barrel'], [52, 0, 107, 'barrel'], [51, 0, 108, 'hay_block'], [52, 0, 109, 'composter']]) put(x, y, z, id);
    K.bench(69, 105, 73, 105, 0, 's'); K.bench(69, 113, 73, 113, 0, 'n'); // скамьи у колодца
    // Знамёна рода на древках у ворот
    for (const x of [58, 68]) { for (let y = 0; y <= 2; y++) put(x, y, 121, 'spruce_fence'); put(x, 3, 121, 'red_banner', { stand: 8, pat: [['bo', 11], ['flo', 11]] }); }
    // Клумбы у парадной лестницы донжона
    const FLOWERS = ['poppy', 'allium', 'cornflower', 'oxeye_daisy', 'azure_bluet', 'lily_of_the_valley'];
    for (const [x1, x2] of [[55, 57], [69, 71]]) for (let x = x1; x <= x2; x++) for (let z = 61; z <= 65; z++) {
      const g = b.get(x, -1, z);
      if (!g || !g.g || !isAir(x, 0, z)) continue;
      b.set(x, -1, z, 'podzol', { g: 1 });
      put(x, 0, z, (x + z) % 4 === 0 ? 'azalea_leaves_flowered' : FLOWERS[(x * 7 + z * 3) % FLOWERS.length]);
    }
    // Колода для дров и поленница у кухонного угла донжона
    for (let z = 58; z <= 60; z++) { put(44, 0, z, 'spruce_log', { a: 'x' }); put(45, 0, z, 'spruce_log', { a: 'x' }); put(44, 1, z, 'spruce_log', { a: 'x' }); }
    put(47, 0, 59, 'stripped_spruce_log'); dish(47, 1, 59, 'iron_axe');

    // ---------- Казарма (внутри x 11..33, z 71..79; второй этаж с y = 5) ----------
    // Очаг с дымоходом посередине, сундучки у коек, общий стол с едой, оружие на стене
    b.set(30, 0, 75, 'campfire'); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(30 + dx, 0, 75 + dz, 'stone_brick_slab');
    solid(b, 30, 2, 75, 30, 9, 75, 'stone_bricks');
    for (const x of [14, 20, 26]) {
      put(x, 0, 71, 'chest', { f: 's', ...(x === 20 ? { slot: 'barracks' } : { theme: 'soldier' }) });
      dish(x, 1, 77, 'bread'); K.candle(x + 1, 1, 77, 2); dish(x + 2, 1, 77, x === 20 ? 'cooked_mutton' : 'apple');
      K.chair(x + 1, 0, 76, 's'); K.hang(x, 3, 75);
    }
    for (const x of [15, 19, 23, 27]) { arms(x, 2, 79, 's', ['iron_sword', 'shield', 'bow', 'iron_spear'][(x - 15) / 4]); arms(x, 7, 79, 's', ['shield', 'iron_sword', 'crossbow', 'bow'][(x - 15) / 4]); }
    for (const x of [14, 26]) put(x, 5, 71, 'chest', { f: 's', theme: 'soldier' });
    K.table(17, 5, 76, 23, 76, 'spruce_slab'); K.bench(17, 75, 23, 75, 5, 's'); K.bench(17, 77, 23, 77, 5, 'n');
    for (const x of [18, 22]) K.candle(x, 6, 76, 3);
    for (const x of [16, 24]) chandL(b, x, 15, 75, 7);
    b.mark('room', 22, 5, 76, 'Казарма, спальня', 'Второй этаж казармы: два ряда коек, сундучки, стол со скамьями, оружие на стене, лампы под коньком крыши.');

    // ---------- Кузница (внутри x 11..19, z 87..95, открыта на юг и восток) ----------
    b.set(11, 0, 92, 'cauldron', { water: 1 }); // корыто для закалки
    ['iron_pickaxe', 'iron_shovel', 'iron_hoe', 'shears'].forEach((it, k) => arms(16 + k, 2, 87, 'n', it));
    arms(11, 2, 89, 'w', 'iron_helmet'); arms(11, 2, 90, 'w', 'chainmail_chestplate');
    put(13, 0, 89, 'coal_block'); put(13, 1, 89, 'coal_block'); put(13, 0, 90, 'coal_block');
    K.table(16, 0, 94, 17, 94, 'spruce_slab'); dish(16, 1, 94, 'iron_ingot'); dish(17, 1, 94, 'iron_nugget');
    put(19, 0, 87, 'barrel', { f: 'u' });
    { const v = b.get(14, 0, 95); if (v && v.id === 'chest') v.slot = 'smith'; }
    for (let z = 88; z <= 93; z++) { put(8, 0, z, 'spruce_log', { a: 'z' }); put(9, 0, z, 'spruce_log', { a: 'z' }); if (z % 2) put(8, 1, z, 'spruce_log', { a: 'z' }); }

    // ---------- Конюшня (внутри x 27..37, z 87..99, открыта на восток) ----------
    ['saddle', 'lead', 'leather_horse_armor', 'iron_horse_armor'].forEach((it, k) => arms(33 + k, 2, 87, 'n', it));
    ['bucket', 'shears', 'wheat'].forEach((it, k) => arms(33 + k, 2, 99, 's', it));
    put(31, 1, 89, 'lantern'); put(31, 1, 95, 'lantern');
    for (const z of [88, 94]) b.set(28, 0, z, 'cauldron', { water: 1 });
    put(37, 0, 98, 'chest', { f: 'w', theme: 'barn' });
    // Поилка и сено снаружи, у открытой стороны
    b.set(40, 0, 90, 'cauldron', { water: 1 }); b.set(40, 0, 91, 'cauldron', { water: 1 });
    put(40, 0, 93, 'hay_block'); put(39, 0, 93, 'hay_block'); put(40, 1, 93, 'hay_block');

    // ---------- Амбар (внутри x 9..21, z 13..23): сеновал над западной частью ----------
    for (let x = 9; x <= 13; x++) for (let z = 14; z <= 22; z++) b.set(x, 3, z, 'spruce_planks');
    for (let z = 14; z <= 22; z++) put(13, 4, z, 'spruce_fence');
    b.fill(9, 0, 18, 9, 3, 18, 'ladder', { f: 'w' });
    for (const [x, y, z] of [[10, 4, 14], [11, 4, 14], [10, 4, 15], [10, 5, 14], [11, 4, 15]]) put(x, y, z, 'hay_block');
    put(10, 4, 21, 'chest', { f: 'e', slot: 'barn_loft' }); put(9, 4, 22, 'barrel', { f: 'e', theme: 'pantry' });
    K.hang(11, 2, 18); K.hang(11, 2, 15); chandL(b, 17, 13, 18, 7);
    arms(21, 2, 21, 'e', 'iron_hoe'); arms(21, 2, 22, 'e', 'shears');
    put(14, 0, 19, 'white_wool'); put(14, 0, 20, 'white_wool'); put(14, 1, 19, 'white_wool');
    b.mark('room', 11, 4, 18, 'Сеновал', 'Дощатый настил под крышей амбара, лестница у стены. Сено, сундук и бочка.');

    // ---------- Огород: сарайчик с инструментом, скамья у цветника, компост ----------
    for (let x = 25; x <= 27; x++) { put(x, 0, 48, 'spruce_planks'); put(x, 1, 48, 'spruce_planks'); }
    for (const x of [25, 27]) { put(x, 0, 46, 'spruce_fence'); put(x, 1, 46, 'spruce_fence'); }
    for (let x = 24; x <= 28; x++) for (let z = 45; z <= 48; z++) put(x, 2, z, 'spruce_slab');
    put(26, 0, 47, 'composter'); put(25, 0, 47, 'barrel', { f: 'n', theme: 'pantry' }); arms(27, 1, 47, 's', 'iron_hoe');
    K.bench(21, 50, 23, 50, 0, 's'); put(10, 0, 50, 'composter'); put(11, 0, 50, 'composter');

    // ---------- Дом управителя (внутри x 97..107, z 7..17; второй этаж с y = 5) ----------
    put(104, 0, 8, 'lectern', { f: 's', slot: 'steward_book' });
    for (const z of [11, 12]) { K.chair(100, 0, z, 'e'); K.chair(105, 0, z, 'w'); }
    dish(101, 1, 11, 'paper'); dish(102, 1, 12, 'writable_book'); dish(104, 1, 11, 'gold_nugget'); K.candle(103, 1, 12, 3);
    arms(97, 2, 10, 'w', 'filled_map'); K.rug(99, 14, 105, 16, 0, 'red_carpet', 'brown_carpet'); put(97, 0, 17, 'barrel', { f: 'e', theme: 'pantry' });
    K.hang(102, 3, 9); K.hang(102, 3, 15);
    K.wardrobe(100, 5, 7, 's'); K.wardrobe(101, 5, 7, 's'); put(98, 5, 10, 'chest', { f: 's' });
    K.table(104, 5, 12, 105, 12); K.chair(104, 5, 13, 'n'); K.candle(105, 6, 12, 2); dish(104, 6, 12, 'writable_book');
    K.rug(99, 11, 103, 15, 5, 'blue_carpet', 'white_carpet'); chandL(b, 102, 16, 12, 7);
    b.mark('room', 102, 0, 12, 'Дом управителя', 'Внизу контора: стол со счетами, кафедра с книгой, полки, карта владений, сундук. Наверху спальня с балконом над входом.');

    // ---------- Ристалище: скамьи для зрителей, стойка с учебным оружием ----------
    K.bench(107, 27, 117, 27, 0, 's');
    for (let x = 106; x <= 108; x++) { put(x, 0, 51, 'spruce_planks'); put(x, 1, 51, 'spruce_planks'); }
    ['wooden_sword', 'shield', 'bow'].forEach((it, k) => arms(106 + k, 1, 50, 's', it));
    for (const [x, z] of [[104, 26], [120, 26], [104, 52], [120, 52]]) put(x, 1, z, 'lantern');

    // ---------- Угловые башни стены: караульня внизу, дозорная наверху ----------
    for (const [x1, z1] of [[0, 0], [119, 0], [0, 123], [119, 123]]) {
      K.stand(x1 + 4, 0, z1 + 4); K.chair(x1 + 3, 0, z1 + 4, 'e'); K.chair(x1 + 5, 0, z1 + 4, 'w');
      put(x1 + 4, 0, z1 + 7, 'chest', { f: 'n', theme: 'soldier' }); put(x1 + 4, 0, z1 + 1, 'barrel', { f: 's' });
      arms(x1 + 1, 2, z1 + 5, 'w', 'bow'); arms(x1 + 1, 2, z1 + 6, 'w', 'iron_sword');
      K.hang(x1 + 4, 7, z1 + 4); K.hang(x1 + 4, 14, z1 + 4);
      put(x1 + 7, 9, z1 + 1, 'barrel', { f: 'w' }); put(x1 + 7, 9, z1 + 7, 'barrel', { f: 'w' });
    }
    // ---------- Надвратные башни: караул, лебёдка решётки ----------
    for (const x1 of [CX - 9, CX + 3]) {
      const west = x1 < CX;
      K.stand(x1 + 3, 0, SZ); K.chair(x1 + 2, 0, SZ, 'e'); K.chair(x1 + 4, 0, SZ, 'w');
      const wx = west ? x1 + 5 : x1 + 1; // ближе к проезду
      put(wx, 0, SZ - 1, 'grindstone'); for (let y = 1; y <= 7; y++) put(wx, y, SZ - 1, 'iron_chain');
      put(wx, 0, SZ - 2, 'chest', { f: west ? 'w' : 'e', ...(west ? { slot: 'gatehouse' } : { theme: 'soldier' }) });
      put(west ? x1 + 5 : x1 + 1, 0, SZ + 2, 'barrel', { f: 'u' });
      arms(x1 + 2, 2, SZ + 2, 's', 'iron_spear'); arms(x1 + 4, 2, SZ + 2, 's', 'crossbow');
      K.hang(x1 + 3, 7, SZ); K.hang(x1 + 3, 14, SZ);
    }
  }

  // ======================= ЗАПУСТЕНИЕ И ВОССТАНОВЛЕНИЕ =======================
  // Замок находят в упадке. Описан он один раз — в восстановленном виде, а
  // запустение накладывается поверх по зонам. У каждой зоны свой этап сюжета:
  // когда этап пройден, зона возвращается к восстановленному виду. Сборщик пишет
  // для этапа «заплатку» (только клетки его зон) и функцию castle_stage_N.
  // Тайники (slot), сундуки, бочки, кафедры, двери, кровати и лестницы запустение
  // не трогает — их содержимое и проходы не зависят от этапа.
  const STAGES = [
    { n: 0, title: 'Упадок', npc: 'король Всеволод, повариха Агафья, конюх Фрол, стражники Остап и Митька', rooms: 'опочивальня короля и гардеробная, кухня, конюшня, ворота и надвратные башни, парадная лестница' },
    { n: 1, title: 'Стража', npc: 'капитан Демьян Беляк, три стражника, лучник', rooms: 'бреши в стенах, угловые башни, казарма во дворе, караульный этаж донжона, караул у входа, зубцы и верх башен донжона' },
    { n: 2, title: 'Кузня', npc: 'кузнец Гордей, подмастерье Васька', rooms: 'кузница, ристалище, парадная оружейная, арсенал, башенная оружейная' },
    { n: 3, title: 'Хозяйство', npc: 'кастелян Игнат, служанка Дуня', rooms: 'дом управителя, подклет (пекарня, кладовые, погреба, колодезная), служебная лестница, буфетная, хлебная, счётная палата, казна, сокровищница, комната служанок, бельевая, амбар, площадь с колодцем и лавками, двор и дорожки' },
    { n: 4, title: 'Вера', npc: 'отец Варлаам', rooms: 'часовня во дворе, склеп, кладбище, часовня донжона, ризница' },
    { n: 5, title: 'Знание', npc: 'переписчик Евсей, звездочёт Ленц, голубятник Сёмка', rooms: 'библиотека со скрипторием, сени библиотеки, архив грамот, кабинет хозяина, комната звездочёта, голубятня' },
    { n: 6, title: 'Исцеление', npc: 'травница Марфа', rooms: 'лекарская, лаборатория, огород' },
    { n: 7, title: 'Подземелье', npc: 'тюремщик Прохор', rooms: 'катакомбы (обвалы разобраны), темница, караульня подклета' },
    { n: 8, title: 'Пир', npc: 'менестрель Тимоша, служанки, гости', rooms: 'Большой зал, сени, зал совета, лестничный зал, галереи, музыкантская, солар, гостевые покои, горница, покои хозяйки, детская, покои гостя' },
    { n: 9, title: 'Наследие', npc: 'король умирает, замок переходит игроку', rooms: 'трон в нише средней башни, колокольня, знамёна на всех башнях' },
  ];
  // Помещения, до которых игрок должен дойти и в упадке (живут люди этапа 0)
  const START_ROOMS = ['Кухня', 'Опочивальня хозяина', 'Гардеробная', 'Конюшня', 'Ворота', 'Большой зал', 'Горница', 'Парадная лестница'];

  function ruinZones(KX, KZ, X2, Z2, CX) {
    const ST = [0, 6, 12, 18, 24, 30];
    const kb = (i1, y1, j1, i2, y2, j2) => [KX + i1, y1, KZ + j1, KX + i2, y2, KZ + j2];
    const kp = (i, y, j) => [KX + i, y, KZ + j];
    // Комната донжона по рамке стен; у наружных стен — вместе с толщей стены и окнами
    const room = (L, i1, j1, i2, j2) => kb(i1 === 2 ? 0 : i1 + 1, ST[L], j1 === 2 ? 0 : j1 + 1, i2 === 36 ? 38 : i2 - 1, ST[L] + 4, j2 === 36 ? 38 : j2 - 1);
    const tower = (k, y1, y2) => { const [a, c] = { nw: [-5, -5], ne: [33, -5] }[k]; return kb(a, y1, c, a + 10, y2, c + 10); };
    const mid = (y1, y2) => kb(14, y1, -6, 24, y2, -1);
    const Z = (stage, title, kind, boxes, o = {}) => ({ stage, title, kind, boxes, heavy: 1, ...o });
    const wallTop = (x1, z1, x2, z2) => [x1, -1, z1, x2, 11, z2];
    const ctower = (x1, z1) => [x1, -1, z1, x1 + 8, 28, z1 + 8];
    const banner = (x, y1, z, y2) => [x, y1, z, x, y2, z];
    return [
      // Этап 0 — здесь живут с самого начала, не разрушено
      Z(0, 'Кухня', 'lock', [room(0, 2, 19, 14, 36)]),
      Z(0, 'Опочивальня короля', 'lock', [room(3, 14, 2, 28, 14)]),
      Z(0, 'Гардеробная', 'lock', [mid(17, 23)]),
      Z(0, 'Парадная лестница', 'lock', [kb(33, -1, 33, 43, 42, 43)]),
      Z(0, 'Пристройка со входом', 'lock', [kb(15, -1, 39, 23, 14, 48)]),
      Z(0, 'Конюшня', 'lock', [[26, -1, 86, 38, 12, 100]]),
      Z(0, 'Ворота', 'lock', [[CX - 9, -1, 123, CX + 9, 16, 131]]),
      // Этап 9 — знамёна и трон (раньше прочих, чтобы их клетки достались этому этапу)
      Z(9, 'Знамёна на башнях', 'strip', [banner(KX, 38, KZ, 40), banner(KX + 38, 38, KZ, 40), banner(KX, 38, KZ + 38, 40), banner(KX + 38, 38, KZ + 38, 40),
        banner(KX + 19, 40, KZ - 3, 42), banner(4, 26, 4, 28), banner(X2 - 4, 26, 4, 28), banner(4, 26, Z2 - 4, 28), banner(X2 - 4, 26, Z2 - 4, 28)], { re: /banner|fence/ }),
      Z(9, 'Трон', 'room', [mid(5, 16)], { strips: [[kb(19, 8, -5, 19, 8, -5), /gold_block/]] }),
      Z(9, 'Колокольня', 'room', [mid(29, 42)]),
      // Этап 1 — стража: стены, башни, казармы
      Z(1, 'Крепостные стены', 'wall', [wallTop(9, 3, X2 - 9, 4), wallTop(3, 9, 4, Z2 - 9), wallTop(X2 - 4, 9, X2 - 3, Z2 - 9), wallTop(9, Z2 - 4, CX - 10, Z2 - 3), wallTop(CX + 10, Z2 - 4, X2 - 9, Z2 - 3)],
        { breaches: [[30, 3, 36, 4, 2], [3, 96, 4, 101, 2], [X2 - 4, 58, X2 - 3, 63, 3]] }),
      Z(1, 'Угловые башни стены', 'wall', [ctower(0, 0), ctower(X2 - 8, 0), ctower(0, Z2 - 8), ctower(X2 - 8, Z2 - 8)], { holes: [[X2 - 4, 15, 4, 2.5, 9]], erode: 16 }),
      Z(1, 'Казарма', 'room', [[10, -1, 70, 34, 17, 80]], { holes: [[18, 10, 77, 2, 6]] }),
      Z(1, 'Казарма донжона', 'room', [room(4, 2, 2, 36, 20)]),
      Z(1, 'Комната капитана', 'room', [room(4, 2, 20, 14, 36)]),
      Z(1, 'Осадный склад', 'room', [room(4, 24, 20, 36, 36)]),
      Z(1, 'Дозорная средней башни', 'room', [mid(24, 28)]),
      Z(1, 'Караул у входа', 'room', [room(1, 24, 31, 28, 36)]),
      Z(1, 'Верх донжона', 'wall', [kb(-6, 29, -7, 44, 41, 44)], { erode: 30, holes: [[...kp(40, 34, 3), 2, 6]] }),
      // Этап 2 — кузня
      Z(2, 'Кузница', 'room', [[9, -1, 85, 21, 14, 97]], { cuts: [[11, 9, 87, 13, 13, 88]] }),
      Z(2, 'Ристалище', 'room', [[104, -1, 26, 120, 3, 52]]),
      Z(2, 'Парадная оружейная', 'room', [room(1, 2, 13, 10, 23)]),
      Z(2, 'Арсенал', 'room', [room(4, 14, 20, 24, 36)]),
      Z(2, 'Башенная оружейная', 'room', [tower('ne', 24, 28)]),
      // Этап 3 — хозяйство
      Z(3, 'Пекарня', 'room', [room(0, 2, 2, 14, 19)]),
      Z(3, 'Кладовые', 'room', [room(0, 14, 2, 24, 36)]),
      Z(3, 'Винный погреб', 'room', [room(0, 24, 2, 36, 19)]),
      Z(3, 'Ледник', 'room', [mid(0, 4)]),
      Z(3, 'Колодезная', 'room', [tower('nw', 0, 4)]),
      Z(3, 'Погреб-холодильник', 'room', [tower('ne', 0, 4)]),
      Z(3, 'Служебная лестница', 'stair', [kb(-5, -1, 33, 5, 38, 43)]),
      Z(3, 'Буфетная', 'room', [room(1, 2, 23, 10, 36)]),
      Z(3, 'Хлебная', 'room', [room(1, 10, 31, 14, 36)]),
      Z(3, 'Счётная палата', 'room', [room(1, 28, 2, 36, 13)]),
      Z(3, 'Казна', 'room', [tower('ne', 6, 10)]),
      Z(3, 'Сокровищница', 'room', [tower('ne', 12, 16)]),
      Z(3, 'Комната служанок', 'room', [room(3, 2, 24, 14, 36)]),
      Z(3, 'Бельевая', 'room', [room(3, 24, 24, 36, 36)]),
      Z(3, 'Дом управителя', 'room', [[95, -1, 5, 109, 18, 21]], { cuts: [[99, 0, 19, 105, 5, 20]] }),
      Z(3, 'Амбар', 'room', [[7, -1, 11, 23, 15, 25]], { holes: [[12, 7, 16, 2.5, 7]] }),
      Z(3, 'Площадь у ворот', 'room', [[50, -1, 100, 76, 7, 118]], { cuts: [[69, 3, 107, 73, 7, 111], [72, 1, 109, 72, 2, 109], [52, 2, 101, 54, 2, 104, 0.6], [52, 2, 113, 54, 2, 116, 0.6], [54, 0, 104, 54, 1, 104], [52, 0, 116, 52, 1, 116]] }),
      // Этап 4 — вера
      Z(4, 'Часовня, склеп и кладбище', 'room', [[87, -12, 70, 118, 27, 107]], { holes: [[94, 8, 83, 2, 6]] }),
      Z(4, 'Часовня донжона', 'room', [room(2, 2, 2, 10, 15)]),
      Z(4, 'Ризница', 'room', [tower('nw', 12, 16)]),
      // Этап 5 — знание
      Z(5, 'Библиотека', 'room', [kb(39, -1, 8, 58, 30, 30)], { holes: [[...kp(51, 17, 23), 2, 9]] }),
      Z(5, 'Сени библиотеки', 'room', [room(1, 28, 13, 36, 24)]),
      Z(5, 'Архив грамот', 'room', [tower('nw', 6, 10)]),
      Z(5, 'Кабинет хозяина', 'room', [room(2, 28, 2, 36, 13)]),
      Z(5, 'Комната звездочёта', 'room', [tower('nw', 18, 22)]),
      Z(5, 'Голубятня', 'room', [tower('nw', 24, 28)]),
      // Этап 6 — исцеление
      Z(6, 'Лекарская', 'room', [room(2, 28, 24, 36, 31)]),
      Z(6, 'Лаборатория', 'room', [tower('ne', 18, 22)]),
      Z(6, 'Огород', 'yard', [[7, -1, 29, 31, 4, 59]], { heavy: 1.6, cuts: [[24, 2, 45, 28, 2, 48, 0.6]] }),
      // Этап 7 — подземелье: обвалы перекрывают ходы
      Z(7, 'Катакомбы', 'crypt', [kb(-11, -23, -21, 61, -2, 58)], { fills: [kb(44, -10, 31, 46, -7, 33), kb(12, -10, -1, 13, -7, -1), kb(18, -10, 1, 20, -7, 2)] }),
      Z(7, 'Караульня подклета', 'room', [room(0, 24, 19, 36, 36)]),
      // Этап 8 — пир: парадные и жилые покои
      Z(8, 'Большой зал', 'room', [kb(11, 5, 0, 27, 18, 26)], {
        holes: [[...kp(13, 17, 22), 1.6, 1]], cuts: [kb(17, 12, 13, 21, 16, 17)],
        place: [[...kp(19, 6, 16), 'dark_oak_fence'], [...kp(20, 6, 15), 'dark_oak_fence'], [...kp(18, 6, 14), 'lantern'], [...kp(19, 6, 15), 'cobblestone_slab']],
      }),
      Z(8, 'Сени за перегородкой', 'room', [room(1, 10, 27, 28, 31)], { heavy: 0.6 }),
      Z(8, 'Входные сени', 'room', [room(1, 14, 31, 24, 36)], { heavy: 0.6 }),
      Z(8, 'Зал совета', 'room', [room(1, 2, 2, 10, 13)]),
      Z(8, 'Лестничный зал', 'room', [room(1, 28, 24, 36, 36)], { heavy: 0.6 }),
      Z(8, 'Галерея менестрелей', 'room', [room(2, 10, 27, 28, 31)]),
      Z(8, 'Музыкантская', 'room', [room(2, 14, 31, 24, 36)]),
      Z(8, 'Галерея над залом', 'room', [room(2, 28, 13, 36, 24)]),
      Z(8, 'Площадка второго этажа', 'room', [room(2, 24, 31, 36, 36)]),
      Z(8, 'Солар', 'room', [room(2, 2, 15, 10, 31)]),
      Z(8, 'Гостевые покои', 'room', [room(2, 2, 31, 14, 36)]),
      Z(8, 'Горница', 'room', [room(3, 2, 14, 36, 24)], { heavy: 0.7 }),
      Z(8, 'Покои хозяйки', 'room', [room(3, 2, 2, 14, 14)], { // пролом в наружной стене, обломки внизу
        cuts: [kb(0, 19, 9, 2, 20, 11, 0.85), kb(0, 21, 10, 1, 21, 10)],
        place: [[...kp(-1, 0, 9), 'cobblestone'], [...kp(-1, 0, 10), 'mossy_cobblestone'], [...kp(-1, 1, 10), 'cobblestone_slab'], [...kp(-2, 0, 10), 'mossy_cobblestone_slab'], [...kp(-1, 0, 11), 'gravel'], [...kp(-2, 0, 11), 'cobblestone_slab']],
      }),
      Z(8, 'Детская', 'room', [room(3, 28, 2, 36, 14)]),
      Z(8, 'Покои гостя', 'room', [room(3, 14, 24, 24, 36)]),
      // Двор целиком — последним: трава, кусты, заросшие дорожки, погасшие фонари
      Z(3, 'Двор', 'yard', [[-6, -1, -6, X2 + 6, 3, Z2 + 6]]),
    ];
  }

  // Накладывает запустение на восстановленный замок. Возвращает карту блоков в
  // упадке и для каждой изменённой клетки — номер зоны, которая её изменила.
  function ruins(full, zones) {
    const blocks = new Map(full.blocks);
    const owner = new Map(), locked = new Set();
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const get = (x, y, z) => blocks.get(key(x, y, z));
    let zi = -1;
    const set = (x, y, z, id, p) => {
      const k = key(x, y, z);
      if (locked.has(k)) return false;
      const o = owner.get(k);
      if (o !== undefined && o !== zi) return false;
      owner.set(k, zi);
      blocks.set(k, { ...(p || {}), x, y, z, id });
      return true;
    };
    const opaque = (v) => window.CastlePhysics ? CastlePhysics.isOpaque(v) : !!v && v.id !== 'air';
    const has = (v) => !!v && v.id !== 'air' && v.id !== 'cobweb';
    const isAir = (x, y, z) => !has(get(x, y, z)) && !(get(x, y, z) && get(x, y, z).id === 'cobweb');
    const PROTECT = /chest|barrel|decorated_pot|lectern|suspicious_gravel|_sign$|_door$|ladder|_bed$|bell|anvil|grindstone|furnace|smoker|brewing|enchanting|jukebox|noteblock|loom|cartography|fletching|smithing|composter|cauldron|water/;
    const removable = (v) => has(v) && !v.slot && !v.theme && !PROTECT.test(v.id);
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const nearDoor = (x, y, z) => N4.some(([dx, dz]) => { const n = get(x + dx, y, z + dz), m = get(x + dx, y - 1, z + dz); return (n && /_door$|ladder|fence_gate/.test(n.id)) || (m && /_door$/.test(m.id)); });
    const RUBBLE = ['cobblestone', 'mossy_cobblestone', 'cobblestone_slab', 'mossy_cobblestone_slab', 'gravel', 'mossy_cobblestone_slab'];
    const CAVE = [['gravel', 3], ['cobblestone', 3], ['mossy_cobblestone', 2], ['andesite', 1], ['stone', 1]];
    const STONE = /^(stone_bricks|mossy_stone_bricks|cracked_stone_bricks|cobblestone|mossy_cobblestone|stone)$/;
    const rngOf = (s) => {
      let a = 7; for (const ch of s) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
      return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    };
    const eachBox = ([x1, y1, z1, x2, y2, z2], fn) => { for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) fn(x, y, z); };
    // Мусор на пол у стены: не в узком ходу, не у двери и не у лестницы
    const rubbleOk = (x, y, z) => {
      if (!opaque(get(x, y - 1, z)) || !isAir(x, y + 1, z) || nearDoor(x, y, z)) return false;
      const w = N4.map(([dx, dz]) => opaque(get(x + dx, y, z + dz)));
      const n = w.filter(Boolean).length;
      return n >= 1 && n <= 2 && !(w[0] && w[1]) && !(w[2] && w[3]);
    };
    const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
    const rubble = (r, x, y, z) => { const id = pick(r, RUBBLE); set(x, y, z, id, /slab/.test(id) ? {} : undefined); };

    function roomOps(z, r) {
      const h = z.heavy, stair = z.kind === 'stair', crypt = z.kind === 'crypt';
      for (const bx of z.boxes) eachBox(bx, (x, y, zz) => {
        const v = get(x, y, zz);
        if (has(v)) {
          const id = v.id;
          if (v.slot || v.theme) return;
          if (id === 'lantern' && v.hang) { if (r() < 0.75 * Math.min(h, 1)) set(x, y, zz, 'air'); }
          else if (id === 'lantern') { if (r() < 0.6) set(x, y, zz, 'air'); }
          else if (id === 'torch') { if (r() < 0.7) set(x, y, zz, 'air'); }
          else if (/candle$/.test(id)) { if (v.lit) set(x, y, zz, id, { ...v, lit: 0 }); }
          else if (id === 'campfire') set(x, y, zz, 'campfire_out');
          else if (stair) { if (id === 'stone_bricks' && r() < 0.15) set(x, y, zz, 'cracked_stone_bricks'); }
          else if (/carpet$/.test(id) && id !== 'moss_carpet') { if (r() < 0.5 * h) set(x, y, zz, 'air'); }
          else if (/glass_pane$/.test(id)) { if (r() < 0.65) set(x, y, zz, 'air'); }
          else if (removable(v) && (v.fur || /^(flower_pot|cake|item_frame)$|_banner$/.test(id))) { if (r() < 0.45 * h) set(x, y, zz, 'air'); }
          else if (id === 'stone_bricks') { const q = r(); if (q < 0.16) set(x, y, zz, 'cracked_stone_bricks'); else if (q < 0.24) set(x, y, zz, 'mossy_stone_bricks'); }
          return;
        }
        if (stair || (v && v.id === 'cobweb')) return;
        // Пустая клетка: паутина под потолком, мусор и мох на полу
        const walls = N4.filter(([dx, dz]) => opaque(get(x + dx, y, zz + dz))).length;
        if (opaque(get(x, y + 1, zz)) && walls >= 2 && isAir(x, y - 1, zz) && isAir(x, y - 2, zz)) { if (r() < (crypt ? 0.6 : 0.45) * Math.min(h, 1)) set(x, y, zz, 'cobweb'); return; }
        if (rubbleOk(x, y, zz)) { const q = r(); if (q < 0.07 * h) rubble(r, x, y, zz); else if (q < 0.1 * h) set(x, y, zz, 'moss_carpet'); }
      });
    }
    function yardOps(z, r) {
      const h = z.heavy;
      for (const bx of z.boxes) for (let x = bx[0]; x <= bx[3]; x++) for (let zz = bx[2]; zz <= bx[5]; zz++) {
        const g = get(x, -1, zz);
        if (!g || !g.g || /farmland|water/.test(g.id)) continue;
        if (/gravel|grass_path|coarse_dirt|cobblestone/.test(g.id) && r() < 0.45 * Math.min(h, 1.2)) set(x, -1, zz, 'grass_block', { g: 1 });
        if (!isAir(x, 0, zz) || nearDoor(x, 0, zz) || get(x, 0, zz)) continue;
        const q = r();
        if (q < 0.15 * h) set(x, 0, zz, 'short_grass');
        else if (q < 0.21 * h) set(x, 0, zz, 'fern');
        else if (q < 0.225 * h && !N4.some(([dx, dz]) => has(get(x + dx, 0, zz + dz)))) set(x, 0, zz, 'azalea_leaves');
      }
      for (const bx of z.boxes) eachBox(bx, (x, y, zz) => { const v = get(x, y, zz); if (v && v.id === 'lantern' && !v.hang && r() < 0.6) set(x, y, zz, 'air'); });
    }
    // Осыпаются только тонкие выступы наверху: зубцы и парапеты
    function erode(z, r, y0) {
      for (const bx of z.boxes) eachBox(bx, (x, y, zz) => {
        const v = get(x, y, zz);
        if (y < y0 || !v || !STONE.test(v.id) || has(get(x, y + 1, zz)) || !has(get(x, y - 1, zz))) return;
        if (N4.filter(([dx, dz]) => !has(get(x + dx, y, zz + dz))).length >= 2 && r() < 0.25) set(x, y, zz, 'air');
      });
    }
    // Обломки там, где упал потолок: на первый сплошной пол ниже
    const debrisBelow = (r, x, y, zz) => {
      for (let yy = y - 1; yy >= y - 16; yy--) {
        const v = get(x, yy, zz);
        if (!has(v)) continue;
        if (opaque(v) && isAir(x, yy + 1, zz) && r() < 0.7) rubble(r, x, yy + 1, zz);
        return;
      }
    };
    function hole(r, [cx, cy, cz, rad, hh]) {
      const R2 = Math.ceil(rad);
      for (let dx = -R2; dx <= R2; dx++) for (let dz = -R2; dz <= R2; dz++) {
        if (dx * dx + dz * dz > rad * rad + r() * 1.5) continue;
        for (let y = cy; y <= cy + hh; y++) { const v = get(cx + dx, y, cz + dz); if (has(v) && !v.slot && !v.theme) set(cx + dx, y, cz + dz, 'air'); }
        debrisBelow(r, cx + dx, cy, cz + dz);
      }
    }
    // Брешь в стене: провал клином, у подножия с обеих сторон завалы
    function breach(r, [x1, z1, x2, z2, yb]) {
      const alongX = x2 - x1 >= z2 - z1, a1 = alongX ? x1 : z1, a2 = alongX ? x2 : z2, c = (a1 + a2) / 2;
      for (let x = x1; x <= x2; x++) for (let zz = z1; zz <= z2; zz++) {
        const t = Math.abs((alongX ? x : zz) - c);
        for (let y = Math.round(yb + t * 1.6 + r()); y <= 12; y++) { const v = get(x, y, zz); if (has(v)) set(x, y, zz, 'air'); }
      }
      for (let a = a1 - 2; a <= a2 + 2; a++) for (const side of [-1, 1]) for (let d = 1; d <= 3; d++) {
        const x = alongX ? a : (side < 0 ? x1 - d : x2 + d), zz = alongX ? (side < 0 ? z1 - d : z2 + d) : a;
        const hgt = Math.max(0, 2 - Math.abs(a - c) / 2.5 - d * 0.6 + r());
        for (let y = 0; y < hgt && y < 3; y++) if (isAir(x, y, zz) && opaque(get(x, y - 1, zz))) rubble(r, x, y, zz);
      }
    }
    // Висит ли блок, лишившись опоры
    const STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
    const OPPF = { n: 's', s: 'n', e: 'w', w: 'e' };
    function loose(v, x, y, zz) {
      const id = v.id, below = get(x, y - 1, zz), above = get(x, y + 1, zz);
      if (/_door$|ladder|_bed$/.test(id) || v.slot) return false;
      if (id === 'lantern' || id === 'soul_lantern') return v.hang ? !has(above) : !has(below);
      if (id === 'iron_chain') return (!v.a || v.a === 'y') && !has(above);
      const wallDir = (id === 'torch' && v.f) || (id === 'item_frame' && v.f && v.f !== 'u') || (/_banner$/.test(id) && v.stand === undefined) || id === 'vine' ? v.f || 'n' : /_shelf$/.test(id) ? OPPF[v.f || 's'] : null;
      if (wallDir) { const [dx, dz] = STEP[wallDir]; return !has(get(x + dx, y, zz + dz)); }
      if (/candle|carpet|flower_pot|cake|pressure_plate|campfire|skull|lever|brewing_stand|short_grass|fern|poppy|allium|cornflower|dandelion|lily|daisy|bluet|_banner|torch/.test(id) || (id === 'item_frame' && v.f === 'u')) return !has(below);
      return false;
    }
    function settle(z) {
      for (let pass = 0; pass < 6; pass++) {
        let n = 0;
        for (const [x1, y1, z1, x2, y2, z2] of z.boxes) eachBox([x1 - 1, y1 - 1, z1 - 1, x2 + 1, y2 + 1, z2 + 1], (x, y, zz) => {
          const v = get(x, y, zz);
          if (has(v) && loose(v, x, y, zz) && set(x, y, zz, 'air')) n++;
        });
        if (!n) break;
      }
    }

    zones.forEach((z, i) => {
      zi = i;
      if (z.kind === 'lock') { for (const bx of z.boxes) eachBox(bx, (x, y, zz) => locked.add(key(x, y, zz))); return; }
      const r = rngOf(z.title);
      for (const [bx, re] of z.strips || []) eachBox(bx, (x, y, zz) => { const v = get(x, y, zz); if (v && re.test(v.id)) set(x, y, zz, 'air'); });
      if (z.kind === 'strip') { for (const bx of z.boxes) eachBox(bx, (x, y, zz) => { const v = get(x, y, zz); if (v && z.re.test(v.id)) set(x, y, zz, 'air'); }); return; }
      for (const f of z.fills || []) eachBox(f, (x, y, zz) => { const v = get(x, y, zz); if (!v || !PROTECT.test(v.id)) set(x, y, zz, CATA_PICK(r, CAVE)); });
      for (const c of z.cuts || []) eachBox(c, (x, y, zz) => { const v = get(x, y, zz); if (has(v) && !v.slot && !v.theme && !PROTECT.test(v.id) && (c[6] === undefined || r() < c[6])) set(x, y, zz, 'air'); });
      for (const b of z.breaches || []) breach(r, b);
      for (const hl of z.holes || []) hole(r, hl);
      for (const [x, y, zz, id, p] of z.place || []) set(x, y, zz, id, p);
      if (z.kind === 'yard') yardOps(z, r);
      else roomOps(z, r);
      if (z.kind === 'wall') erode(z, r, z.erode || 9);
      settle(z);
    });
    return { blocks, owner, zones };
  }
  // Выбор из палитры [id, вес] собственным генератором зоны
  const CATA_PICK = (r, pal) => { let t = r() * pal.reduce((a, [, w]) => a + w, 0); for (const [id, w] of pal) if ((t -= w) < 0) return id; return pal[0][0]; };

  // ---------- Единицы ремонта ----------
  // Как чинится замок по сюжету (docs/castle-story.md):
  //  shell    — корпус донжона: окна, стены, крыши, зубцы. Одно задание в начале.
  //  rooms_N  — комнаты донжона этапа N: прибираются наутро после прихода жителя.
  //  подряды  — стены и здания двора: сундук-подряд после задания, наутро готово.
  // Каждая изменённая упадком клетка достаётся ровно одной единице.
  const CONTRACTS = {
    'Казарма': 'barracks', 'Кузница': 'forge', 'Ристалище': 'tiltyard', 'Дом управителя': 'steward', 'Амбар': 'barn',
    'Площадь у ворот': 'square', 'Двор': 'yard', 'Часовня, склеп и кладбище': 'chapel', 'Огород': 'garden', 'Катакомбы': 'catacombs',
    'Угловые башни стены': 'walls',
  };
  const STRUCTURAL = /glass|pane|bars|stone|brick|planks|slab|stairs|_wall$|log$|wood$|tuff|cobble|andesite|deepslate|tiles|polished|calcite/;
  function repairUnits(full, R, KX, KZ) {
    const units = new Map();
    const unit = (id, title, kind, stage) => { if (!units.has(id)) units.set(id, { id, title, kind, stage, zones: new Set(), cells: 0, sum: [0, 0, 0] }); return units.get(id); };
    const inKeep = (x, z) => { const i = x - KX, j = z - KZ; return i >= -6 && i <= 58 && j >= -7 && j <= 48; };
    const breaches = (R.zones.find((z) => z.title === 'Крепостные стены') || {}).breaches || [];
    const owner = new Map();
    for (const [k, zi] of R.owner) {
      const z = R.zones[zi];
      const [x, y, zz] = k.split(',').map(Number);
      let u;
      if (z.stage === 9) u = unit('heritage', 'Наследие: трон, колокольня, знамёна', 'contract', 9);
      else if (z.title === 'Крепостные стены') {
        const bi = breaches.findIndex(([x1, z1, x2, z2]) => x >= x1 - 5 && x <= x2 + 5 && zz >= z1 - 5 && zz <= z2 + 5);
        u = bi >= 0 ? unit('breach_' + (bi + 1), 'Брешь в стене ' + (bi + 1), 'contract', z.stage) : unit('walls', 'Зубцы стен и угловые башни', 'contract', z.stage);
      } else if (CONTRACTS[z.title]) u = unit(CONTRACTS[z.title], z.title === 'Угловые башни стены' ? 'Зубцы стен и угловые башни' : z.title, 'contract', z.stage);
      else if (inKeep(x, zz) && z.kind !== 'yard' && z.kind !== 'crypt') {
        const f = full.blocks.get(k);
        const structural = f && STRUCTURAL.test(f.id) && !f.fur && !f.slot && !f.theme;
        u = structural ? unit('shell', 'Корпус донжона: окна, крыши, стены', 'shell', 0) : unit('rooms_' + z.stage, 'Комнаты этапа ' + z.stage, 'rooms', z.stage);
      } else u = unit('zone_' + zi, z.title, 'contract', z.stage);
      u.zones.add(z.title); u.cells++; u.sum[0] += x; u.sum[1] += y; u.sum[2] += zz;
      owner.set(k, u.id);
    }
    const list = [...units.values()].map((u) => ({ ...u, zones: [...u.zones], center: u.sum.map((s) => Math.round(s / u.cells)) }));
    return { units: list, owner };
  }

  // Вид замка после этапа s: клетки зон с этапом больше s — в упадке
  function stageView(full, R, s) {
    const out = new Builder(1);
    out.marks = full.marks;
    out.blocks = new Map(full.blocks);
    for (const [k, i] of R.owner) if (R.zones[i].stage > s) out.blocks.set(k, R.blocks.get(k));
    return out;
  }

  // ======================= ОСНОВАНИЕ =======================
  // Замок не подгоняется к рельефу, поэтому под ним — своя толща грунта, как в
  // обычном мире: сверху земля, ниже камень с прожилками руды, гнёздами гравия,
  // андезита, диорита и гранита. За краем территории грунт уходит вниз пологим
  // неровным склоном (на блок вниз с каждым блоком наружу), поросшим травой,
  // с каменными выходами. Где рельеф выше склона, склон просто скрыт в земле.
  // Сборщик спрашивает блок у at(x, y, z) только там, где шаблон пуст.
  function foundation(rect, depth) {
    const [rx1, rz1, rx2, rz2] = rect;
    const skirt = -1 - depth;
    const hash = (a, b, c, s) => {
      let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177) + Math.imul(s, 2654435761)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1103515245);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    // Плавный шум на плоскости: для неровного края склона и пятен травы
    const smooth = (x, z, size, s) => {
      const gx = Math.floor(x / size), gz = Math.floor(z / size), fx = x / size - gx, fz = z / size - gz;
      const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
      const a = hash(gx, gz, 0, s), b2 = hash(gx + 1, gz, 0, s), c = hash(gx, gz + 1, 0, s), d = hash(gx + 1, gz + 1, 0, s);
      return a + (b2 - a) * u + (c - a) * v + (a - b2 - c + d) * u * v;
    };
    // Гнездо: в каждой ячейке size³ с вероятностью p есть шарик радиуса r
    const blob = (x, y, z, size, p, r, s) => {
      const cx = Math.floor(x / size), cy = Math.floor(y / size), cz = Math.floor(z / size);
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) for (let k = cz - 1; k <= cz + 1; k++) {
        if (hash(i, j, k, s) >= p) continue;
        const ox = (i + hash(i, j, k, s + 1)) * size, oy = (j + hash(i, j, k, s + 2)) * size, oz = (k + hash(i, j, k, s + 3)) * size;
        const rr = r * (0.7 + 0.6 * hash(i, j, k, s + 4));
        const dd = (x - ox) ** 2 + (y - oy) ** 2 + (z - oz) ** 2;
        if (dd <= rr * rr && hash(x, y, z, s + 5) < 0.85) return true;
      }
      return false;
    };
    // Верх колонны: внутри территории — под слоем земли двора, снаружи — склон
    const top = (x, z) => {
      const dx = Math.max(rx1 - x, 0, x - rx2), dz = Math.max(rz1 - z, 0, z - rz2);
      if (!dx && !dz) return [-2, false];
      const r = Math.sqrt(dx * dx + dz * dz);
      const d = r * (0.75 + 0.5 * smooth(x, z, 9, 11)) + Math.min(1, r / 4) * 2 * smooth(x, z, 4, 12);
      return [-1 - Math.max(1, Math.round(d)), true];
    };
    const ORES = [
      ['coal_ore', 7, 0.45, 1.6, 0], ['iron_ore', 8, 0.35, 1.4, -5], ['copper_ore', 9, 0.3, 1.6, -8],
      ['gold_ore', 10, 0.18, 1.1, -14], ['redstone_ore', 10, 0.16, 1.2, -16], ['lapis_ore', 12, 0.12, 1.1, -17],
    ];
    const ROCK = [['andesite', 14, 0.3, 4], ['diorite', 14, 0.25, 3.5], ['granite', 14, 0.25, 3.5], ['gravel', 11, 0.18, 2.5], ['dirt', 11, 0.14, 2.5]];
    function at(x, y, z) {
      if (y < depth || y > -2) return null;
      const [t, outside] = top(x, z);
      if (y > t) return null;
      const s = t - y;
      if (outside && s === 0) {
        const rock = smooth(x, z, 5, 21);
        if (rock > 0.78) return hash(x, y, z, 22) < 0.5 ? 'stone' : hash(x, y, z, 23) < 0.5 ? 'andesite' : 'mossy_cobblestone';
        const g = smooth(x, z, 6, 24);
        return g > 0.72 ? 'podzol' : g < 0.18 ? 'coarse_dirt' : hash(x, y, z, 25) < 0.06 ? 'moss_block' : 'grass_block';
      }
      if (s <= 2 + Math.floor(hash(x, 0, z, 26) * 2)) return hash(x, y, z, 27) < 0.12 ? 'coarse_dirt' : 'dirt';
      for (const [id, size, p, r, below] of ORES) if (y <= below && blob(x, y, z, size, p, r, id.length * 101)) return id;
      for (const [id, size, p, r] of ROCK) if (blob(x, y, z, size, p, r, id.length * 37 + 5)) return id;
      if (y < -16 && blob(x, y, z, 13, 0.3, 4, 77)) return 'tuff';
      return 'stone';
    }
    return { rect, depth, skirt, at };
  }

  defineStructure({
    id: 'castle',
    group: 'Замок',
    name: 'Замок из замшелого камня',
    rarity: 'редкая',
    set: 'castle',
    weight: 1,
    biomes: 'пока эскиз',
    desc: 'Большой квадратный донжон 39×39 с четырьмя угловыми башнями и средней башней. Пять этажей: подклет, парадный этаж с Большим залом, галерейный, жилой и караульный. Вход по лестнице в пристройке сразу на второй этаж. К восточной стене пристроена библиотека в три яруса. Под замком катакомбы с темницей, усыпальницей и древним святилищем. В толще стен и в подземелье спрятаны тайные комнаты и ходы. Кнопки внизу показывают этажи по отдельности.',
    territory: [
      'Стена 128×132 блока высотой 10, четыре угловые башни с шатровыми крышами',
      'Ворота на юге между двух надвратных башен',
      'Донжон 49×49 вместе с башнями, высота корпуса 30, башен — 40',
      'Библиотека-пристройка 19×23 и лестничная пристройка ко входу',
      'Во дворе часовня с кладбищем, казарма, кузница, конюшня, амбар, огород, дом управителя, ристалище',
      'Катакомбы на 10–20 блоков под землёй, ход к склепу часовни и лаз за стену',
      'Под замком своя толща грунта с рудой, по краям — травяной склон до 24 блоков вниз',
    ],
    foundation: foundation([-6, -6, 133, 137], -25),
    stagesInfo: STAGES,
    startRooms: START_ROOMS,
    // Кнопки в просмотрщике: замок в упадке, после каждого этапа и восстановленный
    states: STAGES.map((st) => ({ id: String(st.n), label: st.n === 0 ? 'Упадок' : st.n === 9 ? 'Всё' : String(st.n) })),
    // Без state — восстановленный замок с подсветкой и картой запустения (b.ruin) для сборщика
    build(state) {
      if (!this.cache) this.cache = fullCastle();
      if (state === undefined) return this.cache;
      return stageView(this.cache, this.cache.ruin, +state);
    },
  });

  function fullCastle() {
    {
      const b = new Builder(2025);
      b.carve = true;
      const X2 = 127, Z2 = 131, CX = 63;
      b.ground(-6, -6, X2 + 6, Z2 + 6);
      b.surface(-6, -6, X2 + 6, Z2 + 6, [['grass_block', 6], ['podzol', 2], ['coarse_dirt', 1], ['moss_block', 2]]);
      const KX = 44, KZ = 17;
      keep(b, KX, KZ);
      library(b, KX, KZ);
      forebuilding(b, KX, KZ);
      catacombs(b, KX, KZ);
      stamp(b, 33, 22, chapel);
      curtain(b, X2, Z2, CX);
      yard(b, CX, Z2 - 4);
      yardLife(b, CX, Z2 - 4);
      overgrow(b, KX, KZ, KX + 38, KZ + 38, 28, 70);
      overgrow(b, KX - 5, KZ - 5, KX + 43, KZ + 43, 34, 50);
      for (let k = 0; k < 56; k++) {
        const side = k % 4, t = b.r();
        const x = side < 2 ? Math.round(-4 + t * (X2 + 8)) : side === 2 ? -4 - Math.round(b.r()) : X2 + 4 + Math.round(b.r());
        const z = side >= 2 ? Math.round(-4 + t * (Z2 + 8)) : side === 0 ? -4 - Math.round(b.r()) : Z2 + 4 + Math.round(b.r());
        if (x > CX - 6 && x < CX + 6 && z > Z2) continue;
        b.spruce(x, z, 8 + Math.floor(b.r() * 5));
      }
      // Автоподсветка: где после расстановки темно, вешаем настенные факелы.
      if (window.CastlePhysics) {
        // Внутри донжона: корпус, четыре угловые башни, средняя башня, библиотека, пристройка
        const RECTS = [[0, 0, 38, 38], [-5, -5, 5, 5], [33, -5, 43, 5], [-5, 33, 5, 43], [33, 33, 43, 43], [14, -6, 24, 0], [39, 8, 58, 30], [15, 39, 23, 48]];
        // Дворовые здания и башни стены (мировые координаты): казарма, кузница, конюшня, амбар,
        // дом управителя, часовня (неф, трансепт, апсида), угловые и надвратные башни
        const YARD_RECTS = [[10, 70, 34, 80], [10, 86, 20, 96], [26, 86, 38, 100], [8, 12, 22, 24], [96, 6, 108, 18],
          [91, 76, 111, 86], [99, 72, 103, 90], [112, 79, 114, 83],
          [0, 0, 8, 8], [119, 0, 127, 8], [0, 123, 8, 131], [119, 123, 127, 131], [CX - 9, 124, CX - 3, 130], [CX + 3, 124, CX + 9, 130]];
        const inKeep = (x, z) => { const i = x - KX, j = z - KZ; return RECTS.some(([a, c, d, e]) => i >= a && i <= d && j >= c && j <= e) || YARD_RECTS.some(([a, c, d, e]) => x >= a && x <= d && z >= c && z <= e); };
        // Толща наружных стен корпуса: ниши окон и проходы, свет там не нужен
        const inWall = (x, z) => { const i = x - KX, j = z - KZ; return i >= 0 && i <= 38 && j >= 0 && j <= 38 && (i <= 2 || i >= 36 || j <= 2 || j >= 36); };
        b.lighting = CastlePhysics.autoLight(b, {
          box: [-8, -24, -8, X2 + 8, 44, Z2 + 8],
          starts: [[KX + 19, 0, KZ + 50], [KX + 8, 0, KZ + 40], [KX + 30, 0, KZ + 40], [KX + 48, 0, KZ + 32], [CX, 0, Z2 - 12]],
          need: (x, y) => (y <= -2 ? 6 : 8),
          // Свет нужен на полу, а не на крышках шкафов, столах и кроватях
          skip: (x, y, z) => (y > -2 && (!inKeep(x, z) || inWall(x, z))) || !CastlePhysics.isFloor(b.get(x, y - 1, z)),
          placeOk: (x, y, z) => y <= -2 || (inKeep(x, z) && !inWall(x, z)),
        });
        b.keepArea = inKeep;
        b.walkOpts = { box: [-8, -24, -8, X2 + 8, 44, Z2 + 8], starts: [[KX + 19, 0, KZ + 50], [KX + 8, 0, KZ + 40], [KX + 30, 0, KZ + 40], [KX + 48, 0, KZ + 32], [CX, 0, Z2 - 12]] };
      }
      // Камера для «сердца замка» — метки под площадью у ворот, от которой
      // функции этапов накладывают заплатки
      b.set(CX, -20, Z2 - 33, 'air'); b.set(CX, -19, Z2 - 33, 'air');
      b.ruin = ruins(b, ruinZones(KX, KZ, X2, Z2, CX));
      b.repair = repairUnits(b, b.ruin, KX, KZ);
      b.castleInfo = { KX, KZ, X2, Z2, CX, gate: [CX, 0, Z2 - 4], square: [CX, 0, Z2 - 33] };
      return b;
    }
  }
})();
