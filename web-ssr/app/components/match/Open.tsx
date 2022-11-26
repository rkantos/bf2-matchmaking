import { useLoaderData } from '@remix-run/react';
import { loader } from '~/routes/matches/$matchId';

export default function Open() {
  const { match } = useLoaderData<typeof loader>();

  const playerCount = match.players.length;

  return (
    <section>
      <h2 className="text-xl">
        Players({playerCount}/{match.size}):
      </h2>
      <ul>
        {match.players.map((player) => (
          <li key={player.id}>{player.username}</li>
        ))}
      </ul>
    </section>
  );
}
