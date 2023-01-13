import { client, verifySingleResult } from '@bf2-matchmaking/supabase';
import { MatchPlayersRow } from '@bf2-matchmaking/types';
import { sendChannelMessage } from '@bf2-matchmaking/discord';

export const sendMatchJoinMessage = async (
  { player_id }: MatchPlayersRow,
  channelId: string
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(channelId, `${player.full_name} joined`);
};

export const sendMatchLeaveMessage = async (
  { player_id }: Partial<MatchPlayersRow>,
  channelId: string
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(channelId, `${player.full_name} left`);
};

export const sendMatchPickMessage = async (
  { player_id, team }: MatchPlayersRow,
  channelId: string
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(channelId, `${player.full_name} assigned to team ${team}`);
};
