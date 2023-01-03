import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import invariant from 'tiny-invariant';
import { getMatch, initSupabase, updateMatch, updateMatchPlayer } from '~/lib/supabase.server';
import { assignMatchPlayerTeams, shuffleArray } from '~/utils/match-utils';

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

    const shuffledPlayers = match.players; /*shuffleArray(match.players).filter(
      ({ id }) => id !== '45e66c7c-fce5-485c-9edd-a3dd84a0cb17'
    );*/
    if (shuffledPlayers.length < 2) {
      throw new Error('To few players for captian mode.');
    }
    await updateMatchPlayer(match.id, shuffledPlayers[0].id, { team: 'a', captain: true });
    await updateMatchPlayer(match.id, shuffledPlayers[1].id, { team: 'b', captain: true });

    const result = await updateMatch(params['matchId'], { status: 'picking' });
    if (result.error) {
      return json(result.error, { status: result.status });
    }

    return redirect(`/matches/${params['matchId']}`);
  } catch (err) {
    console.error(err);
    return json(err, { status: 500 });
  }
};
