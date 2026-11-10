// Окна: разговор с жителем (по кнопке «Говорить», касанием или из книги) и книга заданий.
// У игрока одновременно открыто не больше одного окна: повторное нажатие, пока окно открыто
// или только что закрылось, ничего не делает (на телефоне одно касание даёт два события).
import { ActionFormData } from '@minecraft/server-ui';
import { show, guarded } from './ui.js';
import { guardNode } from './garrison.js';
import { S, save } from './state.js';
import { NPCS, QUESTS, dialog } from './story.js';
import { residentsNear } from './people.js';
import { api } from './api.js';
import { charterCheck, charterBuild } from './castle_build.js';

export { show, guarded };
// Разговор: узел сюжета (story.js dialog) и дальше по кнопкам. Стражникам гарнизона к разговору
// добавляется «Как служба?» (пост, смена, снаряжение и заготовка своей истории — garrison.js).
async function talkInner(pl, id) { return runNode(pl, id, guardNode(id, dialog(id, api, pl))); }
// Узел сюжета для окна работника (кузнец, подмастерье): его кнопки встают в окно работника
export const storyNode = (pl, id) => (NPCS[id] ? dialog(id, api, pl) : null);
// Нажата кнопка узла: выполнить и продолжить разговор
export async function runOption(pl, id, o) {
  if (o.run) o.run(api, pl);
  return runNode(pl, id, o.next ? (typeof o.next === 'function' ? o.next(api, pl) : o.next) : null);
}
async function runNode(pl, id, node) {
  for (let step = 0; node && step < 20; step++) {
    const opts = node.options && node.options.length ? node.options : [{ text: 'Прощай' }];
    const form = new ActionFormData().title(node.title || NPCS[id].name).body(node.text);
    for (const o of opts) form.button(o.text);
    const r = await show(pl, form);
    if (r.canceled || r.selection === undefined) return;
    const o = opts[r.selection];
    if (o.run) o.run(api, pl);
    node = o.next ? (typeof o.next === 'function' ? o.next(api, pl) : o.next) : null;
  }
}

async function questBookInner(pl) {
  const active = Object.keys(S.q).filter((q) => S.q[q] === 'active' && QUESTS[q]);
  const doneN = Object.values(S.q).filter((v) => v === 'done').length;
  const hint = (q) => (typeof QUESTS[q].hint === 'function' ? QUESTS[q].hint(api) : QUESTS[q].hint);
  const lines = active.map((q) => `§l${QUESTS[q].title}§r${q === S.guide ? ' §a(путь показан)§r' : ''}\n${hint(q)}`);
  const form = new ActionFormData().title('Книга заданий')
    .body(`Звание: §6${S.rank}§r · выполнено заданий: ${doneN}\n\n${lines.length ? lines.join('\n\n') : 'Заданий нет. Поговорите с жителями замка.'}\n\nКнопка задания включает огоньки-путеводители к цели (в замке) или указатель с расстоянием (в лесу — держите в руке компас или эту книгу).`);
  const opts = active.filter((q) => QUESTS[q].target);
  for (const q of opts) form.button((q === S.guide ? '§a» ' : '') + QUESTS[q].title);
  form.button(S.guide ? 'Погасить огоньки' : 'Закрыть');
  const r = await show(pl, form);
  if (r.canceled || r.selection === undefined) return;
  S.guide = r.selection < opts.length ? opts[r.selection] : null; save();
}

// Книга рядом с жителями: сначала предлагает поговорить с ними
async function bookInner(pl) {
  const near = residentsNear(pl);
  if (!near.length) return questBookInner(pl);
  const form = new ActionFormData().title('Книга заданий').body('Рядом с вами:');
  for (const id of near) form.button('Говорить: ' + NPCS[id].name);
  form.button('Открыть книгу заданий');
  const r = await show(pl, form);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection < near.length) return talkInner(pl, near[r.selection]);
  return questBookInner(pl);
}

export const talk = guarded(talkInner);
export const openBook = guarded(bookInner);

// Королевская грамота: поставить замок там, где стоит игрок
async function charterInner(pl) {
  const err = charterCheck(pl);
  if (err) { pl.sendMessage('§7[Замок] ' + err); return; }
  const form = new ActionFormData().title('Королевская грамота')
    .body('«Сим повелеваю: быть на этом месте Студёному детинцу».\n\nЗамок встанет здесь: вы окажетесь на площади у ворот, донжон — к северу от вас. Нужно ровное открытое место вдали от вашего дома: замок с холмом занимает 190 на 190 блоков, под ним подземелье. В плоском мире ставить нельзя.\n\nСтройка идёт около минуты. Стойте на месте.')
    .button('Поставить замок здесь').button('Не сейчас');
  const r = await show(pl, form);
  if (r.canceled || r.selection !== 0) return;
  const again = charterCheck(pl);
  if (again) { pl.sendMessage('§7[Замок] ' + again); return; }
  api.take(pl, [['acastle:charter', 1]]);
  charterBuild(pl);
}
export const openCharter = guarded(charterInner);
