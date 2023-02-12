import { MatchesJoined } from '@bf2-matchmaking/types';

const getMatchIdText = (match: MatchesJoined) => `Match ${match.id}`;
export const getEmbedTitle = (match: MatchesJoined) =>
  `${getMatchIdText(match)}: ${match.status}`;

export const isMatchTitle = (match: MatchesJoined, title?: string) =>
  title?.startsWith(getMatchIdText(match)) || false;
