import { DiscordMatch, MatchesJoined } from './database-types';

export const isDiscordMatch = (match: MatchesJoined): match is DiscordMatch =>
  Boolean(match.channel);
