import { json, LoaderArgs } from '@remix-run/node'; // change this import to whatever runtime you are using
import { Auth, ThemeSupa, ThemeMinimal } from '@supabase/auth-ui-react';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import invariant from 'tiny-invariant';
import { createServerClient } from '@supabase/auth-helpers-remix';
import { Link, useLoaderData } from '@remix-run/react';
import { isNotDeleted } from '~/utils/match-utils';

export const loader = async ({ request }: LoaderArgs) => {
  const response = new Response();
  invariant(process.env.SUPABASE_URL, 'Missing "process.env.SUPABASE_URL"');
  invariant(process.env.SUPABASE_ANON_KEY, 'Missing "process.env.SUPABASE_ANON_KEY"');

  const supabaseClient = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { request, response }
  );

  const { data: matches, error } = await supabaseClient
    .from('matches')
    .select('*')
    .eq('status', 'open');

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  return json(
    { session, matches },
    {
      headers: response.headers,
    }
  );
};

const authRedirect =
  process.env.NODE_ENV === 'production'
    ? 'https://bf2-matchmaking.netlify.app/matches/'
    : 'http://localhost:3000/matches/';

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
