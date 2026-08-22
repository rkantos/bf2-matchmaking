'use client';

import { useCallback, useTransition } from 'react';
import { toast } from 'react-toastify';
import { StarIcon } from '@heroicons/react/20/solid';
import { PlusCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { GatherDraftState } from '@bf2-matchmaking/types/gather';
import { snakePickOrder } from '@bf2-matchmaking/services/gather-draft';
import PlayerConnectionIcons, {
  PlayerConnectionStatus,
} from '@/components/gather/PlayerConnectionIcons';

interface Props {
  draft: GatherDraftState;
  turn: 1 | 2;
  canPick: boolean;
  isAdmin: boolean;
  captainTeam: 1 | 2 | null;
  connections: Record<string, PlayerConnectionStatus>;
  onPick: (
    playerId: string,
    team: 1 | 2
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  onUndo: (
    playerId: string
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export default function DraftBoard({
  draft,
  turn,
  canPick,
  isAdmin,
  captainTeam,
  connections,
  onPick,
  onUndo,
}: Props) {
  const [pending, startTransition] = useTransition();

  const nickOf = useCallback(
    (playerId: string) =>
      draft.players.find((p) => p.playerId === playerId)?.nick ?? playerId,
    [draft.players]
  );
  const ratingOf = useCallback(
    (playerId: string) =>
      draft.players.find((p) => p.playerId === playerId)?.rating ?? 0,
    [draft.players]
  );

  const pick = useCallback(
    (playerId: string) =>
      startTransition(async () => {
        const result = await onPick(playerId, turn);
        if (result.error) {
          toast.error(`Pick failed: ${result.error.message}`);
          return;
        }
        toast.success(`Picked ${nickOf(playerId)} for team ${turn}`);
      }),
    [onPick, turn, nickOf]
  );

  const teamRating = (team: Array<string>) =>
    team.reduce((sum, id) => sum + ratingOf(id), 0);
  const previousTeam =
    draft.pickIndex > 0
      ? snakePickOrder(draft.players.length - draft.captains.length)[draft.pickIndex - 1]
      : undefined;
  const lastPickedId = previousTeam
    ? (previousTeam === 1 ? draft.team1 : draft.team2).at(-1)
    : undefined;

  const undo = useCallback(
    (playerId: string) =>
      startTransition(async () => {
        const result = await onUndo(playerId);
        if (result.error) {
          toast.error(`Remove failed: ${result.error.message}`);
          return;
        }
        toast.success(`Returned ${nickOf(playerId)} to the draft pool`);
      }),
    [onUndo, nickOf]
  );

  const bf2Bar = (playerId: string, expectedTeam?: '1' | '2') => {
    const status = connections[playerId];
    if (!status?.bf2) {
      return { className: 'bg-error', title: 'Not connected to BF2' };
    }
    if (expectedTeam && status.bf2Team === expectedTeam) {
      return { className: 'bg-success', title: 'Connected to the correct BF2 side' };
    }
    if (expectedTeam && status.bf2Team) {
      return { className: 'bg-warning', title: 'Connected to the wrong BF2 side' };
    }
    return { className: 'bg-warning', title: 'Connected to BF2' };
  };

  function TeamColumn({ team, ids }: { team: 1 | 2; ids: Array<string> }) {
    const isTurn = turn === team;
    // Match Team 1 plays BF2 side 2; Match Team 2 plays BF2 side 1.
    const expectedBf2Team = team === 1 ? '2' : '1';
    return (
      <div
        className={`flex-1 rounded border p-2 ${
          isTurn ? 'border-accent' : 'border-base-300'
        }`}
      >
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-semibold">Team {team}</span>
          <span className="text-xs text-base-content/60">{teamRating(ids)}</span>
        </div>
        <ol className="text-sm">
          {ids.map((id) => {
            const bar = bf2Bar(id, expectedBf2Team);
            return (
            <li key={id} className="flex h-9 items-center gap-2 truncate">
              <div className={`h-8 w-2 shrink-0 ${bar.className}`} title={bar.title} />
              {id === draft.captains[team - 1] && (
                <StarIcon height={14} viewBox="0 2 20 20" />
              )}
              {nickOf(id)}
              <PlayerConnectionIcons status={connections[id]} showBf2={false} />
              {isAdmin && id === lastPickedId && !draft.captains.includes(id) && (
                <button
                  type="button"
                  className="btn btn-xs btn-circle btn-ghost ml-auto"
                  disabled={pending}
                  onClick={() => undo(id)}
                  title="Undo latest pick"
                >
                  <XCircleIcon className="size-5 text-error" />
                </button>
              )}
            </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="badge badge-accent">Team {turn} picks</span>
        {captainTeam && (
          <span className="text-base-content/60">You captain team {captainTeam}</span>
        )}
        {isAdmin && !captainTeam && (
          <span className="text-base-content/60">Picking as admin</span>
        )}
      </div>

      <div className="flex gap-2">
        <TeamColumn team={1} ids={draft.team1} />
        <TeamColumn team={2} ids={draft.team2} />
      </div>

      <div>
        <div className="text-sm font-semibold mb-1">
          Available ({draft.pool.length})
        </div>
        {draft.pool.length === 0 ? (
          <p className="text-sm text-base-content/60">Draft complete.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {draft.pool.map((id) => {
              const bar = bf2Bar(id);
              return (
              <li key={id} className="flex items-center">
                <div className={`h-8 w-2 ${bar.className}`} title={bar.title} />
                <button
                  type="button"
                  className="btn btn-sm btn-ghost rounded-l-none"
                  disabled={!canPick || pending}
                  onClick={() => pick(id)}
                  title={
                    canPick ? `Pick for team ${turn}` : 'Not your turn to pick'
                  }
                >
                  {nickOf(id)}
                  <PlayerConnectionIcons status={connections[id]} showBf2={false} />
                  <span className="text-xs opacity-60">{ratingOf(id)}</span>
                  <PlusCircleIcon className="size-5 text-success" />
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
