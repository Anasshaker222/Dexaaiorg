// نظام المستويات والصناديق - منطق نقي (بدون Firebase) عشان يكون سهل الاختبار.

import { NO_BOOST, type Boost } from './tacticsEngine';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemKind = 'ring' | 'boost';

/** تأثيرات بطاقة اللاعب (نوع وحيد لكل بطاقة). */
export type Effect = { move?: number; pass?: number; shoot?: number; tackle?: number; guard?: number };
export type EffectKind = keyof Effect;

export type Item = { id: string; name: string; rarity: Rarity; kind: 'ring'; color: string };

export const RARITY_META: Record<Rarity, { label: string; text: string; border: string; weight: number }> = {
  common: { label: 'عادي', text: 'text-gray-300', border: 'border-gray-500/50', weight: 70 },
  rare: { label: 'نادر', text: 'text-sky-400', border: 'border-sky-400/50', weight: 22 },
  epic: { label: 'ملحمي', text: 'text-purple-400', border: 'border-purple-400/50', weight: 7 },
  legendary: { label: 'أسطوري', text: 'text-yellow-400', border: 'border-yellow-400/60', weight: 1 },
};

/** إطارات ملوّنة بتظهر حوالين لاعبينك بالملعب (كتالوج ثابت، مش عشوائي). */
export const RING_ITEMS: Item[] = [
  { id: 'ring-white', name: 'إطار أبيض', rarity: 'common', kind: 'ring', color: '#f8fafc' },
  { id: 'ring-lime', name: 'إطار ليموني', rarity: 'common', kind: 'ring', color: '#a3e635' },
  { id: 'ring-orange', name: 'إطار برتقالي', rarity: 'common', kind: 'ring', color: '#fb923c' },
  { id: 'ring-teal', name: 'إطار تركوازي', rarity: 'common', kind: 'ring', color: '#2dd4bf' },
  { id: 'ring-sky', name: 'إطار سماوي', rarity: 'rare', kind: 'ring', color: '#38bdf8' },
  { id: 'ring-pink', name: 'إطار وردي', rarity: 'rare', kind: 'ring', color: '#f472b6' },
  { id: 'ring-amber', name: 'إطار كهرماني', rarity: 'rare', kind: 'ring', color: '#fbbf24' },
  { id: 'ring-violet', name: 'إطار بنفسجي', rarity: 'epic', kind: 'ring', color: '#a78bfa' },
  { id: 'ring-fuchsia', name: 'إطار فوشيا', rarity: 'epic', kind: 'ring', color: '#e879f9' },
  { id: 'ring-gold', name: 'إطار ذهبي', rarity: 'legendary', kind: 'ring', color: '#facc15' },
  { id: 'ring-diamond', name: 'إطار ماسي', rarity: 'legendary', kind: 'ring', color: '#67e8f9' },
];

/** وصف تأثير البطاقة بالعربي. */
export function describeEffect(e: Effect): string {
  const parts: string[] = [];
  if (e.move) parts.push(`+${e.move} مدى حركة`);
  if (e.shoot) parts.push(`+${Math.round(e.shoot * 100)}% دقة تسديد`);
  if (e.pass) parts.push(`+${e.pass} مدى تمرير`);
  if (e.tackle) parts.push(`+${Math.round(e.tackle * 100)}% نجاح استخلاص`);
  if (e.guard) parts.push(`-${Math.round(e.guard * 100)}% نجاح استخلاص الخصم عليك`);
  return parts.join(' • ');
}

// ---------- بطاقات اللاعبين (تُفتح من الصناديق بأسماء عشوائية) ----------

/** بطاقة لاعب: اسم عشوائي + قدرة وحيدة بقيمة عشوائية. نفس القدرة ممكن تتكرر
 * ببطاقات كثيرة، بس القيمة (الرقم) بتختلف من بطاقة لبطاقة. */
export type PlayerCard = {
  id: string; // معرّف فريد لهاي البطاقة بالذات (حتى لو نفس الاسم أو نفس القدرة تكرر)
  name: string; // اسم اللاعب (عشوائي)
  rarity: Rarity;
  effectKind: EffectKind;
  value: number;
  color: string;
};

const CARD_FIRST_NAMES = [
  'كريم', 'ياسر', 'مراد', 'سامر', 'وائل', 'زياد', 'باسل', 'رامي', 'فادي', 'نور',
  'حمزة', 'عدي', 'طارق', 'ماهر', 'بلال', 'أنس', 'خالد', 'سيف', 'جود', 'ليث',
];
const CARD_LAST_NAMES = [
  'الشاهين', 'النسر', 'البرق', 'الصقر', 'الرعد', 'الغزال', 'المارد', 'العاصفة',
  'الفارس', 'النمر', 'الأسد', 'الصاروخ', 'الفهد', 'الوعل',
];

function randomCardName(rng: () => number): string {
  const first = CARD_FIRST_NAMES[Math.floor(rng() * CARD_FIRST_NAMES.length)];
  const last = CARD_LAST_NAMES[Math.floor(rng() * CARD_LAST_NAMES.length)];
  return `${first} ${last}`;
}

const EFFECT_KIND_META: Record<EffectKind, { label: string; color: string }> = {
  move: { label: 'مدى حركة', color: '#a3e635' },
  pass: { label: 'مدى تمرير', color: '#f472b6' },
  shoot: { label: 'دقة تسديد', color: '#fbbf24' },
  tackle: { label: 'نجاح استخلاص', color: '#c084fc' },
  guard: { label: 'صد استخلاص الخصم', color: '#2dd4bf' },
};
const EFFECT_KINDS = Object.keys(EFFECT_KIND_META) as EffectKind[];

// مدى القيمة العشوائية (min..max) لكل قدرة حسب الندرة. القيم كلها صغيرة عن قصد
// عشان تضل المباراة عادلة، بس بتختلف بطاقة عن وحدة داخل نفس الفئة.
const VALUE_RANGE: Record<EffectKind, Record<Rarity, [number, number]>> = {
  move: { common: [1, 2], rare: [2, 3], epic: [3, 4], legendary: [4, 6] },
  pass: { common: [3, 6], rare: [6, 9], epic: [9, 12], legendary: [12, 16] },
  shoot: { common: [0.02, 0.04], rare: [0.04, 0.06], epic: [0.06, 0.08], legendary: [0.08, 0.11] },
  tackle: { common: [0.02, 0.05], rare: [0.05, 0.08], epic: [0.08, 0.11], legendary: [0.11, 0.14] },
  guard: { common: [0.02, 0.05], rare: [0.05, 0.08], epic: [0.08, 0.11], legendary: [0.11, 0.14] },
};

function pickRarity(rng: () => number): Rarity {
  const rarities = Object.keys(RARITY_META) as Rarity[];
  const total = rarities.reduce((sum, r) => sum + RARITY_META[r].weight, 0);
  let roll = rng() * total;
  for (const r of rarities) {
    roll -= RARITY_META[r].weight;
    if (roll < 0) return r;
  }
  return 'common';
}

function randomId(rng: () => number): string {
  return `card_${Date.now().toString(36)}_${Math.floor(rng() * 1e9).toString(36)}`;
}

/** بيولّد بطاقة لاعب جديدة كليًا (اسم عشوائي + ندرة عشوائية + قدرة وقيمة عشوائية). */
export function rollPlayerCard(rng: () => number = Math.random): PlayerCard {
  const rarity = pickRarity(rng);
  const effectKind = EFFECT_KINDS[Math.floor(rng() * EFFECT_KINDS.length)];
  const [min, max] = VALUE_RANGE[effectKind][rarity];
  const raw = min + rng() * (max - min);
  const value = effectKind === 'move' || effectKind === 'pass' ? Math.round(raw) : Math.round(raw * 100) / 100;
  return {
    id: randomId(rng),
    name: randomCardName(rng),
    rarity,
    effectKind,
    value,
    color: EFFECT_KIND_META[effectKind].color,
  };
}

export function describeCardEffect(card: PlayerCard): string {
  return describeEffect({ [card.effectKind]: card.value } as Effect);
}

/** بيحوّل بطاقة اللاعب المجهّزة لتأثيرها بالمباراة. بدون بطاقة = بدون تأثير. */
export function boostFor(card: PlayerCard | null | undefined): Boost {
  if (!card) return NO_BOOST;
  return {
    id: card.id,
    move: card.effectKind === 'move' ? card.value : 0,
    pass: card.effectKind === 'pass' ? card.value : 0,
    shoot: card.effectKind === 'shoot' ? card.value : 0,
    tackle: card.effectKind === 'tackle' ? card.value : 0,
    guard: card.effectKind === 'guard' ? card.value : 0,
  };
}

export function boostName(card: PlayerCard | null | undefined): string {
  return card?.name ?? 'بدون';
}

export const XP_BASE = 100;
export const DUPLICATE_XP = 25;

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / XP_BASE)) + 1;
}

export function xpForLevel(level: number): number {
  return XP_BASE * (level - 1) * (level - 1);
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const needed = xpForLevel(level + 1) - floor;
  const current = Math.max(0, xp) - floor;
  return { level, current, needed, pct: Math.min(1, current / needed) };
}

/** XP اللي بيربحها اللاعب بعد مباراة أونلاين: فوز 100، تعادل 50، خسارة 30، + 10 لكل هدف (حد أقصى 3).
 * "result" هي نتيجة المباراة الفعلية (1 فوز / 0.5 تعادل / 0 خسارة)، مش مشتقة من النتيجة نفسها،
 * عشان فوز بالانسحاب يضل محسوب فوز كامل. */
export function matchXp(result: 1 | 0.5 | 0, myScore: number): number {
  const base = result === 1 ? 100 : result === 0.5 ? 50 : 30;
  return base + Math.min(myScore, 3) * 10;
}

/** بيسحب إطار عشوائي من كتالوج الإطارات الثابت (موزون حسب الندرة). */
export function rollItem(pool: Item[] = RING_ITEMS, rng: () => number = Math.random): Item {
  const rarities = Object.keys(RARITY_META) as Rarity[];
  const total = rarities.reduce((sum, r) => sum + RARITY_META[r].weight, 0);
  let roll = rng() * total;
  let picked: Rarity = 'common';
  for (const r of rarities) {
    roll -= RARITY_META[r].weight;
    if (roll < 0) {
      picked = r;
      break;
    }
  }
  const candidates = pool.filter((i) => i.rarity === picked);
  return candidates[Math.floor(rng() * candidates.length) % candidates.length];
}
