import { APIUser } from 'discord-api-types/v10';
import { info } from '../libs/logging';
import {
  createMatchPlayer,
  createPlayer,
  deleteMatchPlayer,
  getChannel,
  getMatch,
  getOpenMatchByChannel,
  getPlayer,
  JoinedMatch,
  Match,
  MatchPlayer,
  updateMatch,
  updateMatchPlayer,
} from '../libs/supabase/supabase';
import { verifyResult, verifySingleResult } from '../utils';

export const getOrCreatePlayer = async ({ id, username, discriminator, avatar }: APIUser) => {
  const { error, data } = await getPlayer(id);
  if (error) {
    info('service/match', `Inserting Player <${username}> with id ${id}`);
    return createPlayer({
      id,
      username: `${username}#${discriminator}`,
      full_name: username,
      avatar_url: avatar || '',
    }).then(verifySingleResult);
  }
  return data;
};

export const getMatchPlayerNamesByChannel = async (channelId: string) => {
  const match = await getOpenMatchByChannel(channelId).then(verifySingleResult);
  return match.players.map(({ full_name }) => full_name);
};

export const addPlayer = async (channelId: string, user: APIUser) => {
  const match = await getOpenMatchByChannel(channelId).then(verifySingleResult);
  const player = await getOrCreatePlayer(user);
  await createMatchPlayer(match.id, player.id).then(verifyResult);

  if (match.players.length + 1 === match.size) {
    return await getMatch(match.id).then(verifySingleResult);
  }
  return match;
};

export const removePlayer = async (channelId: string, user: APIUser) => {
  const match = await getOpenMatchByChannel(channelId).then(verifySingleResult);
  const player = await getOrCreatePlayer(user);
  await deleteMatchPlayer(match.id, player.id).then(verifyResult);
};

export const startMatchDraft = async (match: JoinedMatch) => {
  const shuffledPlayers = match.players; /*shuffleArray(match.players).filter(
    ({ id }) => id !== '45e66c7c-fce5-485c-9edd-a3dd84a0cb17'
  );*/
  if (shuffledPlayers.length < 2) {
    throw new Error('To few players for captian mode.');
  }
  await updateMatchPlayer(match.id, shuffledPlayers[0].id, { team: 'a', captain: true }).then(
    verifyResult
  );
  await updateMatchPlayer(match.id, shuffledPlayers[1].id, { team: 'b', captain: true }).then(
    verifyResult
  );
  return await updateMatch(match.id, { status: 'picking' }).then(verifyResult);
};

export const getNewMatchEmbed = async (match: Match) => {
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

export const getMatchEmbed = async (matchId: number | undefined) => {
  const { id, size, players, channel } = await getMatch(matchId).then(verifySingleResult);
  const count = players.length;
  const description = count
    ? `${count}/${size} | ${players.map((player) => player.full_name).join(', ')}`
    : 'No players';
  return {
    channelId: channel.channel_id,
    embed: {
      title: `Match ${id}`,
      description,
      url: `https://bf2-matchmaking.netlify.app/matches/${id}`,
    },
  };
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
