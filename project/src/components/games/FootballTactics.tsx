import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Swords, Users, Bot, Loader2, Trophy, RotateCcw, X, Crosshair, Footprints, Shield, Send, Hand, Volume2, VolumeX } from 'lucide-react';
import {
  applyAction,
  initialState,
  isValidMove,
  passableTeammates,
  tacklers,
  inShootRange,
  shootChance,
  tackleChance,
  moveRadius,
  aiChooseAction,
  finishByTime,
  passChance,
  goalCenter,
  DIFFICULTY_LABELS,
  type Difficulty,
  type PlayEvent,
  NO_BOOST,
  PITCH_W,
  PITCH_H,
  GOAL_HALF,
  GOAL_DEPTH,
  R_PLAYER,
  MATCH_DURATION_MS,
  TURN_TIME_MS,
  FORMATION_IDS,
  FORMATION_LABELS,
  DEFAULT_FORMATION,
  type MatchState,
  type Team,
  type Point,
  type Action,
  type FormationId,
} from '../../lib/tacticsEngine';
import { firebaseEnabled } from '../../lib/firebase';
import {
  findOrCreateMatch,
  cancelSearch,
  subscribeMatch,
  pushMatchState,
  resetMatch,
  leaveMatch,
  touchPresence,
  claimForfeitByTimeout,
  claimFinishByTime,
  claimStalledTurn,
  type MatchDoc,
} from '../../lib/matchmaking';
import { recordResult, getMyRank, type PlayerRank, type MatchReward } from '../../lib/ranking';
import { RING_ITEMS, boostFor, type PlayerCard } from '../../lib/progression';
import TacticsProfile from './TacticsProfile';

type Mode = 'menu' | 'local' | 'onlineSearch' | 'online';

// حدود الرسم (مع هامش للمرامي برا الملعب)
const VB = { x: -5, y: -3, w: PITCH_W + 10, h: PITCH_H + 6 };
const HIT_R = 5; // نصف قطر منطقة الضغط على لاعب

import { lazy, Suspense } from 'react';
const Pitch3D = lazy(() => import('./Pitch3D'));

// مؤثرات صوتية بسيطة مولّدة بالمتصفح (بدون ملفات صوت خارجية)
let audioCtx: AudioContext | null = null;
function tone(freq: number, dur: number, delay = 0, type: OscillatorType = 'sine', vol = 0.07) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur);
  } catch {
    /* الصوت اختياري */
  }
}

function playSfx(kind: PlayEvent['kind'], mine: boolean) {
  if (kind === 'goal') (mine ? [523, 659, 784, 1047] : [392, 330, 262]).forEach((f, i) => tone(f, 0.25, i * 0.12, 'triangle', 0.09));
  else if (kind === 'miss') tone(180, 0.3, 0, 'sawtooth', 0.05);
  else if (kind === 'pass') tone(440, 0.08, 0, 'triangle');
  else if (kind === 'intercept') tone(220, 0.2, 0, 'square', 0.05);
  else if (kind === 'tackleWin') tone(330, 0.15, 0, 'square', 0.05);
  else tone(150, 0.12, 0, 'square', 0.04);
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function FootballTactics() {
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState('');
  const [formationChoice, setFormationChoice] = useState<FormationId>(DEFAULT_FORMATION);
  const [state, setState] = useState<MatchState>(() => initialState());
  const [selected, setSelected] = useState<number | null>(null);
  const [passMode, setPassMode] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [myRank, setMyRank] = useState<PlayerRank | null>(null);
  const [reward, setReward] = useState<MatchReward | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [muted, setMuted] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [hover, setHover] = useState<Point | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [banner, setBanner] = useState<{ text: string; goal: boolean } | null>(null);

  // online-specific
  const [matchId, setMatchId] = useState<string | null>(null);
  const [role, setRole] = useState<Team>('home');
  const [oppName, setOppName] = useState('');
  const [abandonedBy, setAbandonedBy] = useState<Team | null>(null);
  const rematchLoggedRef = useRef(false);

  // توقيت المباراة (مدة كلية) والدور (لكل حركة) - محلي للعرض ولإنهاء الدور/المباراة تلقائيًا
  // بوضع اللعب المحلي. بوضع الأونلاين القيم جايّة من فايرستور (startedAt/turnStartedAt).
  const [boostCards, setBoostCards] = useState<Record<Team, PlayerCard | null> | null>(null);
  const [matchStartedAt, setMatchStartedAt] = useState<number | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (mode === 'menu' && firebaseEnabled) {
      getMyRank().then(setMyRank).catch(() => {});
    }
  }, [mode]);

  // ساعة تيك كل ثانية طول ما في مباراة شغالة، عشان نحسب الوقت المتبقي للعرض والمنطق
  useEffect(() => {
    if ((mode !== 'local' && mode !== 'online') || state.status !== 'playing') return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode, state.status]);

  // AI turn (local mode only)
  useEffect(() => {
    if (mode !== 'local' || state.status !== 'playing' || state.turn !== 'away') return;
    const t = setTimeout(() => {
      const action = aiChooseAction(state, 'away', difficulty);
      setState((s) => applyAction(s, action, 'away'));
      setSelected(null);
      setTurnStartedAt(Date.now());
    }, 650);
    return () => clearTimeout(t);
  }, [mode, state, difficulty]);

  // وضع محلي: إنهاء الدور تلقائيًا لو خلص وقت الدور، وإنهاء المباراة تلقائيًا لو خلص وقتها الكلي
  useEffect(() => {
    if (mode !== 'local' || state.status !== 'playing') return;
    if (matchStartedAt !== null && nowTick - matchStartedAt >= MATCH_DURATION_MS) {
      setState((s) => finishByTime(s));
      return;
    }
    if (state.turn === 'home' && turnStartedAt !== null && nowTick - turnStartedAt >= TURN_TIME_MS) {
      setState((s) => applyAction(s, { type: 'endTurn' }, 'home'));
      setSelected(null);
      setTurnStartedAt(Date.now());
    }
  }, [mode, state.status, state.turn, nowTick, matchStartedAt, turnStartedAt]);

  // online sync
  useEffect(() => {
    if (mode !== 'online' || !matchId) return;
    const unsub = subscribeMatch(matchId, (m: MatchDoc | null) => {
      if (!m) return;
      setState(m.state);
      setOppName(role === 'home' ? m.awayName : m.homeName);
      setAbandonedBy(m.abandonedBy ?? null);
      setBoostCards(m.boostCards ?? null);
      setMatchStartedAt(m.startedAt?.toMillis?.() ?? null);
      setTurnStartedAt(m.turnStartedAt?.toMillis?.() ?? null);
    });
    return unsub;
  }, [mode, matchId, role]);

  // نبضة حياة دورية طول ما إحنا داخل مباراة أونلاين، عشان الخصم يعرف إننا لسا موجودين
  useEffect(() => {
    if (mode !== 'online' || !matchId || state.status !== 'playing') return;
    touchPresence(matchId, role);
    const t = setInterval(() => touchPresence(matchId, role), 6000);
    return () => clearInterval(t);
  }, [mode, matchId, role, state.status]);

  // مراقبة نبضة الخصم: إذا انقطعت لفترة طويلة منحسم المباراة فوز بالانسحاب
  useEffect(() => {
    if (mode !== 'online' || !matchId || state.status !== 'playing') return;
    const t = setInterval(() => {
      claimForfeitByTimeout(matchId, role).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [mode, matchId, role, state.status]);

  // مراقبة وقت المباراة الكلي أونلاين: لو خلص، أي طرف بيحسم النتيجة حسب الموجود بالنتيجة
  useEffect(() => {
    if (mode !== 'online' || !matchId || state.status !== 'playing') return;
    const t = setInterval(() => {
      claimFinishByTime(matchId).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [mode, matchId, state.status]);

  // مراقبة وقت الدور أونلاين: لو صاحب الدور ما لعب خلال TURN_TIME_MS، أي طرف بيقدر يمرّر
  // الدور جبرًا للطرف التاني (عدالة أكبر من انتظار انسحاب كامل).
  useEffect(() => {
    if (mode !== 'online' || !matchId || state.status !== 'playing') return;
    const t = setInterval(() => {
      claimStalledTurn(matchId, state.turn).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [mode, matchId, state.status, state.turn]);

  // انسحاب صريح: لو المستخدم سكّر التبويب أو غادر الصفحة ومباراته لسا شغالة
  useEffect(() => {
    if (mode !== 'online' || !matchId) return;
    const onLeave = () => {
      leaveMatch(matchId, role);
    };
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [mode, matchId, role]);

  // record ranking once a match finishes (online only)
  useEffect(() => {
    if (mode !== 'online' || state.status !== 'finished' || rematchLoggedRef.current) return;
    rematchLoggedRef.current = true;
    const my = state.score[role];
    const opp = state.score[role === 'home' ? 'away' : 'home'];
    // نتيجة المباراة الفعلية (فوز بالانسحاب بيضل فوز كامل، حتى لو النتيجة وقتها كانت متعادلة)
    const result = state.winner === 'draw' ? 0.5 : state.winner === role ? 1 : 0;
    recordResult(name || 'لاعب', result, my, opp, 1000)
      .then((r) => {
        setReward(r);
        return getMyRank().then(setMyRank);
      })
      .catch(() => {});
  }, [mode, state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // لما تبدأ مباراة جديدة (مثلاً "مباراة ثانية بنفس الخصم") لازم نسمح بتسجيل نتيجتها من جديد
  useEffect(() => {
    if (state.status === 'playing') {
      rematchLoggedRef.current = false;
      setReward(null);
      setAbandonedBy(null);
    }
  }, [state.status]);

  function refreshRank() {
    getMyRank().then(setMyRank).catch(() => {});
  }

  function backToMenu() {
    // إذا كانت المباراة لسا شغالة وطلعنا منها، لازم نبلّغ الخصم حتى ما تضل معلّقة عنده
    if (mode === 'online' && matchId && state.status === 'playing') {
      leaveMatch(matchId, role);
    }
    setMode('menu');
    setMatchId(null);
    setSelected(null);
    setPassMode(false);
    setState(initialState());
    setAbandonedBy(null);
    setBoostCards(null);
    setMatchStartedAt(null);
    setTurnStartedAt(null);
    rematchLoggedRef.current = false;
  }

  // بطاقة اللاعب المجهّزة (بس إذا كانت مفتوحة عند اللاعب فعلاً)
  function myBoostCard(): PlayerCard | null {
    const id = myRank?.equippedBoost ?? null;
    if (!id) return null;
    return myRank?.unlockedBoosts?.find((c) => c.id === id) ?? null;
  }

  function startLocal() {
    const boosts = { home: boostFor(myBoostCard()), away: NO_BOOST };
    const formations = { home: formationChoice, away: DEFAULT_FORMATION };
    setState(initialState('home', boosts, formations));
    setBoostCards({ home: myBoostCard(), away: null });
    const t = Date.now();
    setMatchStartedAt(t);
    setTurnStartedAt(t);
    setSelected(null);
    setPassMode(false);
    setHint('');
    setMode('local');
    rematchLoggedRef.current = false;
  }

  async function startOnline() {
    setError('');
    if (!firebaseEnabled) {
      setError('اللعب الأونلاين مش مفعّل لسا على هاد الموقع.');
      return;
    }
    setMode('onlineSearch');
    try {
      const { matchId: id, role: r } = await findOrCreateMatch(name.trim(), () => {}, myBoostCard(), formationChoice);
      setMatchId(id);
      setRole(r);
      setMode('online');
      rematchLoggedRef.current = false;
    } catch (e) {
      console.error('[matchmaking]', e);
      const code = (e as { code?: string })?.code;
      setError(`صار خطأ بالبحث عن خصم${code ? ` (${code})` : ''}، جرّب كمان مرة.`);
      setMode('menu');
    }
  }

  async function cancelOnlineSearch() {
    await cancelSearch();
    setMode('menu');
  }

  const myTeam: Team = mode === 'online' ? role : 'home';
  const oppTeam: Team = myTeam === 'home' ? 'away' : 'home';
  // اللاعب اللي بيلعب كـ away بيشوف الملعب مقلوب، عشان فريقه دايمًا يهاجم باتجاه اليمين
  const flip = mode === 'online' && role === 'away';
  const toView = (p: Point): Point => (flip ? { x: PITCH_W - p.x, y: PITCH_H - p.y } : p);

  const isMyTurn = state.status === 'playing' && state.turn === myTeam && (mode === 'local' ? myTeam === 'home' : true);
  const carrierPos = state.positions[state.ballOwner][state.ballIndex];
  const myMoveRadius = moveRadius(state, myTeam);

  const passTargets = isMyTurn ? passableTeammates(state, myTeam) : [];
  const tackleList = isMyTurn ? tacklers(state, myTeam) : [];
  const tacklePct = Math.round(tackleChance(state, myTeam, selected !== null && tackleList.includes(selected) ? selected : tackleList[0]) * 100);
  const canShoot = isMyTurn && inShootRange(state, myTeam);
  const shootPct = canShoot ? Math.round(shootChance(state, myTeam) * 100) : 0;
  const passActive = passMode && passTargets.length > 0;
  const selPos = selected !== null && isMyTurn ? state.positions[myTeam][selected] : null;

  const equippedItem = RING_ITEMS.find((i) => i.id === myRank?.equipped);

  // سجل آخر الأحداث (بيتصفّر مع كل مباراة جديدة)
  useEffect(() => {
    if (state.round === 0 && state.lastEvent === 'انطلاق المباراة') {
      setLog([]);
      return;
    }
    setLog((l) => (l[0] === state.lastEvent ? l : [state.lastEvent, ...l].slice(0, 4)));
  }, [state.lastEvent, state.round, state.ap]);

  // مؤثرات كل حدث جديد: صوت + إشعار قصير
  const playId = state.play?.id ?? 0;
  useEffect(() => {
    const p = state.play;
    if (!p) {
      setBanner(null);
      return;
    }
    const mine = p.team === myTeam;
    if (!muted) playSfx(p.kind, mine);
    const text =
      p.kind === 'goal' ? (mine ? '⚽ هدف! 🎉' : '⚽ هدف للخصم')
      : p.kind === 'intercept' ? (mine ? '✋ تمريرتك انقطعت' : '🛡️ قطعت تمريرة الخصم')
      : p.kind === 'miss' ? (mine ? '🥅 التسديدة ضاعت' : '🧤 الخصم ضيّع التسديدة')
      : p.kind === 'tackleWin' ? (mine ? '💪 استخلاص ناجح' : '😬 الخصم سرق الكرة')
      : null;
    if (!text) return;
    setBanner({ text, goal: p.kind === 'goal' });
    const t = setTimeout(() => setBanner(null), 1800);
    return () => clearTimeout(t);
  }, [playId]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchRemainingMs = matchStartedAt !== null ? Math.max(0, MATCH_DURATION_MS - (nowTick - matchStartedAt)) : MATCH_DURATION_MS;
  const turnRemainingMs = turnStartedAt !== null ? Math.max(0, TURN_TIME_MS - (nowTick - turnStartedAt)) : TURN_TIME_MS;

  function act(action: Action) {
    const next = applyAction(state, action, myTeam);
    if (next === state) return;
    setState(next);
    if (mode === 'online' && matchId) pushMatchState(matchId, next);
    else if (mode === 'local') setTurnStartedAt(Date.now());
    setPassMode(false);
    setHint('');
    setHover(null);
    // بعد الحركة بنخلي اللاعب محدّد عشان تقدر تحركه مرة ثانية، إلا إذا خلص الدور
    if (action.type !== 'move' || next.turn !== myTeam || next.status === 'finished') setSelected(null);
  }

  function doTackle() {
    if (tackleList.length === 0) return;
    let idx = selected !== null && tackleList.includes(selected) ? selected : -1;
    if (idx === -1) {
      const enemy = state.positions[oppTeam][state.ballIndex];
      idx = tackleList.reduce((a, b) =>
        dist(state.positions[myTeam][a], enemy) < dist(state.positions[myTeam][b], enemy) ? a : b
      );
    }
    act({ type: 'tackle', playerIndex: idx });
  }

  // معاينة الوجهة: بتتحرك مع المؤشر/الإصبع وبتلوّن أخضر لو الحركة صالحة وأحمر لو لأ
  function pitchMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!isMyTurn || selected === null || state.ap <= 0 || passActive) {
      if (hover) setHover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(toView({ x: VB.x + ((e.clientX - rect.left) / rect.width) * VB.w, y: VB.y + ((e.clientY - rect.top) / rect.height) * VB.h }));
  }

  function pitchClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (!isMyTurn) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = VB.x + ((e.clientX - rect.left) / rect.width) * VB.w;
    const vy = VB.y + ((e.clientY - rect.top) / rect.height) * VB.h;
    const p = toView({ x: vx, y: vy }); // القلب هو معكوس نفسه
    const mine = state.positions[myTeam];
    setHint('');

    if (passActive) {
      const target = passTargets.find((i) => dist(mine[i], p) <= HIT_R);
      if (target !== undefined) act({ type: 'pass', toPlayerIndex: target });
      return;
    }

    // اختيار لاعب من فريقك (بياخد الأقرب لمكان الضغط)
    let own = -1;
    let best = HIT_R;
    mine.forEach((pt, i) => {
      const d = dist(pt, p);
      if (d <= best) {
        best = d;
        own = i;
      }
    });
    if (own !== -1) {
      setSelected(own === selected ? null : own);
      return;
    }

    if (selected === null) {
      setHint('دوس على لاعبك أول');
      return;
    }
    const from = mine[selected];
    if (state.ap <= 0) return;
    if (dist(from, p) > myMoveRadius) {
      setHint('بعيد كتير، دوس جوا الدايرة');
      return;
    }
    const to = { x: clamp(p.x, 0, PITCH_W), y: clamp(p.y, 0, PITCH_H) };
    if (!isValidMove(state, myTeam, selected, to)) {
      setHint('مكان غير صالح، قريب كتير من لاعب ثاني');
      return;
    }
    act({ type: 'move', playerIndex: selected, to });
  }

  // اختصارات لوحة المفاتيح: S تسديد، P تمرير، T استخلاص، E إنهاء الدور، Esc إلغاء التحديد
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || !isMyTurn) return;
      const k = e.key.toLowerCase();
      if (k === 's' && canShoot) act({ type: 'shoot' });
      else if (k === 'p' && passTargets.length > 0) setPassMode((v) => !v);
      else if (k === 't') doTackle();
      else if (k === 'e') act({ type: 'endTurn' });
      else if (k === 'escape') {
        setSelected(null);
        setPassMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col items-center gap-4 w-full" dir="rtl">
      {mode === 'menu' && (
        <div className="w-full max-w-sm flex flex-col gap-4 py-4">
          <div className="text-center">
            <Swords className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <h3 className="font-display font-bold text-xl">تكتيكات الكورة</h3>
            <p className="text-gray-400 text-sm mt-1">11 ضد 11: حرّك لاعبينك بحرية، مرّر، سدّد من بعيد، واستخلص الكرة</p>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك (يظهر للخصم)"
            className="glass rounded-xl px-4 py-2.5 text-sm outline-none border border-slate-700/50 focus:border-emerald-400/50"
            maxLength={16}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 px-1">التشكيلة</label>
            <select
              value={formationChoice}
              onChange={(e) => setFormationChoice(e.target.value as FormationId)}
              className="glass rounded-xl px-4 py-2.5 text-sm outline-none border border-slate-700/50 focus:border-emerald-400/50 bg-transparent"
            >
              {FORMATION_IDS.map((f) => (
                <option key={f} value={f} className="bg-slate-900">
                  {FORMATION_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 px-1">مستوى الذكاء الاصطناعي</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`glass rounded-xl py-2 text-sm border ${
                    difficulty === d ? 'border-cyan-400 text-cyan-300 bg-cyan-400/10' : 'border-slate-700/50 text-gray-400'
                  }`}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          {myRank && (
            <div className="text-xs text-gray-400 text-center">
              تصنيفك الحالي: <span className="text-emerald-400 font-bold">{myRank.elo}</span> — {myRank.wins} فوز / {myRank.losses} خسارة / {myRank.draws} تعادل
            </div>
          )}
          {firebaseEnabled && <TacticsProfile rank={myRank} onRefresh={refreshRank} />}
          <button
            onClick={startLocal}
            className="glass card-hover rounded-xl px-4 py-3 flex items-center justify-center gap-2 border border-slate-700/50 font-semibold"
          >
            <Bot className="w-5 h-5 text-cyan-400" /> لعب تدريبي ضد الذكاء الاصطناعي
          </button>
          <button
            onClick={startOnline}
            className="glass card-hover rounded-xl px-4 py-3 flex items-center justify-center gap-2 border border-emerald-400/40 font-semibold neon-border-accent"
          >
            <Users className="w-5 h-5 text-emerald-400" /> لعب أونلاين ضد لاعب حقيقي
          </button>
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          {!firebaseEnabled && (
            <p className="text-gray-500 text-xs text-center">اللعب الأونلاين والرانكنغ بيحتاجوا ربط الموقع بحساب Firebase مجاني.</p>
          )}
        </div>
      )}

      {mode === 'onlineSearch' && (
        <div className="py-16 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-gray-300">جاري البحث عن خصم...</p>
          <button onClick={cancelOnlineSearch} className="text-sm text-gray-500 underline">
            إلغاء
          </button>
        </div>
      )}

      {(mode === 'local' || mode === 'online') && (
        <div className="w-full flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full max-w-md text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400" />
              <span className="font-semibold">{mode === 'online' && role === 'away' ? oppName || 'الخصم' : name || 'أنت'}</span>
            </div>
            <div className="font-display font-bold text-lg">
              {state.score.home} - {state.score.away}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{mode === 'online' && role === 'home' ? oppName || 'الخصم' : mode === 'local' ? 'الذكاء الاصطناعي' : name || 'أنت'}</span>
              <span className="w-3 h-3 rounded-full bg-rose-400" />
            </div>
          </div>

          {(boostCards?.home || boostCards?.away) && (
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span>⚡ بطاقتك: {boostCards?.[myTeam]?.name ?? 'بدون'}</span>
              <span>•</span>
              <span>بطاقة الخصم: {boostCards?.[oppTeam]?.name ?? 'بدون'}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap justify-center">
            <span>⏱ {formatClock(matchRemainingMs)}</span>
            <button onClick={() => setMuted((m) => !m)} aria-label="الصوت" className="text-gray-400 hover:text-white">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setView3d((v) => !v)} className={`text-xs px-2 py-0.5 rounded-md border ${view3d ? "border-cyan-400 text-cyan-300" : "border-slate-600 text-gray-400"}`}>3D</button>
            <span title="الطقس">{state.weather === 'wet' ? '🌧️' : state.weather === 'damp' ? '🌦️' : '☀️'}</span>
            <span title="حماس الجمهور" className="w-14 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <span className="block h-full bg-yellow-400 transition-all" style={{ width: `${state.crowd ?? 20}%` }} />
            </span>
            <span>•</span>
            <span className={isMyTurn ? 'text-emerald-400 font-bold' : ''}>{isMyTurn ? 'دورك الآن' : 'دور الخصم'}</span>
            <span>•</span>
            <span>نقاط الحركة: {state.ap}</span>
            {state.status === 'playing' && (
              <>
                <span>•</span>
                <span className={turnRemainingMs <= 5000 ? 'text-red-400 font-bold' : ''}>
                  ⏳ {Math.ceil(turnRemainingMs / 1000)}ث {isMyTurn ? 'لدورك' : 'للخصم'}
                </span>
              </>
            )}
          </div>

          {/* الملعب */}
          {view3d && (
            <Suspense fallback={<div className="text-xs text-gray-400">جاري تحميل الملعب ثلاثي الأبعاد…</div>}>
              <Pitch3D state={state} myTeam={myTeam} />
            </Suspense>
          )}
          <svg
            viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
            onClick={pitchClick}
            onPointerMove={pitchMove}
            onPointerLeave={() => setHover(null)}
            className={`w-full rounded-xl border border-emerald-500/20 select-none ${isMyTurn ? 'cursor-pointer' : ''}`}
            style={{ aspectRatio: `${VB.w} / ${VB.h}`, maxWidth: 560, direction: 'ltr', touchAction: 'manipulation' }}
          >
            <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="#052e1a" />
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x={i * (PITCH_W / 10)} y={0} width={PITCH_W / 10} height={PITCH_H} fill={i % 2 ? '#14532d' : '#166534'} />
            ))}

            {/* خطوط الملعب */}
            <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.5}>
              <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
              <line x1={PITCH_W / 2} y1={0} x2={PITCH_W / 2} y2={PITCH_H} />
              <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={9} />
              <rect x={0} y={PITCH_H / 2 - 20} width={16} height={40} />
              <rect x={PITCH_W - 16} y={PITCH_H / 2 - 20} width={16} height={40} />
            </g>
            <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={0.9} fill="rgba(255,255,255,0.6)" />
            <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.5}>
              <rect x={0} y={PITCH_H / 2 - 10} width={6} height={20} />
              <rect x={PITCH_W - 6} y={PITCH_H / 2 - 10} width={6} height={20} />
              <path d={`M 16 ${PITCH_H / 2 - 7.5} A 9 9 0 0 1 16 ${PITCH_H / 2 + 7.5}`} />
              <path d={`M ${PITCH_W - 16} ${PITCH_H / 2 - 7.5} A 9 9 0 0 0 ${PITCH_W - 16} ${PITCH_H / 2 + 7.5}`} />
              <path d={`M 0 2 A 2 2 0 0 0 2 0 M ${PITCH_W - 2} 0 A 2 2 0 0 0 ${PITCH_W} 2 M 2 ${PITCH_H} A 2 2 0 0 0 0 ${PITCH_H - 2} M ${PITCH_W} ${PITCH_H - 2} A 2 2 0 0 0 ${PITCH_W - 2} ${PITCH_H}`} />
            </g>
            <circle cx={11} cy={PITCH_H / 2} r={0.6} fill="rgba(255,255,255,0.6)" />
            <circle cx={PITCH_W - 11} cy={PITCH_H / 2} r={0.6} fill="rgba(255,255,255,0.6)" />

            {/* المرامي ومنطقة التسجيل */}
            <g fill="rgba(250,204,21,0.25)" stroke="#facc15" strokeWidth={0.5}>
              <rect x={-3} y={PITCH_H / 2 - GOAL_HALF} width={3} height={GOAL_HALF * 2} />
              <rect x={PITCH_W} y={PITCH_H / 2 - GOAL_HALF} width={3} height={GOAL_HALF * 2} />
            </g>
            <g fill="rgba(250,204,21,0.12)">
              <rect x={0} y={PITCH_H / 2 - GOAL_HALF} width={GOAL_DEPTH} height={GOAL_HALF * 2} />
              <rect x={PITCH_W - GOAL_DEPTH} y={PITCH_H / 2 - GOAL_HALF} width={GOAL_DEPTH} height={GOAL_HALF * 2} />
            </g>

            {/* دايرة الحركة للاعب المحدّد */}
            {selPos && state.ap > 0 && !passActive && (() => {
              const v = toView(selPos);
              return (
                <circle
                  cx={v.x}
                  cy={v.y}
                  r={myMoveRadius}
                  fill="rgba(34,211,238,0.10)"
                  stroke="rgba(103,232,249,0.65)"
                  strokeWidth={0.4}
                  strokeDasharray="1.5 1.5"
                  pointerEvents="none"
                />
              );
            })()}

            {/* معاينة الحركة وخط التسديد */}
            {hover && selPos && state.ap > 0 && !passActive && (() => {
              const to = { x: clamp(hover.x, 0, PITCH_W), y: clamp(hover.y, 0, PITCH_H) };
              const ok = dist(selPos, to) <= myMoveRadius && isValidMove(state, myTeam, selected ?? 0, to);
              const a = toView(selPos);
              const b = toView(to);
              const c = ok ? '#4ade80' : '#f87171';
              return (
                <g pointerEvents="none">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeOpacity={0.6} strokeWidth={0.4} strokeDasharray="1 1" />
                  <circle cx={b.x} cy={b.y} r={R_PLAYER} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={0.4} />
                </g>
              );
            })()}
            {canShoot && !passActive && (() => {
              const a = toView(carrierPos);
              const g = toView(goalCenter(myTeam));
              return <line x1={a.x} y1={a.y} x2={g.x} y2={g.y} stroke="#facc15" strokeOpacity={0.25} strokeWidth={0.4} strokeDasharray="2 1.5" pointerEvents="none" />;
            })()}

            {/* خطوط التمرير المتاحة */}
            {passActive &&
              passTargets.map((i) => {
                const a = toView(carrierPos);
                const b = toView(state.positions[myTeam][i]);
                return (
                  <line key={`pl-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fde047" strokeOpacity={0.35} strokeWidth={0.4} strokeDasharray="1.2 1.2" pointerEvents="none" />
                );
              })}

            {/* اللاعبين */}
            {(['home', 'away'] as Team[]).flatMap((t) =>
              state.positions[t].map((p, i) => {
                const v = toView(p);
                const mine = t === myTeam;
                const isSel = mine && selected === i;
                const isPassTarget = mine && passActive && passTargets.includes(i);
                const isTackler = mine && tackleList.includes(i) && !passActive;
                const stroke = isSel ? '#ffffff' : mine && equippedItem ? equippedItem.color : 'rgba(255,255,255,0.35)';
                const strokeW = isSel ? 1.1 : mine && equippedItem ? 1.2 : 0.5;
                return (
                  <g
                    key={`${t}-${i}`}
                    style={{ transform: `translate(${v.x}px, ${v.y}px)`, transition: 'transform 350ms ease' }}
                  >
                    {isPassTarget && <circle r={R_PLAYER + 1.8} fill="none" stroke="#fde047" strokeWidth={0.7} />}
                    {isPassTarget && (
                      <text y={-R_PLAYER - 2.6} textAnchor="middle" fontSize={2.8} fontWeight={700} fill="#fde047" style={{ pointerEvents: 'none' }}>
                        {Math.round(passChance(state, myTeam, i) * 100)}%
                      </text>
                    )}
                    {isTackler && (
                      <circle r={R_PLAYER + 1.8} fill="none" stroke="#f87171" strokeWidth={0.6} strokeDasharray="1 1" />
                    )}
                    <ellipse cy={R_PLAYER * 0.9} rx={R_PLAYER} ry={R_PLAYER * 0.4} fill="rgba(0,0,0,0.3)" />
                    {state.ballOwner === t && state.ballIndex === i && (
                      <circle r={R_PLAYER + 1} fill="none" stroke="#fde047" strokeOpacity={0.6} strokeWidth={0.5} />
                    )}
                    <circle r={R_PLAYER} fill={i === 0 ? (t === 'home' ? '#0e7490' : '#9f1239') : t === 'home' ? '#06b6d4' : '#f43f5e'} stroke={stroke} strokeWidth={strokeW} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={3}
                      fontWeight={700}
                      fill="#ffffff"
                      style={{ pointerEvents: 'none' }}
                    >
                      {i === 0 ? 'ح' : i + 1}
                    </text>
                  </g>
                );
              })
            )}

            {/* الكرة */}
            {(() => {
              const bv = toView(carrierPos);
              const bx = bv.x + (state.ballOwner === myTeam ? 3.8 : -3.8);
              return (
                <g style={{ transform: `translate(${bx}px, ${bv.y + 1.4}px)`, transition: 'transform 350ms ease' }}>
                  <circle r={1.5} fill="#ffffff" stroke="#111827" strokeWidth={0.4} />
                </g>
              );
            })()}
          </svg>

          <section aria-label="دليل اللعب" className="w-full max-w-[560px] rounded-xl border border-emerald-400/15 bg-slate-950/45 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-emerald-300">طريقة اللعب</span>
              <span className="text-[10px] text-gray-500">{state.ballOwner === myTeam ? 'استحوذ على الكرة وتقدّم نحو المرمى' : 'اقترب من حامل الكرة وحاول استخلاصها'}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
              <div><span className="block text-[11px] font-semibold text-cyan-300">١ · تحرّك</span><span className="text-[10px] text-gray-400">اختر لاعبًا ثم اضغط المكان المطلوب</span></div>
              <div><span className="block text-[11px] font-semibold text-yellow-300">٢ · مرّر</span><span className="text-[10px] text-gray-400">اضغط تمرير ثم اختر زميلًا مضيئًا</span></div>
              <div><span className="block text-[11px] font-semibold text-rose-300">٣ · استخلص</span><span className="text-[10px] text-gray-400">اختر لاعبًا محاطًا بالأحمر ثم اضغط استخلاص</span></div>
              <div><span className="block text-[11px] font-semibold text-amber-200">٤ · سدّد</span><span className="text-[10px] text-gray-400">سدّد عندما تظهر فرصة التسديد</span></div>
            </div>
            <p className="mt-2 border-t border-white/5 pt-2 text-center text-[10px] text-gray-500" dir="ltr">
              اختصارات لوحة المفاتيح: S تسديد · P تمرير · T استخلاص · E إنهاء الدور · Esc إلغاء التحديد
            </p>
          </section>

          {banner ? (
            <p
              className={`animate-scale-in font-display font-bold px-4 py-1.5 rounded-full text-sm ${
                banner.goal ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40' : 'glass text-white'
              }`}
            >
              {banner.text}
            </p>
          ) : (
            <p className="text-xs text-gray-400 min-h-4">{hint || state.lastEvent}</p>
          )}
          {log.length > 1 && (
            <ul className="text-[11px] text-gray-600 text-center leading-relaxed">
              {log.slice(1).map((e, i) => (
                <li key={i} style={{ opacity: 1 - i * 0.3 }}>{e}</li>
              ))}
            </ul>
          )}

          {isMyTurn && state.status === 'playing' && (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {canShoot && (
                  <button
                    onClick={() => act({ type: 'shoot' })}
                    className="glass rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1 border border-yellow-400/40 text-yellow-300"
                  >
                    <Crosshair className="w-3.5 h-3.5" /> تسديد ({shootPct}%)
                  </button>
                )}
                {passTargets.length > 0 && (
                  <button
                    onClick={() => setPassMode((v) => !v)}
                    className={`glass rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1 border ${
                      passActive ? 'border-yellow-300 text-yellow-200 bg-yellow-400/10' : 'border-slate-600'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" /> تمرير
                  </button>
                )}
                {tackleList.length > 0 && (
                  <button
                    onClick={doTackle}
                    className="glass rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1 border border-red-400/40 text-red-300"
                  >
                    <Hand className="w-3.5 h-3.5" /> استخلاص ({tacklePct}%)
                  </button>
                )}
                <button
                  onClick={() => act({ type: 'endTurn' })}
                  className="glass rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1 border border-slate-600"
                >
                  <Footprints className="w-3.5 h-3.5" /> إنهاء الدور
                </button>
              </div>
              <span className="text-[11px] text-gray-500 flex items-center gap-1 text-center">
                <Shield className="w-3 h-3 shrink-0" />
                {passActive
                  ? 'دوس على زميلك اللي محوّط بأصفر عشان تمرّر له'
                  : 'دوس لاعبك، بعدين دوس أي مكان جوا الدايرة لتحرّكه. للتسجيل: سدّد أو ادخل بالكرة لمنطقة المرمى'}
              </span>
            </div>
          )}

          {state.status === 'finished' && (
            <div className="glass rounded-xl border border-slate-700/50 p-5 flex flex-col items-center gap-3 mt-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <p className="font-display font-bold">
                {mode === 'online' && abandonedBy === oppTeam
                  ? 'الخصم انسحب من المباراة، فزت افتراضيًا! 🎉'
                  : state.winner === 'draw'
                  ? 'تعادل!'
                  : state.winner === myTeam
                  ? 'فزت بالمباراة! 🎉'
                  : 'خسرت هالمرة، حظ أوفر'}
              </p>
              {state.stats &&
                (() => {
                  const a = state.stats[myTeam];
                  const b = state.stats[oppTeam];
                  const pt = (a.poss ?? 0) + (b.poss ?? 0);
                  const pa = pt ? Math.round(((a.poss ?? 0) / pt) * 100) : 50;
                  const rows: [string, string, string][] = [
                    [`${a.passesOk}/${a.passes}`, 'تمريرات ناجحة', `${b.passesOk}/${b.passes}`],
                    [`${pa}%`, 'استحواذ', `${100 - pa}%`],
                    [`${a.shots}`, 'تسديدات', `${b.shots}`],
                    [`${a.tacklesWon}/${a.tackles}`, 'استخلاصات', `${b.tacklesWon}/${b.tackles}`],
                  ];
                  return (
                    <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs text-center w-full">
                      {rows.map(([x, l, y]) => (
                        <div key={l} className="contents">
                          <span className="text-emerald-300 font-bold">{x}</span>
                          <span className="text-gray-400">{l}</span>
                          <span className="text-gray-300 font-bold">{y}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              {mode === 'online' && reward && (
                <div className="text-center text-xs text-gray-300 flex flex-col gap-1">
                  <span className="text-emerald-400 font-bold">+{reward.xpGain} XP</span>
                  {reward.levelAfter > reward.levelBefore && (
                    <span className="text-yellow-300 font-bold">ارتفع مستواك إلى {reward.levelAfter}! 🎉</span>
                  )}
                  {reward.chestsGained > 0 && (
                    <span className="text-purple-300">
                      🎁 ربحت {reward.chestsGained} {reward.chestsGained === 1 ? 'صندوق' : 'صناديق'} — افتحهم من القائمة الرئيسية
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                {mode === 'local' && (
                  <button onClick={startLocal} className="glass card-hover rounded-lg px-4 py-2 text-sm flex items-center gap-1 border border-slate-700/50">
                    <RotateCcw className="w-4 h-4" /> إعادة اللعب
                  </button>
                )}
                {mode === 'online' && matchId && !abandonedBy && (
                  <button
                    onClick={() =>
                      resetMatch(
                        matchId,
                        role === 'home' ? 'away' : 'home',
                        state.boosts,
                        state.formations,
                        boostCards ?? undefined
                      )
                    }
                    className="glass card-hover rounded-lg px-4 py-2 text-sm flex items-center gap-1 border border-slate-700/50"
                  >
                    <RotateCcw className="w-4 h-4" /> مباراة ثانية بنفس الخصم
                  </button>
                )}
                <button onClick={backToMenu} className="glass card-hover rounded-lg px-4 py-2 text-sm flex items-center gap-1 border border-slate-700/50">
                  <X className="w-4 h-4" /> القائمة الرئيسية
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
