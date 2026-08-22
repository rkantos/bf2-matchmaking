import { info, warn } from '@bf2-matchmaking/logging';
import { parseError } from '@bf2-matchmaking/services/error';
import { hash } from '@bf2-matchmaking/redis/hash';
import { environmentFlag } from '@bf2-matchmaking/utils';
import { getApiBaseUrl } from '@bf2-matchmaking/utils/base-urls';

/**
 * Mirrors the gather queue into a discord channel.
 *
 * Discord has no way to pin a message to the bottom of a channel, so keeping it
 * in view means reposting: send a replacement, which lands below whatever has
 * been said since, then delete the old one.
 *
 * Only when it has actually been buried, though. While the embed is still the
 * newest message it is edited in place, which nobody sees as a new message and
 * so needs no interval floor. The floor applies to reposts alone, since those
 * push the conversation up.
 *
 * Off unless ENABLE_GATHER_QUEUE_MESSAGE is set. The token is required at
 * import by the discord package, so the rest client is loaded on demand rather
 * than at module scope - the staging engine runs without one.
 */

const CHANNEL_ID = process.env.GATHER_QUEUE_CHANNEL || '597415520337133571';
/** Floor between reposts. Edits in place are exempt - they add no message. */
const MIN_REPOST_INTERVAL_MS = 30_000;
/** How often the queue is compared against what was last posted. */
const POLL_INTERVAL_MS = 5_000;

const messageStore = () => hash<Record<string, string>>('gather:queue-message');

interface GatherView {
  state: { status?: string; address?: string } | null;
  players: Array<{ id: string; nick: string }>;
  connections: Record<string, { teamspeak?: boolean; bf2?: boolean }>;
}

/**
 * Server emoji from the gather guild. A bot may use emoji from any guild it is
 * in, so these render wherever it posts - but they are ids, and recreating an
 * emoji changes them, hence the overrides.
 */
const TS_EMOJI = process.env.GATHER_QUEUE_TS_EMOJI || '<:ts3:1421538257602216047>';
const BF2_EMOJI = process.env.GATHER_QUEUE_BF2_EMOJI || '<:bf2:1421538248882131044>';
const ABSENT_EMOJI = '▫️';

function icons(connection: { teamspeak?: boolean; bf2?: boolean } | undefined) {
  // Paired with the legend in the footer: the icon shows only once connected.
  return `${connection?.teamspeak ? TS_EMOJI : ABSENT_EMOJI} ${
    connection?.bf2 ? BF2_EMOJI : ABSENT_EMOJI
  }`;
}

function buildEmbed(view: GatherView, size: number) {
  const lines = view.players.map(
    (player, index) =>
      `\`${String(index + 1).padStart(2)}.\` <@${player.id}> ${icons(
        view.connections[player.id]
      )}`
  );

  return {
    title: `Gather queue ${view.players.length}/${size}`,
    description: lines.length ? lines.join('\n') : '_Queue is empty_',
    color: view.players.length >= size ? 0x57f287 : 0x5865f2,
    // Footers are plain text, so the legend names the columns rather than
    // repeating the emoji, which would not render there.
    footer: { text: 'TeamSpeak · BF2 server · ▫️ not connected' },
  };
}

/**
 * What the embed would show, as a comparable string.
 *
 * Compared rather than diffed so that any change worth showing - order, roster,
 * or either connection - triggers exactly one update, and nothing else does.
 */
function signature(view: GatherView) {
  return view.players
    .map((player) => {
      const connection = view.connections[player.id];
      return `${player.id}:${connection?.teamspeak ? 1 : 0}${connection?.bf2 ? 1 : 0}`;
    })
    .join('|');
}

async function fetchView(configId: number): Promise<GatherView | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/gathers/${configId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      warn('queueMessage', `Gather ${configId}: api returned ${response.status}`);
      return null;
    }
    return (await response.json()) as GatherView;
  } catch (e) {
    warn('queueMessage', `Gather ${configId}: could not read queue: ${parseError(e)}`);
    return null;
  }
}

/**
 * Whether our message is still the newest in the channel.
 *
 * Treats an unreadable channel as "not last": reposting something already at
 * the bottom is merely noisy, while editing one that has scrolled away hides
 * the update entirely.
 */
async function stillLast(messageId: string) {
  const { getChannelMessages } = await import('@bf2-matchmaking/discord/rest');
  const messages = await getChannelMessages(CHANNEL_ID);
  return messages.data ? messages.data[0]?.id === messageId : false;
}

async function edit(
  configId: number,
  messageId: string,
  embed: ReturnType<typeof buildEmbed>
) {
  const { editChannelMessage } = await import('@bf2-matchmaking/discord/rest');
  const edited = await editChannelMessage(CHANNEL_ID, messageId, { embeds: [embed] });
  if (edited.data) {
    return true;
  }
  // Most likely someone deleted it; falling through reposts a fresh one.
  warn(
    'queueMessage',
    `Gather ${configId}: could not edit ${messageId}: ${parseError(edited.error)}`
  );
  return false;
}

async function repost(configId: number, embed: ReturnType<typeof buildEmbed>) {
  const { sendChannelMessage, removeChannelMessage } = await import(
    '@bf2-matchmaking/discord/rest'
  );

  const previous = await messageStore().get(String(configId));
  const sent = await sendChannelMessage(CHANNEL_ID, { embeds: [embed] });
  if (!sent.data) {
    warn('queueMessage', `Gather ${configId}: failed to post: ${parseError(sent.error)}`);
    return false;
  }

  // Delete only after the replacement exists, so a failure here leaves the
  // channel with one too many rather than none at all.
  if (previous) {
    await removeChannelMessage(CHANNEL_ID, previous).catch((e) =>
      warn('queueMessage', `Gather ${configId}: could not remove ${previous}: ${parseError(e)}`)
    );
  }
  await messageStore().setEntries([[String(configId), sent.data.id]]);
  return true;
}

export function startQueueMessage(configId: number, size: number) {
  if (!environmentFlag('ENABLE_GATHER_QUEUE_MESSAGE')) {
    return;
  }
  if (!process.env.DISCORD_TOKEN) {
    warn('queueMessage', 'ENABLE_GATHER_QUEUE_MESSAGE is set but DISCORD_TOKEN is not');
    return;
  }

  let lastSignature: string | null = null;
  let lastRepostAt = 0;
  let posting = false;

  const timer = setInterval(async () => {
    if (posting) return;
    const view = await fetchView(configId);
    if (!view) return;

    const current = signature(view);
    if (current === lastSignature) return;

    posting = true;
    try {
      const embed = buildEmbed(view, size);
      const previous = await messageStore().get(String(configId));

      // Still the newest message, so nobody has scrolled it away: update it in
      // place. That costs the channel nothing, so it needs no interval floor
      // and the queue can stay accurate second to second.
      if (previous && (await stillLast(previous)) && (await edit(configId, previous, embed))) {
        lastSignature = current;
        return;
      }

      if (Date.now() - lastRepostAt < MIN_REPOST_INTERVAL_MS) return;
      if (await repost(configId, embed)) {
        lastSignature = current;
        lastRepostAt = Date.now();
      }
    } catch (e) {
      warn('queueMessage', `Gather ${configId}: update failed: ${parseError(e)}`);
    } finally {
      posting = false;
    }
  }, POLL_INTERVAL_MS);
  timer.unref();

  info('queueMessage', `Gather ${configId}: posting queue to channel ${CHANNEL_ID}`);
}
