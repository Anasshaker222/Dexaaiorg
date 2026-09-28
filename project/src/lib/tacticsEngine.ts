// محرك لعبة "تكتيكات الكورة" - منطق نقي (Pure) مشترك بين وضع اللعب أمام الذكاء
// الاصطناعي محليًا، ووضع اللعب أونلاين (نفس الدالة بتشتغل، بس بحالة الأونلاين
// كل لاعب بيبعث حركته وبتنكتب الحالة الجديدة بفايرستور).
//
// الملعب هلأ بإحداثيات حرّة (x, y) بدل المربعات. الفريق home بيهاجم باتجاه x = PITCH_W
// (المرمى اليمين)، والفريق away بيهاجم باتجاه x = 0 (المرمى اليسار).

export const PITCH_W = 150;
export const PITCH_H = 96;
export const GOAL_HALF = 12; // نص عرض المرمى
export const GOAL_DEPTH = 4; // لو الكرة دخلت هالمسافة من خط المرمى (وبين القائمين) بيتحسب هدف
export const R_PLAYER = 2.6; // نصف قطر اللاعب (للرسم فقط)
export const MOVE_RADIUS = 18; // أقصى مسافة بيتحركها لاعب بحركة وحدة
export const MIN_SEP = 6; // أقل مسافة مسموحة بين لاعبين
export const TACKLE_RANGE = 10; // أقصى مسافة للاستخلاص
export const PASS_RANGE = 60; // أقصى مسافة للتمرير
export const MAX_SHOOT_DIST = 100; // أقصى مسافة للتسديد عن مركز المرمى
export const AP_PER_TURN = 2;
export const MAX_GOALS = 2; // أول فريق يوصل هدفين بيكسب فورًا
export const TEAM_SIZE = 11; // 11 ضد 11
export const AUTO_STEP = 4; // أقصى مسافة بيتحركها اللاعب الغير متحكم فيه تلقائيًا بكل حركة

// وقت المباراة الكلي ووقت كل دور - بيتحكم فيهم المكوّن (مش المحرك نفسه، لأنه المحرك نقي
// وما بيعرف الوقت الحقيقي)، بس القيم مركزية هون حتى تنقرا بمكان وحد.
export const MATCH_DURATION_MS = 8 * 60 * 1000; // مدة المباراة: 8 دقائق. لو خلص الوقت، الفوز للي قدام بالنتيجة
export const TURN_TIME_MS = 20 * 1000; // كل ما توصلك الكرة أو يصير دورك، عندك 20 ثانية تلعب فيها، وإلا بتروح الكرة للطرف التاني

export type Team = 'home' | 'away';
export type Point = { x: number; y: number };
export type FormationId = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';

export const FORMATION_IDS: FormationId[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];
export const FORMATION_LABELS: Record<FormationId, string> = {
  '4-4-2': '4-4-2 — متوازنة',
  '4-3-3': '4-3-3 — هجومية',
  '3-5-2': '3-5-2 — تحكم بالوسط',
  '4-2-3-1': '4-2-3-1 — دفاع منظم',
};
export const DEFAULT_FORMATION: FormationId = '4-4-2';

/** بطاقة تعزيز بتأثر على اللعب لفريق واحد (بتيجي من الصناديق). القيم كلها إضافات صغيرة. */
export type Boost = {
  id: string | null;
  move: number; // + على مدى الحركة
  pass: number; // + على مدى التمرير
  shoot: number; // + على احتمال نجاح التسديد (0.05 = 5%)
  tackle: number; // + على احتمال نجاح استخلاصك
  guard: number; // - على احتمال نجاح استخلاص الخصم عليك
};

export const NO_BOOST: Boost = { id: null, move: 0, pass: 0, shoot: 0, tackle: 0, guard: 0 };

import { TUNING, type Weather } from './tacticsConfig';

export type TeamStats = { passes: number; passesOk: number; shots: number; goals: number; tackles: number; tacklesWon: number; poss: number };
export type PlayEvent = { id: number; kind: 'goal' | 'miss' | 'pass' | 'intercept' | 'tackleWin' | 'tackleFail'; team: Team };
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'سهل', normal: 'عادي', hard: 'صعب' };

const EMPTY_STATS: TeamStats = { passes: 0, passesOk: 0, shots: 0, goals: 0, tackles: 0, tacklesWon: 0, poss: 0 };

export type MatchState = {
  positions: Record<Team, Point[]>; // 11 لاعب بكل فريق
  ballOwner: Team;
  ballIndex: number; // مين حامل الكرة (index بمصفوفة positions)
  turn: Team;
  ap: number; // نقاط الحركة المتبقية بهاد الدور
  score: Record<Team, number>;
  round: number; // إجمالي عدد الأدوار اللي مرت (للعرض بس، مش شرط انتهاء)
  status: 'playing' | 'finished';
  winner: Team | 'draw' | null;
  lastEvent: string;
  boosts?: Record<Team, Boost>; // اختياري: المباريات القديمة ما فيها بطاقات
  formations?: Record<Team, FormationId>; // اختياري: المباريات القديمة كانت بتشكيلة وحيدة ثابتة
  stats?: Record<Team, TeamStats>; // إحصائيات المباراة (اختياري للتوافق مع المباريات القديمة)
  play?: PlayEvent; // آخر حدث (للمؤثرات الصوتية والإشعارات بالواجهة) - id بيزيد مع كل حدث
  rng?: number; // حالة المولّد العشوائي الحتمي (نفس البذرة + نفس الأفعال = نفس النتيجة)
  weather?: Weather; // حالة الطقس/الملعب (بتأثر على دقة التمرير)
  crowd?: number; // حماس الجمهور 0-100
};

/** مولّد أرقام عشوائية حتمي (mulberry32) بيخزّن حالته داخل حالة المباراة. */
function rnd(s: MatchState): number {
  let t = ((s.rng ?? Math.random() * 4294967296) + 0x6d2b79f5) >>> 0;
  s.rng = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type Action =
  | { type: 'move'; playerIndex: number; to: Point }
  | { type: 'pass'; toPlayerIndex: number }
  | { type: 'shoot' }
  | { type: 'tackle'; playerIndex: number }
  | { type: 'endTurn' };

// ---------- هندسة ----------

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function opp(t: Team): Team {
  return t === 'home' ? 'away' : 'home';
}

/** مركز المرمى اللي بيهاجمه الفريق. */
export function goalCenter(team: Team): Point {
  return { x: team === 'home' ? PITCH_W : 0, y: PITCH_H / 2 };
}

function inGoalMouth(team: Team, p: Point): boolean {
  const onLine = team === 'home' ? p.x >= PITCH_W - GOAL_DEPTH : p.x <= GOAL_DEPTH;
  return onLine && Math.abs(p.y - PITCH_H / 2) <= GOAL_HALF;
}

// ---------- الحالة الابتدائية ----------

// ---------- الحالة الابتدائية ----------

// كل تشكيلة عبارة عن 11 نقطة: حارس مرمى + المدافعين + الوسط + المهاجمين، بإحداثيات نص
// ملعب "home" (بيهاجم يمين). الفريق away بياخد نفس التشكيلة بالمرآة.
const FORMATIONS: Record<FormationId, Point[]> = {
  '4-4-2': [
    { x: 8, y: 48 },
    { x: 24, y: 14 }, { x: 24, y: 36 }, { x: 24, y: 60 }, { x: 24, y: 82 },
    { x: 55, y: 14 }, { x: 55, y: 36 }, { x: 55, y: 60 }, { x: 55, y: 82 },
    { x: 72, y: 34 }, { x: 72, y: 62 },
  ],
  '4-3-3': [
    { x: 8, y: 48 },
    { x: 24, y: 14 }, { x: 24, y: 36 }, { x: 24, y: 60 }, { x: 24, y: 82 },
    { x: 52, y: 24 }, { x: 52, y: 48 }, { x: 52, y: 72 },
    { x: 74, y: 16 }, { x: 74, y: 48 }, { x: 74, y: 80 },
  ],
  '3-5-2': [
    { x: 8, y: 48 },
    { x: 22, y: 24 }, { x: 22, y: 48 }, { x: 22, y: 72 },
    { x: 50, y: 10 }, { x: 50, y: 29 }, { x: 50, y: 48 }, { x: 50, y: 67 }, { x: 50, y: 86 },
    { x: 72, y: 34 }, { x: 72, y: 62 },
  ],
  '4-2-3-1': [
    { x: 8, y: 48 },
    { x: 24, y: 14 }, { x: 24, y: 36 }, { x: 24, y: 60 }, { x: 24, y: 82 },
    { x: 42, y: 32 }, { x: 42, y: 64 },
    { x: 58, y: 18 }, { x: 58, y: 48 }, { x: 58, y: 78 },
    { x: 72, y: 48 },
  ],
};

function formation(team: Team, formationId: FormationId = DEFAULT_FORMATION): Point[] {
  const base = FORMATIONS[formationId] ?? FORMATIONS[DEFAULT_FORMATION];
  if (team === 'home') return base;
  return base.map((p) => ({ x: PITCH_W - p.x, y: p.y }));
}

/** index المهاجم الأكثر تقدّمًا ومركزية بالتشكيلة - هو اللي بيبدأ ماسك الكرة عند الإرسالة. */
function kickoffIndexFor(formationId: FormationId): number {
  const base = FORMATIONS[formationId] ?? FORMATIONS[DEFAULT_FORMATION];
  let bestIdx = 1;
  let bestX = -Infinity;
  base.forEach((p, i) => {
    if (i === 0) return; // تجاهل الحارس
    if (p.x > bestX) bestX = p.x;
  });
  let bestYDist = Infinity;
  base.forEach((p, i) => {
    if (i === 0 || p.x !== bestX) return;
    const yDist = Math.abs(p.y - PITCH_H / 2);
    if (yDist < bestYDist) {
      bestYDist = yDist;
      bestIdx = i;
    }
  });
  return bestIdx;
}

function boostOf(state: MatchState, team: Team): Boost {
  return state.boosts?.[team] ?? NO_BOOST;
}

/** أقرب لاعبين (غير الحارس) لحامل الكرة الخصم: هدول بيضغطوا عليه بسرعة أكبر. */
function pressers(state: MatchState, team: Team): number[] {
  if (state.ballOwner === team) return [];
  const ball = state.positions[state.ballOwner][state.ballIndex];
  return state.positions[team]
    .map((p, i) => ({ i, d: dist(p, ball) }))
    .filter((o) => o.i > 0)
    .sort((x, y) => x.d - y.d)
    .slice(0, 2)
    .map((o) => o.i);
}

/** المكان "المثالي" للاعب رقم i: حركة الفريق كوحدة منظّمة حسب طور اللعب.
 * - هجوم: الدفاع بيرفع الخط ويحافظ عليه، الوسط بيدعم حامل الكرة من زوايا على الجانبين،
 *   والمهاجمين بيجروا لقدام الكرة مع الحفاظ على العرض.
 * - دفاع: الفريق بينضغط عرضًا باتجاه الكرة (تماسك)، اثنين بيضغطوا على الحامل، وباقي
 *   المدافعين والوسط بيراقبوا أقرب مهاجم من جهة المرمى، والمهاجمين بيضلوا متقدمين للمرتدة. */
function targetSlot(state: MatchState, team: Team, i: number): Point {
  const f = state.formations?.[team] ?? DEFAULT_FORMATION;
  const base = formation(team, f)[i];
  if (!base) return { x: PITCH_W / 2, y: PITCH_H / 2 };
  const ball = state.positions[state.ballOwner][state.ballIndex];
  if (i === 0) return { x: base.x, y: clamp(base.y + (ball.y - base.y) * 0.15, PITCH_H / 2 - 8, PITCH_H / 2 + 8) };

  const dir = team === 'home' ? 1 : -1;
  const toX = (u: number) => (team === 'home' ? u : PITCH_W - u);
  const bu = team === 'home' ? ball.x : PITCH_W - ball.x; // تقدّم الكرة بمنظور هالفريق
  const bp = team === 'home' ? base.x : PITCH_W - base.x; // تقدّم مكان اللاعب الأصلي
  const role = roleOf(state, team, i);
  const attacking = state.ballOwner === team;
  let u: number;
  let y: number;

  if (attacking) {
    if (role === 'def') {
      u = clamp(bu - 34, Math.max(20, bp - 8), bp + 30);
      y = base.y * 0.8 + ball.y * 0.2;
    } else if (role === 'mid') {
      u = clamp(bu - 8, 30, PITCH_W - 30);
      y = clamp(ball.y + (base.y >= PITCH_H / 2 ? 14 : -14), 6, PITCH_H - 6); // زاوية دعم على جانب الكرة
    } else {
      u = clamp(bu + 14, 60, PITCH_W - 10);
      y = base.y * 0.85 + ball.y * 0.15; // الحفاظ على العرض
    }
    return { x: clamp(toX(u), 4, PITCH_W - 4), y: clamp(y, 4, PITCH_H - 4) };
  }

  // دفاع
  if (pressers(state, team).includes(i)) {
    return { x: clamp(ball.x - dir * (MIN_SEP + 1.5), 4, PITCH_W - 4), y: clamp(ball.y, 4, PITCH_H - 4) };
  }
  if (role === 'def') u = clamp(Math.min(bu - 10, bp + 10), 12, 55);
  else if (role === 'mid') u = clamp(bu - 6, 28, 85);
  else u = clamp(bu + 6, 55, 100);
  y = ball.y + (base.y - ball.y) * 0.6; // تماسك: انضغاط باتجاه الكرة
  let t: Point = { x: toX(u), y };
  if (role !== 'fwd') {
    // مراقبة أقرب مهاجم (غير الحامل) من جهة المرمى
    const opps = state.positions[opp(team)];
    let best = -1;
    let bd = 22;
    opps.forEach((o, j) => {
      if (j === 0 || j === state.ballIndex) return;
      const d = dist(o, t);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best >= 0) t = { x: opps[best].x - dir * 3.5, y: opps[best].y + (ball.y - opps[best].y) * 0.15 };
  }
  return { x: clamp(t.x, 4, PITCH_W - 4), y: clamp(t.y, 4, PITCH_H - 4) };
}

/** بتحرّك كل لاعب ما عدا اللي انحرك بالحركة الحالية (وحامل الكرة، إلا إذا هو نفسه المستثنى)
 * خطوة صغيرة تلقائية باتجاه مكانه "المثالي"، عشان الملعب كله يبين حي ومتحرك زي مباراة
 * كورة حقيقية - مش شطرنج بتحرك فيه لاعب واحد بس وكل الباقيين واقفين ساكنين. */
function autoAdjust(state: MatchState, exempt: { team: Team; index: number } | null): MatchState {
  const positions: Record<Team, Point[]> = { home: [...state.positions.home], away: [...state.positions.away] };
  (['home', 'away'] as Team[]).forEach((team) => {
    positions[team] = positions[team].map((p, i) => {
      if (exempt && exempt.team === team && exempt.index === i) return p;
      if (team === state.ballOwner && i === state.ballIndex) return p; // حامل الكرة ما بيتحرك إلا بأمرك
      const target = targetSlot(state, team, i);
      const d = dist(p, target);
      if (d < 0.5) return p;
      const step = Math.min(AUTO_STEP * (pressers(state, team).includes(i) ? 1.7 : 1), d);
      const ang = Math.atan2(target.y - p.y, target.x - p.x);
      const np = {
        x: clamp(p.x + Math.cos(ang) * step, 0, PITCH_W),
        y: clamp(p.y + Math.sin(ang) * step, 0, PITCH_H),
      };
      for (const t2 of ['home', 'away'] as Team[]) {
        for (let j = 0; j < positions[t2].length; j++) {
          if (t2 === team && j === i) continue;
          if (dist(positions[t2][j], np) < MIN_SEP) return p; // رح يصطدم بلاعب ثاني، خليه مكانه هالمرة
        }
      }
      return { x: round1(np.x), y: round1(np.y) };
    });
  });
  return { ...state, positions };
}

export type Role = 'gk' | 'def' | 'mid' | 'fwd';

/** دور اللاعب حسب مكانه بالتشكيلة: الحارس، مدافع، وسط، مهاجم. */
export function roleOf(state: MatchState, team: Team, i: number): Role {
  if (i === 0) return 'gk';
  const base = formation(team, state.formations?.[team] ?? DEFAULT_FORMATION)[i];
  if (!base) return 'mid';
  const progress = team === 'home' ? base.x : PITCH_W - base.x;
  return progress >= 68 ? 'fwd' : progress <= 30 ? 'def' : 'mid';
}

/** مدى حركة الفريق (مع البطاقة). */
export function moveRadius(state: MatchState, team: Team): number {
  return MOVE_RADIUS + boostOf(state, team).move;
}

/** مدى تمرير الفريق (مع البطاقة). */
export function passRange(state: MatchState, team: Team): number {
  return PASS_RANGE + boostOf(state, team).pass;
}

/** احتمال نجاح استخلاص الفريق للكرة (مع بطاقته وبطاقة حامل الكرة). */
export function tackleChance(state: MatchState, team: Team, playerIndex?: number): number {
  // المدافعين أقوى بالاستخلاص (+8%)
  const roleBonus = playerIndex !== undefined && roleOf(state, team, playerIndex) === 'def' ? 0.08 : 0;
  return clamp(0.5 + roleBonus + boostOf(state, team).tackle - boostOf(state, opp(team)).guard, 0.2, 0.88);
}

export function initialState(
  kickoff: Team = 'home',
  boosts?: Record<Team, Boost>,
  formations?: Record<Team, FormationId>
): MatchState {
  const f = formations ?? { home: DEFAULT_FORMATION, away: DEFAULT_FORMATION };
  return {
    positions: { home: formation('home', f.home), away: formation('away', f.away) },
    ballOwner: kickoff,
    ballIndex: kickoffIndexFor(f[kickoff]),
    turn: kickoff,
    ap: AP_PER_TURN,
    score: { home: 0, away: 0 },
    round: 0,
    status: 'playing',
    winner: null,
    lastEvent: 'انطلاق المباراة',
    boosts: boosts ?? { home: NO_BOOST, away: NO_BOOST },
    formations: f,
    stats: { home: { ...EMPTY_STATS }, away: { ...EMPTY_STATS } },
    ...(() => {
      const seed = (Math.random() * 4294967296) >>> 0;
      const r = (seed % 1000) / 1000;
      const weather: Weather = r < TUNING.weatherOdds.dry ? 'dry' : r < TUNING.weatherOdds.dry + TUNING.weatherOdds.damp ? 'damp' : 'wet';
      return { rng: seed, weather, crowd: 20 };
    })(),
  };
}

/** بيسجّل إحصائية وحدث جديد بدون ما يعدّل الحالة الأصلية. */
function record(s: MatchState, team: Team, kind: PlayEvent['kind'], patch: Partial<TeamStats>): MatchState {
  const cur = s.stats ?? { home: { ...EMPTY_STATS }, away: { ...EMPTY_STATS } };
  const mine: TeamStats = { ...cur[team] };
  (Object.keys(patch) as (keyof TeamStats)[]).forEach((k) => {
    mine[k] += patch[k] ?? 0;
  });
  const crowd = clamp((s.crowd ?? 20) + TUNING.crowdGain[kind], 0, 100);
  return { ...s, crowd, stats: { ...cur, [team]: mine }, play: { id: (s.play?.id ?? 0) + 1, kind, team } };
}

function resetAfterGoal(state: MatchState, scoringTeam: Team): MatchState {
  const conceding = opp(scoringTeam);
  const f = state.formations ?? { home: DEFAULT_FORMATION, away: DEFAULT_FORMATION };
  return {
    ...state,
    positions: { home: formation('home', f.home), away: formation('away', f.away) },
    ballOwner: conceding,
    ballIndex: kickoffIndexFor(f[conceding]),
    turn: conceding,
    ap: AP_PER_TURN,
  };
}

function finishIfNeeded(state: MatchState): MatchState {
  if (state.score.home >= MAX_GOALS || state.score.away >= MAX_GOALS) {
    const winner: Team | 'draw' =
      state.score.home === state.score.away ? 'draw' : state.score.home > state.score.away ? 'home' : 'away';
    return { ...state, status: 'finished', winner };
  }
  return state;
}

/** بتخلص المباراة فورًا حسب النتيجة الحالية - تُستخدم لما ينتهي وقت المباراة (MATCH_DURATION_MS)
 * قبل ما حدا يوصل لهدفين. لو النتيجة متعادلة (حتى 0-0) بتصير تعادل فعلي. */
export function finishByTime(state: MatchState): MatchState {
  if (state.status === 'finished') return state;
  const winner: Team | 'draw' =
    state.score.home === state.score.away ? 'draw' : state.score.home > state.score.away ? 'home' : 'away';
  return { ...state, status: 'finished', winner };
}

function endTurnIfNeeded(state: MatchState, forcedEnd: boolean): MatchState {
  if (state.ap > 0 && !forcedEnd) return state;
  // الاستحواذ: كل دور بينتهي بيتحسب لصالح الفريق اللي معه الكرة
  const cur = state.stats;
  const stats = cur ? { ...cur, [state.ballOwner]: { ...cur[state.ballOwner], poss: (cur[state.ballOwner].poss ?? 0) + 1 } } : undefined;
  return { ...state, ...(stats ? { stats } : {}), crowd: Math.max(0, (state.crowd ?? 20) - TUNING.crowdDecay), turn: opp(state.turn), ap: AP_PER_TURN, round: state.round + 1 };
}

// ---------- قواعد الحركة والتمرير والتسديد ----------

/** هل الحركة مسموحة؟ (جوا الملعب، ضمن دايرة الحركة، وما بتلزق بلاعب ثاني). */
export function isValidMove(state: MatchState, team: Team, playerIndex: number, to: Point): boolean {
  const from = state.positions[team][playerIndex];
  if (!from) return false;
  if (!(to.x >= 0 && to.x <= PITCH_W && to.y >= 0 && to.y <= PITCH_H)) return false;
  const d = dist(from, to);
  if (d > moveRadius(state, team) + 1e-6 || d < 1) return false;
  const scoring = state.ballOwner === team && state.ballIndex === playerIndex && inGoalMouth(team, to);
  if (scoring) return true;
  for (const t of ['home', 'away'] as Team[]) {
    for (let i = 0; i < state.positions[t].length; i++) {
      if (t === team && i === playerIndex) continue;
      if (dist(state.positions[t][i], to) < MIN_SEP) return false;
    }
  }
  return true;
}

/** المسافة بين حامل الكرة ومركز المرمى اللي بيهاجمه. */
export function shootDistance(state: MatchState, team: Team): number {
  return dist(state.positions[team][state.ballIndex], goalCenter(team));
}

export function inShootRange(state: MatchState, team: Team): boolean {
  return state.ballOwner === team && shootDistance(state, team) <= MAX_SHOOT_DIST;
}

/** احتمال نجاح التسديدة: بيعتمد على زاوية المرمى اللي شايفها الحامل (كل ما قرّب وواجه المرمى
 * بشكل مباشر كل ما زادت)، ومدافعين قريبين منه، ومدافعين واقفين بخط التسديدة. */
export function shootChance(state: MatchState, team: Team): number {
  const carrier = state.positions[team][state.ballIndex];
  const gc = goalCenter(team);
  const dx = Math.abs(gc.x - carrier.x);
  const a1 = Math.atan2(gc.y - GOAL_HALF - carrier.y, dx);
  const a2 = Math.atan2(gc.y + GOAL_HALF - carrier.y, dx);
  const theta = Math.abs(a2 - a1); // الزاوية اللي بيغطيها المرمى
  let chance = 0.65 * Math.min(1, theta / 1.2);

  const defenders = state.positions[opp(team)];
  const near = defenders.filter((p) => dist(p, carrier) <= TACKLE_RANGE).length;
  const blockers = defenders.filter(
    (p) => distToSegment(p, carrier, gc) <= 3.5 && dist(p, gc) < dist(carrier, gc)
  ).length;
  // المهاجمين أدق بالتسديد (+6%)
  const roleBonus = roleOf(state, team, state.ballIndex) === 'fwd' ? 0.06 : 0;
  // الحارس بيخرج ويضيّق الزاوية لما يكون قريب من حامل الكرة
  const gkOut = dist(state.positions[opp(team)][0], state.positions[team][state.ballIndex]) < TUNING.gkSweepDist ? TUNING.gkSweepPenalty : 0;
  chance += boostOf(state, team).shoot + roleBonus - gkOut - 0.12 * near - 0.1 * blockers;
  return clamp(chance, 0.05, 0.8);
}

/** احتمال نجاح التمريرة: بتنقص مع المسافة ومع كل مدافع واقف بخط التمريرة. */
export function passChance(state: MatchState, team: Team, toIndex: number): number {
  const from = state.positions[team][state.ballIndex];
  const to = state.positions[team][toIndex];
  if (!from || !to) return 0;
  const blockers = state.positions[opp(team)].filter((p) => distToSegment(p, from, to) <= 4).length;
  return clamp(0.97 - 0.2 * (dist(from, to) / passRange(state, team)) - 0.22 * blockers - TUNING.weatherPass[state.weather ?? 'dry'], 0.3, 0.97);
}

export function passableTeammates(state: MatchState, team: Team): number[] {
  if (state.ballOwner !== team) return [];
  const carrier = state.positions[team][state.ballIndex];
  return state.positions[team]
    .map((_, i) => i)
    .filter((i) => i !== state.ballIndex && dist(state.positions[team][i], carrier) <= passRange(state, team));
}

/** لاعبين فريقك اللي بيقدروا يستخلصوا الكرة (قريبين من حامل الكرة الخصم). */
export function tacklers(state: MatchState, team: Team): number[] {
  if (state.ballOwner === team) return [];
  const carrier = state.positions[opp(team)][state.ballIndex];
  return state.positions[team].map((_, i) => i).filter((i) => dist(state.positions[team][i], carrier) <= TACKLE_RANGE);
}

/** بيطبّق حركة وحدة على الحالة الحالية ويرجّع الحالة الجديدة. الحركة الغير صالحة بترجّع نفس الحالة. */
export function applyAction(state: MatchState, action: Action, actingTeam: Team): MatchState {
  if (state.status === 'finished' || state.turn !== actingTeam) return state;
  let next: MatchState = { ...state, positions: { home: [...state.positions.home], away: [...state.positions.away] } };

  if (action.type === 'endTurn') {
    return finishIfNeeded(endTurnIfNeeded(autoAdjust(next, null), true));
  }

  if (action.type === 'move') {
    if (!isValidMove(state, actingTeam, action.playerIndex, action.to)) return state;
    const to = { x: round1(action.to.x), y: round1(action.to.y) };
    const list = [...next.positions[actingTeam]];
    list[action.playerIndex] = to;
    next.positions = { ...next.positions, [actingTeam]: list };
    next.lastEvent = 'حركة لاعب';
    if (next.ballOwner === actingTeam && next.ballIndex === action.playerIndex && inGoalMouth(actingTeam, to)) {
      next.lastEvent = `⚽ هدف لفريق ${actingTeam === 'home' ? 'الأول' : 'الثاني'}!`;
      next.score = { ...next.score, [actingTeam]: next.score[actingTeam] + 1 };
      next = record(next, actingTeam, 'goal', { goals: 1 });
      next = resetAfterGoal(next, actingTeam);
      return finishIfNeeded(next);
    }
    next.ap -= 1;
    next = autoAdjust(next, { team: actingTeam, index: action.playerIndex });
    return finishIfNeeded(endTurnIfNeeded(next, false));
  }

  if (action.type === 'pass') {
    if (!passableTeammates(state, actingTeam).includes(action.toPlayerIndex)) return state;
    const ok = rnd(next) < passChance(state, actingTeam, action.toPlayerIndex);
    next.ap -= 1;
    if (ok) {
      next.ballIndex = action.toPlayerIndex;
      next.lastEvent = 'تمريرة';
      next = record(next, actingTeam, 'pass', { passes: 1, passesOk: 1 });
      next = autoAdjust(next, { team: actingTeam, index: action.toPlayerIndex });
      return finishIfNeeded(endTurnIfNeeded(next, false));
    }
    // التمريرة انقطعت: الكرة بتروح لأقرب مدافع لخط التمريرة وبينتهي الدور
    const from = state.positions[actingTeam][state.ballIndex];
    const to = state.positions[actingTeam][action.toPlayerIndex];
    let stealer = 0;
    let best = Infinity;
    state.positions[opp(actingTeam)].forEach((p, i) => {
      const d = distToSegment(p, from, to);
      if (d < best) {
        best = d;
        stealer = i;
      }
    });
    next.ballOwner = opp(actingTeam);
    next.ballIndex = stealer;
    next.ap = 0;
    next.lastEvent = 'تمريرة مقطوعة! الكرة راحت للخصم';
    next = record(next, actingTeam, 'intercept', { passes: 1 });
    next = autoAdjust(next, { team: opp(actingTeam), index: stealer });
    return finishIfNeeded(endTurnIfNeeded(next, true));
  }

  if (action.type === 'shoot') {
    if (!inShootRange(state, actingTeam)) return state;
    const success = rnd(next) < shootChance(next, actingTeam);
    if (success) {
      next.lastEvent = `⚽ هدف لفريق ${actingTeam === 'home' ? 'الأول' : 'الثاني'}!`;
      next.score = { ...next.score, [actingTeam]: next.score[actingTeam] + 1 };
      next = record(next, actingTeam, 'goal', { shots: 1, goals: 1 });
      next = resetAfterGoal(next, actingTeam);
      return finishIfNeeded(next);
    }
    next.lastEvent = 'تسديدة ضاعت! الكرة رجعت للدفاع';
    next = record(next, actingTeam, 'miss', { shots: 1 });
    next.ballOwner = opp(actingTeam);
    const gc = goalCenter(actingTeam);
    let closestIdx = 0;
    let bestD = Infinity;
    next.positions[opp(actingTeam)].forEach((p, i) => {
      const d = dist(p, gc);
      if (d < bestD) {
        bestD = d;
        closestIdx = i;
      }
    });
    next.ballIndex = closestIdx;
    next.ap = 0;
    next = autoAdjust(next, { team: opp(actingTeam), index: closestIdx });
    return finishIfNeeded(endTurnIfNeeded(next, true));
  }

  if (action.type === 'tackle') {
    if (!tacklers(state, actingTeam).includes(action.playerIndex)) return state;
    const success = rnd(next) < tackleChance(state, actingTeam, action.playerIndex);
    next.ap -= 1;
    if (success) {
      next.lastEvent = 'استخلاص ناجح للكرة!';
      next.ballOwner = actingTeam;
      next.ballIndex = action.playerIndex;
    } else {
      next.lastEvent = 'محاولة استخلاص فاشلة';
    }
    next = record(next, actingTeam, success ? 'tackleWin' : 'tackleFail', { tackles: 1, tacklesWon: success ? 1 : 0 });
    next = autoAdjust(next, { team: actingTeam, index: action.playerIndex });
    return finishIfNeeded(endTurnIfNeeded(next, false));
  }

  return state;
}

// ---------- الذكاء الاصطناعي (وضع اللعب المحلي) ----------

/** بيحاول يحرّك لاعب باتجاه هدف، وبيجرّب زوايا ومسافات مختلفة لحد ما يلاقي مكان صالح. */
function stepToward(state: MatchState, team: Team, idx: number, target: Point): Point | null {
  const from = state.positions[team][idx];
  const d = dist(from, target);
  if (d < 1) return null;
  const baseAngle = Math.atan2(target.y - from.y, target.x - from.x);
  const step = Math.min(moveRadius(state, team), d);
  for (const scale of [1, 0.75, 0.5]) {
    for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
      const a = baseAngle + off;
      const p = {
        x: clamp(from.x + Math.cos(a) * step * scale, 0, PITCH_W),
        y: clamp(from.y + Math.sin(a) * step * scale, 0, PITCH_H),
      };
      if (isValidMove(state, team, idx, p)) return p;
    }
  }
  return null;
}

const AI_TUNING: Record<Difficulty, { shoot: number; pass: number; tackle: number; passMin: number; smart: boolean }> = {
  easy: { shoot: 0.45, pass: 0.2, tackle: 0.6, passMin: 0.5, smart: false },
  normal: { shoot: 0.33, pass: 0.35, tackle: 1, passMin: 0.5, smart: false },
  hard: { shoot: 0.27, pass: 0.6, tackle: 1, passMin: 0.6, smart: true },
};

/** المراوغة الذكية: بيجرّب 24 اتجاه، وبيختار الأقرب للمرمى مع الابتعاد عن المدافعين. */
function bestDribble(state: MatchState, team: Team, idx: number, target: Point): Point | null {
  const from = state.positions[team][idx];
  const R = moveRadius(state, team);
  const enemies = state.positions[opp(team)];
  let best: Point | null = null;
  let bestScore = -Infinity;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const p = { x: clamp(from.x + Math.cos(a) * R, 0, PITCH_W), y: clamp(from.y + Math.sin(a) * R, 0, PITCH_H) };
    if (!isValidMove(state, team, idx, p)) continue;
    const nearest = Math.min(...enemies.map((e) => dist(e, p)));
    const score = -dist(p, target) + 0.8 * Math.min(nearest, 14);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** ذكاء اصطناعي بيختار حركة وحدة لما يكون دور الجهاز، بثلاث مستويات صعوبة (لوضع اللعب المحلي). */
export function aiChooseAction(state: MatchState, team: Team, level: Difficulty = 'normal'): Action {
  const base = AI_TUNING[level];
  // الطبقة الاستراتيجية: لو الجهاز متأخر بيهاجم أكثر، ولو متقدم بيلعب أهدى
  const diff = state.score[team] - state.score[opp(team)];
  const tune = { ...base, shoot: base.shoot - (diff < 0 ? 0.05 : 0), pass: clamp(base.pass + (diff < 0 ? 0.1 : diff > 0 ? -0.1 : 0), 0, 1) };
  if (state.ballOwner === team) {
    const carrier = state.positions[team][state.ballIndex];
    const gc = goalCenter(team);
    if (inShootRange(state, team) && shootChance(state, team) >= tune.shoot) return { type: 'shoot' };

    const carrierGoalDist = dist(carrier, gc);
    const mates = passableTeammates(state, team).filter(
      (i) => dist(state.positions[team][i], gc) < carrierGoalDist - 10 && passChance(state, team, i) >= tune.passMin
    );
    if (mates.length > 0 && Math.random() < tune.pass) {
      const best = mates.reduce((a, b) =>
        dist(state.positions[team][a], gc) < dist(state.positions[team][b], gc) ? a : b
      );
      return { type: 'pass', toPlayerIndex: best };
    }
    const target = { x: gc.x, y: clamp(carrier.y, PITCH_H / 2 - GOAL_HALF, PITCH_H / 2 + GOAL_HALF) };
    const far = dist(carrier, target) > moveRadius(state, team);
    const to = (tune.smart && far ? bestDribble(state, team, state.ballIndex, target) : null) ?? stepToward(state, team, state.ballIndex, target);
    if (to) return { type: 'move', playerIndex: state.ballIndex, to };
    return { type: 'endTurn' };
  }

  const mine = tacklers(state, team);
  const enemyCarrier = state.positions[opp(team)][state.ballIndex];
  if (mine.length > 0 && Math.random() < tune.tackle) {
    const closest = mine.reduce((a, b) =>
      dist(state.positions[team][a], enemyCarrier) < dist(state.positions[team][b], enemyCarrier) ? a : b
    );
    return { type: 'tackle', playerIndex: closest };
  }
  // قرّب أقرب لاعب (غير الحارس) من حامل الكرة الخصم لحد ما يصير بمدى الاستخلاص
  let bestIdx = 1;
  let bestDist = Infinity;
  state.positions[team].forEach((p, i) => {
    if (i === 0) return;
    const d = dist(p, enemyCarrier);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  const from = state.positions[team][bestIdx];
  const dirLen = dist(from, enemyCarrier) || 1;
  const approach = {
    x: enemyCarrier.x + ((from.x - enemyCarrier.x) / dirLen) * (MIN_SEP + 1.5),
    y: enemyCarrier.y + ((from.y - enemyCarrier.y) / dirLen) * (MIN_SEP + 1.5),
  };
  const to = stepToward(state, team, bestIdx, approach);
  if (to) return { type: 'move', playerIndex: bestIdx, to };
  return { type: 'endTurn' };
}
