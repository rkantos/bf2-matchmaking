import { ActionFunction, LoaderFunction, json, LoaderArgs } from '@remix-run/node'; // change this import to whatever runtime you are using
import { Auth, ThemeSupa } from '@supabase/auth-ui-react';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import invariant from 'tiny-invariant';
import { createServerClient } from '@supabase/auth-helpers-remix';
import { Link, useLoaderData } from '@remix-run/react';

export const loader = async ({ request }: LoaderArgs) => {
  const response = new Response();
  invariant(process.env.SUPABASE_URL, 'Missing "process.env.SUPABASE_URL"');
  invariant(process.env.SUPABASE_ANON_KEY, 'Missing "process.env.SUPABASE_ANON_KEY"');

  const supabaseClient = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { request, response }
  );

  const { data: matches } = await supabaseClient.from('matches').select('*');

  return json({ matches });
};

export default function Index() {
  const { matches } = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
      <ul>
        {matches?.map((match) => (
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
