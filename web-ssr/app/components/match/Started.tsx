import { useLoaderData } from '@remix-run/react';
import { Player } from '~/lib/supabase.server';
import { loader } from '~/routes/matches/$matchId';

export default function Started() {
  const { match } = useLoaderData<typeof loader>();

  const isTeam = (team: string) => (player: Player) =>
    match.teams.some(({ player_id, team: t }) => player_id === player.id && t === team);

  return (
    <section className="flex justify-around">
      <div>
        <h2 className="text-xl">Teams:</h2>
        <div className="mb-2">
          <h3 className="text-lg">Team A</h3>
          <ul>
            {match.players.filter(isTeam('a')).map((player) => (
              <li>{player.username}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg">Team B</h3>
          <ul>
            {match.players.filter(isTeam('b')).map((player) => (
              <li>{player.username}</li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <h2 className="text-xl">Maps:</h2>
        <ul>
          {match.maps.map(({ name }) => (
            <li>{name}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
