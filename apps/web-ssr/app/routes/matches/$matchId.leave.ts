import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import invariant from 'tiny-invariant';
import {
  getSession,
  initSupabase,
  deleteMatchPlayer,
  getPlayerByUserId,
} from '../../lib/supabase.server';

export const loader: LoaderFunction = ({ request, params }) => {
  return redirect(`/matches/${params['matchId']}`);
};

export const action: ActionFunction = async ({ request, params }) => {
  try {
    initSupabase(request);
    const {
      data: { session },
    } = await getSession();

    invariant(session, 'No active session');
    const { data: player } = await getPlayerByUserId(session.user.id);
    invariant(player, 'Could not find player connected to user id.');
    const { error, status } = await deleteMatchPlayer(params['matchId']!, player.id);

    if (error) {
      return json(error, { status });
    }

    return redirect(`/matches/${params['matchId']}`);
  } catch (err) {
    console.error(err);
    return json(err, { status: 500 });
  }
};
