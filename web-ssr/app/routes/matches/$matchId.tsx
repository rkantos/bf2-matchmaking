import { json, LoaderArgs } from '@remix-run/node'; // change this import to whatever runtime you are using
import invariant from 'tiny-invariant';
import { Form, useLoaderData, useNavigate } from '@remix-run/react';
import { getMatch, initSupabase, Player } from '~/lib/supabase.server';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';

export const loader = async ({ request, params }: LoaderArgs) => {
  const response = initSupabase(request);

  const { data: match, error, status } = await getMatch(params['matchId']);

  if (error) {
    console.log(error);
  }

  invariant(match, 'Match not found');

  return json(
    { match },
    {
      headers: response.headers,
    }
  );
};

export default function Index() {
  const { match } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const user = useUser();
  const supabase = useSupabaseClient();

  const playerCount = match.players.length;
  const hasJoined = match.players.some((player) => player.id === user?.id);

  const isTeam = (team: string) => (player: Player) =>
    match.teams.some(({ player_id, team: t }) => player_id === player.id && t === team);

  useEffect(() => {
    const channel = supabase
      .channel('public:match_players')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_players' }, () =>
        navigate('.', { replace: true })
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'match_players' }, () =>
        navigate('.', { replace: true })
      )
      .subscribe();
    () => channel.unsubscribe();
  }, [supabase]);

  return (
    <article className="max-w-3xl m-auto mt-4">
      <div className="flex justify-between mb-4">
        <div>
          <h1 className="text-2xl">Match {match.id}</h1>
          <p className="mb-4">Status: {match.status}</p>
          <section>
            <h2 className="text-xl">
              Players({playerCount}/{match.size}):
            </h2>
            <ul>
              {match.players.map((player) => (
                <li key={player.id}>
                  {`${player.username}, team: ${
                    match.teams.find(({ player_id }) => player_id === player.id)?.team
                  }`}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section>
          <h2 className="text-xl">Maps:</h2>
          <ul>
            {match.maps.map((map) => (
              <li key={map.id}>{map.name}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl">Teams:</h2>
          <div className="mb-2">
            <h3 className="text-lg">Team A</h3>
            <ul>
              {match.players.filter(isTeam('a')).map((player) => (
                <li>{player.username}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-lg">Team B</h3>
            <ul>
              {match.players.filter(isTeam('b')).map((player) => (
                <li>{player.username}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <div className="flex gap-2">
        {hasJoined ? (
          <Form method="post" action="./leave">
            <button type="submit" className="filled-button" disabled={match.status !== 'open'}>
              Leave match
            </button>
          </Form>
        ) : (
          <Form method="post" action="./join">
            <button type="submit" className="filled-button" disabled={playerCount >= match.size}>
              Join match
            </button>
          </Form>
        )}
        {match.status === 'open' && (
          <Form method="post" action="./start">
            <button type="submit" className="filled-button" disabled={playerCount < match.size}>
              Start match
            </button>
          </Form>
        )}
        {match.status === 'started' && (
          <Form method="post" action="./close">
            <button type="submit" className="filled-button">
              Close match
            </button>
          </Form>
        )}
      </div>
    </article>
  );
}
