import { useLoaderData } from '@remix-run/react';
import { loader } from '~/routes/matches/$matchId';
import { PlayersRow } from '@bf2-matchmaking/types';
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
      <div className="grow">
        <section className="section h-fit mb-4">
          <h2 className="text-xl">Maps:</h2>
          <ul>
            {match.maps.map(({ name, id }) => (
              <li key={id}>{name}</li>
            ))}
          </ul>
        </section>
        {match.server && (
          <section className="section h-fit">
            <h2 className="text-xl mb-4">Server: {match.server.name}</h2>
            <a
              className="block underline text-blue-800 mb-4"
              href={`https://joinme.click/g/bf2/${match.server.ip}:${match.server.port}`}
              target="_blank"
            >
              https://joinme.click/{match.server.ip}
            </a>
            <a
              className="filled-button"
              href={`https://joinme.click/g/bf2/${match.server.ip}:${match.server.port}`}
              target="_blank"
            >
              BF2 Join Me
            </a>
          </section>
        )}
      </div>
      <RoundsList />
    </div>
  );
}
