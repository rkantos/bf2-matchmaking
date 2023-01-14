import { MatchesJoined, PlayersRow } from '@bf2-matchmaking/types';

export const getMatchEmbed = (match: MatchesJoined) => ({
  title: `Match ${match.id}: ${match.status}`,
  fields: getMatchFields(match),
  url: `https://bf2-matchmaking.netlify.app/matches/${match.id}`,
});
export const getMatchFields = (match: MatchesJoined) => {
  const fields = [];
  if (match.status === 'picking' && getTeamPlayers(match, null).length) {
    fields.push({
      name: 'Pool',
      value: getTeamPlayers(match, null)
        .map((player) => player.full_name)
        .join(', '),
    });
  }
  if (match.status !== 'open') {
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
  if (match.status === 'open') {
    const count = match.players.length;
    fields.push({
      name: 'Players',
      value: `${count}/${match.size} | ${match.players
        .map((player) => player.full_name)
        .join(', ')}`,
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
