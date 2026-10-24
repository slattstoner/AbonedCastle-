// Этап 10 «Самозванец» (с 0.9.0) — после смерти короля (docs/story-expansion.md).
// Мотив — Угличское дело и Лжедмитрий: Лесная управа выставляет «чудом спасшегося княжича
// Ефрема», чтобы забрать замок и рудник Г-7. За самозванцем стоит дьяк Кирилл Кручина,
// покровитель Ножова. Игрок собирает улики и свидетелей; суд в Большом зале — разговор,
// где каждая улика кладётся на «весы правды». Улик больше, чем нужно: их дают и главный
// сюжет, и побочные задания, поэтому к победе ведут разные пути. Проиграть нельзя: если улик
// мало, суд откладывается на три дня.
import { world } from '@minecraft/server';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const bye = { text: 'Прощай' };
const star = (text, run, next) => ({ text: '§6» ' + text, run, next });
const NEED = 6;

export const ACT2_NPCS = {
  gonets: { name: 'Гонец управы', start: null, gate: [63, 0, 120] },
  kruchina: { name: 'Дьяк Кирилл Кручина', start: null },
  pretender: { name: 'Назвавшийся Ефремом', start: null },
  pristav: { name: 'Пристав управы', start: null },
};

// ---------- Улики и свидетели ----------
const PROOFS = [
  { k: 'charter', name: 'Грамота основателя', pts: 1, ok: (a) => !!a.flag('vault_read'),
    say: 'Вы читаете вслух грамоту Ратибора: «Рудник в квадрате Г-7 — земля замка навечно». Дьяк морщится: «Старая бумажка…» Но пристав записывает.' },
  { k: 'map', name: 'Карта квадрата Г-7', pts: 1, item: ['minecraft:paper', 'Карта квадрата Г-7'],
    say: 'Межа на карте Ленца ложится точно по грамоте: знаки-пирамидки стоят там, где их поставил основатель. Землемер управы сам это снял.' },
  { k: 'kk', name: 'Письмо К. К.', pts: 2, item: ['minecraft:paper', 'Письмо К. К.'],
    say: 'Пристав читает: «Мальчишка нам не нужен… найди того, кто сойдёт за него». Подпись: «К. К.» В зале тихо. Самозванец смотрит в пол. Дьяк Кручина: «Подделка!» — но голос его дрожит.' },
  { k: 'confession', name: 'Признание Ножова', pts: 2, item: ['minecraft:paper', 'Признание Ножова'],
    say: 'Признание Ножова: о чаше, об отваре из Затонья, о дьяке, что обещал ему рудник, и о Гришке, которого он три года учил «ходить по-княжески». Самозванец бледнеет.' },
  { k: 'ledger2', name: 'Счета Ножова', pts: 1, item: ['minecraft:paper', 'Счета Ножова'],
    say: 'Вторая книга приказчика: краденый лес шайки шёл через лесопилку в управу. Деньги — дьяку. Пристав присвистывает.' },
  { k: 'ring', name: 'Перстень королевы', pts: 1, item: ['minecraft:gold_nugget', 'Перстень королевы'],
    say: 'На пальце самозванца — «перстень королевы». Вы кладёте рядом настоящий, из колодца, с запиской «Сыну на свадьбу». Подделка рядом с ним — медяшка.' },
  { k: 'button', name: 'Пуговица с мундира', pts: 1, item: ['minecraft:iron_nugget', 'Пуговица с мундира'],
    say: 'Пуговица с орлом управы с пепелища Сомовых: управа жгла и грозила ещё тридцать лет назад. Дьяк отворачивается.' },
  { k: 'horse', name: 'Деревянный конёк', pts: 1, item: ['minecraft:stick', 'Деревянный конёк'],
    say: 'Вы спрашиваете самозванца, где он прятался в ночь пира. «В… в покоях», — говорит он. Вы показываете конька из уха хозяина. Настоящий княжич прятался в стене.' },
  { k: 'letter', name: 'Письмо королевы', pts: 1, item: ['minecraft:paper', 'Письмо королевы'],
    say: 'Письмо королевы Елены: «Твой оберег — башня рода. По нему тебя узнают». У самозванца на шее крест, а не башня.' },
  { k: 'amulet', name: 'Оберег-башня', pts: 1, item: ['minecraft:iron_nugget', 'Оберег-башня'],
    say: 'Серебряный оберег-башня из-под креста у Старой гати. «Где твой оберег, княжич?» — спрашиваете вы. Самозванец хватается за грудь: пусто.' },
];
const WITNESSES = [
  { k: 'w_ryzhy', name: 'Рыжий', pts: 2, ok: (a) => !!a.flag('ryzhy_witness'),
    say: 'Рыжий выходит вперёд и тихо насвистывает колыбельную королевы. «Подпой, княжич», — говорит он. Самозванец молчит: слов он не знает. Агафья в углу плачет.' },
  { k: 'w_agafya', name: 'Повариха Агафья', pts: 1, ok: (a) => a.where('agafya') === 'home',
    say: 'Агафья: «Я Ефремушку с пелёнок кормила. У него родинка за ухом и глаза зелёные. А у этого — карие». Самозванец прячет глаза.' },
  { k: 'w_ostap', name: 'Стражник Остап', pts: 1, ok: (a) => !!a.where('ostap'),
    say: 'Остап: «Двадцать лет в этих воротах. Княжича в ту ночь ни один стражник не видел у ворот — он ушёл лазом. А этот говорит: „через ворота бежал“». Пристав записывает.' },
];
const hasProof = (a, p, e) => (e.item ? a.hasNamed(p, e.item[0], e.item[1]) : e.ok(a));
const score = (shown) => shown.reduce((s, k) => s + ([...PROOFS, ...WITNESSES].find((e) => e.k === k) || { pts: 0 }).pts, 0);

function trialNode(a, p) {
  const shown = a.S.f.trial_shown || [];
  const opts = [];
  const add = (e, label) => opts.push({ text: label + e.name, run: (b) => { b.S.f.trial_shown = [...(b.S.f.trial_shown || []), e.k]; b.save(); },
    next: { text: e.say, options: [{ text: 'Дальше', next: (b, q) => trialNode(b, q) }] } });
  for (const e of PROOFS) if (!shown.includes(e.k) && hasProof(a, p, e)) add(e, 'Предъявить: ');
  for (const w of WITNESSES) if (!shown.includes(w.k) && w.ok(a)) add(w, 'Позвать свидетеля: ');
  opts.push({ text: 'Это всё. Пусть суд решает.', next: (b) => verdict(b) });
  return { title: 'Суд в Большом зале',
    text: `Дьяк Кручина: «Именем Лесной управы! Перед вами княжич Ефрем, сын государя Всеволода, чудом спасшийся. Замок и рудник Г-7 — ему по праву. Чем докажешь, что это не так?»\n\nВесы правды: ${score(shown)} из ${NEED}.`,
    options: opts };
}
function verdict(a) {
  if (score(a.S.f.trial_shown || []) < NEED) return {
    text: 'Дьяк Кручина усмехается: «Слова, слова. Суд откладывается на три дня. Найди доказательства получше — если сможешь». Комиссия уезжает.',
    options: [{ text: 'Я вернусь с доказательствами.', run: (b) => postpone(b) }],
  };
  return {
    text: 'Самозванец вдруг падает на колени: «Не княжич я! Гришка я, пономарёв сын из Затонья! Казначей меня три года учил ходить по-княжески, а дьяк обещал — сыт буду до смерти…» Дьяк Кручина пятится к дверям, но капитан Демьян загораживает выход.\n\nЧто делать с Гришкой?',
    options: [
      { text: 'Отпустить с миром.', run: (b) => resolve(b, 'free'), next: { text: 'Гришка кланяется в пол и уходит, не оглядываясь. Говорят, потом он пел в Затонье на ярмарках — песню о пропавшем княжиче.' } },
      { text: 'В послушники к Варлааму.', run: (b) => resolve(b, 'monk'), next: { text: 'Варлаам кладёт руку Гришке на плечо: «Пойдём, грешник. Свечи лить будешь». Гришка плачет — кажется, от облегчения.' } },
      { text: 'В конюшню к Фролу.', run: (b) => resolve(b, 'stable'), next: { text: 'Фрол хмыкает: «Ходить по-княжески умеешь, а навоз таскать — научу». Гришка впервые за весь суд улыбается.' } },
    ],
  };
}
function leave(a) { for (const id of ['kruchina', 'pristav']) a.live(id, null); }
function backToCamp(a) { if (a.flag('ryzhy_witness')) a.live('ryzhy', a.flag('forest_guard') ? 'place:outlaw_camp' : null); }
function postpone(a) {
  a.S.f.trial_day = world.getDay() + 3; a.S.f.trial_on = 0; a.save();
  leave(a); a.live('pretender', null); backToCamp(a);
}
function resolve(a, fate) {
  const S = a.S;
  leave(a); backToCamp(a);
  const homes = a.castle.homes;
  a.live('pretender', fate === 'monk' ? 'at:' + homes.varlaam.join(',') : fate === 'stable' ? 'at:' + homes.frol.join(',') : null);
  S.f.pretender_fate = fate; S.f.trial_on = 0;
  a.finish('s10_trial'); a.drop('s10_proofs'); a.drop('s10_nozhov'); a.drop('s10_heir');
  a.flag('stage10_done', 1); a.flag('mine_share', 1); S.f.mine_day = world.getDay() - 3; a.save();
  if (a.flag('nozhov_mercy')) { a.live('nozhov', null); a.tell('§7По вашей просьбе Ножова отправили в дальний монастырь: молиться за королеву до конца дней.'); }
  a.tell('§6Суд окончен. Указ управы отменён, дьяка Кручину увезли в острог к Ярославу. Рудник Г-7 — земля замка навечно: Игнат будет выдавать долю рудника каждые три дня.');
  for (const p of a.players()) p.onScreenDisplay.setTitle('§6Суд окончен', { subtitle: 'Рудник Г-7 — земля замка навечно', fadeInDuration: 20, stayDuration: 80, fadeOutDuration: 20 });
  a.rank('Хозяин Студёного бора'); a.renown(10, 'Суд');
}

// ---------- Задания ----------
export const ACT2_QUESTS = {
  s10_decree: { title: 'Гонец из Затонья', target: () => ({ at: [63, 0, 120], label: 'Ворота замка' }), hint: 'К воротам прискакал гонец Лесной управы. Поговорите с ним.' },
  s10_council: { title: 'Указ управы', target: () => ({ path: 'home_ignat', label: 'Дом управителя' }), hint: 'Покажите указ управы кастеляну Игнату.' },
  s10_proofs: { title: 'Весы правды', target: null,
    hint: (a) => {
      const p = a.players()[0];
      const mark = (ok) => (ok ? '§a+§r' : '§7–§r');
      const left = Math.max(0, (a.S.f.trial_day || 0) - world.getDay());
      return `Суд в Большом зале — ${left ? `через ${left} дн.` : 'сегодня, днём'}. Нужно ${NEED} очков на весах правды. Улики (держите при себе):\n` +
        PROOFS.map((e) => `${mark(p && hasProof(a, p, e))} ${e.name}${e.pts > 1 ? ' (весит вдвое)' : ''}`).join('\n') +
        '\nСвидетели: ' + WITNESSES.map((w) => `${mark(w.ok(a))} ${w.name}`).join(', ');
    } },
  s10_nozhov: { title: 'Допрос', target: () => ({ path: 'room_dungeon', label: 'Темница' }),
    hint: 'Ножов в темнице знает всё: и про самозванца, и про дьяка. Допросите его: улики развяжут ему язык, а можно пообещать просить суд о милости.' },
  s10_heir: { title: 'Настоящий княжич', target: () => ({ place: 'outlaw_camp', label: 'Лагерь у Чёрной гари' }),
    hint: 'Позовите на суд Рыжего — настоящего Ефрема. Он в лагере у Чёрной гари.' },
  s10_trial: { title: 'Суд в Большом зале', target: () => ({ path: 'throne', label: 'Большой зал' }),
    hint: (a) => (a.S.f.trial_on ? 'Комиссия управы в Большом зале. Поговорите с дьяком Кручиной и выложите улики.' : 'В назначенный день комиссия управы приедет в Большой зал. Днём поговорите с дьяком Кручиной.'),
    tick(a) {
      const S = a.S;
      if (S.f.trial_on || world.getDay() < (S.f.trial_day || 0) || world.getTimeOfDay() > 11000) return;
      S.f.trial_on = 1; a.save();
      a.live('kruchina', 'feast:1'); a.live('pretender', 'feast:2'); a.live('pristav', 'feast:3');
      if (a.flag('ryzhy_witness')) { a.setState('ryzhy', null); a.live('ryzhy', 'home'); }
      for (const p of a.players()) p.onScreenDisplay.setTitle('§6Суд', { subtitle: 'Комиссия управы в Большом зале', fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
      a.say('demyan', 'Комиссия управы прибыла: дьяк, приставы и этот… «княжич». Ждут в Большом зале.', 300);
    } },
};

// ---------- Разговоры ----------
// Свои жители этапа: разговор целиком
export function act2Dialog(id, api, pl) {
  const has = api.has;
  switch (id) {
    case 'gonets':
      if (has('s10_decree')) return {
        text: 'Указ Лесной управы! (Гонец разворачивает свиток.) «В Затонье объявился княжич Ефрем, сын покойного государя Всеволода, чудом спасшийся. Управа признаёт его наследником. Замок и рудник в квадрате Г-7 передать ему. Через три дня комиссия во главе с дьяком Кириллом Кручиной прибудет в замок для суда».',
        options: [{ text: 'Какой ещё княжич?', run: (a, p) => { a.give(p, 'minecraft:paper', 1, 'Указ управы', ['О передаче замка «княжичу Ефрему»']); a.finish('s10_decree'); a.start('s10_council'); a.live('gonets', null); },
          next: { text: 'Мне велено передать — я передал. Свиток ваш. Прощайте.' } }],
      };
      return { text: 'Указ передан. Мне пора.', options: [bye] };
    case 'kruchina':
      if (has('s10_trial') && api.S.f.trial_on) return trialNode(api, pl);
      return { text: pick(['Управа своё слово сказала.', 'Не мешайте суду.']), options: [bye] };
    case 'pretender': {
      const fate = api.S.f.pretender_fate;
      if (fate === 'monk') return { text: pick(['Отец Варлаам велит свечи лить. Я лью. Ровные выходят!', 'Спасибо, что не в острог.']), options: [bye] };
      if (fate === 'stable') return { text: pick(['Фрол говорит, у меня рука лёгкая — кони не боятся.', 'Ветерок меня уже не кусает!']), options: [bye] };
      return { text: pick(['Я — княжич Ефрем! Я… помню замок. Большой. С башнями.', 'Матушку мою звали… Елена! Да, Елена.', 'Не подходи! Пристав!']), options: [bye] };
    }
    case 'pristav':
      return { text: pick(['Порядок в суде!', 'Дьяк велел никого не пускать. А вы и так здесь.', 'Служба у нас такая — бумажная.']), options: [bye] };
  }
  return null;
}
// Кнопки для жителей замка и Рыжего
export function act2Options(id, api, pl) {
  const has = api.has, out = [];
  switch (id) {
    case 'ignat':
      if (has('s10_council')) out.push(star('Гонец привёз указ управы.', (a) => {
        a.finish('s10_council'); a.S.f.trial_day = world.getDay() + 3; a.S.f.trial_shown = []; a.save();
        for (const q of ['s10_proofs', 's10_nozhov', 's10_heir', 's10_trial']) a.start(q);
      }, { text: 'Кручина… Тот самый дьяк, что на зимнем пиру сидел по правую руку от казначея. Настоящий Ефрем — в бору, у Чёрной гари, и замка не хочет. Значит, управа нашла своего «Ефрема». Это подлог, хозяин. Через три дня — суд в Большом зале. Нужны улики, свидетели — и Ножов: он знает всё. В книге заданий я записал, что у нас есть.' }));
      break;
    case 'nozhov':
      if (has('s10_nozhov') && !api.hasNamed(pl, 'minecraft:paper', 'Признание Ножова')) out.push(star('Допрос', null, (a, p) => nozhovNode(a, p)));
      break;
    case 'ryzhy':
      if (has('s10_heir')) out.push(star('В Затонье объявился «княжич Ефрем».', null, {
        text: 'Слыхал. Какой-то Гришка моим именем назвался. Мне-то что? Замок мне не нужен — я говорил.',
        options: [
          { text: 'Он позорит имя твоей матери.', run: (a) => { a.flag('ryzhy_witness', 1); a.finish('s10_heir'); }, next: { text: '…Мать. (Рыжий долго молчит.) Ладно. Приду на суд. Посмотрю этому Гришке в глаза — и насвищу мамину песню. Пусть подпоёт, если он княжич.' } },
          { text: 'Как знаешь.', next: { text: 'Вот и знаю.' } },
        ],
      }));
      break;
    case 'demyan': case 'yaroslav':
      if (api.flag('stage10_done') && !api.flag(id + '_trial_said')) out.push(star('Как там дьяк Кручина?', (a) => a.flag(id + '_trial_said', 1),
        { text: id === 'yaroslav' ? 'Сидит у меня в остроге, пишет жалобы в управу. Управа молчит: им теперь не до него. Рудник за замком, а с дорог мне Рыжий докладывает. Чудны дела.' : 'Брат его в остроге держит. Жалобы пишет — на нас, на тебя, на погоду. Пусть пишет.' }));
      break;
  }
  return out;
}
function nozhovNode(a, p) {
  const strong = PROOFS.filter((e) => e.item && ['kk', 'ledger2', 'button', 'ring', 'horse', 'letter'].includes(e.k) && hasProof(a, p, e));
  const confess = (mercy) => (b, q) => {
    b.give(q, 'minecraft:paper', 1, 'Признание Ножова', ['Записано в темнице замка', mercy ? 'Под обещание просить о милости' : 'Под тяжестью улик']);
    if (mercy) b.flag('nozhov_mercy', 1);
    b.finish('s10_nozhov');
  };
  const opts = [{ text: 'Пригрозить острогом.', next: { text: 'Острог? Я в острог приказы писал. Не пугай. Хочешь правды — неси что-нибудь, кроме угроз.', options: [{ text: 'Дальше', next: (b, q) => nozhovNode(b, q) }] } }];
  if (strong.length >= 2) opts.push({ text: `Выложить улики: ${strong.map((e) => e.name).join(', ')}.`, run: confess(false), next: {
    text: '(Ножов смотрит на ваши улики и бледнеет.) …Откуда? Ладно. Ладно! Пиши. Гришка это, пономарёв сын из Затонья. Я его три года учил. Кручина обещал мне рудник, если старик помрёт без наследника. И отвар… отвар его аптека варила. Пиши всё.' } });
  opts.push({ text: 'Скажи правду — попрошу суд о милости.', run: confess(true), next: {
    text: '…Милость? Двадцать лет мне никто милости не обещал. (Ножов долго молчит.) Хорошо. Гришка это, пономарёв сын. Чашу я дал кравчему, отвар королю слал я, а варила аптека дьяка Кручины. Он обещал мне рудник. Только в монастырь, не в острог. Прошу.' } });
  opts.push(bye);
  return { text: 'Чего пришёл? Король мёртв, а ты — никто. Скоро тебя самого отсюда выведут.', options: opts };
}

// ---------- События ----------
export function act2Event(name, api) {
  const S = api.S;
  if (name !== 'morning' || !api.flag('king_dead') || S.q.s10_decree) return;
  if (typeof S.f.king_dead_day !== 'number') { S.f.king_dead_day = world.getDay(); api.save(); return; }
  if (world.getDay() <= S.f.king_dead_day + 1) return;
  api.live('gonets', 'gate'); api.start('s10_decree');
  api.tell('§6К воротам прискакал гонец Лесной управы со свитком.');
}
export function act2Bark(id, api) {
  if (id === 'kruchina') return 'Именем управы!';
  if (id === 'pretender' && !api.S.f.pretender_fate) return pick(['Я княжич!', 'Где мой замок?']);
  if (id === 'gonets') return 'Указ управы! Где хозяин?';
  return null;
}
// Переход к этапу 10 (команда acastle:jump 10): король умер, шайка — лесная стража, гонец у ворот
export function act2Jump(api) {
  const S = api.S;
  Object.assign(S.f, { king_dead: 1, king_dead_day: world.getDay() - 2, forest_guard: 1, stage9_done: 1, heir_seen: 1 });
  S.npcs.vsevolod = null;
  for (const id of ['ryzhy', 'sych', 'voron', 'grinya', 'pakhom', 'shilo', 'kunitsa']) { S.npcs[id] = 'place:outlaw_camp'; S.st[id] = null; }
  if (!S.places.outlaw_camp) api.setPlace('outlaw_camp', 400, 600);
  api.save();
  for (const id of ['vsevolod', 'ryzhy']) api.live(id, S.npcs[id]);
  api.live('gonets', 'gate'); api.start('s10_decree');
}
// Переход к раннему этапу: этап 10 ещё не начался
export function act2Reset(api) {
  const S = api.S;
  for (const q of Object.keys(S.q)) if (q.startsWith('s10_')) delete S.q[q];
  for (const k of ['trial_day', 'trial_on', 'trial_shown', 'stage10_done', 'mine_share', 'ryzhy_witness', 'nozhov_mercy', 'pretender_fate', 'king_dead_day']) delete S.f[k];
  for (const id of Object.keys(ACT2_NPCS)) delete S.npcs[id];
  api.save();
}
