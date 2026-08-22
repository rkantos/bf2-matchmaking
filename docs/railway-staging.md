# Isolated Railway gather stack

This stack is intentionally separate from the services behind `bf2.top`,
`api.bf2.top`, and `engine.bf2.top`.

## Services

- `web`: public Railway domain, one replica
- `api`: public Railway domain, one replica; owns the TeamSpeak test sockets and
  `bf2headless.js` child processes
- `engine`: private, one replica; gather lifecycle only
- `Redis`: private, persistent; never share the production Redis URL

The web and API can use the existing Supabase project. That shares database
records, authentication, and Test0-Test15 with production, so it is not full
data isolation. Use a separate `GATHER_CONFIG_ID` if staging matches must not
use the production gather configuration.

## Railway configuration

All three application services build from the repository root. Set the Railway
config paths to:

- web: `apps/web/railway.toml`
- api: `apps/api/railway.toml`
- engine: `apps/engine/railway.toml`

Set `RAILPACK_NODE_VERSION=22` on all three services and keep each service at
one replica. Multiple API replicas would each own a different in-memory client
pool; multiple engines would process the same gather events.

### Shared application secrets

Set these as Railway shared variables or on every service that uses them:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `REDIS_URL=${{Redis.REDIS_URL}}`
- `API_KEY` (a new staging-only random value)

Do not copy the production `REDIS_URL` or `API_KEY`.

### Web

- `NODE_ENV=production`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL=https://<staging-api-domain>`
- `API_BASE_URL=https://<staging-api-domain>`
- `NEXT_PUBLIC_WEB_BASE_URL=https://<staging-web-domain>`
- `WEB_BASE_URL=https://<staging-web-domain>`
- `GATHER_CONFIG_ID=<staging match config id>`

Add `https://<staging-web-domain>/auth/callback` to the Supabase authentication
redirect allowlist.

### API

- `NODE_ENV=production`
- `API_MUTATION_AUTH_MODE=strict`
- `ALLOW_QUERY_API_KEY=false`
- `ENABLE_GATHER_TEST_CLIENTS=true`
- `ENABLE_ADMIN_ROUTES=false`
- `ENABLE_PLATFORM_ROUTES=false`
- `ENABLE_PLAYERS_ROUTES=false`
- `ENABLE_WEBHOOK_ROUTES=false`
- `CORS_ORIGINS=https://<staging-web-domain>`
- `TEAMSPEAK_HOST`
- `TEAMSPEAK_VOICE_PORT`
- `TEAMSPEAK_SERVER_PASSWORD`
- `TEAMSPEAK_MANAGED_CHANNEL_ROOT=42495` (BF2 Beta)
- `TEAMSPEAK_QUEUE_CHANNEL=<dedicated staging queue channel id>`
- `TEAMSPEAK_ADMIN_IDENTITY` (serialized identity from the existing test Redis)
- `TEAMSPEAK_TEST_IDENTITIES_JSON` (Test0-Test15 player-id to serialized identity map)
- `TEAMSPEAK_ADMIN_DISABLED=true` (the engine exclusively owns the admin identity)
- `BF2_TEST_SERVER_PASSWORD=2026`
- `BF2_TEST_SPAWN_STAGGER_MS=70` (optional)
- `TEAMSPEAK_TEST_SPAWN_STAGGER_MS=2000` (optional; lower only after checking
  TeamSpeak anti-flood behavior)

`bf2headless.js` is stored at the repository root and is found automatically.
Railway outbound IPv4 is sufficient for the BF2 UDP and TeamSpeak voice
connections unless either server firewall requires an allowlisted source IP.
In that case use Railway's Pro static outbound IP feature.

### Engine

- `NODE_ENV=production`
- `ENABLE_GATHER=true`
- `ENABLE_ENGINE_JOBS=false`
- `GATHER_CONFIG_ID=20` (prefer a staging-specific config ID)
- `GATHER_SERVER_ADDRESSES=<comma-separated test BF2 servers>`
- `TEAMSPEAK_HOST`
- `TEAMSPEAK_VOICE_PORT`
- `TEAMSPEAK_QUERY_PORT=10022`
- `TEAMSPEAK_QUERY_USERNAME`
- `TEAMSPEAK_QUERY_NICKNAME=bf2.gg-staging`
- `TEAMSPEAK_PASSWORD` (ServerQuery password, not the voice join password)
- `TEAMSPEAK_MANAGED_CHANNEL_ROOT=42495` (BF2 Beta)
- `TEAMSPEAK_QUEUE_CHANNEL=<dedicated staging queue channel id>`

With `ENABLE_ENGINE_JOBS=false`, the engine does not require `DISCORD_TOKEN`
and does not start Discord listeners or production scheduler jobs.

## TeamSpeak identities

Test and admin client identities are persisted in Redis. A new Redis starts
empty, while the database already contains TeamSpeak UIDs for Test0-Test15 and
the current admin voice client already has a server group. Before using the
sliders, copy these Redis hashes from the existing test Redis into the new one:

- `gather:test:identities`
- `teamspeak:admin:identity`

Do not regenerate them unless you also intend to update Test0-Test15 in the
database and grant the new admin UID its TeamSpeak server group.

## API mutation authentication

Public GET and SSE routes remain readable. Mutating routes use one of two
mechanisms:

- browser/admin operations use a signed bearer token plus roles such as
  `match_admin` or `server_admin`;
- trusted server-to-server operations use staging `X-API-Key`.

The hardened routes include match creation/results/teardown/server assignment,
server registration, platform provisioning, gather server selection, and cache
rebuilds. Webhook routes require a separate `X-Webhook-Secret` when enabled;
configure the same `WEBHOOK_SECRET` in Railway and in the webhook sender.

`API_MUTATION_AUTH_MODE` defaults to `legacy` for compatibility with existing
callers. In that mode, historically public mutation routes still accept a
request without credentials and emit an audit warning. If credentials are
provided they are always validated. Newly added gather testing, drafting and
timeout routes remain strictly admin-only in both modes. Query-string
`api_key` authentication is accepted by default for legacy clients, but
staging disables it with `ALLOW_QUERY_API_KEY=false`.

Never put `API_KEY`, `SUPABASE_SERVICE_KEY`, TeamSpeak passwords, or the webhook
secret in a `NEXT_PUBLIC_` variable.
