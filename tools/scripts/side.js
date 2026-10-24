// Второй круг сюжета (с 0.9.0): тайны замка, личные истории жителей и походы в малые места
// тайги (docs/story-expansion.md). Всё здесь — дополнение к этапам 0–9 (story.js, stages.js):
// задания открываются, когда житель уже на месте, и не мешают главным. В разговор они
// добавляются золотыми кнопками (sideOptions), события и реплики — как в stages.js.
// В текстах нет сторон света: только приметы.
import { world, system } from '@minecraft/server';
import { battle, raid } from './stages.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const isDay = () => world.getTimeOfDay() < 12000;
const container = (b) => /chest|barrel|decorated_pot/.test(b.typeId);
// Кнопка личной истории или побочного дела: золотая, чтобы её было видно среди обычных
const star = (text, run, next) => ({ text: '§6» ' + text, run, next });
const POST_OSTAP = [61, 0, 128], POST_MITKA = [65, 0, 128];

// ---------- Походы в места тайги ----------
// Кто даёт, куда идти, что там найти и кому вернуть. far — нужный тайник в конце тропы от места
// (дальше 18 блоков от середины); если тропы нет, засчитывается третий открытый там тайник.
const TRIPS = {
  p_sister: { title: 'Сестра', giver: 'dunya', place: 'mark_deadtree_letters', label: 'Сухое дерево-великан', range: [200, 380],
    back: { path: 'home_dunya', label: 'Комната служанок' },
    go: 'Дуня ищет старшую сестру Ульяну. Лесник видел девицу с письмами у сухой ели-великана — её видно поверх леса. Идите по компасу и загляните в дупло.',
    ret: 'Расскажите Дуне, что нашлось в дупле сухой ели.',
    found: 'В дупле — связка писем: Степан и Ульяна переписывались тайком от её отца. Последняя записка: «Встретимся у камня за тропкой. Уедем, обвенчаемся — и пусть сердится».' },
  x_buran: { title: 'Буран', giver: 'grach', place: 'mark_grave_dog', label: 'Могила Бурана', range: [150, 300],
    back: { place: 'hut_living_grach', label: 'Хижина лесника' },
    go: 'Лесник Грач просит навестить могилу своего пса Бурана и положить ему косточку. Могила — холмик с оградкой в бору.',
    ret: 'Вернитесь к леснику Грачу.',
    found: 'Под холмиком — ошейник с медной бляхой «Буран» и записка лесника: «Лучшему псу в бору. Вытащил меня из полыньи. Спи, друг». Вы кладёте рядом косточку.' },
  x_letter: { title: 'Письмо матери', giver: 'lykov', place: 'mark_grave_soldier', label: 'Могила солдата', range: [150, 300],
    back: { place: 'stockade_hunt', label: 'Острог' }, item: ['minecraft:paper', 'Письмо Петра Лыкова', ['Матери, в Затонье']],
    go: 'Служивый Лыков просит достать из могилы брата неотправленное письмо матери. Могила рядового Петра Лыкова — у дороги, под крестом.',
    ret: 'Отнесите письмо Петра служивому Лыкову в острог.',
    found: 'Под холмиком — солдатский узелок и письмо: «Матушка, служу исправно. Скоро побывка, привезу тебе платок». Письмо так и не ушло.' },
  x_stash: { title: 'Схрон Рыжего', giver: 'yaroslav', place: 'camp_abandoned_raid', label: 'Разграбленный стан', range: [200, 350], far: true,
    back: { place: 'stockade_hunt', label: 'Острог' }, item: ['minecraft:iron_nugget', 'Клеймо «Р»', ['Клеймо шайки Рыжего']],
    go: 'Сотник Ярослав: шайка разграбила стан охотников, следы ведут от кострища к их схрону. Найдите схрон — сотник заплатит.',
    ret: 'Отнесите клеймо шайки сотнику Ярославу в острог.',
    found: 'Под колом с черепом — схрон шайки: тюки с награбленным и железное клеймо «Р», им метят краденый лес.' },
  x_horn: { title: 'Белый рог', giver: 'nikodim', place: 'hut_abandoned_tikhon', label: 'Изба Тихона', range: [200, 380],
    item: ['minecraft:bone', 'Белый рог', ['Рог Хозяина бора, снятый с капища']],
    go: 'Никодим: старый лесник Тихон снял с капища белый рог, и с тех пор Хозяин бора ходил за ним. Изба Тихона брошена. Найдите рог.',
    ret: 'Верните белый рог Хозяину бора: отнесите его на капище. Если капище ещё не найдено, храните рог — оно откроется в конце сюжета замка.',
    found: 'В лабазе на столбах — белый рог, лёгкий, как кость, и холодный, как снег. Записка Тихона: «Верните его. Я не успел».' },
  x_somov: { title: 'Великий пал', giver: 'marfa', place: 'hut_burned_fire', label: 'Пепелище Сомовых', range: [200, 380], far: true,
    back: { path: 'home_marfa', label: 'Лекарская' }, item: ['minecraft:iron_nugget', 'Пуговица с мундира', ['С мундира приказчика Лесной управы']],
    go: 'Марфа: тридцать лет назад сгорел дом лесника Сомова, Анна погибла. Ножов уже тогда грозил им. Сходите на пепелище: может, улика уцелела.',
    ret: 'Покажите находку Марфе в лекарской.',
    found: 'У камня в конце тропы — то, что спрятал Матвей Сомов: медная пуговица с орлом Лесной управы, оторванная в ту ночь с чужого мундира.' },
  x_grisha: { title: 'Дозор на Хозяина', giver: 'kuzma', place: 'camp_treestand_grisha', label: 'Засидка на ели', range: [150, 320], far: true,
    back: { place: 'camp_hunters_bear', label: 'Стан артели' }, item: ['minecraft:white_wool', 'Клок белой шерсти', ['Светится, как снег под луной']],
    go: 'Кузьма: молодой охотник Гриша третий день сидит на засидке, ждёт белого лося. Не вернулся. Найдите засидку и Гришины следы.',
    ret: 'Расскажите Кузьме, что нашлось у засидки.',
    found: 'У корней кривой ели — лёжка огромного зверя и Гришина сума. На ветке — клок белой шерсти. Следы Гриши уходят рядом со следами лося, не враждебно — рядом.' },
};
const tripTarget = (q) => (api) => (api.flag(q + '_found') ? TRIPS[q].back || null : { place: TRIPS[q].place, label: TRIPS[q].label });
const tripHint = (q) => (api) => (api.flag(q + '_found') ? TRIPS[q].ret : TRIPS[q].go);
function startTrip(api, q) { api.setPlace(TRIPS[q].place, ...TRIPS[q].range); api.start(q); }
// Открыт тайник в месте похода?
function tripFound(api, q, b, p) {
  const t = TRIPS[q], h = api.placeAt(t.place);
  if (!h || !container(b)) return;
  const d = api.flat(b.location, h);
  if (d > 48) return;
  let ok = t.far ? d >= 18 : d <= 18;
  if (!ok && t.far) {
    const seen = api.S.f[q + '_seen'] = api.S.f[q + '_seen'] || [];
    const k = `${b.location.x},${b.location.y},${b.location.z}`;
    if (!seen.includes(k)) seen.push(k);
    api.save();
    ok = seen.length >= 3;
  }
  if (!ok) return;
  api.flag(q + '_found', 1);
  if (t.item) api.give(p, t.item[0], 1, t.item[1], t.item[2]);
  p.sendMessage('§7' + t.found);
}

// ---------- Задания ----------
const at = (api, room) => api.castle.rooms[room];
export const SIDE_QUESTS = {
  // ===== Тайны замка =====
  t_cross: { title: 'Крест на могиле', target: (api) => (api.flag('cross_found') ? { path: 'home_varlaam', label: 'Часовня' } : { path: 'slot_grave', label: 'Свежая могила' }),
    hint: (api) => (api.flag('cross_found') ? 'Отнесите крестик отца Ионы Варлааму в часовню во дворе.' : 'На кладбище у часовни одна могила присыпана гравием, а не землёй. Смахните гравий кистью.'),
    tick(api) {
      if (api.flag('cross_found')) return;
      const b = api.blockAt(api.W(api.castle.slots.grave));
      if (!b || b.typeId === 'minecraft:suspicious_gravel') return;
      api.flag('cross_found', 1);
      api.tell('§7Под гравием — медный крестик отца Ионы. Кто-то раскапывал его могилу и наспех засыпал гравием: искал что-то в гробу.');
    } },
  t_ear: { title: 'Голос в стене', target: (api) => (api.flag('ear_journal') ? { path: 'slot_ear', label: 'Бочка в каморке' } : { path: 'slot_ear_book', label: 'Ухо хозяина' }),
    hint: 'В каталоге библиотеки пометка: «Ухо хозяина — за гербом солара». Солар — на галерейном этаже донжона. За знаменем лаз в каморку над Большим залом: там кафедра с журналом и бочка.' },
  t_well: { title: 'Вода помнит', target: (api) => (api.flag('well_ring') ? { path: 'home_lenz', label: 'Комната звездочёта' } : api.flag('well_scheme') ? { path: 'room_well', label: 'Колодезная' } : { path: 'home_lenz', label: 'Сундук звездочёта' }),
    hint: (api) => (api.flag('well_ring') ? 'Расскажите Ленцу о находке.' : api.flag('well_scheme')
      ? 'По схеме звездочёта: в колодце донжона, на полпути к цистерне, в стенке шахты ниша с сундуком. Нырять с запасом воздуха (Марфа продаёт зелье водного дыхания).'
      : 'Ленц нашёл записи старого звездочёта Мартына: «Вода помнит». Схема — в сундуке в комнате звездочёта.') },
  t_prisoner: { title: 'Узник', target: (api) => (api.flag('pr_marks') ? { path: 'room_ossuary', label: 'Костница' } : { path: 'room_dungeon', label: 'Темница' }),
    hint: (api) => (!api.flag('pr_marks') ? 'Прохор: в первой камере темницы под соломой люк в каменный мешок. Спуститесь и осмотрите стены.'
      : !api.flag('pr_pot') ? 'На стене каменного мешка зарубки и имя: «Фома». Осмотрите горшок узника в углу.'
      : 'Узник писал: «В костнице одна кость тонкая. Дует оттуда». Найдите в стене костницы тонкую кладку и пройдите за неё.'),
    tick(api) {
      const sl = api.castle.slots;
      for (const p of api.players()) {
        if (!api.flag('pr_marks') && api.near(p, sl.prisoner_marks, 3, 3)) {
          api.flag('pr_marks', 1);
          p.sendMessage('§7На стене двести четырнадцать зарубок. Под ними нацарапано: «Фома, кравчий. Чашу дал Н. Я не пил. Агаша, не верь им».');
        }
        if (!api.flag('pr_pot') && api.near(p, sl.prisoner_pot, 3, 3)) {
          api.flag('pr_pot', 1);
          p.sendMessage('§7В горшке узника — деревянная миска и обрывок бересты: «В костнице одна кость тонкая. Дует оттуда. Пойду на ветер».');
        }
        if (api.near(p, sl.shrine, 5, 3)) {
          api.flag('pr_marks', 1); api.flag('pr_pot', 1);
          p.sendMessage('§7За тонкой костяной кладкой — святилище, старше замка. У алтаря истлевший кафтан кравчего. На камне нацарапано: «Агаше. Не бежал я. Прости». Фома ушёл из мешка на ветер — и не нашёл выхода.');
          api.finish('t_prisoner'); api.start('t_agasha');
          return;
        }
      }
    } },
  t_agasha: { title: 'Весть для Агафьи', target: () => ({ path: 'home_agafya', label: 'Кухня' }), hint: 'Расскажите Агафье, что стало с её мужем, кравчим Фомой.' },
  // ===== Личные истории =====
  p_mitka: { title: 'Отец', target: (api) => (api.flag('mk_note') ? { at: POST_MITKA, label: 'Митька у ворот' } : !api.flag('mk_book') ? { path: 'slot_captain', label: 'Комната капитана' }
    : !api.flag('mk_ostap') ? { at: POST_OSTAP, label: 'Остап у ворот' } : { path: 'slot_under_stairs', label: 'Каморка под лестницей' }),
    hint: (api) => (api.flag('mk_note') ? 'Отдайте Митьке записку его отца.' : !api.flag('mk_book') ? 'Отец Митьки, стражник Прокоп, пропал в ночь зимнего пира. Загляните в книгу караулов: она в сундуке в комнате капитана.'
      : !api.flag('mk_ostap') ? 'Книга караулов: следы Прокопа вели прочь от болота. Спросите старого Остапа, что он знает.' : 'Остап: вещи Прокопа — в каморке под парадной лестницей. Вход — из кладовых подклета, за бочками.') },
  p_frol: { title: 'Жеребёнок', target: () => ({ path: 'home_frol', label: 'Конюшня' }), hint: 'Фрол просит две золотые морковки: будет у Ласточки жеребёнок.' },
  p_vaska: { title: 'Турнир', target: () => ({ path: 'room_tiltyard', label: 'Ристалище' }),
    hint: (api) => (!api.flag('duel_ok') ? 'Васька мечтает стать оруженосцем. Поговорите с капитаном Демьяном о турнире.'
      : api.S.f.duel ? `Турнир идёт: схватка ${Math.min(3, api.S.f.duel.n + 1)} из 3. Бейтесь до первой крови: противник сдастся сам.` : 'Выходите днём на ристалище во дворе: три поединщика из острога, до первой крови.'),
    tick: duelTick },
  p_timosha: { title: 'Песнь о княжиче', target: () => ({ path: 'home_timosha', label: 'Музыкантская' }),
    hint: (api) => { const left = VERSES.filter((v) => !api.flag('verse_' + v.who)).map((v) => v.name); return left.length ? `Тимоша собирает старую песню. Куплеты помнят: ${left.join(', ')}.` : 'Все куплеты собраны. Попросите Тимошу спеть всю песню.'; } },
  // ===== Походы в тайгу =====
  ...Object.fromEntries(Object.keys(TRIPS).map((q) => [q, { title: TRIPS[q].title, target: tripTarget(q), hint: tripHint(q) }])),
  x_road: { title: 'Разбой на дороге', target: () => ({ place: 'road_raid', label: 'Дорога' }),
    hint: (api) => (api.S.f.road_fight ? 'Прогоните людей Рыжего с дороги! Раненые убегают.' : 'Демьян: на дороге шалят люди Рыжего. Идите по компасу и прогоните их. Сотник платит за каждый набег.'),
    tick(api) {
      const pt = api.S.places.road_raid;
      // шайка ушла к замку (этап 7): на дорогах тихо
      if (api.flag('camp_empty') && !api.S.f.road_fight) { api.drop('x_road'); return; }
      if (!pt) return;
      const p0 = { x: pt.x, y: 0, z: pt.z };
      const near = (p, r) => api.flat(p.location, p0) < r;
      battle(api, 'road_fight', {
        tag: 'acastle_road', label: 'Разбой на дороге',
        ready: () => api.players().some((p) => near(p, 24)),
        stay: () => api.players().some((p) => near(p, 72)),
        near: (p) => near(p, 72),
        start: () => api.tell('§cНа дороге люди Рыжего!'),
        waves: [(a) => raid(a, p0, 3, 'acastle_road', 8, 14), (a) => raid(a, p0, 3, 'acastle_road', 8, 14)],
        win: () => {
          api.finish('x_road'); api.S.f.road_next = world.getDay() + 2; api.save();
          for (const p of api.players()) api.give(p, 'minecraft:emerald', 4);
          api.tell('§6Дорога чиста. Сотник Ярослав прислал награду: 4 изумруда.'); api.renown(1, 'Разбой на дороге');
        },
        lose: () => api.tell('§7Разбойники ушли в лес. Вернитесь на дорогу.'),
      });
    } },
};
// Белый рог возвращается на капище, как только игрок пришёл туда с рогом
SIDE_QUESTS.x_horn.target = (api) => (!api.flag('x_horn_found') ? { place: 'hut_abandoned_tikhon', label: 'Изба Тихона' } : api.S.places.mark_shrine_master ? { place: 'mark_shrine_master', label: 'Капище' } : null);
SIDE_QUESTS.x_horn.tick = (api) => {
  const h = api.placeAt('mark_shrine_master');
  if (!h || !api.flag('x_horn_found')) return;
  const p = api.players().find((q) => api.flat(q.location, h) < 8 && api.hasNamed(q, 'minecraft:bone', 'Белый рог'));
  if (!p) return;
  api.takeNamed(p, 'minecraft:bone', 'Белый рог');
  p.onScreenDisplay.setTitle('§fБелый рог вернулся', { subtitle: 'Лес благодарит вас', fadeInDuration: 20, stayDuration: 60, fadeOutDuration: 20 });
  p.sendMessage('§7Вы кладёте белый рог в чашу на алтаре. Из чащи долго глядит что-то белое, выше ели. Когда вы оборачиваетесь, у камня лежат дары.');
  api.give(p, 'minecraft:golden_apple', 2); api.give(p, 'minecraft:emerald', 8);
  api.flag('horn_returned', 1); api.finish('x_horn'); api.renown(4, 'Белый рог');
};

// ---------- Турнир на ристалище ----------
const DUELISTS = ['Поединщик Рябой', 'Поединщик Кочет', 'Поединщик Медведко'];
function duelTick(api) {
  const S = api.S;
  if (!api.flag('duel_ok')) return;
  const c = at(api, 'Ристалище');
  if (!c) return;
  const w = api.W(c);
  const foes = () => api.dim().getEntities({ tags: ['acastle_duel'] });
  let d = S.f.duel;
  if (!d) {
    if (!isDay() || !api.players().some((p) => api.flat(p.location, w) < 14)) return;
    d = S.f.duel = { n: 0, wait: 0, t: 0 }; api.save();
    api.say('demyan', 'Турнир! Три поединщика из острога. До первой крови — не до смерти!', 64);
  }
  if (!isDay() || !api.players().some((p) => api.flat(p.location, w) < 40)) {
    for (const e of foes()) e.remove();
    S.f.duel = null; api.save();
    api.say('demyan', 'Турнир отложен. Приходи днём на ристалище — начнём сначала.', 200);
    return;
  }
  if (foes().some((e) => e.hasTag('acastle_duel_on'))) {
    if (++d.t > 180) { for (const e of foes()) e.remove(); api.save(); }
    return;
  }
  if (d.n >= 3) { S.f.duel = null; api.save(); tourneyWon(api); return; }
  if (++d.wait < 4) { api.save(); return; }
  d.wait = 0; d.t = 0; api.save();
  // поединщик встаёт на свободное место рядом с серединой ристалища (не в чучело)
  const free = (x, z) => [0, 1].every((dy) => { const b = api.blockAt({ x, y: w.y + dy, z }); return b && b.isAir; });
  const [ox, oz] = [[0, 3], [0, -3], [3, 0], [-3, 0], [0, 0]].find(([x, z]) => free(w.x + x, w.z + z)) || [0, 3];
  try {
    const e = api.dim().spawnEntity('acastle:bandit', { x: w.x + ox + 0.5, y: w.y, z: w.z + oz + 0.5 }, { spawnEvent: 'acastle:as_lykov' });
    e.nameTag = DUELISTS[d.n]; e.addTag('acastle_duel'); e.addTag('acastle_duel_on'); e.triggerEvent('acastle:hostile');
    api.say('demyan', `Схватка ${d.n + 1}: ${DUELISTS[d.n]}! Начинай!`, 64);
  } catch (err) { /* ристалище не загружено */ }
}
function duelYield(api, e) {
  try { e.removeTag('acastle_duel_on'); e.triggerEvent('acastle:peaceful'); } catch (err) { /* уже нет */ }
  if (api.S.f.duel) { api.S.f.duel.n++; api.save(); }
  api.tell(`§7«Признаю! Твоя взяла», — ${e.nameTag || 'поединщик'} опускает оружие.`);
  system.runTimeout(() => { try { e.remove(); } catch (err) { /* уже нет */ } }, 60);
}
function tourneyWon(api) {
  for (const p of api.players()) {
    api.giveEnchanted(p, 'minecraft:iron_sword', 'Турнирный меч', ['Победителю турнира в Студёном детинце'], [['sharpness', 1]]);
    api.give(p, 'minecraft:emerald', 5);
  }
  api.flag('squire_vaska', 1); api.finish('p_vaska'); api.renown(4, 'Турнир');
  api.say('demyan', 'Три схватки — три победы! Васька, отныне ты оруженосец. Держи щит ровно и не болтай.', 120);
}

// ---------- Песнь о княжиче ----------
const VERSES = [
  { who: 'ostap', name: 'Остап', text: '«Стражник у стены стоял,\nВидел босого мальца.\nНе окликнул, не поймал —\nУвёл погоню от крыльца».\n\nЭто про Прокопа, Митькиного отца. Мы её потом тихо пели, чтоб казначей не слышал.' },
  { who: 'agafya', name: 'Агафья', text: '«Горька чаша, горек мёд,\nКравчий чашу подавал.\nКто насыпал — тот уйдёт,\nКто подал — тот пропадал».\n\nЭто кухонная, голубчик. Не любила я её петь.' },
  { who: 'frol', name: 'Фрол', text: '«Конь казначеев вороной\nДо рассвета в мыле шёл.\nКто искал в ночи с тобой,\nТот дорогу не нашёл».\n\nКонюхи её сложили. Про того самого коня.' },
  { who: 'prokhor', name: 'Прохор', text: '«Топь черна, вода темна,\nУгольщик мальца достал.\nБашня с шеи — в гать, до дна,\nЧтоб никто его не знал».\n\nУглежоги поют. Не думал, что про меня.' },
];
const SONG = 'Тимоша берёт гусли:\n\n«Зимний пир, свечей огни, чаша по кругу пошла…\nУшёл во тьму княжич малый — вернётся в зарю, как мать ждала».\n\n' +
  'Он поёт про стражника у стены, про горькую чашу, про коня в мыле и про угольщика у топи. И в конце — тихо, как колыбельную:\n\n«Спи, сыночек, ночь темна. Лес укроет, лось поможет. Мать тебя дождётся».';

// ---------- Разговоры: кнопки, которые добавляются к обычному разговору ----------
export function sideOptions(id, api, pl) {
  const S = api.S, has = api.has, done = api.done, seen = api.seen, f = api.flag, out = [];
  const tripBack = (q, text, reply, run) => { if (has(q) && f(q + '_found') && TRIPS[q].giver === id) out.push(star(text, (a, p) => { if (run) run(a, p); a.finish(q); }, reply)); };
  // песня: куплет у тех, кто помнит ту зиму
  const verse = VERSES.find((v) => v.who === id);
  if (verse && has('p_timosha') && !f('verse_' + id)) out.push(star('Тимоша собирает песню о княжиче. Помнишь куплет?', (a) => a.flag('verse_' + id, 1), { text: verse.text }));
  switch (id) {
    case 'varlaam':
      if (done('s4_chapel') && done('s4_priest') && !seen('t_cross')) out.push(star('Могила отца Ионы', (a, p) => { a.start('t_cross'); if (!a.count(p, 'minecraft:brush')) a.give(p, 'minecraft:brush'); },
        { text: 'Отец Иона просил: «Положите меня с крестиком моим». А на могиле его — гравий, не земля: кто-то раскапывал. Смахни гравий кистью — вот, возьми, — и посмотри, цел ли крестик.' }));
      if (has('t_cross') && f('cross_found')) out.push(star('Крестик отца Ионы нашёлся.', (a) => { placeCross(a); a.finish('t_cross'); a.flag('bless', 1); a.renown(3, 'Крест на могиле'); },
        { text: 'Его крестик… Значит, искали в гробу его записку — думали, он унёс тайну с собой. А тайна лежала в часовне донжона. Поставим крест, зажжём свечу. И приходи ко мне за благословением: в бою оно не лишнее.' }));
      if (f('foma_known') && !f('foma_buried')) out.push(star('Отпеть кравчего Фому', (a) => { a.flag('foma_buried', 1); a.renown(1, 'Панихида по Фоме'); },
        { text: 'Двадцать лет его не поминали как беглого. Сегодня помянем как мученика. Агафью позову — пусть постоит рядом.' }));
      break;
    case 'evsey':
      if (done('s5_vault') && !seen('t_ear')) out.push(star('Что за пометки в каталоге?', (a) => a.start('t_ear'),
        { text: 'На полях каталога рука хранителя Пимена: «Ухо хозяина — за гербом солара. Основатель строил его, чтобы слышать пиры. Мальчик туда лазил — я видел, не выдавал». Мальчик — это княжич Ефрем, больше некому.' }));
      break;
    case 'lenz':
      if (api.where('lenz') === 'home' && done('s5_mine') && !seen('t_well')) out.push(star('Что за бумаги у старого звездочёта?', (a) => a.start('t_well'),
        { text: 'Мой предшественник, Мартын, был человек странный: писал стихи звёздам. Но вот запись: «Вода помнит. Королева просила спрятать её вещь». Схема, пишет, в его сундуке. Найди — мне по лестницам уже тяжело.' }));
      if (has('t_well') && f('well_ring')) out.push(star('Нашёл перстень королевы в колодце.', (a, p) => { a.finish('t_well'); a.give(p, 'minecraft:spyglass', 1, 'Подзорная труба Ленца'); a.renown(3, 'Вода помнит'); },
        { text: '«Сыну на свадьбу»… Береги его. Перстень королевы — не просто золото: по нему узнают, кто врёт, а кто нет. Возьми мою подзорную трубу. Мне звёзды и так видно.' }));
      break;
    case 'prokhor':
      if ((done('s7_undead') || f('stage7_done')) && !seen('t_prisoner')) out.push(star('Кто сидел в каменном мешке?', (a) => a.start('t_prisoner'),
        { text: 'В первой камере под соломой люк — каменный мешок. Я, как пришёл, нашёл там зарубки на стене. Много. Кто-то сидел долго. Говорят, в ту зиму туда кого-то бросили по слову казначея. Глянь сам — я туда лазить не люблю.' }));
      break;
    case 'agafya':
      if (has('t_agasha')) out.push(star('Агафья, я знаю, что стало с Фомой.', null, {
        text: 'С Фомой? С моим Фомой? Двадцать лет мне твердили: сбежал, с казначеевым золотом сбежал, вор он… Говори.',
        options: [{ text: 'Он не бежал. Его бросили в каменный мешок.', next: {
          text: '(Агафья долго молчит, потом садится на лавку.) Двести четырнадцать дней… А я наверху пекла хлеб. Двести четырнадцать дней, и никто не сказал. «Агаша, не верь им»… Не верила я, Фомушка. Только проклинала. Прости и ты меня.',
          options: [{ text: 'Варлаам отпоёт его.', run: (a) => { a.finish('t_agasha'); a.flag('foma_known', 1); a.renown(4, 'Узник'); }, next: { text: 'Отпоёт. И я приду. А тебе, голубчик, — каждый день пирог, пока я жива. Не спорь.' } }],
        } }],
      }));
      break;
    case 'mitka':
      if (f('stage2_done') && !seen('p_mitka')) out.push(star('Ты говорил, отец тут стоял…', (a) => a.start('p_mitka'),
        { text: 'Прокопом звали. Стоял в ту ночь у стены за донжоном. Утром поста нет, а через три дня нашли его в лесу, замёрзшего. Казначей сказал: за вором гнался. А мать до смерти говорила: отец ребёнка гнать не стал бы. Узнаешь правду, а?' }));
      if (has('p_mitka') && f('mk_note')) out.push(star('Твой отец не трус.', (a) => { a.finish('p_mitka'); a.renown(3, 'Отец'); }, {
        text: '(Митька читает записку, шевеля губами.) «Видел княжича… Не стал кричать… Уведу в другую сторону…» Он княжича спас. Он увёл их от болота. А я пять лет стыдился, что отец за ребёнком гонялся. Щит его оставь себе. Он бы хотел, чтоб щит служил.',
      }));
      break;
    case 'ostap':
      if (has('p_mitka') && f('mk_book') && !f('mk_ostap')) out.push(star('Что ты знаешь о Прокопе?', (a) => a.flag('mk_ostap', 1),
        { text: 'Прокоп… Мы с ним в каморке под парадной лестницей в кости играли — вход из кладовых подклета, за бочками. Перед тем караулом он мне сказал: «Если что — мои вещи там». Я туда так и не заглянул. Боялся, что там правда.' }));
      break;
    case 'frol':
      if (done('s0_mare') && f('stage3_done') && !seen('p_frol')) out.push(star('Как Ласточка?', (a) => a.start('p_frol'),
        { text: 'Ласточка-то? Повеселела. Хутор сена шлёт, конюшня сухая. Жеребёнка бы ей — и род конский в замке не кончится. Принеси две золотые морковки: побалую её, глядишь, и будет у нас жеребёнок.' }));
      if (has('p_frol')) out.push(star('Вот две золотые морковки.', null, (a, p) => (a.take(p, [['minecraft:golden_carrot', 2]]) ? (spawnFoal(a), a.give(p, 'minecraft:iron_horse_armor'), a.finish('p_frol'), a.renown(2, 'Жеребёнок'), {
        text: 'Гляди-ка! Ветерок, говорю, Ветерком назовём. Ноги длинные — бегать будет. А тебе — конская броня, старая, да крепкая. Ласточке теперь не до походов.',
      }) : { text: 'Две золотые морковки нужно. Морковь да золотые самородки — сам знаешь.' })));
      break;
    case 'vaska':
      if (f('stage4_done') && api.repaired('tiltyard') && !seen('p_vaska')) out.push(star('Чего такой хмурый, Васька?', (a) => a.start('p_vaska'),
        { text: 'Гордей говорит — кузнецом буду. А я в оруженосцы хочу! У рыцаря оруженосец бывает, а ты теперь рыцарь. Только Демьян говорит: сперва турнир. А турнира двадцать лет не было…' }));
      break;
    case 'demyan':
      if (has('p_vaska') && !f('duel_ok')) out.push(star('Устроим турнир для Васьки?', (a) => a.flag('duel_ok', 1),
        { text: 'Турнир? А что, ристалище готово, людям развлечение. Брат пришлёт трёх поединщиков из острога. Выходи днём на ристалище: три схватки до первой крови. Выстоишь — Васька будет твоим оруженосцем.' }));
      if (f('stage1_done') && !f('camp_empty') && !has('x_road') && world.getDay() >= (S.f.road_next || 0)) out.push(star('Есть дело на дорогах?', (a) => { delete a.S.places.road_raid; a.setPlace('road_raid', 120, 220); a.restart('x_road'); },
        { text: 'Брат пишет: на дороге к острогу опять шалят люди Рыжего. Купцов обирают. Сходи, прогони — сотник за каждый набег платит. Держи компас: место я тебе отметил.' }));
      break;
    case 'timosha':
      if (api.where('timosha') === 'home' && !seen('p_timosha')) out.push(star('Ты знаешь песню о пропавшем княжиче?', (a) => a.start('p_timosha'),
        { text: 'Знаю один куплет: «Ушёл во тьму, вернётся в зарю». А было их пять, говорят. Сложили в ту зиму люди замка — кто что видел. Кто в замке помнит ту зиму, у того и куплет. Соберёшь — спою целиком.' }));
      if (has('p_timosha') && VERSES.every((v) => f('verse_' + v.who))) out.push(star('Спой всю песню.', (a) => { a.finish('p_timosha'); a.flag('song', 1); a.renown(3, 'Песнь о княжиче'); }, { text: SONG }));
      break;
    case 'dunya':
      if (f('stage3_done') && api.where('dunya') === 'home' && !seen('p_sister')) out.push(star('О чём грустишь, Дуня?', (a) => startTrip(a, 'p_sister'),
        { text: 'Сестра моя, Уля, пять лет как пропала. Батюшка сказал — сбежала с бродягой, и имя её в доме не поминать. А лесник, говорят, видел у сухой ели-великана девицу с письмами… Сходишь? Я сама боюсь в бор.' }));
      tripBack('p_sister', 'Я нашёл письма Ули.', { text: 'Венчались? Уехали? Значит, жива и счастлива… (Дуня смеётся и плачет разом.) Батюшке не скажу пока. А тебе — спасибо. Я теперь всё в замке находить буду, что потеряешь. Только скажи.' },
        (a) => { a.flag('finder', 1); a.renown(3, 'Сестра'); });
      break;
    case 'grach':
      if (done('s5_grach') && !seen('x_buran')) out.push(star('Как живёшь, Ефим?', (a, p) => { startTrip(a, 'x_buran'); a.give(p, 'minecraft:bone', 1, 'Косточка для Бурана'); },
        { text: 'Живу. Сёмка в замке, Даша в лесу. Одно на сердце: пса моего, Бурана, давно не навещал. Он меня из полыньи вытащил. Лежит под холмиком в бору. Снеси ему косточку, а? Мне с ногой не дойти.' }));
      tripBack('x_buran', 'Навестил Бурана, оставил косточку.', { text: 'Спасибо… Вот, возьми щенка — Буранова внука, считай. Звать Буранчик. Он тебя выберет, вот увидишь.' },
        (a, p) => { a.takeNamed(p, 'minecraft:bone', 'Косточка для Бурана'); spawnPup(a, p); a.renown(2, 'Буран'); });
      break;
    case 'lykov':
      if (done('s1_ostrog') && !seen('x_letter')) out.push(star('Чего невесел, служивый?', (a) => startTrip(a, 'x_letter'),
        { text: 'Брат мой, Пётр, здесь служил. Лежит у дороги, под крестом. Письмо матери не успел отправить — его с ним и закопали. Мать ждёт весточки третий год. Достань письмо, Христа ради.' }));
      tripBack('x_letter', 'Вот письмо Петра.', { text: '«Привезу тебе платок»… Отвезу матери сам, на побывке. И платок куплю. Держи — это всё, что у меня есть: служивое жалованье за месяц.' },
        (a, p) => { a.takeNamed(p, 'minecraft:paper', 'Письмо Петра Лыкова'); a.give(p, 'minecraft:iron_ingot', 4); a.give(p, 'minecraft:arrow', 16); a.renown(2, 'Письмо матери'); });
      break;
    case 'yaroslav':
      if (done('s1_ostrog') && !f('camp_empty') && !seen('x_stash')) out.push(star('Есть работа для смелых?', (a) => startTrip(a, 'x_stash'),
        { text: 'Есть. Шайка разграбила стан охотников, следы ведут от кострища к их схрону. Найдёшь схрон — получишь награду из казны острога. За разбойников я плачу честно.' }));
      tripBack('x_stash', 'Схрон найден, вот их клеймо.', { text: 'Клеймо «Р»! Этим метят краденый лес — а лес принимает лесопилка Ножова. Ну, теперь не отвертится. Держи награду.' },
        (a, p) => { a.takeNamed(p, 'minecraft:iron_nugget', 'Клеймо «Р»'); a.give(p, 'minecraft:emerald', 6); a.give(p, 'minecraft:iron_sword'); a.renown(3, 'Схрон Рыжего'); });
      break;
    case 'nikodim':
      if (f('stage4_done') && !seen('x_horn')) out.push(star('Расскажи о Хозяине бора.', (a) => startTrip(a, 'x_horn'),
        { text: 'Хозяин бора добр, пока его не обидят. Был лесник Тихон — снял с капища белый рог, хотел продать в Затонье. С тех пор Хозяин ходил за ним, ночами стоял у избы. Тихон пропал, изба брошена. Найди рог и верни на капище — лес это запомнит.' }));
      break;
    case 'marfa':
      if (f('stage6_done') && !seen('x_somov')) out.push(star('Ты знала Сомовых?', (a) => startTrip(a, 'x_somov'),
        { text: 'Знала. Анна мне травы носила. Тридцать лет назад их дом сгорел, Анна сына вынесла, а сама — нет. Ножов тогда уже при управе служил и грозил им: землю их хотел. Сходи на пепелище — Матвей что-то спрятал, я знаю.' }));
      tripBack('x_somov', 'Вот что спрятал Матвей.', { text: 'Пуговица с орлом… С мундира приказчика управы. Ножов тогда в таком ходил. Береги её: перед судом пригодится. Анна, может, теперь спокойна.' },
        (a) => a.renown(3, 'Великий пал'));
      break;
    case 'kuzma':
      if (f('stage2_done') && !seen('x_grisha')) out.push(star('Как артель?', (a) => startTrip(a, 'x_grisha'),
        { text: 'Артель-то цела, а Гриша-молодой третий день на засидке. Ждёт белого лося, дурень. Не вернулся. Глянь, а? Засидка на огромной ели, оттуда далеко видно.' }));
      tripBack('x_grisha', 'У засидки лёжка лося и Гришина сума.', { text: 'А Гриша-то вернулся! Ночью пришёл, глаза как плошки: «Видел Хозяина, шёл с ним до ручья». Шерсть эту береги: Хозяин своих метит. Держи долю артели.' },
        (a, p) => { a.give(p, 'minecraft:leather', 6); a.give(p, 'minecraft:arrow', 16); a.renown(2, 'Дозор на Хозяина'); });
      break;
  }
  return out;
}

// Крест и свеча на могиле отца Ионы (кресты кладбища — из еловых заборов)
function placeCross(a) {
  const g = a.castle.slots.grave;
  for (const [dx, dy, dz] of [[0, 1, -1], [0, 2, -1], [0, 2, -2], [0, 2, 0]]) { const p = a.W([g[0] + dx, g[1] + dy, g[2] + dz]); a.cmd(`setblock ${p.x} ${p.y} ${p.z} spruce_fence keep`); }
  const c = a.W([g[0], g[1] + 1, g[2]]);
  a.cmd(`setblock ${c.x} ${c.y} ${c.z} candle ["lit"=true] keep`);
}
function spawnFoal(a) {
  const h = a.W(a.castle.homes.frol);
  try { const e = a.dim().spawnEntity('minecraft:horse', { x: h.x + 0.5, y: h.y, z: h.z + 0.5 }, { spawnEvent: 'minecraft:entity_born' }); e.nameTag = 'Ветерок'; } catch (err) { /* конюшня не загружена */ }
}
function spawnPup(a, p) {
  try {
    const e = a.dim().spawnEntity('minecraft:wolf', p.location, { spawnEvent: 'minecraft:entity_born' });
    e.nameTag = 'Буранчик';
    const t = e.getComponent('minecraft:tameable'); if (t) t.tame(p);
  } catch (err) { /* не вышло */ }
}

// ---------- События ----------
export function sideEvent(name, api, ev) {
  const S = api.S;
  switch (name) {
    case 'morning':
      // служивый Лыков живёт в остроге вместе с сотником (в 0.8.x его забыли поставить)
      if (api.where('yaroslav') === 'place:stockade_hunt' && !S.npcs.lykov) api.live('lykov', 'place:stockade_hunt');
      break;
    case 'block': {
      const b = ev.block, p = ev.player;
      for (const q of Object.keys(TRIPS)) if (api.has(q) && !api.flag(q + '_found')) tripFound(api, q, b, p);
      if (api.has('t_ear')) {
        if (api.isSlot(b, 'ear_book') && !api.flag('ear_journal')) { api.flag('ear_journal', 1); p.sendMessage('§7Журнал уха. Последняя запись — детскими буквами, углём: «Я тут прячусь. Казначей сыпал в мамину чашу. Я видел. Мне страшно. Я уйду в лаз. Е.»'); }
        if (api.isSlot(b, 'ear') && !api.flag('ear_toy')) { api.flag('ear_toy', 1); api.give(p, 'minecraft:stick', 1, 'Деревянный конёк', ['Игрушка княжича Ефрема', 'Нашлась в ухе хозяина']); p.sendMessage('§7В бочке — детский деревянный конёк, огарок и уголёк. Мальчик прятался здесь в ночь пира — и всё видел сквозь решётку.'); }
        if (api.flag('ear_journal') && api.flag('ear_toy')) { api.finish('t_ear'); api.renown(3, 'Голос в стене'); }
      }
      if (api.has('t_well')) {
        if (api.isSlot(b, 'astronomer') && !api.flag('well_scheme')) { api.flag('well_scheme', 1); p.sendMessage('§7Схема колодца: на полпути к цистерне, в стенке шахты — ниша с сундуком. На полях рукой королевы: «Сыну на свадьбу».'); }
        if (api.isSlot(b, 'well') && !api.flag('well_ring')) { api.flag('well_ring', 1); api.flag('well_scheme', 1); api.give(p, 'minecraft:gold_nugget', 1, 'Перстень королевы', ['Перстень королевы Елены', '«Сыну на свадьбу»']); p.sendMessage('§7В нише — шкатулка королевы Елены: её перстень и записка сыну. Вода сохранила.'); }
      }
      if (api.has('p_mitka')) {
        if (api.isSlot(b, 'captain') && !api.flag('mk_book')) { api.flag('mk_book', 1); p.sendMessage('§7Книга караулов, ночь зимнего пира: «У стены за донжоном — Прокоп. Утром пост пуст». Через три дня его нашли замёрзшим, а следы вели прочь от болота.'); }
        if (api.isSlot(b, 'under_stairs') && !api.flag('mk_note')) {
          api.flag('mk_note', 1); api.flag('mk_book', 1); api.flag('mk_ostap', 1);
          api.give(p, 'minecraft:shield', 1, 'Щит Прокопа', ['Щит стражника Прокопа', 'Отца Митьки']);
          p.sendMessage('§7В каморке — щит Прокопа и записка жене: «Видел княжича у лаза под стеной. Не стал кричать. Пусть бежит. Уведу погоню в другую сторону. Митьке скажи: отец не трус».');
        }
      }
      // Письмо дьяка к казначею — улика для суда (этап 10), её можно найти когда угодно
      if (api.isSlot(b, 'study_niche') && !api.flag('kk_letter')) {
        api.flag('kk_letter', 1); api.give(p, 'minecraft:paper', 1, 'Письмо К. К.', ['К. К. — казначею Ножову', '«Найди того, кто сойдёт за него»']);
        p.sendMessage('§7За знаменем в кабинете — письмо к казначею за подписью «К. К.»: «Старик живуч. Отвар посылай исправно… Когда придёт срок, найди того, кто сойдёт за мальчишку». Сохраните: это улика.');
      }
      break;
    }
    case 'hurt': {
      const e = ev.hurtEntity;
      if (!e || !e.hasTag || !e.hasTag('acastle_duel_on')) break;
      const h = e.getComponent('minecraft:health');
      if (h && h.currentValue < h.effectiveMax * 0.5) duelYield(api, e);
      break;
    }
    case 'die': {
      let tags = [];
      try { tags = ev.deadEntity.getTags(); } catch (e) { tags = []; }
      if (tags.includes('acastle_duel_on') && S.f.duel) { S.f.duel.n++; api.save(); api.tell('§7Поединщика унесли с ристалища. Схватка засчитана.'); }
      break;
    }
  }
}

// ---------- Реплики мимоходом ----------
export function sideBark(id, api) {
  const f = api.flag;
  if (id === 'mitka' && api.done('p_mitka')) return pick(['Отец мой княжича спас. Слыхал?', 'Щит отцовский носи с честью.']);
  if (id === 'agafya' && f('foma_known')) return pick(['Фомушка не бежал… Двадцать лет…', 'Пирог-то взял сегодня?']);
  if (id === 'vaska' && f('squire_vaska')) return pick(['Я теперь оруженосец!', 'Щит держу ровно, честное слово!']);
  if (id === 'dunya' && f('finder')) return pick(['Потерял что? Скажи — найду.', 'Уля жива, Уля счастлива!']);
  if (id === 'timosha' && f('song')) return '♪ Спи, сыночек, ночь темна… ♪';
  return null;
}
