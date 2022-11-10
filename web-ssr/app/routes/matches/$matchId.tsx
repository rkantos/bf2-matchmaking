import { json, LoaderArgs } from '@remix-run/node'; // change this import to whatever runtime you are using
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import invariant from 'tiny-invariant';
import { Form, useLoaderData, useSubmit } from '@remix-run/react';
import { getMatch, initSupabase } from '~/lib/supabase.server';

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
  const submit = useSubmit();
  console.log(match);

  const joinMatch = () => {
    submit(null, { method: 'post', action: `./join` });
  };

  const startMatch = () => {};

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
      <h1>Match {match.id}</h1>
      <p>{match.status}</p>
      <h2>Players:</h2>
      <ul>
        {match.players.map((player, i) => (
          <li key={i}>{player.name}</li>
        ))}
      </ul>
      <Form method="post" action="./join">
        <button type="submit" className="filled-button">
          Join match
        </button>
      </Form>
      <button className="filled-button" onClick={startMatch}>
        Start match
      </button>
    </div>
  );
}
