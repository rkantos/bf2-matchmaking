import { json, LoaderArgs } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { remixClient, verifyResult } from '@bf2-matchmaking/supabase';
import QuickMatchSection from '~/components/match/QuickMatchSection';
import { usePlayer } from '~/state/PlayerContext';

export const loader = async ({ request }: LoaderArgs) => {
  const client = remixClient(request);
  try {
    const configs = await client.getMatchConfigs().then(verifyResult);
    const quickMatches = await Promise.all(configs.map(client.services.getQuickMatchFromConfig));
    return json(
      { quickMatches },
      {
        headers: client.response.headers,
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Response(error.message);
    } else {
      throw error;
    }
  }
};

const authRedirect =
  process.env.NODE_ENV === 'production'
    ? 'https://bf2-matchmaking.netlify.app/matches/'
    : 'http://localhost:5003/matches/';

export default function Index() {
  const { player } = usePlayer();
  const { quickMatches } = useLoaderData<typeof loader>();

  if (!quickMatches) {
    return (
      <article className="route text-center">
        <Link className="filled-button" to="/matches">
          Go to matches
        </Link>
      </article>
    );
  }
  return (
    <article className="route">
      <h1 className="text-4xl font-bold text-center mb-6">Quick match</h1>
      <ul>
        {quickMatches.map(([matchConfig, match]) => (
          <li key={matchConfig.id}>
            <QuickMatchSection
              config={matchConfig}
              match={match}
              hasJoined={match.players.some((matchPlayer) => matchPlayer.id === player?.id)}
            />
          </li>
        ))}
      </ul>
    </article>
  );
}
