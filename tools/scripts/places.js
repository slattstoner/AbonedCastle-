// Места тайги по заданию (острог, станы, хутор, лагерь Рыжего…). Точку выбирает задание
// (api.setPlace), место встаёт командой /place, когда игрок подходит и участок прогружен.
// В каждой постройке лежит метка хозяина — невидимый блок света; по ней ставится житель места.
import { system } from '@minecraft/server';
import { S, save, W, DIM, blockAt, nearest, topAt } from './state.js';
import { CASTLE } from './castle_data.js';
import { PLACES } from './places_data.js';
import { onEvent } from './story.js';
import { api } from './api.js';

const scans = {};
// Все участки под местом прогружены (иначе /place отложит постройку)
function areaLoaded(p, size) {
  const r = Math.ceil(Math.max(...size) / 2) + 2;
  for (const [dx, dz] of [[0, 0], [-r, -r], [r, -r], [-r, r], [r, r]]) {
    try { if (!DIM().isChunkLoaded({ x: p.x + dx, y: 64, z: p.z + dz })) return false; } catch (e) { return false; }
  }
  return true;
}

// Земля под точкой: верхний блок может быть кроной ели или снегом — спускаемся до твёрдого
const SOFT = /leaves|_log$|snow_layer|short_grass|tall_grass|fern|flower|bush|sapling|vine|mushroom|deadbush|berry|air/;
function groundAt(x, z) {
  let b = topAt(x, z);
  for (let i = 0; b && i < 48 && !b.isLiquid && SOFT.test(b.typeId); i++) b = blockAt({ x, y: b.location.y - 1, z });
  return b;
}
const ran = (c) => { try { return DIM().runCommand(c).successCount > 0; } catch (e) { return false; } };
// Запасной путь: шаблон места без jigsaw, нижний слой шаблона — слой земли
function loadTemplate(info, p, g) {
  const [sx, sz] = info.size;
  return !!info.template && ran(`structure load ${info.template} ${p.x - Math.floor(sx / 2)} ${g.location.y} ${p.z - Math.floor(sz / 2)}`);
}

export function placesTick() {
  for (const [id, p] of Object.entries(S.places)) {
    const info = PLACES[id];
    if (!info) continue;
    // Сохранение до 0.9.1: место считалось поставленным, даже если /place молча не сработал
    // (метки хозяина не нашлось, хозяин стоит в самой точке) — ставим заново
    if (p.placed && !p.how) {
      if (p.host && p.host[0] === p.x && p.host[2] === p.z && p.host[1] === p.y) { p.placed = false; p.host = null; save(); } else { p.how = 'place'; save(); }
    }
    if (!p.placed) {
      const [pl, d] = nearest({ x: p.x, y: 0, z: p.z });
      if (!pl || d > 72 || !areaLoaded(p, info.size)) continue;
      const g = groundAt(p.x, p.z);
      if (!g) continue;
      if (g.isLiquid || /water|lava|ice/.test(g.typeId)) {
        // В воду не ставим: точка уходит дальше от замка
        const o = W(CASTLE.origin), dx = p.x - o.x, dz = p.z - o.z, k = 40 / Math.max(1, Math.hypot(dx, dz));
        p.x = Math.round(p.x + dx * k); p.z = Math.round(p.z + dz * k); save();
        pl.sendMessage('§7Следы ведут дальше…');
        continue;
      }
      // Сначала /place (подгоняет постройку к рельефу, ставит тропу к дальнему тайнику),
      // если игра его не выполнила — готовый шаблон
      let how = ran(`place structure ${info.structure} ${p.x} ${g.location.y + 1} ${p.z}`) ? 'place' : loadTemplate(info, p, g) ? 'load' : null;
      if (!how) {
        p.fail = (p.fail || 0) + 1; save();
        if (p.fail === 5) pl.sendMessage(`§c[Замок] Место «${id}» не получается поставить. Отойдите на 20 блоков и вернитесь; если не поможет — пришлите скриншот /scriptevent acastle:status.`);
        continue;
      }
      p.placed = true; p.how = how; p.y = g.location.y + 1; p.ground = g.location.y; save();
      scans[id] = { t: 0, tries: 0 };
    } else if (!p.host && !scans[id]) scans[id] = { t: 0, tries: 0 };
  }
  // Поиск метки хозяина вокруг поставленного места. Постройка встаёт не сразу: ищем три раза
  // с паузой, и только потом ставим хозяина посреди места.
  for (const [id, sc] of Object.entries(scans)) {
    const p = S.places[id];
    if (!p || p.host) { delete scans[id]; continue; }
    if (sc.running) continue;
    if (++sc.t < 3 + sc.tries * 5) continue;
    const r = Math.max(...PLACES[id].size) + 2;
    sc.running = true;
    system.runJob((function* () {
      for (let dy = -8; dy <= 16; dy++) for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const b = blockAt({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
          if (b && b.typeId === 'minecraft:light_block_0') {
            p.host = [b.location.x, b.location.y, b.location.z]; b.setType('minecraft:air'); save();
            sc.running = false; onEvent('placed:' + id, api); return;
          }
        }
        yield;
      }
      sc.running = false;
      if (++sc.tries < 3) return;
      // Метки нет: /place «сработал», но постройка не встала — ставим готовый шаблон и ищем снова
      if (p.how === 'place') {
        const g = groundAt(p.x, p.z);
        if (g && loadTemplate(PLACES[id], p, g)) { p.how = 'load'; p.y = g.location.y + 1; save(); scans[id] = { t: 0, tries: 0 }; return; }
      }
      p.host = [p.x, p.y, p.z]; save(); onEvent('placed:' + id, api);
    })());
  }
}
