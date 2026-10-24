// Сюжет замка, этапы 2–9 (docs/castle-story.md). Этапы 0 и 1 — в story.js, он же
// собирает всё вместе. Движок — main.js.
// Каждый этап: сюжетная причина → поход в тайгу по компасу → кто приходит → что чинится.
// В разговорах не называем стороны света: только приметы.
import { world, system } from '@minecraft/server';

const night = () => { const t = world.getTimeOfDay(); return t >= 13000 && t <= 22500; };
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const bye = { text: 'Прощай' };
const GANG = ['ryzhy', 'sych', 'voron', 'grinya', 'pakhom', 'shilo', 'kunitsa'];
// Жители замка, которые на пиру собираются в Большом зале
const HOUSE = ['vsevolod', 'agafya', 'frol', 'gordey', 'vaska', 'ignat', 'dunya', 'varlaam', 'evsey', 'lenz', 'semka', 'marfa', 'prokhor', 'timosha'];

// ---------- Жители ----------
// place:<место> — живёт в месте тайги, пока не придёт в замок; off — сдвиг от хозяина места.
export const LATE_NPCS = {
  savva: { name: 'Лучник Савва', guard: true, start: null },
  gordey: { name: 'Кузнец Гордей', start: null },
  vaska: { name: 'Подмастерье Васька', start: null },
  ignat: { name: 'Кастелян Игнат', start: null },
  dunya: { name: 'Служанка Дуня', start: null },
  varlaam: { name: 'Отец Варлаам', start: null },
  evsey: { name: 'Переписчик Евсей', start: null },
  lenz: { name: 'Звездочёт Ленц', start: null },
  semka: { name: 'Голубятник Сёмка', start: null },
  marfa: { name: 'Травница Марфа', start: null },
  prokhor: { name: 'Тюремщик Прохор', start: null },
  timosha: { name: 'Менестрель Тимоша', start: null },
  kuzma: { name: 'Старшина Кузьма', start: null },
  hunter: { name: 'Охотник Ерофей', start: null, off: [2, 1] },
  nastya: { name: 'Настя Воронина', start: null },
  nikodim: { name: 'Отшельник Никодим', start: null },
  liza: { name: 'Лиза', start: null },
  grach: { name: 'Лесник Ефим Грач', start: null },
  watchman: { name: 'Сторож Гаврила', start: null },
  lykov: { name: 'Служивый Лыков', start: null, off: [2, 0] },
  // Шайка Рыжего и Ножов — вид acastle:bandit
  ryzhy: { name: 'Рыжий', bandit: true, start: null },
  sych: { name: 'Сыч', bandit: true, start: null, off: [0, 9] },
  voron: { name: 'Ворон', bandit: true, start: null, off: [8, 7] },
  grinya: { name: 'Гриня Кривой', bandit: true, start: null, off: [0, -4] },
  pakhom: { name: 'Пахом', bandit: true, start: null, off: [1, 2] },
  shilo: { name: 'Шило', bandit: true, start: null, off: [-4, 3] },
  kunitsa: { name: 'Куница', bandit: true, start: null, off: [-2, -1] },
  trader: { name: 'Торговка', bandit: true, start: null }, // облик Куницы без оружия: событие acastle:as_trader
  nozhov: { name: 'Савелий Ножов', bandit: true, start: null },
};

// ---------- Подряды ----------
export const LATE_CONTRACTS = {
  forge: { title: 'Огонь в горне', who: 'gordey', items: [['minecraft:coal', 32, 'Уголь'], ['minecraft:iron_ingot', 16, 'Железо']],
    done: 'Уголь и железо есть! Ночью разожгу горн и перекрою кузню — утром приходи.' },
  tiltyard: { title: 'Ристалище', who: 'demyan', items: [['minecraft:spruce_planks', 48, 'Еловые доски'], ['minecraft:hay_block', 8, 'Тюки сена']],
    done: 'Доски и сено на месте. К утру будет где ребятам учиться.' },
  steward: { title: 'Дом управителя', who: 'ignat', items: [['minecraft:spruce_planks', 48, 'Еловые доски'], ['minecraft:glass_pane', 16, 'Оконное стекло']] },
  barn: { title: 'Амбар', who: 'ignat', items: [['minecraft:spruce_planks', 16, 'Еловые доски'], ['minecraft:spruce_stairs', 32, 'Еловые ступени']] },
  square: { title: 'Площадь и колодец', who: 'ignat', items: [['minecraft:stone_bricks', 24, 'Каменный кирпич'], ['minecraft:spruce_planks', 24, 'Еловые доски']] },
  yard: { title: 'Двор', who: 'ignat', items: [['minecraft:cobblestone', 32, 'Булыжник'], ['minecraft:lantern', 8, 'Фонари']],
    done: 'Всё есть. Ночью скосим двор и проложим дорожки.' },
  chapel: { title: 'Часовня и кладбище', who: 'varlaam', items: [['minecraft:spruce_planks', 32, 'Еловые доски'], ['minecraft:glass', 16, 'Стекло'], ['minecraft:candle', 8, 'Свечи']],
    done: 'Благослови тебя Бог. К утру часовня будет как прежде.' },
  garden: { title: 'Огород', who: 'marfa', items: [['minecraft:wheat_seeds', 32, 'Семена пшеницы'], ['minecraft:carrot', 8, 'Морковь'], ['minecraft:potato', 8, 'Картофель']],
    done: 'Семена есть. Утром грядки будут вскопаны.' },
  catacombs: { title: 'Завалы в катакомбах', who: 'prokhor', items: [['minecraft:spruce_log', 32, 'Еловые брёвна'], ['minecraft:torch', 32, 'Факелы']],
    done: 'Брёвна для подпорок есть. Ночью разберу завалы.' },
  heritage: { title: 'Наследие', who: 'ignat', items: [['minecraft:gold_block', 2, 'Золотые блоки'], ['minecraft:white_wool', 24, 'Белая шерсть'], ['minecraft:iron_block', 1, 'Железный блок']],
    done: 'Золото для трона, шерсть для знамён, железо для колокола. К утру замок будет твой во всей красе.' },
};

// ---------- Бои ----------
// Бой по волнам: o.ready() — можно начинать, o.stay() — бой продолжается, o.waves — функции,
// которые выводят волну (метят существ o.tag), o.win() / o.lose(). Счёт — над панелью предметов.
export function battle(api, key, o) {
  const S = api.S;
  const mobs = () => api.dim().getEntities({ tags: [o.tag] });
  let b = S.f[key];
  if (!b) {
    if (o.ready()) { b = S.f[key] = { n: 0, wait: 99 }; api.save(); if (o.start) o.start(); }
    return;
  }
  if (!o.stay()) {
    for (const m of mobs()) m.remove();
    S.f[key] = null; api.save();
    if (o.lose) o.lose();
    return;
  }
  let left = mobs().length;
  // Застрявшие (не дойти, не добить) через две минуты разбегаются — бой не висит вечно
  if (left > 0 && ++b.t > 120) { for (const m of mobs()) m.remove(); left = 0; api.tell('§7Остальные разбежались.'); }
  for (const p of api.players()) if (!o.near || o.near(p)) p.onScreenDisplay.setActionBar(`${o.label}: волна ${Math.max(1, b.n)} из ${o.waves.length}, осталось ${left}`);
  if (left > 0) return;
  if (b.n >= o.waves.length) { S.f[key] = null; api.save(); o.win(); return; }
  if (++b.wait < 4) { api.save(); return; }
  b.n++; b.wait = 0; b.t = 0; api.save();
  o.waves[b.n - 1](api);
  if (o.next) o.next(b.n);
}
// Люди Рыжего вокруг точки p (в мире): враждебные, в бою с игроком и стражей
export function raid(api, p, n, tag, rmin = 16, rmax = 24) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = rmin + Math.random() * (rmax - rmin);
    const x = Math.round(p.x + Math.cos(a) * r), z = Math.round(p.z + Math.sin(a) * r);
    const top = api.topAt(x, z);
    if (!top) continue;
    try {
      const e = api.dim().spawnEntity('acastle:bandit', { x: x + 0.5, y: top.location.y + 1, z: z + 0.5 }, { spawnEvent: 'acastle:as_' + pick(['sych', 'voron', 'grinya']) });
      e.nameTag = 'Человек Рыжего'; e.addTag(tag); e.addTag('acastle_raid'); e.triggerEvent('acastle:hostile');
    } catch (err) { /* участок не загружен */ }
  }
}
// Нежить в помещениях замка (склеп, катакомбы): по точкам из castle_data
function undead(api, spots, list, tag) {
  let i = 0;
  for (const [type, count] of list) for (let k = 0; k < count; k++) {
    const c = api.W(spots[i++ % spots.length]);
    try { const m = api.dim().spawnEntity(type, { x: c.x + 0.5, y: c.y, z: c.z + 0.5 }); m.addTag(tag); } catch (e) { /* не загружено */ }
  }
}
// Волна у ворот замка (как в «Ночи у ворот»): x 55–71, z 146–151 в координатах замка
function atGate(api, fn) {
  const c = api.W([55 + Math.floor(Math.random() * 17), 0, 146 + Math.floor(Math.random() * 6)]);
  return fn({ x: c.x, y: c.y, z: c.z });
}
const nearGate = (api, p, r = 64) => api.flat(p.location, api.W(api.castle.gate)) < r;
const nearPlace = (api, id, p, r = 48) => { const h = api.placeAt(id); return !!h && api.flat(p.location, h) < r; };
const nearRoom = (api, title, p, r = 8) => api.near(p, api.castle.rooms[title], r, 4);
const inRoom = (api, block, title, r = 7) => { const c = api.W(api.castle.rooms[title]); const l = block.location; return Math.hypot(l.x - c.x, l.z - c.z) < r && Math.abs(l.y - c.y) < 4; };
const container = (block) => /chest|barrel/.test(block.typeId);

// Переселить в место тайги (место выбирается, если ещё не выбрано)
function toPlace(api, place, ids, min = 250, max = 500) {
  api.setPlace(place, min, max);
  for (const id of ids) api.S.npcs[id] = 'place:' + place;
  api.save();
}
// Пир: жители замка собираются в Большом зале, наутро расходятся
function gather(api) {
  let i = 0;
  for (const id of HOUSE) if (api.where(id) === 'home') { api.S.f['feast_' + id] = 1; api.live(id, 'feast:' + i++); }
  api.live('demyan', 'gate');
}
function disperse(api) {
  for (const id of HOUSE) if (api.S.f['feast_' + id]) { api.S.f['feast_' + id] = 0; api.live(id, 'home'); }
  if (api.where('demyan') === 'gate') api.live('demyan', 'home');
}
// Улики для разговора с Рыжим в осаде
function evidence(api, pl) {
  return {
    amulet: api.hasNamed(pl, 'minecraft:iron_nugget', 'Оберег-башня'),
    letter: api.hasNamed(pl, 'minecraft:paper', 'Письмо королевы'),
    lullaby: !!api.flag('lullaby'),
    horse: api.hasNamed(pl, 'minecraft:stick', 'Деревянный конёк'),
  };
}

// ---------- Задания ----------
const room = (api, t) => api.castle.rooms[t];
const left = (api, units) => units.filter((u) => !api.repaired(u));
const firstOpen = (api, units) => units.find((u) => api.S.rep[u] && api.S.rep[u].st === 'open');
export const LATE_QUESTS = {
  // ===== Этап 2. Кузня =====
  s2_smith: { title: 'Кузнец у охотников', target: () => ({ place: 'camp_hunters_bear', label: 'Стан охотничьей артели' }),
    hint: 'Кузнец Гордей ушёл к охотникам старшины Кузьмы. Их стан далеко в лесу. Держите в руке компас или эту книгу — внизу экрана видно, куда идти. Поговорите с Кузьмой.' },
  s2_bear: { title: 'Шатун', target: () => ({ tag: 'acastle_shatun', near: { place: 'camp_hunters_bear' }, label: 'Шатун' }),
    hint: 'Медведь-шатун не залёг зимой и ходит вокруг стана. Выследите его недалеко от стана и убейте. Он сильный — возьмите еду и броню.',
    tick(api) {
      const S = api.S, h = api.placeAt('camp_hunters_bear');
      if (!h) return;
      const close = api.players().some((p) => api.flat(p.location, h) < 56);
      const bear = api.dim().getEntities({ tags: ['acastle_shatun'] })[0];
      if (bear || !close) return;
      // шатуна нет рядом — выходит из чащи (и снова, если ушёл далеко и пропал)
      if (S.f.bear_t && api.absTime() - S.f.bear_t < 600) return;
      const a = Math.random() * Math.PI * 2, x = Math.round(h.x + Math.cos(a) * 22), z = Math.round(h.z + Math.sin(a) * 22);
      const top = api.topAt(x, z);
      if (!top) return;
      try {
        const e = api.dim().spawnEntity('minecraft:polar_bear', { x: x + 0.5, y: top.location.y + 1, z: z + 0.5 });
        e.nameTag = 'Шатун'; e.addTag('acastle_shatun');
        S.f.bear_t = api.absTime(); api.save();
        api.say('kuzma', 'Слышишь? Ломится через ельник… Он! Шатун вышел!', 80);
      } catch (err) { /* не загружено */ }
    } },
  s2_knife: { title: 'Нож с клеймом', target: () => ({ place: 'camp_hunters_bear', label: 'Стан охотников' }),
    hint: 'Гордей заметил у охотника Ерофея нож с клеймом замка. Спросите Ерофея, откуда нож, и расскажите Гордею.' },
  s2_wait: { title: 'Кузня ждёт', hint: 'Гордей и Васька собираются в замок. Наутро они будут в кузнице во дворе.', target: () => ({ path: 'home_gordey', label: 'Кузница' }) },
  s2_forge: { title: 'Огонь в горне', target: () => ({ path: 'chest_forge', label: 'Сундук у кузницы' }),
    hint: (api) => (api.S.rep.forge && api.S.rep.forge.st !== 'open' ? 'Всё собрано. Утром кузня будет готова.' : 'Сундук-подряд у кузницы во дворе: 32 угля и 16 железных слитков. Наутро Гордей разожжёт горн.') },
  s2_tiltyard: { title: 'Ристалище', target: () => ({ path: 'chest_tiltyard', label: 'Сундук у ристалища' }),
    hint: 'Демьян: стражникам нужно где учиться. Сундук-подряд у ристалища: 48 еловых досок и 8 тюков сена.' },
  s2_hammer: { title: 'Молот деда', target: (api) => ({ at: room(api, 'Арсенал'), label: 'Арсенал' }),
    hint: 'Васька: молот его деда, замкового кузнеца, остался в арсенале на верхнем этаже донжона, рядом с казармой. Откройте там сундуки и бочки и принесите молот Ваське.' },
  // ===== Этап 3. Хозяйство =====
  s3_farm: { title: 'Кастелян на хуторе', target: () => ({ place: 'farmstead_voronin', label: 'Хутор Ворониных' }),
    hint: 'Кастелян Игнат живёт у Ворониных на лесном хуторе. Идите по компасу и поговорите с ним.' },
  s3_lights: { title: 'Огни в лесу', target: () => ({ place: 'farmstead_voronin', label: 'Хутор Ворониных' }),
    hint: (api) => (api.S.f.farm_raid ? 'Люди Рыжего у хутора! Прогоните их.' : 'По ночам у хутора огни: люди Рыжего уводят скот. Дождитесь ночи на хуторе и прогоните их. Разбойники не бьются до смерти: раненые убегают.'),
    tick(api) {
      battle(api, 'farm_raid', {
        tag: 'acastle_farm', label: 'Огни в лесу',
        ready: () => night() && api.players().some((p) => nearPlace(api, 'farmstead_voronin', p, 32)),
        stay: () => night() && api.players().some((p) => nearPlace(api, 'farmstead_voronin', p, 80)),
        near: (p) => nearPlace(api, 'farmstead_voronin', p, 80),
        start: () => api.say('nastya', '§cОгни! Опять они у загона!', 80),
        waves: [(a) => raid(a, a.placeAt('farmstead_voronin'), 3, 'acastle_farm'), (a) => raid(a, a.placeAt('farmstead_voronin'), 4, 'acastle_farm')],
        win: () => api.finish('s3_lights'),
        lose: () => api.say('ignat', 'Ушли в лес до следующей ночи…', 120),
      });
    } },
  s3_wait: { title: 'Хозяйство', hint: 'Игнат и Дуня собираются в замок. Наутро они будут на месте.', target: () => ({ path: 'home_ignat', label: 'Дом управителя' }) },
  s3_works: { title: 'Хозяйство', target: (api) => { const u = firstOpen(api, ['steward', 'barn', 'square', 'yard']); return u ? { path: 'chest_' + u, label: LATE_CONTRACTS[u].title } : null; },
    hint: (api) => `Игнат поставил сундуки-подряды: дом управителя (48 досок, 16 оконного стекла), амбар (16 досок, 32 еловых ступени), площадь с колодцем (24 каменного кирпича, 24 доски), двор (32 булыжника, 8 фонарей). Осталось: ${left(api, ['steward', 'barn', 'square', 'yard']).length}.` },
  s3_books: { title: 'Книга податей', target: (api) => ({ path: api.flag('ledger') ? 'slot_steward_book' : 'slot_ledger', label: api.flag('ledger') ? 'Бумаги управителя' : 'Счётная палата' }),
    hint: (api) => (api.flag('ledger') ? 'Игнат: «Мои старые бумаги — в сундуке в доме управителя. Там записано, когда исчез казначей».' : 'Игнат: «Книга податей — в счётной палате донжона, у казны». Откройте сундук в счётной палате.') },
  // ===== Этап 4. Вера =====
  s4_hermit: { title: 'Священник в скиту', target: () => ({ place: 'hermitage_nikodim', label: 'Скит отшельника' }),
    hint: 'Старого священника хоронить некому. Отец Варлаам гостит в скиту у отшельника Никодима. Идите по компасу.' },
  s4_wait: { title: 'Вера', hint: 'Отец Варлаам придёт в замок наутро. Его место — часовня во дворе.', target: () => ({ path: 'home_varlaam', label: 'Часовня' }) },
  s4_crypt: { title: 'Покой мёртвых', target: () => ({ path: 'crypt', label: 'Склеп часовни' }),
    hint: 'В склепе под часовней во дворе нежить. Спуститесь туда и очистите склеп.',
    tick(api) {
      battle(api, 'crypt_fight', {
        tag: 'acastle_crypt', label: 'Склеп',
        ready: () => api.players().some((p) => api.near(p, api.castle.lairs.crypt[0], 10, 4)),
        stay: () => api.players().some((p) => api.near(p, api.castle.lairs.crypt[0], 40, 16)),
        near: (p) => api.near(p, api.castle.lairs.crypt[0], 40, 16),
        waves: [(a) => undead(a, a.castle.lairs.crypt, [['minecraft:zombie', 3], ['minecraft:skeleton', 2]], 'acastle_crypt'), (a) => undead(a, a.castle.lairs.crypt, [['minecraft:zombie', 2], ['minecraft:skeleton', 2], ['minecraft:husk', 1]], 'acastle_crypt')],
        win: () => api.finish('s4_crypt'),
      });
    } },
  s4_chapel: { title: 'Часовня и кладбище', target: () => ({ path: 'chest_chapel', label: 'Сундук у часовни' }),
    hint: 'Сундук-подряд у часовни во дворе: 32 еловые доски, 16 стекла, 8 свечей.' },
  s4_priest: { title: 'Тайник священника', target: () => ({ path: 'slot_priest', label: 'Часовня донжона' }),
    hint: 'Варлаам: старый священник что-то спрятал в часовне донжона, на втором жилом этаже. Найдите его тайник.' },
  // ===== Этап 5. Знание =====
  s5_carto: { title: 'Дом картографа', target: () => ({ place: 'hut_cartographer_liza', label: 'Дом картографа' }),
    hint: 'Грамоты рода лежат в архиве, а читать их некому. Переписчик Евсей помогает ученице картографа Лизе. Идите по компасу.' },
  s5_mine: { title: 'Квадрат Г-7', target: () => ({ place: 'mine_g7', label: 'Рудник Г-7' }),
    hint: 'Картограф Ленц пропал у рудника в квадрате Г-7. Лиза думает, что его завалило в штольне. Возьмите кирку: обвал придётся разобрать.' },
  s5_grach: { title: 'Лесник', target: () => ({ place: 'hut_living_grach', label: 'Хижина лесника' }),
    hint: 'Лиза советует лесника Ефима Грача: он видит всё, что творится в бору. Поговорите с ним.' },
  s5_pigeon: { title: 'Голубиная почта', hint: 'Сёмка с голубями будет в голубятне на верху угловой башни донжона. Дождитесь первого письма от лесника.', target: () => ({ path: 'home_semka', label: 'Голубятня' }) },
  s5_camp: { title: 'Логово', target: () => ({ place: 'outlaw_camp', label: 'Лагерь у Чёрной гари' }),
    hint: 'Шайка Рыжего стоит у Чёрной гари. Идите по компасу. Не нападайте первым: поговорите с атаманом.' },
  s5_lullaby: { title: 'Колыбельная', target: () => ({ path: 'home_agafya', label: 'Кухня' }),
    hint: 'Рыжий насвистывал старую песню. Спросите в замке, что это за песня: Агафья служит тут дольше всех.' },
  s5_vault: { title: 'Запретная полка', target: () => ({ path: 'slot_vault', label: 'Тайное хранилище' }),
    hint: 'Евсей: за одной из полок библиотеки — тайное хранилище с грамотами рода. Полку придётся разобрать.' },
  // ===== Этап 6. Исцеление =====
  s6_ask: { title: 'Где искать Марфу', target: () => ({ place: 'hermitage_nikodim', label: 'Скит отшельника' }),
    hint: 'Королю хуже. Помочь может только травница Марфа, но её дом сгорел. Отшельник Никодим знает лес лучше всех: спросите его.' },
  s6_marfa: { title: 'Ведунья с пепелища', target: () => ({ place: 'hut_burned_marfa', label: 'Пепелище' }),
    hint: 'Никодим говорит, что Марфа жива и прячется в погребице на пепелище. Идите по компасу.' },
  s6_cure: { title: 'Лекарство для короля', target: () => ({ path: 'home_marfa', label: 'Лекарская' }),
    hint: (api) => (api.flag('diary') ? 'Принесите Марфе в лекарскую: 8 сладких ягод, бутылку мёда и сверкающий ломтик арбуза.' : 'Марфе нужен дневник короля: он в опочивальне. Найдите его, потом принесите Марфе 8 сладких ягод, бутылку мёда и сверкающий ломтик арбуза.') },
  s6_garden: { title: 'Огород', target: () => ({ path: 'chest_garden', label: 'Огород' }),
    hint: 'Марфе нужны свои травы. Сундук-подряд у огорода во дворе: 32 семени пшеницы, 8 моркови, 8 картофеля.' },
  // ===== Этап 7. Подземелье =====
  s7_prokhor: { title: 'Углежог', target: () => ({ place: 'charcoal_prokhor', label: 'Углежоги' }),
    hint: 'Под замком ходы завалены, оттуда лезет нежить. Нужен человек, что умеет копать и не боится темноты: углежог Прохор. Идите по компасу.' },
  s7_gat: { title: 'Старая гать', target: () => ({ place: 'gat_amulet', label: 'Старая гать' }),
    hint: 'Прохор зарыл серебряный оберег под крестом у Старой гати, на болоте. Пройдите по гати и откройте тайник под крестом.' },
  s7_catacombs: { title: 'Завалы', target: () => ({ path: 'chest_catacombs', label: 'Сундук в катакомбах' }),
    hint: 'Сундук-подряд в катакомбах под донжоном: 32 еловых бревна на подпорки и 32 факела.' },
  s7_undead: { title: 'Нежить в ходах', target: () => ({ path: 'catacombs', label: 'Костница' }),
    hint: 'Прохор: «Пока в костнице и усыпальнице нежить, копать не дадут». Спуститесь в катакомбы и очистите их.',
    tick(api) {
      const L = api.castle.lairs.catacombs;
      battle(api, 'cata_fight', {
        tag: 'acastle_cata', label: 'Катакомбы',
        ready: () => api.players().some((p) => api.near(p, L[0], 10, 4) || api.near(p, L[4], 10, 4)),
        stay: () => api.players().some((p) => api.near(p, L[0], 48, 16)),
        near: (p) => api.near(p, L[0], 48, 16),
        waves: [(a) => undead(a, L.slice(0, 4), [['minecraft:zombie', 3], ['minecraft:skeleton', 2]], 'acastle_cata'), (a) => undead(a, L.slice(4), [['minecraft:skeleton', 3], ['minecraft:zombie', 2], ['minecraft:cave_spider', 2]], 'acastle_cata')],
        win: () => api.finish('s7_undead'),
      });
    } },
  s7_sealed: { title: 'Ночной путь', target: () => ({ path: 'slot_sealed', label: 'Запечатанная сокровищница' }),
    hint: 'Прохор: «Под донжоном есть сокровищница, запечатанная в ту зиму. Королева, говорят, что-то туда положила». Найдите её в катакомбах.' },
  // ===== Этап 8. Пир и осада =====
  s8_feast: { title: 'Готовим пир', target: () => ({ path: 'home_agafya', label: 'Кухня' }),
    hint: 'Агафье для пира нужно: 16 хлеба, 16 жареного мяса (любого) и 2 торта.' },
  s8_sawmill: { title: 'Счета Ножова', target: () => ({ place: 'sawmill_books', label: 'Лесопилка' }),
    hint: 'Необязательное. Сторож лесопилки Гаврила, говорят, бережёт счета приказчика. Сходите к нему.' },
  s8_siege: { title: 'Осада', target: () => ({ at: [63, 0, 126], label: 'Ворота замка' }),
    hint: (api) => (api.S.f.siege ? 'Шайка у ворот! Пробейтесь к Рыжему у костра за спинами разбойников и поговорите с ним.' : 'В ночь пира шайка Рыжего придёт к воротам. Ждите у ворот после заката.'),
    tick(api) {
      const S = api.S;
      if (S.f.siege_calm) return; // волны отбиты или Рыжий остановил бой — ждём разговора
      battle(api, 'siege', {
        tag: 'acastle_siege', label: 'Осада',
        ready: () => night() && api.players().some((p) => nearGate(api, p, 40)),
        stay: () => night() && !S.f.siege_talk && api.players().some((p) => nearGate(api, p, 96)),
        near: (p) => nearGate(api, p, 96),
        start: () => {
          gather(api);
          api.live('ryzhy', 'field:63,154'); api.setState('ryzhy', null);
          api.live('nozhov', 'field:66,160'); api.setState('nozhov', null);
          api.say('mitka', '§cИз леса идут! Факелы! Это шайка!', 120);
          for (const p of api.players()) p.onScreenDisplay.setTitle('§cОсада', { subtitle: 'Шайка Рыжего у ворот', fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 });
        },
        waves: [(a) => { for (let i = 0; i < 4; i++) atGate(a, (p) => raid(a, p, 1, 'acastle_siege', 0, 2)); }, (a) => { for (let i = 0; i < 5; i++) atGate(a, (p) => raid(a, p, 1, 'acastle_siege', 0, 2)); }, (a) => { for (let i = 0; i < 5; i++) atGate(a, (p) => raid(a, p, 1, 'acastle_siege', 0, 2)); }],
        next: (n) => { if (n === 1) api.say('demyan', 'Держать ворота! Рыжий у костра за их спинами — к нему не пробиться, пока лезут!', 120); },
        win: () => { S.f.siege_calm = 1; api.save(); api.say('demyan', 'Отбились… Рыжий всё ещё у костра. Иди к нему, пока он не ушёл!', 120); },
        lose: () => {
          if (S.f.siege_talk) return;
          api.live('ryzhy', null); api.live('nozhov', null); disperse(api);
          api.say('ostap', 'Отошли в лес… Вернутся следующей ночью. Готовься.', 200);
        },
      });
    } },
  s8_nozhov: { title: 'Поймать Ножова', target: () => ({ tag: 'acastle_npc_nozhov', label: 'Ножов' }),
    hint: (api) => (api.S.st.nozhov === 'captive' ? 'Ножов связан. Накиньте на него поводок и отведите к Прохору в караульню подклета или прямо в темницу.' : 'Ножов бежит в лес! Догоните его и ударьте — он сдастся.'),
    tick(api) {
      if (api.S.st.nozhov !== 'captive') return;
      const e = api.findNpc('nozhov');
      if (!e) return;
      // Страховка, если поводок не накинуть: связанный пленник сам плетётся за игроком
      const [pl, d] = api.nearest(e.location);
      if (pl && d > 8 && d < 48) {
        const v = pl.getViewDirection();
        try { e.teleport({ x: pl.location.x - v.x * 2, y: pl.location.y, z: pl.location.z - v.z * 2 }); } catch (err) { /* ничего */ }
      }
      const at = [api.castle.homes.prokhor, api.castle.homes.nozhov].map((c) => api.W(c));
      if (at.some((c) => api.dist(e.location, c) < 7)) {
        // Прохор уводит его в темницу: там он и появится
        try { e.triggerEvent('acastle:despawn'); e.removeTag(api.tagOf('nozhov')); } catch (err) { /* ничего */ }
        api.setState('nozhov', null); api.live('nozhov', 'home');
        api.finish('s8_nozhov');
      }
    } },
  // ===== Этап 9. Наследие =====
  s9_heir: { title: 'Отец и сын', target: () => ({ path: 'throne', label: 'Большой зал' }),
    hint: 'Рыжий пришёл в замок. Король ждёт вас в Большом зале у трона.' },
  s9_shrine: { title: 'Перстень основателя', target: () => ({ place: 'mark_shrine_master', label: 'Капище' }),
    hint: 'Король просит отнести перстень основателя на капище Хозяина бора, чтобы лес принял нового хозяина. Идите по компасу, перстень держите при себе.',
    tick(api) {
      const h = api.placeAt('mark_shrine_master');
      if (!h || !api.players().some((p) => api.flat(p.location, h) < 7 && api.hasNamed(p, 'minecraft:gold_nugget', 'Перстень основателя'))) return;
      for (const p of api.players()) {
        api.takeNamed(p, 'minecraft:gold_nugget', 'Перстень основателя');
        p.onScreenDisplay.setTitle('§fХозяин бора', { subtitle: 'Из чащи вышел белый лось и склонил рога', fadeInDuration: 20, stayDuration: 80, fadeOutDuration: 30 });
        p.playSound('random.levelup');
        p.sendMessage('§7Белый лось долго смотрит на вас, потом склоняет рога над перстнем на камне и уходит в чащу. Лес принял нового хозяина.');
      }
      for (let i = 0; i < 12; i++) try { api.dim().spawnParticle('minecraft:totem_particle', { x: h.x + Math.random() * 4 - 2, y: h.y + 1 + Math.random() * 2, z: h.z + Math.random() * 4 - 2 }); } catch (e) { /* ничего */ }
      api.finish('s9_shrine');
    } },
  s9_return: { title: 'Последняя воля', target: () => ({ path: 'throne', label: 'Большой зал' }), hint: 'Вернитесь к королю в Большой зал.' },
  s9_heritage: { title: 'Наследие', target: () => ({ path: 'chest_heritage', label: 'Сундук наследия' }),
    hint: 'Подряды хозяина: золото для трона, белая шерсть для знамён на всех башнях, железо для колокола. Сундук у трона.' },
  // ===== Побочные =====
  x_peace: { title: 'Мир с атаманом', target: () => ({ place: 'outlaw_camp', label: 'Лагерь у Чёрной гари' }),
    hint: 'Лагерь Рыжего враждебен. Принесите кашевару Пахому дар — 8 хлеба и 8 жареного мяса — и попросите замолвить слово.' },
  x_shilo: { title: 'Пропажа', target: () => ({ place: 'outlaw_camp', label: 'Лагерь у Чёрной гари' }),
    hint: 'Мальчишка Шило в лагере что-то вытащил у вас из сумы. Поговорите с ним.' },
  x_trader: { title: 'Торговка на площади', target: () => ({ at: [71, 0, 109], label: 'Колодец на площади' }),
    hint: 'На площади у колодца появилась торговка. Странно: торговать ей нечем, а спрашивает она много. Поговорите с ней несколько раз.' },
};

// ---------- Начало этапов (и для перехода командой acastle:jump) ----------
export const STARTS = {
  2: (api) => { api.start('s2_smith'); toPlace(api, 'camp_hunters_bear', ['kuzma', 'hunter', 'gordey', 'vaska']); },
  3: (api) => { api.start('s3_farm'); toPlace(api, 'farmstead_voronin', ['nastya', 'ignat', 'dunya']); },
  4: (api) => { api.start('s4_hermit'); toPlace(api, 'hermitage_nikodim', ['nikodim', 'varlaam']); },
  5: (api) => { api.start('s5_carto'); toPlace(api, 'hut_cartographer_liza', ['liza', 'evsey']); },
  6: (api) => { api.start('s6_ask'); toPlace(api, 'hermitage_nikodim', ['nikodim']); },
  7: (api) => { api.start('s7_prokhor'); toPlace(api, 'charcoal_prokhor', ['prokhor']); },
  8: (api) => { api.start('s8_feast'); api.start('s8_sawmill'); toPlace(api, 'sawmill_books', ['watchman']); api.arriveNextMorning('timosha', 'rooms_8'); },
  9: (api) => { api.live('ryzhy', 'home'); api.setState('ryzhy', null); api.live('vsevolod', 'feast:0'); api.start('s9_heir'); },
};
// Жители, которые приходят на каждом этапе, и их комнаты
const ARRIVALS = { 1: ['demyan'], 2: ['gordey', 'vaska'], 3: ['ignat', 'dunya'], 4: ['varlaam'], 5: ['evsey', 'lenz', 'semka'], 6: ['marfa'], 7: ['prokhor'], 8: ['timosha'] };
const RANKS = { 1: 'Оруженосец', 4: 'Рыцарь', 6: 'Кастелян', 9: 'Хозяин замка' };

function checkStage(api, n) {
  const need = {
    2: ['s2_forge', 's2_tiltyard', 's2_hammer'],
    3: ['s3_works', 's3_books'],
    4: ['s4_crypt', 's4_chapel', 's4_priest'],
    5: ['s5_mine', 's5_lullaby', 's5_vault'],
    6: ['s6_cure', 's6_garden'],
    7: ['s7_gat', 's7_catacombs', 's7_undead', 's7_sealed'],
    8: ['s8_feast', 's8_siege', 's8_nozhov'],
  }[n];
  if (!need || api.flag(`stage${n}_done`) || !need.every((q) => api.done(q))) return;
  api.flag(`stage${n}_done`, 1);
  if (RANKS[n]) api.rank(RANKS[n]);
  api.renown(5, `этап ${n}`);
  const after = {
    2: 'Кузня горит. Агафья на кухне жалуется, что кладовые пусты.',
    3: 'Хозяйство налажено. Игнат хочет поговорить о старом кладбище.',
    4: 'Часовня освящена. Отец Варлаам хочет поговорить о грамотах рода.',
    5: 'Грамоты найдены, Рыжий — не простой разбойник. Утром зайдите к королю.',
    6: 'Король на ногах. Капитан Демьян хочет поговорить о подземелье.',
    7: 'Тайна раскрыта: Рыжий — пропавший княжич Ефрем. Игнат хочет созвать пир.',
    8: 'Ножов в темнице. Утром Рыжий придёт в замок.',
  }[n];
  api.tell(`§6Этап ${n} пройден. ${after}`);
  if (n === 5) api.flag('king_ill_day', world.getDay());
  if (n === 7) {
    for (const p of api.players()) p.onScreenDisplay.setTitle('§6Рыжий — княжич Ефрем', { subtitle: 'Оберег рода, письмо королевы, колыбельная', fadeInDuration: 20, stayDuration: 80, fadeOutDuration: 20 });
    for (const id of GANG) { api.live(id, null); api.setState(id, null); } // лагерь опустел: шайка ушла к замку по зову Ножова
    api.flag('camp_empty', 1);
    // побочные задания лагеря теряют смысл: мириться не с кем, Шило подбросил пропажу
    api.drop('x_peace');
    if (api.has('x_shilo')) {
      const it = api.S.f.stolen;
      if (it) for (const p of api.players()) { api.give(p, it.id, it.n); p.sendMessage('§7В сумке нашлась пропажа: Шило, уходя с шайкой, подбросил её обратно.'); break; }
      api.S.f.stolen = null; api.drop('x_shilo');
    }
  }
  if (n === 8) api.arriveNextMorning('ryzhy');
}

// ---------- Разговоры ----------
// Возвращает узел разговора или null, если житель говорит по правилам этапов 0–1 (story.js).
// «Я тут порядок навёл» житель говорит один раз, вместе с тем, что скажет дальше.
const TIDY = {
  gordey: 'Я тут порядок навёл: в оружейных и арсенале всё по стойкам. А кузня во дворе — без угля и железа горн не разжечь.',
  ignat: 'Я тут порядок навёл: кладовые, погреба, пекарня, казна — всё по описи. А мой дом, амбар и площадь без досок и камня не поднять.',
  varlaam: 'Я тут порядок навёл в часовне донжона и ризнице. Но в склепе под часовней во дворе неспокойно: мёртвые не лежат.',
};
export function lateDialog(id, api, pl) {
  if (TIDY[id] && api.flag('tidy_' + id) && !api.flag(`tidy_${id}_said`)) {
    api.flag(`tidy_${id}_said`, 1);
    const node = talkLate(id, api, pl);
    return node && node.text !== '…' ? { ...node, text: TIDY[id] + '\n\n' + node.text } : { text: TIDY[id], options: [bye] };
  }
  return talkLate(id, api, pl);
}
function talkLate(id, api, pl) {
  const S = api.S, has = api.has, done = api.done, f = api.flag;
  switch (id) {
    // ===== Замок =====
    case 'demyan': {
      if (f('stage1_done') && !S.q.s2_smith) return {
        text: 'Стены держим. А вот мечи тупые, броня ржавая. Кузнец наш, Гордей, как замок закрыли, ушёл к охотникам Кузьмы — куёт им наконечники. Без кузни нам первую же осаду не выдержать.',
        options: [{ text: 'Схожу за ним.', run: (a) => STARTS[2](a), next: { text: 'Стан артели далеко в лесу. Компас тебе в помощь. Скажи Гордею: Демьян зовёт, и замок жив.' } }, bye],
      };
      if (has('s2_tiltyard')) return { text: 'Ристалище бы поправить: доски да сено. Ребятам учиться надо, а не только у ворот стоять.', options: [bye] };
      if (f('stage6_done') && !S.q.s7_prokhor) return {
        text: 'Под замком ходы завалены, и оттуда по ночам лезет нежить. Нужен человек, что умеет копать и не боится темноты. Слыхал я про углежога Прохора — вот кто нам нужен.',
        options: [{ text: 'Найду его.', run: (a) => STARTS[7](a), next: { text: 'Углежоги жгут уголь далеко в бору. Иди по компасу.' } }, bye],
      };
      if (has('s8_siege')) return { text: S.f.siege ? 'Держим ворота! Иди к Рыжему!' : 'Ночью будь у ворот. Я чую: Ножов пир нам испортить захочет.', options: [{ text: 'Дай верёвку на всякий случай.', run: (a, p) => a.give(p, 'minecraft:lead', 2), next: { text: 'Держи. Пленника на поводке и поведёшь.' } }, bye] };
      if (has('s8_nozhov')) return { text: 'Ножов бежит! Догони — да не руби: живым его к Прохору, пусть король его судит.', options: [{ text: 'Дай верёвку.', run: (a, p) => a.give(p, 'minecraft:lead', 2), next: { text: 'Держи поводок.' } }, bye] };
      return null;
    }
    case 'savva': return { text: pick(['С башни всё видно. И нежить, и людей.', 'Тетиву берегу от сырости. А то в нужный миг подведёт.', 'Рыжего люди тоже хорошо стреляют. Ворон у них — меткий, говорят.']), options: [bye] };
    case 'agafya': {
      if (has('s5_lullaby')) return {
        text: 'Песню? Какую песню, голубчик?',
        options: [{ text: 'Насвистеть мотив, что пел Рыжий.', run: (a) => { a.flag('lullaby', 1); a.finish('s5_lullaby'); }, next: { text: 'Господи… Это же колыбельная королевы Елены. Она её Ефремушке пела, сама сложила. Больше её никто не знал, никто! Откуда она у разбойника?..' } }, bye],
      };
      if (has('s8_feast')) return {
        text: 'Пир! Как в старину! Мне нужно 16 хлеба, 16 жареного мяса — любого — и 2 торта. Остальное сама соберу.',
        options: [{ text: 'Вот всё для пира.', next: (a, p) => (a.hasAll(p, [['minecraft:bread', 16], ['minecraft:cake', 2]]) && cookedCount(a, p) >= 16 && a.take(p, [['minecraft:bread', 16], ['minecraft:cake', 2]]) && takeCooked(a, p, 16) ? (a.finish('s8_feast'), a.start('s8_siege'), {
          text: 'Вот это стол будет! Нынче же вечером и пируем. Ступай, отдохни… Хотя Демьян что-то хмурый ходит. Говорит, в лесу огни.',
        }) : { text: 'Не всё ещё: 16 хлеба, 16 жареного мяса и 2 торта.' }) }, bye],
      };
      if (f('stage2_done') && !S.q.s3_farm) return {
        text: 'Кладовые пусты, погреба пусты. Одной мне не управиться. Был у нас кастелян, Игнат, — всё хозяйство на нём держалось. Говорят, живёт у Ворониных на лесном хуторе.',
        options: [{ text: 'Приведу его.', run: (a) => STARTS[3](a), next: { text: 'Хутор в лесу, за ручьём. Компас тебе в помощь. Кланяйся Ворониным от Агафьи.' } }, bye],
      };
      if (f('farm_supply') && S.f.fed !== world.getDay()) return {
        text: 'С хутора привезли молока и мяса! Садись, накормлю как следует.',
        options: [{ text: 'Покорми, Агафья.', run: (a, p) => { a.give(p, 'minecraft:bread', 3); a.give(p, 'minecraft:cooked_beef', 2); a.give(p, 'minecraft:pumpkin_pie', 1); a.flag('fed', world.getDay()); }, next: { text: 'Кушай на здоровье.' } }, bye],
      };
      return null;
    }
    case 'vsevolod': {
      if (has('s9_heir')) return {
        text: 'Подойди. Видишь, кто рядом со мной? Ефрем. Мой сын. Двадцать лет я считал его мёртвым…',
        options: [{ text: 'Что он говорит?', next: {
          text: 'Он говорит: «Моё место в бору». Не хочет замка. Я не держу. Но замку нужен хозяин, а мне осталось недолго. Возьми перстень основателя. Отнеси его на капище Хозяина бора: пусть лес примет нового хозяина. Тебя.',
          options: [{ text: 'Отнесу.', run: (a, p) => { a.finish('s9_heir'); a.give(p, 'minecraft:gold_nugget', 1, 'Перстень основателя', ['Отнести на капище Хозяина бора']); a.start('s9_shrine'); a.setPlace('mark_shrine_master', 300, 500); } }],
        } }],
      };
      if (has('s9_shrine')) return { text: 'Капище далеко в бору. Там стоит камень, старше нашего замка. Положи перстень и жди.', options: [bye] };
      if (has('s9_return')) return {
        text: 'Ты видел его? Белого лося? Значит, лес принял тебя. Слушайте все! Отныне хозяин Студёного детинца — вот он. Служите ему, как служили мне.',
        options: [{ text: 'Я не подведу.', run: (a) => { a.finish('s9_return'); a.rank('Хозяин замка'); a.start('s9_heritage'); a.openContract('heritage'); a.flag('king_dies', world.getDay()); }, next: { text: 'Знаю. Теперь можно и отдохнуть… Позови Игната: пусть трон позолотят, знамёна поднимут, колокол повесят. Пусть все видят: замок жив.' } }],
      };
      if (typeof f('king_ill_day') === 'number' && world.getDay() > f('king_ill_day') && !S.q.s6_ask) return {
        text: '…Подойди… Сил нет подняться. С утра всё хуже. Варлаам молится, да молитвой одной не вылечишь.',
        options: [{ text: 'Я найду лекаря.', run: (a) => STARTS[6](a), next: { text: 'Говорили, была в бору травница, Марфа. Да сожгли её… Спроси отшельника Никодима: он всех в лесу знает.' } }],
      };
      if (f('king_up') && !f('stage9_done')) return { text: pick(['Я хожу! Впервые за годы спустился в Большой зал. Спасибо Марфе… и тебе.', 'Вороний глаз… Ножов травил её. А я двадцать лет звал это горячкой.', 'Если Рыжий и правда мой Ефрем… Господи, дай дожить.']), options: [bye] };
      return null;
    }
    case 'gordey': {
      if (has('s2_smith')) return { text: 'Демьян зовёт? Замок жив?.. Ты сперва с Кузьмой потолкуй. Артель меня приютила — не брошу их, пока шатун у стана ходит.', options: [bye] };
      if (has('s2_bear')) return { text: 'Шатун ещё ходит. Пока он тут, я не уйду.', options: [bye] };
      if (has('s2_knife') && !f('knife')) return { text: 'Глянь на нож у Ерофея. Видишь клеймо — башня в круге? Это клеймо нашей кузни, я сам его ставил! Спроси, откуда у него.', options: [bye] };
      if (has('s2_knife') && f('knife')) return {
        text: 'Купил у людей Рыжего на дороге? Значит, оружие уходило из арсенала через кого-то внутри. Двадцать лет назад, в ту зиму… Ладно. Иду в замок. Васька, собирай инструмент!',
        options: [{ text: 'Жду в замке.', run: (a) => { a.finish('s2_knife'); a.start('s2_wait'); a.arriveNextMorning('gordey', 'rooms_2'); a.arriveNextMorning('vaska'); } }],
      };
      if (has('s2_wait')) return { text: 'Соберём инструмент — и в путь. Наутро будем в кузне.', options: [bye] };
      if (has('s2_forge')) return { text: 'Горн холодный. 32 угля и 16 железа — в сундук у кузни. Утром разожгу.', options: [bye] };
      if (done('s2_forge')) {
        const today = world.getDay();
        return {
          text: pick(['Молот поёт — значит, замок живёт.', 'Клеймо на клинках снова наше: башня в круге.', 'Приноси, что сломалось, — поправлю.']),
          options: [S.f.fix_day === today ? { text: 'Почини (уже чинил сегодня)', next: { text: 'Сегодня уже чинил. Завтра приходи.' } } : { text: 'Почини, что в руке (1 железо).', next: (a, p) => (a.count(p, 'minecraft:iron_ingot') < 1 ? { text: 'Без железного слитка не возьмусь.' } : a.repairHeld(p) ? (a.take(p, [['minecraft:iron_ingot', 1]]), a.flag('fix_day', today), { text: 'Держи. Как новый.' }) : { text: 'Тут и чинить нечего. Или это не железо — с ним я не работаю.' }) }, bye],
        };
      }
      return { text: '…', options: [bye] };
    }
    case 'vaska': {
      if (has('s2_hammer')) return api.hasNamed(pl, 'minecraft:mace', 'Молот деда') ? {
        text: 'Это он! Дедов молот! Дед им ворота ковал, когда я ещё не родился…',
        options: [{ text: 'Держи, Васька.', run: (a, p) => { a.takeNamed(p, 'minecraft:mace', 'Молот деда'); a.finish('s2_hammer'); a.give(p, 'minecraft:iron_ingot', 4); a.give(p, 'minecraft:emerald', 3); checkStage(a, 2); }, next: { text: 'Спасибо! На, возьми — это я сам в бочке нашёл. Тебе нужнее.' } }],
      } : { text: 'Дедов молот где-то в арсенале наверху донжона, рядом с казармой. Я туда боюсь — там всё ржавое и скрипит.', options: [bye] };
      if (S.places.camp_hunters_bear && api.where('vaska').startsWith('place:')) return { text: 'Я с Гордеем! Куда он — туда и я.', options: [bye] };
      return { text: pick(['А правда, что в катакомбах клад?', 'Я сегодня три гвоздя выковал! Кривые, правда.', 'Гордей говорит, руки у меня золотые. А голова — дырявая.']), options: [bye] };
    }
    case 'ignat': {
      if (has('s3_farm')) return {
        text: 'Из замка? Агафья жива? Господи… Я бы рад вернуться, да Ворониных не брошу. По ночам у хутора огни: люди Рыжего скот уводят. Хозяин в отъезде, одна Настя с детьми.',
        options: [{ text: 'Я их прогоню.', run: (a) => { a.finish('s3_farm'); a.start('s3_lights'); }, next: { text: 'Приходят после заката, со стороны леса. Будь осторожен: они не дураки драться.' } }, bye],
      };
      if (has('s3_lights')) return { text: 'Ночью жди у хутора. Как увидишь огни — бей.', options: [bye] };
      if (done('s3_lights') && !S.q.s3_wait && !done('s3_wait')) return {
        text: 'Прогнал! Ну, теперь и мне не стыдно уходить. Дуня со мной пойдёт — она девка работящая. А хутор будет кухню снабжать: молоко, мясо, сено.',
        options: [{ text: 'Жду в замке.', run: (a) => { a.start('s3_wait'); a.arriveNextMorning('ignat', 'rooms_3'); a.arriveNextMorning('dunya'); a.flag('farm_supply', 1); } }],
      };
      if (has('s3_wait')) return { text: 'Наутро будем в замке.', options: [bye] };
      if (has('s3_books') && f('ledger') && !f('steward_papers')) return { text: 'Книга податей… Треть казны за подписью С. Ножова. Мои старые бумаги — в сундуке в моём доме. Там записано, когда он исчез.', options: [bye] };
      if (f('stage3_done') && !S.q.s4_hermit) return {
        text: 'Хозяйство налажено. Одно гнетёт: старый священник похоронен на кладбище без отпевания, могила без креста. Отец Варлаам, говорят, гостит в скиту у отшельника Никодима.',
        options: [{ text: 'Позову его.', run: (a) => STARTS[4](a), next: { text: 'Скит в глуши. Иди по компасу.' } }, bye],
      };
      if (f('stage7_done') && !S.q.s8_feast) return {
        text: 'Замок жив. Кухня полна, часовня освящена, подземелье чисто. Пора созвать пир, как в старину! Гусляра позовём, гостей. Пусть весь бор знает.',
        options: [{ text: 'Созываем пир!', run: (a) => STARTS[8](a), next: { text: 'Агафье нужны продукты — ступай к ней. А гусляр Тимоша наутро сам придёт: он такие вести за версту чует.' } }, bye],
      };
      if (has('s9_heritage')) return { text: 'Золото для трона, шерсть для знамён, железо для колокола — в сундук у трона.', options: [bye] };
      return { text: pick(['Всё по описи, всё на месте.', 'Хутор шлёт молоко исправно.', 'Казна пуста, да руки целы.']), options: [bye] };
    }
    case 'dunya': return { text: pick(['Я всё найду! Всё, что теряют, ко мне приходит.', 'Бельё перестирала. Двадцать лет пыли!', 'Мамка с хутора кланяется.']), options: [bye] };
    case 'trader': {
      const n = (S.f.trader_n || 0) + 1;
      api.flag('trader_n', n);
      if (n >= 3 && !f('trader_spy')) { api.flag('trader_spy', 1); if (has('x_trader')) api.finish('x_trader'); }
      return { text: [
        'Товар? Ой, распродала уже, милок. А вы тут давно? Стражи-то много у вас?',
        'А король ваш — хворый, говорят? А в какой он комнате спит, высоко, поди?',
        'Ты чего так смотришь? Пойду я… (Она не похожа на торговку: руки в мозолях от тетивы, на поясе два ножа.)',
      ][Math.min(n, 3) - 1], options: [bye] };
    }
    case 'varlaam': {
      if (has('s4_hermit')) return {
        text: 'Из замка? Старый священник без отпевания лежит? Грех… Приду. Но сначала выслушай Никодима: он давно ищет, кому покаяться.',
        options: [{ text: 'Хорошо.', run: (a) => a.flag('varlaam_ok', 1) }],
      };
      if (has('s4_wait')) return { text: 'Наутро буду в часовне.', options: [bye] };
      if (f('stage4_done') && !S.q.s5_carto) return {
        text: 'Грамоты рода лежат в архиве, а читать их некому: я по-латыни разумею, а по-старому — нет. Переписчик Евсей разумеет. Он нынче помогает ученице картографа.',
        options: [{ text: 'Найду Евсея.', run: (a) => STARTS[5](a), next: { text: 'Дом картографа в бору, на холме. Иди с Богом.' } }, bye],
      };
      if (has('s6_ask')) return { text: 'Помочь королю может только Марфа-травница. Да её, говорят, сожгли. Спроси Никодима — он в бору всех знает.', options: [bye] };
      return { text: pick(['Мир тебе.', 'Не горячка… Чаша. Старый священник знал и молчал. Тайна исповеди.', 'Свечи бы ещё. В часовне темно.']), options: [bye] };
    }
    case 'nikodim': {
      if (has('s4_hermit')) return {
        text: 'Ты из замка… Двадцать лет я ждал, кто придёт оттуда. Слушай. Я был солдатом острога. В ту зиму казначей кричал: «Вор! Мальчишка обокрал казну!» Мы гнали его до болота. Ему было лет семь. Он ушёл в топь… Я не стал его вытаскивать.',
        options: [{ text: 'Бог простит.', run: (a) => { a.flag('confess', 1); a.finish('s4_hermit'); a.start('s4_wait'); a.arriveNextMorning('varlaam', 'rooms_4'); }, next: { text: 'Может, и простит. А я — нет. Иди. Варлаам пойдёт с тобой. Он нужнее вам, чем мне.' } },
          { text: 'Ты убил ребёнка.', run: (a) => { a.flag('confess', 1); a.finish('s4_hermit'); a.start('s4_wait'); a.arriveNextMorning('varlaam', 'rooms_4'); }, next: { text: 'Да. Потому и живу тут. Иди. Варлаам пойдёт с тобой.' } }],
      };
      if (has('s6_ask')) return {
        text: 'Марфа? Жива. Её дом сожгли люди приказчика, а она ушла в погребицу на пепелище. Я ношу ей хлеб. Скажи, что от Никодима, — поверит.',
        options: [{ text: 'Спасибо.', run: (a) => { a.finish('s6_ask'); a.start('s6_marfa'); toPlace(a, 'hut_burned_marfa', ['marfa']); } }],
      };
      return { text: pick(['Хозяин бора всё видит.', 'Молюсь за того мальчишку каждую ночь.', 'Лес не прощает. Но и не мстит.']), options: [bye] };
    }
    case 'evsey': {
      if (has('s5_carto')) return {
        text: 'Грамоты рода? Двадцать лет к ним никто не прикасался… Пойду. Лиза справится одна, только учителя её найди — Аркадия Ленца. Она тебе расскажет.',
        options: [{ text: 'Найду.', run: (a) => { a.finish('s5_carto'); a.arriveNextMorning('evsey', 'rooms_5'); if (!a.S.q.s5_mine) { a.start('s5_mine'); toPlace(a, 'mine_g7', ['lenz'], 350, 550); } } }],
      };
      if (f('tidy_evsey') && !S.q.s5_vault && !done('s5_vault')) return {
        text: 'Я тут порядок навёл: библиотека, архив, кабинет — всё по полкам. Только главных грамот нет. Старый хранитель держал их за одной из полок, в тайном хранилище.',
        options: [{ text: 'Найду.', run: (a) => a.start('s5_vault') }],
      };
      if (done('s5_vault') && !f('vault_read')) return {
        text: 'Грамота основателя! «Рудник в квадрате Г-7 — земля замка навечно». И договор с Хозяином бора… Ножов знал, что ищет.',
        options: [{ text: 'Что в договоре?', run: (a) => { a.flag('vault_read', 1); checkStage(a, 5); }, next: { text: '«Замок бережёт лес, лес бережёт замок». И приписка: новый хозяин должен отнести перстень на капище. Иначе лес не примет его.' } }],
      };
      return { text: pick(['Чернила засохли, перья истрепались. Двадцать лет!', 'В архиве мыши. Нужна кошка.', 'Буквы старые, да смысл ясный.']), options: [bye] };
    }
    case 'lenz': {
      if (has('s5_mine')) return {
        text: 'Свет! Живой человек! Неделю за этим завалом… Люди Ножова обрушили штольню, когда я нашёл межевой знак. Рудник — земля замка, понимаешь? А в управе об этом ни слова!',
        options: [{ text: 'Идём в замок.', run: (a, p) => { a.finish('s5_mine'); a.give(p, 'minecraft:paper', 1, 'Карта квадрата Г-7', ['Межа замка, золотая жила']); a.arriveNextMorning('lenz'); a.flag('lenz_map', 1); if (!a.S.q.s5_grach) { a.start('s5_grach'); toPlace(a, 'hut_living_grach', ['grach', 'semka']); } checkStage(a, 5); }, next: { text: 'Возьми карту: межа замка, жила. Сохрани её. Я приду в замок, только отосплюсь. А ты загляни к леснику Грачу — он видел, кто ходил к руднику.' } }],
      };
      return { text: pick(['Звёзды не лгут. Люди — да.', 'Межа замка идёт по ручью, через холм, до самого рудника.', 'Лиза — умница. Лучше меня считает.']), options: [bye] };
    }
    case 'liza': {
      if (has('s5_carto') || has('s5_mine')) return { text: 'Учитель ушёл в квадрат Г-7 мерить землю и не вернулся. Неделю уже! Я бы пошла, да одна боюсь. Если найдёшь его… Скажи, что я все расчёты закончила.', options: [bye] };
      return { text: pick(['Спасибо за учителя!', 'Я составила карту бора. Почти всю.', 'Евсей обещал научить меня старым буквам.']), options: [bye] };
    }
    case 'grach': {
      if (has('s5_grach')) return {
        text: 'Видел я, кто к руднику ходил: люди Рыжего, а с ними приказчиков человек. Шайка нынче стоит у Чёрной гари. Сёмку моего возьми в замок: у него голуби. Как узнаю что — пришлю письмо.',
        options: [{ text: 'Возьму.', run: (a) => { a.finish('s5_grach'); a.start('s5_pigeon'); a.arriveNextMorning('semka'); } }],
      };
      return { text: pick(['В бору тихо. Это плохо.', 'Даша моя опять в лес убежала. Вся в мать.', 'Голубь дорогу знает лучше человека.']), options: [bye] };
    }
    case 'semka': {
      if (has('s5_pigeon') && f('pigeon')) return {
        text: 'Голубь от отца! Вот: «Шайка Рыжего у Чёрной гари. Атаман сам в лагере. Будь осторожен». Отец пишет — Рыжий не злой, только злой притворяется.',
        options: [{ text: 'Иду к ним.', run: (a) => { a.finish('s5_pigeon'); a.start('s5_camp'); toPlace(a, 'outlaw_camp', GANG.filter((g) => g !== 'kunitsa'), 400, 600); a.live('trader', null); a.live('kunitsa', 'place:outlaw_camp'); } }],
      };
      if (has('s5_pigeon')) return { text: 'Голубей устрою — и будем ждать письма от отца. Утром, может, прилетит.', options: [bye] };
      return { text: pick(['Это Сизарь, а это Белянка. Белянка быстрее.', 'Отсюда весь бор видно!', 'Голубь всегда домой летит. Даже если дом сгорел.']), options: [bye] };
    }
    case 'marfa': {
      if (has('s6_marfa')) return {
        text: 'От Никодима? Ну, коли так… Король болен? Двадцать лет болен, говоришь? Хм. Пойду. Только мне нужен его дневник — по нему пойму, чем он хворает.',
        options: [{ text: 'Будет дневник.', run: (a) => { a.finish('s6_marfa'); a.start('s6_cure'); a.arriveNextMorning('marfa', 'rooms_6'); } }],
      };
      if (has('s6_cure') && f('diary') && !f('poison')) return {
        text: 'Дай-ка… «Королева пила из чаши, горько, сказала. К утру…» Горько. Вороний глаз! Яд это, а не горячка. И король пьёт что-то горькое уж двадцать лет — кто ему подносит?',
        options: [{ text: 'Чем лечить?', run: (a) => a.flag('poison', 1), next: { text: 'Принеси 8 сладких ягод, бутылку мёда и сверкающий ломтик арбуза. Отвар сварю.' } }],
      };
      if (has('s6_cure') && f('poison')) return {
        text: 'Принёс травы?',
        options: [{ text: 'Вот всё.', next: (a, p) => (a.take(p, [['minecraft:sweet_berries', 8], ['minecraft:honey_bottle', 1], ['minecraft:glistering_melon_slice', 1]]) ? (a.finish('s6_cure'), a.flag('king_up', 1), a.live('vsevolod', 'feast:0'), checkStage(a, 6), {
          text: 'Сварю к вечеру. А завтра король встанет, вот увидишь. И вели Агафье: никаких чаш, кроме моих.',
        }) : { text: 'Не всё: 8 сладких ягод, бутылка мёда и сверкающий ломтик арбуза.' }) }, bye],
      };
      if (has('s6_cure')) return { text: 'Дневник короля мне нужен. Он у себя в опочивальне держал его.', options: [bye] };
      if (f('tidy_marfa') && !S.q.s6_garden && !done('s6_garden')) return {
        text: 'Я тут порядок навёл… навела: лекарская, склянки. А трав нет. Огород во дворе зарос — вскопать бы.',
        options: [{ text: 'Помогу.', run: (a) => { a.start('s6_garden'); a.openContract('garden'); } }],
      };
      return { text: pick(['Травы помнят руки.', 'Вороний глаз… ягода как ягода. А убивает.', 'Королю лучше. Я вижу.']), options: [bye] };
    }
    case 'prokhor': {
      if (has('s7_prokhor')) return {
        text: 'Из замка?.. Слушай, раз пришёл. Двадцать лет назад, в ту зиму, я вытащил из болота мальчишку. На шее у него был серебряный оберег — башня. Я испугался: за таким придут. Оберег зарыл под крестом у Старой гати. А мальчишку вырастили мы, углежоги. Рыжего.',
        options: [{ text: 'Где эта гать?', run: (a) => { a.finish('s7_prokhor'); a.start('s7_gat'); a.setPlace('gat_amulet', 250, 450); a.arriveNextMorning('prokhor', 'rooms_7'); }, next: { text: 'В бору, на болоте. Иди по компасу. А я приду в замок: копать умею, темноты не боюсь. Говорят, у вас ходы завалены.' } }],
      };
      if (f('tidy_prokhor') && !S.q.s7_catacombs && !done('s7_catacombs')) return {
        text: 'Я тут порядок навёл: караульня, темница. А ходы под донжоном завалены, и оттуда нежить лезет. Брёвна на подпорки нужны и факелы. И нежить выбить.',
        options: [{ text: 'Возьмусь.', run: (a) => { a.start('s7_catacombs'); a.openContract('catacombs'); a.start('s7_undead'); a.start('s7_sealed'); } }],
      };
      if (api.S.st.nozhov === 'captive' && has('s8_nozhov')) return { text: 'Веди его сюда, в темницу. Ключи у меня.', options: [bye] };
      return { text: pick(['Темноты не боюсь. Людей боюсь.', 'Мальчишка тот ничего не помнил. Только колыбельную насвистывал.', 'Уголь — дело чёрное. Да руки после него чище, чем у иных.']), options: [bye] };
    }
    case 'timosha': return { text: pick(['Спою тебе песню о пропавшем княжиче? «Ушёл во тьму, вернётся в зарю…»', 'На пиру буду петь до утра!', 'Гусли старые, да струны новые.']), options: [bye] };
    case 'watchman': {
      if (has('s8_sawmill')) return {
        text: 'Приказчик в Затонье уехал. А я тут двадцать лет сторожу — и двадцать лет вижу, как он одну книгу пишет для управы, а другую — для себя. Возьми. Не могу больше молчать.',
        options: [{ text: 'Спасибо, Гаврила.', run: (a, p) => { a.give(p, 'minecraft:paper', 1, 'Счета Ножова', ['Вторая книга приказчика']); a.finish('s8_sawmill'); a.flag('ledger2', 1); } }],
      };
      return { text: pick(['Запруду бы почистить.', 'Приказчика нет — и слава Богу.', 'Доски нынче дорогие.']), options: [bye] };
    }
    case 'kuzma': {
      if (has('s2_smith')) return {
        text: 'Кузьма я, старшина артели. Гордей у нас, да. Только сейчас не до гостей: шатун вокруг стана ходит. Медведь, что зимой не лёг, — голодный и злой. Денису руку порвал.',
        options: [{ text: 'Помогу с шатуном.', run: (a) => { a.finish('s2_smith'); a.start('s2_bear'); }, next: { text: 'Ходит он в ельнике вокруг стана. Подойдёт — увидишь. Бей и не жалей.' } }, bye],
      };
      if (has('s2_bear')) return { text: 'Шатун вокруг стана ходит. Как выйдет — бей!', options: [bye] };
      if (done('s2_bear') && !f('kuzma_paid')) return {
        text: 'Взял шатуна! Ну, ты могуч. Держи долю артели — заслужил.',
        options: [{ text: 'Спасибо.', run: (a, p) => { a.flag('kuzma_paid', 1); a.give(p, 'minecraft:leather', 8); a.give(p, 'minecraft:cooked_beef', 6); a.give(p, 'minecraft:arrow', 16); }, next: { text: 'А Гордей тебе что-то сказать хочет. Иди к нему.' } }],
      };
      return { text: pick(['Лось нынче ушёл за реку.', 'Артель жива, пока все вместе.', 'Если что — заходи. Мясо всегда есть.']), options: [bye] };
    }
    case 'hunter': {
      if (has('s2_knife')) return {
        text: 'Нож? Хороший нож, звонкий. Купил прошлой осенью на дороге у людей Рыжего. Дёшево отдали — у них таких много, целый воз.',
        options: [{ text: 'Целый воз?', run: (a) => a.flag('knife', 1), next: { text: 'Ну, может, не воз. Но штук двадцать видел. Все с той же башней. Гордею скажи — он поймёт.' } }],
      };
      return { text: pick(['Белку в глаз — это не сказки.', 'Шатуна ты здорово…', 'Тише. Зверь слушает.']), options: [bye] };
    }
    case 'nastya': {
      if (has('s3_lights')) return { text: 'Огни приходят после заката, со стороны леса. Мужа нет, детей боюсь одних оставить… Помоги, Христа ради.', options: [bye] };
      if (done('s3_lights') && !f('nastya_paid')) return {
        text: 'Спасибо тебе! Возьми хоть хлеба с собой. И в замок теперь будем возить молоко да мясо — Агафье кланяйся.',
        options: [{ text: 'Спасибо, хозяюшка.', run: (a, p) => { a.flag('nastya_paid', 1); a.give(p, 'minecraft:bread', 8); a.give(p, 'minecraft:cooked_beef', 4); } }],
      };
      return { text: pick(['Митя мой в остроге служит. Скучаю.', 'Коровы целы — и ладно.', 'Заходи, накормлю.']), options: [bye] };
    }
    case 'yaroslav': {
      if (f('stage9_done')) return { text: 'Рыжий — княжич? Ну и дела. Я за ним три года гонялся, а теперь его люди дороги стерегут. Бывает же.', options: [bye] };
      return null;
    }
    case 'lykov': return { text: pick(['Служу!', 'Сотник у нас строгий.', 'Говорят, в замке теперь кормят. Возьмите к себе!']), options: [bye] };
    // ===== Шайка =====
    case 'sych': {
      if (f('forest_guard')) return { text: 'Стоим на дорогах. Теперь — за хозяина. За тебя, то есть.', options: [bye] };
      if (S.st.sych === 'hostile') return { text: 'Сам напал — сам и получай!', options: [bye] };
      if (!f('sych_ok')) return {
        text: 'Стой. Дальше — по слову атамана. Кто таков?',
        options: [{ text: 'Из замка. К атаману.', run: (a) => a.flag('sych_ok', 1), next: { text: 'Из замка?.. Атаман таких любит. Иди. Руки держи на виду. И мальчишку нашего, Шило, берегись — без кошеля останешься.' } }],
      };
      return { text: 'Я за тобой смотрю. Одним глазом, да зорко.', options: [bye] };
    }
    case 'ryzhy': {
      if (has('s9_heir') || f('heir_seen')) return { text: f('stage9_done') ? 'Ну что, хозяин? Лес тебя принял — значит, и я приму. Люди мои дороги стерегут. Заходи, если что.' : 'Отец… Странное слово. Я в бору вырос, там моё место. А замок пусть будет твой.', options: [bye] };
      if (has('s8_siege') && S.f.siege_talk !== 1) {
        const e = evidence(api, pl), n = [e.amulet, e.letter, e.lullaby, e.horse].filter(Boolean).length;
        if (!n) return { text: 'Слова! Мне платят за то, чтобы этот замок горел. Принеси мне что-нибудь, кроме слов, — или уходи с дороги.', options: [bye] };
        const opts = [];
        if (e.amulet) opts.push({ text: 'Показать оберег-башню.', next: endSiege(n, 'Оберег… Башня. Я помню её — на шее, в темноте, в холодной воде. Откуда он у тебя?') });
        if (e.letter) opts.push({ text: 'Прочитать письмо королевы.', next: endSiege(n, '«Ефремушка, если ты читаешь это — значит, я не смогла тебя уберечь…» Перестань. Хватит.') });
        if (e.lullaby) opts.push({ text: 'Напеть колыбельную.', next: endSiege(n, 'Откуда ты её знаешь? Её никто не знает. Её… её мать пела.') });
        if (e.horse) opts.push({ text: 'Показать деревянного конька.', next: endSiege(n, 'Конёк… Хвост отломан, я сам его отломал, когда… Я прятался. В стене. Там была решётка и свечи внизу. Откуда ты это взял?') });
        return { text: 'Ты? Опять ты. Пришёл умереть за старика?', options: opts };
      }
      if (has('s5_camp')) return {
        text: 'Так это ты в замке шумишь? Садись к огню, раз пришёл. Мне платят, знаешь ли, — приказчик Ножов. Чтобы я «приглядывал за замком, пока старик не помрёт». А потом, говорит, будет большое дело.',
        options: [{ text: 'Зачем Ножову замок?', next: { text: 'А мне почём знать? Платит — и ладно. (Рыжий отворачивается к огню и тихо насвистывает старую протяжную песню. Мотив странно знакомый, как колыбельная.)', options: [{ text: 'Что это за песня?', run: (a) => { a.finish('s5_camp'); a.start('s5_lullaby'); a.flag('heard_song', 1); }, next: { text: 'Песня? Не знаю. Всегда её помню. Отстань.' } }] } }],
      };
      return { text: pick(['Лес — мой дом. Другого не помню.', 'Ножов? Скользкий. Но платит.', 'Чего уставился? Иди, пока цел.']), options: [bye] };
    }
    case 'pakhom': {
      if (has('x_peace')) return {
        text: 'Эх, зря ты на наших полез… Атаман ушёл, ребята злые. Принеси дар — 8 хлеба да 8 жареного мяса. Я замолвлю слово.',
        options: [{ text: 'Вот дар.', next: (a, p) => (a.count(p, 'minecraft:bread') >= 8 && cookedCount(a, p) >= 8 && a.take(p, [['minecraft:bread', 8]]) && takeCooked(a, p, 8) ? (makePeace(a), { text: 'Добро. Атаман вернётся — я скажу, что ты не со зла.' }) : { text: 'Мало. 8 хлеба и 8 жареного мяса.' }) }, bye],
      };
      if (f('heard_song') && !f('pakhom_told')) return {
        text: 'Песня у атамана, говоришь? Он её с малолетства свистит. Его углежоги из болота вытащили, Прохор, кажется. Мальчонка ничего не помнил — ни имени, ни дома. Только эту песню.',
        options: [{ text: 'Спасибо, Пахом.', run: (a) => a.flag('pakhom_told', 1) }],
      };
      return { text: pick(['Каша сегодня с салом. Будешь?', 'Шило опять всё тащит. Держи суму крепче.', 'Атаман не злой. Жизнь злая.']), options: [bye] };
    }
    case 'shilo': {
      if (has('x_shilo')) return {
        text: 'Ничего я не брал! …Ну ладно. На, забирай. Я просто посмотреть.',
        options: [{ text: 'Больше не балуй.', run: (a, p) => { const it = a.S.f.stolen; if (it) a.give(p, it.id, it.n); a.S.f.stolen = null; a.save(); a.finish('x_shilo'); } }],
      };
      return { text: pick(['Чего надо?', 'Я тут ни при чём!', 'А у тебя в замке много золота?']), options: [bye] };
    }
    case 'grinya': return { text: S.st.grinya === 'hostile' ? 'Ррраз — и нету!' : pick(['Чего надо?', 'Атаман сказал — не трогать. Не трогаю.', 'Дубина моя — Машенька. Хочешь познакомиться?']), options: [bye] };
    case 'voron': return { text: pick(['…', 'С помоста всё видно. И тебя тоже.', 'Ворон в бору один. Как и я.']), options: [bye] };
    case 'kunitsa': return { text: f('trader_n') ? 'Узнал? Да, я торговка с площади. Работа такая. Без обид.' : pick(['Чего уставился?', 'Ножи точу. Хочешь проверить?']), options: [bye] };
    case 'nozhov': {
      if (api.where('nozhov') === 'home') return { text: pick(['Это ошибка! Я служил честно!', 'Король при смерти, а вы… Вы ещё пожалеете.', 'Всё ради замка. Всё ради порядка.']), options: [bye] };
      return { text: 'Прочь с дороги! Ты не знаешь, с кем говоришь!', options: [bye] };
    }
  }
  return null;
}

// Конец осады после разговора с Рыжим: чем больше улик, тем короче и мирнее
function endSiege(n, first) {
  const finish = (a) => {
    a.S.f.siege_talk = 1; a.save();
    for (const m of a.dim().getEntities({ tags: ['acastle_siege'] })) { m.removeTag('acastle_siege'); flee(m); }
    a.live('ryzhy', null);
    a.finish('s8_siege');
    a.setState('nozhov', 'flee');
    a.start('s8_nozhov');
    for (const p of a.players()) p.onScreenDisplay.setTitle('§cНожов бежит!', { subtitle: 'Догоните его и ударьте', fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 });
  };
  if (n >= 2) return { text: first + ' …Хватит. Ребята! Уходим. Я сам приду в замок. Утром.', options: [{ text: 'Буду ждать.', run: finish }] };
  return { text: first + ' Не знаю, кто ты и откуда это взял. Но драться я больше не хочу. Уходим!', options: [{ text: 'Иди с миром.', run: finish }] };
}
// Разбойник бежит и исчезает в лесу
function flee(e) {
  try { e.triggerEvent('acastle:flee'); } catch (err) { /* ничего */ }
  system.runTimeout(() => { try { e.remove(); } catch (err) { /* уже нет */ } }, 80);
}
function makePeace(a) {
  for (const id of GANG) if (a.S.st[id] === 'hostile') a.setState(id, null);
  a.live('ryzhy', a.flag('camp_empty') ? null : 'place:outlaw_camp');
  a.finish('x_peace');
}

const COOKED = ['minecraft:cooked_beef', 'minecraft:cooked_porkchop', 'minecraft:cooked_mutton', 'minecraft:cooked_chicken', 'minecraft:cooked_rabbit'];
const cookedCount = (a, p) => COOKED.reduce((s, id) => s + a.count(p, id), 0);
function takeCooked(a, p, n) {
  let need = n;
  for (const id of COOKED) { const t = Math.min(a.count(p, id), need); if (t) { a.take(p, [[id, t]]); need -= t; } }
  return true;
}

// ---------- Реплики мимоходом ----------
export function lateBark(id, api, pl) {
  const S = api.S;
  if (id === 'shilo' && !S.f.stolen_once && api.where('shilo') === 'place:outlaw_camp') {
    // Шило ворует мелочь из сумки (не из рук и не именные предметы)
    const inv = pl.getComponent('minecraft:inventory').container;
    for (let i = 9; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (!it || it.nameTag || it.typeId === 'acastle:quest_book') continue;
      const n = Math.min(it.amount, 4);
      api.take(pl, [[it.typeId, n]]);
      S.f.stolen = { id: it.typeId, n }; S.f.stolen_once = 1; api.save();
      api.start('x_shilo');
      return 'Ой, простите, дяденька! (Мальчишка прошмыгнул мимо. Сума стала легче.)';
    }
  }
  if (GANG.includes(id) && S.st[id] === 'hostile') return 'Бей его!';
  return null;
}

// ---------- События ----------
export function lateEvent(name, api, ev) {
  const S = api.S;
  switch (name) {
    case 'morning':
      if (api.has('s5_pigeon') && S.npcs.semka === 'home' && !S.f.pigeon) { S.f.pigeon = 1; api.save(); api.tell('§7На голубятню прилетел голубь с письмом. Сёмка зовёт вас.'); }
      if (S.f.siege_talk === 1 && !api.has('s8_siege')) { S.f.siege_talk = 2; disperse(api); api.save(); }
      if (typeof S.f.king_dies === 'number' && world.getDay() > S.f.king_dies && !S.f.king_dead) {
        S.f.king_dead = 1; S.f.king_dead_day = world.getDay(); api.save();
        api.live('vsevolod', null);
        for (const p of api.players()) { p.onScreenDisplay.setTitle('§7Король Всеволод умер', { subtitle: 'на рассвете, во сне', fadeInDuration: 30, stayDuration: 100, fadeOutDuration: 30 }); p.playSound('block.bell.hit'); }
        api.tell('§7Звонит колокол. Король Всеволод умер на рассвете. Замок теперь ваш. Рыжий ушёл в бор: его люди стерегут дороги — лагерь у Чёрной гари теперь дружеский.');
        api.flag('forest_guard', 1);
        for (const id of GANG) { api.setState(id, null); api.live(id, 'place:outlaw_camp'); }
      }
      break;
    case 'arrived:gordey':
      api.finish('s2_wait');
      api.start('s2_forge'); api.openContract('forge');
      api.start('s2_tiltyard'); api.openContract('tiltyard');
      api.start('s2_hammer');
      api.tell('§6Гордей и Васька пришли в замок. Оружейные и арсенал прибраны.');
      break;
    case 'arrived:ignat':
      api.finish('s3_wait');
      api.start('s3_works'); for (const u of ['steward', 'barn', 'square', 'yard']) api.openContract(u);
      api.start('s3_books');
      api.live('trader', 'home'); api.start('x_trader');
      api.tell('§6Игнат и Дуня пришли в замок. Подклет, кладовые и казна прибраны.');
      break;
    case 'arrived:varlaam':
      api.finish('s4_wait');
      api.start('s4_crypt'); api.start('s4_chapel'); api.openContract('chapel'); api.start('s4_priest');
      api.tell('§6Отец Варлаам пришёл в замок. Часовня донжона и ризница прибраны.');
      break;
    case 'arrived:evsey': api.tell('§6Переписчик Евсей пришёл в замок. Библиотека и архив прибраны.'); break;
    case 'arrived:lenz': api.tell('§6Картограф Ленц пришёл в замок и поселился в комнате звездочёта.'); break;
    case 'arrived:semka': api.tell('§6Сёмка с голубями поселился в голубятне.'); break;
    case 'arrived:marfa': api.tell('§6Травница Марфа пришла в замок. Лекарская и лаборатория прибраны.'); break;
    case 'arrived:prokhor': api.tell('§6Прохор пришёл в замок. Караульня подклета и темница прибраны.'); break;
    case 'arrived:timosha': api.tell('§6В замок пришёл гусляр Тимоша. Парадные покои прибраны к пиру.'); break;
    case 'arrived:ryzhy':
      api.live('vsevolod', 'feast:0'); api.setState('ryzhy', null); api.flag('heir_seen', 1);
      STARTS[9](api);
      api.tell('§6Утром в замок пришёл Рыжий. Он ждёт в Большом зале у трона, рядом с королём.');
      break;
    case 'done:s2_bear': api.start('s2_knife'); break;
    case 'repaired:forge':
      api.finish('s2_forge'); api.say('gordey', 'Горн горит! Держи — первый клинок новой кузни. И щит в придачу.', 200);
      for (const p of api.players()) { api.give(p, 'minecraft:iron_sword', 1, 'Меч замковой ковки', ['Клеймо: башня в круге']); api.give(p, 'minecraft:shield', 1); }
      checkStage(api, 2); break;
    case 'repaired:tiltyard': api.finish('s2_tiltyard'); checkStage(api, 2); break;
    case 'repaired:steward': case 'repaired:barn': case 'repaired:square': case 'repaired:yard':
      api.tell('§6Готово: ' + LATE_CONTRACTS[name.slice(9)].title + '.');
      if (['steward', 'barn', 'square', 'yard'].every((u) => api.repaired(u))) { api.finish('s3_works'); checkStage(api, 3); }
      break;
    case 'repaired:chapel': api.finish('s4_chapel'); checkStage(api, 4); break;
    case 'repaired:garden': api.finish('s6_garden'); checkStage(api, 6); break;
    case 'repaired:catacombs': api.finish('s7_catacombs'); checkStage(api, 7); break;
    case 'repaired:heritage':
      api.finish('s9_heritage'); api.flag('stage9_done', 1); api.renown(5, 'этап 9');
      for (const p of api.players()) p.onScreenDisplay.setTitle('§6Замок восстановлен', { subtitle: 'Студёный детинец снова жив', fadeInDuration: 20, stayDuration: 100, fadeOutDuration: 30 });
      api.tell('§6Трон позолочен, знамёна подняты, колокол звонит. Сюжет замка пройден. Спасибо!');
      break;
    case 'done:s3_lights': break;
    case 'done:s4_crypt': case 'done:s4_priest': checkStage(api, 4); break;
    case 'done:s5_vault': break;
    case 'done:s5_lullaby': checkStage(api, 5); break;
    case 'done:s7_gat': case 'done:s7_undead': case 'done:s7_sealed': checkStage(api, 7); break;
    case 'done:s8_nozhov':
      api.tell('§6Ножов в темнице. Прохор запер решётку.');
      checkStage(api, 8);
      break;
    case 'done:s9_shrine': api.start('s9_return'); break;
    case 'block': {
      const b = ev.block, p = ev.player;
      if (api.has('s2_hammer') && container(b) && inRoom(api, b, 'Арсенал', 9) && !api.flag('hammer')) {
        api.flag('hammer', 1); api.give(p, 'minecraft:mace', 1, 'Молот деда', ['Молот замкового кузнеца']);
        p.sendMessage('§7Под ржавыми кольчугами — тяжёлый молот с клеймом-башней. Это он.');
      }
      if (api.has('s3_books')) {
        if (api.isSlot(b, 'ledger') && !api.flag('ledger')) { api.flag('ledger', 1); p.sendMessage('§7Книга податей: в год смерти королевы треть казны ушла «на нужды замка» за подписью казначея С. Ножова.'); }
        if (api.isSlot(b, 'steward_book') && api.flag('ledger') && !api.flag('steward_papers')) {
          api.flag('steward_papers', 1); api.finish('s3_books'); checkStage(api, 3);
          p.sendMessage('§7Бумаги управителя: «Казначей Ножов не явился утром. Его конь в мыле, седельные сумы пусты. Княжича ищут». Та же ночь.');
        }
      }
      if (api.has('s4_priest') && api.isSlot(b, 'priest')) { api.finish('s4_priest'); p.sendMessage('§7Записка старого священника: «Не горячка. Чаша. Тайна исповеди держит меня. Господи, прости».'); }
      if (api.has('s5_vault') && api.isSlot(b, 'vault')) { api.finish('s5_vault'); p.sendMessage('§7Грамота основателя и договор с Хозяином бора. Отнесите весть Евсею.'); }
      if (api.has('s6_cure') && api.isSlot(b, 'master_diary') && !api.flag('diary')) { api.flag('diary', 1); p.sendMessage('§7Дневник короля. Последняя запись о королеве: «Пила из чаши. Горько, сказала». Отнесите Марфе.'); }
      if (api.has('s7_sealed') && api.isSlot(b, 'sealed')) {
        api.give(p, 'minecraft:paper', 1, 'Письмо королевы', ['Ефремушке, если я не смогу его уберечь']);
        api.finish('s7_sealed'); p.sendMessage('§7Письмо королевы Елены сыну: «Ефремушка… если читаешь это — я не смогла тебя уберечь. Помни нашу песню».');
      }
      if (api.has('s7_gat') && container(b)) {
        const h = api.placeAt('gat_amulet');
        if (h && api.flat(b.location, h) < 6) {
          api.give(p, 'minecraft:iron_nugget', 1, 'Оберег-башня', ['Серебряный оберег рода', 'Нашёлся под крестом у Старой гати']);
          api.finish('s7_gat'); p.sendMessage('§7В тряпице — серебряный оберег в виде башни. Знак рода основателя.');
        }
      }
      break;
    }
    case 'hurt': {
      const e = ev.hurtEntity, src = ev.damageSource && ev.damageSource.damagingEntity;
      if (!e || e.typeId !== 'acastle:bandit') break;
      const id = api.npcIdOf(e);
      // Безымянные люди Рыжего не бьются до смерти: раненые убегают в лес
      if (!id && e.hasTag('acastle_raid')) {
        const h = e.getComponent('minecraft:health');
        if (h && h.currentValue < h.effectiveMax * 0.4) { for (const t of ['acastle_farm', 'acastle_siege', 'acastle_raid', 'acastle_road']) e.removeTag(t); flee(e); }
        break;
      }
      // Игрок напал на мирный лагерь: шайка враждебна, атаман уходит
      if (id && GANG.includes(id) && src && src.typeId === 'minecraft:player' && !S.st[id] && !api.flag('forest_guard') && api.where(id) === 'place:outlaw_camp' && !api.has('x_peace')) {
        for (const g of GANG) if (g !== 'pakhom' && g !== 'ryzhy') api.setState(g, 'hostile');
        api.live('ryzhy', null);
        api.start('x_peace');
        api.tell('§cЛагерь поднялся! Рыжий ушёл в чащу. Помириться можно через кашевара Пахома.');
      }
      break;
    }
    case 'trigger': {
      const id = api.npcIdOf(ev.entity);
      if (ev.eventId === 'acastle:yield' && id === 'ryzhy') {
        // Рыжий не погибает: бой стихает
        for (const m of api.dim().getEntities({ tags: ['acastle_siege'] })) { m.removeTag('acastle_siege'); flee(m); }
        api.tell('§7Рыжий опускается на колено. Его люди отступают. Поговорите с ним.');
        if (api.has('s8_siege')) { S.f.siege = null; S.f.siege_calm = 1; api.save(); }
      }
      if (ev.eventId === 'acastle:caught' && id === 'nozhov' && api.has('s8_nozhov') && S.st.nozhov !== 'captive') {
        api.setState('nozhov', 'captive');
        api.tell('§6Ножов упал на колени: «Не бей! Сдаюсь!» Накиньте на него поводок и отведите к Прохору.');
      }
      break;
    }
    case 'die': {
      let tags = [];
      try { tags = ev.deadEntity.getTags(); } catch (e) { tags = []; }
      if (tags.includes('acastle_shatun') && api.has('s2_bear')) api.finish('s2_bear');
      if (tags.includes('acastle_npc_ryzhy')) { S.down.ryzhy = 0; api.save(); }
      break;
    }
  }
}

// Переход к началу этапа n (для проверки в игре): всё, что было раньше, считается сделанным
export function jumpLate(n, api, base) {
  const S = api.S;
  for (const q of Object.keys(base.QUESTS)) {
    const m = /^s(\d)_/.exec(q);
    if (!m) continue;
    if (+m[1] < n) S.q[q] = 'done'; else delete S.q[q];
  }
  for (const [u, info] of Object.entries(api.castle.units)) if (info.stage < n && !(S.rep[u] && S.rep[u].st === 'done')) S.rep[u] = { st: 'due' };
  // жители прежних этапов — дома, поздних — ещё не пришли (и при переходе назад уходят)
  for (const [k, ids] of Object.entries(ARRIVALS)) for (const id of ids) { if (+k < n) S.npcs[id] = 'home'; else delete S.npcs[id]; }
  S.arrive = [];
  for (let k = n; k <= 9; k++) delete S.f[`stage${k}_done`];
  if (n >= 2) { for (const p of api.castle.posts) S.npcs[p.guard] = 'post'; }
  for (let k = 1; k < n; k++) S.f[`stage${k}_done`] = 1;
  Object.assign(S.f, { s1_talked: n > 1 ? 1 : S.f.s1_talked, seal: n > 1 ? 1 : S.f.seal, copy: n > 1 ? 1 : S.f.copy, farm_supply: n > 3 ? 1 : 0, lullaby: n > 5 ? 1 : 0, heard_song: n > 5 ? 1 : 0, king_up: n > 6 ? 1 : 0, camp_empty: n > 7 ? 1 : 0, vault_read: n > 5 ? 1 : 0 });
  if (n > 3) S.npcs.trader = n > 5 ? null : 'home';
  if (n > 6) S.npcs.vsevolod = 'feast:0';
  if (n > 8) { S.npcs.nozhov = 'home'; S.st.nozhov = null; }
  const rank = Object.entries(RANKS).filter(([k]) => +k < n).pop();
  S.rank = rank ? rank[1] : 'Гость';
  api.save();
  for (const pl of api.players()) {
    if (n >= 8) { api.give(pl, 'minecraft:iron_nugget', 1, 'Оберег-башня', ['Серебряный оберег рода']); api.give(pl, 'minecraft:paper', 1, 'Письмо королевы', ['Ефремушке']); }
    api.give(pl, 'acastle:quest_book');
  }
  for (const id of Object.keys(S.npcs)) api.live(id, S.npcs[id]);
  if (STARTS[n]) STARTS[n](api);
  api.tell(`§6Переход к этапу ${n}. Прежние этапы засчитаны, починка встанет, когда участки замка будут рядом.`);
}
