import { json, LinksFunction, LoaderFunction, MetaFunction } from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from '@remix-run/react';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserClient, createServerClient } from '@supabase/auth-helpers-remix';
import { useState } from 'react';
import Header from './components/Header';
import styles from './styles/app.css';

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }];
};

export const meta: MetaFunction = () => ({
  charset: 'utf-8',
  title: 'BF2 Matchmaking',
  viewport: 'width=device-width,initial-scale=1',
});

export const loader: LoaderFunction = async ({ request }) => {
  // environment variables may be stored somewhere other than
  // `process.env` in runtimes other than node
  // we need to pipe these Supabase environment variables to the browser
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  // We can retrieve the session on the server and hand it to the client.
  // This is used to make sure the session is available immediately upon rendering
  const response = new Response();
  const supabaseClient = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { request, response }
  );
  const {
    data: { session: initialSession },
  } = await supabaseClient.auth.getSession();

  // in order for the set-cookie header to be set,
  // headers must be returned as part of the loader response
  return json(
    {
      initialSession,
      env: {
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      },
    },
    {
      headers: response.headers,
    }
  );
};

export default function App() {
  const { env, initialSession } = useLoaderData<typeof loader>();
  const [supabaseClient] = useState(() =>
    createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  );

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <SessionContextProvider supabaseClient={supabaseClient} initialSession={initialSession}>
          <Header />
          <main className="mx-4 w-full md:w-3/4 md:mx-auto">
            <Outlet />
          </main>
        </SessionContextProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
