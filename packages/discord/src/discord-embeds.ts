import { MatchesJoined, MatchStatus } from '@bf2-matchmaking/types';
import { APIEmbed } from 'discord-api-types/v10';
import {
  getDraftStep,
  getDurationString,
  getPlayersReadyStatus,
  getTeamPlayers,
  getTimeLeft,
} from '@bf2-matchmaking/utils';
import { stringify } from 'querystring';

export const getMatchEmbed = (match: MatchesJoined, description?: string): APIEmbed => ({
  title: `Match ${match.id}: ${match.status}`,
  description: description || getMatchDescription(match),
  fields: getMatchFields(match),
  url: `https://bf2-matchmaking.netlify.app/matches/${match.id}`,
});

const getMatchDescription = (match: MatchesJoined): string | undefined => {
  if (match.status === MatchStatus.Summoning && match.ready_at) {
    const timeLeft = getTimeLeft(match.ready_at);
    return `Ready check ends in: ${getDurationString(timeLeft)}`;
  }
  if (match.status === MatchStatus.Drafting) {
    const { captain } = getDraftStep(match);
    return captain ? `${captain.username} is picking` : undefined;
  }
};

const getMatchFields = (match: MatchesJoined) =>
  createCurrentPlayersFields(match)
    .concat(createSummoningFields(match))
    .concat(createPoolFields(match))
    .concat(createTeamFields(match))
    .concat(createServerFields(match));

const createCurrentPlayersFields = ({ status, players, size }: MatchesJoined) =>
  status === MatchStatus.Open
    ? [
        {
          name: 'Players',
          value: `${players.length}/${size} | ${players
            .map((player) => player.full_name)
            .join(', ')}`,
        },
      ]
    : [];

const createSummoningFields = (match: MatchesJoined) =>
  match.status === MatchStatus.Summoning
    ? [
        {
          name: 'Ready players',
          value: getPlayersReadyStatus(match)
            .map(({ name, ready }) => `${ready ? '✅' : '❌'}  ${name}`)
            .join('\n'),
        },
      ]
    : [];

const createPoolFields = (match: MatchesJoined) =>
  match.status === MatchStatus.Drafting && getTeamPlayers(match, null).length > 0
    ? [
        {
          name: 'Pool',
          value: getTeamPlayers(match, null)
            .map((player) => player.full_name)
            .join(', '),
        },
      ]
    : [];

const createTeamFields = (match: MatchesJoined) =>
  match.status === MatchStatus.Drafting ||
  match.status === MatchStatus.Ongoing ||
  match.status === MatchStatus.Closed
    ? [
        {
          name: 'Team A',
          value: getTeamPlayers(match, 'a')
            .map((player) => player.full_name)
            .join(', '),
        },
        {
          name: 'Team B',
          value: getTeamPlayers(match, 'b')
            .map((player) => player.full_name)
            .join(', '),
        },
      ]
    : [];

const createServerFields = (match: MatchesJoined) =>
  (match.status === MatchStatus.Drafting || match.status === MatchStatus.Ongoing) &&
  match.server
    ? [
        {
          name: match.server.name,
          value: `[https://joinme.click/${match.server.ip}](https://joinme.click/g/bf2/${match.server.ip}:${match.server.port})`,
        },
      ]
    : [];
