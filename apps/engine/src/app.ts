import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { DateTime } from 'luxon';
import { error, info, warn } from '@bf2-matchmaking/logging';
import { hash } from '@bf2-matchmaking/redis/hash';
import { json } from '@bf2-matchmaking/redis/json';
import {
  assertString,
  environmentFlag,
  isDevelopment,
} from '@bf2-matchmaking/utils';
import { initGather } from './gather/gather-service';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5006;
const development = isDevelopment();
const engineJobsEnabled = environmentFlag('ENABLE_ENGINE_JOBS', !development);
const gatherEnabled = environmentFlag('ENABLE_GATHER', development);
const gatherConfigId = Number(process.env.GATHER_CONFIG_ID || 20);

async function initEngineJobs() {
  assertString(process.env.DISCORD_TOKEN, 'process.env.DISCORD_TOKEN is not defined');

  // A staging gather must not open a second production Discord session or run
  // the production schedulers, so load those modules only when explicitly on.
  const [
    { discordClient },
    { initChannelListener },
    { initScheduledEventsListener },
    { initDraftMessageListeners },
    { initQueueListeners },
    { scheduleCloseOldMatchesJob },
    { scheduleActiveServersJob },
    { scheduleIdleServersJob },
    { scheduleCloseOldChallengesJob },
    { scheduleResetServersJob },
  ] = await Promise.all([
    import('./discord/client.js'),
    import('./discord/channel-manager.js'),
    import('./discord/scheduled-events-listener.js'),
    import('./discord/draft-message-listener.js'),
    import('./discord/queue-listener.js'),
    import('./jobs/closeOldMatches.js'),
    import('./jobs/update-active-servers.js'),
    import('./jobs/update-idle-servers.js'),
    import('./jobs/closeOldChallenges.js'),
    import('./jobs/resetServers.js'),
  ]);

  await discordClient.login(process.env.DISCORD_TOKEN);
  await hash('system').set({ engineStartedAt: DateTime.now().toISO() });
  await Promise.all([json('app:engine:state').set({}), initChannelListener()]);
  initQueueListeners();
  initDraftMessageListeners();
  initScheduledEventsListener();

  scheduleCloseOldMatchesJob();
  scheduleIdleServersJob();
  scheduleActiveServersJob();
  // scheduleStartScheduledMatchesJob(); TODO: enable once server selection is ready
  scheduleCloseOldChallengesJob();
  scheduleResetServersJob();
}

async function start() {
  info('app', 'Starting...');
  if (development) warn('app', 'Starting in development mode');

  if (engineJobsEnabled) {
    await initEngineJobs();
  } else {
    warn('app', 'Discord listeners and scheduled engine jobs are disabled');
  }

  if (gatherEnabled) {
    if (!Number.isInteger(gatherConfigId) || gatherConfigId <= 0) {
      throw new Error('GATHER_CONFIG_ID must be a positive integer');
    }
    await initGather(gatherConfigId);
  } else {
    warn('app', 'Gather engine is disabled');
  }

  createServer(requestListener).listen(PORT, () => {
    info('app', `Engine state api listening on port ${PORT}`);
  });
  info('app', 'Initialized!');
}

void start().catch((cause) => {
  error('app', cause);
  process.exitCode = 1;
});

function requestListener(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  switch (req.url) {
    case '/health':
      res.writeHead(200);
      res.end('OK');
      break;
    case '/state':
      json('app:engine:state')
        .get()
        .then((state) => {
          res.writeHead(200);
          res.end(JSON.stringify(state));
        });
      break;
    default:
      res.writeHead(404);
      res.end(JSON.stringify({ message: 'Resource not found' }));
  }
}
