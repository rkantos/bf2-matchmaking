export const LOBBY_CHANNEL = process.env.TEAMSPEAK_LOBBY_CHANNEL || '20342';
/** Root of the only channel tree the matchmaking bot may manage. */
export const MANAGED_CHANNEL_ROOT =
  process.env.TEAMSPEAK_MANAGED_CHANNEL_ROOT || '42495'; // BF2 Beta
export const QUEUE_CHANNEL = process.env.TEAMSPEAK_QUEUE_CHANNEL || '42497';
/** Match channels are created directly below BF2 Beta. */
export const BOT_CHANNEL = MANAGED_CHANNEL_ROOT;

/**
 * Voice-port address, used by the admin client.
 *
 * Distinct from the ServerQuery connection, which uses the SSH query port
 * (10022). A normal client connects to the virtual server's voice port.
 */
export const TEAMSPEAK_HOST = process.env.TEAMSPEAK_HOST || 'oslo21.spillvert.no';
export const TEAMSPEAK_VOICE_PORT = process.env.TEAMSPEAK_VOICE_PORT || '10014';
export const TEAMSPEAK_QUERY_PORT = Number(
  process.env.TEAMSPEAK_QUERY_PORT || '10022'
);
export const TEAMSPEAK_QUERY_USERNAME =
  process.env.TEAMSPEAK_QUERY_USERNAME || 'bf2.gg';

//TODO: should password be exposed on the page? only show if user is on the discord server?
export const TEAMSPEAK_SERVER_URI = `ts3server://${TEAMSPEAK_HOST}?port=${TEAMSPEAK_VOICE_PORT}&cid=${QUEUE_CHANNEL}`; //&password=${process.env.TEAMSPEAK_PASSWORD}`;
