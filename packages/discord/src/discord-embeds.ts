import { MatchesJoined, MatchStatus, PlayersRow } from '@bf2-matchmaking/types';
import { APIEmbed } from 'discord-api-types/v10';

export const getMatchEmbed = (match: MatchesJoined): APIEmbed => ({
  title: `Match ${match.id}: ${match.status}`,
  fields: getMatchFields(match),
  url: `https://bf2-matchmaking.netlify.app/matches/${match.id}`,
});
export const getMatchFields = (match: MatchesJoined) => {
  const fields = [];
  if (match.status === MatchStatus.Drafting && getTeamPlayers(match, null).length) {
    fields.push({
      name: 'Pool',
      value: getTeamPlayers(match, null)
        .map((player) => player.full_name)
        .join(', '),
    });
  }
  if (match.status !== MatchStatus.Open) {
    fields.push(
      ...[
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
    );
  }
  if (match.status === MatchStatus.Open) {
    const count = match.players.length;
    fields.push({
      name: 'Players',
      value: `${count}/${match.size} | ${match.players
        .map((player) => player.full_name)
        .join(', ')}`,
    });
  }

  if (match.status === MatchStatus.Drafting && match.server) {
    fields.push({
      name: match.server.name,
      value: `[https://joinme.click/${match.server.ip}](https://joinme.click/g/bf2/${match.server.ip}:${match.server.port})`,
    });
  }
  return fields;
};

export const getTeamPlayers = (match: MatchesJoined, team: 'a' | 'b' | null) =>
  match.teams
    .filter((player) => player.team === team)
    .map((teamPlayer) =>
      match.players.find((player) => player.id === teamPlayer.player_id)
    )
    .filter((player): player is PlayersRow => player !== undefined);
