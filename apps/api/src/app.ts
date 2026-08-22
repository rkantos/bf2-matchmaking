import 'dotenv/config';
import Koa from 'koa';
import logger from 'koa-logger';
import { bodyParser } from '@koa/bodyparser';
import { info, warn } from '@bf2-matchmaking/logging';
import Router from '@koa/router';
import { cacheRouter } from './cache/router';
import { matchesRouter } from './matches/router';
import { serversRouter } from './servers/router';
import { hash } from '@bf2-matchmaking/redis/hash';
import { DateTime } from 'luxon';
import { environmentFlag, isDevelopment } from '@bf2-matchmaking/utils';
import { gathersRouter } from './gather/router';
import { bearerToken } from './auth';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5004;

export const rootRouter = new Router();
rootRouter.get('/health', (ctx) => {
  ctx.body = 'Ok';
});

const app = new Koa()
  .use(logger())
  .use(bodyParser())
  .use(bearerToken())
  .use(cacheRouter.routes())
  .use(cacheRouter.allowedMethods())
  .use(gathersRouter.routes())
  .use(gathersRouter.allowedMethods())
  .use(matchesRouter.routes())
  .use(matchesRouter.allowedMethods())
  .use(serversRouter.routes())
  .use(serversRouter.allowedMethods())
  .use(rootRouter.routes())
  .use(rootRouter.allowedMethods());

/**
 * The legacy routers load credentials for Railway, Vultr, Cloudflare and
 * BF2CC at module scope. A gather-only staging API neither needs nor should
 * receive those production credentials, so allow each integration to be
 * omitted without changing the full production default.
 */
async function mountOptionalRoutes() {
  const optionalRoutes = [
    [
      'ENABLE_ADMIN_ROUTES',
      async () => (await import('./admin/router.ts')).adminRouter,
      'adminRouter',
    ],
    [
      'ENABLE_PLATFORM_ROUTES',
      async () => (await import('./platform/router.ts')).platformRouter,
      'platformRouter',
    ],
    [
      'ENABLE_PLAYERS_ROUTES',
      async () => (await import('./players/router.ts')).playersRouter,
      'playersRouter',
    ],
    [
      'ENABLE_WEBHOOK_ROUTES',
      async () => (await import('./webhooks/router.ts')).webhooksRouter,
      'webhooksRouter',
    ],
  ] as const;

  for (const [flag, load, routerName] of optionalRoutes) {
    if (!environmentFlag(flag, true)) {
      warn('app', `${routerName} is disabled`);
      continue;
    }
    const router = await load();
    app.use(router.routes()).use(router.allowedMethods());
  }
}

void mountOptionalRoutes().then(() => {
  app.listen(PORT, async () => {
    info('app', `api listening on port ${PORT}`);
    if (isDevelopment()) {
      warn('app', 'Starting in development mode');
      return;
    }
    await hash('system').set({ apiStartedAt: DateTime.now().toISO() });
  });
});
