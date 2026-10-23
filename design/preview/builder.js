// Конструктор построек. Постройка описывается вызовами вроде fill/walls/gable,
// а не списком блоков: так её легко править, и её же потом можно экспортировать
// в .mcstructure. Оси как в игре: x — восток, y — вверх, z — юг.
// Поверхность земли — y = -1, первый ярус постройки — y = 0.
(function () {
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TAIGA_TOP = [['grass_block', 5], ['podzol', 3], ['coarse_dirt', 1], ['moss_block', 1]];

  class Builder {
    constructor(seed = 1) {
      this.blocks = new Map();
      this.marks = [];
      this.anchors = {};
      this.r = rng(seed);
    }
    k(x, y, z) { return x + ',' + y + ',' + z; }
    chance(p) { return this.r() < p; }
    // id: строка, массив строк (равные шансы) или массив [id, вес].
    pick(id) {
      if (!Array.isArray(id)) return id;
      if (!Array.isArray(id[0])) return id[Math.floor(this.r() * id.length)];
      const total = id.reduce((s, [, w]) => s + w, 0);
      let v = this.r() * total;
      for (const [b, w] of id) if ((v -= w) < 0) return b;
      return id[0][0];
    }
    set(x, y, z, id, p) {
      const b = this.pick(id);
      // carve: под землёй вырезанная пустота запоминается как явный воздух,
      // иначе в игре грунт останется внутри подземных залов.
      if ((!b || b === 'air') && this.carve && y <= -1) this.blocks.set(this.k(x, y, z), { x, y, z, id: 'air' });
      else if (!b || b === 'air') this.blocks.delete(this.k(x, y, z));
      else this.blocks.set(this.k(x, y, z), { x, y, z, id: b, ...p });
      return this;
    }
    get(x, y, z) { return this.blocks.get(this.k(x, y, z)); }
    each(x1, y1, z1, x2, y2, z2, fn) {
      const [ax, bx] = x1 < x2 ? [x1, x2] : [x2, x1];
      const [ay, by] = y1 < y2 ? [y1, y2] : [y2, y1];
      const [az, bz] = z1 < z2 ? [z1, z2] : [z2, z1];
      for (let x = ax; x <= bx; x++)
        for (let y = ay; y <= by; y++)
          for (let z = az; z <= bz; z++) fn(x, y, z, ax, bx, az, bz);
      return this;
    }
    fill(x1, y1, z1, x2, y2, z2, id, p) {
      return this.each(x1, y1, z1, x2, y2, z2, (x, y, z) => this.set(x, y, z, id, p));
    }
    clear(x1, y1, z1, x2, y2, z2) { return this.fill(x1, y1, z1, x2, y2, z2, 'air'); }
    // Только периметр (стены коробки без пола и потолка).
    walls(x1, y1, z1, x2, y2, z2, id, p) {
      return this.each(x1, y1, z1, x2, y2, z2, (x, y, z, ax, bx, az, bz) => {
        if (x === ax || x === bx || z === az || z === bz) this.set(x, y, z, id, p);
      });
    }
    // Сруб: горизонтальные брёвна вдоль стен, обтёсанные столбы по углам.
    logRing(x1, y1, z1, x2, y2, z2, id = 'spruce_log', corner = 'stripped_spruce_log') {
      return this.each(x1, y1, z1, x2, y2, z2, (x, y, z, ax, bx, az, bz) => {
        const ex = x === ax || x === bx, ez = z === az || z === bz;
        if (!ex && !ez) return;
        if (ex && ez) this.set(x, y, z, corner);
        else this.set(x, y, z, id, { a: ez ? 'x' : 'z' });
      });
    }
    // Грядки: пашня в верхнем слое земли и посадки над ней.
    crops(x1, z1, x2, z2, crop) {
      this.surface(x1, z1, x2, z2, 'farmland');
      return this.fill(x1, 0, z1, x2, 0, z2, crop);
    }
    // Вертикальные бревна по углам прямоугольника.
    corners(x1, y1, z1, x2, y2, z2, id) {
      for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) this.fill(x, y1, z, x, y2, z, id);
      return this;
    }
    // Верхний слой земли (y = -1) — нижний слой шаблона. В мире он ляжет
    // вровень с рельефом, а игра подсыплет землю под ним (beard_thin).
    ground(x1, z1, x2, z2, top = TAIGA_TOP) {
      for (let x = x1; x <= x2; x++)
        for (let z = z1; z <= z2; z++) this.set(x, -1, z, top, { g: 1 });
      this.area = [x1, z1, x2, z2];
      return this;
    }
    // Заменить верхний слой (тропы, гарь, отмостка).
    surface(x1, z1, x2, z2, id, p = 1) {
      return this.each(x1, -1, z1, x2, -1, z2, (x, y, z) => {
        if (this.chance(p)) this.set(x, y, z, id, { g: 1 });
      });
    }
    // Растения на открытой земле. keep — посадки, которые входят в шаблон;
    // без keep это только оформление превью (в мире растительность своя).
    scatter(x1, z1, x2, z2, id, p, keep = false) {
      return this.each(x1, 0, z1, x2, 0, z2, (x, y, z) => {
        const below = this.get(x, -1, z);
        if (!this.get(x, 0, z) && below && below.g && /grass|podzol|moss/.test(below.id) && this.chance(p))
          this.set(x, 0, z, id, keep ? {} : { env: 1 });
      });
    }
    // Ель: ствол и хвоя ярусами. dead — сухое дерево без хвои.
    // keep — дерево входит в шаблон (хвоя ставится неопадающей).
    spruce(x, z, h = 10, y = 0, dead = false, keep = false) {
      const p = keep ? {} : { env: 1 };
      this.fill(x, y, z, x, y + h - 1, z, 'spruce_log', p);
      if (dead) return this;
      for (let i = 2; i <= h; i++) {
        const fromTop = h - i;
        const rad = fromTop < 1 ? 0 : fromTop % 2 === 0 ? Math.min(3, 1 + (fromTop >> 2)) : Math.min(2, (fromTop + 1) >> 2);
        for (let dx = -rad; dx <= rad; dx++)
          for (let dz = -rad; dz <= rad; dz++) {
            if (dx === 0 && dz === 0 && i < h) continue;
            if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
            if (!this.get(x + dx, y + i, z + dz)) this.set(x + dx, y + i, z + dz, 'spruce_leaves', p);
          }
      }
      this.set(x, y + h, z, 'spruce_leaves', p);
      return this;
    }
    // Двускатная крыша. axis — вдоль какой оси идёт конёк.
    // Ступени смотрят высокой стороной к коньку (f — сторона высокой части).
    gable(x1, z1, x2, z2, y, o = {}) {
      const { axis = 'x', stair = 'spruce_stairs', slab = 'spruce_slab', fill = 'spruce_planks', over = 1 } = o;
      const X = axis === 'x';
      const [l1, l2, w1, w2] = X ? [x1, x2, z1, z2] : [z1, z2, x1, x2];
      const put = (l, w, yy, id, p) => (X ? this.set(l, yy, w, id, p) : this.set(w, yy, l, id, p));
      for (let i = 0; ; i++) {
        const a = w1 - over + i, b = w2 + over - i, yy = y + i;
        if (a > b) break;
        for (let l = l1 - over; l <= l2 + over; l++) {
          if (a === b) put(l, a, yy, slab);
          else {
            put(l, a, yy, stair, { f: X ? 's' : 'e' });
            put(l, b, yy, stair, { f: X ? 'n' : 'w' });
          }
        }
        if (fill) for (let w = Math.max(a + 1, w1); w <= Math.min(b - 1, w2); w++) {
          put(l1, w, yy, fill);
          put(l2, w, yy, fill);
        }
        if (a === b) break;
      }
      return this;
    }
    door(x, y, z, f, id = 'spruce_door', open = false) {
      this.set(x, y, z, id, { f, open });
      return this.set(x, y + 1, z, id, { f, open, top: 1 });
    }
    // Кровать: (x, z) — изножье, (x + dx, z + dz) — изголовье.
    bed(x, y, z, dx, dz, id = 'red_bed') {
      const f = dx > 0 ? 'e' : dx < 0 ? 'w' : dz > 0 ? 's' : 'n';
      this.set(x, y, z, id, { f });
      return this.set(x + dx, y, z + dz, id, { f, head: 1 });
    }
    // Ветхость: с вероятностью p заменяет блоки по правилам {id: новый | null}.
    decay(rules, p, area) {
      for (const b of [...this.blocks.values()]) {
        if (b.env || !(b.id in rules)) continue;
        if (area && (b.x < area[0] || b.y < area[1] || b.z < area[2] || b.x > area[3] || b.y > area[4] || b.z > area[5])) continue;
        if (this.chance(p)) this.set(b.x, b.y, b.z, rules[b.id], rules[b.id] ? { f: b.f, h: b.h, a: b.a, g: b.g } : undefined);
      }
      return this;
    }
    // Точка выхода тропы к дальнему тайнику: jigsaw-блок на краю двора.
    // История выбирает, какой якорь включить; остальные остаются тропинкой.
    anchor(name, x, z, f) {
      this.anchors[name] = { x, y: -1, z, f };
      return this.set(x, -1, z, 'grass_path', { g: 1, anchor: name, f });
    }
    // Метки для просмотрщика и будущей системы историй:
    // slot — место, где может появиться тайник; clue — место для записки/подсказки;
    // secret — механика: фальш-стена, люк, рычаг.
    mark(type, x, y, z, title, desc) {
      this.marks.push({ type, x, y, z, title, desc });
      return this;
    }
  }

  window.Builder = Builder;
  window.TAIGA_TOP = TAIGA_TOP;
  window.STRUCTURES = [];
  window.defineStructure = (s) => window.STRUCTURES.push(s);
})();
