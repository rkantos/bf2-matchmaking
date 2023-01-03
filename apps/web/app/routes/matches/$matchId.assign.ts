import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import invariant from 'tiny-invariant';
import { isAssignedTeam } from '~/utils/match-utils';
import { remixClient } from '@bf2-matchmaking/supabase';

export const loader: LoaderFunction = ({ request, params }) => {
  return redirect(`/matches/${params['matchId']}`);
};

export const action: ActionFunction = async ({ request, params }) => {
  try {
    const client = remixClient(request);
    const formData = await request.formData();
    const playerId = formData.get('playerId')?.toString();
    const team = formData.get('team')?.toString();
    invariant(playerId, 'playerId not defined');
    invariant(team, 'Team not defined');
    const matchId = params['matchId'] ? parseInt(params['matchId']) : undefined;
    const { data: match } = await client.getMatch(matchId);
    invariant(match, 'No match found');

    if (isAssignedTeam(match, playerId)) {
      throw new Error('Player already assigned');
    }
    const result = await client.updateMatchPlayer(match.id, playerId, { team });

    if (result.error) {
      return json(result.error, { status: result.status });
    }

    return redirect(`/matches/${params['matchId']}`);
  } catch (err) {
    console.error(err);
    return json(err, { status: 500 });
  }
};
