import { useLoaderData } from '@remix-run/react';
import { loader } from '~/routes/matches/$matchId';
import { FaCheckCircle } from 'react-icons/fa';
import { SummonedDialog } from '~/components/match/SummonedDialog';
import { MatchStatus } from '@bf2-matchmaking/types';

const StagingContainer = () => {
  const { match } = useLoaderData<typeof loader>();
  const playerCount = match.players.length;
  const readyPlayers = match.teams.filter((p) => p.ready).map((p) => p.player_id);

  return (
    <>
      <section className="section">
        <h2 className="text-xl">
          Players({playerCount}/{match.size}):
        </h2>
        <ul>
          {match.players.map((player) => (
            <li key={player.id} className="flex gap-1 items-center">
              <p>{player.username}</p>
              {match.status === MatchStatus.Summoning && readyPlayers.includes(player.id) && (
                <FaCheckCircle className="text-green-600" />
              )}
            </li>
          ))}
        </ul>
      </section>
      <SummonedDialog />
    </>
  );
};
export default StagingContainer;
