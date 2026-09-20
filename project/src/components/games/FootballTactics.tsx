import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Swords, Users, Bot, Loader2, Trophy, RotateCcw, X, Crosshair, Footprints, Shield, Send, Hand } from 'lucide-react';
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
  NO_BOOST,
  PITCH_W,
  PITCH_H,
  GOAL_HALF,
  GOAL_DEPTH,
  R_PLAYER,
  type MatchState,
  type Team,
  type Point,
  type Action,
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
  type MatchDoc,
} from '../../lib/matchmaking';
import { recordResult, getMyRank, type PlayerRank, type MatchReward } from '../../lib/ranking';
import { ITEMS, boostFor, boostName } from '../../lib/progression';
import TacticsProfile from './TacticsProfile';

type Mode = 'menu' | 'local' | 'onlineSearch' | 'online';

// حدود الرسم (مع هامش للمرامي برا الملعب)
const VB = { x: -5, y: -3, w: PITCH_W + 10, h: PITCH_H + 6 };
const HIT_R = 5; // نصف قطر منطقة الضغط على لاعب

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function FootballTactics() {
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState('');
  const [state, setState] = useState<MatchState>(() => initialState());
  const [selected, setSelected] = useState<number | null>(null);
  const [passMode, setPassMode] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [myRank, setMyRank] = useState<PlayerRank | null>(null);
  const [reward, setReward] = useState<MatchReward | null>(null);

  // online-specific
  const [matchId, setMatchId] = useState<string | null>(null);
  const [role, setRole] = useState<Team>('home');
  const [oppName, setOppName] = useState('');
  const [abandonedBy, setAbandonedBy] = useState<Team | null>(null);
  const rematchLoggedRef = useRef(false);

  useEffect(() => {
    if (mode === 'menu' && firebaseEnabled) {
      getMyRank().then(setMyRank).catch(() => {});
    }
  }, [mode]);

  // AI turn (local mode only)
  useEffect(() => {
    if (mode !== 'local' || state.status !== 'playing' || state.turn !== 'away') return;
    const t = setTimeout(() => {
      const action = aiChooseAction(state, 'away');
      setState((s) => applyAction(s, action, 'away'));
      setSelected(null);
    }, 650);
    return () => clearTimeout(t);
  }, [mode, state]);

  // online sync
  useEffect(() => {
    if (mode !== 'online' || !matchId) return;
    const unsub = subscribeMatch(matchId, (m: MatchDoc | null) => {
      if (!m) return;
      setState(m.state);
      setOppName(role === 'home' ? m.awayName : m.homeName);
      setAbandonedBy(m.abandonedBy ?? null);
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
    rematchLoggedRef.current = false;
  }

  // بطاقة التعزيز المجهّزة (بس إذا كانت مفتوحة عند اللاعب فعلاً)
  function myBoostId(): string | null {
    const id = myRank?.equippedBoost ?? null;
    return id && myRank?.unlocked?.includes(id) ? id : null;
  }

  function startLocal() {
    setState(initialState('home', { home: boostFor(myBoostId()), away: NO_BOOST }));
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
      const { matchId: id, role: r } = await findOrCreateMatch(name.trim(), () => {}, myBoostId());
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
  const tacklePct = Math.round(tackleChance(state, myTeam) * 100);

  const passTargets = isMyTurn ? passableTeammates(state, myTeam) : [];
  const tackleList = isMyTurn ? tacklers(state, myTeam) : [];
  const canShoot = isMyTurn && inShootRange(state, myTeam);
  const shootPct = canShoot ? Math.round(shootChance(state, myTeam) * 100) : 0;
  const passActive = passMode && passTargets.length > 0;
  const selPos = selected !== null && isMyTurn ? state.positions[myTeam][selected] : null;

  const equippedItem = ITEMS.find((i) => i.id === myRank?.equipped);

  function act(action: Action) {
    const next = applyAction(state, action, myTeam);
    if (next === state) return;
    setState(next);
    if (mode === 'online' && matchId) pushMatchState(matchId, next);
    setPassMode(false);
    setHint('');
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

  return (
    <div className="flex flex-col items-center gap-4 w-full" dir="rtl">
      {mode === 'menu' && (
        <div className="w-full max-w-sm flex flex-col gap-4 py-4">
          <div className="text-center">
            <Swords className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <h3 className="font-display font-bold text-xl">تكتيكات الكورة</h3>
            <p className="text-gray-400 text-sm mt-1">لعبة أدوار: حرّك لاعبينك بحرية، مرّر، سدّد من بعيد، واستخلص الكرة</p>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك (يظهر للخصم)"
            className="glass rounded-xl px-4 py-2.5 text-sm outline-none border border-slate-700/50 focus:border-emerald-400/50"
            maxLength={16}
          />
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

          {(state.boosts?.home.id || state.boosts?.away.id) && (
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span>⚡ بطاقتك: {boostName(state.boosts?.[myTeam].id)}</span>
              <span>•</span>
              <span>بطاقة الخصم: {boostName(state.boosts?.[oppTeam].id)}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>الدور {state.round + 1} / 30</span>
            <span>•</span>
            <span className={isMyTurn ? 'text-emerald-400 font-bold' : ''}>{isMyTurn ? 'دورك الآن' : 'دور الخصم'}</span>
            <span>•</span>
            <span>نقاط الحركة: {state.ap}</span>
          </div>

          {/* الملعب */}
          <svg
            viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
            onClick={pitchClick}
            className={`w-full rounded-xl border border-emerald-500/20 select-none ${isMyTurn ? 'cursor-pointer' : ''}`}
            style={{ aspectRatio: `${VB.w} / ${VB.h}`, maxWidth: 560, direction: 'ltr', touchAction: 'manipulation' }}
          >
            <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="#052e1a" />
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x={i * 10} y={0} width={10} height={PITCH_H} fill={i % 2 ? '#14532d' : '#166534'} />
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
                    {isTackler && (
                      <circle r={R_PLAYER + 1.8} fill="none" stroke="#f87171" strokeWidth={0.6} strokeDasharray="1 1" />
                    )}
                    <circle r={R_PLAYER} fill={t === 'home' ? '#06b6d4' : '#f43f5e'} stroke={stroke} strokeWidth={strokeW} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={3.4}
                      fontWeight={700}
                      fill="#ffffff"
                      style={{ pointerEvents: 'none' }}
                    >
                      {i + 1}
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
                  <circle r={1.7} fill="#ffffff" stroke="#111827" strokeWidth={0.4} />
                </g>
              );
            })()}
          </svg>

          <p className="text-xs text-gray-400 min-h-4">{hint || state.lastEvent}</p>

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
                    onClick={() => resetMatch(matchId, role === 'home' ? 'away' : 'home', state.boosts)}
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
