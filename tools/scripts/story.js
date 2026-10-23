// Сюжет замка: жители, задания, подряды и разговоры. Здесь этапы 0 и 1 (docs/castle-story.md,
// docs/quests.md), этапы 2–9 — в stages.js; этот файл собирает всё вместе.
// Движок — main.js; здесь только что говорят жители и что считается сделанным.
// В разговорах не называем стороны света: по приметам («у ворот», «на башне с колоколом»).
import { world } from '@minecraft/server';
import { LATE_NPCS, LATE_CONTRACTS, LATE_QUESTS, STARTS, lateDialog, lateEvent, lateBark, jumpLate } from './stages.js';

// ---------- Жители ----------
// start — где живёт с самого начала: 'post' (пост стражника), 'home' (комната в замке), null — ещё не пришёл.
export const NPCS = {
  ostap: { name: 'Стражник Остап', guard: true, start: 'post' },
  mitka: { name: 'Стражник Митька', guard: true, start: 'post' },
  zhdan: { name: 'Стражник Ждан', guard: true, start: null },
  gavrila: { name: 'Стражник Гаврила', guard: true, start: null },
  luka: { name: 'Стражник Лука', guard: true, start: null },
  vsevolod: { name: 'Король Всеволод', start: 'home' },
  agafya: { name: 'Повариха Агафья', start: 'home' },
  frol: { name: 'Конюх Фрол', start: 'home' },
  demyan: { name: 'Капитан Демьян Беляк', start: null, gate: [63, 0, 118] },
  yaroslav: { name: 'Сотник Ярослав Беляк', start: null },
  ...LATE_NPCS,
};

// ---------- Подряды: что положить в сундук ----------
export const CONTRACTS = {
  shell: { title: 'Корпус донжона', who: 'vsevolod', items: [['minecraft:stone_bricks', 64, 'Каменный кирпич'], ['minecraft:glass', 32, 'Стекло'], ['minecraft:spruce_planks', 32, 'Еловые доски']],
    done: 'Всё собрано. Остап с Фролом ночью залезут на крышу, а к утру окна будут целы.' },
  breach_1: { title: 'Брешь в стене', who: 'demyan', items: [['minecraft:cobblestone', 48, 'Булыжник'], ['minecraft:stone_bricks', 16, 'Каменный кирпич']] },
  breach_2: { title: 'Брешь в стене', who: 'demyan', items: [['minecraft:cobblestone', 48, 'Булыжник'], ['minecraft:stone_bricks', 16, 'Каменный кирпич']] },
  breach_3: { title: 'Брешь в стене', who: 'demyan', items: [['minecraft:cobblestone', 48, 'Булыжник'], ['minecraft:stone_bricks', 16, 'Каменный кирпич']] },
  walls: { title: 'Зубцы и башни', who: 'demyan', items: [['minecraft:stone_bricks', 64, 'Каменный кирпич'], ['minecraft:spruce_planks', 24, 'Еловые доски']] },
  barracks: { title: 'Казарма', who: 'demyan', items: [['minecraft:spruce_planks', 32, 'Еловые доски'], ['minecraft:spruce_stairs', 16, 'Еловые ступени']],
    done: 'Доски на месте. Ребята ночью перекроют крышу казармы.' },
  ...LATE_CONTRACTS,
};

// ---------- Волны у ворот ----------
const WAVES = [
  [['minecraft:zombie', 4]],
  [['minecraft:zombie', 3], ['minecraft:skeleton', 2]],
  [['minecraft:zombie', 5], ['minecraft:skeleton', 2], ['minecraft:spider', 1]],
];
const night = () => { const t = world.getTimeOfDay(); return t >= 13000 && t <= 22500; };
function waveTick(api) {
  const S = api.S, gate = api.W(api.castle.gate);
  const near = api.players().some((p) => api.flat(p.location, gate) < 48);
  const far = !api.players().some((p) => api.flat(p.location, gate) < 90);
  const w = S.f.wave;
  const mobs = () => api.dim().getEntities({ tags: ['acastle_wave'] });
  if (world.getDifficulty() === 'Peaceful') return; // на «Мирной» засчитывается утром (onEvent morning)
  if (!w) {
    if (night() && near) { S.f.wave = { n: 0, wait: 99 }; api.save(); api.say('mitka', '§cИдут! Из леса идут! К воротам!', 80); }
    return;
  }
  if (far || !night()) {
    for (const m of mobs()) m.remove();
    S.f.wave = null; api.save();
    api.say('ostap', 'Ушли… Не беда. Приходи следующей ночью — постоим ещё.', 200);
    return;
  }
  const left = mobs().length;
  for (const p of api.players()) if (api.flat(p.location, gate) < 90) p.onScreenDisplay.setActionBar(`Ночь у ворот: волна ${Math.max(1, w.n)} из 3, нежити осталось ${left}`);
  if (left > 0) return;
  if (w.n >= WAVES.length) { S.f.wave = null; api.finish('s0_night'); return; }
  if (++w.wait < 4) { api.save(); return; }
  w.n++; w.wait = 0; api.save();
  for (const [type, count] of WAVES[w.n - 1]) for (let i = 0; i < count; i++) {
    const c = api.W([55 + Math.floor(Math.random() * 17), 0, 146 + Math.floor(Math.random() * 6)]);
    let top; try { top = api.dim().getTopmostBlock({ x: c.x, z: c.z }); } catch (e) { top = undefined; }
    if (!top) continue;
    try { const m = api.dim().spawnEntity(type, { x: c.x + 0.5, y: top.location.y + 1, z: c.z + 0.5 }); m.addTag('acastle_wave'); } catch (e) { /* не вышло */ }
  }
  if (w.n > 1) api.say('ostap', w.n === 3 ? 'Последние! Держись!' : 'Ещё идут! Не зевай!', 80);
}

// ---------- Задания ----------
const C = (api) => api.castle;
export const QUESTS = {
  // ===== Этап 0 =====
  s0_halt: { title: 'Стой, кто идёт?', hint: 'Подойдите к воротам замка и поговорите со стражником Остапом (кнопка «Говорить»).',
    target: () => ({ at: [61, 0, 126], label: 'Ворота замка' }),
    tick(api) {
      if (api.flag('shout')) return;
      const gate = api.W(C(api).gate);
      if (api.players().some((p) => api.flat(p.location, gate) < 18)) { api.flag('shout', 1); api.say('ostap', '§lСтой! Кто таков?§r Двадцать лет сюда никто не ходил, кроме нежити. Подойди, поговорим.', 40); }
    } },
  s0_night: { title: 'Ночь у ворот', target: () => ({ at: [63, 0, 126], label: 'Ворота замка' }),
    hint: (api) => (api.S.f.wave ? 'Бейте нежить вместе со стражей у ворот!' : night() ? 'Стойте у ворот: нежить вот-вот пойдёт из леса.' : 'Дождитесь сумерек у ворот замка. Три волны нежити — продержитесь вместе со стражей. Спать этой ночью нельзя.'),
    tick: waveTick },
  s0_king: { title: 'Слово короля', hint: 'Король Всеволод ждёт в опочивальне на жилом этаже донжона. Огоньки покажут дорогу.',
    target: () => ({ path: 'home_vsevolod', label: 'Опочивальня короля' }) },
  s0_kitchen: { title: 'Пустой котёл', hint: 'Повариха Агафья на кухне в подклете донжона просит: 16 пшеницы, 4 сырого мяса (любого) и ведро молока.',
    target: () => ({ path: 'home_agafya', label: 'Кухня' }) },
  s0_mare: { title: 'Старая кобыла', hint: 'Конюх Фрол в конюшне во дворе просит 8 тюков сена (необязательное задание).',
    target: () => ({ path: 'home_frol', label: 'Конюшня' }) },
  s0_roof: { title: 'Крыша над головой', target: () => ({ path: 'chest_shell', label: 'Сундук у входа в донжон' }),
    hint: (api) => (api.S.rep.shell && api.S.rep.shell.st !== 'open' ? 'Всё собрано. Ложитесь спать — к утру корпус донжона починят.' : 'Положите в сундук-подряд у входа в донжон: 64 каменного кирпича, 32 стекла, 32 еловые доски. Табличка рядом показывает, сколько уже собрано.') },
  s0_signal: { title: 'Сигнальный огонь', hint: 'Зажгите огнивом сигнальный костёр на верху башни донжона, где висит колокол. Огоньки покажут дорогу.',
    target: () => ({ path: 'signal', label: 'Сигнальный костёр' }),
    tick(api) {
      const b = api.blockAt(api.W(C(api).signal));
      if (b && b.typeId === 'minecraft:campfire' && b.permutation.getState('extinguished') === false) {
        api.finish('s0_signal');
        for (const p of api.players()) p.onScreenDisplay.setTitle('§6Огонь горит', { subtitle: 'Его видно до самого острога', fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
      }
    } },
  s0_wait: { title: 'Подмога из острога', hint: 'Острог увидел огонь. Дождитесь утра (можно лечь спать) — к воротам придут люди.', target: () => ({ at: [63, 0, 120], label: 'Ворота замка' }) },
  // ===== Этап 1 =====
  s1_captain: { title: 'Капитан', hint: 'У ворот ждёт капитан Демьян Беляк. Поговорите с ним.', target: () => ({ at: [63, 0, 118], label: 'Ворота замка' }) },
  s1_breaches: { title: 'Дыры в стене', target: (api) => { const u = ['breach_1', 'breach_2', 'breach_3'].find((b) => !api.S.rep[b] || api.S.rep[b].st === 'open') || 'breach_1'; return { path: 'chest_' + u, label: 'Брешь в стене' }; },
    hint: (api) => {
      const left = ['breach_1', 'breach_2', 'breach_3'].filter((u) => !api.repaired(u)).length;
      return `Через три бреши в крепостной стене нежить ходит во двор. У каждой бреши — сундук-подряд: 48 булыжника и 16 каменного кирпича. Брешь заделают в ночь после того, как сундук заполнен. Осталось брешей: ${left}.`;
    } },
  s1_walls: { title: 'Зубцы и башни', hint: 'Сундук-подряд у ворот: 64 каменного кирпича и 24 еловые доски — для зубцов стен и угловых башен.',
    target: () => ({ path: 'chest_walls', label: 'Сундук у ворот' }) },
  s1_barracks: { title: 'Где спать людям', hint: 'Сундук-подряд у казармы во дворе: 32 еловые доски и 16 еловых ступеней — перекрыть крышу.',
    target: () => ({ path: 'chest_barracks', label: 'Казарма' }) },
  s1_ostrog: { title: 'Весть в острог', target: () => ({ place: 'stockade_hunt', label: 'Острог' }),
    hint: (api) => (api.flag('copy') ? 'Отнесите копию приказа капитану Демьяну.' : 'Отнесите донесение сотнику Ярославу Беляку в острог. Держите в руке компас или эту книгу — внизу экрана видно, куда идти.') },
  s1_seal: { title: 'Чужая печать', hint: 'Сравните печать на приказе с печатью на старой грамоте: она в сундуке у лебёдки решётки, в надвратной башне справа, если стоять во дворе лицом к воротам.',
    target: () => ({ at: [62, 0, 125], label: 'Надвратная башня' }) },
  ...LATE_QUESTS,
};

// ---------- Разговоры ----------
// Узел: { text, options: [{ text, run(api, pl), next }] }. Без вариантов — кнопка «Прощай».
const bye = { text: 'Прощай' };
function lostBook(api) {
  return { text: 'Я потерял книгу заданий.', run: (a, pl) => { a.give(pl, 'acastle:quest_book'); a.flag('book', 1); }, next: { text: 'Держи новую. Береги — в ней всё, что тебе поручено.' } };
}

export function dialog(id, api, pl) {
  const late = lateDialog(id, api, pl);
  if (late) return late;
  const has = api.has, done = api.done;
  const S = api.S;
  switch (id) {
    case 'ostap': {
      if (!done('s0_halt')) return {
        text: 'Стой! Двадцать лет никто к нам не ходил, кроме нежити да волков. Кто таков?',
        options: [
          { text: 'Путник. Ищу ночлег.', next: { text: 'Ночлег… Замок пустует, да не брошен. Король жив, и мы, его стража, тоже. Только чужих мы не пускаем: шайка Рыжего по лесу шастает.', options: [{ text: 'Как мне доказать, что я не из шайки?', next: haltEnd } ] } },
          { text: 'Слышал, замок пустует.', next: { text: 'Пустует, да не брошен! Король жив, и мы с Митькой двадцать лет держим эти ворота. Каждую ночь нежить лезет из развалин, а нас двое.', options: [{ text: 'Могу помочь.', next: haltEnd }] } },
        ],
      };
      if (has('s0_night')) return { text: S.f.wave ? 'Бей их! Не пускай к воротам!' : night() ? 'Чуешь? Тихо стало. Сейчас пойдут. Стой рядом.' : 'Жди сумерек. Как стемнеет — из леса полезут. Не вздумай спать этой ночью.', options: [lostBook(api), bye] };
      if (has('s0_king')) return { text: 'Ступай к королю. Опочивальня на жилом этаже донжона: войдёшь по лестнице в пристройке, дальше по большой винтовой наверх. Огоньки укажут.', options: [lostBook(api), bye] };
      if (has('s1_captain')) return { text: 'Видал? Острог прислал людей! Капитан Демьян у ворот — ступай к нему.', options: [bye] };
      return { text: ['Двадцать лет стою в этих воротах. Ещё при королеве Елене стоял.', 'Ночью гляди в оба: нежить любит тёмные углы.', 'Митька парень хороший, только болтает много.'][Math.floor(Math.random() * 3)], options: [lostBook(api), bye] };
    }
    case 'mitka': {
      if (!done('s0_halt')) return { text: 'Ты с Остапом говори, он у нас старший. Я что… я только недавно стою. Пятый год всего.', options: [bye] };
      if (has('s0_night')) return { text: 'Я, честно, побаиваюсь. Но с тобой веселее! Ночью стой между нами, у самой арки.', options: [bye] };
      return { text: ['Отец мой тоже тут стоял. Его в ту зиму не стало, когда королева умерла.', 'Говорят, у Рыжего в шайке сто человек. Врут, поди.', 'Агафья вкусно готовит, если есть из чего.'][Math.floor(Math.random() * 3)], options: [lostBook(api), bye] };
    }
    case 'vsevolod': {
      if (has('s0_king')) return {
        text: 'Подойди ближе… Глаза уже не те. Остап говорит, ты простоял с ними ночь у ворот. Значит, не из шайки.',
        options: [{ text: 'Я готов служить.', next: {
          text: 'Двадцать лет назад, на зимнем пиру, умерла моя королева. В ту же ночь пропал наш сын, Ефрем. Я распустил двор, закрыл ворота… и замок умер вместе со мной. Но я ещё дышу. Помоги поднять замок, пока я жив.',
          options: [{ text: 'С чего начать?', run: (a) => { a.finish('s0_king'); a.start('s0_roof'); a.start('s0_kitchen'); a.start('s0_mare'); a.openContract('shell'); }, next: {
            text: 'Сначала — крыша над головой. Окна выбиты, в кровле дыры: в таком донжоне не перезимовать. У входа в донжон я велел поставить сундук. Принеси камня, стекла и досок — Остап с Фролом ночью залатают. И загляни к Агафье на кухню: голодный много не наработает.',
          } }],
        } }],
      };
      if (has('s0_roof')) return { text: 'Камень, стекло, доски — в сундук у входа в донжон. Как соберёшь, ложись спать: к утру будет сделано.', options: [bye] };
      if (done('s0_roof') && !S.q.s0_signal) return {
        text: 'Слышишь? Ветер больше не воет в окнах. Хорошо… Теперь нам нужны люди. На башне с колоколом стоит сигнальный костёр. Зажги его — в остроге увидят и пришлют подмогу.',
        options: [{ text: 'Зажгу.', run: (a) => a.start('s0_signal') }],
      };
      if (has('s0_signal')) return { text: 'Сигнальный костёр — на самом верху башни донжона, где колокол. Возьми огниво.', options: [{ text: 'У меня нет огнива.', run: (a, p) => a.give(p, 'minecraft:flint_and_steel'), next: { text: 'Возьми моё. Только верни… хотя что уж там. Оставь себе.' } }, bye] };
      if (has('s0_wait')) return { text: 'Огонь горит. Ярослав Беляк в остроге — человек честный, он придёт. Отдохни до утра.', options: [bye] };
      if (S.f.tidy_vsevolod) return { text: 'Спасибо тебе. Впервые за двадцать лет в замке слышны голоса.', options: [bye] };
      return { text: ['Королева любила эту комнату. Здесь пахло яблоками…', 'Сын мой… Ефрем… Ему было семь. Он боялся темноты.', 'Казначей мой, Ножов, ушёл в ту же ночь. Я тогда не придал значения…'][Math.floor(Math.random() * 3)], options: [bye] };
    }
    case 'agafya': {
      if (has('s0_kitchen')) return {
        text: 'Батюшки, живой человек! Котёл холодный, полки пустые. Принеси мне 16 пшеницы, 4 куска сырого мяса — какого найдёшь — и ведро молока. Испеку хлеба, сварю похлёбку.',
        options: [{ text: 'Вот, принёс.', next: (a, p) => (a.hasAll(p, [['minecraft:wheat', 16], ['minecraft:milk_bucket', 1]]) && meatCount(a, p) >= 4 && a.take(p, [['minecraft:wheat', 16], ['minecraft:milk_bucket', 1]]) && takeMeat(a, p) ? (a.give(p, 'minecraft:bread', 6), a.give(p, 'minecraft:pumpkin_pie', 2), a.give(p, 'minecraft:bucket'), a.finish('s0_kitchen'), a.flag('fed', world.getDay()), {
          text: 'Вот это дело! Держи хлеба да пирогов. Заходи каждый день — накормлю. А знаешь… королева в ту ночь из чаши испила да слегла. Горячка, сказали. Только я ту чашу сама мыла — пахла она горько.',
        }) : { text: 'Не всё ещё. Нужно 16 пшеницы, 4 сырого мяса и ведро молока. Мясо — любое: говядина, баранина, свинина, курица.' }) }, bye],
      };
      const fed = S.f.fed === world.getDay();
      return { text: fed ? 'Сегодня уже кормила. Приходи завтра, голубчик.' : 'Проголодался? Садись.', options: fed ? [bye] : [{ text: 'Покорми, Агафья.', run: (a, p) => { a.give(p, 'minecraft:bread', 3); a.flag('fed', world.getDay()); }, next: { text: 'Кушай на здоровье.' } }, bye] };
    }
    case 'frol': {
      if (has('s0_mare')) return {
        text: 'Одна кобыла у нас осталась, Ласточка. Старая, да умная. Сена нет — чем кормить? Принеси 8 тюков сена, и она твоя.',
        options: [{ text: 'Вот сено.', next: (a, p) => (a.take(p, [['minecraft:hay_block', 8]]) ? (spawnMare(a), a.give(p, 'minecraft:saddle'), a.finish('s0_mare'), {
          text: 'Вот и славно. Ласточка в стойле, седло держи. Подружишься с ней — повезёт хоть на край света. А знаешь, что я помню про ту ночь? Конь казначея пришёл к утру весь в мыле. Куда он гонял до рассвета?',
        }) : { text: 'Тюков маловато. Нужно 8.' }) }, bye],
      };
      return { text: ['Лошади — они всё чуют. Перед бедой ржут.', 'Казначейский конь был вороной, злой. Кусался.', 'Когда двор был полон, тут стояло двадцать коней.'][Math.floor(Math.random() * 3)], options: [bye] };
    }
    case 'demyan': {
      if (has('s1_captain')) return {
        text: 'Демьян Беляк, капитан. Брат мой, Ярослав, сотником в остроге. Увидели огонь на башне — я сразу людей собрал. Ждан, Гаврила, Лука — у ворот и на площади. Ну, показывай, что тут у вас.',
        options: [{ text: 'Замок в разрухе. Нужна защита.', run: (a) => {
          a.finish('s1_captain'); a.start('s1_breaches'); a.start('s1_barracks'); a.start('s1_ostrog');
          for (const u of ['breach_1', 'breach_2', 'breach_3', 'barracks']) a.openContract(u);
          a.setPlace('stockade_hunt', 300, 500); a.S.npcs.yaroslav = 'place:stockade_hunt'; a.save();
          a.arriveNextMorning('demyan', 'rooms_1');
        }, next: (a, p) => { a.give(p, 'minecraft:paper', 1, 'Донесение капитана', ['Сотнику Ярославу Беляку, в острог']); return {
          text: 'Вижу. Через три бреши в стене нежить ходит, как к себе домой — так нам ворота не удержать. У каждой бреши я поставил сундук: носи туда камень, ночью мои заделают. Казарма во дворе без крыши — людям спать негде. И вот ещё: отнеси это донесение брату в острог. Он должен знать, что мы здесь. Острог лесом далеко, держи компас.',
        }; } }],
      };
      if (has('s1_ostrog') && api.flag('copy')) return {
        text: 'Вернулся? Что брат передал?',
        options: [{ text: 'Копию приказа о сдаче острога.', run: (a, p) => { a.takeNamed(p, 'minecraft:paper', 'Копия приказа'); a.finish('s1_ostrog'); a.start('s1_seal'); }, next: {
          text: 'Приказ поддельный, это Ярослав и сам понял. Гляди на печать: башня в круге. Это казначейская печать нашего замка! Её двадцать лет никто не видел. В надвратной башне в сундуке лежит старая грамота с той же печатью. Сравни сам.',
        } }],
      };
      if (has('s1_seal')) return { text: 'Сундук с грамотами — в надвратной башне, у лебёдки решётки.', options: [bye] };
      if (S.f.seal && !S.f.s1_talked) return {
        text: 'Ну? Та же печать? Значит, кто-то из людей нашего старого казначея жив и пишет поддельные приказы. Ножов… Брат говорил, что Ножов теперь приказчиком на лесопилке. Совпадение? Не верю.',
        options: [{ text: 'Что дальше?', run: (a) => { a.flag('s1_talked', 1); stage1Check(a); }, next: { text: 'Держать стены. И точить мечи — а с этим без кузнеца никак.' } }],
      };
      if (S.f.tidy_demyan && !S.f.tidy_demyan_said) { api.flag('tidy_demyan_said', 1); return { text: 'Я тут порядок навёл: караульный этаж, своя комната, оружие по стойкам. Теперь это гарнизон, а не развалины.', options: [bye] }; }
      return { text: ['Стены — это хорошо. Но стены держат люди.', 'Рыжий шалит на дорогах. Брат за ним третий год гоняется.', 'Лучника бы на стены… Савва придёт, как казарму перекроем.'][Math.floor(Math.random() * 3)], options: [lostBook(api), bye] };
    }
    case 'yaroslav': {
      if (has('s1_ostrog') && !api.flag('copy')) return {
        text: 'Из замка? Живой замок… а я думал, там одни волки. Что у тебя?',
        options: [{ text: 'Донесение от вашего брата.', next: (a, p) => (a.takeNamed(p, 'minecraft:paper', 'Донесение капитана') ? (a.give(p, 'minecraft:paper', 1, 'Копия приказа', ['Приказ оставить острог', 'Печать: башня в круге']), a.flag('copy', 1), {
          text: 'Демьян… Значит, король жив. Передай брату вот это: копия приказа, по которому меня хотели выгнать из острога и сдать знамя приказчику Ножову. Печать на нём странная — башня в круге. Не управы печать. Пусть Демьян посмотрит. А сам заходи: на дорогах шалит Рыжий, работа для смелых найдётся.',
        }) : { text: 'Донесения нет при тебе. Потерял по дороге?' }) }, bye],
      };
      return { text: ['Острог стоит, пока стоим мы.', 'Рыжего я ловлю третий год. Хитёр, как лис. И будто знает, где мы пойдём.', 'Передай Демьяну: пусть стены держит, а дороги — моя забота.'][Math.floor(Math.random() * 3)], options: [bye] };
    }
    case 'zhdan': case 'gavrila': case 'luka':
      return { text: ['Служба как служба.', 'Капитан у нас строгий, но справедливый.', 'Ночью тут жутковато. В развалинах кто-то шуршит.', 'Казарму бы перекрыть — спать под дождём не дело.'][Math.floor(Math.random() * 4)], options: [lostBook(api), bye] };
  }
  return { text: '…', options: [bye] };
}
const haltEnd = { text: 'Постой с нами ночь у ворот. Нежить полезет — вместе отобьёмся. Тогда поверю и к королю отведу. Держи книгу: в ней будет всё, что тебе поручат.',
  options: [{ text: 'Договорились.', run: (a, p) => { a.give(p, 'acastle:quest_book'); a.finish('s0_halt'); a.start('s0_night'); } }] };

const MEAT = ['minecraft:beef', 'minecraft:mutton', 'minecraft:porkchop', 'minecraft:chicken', 'minecraft:rabbit'];
const meatCount = (a, p) => MEAT.reduce((s, id) => s + a.count(p, id), 0);
// Мясо любое: забираем 4 куска по порядку
function takeMeat(a, p) {
  let left = 4;
  for (const id of MEAT) { const t = Math.min(a.count(p, id), left); if (t) { a.take(p, [[id, t]]); left -= t; } }
  return true;
}
function spawnMare(a) {
  const at = a.W(a.castle.homes.frol);
  try { const h = a.dim().spawnEntity('minecraft:horse', { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }); h.nameTag = 'Ласточка'; } catch (e) { /* конюшня не загружена */ }
}
function stage1Check(a) {
  if (['s1_breaches', 's1_walls', 's1_barracks', 's1_ostrog', 's1_seal'].every((q) => a.done(q)) && a.flag('s1_talked') && !a.flag('stage1_done')) {
    a.flag('stage1_done', 1);
    a.rank('Оруженосец');
    a.tell('§6Этап 1 «Стража» пройден. Капитан Демьян хочет поговорить о кузне.');
  }
}

// ---------- События ----------
export function onEvent(name, api, ev) {
  const S = api.S;
  lateEvent(name, api, ev);
  switch (name) {
    case 'castle': api.start('s0_halt'); break;
    case 'done:s0_night':
      api.say('ostap', 'Отбились! Ну, теперь верю — не из шайки ты. Ступай к королю: опочивальня на жилом этаже донжона. Огоньки укажут дорогу.', 120);
      api.start('s0_king'); break;
    case 'repaired:shell':
      api.finish('s0_roof');
      api.tell('§6Наутро корпус донжона цел: окна застеклены, крыши залатаны. Король хочет вас видеть.');
      break;
    case 'done:s0_signal': api.start('s0_wait'); api.flag('help_day', world.getDay()); break;
    case 'morning':
      if (api.has('s0_night') && world.getDifficulty() === 'Peaceful') api.finish('s0_night');
      if (api.has('s0_wait') && world.getDay() > S.f.help_day) {
        // Пришёл отряд из острога: капитан у ворот, стражники по постам
        S.npcs.demyan = 'gate'; api.stageGuards(1); api.save();
        api.finish('s0_wait'); api.start('s1_captain');
        api.tell('§6На рассвете к воротам подошёл отряд из острога.');
      }
      break;
    case 'repaired:breach_1': case 'repaired:breach_2': case 'repaired:breach_3':
      api.tell('§6Брешь в стене заделана.');
      if (['breach_1', 'breach_2', 'breach_3'].every((u) => api.repaired(u))) {
        api.finish('s1_breaches');
        api.say('demyan', 'Все три бреши закрыты! Теперь зубцы и башни: сундук я поставил у ворот.', 200);
        api.start('s1_walls'); api.openContract('walls');
      }
      break;
    case 'repaired:walls': api.finish('s1_walls'); stage1Check(api); break;
    case 'repaired:barracks':
      api.finish('s1_barracks'); api.tell('§6Казарма перекрыта: стражникам есть где спать. На надвратную башню встал лучник Савва.');
      S.npcs.savva = 'post'; api.save(); stage1Check(api); break;
    case 'arrived:demyan': break;
    case 'block': {
      const g = api.castle.slots && api.castle.slots.gatehouse;
      if (g && api.has('s1_seal')) {
        const at = api.W(g), l = ev.block.location;
        if (l.x === at.x && l.y === at.y && l.z === at.z) {
          api.flag('seal', 1); api.finish('s1_seal');
          ev.player.sendMessage('§7На старой грамоте та же печать: башня в круге. Казначейская печать замка.');
        }
      }
      break;
    }
  }
}

// ---------- Реплики мимоходом ----------
// Когда игрок проходит рядом с жителем: одна строка над панелью предметов.
const BARKS = {
  ostap: ['Стой, кто идёт? А, это ты.', 'Ночью гляди в оба.'],
  mitka: ['Здорово!', 'Остап опять ворчит.'],
  zhdan: ['Тихо сегодня.'], gavrila: ['Служба.'], luka: ['Капитан велел площадь обходить.'],
  vsevolod: ['Подойди…', 'Замок оживает. Я слышу.'],
  agafya: ['Голодный? Заходи на кухню.'], frol: ['Ласточка тебя помнит.'],
  demyan: ['Как служба?', 'Стены держим.'], gordey: ['Молот поёт!'], vaska: ['Здрасьте!'],
  ignat: ['Всё по описи.'], dunya: ['Ой, извините, я тут мою.'], varlaam: ['Мир тебе.'],
  evsey: ['Тише: я считаю буквы.'], lenz: ['Звёзды сегодня ясные.'], semka: ['Голуби вернулись!'],
  marfa: ['Не трогай склянки.'], prokhor: ['Темноты не боюсь.'], timosha: ['♪ Ушёл во тьму, вернётся в зарю… ♪'],
  kuzma: ['Здорово, охотник.'], nastya: ['Заходи, гость.'], nikodim: ['…'], liza: ['Привет!'], grach: ['Тише, зверя спугнёшь.'],
  sych: ['Я за тобой смотрю.'], pakhom: ['Каши хочешь?'], grinya: ['Чего уставился?'], ryzhy: ['Ну?'],
};
export function bark(id, api, pl) {
  const late = lateBark(id, api, pl);
  if (late) return late;
  if (id === 'ostap' && night() && api.has('s0_night')) return 'Стой у ворот! Сейчас пойдут!';
  const list = BARKS[id];
  return list && Math.random() < 0.6 ? list[Math.floor(Math.random() * list.length)] : null;
}
// Переход к этапу (команда /scriptevent acastle:jump <этап>), для проверки в игре
export function jump(n, api) {
  if (n < 1 || n > 9) { api.tell('§7Номер этапа — от 1 до 9.'); return; }
  jumpLate(n, api, { QUESTS });
  if (n === 1) { api.S.npcs.demyan = 'gate'; api.stageGuards(1); api.start('s1_captain'); api.save(); }
}
export { STARTS };
