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
};

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

/** مدى حركة الفريق (مع البطاقة). */
export function moveRadius(state: MatchState, team: Team): number {
  return MOVE_RADIUS + boostOf(state, team).move;
}

/** مدى تمرير الفريق (مع البطاقة). */
export function passRange(state: MatchState, team: Team): number {
  return PASS_RANGE + boostOf(state, team).pass;
}

/** احتمال نجاح استخلاص الفريق للكرة (مع بطاقته وبطاقة حامل الكرة). */
export function tackleChance(state: MatchState, team: Team): number {
  return clamp(0.5 + boostOf(state, team).tackle - boostOf(state, opp(team)).guard, 0.2, 0.8);
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
  };
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
  return { ...state, turn: opp(state.turn), ap: AP_PER_TURN, round: state.round + 1 };
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
  chance += boostOf(state, team).shoot - 0.12 * near - 0.1 * blockers;
  return clamp(chance, 0.05, 0.8);
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
    return finishIfNeeded(endTurnIfNeeded(next, true));
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
      next = resetAfterGoal(next, actingTeam);
      return finishIfNeeded(next);
    }
    next.ap -= 1;
    return finishIfNeeded(endTurnIfNeeded(next, false));
  }

  if (action.type === 'pass') {
    if (!passableTeammates(state, actingTeam).includes(action.toPlayerIndex)) return state;
    next.ballIndex = action.toPlayerIndex;
    next.lastEvent = 'تمريرة';
    next.ap -= 1;
    return finishIfNeeded(endTurnIfNeeded(next, false));
  }

  if (action.type === 'shoot') {
    if (!inShootRange(state, actingTeam)) return state;
    const chance = shootChance(next, actingTeam);
    const success = Math.random() < chance;
    if (success) {
      next.lastEvent = `⚽ هدف لفريق ${actingTeam === 'home' ? 'الأول' : 'الثاني'}!`;
      next.score = { ...next.score, [actingTeam]: next.score[actingTeam] + 1 };
      next = resetAfterGoal(next, actingTeam);
      return finishIfNeeded(next);
    }
    next.lastEvent = 'تسديدة ضاعت! الكرة رجعت للدفاع';
    next.ballOwner = opp(actingTeam);
    // الكرة بترجع لأقرب مدافع من الفريق التاني لمركز المرمى المهدد
    const gc = goalCenter(actingTeam);
    let closestIdx = 0;
    let best = Infinity;
    next.positions[opp(actingTeam)].forEach((p, i) => {
      const d = dist(p, gc);
      if (d < best) {
        best = d;
        closestIdx = i;
      }
    });
    next.ballIndex = closestIdx;
    next.ap = 0;
    return finishIfNeeded(endTurnIfNeeded(next, true));
  }

  if (action.type === 'tackle') {
    if (!tacklers(state, actingTeam).includes(action.playerIndex)) return state;
    const success = Math.random() < tackleChance(state, actingTeam);
    next.ap -= 1;
    if (success) {
      next.lastEvent = 'استخلاص ناجح للكرة!';
      next.ballOwner = actingTeam;
      next.ballIndex = action.playerIndex;
    } else {
      next.lastEvent = 'محاولة استخلاص فاشلة';
    }
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

/** ذكاء اصطناعي بسيط بيختار حركة وحدة لما يكون دور الجهاز، لوضع اللعب المحلي فقط. */
export function aiChooseAction(state: MatchState, team: Team): Action {
  if (state.ballOwner === team) {
    const carrier = state.positions[team][state.ballIndex];
    const gc = goalCenter(team);
    if (inShootRange(state, team) && shootChance(state, team) >= 0.33) return { type: 'shoot' };

    const carrierGoalDist = dist(carrier, gc);
    const mates = passableTeammates(state, team).filter(
      (i) => dist(state.positions[team][i], gc) < carrierGoalDist - 10
    );
    if (mates.length > 0 && Math.random() < 0.35) {
      const best = mates.reduce((a, b) =>
        dist(state.positions[team][a], gc) < dist(state.positions[team][b], gc) ? a : b
      );
      return { type: 'pass', toPlayerIndex: best };
    }
    const target = { x: gc.x, y: clamp(carrier.y, PITCH_H / 2 - GOAL_HALF, PITCH_H / 2 + GOAL_HALF) };
    const to = stepToward(state, team, state.ballIndex, target);
    if (to) return { type: 'move', playerIndex: state.ballIndex, to };
    return { type: 'endTurn' };
  }

  const mine = tacklers(state, team);
  const enemyCarrier = state.positions[opp(team)][state.ballIndex];
  if (mine.length > 0) {
    const closest = mine.reduce((a, b) =>
      dist(state.positions[team][a], enemyCarrier) < dist(state.positions[team][b], enemyCarrier) ? a : b
    );
    return { type: 'tackle', playerIndex: closest };
  }
  // قرّب أقرب لاعب من حامل الكرة الخصم لحد ما يصير بمدى الاستخلاص
  let bestIdx = 0;
  let bestDist = Infinity;
  state.positions[team].forEach((p, i) => {
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
