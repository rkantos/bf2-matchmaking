import { json, LoaderArgs } from '@remix-run/node'; // change this import to whatever runtime you are using
import { Auth, ThemeSupa } from '@supabase/auth-ui-react';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { Link, useLoaderData } from '@remix-run/react';
import { isNotDeleted } from '~/utils/match-utils';
import { remixClient } from '@bf2-matchmaking/supabase';

export const loader = async ({ request }: LoaderArgs) => {
  const client = remixClient(request);
  const { data: session } = await client.getSession();
  const { data: matches } = await client.getOpenMatches();

  return json(
    { session, matches },
    {
      headers: client.response.headers,
    }
  );
};

const authRedirect =
  process.env.NODE_ENV === 'production'
    ? 'https://bf2-matchmaking.netlify.app/matches/'
    : 'http://localhost:5003/matches/';

export default function Index() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const { session, matches } = useLoaderData<typeof loader>();

  if (!user) {
    return (
      <div className="max-w-[200px] m-auto text-center">
        <p>Login</p>
        <Auth
          redirectTo={authRedirect}
          appearance={{ theme: ThemeSupa }}
          supabaseClient={supabase}
          providers={['discord']}
          socialLayout="horizontal"
          onlyThirdPartyProviders={true}
        />
      </div>
    );
  }
  return (
    <div>
      <h1>BF2 Matchmaking</h1>
      <Link className="filled-button mt-4" to="/matches">
        Go to matches
      </Link>
      <ul>
        {matches?.filter(isNotDeleted).map((match) => (
          <li key={match.id}>
            <Link
              to={`/matches/${match.id}`}
            >{`${match.id} - ${match.status} - ${match.created_at}`}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
