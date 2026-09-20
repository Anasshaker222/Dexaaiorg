// نظام المستويات والصناديق - منطق نقي (بدون Firebase) عشان يكون سهل الاختبار.

import { NO_BOOST, type Boost } from './tacticsEngine';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemKind = 'ring' | 'boost';

/** تأثيرات بطاقة التعزيز (كلها اختيارية). */
export type Effect = { move?: number; pass?: number; shoot?: number; tackle?: number; guard?: number };

export type Item = { id: string; name: string; rarity: Rarity; kind: ItemKind; color: string; effect?: Effect };

export const RARITY_META: Record<Rarity, { label: string; text: string; border: string; weight: number }> = {
  common: { label: 'عادي', text: 'text-gray-300', border: 'border-gray-500/50', weight: 70 },
  rare: { label: 'نادر', text: 'text-sky-400', border: 'border-sky-400/50', weight: 22 },
  epic: { label: 'ملحمي', text: 'text-purple-400', border: 'border-purple-400/50', weight: 7 },
  legendary: { label: 'أسطوري', text: 'text-yellow-400', border: 'border-yellow-400/60', weight: 1 },
};

/** إطارات ملوّنة بتظهر حوالين لاعبينك بالملعب. */
export const ITEMS: Item[] = [
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

  // بطاقات تعزيز: بتأثر على اللعب (تأثيرات صغيرة عن قصد عشان تضل المباراة عادلة)
  { id: 'boost-boots', name: 'أحذية خفيفة', rarity: 'common', kind: 'boost', color: '#a3e635', effect: { move: 2 } },
  { id: 'boost-touch', name: 'لمسة دقيقة', rarity: 'common', kind: 'boost', color: '#fb923c', effect: { shoot: 0.04 } },
  { id: 'boost-gloves', name: 'قفازات', rarity: 'common', kind: 'boost', color: '#2dd4bf', effect: { guard: 0.06 } },
  { id: 'boost-sprint', name: 'أحذية سريعة', rarity: 'rare', kind: 'boost', color: '#38bdf8', effect: { move: 3 } },
  { id: 'boost-striker', name: 'قدم ذهبية', rarity: 'rare', kind: 'boost', color: '#fbbf24', effect: { shoot: 0.06 } },
  { id: 'boost-playmaker', name: 'صانع ألعاب', rarity: 'rare', kind: 'boost', color: '#f472b6', effect: { pass: 10 } },
  { id: 'boost-rocket', name: 'صاروخ', rarity: 'epic', kind: 'boost', color: '#a78bfa', effect: { shoot: 0.09 } },
  { id: 'boost-lightning', name: 'سرعة البرق', rarity: 'epic', kind: 'boost', color: '#e879f9', effect: { move: 4 } },
  { id: 'boost-wall', name: 'الجدار', rarity: 'epic', kind: 'boost', color: '#c084fc', effect: { tackle: 0.1 } },
  { id: 'boost-star', name: 'نجم الملعب', rarity: 'legendary', kind: 'boost', color: '#facc15', effect: { move: 3, shoot: 0.06, pass: 8 } },
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

/** بيحوّل id البطاقة لتأثيراتها بالمباراة. أي id غير معروف (أو مش بطاقة) بيرجّع بدون تأثير. */
export function boostFor(id: string | null | undefined): Boost {
  const item = ITEMS.find((i) => i.id === id && i.kind === 'boost');
  if (!item || !item.effect) return NO_BOOST;
  const e = item.effect;
  return { id: item.id, move: e.move ?? 0, pass: e.pass ?? 0, shoot: e.shoot ?? 0, tackle: e.tackle ?? 0, guard: e.guard ?? 0 };
}

export function boostName(id: string | null | undefined): string {
  return ITEMS.find((i) => i.id === id && i.kind === 'boost')?.name ?? 'بدون';
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

/** XP اللي بيربحها اللاعب بعد مباراة أونلاين: فوز 100، تعادل 50، خسارة 30، + 10 لكل هدف (حد أقصى 3). */
export function matchXp(myScore: number, oppScore: number): number {
  const base = myScore > oppScore ? 100 : myScore === oppScore ? 50 : 30;
  return base + Math.min(myScore, 3) * 10;
}

export function rollItem(rng: () => number = Math.random): Item {
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
  const pool = ITEMS.filter((i) => i.rarity === picked);
  return pool[Math.floor(rng() * pool.length) % pool.length];
}
