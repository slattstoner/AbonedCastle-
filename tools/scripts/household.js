// Хозяйство замка (с 0.9.0): то, ради чего в замок стоит возвращаться и после сюжета
// (docs/story-expansion.md, как «доска заказов» и уровень поселения в Dragon Quest Builders):
//  • слава замка — растёт за этапы, тайны, личные истории и поручения; уровни открывают новое;
//  • поручения на день — каждое утро Игнат вывешивает два дела от жителей, награда изумрудами;
//  • услуги жителей — благословение, зелья, песня, найдёныш, заточка клинка, пирог;
//  • торговля после финала — Пахом, приметы кладов у Куницы (места тайги, которых не было);
//  • ярмарка на площади, колокол на рассвете и закате, доля рудника и подати.
import { world, system } from '@minecraft/server';

const star = (text, run, next) => ({ text: '§6» ' + text, run, next });
const bye = { text: 'Прощай' };
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const today = () => world.getDay();
const container = (b) => /chest|barrel|decorated_pot/.test(b.typeId);

// ---------- Слава замка ----------
export const LEVELS = [[0, 'Запустение'], [10, 'Обжитый'], [25, 'Крепкий'], [45, 'Славный'], [70, 'Великий']];
export const levelOf = (n) => LEVELS.filter(([k]) => (n || 0) >= k).pop()[1];
export const PERKS = {
  'Обжитый': 'Кастелян Игнат каждое утро вывешивает поручения жителей.',
  'Крепкий': 'Каждый третий день на площадь приезжает купец из Затонья.',
  'Славный': 'Кузнец Гордей точит клинки и топоры.',
  'Великий': 'Хутора несут подати: каждый день Игнат выдаёт изумруды.',
};
const renownAt = (api, lvl) => (api.S.f.renown || 0) >= LEVELS.find(([, t]) => t === lvl)[0];

// ---------- Поручения на день ----------
export const ORDERS = [
  { who: 'agafya', text: '6 сырой трески для ухи', items: [['minecraft:cod', 6]], pay: 3 },
  { who: 'agafya', text: '12 яиц на пироги', items: [['minecraft:egg', 12]], pay: 2 },
  { who: 'frol', text: '16 пшеницы на корм коням', items: [['minecraft:wheat', 16]], pay: 2 },
  { who: 'gordey', text: '8 сырого железа', items: [['minecraft:raw_iron', 8]], pay: 4 },
  { who: 'gordey', text: '16 угля для горна', items: [['minecraft:coal', 16]], pay: 3 },
  { who: 'varlaam', text: '4 свечи для часовни', items: [['minecraft:candle', 4]], pay: 2 },
  { who: 'marfa', text: '4 мака и 4 одуванчика на отвары', items: [['minecraft:poppy', 4], ['minecraft:dandelion', 4]], pay: 3 },
  { who: 'marfa', text: '6 бурых грибов', items: [['minecraft:brown_mushroom', 6]], pay: 2 },
  { who: 'evsey', text: '8 бумаги для переписки', items: [['minecraft:paper', 8]], pay: 2 },
  { who: 'evsey', text: '3 чернильных мешка', items: [['minecraft:ink_sac', 3]], pay: 2 },
  { who: 'lenz', text: '4 стекла для линз', items: [['minecraft:glass', 4]], pay: 2 },
  { who: 'semka', text: '16 семян пшеницы для голубей', items: [['minecraft:wheat_seeds', 16]], pay: 1 },
  { who: 'timosha', text: '4 нити на струны', items: [['minecraft:string', 4]], pay: 2 },
  { who: 'ignat', text: '16 еловых брёвен на дрова', items: [['minecraft:spruce_log', 16]], pay: 3 },
  { who: 'dunya', text: '6 белой шерсти на бельё', items: [['minecraft:white_wool', 6]], pay: 3 },
  { who: 'savva', text: '32 стрелы', items: [['minecraft:arrow', 32]], pay: 3 },
  { who: 'prokhor', text: '8 факелов для темницы', items: [['minecraft:torch', 8]], pay: 2 },
  { who: 'demyan', text: 'перебить у замка 6 нежити ночью', kill: 6, pay: 4 },
];
const DEAD = /zombie|skeleton|spider|husk|stray|drowned|creeper|witch|phantom/;
function genOrders(api) {
  const S = api.S;
  const pool = ORDERS.map((o, i) => [o, i]).filter(([o]) => ['home', 'post'].includes(api.where(o.who)));
  const out = [], who = new Set();
  while (pool.length && out.length < 2) {
    const [o, i] = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (who.has(o.who)) continue;
    who.add(o.who); out.push({ i, n: 0, done: 0 });
  }
  S.f.orders = out; S.f.orders_day = today(); api.save();
  if (out.length) api.tell('§6Игнат вывесил поручения на день: ' + out.map((o) => `${api.npcName(ORDERS[o.i].who)} — ${ORDERS[o.i].text}`).join('; ') + '. Подробности — в книге заданий.');
}
const ordersOn = (api) => api.flag('stage3_done') && renownAt(api, 'Обжитый');

// ---------- Приметы Куницы: места тайги, где ещё никто не был ----------
const CLUES = {
  hut_abandoned_winter: { label: 'Зимовье в бору', tip: 'Изба, где старик просидел зиму под снегом. Говорит, запасы закопал, а сам ушёл.' },
  mark_cairn_child: { label: 'Детская горка', tip: 'Пирамидка из камней, да не землемерская: дети с хутора сложили. Под ней их «клад».' },
  farmstead_silence: { label: 'Опустевший хутор', tip: 'Хутор, где стол накрыт, а людей нет. Хозяин пошёл на огни в лесу и не вернулся.' },
  mark_signpost_crossroad: { label: 'Развилка трёх троп', tip: 'Столб с табличками. Одну сорвали — ту, что к Хозяину бора. Под камнем путник что-то оставил.' },
  camp_hunters_furs: { label: 'Стан, где пропали шкуры', tip: 'Охотники друг на друга грешат, а шкуры закопал один из них.' },
  camp_abandoned_wolves: { label: 'Стан после волчьей ночи', tip: 'Стан бросили после волков. Раненый Ваня свою долю зарыл, чтоб не тащить.' },
  farmstead_last: { label: 'Заросший хутор', tip: 'Хутор, заросший ельником. Дед Иван там один доживал, клад внукам оставил.' },
  sawmill_drowned: { label: 'Старая лесопилка', tip: 'Хозяин той лесопилки утонул у колеса. Вдова не верит, что сам. На дне запруды — его накопления.' },
};
export const HOUSE_QUESTS = {
  x_clue: { title: 'Примета Куницы', target: (api) => (api.S.f.clue ? { place: api.S.f.clue, label: CLUES[api.S.f.clue].label } : null),
    hint: (api) => (api.S.f.clue ? `Куница: «${CLUES[api.S.f.clue].tip}» Идите по компасу и откройте тайник на месте.` : 'Спросите Куницу о приметах.') },
};

// ---------- Разговоры: услуги, торговля, поручения ----------
const once = (api, k) => api.S.f['svc_' + k] === today();
const used = (api, k) => { api.S.f['svc_' + k] = today(); api.save(); };
const DUNYA_FINDS = [['minecraft:iron_nugget', 6], ['minecraft:string', 4], ['minecraft:arrow', 12], ['minecraft:emerald', 1], ['minecraft:gold_nugget', 5], ['minecraft:bread', 3], ['minecraft:candle', 2], ['minecraft:lead', 1]];
const POTIONS = [['minecraft:healing', 'Зелье исцеления', 2], ['minecraft:water_breathing', 'Зелье водного дыхания', 2], ['minecraft:nightvision', 'Зелье ночного зрения', 2], ['minecraft:fire_resistance', 'Зелье огнестойкости', 3]];
const pay = (a, p, n) => a.count(p, 'minecraft:emerald') >= n && a.take(p, [['minecraft:emerald', n]]);

function marfaShop() {
  return { text: 'Отвары у меня честные: что написано, то и будет. Платят изумрудами.', options: [
    ...POTIONS.map(([eff, name, price]) => ({ text: `${name} — ${price} изумр.`, next: (a, p) => (pay(a, p, price) ? (a.potion(p, eff, name), { text: 'Держи. Пей не всё сразу.' }) : { text: `Нужно ${price} изумруда.` }) })),
    bye] };
}
function pakhomShop() {
  return { text: 'Торговать? Это можно. Каша, стрелы, а кожу у тебя возьму — ребятам на сапоги.', options: [
    { text: 'Кулеш — 1 изумруд', next: (a, p) => (pay(a, p, 1) ? (a.give(p, 'minecraft:rabbit_stew'), { text: 'Горячий ещё. Ешь.' }) : { text: 'Изумруд нужен.' }) },
    { text: '16 стрел — 1 изумруд', next: (a, p) => (pay(a, p, 1) ? (a.give(p, 'minecraft:arrow', 16), { text: 'Ворон сам точил.' }) : { text: 'Изумруд нужен.' }) },
    { text: 'Продать 6 кожи — 2 изумруда', next: (a, p) => (a.take(p, [['minecraft:leather', 6]]) ? (a.give(p, 'minecraft:emerald', 2), { text: 'Добрая кожа.' }) : { text: 'Шесть кож нужно.' }) },
    bye] };
}
export function houseOptions(id, api, pl) {
  const S = api.S, f = api.flag, out = [];
  // поручение от этого жителя
  if (S.f.orders_day === today()) for (const o of S.f.orders || []) {
    const ord = ORDERS[o.i];
    if (!ord || ord.who !== id || o.done) continue;
    out.push(star(`Поручение: ${ord.text}`, null, (a, p) => {
      if (ord.kill ? o.n < ord.kill : !a.hasAll(p, ord.items)) return { text: ord.kill ? `Пока перебито ${o.n} из ${ord.kill}. Ночью у стен их хватает.` : `Не всё: ${ord.text}.` };
      if (ord.items) a.take(p, ord.items);
      o.done = 1; a.save(); a.give(p, 'minecraft:emerald', ord.pay); a.renown(1, 'поручение');
      return { text: pick(['Вот спасибо! Держи за труды.', 'Выручил. Держи.', 'Другое дело! Награда твоя.']) + ` (+${ord.pay} изумр.)` };
    }));
  }
  switch (id) {
    case 'varlaam':
      if (f('bless') && !once(api, 'bless')) out.push(star('Благослови, отче.', (a, p) => { used(a, 'bless'); a.effect(p, 'regeneration', 60, 0); a.effect(p, 'absorption', 300, 1); }, { text: 'Господь с тобой. Ступай с миром — и с силой.' }));
      break;
    case 'marfa':
      if (f('stage6_done')) out.push(star('Купить зелья', null, marfaShop()));
      break;
    case 'timosha':
      if (f('song') && !once(api, 'song')) out.push(star('Сыграй, Тимоша!', (a, p) => { used(a, 'song'); a.effect(p, 'speed', 300, 0); a.effect(p, 'strength', 300, 0); }, { text: '♪ Ушёл во тьму, вернётся в зарю… ♪ (От гуслей ноги сами идут, а руки крепче держат меч.)' }));
      break;
    case 'dunya':
      if (f('finder') && !once(api, 'finder')) out.push(star('Поищи, что я потерял.', null, (a, p) => { used(a, 'finder'); const [it, n] = pick(DUNYA_FINDS); a.give(p, it, n); return { text: 'Вот, под лавкой в кухне лежало. Твоё ведь?' }; }));
      break;
    case 'agafya':
      if (f('foma_known') && !once(api, 'pie')) out.push(star('Пирог от Агафьи', (a, p) => { used(a, 'pie'); a.give(p, 'minecraft:pumpkin_pie', 2); }, { text: 'Обещала — каждый день пирог. Ешь, голубчик.' }));
      break;
    case 'gordey':
      if (api.done('s2_forge') && renownAt(api, 'Славный')) out.push(star('Наточить клинок (3 изумруда и 1 железо)', null, (a, p) => {
        if (a.count(p, 'minecraft:emerald') < 3 || a.count(p, 'minecraft:iron_ingot') < 1) return { text: 'Три изумруда и слиток железа — за меньшее точило не кручу.' };
        const lvl = a.sharpen(p, 3);
        if (lvl <= 0) return { text: lvl < 0 ? 'Острее этого клинка уже не сделать.' : 'Возьми в руку меч или топор — его и наточу.' };
        a.take(p, [['minecraft:emerald', 3], ['minecraft:iron_ingot', 1]]);
        return { text: `Готово: острота ${['', 'I', 'II', 'III'][lvl]}. Клеймо башни не стёр.` };
      }));
      break;
    case 'ignat': {
      if (f('mine_share') && today() - (S.f.mine_day || 0) >= 3) out.push(star('Доля рудника', (a, p) => { a.S.f.mine_day = today(); a.save(); a.give(p, 'minecraft:gold_ingot', 3); a.give(p, 'minecraft:emerald', 2); }, { text: 'Артель с рудника прислала долю хозяина. Всё по описи.' }));
      if (renownAt(api, 'Великий') && !once(api, 'tax')) out.push(star('Подати с хуторов', (a, p) => { used(a, 'tax'); a.give(p, 'minecraft:emerald', 2); }, { text: 'Хутора несут подати, хозяин. Замок славный — и люди к нему тянутся.' }));
      break;
    }
    case 'pakhom':
      if (f('forest_guard')) out.push(star('Торговать', null, pakhomShop()));
      break;
    case 'kunitsa':
      if (f('forest_guard')) {
        const left = Object.keys(CLUES).filter((k) => !(S.f.clues || []).includes(k));
        if (api.has('x_clue')) out.push(star('Насчёт приметы…', null, { text: 'Сперва ту примету проверь. Потом приходи.' }));
        else if (left.length) out.push(star('Есть приметы кладов? (4 изумруда)', null, (a, p) => {
          if (!pay(a, p, 4)) return { text: 'Приметы денег стоят. Четыре изумруда.' };
          const k = left[0];
          a.S.f.clue = k; a.setPlace(k, 200, 420); a.restart('x_clue');
          return { text: `Слушай: ${CLUES[k].tip} Я тебе направление дам — держи компас.` };
        }));
      }
      break;
  }
  return out;
}

// ---------- События ----------
export function houseEvent(name, api, ev) {
  const S = api.S;
  switch (name) {
    case 'morning': {
      for (const e of api.dim().getEntities({ tags: ['acastle_merchant'] })) e.remove();
      if (ordersOn(api)) genOrders(api);
      if (renownAt(api, 'Крепкий') && api.repaired('square') && today() % 3 === 0) { S.f.market = today(); api.save(); api.tell('§6Сегодня ярмарка: на площадь у колодца приехал купец из Затонья.'); }
      break;
    }
    case 'block': {
      const b = ev.block;
      if (api.has('x_clue') && S.f.clue && container(b)) {
        const h = api.placeAt(S.f.clue);
        if (h && api.flat(b.location, h) < 22) {
          S.f.clues = [...(S.f.clues || []), S.f.clue]; S.f.clue = null; api.save();
          api.finish('x_clue'); api.renown(1, 'примета Куницы');
          ev.player.sendMessage('§7Примета Куницы не обманула. Всё, что здесь найдёте, — ваше.');
        }
      }
      break;
    }
    case 'die': {
      const ords = (S.f.orders_day === today() && S.f.orders || []).filter((o) => !o.done && ORDERS[o.i] && ORDERS[o.i].kill);
      if (!ords.length) break;
      const dead = ev.deadEntity, src = ev.damageSource && ev.damageSource.damagingEntity;
      let type = '', loc = null;
      try { type = dead.typeId; loc = dead.location; } catch (e) { /* уже нет */ }
      if (!DEAD.test(type.replace('minecraft:', '')) || !src || !/player|acastle:guard/.test(src.typeId)) break;
      if (!loc) try { loc = src.location; } catch (e) { break; }
      if (api.flat(loc, api.W(api.castle.gate)) > 110) break;
      for (const o of ords) o.n = Math.min(ORDERS[o.i].kill, o.n + 1);
      api.save();
      break;
    }
  }
}

// Раз в секунду: купец на ярмарке и колокол на рассвете и закате (когда колокол снова с языком)
export function houseTick(api) {
  const S = api.S;
  if (S.f.market === today() && S.f.market_spawned !== today() && world.getTimeOfDay() < 11000) {
    const c = api.castle.homes.trader;
    const p = c && api.W(c);
    if (p && api.loaded(p)) {
      try {
        const e = api.dim().spawnEntity('minecraft:wandering_trader', { x: p.x + 0.5, y: p.y, z: p.z + 0.5 });
        e.nameTag = 'Купец из Затонья'; e.addTag('acastle_merchant');
        S.f.market_spawned = today(); api.save();
      } catch (err) { /* позже */ }
    }
  }
  if (!api.repaired('heritage')) return;
  const t = world.getTimeOfDay(), now = api.absTime();
  if (!((t < 400) || (t >= 12000 && t < 12400)) || now - (S.f.bell_t || 0) < 3000) return;
  S.f.bell_t = now; api.save();
  const sq = api.W(api.castle.square);
  for (const pl of api.players()) {
    if (api.flat(pl.location, sq) > 220) continue;
    for (let i = 0; i < 3; i++) system.runTimeout(() => { try { pl.playSound('block.bell.hit', { volume: 1.5 }); } catch (e) { /* игрок вышел */ } }, i * 25);
  }
}

// Строки для книги заданий: слава и поручения на сегодня
export function houseBook(api) {
  const S = api.S, n = S.f.renown || 0, lvl = levelOf(n);
  const next = LEVELS.find(([k]) => k > n);
  const lines = [`Слава замка: §6${n}§r — «${lvl}»${next ? ` (до «${next[1]}» — ${next[0] - n})` : ''}`];
  if (S.f.orders_day === today() && (S.f.orders || []).length) {
    lines.push('§lПоручения на сегодня§r');
    for (const o of S.f.orders) {
      const ord = ORDERS[o.i];
      if (ord) lines.push(`${o.done ? '§a(готово)§r' : '•'} ${api.npcName(ord.who)}: ${ord.text}${ord.kill && !o.done ? ` (${o.n}/${ord.kill})` : ''}`);
    }
  }
  return lines.join('\n');
}
