// Опускная решётка главных ворот. Рычаги (CASTLE.portcullis.levers): у ворот со стороны двора,
// снаружи и у лебёдки в каждой надвратной башне. Повернул любой — решётка идёт вниз или вверх
// по одному ряду (видно и слышно, как она опускается), за ~1 секунду. Если в проёме стоит
// игрок или существо, ряд ждёт, пока проход освободится (решётка никого не придавит).
// Проверка: /scriptevent acastle:gate open | close | status
import { world, system } from '@minecraft/server';
import { S, DIM, players } from './state.js';
import { CASTLE } from './castle_data.js';

const KEY = 'acastle:gate';
let G = null; // { closed: false }
let anim = null; // { dir: 'down' | 'up', row, until, waits }
const load = () => { try { G = JSON.parse(world.getDynamicProperty(KEY) || 'null'); } catch (e) { G = null; } if (!G) G = { closed: false }; };
const save = () => world.setDynamicProperty(KEY, JSON.stringify(G));
const Wc = (c) => ({ x: S.origin[0] + c[0], y: S.origin[1] + c[1], z: S.origin[2] + c[2] });
const blk = (p) => { try { return DIM().getBlock(p); } catch (e) { return undefined; } };
function sound(id, p) { try { DIM().playSound(id, p, { volume: 0.8, pitch: 0.7 }); } catch (e) { /* ничего */ } }

export function isGateLever(block) {
  if (!S || !S.origin || !CASTLE.portcullis || !block) return false;
  const l = block.location;
  return CASTLE.portcullis.levers.some((c) => { const w = Wc(c); return w.x === l.x && w.y === l.y && w.z === l.z; });
}
// Кто-то стоит в клетках ряда?
function blocked(row) {
  let near = [];
  try { const c = Wc(row[Math.floor(row.length / 2)]); near = DIM().getEntities({ location: { x: c.x + 0.5, y: c.y, z: c.z + 0.5 }, maxDistance: 5 }); } catch (e) { near = []; }
  near = [...near, ...players()]; // игроков — отдельно, наверняка
  return near.some((e) => row.some((r) => { const w = Wc(r); return Math.floor(e.location.x) === w.x && Math.floor(e.location.z) === w.z && e.location.y > w.y - 1.8 && e.location.y < w.y + 1; }));
}
export function toggleGate(want) {
  if (!S || !S.origin || !CASTLE.portcullis) return 'Замок ещё не поставлен.';
  if (!G) load();
  const close = want === undefined ? !G.closed : want;
  if (close === G.closed && !anim) return close ? 'Решётка уже опущена.' : 'Решётка уже поднята.';
  const rows = CASTLE.portcullis.rows;
  // опускаем сверху вниз (ряд 3 → 0), поднимаем снизу вверх (ряд 0 → 3)
  anim = { dir: close ? 'down' : 'up', row: close ? rows.length - 1 : 0, until: system.currentTick, waits: 0 };
  G.closed = close; save();
  const mid = Wc(rows[0][Math.floor(rows[0].length / 2)]);
  sound('block.chain.place', mid);
  for (const pl of players()) if (Math.hypot(pl.location.x - mid.x, pl.location.z - mid.z) < 32) pl.onScreenDisplay.setActionBar(close ? '§7Решётка опускается' : '§7Решётка поднимается');
  return close ? 'Решётка опускается.' : 'Решётка поднимается.';
}
// Каждый тик: следующий ряд решётки
export function gateTick() {
  if (!anim || !S || !S.origin) return;
  if (system.currentTick < anim.until) return;
  const rows = CASTLE.portcullis.rows, row = rows[anim.row];
  if (!row) { anim = null; return; }
  if (anim.dir === 'down' && blocked(row) && anim.waits < 200) { anim.waits++; anim.until = system.currentTick + 10; return; }
  for (const c of row) {
    const b = blk(Wc(c));
    if (!b) { anim.until = system.currentTick + 20; return; } // ворота не прогружены — подождём
  }
  for (const c of row) { const b = blk(Wc(c)); try { b.setType(anim.dir === 'down' ? 'minecraft:iron_bars' : 'minecraft:air'); } catch (e) { /* ничего */ } }
  const mid = Wc(row[Math.floor(row.length / 2)]);
  sound(anim.dir === 'down' ? 'random.door_close' : 'random.door_open', mid);
  anim.row += anim.dir === 'down' ? -1 : 1;
  anim.until = system.currentTick + 6;
  if (anim.row < 0 || anim.row >= rows.length) { if (anim.dir === 'down') sound('random.anvil_land', mid); anim = null; }
}
export function gateCommand(msg, src) {
  if (!G) load();
  const cmd = (msg || '').trim();
  const text = cmd === 'open' ? toggleGate(false) : cmd === 'close' ? toggleGate(true) : `Решётка ворот: ${G.closed ? 'опущена' : 'поднята'}${anim ? ' (идёт)' : ''}. Команды: open, close.`;
  if (src && src.sendMessage) src.sendMessage(text); else world.sendMessage(text);
}
