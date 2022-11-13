import { json, LoaderArgs } from '@remix-run/node'; // change this import to whatever runtime you are using
import invariant from 'tiny-invariant';
import { Form, useLoaderData } from '@remix-run/react';
import { getMatch, initSupabase } from '~/lib/supabase.server';
import { useUser } from '@supabase/auth-helpers-react';

export const loader = async ({ request, params }: LoaderArgs) => {
  const response = initSupabase(request);

  const { data: match, error } = await getMatch(params['matchId']);

  invariant(match, 'Match not found');

  return json(
    { match },
    {
      headers: response.headers,
    }
  );
};

export default function Index() {
  const { match } = useLoaderData<typeof loader>();
  const user = useUser();

  const playerCount = match.players.length;
  const hasJoined = match.players.some((player) => player.id === user?.id);

  return (
    <article>
      <h1>Match {match.id}</h1>
      <p>{match.status}</p>
      <section>
        <h2>
          Players({playerCount}/{match.size}):
        </h2>
        <ul>
          {match.players?.map((player, i) => (
            <li key={i}>{player.username}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Maps:</h2>
        <ul>
          {match.maps.map((map) => (
            <li key={map.id}>{map.name}</li>
          ))}
        </ul>
      </section>
      {hasJoined ? (
        <Form method="post" action="./leave">
          <button type="submit" className="filled-button" disabled={match.status !== 'open'}>
            Leave match
          </button>
        </Form>
      ) : (
        <Form method="post" action="./join">
          <button type="submit" className="filled-button" disabled={playerCount >= match.size}>
            Join match
          </button>
        </Form>
      )}
      {match.status === 'open' && (
        <Form method="post" action="./start">
          <button type="submit" className="filled-button" disabled={playerCount < match.size}>
            Start match
          </button>
        </Form>
      )}
      {match.status === 'started' && (
        <Form method="post" action="./close">
          <button type="submit" className="filled-button">
            Close match
          </button>
        </Form>
      )}
    </article>
  );
}
