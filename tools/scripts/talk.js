// Окна: разговор с жителем (по кнопке «Говорить», касанием или из книги) и книга заданий.
// У игрока одновременно открыто не больше одного окна: повторное нажатие, пока окно открыто
// или только что закрылось, ничего не делает (на телефоне одно касание даёт два события).
import { system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { S, save } from './state.js';
import { NPCS, QUESTS, dialog, bookExtra } from './story.js';
import { residentsNear } from './people.js';
import { api } from './api.js';

const wait = (t) => new Promise((r) => system.runTimeout(r, t));
// Окно не показывается, пока у игрока открыт другой экран (игра отвечает «занят»):
// повторяем несколько раз с паузой — так окно откроется сразу после нажатия.
async function show(pl, form) {
  for (let i = 0; i < 10; i++) {
    const r = await form.show(pl);
    if (!r.canceled || r.cancelationReason !== 'UserBusy') return r;
    await wait(5);
  }
  return { canceled: true };
}

const busy = new Map(); // игрок → тик, когда окно закрылось (или true, пока открыто)
function guarded(fn) {
  return (pl, ...args) => {
    const b = busy.get(pl.id);
    if (b === true || (b && system.currentTick - b < 10)) return;
    busy.set(pl.id, true);
    system.run(async () => {
      try { await fn(pl, ...args); } catch (e) { console.warn('acastle окно: ' + e); } finally { busy.set(pl.id, system.currentTick); }
    });
  };
}

async function talkInner(pl, id) {
  let node = dialog(id, api, pl);
  for (let step = 0; node && step < 40; step++) {
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
  let extra = '';
  try { extra = bookExtra(api); } catch (e) { extra = ''; }
  const form = new ActionFormData().title('Книга заданий')
    .body(`Звание: §6${S.rank}§r · выполнено заданий: ${doneN}\n${extra}\n\n${lines.length ? lines.join('\n\n') : 'Заданий нет. Поговорите с жителями замка.'}\n\nКнопка задания включает огоньки-путеводители к цели (в замке) или указатель с расстоянием (в лесу — держите в руке компас или эту книгу).`);
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
