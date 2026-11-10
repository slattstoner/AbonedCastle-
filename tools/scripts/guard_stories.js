// Свои истории стражников гарнизона — ЗАГОТОВКИ. У каждого стражника будет своя ветка сюжета
// (docs/workers.md, «Стража»). Как добавить ветку:
//   talk(api, pl, card) — вернуть узел разговора ({ text, options }) или null, если сейчас
//   стражнику нечего сказать по своей истории (тогда показывается обычная карточка службы).
//   card — карточка службы (пост, смена, снаряжение), её можно вставить в текст.
// Флаги истории хранить через api.flag('g_<id>_…'), задания — как обычные (story.js QUESTS).
export const GUARD_STORIES = {
  ostap: { title: 'Последний привратник королевы', talk: null },
  mitka: { title: 'Сын погибшего стражника', talk: null },
  zhdan: { title: 'Ждан и письмо из дома', talk: null },
  gavrila: { title: 'Гаврила-тёзка', talk: null },
  luka: { title: 'Лука и пропавший обоз', talk: null },
  bogdan: { title: 'Богдан с хутора', talk: null },
  eryoma: { title: 'Ерёма-бродяга', talk: null },
  vlas: { title: 'Десятник ночной смены', talk: null },
  gleb: { title: 'Глеб и чужие огни', talk: null },
  foma: { title: 'Фома неверующий', talk: null },
  prokop: { title: 'Старый Прокоп', talk: null },
  stepan: { title: 'Степан-рыжий', talk: null },
  yakov: { title: 'Яков из острога', talk: null },
  nestor: { title: 'Нестор-грамотей', talk: null },
  arkhip: { title: 'Архип и сова', talk: null },
  semyon: { title: 'Семён и голуби', talk: null },
  kirill: { title: 'Кирилл и шахта', talk: null },
  khariton: { title: 'Харитон-молчун', talk: null },
  savva: { title: 'Савва и белая стрела', talk: null },
  lyubim: { title: 'Любим и Ворон', talk: null },
};
