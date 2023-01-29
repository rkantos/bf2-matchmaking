import { json, LoaderArgs } from '@remix-run/node';
import invariant from 'tiny-invariant';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect } from 'react';
import DraftingContainer from '~/components/match/DraftingContainer';
import StagingContainer from '~/components/match/StagingContainer';
import StartedContainer from '~/components/match/StartedContainer';
import MatchActions from '~/components/match/MatchActions';
import { getTeamCaptain } from '~/utils/match-utils';
import { remixClient } from '@bf2-matchmaking/supabase';
import { Database, MatchStatus } from '@bf2-matchmaking/types';

export const loader = async ({ request, params }: LoaderArgs) => {
  const client = remixClient(request);
  const matchId = params['matchId'] ? parseInt(params['matchId']) : undefined;
  const { data: match } = await client.getMatch(matchId);
  const { data: servers } = await client.getServers();
  invariant(match, 'Match not found');
  const rounds = await client.services.getMatchRounds(match);
  return json(
    { match, servers, rounds },
    {
      headers: client.response.headers,
    }
  );
};

export default function Index() {
  const { match } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const user = useUser();
  const supabase = useSupabaseClient<Database>();

  const playerPool = match.teams.filter(({ team }) => team === null);
  const currentTeam = playerPool.length % 2 === 0 ? 'a' : 'b';
  const currentPicker = getTeamCaptain(match, currentTeam);

  useEffect(() => {
    const channel = supabase
      .channel('public:match_players')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_players' }, () => {
        navigate('.', { replace: true });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'match_players' }, () => {
        navigate('.', { replace: true });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_players' }, () => {
        navigate('.', { replace: true });
      })
      .subscribe();
    () => channel.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        navigate('.', { replace: true });
      })
      .subscribe();
    () => channel.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel('public:rounds')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rounds' }, (event) => {
        if (match.server && match.server.ip === event.new.server) {
          navigate('.', { replace: true });
        }
      })
      .subscribe();
    () => channel.unsubscribe();
  }, [supabase]);

  return (
    <article className="route">
      <div className="flex flex-col justify-between mb-4">
        <div className="mb-4 section">
          <h1 className="text-2xl">Match {match.id}</h1>
          <span className="mr-4">Status: {match.status}</span>
          <span>Pick mode: {match.pick}</span>
          {match.channel && <span className="ml-4">Channel: {match.channel.name}</span>}
          {currentPicker && <span className="ml-4">Picking: {currentPicker.username}</span>}
          {match.server && <span className="ml-4">Server: {match.server.name}</span>}
        </div>
        {match.status === MatchStatus.Open && <StagingContainer />}
        {match.status === MatchStatus.Summoning && <StagingContainer />}
        {match.status === MatchStatus.Drafting && (
          <DraftingContainer currentPicker={currentPicker} currentTeam={currentTeam} />
        )}
        {match.status === MatchStatus.Ongoing && <StartedContainer />}
        {match.status === MatchStatus.Closed && <StartedContainer />}
      </div>
      {user && <MatchActions match={match} user={user} />}
    </article>
  );
}
