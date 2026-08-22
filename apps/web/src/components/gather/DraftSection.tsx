import { cookies } from 'next/headers';
import { session, supabase } from '@/lib/supabase/supabase-server';
import { MatchConfigsRow } from '@bf2-matchmaking/types';
import { GatherDraftState } from '@bf2-matchmaking/types/gather';
import { currentTurn } from '@bf2-matchmaking/services/gather-draft';
import DraftBoard from '@/components/gather/DraftBoard';
import { pickDraftPlayer, undoDraftPick } from '@/app/gather/actions';
import Link from 'next/link';
import { PlayerConnectionStatus } from '@/components/gather/PlayerConnectionIcons';

interface Props {
  config: MatchConfigsRow;
  draft: GatherDraftState;
  connections: Record<string, PlayerConnectionStatus>;
}

/**
 * Replaces the queueing-players box while captains are picking teams.
 *
 * A captain may only pick for their own side. Admins can pick for either, which
 * is what makes the flow testable without two real people present.
 */
export default async function DraftSection({ config, draft, connections }: Props) {
  const cookieStore = await cookies();
  // Spectators and signed-out viewers should still see the draft as it happens,
  // just without the ability to pick - so neither lookup may be allowed to throw
  // the section away. getAdminRoles raises AuthSessionMissingError when nobody
  // is signed in.
  const adminRoles = await supabase(cookieStore)
    .getAdminRoles()
    .then((res) => res.data)
    .catch(() => null);
  const sessionPlayer = await session.getSessionPlayerSafe().catch(() => null);

  const isAdmin = Boolean(adminRoles?.match_admin || adminRoles?.system_admin);
  const turn = currentTurn(draft);

  const captainTeam: 1 | 2 | null =
    sessionPlayer?.id === draft.captains[0]
      ? 1
      : sessionPlayer?.id === draft.captains[1]
        ? 2
        : null;

  // A captain only acts on their turn; an admin stands in for whoever is up.
  const canPick = isAdmin || captainTeam === turn;

  async function pickSA(playerId: string, team: 1 | 2) {
    'use server';
    return pickDraftPlayer(config.id, playerId, team);
  }

  async function undoSA(playerId: string) {
    'use server';
    return undoDraftPick(config.id, playerId);
  }

  return (
    <section className="section flex-auto">
      <div className="flex items-baseline justify-between">
        <h2>Drafting</h2>
        <Link className="link link-hover text-sm" href={`/matches/${draft.matchId}`}>
          Match {draft.matchId}
        </Link>
      </div>
      <DraftBoard
        draft={draft}
        turn={turn}
        canPick={canPick}
        isAdmin={isAdmin}
        captainTeam={captainTeam}
        connections={connections}
        onPick={pickSA}
        onUndo={undoSA}
      />
    </section>
  );
}
