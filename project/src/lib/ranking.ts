import { doc, getDoc, setDoc, updateDoc, runTransaction, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, ensureSignedIn } from './firebase';
import { DUPLICATE_XP, ITEMS, levelFromXp, matchXp, rollItem, type Item, type ItemKind } from './progression';

export type PlayerRank = {
  name: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  xp?: number;
  chests?: number;
  unlocked?: string[];
  equipped?: string | null; // الإطار الملوّن
  equippedBoost?: string | null; // بطاقة التعزيز
};

export type MatchReward = { xpGain: number; levelBefore: number; levelAfter: number; chestsGained: number };
export type ChestResult = { item: Item; duplicate: boolean; xpBonus: number };

const START_ELO = 1000;
const K = 32;

function expected(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** بيحدّث تصنيف ELO والـ XP والصناديق تبع اللاعب الحالي بس (كل لاعب بيحدّث سجله هوي فقط بعد
 * المباراة، حتى ما يحتاج المشروع أي سيرفر خلفي). */
export async function recordResult(
  myName: string,
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

  const result = myScore > oppScore ? 1 : myScore < oppScore ? 0 : 0.5;
  const newElo = Math.round(current.elo + K * (result - expected(current.elo, oppElo)));

  const xpBefore = current.xp ?? 0;
  const xpGain = matchXp(myScore, oppScore);
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
    equipped: current.equipped ?? null,
    equippedBoost: current.equippedBoost ?? null,
  });

  return { xpGain, levelBefore, levelAfter, chestsGained };
}

/** بيفتح صندوق واحد (بترانزاكشن عشان ما ينفتح مرتين بنفس اللحظة). */
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
    const item = rollItem();
    const unlocked = cur.unlocked ?? [];
    const duplicate = unlocked.includes(item.id);
    const xpBonus = duplicate ? DUPLICATE_XP : 0;
    tx.update(ref, {
      chests: chests - 1,
      unlocked: duplicate ? unlocked : [...unlocked, item.id],
      xp: (cur.xp ?? 0) + xpBonus,
    });
    return { item, duplicate, xpBonus };
  });
}

export async function equipItem(itemId: string | null, kind: ItemKind) {
  if (!db) return;
  const uid = await ensureSignedIn();
  if (!uid) return;
  if (itemId !== null && !ITEMS.some((i) => i.id === itemId && i.kind === kind)) return;
  await updateDoc(doc(db, 'tacticsPlayers', uid), { [kind === 'boost' ? 'equippedBoost' : 'equipped']: itemId });
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
