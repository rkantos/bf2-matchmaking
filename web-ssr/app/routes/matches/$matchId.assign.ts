import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import invariant from 'tiny-invariant';
import { getMatch, initSupabase, updateMatchPlayer } from '~/lib/supabase.server';
import { isAssignedTeam } from '~/utils/match-utils';

export const loader: LoaderFunction = ({ request, params }) => {
  return redirect(`/matches/${params['matchId']}`);
};

export const action: ActionFunction = async ({ request, params }) => {
  try {
    const formData = await request.formData();
    const playerId = formData.get('playerId')?.toString();
    const team = formData.get('team')?.toString();
    invariant(playerId, 'playerId not defined');
    invariant(team, 'Team not defined');

    initSupabase(request);
    const { data: match } = await getMatch(params['matchId']);
    invariant(match, 'No match found');

    if (isAssignedTeam(match, playerId)) {
      throw new Error('Player already assigned');
    }
    const result = await updateMatchPlayer(match.id, playerId, { team });

    if (result.error) {
      return json(result.error, { status: result.status });
    }

    return redirect(`/matches/${params['matchId']}`);
  } catch (err) {
    console.error(err);
    return json(err, { status: 500 });
  }
};
