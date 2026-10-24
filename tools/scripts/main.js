// Движок заданий замка: точка входа. Только стабильные модули игры (@minecraft/server,
// @minecraft/server-ui), без экспериментальных настроек. Здесь — подписки на события игры
// и общие циклы; работа разложена по модулям:
//   state.js        — прогресс S в памяти мира, координаты замка, общие помощники;
//   people.js       — жители: где стоят, появление, переезд, двойники;
//   api.js          — помощники для сюжета (задания, предметы, ремонт, места);
//   talk.js         — окна: разговор и книга заданий;
//   castle_build.js — стройка замка по кускам, начало сюжета, «сердце замка», самопроверка;
//   repairs.js      — сундуки-подряды и утренний ремонт;
//   places.js       — места тайги по заданию;
//   guide.js        — огоньки-путеводители и указатель;
//   story.js, stages.js — сюжет (что говорят жители и что считается сделанным);
//   castle_data.js, places_data.js — данные, их собирает tools/build.js.
//
// Команды для проверки: /scriptevent acastle:status (что знают скрипты),
// /scriptevent acastle:jump <этап> (сразу к началу этапа).
import { world, system } from '@minecraft/server';
import { S, load, flush, DIM, players } from './state.js';
import { NPCS, QUESTS, onEvent, bark, jump } from './story.js';
import { npcIdOf, ensureNpcs } from './people.js';
import { api } from './api.js';
import { talk, openBook } from './talk.js';
import { beginBuild, placedByCommand, buildTick, measureTick, findHeart, status } from './castle_build.js';
import { contractTick, morningTick } from './repairs.js';
import { placesTick } from './places.js';
import { guideTick } from './guide.js';
import { CASTLE } from './castle_data.js';

const story = () => !!(S && S.origin); // сюжет идёт (замок поставлен)
const warn = (what, e) => console.warn(`acastle ${what}: ${e}${e && e.stack ? '\n' + e.stack : ''}`);

// ---------- Разговор ----------
world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  if (!story()) return;
  const id = npcIdOf(target);
  if (id && NPCS[id]) talk(player, id);
});
// На iPhone касание существа — это удар. Стражник и мирный житель урона от игрока не получают,
// поэтому касание открывает разговор; с людьми Рыжего — только если игрок пригнулся.
// Посреди боя (монстр рядом) касание остаётся ударом мимо: окно не открывается.
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
  if (!story() || !damagingEntity || damagingEntity.typeId !== 'minecraft:player') return;
  const id = npcIdOf(hitEntity);
  if (!id || !NPCS[id]) return;
  if (NPCS[id].bandit && (!damagingEntity.isSneaking || S.st[id] === 'hostile')) return;
  let fight = [];
  try { fight = DIM().getEntities({ location: damagingEntity.location, maxDistance: 8, families: ['monster'] }); } catch (e) { fight = []; }
  if (fight.length) return;
  talk(damagingEntity, id);
});

// ---------- Книга заданий ----------
world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (story() && itemStack.typeId === 'acastle:quest_book') openBook(source);
});
// Блоки, у которых своё действие: с книгой в руке их открывают, а не книгу
const OWN_ACTION = /chest|barrel|door|gate|lever|button|lectern|bed|table|furnace|smoker|anvil|grindstone|loom|stonecutter|brewing|cauldron|campfire|bell|shelf|frame|sign|composter|hopper|dispenser|dropper|jukebox|noteblock|beehive|pot|shulker/;
world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
  if (!story()) return;
  // Запасной путь для книги: на телефоне долгое нажатие по земле с книгой в руке
  if (ev.itemStack && ev.itemStack.typeId === 'acastle:quest_book' && !OWN_ACTION.test(ev.block.typeId)) openBook(ev.player);
  try { onEvent('block', api, ev); } catch (e) { warn('block', e); }
});

// ---------- Команды ----------
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  try {
    if (ev.id === 'acastle:status') status();
    else if (ev.id === 'acastle:jump' && story()) { jump(parseInt(ev.message, 10) || 0, api); flush(); }
    else if (ev.id === 'acastle:castle_build' && ev.sourceEntity) beginBuild(ev.sourceEntity.location);
    else if (ev.id === 'acastle:castle_placed' && ev.sourceEntity) placedByCommand(ev.sourceEntity.location);
  } catch (e) { warn(ev.id, e); }
});
// Приветствие при входе в мир: видно, что работает нужная версия аддона
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    if (!S) load();
    try { player.sendMessage(`§7[Замок] Аддон ${CASTLE.version}: скрипты работают.${S.origin ? '' : S.build ? ' Замок строится.' : ' Замок ещё не поставлен: /function castle'}`); } catch (e) { /* игрок вышел */ }
  }, 100);
});

// ---------- Бой и события существ ----------
world.afterEvents.entityDie.subscribe((ev) => {
  if (!story()) return;
  // Житель погиб в бою: он ранен и вернётся на своё место через пару минут
  const id = npcIdOf(ev.deadEntity);
  if (id && NPCS[id]) {
    S.down[id] = world.getAbsoluteTime() + 2400; api.save();
    if (NPCS[id].guard) api.tell(`§7${NPCS[id].name} ранен, его унесли в казарму. Через пару минут вернётся на пост.`);
  }
  try { onEvent('die', api, ev); } catch (e) { warn('die', e); }
});
world.afterEvents.entityHurt.subscribe((ev) => { if (story()) try { onEvent('hurt', api, ev); } catch (e) { warn('hurt', e); } });
world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
  if (!story() || !ev.eventId.startsWith('acastle:')) return;
  try { onEvent('trigger', api, ev); } catch (e) { warn('trigger', e); }
});

// ---------- Циклы ----------
// Стройка замка: каждый тик (там же замер, успевает ли игра)
system.runInterval(() => {
  measureTick();
  if (!S) load();
  if (S.build) try { buildTick(); } catch (e) { warn('стройка', e); }
}, 1);
// Общий цикл: путеводитель — дважды в секунду, остальное — раз в секунду, жители — раз в 3 секунды
let tick = 0;
const questsTick = () => { for (const q of Object.keys(S.q)) if (S.q[q] === 'active' && QUESTS[q] && QUESTS[q].tick) QUESTS[q].tick(api); };
const SECOND = [morningTick, contractTick, placesTick, questsTick, () => { if (tick % 6 === 0) ensureNpcs(); }];
system.runInterval(() => {
  if (!S) load();
  if (!S.origin) { if (!S.build) try { findHeart(); } catch (e) { /* позже */ } flush(); return; }
  tick++;
  try { guideTick(); } catch (e) { warn('путеводитель', e); }
  if (tick % 2 === 0) for (const fn of SECOND) { try { fn(); } catch (e) { warn('цикл', e); } }
  flush();
}, 10);
// Короткие реплики, когда игрок проходит рядом (не чаще раза в полминуты от жителя)
const barked = {};
system.runInterval(() => {
  if (!story()) return;
  const now = system.currentTick;
  for (const pl of players()) {
    let near = [];
    try { near = DIM().getEntities({ location: pl.location, maxDistance: 5, families: ['acastle_person'] }); } catch (e) { continue; }
    for (const e of near) {
      const id = npcIdOf(e);
      if (!id || !NPCS[id] || (barked[id] && now - barked[id] < 600)) continue;
      barked[id] = now;
      let line = null;
      try { line = bark(id, api, pl); } catch (err) { warn('реплика', err); }
      if (line) { pl.onScreenDisplay.setActionBar(`§e${NPCS[id].name}:§r ${line}`); break; }
    }
  }
}, 40);
