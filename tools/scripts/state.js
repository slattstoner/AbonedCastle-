// Состояние сюжета и общие помощники движка. Прогресс — одна запись в памяти мира (S),
// общая для всех игроков. Координаты в данных замка — относительно его угла, S.origin — этот
// угол в мире (W переводит координаты замка в мировые).
import { world } from '@minecraft/server';
import { CASTLE } from './castle_data.js';
import { QUESTS } from './story.js';

const KEY = 'acastle:state';
export const DIM = () => world.getDimension('overworld');

// S — живая привязка: другие модули видят новое значение после load() и setS()
export let S = null;
let dirty = false;

export function fresh() {
  return { v: 1, origin: null, q: {}, f: {}, n: {}, rep: {}, arrive: [], npcs: {}, places: {}, down: {}, st: {}, day: world.getDay(), guide: null, rank: 'Гость' };
}
export function load() {
  try { S = JSON.parse(world.getDynamicProperty(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = fresh();
  S.down = S.down || {}; S.st = S.st || {};
  // Сохранение от прежней версии: задания и подряды, которых больше нет, убираем —
  // иначе на них спотыкаются утренний ремонт, книга заданий и путеводитель
  for (const q of Object.keys(S.q)) if (!QUESTS[q]) delete S.q[q];
  if (S.guide && !QUESTS[S.guide]) S.guide = null;
  for (const u of Object.keys(S.rep)) if (!CASTLE.units[u]) delete S.rep[u];
}
export function setS(next) { S = next; dirty = true; }
export const save = () => { dirty = true; };
export function flush() { if (dirty && S) { world.setDynamicProperty(KEY, JSON.stringify(S)); dirty = false; } }

// ---------- Координаты и мир ----------
export const W = (c) => ({ x: S.origin[0] + c[0], y: S.origin[1] + c[1], z: S.origin[2] + c[2] });
export const center = (p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5 });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function blockAt(p) { try { return DIM().getBlock(p); } catch (e) { return undefined; } }
export const loaded = (p) => !!blockAt(p);
export const players = () => world.getPlayers();
export function nearest(p) {
  let best = null, bd = Infinity;
  for (const pl of players()) { const d = flat(pl.location, p); if (d < bd) { bd = d; best = pl; } }
  return [best, bd];
}
export function topAt(x, z) { try { return DIM().getTopmostBlock({ x, z }); } catch (e) { return undefined; } }
export function runCmd(c) { try { return DIM().runCommand(c).successCount; } catch (e) { return 0; } }
