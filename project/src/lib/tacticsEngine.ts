// محرك لعبة "تكتيكات الكورة" - منطق نقي (Pure) مشترك بين وضع اللعب أمام الذكاء
// الاصطناعي محليًا، ووضع اللعب أونلاين (نفس الدالة بتشتغل، بس بحالة الأونلاين
// كل لاعب بيبعث حركته وبتنكتب الحالة الجديدة بفايرستور).

export const COLS = 11;
export const ROWS = 7;
export const GOAL_ROWS = [2, 3, 4]; // الصفوف اللي فيها المرمى
export const MAX_ROUNDS = 30; // 15 دور لكل فريق كحد أقصى
export const MAX_GOALS = 3; // أول فريق يوصل 3 أهداف بيكسب فورًا

export type Team = 'home' | 'away';
export type Cell = { r: number; c: number };

export type MatchState = {
  positions: Record<Team, Cell[]>; // 5 لاعبين بكل فريق
  ballOwner: Team;
  ballIndex: number; // مين حامل الكرة (index بمصفوفة positions)
  turn: Team;
  ap: number; // نقاط الحركة المتبقية بهاد الدور
  score: Record<Team, number>;
  round: number; // إجمالي عدد الأدوار اللي مرت
  status: 'playing' | 'finished';
  winner: Team | 'draw' | null;
  lastEvent: string;
};

export type Action =
  | { type: 'move'; playerIndex: number; to: Cell }
  | { type: 'pass'; toPlayerIndex: number }
  | { type: 'shoot' }
  | { type: 'tackle'; playerIndex: number }
  | { type: 'endTurn' };

function formation(team: Team): Cell[] {
  const base: Cell[] = [
    { r: 3, c: 1 },
    { r: 1, c: 2 },
    { r: 5, c: 2 },
    { r: 3, c: 3 },
    { r: 3, c: 4 },
  ];
  if (team === 'home') return base;
  return base.map((p) => ({ r: p.r, c: COLS - 1 - p.c }));
}

export function initialState(kickoff: Team = 'home'): MatchState {
  return {
    positions: { home: formation('home'), away: formation('away') },
    ballOwner: kickoff,
    ballIndex: 4,
    turn: kickoff,
    ap: 2,
    score: { home: 0, away: 0 },
    round: 0,
    status: 'playing',
    winner: null,
    lastEvent: 'انطلاق المباراة',
  };
}

function opp(t: Team): Team {
  return t === 'home' ? 'away' : 'home';
}

function cellsEqual(a: Cell, b: Cell) {
  return a.r === b.r && a.c === b.c;
}

function isOccupied(state: MatchState, cell: Cell): boolean {
  return (
    state.positions.home.some((p) => cellsEqual(p, cell)) ||
    state.positions.away.some((p) => cellsEqual(p, cell))
  );
}

function inGoal(team: Team, cell: Cell): boolean {
  // الفريق home بيسجل لما وصل لعمود آخر عمود (يمين مرمى away)، وبالعكس
  const targetCol = team === 'home' ? COLS - 1 : 0;
  return cell.c === targetCol && GOAL_ROWS.includes(cell.r);
}

function chebyshev(a: Cell, b: Cell) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
}

export function inShootRange(team: Team, cell: Cell): boolean {
  return team === 'home' ? cell.c >= COLS - 4 : cell.c <= 3;
}

function resetAfterGoal(state: MatchState, scoringTeam: Team): MatchState {
  const conceding = opp(scoringTeam);
  return {
    ...state,
    positions: { home: formation('home'), away: formation('away') },
    ballOwner: conceding,
    ballIndex: 4,
    turn: conceding,
    ap: 2,
  };
}

function finishIfNeeded(state: MatchState): MatchState {
  if (state.score.home >= MAX_GOALS || state.score.away >= MAX_GOALS || state.round >= MAX_ROUNDS) {
    const winner: Team | 'draw' =
      state.score.home === state.score.away ? 'draw' : state.score.home > state.score.away ? 'home' : 'away';
    return { ...state, status: 'finished', winner };
  }
  return state;
}

function endTurnIfNeeded(state: MatchState, forcedEnd: boolean): MatchState {
  if (state.ap > 0 && !forcedEnd) return state;
  const nextTurn = opp(state.turn);
  return { ...state, turn: nextTurn, ap: 2, round: state.round + 1 };
}

/** بيطبّق حركة وحدة على الحالة الحالية ويرجّع الحالة الجديدة. ما بيتحقق من صلاحية
 * الحركة (لازم الواجهة تتأكد قبل ما تستدعيها عن طريق getValidMoves/canShoot..). */
export function applyAction(state: MatchState, action: Action, actingTeam: Team): MatchState {
  if (state.status === 'finished' || state.turn !== actingTeam) return state;
  let next: MatchState = { ...state, positions: { home: [...state.positions.home], away: [...state.positions.away] } };

  if (action.type === 'endTurn') {
    return finishIfNeeded(endTurnIfNeeded(next, true));
  }

  if (action.type === 'move') {
    const list = [...next.positions[actingTeam]];
    list[action.playerIndex] = action.to;
    next.positions = { ...next.positions, [actingTeam]: list };
    next.lastEvent = 'حركة لاعب';
    if (next.ballOwner === actingTeam && next.ballIndex === action.playerIndex) {
      if (inGoal(actingTeam, action.to)) {
        next.lastEvent = `⚽ هدف لفريق ${actingTeam === 'home' ? 'الأول' : 'الثاني'}!`;
        next.score = { ...next.score, [actingTeam]: next.score[actingTeam] + 1 };
        next = resetAfterGoal(next, actingTeam);
        return finishIfNeeded(next);
      }
    }
    next.ap -= 1;
    return finishIfNeeded(endTurnIfNeeded(next, false));
  }

  if (action.type === 'pass') {
    next.ballIndex = action.toPlayerIndex;
    next.lastEvent = 'تمريرة';
    next.ap -= 1;
    return finishIfNeeded(endTurnIfNeeded(next, false));
  }

  if (action.type === 'shoot') {
    const carrier = next.positions[actingTeam][next.ballIndex];
    const opponents = next.positions[opp(actingTeam)];
    const nearDefenders = opponents.filter((p) => chebyshev(p, carrier) <= 1).length;
    const chance = Math.max(0.15, 0.6 - nearDefenders * 0.15);
    const success = Math.random() < chance;
    if (success) {
      next.lastEvent = `⚽ هدف لفريق ${actingTeam === 'home' ? 'الأول' : 'الثاني'}!`;
      next.score = { ...next.score, [actingTeam]: next.score[actingTeam] + 1 };
      next = resetAfterGoal(next, actingTeam);
      return finishIfNeeded(next);
    }
    next.lastEvent = 'تسديدة ضاعت! الكرة رجعت للحارس';
    next.ballOwner = opp(actingTeam);
    // الكرة بترجع لأقرب لاعب من الفريق التاني للمرمى المهدد (دفاعهم)
    const goalCol = actingTeam === 'home' ? COLS - 1 : 0;
    let closestIdx = 0;
    let best = Infinity;
    opponents.forEach((p, i) => {
      const d = Math.abs(p.c - goalCol);
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
    const defender = next.positions[actingTeam][action.playerIndex];
    const carrier = next.positions[opp(actingTeam)][next.ballIndex];
    if (chebyshev(defender, carrier) > 1) return state;
    const success = Math.random() < 0.5;
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

export function validMoveCells(state: MatchState, team: Team, playerIndex: number): Cell[] {
  const p = state.positions[team][playerIndex];
  const out: Cell[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const cell = { r: p.r + dr, c: p.c + dc };
      if (cell.r < 0 || cell.r >= ROWS || cell.c < 0 || cell.c >= COLS) continue;
      if (isOccupied(state, cell)) continue;
      out.push(cell);
    }
  }
  return out;
}

export function passableTeammates(state: MatchState, team: Team): number[] {
  const carrier = state.positions[team][state.ballIndex];
  return state.positions[team]
    .map((p, i) => i)
    .filter((i) => i !== state.ballIndex && chebyshev(state.positions[team][i], carrier) <= 4);
}

export function adjacentEnemies(state: MatchState, team: Team): number[] {
  const carrier = state.positions[opp(team)][state.ballIndex];
  if (state.ballOwner !== opp(team)) return [];
  return state.positions[team].map((p, i) => i).filter((i) => chebyshev(state.positions[team][i], carrier) <= 1);
}

/** ذكاء اصطناعي بسيط بيختار حركة وحدة لما يكون دور الجهاز، لوضع اللعب المحلي فقط. */
export function aiChooseAction(state: MatchState, team: Team): Action {
  const hasBall = state.ballOwner === team;
  if (hasBall) {
    const carrier = state.positions[team][state.ballIndex];
    if (inShootRange(team, carrier)) return { type: 'shoot' };
    const mates = passableTeammates(state, team);
    const goalCol = team === 'home' ? COLS - 1 : 0;
    const advancedMate = mates.find((i) => Math.abs(state.positions[team][i].c - goalCol) < Math.abs(carrier.c - goalCol));
    if (advancedMate !== undefined && Math.random() < 0.35) return { type: 'pass', toPlayerIndex: advancedMate };
    const dir = team === 'home' ? 1 : -1;
    const moves = validMoveCells(state, team, state.ballIndex);
    const forward = moves.find((m) => m.c === carrier.c + dir) ?? moves[0];
    if (forward) return { type: 'move', playerIndex: state.ballIndex, to: forward };
    return { type: 'endTurn' };
  }
  const enemies = adjacentEnemies(state, team);
  if (enemies.length > 0) return { type: 'tackle', playerIndex: enemies[0] };
  // قرّب أقرب لاعب من حامل الكرة الخصم
  const enemyCarrier = state.positions[opp(team)][state.ballIndex];
  let bestIdx = 0;
  let bestDist = Infinity;
  state.positions[team].forEach((p, i) => {
    const d = chebyshev(p, enemyCarrier);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  const moves = validMoveCells(state, team, bestIdx).sort(
    (a, b) => chebyshev(a, enemyCarrier) - chebyshev(b, enemyCarrier)
  );
  if (moves[0]) return { type: 'move', playerIndex: bestIdx, to: moves[0] };
  return { type: 'endTurn' };
}
