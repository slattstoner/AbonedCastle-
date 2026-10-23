// Скины жителей замка и шайки Рыжего: рисуются кодом в формате скина игрока 64×64
// (основной слой + верхний: волосы объёмом, шлемы, шапки, кафтаны, плащи, подолы).
// Свет падает сверху и спереди: у каждой грани своя яркость, низ темнее верха,
// внутренние стороны рук и ног в тени. Цвета берутся из «лестницы» оттенков
// (светлее — теплее, темнее — холоднее), как в пиксельной графике.
// node tools/skins.js → design/skins/*.png и design/skins/lineup.html (просмотр).
// Сборщик берёт отсюда скины тех жителей, что уже есть в игре.
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- PNG ----------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function png(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- Цвета ----------
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
// Оттенок t: 0 — сам цвет, +1 светлее (теплее), −1 темнее (холоднее). Шаг — половина ступени.
function tone(c, t) {
  t = Math.round(t * 2) / 2;
  const [r, g, b] = hex(c);
  if (t >= 0) return mix(toHex(r * (1 + 0.15 * t), g * (1 + 0.15 * t), b * (1 + 0.15 * t)), '#fff0d0', Math.min(0.5, 0.07 * t));
  return mix(toHex(r * (1 + 0.19 * t), g * (1 + 0.19 * t), b * (1 + 0.19 * t)), '#18203a', Math.min(0.5, -0.07 * t));
}

// ---------- Развёртки частей тела (как у скина игрока) ----------
// u, v — левый верхний угол развёртки; w — ширина, h — высота, d — глубина.
const PARTS = {
  head: [0, 0, 8, 8, 8], hat: [32, 0, 8, 8, 8],
  body: [16, 16, 8, 12, 4], jacket: [16, 32, 8, 12, 4],
  rArm: [40, 16, 4, 12, 4], rSleeve: [40, 32, 4, 12, 4],
  lArm: [32, 48, 4, 12, 4], lSleeve: [48, 48, 4, 12, 4],
  rLeg: [0, 16, 4, 12, 4], rPants: [0, 32, 4, 12, 4],
  lLeg: [16, 48, 4, 12, 4], lPants: [0, 48, 4, 12, 4],
};
const OVER = { head: 'hat', body: 'jacket', rArm: 'rSleeve', lArm: 'lSleeve', rLeg: 'rPants', lLeg: 'lPants' };
function faces(part) {
  const [u, v, w, h, d] = PARTS[part];
  return {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  };
}
// Свет по граням и по высоте части; внутренние стороны рук и ног в тени
const FACE_LIGHT = { top: 0.6, front: 0, right: -0.4, left: -0.4, back: -0.6, bottom: -1.2 };
const GRAD = { head: [0.1, -0.2], body: [0.3, -0.4], rArm: [0.3, -0.3], lArm: [0.3, -0.3], rLeg: [0, -0.5], lLeg: [0, -0.5] };
const INNER = { rArm: 'left', lArm: 'right', rLeg: 'left', lLeg: 'right' };
const basePart = (p) => Object.keys(OVER).find((k) => k === p || OVER[k] === p);

// Холст скина. Пустая клетка — прозрачная (бывает только на верхнем слое).
function Skin(seed) {
  const px = new Array(64 * 64).fill(null);
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const K = {
    rnd, px,
    get: (x, y) => px[y * 64 + x],
    // Покрасить часть. fn(x, y, side, w, h, u) → краска или undefined (не трогать), null (стереть).
    // Краска — строка цвета или { c, t (оттенок), n (шум), flat (без света) }.
    // u — номер столбца по кругу: правый бок → перёд → левый бок → спина.
    paint(part, fn, sides = ['right', 'front', 'left', 'back', 'top', 'bottom']) {
      const bp = basePart(part), over = part !== bp;
      const [, , W, , D] = PARTS[part];
      const off = { right: 0, front: D, left: D + W, back: 2 * D + W, top: 0, bottom: 0 };
      for (const side of sides) {
        const [x0, y0, w, h] = faces(part)[side];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const r = fn(x, y, side, w, h, off[side] + x);
          if (r === undefined) continue;
          if (r === null) { px[(y0 + y) * 64 + x0 + x] = null; continue; }
          const p = typeof r === 'string' ? { c: r } : r;
          let t = p.t || 0;
          if (!p.flat) {
            t += FACE_LIGHT[side];
            if (side !== 'top' && side !== 'bottom') { const [a, b] = GRAD[bp]; t += a + (b - a) * (y / (h - 1)); }
            if (INNER[bp] === side) t -= 0.35;
            if (over) t += 0.15;
          }
          if (p.n) t += (rnd() * 2 - 1) * p.n;
          px[(y0 + y) * 64 + x0 + x] = p.flat && !p.n && !p.t ? p.c : tone(p.c, t);
        }
      }
    },
    side(part, side, fn) { K.paint(part, fn, [side]); },
    png() {
      const buf = Buffer.alloc(64 * 64 * 4);
      px.forEach((c, i) => { if (c) { const [r, g, b] = hex(c); buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255; } });
      return png(64, 64, buf);
    },
  };
  return K;
}

// ---------- Материалы ----------
const M = {
  cloth: (c, n = 0.25) => ({ c, n }),
  // Ткань со складками: продольные тени через несколько столбцов
  folds: (c, u, every = 3, n = 0.2) => ({ c, t: u % every === 0 ? -0.5 : 0, n }),
  // Кольчуга: колечки рядами со сдвигом
  mail: (x, y) => ({ c: '#8f959c', t: (x + (y % 2)) % 2 ? 0.5 : -0.6, n: 0.15 }),
  fur: (c) => ({ c, n: 0.9 }),
  leather: (c, y, x) => ({ c, t: (x + y * 3) % 7 === 0 ? -0.5 : 0, n: 0.2 }),
  metal: (c, y) => ({ c, t: y === 0 ? 0.8 : 0, n: 0.1 }),
  // Волосы прядями: светлая прядь, тень между прядями
  hair: (c, x, y) => ({ c, t: (x * 3 + y) % 5 === 0 ? 0.7 : (x % 2 ? 0 : -0.45), n: 0.15 }),
};

// ---------- Человек ----------
// o.skin, o.hair, o.hairStyle: short | parted | long | bald | bowl | curly | shaggy | slick | tonsure
// o.beard: stubble | mustache | droop (длинные усы) | goatee | short | full | long; o.beardColor
// o.eyes, o.brows, o.age (морщины), o.freckles, o.blush, o.soot, o.scar ('cheek' | 'brow'), o.patch (повязка на глазу)
function person(o, seed) {
  const K = Skin(seed);
  const skin = o.skin, hair = o.hair || '#4a3020', bc = o.beardColor || hair, hs = o.hairStyle || 'short';
  const S = (t = 0, n = 0.08) => ({ c: skin, t, n });
  const H = (x, y) => M.hair(hair, x, y);
  // --- Голова: кожа, уши, тень под подбородком
  K.paint('head', (x, y, side) => {
    if (side === 'top') return S(0.2);
    if (side === 'bottom') return S(-0.6);
    if ((side === 'right' || side === 'left') && (x === 3 || x === 4) && (y === 4 || y === 5)) return S(-0.6); // ухо
    if (side === 'front' && y === 7) return S(-0.3);
    return S();
  });
  // --- Волосы
  const hairSide = (x, y, side) => {
    const nearBack = side === 'right' ? x < 4 : x > 3;
    const edge = side === 'right' ? 7 - x : x; // 0 — у лица
    switch (hs) {
      case 'bald': case 'tonsure': return y >= 2 && y <= 4 && nearBack;
      case 'long': return y < 8 && !(edge === 0 && y >= 3 && y <= 6) && !((edge === 1 || edge === 2) && (y === 4 || y === 5));
      case 'slick': return y < 3 || (nearBack && y < 4);
      default: return y < 3 || (nearBack && y < (hs === 'shaggy' || hs === 'curly' ? 6 : 5)) || (edge > 0 && y < 4 && hs !== 'bowl');
    }
  };
  const hairFront = (x, y) => {
    switch (hs) {
      case 'bald': return false;
      case 'tonsure': return false;
      case 'bowl': return y < 3;
      case 'parted': return y === 0 || (y === 1 && x !== 4 && x !== 3) || (y === 2 && (x <= 1 || x >= 6));
      case 'long': return y < 2 || ((x === 0 || x === 7) && y < 7) || (y === 2 && (x <= 1 || x >= 6));
      case 'curly': return y < 2 || (y === 2 && x % 3 !== 1);
      case 'shaggy': return y < 2 || (y === 2 && [0, 1, 3, 6, 7].includes(x)) || (y === 3 && (x === 0 || x === 7));
      case 'slick': return y < 1 || (y === 1 && x !== 5 && x !== 6);
      default: return y < 2 || (y === 2 && (x === 0 || x === 7 || x === 5));
    }
  };
  K.paint('head', (x, y, side) => {
    if (side === 'top') return hs === 'bald' ? (x > 1 && x < 6 && y > 1 ? S(0.4 + (x === 3 && y === 3 ? 0.8 : 0)) : H(x, y)) : hs === 'tonsure' && x > 2 && x < 5 && y > 2 && y < 5 ? S(0.4) : H(x, y);
    if (side === 'bottom') return undefined;
    if (side === 'back') return hs === 'bald' || hs === 'tonsure' ? (y >= 2 && y <= 4 ? H(x, y) : undefined) : y < (hs === 'long' ? 8 : 6) ? H(x, y) : undefined;
    if (side === 'front') return hairFront(x, y) ? H(x, y) : undefined;
    return hairSide(x, y, side) ? H(x, y) : undefined;
  });
  // объём волос на верхнем слое
  if (['curly', 'shaggy', 'long'].includes(hs)) K.paint('hat', (x, y, side) => {
    if (side === 'top') return K.rnd() < 0.45 ? H(x, y) : undefined;
    if (side === 'front') return y === 0 && K.rnd() < 0.6 ? H(x, y) : hs === 'shaggy' && y === 1 && x % 3 === 0 ? H(x, y) : undefined;
    if (side === 'bottom') return undefined;
    if (side === 'back') return y < (hs === 'long' ? 8 : 5) && K.rnd() < 0.5 ? H(x, y) : undefined;
    return y < 3 && K.rnd() < 0.4 ? H(x, y) : undefined;
  });
  // --- Лицо
  const eye = o.eyes || '#3b5a8a', brow = o.brows || (hs === 'bald' || hs === 'tonsure' ? bc : hair);
  K.side('head', 'front', (x, y) => {
    if (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) return { c: brow, t: -0.5 };
    if (y === 4) {
      if (o.patch && x >= 5 && x <= 6) return { c: '#1e1a18', t: 0 };
      if (x === 1 || x === 6) return { c: '#ece8e0', flat: 1 };
      if (x === 2 || x === 5) return { c: eye, t: -0.3 };
    }
    if (y === 5 && x === 4) return S(-0.7); // тень от носа
    if (y === 5 && x === 3) return S(0.2);
    if (y === 6 && (x === 3 || x === 4)) return o.mouth ? { c: o.mouth } : { c: mix(skin, '#9a3a3a', 0.45), t: -0.2 };
    if (y === 5 && (x === 2 || x === 5) && o.age) return S(-0.45);
    if (y === 6 && (x === 1 || x === 6) && o.age) return S(-0.35);
    if (y === 5 && (x === 1 || x === 6) && o.blush) return { c: mix(skin, '#d86a6a', 0.4) };
    if (o.freckles && ((y === 5 && (x === 1 || x === 6)) || (y === 5 && (x === 2 || x === 5) && o.freckles > 1))) return S(-0.8);
    return undefined;
  }, ['front']);
  if (o.patch) { // ремешок повязки
    K.paint('head', (x, y, side) => (side === 'front' ? (y === 3 && x >= 4 ? { c: '#2a2220' } : undefined) : side === 'left' || side === 'right' || side === 'back' ? (y === 3 ? { c: '#2a2220' } : undefined) : undefined), ['front', 'left', 'right', 'back']);
  }
  if (o.scar === 'cheek') K.side('head', 'front', (x, y) => ((x === 6 && y === 5) || (x === 7 && y === 6) || (x === 6 && y === 6) ? { c: mix(skin, '#ffffff', 0.25), t: -0.2 } : undefined));
  if (o.scar === 'brow') K.side('head', 'front', (x, y) => ((x === 5 && y === 2) || (x === 5 && y === 3) || (x === 4 && y === 5) ? { c: mix(skin, '#e8c0b0', 0.4) } : undefined));
  // --- Борода
  const B = (x, y, t = 0) => ({ ...M.hair(bc, x, y + 1), t: (M.hair(bc, x, y + 1).t || 0) + t });
  const beard = o.beard;
  if (beard) {
    K.paint('head', (x, y, side) => {
      if (side === 'front') {
        switch (beard) {
          case 'stubble': return y >= 6 && x !== 3 && x !== 4 && (x + y) % 2 === 0 ? S(-0.9) : y === 7 && (x === 3 || x === 4) ? S(-0.8) : undefined;
          case 'mustache': return (y === 6 && x >= 2 && x <= 5 && !(x === 3 || x === 4)) || (y === 5 && x >= 2 && x <= 5 && x !== 3 && x !== 4) ? B(x, y) : undefined;
          case 'droop': return (y === 5 && (x === 2 || x === 5)) || (y === 6 && (x === 2 || x === 5 || x === 1 || x === 6)) || (y === 7 && (x === 1 || x === 6)) ? B(x, y) : undefined;
          case 'goatee': return (y === 5 && (x === 2 || x === 5)) || (y === 7 && x >= 2 && x <= 5) || (y === 6 && (x === 2 || x === 5)) ? B(x, y) : undefined;
          case 'short': return (y === 7 && !(x === 3 || x === 4) ) || (y === 7 && (x === 3 || x === 4)) ? B(x, y) : (y === 6 && (x <= 1 || x >= 6)) || (y === 5 && (x === 0 || x === 7)) || (y === 5 && (x === 2 || x === 5)) ? B(x, y) : undefined;
          default: // full, long
            if (y === 6 && (x === 3 || x === 4)) return { c: mix(skin, '#9a3a3a', 0.45), t: -0.4 };
            return (y >= 6) || (y === 5 && x !== 3 && x !== 4) ? B(x, y, y === 7 && (x === 3 || x === 4) ? -0.3 : 0) : undefined;
        }
      }
      if ((side === 'right' || side === 'left') && !['stubble', 'mustache', 'droop', 'goatee'].includes(beard)) {
        const edge = side === 'right' ? 7 - x : x;
        return edge < 4 && y >= (beard === 'short' ? 5 : 4) + (edge === 3 ? 1 : 0) ? B(x, y) : undefined;
      }
      return undefined;
    }, ['front', 'right', 'left']);
    if (beard === 'full' || beard === 'long') K.paint('hat', (x, y, side) => {
      if (side === 'front') return y === 7 && (x <= 2 || x >= 5) ? B(x, y) : undefined;
      return undefined;
    }, ['front']);
    if (beard === 'long') K.side('jacket', 'front', (x, y) => {
      const w = [3, 3, 3, 2, 2, 1, 1][y];
      return w !== undefined && x >= 4 - w && x <= 3 + w ? B(x, y, y > 4 ? -0.2 : 0.1) : undefined;
    });
  }
  if (o.soot) K.side('head', 'front', (x, y) => ([[1, 6], [6, 5], [7, 6], [2, 2]].some(([a, b]) => a === x && b === y) ? S(-1.2) : undefined));
  return K;
}

// ---------- Одежда ----------
const RL = ['rLeg', 'lLeg'], RA = ['rArm', 'lArm'], RLP = ['rPants', 'lPants'], RAS = ['rSleeve', 'lSleeve'];
const W = {
  // Рубаха до бёдер; ворот косоворотки и вышивка по подолу и обшлагам
  shirt(K, c, { emb, sleeves = 'long', skin, len = 12, slit = true } = {}) {
    K.paint('body', (x, y, side, w, h, u) => {
      if (side === 'top') return M.cloth(c);
      if (side === 'bottom') return undefined;
      if (emb && y === len - 1) return { c: emb, t: u % 2 ? 0 : -0.5 };
      if (side === 'front' && slit && y < 3 && x === 2) return { c: emb || c, t: -0.6 };
      if (side === 'front' && y === 0 && (x === 3 || x === 4)) return { c: skin || c, t: -0.2 };
      return M.folds(c, u, 4);
    });
    for (const a of RA) K.paint(a, (x, y, side, w, h, u) => {
      if (side === 'bottom') return skin ? { c: skin, t: -0.4 } : undefined;
      if (side === 'top') return M.cloth(c);
      const end = sleeves === 'short' ? 4 : sleeves === 'rolled' ? 6 : 10;
      if (y < end) return emb && y === end - 1 && sleeves === 'long' ? { c: emb } : y === end - 1 && sleeves === 'rolled' ? { c, t: 0.4 } : M.folds(c, u, 5);
      if (skin) return { c: skin, n: 0.08, t: y === 11 ? -0.2 : 0 };
      return undefined;
    });
  },
  trousers(K, c) {
    for (const l of RL) K.paint(l, (x, y, side, w, h, u) => (side === 'bottom' ? undefined : M.folds(c, u, 4)));
  },
  // Сапоги с отворотом и складками
  boots(K, c, top = 6, { cuff, red } = {}) {
    for (const l of RL) K.paint(l, (x, y, side) => {
      if (side === 'top') return undefined;
      if (side === 'bottom') return { c, t: -1.4 };
      if (y < top) return undefined;
      if (y === 11) return { c, t: -1.2 };
      if (y === top && cuff) return { c: cuff, t: 0.3 };
      if (side === 'front' && y === 10) return { c, t: 0.6 }; // носок
      return { c, t: (y - top) % 2 ? -0.3 : 0.2, n: 0.15 };
    });
  },
  // Онучи с перекрёстными оборами и лапти
  lapti(K, { cloth = '#d8ccb0', bast = '#b89a5a' } = {}) {
    for (const l of RL) K.paint(l, (x, y, side, w, h, u) => {
      if (side === 'top') return undefined;
      if (side === 'bottom') return { c: bast, t: -0.8 };
      if (y < 6) return undefined;
      if (y >= 10) return { c: bast, t: (x + y) % 2 ? 0.3 : -0.4 };
      return (u + y) % 4 === 0 || (u - y + 16) % 4 === 0 ? { c: '#6a5030', t: -0.3 } : M.cloth(cloth, 0.15);
    });
  },
  belt(K, c, { y = 8, buckle, sash, part = 'body' } = {}) {
    K.paint(part, (x, yy, side, w, h, u) => {
      if (side === 'top' || side === 'bottom' || yy !== y) return undefined;
      if (buckle && side === 'front' && (x === 3 || x === 4)) return { c: buckle, t: x === 3 ? 0.6 : -0.2 };
      return { c, t: u % 2 ? 0 : -0.25 };
    });
    if (sash) K.side('jacket', 'front', (x, yy) => (x === 1 && yy > y && yy <= y + 3 ? { c: sash, t: yy === y + 3 ? -0.4 : 0 } : x === 2 && yy === y + 1 ? { c: sash, t: -0.3 } : undefined));
  },
  // Кафтан на верхнем слое: перёд с застёжкой, рукава, полы на ногах
  kaftan(K, c, { trim, len = 6, buttons, collar, open, sleeves = true, fur } = {}) {
    K.paint('jacket', (x, y, side, w, h, u) => {
      if (side === 'bottom') return undefined;
      if (side === 'top') return M.cloth(c);
      if (open && side === 'front' && x >= 3 && x <= 4) return undefined;
      if (side === 'front' && buttons && (x === 3 || x === 4) && y < 11) return x === 3 && y % 2 === 1 ? { c: buttons, t: 0.6 } : { c, t: -0.6 };
      if (trim && side === 'front' && (open ? x === 2 || x === 5 : x === 3)) return { c: trim, t: y % 3 ? 0 : 0.5 };
      if (trim && y === 11) return { c: trim, t: u % 2 ? 0 : -0.4 };
      if (collar && y === 0) return { c: collar, n: fur ? 0.9 : 0.2, t: 0.2 };
      return M.folds(c, u, 4);
    });
    if (sleeves) for (const a of RAS) K.paint(a, (x, y, side, w, h, u) => {
      if (side === 'bottom') return undefined;
      if (side === 'top') return M.cloth(c);
      if (y > 10) return undefined;
      if (y === 10 && trim) return { c: trim };
      if (y === 10 && fur) return M.fur(collar || c);
      return M.folds(c, u, 5);
    });
    if (len) for (const l of RLP) K.paint(l, (x, y, side, w, h, u) => {
      if (side === 'top' || side === 'bottom' || y >= len) return undefined;
      if (open && side === 'front' && ((l === 'rPants' && x === 3) || (l === 'lPants' && x === 0))) return { c, t: -0.6 };
      if (trim && y === len - 1) return { c: trim, t: u % 2 ? 0 : -0.4 };
      return M.folds(c, u, 3);
    });
  },
  // Безрукавка (кожаная, меховая)
  vest(K, c, { lace, fur, len = 10 } = {}) {
    K.paint('jacket', (x, y, side, w, h, u) => {
      if (side === 'bottom' || y >= len) return undefined;
      if (side === 'top') return fur ? M.fur(c) : M.cloth(c);
      if (side === 'front' && x >= 3 && x <= 4) return lace && y % 2 && y < len - 1 ? { c: lace, t: -0.2 } : undefined;
      return fur ? M.fur(c) : M.leather(c, y, u);
    });
  },
  // Длинный подол: сарафан, ряса, платье (верхний слой ног)
  skirt(K, c, { len = 12, hem } = {}) {
    for (const l of RLP) K.paint(l, (x, y, side, w, h, u) => {
      if (side === 'top' || side === 'bottom' || y >= len) return undefined;
      if (hem && y === len - 1) return { c: hem, t: u % 2 ? 0.2 : -0.3 };
      return M.folds(c, u, 3);
    });
  },
  apron(K, c, { top = 2, len = 7, hem, stains } = {}) {
    K.side('jacket', 'front', (x, y) => {
      if (y < top) return x === 1 || x === 6 ? { c, t: -0.3 } : undefined;
      if (x < 1 || x > 6) return y === 8 ? { c, t: -0.6 } : undefined;
      if (stains && K.rnd() < 0.035) return { c: stains, n: 0.2 };
      return M.cloth(c, 0.15);
    });
    K.paint('jacket', (x, y, side) => (y === 8 && (side === 'left' || side === 'right' || side === 'back') ? { c, t: -0.4 } : undefined), ['left', 'right', 'back']);
    for (const l of RLP) K.side(l, 'front', (x, y) => {
      if (y >= len || (l === 'rPants' && x === 0) || (l === 'lPants' && x === 3)) return undefined;
      if (hem && y === len - 1) return { c: hem };
      if (stains && K.rnd() < 0.035) return { c: stains, n: 0.2 };
      return { c, n: 0.15, t: y === len - 1 ? -0.4 : 0 };
    });
  },
  mail(K, { arms = 9, skirt = 3 } = {}) {
    K.paint('body', (x, y, side) => (side === 'bottom' ? undefined : M.mail(x, y)));
    for (const a of RA) K.paint(a, (x, y, side) => (side === 'top' || y < arms ? M.mail(x, y) : undefined), ['right', 'front', 'left', 'back', 'top']);
    for (const l of RL) K.paint(l, (x, y, side) => (y < skirt && side !== 'bottom' && side !== 'top' ? M.mail(x, y) : undefined));
  },
  // Сюрко поверх кольчуги: поле, кайма, герб замка — жёлтая башня
  tabard(K, c = '#9c2a22', trim = '#d8b040') {
    const tower = (x, y) => (y >= 2 && y <= 7 && x >= 3 && x <= 4) || (y === 2 && (x === 2 || x === 5)) || (y === 3 && (x === 2 || x === 5)) || (y === 1 && (x === 2 || x === 5 || x === 3 || x === 4) && x !== 3);
    for (const side of ['front', 'back']) K.side('jacket', side, (x, y) => {
      if (x === 0 || x === 7) return undefined;
      if (y === 11 || ((x === 1 || x === 6) && y > 0)) return { c: trim, t: y % 2 ? 0 : -0.3 };
      if (side === 'front' && tower(x, y)) return { c: trim, t: y === 7 ? -0.5 : x === 3 ? 0.4 : 0 };
      if (side === 'front' && y === 7 && (x === 2 || x === 5)) return { c: trim, t: -0.4 };
      return { c, n: 0.2 };
    });
    for (const l of RLP) K.paint(l, (x, y, side) => (y < 3 && (side === 'front' || side === 'back') ? (y === 2 ? { c: trim } : { c, n: 0.2 }) : undefined), ['front', 'back']);
  },
  // Плащ за спиной и на плечах
  cloak(K, c, { clasp = '#d8b040', fur, len = 10, hood } = {}) {
    K.paint('jacket', (x, y, side, w, h, u) => {
      if (side === 'back') return fur && y === 0 ? M.fur(fur) : M.folds(c, u, 2, 0.25);
      if (side === 'left' || side === 'right') return fur && y === 0 ? M.fur(fur) : M.folds(c, u, 3);
      if (side === 'top') return fur ? M.fur(fur) : M.cloth(c);
      if (side === 'front') return y === 0 ? (x === 0 || x === 7 ? { c: clasp, t: 0.5 } : fur && x !== 3 && x !== 4 ? M.fur(fur) : undefined) : x === 0 || x === 7 ? M.cloth(c) : undefined;
      return undefined;
    });
    for (const a of RAS) K.paint(a, (x, y, side) => (y < 2 && side !== 'bottom' ? (fur ? M.fur(fur) : M.cloth(c)) : undefined));
    for (const l of RLP) K.side(l, 'back', (x, y, w, h, u) => (y < len ? M.folds(c, x, 2) : undefined));
    if (hood) K.side('hat', 'back', (x, y) => (y >= 5 ? M.cloth(c) : undefined));
  },
  hood(K, c, { cape = true, mask } = {}) {
    K.paint('hat', (x, y, side) => {
      if (side === 'bottom') return undefined;
      if (side === 'front') return y <= 1 || x === 0 || x === 7 ? M.cloth(c) : mask && y >= 5 ? M.cloth(mask, 0.15) : undefined;
      if (side === 'top') return M.cloth(c);
      return M.cloth(c);
    });
    if (cape) {
      K.paint('jacket', (x, y, side) => (y < 3 && side !== 'bottom' ? { c, n: 0.2, t: y === 2 ? -0.5 : 0 } : undefined));
      for (const a of RAS) K.paint(a, (x, y, side) => (y < 2 && side !== 'bottom' ? M.cloth(c) : undefined));
    }
  },
  // Шелом с наносником и бармицей
  helmet(K, steel = '#a8adb2', { plume, rim = '#c8a040' } = {}) {
    K.paint('hat', (x, y, side) => {
      if (side === 'bottom') return undefined;
      if (side === 'top') return plume && (x === 3 || x === 4) ? { c: plume, n: 0.3, t: 0.3 } : { c: steel, t: (x === 3 || x === 4) && (y === 3 || y === 4) ? 1 : 0.4, n: 0.1 };
      if (y === 0) return { c: steel, t: 0.5 };
      if (y === 2) return side === 'front' ? (x === 3 || x === 4 ? { c: steel, t: -0.2 } : { c: rim, t: 0.2 }) : { c: rim, t: 0.1 };
      if (side === 'front') return y === 1 ? { c: steel, t: 0.1 } : (x === 3 || x === 4) && y <= 5 ? { c: steel, t: x === 3 ? 0.3 : -0.3 } : undefined;
      if (y === 1) return { c: steel, t: 0 };
      const edge = side === 'right' ? 7 - x : side === 'left' ? x : 9;
      if (y >= 3 && edge > 1) return M.mail(x, y); // бармица
      return undefined;
    });
  },
  // Платок: на макушке, по бокам, узел сзади
  kerchief(K, c, { dots, hair } = {}) {
    K.paint('hat', (x, y, side) => {
      const col = dots && (x + 2 * y) % 4 === 0 ? { c: dots } : M.cloth(c, 0.2);
      if (side === 'bottom') return undefined;
      if (side === 'top') return col;
      if (side === 'front') return y <= 1 ? col : undefined;
      if (side === 'back') return y <= 6 ? col : y === 7 && (x === 3 || x === 4) ? { c, t: -0.6 } : undefined;
      const edge = side === 'right' ? 7 - x : x;
      return y <= 5 && edge > 0 ? col : y <= 7 && edge > 3 ? col : undefined;
    });
    if (hair) K.side('head', 'front', (x, y) => (y === 2 && x >= 2 && x <= 5 ? M.hair(hair, x, y) : undefined));
  },
  // Шапка с меховым околышем
  furHat(K, fur = '#6b4a2e', top = '#3d6b4a', { tall } = {}) {
    K.paint('hat', (x, y, side) => {
      if (side === 'bottom') return undefined;
      if (side === 'top') return x > 0 && x < 7 && y > 0 && y < 7 ? { c: top, n: 0.2, t: 0.2 } : M.fur(fur);
      if (y === 0 && tall) return { c: top, t: 0.3 };
      return y <= (tall ? 2 : 1) ? M.fur(fur) : undefined;
    });
  },
  cap(K, c, { brim, feather } = {}) {
    K.paint('hat', (x, y, side) => {
      if (side === 'bottom') return undefined;
      if (side === 'top') return M.cloth(c);
      if (y === 1 && brim) return { c: brim, t: 0.2 };
      return y <= 1 ? M.cloth(c) : undefined;
    });
    if (feather) K.side('hat', 'left', (x, y) => ((x === 4 && y === 0) || (x === 5 && y === 0) || (x === 4 && y === 1) ? { c: feather, t: x === 5 ? 0.6 : 0 } : undefined));
  },
  gloves(K, c, from = 10) {
    for (const a of RA) K.paint(a, (x, y, side) => (side === 'bottom' ? { c, t: -0.6 } : side !== 'top' && y >= from ? { c, t: y === from ? 0.4 : 0, n: 0.15 } : undefined));
  },
  bracer(K, c, arm = 'lArm') {
    K.paint(arm, (x, y, side) => (side !== 'top' && side !== 'bottom' && y >= 7 && y <= 9 ? M.leather(c, y, x) : undefined));
  },
  // Перевязь наискось через грудь
  strap(K, c, { buckle } = {}) {
    K.side('jacket', 'front', (x, y) => { const sx = 7 - Math.floor(y * 0.62); return x === sx || x === sx - 1 ? (buckle && y === 5 && x === sx ? { c: buckle, t: 0.5 } : { c, t: x === sx ? 0 : -0.4 }) : undefined; });
    K.side('jacket', 'back', (x, y) => { const sx = Math.floor(y * 0.62); return x === sx || x === sx + 1 ? { c, t: x === sx ? 0 : -0.4 } : undefined; });
  },
  quiver(K) {
    K.side('jacket', 'back', (x, y) => {
      if (y === 0 && x >= 4 && x <= 6) return { c: x === 5 ? '#e8e8e8' : '#b83030' };
      if (y === 1 && x >= 4 && x <= 6) return { c: '#5a3a20', t: -0.4 };
      if (x >= 4 && x <= 6 && y >= 2 && y <= 9) return { c: '#7a4e2a', t: x === 4 ? 0.3 : x === 6 ? -0.4 : 0, n: 0.15 };
      return undefined;
    });
  },
  pouch(K, c, x0 = 5, y0 = 9) {
    K.side('jacket', 'front', (x, y) => (x >= x0 && x <= x0 + 1 && y >= y0 && y <= y0 + 1 ? { c, t: y === y0 ? 0.3 : -0.2 } : undefined));
  },
  knife(K, x0 = 1, y0 = 9) {
    K.side('jacket', 'front', (x, y) => (x === x0 && y >= y0 && y <= y0 + 2 ? { c: y === y0 ? '#c8c8c8' : '#4a3020', t: 0 } : undefined));
  },
  keys(K, x0 = 6, y0 = 9) {
    K.side('jacket', 'front', (x, y) => ((x === x0 && y >= y0 && y <= y0 + 2) || (x === x0 - 1 && y === y0 + 2) ? { c: '#d0a838', t: y === y0 ? 0.5 : 0 } : undefined));
  },
  cross(K, c = '#d8d8d8', y0 = 3) {
    K.side('jacket', 'front', (x, y) => (((x === 3 || x === 4) && y >= y0 && y <= y0 + 4) || (y === y0 + 1 && x >= 2 && x <= 5) ? { c, t: x === 3 ? 0.6 : 0 } : (x === 2 && y < y0 && y === y0 - 1 - 0) || (x === 5 && y === y0 - 1) || ((x === 1 || x === 6) && y === y0 - 2) ? { c: '#9a9a9a' } : undefined));
  },
  // Узор по полю: звёзды, заплаты, пятна
  sprinkle(K, part, c, p, t = 0) { K.paint(part, (x, y, side) => (side !== 'top' && side !== 'bottom' && K.rnd() < p ? { c, t } : undefined)); },
  patch(K, part, side, x0, y0, c) { K.side(part, side, (x, y) => (x >= x0 && x <= x0 + 1 && y >= y0 && y <= y0 + 1 ? { c, t: (x + y) % 2 ? 0 : -0.3, n: 0.1 } : undefined)); },
  glasses(K, c = '#5a4630') {
    K.side('hat', 'front', (x, y) => (y === 4 && (x === 0 || x === 3 || x === 4 || x === 7) ? { c } : (y === 3 || y === 5) && (x === 1 || x === 2 || x === 5 || x === 6) ? { c, t: -0.2 } : undefined));
    K.paint('hat', (x, y, side) => (y === 4 && (side === 'right' ? x >= 4 : x <= 3) ? { c } : undefined), ['left', 'right']);
  },
  braid(K, c, tie = '#c03030') {
    K.side('jacket', 'back', (x, y) => ((x === 3 || x === 4) && y <= 9 ? (y === 9 ? { c: tie } : M.hair(c, x + (y % 2), y)) : undefined));
    K.side('hat', 'back', (x, y) => ((x === 3 || x === 4) && y >= 6 ? M.hair(c, x, y) : undefined));
  },
  headband(K, c, beads) {
    K.paint('hat', (x, y, side) => (side === 'top' || side === 'bottom' ? undefined : y === 1 ? (beads && side === 'front' && x % 2 ? { c: beads, t: 0.5 } : M.cloth(c)) : side === 'front' && y === 0 && x >= 2 && x <= 5 ? { c, t: 0.3 } : undefined));
  },
  crown(K, gold = '#e0b33a', fur = '#5a3a24') {
    K.paint('hat', (x, y, side) => {
      if (side === 'bottom') return undefined;
      if (side === 'top') return x >= 2 && x <= 5 && y >= 2 && y <= 5 ? { c: gold, t: 0.5 } : undefined;
      if (y === 3) return M.fur(fur);
      if (y === 2) return { c: gold, t: x % 2 ? 0.3 : -0.2 };
      if (y === 1) return side === 'front' && (x === 3 || x === 4) ? { c: '#c0283a', t: x === 3 ? 0.6 : 0 } : side === 'front' && (x === 1 || x === 6) ? { c: '#2f5fb0', t: 0.3 } : { c: gold, t: 0.2 };
      if (y === 0) return x === 0 || x === 3 || x === 4 || x === 7 ? { c: gold, t: 0.8 } : undefined;
      return undefined;
    });
  },
  // Гусли за спиной
  gusli(K) {
    K.side('jacket', 'back', (x, y) => {
      const lo = 1 + Math.floor((9 - y) / 4), hi = 6 - Math.floor((9 - y) / 6);
      if (y >= 2 && y <= 9 && x >= lo && x <= hi) return x === lo || x === hi || y === 2 || y === 9 ? { c: '#6a4020', t: 0 } : (x % 2 ? { c: '#e0d090', t: 0.6 } : { c: '#a8743a' });
      return undefined;
    });
  },
};

// ---------- Жители ----------
const SKIN = { light: '#e6b494', fair: '#f0c6a6', ruddy: '#dda080', tan: '#c88c64', old: '#dcb49c', dark: '#a87250', pale: '#e8c8b4', weather: '#c49070' };
const GUARD = (K, o) => { W.trousers(K, '#4a4038'); W.mail(K); W.gloves(K, '#5a3a22'); W.boots(K, '#3a2616', 6, { cuff: '#5a3a22' }); W.tabard(K, o.field, o.trim); W.belt(K, '#4a3020', { y: 8, buckle: '#c8a040' }); W.helmet(K, o.steel, o); };

const NPC = [
  // ===== Этап 0 =====
  { id: 'vsevolod', group: 'castle', name: 'Король Всеволод', stage: 0, role: 'старый больной король, хозяин замка', draw: (s) => {
    const K = person({ skin: SKIN.old, hair: '#dcdcd6', hairStyle: 'long', beard: 'long', beardColor: '#e8e8e2', eyes: '#5a6a7a', age: 1 }, s);
    W.shirt(K, '#e8dcc0', { emb: '#b8302a', skin: SKIN.old });
    W.trousers(K, '#4a1a2e'); W.boots(K, '#9a2a20', 7, { cuff: '#d8b040' });
    W.kaftan(K, '#6a1f3a', { trim: '#d8b040', len: 11, collar: '#d8b040' });
    W.belt(K, '#d8b040', { y: 7, buckle: '#c0283a', part: 'jacket' });
    W.cloak(K, '#7a2238', { clasp: '#e0b33a', fur: '#eeeae0', len: 11 });
    K.paint('jacket', (x, y, side) => (side !== 'bottom' && side !== 'top' && y === 0 && (x + y) % 3 === 0 ? { c: '#1e1a18' } : undefined)); // хвостики горностая
    W.crown(K);
    return K;
  } },
  { id: 'agafya', group: 'castle', name: 'Повариха Агафья', stage: 0, role: 'кухня', draw: (s) => {
    const K = person({ skin: SKIN.ruddy, hair: '#7a4a2a', hairStyle: 'short', blush: 1, eyes: '#5a4a2a', age: 1, mouth: '#a84848' }, s);
    W.shirt(K, '#efe8d8', { emb: '#b8302a', sleeves: 'rolled', skin: SKIN.ruddy });
    W.trousers(K, '#3e5f8a'); W.boots(K, '#4a3020', 9);
    W.kaftan(K, '#3e5f8a', { len: 11, sleeves: false, trim: '#b8302a' }); // сарафан
    K.side('jacket', 'front', (x, y) => (y < 3 && (x === 0 || x === 7 || (x >= 2 && x <= 5)) ? null : undefined)); // лямки сарафана
    W.apron(K, '#f2ede0', { top: 3, len: 9, hem: '#b8302a', stains: '#c8b8a0' });
    W.kerchief(K, '#b8302a', { dots: '#f2ece0', hair: '#7a4a2a' });
    return K;
  } },
  { id: 'frol', group: 'castle', name: 'Конюх Фрол', stage: 0, role: 'конюшня', draw: (s) => {
    const K = person({ skin: SKIN.weather, hair: '#5a3a1e', hairStyle: 'curly', beard: 'full', beardColor: '#6a4424', eyes: '#4a3a1a' }, s);
    W.shirt(K, '#6a7a4a', { sleeves: 'rolled', skin: SKIN.weather, emb: '#3a4a2a' });
    W.trousers(K, '#5a4a3a'); W.boots(K, '#3a2616', 5, { cuff: '#5a3a22' });
    W.vest(K, '#7a5434', { lace: '#2a1a10' });
    W.belt(K, '#3a2a1a', { y: 9, buckle: '#8a8a8a' }); W.pouch(K, '#5a3a20', 5, 10);
    K.paint('hat', (x, y, side) => (side === 'top' && (x * 5 + y * 3) % 7 === 0 ? { c: '#d8c060', t: 0.3 } : undefined)); // соломинки в волосах
    return K;
  } },
  { id: 'ostap', group: 'castle', name: 'Стражник Остап', stage: 0, role: 'привратник, старший из двух', draw: (s) => {
    const K = person({ skin: SKIN.weather, hair: '#8a8a86', hairStyle: 'short', beard: 'droop', beardColor: '#b0b0aa', eyes: '#4a5a6a', age: 1, scar: 'brow' }, s);
    GUARD(K, {}); return K;
  } },
  { id: 'mitka', group: 'castle', name: 'Стражник Митька', stage: 0, role: 'привратник, молодой', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#d8b060', hairStyle: 'bowl', freckles: 2, blush: 1, eyes: '#4a7ab0' }, s);
    GUARD(K, { steel: '#b4b8bc' });
    K.side('hat', 'front', (x, y) => ((y === 3 && (x === 0 || x === 1 || x === 6)) ? M.hair('#d8b060', x, y) : undefined)); // вихры из-под шлема
    return K;
  } },
  // ===== Этап 1 =====
  { id: 'demyan', group: 'castle', name: 'Капитан Демьян Беляк', stage: 1, role: 'начальник стражи, младший брат сотника Ярослава', draw: (s) => {
    const K = person({ skin: SKIN.tan, hair: '#2a2220', hairStyle: 'short', beard: 'short', beardColor: '#2a2220', eyes: '#3a3020', scar: 'cheek' }, s);
    W.trousers(K, '#3a3436'); W.mail(K); W.gloves(K, '#3a2a1e', 9); W.boots(K, '#2a1a12', 5, { cuff: '#8a1e1e' });
    // зерцало: круглая пластина на груди, наплечники
    K.side('jacket', 'front', (x, y) => {
      if (y >= 1 && y <= 7 && x >= 1 && x <= 6) { const r = Math.hypot(x - 3.5, y - 4); return r < 1.6 ? { c: '#e0c050', t: 0.4 } : r < 3.3 ? { c: '#c0c4c8', t: (x + y) % 3 ? 0 : 0.6 } : undefined; }
      return undefined;
    });
    for (const a of RAS) K.paint(a, (x, y, side) => (side !== 'bottom' && y < 3 ? { c: '#b8bcc0', t: y === 0 ? 0.6 : y === 2 ? -0.5 : 0 } : undefined));
    W.belt(K, '#2a1a10', { y: 8, buckle: '#e0c050', part: 'jacket' });
    W.cloak(K, '#8a1e1e', { clasp: '#e0c050', len: 11 });
    W.helmet(K, '#c8ccd0', { plume: '#c03030' });
    return K;
  } },
  ...[['zhdan', 'Стражник Ждан', SKIN.light, '#6a4a2a', 'full', 'short'], ['gavrila', 'Стражник Гаврила', SKIN.dark, '#1e1a18', 'short', 'short'], ['luka', 'Стражник Лука', SKIN.fair, '#a0522d', 'stubble', 'shaggy']].map(([id, name, sk, hair, beard, hs]) => ({
    id, group: 'castle', name, stage: 1, role: 'стражник гарнизона', draw: (s) => {
      const K = person({ skin: sk, hair, hairStyle: hs, beard, beardColor: hair, eyes: '#4a4a3a', freckles: id === 'luka' ? 1 : 0 }, s);
      GUARD(K, {}); return K;
    },
  })),
  { id: 'savva', group: 'castle', name: 'Лучник Савва', stage: 1, role: 'стрелок на стенах', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#5a3a1e', hairStyle: 'short', beard: 'stubble', eyes: '#3a6a3a' }, s);
    W.shirt(K, '#6a5038', { slit: false }); W.trousers(K, '#4a5a34'); W.boots(K, '#4a3020', 5, { cuff: '#6a4a2a' });
    W.vest(K, '#7a5a3a', { len: 11 }); W.belt(K, '#3a2a1a', { y: 8, buckle: '#8a8a8a', part: 'jacket' });
    W.bracer(K, '#5a3a20', 'lArm'); W.gloves(K, '#6a4a2a', 11);
    W.hood(K, '#3a5a30'); W.strap(K, '#5a3a20'); W.quiver(K);
    return K;
  } },
  // ===== Этап 2 =====
  { id: 'gordey', group: 'castle', name: 'Кузнец Гордей', stage: 2, role: 'кузница', draw: (s) => {
    const K = person({ skin: SKIN.tan, hair: '#1a1614', hairStyle: 'bald', beard: 'full', beardColor: '#1e1a18', eyes: '#3a2a1a', soot: 1 }, s);
    W.shirt(K, '#8a6a4a', { sleeves: 'short', skin: SKIN.tan, slit: false });
    W.trousers(K, '#3a3430'); W.boots(K, '#2a1a12', 6);
    W.apron(K, '#5a3a22', { top: 0, len: 10, stains: '#2a1a10' });
    W.gloves(K, '#4a3020', 8);
    K.paint('hat', (x, y, side) => (side !== 'top' && side !== 'bottom' && y === 2 ? { c: '#7a2a20', n: 0.2 } : undefined)); // повязка от пота
    W.sprinkle(K, 'rArm', '#3a2a20', 0.05); W.sprinkle(K, 'lArm', '#3a2a20', 0.05);
    return K;
  } },
  { id: 'vaska', group: 'castle', name: 'Подмастерье Васька', stage: 2, role: 'кузница', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#c0582a', hairStyle: 'curly', freckles: 2, eyes: '#4a6a3a', soot: 1 }, s);
    W.shirt(K, '#c8b898', { sleeves: 'rolled', skin: SKIN.fair, emb: '#8a3a2a' });
    W.trousers(K, '#5a5048'); W.lapti(K);
    W.apron(K, '#6a4a2e', { top: 3, len: 5, stains: '#2a1a10' });
    W.belt(K, '#8a3a2a', { y: 8, sash: '#8a3a2a' });
    return K;
  } },
  // ===== Этап 3 =====
  { id: 'ignat', group: 'castle', name: 'Кастелян Игнат', stage: 3, role: 'управитель, главный по хозяйству', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#6a5a4a', hairStyle: 'parted', beard: 'short', beardColor: '#8a7a6a', eyes: '#4a5a6a', age: 1 }, s);
    W.shirt(K, '#e8dcc0'); W.trousers(K, '#3a3a40'); W.boots(K, '#3a2616', 6);
    W.kaftan(K, '#2e5a3e', { buttons: '#d8b040', len: 7, trim: '#d8b040' });
    K.side('jacket', 'front', (x, y) => (y >= 1 && y <= 7 && y % 2 && (x === 1 || x === 2 || x === 5 || x === 6) ? { c: '#d8b040', t: x === 1 || x === 6 ? -0.3 : 0.2 } : undefined)); // нашивки-«разговоры»
    W.belt(K, '#a83030', { y: 8, sash: '#a83030', part: 'jacket' }); W.keys(K, 6, 9);
    W.furHat(K, '#5a3a24', '#2e5a3e');
    return K;
  } },
  { id: 'dunya', group: 'castle', name: 'Служанка Дуня', stage: 3, role: 'комната служанок, бельевая', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#e0c070', hairStyle: 'parted', blush: 1, eyes: '#4a7ab0', mouth: '#c05858' }, s);
    W.shirt(K, '#f2ece0', { emb: '#c03030', skin: SKIN.fair, slit: false });
    K.paint('rArm', (x, y, side) => (side !== 'top' && side !== 'bottom' && y === 2 ? { c: '#c03030', t: x % 2 ? 0.3 : 0 } : undefined)); K.paint('lArm', (x, y, side) => (side !== 'top' && side !== 'bottom' && y === 2 ? { c: '#c03030', t: x % 2 ? 0.3 : 0 } : undefined));
    W.trousers(K, '#5a8ab8'); W.boots(K, '#8a3020', 9);
    W.kaftan(K, '#5a8ab8', { len: 12, sleeves: false, trim: '#e0c050' });
    K.side('jacket', 'front', (x, y) => (y < 2 && (x <= 1 || x >= 6 || x === 3 || x === 4) ? null : undefined));
    W.apron(K, '#f8f4ea', { top: 6, len: 6, hem: '#c03030' });
    W.headband(K, '#b83030', '#e0c050'); W.braid(K, '#e0c070');
    return K;
  } },
  // ===== Этап 4 =====
  { id: 'varlaam', group: 'castle', name: 'Отец Варлаам', stage: 4, role: 'священник часовни', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#8a7a6a', hairStyle: 'long', beard: 'long', beardColor: '#9a8a78', eyes: '#4a3a2a', age: 1 }, s);
    W.shirt(K, '#26262c', { slit: false }); W.trousers(K, '#1e1e22'); W.boots(K, '#1a1a1a', 9);
    W.kaftan(K, '#1e1e24', { len: 12 });
    K.paint('hat', (x, y, side) => (side === 'bottom' ? undefined : side === 'top' ? { c: '#1a1a20', t: 0.4 } : y <= 2 ? { c: '#1a1a20', t: y === 0 ? 0.4 : 0, n: 0.1 } : undefined)); // камилавка
    W.cross(K, '#e0e0e0', 5);
    return K;
  } },
  // ===== Этап 5 =====
  { id: 'evsey', group: 'castle', name: 'Переписчик Евсей', stage: 5, role: 'скрипторий, библиотека', draw: (s) => {
    const K = person({ skin: SKIN.pale, hair: '#8a6a4a', hairStyle: 'tonsure', beard: 'short', beardColor: '#8a6a4a', eyes: '#4a4a3a', age: 1 }, s);
    W.shirt(K, '#6a5a46', { slit: false }); W.trousers(K, '#4a4038'); W.boots(K, '#3a2a1e', 9);
    W.kaftan(K, '#6a5a46', { len: 12 }); W.belt(K, '#3a2a1a', { y: 8, part: 'jacket' }); W.pouch(K, '#2a2a40', 5, 9);
    K.side('rArm', 'front', (x, y) => (y === 11 && x % 2 ? { c: '#1a2a6a' } : undefined)); // чернила на пальцах
    K.side('hat', 'right', (x, y) => (x === 5 && y >= 1 && y <= 4 ? { c: '#f0f0f0', t: y === 1 ? 0.5 : 0 } : undefined)); // перо за ухом
    return K;
  } },
  { id: 'lenz', group: 'castle', name: 'Звездочёт Ленц', stage: 5, role: 'картограф Аркадий Ленц, вернувшийся из квадрата Г-7', draw: (s) => {
    const K = person({ skin: SKIN.old, hair: '#c8c8c4', hairStyle: 'shaggy', beard: 'goatee', beardColor: '#d0d0cc', eyes: '#5a6a8a', age: 1 }, s);
    W.shirt(K, '#d8d0c0'); W.trousers(K, '#2a2a3a'); W.boots(K, '#3a2616', 8);
    W.kaftan(K, '#22305a', { len: 12, trim: '#d8b040' });
    W.sprinkle(K, 'jacket', '#f0d860', 0.07, 0.6); W.sprinkle(K, 'rPants', '#f0d860', 0.06, 0.6); W.sprinkle(K, 'lPants', '#f0d860', 0.06, 0.6);
    W.belt(K, '#5a3a20', { y: 8, part: 'jacket', buckle: '#c8a040' });
    W.strap(K, '#5a3a20'); K.side('jacket', 'back', (x, y) => (x >= 5 && x <= 6 && y <= 8 ? { c: '#8a5a30', t: y === 0 ? 0.6 : 0 } : undefined)); // тубус с картами
    W.glasses(K);
    return K;
  } },
  { id: 'semka', group: 'castle', name: 'Голубятник Сёмка', stage: 5, role: 'мальчишка с голубятни', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#7a5a3a', hairStyle: 'bowl', freckles: 2, blush: 1, eyes: '#5a7a4a' }, s);
    W.shirt(K, '#c8c0a8', { emb: '#6a8ab0', skin: SKIN.fair }); W.trousers(K, '#6a6a70'); W.lapti(K);
    W.belt(K, '#6a3a20', { y: 8, sash: '#6a3a20' });
    W.patch(K, 'lLeg', 'front', 1, 2, '#8a6a4a'); W.patch(K, 'rArm', 'front', 1, 5, '#8a7a5a');
    W.cap(K, '#5a5a60', { feather: '#eeeef2' });
    K.paint('lSleeve', (x, y, side) => (side === 'top' ? { c: '#e8e8ec', t: x === 1 && y === 1 ? -1.5 : 0.3 } : undefined), ['top']); // голубь на плече
    return K;
  } },
  // ===== Этап 6 =====
  { id: 'marfa', group: 'castle', name: 'Травница Марфа', stage: 6, role: 'лекарская; та самая ведунья из сгоревшего дома', draw: (s) => {
    const K = person({ skin: SKIN.old, hair: '#b8b4ac', hairStyle: 'long', eyes: '#4a6a3a', age: 1 }, s);
    W.shirt(K, '#d8d0b8', { emb: '#4a6a3a', skin: SKIN.old }); W.trousers(K, '#5a4630'); W.boots(K, '#3a2a1e', 9);
    W.kaftan(K, '#6a5032', { len: 12, sleeves: false });
    W.belt(K, '#3a5a2a', { y: 8, part: 'jacket' }); W.strap(K, '#5a4a30'); W.pouch(K, '#7a6a40', 5, 9);
    K.side('jacket', 'front', (x, y) => ((x === 1 || x === 2) && y >= 9 && y <= 11 ? { c: y === 9 ? '#3a5a2a' : (x + y) % 2 ? '#6a9a4a' : '#9ab060' } : undefined)); // пучки трав
    W.kerchief(K, '#4a6a3a', { hair: '#b8b4ac' });
    K.side('jacket', 'front', (x, y) => ((y === 1 && (x === 2 || x === 5)) || (y === 2 && (x === 3 || x === 4)) ? { c: '#a03030', t: 0.3 } : undefined)); // бусы
    return K;
  } },
  // ===== Этап 7 =====
  { id: 'prokhor', group: 'castle', name: 'Тюремщик Прохор', stage: 7, role: 'бывший углежог, вытащил мальчика из болота', draw: (s) => {
    const K = person({ skin: SKIN.ruddy, hair: '#2a2220', hairStyle: 'bald', beard: 'stubble', eyes: '#3a2a1a', soot: 1, age: 1 }, s);
    W.shirt(K, '#5a4a3a', { sleeves: 'rolled', skin: SKIN.ruddy }); W.trousers(K, '#2e2a28'); W.boots(K, '#1e1610', 5);
    W.vest(K, '#2a221e', { len: 11 });
    W.belt(K, '#2a1a10', { y: 8, buckle: '#8a8a8a', part: 'jacket' }); W.keys(K, 6, 9); W.keys(K, 2, 9);
    K.side('rArm', 'front', (x, y) => (y >= 8 && y <= 9 && x >= 1 ? { c: mix(SKIN.ruddy, '#a05040', 0.4) } : undefined)); // ожог
    return K;
  } },
  // ===== Этап 8 =====
  { id: 'timosha', group: 'castle', name: 'Менестрель Тимоша', stage: 8, role: 'гусляр, поёт песню о пропавшем княжиче', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#d8a040', hairStyle: 'curly', beard: 'mustache', beardColor: '#d8a040', eyes: '#3a6a9a', blush: 1 }, s);
    W.shirt(K, '#c8a020', { emb: '#b02a2a' }); W.trousers(K, '#b02a2a'); W.boots(K, '#4a2a5a', 7, { cuff: '#c8a020' });
    // кафтан на две половины, ноги наоборот
    K.paint('body', (x, y, side) => ((side === 'front' && x >= 4) || (side === 'back' && x < 4) || side === 'left' ? M.folds('#b02a2a', x, 4) : undefined), ['front', 'back', 'left']);
    K.paint('lArm', (x, y, side) => (side !== 'bottom' && y < 10 ? M.folds('#b02a2a', x, 5) : undefined));
    K.paint('lLeg', (x, y, side) => (side !== 'bottom' && y < 7 ? M.folds('#c8a020', x, 4) : undefined));
    W.belt(K, '#5a2a6a', { y: 8, buckle: '#d8b040' });
    W.gusli(K); W.strap(K, '#7a4a20');
    W.cap(K, '#3a6a4a', { brim: '#c8a020', feather: '#e8e0f0' });
    return K;
  } },

  // ===== Шайка Рыжего =====
  { id: 'ryzhy', group: 'gang', name: 'Рыжий (Ефрем Рыжов)', stage: 5, role: 'атаман шайки; пропавший княжич Ефрем', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#c4501e', hairStyle: 'shaggy', beard: 'short', beardColor: '#b84a1c', eyes: '#4a8a4a', scar: 'brow', freckles: 1 }, s);
    W.shirt(K, '#9a2a24', { emb: '#1e1a18', skin: SKIN.light });
    W.trousers(K, '#2e2c2a'); W.boots(K, '#2a1a12', 5, { cuff: '#4a3020' });
    W.vest(K, '#3a2a1e', { len: 10 });
    W.belt(K, '#6a1a1a', { y: 8, sash: '#6a1a1a', part: 'jacket' }); W.knife(K, 6, 8);
    W.bracer(K, '#3a2a1e', 'rArm'); W.bracer(K, '#3a2a1e', 'lArm');
    W.cloak(K, '#5a5450', { clasp: '#a8a8a8', fur: '#8a8580', len: 6 }); // волчья шкура на плечах
    K.side('jacket', 'back', (x, y) => (y >= 1 && y <= 6 ? M.fur('#7a7570') : undefined));
    K.paint('hat', (x, y, side) => (side === 'back' && y >= 6 ? M.fur('#7a7570') : undefined), ['back']);
    return K;
  } },
  { id: 'sych', group: 'gang', name: 'Сыч', stage: 5, role: 'дозорный шайки, одноглазый', draw: (s) => {
    const K = person({ skin: SKIN.weather, hair: '#6a6056', hairStyle: 'short', beard: 'stubble', eyes: '#6a5a3a', patch: 1, age: 1 }, s);
    W.shirt(K, '#7a7060', { slit: false }); W.trousers(K, '#5a5248'); W.lapti(K);
    W.kaftan(K, '#5a5a4a', { len: 6 }); W.patch(K, 'jacket', 'front', 1, 4, '#7a6a4a'); W.patch(K, 'rSleeve', 'front', 1, 6, '#6a5a3a');
    W.belt(K, '#4a3a2a', { y: 8, part: 'jacket' });
    W.hood(K, '#4a463e', { cape: true });
    K.side('hat', 'front', (x, y) => (y >= 2 && x >= 1 && x <= 6 ? undefined : undefined));
    return K;
  } },
  { id: 'voron', group: 'gang', name: 'Ворон', stage: 5, role: 'лучник шайки', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#141418', hairStyle: 'short', eyes: '#2a2a2a' }, s);
    W.shirt(K, '#2a2a30', { slit: false }); W.trousers(K, '#22222a'); W.boots(K, '#141210', 5);
    W.vest(K, '#1e1c1c', { len: 11 }); W.belt(K, '#3a2a1a', { y: 8, part: 'jacket', buckle: '#6a6a6a' });
    W.bracer(K, '#3a2a1e', 'lArm'); W.gloves(K, '#2a1e16', 11);
    W.hood(K, '#18181e', { mask: '#26262c' }); W.strap(K, '#3a2a1a'); W.quiver(K);
    return K;
  } },
  { id: 'grinya', group: 'gang', name: 'Гриня Кривой', stage: 5, role: 'силач шайки, с дубиной', draw: (s) => {
    const K = person({ skin: SKIN.ruddy, hair: '#5a3a24', hairStyle: 'bald', beard: 'full', beardColor: '#5a3a24', eyes: '#3a2a1a', scar: 'cheek' }, s);
    K.side('head', 'front', (x, y) => (x === 3 && y === 5 ? { c: SKIN.ruddy, t: -0.9 } : undefined)); // перебитый нос
    W.shirt(K, '#8a7a60', { sleeves: 'short', skin: SKIN.ruddy, slit: false });
    W.trousers(K, '#4a4034'); W.lapti(K, { cloth: '#c8bca0' });
    W.vest(K, '#c8b090', { fur: 1, len: 9 }); // овчина
    W.belt(K, '#a08a5a', { y: 8 }); // верёвка
    K.paint('rArm', (x, y, side) => (side !== 'top' && side !== 'bottom' && y === 9 ? { c: '#8a8a8a', t: x % 2 ? 0.5 : 0 } : undefined)); // браслет
    return K;
  } },
  { id: 'kunitsa', group: 'gang', name: 'Куница', stage: 5, role: 'разведчица шайки', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#3a2418', hairStyle: 'parted', eyes: '#6a8a3a', mouth: '#b85a50' }, s);
    W.shirt(K, '#c8b898', { slit: false }); W.trousers(K, '#4a3a2a'); W.boots(K, '#3a2616', 4, { cuff: '#5a3a22' });
    W.vest(K, '#6a4a2a', { len: 10, lace: '#2a1a10' }); W.belt(K, '#2a1a10', { y: 8, part: 'jacket' }); W.knife(K, 1, 8); W.knife(K, 6, 8);
    W.cloak(K, '#3a5a34', { clasp: '#8a8a8a', len: 8 });
    W.braid(K, '#3a2418', '#3a5a34');
    W.furHat(K, '#c8641e', '#c8641e'); // лисья шапка
    K.side('hat', 'back', (x, y) => ((x === 3 || x === 4) && y >= 2 && y <= 5 ? { c: y === 5 ? '#f0ece0' : '#c8641e', n: 0.3 } : undefined)); // хвост
    return K;
  } },
  { id: 'pakhom', group: 'gang', name: 'Пахом', stage: 5, role: 'старый кашевар шайки', draw: (s) => {
    const K = person({ skin: SKIN.old, hair: '#a8a49c', hairStyle: 'bald', beard: 'full', beardColor: '#bcb8b0', eyes: '#5a5a4a', age: 1, blush: 1 }, s);
    W.shirt(K, '#c8bca0', { emb: '#8a3a2a', skin: SKIN.old, sleeves: 'rolled' });
    W.trousers(K, '#5a5044'); W.lapti(K);
    W.kaftan(K, '#c8a878', { len: 6, collar: '#e8dcc0', fur: 1, open: 1 }); // тулуп
    W.apron(K, '#d8d0c0', { top: 4, len: 6, stains: '#6a5040' });
    W.belt(K, '#6a4a2a', { y: 8, part: 'jacket' });
    return K;
  } },
  { id: 'shilo', group: 'gang', name: 'Шило', stage: 5, role: 'мальчишка-воришка', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#3a2a20', hairStyle: 'shaggy', eyes: '#5a4a2a', freckles: 1, soot: 1 }, s);
    W.shirt(K, '#9a9080', { slit: false }); W.trousers(K, '#4a4a4a'); W.lapti(K);
    W.kaftan(K, '#6a5a44', { len: 8, open: 1 }); // кафтан не по росту
    W.patch(K, 'jacket', 'back', 2, 3, '#8a6a4a'); W.patch(K, 'lSleeve', 'front', 1, 7, '#4a5a6a'); W.patch(K, 'rPants', 'front', 1, 4, '#7a6a4a');
    W.belt(K, '#a08a5a', { y: 8, part: 'jacket' });
    W.cap(K, '#3a3634');
    return K;
  } },
  // ===== Жители тайги =====
  { id: 'yaroslav', group: 'taiga', name: 'Сотник Ярослав Беляк', stage: 1, role: 'начальник острога, старший брат капитана Демьяна', draw: (s) => {
    const K = person({ skin: SKIN.weather, hair: '#5a4a3a', hairStyle: 'short', beard: 'full', beardColor: '#6a5a48', eyes: '#3a4a5a', age: 1, scar: 'brow' }, s);
    W.trousers(K, '#3a3436'); W.mail(K, { arms: 6 }); W.gloves(K, '#3a2a1e', 10); W.boots(K, '#5a2a1a', 6, { cuff: '#8a5a2a' });
    W.kaftan(K, '#7a2a24', { trim: '#c8a040', len: 8, open: 1, sleeves: false });
    W.belt(K, '#2a1a10', { y: 8, buckle: '#c8a040', part: 'jacket' }); W.knife(K, 1, 8);
    W.helmet(K, '#b8bcc0', { plume: '#7a2a24', rim: '#a08040' });
    return K;
  } },
  { id: 'lykov', group: 'taiga', name: 'Служивый Лыков', stage: 1, role: 'рядовой острога', draw: (s) => {
    const K = person({ skin: SKIN.ruddy, hair: '#8a5a2a', hairStyle: 'shaggy', beard: 'stubble', eyes: '#4a5a3a', freckles: 1 }, s);
    W.shirt(K, '#c8b898', { slit: false }); W.trousers(K, '#4a4a3a'); W.boots(K, '#3a2616', 6);
    W.kaftan(K, '#8a6a42', { len: 7, collar: '#6a4a2a' }); // стёганый тегиляй
    K.paint('jacket', (x, y, side) => (side !== 'top' && side !== 'bottom' && y % 3 === 2 ? { c: '#8a6a42', t: -0.6 } : undefined));
    W.belt(K, '#3a2a1a', { y: 8, part: 'jacket', buckle: '#8a8a8a' });
    W.furHat(K, '#4a3420', '#8a2a24', { tall: 1 });
    return K;
  } },
  // ===== Противник =====
  { id: 'nozhov', group: 'other', name: 'Савелий Ножов', stage: 8, role: 'приказчик лесопилки, бывший казначей замка', draw: (s) => {
    const K = person({ skin: SKIN.pale, hair: '#1a1818', hairStyle: 'slick', beard: 'goatee', beardColor: '#1a1818', eyes: '#3a3a2a', age: 1 }, s);
    K.side('head', 'front', (x, y) => (y === 5 && x === 3 ? { c: SKIN.pale, t: 0.5 } : undefined));
    W.shirt(K, '#e0e0d8'); W.trousers(K, '#1e1e22'); W.boots(K, '#141414', 6, { cuff: '#2a2a2a' });
    W.kaftan(K, '#2a2024', { buttons: '#c8c8c8', len: 9, collar: '#1a1416' });
    W.belt(K, '#141414', { y: 8, part: 'jacket', buckle: '#c8c8c8' }); W.keys(K, 1, 9); W.pouch(K, '#5a3a20', 5, 9);
    W.furHat(K, '#1e1a18', '#2a2024');
    return K;
  } },
];

const skinPng = (id) => { const i = NPC.findIndex((n) => n.id === id); if (i < 0) throw new Error('нет скина ' + id); return NPC[i].draw(1000 + i * 7919).png(); };
function render(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const n of NPC) fs.writeFileSync(path.join(outDir, n.id + '.png'), skinPng(n.id));
}

// ---------- Просмотр: каждый житель спереди, сбоку и сзади ----------
function lineup(outDir) {
  const GROUPS = { castle: 'Жители замка', gang: 'Шайка Рыжего', taiga: 'Жители тайги', other: 'Противник' };
  const cards = NPC.map((n) => `{g:'${n.group}',name:${JSON.stringify(n.name)},role:${JSON.stringify(n.role)},stage:${n.stage},src:'data:image/png;base64,${skinPng(n.id).toString('base64')}'}`);
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Жители замка</title>
<style>
:root{--bg:#f4efe4;--card:#fffaf0;--ink:#2a2420;--muted:#7a6e60;--line:#d8ccb4;--stage:#e9e0cc}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1c1a17;--card:#26231f;--ink:#eee6d8;--muted:#a89c8a;--line:#3a352e;--stage:#302c26}}
:root[data-theme="dark"]{--bg:#1c1a17;--card:#26231f;--ink:#eee6d8;--muted:#a89c8a;--line:#3a352e;--stage:#302c26}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 Georgia,serif;padding:16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:22px 0 10px}p.sub{margin:0 0 8px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.c{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center}
.c canvas{image-rendering:pixelated;width:100%;height:auto;background:var(--stage);border-radius:6px}
.n{font-weight:bold;margin-top:6px}.r{font-size:12px;color:var(--muted)}.s{font-size:11px;color:var(--muted);margin-top:2px}
</style></head><body>
<h1>Жители замка и шайка Рыжего</h1><p class="sub">Скины на модель игрока, 64×64: спереди, сбоку и сзади. Этап — когда житель появляется.</p>
<div id="root"></div>
<script>
const NPC=[${cards.join(',\n')}];
const GROUPS=${JSON.stringify(GROUPS)};
const P={head:[0,0,8,8,8],hat:[32,0,8,8,8],body:[16,16,8,12,4],jacket:[16,32,8,12,4],rArm:[40,16,4,12,4],rSleeve:[40,32,4,12,4],lArm:[32,48,4,12,4],lSleeve:[48,48,4,12,4],rLeg:[0,16,4,12,4],rPants:[0,32,4,12,4],lLeg:[16,48,4,12,4],lPants:[0,48,4,12,4]};
function face(p,side){const[u,v,w,h,d]=P[p];return{front:[u+d,v+d,w,h],back:[u+2*d+w,v+d,w,h],left:[u+d+w,v+d,d,h]}[side]}
function draw(img,cv){
  const S=5,ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
  const put=(p,side,x,y,over)=>{const[sx,sy,w,h]=face(p,side);const g=over?0.5:0;ctx.drawImage(img,sx,sy,w,h,(x-g)*S,(y-g)*S,(w+2*g)*S,(h+2*g)*S)};
  const fig=(ox,side)=>{const F=side==='front';
    const L=F?['rArm','rSleeve','rLeg','rPants']:['lArm','lSleeve','lLeg','lPants'],R=F?['lArm','lSleeve','lLeg','lPants']:['rArm','rSleeve','rLeg','rPants'];
    put(L[2],side,ox+4,21);put(R[2],side,ox+8,21);put('body',side,ox+4,9);put(L[0],side,ox,9);put(R[0],side,ox+12,9);put('head',side,ox+4,1);
    put(L[3],side,ox+4,21,1);put(R[3],side,ox+8,21,1);put('jacket',side,ox+4,9,1);put(L[1],side,ox,9,1);put(R[1],side,ox+12,9,1);put('hat',side,ox+4,1,1)};
  // сбоку (левый бок): голова, тело, левая рука, левая нога
  const prof=(ox)=>{put('lLeg','left',ox+2,21);put('body','left',ox+2,9);put('head','left',ox,1);put('lPants','left',ox+2,21,1);put('jacket','left',ox+2,9,1);put('lArm','left',ox+2,9);put('lSleeve','left',ox+2,9,1);put('hat','left',ox,1,1)};
  fig(1,'front');prof(20);fig(31,'back');
}
const root=document.getElementById('root');
for(const[g,title]of Object.entries(GROUPS)){
  const h=document.createElement('h2');h.textContent=title;root.append(h);
  const grid=document.createElement('div');grid.className='grid';root.append(grid);
  for(const n of NPC.filter((q)=>q.g===g)){const d=document.createElement('div');d.className='c';const cv=document.createElement('canvas');cv.width=48*5;cv.height=34*5;d.append(cv);
    for(const[cls,t]of[['n',n.name],['r',n.role],['s','этап '+n.stage]]){const e=document.createElement('div');e.className=cls;e.textContent=t;d.append(e)}
    grid.append(d);const img=new Image();img.onload=()=>draw(img,cv);img.src=n.src;}
}
</script></body></html>`;
  fs.writeFileSync(path.join(outDir, 'lineup.html'), html);
}

module.exports = { NPC, render, skinPng, png };
if (require.main === module) {
  const out = path.resolve(__dirname, '../design/skins');
  render(out); lineup(out);
  console.log(`Скины: ${NPC.length} → ${path.relative(process.cwd(), out)}`);
}
