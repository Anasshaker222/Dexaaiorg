import { useEffect, useRef, useState } from 'react';
import { Swords, Users, Bot, Loader2, Trophy, RotateCcw, X, Crosshair, Footprints, Shield } from 'lucide-react';
import {
  applyAction,
  initialState,
  validMoveCells,
  passableTeammates,
  adjacentEnemies,
  inShootRange,
  COLS,
  ROWS,
  type MatchState,
  type Team,
  type Action,
  aiChooseAction,
} from '../../lib/tacticsEngine';
import { firebaseEnabled } from '../../lib/firebase';
import { findOrCreateMatch, cancelSearch, subscribeMatch, pushMatchState, resetMatch, type MatchDoc } from '../../lib/matchmaking';
import { recordResult, getMyRank, type PlayerRank, type MatchReward } from '../../lib/ranking';
import { ITEMS } from '../../lib/progression';
import TacticsProfile from './TacticsProfile';

type Mode = 'menu' | 'local' | 'onlineSearch' | 'online';

export default function FootballTactics() {
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState('');
  const [state, setState] = useState<MatchState>(() => initialState());
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [myRank, setMyRank] = useState<PlayerRank | null>(null);
  const [reward, setReward] = useState<MatchReward | null>(null);

  // online-specific
  const [matchId, setMatchId] = useState<string | null>(null);
  const [role, setRole] = useState<Team>('home');
  const [oppName, setOppName] = useState('');
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
    }, 550);
    return () => clearTimeout(t);
  }, [mode, state]);

  // online sync
  useEffect(() => {
    if (mode !== 'online' || !matchId) return;
    const unsub = subscribeMatch(matchId, (m: MatchDoc | null) => {
      if (!m) return;
      setState(m.state);
      setOppName(role === 'home' ? m.awayName : m.homeName);
    });
    return unsub;
  }, [mode, matchId, role]);

  // record ranking once a match finishes (online only)
  useEffect(() => {
    if (mode !== 'online' || state.status !== 'finished' || rematchLoggedRef.current) return;
    rematchLoggedRef.current = true;
    const my = state.score[role];
    const opp = state.score[role === 'home' ? 'away' : 'home'];
    recordResult(name || 'لاعب', my, opp, 1000)
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
    }
  }, [state.status]);

  function refreshRank() {
    getMyRank().then(setMyRank).catch(() => {});
  }

  function backToMenu() {
    setMode('menu');
    setMatchId(null);
    setSelected(null);
    setState(initialState());
    rematchLoggedRef.current = false;
  }

  function startLocal() {
    setState(initialState());
    setSelected(null);
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
      const { matchId: id, role: r } = await findOrCreateMatch(name.trim(), () => {});
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

  function act(action: Action, team: Team) {
    setState((s) => {
      const next = applyAction(s, action, team);
      if (mode === 'online' && matchId) pushMatchState(matchId, next);
      return next;
    });
    setSelected(null);
  }

  const myTeam: Team = mode === 'online' ? role : 'home';
  const equippedItem = ITEMS.find((i) => i.id === myRank?.equipped);
  const ringStyle = equippedItem ? { boxShadow: `inset 0 0 0 2px ${equippedItem.color}` } : undefined;
  const isMyTurn = state.status === 'playing' && state.turn === myTeam && (mode === 'local' ? myTeam === 'home' : true);
  const carrier = state.positions[state.ballOwner][state.ballIndex];

  const moveTargets = selected !== null && isMyTurn ? validMoveCells(state, myTeam, selected) : [];
  const canPassSelected = selected === state.ballIndex && state.ballOwner === myTeam;
  const passTargets = canPassSelected && isMyTurn ? passableTeammates(state, myTeam) : [];
  const tackleTargets = isMyTurn && state.ballOwner !== myTeam ? adjacentEnemies(state, myTeam) : [];
  const canShoot = isMyTurn && state.ballOwner === myTeam && inShootRange(myTeam, carrier) && selected === state.ballIndex;

  function cellClick(r: number, c: number) {
    if (!isMyTurn) return;
    // clicking own player selects it
    const ownIdx = state.positions[myTeam].findIndex((p) => p.r === r && p.c === c);
    if (ownIdx !== -1) {
      setSelected(ownIdx);
      return;
    }
    if (selected !== null) {
      const target = moveTargets.find((m) => m.r === r && m.c === c);
      if (target) act({ type: 'move', playerIndex: selected, to: target }, myTeam);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full" dir="rtl">
      {mode === 'menu' && (
        <div className="w-full max-w-sm flex flex-col gap-4 py-4">
          <div className="text-center">
            <Swords className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <h3 className="font-display font-bold text-xl">تكتيكات الكورة</h3>
            <p className="text-gray-400 text-sm mt-1">لعبة أدوار: حرّك، مرّر، سدّد، واستخلص الكرة</p>
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

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>الدور {state.round + 1} / 30</span>
            <span>•</span>
            <span className={isMyTurn ? 'text-emerald-400 font-bold' : ''}>{isMyTurn ? 'دورك الآن' : 'دور الخصم'}</span>
            <span>•</span>
            <span>نقاط الحركة: {state.ap}</span>
          </div>

          <div
            className="grid gap-[2px] bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, width: '100%', maxWidth: 440 }}
          >
            {Array.from({ length: ROWS }).map((_, r) =>
              Array.from({ length: COLS }).map((_, c) => {
                const homeIdx = state.positions.home.findIndex((p) => p.r === r && p.c === c);
                const awayIdx = state.positions.away.findIndex((p) => p.r === r && p.c === c);
                const isBall =
                  (state.ballOwner === 'home' && homeIdx === state.ballIndex) ||
                  (state.ballOwner === 'away' && awayIdx === state.ballIndex);
                const isGoalCol = c === 0 || c === COLS - 1;
                const isGoalCell = isGoalCol && [2, 3, 4].includes(r);
                const isMoveTarget = moveTargets.some((m) => m.r === r && m.c === c);
                const isSelected = selected !== null && state.positions[myTeam][selected]?.r === r && state.positions[myTeam][selected]?.c === c;
                const passIdx = state.positions[myTeam].findIndex((p, i) => passTargets.includes(i) && p.r === r && p.c === c);
                const tackleIdx = state.positions[myTeam === 'home' ? 'away' : 'home'].findIndex(
                  (p, i) => tackleTargets.includes(i) && p.r === r && p.c === c
                );

                let content = null;
                if (homeIdx !== -1) content = <div style={myTeam === 'home' ? ringStyle : undefined} className="w-full h-full rounded-full bg-cyan-500 flex items-center justify-center text-[9px] font-bold text-white">{homeIdx + 1}</div>;
                if (awayIdx !== -1) content = <div style={myTeam === 'away' ? ringStyle : undefined} className="w-full h-full rounded-full bg-rose-500 flex items-center justify-center text-[9px] font-bold text-white">{awayIdx + 1}</div>;

                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => {
                      if (passIdx !== -1 && canPassSelected && isMyTurn) act({ type: 'pass', toPlayerIndex: passIdx }, myTeam);
                      else if (tackleIdx !== -1 && isMyTurn) act({ type: 'tackle', playerIndex: tackleIdx }, myTeam);
                      else cellClick(r, c);
                    }}
                    className={`relative aspect-square flex items-center justify-center rounded-[3px] ${
                      isGoalCell ? 'bg-yellow-500/10' : 'bg-emerald-900/40'
                    } ${isSelected ? 'ring-2 ring-white' : ''} ${isMoveTarget ? 'ring-2 ring-cyan-300/70' : ''} ${
                      passIdx !== -1 ? 'ring-2 ring-yellow-300' : ''
                    } ${tackleIdx !== -1 ? 'ring-2 ring-red-400' : ''}`}
                  >
                    {content}
                    {isBall && <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">⚽</span>}
                  </button>
                );
              })
            )}
          </div>

          <p className="text-xs text-gray-400 h-4">{state.lastEvent}</p>

          {isMyTurn && state.status === 'playing' && (
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {canShoot && (
                <button onClick={() => act({ type: 'shoot' }, myTeam)} className="glass rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1 border border-yellow-400/40 text-yellow-300">
                  <Crosshair className="w-3.5 h-3.5" /> تسديد
                </button>
              )}
              <button onClick={() => act({ type: 'endTurn' }, myTeam)} className="glass rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1 border border-slate-600">
                <Footprints className="w-3.5 h-3.5" /> إنهاء الدور
              </button>
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <Shield className="w-3 h-3" /> دوس لاعبك، بعدين دوس خانة فاضية للحركة، لاعب أصفر للتمرير، أو خصم أحمر للاستخلاص
              </span>
            </div>
          )}

          {state.status === 'finished' && (
            <div className="glass rounded-xl border border-slate-700/50 p-5 flex flex-col items-center gap-3 mt-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <p className="font-display font-bold">
                {state.winner === 'draw'
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
                {mode === 'online' && matchId && (
                  <button
                    onClick={() => resetMatch(matchId, role === 'home' ? 'away' : 'home')}
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
