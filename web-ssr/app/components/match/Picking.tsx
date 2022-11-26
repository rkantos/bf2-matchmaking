import { useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useEffect } from 'react';
import { Player } from '~/lib/supabase.server';
import { loader } from '~/routes/matches/$matchId';

export default function Picking() {
  const { match } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const user = useUser();
  const supabase = useSupabaseClient();

  const isTeam = (team: string | null) => (player: Player) =>
    match.teams.some(({ player_id, team: t }) => player_id === player.id && t === team);

  const playerPool = match.players.filter(isTeam(null));

  const team = match.teams.find(({ player_id }) => user && player_id === user.id)?.team;

  const isTeamCaptain = (team: string | null) => {
    const player = match.teams.find(({ player_id }) => user && player_id === user.id);
    return Boolean(player?.captain && player.team === team);
  };

  const canPick = playerPool.length % 2 === 0 ? isTeamCaptain('a') : isTeamCaptain('b');

  useEffect(() => {
    const channel = supabase
      .channel('public:match_players')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_players' }, () =>
        navigate('.', { replace: true })
      )
      .subscribe();
    () => channel.unsubscribe();
  }, [supabase]);

  const assignPlayer = (playerId: string, team: string) => () =>
    submit(
      { playerId, team },
      { method: 'post', action: `/matches/${match.id}/assign`, replace: true }
    );

  return (
    <article className="max-w-3xl mt-4 flex justify-between">
      <section>
        <h2>Player pool:</h2>
        <ul>
          {playerPool.map((player) => (
            <li key={player.id}>
              <span>{player.username}</span>
              {team && canPick && (
                <button
                  className="inline-block underline ml-2"
                  onClick={assignPlayer(player.id, team)}
                >
                  Pick
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl">Teams:</h2>
        <div className="flex gap-8">
          <div className="mb-2">
            <h3 className="text-lg">Team A</h3>
            <ul>
              {match.players.filter(isTeam('a')).map((player) => (
                <li key={player.id}>{player.username}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-lg">Team B</h3>
            <ul>
              {match.players.filter(isTeam('b')).map((player) => (
                <li key={player.id}>{player.username}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </article>
  );
}
