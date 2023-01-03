import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import { createMatchMaps, initSupabase, updateMatch } from '~/lib/supabase.server';

export const loader: LoaderFunction = ({ request, params }) => {
  return redirect(`/matches/${params['matchId']}`);
};

export const action: ActionFunction = async ({ request, params }) => {
  try {
    initSupabase(request);
    const { error, status } = await updateMatch(params['matchId'], { status: 'closed' });

    if (error) {
      return json(error, { status: status });
    }

    return redirect(`/matches/${params['matchId']}`);
  } catch (err) {
    console.error(err);
    return json(err, { status: 500 });
  }
};
