// Окна (общее для разговоров, книги, работников, гарнизона). У игрока одновременно открыто не
// больше одного окна: повторное нажатие, пока окно открыто или только что закрылось, ничего не
// делает (на телефоне одно касание даёт два события).
import { system } from '@minecraft/server';

const wait = (t) => new Promise((r) => system.runTimeout(r, t));
// Окно не показывается, пока у игрока открыт другой экран (игра отвечает «занят»):
// повторяем несколько раз с паузой — так окно откроется сразу после нажатия.
export async function show(pl, form) {
  for (let i = 0; i < 10; i++) {
    const r = await form.show(pl);
    if (!r.canceled || r.cancelationReason !== 'UserBusy') return r;
    await wait(5);
  }
  return { canceled: true };
}

const busy = new Map(); // игрок → тик, когда окно закрылось (или true, пока открыто)
export function guarded(fn) {
  return (pl, ...args) => {
    const b = busy.get(pl.id);
    if (b === true || (b && system.currentTick - b < 10)) return;
    busy.set(pl.id, true);
    system.run(async () => {
      try { await fn(pl, ...args); } catch (e) { console.warn('acastle окно: ' + e); } finally { busy.set(pl.id, system.currentTick); }
    });
  };
}

