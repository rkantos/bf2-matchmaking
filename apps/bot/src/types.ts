import { DiscordChannelsRow, MatchesJoined } from '@bf2-matchmaking/types';

export interface PostMatchEventRequestBody {
  event: 'Summon' | 'Draft';
  matchId: number;
}

export interface DiscordMatch extends MatchesJoined {
  channel: DiscordChannelsRow;
}

export const isDiscordMatch = (match: MatchesJoined): match is DiscordMatch =>
  Boolean(match.channel);
