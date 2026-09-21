import { doc, getDoc, setDoc, updateDoc, runTransaction, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, ensureSignedIn } from './firebase';
import {
  DUPLICATE_XP,
  RING_ITEMS,
  levelFromXp,
  matchXp,
  rollItem,
  rollPlayerCard,
  type Item,
  type ItemKind,
  type PlayerCard,
} from './progression';

export type MatchOutcome = 1 | 0.5 | 0;

export type PlayerRank = {
  name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  xp?: number;
  chests?: number;
  unlocked?: string[]; // معرّفات الإطارات المفتوحة (كتالوج ثابت)
  unlockedBoosts?: PlayerCard[]; // بطاقات اللاعبين المفتوحة (عشوائية، كل وحدة كاملة بحالها)
  equipped?: string | null; // الإطار الملوّن
  equippedBoost?: string | null; // معرّف بطاقة اللاعب المجهّزة (من unlockedBoosts)
};

export type MatchReward = { xpGain: number; levelBefore: number; levelAfter: number; chestsGained: number };
export type ChestResult =
  | { kind: 'ring'; item: Item; duplicate: boolean; xpBonus: number }
  | { kind: 'boost'; card: PlayerCard; duplicate: boolean; xpBonus: number };

const START_ELO = 1000;
const K = 32;

function expected(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** بيحدّث تصنيف ELO والـ XP والصناديق تبع اللاعب الحالي بس (كل لاعب بيحدّث سجله هوي فقط بعد
 * المباراة، حتى ما يحتاج المشروع أي سيرفر خلفي).
 * لازم "result" ياخد نتيجة المباراة الفعلية (من state.winner)، مش يتحسب من النتيجة وبس،
 * عشان بحالة الفوز بالانسحاب (الخصم طلع من اللعبة) يضل الفوز فوز حتى لو كانت النتيجة
 * وقتها متعادلة أو حتى خسارة على أرض الملعب. */
export async function recordResult(
  myName: string,
  result: MatchOutcome,
  myScore: number,
  oppScore: number,
  oppElo: number
): Promise<MatchReward | null> {
  if (!db) return null;
  const uid = await ensureSignedIn();
  if (!uid) return null;
  const ref = doc(db, 'tacticsPlayers', uid);
  const snap = await getDoc(ref);
  const current: PlayerRank = snap.exists()
    ? (snap.data() as PlayerRank)
    : { name: myName, elo: START_ELO, wins: 0, losses: 0, draws: 0 };

  const newElo = Math.round(current.elo + K * (result - expected(current.elo, oppElo)));

  const xpBefore = current.xp ?? 0;
  const xpGain = matchXp(result, myScore);
  const xpAfter = xpBefore + xpGain;
  const levelBefore = levelFromXp(xpBefore);
  const levelAfter = levelFromXp(xpAfter);
  // صندوق لكل فوز + صندوق لكل مستوى جديد
  const chestsGained = (result === 1 ? 1 : 0) + (levelAfter - levelBefore);

  await setDoc(ref, {
    name: myName,
    elo: newElo,
    wins: current.wins + (result === 1 ? 1 : 0),
    losses: current.losses + (result === 0 ? 1 : 0),
    draws: current.draws + (result === 0.5 ? 1 : 0),
    xp: xpAfter,
    chests: (current.chests ?? 0) + chestsGained,
    unlocked: current.unlocked ?? [],
    unlockedBoosts: current.unlockedBoosts ?? [],
    equipped: current.equipped ?? null,
    equippedBoost: current.equippedBoost ?? null,
  });

  return { xpGain, levelBefore, levelAfter, chestsGained };
}

/** بيفتح صندوق واحد: نص الوقت بيطلع إطار من الكتالوج الثابت، والنص التاني بيطلع بطاقة
 * لاعب جديدة بالكامل (اسم عشوائي + قدرة وقيمة عشوائية). بترانزاكشن عشان ما ينفتح مرتين
 * بنفس اللحظة. */
export async function openChest(): Promise<ChestResult | null> {
  if (!db) return null;
  const firestore = db;
  const uid = await ensureSignedIn();
  if (!uid) return null;
  const ref = doc(firestore, 'tacticsPlayers', uid);
  return runTransaction(firestore, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const cur = snap.data() as PlayerRank;
    const chests = cur.chests ?? 0;
    if (chests <= 0) return null;

    if (Math.random() < 0.5) {
      const item = rollItem(RING_ITEMS);
      const unlocked = cur.unlocked ?? [];
      const duplicate = unlocked.includes(item.id);
      const xpBonus = duplicate ? DUPLICATE_XP : 0;
      tx.update(ref, {
        chests: chests - 1,
        unlocked: duplicate ? unlocked : [...unlocked, item.id],
        xp: (cur.xp ?? 0) + xpBonus,
      });
      return { kind: 'ring', item, duplicate, xpBonus };
    }

    const card = rollPlayerCard();
    const unlockedBoosts = cur.unlockedBoosts ?? [];
    // مكرّر هون معناها نفس اسم اللاعب موجود عندك أصلاً (القيم والقدرة ممكن تختلف
    // لأنها عشوائية كل مرة، فمش منطقي نقارن بالمعرّف الفريد).
    const duplicate = unlockedBoosts.some((c) => c.name === card.name);
    const xpBonus = duplicate ? DUPLICATE_XP : 0;
    tx.update(ref, {
      chests: chests - 1,
      unlockedBoosts: duplicate ? unlockedBoosts : [...unlockedBoosts, card],
      xp: (cur.xp ?? 0) + xpBonus,
    });
    return { kind: 'boost', card, duplicate, xpBonus };
  });
}

export async function equipItem(itemId: string | null, kind: ItemKind) {
  if (!db) return;
  const uid = await ensureSignedIn();
  if (!uid) return;
  if (kind === 'ring') {
    if (itemId !== null && !RING_ITEMS.some((i) => i.id === itemId)) return;
    await updateDoc(doc(db, 'tacticsPlayers', uid), { equipped: itemId });
    return;
  }
  // kind === 'boost': لازم البطاقة تكون فعلاً من بطاقات اللاعب المفتوحة
  if (itemId !== null) {
    const snap = await getDoc(doc(db, 'tacticsPlayers', uid));
    const owned = (snap.data() as PlayerRank | undefined)?.unlockedBoosts ?? [];
    if (!owned.some((c) => c.id === itemId)) return;
  }
  await updateDoc(doc(db, 'tacticsPlayers', uid), { equippedBoost: itemId });
}

export async function getMyRank(): Promise<PlayerRank | null> {
  if (!db) return null;
  const uid = await ensureSignedIn();
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'tacticsPlayers', uid));
  return snap.exists() ? (snap.data() as PlayerRank) : null;
}

export async function getTopPlayers(n = 10): Promise<PlayerRank[]> {
  if (!db) return [];
  const q = query(collection(db, 'tacticsPlayers'), orderBy('elo', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as PlayerRank);
}
