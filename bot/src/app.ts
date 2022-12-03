import 'dotenv/config';
import express from 'express';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { DiscordRequest, VerifyDiscordRequest } from './utils';
import { getChannel, subscribeMatches } from './libs/supabase/supabase';
import invariant from 'tiny-invariant';

// Create an express app
const app = express();
// Get port, or default to 4000
const PORT = process.env.PORT || 4000;
// Parse request body and verifies incoming requests using discord-interactions package
invariant(process.env.PUBLIC_KEY, 'PUBLIC_KEY not defined');
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

subscribeMatches(async (payload) => {
  console.log('new match', payload);
  const channel = await getChannel(payload.new.channel);
  console.log(channel.data?.uri);
  try {
    DiscordRequest(`channels/${channel.data?.uri.split('/').pop()}/messages`, {
      method: 'POST',
      body: {
        content: 'New match created',
        tts: false,
        embeds: [
          {
            title: `Match ${payload.new.id}`,
            description: 'Follow url to join match',
            url: `https://bf2-matchmaking.netlify.app/matches/${payload.new.id}`,
          },
        ],
      },
    });
  } catch (e) {
    console.error(e);
  }
});

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
