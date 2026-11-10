// Реликвии: бонус полного комплекта брони и свойства особых клинков.
//  • Латы стражи детинца — сопротивление урону;
//  • Доспех охотницы — скорость и ночное зрение;
//  • Латы основателя — сила, сопротивление урону и защита от огня;
//  • меч «Заря» поджигает нежить, тесак охотницы замедляет того, кого ранил.
// Эффект выдаётся на 16 секунд и продлевается, пока комплект надет целиком.
import { world } from '@minecraft/server';

const SETS = {
  watch: { title: 'Латы стражи детинца', what: 'удары держать легче', effects: [['resistance', 0]] },
  hunter: { title: 'Доспех охотницы', what: 'ноги быстры, а ночь светла', effects: [['speed', 0], ['night_vision', 0]] },
  founder: { title: 'Латы основателя', what: 'сила в руке, крепость в теле, огонь не страшен', effects: [['strength', 0], ['resistance', 0], ['fire_resistance', 0]] },
};
const SLOTS = [['Head', 'helmet'], ['Chest', 'chestplate'], ['Legs', 'leggings'], ['Feet', 'boots']];
const worn = new Map();

export function setOf(pl) {
  let eq;
  try { eq = pl.getComponent('minecraft:equippable'); } catch (e) { return null; }
  if (!eq) return null;
  let found = null;
  for (const [slot, piece] of SLOTS) {
    const it = eq.getEquipment(slot);
    const m = it && /^acastle:(\w+?)_(helmet|chestplate|leggings|boots)$/.exec(it.typeId);
    if (!m || m[2] !== piece || (found && found !== m[1])) return null;
    found = m[1];
  }
  return SETS[found] ? found : null;
}
export function relicTick() {
  for (const pl of world.getPlayers()) {
    const id = setOf(pl);
    if (worn.get(pl.id) !== id) {
      worn.set(pl.id, id);
      if (id) pl.sendMessage(`§6${SETS[id].title}: комплект собран — ${SETS[id].what}.`);
    }
    if (!id) continue;
    for (const [fx, amp] of SETS[id].effects) try { pl.addEffect(fx, 320, { amplifier: amp, showParticles: false }); } catch (e) { /* игрок вышел */ }
  }
}
export function relicHit(pl, target) {
  let it;
  try { it = pl.getComponent('minecraft:equippable').getEquipment('Mainhand'); } catch (e) { return; }
  if (!it || !target) return;
  try {
    if (it.typeId === 'acastle:dawn' && target.matches({ families: ['undead'] })) target.setOnFire(6, true);
    if (it.typeId === 'acastle:hunter_cleaver') target.addEffect('slowness', 60, { amplifier: 1, showParticles: true });
  } catch (e) { /* цель пропала */ }
}
