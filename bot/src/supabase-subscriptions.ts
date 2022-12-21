import { REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from '@supabase/supabase-js';
import { error } from './libs/logging';
import { onMatchesInsert, onMatchPlayersChange } from './libs/supabase/supabase';
import {
  getMatchInfo,
  getMatchJoinMessage,
  getMatchLeaveMessage,
  getMatchPickMessage,
  getNewMatchInfo,
} from './services/match';
import { DiscordRequest } from './utils';

export const subscribeMatchPlayers = async () => {
  onMatchPlayersChange(async (payload) => {
    try {
      switch (payload.eventType) {
        case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.INSERT:
          const { embed, channelId } = await getMatchInfo(payload.new.match_id);
          const content = await getMatchJoinMessage(payload.new);
          await sendChannelMessage(channelId, content, embed);
          break;
        case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.DELETE: {
          const { embed, channelId } = await getMatchInfo(payload.old.match_id);
          const content = await getMatchLeaveMessage(payload.old);
          await sendChannelMessage(channelId, content, embed);
          break;
        }
        case REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.UPDATE: {
          const { embed, channelId } = await getMatchInfo(payload.old.match_id);
          const content = await getMatchPickMessage(payload.new);
          await sendChannelMessage(channelId, content, embed);
          break;
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        error('discord-gateway', e.message);
      } else if (typeof e === 'string') {
        error('discord-gateway', e);
      } else {
        error('discord-gateway', JSON.stringify(e));
      }
    }
  });
};

export const subscribeMatches = () =>
  onMatchesInsert(async (payload) => {
    try {
      const { channelId, embed } = await getNewMatchInfo(payload.new);
      await sendChannelMessage(channelId, 'New match created', embed);
    } catch (e) {
      if (e instanceof Error) {
        error('discord-gateway', e.message);
      } else if (typeof e === 'string') {
        error('discord-gateway', e);
      } else {
        error('discord-gateway', JSON.stringify(e));
      }
    }
  });

const sendChannelMessage = (channelId: string, content: string, embed: unknown) =>
  DiscordRequest(`channels/${channelId}/messages`, {
    method: 'POST',
    body: {
      content,
      embeds: [embed],
    },
  });
