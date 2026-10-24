// Жители: где каждый должен быть, появление на месте, переезд, двойники.
//  • место жителя (S.npcs[id], по умолчанию NPCS[id].start): 'post' — пост стражника, 'home' — его
//    комната в замке, 'gate' — у ворот, 'place:<id>' — место тайги, 'feast:<n>' — Большой зал на
//    пиру, 'at:x,y,z' — точка замка, 'field:x,z' — поверхность перед воротами; null — ушёл;
//  • житель появляется, когда его место прогружено и там твёрдый пол (не в воздухе);
//  • кто стоит не на своём месте (переехал, пока прежнее место было далеко) — исчезает и
//    появляется на новом; лишние копии убираются;
//  • раненый (погиб в бою) возвращается через пару минут.
import { world } from '@minecraft/server';
import { S, W, DIM, center, dist, flat, blockAt, loaded, topAt } from './state.js';
import { CASTLE } from './castle_data.js';
import { NPCS } from './story.js';

export const tagOf = (id) => 'acastle_npc_' + id;
export function npcIdOf(e) {
  try { for (const t of e.getTags()) if (t.startsWith('acastle_npc_')) return t.slice(12); } catch (err) { /* существо пропало */ }
  return null;
}
export const whereOf = (id) => (id in S.npcs ? S.npcs[id] : NPCS[id].start);
export const typeOf = (id) => (NPCS[id].bandit ? 'acastle:bandit' : NPCS[id].guard ? 'acastle:guard' : 'acastle:npc');
export function findNpc(id) { try { return DIM().getEntities({ tags: [tagOf(id)] })[0]; } catch (e) { return undefined; } }

// Точка, где житель должен стоять (в мире), или null, если места нет или оно пока неизвестно
export function npcSpot(id) {
  const where = whereOf(id);
  if (!where) return null;
  if (where === 'post') { const p = CASTLE.posts.find((q) => q.guard === id); return p ? W(p.at) : null; }
  if (where === 'home') return CASTLE.homes[id] ? W(CASTLE.homes[id]) : null;
  if (where === 'gate') return W(NPCS[id].gate || [63, 0, 121]);
  if (where.startsWith('place:')) {
    const pl = S.places[where.slice(6)];
    if (!pl || !pl.host) return null;
    const o = NPCS[id].off || [0, 0];
    return { x: pl.host[0] + o[0], y: pl.host[1], z: pl.host[2] + o[1] };
  }
  if (where.startsWith('feast:')) { const c = CASTLE.feast[+where.slice(6) % CASTLE.feast.length]; return c ? W(c) : null; }
  if (where.startsWith('at:')) return W(where.slice(3).split(',').map(Number));
  if (where.startsWith('field:')) {
    const [x, z] = where.slice(6).split(',').map(Number), p = W([x, 0, z]);
    const top = topAt(p.x, p.z);
    return top ? { x: p.x, y: top.location.y + 1, z: p.z } : null;
  }
  return null;
}

// Насколько далеко житель может отойти от места, прежде чем его вернут: стражник гоняется за
// монстрами, люди Рыжего ходят по лагерю, мирный житель держится своей комнаты.
function strayed(id, e, at) {
  const [r, dy] = NPCS[id].guard ? [40, 24] : NPCS[id].bandit ? [24, 8] : [10, 4];
  return flat(e.location, at) > r || Math.abs(e.location.y - at.y) > dy;
}
const despawn = (id, e) => { try { e.triggerEvent('acastle:despawn'); e.removeTag(tagOf(id)); } catch (err) { /* уже нет */ } };

function spawnNpc(id, at) {
  const n = NPCS[id];
  const e = DIM().spawnEntity(typeOf(id), center(at), { spawnEvent: 'acastle:as_' + (n.skin || id), initialPersistence: true });
  e.nameTag = n.name;
  e.addTag(tagOf(id));
  if (S.st[id]) e.triggerEvent('acastle:' + S.st[id]);
  return e;
}

// Переезд: прежний житель исчезает сразу (если он рядом с игроком), на новом месте появится сам
export function relocate(id) {
  const e = findNpc(id);
  if (!e) return;
  const where = whereOf(id);
  if (!where) { despawn(id, e); return; }
  const at = where.startsWith('field:') ? null : npcSpot(id);
  if (at && strayed(id, e, at)) despawn(id, e);
}

// Можно ли стоять: под ногами твёрдое, на уровне ног и головы — проходимое
const PASSABLE = /air|carpet|short_grass|tall_grass|:fern|large_fern|flower|poppy|dandelion|tulip|orchid|allium|bluet|daisy|cornflower|lily_of|snow_layer|torch|sign|button|pressure_plate|light_block|rail|vine|sapling|mushroom|deadbush|berry_bush|lever/;
export function standable(at) {
  const below = blockAt({ x: at.x, y: at.y - 1, z: at.z }), feet = blockAt(at), head = blockAt({ x: at.x, y: at.y + 1, z: at.z });
  if (!below || !feet || !head) return false;
  if (below.isAir || below.isLiquid) return false;
  const open = (b) => b.isAir || PASSABLE.test(b.typeId);
  return open(feet) && open(head);
}

export const spawnErr = {};
// Раз в несколько секунд: один запрос на всех жителей вокруг, лишних — убрать, недостающих — поставить
export function ensureNpcs() {
  const now = world.getAbsoluteTime();
  const byId = {};
  let all = [];
  try { all = DIM().getEntities({ families: ['acastle_person'] }); } catch (err) { all = []; }
  for (const e of all) { const id = npcIdOf(e); if (id) (byId[id] = byId[id] || []).push(e); }
  for (const [id, list] of Object.entries(byId)) {
    // метка жителя, которого больше нет в сюжете (старая версия), или житель ушёл совсем
    if (!NPCS[id] || !whereOf(id)) { for (const e of list) despawn(id, e); delete byId[id]; }
  }
  for (const id of Object.keys(NPCS)) {
    const where = whereOf(id);
    if (!where) continue;
    const at = npcSpot(id);
    let list = byId[id] || [];
    if (at) {
      // Двойники и заблудившиеся: оставляем ближайшего к месту. Кто бежит, на поводке или
      // в бою (S.st), остаётся, где есть.
      if (!S.st[id]) list.sort((p, q) => dist(p.location, at) - dist(q.location, at));
      for (const extra of list.slice(1)) despawn(id, extra);
      list = list.slice(0, 1);
      if (list[0] && !S.st[id] && strayed(id, list[0], at)) { despawn(id, list[0]); list = []; }
    }
    if (list.length || !at) continue;
    if (S.down[id] && S.down[id] > now) continue; // ранен — отлёживается
    if (!loaded(at) || !standable(at)) continue; // места не видно или пола ещё нет — позже
    try { spawnNpc(id, at); delete spawnErr[id]; } catch (err) {
      const e = spawnErr[id] = spawnErr[id] || { n: 0 };
      e.n++; e.msg = String(err);
      if (e.n === 5) world.sendMessage(`§c[Замок] Не получается поставить жителя «${NPCS[id].name}»: ${e.msg}`);
    }
  }
}

// Жители в нескольких шагах от игрока (кроме тех, кто сейчас дерётся с ним)
export function residentsNear(pl, r = 6) {
  let list = [];
  try { list = DIM().getEntities({ location: pl.location, maxDistance: r, families: ['acastle_person'] }); } catch (e) { list = []; }
  return list.map((e) => npcIdOf(e)).filter((id) => id && NPCS[id] && !(NPCS[id].bandit && S.st[id] === 'hostile'));
}
