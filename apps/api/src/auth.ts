import { Context, Next } from 'koa';
import { assertString, environmentFlag } from '@bf2-matchmaking/utils';
import { AccessRoles, SessionUser } from '@bf2-matchmaking/types/api';
import { verifyToken } from '@bf2-matchmaking/auth/token';
import { isString } from '@bf2-matchmaking/types';
import { error, warn } from '@bf2-matchmaking/logging';
import { getPlayerRoles } from '@bf2-matchmaking/auth/roles';

assertString(process.env.API_KEY, 'API_KEY is not set.');

declare module 'koa' {
  interface Request {
    token?: string;
    user?: SessionUser;
  }
}

export function protect(...roles: Array<AccessRoles>) {
  return async (ctx: Context, next: Next) => {
    const headerApiKey = ctx.get('X-API-Key');
    const queryApiKey = ctx.query.api_key;
    const allowQueryApiKey = environmentFlag('ALLOW_QUERY_API_KEY', true);
    const providedApiKey =
      headerApiKey ||
      (allowQueryApiKey && isString(queryApiKey) ? queryApiKey : undefined);

    if (!headerApiKey && allowQueryApiKey && isString(queryApiKey)) {
      warn(
        'protect',
        `Deprecated api_key query authentication used for ${ctx.method} ${ctx.path}`
      );
    }
    if (isString(providedApiKey)) {
      if (providedApiKey !== process.env.API_KEY) {
        ctx.throw(401, 'Invalid API key');
      }
      ctx.request.user = { id: 'system', nick: 'system', keyhash: 'system' };
      return next();
    }

    const idToken = ctx.request.token;
    if (!idToken) {
      ctx.throw(401, 'Missing id token');
    }

    let userFromToken;
    let userRoles;
    try {
      userFromToken = await verifyToken(idToken);
      userRoles = await getPlayerRoles(userFromToken.id);
    } catch (e) {
      error('protect', e);
      ctx.throw(401, 'Invalid id token');
    }

    if (
      userRoles.includes('system_admin') ||
      roles.some((role) => userRoles.includes(role))
    ) {
      ctx.request.user = userFromToken;
      return next();
    }

    ctx.throw(401, 'Unauthorized');
  };
}

export function isStrictMutationAuth() {
  const mode = (process.env.API_MUTATION_AUTH_MODE || 'legacy').toLowerCase();
  if (mode !== 'legacy' && mode !== 'strict') {
    throw new Error('API_MUTATION_AUTH_MODE must be legacy or strict');
  }
  return mode === 'strict';
}

/**
 * Compatibility wrapper for mutation routes that were historically public.
 *
 * In legacy mode an entirely unauthenticated request is allowed and logged.
 * If a caller supplies any credential, it is still validated so a bad key
 * cannot silently downgrade to anonymous access. Strict staging uses the same
 * role/API-key checks as protect().
 */
export function protectMutation(...roles: Array<AccessRoles>) {
  const strictProtection = protect(...roles);
  return async (ctx: Context, next: Next) => {
    const suppliedCredentials = Boolean(
      ctx.get('X-API-Key') ||
        ctx.get('Authorization') ||
        (environmentFlag('ALLOW_QUERY_API_KEY', true) && isString(ctx.query.api_key))
    );
    if (isStrictMutationAuth() || suppliedCredentials) {
      return strictProtection(ctx, next);
    }

    warn(
      'protectMutation',
      `Allowing legacy unauthenticated ${ctx.method} ${ctx.path}`
    );
    return next();
  };
}

export function bearerToken() {
  return (ctx: Context, next: Next) => {
    const { header } = ctx.request;
    if (header.authorization) {
      const parts = header.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        ctx.request.token = parts[1];
      }
    }

    return next();
  };
}
