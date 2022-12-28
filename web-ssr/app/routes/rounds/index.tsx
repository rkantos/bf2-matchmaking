import React from 'react';
import { json, LoaderArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { getRounds, initSupabase, JoinedRound } from '../../lib/supabase.server';
import { groupRoundsByServer } from '../../utils/round-utils';
import RoundItem from '../../components/round/RoundItem';

export const loader = async ({ request, params }: LoaderArgs) => {
  const response = initSupabase(request);
  const { data: rounds, error, status } = await getRounds();

  if (error) {
    throw json(error, { status });
  }

  return json(
    { rounds },
    {
      headers: response.headers,
    }
  );
};

export default function Index() {
  const { rounds } = useLoaderData<typeof loader>();
  const groupedByServer = groupRoundsByServer(rounds);
  return (
    <article>
      <h1 className="text-2xl">Rounds</h1>
      {groupedByServer.map(([serverName, serverRounds]) => (
        <section key={serverName}>
          <h2 className="text-lg">Server: {serverName}</h2>
          <ul>
            {serverRounds.map((round) => (
              <RoundItem round={round} key={round.id} />
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
