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
  const CRYPT = [['deepslate_bricks', 4], ['cracked_deepslate_bricks', 2], ['stone_bricks', 2], ['mossy_stone_bricks', 2], ['tuff', 1]];
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
      if (b.chance(0.5) && !b.get(x, 0, z)) b.set(x, 0, z, ['oak_leaves', 'azalea_leaves', 'azalea_leaves_flowered']);
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
    fn(t);
    for (const v of t.blocks.values()) { const { x, y, z, id, ...p } = v; b.set(x + dx, y, z + dz, id, p); }
    for (const m of t.marks) b.mark(m.type, m.x + dx, m.y, m.z + dz, m.title, m.desc);
  }

  const hangL = (w, x, y, z) => w.set(x, y, z, 'lantern', { hang: 1 });
  const chandL = (w, x, top, z, len = 3) => { w.fill(x, top - len + 1, z, x, top, z, 'iron_chain'); hangL(w, x, top - len, z); };
  const tableL = (w, x1, y, z1, x2, z2, id = 'dark_oak_slab') => w.fill(x1, y, z1, x2, y, z2, id, { h: 'top' });
  const INNER = [['stone_bricks', 6], ['cracked_stone_bricks', 1], ['mossy_stone_bricks', 1]];
  const BEAMS = (x) => (x % 4 === 1 ? ['dark_oak_log', { a: 'z' }] : [PLANKS]);

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
    dr(0, 14, 10, 'e'); dr(0, 14, 28, 'e'); dr(0, 24, 10, 'w'); dr(0, 24, 28, 'w'); dr(0, 8, 19, 's'); dr(0, 30, 19, 's');
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
    air(w, 16, 6, 0, 22, 14, 2); for (let j = 0; j <= 2; j++) { w.set(16, 14, j, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(22, 14, j, 'stone_brick_stairs', { h: 'top', f: 'e' }); }

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
    for (const [x, z, f] of [[-4, 0, 'w'], [42, 0, 'e']]) w.fill(x, 30, z, x, 37, z, 'ladder', { f });

    // Средняя башня: ниша трона, гардеробная хозяина, дозорные
    ring(w, 14, -1, -6, 24, 38, 0); air(w, 15, 0, -5, 23, 38, -1);
    solid(w, 15, -1, -5, 23, -1, -1, PAVE); solid(w, 15, 5, -5, 23, 5, -1, PAVE);
    for (const y of [17, 23, 29]) solid(w, 15, y, -5, 23, y, -1, PLANKS);
    battlements(w, 14, -6, 24, 0, 39);
    air(w, 19, 0, 0, 19, 1, 2); air(w, 19, 30, 0, 19, 31, 2);
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
      w.set(38, 13, 38, 'chest', { f: 's' }); w.set(37, 13, 37, 'candle'); w.set(39, 13, 39, 'skeleton_skull');
      w.mark('secret', inX, 13, inZ, 'Комната в сердце лестницы', 'Посреди винтовой лестницы, между вторым и третьим этажом, два треснувших камня в столбе. За ними — каморка 3×3 внутри столба.');
    }
    // Служебная винтовая лестница (юго-запад): из подклета к буфетной и наверх
    solid(w, -2, -1, 36, 2, 36, 40, STONE);
    spiral2(w, -4, 34, 4, 42, [3, 35], true, [[0, 6], [6, 12], [12, 18], [18, 24], [24, 30], [30, 30]], -1);
    w.fill(-4, 30, 38, -4, 37, 38, 'ladder', { f: 'w' });
    w.room(0, 0, 38, 'Служебная лестница', 'Винтовая лестница для слуг в юго-западной башне: из кухни в буфетную у Большого зала и выше, до крыши.');
    w.room(38, 0, 38, 'Парадная лестница', 'Широкая винтовая лестница юго-восточной башни: все этажи, крыша и верх башни.');

    // ======== Убранство ========
    const lampHang = (x, y, z) => hangL(w, x, y, z);
    const chand = (x, top, z, len) => chandL(w, x, top, z, len);
    const table = (x1, y, z1, x2, z2, id) => tableL(w, x1, y, z1, x2, z2, id);
    const banner = (x, y, z, f, id = 'red_banner') => w.set(x, y, z, id, { f });
    // Камин: топка с костром, каменные щёки и колпак до потолка
    const hearth = (x, y, z, f, top) => {
      const along = f === 'e' || f === 'w' ? 'z' : 'x';
      const P = (a, b) => (along === 'z' ? [x + a * (f === 'e' ? 1 : -1), z + b] : [x + b, z + a * (f === 's' ? 1 : -1)]);
      for (const b2 of [-2, 2]) for (let yy = y; yy <= y + 2; yy++) { const [px, pz] = P(0, b2); w.set(px, yy, pz, 'stone_bricks'); }
      for (let b2 = -2; b2 <= 2; b2++) { const [px, pz] = P(0, b2); w.set(px, y + 3, pz, 'stone_brick_stairs', { h: 'top', f: { e: 'w', w: 'e', s: 'n', n: 's' }[f] }); }
      for (let yy = y + 4; yy <= top; yy++) for (let b2 = -1; b2 <= 1; b2++) { const [px, pz] = P(0, b2); w.set(px, yy, pz, 'stone_bricks'); }
      const [cx, cz] = P(0, 0); w.set(cx, y, cz, 'campfire');
    };

    // --- Подклет ---
    for (const x of [7, 8, 9]) { w.set(x, 0, 3, 'furnace', { f: 's' }); w.fill(x, 1, 3, x, 4, 3, 'stone_bricks'); }
    w.set(11, 0, 3, 'smoker', { f: 's' }); w.set(3, 0, 10, 'cauldron'); w.set(3, 0, 12, 'cauldron');
    for (let j = 14; j <= 17; j++) w.set(3, 0, j, 'barrel');
    table(8, 0, 9, 10, 10, 'spruce_slab'); w.set(12, 0, 15, 'hay_block'); w.set(12, 1, 15, 'hay_block'); w.fill(13, 0, 16, 13, 0, 18, 'white_wool');
    lampHang(8, 4, 10); lampHang(8, 4, 16);
    w.room(9, 0, 12, 'Пекарня и пивоварня', 'Хлебные печи вдоль стены, котлы для пива, бочки, мешки с мукой.');
    for (const z of [24, 30]) w.fill(3, 0, z, 4, 2, z, 'stone_bricks');
    w.fill(3, 3, 24, 4, 3, 30, 'stone_bricks'); w.fill(3, 4, 25, 3, 4, 29, 'stone_bricks');
    w.set(3, 0, 25, 'campfire'); w.set(3, 0, 29, 'campfire'); w.set(3, 0, 27, 'cauldron'); w.fill(3, 1, 26, 3, 1, 28, 'iron_chain');
    table(7, 0, 26, 10, 29, 'spruce_slab'); for (let z = 26; z <= 29; z++) { w.set(6, 0, z, 'spruce_stairs', { f: 'w' }); w.set(11, 0, z, 'spruce_stairs', { f: 'e' }); }
    for (let x = 8; x <= 12; x++) w.set(x, 0, 35, x % 2 ? 'furnace' : 'smoker', { f: 'n' });
    for (const z of [21, 22, 23]) w.set(13, 0, z, 'barrel', { theme: 'kitchen' });
    w.set(13, 0, 31, 'stripped_spruce_log'); w.set(13, 0, 33, 'chest', { f: 'w' }); lampHang(8, 4, 23); lampHang(8, 4, 31);
    w.room(8, 0, 27, 'Кухня', 'Большой очаг на две топки с котлом посередине, разделочный стол, печи и коптильни. Отсюда служебная лестница наверх.');
    for (const i of [17, 21]) for (const j of [8, 14, 20, 26, 32]) solid(w, i, 0, j, i, 4, j, STONE);
    for (let j = 4; j <= 34; j++) if (j % 3) { w.set(15, 0, j, j % 2 ? 'barrel' : 'hay_block'); w.set(23, 0, j, j % 2 ? 'white_wool' : 'barrel'); }
    for (const j of [11, 23, 29]) lampHang(19, 4, j);
    w.room(19, 0, 18, 'Кладовые', 'Длинный зал под Большим залом: столбы, бочки, мешки, сено. С северного конца дверь в ледник под нишей трона.');
    w.fill(16, 0, -4, 22, 1, -4, 'packed_ice'); w.fill(16, 0, -2, 22, 0, -2, 'barrel');
    w.room(19, 0, -3, 'Ледник', 'Холодный погреб под нишей трона: лёд и бочки с солониной.');
    for (const j of [7, 11, 15]) for (let i = 26; i <= 34; i++) { w.set(i, 0, j, 'barrel'); w.set(i, 1, j, 'barrel'); }
    lampHang(30, 4, 9); lampHang(30, 4, 13);
    w.room(30, 0, 9, 'Винный погреб', 'Ряды бочек в два яруса.');
    // Караульня и тюремный спуск
    w.fill(25, 0, 22, 25, 0, 32, 'iron_bars'); w.fill(28, 0, 22, 28, 0, 32, 'iron_bars'); w.fill(26, 0, 32, 27, 0, 32, 'iron_bars');
    table(31, 0, 24, 32, 26); w.set(30, 0, 25, 'spruce_stairs', { f: 'w' }); w.set(33, 0, 25, 'spruce_stairs', { f: 'e' });
    w.bed(34, 0, 22, 0, 1, 'brown_bed'); w.bed(34, 0, 26, 0, 1, 'brown_bed'); w.fill(35, 0, 28, 35, 1, 31, 'spruce_fence'); lampHang(31, 4, 28);
    w.room(30, 0, 27, 'Караульня', 'Стража у входа в подклет. Здесь же решётка над лестницей в темницу.');
    // Колодезная (СЗ башня)
    ring(w, -1, 0, -1, 1, 0, 1, 'mossy_cobblestone'); w.set(0, 0, 0, 'air'); w.set(0, -1, 0, 'water');
    for (const x of [-1, 1]) w.fill(x, 1, 0, x, 2, 0, 'spruce_fence'); w.fill(-1, 3, 0, 1, 3, 0, 'spruce_slab'); w.set(0, 2, 0, 'iron_chain');
    w.set(-3, 0, -3, 'barrel'); w.set(-3, 0, 3, 'cauldron');
    w.room(0, 0, 2, 'Колодезная', 'Колодец внутри донжона: в осаду вода своя. Шахта уходит вниз, в подземную цистерну.');
    for (let i = -3; i <= 3; i++) if (i % 2) { w.set(i + 36 + 2, 0, -3, 'packed_ice'); }
    w.room(38, 0, 0, 'Погреб-холодильник', 'Нижняя комната северо-восточной башни: лёд и бочки.');
    for (const [x, z] of [[35, -3], [36, -3], [37, -3], [41, 1], [41, 2]]) w.set(x, 0, z, 'barrel');

    // --- Парадный этаж ---
    // Большой зал: возвышение с высоким столом, трон в нише, два камина, столы, колонны
    solid(w, 11, 6, 3, 27, 6, 5, PAVE); for (let i = 11; i <= 27; i++) w.set(i, 6, 6, 'stone_brick_stairs', { f: 'n' });
    solid(w, 15, 6, -5, 23, 6, -1, 'polished_andesite');
    w.fill(16, 7, -4, 22, 7, 5, 'red_carpet'); w.fill(18, 6, 7, 20, 6, 35, 'red_carpet');
    w.set(19, 7, -4, 'dark_oak_stairs', { f: 'n' }); w.fill(19, 7, -5, 19, 8, -5, 'chiseled_stone_bricks'); w.set(19, 9, -5, 'gold_block');
    w.set(18, 7, -5, 'dark_oak_fence'); w.set(20, 7, -5, 'dark_oak_fence');
    banner(15, 11, -3, 'w'); banner(23, 11, -3, 'e');
    table(12, 7, 4, 16, 4); table(22, 7, 4, 26, 4);
    for (const i of [12, 14, 16, 22, 24, 26]) w.set(i, 7, 3, 'dark_oak_stairs', { f: 'n' });
    for (const i of [13, 25]) for (const j of [8, 13, 18, 23]) { solid(w, i, 6, j, i, 15, j, STONE); w.set(i, 16, j, 'chiseled_stone_bricks'); }
    for (const [x1, x2] of [[15, 16], [22, 23]]) {
      table(x1, 6, 9, x2, 24, 'spruce_slab');
      for (let j = 9; j <= 24; j += 1) { w.set(x1 - 1, 6, j, 'spruce_stairs', { f: 'w' }); w.set(x2 + 1, 6, j, 'spruce_stairs', { f: 'e' }); }
      for (const j of [11, 16, 21]) w.set(x1, 7, j, 'candle', { lit: 1 });
    }
    hearth(11, 6, 16, 'e', 16); hearth(27, 6, 16, 'w', 16);
    for (const j of [10, 16, 22]) chand(19, 16, j, 4);
    for (const j of [8, 12, 20, 24]) { banner(11, 12, j, 'w'); banner(27, 12, j, 'e'); }
    banner(16, 12, 3, 'n'); banner(22, 12, 3, 'n');
    w.room(19, 6, 14, 'Большой зал', 'Сердце замка, высотой в два этажа. В северном конце возвышение с высоким столом и трон в нише средней башни. Вдоль зала столы с лавками, по бокам два камина, колонны и знамёна. Сверху на зал смотрят галереи.');
    w.mark('slot', 19, 6, 6, 'Под ступенью трона', 'Ступень возвышения перед троном можно поднять.');
    w.mark('slot', 11, 6, 16, 'Камень в очаге', 'Расшатанный камень в задней стенке западного камина.');
    for (let i = 11; i <= 27; i += 4) w.set(i, 6, 29, 'barrel');
    w.room(19, 6, 29, 'Сени за перегородкой', 'Проход между резной перегородкой зала и входом. Отсюда двери в буфетную и к парадной лестнице.');
    for (const i of [15, 23]) { w.set(i, 6, 33, 'stone_brick_stairs', { f: i === 15 ? 'w' : 'e' }); w.set(i, 6, 34, 'stone_brick_stairs', { f: i === 15 ? 'w' : 'e' }); }
    banner(17, 9, 35, 's'); banner(21, 9, 35, 's'); chand(19, 10, 33, 2);
    w.room(19, 6, 33, 'Входные сени', 'Сюда приводит лестница пристройки. Знамёна, скамьи для ожидающих.');
    // Зал совета
    table(6, 6, 8, 8, 10); for (const [x, z, f] of [[5, 8, 'w'], [5, 10, 'w'], [9, 8, 'e'], [9, 10, 'e'], [7, 7, 'n'], [7, 11, 's'], [5, 9, 'w'], [9, 9, 'e']]) w.set(x, 6, z, 'dark_oak_stairs', { f });
    w.set(7, 7, 9, 'candle', { lit: 1 }); w.set(3, 8, 9, 'item_frame', { f: 'w' }); banner(3, 9, 11, 'w'); banner(9, 9, 3, 'n'); chand(7, 10, 9, 1);
    w.room(7, 6, 9, 'Зал совета', 'Круглый стол на восемь мест, карта на стене. Здесь хозяин держал совет.');
    // Парадная оружейная
    for (let j = 15; j <= 21; j += 2) { w.fill(3, 6, j, 3, 7, j, 'spruce_fence'); banner(3, 9, j, 'w', j % 4 === 1 ? 'red_banner' : 'brown_banner'); }
    for (const j of [16, 20]) w.set(9, 6, j, 'iron_bars'); w.set(8, 6, 18, 'chest', { f: 'w' }); w.set(9, 6, 14, 'grindstone'); lampHang(6, 10, 18);
    w.room(6, 6, 18, 'Парадная оружейная', 'Стойки с оружием и щиты рода на стенах.');
    // Буфетная и хлебная
    for (let j = 24; j <= 30; j++) { w.set(3, 6, j, 'barrel'); if (j % 2) w.set(3, 7, j, 'barrel'); }
    table(7, 6, 27, 8, 30, 'spruce_slab'); w.set(8, 7, 28, 'candle'); lampHang(6, 10, 28);
    w.room(6, 6, 28, 'Буфетная', 'Бочки с вином и пивом, стол для разлива. Сюда поднимаются слуги по винтовой лестнице.');
    w.fill(11, 6, 35, 13, 6, 35, 'barrel'); table(11, 6, 33, 12, 33, 'spruce_slab'); w.set(11, 7, 33, 'cake');
    w.room(12, 6, 34, 'Хлебная', 'Кладовая для хлеба и сыра рядом с залом.');
    w.bed(25, 6, 34, 0, 1, 'brown_bed'); w.set(27, 6, 32, 'barrel');
    w.room(26, 6, 33, 'Караул у входа', 'Комнатка стражи рядом со входными сенями.');
    // Счётная палата
    table(31, 6, 8, 33, 8); w.set(32, 6, 9, 'dark_oak_stairs', { f: 's' }); w.set(31, 6, 10, 'lectern', { f: 'n' });
    for (const z of [7, 8, 9]) w.set(35, 6, z, 'chest', { f: 'w' }); w.set(29, 6, 11, 'cartography_table'); w.set(33, 7, 8, 'candle', { lit: 1 }); lampHang(32, 10, 9);
    w.room(32, 6, 9, 'Счётная палата', 'Здесь управитель вёл счета замка: конторка, книги податей, сундуки.');
    for (const j of [15, 22]) for (let i = 30; i <= 34; i += 2) w.set(i, 6, j, 'spruce_stairs', { f: j === 15 ? 'n' : 's' });
    banner(29, 9, 19, 'w'); lampHang(32, 10, 19);
    w.room(32, 6, 19, 'Сени библиотеки', 'Прохожая перед библиотекой: в восточной стене широкий проём в книжную пристройку.');
    banner(35, 9, 28, 'e'); lampHang(31, 10, 30);
    w.room(31, 6, 30, 'Лестничный зал', 'Дверь на парадную винтовую лестницу.');
    // Архив и казна в башнях
    for (const [x, z] of [[-3, -3], [-3, -2], [-3, -1], [-2, -3], [-1, -3]]) w.fill(x, 6, z, x, 8, z, 'bookshelf');
    w.set(1, 6, -1, 'lectern', { f: 's' }); w.set(-1, 6, 2, 'chest', { f: 'n' });
    w.room(0, 6, 0, 'Архив грамот', 'Полки со свитками и грамотами рода в северо-западной башне.');
    w.fill(34, 6, 0, 42, 7, 0, 'iron_bars'); w.door(38, 6, 0, 's', 'iron_door');
    for (const x of [35, 37, 39, 41]) w.set(x, 6, -3, 'chest', { f: 's' }); w.set(38, 6, -2, 'gold_block');
    w.room(38, 6, 1, 'Казна', 'За решёткой с железной дверью сундуки с серебром.');

    // --- Галерейный этаж ---
    // Часовня с тайником священника
    w.fill(9, 12, 8, 9, 12, 10, 'chiseled_stone_bricks'); w.fill(9, 13, 8, 9, 13, 10, 'smooth_stone_slab');
    w.set(9, 14, 8, 'candle', { lit: 1 }); w.set(9, 14, 10, 'candle', { lit: 1 }); banner(9, 15, 9, 'e');
    for (const i of [5, 7]) for (const j of [6, 7, 11, 12]) w.set(i, 12, j, 'spruce_stairs', { f: 'w' });
    w.fill(3, 12, 9, 8, 12, 9, 'red_carpet'); w.set(8, 12, 12, 'lectern', { f: 'e' }); lampHang(6, 16, 9);
    air(w, 1, 12, 9, 2, 13, 9); air(w, 1, 12, 10, 1, 13, 10); banner(3, 14, 9, 'w');
    w.set(1, 12, 10, 'chest', { f: 'n' });
    w.room(6, 12, 9, 'Часовня донжона', 'Домашняя часовня хозяина: алтарь со свечами, скамьи, кафедра.');
    w.mark('secret', 2, 12, 9, 'Тайник священника', 'За знаменем у западной стены часовни — лаз в нишу внутри толстой стены. Там прятали священника и церковное серебро.');
    // Солар и «ухо хозяина»
    hearth(3, 12, 25, 'e', 16);
    w.fill(4, 12, 22, 8, 12, 28, 'red_carpet'); for (const z of [23, 27]) w.set(6, 12, z, 'dark_oak_stairs', { f: 'e' });
    w.fill(9, 12, 23, 9, 14, 26, 'bookshelf'); w.set(8, 12, 30, 'chest', { f: 'n' }); w.set(4, 12, 30, 'lectern', { f: 'n' }); lampHang(6, 16, 25);
    w.room(6, 12, 25, 'Солар', 'Личная гостиная хозяина: камин, кресла, книги. Здесь он отдыхал и принимал близких.');
    w.set(6, 12, 18, 'air'); w.set(6, 13, 18, 'air'); banner(5, 14, 18, 'e');
    for (const z of [17, 18, 19]) w.set(10, 13, z, 'iron_bars');
    w.set(8, 12, 18, 'dark_oak_stairs', { f: 'w' }); w.set(7, 12, 16, 'candle');
    w.mark('secret', 8, 12, 18, 'Ухо хозяина', 'За знаменем в соларе — каморка в стене над Большим залом. Через решётку слышно и видно всё, что говорят в зале.');
    // Гостевые, музыкантская, галерея
    w.bed(8, 12, 33, 0, 1, 'red_bed'); w.bed(11, 12, 33, 0, 1, 'red_bed'); w.set(13, 12, 32, 'chest', { f: 'w' }); lampHang(10, 16, 33);
    w.room(10, 12, 33, 'Гостевые покои', 'Две кровати для знатных гостей.');
    for (const i of [16, 17, 18]) w.set(i, 12, 34, 'noteblock'); w.set(21, 12, 34, 'jukebox'); for (const i of [16, 18]) w.set(i, 12, 32, 'spruce_stairs', { f: 'n' });
    w.room(19, 12, 33, 'Музыкантская', 'Комната менестрелей: инструменты. Дверь ведёт на галерею над залом.');
    for (const i of [13, 17, 21, 25]) w.set(i, 12, 30, 'spruce_stairs', { f: 's' });
    w.room(19, 12, 29, 'Галерея менестрелей', 'Балкон над входом в Большой зал: отсюда играли музыканты на пирах.');
    // Кабинет, галерея к библиотеке, лекарская
    table(31, 12, 7, 33, 7); w.set(32, 12, 8, 'dark_oak_stairs', { f: 's' }); w.set(33, 13, 7, 'candle', { lit: 1 });
    w.fill(35, 12, 7, 35, 14, 12, 'bookshelf'); w.set(29, 14, 9, 'item_frame', { f: 'w' }); w.set(30, 12, 12, 'chest', { f: 'n' }); lampHang(32, 16, 9);
    w.room(32, 12, 9, 'Кабинет хозяина', 'Письменный стол, книги, карта владений.');
    for (const j of [15, 22]) w.set(34, 12, j, 'lectern', { f: 'w' }); lampHang(32, 16, 19);
    w.room(32, 12, 19, 'Галерея над залом', 'Аркада на Большой зал и проход на верхнюю галерею библиотеки.');
    w.set(29, 12, 26, 'brewing_stand'); w.set(30, 12, 26, 'cauldron'); w.bed(34, 12, 27, 0, 1, 'brown_bed'); for (const z of [28, 29, 30]) w.set(29, 12, z, 'flower_pot');
    w.room(32, 12, 28, 'Лекарская', 'Комната лекаря: травы, котёл, койка для больного.');
    w.room(30, 12, 34, 'Площадка второго этажа', 'Выход с парадной лестницы на галерейный этаж.');
    // Ризница и сокровищница в башнях
    w.set(-2, 12, -2, 'chest', { f: 's' }); w.set(0, 12, -3, 'barrel'); w.set(2, 12, -3, 'lectern', { f: 's' });
    w.room(0, 12, 0, 'Ризница', 'Облачения и церковная утварь при часовне.');
    w.fill(34, 12, 0, 42, 13, 0, 'iron_bars'); w.door(38, 12, 0, 's', 'iron_door'); for (const x of [36, 38, 40]) w.set(x, 12, -3, 'decorated_pot'); w.set(38, 12, -4, 'chest', { f: 's' });
    w.room(38, 12, 1, 'Сокровищница', 'Дорогая утварь, кубки и драгоценности рода за второй решёткой.');

    // --- Жилой этаж ---
    w.bed(9, 18, 4, 0, -1, 'red_bed'); w.set(12, 18, 3, 'loom'); w.set(13, 18, 8, 'chest', { f: 'w' });
    for (const z of [10, 11, 12]) w.set(3, 18, z, 'flower_pot'); w.fill(7, 18, 7, 11, 18, 11, 'green_carpet'); lampHang(9, 22, 9);
    w.room(9, 18, 9, 'Покои хозяйки', 'Кровать, ткацкий станок, цветы, сундук с приданым.');
    w.bed(23, 18, 4, 0, -1, 'red_bed'); w.bed(24, 18, 4, 0, -1, 'red_bed');
    for (const [x, z] of [[22, 3], [25, 3], [22, 5], [25, 5]]) w.fill(x, 18, z, x, 20, z, 'dark_oak_fence');
    w.fill(22, 21, 3, 25, 21, 5, 'dark_oak_slab'); w.set(23, 18, 6, 'chest', { f: 's' });
    hearth(15, 18, 9, 'e', 22); w.fill(17, 18, 7, 26, 18, 12, 'red_carpet'); w.set(17, 18, 12, 'barrel'); w.set(26, 18, 12, 'lectern', { f: 'n' }); lampHang(21, 22, 9);
    banner(27, 20, 3, 'n'); air(w, 27, 18, 2, 27, 19, 2);
    w.room(21, 18, 9, 'Опочивальня хозяина', 'Кровать под балдахином, камин, сундук. Дверь в нише средней башни ведёт в гардеробную.');
    w.mark('secret', 27, 18, 2, 'Потайной спуск хозяина', 'За знаменем в углу опочивальни — шахта с лестницей внутри северной стены. Она идёт через все этажи прямо в запечатанную сокровищницу под замком.');
    for (const [x, z] of [[16, -4], [17, -4], [16, -2]]) w.set(x, 18, z, 'barrel'); w.set(22, 18, -4, 'spruce_stairs', { f: 'n' }); w.set(22, 18, -2, 'chest', { f: 's' });
    w.room(19, 18, -3, 'Гардеробная', 'Одежда хозяина в нише средней башни, тут же уборная.');
    w.bed(31, 18, 7, 0, 1, 'brown_bed'); w.bed(33, 18, 7, 0, 1, 'brown_bed'); w.set(30, 18, 12, 'chest', { f: 'n' }); w.set(34, 18, 12, 'noteblock'); lampHang(32, 22, 10);
    w.room(32, 18, 10, 'Детская', 'Две маленькие кровати, сундук с игрушками.');
    table(8, 18, 18, 30, 19); for (let i = 8; i <= 30; i += 2) { w.set(i, 18, 17, 'spruce_stairs', { f: 'n' }); w.set(i, 18, 20, 'spruce_stairs', { f: 's' }); }
    hearth(3, 18, 19, 'e', 22); for (const i of [12, 19, 26]) chand(i, 22, 19, 1);
    for (const i of [10, 28]) { banner(i, 21, 15, 'n'); banner(i, 21, 23, 's'); }
    w.room(19, 18, 19, 'Горница', 'Семейный зал на жилом этаже: длинный стол, камин. Здесь ели без гостей.');
    for (let i = 4; i <= 12; i += 3) w.bed(i, 18, 26, 0, 1, 'brown_bed'); w.set(12, 18, 34, 'chest', { f: 'w' });
    w.room(8, 18, 30, 'Комната служанок', 'Простые кровати рядом со служебной лестницей.');
    w.bed(19, 18, 26, 0, 1, 'red_bed'); w.set(16, 18, 34, 'chest', { f: 'n' }); w.fill(17, 18, 29, 21, 18, 33, 'red_carpet');
    w.room(19, 18, 30, 'Покои гостя', 'Опочивальня для почётного гостя.');
    for (const z of [26, 27, 28]) w.set(35, 18, z, 'barrel');
    w.room(30, 18, 30, 'Бельевая', 'Бочки с бельём у выхода с парадной лестницы.');
    w.set(0, 18, 0, 'cartography_table'); w.set(-2, 18, -2, 'lectern', { f: 'e' }); w.fill(-1, 18, 3, -1, 20, 3, 'spruce_fence'); w.set(1, 18, -3, 'chest', { f: 's' });
    w.room(0, 18, 0, 'Комната звездочёта', 'Звёздные карты и подзорная труба в северо-западной башне.');
    for (const x of [35, 37, 39]) w.set(x, 18, -3, 'brewing_stand'); w.set(41, 18, -1, 'cauldron'); w.fill(41, 18, 1, 41, 18, 3, 'barrel');
    for (const x of [36, 38]) w.set(x, 18, 2, 'flower_pot');
    w.room(38, 18, 0, 'Лаборатория', 'Алхимик рода: зельеварки, котёл, снадобья.');

    // --- Караульный этаж ---
    for (let i = 7; i <= 31; i += 3) { w.bed(i, 24, 4, 0, -1, 'brown_bed'); w.bed(i, 24, 18, 0, 1, 'brown_bed'); }
    table(12, 24, 11, 26, 11, 'spruce_slab'); for (let i = 12; i <= 26; i += 2) { w.set(i, 24, 10, 'spruce_stairs', { f: 'n' }); w.set(i, 24, 12, 'spruce_stairs', { f: 's' }); }
    for (const i of [12, 19, 26]) lampHang(i, 28, 8);
    w.room(19, 24, 11, 'Казарма', 'Спальня гарнизона: два ряда коек, общий стол.');
    w.bed(4, 24, 30, 0, 1, 'brown_bed'); table(9, 24, 27, 11, 27); w.set(10, 24, 28, 'dark_oak_stairs', { f: 's' }); w.set(13, 26, 28, 'item_frame', { f: 'e' }); w.set(12, 24, 34, 'chest', { f: 'w' });
    w.room(8, 24, 28, 'Комната капитана', 'Кровать, стол с картой обороны, сундук.');
    for (let z = 22; z <= 34; z += 2) { w.fill(15, 24, z, 15, 25, z, 'spruce_fence'); w.set(23, 24, z, 'barrel'); } w.set(19, 24, 30, 'grindstone'); w.set(20, 24, 33, 'anvil', { f: 'e' });
    w.room(19, 24, 28, 'Арсенал', 'Запас оружия гарнизона. Отсюда лестница-люк на крышу.');
    w.fill(26, 24, 22, 28, 25, 24, 'cobblestone'); for (const x of [31, 33]) w.set(x, 24, 22, 'cauldron'); w.fill(26, 24, 30, 27, 24, 34, 'hay_block'); w.set(34, 24, 29, 'target');
    w.room(30, 24, 28, 'Осадный склад', 'Камни для метания, котлы для смолы, солома.');
    w.fill(-3, 24, -3, 3, 24, -3, 'hay_block'); for (const x of [-3, -1, 1, 3]) w.set(x, 25, -3, 'spruce_trapdoor', { open: 1, f: 'n' });
    w.room(0, 24, 0, 'Голубятня', 'Гнёзда почтовых голубей: так замок слал вести.');
    w.fill(35, 24, -3, 41, 25, -3, 'barrel'); w.room(38, 24, 0, 'Башенная оружейная', 'Запас стрел и арбалетов у бойниц.');
    w.room(19, 30, 19, 'Крыша', 'Плоская кровля за зубцами, над ней четыре угловые башни и средняя дозорная.');
  }

  // ======================= БИБЛИОТЕКА =======================
  // Пристройка к восточной стене донжона между двух башен. Внизу скрипторий,
  // над ним зал библиотеки в два этажа с галереей и тайным хранилищем.
  function library(b, KX, KZ) {
    const w = at(b, KX, KZ);
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
    for (const j of [13, 25]) lampHang(47, 4, j);
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
    w.set(47, 6, 19, 'lectern', { f: 's' });
    for (const j of [13, 19, 25]) chand(47, 16, j, 4);
    w.room(46, 6, 19, 'Библиотека', 'Главный зал библиотеки в два этажа: книжные шкафы-стойла между высокими окнами, столы для чтения со свечами, люстры. Лестница ведёт на галерею вдоль трёх стен, где полки до самого потолка.');
    w.room(40, 12, 20, 'Галерея библиотеки', 'Верхний ярус полок. С западной стороны дверь на галерею донжона.');
    // Тайное хранилище за полкой-дверью и чердак над ним
    w.fill(52, 12, 9, 52, 16, 12, 'bookshelf'); w.fill(53, 12, 12, 56, 16, 12, 'bookshelf'); air(w, 53, 12, 9, 56, 16, 11); solid(w, 52, 11, 9, 56, 11, 12, 'dark_oak_planks');
    w.set(55, 12, 11, 'lectern', { f: 's' }); w.set(54, 12, 9, 'chest', { f: 's' }); w.set(53, 12, 9, 'candle', { lit: 1 }); w.fill(56, 12, 9, 56, 17, 9, 'ladder', { f: 'e' });
    w.mark('secret', 52, 12, 10, 'Тайное хранилище', 'Конец северной галереи упирается в шкаф. Два блока полок — дверь на поршнях; рычаг спрятан под кафедрой у окна. За ней комнатка с запретными книгами и лестница на чердак.');
    w.set(53, 18, 12, 'lectern', { f: 'w' }); w.set(55, 18, 14, 'chest', { f: 'w' }); w.fill(53, 18, 16, 56, 18, 16, 'bookshelf'); w.set(54, 18, 13, 'candle', { lit: 1 });
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
    chandL(w, 19, 12, 44, 3); banner2(w, 16, 9, 40, 'w'); banner2(w, 22, 9, 40, 'e');
    lamp(w, 16, 3, 49); lamp(w, 22, 3, 49);
    w.room(19, 6, 40, 'Парадная лестница ко входу', 'Каменная пристройка с широкой лестницей: в донжон входят сразу на второй, парадный этаж. Так строили настоящие донжоны: внизу двери нет, чтобы врагу было труднее.');
  }
  const banner2 = (w, x, y, z, f) => w.set(x, y, z, 'red_banner', { f });

  // ======================= КАТАКОМБЫ =======================
  // Пол y = -11, стоять на y = -10. Описаны внутренности залов: стены
  // между соседними залами общие, проходы прорезаются отдельно.
  function catacombs(b, KX, KZ) {
    const w = at(b, KX, KZ);
    const NATURAL = [['stone', 3], ['mossy_cobblestone', 2], ['tuff', 2], ['cobblestone', 1], ['moss_block', 1]];
    const rooms = [
      [6, 31, 54, 33, 4], // южный ход
      [53, 34, 55, 59, 4], // ход к склепу часовни
      [18, -8, 20, 30, 4], // средний ход
      [9, 5, 29, 15, 7], // усыпальница
      [23, 19, 33, 29, 4], // темница
      [5, 19, 15, 29, 4], // костница
      [-9, 18, 2, 28, 6, NATURAL], // древнее святилище
      [-5, -5, 7, 1, 5], // цистерна
      [8, -1, 17, -1, 4], // ход от цистерны
      [23, -7, 31, 1, 4], // запечатанная сокровищница
      [19, -18, 19, -9, 3], // лаз за стену
    ];
    for (const [x1, z1, x2, z2, h, pal] of rooms) solid(w, x1 - 1, -11, z1 - 1, x2 + 1, -10 + h, z2 + 1, pal || CRYPT);
    solid(w, 5, -15, -5, 25, -12, -3, CRYPT); // сифон
    solid(w, 29, -22, 18, 33, -12, 22, CRYPT); // каменный мешок
    solid(w, 25, -12, 21, 28, -1, 32, CRYPT); // тюремный спуск
    solid(w, 26, -5, 0, 28, -2, 2, CRYPT); solid(w, 18, -11, -20, 20, -2, -18, CRYPT);
    for (const [x1, z1, x2, z2, h] of rooms) {
      air(w, x1, -10, z1, x2, -11 + h, z2);
      const top = -11 + h;
      if (h >= 4) {
        if (x2 - x1 <= z2 - z1) for (let z = z1; z <= z2; z++) { w.set(x1, top, z, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(x2, top, z, 'stone_brick_stairs', { h: 'top', f: 'e' }); }
        else for (let x = x1; x <= x2; x++) { w.set(x, top, z1, 'stone_brick_stairs', { h: 'top', f: 'n' }); w.set(x, top, z2, 'stone_brick_stairs', { h: 'top', f: 's' }); }
      }
    }
    const cut = (x1, z1, x2, z2, h = 2) => air(w, x1, -10, z1, x2, -11 + h, z2);
    cut(30, 30, 30, 30); cut(21, 24, 22, 24); cut(16, 24, 17, 24); cut(10, 30, 10, 30);

    // Тюремный спуск из караульни подклета
    for (let k = 0; k <= 9; k++) { air(w, 26, -1 - k, 22 + k, 27, -1, 22 + k); w.fill(26, -2 - k, 22 + k, 27, -2 - k, 22 + k, 'stone_brick_stairs', { f: 'n' }); }
    w.mark('room', 26, -6, 27, 'Тюремный спуск', 'Лестница из караульни подклета вниз, к темнице. Сверху огорожена решёткой.');

    // Усыпальница рода
    for (const i of [12, 16, 22, 26]) for (const j of [7, 13]) solid(w, i, -10, j, i, -4, j, 'deepslate_tiles');
    for (const i of [10, 14, 24, 28]) for (const j of [8, 11]) { w.fill(i, -10, j, i, -10, j + 1, 'polished_deepslate'); w.fill(i, -9, j, i, -9, j + 1, 'smooth_stone_slab'); w.set(i, -8, j, 'candle', { lit: 1 }); }
    w.fill(17, -10, 5, 21, -10, 6, 'polished_blackstone'); w.fill(18, -9, 5, 20, -9, 6, 'polished_deepslate'); w.set(19, -8, 5, 'skeleton_skull'); banner2(w, 19, -6, 5, 'n');
    for (const i of [14, 24]) w.set(i, -4, 10, 'soul_lantern', { hang: 1 });
    w.mark('room', 19, -10, 10, 'Усыпальница рода', 'Высокий зал с колоннами: каменные гробницы хозяев замка, у северной стены главная гробница основателя.');
    w.mark('slot', 19, -10, 6, 'Гробница основателя', 'Плиту главной гробницы можно сдвинуть.');
    // Темница и каменный мешок
    for (const j of [22, 26]) w.fill(29, -10, j, 33, -8, j, CRYPT);
    w.fill(28, -10, 19, 28, -8, 29, 'iron_bars'); for (const j of [20, 24, 28]) w.door(28, -10, j, 'e', 'iron_door');
    for (const j of [19, 23, 27]) { w.fill(33, -9, j, 33, -8, j, 'iron_chain'); w.set(32, -10, j + 2, 'hay_block'); }
    air(w, 31, -18, 20, 31, -12, 20); air(w, 30, -21, 19, 32, -19, 21); w.set(31, -11, 20, 'spruce_trapdoor');
    w.set(30, -21, 19, 'skeleton_skull'); w.fill(32, -20, 21, 32, -19, 21, 'iron_chain'); w.set(31, -21, 21, 'cobweb');
    for (const j of [21, 27]) w.set(25, -7, j, 'soul_lantern', { hang: 1 });
    w.mark('room', 28, -10, 24, 'Темница', 'Три камеры за решётками с железными дверями, цепи, солома.');
    w.mark('secret', 31, -11, 20, 'Каменный мешок', 'Под соломой в первой камере — люк. Под ним яма-одиночка в восемь блоков глубиной, куда бросали «навсегда». На стенах — нацарапанные записи узника.');
    // Костница с ложной стеной
    for (let j = 19; j <= 29; j++) { w.fill(5, -10, j, 5, -8, j, 'bone_block'); if (j % 2) w.set(5, -9, j, 'skeleton_skull'); w.fill(4, -10, j, 4, -8, j, 'bone_block'); }
    air(w, 3, -10, 23, 3, -9, 23); air(w, 5, -10, 23, 5, -9, 23);
    w.fill(9, -10, 22, 11, -10, 26, 'bone_block'); w.set(10, -9, 24, 'skeleton_skull'); w.set(12, -7, 24, 'soul_lantern', { hang: 1 });
    w.mark('room', 10, -10, 24, 'Костница', 'Стены сложены из костей и черепов давно умерших.');
    w.mark('secret', 4, -10, 23, 'Ложная стена костницы', 'Один «костяной» блок в западной стене — кладка в один слой. За ним проход в древнее святилище.');
    // Древнее святилище (старше замка)
    w.fill(-9, -11, 18, 2, -11, 28, ['moss_block', 'stone', 'mossy_cobblestone']);
    w.fill(-7, -10, 23, -7, -10, 23, 'chiseled_stone_bricks'); w.set(-7, -9, 23, 'skeleton_skull');
    for (const [y, z] of [[-9, 22], [-8, 21], [-9, 24], [-8, 25], [-7, 20], [-7, 26]]) w.set(-7, y, z, 'bone_block');
    for (const z of [21, 25]) w.set(-5, -10, z, 'candle', { lit: 1 });
    for (const [x, z] of [[-3, 19], [0, 27], [-6, 27], [1, 20], [-8, 19]]) w.fill(x, -6, z, x, -6, z, 'hanging_roots');
    w.fill(-2, -10, 22, 0, -10, 24, 'moss_carpet');
    w.mark('room', -4, -10, 23, 'Древнее святилище', 'Пещера, которая старше замка: алтарь с черепом и рогами из кости, корни свисают с потолка. Кто молился здесь до замка — загадка для истории.');
    // Цистерна и сифон в сокровищницу
    w.fill(-4, -10, -4, 6, -10, 0, 'water'); air(w, 0, -5, 0, 0, -2, 0); w.fill(0, -5, 0, 0, -2, 0, 'water');
    ring(w, -1, -4, -1, 1, -2, 1, CRYPT); w.fill(0, -4, 0, 0, -2, 0, 'water');
    w.fill(6, -13, -4, 6, -11, -4, 'water'); w.fill(6, -14, -4, 24, -13, -4, 'water'); w.fill(24, -13, -4, 24, -11, -4, 'water');
    w.mark('room', 2, -10, -2, 'Цистерна', 'Подземный водоём, сюда спускается шахта колодца.');
    w.mark('secret', 6, -11, -4, 'Подводный лаз', 'В дальнем углу цистерны дно уходит вниз. Лаз под водой ныряет под средний ход и выходит в запечатанную сокровищницу. Плыть около 20 блоков.');
    // Запечатанная сокровищница
    for (const x of [24, 26, 28, 30]) w.set(x, -10, -6, 'chest', { f: 's' });
    w.set(27, -10, -3, 'gold_block'); w.set(29, -10, -3, 'gold_block'); w.set(25, -10, 0, 'decorated_pot'); w.set(30, -10, 0, 'decorated_pot');
    air(w, 27, -6, 1, 27, 19, 1); w.fill(27, -6, 1, 27, 19, 1, 'ladder', { f: 'n' });
    w.mark('room', 27, -10, -3, 'Запечатанная сокровищница', 'Глухой зал без дверей. Попасть сюда можно двумя путями: по потайной шахте из опочивальни хозяина или вплавь через сифон из цистерны.');
    // Лаз за стену
    air(w, 19, -10, -19, 19, -2, -19); w.fill(19, -10, -19, 19, -2, -19, 'ladder', { f: 'n' }); w.set(19, -1, -19, 'spruce_trapdoor');
    w.mark('secret', 19, -10, -14, 'Потайной лаз', 'Узкий ход из подземелья под крепостной стеной. Выходит люком в лесу за северной стеной.');
    // Освещение и паутина
    for (let i = 10; i <= 50; i += 8) w.set(i, -7, 32, 'soul_lantern', { hang: 1 });
    for (let j = -6; j <= 28; j += 8) w.set(19, -7, j, 'soul_lantern', { hang: 1 });
    for (let j = 38; j <= 56; j += 9) w.set(54, -7, j, 'soul_lantern', { hang: 1 });
    for (const [i, j] of [[6, 31], [54, 58], [18, -8], [20, 30], [19, -17], [23, -7]]) w.set(i, -10, j, 'cobweb');
    w.mark('room', 30, -10, 32, 'Южный ход', 'Главный коридор подземелья. На восточном конце поворачивает к склепу часовни.');
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
      b.fill(x1 + 1, 0, z1 + 4, x1 + 1, 15, z1 + 4, 'ladder', { f: 'w' });
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
    for (let x = 9; x <= 21; x++) for (const z of [13, 23]) if (x % 3) { b.set(x, 0, z, 'barrel'); if (x % 2) b.set(x, 1, z, 'hay_block'); }
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
    b.fill(98, 0, 8, 100, 0, 8, 'bookshelf'); b.fill(101, 0, 11, 104, 0, 12, 'spruce_slab', { h: 'top' }); b.set(106, 0, 8, 'chest', { f: 's' });
    b.bed(98, 5, 9, 0, -1, 'red_bed'); b.set(106, 5, 8, 'barrel'); b.fill(107, 0, 16, 107, 4, 16, 'ladder', { f: 'e' });
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
    b.set(77, 2, 58, 'candle', { lit: 1 }); b.set(77, 2, 60, 'candle', { lit: 1 }); b.set(80, 0, 59, 'lectern', { f: 'w' });
    b.fill(59, 0, 59, 76, 0, 59, 'red_carpet');
    b.set(68, 7, 59, 'lantern', { hang: 1 }); b.fill(68, 8, 59, 68, 12, 59, 'iron_chain');
    // Спуск в склеп в южном рукаве трансепта
    b.fill(68, -10, 67, 68, -1, 67, 'ladder', { f: 's' });
    b.mark('room', 68, 0, 59, 'Часовня', 'Крестообразная часовня: неф со скамьями, алтарь в апсиде, над средокрестием башенка с колоколом и крестом. В южном рукаве — лаз в склеп.');
    overgrow(b, 58, 54, 78, 64, 7, 22);
    // Склеп под часовней
    solid(b, 59, -11, 54, 77, -5, 68, CRYPT); air(b, 60, -10, 55, 76, -6, 63); air(b, 67, -10, 64, 69, -7, 67);
    air(b, 64, -10, 54, 66, -7, 54);
    b.fill(68, -10, 67, 68, -1, 67, 'ladder', { f: 's' });
    for (const x of [62, 66, 70, 74]) for (const z of [56, 62]) { b.fill(x, -10, z, x + 1, -10, z, 'polished_deepslate'); b.set(x, -9, z, 'candle', { lit: 1 }); }
    for (const x of [64, 72]) for (const z of [55, 63]) b.fill(x, -10, z, x, -6, z, 'deepslate_tiles');
    b.set(68, -6, 59, 'soul_lantern', { hang: 1 });
    b.mark('room', 68, -10, 59, 'Склеп часовни', 'Под полом часовни: гробницы в два ряда. Отсюда длинный ход ведёт к катакомбам донжона.');
      // Кладбище у часовни
    b.walls(60, 0, 70, 84, 0, 84, 'mossy_cobblestone_wall'); b.set(60, 0, 77, 'air');
    for (let x = 63; x <= 81; x += 3) for (let z = 73; z <= 81; z += 4) {
      b.surface(x, z, x, z + 1, 'coarse_dirt');
      if ((x + z) % 2) { b.fill(x, 0, z, x, 1, z, 'spruce_fence'); b.set(x, 1, z - 1, 'spruce_fence'); b.set(x, 1, z + 1, 'spruce_fence'); b.set(x, 1, z, 'spruce_fence'); }
      else b.set(x, 0, z, 'mossy_stone_brick_wall');
      if (b.chance(0.4)) b.set(x + 1, 0, z + 1, ['poppy', 'candle', 'lily_of_the_valley']);
    }
    b.mark('room', 72, 0, 77, 'Кладбище', 'Низкая каменная ограда, кресты и надгробия рядами.');

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
    ],
    build() {
      const b = new Builder(2025);
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
      overgrow(b, KX, KZ, KX + 38, KZ + 38, 28, 70);
      overgrow(b, KX - 5, KZ - 5, KX + 43, KZ + 43, 34, 50);
      for (let k = 0; k < 56; k++) {
        const side = k % 4, t = b.r();
        const x = side < 2 ? Math.round(-4 + t * (X2 + 8)) : side === 2 ? -4 - Math.round(b.r()) : X2 + 4 + Math.round(b.r());
        const z = side >= 2 ? Math.round(-4 + t * (Z2 + 8)) : side === 0 ? -4 - Math.round(b.r()) : Z2 + 4 + Math.round(b.r());
        if (x > CX - 6 && x < CX + 6 && z > Z2) continue;
        b.spruce(x, z, 8 + Math.floor(b.r() * 5));
      }
      return b;
    },
  });
})();
