import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  deleteDoc,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { db, ensureSignedIn } from './firebase';
import { initialState, type MatchState, type Team, type Boost } from './tacticsEngine';
import { boostFor } from './progression';

export type MatchDoc = {
  home: string;
  away: string;
  homeName: string;
  awayName: string;
  state: MatchState;
  rematch: { home: boolean; away: boolean };
};

/** بيدوّر على خصم بانتظار الدور، وإذا لقى وحده بينضم له، وإذا لأ بيصير هوي الواقف
 * بالدور وبيستنى لحد ما حدا ينضم إله. بيرجّع matchId وrole (home/away). */
export async function findOrCreateMatch(
  displayName: string,
  onWaiting: () => void,
  myBoostId: string | null = null
): Promise<{ matchId: string; role: Team }> {
  if (!db) throw new Error('اللعب أونلاين غير مفعّل حاليًا');
  const firestore = db;
  const uid = await ensureSignedIn();
  if (!uid) throw new Error('تعذّر تسجيل الدخول');

  const queueRef = collection(firestore, 'tacticsQueue');
  const q = query(queueRef, where('status', '==', 'waiting'), limit(5));
  const snap = await getDocs(q);
  const candidate = snap.docs.find((d) => d.id !== uid);

  if (candidate) {
    const matchId = `m_${candidate.id}_${uid}_${Date.now()}`;
    const claimed = await runTransaction(firestore, async (tx) => {
      const freshCandidate = await tx.get(doc(firestore, 'tacticsQueue', candidate.id));
      if (!freshCandidate.exists() || freshCandidate.data().status !== 'waiting') return false;
      const matchRef = doc(firestore, 'tacticsMatches', matchId);
      const initial: MatchDoc = {
        home: candidate.id,
        away: uid,
        homeName: freshCandidate.data().name || 'لاعب',
        awayName: displayName || 'لاعب',
        state: initialState('home', {
          home: boostFor(freshCandidate.data().boost),
          away: boostFor(myBoostId),
        }),
        rematch: { home: false, away: false },
      };
      tx.set(matchRef, { ...initial, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      tx.update(doc(firestore, 'tacticsQueue', candidate.id), { status: 'matched', matchId });
      return true;
    });
    if (claimed) return { matchId, role: 'away' };
  }

  // ما لقينا خصم، صير أنت الواقف بالدور
  onWaiting();
  await setDoc(doc(firestore, 'tacticsQueue', uid), {
    name: displayName || 'لاعب',
    status: 'waiting',
    boost: myBoostId,
    matchId: null,
    createdAt: serverTimestamp(),
  });

  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(
      doc(firestore, 'tacticsQueue', uid),
      (d) => {
        const data = d.data();
        if (data?.status === 'matched' && data.matchId) {
          unsub();
          resolve({ matchId: data.matchId, role: 'home' });
        }
      },
      (err) => {
        unsub();
        reject(err);
      }
    );
  });
}

export async function cancelSearch() {
  if (!db) return;
  const firestore = db;
  const uid = await ensureSignedIn();
  if (!uid) return;
  await deleteDoc(doc(firestore, 'tacticsQueue', uid)).catch(() => {});
}

export function subscribeMatch(matchId: string, cb: (m: MatchDoc | null) => void) {
  if (!db) return () => {};
  const firestore = db;
  return onSnapshot(doc(firestore, 'tacticsMatches', matchId), (d) => {
    cb(d.exists() ? (d.data() as MatchDoc) : null);
  });
}

export async function pushMatchState(matchId: string, state: MatchState) {
  if (!db) return;
  const firestore = db;
  await updateDoc(doc(firestore, 'tacticsMatches', matchId), { state, updatedAt: serverTimestamp() });
}

export async function requestRematch(matchId: string, role: Team) {
  if (!db) return;
  const firestore = db;
  await updateDoc(doc(firestore, 'tacticsMatches', matchId), { [`rematch.${role}`]: true });
}

export async function resetMatch(matchId: string, kickoff: Team, boosts?: Record<Team, Boost>) {
  if (!db) return;
  const firestore = db;
  await updateDoc(doc(firestore, 'tacticsMatches', matchId), {
    state: initialState(kickoff, boosts),
    rematch: { home: false, away: false },
    updatedAt: serverTimestamp(),
  });
}
