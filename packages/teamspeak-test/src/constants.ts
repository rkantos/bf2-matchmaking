/**
 * Voice-port address for emulated clients.
 *
 * Distinct from the ServerQuery connection in packages/teamspeak, which uses
 * the SSH query port (10022). A real client connects to the virtual server's
 * voice port instead - 10014, matching TEAMSPEAK_SERVER_URI in
 * packages/teamspeak/src/constants.ts.
 */
export const TEAMSPEAK_HOST = process.env.TEAMSPEAK_HOST || 'oslo21.spillvert.no';
export const TEAMSPEAK_VOICE_PORT = process.env.TEAMSPEAK_VOICE_PORT || '10014';
export const TEAMSPEAK_ADDR = `${TEAMSPEAK_HOST}:${TEAMSPEAK_VOICE_PORT}`;

/**
 * Join password for the virtual server (serverinfo reports
 * virtualserver_flag_password=true). Without it the handshake stalls after
 * initivexpand2 rather than failing outright.
 *
 * Distinct in principle from the ServerQuery login password, though this
 * deployment appears to use the same value - see the commented-out
 * `&password=` in packages/teamspeak/src/constants.ts.
 */
export const TEAMSPEAK_SERVER_PASSWORD =
  process.env.TEAMSPEAK_SERVER_PASSWORD || process.env.TEAMSPEAK_PASSWORD || '';

/** How long a single client gets to complete its handshake. */
export const CONNECT_TIMEOUT_MS = 45000;

/**
 * Delay between spawning clients.
 *
 * The gather server blocks an IP at 250 antiflood points and only decays 5 per
 * tick (virtualserver_antiflood_points_needed_ip_block /
 * _points_tick_reduce). At 400ms the 7th consecutive connection from one host
 * was silently dropped. Keep the proven two-second recovery window by default,
 * but allow a server operator to tune it when anti-flood settings differ.
 */
export const SPAWN_STAGGER_MS = Math.max(
  400,
  Number(process.env.TEAMSPEAK_TEST_SPAWN_STAGGER_MS) || 2000
);

/**
 * Pause between leaving the queue channel and disconnecting.
 *
 * The engine resolves the moved client via getClientByUid when handling
 * 'clientmoved'; disconnecting immediately makes that lookup fail
 * ("could not fetch client with id N in event clientmoved") and the player is
 * never removed from the queue. Let the move be observed before dropping.
 */
export const MOVE_SETTLE_MS = 2000;
