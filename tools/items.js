// Предметы аддона (0.9.0): Королевская грамота, три комплекта брони и три клинка.
// Всё рисуется кодом: значки 16×16, текстуры брони 64×32 (два слоя, как у ванильной брони).
// Броня надевается как обычная: предмет с minecraft:wearable в пакете поведения и
// «attachable» в пакете внешности (по образцу Mojang bedrock-samples, attachables/iron_*.json).
// Бонусы полного комплекта и свойства клинков — в скриптах (tools/scripts/relics.js).
'use strict';

const { png, tone, mix } = require('./skins');
const NS = 'acastle';

// ---------- Комплекты ----------
// prot — защита по частям (шлем, нагрудник, поножи, сапоги); у железа 2-6-5-2, у алмаза 3-8-6-3.
const SETS = {
  watch: {
    title: 'Латы стражи детинца', bonus: 'Сопротивление урону',
    names: ['Шлем стражи детинца', 'Кираса стражи детинца', 'Поножи стражи детинца', 'Сапоги стражи детинца'],
    prot: [2, 6, 5, 2], dur: [240, 350, 330, 280], ench: 12, repair: 'minecraft:iron_ingot',
    pal: { K: '#20242c', a: '#8f99a6', b: '#c3ccd6', c: '#5d6672', d: '#8a1e1e', e: '#d8b040' },
  },
  hunter: {
    title: 'Доспех охотницы', bonus: 'Скорость и ночное зрение',
    names: ['Капюшон охотницы', 'Куртка охотницы', 'Штаны охотницы', 'Сапоги охотницы'],
    prot: [2, 5, 4, 2], dur: [210, 300, 280, 240], ench: 15, repair: 'minecraft:leather',
    pal: { K: '#1c2416', a: '#44613a', b: '#6f8f58', c: '#2c4027', d: '#6b4526', e: '#cdbf9c' },
  },
  founder: {
    title: 'Латы основателя', bonus: 'Сила, сопротивление урону и защита от огня',
    names: ['Шлем основателя', 'Латы основателя', 'Поножи основателя', 'Сабатоны основателя'],
    prot: [3, 8, 6, 3], dur: [480, 700, 650, 560], ench: 18, repair: 'minecraft:gold_ingot',
    pal: { K: '#0d1016', a: '#3b4252', b: '#616b80', c: '#232836', d: '#d8b040', e: '#8fd8e8' },
  },
};
const PIECES = ['helmet', 'chestplate', 'leggings', 'boots'];
const SLOTS = ['slot.armor.head', 'slot.armor.chest', 'slot.armor.legs', 'slot.armor.feet'];
const ENCH = ['armor_head', 'armor_torso', 'armor_legs', 'armor_feet'];
const SWORDS = {
  keep_blade: { name: 'Клинок детинца', damage: 8, dur: 600, ench: 12, repair: 'minecraft:iron_ingot', pal: { K: '#20242c', a: '#aab4c0', b: '#e4eaf0', c: '#6c7684', d: '#8a1e1e', e: '#d8b040' } },
  hunter_cleaver: { name: 'Тесак охотницы', damage: 7, dur: 450, ench: 15, repair: 'minecraft:iron_ingot', pal: { K: '#1c2416', a: '#9aa890', b: '#d5dfc8', c: '#5f6d58', d: '#6b4526', e: '#44613a' } },
  dawn: { name: 'Меч основателя «Заря»', damage: 10, dur: 1561, ench: 18, repair: 'minecraft:gold_ingot', pal: { K: '#0d1016', a: '#e8d9a0', b: '#fff6d0', c: '#b89a4a', d: '#d8b040', e: '#8fd8e8' } },
};

// ---------- Значки 16×16 ----------
// K — контур, a — основной цвет, b — блик, c — тень, d — отделка, e — вторая отделка, . — пусто
const ICON = {
  helmet: [
    '................',
    '.....KKKKKK.....',
    '...KKbbbaaaKK...',
    '..KbbbaaaaaacK..',
    '..KbbaaddaaacK..',
    '.KbbaaaddaaaacK.',
    '.KddddddddddddK.',
    '.KbaaKKddKKaacK.',
    '.KbaK..dd..KacK.',
    '.KbaK..dd..KacK.',
    '.KaaK..ee..KccK.',
    '.KacK......KccK.',
    '.KKKK......KKKK.',
    '................',
    '................',
    '................',
  ],
  chestplate: [
    '................',
    '.KKKK......KKKK.',
    'KbbaaK....KaaacK',
    'KbaaaaKKKKaaaacK',
    'KbaaaadddaaaaacK',
    'KKKaaaddddaaaKKK',
    '..KbaadeedaacK..',
    '..KbaadeedaacK..',
    '..KbaaaddaaacK..',
    '..KbaaaddaaacK..',
    '..KbaaaaaaaacK..',
    '..KddddddddddK..',
    '..KbaaaaaaaacK..',
    '..KaaaaaaaaccK..',
    '..KKKKKKKKKKKK..',
    '................',
  ],
  leggings: [
    '................',
    '..KKKKKKKKKKKK..',
    '..KddddeeddddK..',
    '..KbaaaaaaaacK..',
    '..KbaaaaaaaacK..',
    '..KbaaaKKaaacK..',
    '..KbaaK..KaacK..',
    '..KbdaK..KadcK..',
    '..KbdaK..KadcK..',
    '..KbaaK..KaacK..',
    '..KbaaK..KaacK..',
    '..KaaaK..KaacK..',
    '..KaacK..KaccK..',
    '..KaccK..KcccK..',
    '..KKKKK..KKKKK..',
    '................',
  ],
  boots: [
    '................',
    '................',
    '................',
    '..KKKK....KKKK..',
    '..KeeK....KeeK..',
    '..KbaK....KbaK..',
    '..KbaK....KbaK..',
    '..KbaK....KbaK..',
    '..KddK....KddK..',
    '.KKbaK....KbaKK.',
    'KbbaaK....KaaacK',
    'KbaaaK....KaaacK',
    'KaaacK....KaaccK',
    'KKKKKK....KKKKKK',
    '................',
    '................',
  ],
  sword: [
    '.............KKK',
    '............KbaK',
    '...........KbacK',
    '..........KbacK.',
    '.........KbacK..',
    '........KbacK...',
    '.......KbacK....',
    '..KK..KbacK.....',
    '..KdKKbacK......',
    '...KdKacK.......',
    '....KddK........',
    '...KdKdKK.......',
    '..KdK.KdK.......',
    '.KeK...KK.......',
    '.KKK............',
    '................',
  ],
  cleaver: [
    '..........KKKK..',
    '.........KbbaaK.',
    '........KbaaacK.',
    '.......KbaaacK..',
    '......KbaaacK...',
    '.....KbaaacK....',
    '....KbaaacK.....',
    '....KaaacK......',
    '..KKKaacK.......',
    '..KeeKKK........',
    '...KddK.........',
    '..KdKdK.........',
    '.KdK.KK.........',
    '.KdK............',
    '.KKK............',
    '................',
  ],
  charter: [
    '................',
    '..KKKKKKKKKKKK..',
    '.KbbbbbbbbbbbbK.',
    '.KKaaaaaaaaaaKK.',
    '..KbaccccccabK..',
    '..KbaaaaaaaabK..',
    '..KbaccccccabK..',
    '..KbaaaaaaaabK..',
    '..KbacccccaabK..',
    '..KbaaaaaddabK..',
    '..KbaccadeedbK..',
    '..KbaaaadeedbK..',
    '.KKaaaaaaddaaKK.',
    '.KbbbbbbbbdbbbK.',
    '..KKKKKKKKdKKK..',
    '..........K.....',
  ],
};
for (const [k, rows] of Object.entries(ICON)) {
  if (rows.length !== 16 || rows.some((r) => r.length !== 16)) throw new Error('значок ' + k + ': не 16×16');
}
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function icon(rows, pal) {
  const buf = Buffer.alloc(16 * 16 * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = pal[ch]; if (c) buf.set([...hex(c), 255], (y * 16 + x) * 4); }));
  return png(16, 16, buf);
}
const CHARTER_PAL = { K: '#3a2a16', a: '#ead9a8', b: '#f6ecc8', c: '#7a6238', d: '#9a1c1c', e: '#d43a2a' };

// ---------- Текстуры брони 64×32 ----------
// Развёртка коробки (u, v, ширина, высота, глубина) — как у скина игрока.
const BOX = { head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], arm: [40, 16, 4, 12, 4], leg: [0, 16, 4, 12, 4] };
const LIGHT = { top: 0.7, front: 0, right: -0.5, left: -0.5, back: -0.7, bottom: -1.3 };
function Canvas() {
  const px = Buffer.alloc(64 * 32 * 4);
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
  return {
    // fn(side, x, y, w, h) → цвет, [цвет, оттенок] или null (прозрачно)
    paint(box, fn) {
      const [u, v, w, h, d] = BOX[box];
      const F = { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] };
      for (const [side, [x0, y0, fw, fh]] of Object.entries(F)) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        const r = fn(side, x, y, fw, fh);
        if (!r) continue;
        const [c, t = 0] = Array.isArray(r) ? r : [r];
        const vert = side === 'top' || side === 'bottom' ? 0 : 0.3 - 0.6 * (y / Math.max(1, fh - 1));
        const col = hex(tone(c, t + LIGHT[side] + vert + (rnd() - 0.5) * 0.5));
        px.set([...col, 255], ((y0 + y) * 64 + x0 + x) * 4);
      }
    },
    png: () => png(64, 32, px),
  };
}
const side4 = (s) => s !== 'top' && s !== 'bottom';

function layer1(id, P) {
  const C = Canvas();
  // Шлем
  C.paint('head', (s, x, y, w) => {
    if (id === 'watch') {
      // шапель с наносником и кольчужной бармицей
      if (s === 'front' && y >= 3 && y <= 6 && x >= 1 && x <= 6 && !(x >= 3 && x <= 4 && y <= 5)) return null;
      if (s === 'top') return [P.a, x === 3 || x === 4 ? 0.8 : 0];
      if (s === 'bottom') return null;
      if (y === 2) return [P.b, 0.5]; // поле шлема
      if (y >= 6) return [(x + y) % 2 ? P.c : P.a, -0.6]; // бармица
      if (s === 'front' && (x === 3 || x === 4)) return [P.b, 0.3];
      return P.a;
    }
    if (id === 'hunter') {
      // капюшон с серебряным обручем, лицо открыто
      if (s === 'front' && y >= 2 && x >= 1 && x <= 6) return null;
      if (s === 'bottom') return null;
      if (side4(s) && y === 1) return [P.e, 0.6];
      if (side4(s) && y === 7) return [P.d, -0.3];
      if (s === 'top' && (x + y) % 3 === 0) return [P.b, 0];
      return (x * 3 + y) % 5 === 0 ? [P.c, 0] : P.a;
    }
    // основатель: глухой шлем с прорезью, золотой венец и гребень, рога на боках
    if (s === 'bottom') return null;
    if (s === 'front' && y === 4 && x >= 1 && x <= 6 && x !== 3 && x !== 4) return ['#05070a', 0];
    if (s === 'top') return x === 3 || x === 4 || y === 3 || y === 4 ? [P.d, 0.4] : P.a;
    if (side4(s) && y <= 1) return y === 0 && x % 2 ? [P.d, 0.8] : [P.d, 0.2];
    if (s === 'front' && (x === 3 || x === 4)) return [P.d, 0.3];
    if ((s === 'left' || s === 'right') && ((x === 2 && y === 5) || (x === 3 && y === 4) || (x === 4 && y === 3) || (x === 5 && y === 2) || (x === 5 && y === 4) || (x === 6 && y === 3))) return [P.d, 0.6];
    if (s === 'front' && y === 6 && (x === 3 || x === 4)) return [P.e, 0.8];
    return y === 7 ? [P.c, 0] : P.a;
  });
  // Нагрудник
  C.paint('body', (s, x, y, w, h) => {
    if (s === 'top' || s === 'bottom') return P.c;
    if (id === 'watch') {
      if (y >= 10) return (x + y) % 2 ? [P.c, -0.4] : [P.a, -0.4]; // кольчужный подол
      if ((s === 'front' || s === 'back') && x >= 2 && x <= 5) {
        // красная накидка с золотой башней
        if (s === 'front' && ((y === 3 && (x === 2 || x === 3 || x === 4 || x === 5) && x % 2 === 0) || (y >= 4 && y <= 7 && (x === 3 || x === 4)) || (y === 8 && x >= 2 && x <= 5))) return [P.e, 0.4];
        return P.d;
      }
      if (y === 0) return [P.b, 0.4];
      return (x + y * 2) % 7 === 0 ? [P.b, 0.2] : P.a;
    }
    if (id === 'hunter') {
      if (y <= 1) return [P.e, (x + y) % 2 ? 0.5 : -0.2]; // меховой ворот
      if (s === 'front' && (x === y - 2 || x === y - 3)) return [P.d, 0]; // перевязь
      if (y === 9) return [P.d, -0.2]; // пояс
      if (s === 'front' && y === 9 && (x === 3 || x === 4)) return [P.e, 0.6];
      if (s === 'front' && x === 4 && y >= 3 && y <= 7 && y % 2) return [P.c, -0.2]; // шнуровка
      return (x * 2 + y) % 5 === 0 ? [P.b, -0.2] : P.a;
    }
    // основатель
    if (y === 0 || y === 11) return [P.d, 0.3];
    if ((s === 'front' || s === 'back') && (x === 0 || x === 7)) return [P.d, 0];
    if (s === 'front' && y >= 3 && y <= 6 && x >= 3 && x <= 4) return y === 4 || y === 5 ? [P.e, 0.8] : [P.d, 0.5]; // камень в золоте
    if (s === 'front' && ((y === 2 && (x === 2 || x === 5)) || (y === 3 && (x === 1 || x === 6)) || (y === 7 && (x === 3 || x === 4)))) return [P.d, 0.4]; // лосиные рога
    if (y === 8) return [P.c, -0.3];
    return (x + y) % 4 === 0 ? [P.b, -0.2] : P.a;
  });
  // Руки: наплечник, локоть, наруч
  C.paint('arm', (s, x, y) => {
    if (s === 'bottom') return null;
    if (id === 'hunter') {
      if (s === 'top') return P.e;
      if (y <= 1) return [P.e, (x + y) % 2 ? 0.4 : -0.2];
      if (y >= 8 && y <= 10) return y === 8 ? [P.e, 0.2] : P.d; // наруч с мехом
      if (y === 11) return null;
      return (x + y) % 4 === 0 ? [P.b, -0.2] : P.a;
    }
    const trim = id === 'founder' ? P.d : P.b;
    if (s === 'top') return [P.b, 0.2];
    if (y <= 3) return y === 3 ? [trim, 0.3] : [P.b, 0.1 - y * 0.1];
    if (y >= 4 && y <= 6) return id === 'watch' ? ((x + y) % 2 ? [P.c, -0.3] : [P.a, -0.3]) : [P.c, 0];
    if (y === 7 || y === 10) return [trim, 0];
    if (y === 11) return null;
    return P.a;
  });
  // Сапоги: нижняя часть ноги
  C.paint('leg', (s, x, y) => {
    if (y < 6 && side4(s)) return null;
    if (s === 'top') return null;
    if (s === 'bottom') return [P.K, 0];
    if (id === 'hunter') return y === 6 ? [P.e, (x % 2) * 0.5] : y === 9 ? [P.c, 0] : P.d;
    if (y === 6) return [id === 'founder' ? P.d : P.b, 0.4];
    if (y === 11) return [P.c, -0.3];
    if (id === 'founder' && s === 'front' && (x === 1 || x === 2) && y === 8) return [P.e, 0.6];
    return P.a;
  });
  return C.png();
}
function layer2(id, P) {
  const C = Canvas();
  // Пояс и набедренники
  C.paint('body', (s, x, y) => {
    if (y < 7 || s === 'top' || s === 'bottom') return null;
    if (y === 7) return [id === 'hunter' ? P.d : P.c, 0];
    if (y === 8) return [id === 'watch' ? P.d : id === 'hunter' ? P.d : P.d, 0.2];
    if (s === 'front' && y === 8 && (x === 3 || x === 4)) return [P.e, 0.6];
    return id === 'watch' ? ((x + y) % 2 ? [P.c, -0.2] : [P.a, -0.2]) : P.a;
  });
  // Ноги
  C.paint('leg', (s, x, y) => {
    if (s === 'top' || s === 'bottom') return null;
    if (y >= 10) return null;
    if (id === 'hunter') {
      if (y === 4 || y === 5) return [P.d, y === 4 ? 0.2 : -0.2]; // наколенник из кожи
      return (x + y * 2) % 5 === 0 ? [P.c, 0] : P.a;
    }
    if (y === 4) return [id === 'founder' ? P.d : P.b, 0.5];
    if (y === 5) return [P.b, 0.2];
    if (y === 9) return [id === 'founder' ? P.d : P.c, 0];
    if (id === 'watch' && y < 4) return (x + y) % 2 ? [P.c, -0.2] : [P.a, -0.2];
    return P.a;
  });
  return C.png();
}

// ---------- Запись в пакеты ----------
const GEO = ['helmet', 'chestplate', 'leggings', 'boots'];
const VIS = ['helmet_layer_visible', 'chest_layer_visible', 'leg_layer_visible', 'boot_layer_visible'];
function writeItems(writeBP, writeRP) {
  const textures = {}, lang = [];
  const reg = (id, name, pngBuf) => {
    writeRP(`textures/items/${NS}/${id}.png`, pngBuf);
    textures[`${NS}_${id}`] = { textures: `textures/items/${NS}/${id}` };
    lang.push(`item.${NS}:${id}=${name}`);
  };
  const item = (id, name, components, category = 'equipment') => writeBP(`items/${id}.json`, {
    format_version: '1.21.40',
    'minecraft:item': {
      description: { identifier: `${NS}:${id}`, menu_category: { category } },
      components: { 'minecraft:icon': `${NS}_${id}`, 'minecraft:display_name': { value: name }, 'minecraft:max_stack_size': 1, ...components },
    },
  });
  // Королевская грамота
  reg('charter', 'Королевская грамота', icon(ICON.charter, CHARTER_PAL));
  item('charter', 'Королевская грамота', { 'minecraft:glint': true }, 'items');
  // Броня
  for (const [sid, S] of Object.entries(SETS)) {
    writeRP(`textures/models/armor/${NS}/${sid}_1.png`, layer1(sid, S.pal));
    writeRP(`textures/models/armor/${NS}/${sid}_2.png`, layer2(sid, S.pal));
    PIECES.forEach((piece, i) => {
      const id = `${sid}_${piece}`;
      reg(id, S.names[i], icon(ICON[piece], S.pal));
      item(id, S.names[i], {
        'minecraft:wearable': { slot: SLOTS[i], protection: S.prot[i] },
        'minecraft:durability': { max_durability: S.dur[i] },
        'minecraft:enchantable': { slot: ENCH[i], value: S.ench },
        'minecraft:repairable': { repair_items: [{ items: [S.repair], repair_amount: 'query.max_durability * 0.25' }] },
      });
      writeRP(`attachables/${id}.json`, {
        format_version: '1.8.0',
        'minecraft:attachable': {
          description: {
            identifier: `${NS}:${id}`,
            materials: { default: 'armor', enchanted: 'armor_enchanted' },
            textures: { default: `textures/models/armor/${NS}/${sid}_${piece === 'leggings' ? 2 : 1}`, enchanted: 'textures/misc/enchanted_actor_glint' },
            geometry: { default: `geometry.humanoid.armor.${GEO[i]}` },
            scripts: { parent_setup: `variable.${VIS[i]} = 0.0;` },
            render_controllers: ['controller.render.armor'],
          },
        },
      });
    });
  }
  // Клинки
  for (const [id, W] of Object.entries(SWORDS)) {
    reg(id, W.name, icon(id === 'hunter_cleaver' ? ICON.cleaver : ICON.sword, W.pal));
    item(id, W.name, {
      'minecraft:hand_equipped': true,
      'minecraft:damage': W.damage,
      'minecraft:durability': { max_durability: W.dur },
      'minecraft:enchantable': { slot: 'sword', value: W.ench },
      'minecraft:repairable': { repair_items: [{ items: [W.repair], repair_amount: 'query.max_durability * 0.25' }] },
      'minecraft:can_destroy_in_creative': false,
      'minecraft:tags': { tags: ['minecraft:is_sword'] },
      ...(id === 'dawn' ? { 'minecraft:glint': true } : {}),
    });
  }
  return { textures, lang };
}
const ITEM_IDS = ['charter', ...Object.keys(SETS).flatMap((s) => PIECES.map((p) => `${s}_${p}`)), ...Object.keys(SWORDS)].map((id) => `${NS}:${id}`);

// Значок пакета 128×128: шлем основателя на каменном поле
function packIcon() {
  const N = 128, buf = Buffer.alloc(N * N * 4), P = SETS.founder.pal;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const brick = (Math.floor(y / 16) % 2 ? x + 16 : x) % 32 < 2 || y % 16 < 2;
    const v = brick ? 38 : 58 + ((x * 7 + y * 13) % 9);
    buf.set([v, v + 4, v + 10, 255], (y * N + x) * 4);
  }
  ICON.helmet.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = P[ch]; if (!c) return;
    for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) buf.set([...hex(c), 255], ((12 + y * 7 + dy) * N + 8 + x * 7 + dx) * 4);
  }));
  return png(N, N, buf);
}

// Просмотр значков и текстур: node tools/items.js → design/items/*.png
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const out = path.resolve(__dirname, '../design/items');
  fs.mkdirSync(out, { recursive: true });
  writeItems(() => {}, (rel, data) => { if (Buffer.isBuffer(data)) fs.writeFileSync(path.join(out, rel.replace(/\//g, '_')), data); });
  console.log('Значки и текстуры: ' + out);
}

module.exports = { SETS, SWORDS, PIECES, ITEM_IDS, writeItems, packIcon, mix };
