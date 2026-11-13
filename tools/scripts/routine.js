// Распорядок жителей (0.11.0): каждый ходит от своего места к рабочим местам рядом — верстаку,
// кафедре, очагу, котлу, полкам (CASTLE.spots: вид места, куда смотреть, путь по клеткам от дома),
// стоит там за делом и возвращается. Пока житель у рабочего места, он говорит о своей работе.
// Ходьба — маленькими шагами по готовому пути (сквозь стены и мебель не идёт).
import { world, system } from '@minecraft/server';
import { S, W, DIM } from './state.js';
import { CASTLE } from './castle_data.js';
import { tagOf, whereOf } from './people.js';

const R = {}; // id → { e, st: 'rest' | 'go' | 'work' | 'back', spot, k, until }
const pick = (l) => l[Math.floor(Math.random() * l.length)];
// Что житель говорит у рабочего места: по виду места, у некоторых — свои слова
const BY_KIND = {
  map: ['Межу надо сверить ещё раз.', 'Вот здесь, у ручья, старая карта врёт.'], book: ['Тише, читаю.', 'Тут записано иначе, чем говорят.'], shelf: ['Не на той полке… А, вот она.', 'Пыль двадцати лет.'],
  fire: ['Дров бы подкинуть.', 'Огонь держать — тоже работа.'], brew: ['Не дыши над склянкой.', 'Ещё три капли — и готово.'], cauldron: ['Вода закипает.', 'Сполоснуть и на место.'],
  loom: ['Нитка опять рвётся.', 'К зиме надо успеть.'], tools: ['Наточить бы.', 'Инструмент любит порядок.'], stars: ['Ночью будет ясно.', 'Звёзды сегодня сдвинулись на волос.'],
  music: ['Струна фальшивит…', '♪ Ушёл во тьму — вернётся в зарю… ♪'], bell: ['К вечерне пора звонить.', 'Колокол слышно до самого бора.'], hay: ['Сена до весны хватит, если беречь.', 'Сухое. Хорошо.'],
  store: ['Считаю запас.', 'Одного мешка не хватает. Опять.'], candle: ['Фитиль подрезать.', 'Свечей мало. Беречь надо.'], plant: ['Полить забыли.', 'Растёт, упрямый.'], wall: ['Висит криво.', 'Хорошая работа, старая.'], banner: ['Знамя рода. Выцвело, а держится.'],
};
const OWN = {
  agafya: { fire: ['Похлёбка поспевает. Не лезь под руку.', 'Вертел сам себя не повернёт.'], store: ['Соли на донышке. Муки на неделю.'], cauldron: ['Котёл выскрести — и за тесто.'] },
  lenz: { map: ['Квадрат Г-7… Жила уходит под гору.', 'Межа замка идёт по ручью. Запомни.'], book: ['Счисление не сходится на полградуса.'] },
  evsey: { book: ['«В лето… от основания детинца…» Дальше размыто.', 'Переписываю грамоту. Не дыши на чернила.'], shelf: ['Летописи — наверх, счёт — вниз.'], map: ['Нестор чертил лучше меня.'] },
  marfa: { cauldron: ['Отвар для короля. Горький, да не тот горький.'], plant: ['Зверобой, девясил, сон-трава.'], store: ['Склянки не трогай.'] },
  varlaam: { candle: ['За упокой Елены. За здравие Ефрема.'], plant: ['Цветы к алтарю.'] },
  frol: { hay: ['Ласточке — лучшее сено.', 'Овса бы ещё.'], cauldron: ['Напоить, почистить, расчесать.'] },
  ignat: { book: ['Приход, расход… Опять не сходится.'], store: ['Всё по описи. Почти всё.'], shelf: ['Бумаги двадцатилетней давности. Читаю как страшную сказку.'] },
  dunya: { cauldron: ['Стирки на три дня.'], store: ['Всё, что теряют, ко мне приходит.'] },
  demyan: { wall: ['План обороны. Третья редакция.'], store: ['Оружие по счёту. По моему счёту.'], fire: ['Смена греется — и на пост.'] },
  semka: { hay: ['Сизарь, Белянка, кыш с гнезда!'], store: ['Письмо? Нет, пусто. Ждём.'] },
  prokhor: { wall: ['Ключи на месте. Все до одного.'], fire: ['Внизу сыро. Тут хоть греюсь.'] },
  vsevolod: { fire: ['Раньше у этого огня сидели вдвоём.'], store: ['Её вещи… Не трогаю.'] },
  timosha: { music: ['Новую песню складываю. Про того, кто поднял замок.', '♪ Спи, мой лосёнок, под белой луной… ♪'] },
  onisim: { candle: ['Сорок свечей — сорок душ.'], cauldron: ['Святая вода. Руки не суй.'] },
  feodor: { candle: ['Поминальник длинный. Читаю с утра.'], plant: ['На могилы снесу.'] },
};
export function routineLine(id) {
  const r = R[id];
  if (!r || r.st !== 'work' || !r.spot) return null;
  const own = OWN[id] && OWN[id][r.spot[0]];
  return pick(own || BY_KIND[r.spot[0]] || ['…']);
}
export const routineAt = (id) => (R[id] && R[id].st === 'work' ? R[id].spot[0] : null);

const cellsOf = (sp) => { const out = []; for (let i = 3; i + 2 < sp.length; i += 3) out.push(W([sp[i], sp[i + 1], sp[i + 2]])); return out; };
function place(e, a, b, t, face) {
  const x = a.x + (b.x - a.x) * t + 0.5, z = a.z + (b.z - a.z) * t + 0.5, y = a.y + (b.y - a.y) * t;
  const dx = face ? face.x + 0.5 - x : b.x - a.x, dz = face ? face.z + 0.5 - z : b.z - a.z;
  const yaw = dx || dz ? (Math.atan2(-dx, dz) * 180) / Math.PI : undefined;
  try { e.teleport({ x, y, z }, yaw === undefined ? {} : { rotation: { x: 0, y: yaw } }); } catch (err) { /* участок выгружен */ }
}
let n = 0;
export function routineTick() {
  if (!S || !S.origin || !CASTLE.spots) return;
  const now = system.currentTick, refresh = ++n % 15 === 0;
  let pls = [];
  try { pls = world.getPlayers(); } catch (e) { return; }
  for (const id of Object.keys(CASTLE.spots)) {
    if (whereOf(id) !== 'home') { delete R[id]; continue; }
    const r = R[id] || (R[id] = { st: 'rest', until: now + 200 + Math.floor(Math.random() * 600), k: 0 });
    if (refresh || !r.e) { try { r.e = DIM().getEntities({ tags: [tagOf(id)] })[0]; } catch (e) { r.e = undefined; } }
    const e = r.e;
    let ok = false; try { ok = !!e && e.isValid; } catch (err) { ok = false; }
    if (!ok) { r.e = undefined; continue; }
    if (r.st === 'rest') {
      if (now < r.until) continue;
      // идём, только когда рядом есть игрок: иначе некому смотреть, а участок может быть выгружен
      if (!pls.some((p) => Math.abs(p.location.x - e.location.x) + Math.abs(p.location.z - e.location.z) < 48)) { r.until = now + 200; continue; }
      r.spot = pick(CASTLE.spots[id]); r.path = cellsOf(r.spot); r.k = 0; r.st = r.path.length > 1 ? 'go' : 'work'; r.until = now + 500 + Math.floor(Math.random() * 500);
      continue;
    }
    if (r.st === 'go' || r.st === 'back') {
      const P = r.path, last = P.length - 1;
      r.k += 0.3;
      if (r.k >= last) {
        place(e, P[last], P[last], 0, r.st === 'go' ? { x: W([r.spot[1], 0, r.spot[2]]).x, z: W([r.spot[1], 0, r.spot[2]]).z } : null);
        if (r.st === 'go') { r.st = 'work'; r.until = now + 500 + Math.floor(Math.random() * 500); } else { r.st = 'rest'; r.until = now + 400 + Math.floor(Math.random() * 800); }
        continue;
      }
      const i = Math.floor(r.k);
      place(e, P[i], P[i + 1], r.k - i);
      continue;
    }
    if (r.st === 'work' && now >= r.until) { r.path = cellsOf(r.spot).reverse(); r.k = 0; r.st = r.path.length > 1 ? 'back' : 'rest'; r.until = now + 400; }
  }
}
