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

  console.log(user);

  const playerCount = match.players.length;
  const hasJoined = match.players.some((player) => player.id === user?.id);

  const startMatch = () => {};

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
      <h1>Match {match.id}</h1>
      <p>{match.status}</p>
      <h2>
        Players({playerCount}/{match.size}):
      </h2>
      <ul>
        {match.players?.map((player, i) => (
          <li key={i}>{player.username}</li>
        ))}
      </ul>
      {hasJoined ? (
        <Form method="post" action="./leave">
          <button type="submit" className="filled-button">
            Leave match
          </button>
        </Form>
      ) : (
        <Form method="post" action="./join">
          <button type="submit" className="filled-button">
            Join match
          </button>
        </Form>
      )}
      <button className="filled-button" onClick={startMatch}>
        Start match
      </button>
    </div>
  );
}
