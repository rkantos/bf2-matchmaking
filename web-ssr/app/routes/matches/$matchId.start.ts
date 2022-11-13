import { ActionFunction, json, LoaderFunction, redirect } from '@remix-run/node';
import { addMapsToMatch, initSupabase, updateMatch } from '~/lib/supabase.server';

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
    const addResult = await addMapsToMatch(params['matchId']!, ...getMaps());
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
