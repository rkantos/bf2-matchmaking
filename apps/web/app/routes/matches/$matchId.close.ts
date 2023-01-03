import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import { createMatchMaps, initSupabase, updateMatch } from '~/lib/supabase.server';
import { remixClient } from '@bf2-matchmaking/supabase';

export const loader: LoaderFunction = ({ request, params }) => {
  return redirect(`/matches/${params['matchId']}`);
};

export const action: ActionFunction = async ({ request, params }) => {
  try {
    const client = remixClient(request);
    const { error, status } = await client.updateMatch(params['matchId'], { status: 'closed' });

    if (error) {
      return json(error, { status: status });
    }

    return redirect(`/matches/${params['matchId']}`);
  } catch (err) {
    console.error(err);
    return json(err, { status: 500 });
  }
};
