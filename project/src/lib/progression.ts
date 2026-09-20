// نظام المستويات والصناديق - منطق نقي (بدون Firebase) عشان يكون سهل الاختبار.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type Item = { id: string; name: string; rarity: Rarity; color: string };

export const RARITY_META: Record<Rarity, { label: string; text: string; border: string; weight: number }> = {
  common: { label: 'عادي', text: 'text-gray-300', border: 'border-gray-500/50', weight: 70 },
  rare: { label: 'نادر', text: 'text-sky-400', border: 'border-sky-400/50', weight: 22 },
  epic: { label: 'ملحمي', text: 'text-purple-400', border: 'border-purple-400/50', weight: 7 },
  legendary: { label: 'أسطوري', text: 'text-yellow-400', border: 'border-yellow-400/60', weight: 1 },
};

/** إطارات ملوّنة بتظهر حوالين لاعبينك بالملعب. */
export const ITEMS: Item[] = [
  { id: 'ring-white', name: 'إطار أبيض', rarity: 'common', color: '#f8fafc' },
  { id: 'ring-lime', name: 'إطار ليموني', rarity: 'common', color: '#a3e635' },
  { id: 'ring-orange', name: 'إطار برتقالي', rarity: 'common', color: '#fb923c' },
  { id: 'ring-teal', name: 'إطار تركوازي', rarity: 'common', color: '#2dd4bf' },
  { id: 'ring-sky', name: 'إطار سماوي', rarity: 'rare', color: '#38bdf8' },
  { id: 'ring-pink', name: 'إطار وردي', rarity: 'rare', color: '#f472b6' },
  { id: 'ring-amber', name: 'إطار كهرماني', rarity: 'rare', color: '#fbbf24' },
  { id: 'ring-violet', name: 'إطار بنفسجي', rarity: 'epic', color: '#a78bfa' },
  { id: 'ring-fuchsia', name: 'إطار فوشيا', rarity: 'epic', color: '#e879f9' },
  { id: 'ring-gold', name: 'إطار ذهبي', rarity: 'legendary', color: '#facc15' },
  { id: 'ring-diamond', name: 'إطار ماسي', rarity: 'legendary', color: '#67e8f9' },
];

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
