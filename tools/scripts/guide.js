// Путеводитель к цели выбранного задания (S.guide): в замке — огоньки по пути от ворот
// (CASTLE.paths), в лесу — строка над панелью предметов с расстоянием и направлением, пока
// в руке компас или книга заданий. Цель задания: { path | at | place | tag, label }.
import { S, W, DIM, players, flat, dist } from './state.js';
import { CASTLE } from './castle_data.js';
import { QUESTS } from './story.js';
import { api } from './api.js';

function bearing(pl, to) {
  const v = pl.getViewDirection(), dx = to.x - pl.location.x, dz = to.z - pl.location.z, len = Math.hypot(dx, dz) || 1;
  const tx = dx / len, tz = dz / len, cross = v.x * tz - v.z * tx, dot = v.x * tx + v.z * tz;
  const ang = Math.atan2(cross, dot) * 180 / Math.PI;
  if (Math.abs(ang) < 20) return 'прямо';
  if (Math.abs(ang) > 135) return 'позади';
  return (Math.abs(ang) < 70 ? 'чуть ' : '') + (ang < 0 ? 'левее' : 'правее');
}
function holdingGuide(pl) {
  try { const it = pl.getComponent('minecraft:equippable').getEquipment('Mainhand'); return !!it && (it.typeId === 'minecraft:compass' || it.typeId === 'acastle:quest_book'); } catch (e) { return false; }
}
const pointer = (pl, label, to) => { if (holdingGuide(pl)) pl.onScreenDisplay.setActionBar(`${label} — ${Math.round(flat(pl.location, to))} бл., ${bearing(pl, to)}`); };

export function guideTick() {
  const q = S.guide && QUESTS[S.guide];
  if (!q || !q.target) return;
  const t = q.target(api);
  if (!t) return;
  for (const pl of players()) {
    if (t.tag) {
      let e; try { e = DIM().getEntities({ tags: [t.tag] })[0]; } catch (err) { e = undefined; }
      const to = e ? e.location : t.near ? (t.near.place ? api.placeAt(t.near.place) : W(t.near)) : null;
      if (to) pointer(pl, t.label, to);
      continue;
    }
    if (t.place) {
      const p = S.places[t.place];
      if (p) pointer(pl, t.label, p.host ? { x: p.host[0], y: p.host[1], z: p.host[2] } : { x: p.x, y: pl.location.y, z: p.z });
      continue;
    }
    const path = t.path && CASTLE.paths[t.path];
    const goal = W(t.at || (path ? path.slice(-3) : CASTLE.square));
    if (flat(pl.location, goal) < 3 && Math.abs(pl.location.y - goal.y) < 3) continue;
    if (!path) { pointer(pl, t.label, goal); continue; }
    // Огоньки: от ближайшей к игроку точки пути на несколько шагов вперёд
    let bi = -1, bd = Infinity;
    for (let i = 0; i < path.length; i += 3) { const d = dist(pl.location, W([path[i], path[i + 1], path[i + 2]])); if (d < bd) { bd = d; bi = i; } }
    // далеко от пути: расстояние до цели, направление — к ближайшей точке пути
    if (bd > 8) { if (holdingGuide(pl)) pl.onScreenDisplay.setActionBar(`${t.label} — ${Math.round(dist(pl.location, goal))} бл., ${bearing(pl, W([path[bi], path[bi + 1], path[bi + 2]]))}`); continue; }
    for (let k = 1; k <= 10; k++) {
      const i = bi + k * 3; if (i >= path.length) break;
      const c = W([path[i], path[i + 1], path[i + 2]]);
      try { DIM().spawnParticle('minecraft:villager_happy', { x: c.x + 0.5, y: c.y + 0.6, z: c.z + 0.5 }); } catch (e) { /* участок не загружен */ }
    }
  }
}
