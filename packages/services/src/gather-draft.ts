import {
  GatherDraftPlayer,
  GatherDraftState,
} from '@bf2-matchmaking/types/gather';

/**
 * Snake draft used when the gather is set to captain drafting.
 *
 * Captains are seeded onto their own teams first, then alternate picks from the
 * remaining pool in a snake order (1,2,2,1,1,2,...) so neither side gains a
 * systematic advantage from picking first.
 *
 * Pure functions over an explicit state object: the caller owns persistence,
 * which keeps the ordering rules independently testable and free of redis.
 */

/**
 * Team to pick at each position in a snake draft.
 *
 * Pairs alternate which side leads: team 1 takes the first pick, then team 2
 * takes two, then team 1 takes two, and so on.
 */
export function snakePickOrder(pickCount: number): Array<1 | 2> {
  const order: Array<1 | 2> = [];
  let current: 1 | 2 = 1;
  let remainingInRun = 1;

  while (order.length < pickCount) {
    order.push(current);
    remainingInRun--;
    if (remainingInRun === 0) {
      current = current === 1 ? 2 : 1;
      remainingInRun = 2;
    }
  }
  return order;
}

export function createDraftState(
  matchId: number,
  players: Array<GatherDraftPlayer>,
  captains: [string, string]
): GatherDraftState {
  const pool = players
    .map((p) => p.playerId)
    .filter((id) => id !== captains[0] && id !== captains[1]);

  return {
    matchId,
    captains,
    pool,
    team1: [captains[0]],
    team2: [captains[1]],
    turn: snakePickOrder(pool.length)[0] ?? 1,
    pickIndex: 0,
    players,
  };
}

/** Pick two captains at random. */
export function pickRandomCaptains(
  players: Array<GatherDraftPlayer>
): [string, string] {
  if (players.length < 2) {
    throw new Error('Need at least two players to pick captains');
  }
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  return [shuffled[0].playerId, shuffled[1].playerId];
}

export function isDraftComplete(state: GatherDraftState) {
  return state.pool.length === 0;
}

export function currentTurn(state: GatherDraftState): 1 | 2 {
  const order = snakePickOrder(state.pool.length + state.pickIndex);
  return order[state.pickIndex] ?? 1;
}

/**
 * Apply a pick, returning the next state.
 *
 * Throws rather than silently correcting: a pick for the wrong team or an
 * already-taken player means the caller's view of the draft is stale, and
 * quietly accepting it would corrupt the turn order.
 */
export function applyPick(
  state: GatherDraftState,
  playerId: string,
  team: 1 | 2
): GatherDraftState {
  if (isDraftComplete(state)) {
    throw new Error('Draft is already complete');
  }
  if (!state.pool.includes(playerId)) {
    throw new Error(`Player ${playerId} is not available to pick`);
  }
  const expected = currentTurn(state);
  if (team !== expected) {
    throw new Error(`It is team ${expected}'s turn to pick, not team ${team}`);
  }

  const pool = state.pool.filter((id) => id !== playerId);
  const next: GatherDraftState = {
    ...state,
    pool,
    team1: team === 1 ? [...state.team1, playerId] : state.team1,
    team2: team === 2 ? [...state.team2, playerId] : state.team2,
    pickIndex: state.pickIndex + 1,
  };

  // Last player is not a choice - assign automatically so the draft cannot
  // stall on a pool of one.
  if (pool.length === 1) {
    const lastTeam = currentTurn(next);
    const [lastPlayer] = pool;
    return {
      ...next,
      pool: [],
      team1: lastTeam === 1 ? [...next.team1, lastPlayer] : next.team1,
      team2: lastTeam === 2 ? [...next.team2, lastPlayer] : next.team2,
      pickIndex: next.pickIndex + 1,
      turn: lastTeam,
    };
  }

  return { ...next, turn: currentTurn(next) };
}
