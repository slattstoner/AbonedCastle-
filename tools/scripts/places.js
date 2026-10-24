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

export function placesTick() {
  for (const [id, p] of Object.entries(S.places)) {
    const info = PLACES[id];
    if (!info) continue;
    if (!p.placed) {
      const [pl, d] = nearest({ x: p.x, y: 0, z: p.z });
      if (!pl || d > 72 || !areaLoaded(p, info.size)) continue;
      const top = topAt(p.x, p.z);
      if (!top) continue;
      if (top.isLiquid || /water|lava|ice/.test(top.typeId)) {
        // В воду не ставим: точка уходит дальше от замка
        const o = W(CASTLE.origin), dx = p.x - o.x, dz = p.z - o.z, k = 40 / Math.max(1, Math.hypot(dx, dz));
        p.x = Math.round(p.x + dx * k); p.z = Math.round(p.z + dz * k); save();
        pl.sendMessage('§7Следы ведут дальше…');
        continue;
      }
      // ошибка команды — попробуем позже; повторно уже поставленное место не ставим
      try { DIM().runCommand(`place structure ${info.structure} ${p.x} ${top.location.y + 1} ${p.z}`); } catch (e) { continue; }
      p.placed = true; p.y = top.location.y + 1; save();
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
      p.host = [p.x, p.y, p.z]; save(); onEvent('placed:' + id, api);
    })());
  }
}
