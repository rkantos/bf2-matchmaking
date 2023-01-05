import 'dotenv/config';
import express from 'express';
import { InteractionResponseType } from 'discord-interactions';
import {
  getOption,
  VerifyDiscordRequest,
  verifyResult,
  verifySingleResult,
} from './utils';
import {
  createMatchPlayer,
  deleteMatchPlayer,
  getMatch,
  getOpenMatchByChannel,
} from './libs/supabase/supabase';
import invariant from 'tiny-invariant';
import {
  HasGuildCommands,
  INFO_COMMAND,
  JOIN_COMMAND,
  LEAVE_COMMAND,
  PICK_COMMAND,
} from './commands';
import {
  APIInteraction,
  InteractionType,
  ApplicationCommandType,
} from 'discord-api-types/v10';
import { initDiscordGateway } from './discord-gateway';
import { subscribeMatches, subscribeMatchPlayers } from './supabase-subscriptions';
import { getOrCreatePlayer, startMatchDraft } from './services/match';

// Create an express app
const app = express();
// Get port, or default to 5001
const PORT = process.env.PORT || 5001;
// Parse request body and verifies incoming requests using discord-interactions package
invariant(process.env.PUBLIC_KEY, 'PUBLIC_KEY not defined');
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

initDiscordGateway();
//subscribeMatchPlayers();
//subscribeMatches();

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data, member, channel_id } = req.body as APIInteraction;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.Ping) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (
    type === InteractionType.ApplicationCommand &&
    data.type === ApplicationCommandType.ChatInput
  ) {
    const { name, options } = data;
    if (name === 'join') {
      try {
        const match = await getOpenMatchByChannel(channel_id).then(verifySingleResult);
        invariant(member, 'Could not get user data from request.');
        const player = await getOrCreatePlayer(member.user);

        await createMatchPlayer(match.id, player.id).then(verifyResult);

        if (match.players.length + 1 === match.size) {
          const fullMatch = await getMatch(match.id).then(verifySingleResult);
          if (fullMatch.players.length === fullMatch.size) {
            if (match.pick === 'captain') {
              startMatchDraft(fullMatch);
            }
          }
        }

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Joined match',
          },
        });
      } catch (e: any) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: e.message,
          },
        });
      }
    }
    if (name === 'leave') {
      try {
        const match = await getOpenMatchByChannel(channel_id).then(verifySingleResult);
        invariant(member, 'Could not get user data from request.');
        const player = await getOrCreatePlayer(member.user);

        await deleteMatchPlayer(match.id, player.id).then(verifyResult);

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Left match',
          },
        });
      } catch (e: any) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: e.message,
          },
        });
      }
    }
    if (name === 'info') {
      const match = await getOpenMatchByChannel(channel_id).then(verifySingleResult);
      if (match) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: `Match ${match.id}`,
                description: `Players: [${match.players
                  .map(({ username }) => username)
                  .join(', ')}]`,
                url: `https://bf2-matchmaking.netlify.app/matches/${match.id}`,
              },
            ],
          },
        });
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'No open match in channel',
          },
        });
      }
    }
    if (name === 'pick') {
      try {
        const match = await getOpenMatchByChannel(channel_id).then(verifySingleResult);
        invariant(member, 'Could not get user data from request.');
        const captain = await getOrCreatePlayer(member.user);
        const pickedPlayer = getOption('player', options);

        /*const team = captain;
        invariant(team, 'Team not defined');

        if (isAssignedTeam(match, playerId)) {
          throw new Error('Player already assigned');
        }
        const result = await updateMatchPlayer(match.id, options.player, { team });*/
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: pickedPlayer,
          },
        });
      } catch (e: any) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: e.message,
          },
        });
      }
    }
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
  // Check if guild commands from commands.js are installed (if not, install them)
  invariant(process.env.APP_ID, 'APP_ID not defined');
  invariant(process.env.GUILD_ID, 'GUILD_ID not defined');
  HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    JOIN_COMMAND,
    LEAVE_COMMAND,
    INFO_COMMAND,
    PICK_COMMAND,
  ]);
});
