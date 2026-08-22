import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase/supabase-server';
import { MatchConfigsRow } from '@bf2-matchmaking/types';
import SummonTimeoutSlider from '@/components/gather/SummonTimeoutSlider';
import {
  setDraftMode,
  setSummonTimeout,
  setTestClientCount,
} from '@/app/gather/actions';
import DraftModeToggle from '@/components/gather/DraftModeToggle';
import { GatherDraftMode } from '@bf2-matchmaking/types/gather';
import TestClientSlider from '@/components/gather/TestClientSlider';

interface Props {
  config: MatchConfigsRow;
  summonTimeout: number;
  draftMode: GatherDraftMode;
  testClients: { teamspeak: number; bf2: number };
}

/**
 * Admin-only gather controls.
 *
 * The gather page itself has no role check, so the gating lives here: renders
 * nothing unless the viewer holds match_admin or system_admin. The api enforces
 * the same requirement independently, so hiding the control is presentation
 * only, not the security boundary.
 */
export default async function AdminSection({
  config,
  summonTimeout,
  draftMode,
  testClients,
}: Props) {
  const cookieStore = await cookies();
  const { data: adminRoles } = await supabase(cookieStore).getAdminRoles();

  if (!adminRoles?.match_admin && !adminRoles?.system_admin) {
    return null;
  }

  async function setSummonTimeoutSA(value: number) {
    'use server';
    return setSummonTimeout(config.id, value);
  }

  async function setDraftModeSA(value: GatherDraftMode) {
    'use server';
    return setDraftMode(config.id, value);
  }

  async function setTeamspeakClientsSA(value: number) {
    'use server';
    return setTestClientCount(config.id, 'teamspeak', value);
  }

  async function setBf2ClientsSA(value: number) {
    'use server';
    return setTestClientCount(config.id, 'bf2', value);
  }

  return (
    <section className="section">
      <h2>Gather Admin</h2>
      <div className="flex flex-wrap gap-10">
        <SummonTimeoutSlider
          configId={config.id}
          summonTimeout={summonTimeout}
          onChange={setSummonTimeoutSA}
        />
        <DraftModeToggle draftMode={draftMode} onChange={setDraftModeSA} />
        <TestClientSlider
          kind="teamspeak"
          initialCount={testClients.teamspeak}
          onChange={setTeamspeakClientsSA}
        />
        <TestClientSlider
          kind="bf2"
          initialCount={testClients.bf2}
          onChange={setBf2ClientsSA}
        />
      </div>
    </section>
  );
}
