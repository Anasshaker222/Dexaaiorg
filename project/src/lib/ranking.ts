import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, ensureSignedIn } from './firebase';

export type PlayerRank = { name: string; elo: number; wins: number; losses: number; draws: number };

const START_ELO = 1000;
const K = 32;

function expected(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** بيحدّث تصنيف ELO تبع اللاعب الحالي بس (كل لاعب بيحدّث سجله هوي فقط بعد المباراة،
 * حتى ما يحتاج المشروع أي سيرفر خلفي). */
export async function recordResult(myName: string, myScore: number, oppScore: number, oppElo: number) {
  if (!db) return;
  const uid = await ensureSignedIn();
  if (!uid) return;
  const ref = doc(db, 'tacticsPlayers', uid);
  const snap = await getDoc(ref);
  const current: PlayerRank = snap.exists()
    ? (snap.data() as PlayerRank)
    : { name: myName, elo: START_ELO, wins: 0, losses: 0, draws: 0 };

  const result = myScore > oppScore ? 1 : myScore < oppScore ? 0 : 0.5;
  const newElo = Math.round(current.elo + K * (result - expected(current.elo, oppElo)));

  await setDoc(ref, {
    name: myName,
    elo: newElo,
    wins: current.wins + (result === 1 ? 1 : 0),
    losses: current.losses + (result === 0 ? 1 : 0),
    draws: current.draws + (result === 0.5 ? 1 : 0),
  });
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
