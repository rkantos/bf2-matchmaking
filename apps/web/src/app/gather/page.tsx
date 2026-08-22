import { verify } from '@bf2-matchmaking/utils';
import { api } from '@bf2-matchmaking/services/api';
import ServerSection from '@/components/gather/ServerSection';
import { Suspense } from 'react';
import EventsSection from '@/components/gather/EventsSection';
import PlayersSection from '@/components/gather/PlayersSection';
import { supabase } from '@/lib/supabase/supabase-server';
import { cookies } from 'next/headers';
import { verifySingleResult } from '@bf2-matchmaking/supabase';
import ConnectionsSection from '@/components/gather/ConnectionsSection';
import SectionFallback from '@/components/commons/SectionFallback';
import DraftSection from '@/components/gather/DraftSection';
import AdminSection from '@/components/gather/AdminSection';
import { GatherStatus } from '@bf2-matchmaking/types/gather';

const GATHER_CONFIG = 20;

const statusBadgeClass: Record<GatherStatus, string> = {
  [GatherStatus.Queueing]: 'badge-info',
  [GatherStatus.Summoning]: 'badge-warning',
  [GatherStatus.Drafting]: 'badge-accent',
  [GatherStatus.Starting]: 'badge-success',
  [GatherStatus.Aborting]: 'badge-error',
  [GatherStatus.Failed]: 'badge-error',
};

interface Props {
  searchParams: Promise<{ auto?: string }>;
}

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const config = await supabase(cookieStore)
    .getMatchConfig(GATHER_CONFIG)
    .then(verifySingleResult);
  const gatherResponse = await api.getGather(config.id).then(verify);
  const { state, events, players, summonTimeout, draftMode, draft } = gatherResponse;
  const testClients = gatherResponse.testClients ?? { teamspeak: 0, bf2: 0 };
  const connections = gatherResponse.connections ?? {};

  return (
    <main className="main">
      <h1>{config.name}</h1>
      <div className="flex items-center gap-3">
        <span className={`badge badge-lg ${statusBadgeClass[state.status]}`}>
          {state.status}
        </span>
        <span className="text-sm text-base-content/60">
          {players.length}/{config.size} players
        </span>
      </div>
      <div className="flex gap-8  mt-8">
        <Suspense fallback={<SectionFallback title="Connections" />}>
          <ConnectionsSection config={config} serverAddress={state.address} players={players} />
        </Suspense>
        {draft ? (
          <Suspense fallback={<SectionFallback title="Drafting" />}>
            <DraftSection config={config} draft={draft} connections={connections} />
          </Suspense>
        ) : (
          <PlayersSection players={players} connections={connections} />
        )}
        <Suspense fallback={<SectionFallback title="No server selected" />}>
          <ServerSection
            address={state.address}
            configId={config.id}
            gatherStatus={state.status}
          />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <AdminSection
          config={config}
          summonTimeout={summonTimeout}
          draftMode={draftMode}
          testClients={testClients}
        />
      </Suspense>
      <EventsSection config={config.id} events={events} />
    </main>
  );
}
