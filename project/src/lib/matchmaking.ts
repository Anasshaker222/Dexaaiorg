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
import {
  initialState,
  applyAction,
  finishByTime,
  DEFAULT_FORMATION,
  MATCH_DURATION_MS,
  TURN_TIME_MS,
  type MatchState,
  type Team,
  type Boost,
  type FormationId,
} from './tacticsEngine';
import { boostFor, type PlayerCard } from './progression';

export type Presence = Partial<Record<Team, { toMillis: () => number } | null>>;
export type FsTimestamp = { toMillis: () => number };

export type MatchDoc = {
  home: string;
  away: string;
  homeName: string;
  awayName: string;
  state: MatchState;
  rematch: { home: boolean; away: boolean };
  presence?: Presence;
  abandonedBy?: Team | null;
  startedAt?: FsTimestamp;
  turnStartedAt?: FsTimestamp;
  // بطاقات اللاعبين المجهّزة (لعرض الاسم/التفاصيل بس - المحرك نفسه بس بياخد الأرقام
  // عبر state.boosts، عشان يضل نقي وما يعرف شي عن نظام البطاقات).
  boostCards?: Record<Team, PlayerCard | null>;
};

// كل قد إيش (ms) بيبعث كل لاعب "نبضة" يخبر فيها إنه لسا موجود
const PRESENCE_INTERVAL_MS = 6000;
// إذا ما وصلت نبضة الخصم خلال هاد الوقت، بنعتبره منسحب/مقطوع تمامًا (تخلص المباراة)
const PRESENCE_TIMEOUT_MS = 18000;
// نفس الفكرة بس للاعب الواقف بالدور (طابور الانتظار)
const QUEUE_STALE_MS = 20000;
// هامش بسيط فوق TURN_TIME_MS عشان فرق التوقيت البسيط بين المتصفحين
const TURN_GRACE_MS = 2000;

function opponentOf(role: Team): Team {
  return role === 'home' ? 'away' : 'home';
}

// عشان نقدر نوقف النبضة والاستماع تبع البحث عن خصم لما المستخدم يلغي البحث
let activeSearch: { heartbeat: ReturnType<typeof setInterval>; unsub: () => void } | null = null;

function stopActiveSearch() {
  if (activeSearch) {
    clearInterval(activeSearch.heartbeat);
    activeSearch.unsub();
    activeSearch = null;
  }
}

/** بيدوّر على خصم بانتظار الدور، وإذا لقى وحده بينضم له، وإذا لأ بيصير هوي الواقف
 * بالدور وبيستنى لحد ما حدا ينضم إله. بيرجّع matchId وrole (home/away). */
export async function findOrCreateMatch(
  displayName: string,
  onWaiting: () => void,
  myBoostCard: PlayerCard | null = null,
  myFormation: FormationId = DEFAULT_FORMATION
): Promise<{ matchId: string; role: Team }> {
  if (!db) throw new Error('اللعب أونلاين غير مفعّل حاليًا');
  const firestore = db;
  const uid = await ensureSignedIn();
  if (!uid) throw new Error('تعذّر تسجيل الدخول');

  const queueRef = collection(firestore, 'tacticsQueue');
  const q = query(queueRef, where('status', '==', 'waiting'), limit(5));
  const snap = await getDocs(q);
  // بنتجاهل أي حدا واقف بالدور من زمان وما بعت نبضة أخيرة (يعني الأغلب سكّر الصفحة
  // وهو لسا واقف بالدور) عشان ما نتعلق بخصم مش موجود أصلاً
  const now = Date.now();
  const candidate = snap.docs.find((d) => {
    if (d.id === uid) return false;
    const data = d.data() as { lastSeen?: FsTimestamp; createdAt?: FsTimestamp };
    const seenAt = data.lastSeen?.toMillis?.() ?? data.createdAt?.toMillis?.() ?? 0;
    return now - seenAt < QUEUE_STALE_MS;
  });

  if (candidate) {
    const matchId = `m_${candidate.id}_${uid}_${Date.now()}`;
    const claimed = await runTransaction(firestore, async (tx) => {
      const freshCandidate = await tx.get(doc(firestore, 'tacticsQueue', candidate.id));
      if (!freshCandidate.exists() || freshCandidate.data().status !== 'waiting') return false;
      const matchRef = doc(firestore, 'tacticsMatches', matchId);
      const cd = freshCandidate.data();
      const formations: Record<Team, FormationId> = {
        home: (cd.formation as FormationId) || DEFAULT_FORMATION,
        away: myFormation,
      };
      const initial: MatchDoc = {
        home: candidate.id,
        away: uid,
        homeName: cd.name || 'لاعب',
        awayName: displayName || 'لاعب',
        state: initialState(
          'home',
          { home: boostFor(cd.boost as PlayerCard | null), away: boostFor(myBoostCard) },
          formations
        ),
        rematch: { home: false, away: false },
        boostCards: { home: (cd.boost as PlayerCard | null) ?? null, away: myBoostCard ?? null },
      };
      tx.set(matchRef, {
        ...initial,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        startedAt: serverTimestamp(),
        turnStartedAt: serverTimestamp(),
      });
      tx.update(doc(firestore, 'tacticsQueue', candidate.id), { status: 'matched', matchId });
      return true;
    });
    if (claimed) return { matchId, role: 'away' };
  }

  // ما لقينا خصم، صير أنت الواقف بالدور
  stopActiveSearch(); // احتياط: لو كان في بحث سابق ما انسكر منيح
  onWaiting();
  await setDoc(doc(firestore, 'tacticsQueue', uid), {
    name: displayName || 'لاعب',
    status: 'waiting',
    boost: myBoostCard,
    formation: myFormation,
    matchId: null,
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  });

  return new Promise((resolve, reject) => {
    const heartbeat = setInterval(() => {
      updateDoc(doc(firestore, 'tacticsQueue', uid), { lastSeen: serverTimestamp() }).catch(() => {});
    }, PRESENCE_INTERVAL_MS);
    const unsub = onSnapshot(
      doc(firestore, 'tacticsQueue', uid),
      (d) => {
        const data = d.data();
        if (data?.status === 'matched' && data.matchId) {
          stopActiveSearch();
          resolve({ matchId: data.matchId, role: 'home' });
        }
      },
      (err) => {
        stopActiveSearch();
        reject(err);
      }
    );
    activeSearch = { heartbeat, unsub };
  });
}

export async function cancelSearch() {
  stopActiveSearch();
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
  // كل حركة (حتى لو ما خلصت الدور) بتصفّر ساعة الدور، عشان يضل عند اللاعب وقت كافي
  // من آخر حركة أي حدا سواها.
  await updateDoc(doc(firestore, 'tacticsMatches', matchId), {
    state,
    updatedAt: serverTimestamp(),
    turnStartedAt: serverTimestamp(),
  });
}

export async function requestRematch(matchId: string, role: Team) {
  if (!db) return;
  const firestore = db;
  await updateDoc(doc(firestore, 'tacticsMatches', matchId), { [`rematch.${role}`]: true });
}

export async function resetMatch(
  matchId: string,
  kickoff: Team,
  boosts?: Record<Team, Boost>,
  formations?: Record<Team, FormationId>,
  boostCards?: Record<Team, PlayerCard | null>
) {
  if (!db) return;
  const firestore = db;
  await updateDoc(doc(firestore, 'tacticsMatches', matchId), {
    state: initialState(kickoff, boosts, formations),
    rematch: { home: false, away: false },
    abandonedBy: null,
    updatedAt: serverTimestamp(),
    startedAt: serverTimestamp(),
    turnStartedAt: serverTimestamp(),
    ...(boostCards ? { boostCards } : {}),
  });
}

/** بيبعت "نبضة حياة" لصاحب الدور بالمباراة، عشان الخصم يعرف إنك لسا موجود. */
export async function touchPresence(matchId: string, role: Team) {
  if (!db) return;
  await updateDoc(doc(db, 'tacticsMatches', matchId), {
    [`presence.${role}`]: serverTimestamp(),
  }).catch(() => {});
}

/** انسحاب صريح (رجوع للقائمة الرئيسية، أو إغلاق الصفحة): بتخلص المباراة فورًا
 * وتدي الفوز للخصم، عشان ما تضل معلّقة وما يضيع حق اللي كمّل. */
export async function leaveMatch(matchId: string, role: Team) {
  if (!db) return;
  const firestore = db;
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'tacticsMatches', matchId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as MatchDoc;
    if (data.state.status === 'finished') return; // خلصت أصلاً، ما في داعي نلمسها
    tx.update(ref, {
      state: { ...data.state, status: 'finished', winner: opponentOf(role) },
      abandonedBy: role,
      updatedAt: serverTimestamp(),
    });
  }).catch(() => {});
}

/** بيتفحّص إذا الخصم توقف عن إرسال نبضات لفترة أطول من المسموح، وإذا هيك
 * بيحسم المباراة لصالحي (فوز بالانسحاب) بترانزاكشن آمنة حتى ما تصير مرتين. */
export async function claimForfeitByTimeout(matchId: string, myRole: Team): Promise<boolean> {
  if (!db) return false;
  const firestore = db;
  const oppRole = opponentOf(myRole);
  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'tacticsMatches', matchId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as MatchDoc;
    if (data.state.status === 'finished') return false;
    const seenAt = data.presence?.[oppRole]?.toMillis?.() ?? 0;
    if (Date.now() - seenAt < PRESENCE_TIMEOUT_MS) return false; // لسا موجود، ما بنحسمها
    tx.update(ref, {
      state: { ...data.state, status: 'finished', winner: myRole },
      abandonedBy: oppRole,
      updatedAt: serverTimestamp(),
    });
    return true;
  }).catch(() => false);
}

/** لما وقت المباراة الكلي (MATCH_DURATION_MS) يخلص، أي طرف بيقدر يحسم النتيجة حسب
 * النتيجة الحالية بترانزاكشن آمنة حتى ما تصير مرتين. */
export async function claimFinishByTime(matchId: string): Promise<boolean> {
  if (!db) return false;
  const firestore = db;
  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'tacticsMatches', matchId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as MatchDoc;
    if (data.state.status === 'finished') return false;
    const startedAt = data.startedAt?.toMillis?.() ?? 0;
    if (Date.now() - startedAt < MATCH_DURATION_MS) return false; // لسا في وقت
    tx.update(ref, { state: finishByTime(data.state), updatedAt: serverTimestamp() });
    return true;
  }).catch(() => false);
}

/** لما دور اللاعب صاحب الكرة يعدّي بدون ما يلعب (TURN_TIME_MS)، أي طرف بيقدر يمرّر
 * الدور جبرًا للطرف التاني - بترانزاكشن آمنة حتى ما تصير مرتين. */
export async function claimStalledTurn(matchId: string, stalledTeam: Team): Promise<boolean> {
  if (!db) return false;
  const firestore = db;
  return runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'tacticsMatches', matchId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as MatchDoc;
    if (data.state.status !== 'playing' || data.state.turn !== stalledTeam) return false;
    const turnStartedAt = data.turnStartedAt?.toMillis?.() ?? 0;
    if (Date.now() - turnStartedAt < TURN_TIME_MS + TURN_GRACE_MS) return false; // لسا بوقته
    const next = applyAction(data.state, { type: 'endTurn' }, stalledTeam);
    if (next === data.state) return false;
    tx.update(ref, { state: next, updatedAt: serverTimestamp(), turnStartedAt: serverTimestamp() });
    return true;
  }).catch(() => false);
}
