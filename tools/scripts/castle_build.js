// Стройка замка и начало сюжета.
//  • /function castle шлёт acastle:castle_build: куски замка (32×32, от площади к краям, список
//    CASTLE.build) ставятся по одному. Кусок ставится, только когда все его участки мира
//    прогружены, иначе игра отложит его до прихода игрока. Чтобы не ждать игрока, на время
//    стройки участок куска держится «тикающим» (tickingarea). Если игра не успевает (тик дольше
//    75 мс), следующий кусок ждёт. В конце — «сердце замка», потом начинается сюжет.
//  • Если сигнал не дошёл (замок поставлен старой версией аддона), скрипты находят замок по
//    «сердцу замка» — подставке в камере под площадью.
//  • /scriptevent acastle:status — что знают скрипты: версия, где замок, кто из жителей на месте.
import { world } from '@minecraft/server';
import { S, setS, fresh, load, save, flush, DIM, players, loaded, runCmd } from './state.js';
import { CASTLE } from './castle_data.js';
import { NPCS, QUESTS, onEvent } from './story.js';
import { npcSpot, findNpc, spawnErr } from './people.js';
import { api } from './api.js';

const fromPlayer = (p) => [Math.floor(p.x) - CASTLE.origin[0], Math.floor(p.y) - CASTLE.origin[1], Math.floor(p.z) - CASTLE.origin[2]];

export function beginBuild(p) {
  const st = fresh();
  st.build = { o: fromPlayer(p), i: 0, wait: 20, area: -1, since: 0 };
  setS(st); flush();
}

export function startCastle(origin) {
  const st = fresh();
  st.origin = origin;
  for (const p of CASTLE.posts) if (p.stage === 0) st.npcs[p.guard] = 'post';
  setS(st);
  onEvent('castle', api);
  flush();
  for (const pl of players()) if (!api.count(pl, 'acastle:quest_book')) api.give(pl, 'acastle:quest_book');
  world.sendMessage(`§6Замок ждёт (аддон ${CASTLE.version}). Подойдите к воротам и коснитесь стражника — он заговорит с вами. Книга заданий у вас в сумке.`);
}
// Старый сигнал (до 0.8.2 /function castle ставил куски сам и потом слал acastle:castle_placed)
export const placedByCommand = (p) => startCastle(fromPlayer(p));

// ---------- Стройка ----------
let tickMs = 50, lastNow = Date.now();
export function measureTick() { const now = Date.now(); tickMs = tickMs * 0.8 + (now - lastNow) * 0.2; lastNow = now; }

function pieceBox(o, q) {
  const [, x, y, z, sx, , sz] = q;
  return { a: { x: o[0] + x, y: o[1] + y, z: o[2] + z }, b: { x: o[0] + x + sx - 1, y: o[1] + y, z: o[2] + z + sz - 1 } };
}
function chunksLoaded(a, b) {
  for (let x = a.x; x <= b.x + 15; x += 16) for (let z = a.z; z <= b.z + 15; z += 16) {
    const p = { x: Math.min(x, b.x), y: a.y, z: Math.min(z, b.z) };
    try { if (!DIM().isChunkLoaded(p)) return false; } catch (e) { return false; }
  }
  return true;
}
export function buildTick() {
  const B = S.build, P = CASTLE.build;
  if (B.wait > 0) { B.wait--; return; }
  if (B.i >= P.length) { finishBuild(); return; }
  if (tickMs > 75) return; // игра не успевает — пусть отдышится
  const { a, b } = pieceBox(B.o, P[B.i]);
  if (B.area !== B.i) {
    // участок куска держим загруженным; имена чередуются, прежний убираем после установки
    runCmd(`tickingarea add ${a.x} ${a.y} ${a.z} ${b.x} ${a.y} ${b.z} acastle_build_${B.i % 2} true`);
    B.area = B.i; B.since = 0; save();
    return;
  }
  if (!chunksLoaded(a, b)) {
    if (++B.since === 400) world.sendMessage('§7[Замок] Край замка далеко и не прогружается. Подойдите к нему — стройка продолжится.');
    return;
  }
  try { world.structureManager.place(P[B.i][0], DIM(), a); } catch (e) { console.warn('acastle стройка: ' + e); }
  runCmd(`tickingarea remove acastle_build_${(B.i + 1) % 2}`);
  B.i++; B.wait = 8; save();
  for (const pl of players()) pl.onScreenDisplay.setActionBar(`§6Строится замок: ${B.i} из ${P.length}`);
  if (B.i % 4 === 0) flush();
}
function finishBuild() {
  const B = S.build;
  runCmd('tickingarea remove acastle_build_0'); runCmd('tickingarea remove acastle_build_1');
  const h = { x: B.o[0] + CASTLE.heart[0], y: B.o[1] + CASTLE.heart[1], z: B.o[2] + CASTLE.heart[2] };
  runCmd('kill @e[type=armor_stand,name=acastle_heart]');
  runCmd(`summon armor_stand acastle_heart ${h.x + 0.5} ${h.y} ${h.z + 0.5}`);
  for (const pl of players()) pl.onScreenDisplay.setTitle('§6Замок встал', { subtitle: 'Жители выходят на свои места', fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 });
  startCastle(B.o);
}

// ---------- Запасной путь: «сердце замка» ----------
let heartTick = 0;
export function findHeart() {
  if (++heartTick % 10) return;
  let h;
  try { h = DIM().getEntities({ type: 'minecraft:armor_stand', name: 'acastle_heart' })[0]; } catch (e) { h = undefined; }
  if (!h) return;
  const l = h.location;
  startCastle([Math.floor(l.x) - CASTLE.heart[0], Math.floor(l.y) - CASTLE.heart[1], Math.floor(l.z) - CASTLE.heart[2]]);
}

// ---------- Самопроверка ----------
export function status() {
  if (!S) load();
  const lines = [`§6[Замок] аддон ${CASTLE.version}, скрипты работают.`];
  if (S.build) lines.push(`Замок строится: ${S.build.i} из ${CASTLE.build.length}.`);
  else if (!S.origin) lines.push('Замок скриптам неизвестен: поставьте его командой /function castle.');
  else {
    lines.push(`Угол замка: ${S.origin.join(' ')}. Звание: ${S.rank}.`);
    lines.push('Задания: ' + (Object.keys(S.q).filter((q) => S.q[q] === 'active').map((q) => QUESTS[q].title).join(', ') || 'нет'));
    const here = [], away = [];
    for (const id of Object.keys(NPCS)) {
      const at = npcSpot(id); if (!at) continue;
      const e = findNpc(id);
      (e ? here : away).push(NPCS[id].name + (e ? '' : loaded(at) ? (spawnErr[id] ? ' (ошибка: ' + spawnErr[id].msg + ')' : ' (сейчас появится)') : ' (далеко)'));
    }
    lines.push('На месте: ' + (here.join(', ') || 'никого'));
    if (away.length) lines.push('Нет на месте: ' + away.join(', '));
  }
  world.sendMessage(lines.join('\n'));
}
