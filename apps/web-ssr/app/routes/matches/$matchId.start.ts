import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import invariant from 'tiny-invariant';
import {
  createMatchMaps,
  getMatch,
  initSupabase,
  updateMatch,
  updateMatchPlayer,
} from '~/lib/supabase.server';
import { assignMatchPlayerTeams } from '~/utils/match-utils';

const getMaps = () => {
  const mapIds = new Set<number>();
  while (mapIds.size !== 2) {
    mapIds.add(Math.floor(Math.random() * 17) + 1);
  }
  return mapIds.values();
};

export const loader: LoaderFunction = ({ request, params }) => {
  return redirect(`/matches/${params['matchId']}`);
};

export const action: ActionFunction = async ({ request, params }) => {
  try {
    initSupabase(request);
    const { data: match } = await getMatch(params['matchId']);
    invariant(match, 'No match found');
    const addResult = await createMatchMaps(params['matchId']!, ...getMaps());
    if (match.pick === 'random') {
      await Promise.all(
        assignMatchPlayerTeams(match.players).map(({ playerId, team }) =>
          updateMatchPlayer(match.id, playerId, { team })
        )
      );
    }
    const startResult = await updateMatch(params['matchId'], { status: 'started' });

    if (addResult.error) {
      return json(addResult.error, { status: addResult.status });
    }

    if (startResult.error) {
      return json(startResult.error, { status: startResult.status });
    }

    return redirect(`/matches/${params['matchId']}`);
  } catch (err) {
    console.error(err);
    return json(err, { status: 500 });
  }
};
