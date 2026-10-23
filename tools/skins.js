// Скины жителей замка: рисуются кодом в формате скина игрока 64×64
// (основной слой + верхний: шлем, капюшон, корона, накидка, подол).
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
const shade = (c, k) => { const [r, g, b] = hex(c); return toHex(r * k, g * k, b * k); };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };

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
function faces(part) {
  const [u, v, w, h, d] = PARTS[part];
  return {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  };
}

// Холст скина. Цвет null — прозрачная клетка (только для верхнего слоя).
function Skin(seed) {
  const px = new Array(64 * 64).fill(null);
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const set = (x, y, c) => { if (x >= 0 && x < 64 && y >= 0 && y < 64) px[y * 64 + x] = c; };
  const get = (x, y) => px[y * 64 + x];
  const K = {
    rnd, set, get, px,
    // Ткань с лёгкой неровностью: цвет каждой клетки чуть плавает.
    cloth: (c, amp = 0.06) => c && shade(c, 1 - amp + rnd() * amp * 2),
    // Покрасить грань части: fn(x, y, w, h) → цвет (undefined — не трогать).
    face(part, side, fn) {
      const [x0, y0, w, h] = faces(part)[side];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y, w, h); if (c !== undefined) set(x0 + x, y0 + y, c); }
    },
    // Все четыре боковые грани и, по желанию, верх и низ
    around(part, fn, caps) {
      for (const side of ['right', 'front', 'left', 'back']) K.face(part, side, (x, y, w, h) => fn(x, y, side, w, h));
      if (caps) for (const side of ['top', 'bottom']) K.face(part, side, (x, y, w, h) => caps(x, y, side, w, h));
    },
    fill(part, c, amp) { K.around(part, () => K.cloth(c, amp), () => K.cloth(c, amp)); },
    png() {
      const buf = Buffer.alloc(64 * 64 * 4);
      px.forEach((c, i) => { if (c) { const [r, g, b] = hex(c); buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255; } });
      return png(64, 64, buf);
    },
  };
  return K;
}

// ---------- Общий рисунок человека ----------
// o: skin, hair, hairStyle (short|long|bald|bowl|curly), beard (none|stubble|mustache|short|full|long), beardColor,
// eyes, brows, shirt (рукава), tunic, belt, trousers, boots, sleeves (long|short|rolled), robe (подол на ногах),
// freckles, blush, age (морщины), soot.
function person(o, seed) {
  const K = Skin(seed);
  const skin = o.skin, sk = (k) => shade(skin, k);
  const hair = o.hair || '#4a3020', beardC = o.beardColor || hair;
  // Голова: кожа, волосы сверху и сзади
  K.around('head', (x, y, side) => {
    let c = K.cloth(skin, 0.03);
    if (side === 'back') c = y < (o.hairStyle === 'bald' ? 2 : o.hairStyle === 'long' ? 8 : 6) ? K.cloth(hair, 0.1) : c;
    if (side === 'right' || side === 'left') {
      const lim = o.hairStyle === 'bald' ? 2 : o.hairStyle === 'long' ? 8 : 4;
      const nearBack = side === 'right' ? x < 4 : x > 3;
      if (y < 2 || (y < lim && (nearBack || o.hairStyle === 'long')) || (o.hairStyle !== 'bald' && y < 3)) c = K.cloth(hair, 0.1);
      if (o.hairStyle === 'long' && y >= 3 && !nearBack && x === (side === 'right' ? 7 : 0)) c = K.cloth(skin, 0.03);
    }
    if (side === 'front') {
      if (o.hairStyle === 'bald') { if (y === 0) c = sk(0.95); }
      else if (o.hairStyle === 'bowl' && y < 3) c = K.cloth(hair, 0.1);
      else if (y < 2 || (y === 2 && (x === 0 || x === 7))) c = K.cloth(hair, 0.1);
      else if (o.hairStyle === 'curly' && y === 2 && x % 3 !== 1) c = K.cloth(hair, 0.1);
      if (o.hairStyle === 'long' && (x === 0 || x === 7) && y < 7) c = K.cloth(hair, 0.1);
    }
    return c;
  }, (x, y, side) => (side === 'top' ? (o.hairStyle === 'bald' && x > 1 && x < 6 && y > 1 && y < 7 ? K.cloth(skin, 0.04) : K.cloth(hair, 0.1)) : sk(0.8)));
  // Лицо
  K.face('head', 'front', (x, y) => {
    const eye = o.eyes || '#3b5a8a';
    if (y === 3 && (x === 1 || x === 2 || x === 5 || x === 6)) return shade(o.brows || hair, 0.85);
    if (y === 4) { if (x === 1 || x === 6) return '#f2f2f2'; if (x === 2 || x === 5) return eye; }
    if (y === 5 && (x === 3 || x === 4)) return sk(0.86);
    if (y === 6 && (x === 3 || x === 4)) return o.mouth || mix(sk(0.75), '#a04040', 0.35);
    if (o.blush && y === 5 && (x === 1 || x === 6)) return mix(skin, '#e08080', 0.45);
    if (o.freckles && y === 5 && (x === 1 || x === 2 || x === 5 || x === 6) && (x + y) % 2) return sk(0.82);
    if (o.age && y === 5 && (x === 0 || x === 7)) return sk(0.88);
    return undefined;
  });
  // Борода и усы
  const beard = o.beard || 'none';
  if (beard !== 'none') {
    K.face('head', 'front', (x, y) => {
      const b = K.cloth(beardC, 0.08);
      if (beard === 'stubble') return y >= 6 && (x + y) % 2 === 0 && x !== 3 && x !== 4 ? shade(skin, 0.7) : undefined;
      if (y === 5 && (x === 2 || x === 5) && beard !== 'short') return b;
      if (y === 6 && x >= 2 && x <= 5) return beard === 'mustache' && (x === 3 || x === 4) ? b : b;
      if (beard === 'mustache') return y === 7 && (x === 1 || x === 6) ? b : undefined;
      if (y === 6 && (x <= 1 || x >= 6) && beard !== 'short') return b;
      if (y === 7) return (x === 3 || x === 4) && beard === 'short' ? shade(skin, 0.75) : b;
      return undefined;
    });
    // мундштук рта в бороде
    if (beard === 'full' || beard === 'long') K.face('head', 'front', (x, y) => (y === 7 && (x === 3 || x === 4) ? shade(beardC, 0.7) : undefined));
    for (const side of ['right', 'left']) K.face('head', side, (x, y) => {
      const front = side === 'right' ? x > 4 : x < 3;
      if (beard === 'stubble' || beard === 'mustache') return undefined;
      return front && y >= 5 ? K.cloth(beardC, 0.08) : undefined;
    });
    if (beard === 'long') {
      // длинная борода спускается на грудь (верхний слой тела)
      K.face('jacket', 'front', (x, y) => (x >= 1 && x <= 6 && y < (x === 1 || x === 6 ? 2 : x === 2 || x === 5 ? 4 : 5) ? K.cloth(beardC, 0.08) : undefined));
    }
  }
  if (o.soot) for (const [x, y] of [[1, 6], [6, 5], [7, 6]]) K.face('head', 'front', (fx, fy) => (fx === x && fy === y ? sk(0.6) : undefined));

  // Тело: рубаха/рубище, пояс
  const tunic = o.tunic || '#7a5a3a';
  K.around('body', (x, y, side) => {
    if (o.belt && y === (o.beltY ?? 8)) return side === 'front' && (x === 3 || x === 4) ? (o.buckle || '#c8a040') : K.cloth(o.belt, 0.05);
    if (y === 0 && side === 'front' && x >= 3 && x <= 4 && o.collar !== false) return sk(0.95);
    return K.cloth(y > 9 && o.hem ? shade(tunic, 0.85) : tunic);
  }, (x, y, side) => (side === 'top' ? K.cloth(tunic) : K.cloth(o.trousers || '#4a4038')));
  // Руки
  const shirt = o.shirt || tunic;
  for (const arm of ['rArm', 'lArm']) K.around(arm, (x, y) => {
    const sl = o.sleeves || 'long';
    if (sl === 'short' && y >= 4) return K.cloth(skin, 0.03);
    if (sl === 'rolled' && y >= 6) return y === 6 ? shade(shirt, 0.8) : K.cloth(skin, 0.03);
    if (y >= 11) return o.gloves ? K.cloth(o.gloves, 0.05) : K.cloth(skin, 0.03);
    if (y === 10 && o.cuff) return K.cloth(o.cuff, 0.05);
    return K.cloth(shirt);
  }, (x, y, side) => (side === 'top' ? K.cloth(shirt) : o.gloves ? o.gloves : sk(0.9)));
  // Ноги: штаны и сапоги
  const boots = o.boots || '#3a2a1e';
  for (const leg of ['rLeg', 'lLeg']) K.around(leg, (x, y) => {
    if (y >= (o.bootTop ?? 7)) return y === 11 ? shade(boots, 0.7) : K.cloth(boots, 0.05);
    return K.cloth(o.trousers || '#4a4038');
  }, (x, y, side) => (side === 'top' ? K.cloth(o.trousers || '#4a4038') : shade(boots, 0.6)));
  // Длинный подол (рубаха, ряса, сарафан) — верхний слой ног
  if (o.robe) {
    const len = o.robeLen ?? 12;
    for (const leg of ['rPants', 'lPants']) K.around(leg, (x, y) => (y < len ? (y === len - 1 ? shade(o.robe, 0.8) : K.cloth(o.robe)) : undefined));
  }
  if (o.soot) for (const arm of ['rArm', 'lArm']) K.around(arm, (x, y) => (y > 6 && K.rnd() < 0.12 ? shade(skin, 0.6) : undefined));
  return K;
}

// ---------- Детали ----------
const D = {
  // Кольчуга: серые колечки в шахматку
  mail(K, part, rows = [0, 12], amp = 1) {
    K.around(part, (x, y) => (y >= rows[0] && y < rows[1] ? ((x + y) % 2 ? shade('#9aa0a6', 0.95 + K.rnd() * 0.1 * amp) : shade('#6c7278', 0.95 + K.rnd() * 0.1)) : undefined));
  },
  // Сюрко (накидка поверх кольчуги) с гербом: красное поле, жёлтая башня
  tabard(K, color = '#9c2a22', trim = '#d8b040', emblem = true) {
    for (const side of ['front', 'back']) K.face('jacket', side, (x, y) => {
      if (x === 0 || x === 7) return undefined;
      if (y === 11) return trim;
      if (x === 1 || x === 6) return K.cloth(shade(color, 0.85));
      if (emblem && side === 'front') {
        const tower = (x >= 3 && x <= 4 && y >= 3 && y <= 7) || (y === 2 && (x === 2 || x === 5 || x === 3 || x === 4) && x !== 3) || (y === 3 && (x === 2 || x === 5)) || (y === 2 && x === 2) || (y === 2 && x === 5);
        if (tower) return y === 7 ? shade(trim, 0.8) : trim;
      }
      return K.cloth(color, 0.05);
    });
    for (const leg of ['rPants', 'lPants']) K.around(leg, (x, y, side) => (y < 3 && (side === 'front' || side === 'back') ? (y === 2 ? trim : K.cloth(color, 0.05)) : undefined));
  },
  // Шелом с наносником и бармицей (верхний слой головы)
  helmet(K, steel = '#a8adb2', plume) {
    K.around('hat', (x, y, side) => {
      const st = K.cloth(steel, 0.06);
      if (y === 0) return shade(steel, 1.1);
      if (y === 1) return side === 'front' ? shade(steel, 0.8) : st;
      if (side === 'front') return (x === 3 || x === 4) && y <= 4 ? shade(steel, 0.85) : undefined;
      if (y <= 2) return st;
      // бармица — кольчужная сетка на шее
      if (side === 'back' || (side === 'right' && x < 6) || (side === 'left' && x > 1)) return y >= 4 ? ((x + y) % 2 ? '#8a9096' : '#5c6268') : st;
      return undefined;
    }, (x, y, side) => (side === 'top' ? (plume && x >= 3 && x <= 4 ? plume : (x + y) % 3 ? steel : shade(steel, 1.12)) : undefined));
  },
  hood(K, c, faceOpen = true) {
    K.around('hat', (x, y, side) => {
      if (side === 'front') return y <= 1 || ((x === 0 || x === 7) && faceOpen) ? K.cloth(c) : undefined;
      return K.cloth(c);
    }, (x, y, side) => (side === 'top' ? K.cloth(c) : undefined));
  },
  kerchief(K, c, dots) {
    K.around('hat', (x, y, side) => {
      const col = dots && (x + 2 * y) % 4 === 0 ? dots : K.cloth(c);
      if (side === 'front') return y <= 1 ? col : undefined;
      if (side === 'back') return y <= 6 ? col : y === 7 && (x === 3 || x === 4) ? shade(c, 0.8) : undefined;
      return y <= 4 || (side === 'right' ? x < 3 : x > 4) && y <= 6 ? col : undefined;
    }, (x, y, side) => (side === 'top' ? K.cloth(c) : undefined));
  },
  crown(K) {
    const gold = '#e0b33a';
    K.around('hat', (x, y, side) => {
      if (y === 2) return shade(gold, 0.85);
      if (y === 1) return (x + (side === 'front' ? 0 : 1)) % 3 === 1 && side === 'front' ? (x < 4 ? '#c0283a' : '#2f5fb0') : gold;
      if (y === 0) return x % 3 === 1 ? shade(gold, 1.1) : undefined;
      if (y === 3 && side !== 'front') return '#f2efe6'; // меховая опушка
      return undefined;
    });
  },
  furHat(K, c = '#6b4a2e', top = '#3d6b4a') {
    K.around('hat', (x, y) => (y <= 2 ? K.cloth(y === 2 ? c : c, 0.15) : undefined), (x, y, side) => (side === 'top' ? (x > 0 && x < 7 && y > 0 && y < 7 ? K.cloth(top) : K.cloth(c, 0.15)) : undefined));
  },
  // Плащ на спине (верхний слой тела, задняя грань и края)
  cloak(K, c, clasp = '#d8b040', fur) {
    K.face('jacket', 'back', () => K.cloth(c));
    for (const side of ['right', 'left']) K.face('jacket', side, () => K.cloth(shade(c, 0.9)));
    K.face('jacket', 'front', (x, y) => (y === 0 && (x === 0 || x === 7) ? clasp : x === 0 || x === 7 ? K.cloth(c) : undefined));
    for (const leg of ['rPants', 'lPants']) K.face(leg, 'back', (x, y) => (y < 10 ? K.cloth(c) : undefined));
    if (fur) {
      K.face('jacket', 'back', (x, y) => (y === 0 ? (x % 2 ? '#f0ece0' : '#202020') : undefined));
      K.face('jacket', 'front', (x, y) => (y === 0 ? (x === 3 || x === 4 ? undefined : x % 2 ? '#f0ece0' : '#202020') : undefined));
      for (const side of ['right', 'left']) K.face('jacket', side, (x, y) => (y === 0 ? (x % 2 ? '#f0ece0' : '#202020') : undefined));
    }
  },
  apron(K, c = '#ece6d6', legs = 8, top = 2) {
    K.face('jacket', 'front', (x, y) => (x >= 1 && x <= 6 && y >= top ? K.cloth(c, 0.04) : (y === 8 || (y < top && (x === 1 || x === 6))) ? shade(c, 0.8) : undefined));
    K.face('rPants', 'front', (x, y) => (y < legs && x >= 1 ? (y === legs - 1 ? shade(c, 0.85) : K.cloth(c, 0.04)) : undefined));
    K.face('lPants', 'front', (x, y) => (y < legs && x <= 2 ? (y === legs - 1 ? shade(c, 0.85) : K.cloth(c, 0.04)) : undefined));
  },
  // Перевязь наискось через грудь (колчан, сумка, гусли)
  strap(K, c) {
    K.face('jacket', 'front', (x, y) => (x === 7 - Math.floor(y * 0.65) || x === 7 - Math.floor(y * 0.65) - 1 ? K.cloth(c, 0.05) : undefined));
    K.face('jacket', 'back', (x, y) => (x === Math.floor(y * 0.65) ? K.cloth(c, 0.05) : undefined));
  },
  quiver(K) {
    K.face('jacket', 'back', (x, y) => {
      if (x >= 4 && x <= 6 && y >= 1 && y <= 9) return y === 1 ? shade('#5a3a20', 0.8) : K.cloth('#7a4e2a', 0.08);
      if (y === 0 && x >= 4 && x <= 6) return x === 5 ? '#e8e8e8' : '#c03030';
      return undefined;
    });
  },
  cross(K, c = '#d8d8d8', y0 = 2) {
    K.face('body', 'front', (x, y) => (((x === 3 || x === 4) && y >= y0 && y <= y0 + 4) || (y === y0 + 1 && x >= 2 && x <= 5) ? c : undefined));
  },
  keys(K, y = 8) {
    K.face('body', 'front', (x, fy) => ((x === 6 && fy >= y && fy <= y + 2) || (x === 5 && fy === y + 2) ? '#d0a838' : undefined));
  },
  buttons(K, c = '#d0a838', from = 1, to = 7) {
    K.face('body', 'front', (x, y) => ((x === 3 || x === 4) && y >= from && y <= to ? (x === 3 && y % 2 === 0 ? c : shade(K.get(20 + x, 20 + y) || '#000000', 0.85)) : undefined));
  },
  stars(K, part, c = '#f0d860', p = 0.08) {
    K.around(part, (x, y) => (K.rnd() < p ? c : undefined));
  },
  glasses(K) {
    K.face('hat', 'front', (x, y) => (y === 4 && (x === 0 || x === 3 || x === 4 || x === 7) ? '#5a4630' : y === 4 && (x === 1 || x === 2 || x === 5 || x === 6) ? undefined : undefined));
    K.face('hat', 'right', (x, y) => (y === 4 && x >= 4 ? '#5a4630' : undefined));
    K.face('hat', 'left', (x, y) => (y === 4 && x <= 3 ? '#5a4630' : undefined));
  },
  braid(K, c) {
    K.face('jacket', 'back', (x, y) => ((x === 3 || x === 4) && y <= 9 ? (y === 9 ? '#c03030' : (x + y) % 2 ? K.cloth(c, 0.08) : shade(c, 0.8)) : undefined));
  },
  headband(K, c, beads) {
    K.around('hat', (x, y, side) => (y === 1 ? (beads && side === 'front' && x % 2 ? beads : K.cloth(c)) : y === 0 && side === 'front' && x >= 2 && x <= 5 ? K.cloth(c) : undefined));
  },
};

// ---------- Жители ----------
const SKIN = { light: '#e8b796', fair: '#f0c4a4', ruddy: '#e0a07e', tan: '#c98d66', old: '#e0b49a', dark: '#a8724e' };
const NPC = [
  { id: 'vsevolod', name: 'Король Всеволод', stage: 0, role: 'старый больной король, хозяин замка', draw: (s) => {
    const K = person({ skin: SKIN.old, hair: '#d8d8d4', hairStyle: 'long', beard: 'long', beardColor: '#e6e6e2', eyes: '#5a6a7a', age: 1,
      tunic: '#6a1f3a', shirt: '#6a1f3a', cuff: '#d8b040', belt: '#d8b040', buckle: '#c0283a', trousers: '#4a1a2e', boots: '#8a2a20', robe: '#5a1830', hem: 1 }, s);
    D.crown(K); D.cloak(K, '#7a2238', '#e0b33a', true);
    K.face('body', 'front', (x, y) => ((x === 3 || x === 4) && y > 8 ? '#d8b040' : undefined));
    return K;
  } },
  { id: 'agafya', name: 'Повариха Агафья', stage: 0, role: 'кухня', draw: (s) => {
    const K = person({ skin: SKIN.ruddy, hair: '#7a4a2a', hairStyle: 'short', blush: 1, eyes: '#5a4a2a',
      tunic: '#3e5f8a', shirt: '#ece6d6', sleeves: 'rolled', trousers: '#3e5f8a', boots: '#4a3020', robe: '#3e5f8a', mouth: '#b05050' }, s);
    D.kerchief(K, '#b8302a', '#f2ece0'); D.apron(K, '#ece6d6', 9, 1);
    return K;
  } },
  { id: 'frol', name: 'Конюх Фрол', stage: 0, role: 'конюшня', draw: (s) => {
    const K = person({ skin: SKIN.tan, hair: '#5a3a1e', hairStyle: 'curly', beard: 'full', beardColor: '#5a3a1e', eyes: '#4a3a1a',
      tunic: '#6e5232', shirt: '#4f6b3a', sleeves: 'rolled', belt: '#3a2a1a', trousers: '#5a4a3a', boots: '#3a2616', bootTop: 5 }, s);
    // кожаная безрукавка со шнуровкой
    K.face('jacket', 'front', (x, y) => (y < 10 && (x <= 2 || x >= 5) ? K.cloth('#7a5434', 0.08) : y < 10 && (x === 3 || x === 4) && y % 2 ? '#2a1a10' : undefined));
    K.face('jacket', 'back', (x, y) => (y < 10 ? K.cloth('#7a5434', 0.08) : undefined));
    return K;
  } },
  { id: 'ostap', name: 'Стражник Остап', stage: 0, role: 'привратник, старший из двух', draw: (s) => {
    const K = person({ skin: SKIN.ruddy, hair: '#8a8a86', hairStyle: 'short', beard: 'mustache', beardColor: '#a8a8a2', eyes: '#4a5a6a', age: 1,
      tunic: '#7a7f86', shirt: '#7a7f86', belt: '#4a3020', trousers: '#5a4636', boots: '#3a2616', gloves: '#5a3a22' }, s);
    D.mail(K, 'body'); D.mail(K, 'rArm', [0, 9]); D.mail(K, 'lArm', [0, 9]); D.tabard(K); D.helmet(K);
    return K;
  } },
  { id: 'mitka', name: 'Стражник Митька', stage: 0, role: 'привратник, молодой', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#d8b060', hairStyle: 'bowl', freckles: 1, blush: 1, eyes: '#4a7ab0',
      tunic: '#7a7f86', shirt: '#7a7f86', belt: '#4a3020', trousers: '#5a4636', boots: '#3a2616', gloves: '#5a3a22' }, s);
    D.mail(K, 'body'); D.mail(K, 'rArm', [0, 9]); D.mail(K, 'lArm', [0, 9]); D.tabard(K); D.helmet(K, '#b4b8bc');
    // вихор из-под шлема
    K.face('hat', 'front', (x, y) => (y === 2 && (x === 1 || x === 6) ? '#d8b060' : undefined));
    return K;
  } },
  { id: 'demyan', name: 'Капитан Демьян Беляк', stage: 1, role: 'начальник стражи, младший брат сотника Ярослава', draw: (s) => {
    const K = person({ skin: SKIN.tan, hair: '#2a2220', hairStyle: 'short', beard: 'short', beardColor: '#2a2220', eyes: '#3a3020',
      tunic: '#7a7f86', shirt: '#7a7f86', belt: '#2a1a10', buckle: '#e0c050', trousers: '#3a3436', boots: '#2a1a12', gloves: '#3a2a1e', cuff: '#8a1e1e' }, s);
    D.mail(K, 'body'); D.mail(K, 'rArm', [0, 9]); D.mail(K, 'lArm', [0, 9]);
    // пластинчатый доспех (зерцало) и красный плащ
    K.face('jacket', 'front', (x, y) => (x >= 1 && x <= 6 && y >= 1 && y <= 7 ? (y % 2 ? '#c0c4c8' : '#8e9398') : y === 8 && x >= 1 && x <= 6 ? '#2a1a10' : undefined));
    D.cloak(K, '#8a1e1e', '#e0c050');
    D.helmet(K, '#c8ccd0', '#c03030');
    K.face('head', 'front', (x, y) => (x === 6 && (y === 3 || y === 5) ? shade(SKIN.tan, 0.75) : undefined)); // шрам
    return K;
  } },
  ...[['zhdan', 'Стражник Ждан', SKIN.light, '#6a4a2a', 'full', '#6a4a2a'], ['gavrila', 'Стражник Гаврила', SKIN.dark, '#1e1a18', 'short', '#1e1a18'], ['luka', 'Стражник Лука', SKIN.fair, '#a0522d', 'stubble', '#a0522d']].map(([id, name, sk, hair, beard, bc]) => ({
    id, name, stage: 1, role: 'стражник гарнизона', draw: (s) => {
      const K = person({ skin: sk, hair, hairStyle: 'short', beard, beardColor: bc, eyes: '#4a4a3a', tunic: '#7a7f86', shirt: '#7a7f86', belt: '#4a3020', trousers: '#4a4440', boots: '#3a2616', gloves: '#5a3a22' }, s);
      D.mail(K, 'body'); D.mail(K, 'rArm', [0, 9]); D.mail(K, 'lArm', [0, 9]); D.tabard(K); D.helmet(K);
      return K;
    },
  })),
  { id: 'savva', name: 'Лучник Савва', stage: 1, role: 'стрелок на стенах', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#5a3a1e', hairStyle: 'short', beard: 'stubble', eyes: '#3a6a3a',
      tunic: '#4a6a3a', shirt: '#6a5038', belt: '#3a2a1a', trousers: '#5a4a38', boots: '#4a3020', gloves: '#6a4a2a', bootTop: 5 }, s);
    D.hood(K, '#3a5a30'); D.strap(K, '#5a3a20'); D.quiver(K);
    K.face('jacket', 'front', (x, y) => (y >= 10 ? K.cloth('#4a6a3a') : undefined));
    return K;
  } },
  { id: 'gordey', name: 'Кузнец Гордей', stage: 2, role: 'кузница', draw: (s) => {
    const K = person({ skin: SKIN.tan, hair: '#1a1614', hairStyle: 'bald', beard: 'full', beardColor: '#1a1614', eyes: '#3a2a1a', soot: 1,
      tunic: '#8a6a4a', shirt: '#8a6a4a', sleeves: 'short', belt: '#2a1a10', trousers: '#3a3430', boots: '#2a1a12', gloves: '#4a3020' }, s);
    D.apron(K, '#5a3a22', 10, 0);
    return K;
  } },
  { id: 'vaska', name: 'Подмастерье Васька', stage: 2, role: 'кузница', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#c0582a', hairStyle: 'curly', freckles: 1, eyes: '#4a6a3a', soot: 1,
      tunic: '#b8a888', shirt: '#b8a888', sleeves: 'rolled', belt: '#3a2a1a', trousers: '#5a5048', boots: '#3a2616' }, s);
    D.apron(K, '#6a4a2e', 6, 3);
    return K;
  } },
  { id: 'ignat', name: 'Кастелян Игнат', stage: 3, role: 'управитель, главный по хозяйству', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#6a5a4a', hairStyle: 'short', beard: 'short', beardColor: '#7a6a5a', eyes: '#4a5a6a', age: 1,
      tunic: '#2e5a3e', shirt: '#2e5a3e', cuff: '#d0a838', belt: '#3a2a1a', trousers: '#3a3a40', boots: '#3a2616', robe: '#2e5a3e', robeLen: 6 }, s);
    D.buttons(K); D.keys(K); D.furHat(K, '#6b4a2e', '#2e5a3e');
    return K;
  } },
  { id: 'dunya', name: 'Служанка Дуня', stage: 3, role: 'комната служанок, бельевая', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#e0c070', hairStyle: 'short', blush: 1, eyes: '#4a7ab0',
      tunic: '#5a8ab8', shirt: '#f0ece0', trousers: '#5a8ab8', boots: '#6a3a20', robe: '#5a8ab8', collar: false }, s);
    D.headband(K, '#b83030', '#e0c050'); D.braid(K, '#e0c070');
    K.face('body', 'front', (x, y) => (y === 0 ? '#f0ece0' : undefined));
    return K;
  } },
  { id: 'varlaam', name: 'Отец Варлаам', stage: 4, role: 'священник часовни', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#8a7a6a', hairStyle: 'long', beard: 'long', beardColor: '#9a8a7a', eyes: '#4a3a2a', age: 1,
      tunic: '#1e1e22', shirt: '#1e1e22', trousers: '#1e1e22', boots: '#1a1a1a', robe: '#1e1e22' }, s);
    K.around('hat', (x, y, side) => (y <= 2 ? K.cloth('#18181c', 0.04) : undefined), (x, y, side) => (side === 'top' ? '#18181c' : undefined));
    D.cross(K, '#d8d8d8', 5);
    return K;
  } },
  { id: 'evsey', name: 'Переписчик Евсей', stage: 5, role: 'скрипторий, библиотека', draw: (s) => {
    const K = person({ skin: SKIN.light, hair: '#8a6a4a', hairStyle: 'bald', beard: 'short', beardColor: '#8a6a4a', eyes: '#4a4a3a',
      tunic: '#6a5a46', shirt: '#6a5a46', belt: '#3a2a1a', trousers: '#4a4038', boots: '#3a2a1e', robe: '#6a5a46' }, s);
    // чернильные пятна на пальцах, перо за ухом
    K.around('rArm', (x, y) => (y === 11 && x % 2 ? '#1a2a5a' : undefined));
    K.face('hat', 'right', (x, y) => (x === 5 && y >= 1 && y <= 4 ? (y === 1 ? '#f0f0f0' : '#d8d8d8') : undefined));
    return K;
  } },
  { id: 'lenz', name: 'Звездочёт Ленц', stage: 5, role: 'картограф Аркадий Ленц, вернувшийся из квадрата Г-7', draw: (s) => {
    const K = person({ skin: SKIN.old, hair: '#c8c8c4', hairStyle: 'short', beard: 'short', beardColor: '#c8c8c4', eyes: '#5a6a8a', age: 1,
      tunic: '#22305a', shirt: '#22305a', cuff: '#d8b040', belt: '#5a3a20', trousers: '#2a2a3a', boots: '#3a2616', robe: '#22305a' }, s);
    D.stars(K, 'body'); D.stars(K, 'rPants'); D.stars(K, 'lPants');
    K.around('hat', (x, y) => (y <= 1 ? K.cloth('#1a2448') : undefined), (x, y, side) => (side === 'top' ? K.cloth('#1a2448') : undefined));
    D.glasses(K);
    return K;
  } },
  { id: 'semka', name: 'Голубятник Сёмка', stage: 5, role: 'мальчишка с голубятни', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#7a5a3a', hairStyle: 'bowl', freckles: 1, blush: 1, eyes: '#5a7a4a',
      tunic: '#c8c0a8', shirt: '#c8c0a8', belt: '#6a3a20', trousers: '#6a6a70', boots: '#5a4030', bootTop: 9 }, s);
    // заплатки и голубиное перо на шапке
    K.face('lPants', 'front', (x, y) => (y >= 3 && y <= 5 && x >= 1 && x <= 2 ? '#8a6a4a' : undefined));
    K.around('hat', (x, y) => (y <= 1 ? K.cloth('#5a5a60') : undefined), (x, y, side) => (side === 'top' ? K.cloth('#5a5a60') : undefined));
    K.face('hat', 'left', (x, y) => (x === 2 && y <= 2 ? '#e8e8ec' : undefined));
    return K;
  } },
  { id: 'marfa', name: 'Травница Марфа', stage: 6, role: 'лекарская; та самая ведунья из сгоревшего дома', draw: (s) => {
    const K = person({ skin: SKIN.old, hair: '#b8b4ac', hairStyle: 'long', eyes: '#4a6a3a', age: 1,
      tunic: '#6a5032', shirt: '#d8d0b8', belt: '#3a5a2a', trousers: '#5a4630', boots: '#3a2a1e', robe: '#6a5032' }, s);
    D.kerchief(K, '#4a6a3a'); D.strap(K, '#5a4a30');
    // пучки трав на поясе
    K.face('body', 'front', (x, y) => ((x === 1 || x === 5) && y >= 9 ? (y === 9 ? '#3a5a2a' : '#6a9a4a') : undefined));
    return K;
  } },
  { id: 'prokhor', name: 'Тюремщик Прохор', stage: 7, role: 'бывший углежог, знает тайны Рыжего', draw: (s) => {
    const K = person({ skin: SKIN.ruddy, hair: '#2a2220', hairStyle: 'bald', beard: 'stubble', eyes: '#3a2a1a', soot: 1,
      tunic: '#3a3430', shirt: '#5a4a3a', sleeves: 'rolled', belt: '#2a1a10', trousers: '#2e2a28', boots: '#1e1610' }, s);
    K.face('jacket', 'front', (x, y) => (y < 10 && (x <= 1 || x >= 6) ? K.cloth('#2a221e') : undefined));
    K.face('jacket', 'back', (x, y) => (y < 10 ? K.cloth('#2a221e') : undefined));
    D.keys(K, 7); K.face('body', 'front', (x, y) => ((x === 1 || x === 2) && y >= 9 && y <= 10 ? '#8a8a8a' : undefined));
    return K;
  } },
  { id: 'timosha', name: 'Менестрель Тимоша', stage: 8, role: 'музыкант, гусляр', draw: (s) => {
    const K = person({ skin: SKIN.fair, hair: '#d8a040', hairStyle: 'long', beard: 'mustache', beardColor: '#d8a040', eyes: '#3a6a9a', blush: 1,
      tunic: '#c8a020', shirt: '#b02a2a', belt: '#5a2a6a', trousers: '#b02a2a', boots: '#4a2a5a' }, s);
    // кафтан на две половины: жёлтая и красная, ноги наоборот
    K.around('body', (x, y, side) => ((side === 'front' && x >= 4) || (side === 'back' && x < 4) || side === 'left' ? (y === 8 ? undefined : K.cloth('#b02a2a')) : undefined));
    K.around('lLeg', (x, y) => (y < 7 ? K.cloth('#c8a020') : undefined));
    D.strap(K, '#7a4a20');
    // шапка с пером
    K.around('hat', (x, y) => (y <= 1 ? K.cloth('#3a6a4a') : undefined), (x, y, side) => (side === 'top' ? K.cloth('#3a6a4a') : undefined));
    K.face('hat', 'left', (x, y) => (x >= 2 && x <= 4 && y === 0 ? '#e8e0f0' : x === 3 && y === 1 ? '#d8d0e0' : undefined));
    return K;
  } },
];

const skinPng = (id) => { const i = NPC.findIndex((n) => n.id === id); if (i < 0) throw new Error('нет скина ' + id); return NPC[i].draw(1000 + i * 7919).png(); };
function render(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const n of NPC) fs.writeFileSync(path.join(outDir, n.id + '.png'), skinPng(n.id));
}

// ---------- Просмотр: каждый житель спереди и сзади ----------
function lineup(outDir) {
  const cards = NPC.map((n) => {
    const data = fs.readFileSync(path.join(outDir, n.id + '.png')).toString('base64');
    return `{id:'${n.id}',name:${JSON.stringify(n.name)},role:${JSON.stringify(n.role)},stage:${n.stage},src:'data:image/png;base64,${data}'}`;
  });
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Жители замка</title>
<style>
:root{--bg:#f4efe4;--card:#fffaf0;--ink:#2a2420;--muted:#7a6e60;--line:#d8ccb4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1c1a17;--card:#26231f;--ink:#eee6d8;--muted:#a89c8a;--line:#3a352e}}
:root[data-theme="dark"]{--bg:#1c1a17;--card:#26231f;--ink:#eee6d8;--muted:#a89c8a;--line:#3a352e}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 Georgia,serif;padding:16px}
h1{font-size:22px;margin:0 0 4px}p.sub{margin:0 0 16px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.c{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center}
.c canvas{image-rendering:pixelated;width:100%;height:auto}
.n{font-weight:bold;margin-top:6px}.r{font-size:12px;color:var(--muted)}.s{font-size:11px;color:var(--muted);margin-top:2px}
</style></head><body>
<h1>Жители замка</h1><p class="sub">Скины на модель игрока, 64×64. Слева — вид спереди, справа — сзади. Этап — когда житель появляется.</p>
<div class="grid" id="g"></div>
<script>
const NPC=[${cards.join(',\n')}];
// Развёртки: [u,v,w,h,d]
const P={head:[0,0,8,8,8],hat:[32,0,8,8,8],body:[16,16,8,12,4],jacket:[16,32,8,12,4],rArm:[40,16,4,12,4],rSleeve:[40,32,4,12,4],lArm:[32,48,4,12,4],lSleeve:[48,48,4,12,4],rLeg:[0,16,4,12,4],rPants:[0,32,4,12,4],lLeg:[16,48,4,12,4],lPants:[0,48,4,12,4]};
const face=(p,side)=>{const[u,v,w,h,d]=P[p];return side==='front'?[u+d,v+d,w,h]:[u+2*d+w,v+d,w,h]};
function draw(img,cv){
  const S=6,ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
  const put=(p,side,x,y,over)=>{const[sx,sy,w,h]=face(p,side);const g=over?0.5:0;ctx.drawImage(img,sx,sy,w,h,(x-g)*S,(y-g)*S,(w+2*g)*S,(h+2*g)*S)};
  const fig=(ox,side)=>{const F=side==='front';
    // спереди слева от зрителя правая рука и нога, сзади — левые
    const L=F?['rArm','rSleeve','rLeg','rPants']:['lArm','lSleeve','lLeg','lPants'],R=F?['lArm','lSleeve','lLeg','lPants']:['rArm','rSleeve','rLeg','rPants'];
    put('head',side,ox+4,1);put(L[2],side,ox+4,21);put(R[2],side,ox+8,21);put('body',side,ox+4,9);put(L[0],side,ox,9);put(R[0],side,ox+12,9);
    put(L[3],side,ox+4,21,1);put(R[3],side,ox+8,21,1);put('jacket',side,ox+4,9,1);put(L[1],side,ox,9,1);put(R[1],side,ox+12,9,1);put('hat',side,ox+4,1,1)};
  fig(1,'front');fig(19,'back');
}
const g=document.getElementById('g');
for(const n of NPC){const d=document.createElement('div');d.className='c';const cv=document.createElement('canvas');cv.width=36*6;cv.height=34*6;d.append(cv);
  d.insertAdjacentHTML('beforeend','<div class="n">'+n.name+'</div><div class="r">'+n.role+'</div><div class="s">этап '+n.stage+'</div>');g.append(d);
  const img=new Image();img.onload=()=>draw(img,cv);img.src=n.src;}
</script></body></html>`;
  fs.writeFileSync(path.join(outDir, 'lineup.html'), html);
}

module.exports = { NPC, render, skinPng };
if (require.main === module) {
  const out = path.resolve(__dirname, '../design/skins');
  render(out); lineup(out);
  console.log(`Скины: ${NPC.length} → ${path.relative(process.cwd(), out)}`);
}
