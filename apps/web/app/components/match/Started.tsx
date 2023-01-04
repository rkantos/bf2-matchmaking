import { useLoaderData } from '@remix-run/react';
import { loader } from '~/routes/matches/$matchId';
import { PlayersRow } from '@bf2-matchmaking/supabase/src/types';
import RoundsList from '~/components/match/RoundsList';

export default function Started() {
  const { match } = useLoaderData<typeof loader>();

  const isTeam = (team: string) => (player: PlayersRow) =>
    match.teams.some(({ player_id, team: t }) => player_id === player.id && t === team);

  return (
    <div className="flex justify-around gap-4 flex-wrap">
      <section className="section grow">
        <h2 className="text-xl">Teams:</h2>
        <div className="mb-2">
          <h3 className="text-lg">Team A</h3>
          <ul>
            {match.players.filter(isTeam('a')).map((player) => (
              <li key={player.id}>{player.username}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg">Team B</h3>
          <ul>
            {match.players.filter(isTeam('b')).map((player) => (
              <li key={player.id}>{player.username}</li>
            ))}
          </ul>
        </div>
      </section>
      <section className="section grow h-fit">
        <h2 className="text-xl">Maps:</h2>
        <ul>
          {match.maps.map(({ name, id }) => (
            <li key={id}>{name}</li>
          ))}
        </ul>
      </section>
      <RoundsList />
    </div>
  );
}
