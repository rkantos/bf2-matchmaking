import { APIUser } from 'discord-api-types/v10';
import { error, info } from '@bf2-matchmaking/logging';
import {
  getChannel,
  getMatch,
  getPlayer,
  JoinedMatch,
  Match,
  MatchPlayer,
  updateMatch,
  updateMatchPlayer,
} from '../libs/supabase/supabase';
import { getTeamPlayers, isAssignedTeam } from '../utils/match-utils';
import { client, verifySingleResult, verifyResult } from '@bf2-matchmaking/supabase';

export const getOrCreatePlayer = async ({
  id,
  username,
  discriminator,
  avatar,
}: APIUser) => {
  const { error, data } = await client().getPlayer(id);
  if (error) {
    info('getOrCreatePlayer', `Inserting Player <${username}> with id ${id}`);
    return client()
      .createPlayer({
        id,
        username: `${username}#${discriminator}`,
        full_name: username,
        avatar_url: avatar || '',
      })
      .then(verifySingleResult);
  }
  return data;
};

export const getMatchInfoByChannel = async (channelId: string) => {
  const match = await client()
    .getStagingMatchByChannelId(channelId)
    .then(verifySingleResult);
  return {
    embed: {
      title: `Match ${match.id}`,
      fields: getMatchFields(match),
      url: `https://bf2-matchmaking.netlify.app/matches/${match.id}`,
    },
  };
};

export const addPlayer = async (channelId: string, user: APIUser) => {
  const match = await client()
    .getOpenMatchByChannelId(channelId)
    .then(verifySingleResult);
  const player = await getOrCreatePlayer(user);
  await client().createMatchPlayer(match.id, player.id).then(verifyResult);
};

export const removePlayer = async (channelId: string, user: APIUser) => {
  const match = await client()
    .getOpenMatchByChannelId(channelId)
    .then(verifySingleResult);
  const player = await getOrCreatePlayer(user);
  await client().deleteMatchPlayer(match.id, player.id).then(verifyResult);
};

export const startMatchDraft = async (match: JoinedMatch) => {
  const shuffledPlayers = match.players; /*shuffleArray(match.players).filter(
    ({ id }) => id !== '45e66c7c-fce5-485c-9edd-a3dd84a0cb17'
  );*/
  if (shuffledPlayers.length < 2) {
    throw new Error('To few players for captian mode.');
  }
  await updateMatchPlayer(match.id, shuffledPlayers[0].id, {
    team: 'a',
    captain: true,
  }).then(verifyResult);
  await updateMatchPlayer(match.id, shuffledPlayers[1].id, {
    team: 'b',
    captain: true,
  }).then(verifyResult);
  return await updateMatch(match.id, { status: 'picking' }).then(verifyResult);
};

export const pickMatchPlayer = async (
  channelId: string,
  captainId: string,
  pickedPlayerId: string
): Promise<string | undefined> => {
  const match = await client()
    .getPickingMatchByChannelId(channelId)
    .then(verifySingleResult);
  const playerPool = match.teams.filter(({ team }) => team === null);
  const currentTeam = playerPool.length % 2 === 0 ? 'a' : 'b';
  const canPick = match.teams.some(
    ({ captain, player_id, team }) =>
      captain && player_id === captainId && team === currentTeam
  );

  if (!canPick) {
    return 'Not allowed to pick';
  }
  const inPlayerpool = playerPool.some((player) => player.player_id === pickedPlayerId);
  if (!inPlayerpool) {
    return 'Player not in match';
  }
  if (isAssignedTeam(match, pickedPlayerId)) {
    return 'Player already picked';
  }
  const { error: err, data } = await updateMatchPlayer(match.id, pickedPlayerId, {
    team: currentTeam,
  });

  if (err) {
    error('pickMatchPlayer', err.message);
    return 'Something went wrong while picking';
  }
};

export const getNewMatchInfo = async (match: Match) => {
  const channel = await getChannel(match.channel).then(verifySingleResult);
  return {
    channelId: channel.channel_id,
    embed: {
      title: `Match ${match.id}`,
      description: '/join: Join match',
      url: `https://bf2-matchmaking.netlify.app/matches/${match.id}`,
    },
  };
};

export const getMatchInfo = async (matchId: number | undefined) => {
  const match = await getMatch(matchId).then(verifySingleResult);
  return {
    channelId: match.channel.channel_id,
    embed: {
      title: `Match ${match.id}`,
      fields: getMatchFields(match),
      url: `https://bf2-matchmaking.netlify.app/matches/${match.id}`,
    },
  };
};

export const getMatchFields = (match: JoinedMatch) => {
  const fields = [];
  if (match.status === 'picking' && getTeamPlayers(match, null).length) {
    fields.push({
      name: 'Pool',
      value: getTeamPlayers(match, null)
        .map((player) => player.full_name)
        .join(', '),
    });
  }
  if (match.status === 'picking') {
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

export const getMatchJoinMessage = async ({ player_id }: MatchPlayer) => {
  const player = await getPlayer(player_id).then(verifySingleResult);
  return `${player.full_name} joined`;
};

export const getMatchLeaveMessage = async ({ player_id }: Partial<MatchPlayer>) => {
  const player = await getPlayer(player_id).then(verifySingleResult);
  return `${player.full_name} left`;
};

export const getMatchPickMessage = async ({ player_id, team }: MatchPlayer) => {
  const player = await getPlayer(player_id).then(verifySingleResult);
  return `${player.full_name} assigned to team ${team}`;
};
