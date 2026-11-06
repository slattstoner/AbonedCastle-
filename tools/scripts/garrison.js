// Гарнизон замка (docs/workers.md, «Стража»). Список — CASTLE.garrison.roster (tools/npc.js).
//  • Посты: ворота ×2, вход в донжон ×2, дозор по двору (пара), обход донжона (один) — их держат
//    две смены по 7 человек, у каждого своя койка в казарме. Днём стоит дневная смена, ночью —
//    ночная. На пересменке новый идёт от своей койки на пост; прежний, когда его сменили, идёт
//    к своей койке и ложится спать (пропадает до своей смены). Пока у поста нет сменщика,
//    стражник стоит обе смены. Без смен: дозорные угловых башен и лучники надвратных башен.
//  • Ходят стражники по готовым путям (сборщик считает их по клеткам, где можно пройти):
//    от койки к посту, обходы — по петле через двор. Скрипт переносит их шагами; если рядом
//    монстр — не мешает: стражник дерётся сам, потом возвращается на пост или на обход.
//  • Набор: капитан Демьян (кнопка «Гарнизон» в разговоре). Новобранцу нужен меч — его
//    куёт кузнец (workers.js), наутро новобранец на посту.
//  • Снаряжение: кузнец куёт броню и мечи, garrison.equip надевает (видно на стражнике).
//  • Сюжет, ведущий стражника (пир, осада), — главнее: если S.npcs[id] не 'post', гарнизон
//    стражника не трогает. Свои истории стражников — заготовки в guard_stories.js.
// Команды: /scriptevent acastle:guard status | all | day | night | tp <id>
import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { show } from './ui.js';
import { S, save, DIM, players, runCmd } from './state.js';
import { CASTLE } from './castle_data.js';
import { NPCS, HOOKS } from './story.js';
import { GUARD_STORIES } from './guard_stories.js';

const KEY = 'acastle:garrison';
const GR = () => CASTLE.garrison;
const ROSTER = () => GR().roster;
const byId = (id) => ROSTER().find((g) => g.id === id);
export const GARRISON_IDS = new Set((CASTLE.garrison ? CASTLE.garrison.roster : []).map((g) => g.id));
// Новые стражники — тоже жители (для разговора и книги)
for (const g of (CASTLE.garrison ? CASTLE.garrison.roster : [])) if (!NPCS[g.id]) NPCS[g.id] = { name: g.name, guard: true, start: null, garrison: true };

export let G = null;
function gload() {
  try { G = JSON.parse(world.getDynamicProperty(KEY) || 'null'); } catch (e) { G = null; }
  if (!G || G.v !== 1) G = { v: 1, origin: null, rec: {}, st: {}, gear: {}, want: {}, ri: {}, since: {} };
}
let gdirty = false;
const gsave = () => { gdirty = true; };
function gflush() { if (gdirty && G) { world.setDynamicProperty(KEY, JSON.stringify(G)); gdirty = false; } }

// ---------- Кто где ----------
const Wc = (c) => ({ x: S.origin[0] + c[0], y: S.origin[1] + c[1], z: S.origin[2] + c[2] });
const W3 = (flat, k) => Wc([flat[k], flat[k + 1], flat[k + 2]]);
const pts = (flat) => { const out = []; for (let k = 0; k < flat.length; k += 3) out.push(W3(flat, k)); return out; };
const blk = (p) => { try { return DIM().getBlock(p); } catch (e) { return undefined; } };
const tag = (id) => 'acastle_npc_' + id;
const whereOf = (id) => (id in S.npcs ? S.npcs[id] : NPCS[id] && NPCS[id].start);
const recruited = (id) => whereOf(id) === 'post';
export const managed = (id) => GARRISON_IDS.has(id) && recruited(id);
const isNight = () => { const t = world.getTimeOfDay(); return t >= 12000; };
const RANK_ORDER = { десятник: 0, стражник: 1, лучник: 2, дозорный: 3 };
// Капитан и стражники по званию — в таком порядке кузнец их и одевает
export function byRank() {
  const list = ROSTER().filter((g) => recruited(g.id)).sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || ROSTER().indexOf(a) - ROSTER().indexOf(b));
  return [...(S.npcs.demyan ? [{ id: 'demyan', name: 'Капитан Демьян Беляк', rank: 'капитан' }] : []), ...list];
}
const slotKey = (g) => g.post + ':' + (g.slot || 0);
function slots() {
  const out = {};
  for (const g of ROSTER()) (out[slotKey(g)] = out[slotKey(g)] || []).push(g);
  return out;
}
// Кто сейчас должен стоять на посту
function onDuty(list) {
  const rec = list.filter((g) => recruited(g.id));
  if (!rec.length) return null;
  const want = isNight() ? 'night' : 'day';
  return (rec.find((g) => !g.shift || g.shift === want) || rec[0]).id;
}
const POST_TITLE = {
  gate_l: 'ворота', gate_r: 'ворота', keep_l: 'вход в донжон', keep_r: 'вход в донжон', patrol_yard: 'дозор по двору', patrol_keep: 'обход донжона',
  tower_nw: 'башня за амбаром', tower_ne: 'башня за домом управителя', tower_sw: 'башня у шахты', tower_se: 'башня у двора строителя', arch_l: 'левая надвратная башня', arch_r: 'правая надвратная башня',
};
const isPatrol = (g) => g.post.startsWith('patrol_');
const routeOf = (g) => pts(GR().routes[g.post].path);
// Место поста (для обхода — текущая точка петли)
function postAt(g) {
  if (isPatrol(g)) { const r = routeOf(g); return r[(G.ri[g.id] || 0) % r.length]; }
  return Wc(GR().posts[g.post]);
}
const bedAt = (g) => (g.bed !== undefined && GR().beds[g.bed] ? Wc(GR().beds[g.bed]) : null);

// ---------- Существа ----------
const ents = {};
function entOf(id) {
  const e = ents[id];
  try { if (e && e.isValid) return e; } catch (err) { /* нет */ }
  ents[id] = undefined;
  return undefined;
}
function findAll() {
  let list = [];
  try { list = DIM().getEntities({ type: 'acastle:guard' }); } catch (e) { list = []; }
  const out = {};
  for (const e of list) { let id = null; try { for (const t of e.getTags()) if (t.startsWith('acastle_npc_')) id = t.slice(12); } catch (err) { /* нет */ } if (id) (out[id] = out[id] || []).push(e); }
  return out;
}
function standable(p) {
  const below = blk({ x: p.x, y: p.y - 1, z: p.z }), feet = blk(p), head = blk({ x: p.x, y: p.y + 1, z: p.z });
  if (!below || !feet || !head || below.isAir || below.isLiquid) return false;
  const open = (b) => b.isAir || /grass|fern|flower|carpet|torch|rail|snow_layer|light_block/.test(b.typeId);
  return open(feet) && open(head);
}
function spawn(g, at) {
  if (!blk(at) || !standable(at)) return null;
  try {
    const e = DIM().spawnEntity('acastle:guard', { x: at.x + 0.5, y: at.y, z: at.z + 0.5 }, { spawnEvent: 'acastle:as_' + g.id, initialPersistence: true });
    e.nameTag = g.name; e.addTag(tag(g.id));
    if (!g.archer && g.post !== 'arch_l') e.triggerEvent('acastle:patrol');
    ents[g.id] = e; applied.delete(g.id);
    return e;
  } catch (err) { report(g.name + ': не встал', err); return null; }
}
function despawn(id) { const e = entOf(id); if (e) try { e.triggerEvent('acastle:despawn'); e.removeTag(tag(id)); } catch (err) { /* нет */ } ents[id] = undefined; }
let errAt = 0;
function report(what, e) {
  console.warn('acastle гарнизон: ' + what + ' ' + (e || ''));
  if (system.currentTick - errAt > 1200) { errAt = system.currentTick; world.sendMessage('§c[Замок] Гарнизон: ' + what + (e ? ' — ' + e : '')); }
}

// ---------- Снаряжение ----------
const SLOT_CMD = { head: 'slot.armor.head', chest: 'slot.armor.chest', legs: 'slot.armor.legs', feet: 'slot.armor.feet', hand: 'slot.weapon.mainhand' };
const applied = new Map(); // id → снаряжение, которое уже надето на это существо
export const gearOf = (id) => (G ? G.gear[id] || {} : {});
export function equip(id, slot, item) {
  if (!G) gload();
  (G.gear[id] = G.gear[id] || {})[slot] = item; gsave(); gflush();
  applied.delete(id);
}
function applyGear(id, e) {
  const gear = G.gear[id];
  if (!gear) return;
  const key = JSON.stringify(gear) + ':' + e.id;
  if (applied.get(id) === key) return;
  for (const [slot, item] of Object.entries(gear)) runCmd(`replaceitem entity @e[tag=${tag(id)}] ${SLOT_CMD[slot]} 0 ${item}`);
  applied.set(id, key);
}

// ---------- Набор ----------
function needsMet(g) {
  if (!g.needs) return true;
  if (g.needs === 'barracks') return !!(S.rep.barracks && S.rep.barracks.st === 'done');
  let done = {};
  try { done = (JSON.parse(world.getDynamicProperty('acastle:work') || '{}').build || {}).done || {}; } catch (e) { done = {}; }
  return !!done[g.needs];
}
const NEEDS_TEXT = { barracks: 'казарма во дворе перекрыта', tower_nw: 'башня за амбаром сложена', tower_ne: 'башня за домом управителя сложена', tower_sw: 'башня у шахты сложена', tower_se: 'башня у двора строителя сложена' };
// Новобранцы, для которых кузнец должен сковать меч
export const wanted = () => Object.keys(G ? G.want : {}).filter((id) => !recruited(id));
export function recruitArrive(id) {
  if (!G) gload();
  const g = byId(id);
  if (!g) return;
  delete G.want[id];
  S.npcs[id] = 'post'; save();
  G.st[id] = 'rest'; gsave(); gflush();
  world.sendMessage(`§6${g.name} принял меч и заступает в гарнизон: ${POST_TITLE[g.post]}${g.shift ? (g.shift === 'night' ? ', ночная смена' : ', дневная смена') : ''}.`);
}

// ---------- Ходьба ----------
const movers = {};
function walk(id, path, done, v = 0.15) {
  if (!path || path.length < 2) { done && done(); return; }
  movers[id] = { path, i: 0, t: 0, v, done };
}
function moveTick(id, dt) {
  const m = movers[id], e = entOf(id);
  if (!m) return false;
  if (!e) { delete movers[id]; return false; }
  m.t += m.v * dt;
  while (m.t >= 1 && m.i < m.path.length - 1) { m.t -= 1; m.i++; }
  const a = m.path[m.i], b = m.path[Math.min(m.i + 1, m.path.length - 1)];
  const last = m.i >= m.path.length - 1;
  const t = last ? 0 : m.t;
  try { e.teleport({ x: a.x + (b.x - a.x) * t + 0.5, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t + 0.5 }, { facingLocation: { x: b.x + 0.5, y: b.y + 1.6, z: b.z + 0.5 } }); } catch (err) { /* нет */ }
  if (last) { delete movers[id]; if (m.done) m.done(); }
  return true;
}
const line = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z))); const out = []; for (let k = 0; k <= n; k++) out.push({ x: Math.round(a.x + (b.x - a.x) * k / n), y: k < n ? Math.floor(a.y) : b.y, z: Math.round(a.z + (b.z - a.z) * k / n) }); return out; };
const fl = (l) => ({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });
const busy = {}; // id → тик, когда рядом был монстр

// ---------- Каждую секунду: смены, посты, появление ----------
let shiftAt = {};
export function garrisonTick() {
  if (!S || !S.origin || S.build || !CASTLE.garrison) return;
  if (!G) gload();
  if (!G.origin || G.origin.join() !== S.origin.join()) { const keep = G.gear; gload(); G = { v: 1, origin: S.origin.slice(), rec: {}, st: {}, gear: keep || {}, want: {}, ri: {}, since: {} }; gsave(); }
  const found = findAll();
  for (const [id, list] of Object.entries(found)) {
    if (!GARRISON_IDS.has(id)) continue;
    if (!managed(id)) continue; // сюжет ведёт сам (пир, осада) — не трогаем
    const keep = entOf(id) || list[0];
    for (const e of list) if (e !== keep) try { e.triggerEvent('acastle:despawn'); e.removeTag(tag(id)); } catch (err) { /* нет */ }
    if (!ents[id]) { ents[id] = keep; try { keep.triggerEvent('acastle:patrol'); } catch (err) { /* нет */ } }
  }
  // броня и мечи — всем, на ком они должны быть (и капитану)
  for (const id of [...GARRISON_IDS, 'demyan']) { const e = entOf(id) || (found[id] && found[id][0]); if (e && G.gear[id]) applyGear(id, e); }
  if (G.gear.demyan) { let d = null; try { d = DIM().getEntities({ tags: [tag('demyan')] })[0]; } catch (e) { d = null; } if (d) applyGear('demyan', d); }
  const now = system.currentTick;
  for (const [key, list] of Object.entries(slots())) {
    const duty = onDuty(list);
    if (shiftAt[key] !== duty) { shiftAt[key] = duty; G.since[key] = now; }
    for (const g of list) {
      if (!managed(g.id)) continue;
      const st = G.st[g.id] || 'rest', e = entOf(g.id);
      if (g.id === duty) {
        if (st === 'rest' || st === 'toBed') {
          delete movers[g.id];
          const bed = bedAt(g), path = GR().paths[g.id];
          if (e) { G.st[g.id] = 'duty'; } // ещё не ушёл — остаётся
          else if (bed && path && blk(bed) && standable(bed)) {
            const ne = spawn(g, bed);
            if (ne) { G.st[g.id] = 'toPost'; walk(g.id, pts(path), () => { G.st[g.id] = 'duty'; G.ri[g.id] = 0; gsave(); }); }
          } else G.st[g.id] = 'duty';
          gsave();
        } else if (st === 'duty' && !e) {
          const at = postAt(g);
          if (blk(at)) spawn(g, at);
        } else if (st === 'toPost' && !e) G.st[g.id] = 'duty';
      } else {
        // не его смена: дождаться сменщика (или минуты), потом к койке и спать
        if (st === 'duty' || st === 'toPost') {
          const rel = duty && (G.st[duty] === 'duty' || now - (G.since[key] || now) > 1200);
          if (!duty) continue; // сменщика нет — стоит дальше
          if (!rel) continue;
          const bed = bedAt(g), path = GR().paths[g.id];
          if (e && bed && path) {
            G.st[g.id] = 'toBed'; delete movers[g.id];
            const back = pts(path).reverse();
            const from = fl(e.location);
            walk(g.id, [...line(from, back[0]), ...back], () => { despawn(g.id); G.st[g.id] = 'rest'; gsave(); });
          } else { despawn(g.id); G.st[g.id] = 'rest'; }
          gsave();
        } else if (st === 'toBed' && !e) G.st[g.id] = 'rest';
      }
    }
  }
  gflush();
}

// ---------- Каждый тик: шаги, обходы, возврат на пост ----------
let lastMove = 0, lastScan = 0;
export function garrisonMove() {
  if (!S || !S.origin || !G || !CASTLE.garrison) return;
  const now = system.currentTick;
  // сколько тиков прошло (в игре — 1; если игра пропустила тики — догоняем)
  const dt = Math.max(1, Math.min(20, now - (lastMove || now))); lastMove = now;
  const scan = now - lastScan >= 10; if (scan) lastScan = now;
  for (const g of ROSTER()) {
    const e = entOf(g.id);
    if (!e) continue;
    // бой: монстр рядом — стражник дерётся сам
    if (scan) {
      let m = [];
      try { m = DIM().getEntities({ location: e.location, maxDistance: 10, families: ['monster'] }); } catch (err) { m = []; }
      if (m.length) busy[g.id] = now;
    }
    const fight = busy[g.id] && now - busy[g.id] < 60;
    if (fight) { if (movers[g.id] && G.st[g.id] === 'duty') delete movers[g.id]; continue; }
    if (moveTick(g.id, dt)) continue;
    if (G.st[g.id] !== 'duty' || !managed(g.id)) continue;
    if (isPatrol(g)) {
      const r = routeOf(g);
      // второй в паре идёт за первым, на три шага позади
      let i = G.ri[g.id] || 0;
      if (g.slot) { const lead = ROSTER().find((q) => q.post === g.post && !q.slot && q.shift === g.shift); if (lead && entOf(lead.id) && G.st[lead.id] === 'duty') i = ((G.ri[lead.id] || 0) - 3 + r.length) % r.length; }
      const at = r[i % r.length], here = e.location;
      if (Math.hypot(here.x - at.x - 0.5, here.z - at.z - 0.5) > 3) { walk(g.id, line(fl(here), at), null, 0.15); continue; }
      const nx = r[(i + 1) % r.length];
      G.pt = G.pt || {}; G.pt[g.id] = (G.pt[g.id] || 0) + 0.1 * dt;
      if (G.pt[g.id] >= 1) { G.pt[g.id] = 0; G.ri[g.id] = (i + 1) % r.length; gsave(); }
      const t = G.pt[g.id];
      try { e.teleport({ x: at.x + (nx.x - at.x) * t + 0.5, y: at.y + (nx.y - at.y) * t, z: at.z + (nx.z - at.z) * t + 0.5 }, { facingLocation: { x: nx.x + 0.5, y: nx.y + 1.6, z: nx.z + 0.5 } }); } catch (err) { /* нет */ }
    } else if (scan) {
      const at = postAt(g), here = e.location;
      const d = Math.hypot(here.x - at.x - 0.5, here.z - at.z - 0.5);
      if (d > 2.5 || Math.abs(here.y - at.y) > 1.5) {
        if (d > 24) try { e.teleport({ x: at.x + 0.5, y: at.y, z: at.z + 0.5 }); } catch (err) { /* нет */ }
        else walk(g.id, line(fl(here), at), null, 0.15);
      }
    }
  }
}

// ---------- Разговор: карточка службы ----------
const RANK_RU = { десятник: 'десятник', стражник: 'стражник', лучник: 'лучник', дозорный: 'дозорный' };
const ITEM_RU = (it) => (it || '').replace('minecraft:', '').replace(/^iron_/, 'железн. ').replace(/^diamond_/, 'алмазн. ').replace('helmet', 'шлем').replace('chestplate', 'нагрудник').replace('leggings', 'поножи').replace('boots', 'сапоги').replace('sword', 'меч');
export function gearText(id) { const g = gearOf(id); const list = ['head', 'chest', 'legs', 'feet', 'hand'].filter((k) => g[k]).map((k) => ITEM_RU(g[k])); return list.length ? list.join(', ') : 'своё (без брони)'; }
export function card(id) {
  if (!G) gload();
  const g = byId(id);
  if (!g) return '';
  const st = G.st[id] || 'rest';
  const now = { duty: isPatrol(g) ? 'на обходе' : 'на посту', toPost: 'идёт на пост', toBed: 'идёт спать', rest: 'спит в казарме' }[st];
  return [`§l${g.name}§r, ${RANK_RU[g.rank]}.`, `§7Пост:§r ${POST_TITLE[g.post]}${isPatrol(g) ? ' (' + GR().routes[g.post].title + ')' : ''}.`,
    `§7Смена:§r ${g.shift ? (g.shift === 'day' ? 'дневная' : 'ночная') + (g.bed !== undefined ? `, койка №${g.bed + 1} в казарме` : '') : 'без смены, живёт у своего поста'}. §7Сейчас:§r ${now}.`,
    `§7Снаряжение:§r ${gearText(id)}.`].join('\n');
}
// Узел разговора стражника: своя история (заготовка) или карточка службы
export function guardNode(id, node) {
  if (!GARRISON_IDS.has(id) || !S || !S.origin) return node;
  const story = GUARD_STORIES[id];
  const c = card(id);
  const own = story && story.talk ? story.talk(null, null, c) : null;
  if (own) return own;
  const cardNode = { text: c + (story ? `\n\n§7Своя история: «${story.title}» — скоро.§r` : ''), options: [{ text: 'Служи' }] };
  if (!node || node.text === '…') return cardNode;
  return { ...node, options: [...(node.options || []), { text: 'Как служба?', next: cardNode }] };
}

// ---------- Капитан: окно гарнизона ----------
export async function garrisonMenu(pl) {
  if (!G) gload();
  const lines = [];
  for (const [key, list] of Object.entries(slots())) {
    const g0 = list[0];
    lines.push(`§7${POST_TITLE[g0.post]}:§r ` + list.map((g) => `${g.name.split(' ').pop()}${g.shift ? (g.shift === 'day' ? ' (д)' : ' (н)') : ''} — ${recruited(g.id) ? { duty: 'служит', toPost: 'идёт на пост', toBed: 'идёт спать', rest: 'спит' }[G.st[g.id] || 'rest'] : G.want[g.id] ? 'ждёт меч' : 'нет'}`).join('; '));
  }
  const free = ROSTER().filter((g) => !recruited(g.id) && !G.want[g.id] && g.from !== 'story');
  const f = new ActionFormData().title('Гарнизон').body(`Сейчас ${isNight() ? 'ночь — стоит ночная смена' : 'день — стоит дневная смена'}. Набрано ${ROSTER().filter((g) => recruited(g.id)).length} из ${ROSTER().length}.\n` +
    'Новобранцу нужен меч — его скуёт кузнец Гордей, наутро человек на посту.\n\n' + lines.join('\n'));
  const btn = [];
  for (const g of free.slice(0, 8)) btn.push([`${needsMet(g) ? '§2' : '§8'}Набрать: ${g.name}§r\n${POST_TITLE[g.post]}${g.shift ? (g.shift === 'day' ? ', днём' : ', ночью') : ''}${needsMet(g) ? '' : ' — когда ' + (NEEDS_TEXT[g.needs.split(':')[0]] || g.needs)}`, g]);
  btn.push(['Пока', null]);
  for (const [t] of btn) f.button(t);
  const r = await show(pl, f);
  if (r.canceled || !btn[r.selection][1]) return;
  const g = btn[r.selection][1];
  if (!needsMet(g)) { pl.sendMessage(`§eКапитан Демьян:§r Рано. Сперва чтоб ${NEEDS_TEXT[g.needs.split(':')[0]] || g.needs}.`); return; }
  G.want[g.id] = 'sword'; gsave(); gflush();
  pl.sendMessage(`§eКапитан Демьян:§r ${g.name.split(' ').pop()} придёт, как будет меч. Скажу Гордею — скуёт.`);
}
if (HOOKS) HOOKS.garrisonMenu = (pl) => system.runTimeout(() => garrisonMenu(pl).catch((e) => report('окно', e)), 2);

// ---------- Команды ----------
export function guardCommand(msg, src) {
  if (!G) gload();
  const [cmd, arg] = (msg || '').trim().split(/\s+/);
  const out = [];
  if (!S || !S.origin) out.push('Замок ещё не поставлен.');
  else if (!cmd || cmd === 'status') {
    out.push(`§6[Гарнизон]§r ${isNight() ? 'ночь' : 'день'}, набрано ${ROSTER().filter((g) => recruited(g.id)).length} из ${ROSTER().length}`);
    for (const g of ROSTER()) if (recruited(g.id) || G.want[g.id]) { const e = entOf(g.id); out.push(`${g.name}: ${G.want[g.id] && !recruited(g.id) ? 'ждёт меч' : (G.st[g.id] || 'rest')}${e ? ' (' + [e.location.x, e.location.y, e.location.z].map(Math.floor).join(' ') + ')' : ''}${movers[g.id] ? ', идёт' : ''}; ${gearText(g.id)}`); }
  } else if (cmd === 'all') { for (const g of ROSTER()) if (!recruited(g.id)) { S.npcs[g.id] = 'post'; G.st[g.id] = 'rest'; } save(); gsave(); out.push('Весь гарнизон набран (для проверки).'); }
  else if (cmd === 'day') { runCmd('time set 1000'); out.push('Утро: дневная смена.'); }
  else if (cmd === 'night') { runCmd('time set 13000'); out.push('Ночь: ночная смена.'); }
  else if (cmd === 'tp') { const e = entOf(arg); if (e && src) { src.teleport(e.location); out.push('Перенёс к ' + byId(arg).name); } else out.push('Стражника не видно.'); }
  else out.push('Команды: status | all | day | night | tp <id>');
  gflush();
  const text = out.join('\n');
  if (src && src.sendMessage) src.sendMessage(text); else world.sendMessage(text);
}
