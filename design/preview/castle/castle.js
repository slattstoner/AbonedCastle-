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

  // Винтовая лестница вокруг столба 3×3. ring — клетки по ходу движения,
  // laps — пары [откуда, куда] (высота, на которой стоит игрок) на каждый виток.
  function spiral(w, cells, laps, floorY) {
    const steps = [];
    for (const [a, c] of laps) {
      const r = c - a, n = cells.length - 1;
      cells.forEach(([x, z], k) => steps.push({ x, z, s: a + Math.round((k * r) / n) }));
    }
    const dir = (p, q) => (q.x > p.x ? 'e' : q.x < p.x ? 'w' : q.z > p.z ? 's' : 'n');
    const lastAt = {};
    steps.forEach((st) => { for (let y = st.s; y <= st.s + 2; y++) w.set(st.x, y, st.z, 'air'); });
    steps.forEach((st, i) => {
      const key = st.x + ',' + st.z;
      const from = lastAt[key] !== undefined ? lastAt[key] + 3 : floorY;
      for (let y = from; y <= st.s - 2; y++) w.set(st.x, y, st.z, STONE);
      lastAt[key] = st.s;
      const p = steps[i - 1];
      if (!p || p.s === st.s) w.set(st.x, st.s - 1, st.z, 'stone_bricks');
      else if (st.s > p.s) w.set(st.x, st.s - 1, st.z, 'stone_brick_stairs', { f: dir(p, st) });
      else w.set(st.x, st.s - 1, st.z, 'stone_brick_stairs', { f: dir(st, p) });
    });
  }
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
    };
  }

  // ======================= ДОНЖОН =======================
  // Корпус 25×25 (i, j = 0..24 от северо-западного угла), башни 7×7 по углам,
  // средняя башня на северной стене. Этажи: пол 1-го y = -1, 2-го y = 7,
  // 3-го y = 14, крыша y = 21. Тронный зал — в два этажа.
  function keep(b, KX, KZ) {
    const w = at(b, KX, KZ);
    const F1 = 0, F2 = 8, F3 = 15, ROOFY = 22; // уровни, на которых стоит игрок

    // Корпус, полы, кровля
    ring(w, 0, -1, 0, 24, 21, 24);
    solid(w, 1, -1, 1, 23, -1, 23, PAVE);
    solid(w, 1, 7, 1, 23, 7, 23, PLANKS);
    solid(w, 1, 14, 1, 23, 14, 23, PLANKS);
    solid(w, 1, 21, 1, 23, 21, 23, STONE);
    // Пилястры по фасадам
    for (const i of [6, 18]) { solid(w, i, -1, -1, i, 20, -1); }
    for (const i of [6, 10, 14, 18]) { solid(w, i, -1, 25, i, 20, 25); }
    for (const j of [8, 13, 18]) { solid(w, -1, -1, j, -1, 20, j); solid(w, 25, -1, j, 25, 20, j); }
    battlementsBody();
    function battlementsBody() { corbels(w, 0, 0, 24, 24, 21); crenel(w, -1, -1, 25, 25, 22); }

    // Тронный зал в два этажа: убрать пол второго этажа
    air(w, 7, 7, 1, 17, 7, 15);
    // Перегородки 1-го этажа (y 0..6) и стены тронного зала (до y 13)
    const wallX = (i, j1, j2, y1, y2) => solid(w, i, y1, j1, i, y2, j2, STONE);
    const wallZ = (j, i1, i2, y1, y2) => solid(w, i1, y1, j, i2, y2, j, STONE);
    wallX(6, 1, 23, 0, 13); wallX(18, 1, 23, 0, 13); wallZ(16, 7, 17, 0, 13);
    wallZ(13, 1, 5, 0, 6); wallZ(13, 19, 23, 0, 6); wallZ(21, 4, 5, 0, 6);
    // 2-й этаж
    wallX(6, 17, 23, 8, 13); wallZ(13, 19, 23, 8, 13); wallZ(21, 4, 5, 8, 13);
    // 3-й этаж
    wallZ(13, 1, 23, 15, 20); wallX(6, 14, 23, 15, 20); wallX(18, 14, 23, 15, 20); wallZ(21, 4, 5, 15, 20);
    wallX(6, 1, 12, 15, 20); wallX(18, 1, 12, 15, 20); air(w, 6, 15, 1, 6, 20, 12); air(w, 18, 15, 1, 18, 20, 12);

    // Проёмы и двери
    // Вход: арка 3×4 по центру южного фасада
    air(w, 11, 0, 24, 13, 3, 24);
    w.set(11, 3, 24, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(13, 3, 24, 'stone_brick_stairs', { h: 'top', f: 'e' });
    // Из сеней в тронный зал — такая же арка
    air(w, 11, 0, 16, 13, 3, 16);
    w.set(11, 3, 16, 'stone_brick_stairs', { h: 'top', f: 'w' }); w.set(13, 3, 16, 'stone_brick_stairs', { h: 'top', f: 'e' });
    w.door(6, 0, 8, 'e', 'dark_oak_door'); w.door(18, 0, 8, 'w', 'dark_oak_door');
    w.door(3, 0, 13, 's', 'spruce_door'); w.door(21, 0, 13, 's', 'spruce_door');
    w.door(6, 0, 22, 'e', 'dark_oak_door'); w.door(18, 0, 22, 'w', 'dark_oak_door');
    w.door(4, 0, 21, 's', 'spruce_door');
    // Галереи над тронным залом: арки с перилами
    for (const [i, js] of [[6, [5, 9, 13]], [18, [5, 9]]]) for (const j of js) {
      air(w, i, 8, j, i, 11, j + 1);
      w.set(i, 8, j, 'dark_oak_fence'); w.set(i, 8, j + 1, 'dark_oak_fence');
      w.set(i, 11, j, 'stone_brick_stairs', { h: 'top', f: 'n' }); w.set(i, 11, j + 1, 'stone_brick_stairs', { h: 'top', f: 's' });
    }
    air(w, 18, 8, 14, 18, 10, 15); w.set(18, 8, 14, 'dark_oak_fence'); w.set(18, 8, 15, 'dark_oak_fence');
    // Балкон кабинета над залом
    air(w, 11, 8, 16, 13, 10, 16); for (let i = 11; i <= 13; i++) w.set(i, 8, 16, 'dark_oak_fence');
    w.door(6, F2, 19, 'e', 'dark_oak_door'); w.door(18, F2, 19, 'w', 'dark_oak_door');
    w.door(21, F2, 13, 's', 'spruce_door'); w.door(6, F2, 22, 'e', 'spruce_door');
    w.door(3, F3, 13, 's', 'dark_oak_door'); w.door(20, F3, 13, 's', 'dark_oak_door');
    w.door(6, F3, 18, 'e', 'dark_oak_door'); w.door(18, F3, 19, 'w', 'dark_oak_door');

    // Окна корпуса
    const rows = [[2, 2], [9, 2], [16, 2]];
    for (const [y, h] of rows) {
      for (const i of [5, 19]) win(w, i, y, 0, h);
      for (const i of [5, 8, 16, 19]) win(w, i, y, 24, h);
      for (const j of [6, 10, 16, 19]) { win(w, 0, y, j, h); win(w, 24, y, j, h); }
    }
    win(w, 12, 9, 24, 2); win(w, 12, 16, 24, 2);
    for (const i of [7, 17]) { win(w, i, 2, 0, 10); win(w, i, 16, 0, 2); }

    // ---------- Башни ----------
    const towers = {
      nw: { x1: -3, z1: -3, x2: 3, z2: 3, door: [[2, 3]], slits: [[-3, 0], [0, -3]] },
      ne: { x1: 21, z1: -3, x2: 27, z2: 3, door: [[22, 3]], slits: [[27, 0], [24, -3]] },
      sw: { x1: -3, z1: 21, x2: 3, z2: 27, slits: [[-3, 24], [0, 27]] },
      se: { x1: 21, z1: 21, x2: 27, z2: 27, slits: [[27, 24], [24, 27]] },
    };
    for (const t of Object.values(towers)) {
      ring(w, t.x1, -1, t.z1, t.x2, 27, t.z2);
      air(w, t.x1 + 1, 0, t.z1 + 1, t.x2 - 1, 27, t.z2 - 1);
      solid(w, t.x1 + 1, -1, t.z1 + 1, t.x2 - 1, -1, t.z2 - 1, PAVE);
      battlements(w, t.x1, t.z1, t.x2, t.z2, 28);
      for (const [x, z] of t.slits) for (const y of [2, 9, 16, 24]) win(w, x, y, z, 2);
    }
    // Средняя башня на северной стене: внизу ниша для трона, наверху дозорная.
    ring(w, 9, -1, -4, 15, 28, 0);
    air(w, 10, 0, -3, 14, 27, -1);
    solid(w, 10, -1, -3, 14, -1, -1, PAVE);
    battlements(w, 9, -4, 15, 0, 29);
    solid(w, 10, 14, -3, 14, 14, -1, PLANKS); solid(w, 10, 21, -3, 14, 21, -1, STONE);
    air(w, 10, 0, 0, 14, 12, 0); air(w, 10, 15, 0, 14, 19, 0); doorway(w, 12, ROOFY, 0);
    win(w, 12, 3, -4, 8); win(w, 12, 16, -4, 2); win(w, 12, 24, -4, 2);
    for (const i of [9, 15]) for (const y of [4, 17, 24]) win(w, i, y, -2, 2);

    // Полы в башнях NW, NE, SW; двери с каждого этажа
    for (const k of ['nw', 'ne', 'sw']) {
      const t = towers[k];
      for (const y of [7, 14, 21]) solid(w, t.x1 + 1, y, t.z1 + 1, t.x2 - 1, y, t.z2 - 1, PLANKS);
    }
    for (const y of [F1, F2, F3]) { doorway(w, 2, y, 3); doorway(w, 22, y, 3); }
    doorway(w, 3, ROOFY, 2); doorway(w, 21, ROOFY, 2); doorway(w, 3, ROOFY, 22);
    doorway(w, 3, F1, 22); doorway(w, 2, F2, 21); doorway(w, 2, F3, 21);
    // Лестницы-стремянки из верхних комнат башен на площадки
    for (const [x, z, f] of [[-2, 0, 'w'], [26, 0, 'e'], [-2, 24, 'w']]) w.fill(x, 22, z, x, 28, z, 'ladder', { f });

    // Главная винтовая лестница в юго-восточной башне: от первого этажа до верха башни
    for (const y of [F1, F2, F3, ROOFY]) doorway(w, 21, y, 22);
    solid(w, 23, -1, 23, 25, 27, 25, STONE);
    spiral(w, ringCells(22, 22, 26, 26, [22, 22]), [[0, 8], [8, 15], [15, 22], [22, 29]], 0);
    // Спуск в катакомбы в юго-западной башне
    air(w, -2, -1, 22, 2, -1, 26);
    solid(w, -1, -12, 23, 1, -1, 25, STONE);
    ring(w, -3, -12, 21, 3, -1, 27, CRYPT);
    spiral(w, ringCells(-2, 22, 2, 26, [2, 22], true), [[0, -10]], -12);
    doorway(w, 3, -10, 23, 3);

    // ---------- Убранство ----------
    // Тронный зал
    w.fill(11, 0, 2, 13, 0, 23, 'red_carpet');
    for (const i of [8, 16]) for (const j of [3, 7, 11, 14]) { solid(w, i, 0, j, i, 12, j, STONE); w.set(i, 13, j, 'chiseled_stone_bricks'); }
    solid(w, 10, 0, -3, 14, 0, -1, 'polished_andesite');
    for (let i = 10; i <= 14; i++) w.set(i, 0, 0, 'stone_brick_stairs', { f: 'n' });
    w.fill(11, 1, -2, 13, 1, -1, 'red_carpet');
    w.set(12, 1, -2, 'dark_oak_stairs', { f: 'n' }); w.set(12, 1, -3, 'chiseled_stone_bricks'); w.set(12, 2, -3, 'gold_block');
    w.set(11, 1, -3, 'dark_oak_fence'); w.set(13, 1, -3, 'dark_oak_fence');
    w.set(10, 5, -2, 'red_banner', { f: 'w' }); w.set(14, 5, -2, 'red_banner', { f: 'e' });
    for (const j of [4, 10]) { w.set(7, 6, j, 'red_banner', { f: 'w' }); w.set(17, 6, j, 'red_banner', { f: 'e' }); }
    for (const j of [5, 11]) { w.fill(12, 10, j, 12, 13, j, 'iron_chain'); w.set(12, 9, j, 'lantern', { hang: 1 }); }
    for (const j of [2, 14]) { w.set(9, 0, j, 'stone_brick_stairs', { f: 'w' }); w.set(15, 0, j, 'stone_brick_stairs', { f: 'e' }); }
    w.room(12, 1, -2, 'Тронный зал', 'Зал в два этажа высотой. Трон стоит в нише средней башни на возвышении. Колонны в два ряда, знамёна, люстры на цепях. С боков над залом нависают галереи второго этажа.');
    // Сени
    for (const i of [8, 16]) { w.set(i, 0, 18, 'stone_brick_stairs', { f: i === 8 ? 'w' : 'e' }); w.set(i, 0, 22, 'stone_brick_stairs', { f: i === 8 ? 'w' : 'e' }); }
    w.set(12, 6, 20, 'lantern', { hang: 1 }); w.set(10, 3, 23, 'red_banner', { f: 's' }); w.set(14, 3, 23, 'red_banner', { f: 's' });
    w.room(12, 0, 20, 'Сени', 'Входной зал. Отсюда двери в тронный зал, к спуску в подземелье и к главной лестнице.');
    // Кухня
    for (const j of [5, 6]) w.set(1, 0, j, 'furnace', { f: 'e' });
    w.set(1, 0, 7, 'smoker', { f: 'e' }); w.set(1, 0, 9, 'cauldron'); w.set(1, 0, 11, 'barrel', { theme: 'kitchen' }); w.set(1, 0, 12, 'barrel', { theme: 'kitchen' });
    w.fill(3, 0, 7, 4, 0, 10, 'spruce_slab', { h: 'top' }); w.set(5, 0, 8, 'spruce_stairs', { f: 'e' }); w.set(5, 0, 9, 'spruce_stairs', { f: 'e' });
    w.set(5, 0, 4, 'crafting_table'); w.set(4, 0, 4, 'barrel'); w.set(3, 6, 8, 'lantern', { hang: 1 });
    w.room(3, 0, 6, 'Кухня', 'Печи, коптильня, котёл, разделочный стол. Дверь в тронный зал, в кладовую и в башню с колодцем.');
    // Кладовая
    for (const j of [15, 16, 17, 18, 19, 20]) { w.set(1, 0, j, 'barrel', { theme: 'pantry' }); }
    w.set(5, 0, 15, 'hay_block'); w.set(5, 0, 16, 'hay_block'); w.set(5, 1, 15, 'hay_block'); w.set(3, 0, 20, 'chest', { f: 'n' });
    w.room(3, 0, 17, 'Кладовая', 'Бочки с припасами, сено, сундук. Отсюда узкая дверь к спуску в подземелье.');
    // Колодезная (северо-западная башня)
    ring(w, -1, 0, -1, 1, 0, 1, 'mossy_cobblestone'); w.set(0, 0, 0, 'air');
    w.set(-1, 1, 0, 'spruce_fence'); w.set(1, 1, 0, 'spruce_fence'); w.set(-1, 2, 0, 'spruce_fence'); w.set(1, 2, 0, 'spruce_fence');
    w.fill(-1, 3, 0, 1, 3, 0, 'spruce_slab'); w.set(0, 2, 0, 'iron_chain');
    solid(w, 0, -5, 0, 0, -1, 0, 'water'); ring(w, -1, -5, -1, 1, -2, 1, STONE);
    w.room(0, 0, 0, 'Колодезная', 'Колодец внутри донжона: в осаду вода своя. Шахта уходит прямо в подземную цистерну.');
    // Караульная
    for (const j of [5, 8, 11]) w.bed(23, 0, j, -1, 0, 'brown_bed');
    w.fill(20, 0, 7, 20, 0, 9, 'spruce_slab', { h: 'top' }); w.set(19, 0, 8, 'spruce_stairs', { f: 'w' });
    w.set(23, 0, 4, 'barrel'); w.set(19, 0, 4, 'grindstone'); w.set(21, 6, 8, 'lantern', { hang: 1 });
    w.room(21, 0, 6, 'Караульная', 'Койки стражи, стол, точило. Дверь в тронный зал и к главной лестнице.');
    // Винный погреб (северо-восточная башня, внизу)
    for (const [x, z] of [[23, -2], [24, -2], [25, -2], [26, -1], [26, 0], [26, 1]]) { w.set(x, 0, z, 'barrel'); w.set(x, 1, z, 'barrel'); }
    w.room(24, 0, 0, 'Винный погреб', 'Бочки в два яруса в нижней комнате башни.');
    // Лестничные площадки
    w.set(20, 6, 17, 'lantern', { hang: 1 }); w.set(23, 3, 17, 'red_banner', { f: 'e' });
    w.room(21, 0, 17, 'Лестничный зал', 'Дверь в винтовую лестницу юго-восточной башни: с неё попадаешь на все этажи, на крышу и на верх башни.');
    w.room(3, 0, 23, 'Сени к подземелью', 'Тесный проход к юго-западной башне. В ней винтовая лестница уходит вниз, в катакомбы.');

    // --- 2-й этаж ---
    // Библиотека вдоль западной стены, с арками на тронный зал
    for (let j = 4; j <= 20; j++) if (![6, 10, 16, 19].includes(j)) w.fill(1, 8, j, 1, 12, j, j % 3 ? 'bookshelf' : 'chiseled_bookshelf');
    for (const j of [8, 15]) { w.fill(3, 8, j, 3, 10, j + 1, 'bookshelf'); }
    w.set(4, 8, 12, 'lectern', { f: 'w' }); w.set(4, 8, 18, 'lectern', { f: 'w' });
    w.fill(2, 8, 12, 3, 8, 13, 'dark_oak_slab', { h: 'top' }); w.set(2, 9, 12, 'candle', { lit: 1 });
    for (const j of [6, 13, 19]) w.set(3, 13, j, 'lantern', { hang: 1 });
    w.room(3, F2, 11, 'Библиотека', 'Длинный зал вдоль стены: полки до потолка, кафедры, стол для чтения. Через арки видно тронный зал.');
    // Архив (NW башня, 2-й этаж)
    ring(w, -2, 8, -2, 2, 10, 2, 'bookshelf'); doorway(w, 2, F2, 2); w.set(0, 8, 0, 'cartography_table'); w.set(-1, 8, 0, 'lectern', { f: 'e' });
    w.room(0, F2, 0, 'Архив', 'Комната в башне: полки по кругу, стол картографа, кафедра. Здесь хранили грамоты и планы.');
    // Оружейная
    for (const j of [4, 6, 8, 10, 12]) { w.set(23, 8, j, 'spruce_fence'); w.set(23, 9, j, 'spruce_fence'); }
    w.set(20, 8, 4, 'anvil', { f: 'e' }); w.set(19, 8, 11, 'smithing_table'); w.set(20, 8, 12, 'grindstone'); w.set(23, 8, 5, 'barrel'); w.set(23, 8, 11, 'barrel');
    w.set(23, 11, 7, 'red_banner', { f: 'e' }); w.set(21, 13, 8, 'lantern', { hang: 1 });
    w.room(21, F2, 8, 'Оружейная', 'Стойки с оружием вдоль стены, наковальня, точило. Арки выходят на тронный зал.');
    // Казна (NE башня, 2-й этаж)
    w.fill(22, 8, -1, 26, 8, -1, 'iron_bars'); w.fill(22, 9, -1, 26, 9, -1, 'iron_bars'); w.set(24, 8, -1, 'iron_door', { f: 's' }); w.set(24, 9, -1, 'iron_door', { f: 's', top: 1 });
    w.set(23, 8, -2, 'chest', { f: 's' }); w.set(25, 8, -2, 'chest', { f: 's' }); w.set(24, 8, -2, 'gold_block');
    w.room(24, F2, 0, 'Казна', 'Решётка с железной дверью, за ней сундуки.');
    // Кабинет хозяина с балконом на тронный зал
w.fill(9, 8, 18, 15, 8, 22, 'red_carpet');
    w.fill(11, 8, 20, 13, 8, 20, 'dark_oak_slab', { h: 'top' }); w.set(12, 8, 21, 'dark_oak_stairs', { f: 's' });
    w.set(13, 9, 20, 'candle', { lit: 1 }); w.set(11, 8, 22, 'lectern', { f: 'n' });
    for (let j = 17; j <= 23; j++) { if (j !== 19 && j !== 22) { w.fill(7, 8, j, 7, 10, j, 'bookshelf'); w.fill(17, 8, j, 17, 10, j, 'bookshelf'); } }
    w.set(16, 8, 23, 'cartography_table'); w.set(12, 13, 19, 'lantern', { hang: 1 });
    w.room(12, F2, 20, 'Кабинет хозяина', 'Стол, кафедра, книги. Балкон смотрит в тронный зал.');
    // Молельня (SW башня, 2-й этаж)
    w.set(0, 8, 25, 'chiseled_stone_bricks'); w.set(0, 9, 25, 'candle', { lit: 1 }); w.set(-1, 8, 25, 'candle', { lit: 1 }); w.set(1, 8, 25, 'candle', { lit: 1 });
    w.set(0, 10, 26, 'red_banner', { f: 's' }); w.set(0, 8, 23, 'spruce_stairs', { f: 'n' });
    w.room(0, F2, 24, 'Молельня', 'Крохотная домашняя часовня в башне: алтарь, свечи, скамья.');
    w.room(21, F2, 17, 'Галерея стражи', 'Площадка у лестницы, арка на тронный зал.');

    // --- 3-й этаж ---
    // Пиршественный зал
    w.fill(6, 15, 6, 18, 15, 7, 'dark_oak_slab', { h: 'top' });
    for (let i = 6; i <= 18; i += 2) { w.set(i, 15, 5, 'spruce_stairs', { f: 'n' }); w.set(i, 15, 8, 'spruce_stairs', { f: 's' }); }
    for (const i of [8, 12, 16]) w.set(i, 16, 6, 'candle', { lit: 1 });
    w.set(10, 16, 7, 'cake'); w.set(14, 16, 6, 'cake');
    w.fill(11, 15, -2, 13, 15, -2, 'dark_oak_slab', { h: 'top' }); w.set(12, 15, -3, 'dark_oak_stairs', { f: 'n' });
    for (const i of [8, 16]) { w.fill(i, 18, 6, i, 20, 6, 'iron_chain'); w.set(i, 17, 6, 'lantern', { hang: 1 }); }
    solid(w, 1, 15, 8, 1, 17, 10, STONE); w.set(1, 15, 9, 'air'); w.set(2, 15, 9, 'campfire');
    for (const i of [8, 16]) w.set(i, 19, 1, 'red_banner', { f: 'n' });
    w.room(12, F3, 6, 'Пиршественный зал', 'Длинный стол на весь зал, камин, люстры. Хозяйский стол — в нише средней башни.');
    // Обсерватория (NW башня, 3-й этаж)
    w.set(0, 15, 0, 'cartography_table'); w.set(-1, 15, -1, 'lectern', { f: 'e' }); w.set(1, 15, -1, 'chest', { f: 's' });
    w.room(0, F3, 0, 'Комната звездочёта', 'Верхняя комната северо-западной башни: карты неба, стол, сундук.');
    // Лаборатория (NE башня, 3-й этаж)
    w.set(23, 15, -2, 'brewing_stand'); w.set(25, 15, -2, 'brewing_stand'); w.set(26, 15, 0, 'cauldron');
    w.fill(22, 15, -2, 22, 15, 1, 'barrel'); for (const x of [23, 24, 25]) w.set(x, 15, 2, 'flower_pot');
    w.room(24, F3, 0, 'Лаборатория', 'Зельеварки, котёл, горшки с травами. Здесь варили снадобья.');
    // Покои хозяина: кровать под балдахином
    w.bed(11, 15, 16, 0, -1, 'red_bed'); w.bed(12, 15, 16, 0, -1, 'red_bed');
    for (const [i, j] of [[10, 14], [13, 14], [10, 17], [13, 17]]) w.fill(i, 15, j, i, 17, j, 'dark_oak_fence');
    w.fill(10, 18, 14, 13, 18, 17, 'dark_oak_slab');
    w.set(8, 15, 14, 'barrel'); w.set(8, 15, 15, 'barrel'); w.set(12, 15, 18, 'chest', { f: 's' }); w.fill(9, 15, 19, 15, 15, 22, 'red_carpet');
    w.set(16, 15, 22, 'lectern', { f: 'n' }); w.set(12, 20, 20, 'lantern', { hang: 1 });
    w.room(12, F3, 18, 'Покои хозяина', 'Кровать под балдахином, сундук, шкафы.');
    // Покои хозяйки
    w.bed(2, 15, 15, 0, -1, 'brown_bed'); w.set(5, 15, 14, 'loom'); w.set(1, 15, 17, 'chest', { f: 'e' });
    for (const j of [18, 19, 20]) w.set(1, 15, j, 'flower_pot'); w.fill(2, 15, 17, 4, 15, 20, 'green_carpet');
    w.room(3, F3, 17, 'Покои хозяйки', 'Кровать, ткацкий станок, цветы, сундук.');
    // Гардеробная (SW башня, 3-й этаж)
    for (const [x, z] of [[-2, 23], [-2, 24], [-2, 25], [2, 25]]) w.set(x, 15, z, 'barrel');
    w.set(0, 15, 26, 'chest', { f: 'n' });
    w.room(0, F3, 24, 'Гардеробная', 'Тесная комната с сундуками и бочками в башне.');
    w.room(21, F3, 17, 'Верхняя площадка', 'Выход с винтовой лестницы на третий этаж.');
    w.room(12, ROOFY, 12, 'Крыша', 'Плоская кровля с зубцами. С неё двери в верхние комнаты башен, а оттуда лестницы на смотровые площадки.');
  }

  // ======================= КАТАКОМБЫ =======================
  // Пол y = -11, стоять на y = -10. Сначала выкладываем «оболочки» всех залов,
  // потом вырезаем пустоты: стены между соседними залами получаются общими.
  function catacombs(b, KX, KZ) {
    const K = (i) => KX + i, Z = (j) => KZ + j;
    const rooms = [
      // [x1, z1, x2, z2, высота]
      [K(4), Z(22), K(31), Z(24), 4], // главный ход
      [K(11), Z(-10), K(13), Z(21), 4], // поперечный ход
      [K(0), Z(3), K(9), Z(11), 4], // темница
      [K(0), Z(13), K(9), Z(20), 4], // костница
      [K(15), Z(12), K(25), Z(20), 6], // усыпальница
      [K(15), Z(2), K(25), Z(9), 4], // погреба
      [K(-2), Z(-4), K(9), Z(1), 5], // цистерна
      [K(15), Z(-6), K(21), Z(0), 4], // тайная сокровищница
      [K(30), Z(25), K(32), Z(38), 4], // ход к часовне
    ];
    for (const [x1, z1, x2, z2, h] of rooms) solid(b, x1 - 1, -11, z1 - 1, x2 + 1, -11 + h + 1, z2 + 1, CRYPT);
    for (const [x1, z1, x2, z2, h] of rooms) {
      air(b, x1, -10, z1, x2, -11 + h, z2);
      // Своды: перевёрнутые ступени вдоль длинных стен под потолком
      const top = -11 + h;
      if (x2 - x1 <= z2 - z1) for (let z = z1; z <= z2; z++) { b.set(x1, top, z, 'stone_brick_stairs', { h: 'top', f: 'w' }); b.set(x2, top, z, 'stone_brick_stairs', { h: 'top', f: 'e' }); }
      else for (let x = x1; x <= x2; x++) { b.set(x, top, z1, 'stone_brick_stairs', { h: 'top', f: 'n' }); b.set(x, top, z2, 'stone_brick_stairs', { h: 'top', f: 's' }); }
    }
    const hole = (x1, z1, x2, z2, h = 3) => air(b, x1, -10, z1, x2, -11 + h, z2);
    hole(K(10), Z(6), K(10), Z(8)); hole(K(10), Z(16), K(10), Z(17)); hole(K(14), Z(15), K(14), Z(17), 4);
    hole(K(14), Z(5), K(14), Z(6)); hole(K(10), Z(-2), K(10), Z(-1)); hole(K(14), Z(-3), K(14), Z(-3), 2);
    hole(K(12), Z(21), K(12), Z(21)); hole(K(31), Z(25), K(31), Z(25));
    // Выход из винтовой лестницы юго-западной башни
    hole(K(3), Z(23), K(3), Z(23));

    // Темница: камеры с решётками
    for (const j of [3, 4, 5, 6, 7, 8, 9, 10, 11]) b.fill(K(5), -10, Z(j), K(5), -8, Z(j), 'iron_bars');
    for (const j of [5, 8]) b.fill(K(0), -10, Z(j), K(4), -8, Z(j), CRYPT);
    for (const j of [4, 7, 10]) { b.set(K(5), -10, Z(j), 'air'); b.set(K(5), -9, Z(j), 'air'); b.door(K(5), -10, Z(j), 'e', 'iron_door'); }
    for (const j of [3, 6, 9]) { b.set(K(1), -10, Z(j + 1), 'hay_block'); b.fill(K(0) + 1, -9, Z(j), K(0) + 1, -8, Z(j), 'iron_chain'); }
    b.set(K(2), -10, Z(10), 'skeleton_skull'); b.set(K(8), -8, Z(7), 'soul_lantern', { hang: 1 });
    b.mark('room', K(6), -10, Z(7), 'Темница', 'Три камеры за решётками с железными дверями, цепи на стенах.');
    // Костница
    for (let j = 13; j <= 20; j++) { b.fill(K(0), -10, Z(j), K(0), -8, Z(j), 'bone_block'); if (j % 2) b.set(K(1), -9, Z(j), 'skeleton_skull'); }
    b.fill(K(4), -10, Z(15), K(5), -10, Z(18), 'bone_block'); b.set(K(4), -9, Z(16), 'skeleton_skull'); b.set(K(5), -9, Z(17), 'skeleton_skull');
    b.set(K(7), -8, Z(16), 'soul_lantern', { hang: 1 });
    b.mark('room', K(5), -10, Z(17), 'Костница', 'Стены выложены костями и черепами.');
    // Усыпальница: колонны и гробницы
    for (const [i, j] of [[17, 14], [17, 18], [23, 14], [23, 18]]) b.fill(K(i), -10, Z(j), K(i), -6, Z(j), 'deepslate_tiles');
    for (const i of [19, 21]) for (const j of [13, 18]) { b.fill(K(i), -10, Z(j), K(i), -10, Z(j + 1), 'polished_deepslate'); b.set(K(i), -9, Z(j), 'candle', { lit: 1 }); }
    b.fill(K(24), -10, Z(15), K(25), -10, Z(17), 'polished_deepslate'); b.fill(K(24), -9, Z(15), K(25), -9, Z(17), 'smooth_stone_slab');
    b.set(K(25), -8, Z(16), 'red_banner', { f: 'e' }); b.set(K(20), -6, Z(16), 'soul_lantern', { hang: 1 });
    b.mark('room', K(20), -10, Z(16), 'Усыпальница', 'Высокий зал с колоннами и каменными гробницами. У дальней стены — главная гробница рода.');
    // Погреба
    for (let i = 16; i <= 24; i += 2) { b.set(K(i), -10, Z(2), 'barrel'); b.set(K(i), -9, Z(2), 'barrel'); b.set(K(i), -10, Z(9), 'barrel'); }
    b.set(K(20), -7, Z(5), 'lantern', { hang: 1 }); b.fill(K(18), -10, Z(5), K(19), -10, Z(6), 'cobweb');
    b.mark('room', K(20), -10, Z(5), 'Погреба', 'Старые запасы, паутина, бочки.');
    // Цистерна: вода, вдоль стен узкий проход
    b.fill(K(0), -11, Z(-3), K(8), -11, Z(0), CRYPT); b.fill(K(0), -10, Z(-3), K(8), -10, Z(0), 'water');
    b.mark('room', K(4), -10, Z(-2), 'Цистерна', 'Подземный водоём. Сверху в него спускается шахта колодца.');
    // Тайная сокровищница
    b.set(K(18), -10, Z(-5), 'chest', { f: 's' }); b.set(K(20), -10, Z(-5), 'gold_block'); b.set(K(16), -10, Z(-5), 'decorated_pot');
    b.mark('room', K(18), -10, Z(-3), 'Тайная сокровищница', 'Глухая комнатка в конце хода. Как в неё попасть — решим с историей.');
    // Ход к часовне
    b.mark('room', K(31), -10, Z(32), 'Ход к часовне', 'Длинный коридор под двором до склепа часовни.');
    // Подземный лаз за северную стену
    solid(b, K(11), -11, Z(-21), K(13), -7, Z(-11), CRYPT); solid(b, K(11), -6, Z(-21), K(13), -2, Z(-19), CRYPT);
    air(b, K(12), -10, Z(-20), K(12), -8, Z(-11)); air(b, K(12), -7, Z(-20), K(12), -2, Z(-20));
    b.fill(K(12), -10, Z(-20), K(12), -2, Z(-20), 'ladder', { f: 'n' }); b.set(K(12), -1, Z(-20), 'spruce_trapdoor');
    b.mark('room', K(12), -10, Z(-16), 'Потайной лаз', 'Узкий ход под крепостной стеной. Выходит люком в лесу за замком.');
    // Освещение ходов
    for (let i = 6; i <= 30; i += 6) b.set(K(i), -7, Z(23), 'soul_lantern', { hang: 1 });
    for (let j = -8; j <= 20; j += 7) b.set(K(12), -7, Z(j), 'soul_lantern', { hang: 1 });
    for (const [i, j] of [[4, 22], [13, -10], [31, 37], [11, 20]]) b.set(K(i), -10, Z(j), 'cobweb');
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
  }

  // ======================= КРЕПОСТНЫЕ СТЕНЫ =======================
  function curtain(b) {
    const WT = 8; // верх стены: стоять на y = 9
    const wall = (x1, z1, x2, z2, outer) => {
      solid(b, x1, -1, z1, x2, WT, z2);
      // парапет с зубцами по внешней кромке
      const line = outer === 'n' ? [x1, z1, x2, z1] : outer === 's' ? [x1, z2, x2, z2] : outer === 'w' ? [x1, z1, x1, z2] : [x2, z1, x2, z2];
      box(line[0], WT + 1, line[1], line[2], WT + 1, line[3], (x, y, z) => b.set(x, y, z, STONE));
      box(line[0], WT + 2, line[1], line[2], WT + 2, line[3], (x, y, z) => { if ((x + z) % 2 === 0) b.set(x, y, z, STONE); });
      // контрфорсы снаружи
      const [dx, dz] = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[outer];
      box(line[0], 0, line[1], line[2], 0, line[3], (x, _, z) => {
        if ((x + z) % 10 !== 0) return;
        solid(b, x + dx, -1, z + dz, x + dx, WT - 2, z + dz, MOSSY);
        b.set(x + dx, WT - 1, z + dz, 'stone_brick_stairs', { f: { n: 's', s: 'n', w: 'e', e: 'w' }[outer] });
      });
    };
    wall(9, 3, 82, 4, 'n'); wall(3, 9, 4, 86, 'w'); wall(87, 9, 88, 86, 'e');
    wall(9, 91, 36, 92, 's'); wall(56, 91, 82, 92, 's');
    // Угловые башни с шатровыми крышами
    for (const [x1, z1] of [[0, 0], [83, 0], [0, 87], [83, 87]]) {
      const x2 = x1 + 8, z2 = z1 + 8;
      ring(b, x1, -1, z1, x2, 15, z2); air(b, x1 + 1, 0, z1 + 1, x2 - 1, 15, z2 - 1);
      solid(b, x1 + 1, -1, z1 + 1, x2 - 1, -1, z2 - 1, PAVE); solid(b, x1 + 1, 8, z1 + 1, x2 - 1, 8, z2 - 1, PLANKS);
      corbels(b, x1, z1, x2, z2, 15); solid(b, x1 + 1, 15, z1 + 1, x2 - 1, 15, z2 - 1, PLANKS);
      ring(b, x1 - 1, 16, z1 - 1, x2 + 1, 16, z2 + 1, STONE);
      for (const [x, z] of [[x1 - 1, z1 - 1], [x2 + 1, z1 - 1], [x1 - 1, z2 + 1], [x2 + 1, z2 + 1]]) solid(b, x, 17, z, x, 18, z, FRAME);
      pyramid(b, x1 - 2, z1 - 2, x2 + 2, z2 + 2, 19);
      b.fill(x1 + 4, 26, z1 + 4, x1 + 4, 27, z1 + 4, 'spruce_fence'); b.set(x1 + 4, 28, z1 + 4, 'red_banner', { stand: 0 });
      for (const y of [2, 10]) { win(b, x1 + 4, y, z1, 2, 'iron_bars'); win(b, x1 + 4, y, z2, 2, 'iron_bars'); win(b, x1, y, z1 + 4, 2, 'iron_bars'); win(b, x2, y, z1 + 4, 2, 'iron_bars'); }
      b.fill(x1 + 1, 0, z1 + 4, x1 + 1, 15, z1 + 4, 'ladder', { f: 'w' });
      lamp(b, x1 + 4, 14, z1 - 2); lamp(b, x1 + 4, 14, z2 + 2);
    }
    // Двери: со двора в башни и со стен в башни
    for (const [x, z, f] of [[8, 6, 'e'], [83, 6, 'w'], [8, 89, 'e'], [83, 89, 'w']]) b.door(x, 0, z, f, 'spruce_door');
    for (const [x, z] of [[8, 4], [4, 8], [83, 4], [87, 8], [8, 91], [4, 87], [83, 91], [87, 87]]) doorway(b, x, 9, z);
    // Надвратные башни и ворота
    for (const x1 of [37, 49]) {
      const x2 = x1 + 6;
      ring(b, x1, -1, 88, x2, 14, 94); air(b, x1 + 1, 0, 89, x2 - 1, 14, 93);
      solid(b, x1 + 1, -1, 89, x2 - 1, -1, 93, PAVE); solid(b, x1 + 1, 8, 89, x2 - 1, 8, 93, PLANKS);
      battlements(b, x1, 88, x2, 94, 15);
      for (const y of [2, 10]) win(b, x1 + 3, y, 94, 2, 'iron_bars');
      win(b, x1 === 37 ? x2 : x1, 2, 91, 2, 'iron_bars');
      b.fill(x1 === 37 ? x1 + 1 : x2 - 1, 0, 92, x1 === 37 ? x1 + 1 : x2 - 1, 15, 92, 'ladder', { f: x1 === 37 ? 'w' : 'e' });
      b.door(x1 + 3, 0, 88, 'n', 'spruce_door');
      doorway(b, x1 === 37 ? x1 : x2, 9, 91);
    }
    // Арка проезда, над ней каменный переход
    solid(b, 44, 6, 88, 48, 13, 94); solid(b, 44, -1, 88, 48, -1, 94, PAVE);
    air(b, 44, 0, 88, 48, 5, 94);
    for (let z = 88; z <= 94; z++) { b.set(44, 5, z, 'stone_brick_stairs', { h: 'top', f: 'w' }); b.set(48, 5, z, 'stone_brick_stairs', { h: 'top', f: 'e' }); }
    for (let x = 44; x <= 48; x++) { b.set(x, 5, 93, 'iron_bars'); b.set(x, 4, 93, 'iron_bars'); }
    box(44, 14, 88, 48, 14, 94, (x, y, z) => { if (z === 88 || z === 94) b.set(x, y, z, STONE); });
    box(44, 15, 88, 48, 15, 94, (x, y, z) => { if ((z === 88 || z === 94) && (x + z) % 2 === 0) b.set(x, y, z, STONE); });
    b.door(44, 0, 89, 'w', 'dark_oak_door', true); b.door(48, 0, 89, 'e', 'dark_oak_door', true);
    lamp(b, 43, 4, 95); lamp(b, 49, 4, 95); lamp(b, 43, 4, 87); lamp(b, 49, 4, 87);
    b.set(43, 6, 95, 'red_banner', { f: 'n' }); b.set(49, 6, 95, 'red_banner', { f: 'n' });
    b.mark('room', 46, 0, 91, 'Ворота', 'Проезд между двух надвратных башен, поднятая решётка, тяжёлые створки. Над аркой — каменный переход.');
    // Лестницы на стены у ворот
    for (let k = 0; k <= 8; k++) {
      b.set(26 + k, k, 90, 'stone_brick_stairs', { f: 'e' }); solid(b, 26 + k, -1, 90, 26 + k, k - 1, 90, MOSSY);
      b.set(66 - k, k, 90, 'stone_brick_stairs', { f: 'w' }); solid(b, 66 - k, -1, 90, 66 - k, k - 1, 90, MOSSY);
    }
    for (const [x1, z1, x2, z2] of [[9, 3, 82, 4], [3, 9, 4, 86], [87, 9, 88, 86], [9, 91, 36, 92], [56, 91, 82, 92]]) overgrow(b, x1, z1, x2, z2, 9, 18);
  }

  // ======================= ДВОР =======================
  function yard(b) {
    // Мощёная дорога от ворот к донжону и к часовне
    b.surface(44, 44, 48, 99, YARD);
    b.surface(49, 58, 54, 60, YARD); b.surface(35, 54, 43, 56, YARD, 0.8);
    b.surface(36, 70, 56, 84, YARD, 0.7);
    for (const z of [50, 62, 74, 86]) { solid(b, 43, 0, z, 43, 1, z, 'stone_brick_wall'); b.set(43, 2, z, 'lantern'); solid(b, 49, 0, z, 49, 1, z, 'stone_brick_wall'); b.set(49, 2, z, 'lantern'); }
    // Колодец на площади
    ring(b, 50, 0, 76, 52, 0, 78, 'mossy_cobblestone'); b.set(51, 0, 77, 'air'); b.set(51, -1, 77, 'water');
    solid(b, 50, 1, 77, 50, 2, 77, 'spruce_fence'); solid(b, 52, 1, 77, 52, 2, 77, 'spruce_fence');
    pyramid(b, 49, 76, 53, 78, 3); b.set(51, 2, 77, 'iron_chain');
    b.mark('room', 51, 0, 77, 'Колодец', 'Колодец на площади у ворот, под шатровой крышей.');

    // Казарма: два этажа
    house(b, 10, 50, 34, 60, 9, { axis: 'x', mid: 4 });
    b.door(34, 0, 55, 'e', 'dark_oak_door'); solid(b, 35, -1, 54, 36, -1, 56, PAVE);
    for (let x = 13; x <= 31; x += 4) { win(b, x, 1, 50); win(b, x, 1, 60); win(b, x, 6, 50); win(b, x, 6, 60); }
    for (let x = 12; x <= 30; x += 3) { b.bed(x, 0, 51, 0, 1, 'brown_bed'); b.bed(x, 5, 51, 0, 1, 'brown_bed'); }
    for (let x = 14; x <= 26; x += 6) { b.fill(x, 0, 57, x + 2, 0, 57, 'spruce_slab', { h: 'top' }); b.set(x, 0, 58, 'spruce_stairs', { f: 's' }); }
    b.fill(11, 0, 59, 11, 4, 59, 'ladder', { f: 'w' });
    for (const x of [12, 32]) { b.set(x, 0, 59, 'barrel'); }
    solid(b, 30, 10, 55, 30, 18, 55, STONE); b.set(30, 19, 55, 'cobblestone_slab');
    lamp(b, 35, 4, 53); lamp(b, 35, 4, 57); for (const x of [16, 28]) { lamp(b, x, 4, 49); lamp(b, x, 4, 61); }
    overgrow(b, 10, 50, 34, 60, 9, 14);
    b.mark('room', 22, 0, 55, 'Казарма', 'Два этажа коек для гарнизона, столы, бочки. Лестница на второй этаж у дальней стены.');

    // Кузница: открытый навес с горном
    house(b, 10, 66, 20, 76, 5, { axis: 'x', open: 'se', floor: [['coarse_dirt', 2], ['gravel', 1]] });
    solid(b, 11, 0, 67, 13, 1, 68, STONE); b.set(12, 1, 68, 'campfire'); solid(b, 11, 2, 67, 13, 12, 68, STONE); b.set(12, 13, 67, 'campfire');
    b.set(14, 0, 67, 'blast_furnace', { f: 's' }); b.set(15, 0, 67, 'furnace', { f: 's' });
    b.set(15, 0, 71, 'anvil', { f: 'e' }); b.set(17, 0, 71, 'grindstone'); b.set(11, 0, 72, 'cauldron'); b.set(11, 0, 74, 'smithing_table');
    b.set(11, 0, 75, 'barrel'); b.set(14, 0, 75, 'chest', { f: 'n' });
    lamp(b, 21, 4, 70); overgrow(b, 10, 66, 20, 76, 5, 6);
    b.mark('room', 15, 0, 71, 'Кузница', 'Навес с горном и трубой, плавильня, наковальня, точило, котёл для закалки.');

    // Конюшня: стойла вдоль западной стены, открыта к дороге
    house(b, 26, 66, 38, 80, 4, { axis: 'z', open: 'e', floor: [['coarse_dirt', 2], ['podzol', 1]] });
    for (const z of [69, 72, 75, 78]) b.fill(27, 0, z, 31, 0, z, 'spruce_fence');
    for (const z of [67, 70, 73, 76, 79]) { b.set(27, 0, z, 'hay_block'); b.set(31, 0, z, 'spruce_fence_gate', { f: 'e' }); }
    for (const z of [68, 71, 74, 77]) b.set(27, 0, z, 'composter');
    b.fill(31, 0, 67, 31, 0, 68, 'spruce_fence'); b.fill(31, 0, 70, 31, 0, 71, 'spruce_fence'); b.fill(31, 0, 73, 31, 0, 74, 'spruce_fence'); b.fill(31, 0, 76, 31, 0, 77, 'spruce_fence'); b.set(31, 0, 80 - 1, 'spruce_fence');
    b.set(36, 0, 68, 'hay_block'); b.set(36, 1, 68, 'hay_block'); b.set(37, 0, 69, 'hay_block'); b.set(36, 0, 79, 'barrel');
    lamp(b, 39, 3, 72); lamp(b, 39, 3, 76); overgrow(b, 26, 66, 38, 80, 4, 8);
    b.mark('room', 32, 0, 73, 'Конюшня', 'Пять стойл с кормушками и сеном. Сторона к дороге открыта.');

    // Амбар
    house(b, 8, 12, 22, 24, 6, { axis: 'x' });
    b.door(15, 0, 24, 's', 'spruce_door'); b.door(16, 0, 24, 's', 'spruce_door');
    for (let x = 9; x <= 21; x++) for (const z of [13, 23]) if (x % 3) { b.set(x, 0, z, 'barrel'); if (x % 2) b.set(x, 1, z, 'hay_block'); }
    b.fill(18, 0, 16, 21, 2, 19, 'hay_block'); b.set(10, 0, 18, 'chest', { f: 'e' });
    for (const x of [11, 19]) { win(b, x, 2, 12); win(b, x, 2, 24); }
    lamp(b, 14, 4, 25); lamp(b, 17, 4, 25); overgrow(b, 8, 12, 22, 24, 6, 10);
    b.mark('room', 15, 0, 18, 'Амбар', 'Склад зерна и сена, бочки вдоль стен.');

    // Огород с ульями
    b.walls(8, 0, 28, 26, 0, 42, 'spruce_fence'); b.set(17, 0, 28, 'spruce_fence_gate', { f: 'n' });
    for (const [z, c] of [[30, 'potatoes'], [31, 'carrots'], [33, 'beetroot'], [34, 'potatoes'], [36, 'carrots'], [37, 'beetroot']]) b.crops(10, z, 24, z, c);
    b.surface(10, 32, 24, 32, 'water'); b.surface(10, 35, 24, 35, 'water');
    b.set(17, 0, 39, 'spruce_fence'); b.set(17, 1, 39, 'hay_block'); b.set(17, 2, 39, 'carved_pumpkin', { f: 's' });
    for (const x of [10, 12, 14]) b.set(x, 0, 41, 'beehive', { f: 'n' });
    for (const x of [20, 21, 22, 23]) b.set(x, 0, 40, ['allium', 'cornflower', 'dandelion', 'lily_of_the_valley', 'poppy']);
    b.mark('room', 17, 0, 35, 'Огород', 'Грядки с канавками, пугало, ульи, цветник.');

    // Дом управителя с балконом
    house(b, 68, 12, 82, 24, 9, { axis: 'z', mid: 4 });
    b.door(75, 0, 24, 's', 'dark_oak_door');
    b.fill(72, 4, 25, 78, 4, 26, 'spruce_slab', { h: 'top' }); for (let x = 72; x <= 78; x++) b.set(x, 5, 26, 'spruce_fence'); b.set(72, 5, 25, 'spruce_fence'); b.set(78, 5, 25, 'spruce_fence');
    for (const x of [72, 78]) b.fill(x, 0, 26, x, 3, 26, 'stripped_spruce_log');
    b.door(75, 5, 24, 's', 'spruce_door');
    for (const x of [71, 79]) { win(b, x, 1, 24); win(b, x, 6, 24); win(b, x, 1, 12); win(b, x, 6, 12); }
    for (const z of [14, 18, 22]) { win(b, 68, 1, z); win(b, 82, 1, z); win(b, 68, 6, z); win(b, 82, 6, z); }
    b.fill(70, 0, 14, 72, 0, 14, 'bookshelf'); b.fill(74, 0, 17, 77, 0, 18, 'spruce_slab', { h: 'top' }); b.set(80, 0, 14, 'chest', { f: 's' });
    b.bed(70, 5, 15, 0, -1, 'red_bed'); b.set(80, 5, 14, 'barrel'); b.set(80, 5, 22, 'lectern', { f: 'n' });
    b.fill(81, 0, 22, 81, 4, 22, 'ladder', { f: 'e' });
    for (const z of [11, 25]) lamp(b, 70, 4, z); lamp(b, 80, 4, 25);
    overgrow(b, 68, 12, 82, 24, 9, 12);
    b.mark('room', 75, 0, 18, 'Дом управителя', 'Двухэтажный дом с балконом над входом. Внизу контора и книги, наверху спальня.');

    // Ристалище
    b.walls(66, 0, 30, 84, 0, 42, 'spruce_fence'); b.set(66, 0, 36, 'spruce_fence_gate', { f: 'w' });
    b.surface(67, 31, 83, 41, [['coarse_dirt', 2], ['gravel', 1], ['grass_path', 1]]);
    for (const z of [32, 36, 40]) { b.set(83, 0, z, 'hay_block'); b.set(83, 1, z, 'target'); }
    for (const x of [70, 74]) { b.set(x, 0, 38, 'spruce_fence'); b.set(x, 1, 38, 'hay_block'); b.set(x, 2, 38, 'carved_pumpkin', { f: 'w' }); }
    b.set(68, 0, 31, 'barrel'); b.set(68, 0, 32, 'grindstone');
    b.mark('room', 75, 0, 36, 'Ристалище', 'Двор для учений: мишени на снопах, соломенные чучела, точило.');

    // Кладбище у часовни
    b.walls(60, 0, 70, 84, 0, 84, 'mossy_cobblestone_wall'); b.set(60, 0, 77, 'air');
    for (let x = 63; x <= 81; x += 3) for (let z = 73; z <= 81; z += 4) {
      b.surface(x, z, x, z + 1, 'coarse_dirt');
      if ((x + z) % 2) { b.fill(x, 0, z, x, 1, z, 'spruce_fence'); b.set(x, 1, z - 1, 'spruce_fence'); b.set(x, 1, z + 1, 'spruce_fence'); b.set(x, 1, z, 'spruce_fence'); }
      else b.set(x, 0, z, 'mossy_stone_brick_wall');
      if (b.chance(0.4)) b.set(x + 1, 0, z + 1, ['poppy', 'candle', 'lily_of_the_valley']);
    }
    b.mark('room', 72, 0, 77, 'Кладбище', 'Низкая каменная ограда, кресты и надгробия рядами.');

    // Задний двор за донжоном: сад
    for (const [x, z] of [[20, 6], [28, 8], [64, 7], [74, 6]]) b.spruce(x, z, 9, 0, false, true);
  }

  defineStructure({
    id: 'castle',
    group: 'Замок',
    name: 'Замок из замшелого камня',
    rarity: 'редкая',
    set: 'castle',
    weight: 1,
    biomes: 'пока эскиз',
    desc: 'Квадратный донжон с четырьмя угловыми башнями и средней башней, под ним катакомбы. Вокруг двор за крепостной стеной: часовня с колокольней, казарма, кузница, конюшня, амбар, дом управителя, огород, ристалище, кладбище. Слои: «Срез по высоте» показывает этажи, а снятая галочка «Грунт и деревья» открывает подземелье.',
    territory: [
      'Стена 92×96 блоков высотой 10, четыре угловые башни с шатровыми крышами',
      'Ворота на юге между двух надвратных башен, решётка, переход над аркой',
      'Донжон 31×31 у северной стены, высота до верха башен 31',
      'Катакомбы на 10–15 блоков под землёй, ход под двором к склепу часовни',
      'Потайной лаз из подземелья под стеной наружу',
    ],
    build() {
      const b = new Builder(2025);
      b.ground(-6, -6, 97, 104);
      b.surface(-6, -6, 97, 104, [['grass_block', 6], ['podzol', 2], ['coarse_dirt', 1], ['moss_block', 2]]);
      const KX = 34, KZ = 16;
      keep(b, KX, KZ);
      catacombs(b, KX, KZ);
      chapel(b);
      curtain(b);
      yard(b);
      overgrow(b, KX - 3, KZ - 3, KX + 27, KZ + 27, 26, 40);
      overgrow(b, KX, KZ, KX + 24, KZ + 24, 20, 50);
      // Порог у входа в донжон и крыльцо
      const w = at(b, KX, KZ);
      solid(w, 9, -1, 25, 15, -1, 28, PAVE);
      for (const i of [10, 14]) solid(w, i, 0, 28, i, 4, 28, FRAME);
      roof(b, KX + 10, KZ + 26, KX + 14, KZ + 28, 5, 'z');
      w.fill(12, 5, 27, 12, 7, 27, 'iron_chain'); w.set(12, 4, 27, 'lantern', { hang: 1 });
      w.set(9, 3, 25, 'red_banner', { f: 'n' }); w.set(15, 3, 25, 'red_banner', { f: 'n' });
      // Ельник вокруг стен (только для превью)
      for (let k = 0; k < 40; k++) {
        const side = k % 4, t = b.r();
        const x = side < 2 ? Math.round(-4 + t * 99) : side === 2 ? -4 - Math.round(b.r()) : 95 + Math.round(b.r());
        const z = side >= 2 ? Math.round(-4 + t * 106) : side === 0 ? -4 - Math.round(b.r()) : 101 + Math.round(b.r());
        if (x > 40 && x < 52 && z > 95) continue;
        b.spruce(x, z, 8 + Math.floor(b.r() * 5));
      }
      return b;
    },
  });
})();
