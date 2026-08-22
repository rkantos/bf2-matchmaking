import { GatherPlayer, MatchConfigsRow } from '@bf2-matchmaking/types';
import { session } from '@/lib/supabase/supabase-server';
import { getGuildMember } from '@bf2-matchmaking/discord';
import { api, verify } from '@bf2-matchmaking/utils';
import Link from 'next/link';
import { TEAMSPEAK_SERVER_URI } from '@bf2-matchmaking/teamspeak';
import SearchParamToggle from '@/components/gather/SearchParamToggle';
import AutoJoinBf2 from '@/components/gather/AutoJoinBf2';
import { GatherStatus } from '@bf2-matchmaking/types/gather';

interface Props {
  config: MatchConfigsRow;
  serverAddress: string | undefined;
  players: Array<GatherPlayer>;
  status: GatherStatus;
  /** Set for the duration of a summon; identifies which one. */
  summonedAt: string | number | undefined;
  /** The `auto` search param that the toggle below writes. */
  autoJoin: boolean;
}
export default async function ConnectionsSection({
  config,
  serverAddress,
  players,
  status,
  summonedAt,
  autoJoin,
}: Props) {
  const player = await session.getSessionPlayerSafe();
  if (!player) {
    return (
      <section className="section">
        <h2>Connections</h2>
        <p>Sign in to view your Discord, TeamSpeak and BF2 connections.</p>
      </section>
    );
  }
  const guildMember = config.guild
    ? await getGuildMember(config.guild, player.id).then(({ data }) => data)
    : null;

  const server = serverAddress ? await api.v2.getServer(serverAddress).then(verify) : null;
  const isConnectedBf2Server = server?.live?.players.some(
    (serverPlayer) => serverPlayer.keyhash === player.keyhash
  );
  const isInQueue =
    player.teamspeak_id != null &&
    players.some((p) => p.teamspeak_id === player.teamspeak_id);

  return (
    <section className="section">
      <h2>Connections</h2>
      <h3>Discord</h3>
      {!config.guild ? (
        <p>Discord is not required for this gather.</p>
      ) : guildMember ? (
        <>
          <p>{guildMember.nick || guildMember.user.global_name || 'unknown'}</p>
          <Link
            className="link"
            href={`https://discord.com/channels/${config.guild}/${config.channel}`}
            target="_blank"
          >
            Go to discord
          </Link>
        </>
      ) : (
        <Link className="link" href="https://discord.gg/FK2fhUgdFu" target="_blank">
          Join discord
        </Link>
      )}
      <h3>Teamspeak</h3>
      {player.teamspeak_id ? (
        isInQueue ? (
          <p>In queue</p>
        ) : (
          <>
            <p>Registered ({player.teamspeak_id})</p>
            <Link className="link" href={TEAMSPEAK_SERVER_URI}>
              Connect to queue
            </Link>
          </>
        )
      ) : (
        <>
          <p>No Teamspeak ID registered</p>
          <Link className="link" href={`/gather/register?tsid=`}>
            Register Teamspeak ID
          </Link>
        </>
      )}
      <h3>BF2 Server</h3>
      {isConnectedBf2Server ? <p>Connected</p> : <p>Not connected</p>}
      {!isConnectedBf2Server && server?.data && (
        <>
          <Link href={server.data.joinmeHref}>Join me</Link>
          <Link href={server.data.joinmeDirect}>Start bf2</Link>
        </>
      )}
      <SearchParamToggle param="auto" label="Auto join BF2 server" />
      <AutoJoinBf2
        enabled={autoJoin}
        active={status === GatherStatus.Summoning && Boolean(isInQueue) && !isConnectedBf2Server}
        joinUrl={server?.data?.joinmeDirect}
        summonKey={String(summonedAt ?? 'none')}
      />
    </section>
  );
}
