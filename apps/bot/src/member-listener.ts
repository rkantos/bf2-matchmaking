import { getDiscordClient } from './client';
import { ApiError, ApiErrorType, DiscordMatch } from '@bf2-matchmaking/types';
import { info } from '@bf2-matchmaking/logging';
import { client } from '@bf2-matchmaking/supabase';

const matchChannelsMap = new Map<string, DiscordMatch>();

export const addChannel = async (channelId: string, match: DiscordMatch) => {
  const discordClient = await getDiscordClient();
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !channel.isVoiceBased()) {
    throw new ApiError(ApiErrorType.NotVoiceChannel);
  }
  if (matchChannelsMap.size === 0) {
    info('member-listener', `Adding voice listener for channel ${channelId}`);
    await addVoiceListener();
  }
  matchChannelsMap.set(channelId, match);
};

export const removeChannel = async (channelId: string) => {
  const discordClient = await getDiscordClient();
  matchChannelsMap.delete(channelId);
  if (matchChannelsMap.size === 0) {
    discordClient.removeAllListeners('voiceStateUpdate');
  }
};
const addVoiceListener = async () => {
  const discordClient = await getDiscordClient();
  discordClient.on('voiceStateUpdate', async (oldState, newState) => {
    const match = newState.channelId && matchChannelsMap.get(newState.channelId);
    const player = match && match.players.find((p) => p.id === newState.member?.id);
    if (newState.member && match && player) {
      const res = await client().updateMatchPlayer(match.id, player.id, { ready: true });
      console.log(res);
    }
  });
};

export const getVoiceMembers = async (match: DiscordMatch) => {
  const discordClient = await getDiscordClient();
  const guild = await discordClient.guilds.fetch(match.channel.server_id);
  const members = await guild.members.fetch({ withPresences: true });
  return [...members.filter((m) => m.voice.channelId).values()].map((m) => m.user.id);
};
