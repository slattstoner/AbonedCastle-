// Ночные налёты (0.11.0): раз в несколько ночей из леса к воротам выходит ватага разбойников.
// Стража бьётся с ними, раненые разбойники бегут (как в осаде). Отбитый налёт — награда от капитана.
import { world, system } from '@minecraft/server';

const TAGR = 'acastle_nightraid';
export function raidTick(api) {
  const S = api.S, t = world.getTimeOfDay(), day = world.getDay(), night = t >= 13500 && t <= 22000;
  if (!api.done('s0_night') || world.getDifficulty() === 'Peaceful') return;
  let mobs = [];
  try { mobs = api.dim().getEntities({ tags: [TAGR] }); } catch (e) { return; }
  if (S.f.raid_on) {
    if (!night) { for (const m of mobs) try { m.remove(); } catch (e) { /* нет */ } S.f.raid_on = 0; api.save(); return; }
    if (mobs.length) { for (const p of api.players()) if (api.flat(p.location, api.W(api.castle.gate)) < 80) p.onScreenDisplay.setActionBar(`§cНалёт: разбойников осталось ${mobs.length}`); return; }
    S.f.raid_on = 0; S.f.raids = (S.f.raids || 0) + 1; api.save();
    api.say('demyan', `Отбились! Это уже ${S.f.raids}-й налёт. Держи долю из отбитого.`, 200);
    for (const p of api.players()) if (api.flat(p.location, api.W(api.castle.gate)) < 96) { api.give(p, 'minecraft:emerald', 2); api.give(p, 'minecraft:arrow', 8); }
    return;
  }
  // решаем один раз за ночь: первая ночь после «Ночи у ворот» — тихая, дальше — примерно каждая вторая
  if (!night || S.f.raid_day === day) return;
  const gate = api.W(api.castle.gate);
  if (!api.players().some((p) => api.flat(p.location, gate) < 90)) return;
  S.f.raid_day = day; api.save();
  if (S.f.raid_first === undefined) { S.f.raid_first = day; api.save(); return; }
  if (Math.random() > 0.5) return;
  const n = 3 + Math.min(3, Math.floor((S.f.raids || 0) / 2));
  let made = 0;
  for (let i = 0; i < n; i++) {
    const c = api.W([55 + Math.floor(Math.random() * 17), 0, 148 + Math.floor(Math.random() * 6)]);
    const top = api.topAt(c.x, c.z);
    if (!top) continue;
    try {
      const e = api.dim().spawnEntity('acastle:bandit', { x: c.x + 0.5, y: top.location.y + 1, z: c.z + 0.5 }, { spawnEvent: 'acastle:as_' + ['sych', 'voron', 'grinya'][i % 3] });
      e.nameTag = 'Разбойник'; e.addTag(TAGR); e.addTag('acastle_raid'); e.triggerEvent('acastle:hostile'); made++;
    } catch (err) { /* участок не загружен */ }
  }
  if (!made) return;
  S.f.raid_on = 1; api.save();
  api.say('ostap', '§cК оружию! Разбойники из леса — к воротам!', 200);
  for (const p of api.players()) if (api.flat(p.location, gate) < 120) { p.onScreenDisplay.setTitle('§cНалёт', { subtitle: 'Разбойники у ворот', fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 10 }); try { p.playSound('raid.horn'); } catch (e) { /* нет звука */ } }
}
