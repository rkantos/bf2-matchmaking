import { info, warn } from '@bf2-matchmaking/logging';
import { parseError } from '@bf2-matchmaking/services/error';
import { hash } from '@bf2-matchmaking/redis/hash';
import { environmentFlag } from '@bf2-matchmaking/utils';
import { getApiBaseUrl } from '@bf2-matchmaking/utils/base-urls';

/**
 * Mirrors the gather queue into a discord channel.
 *
 * Discord has no way to pin a message to the bottom of a channel, so the only
 * way to keep it in view is to repost: delete the previous message and send a
 * new one, which lands below whatever has been said since. That is disruptive
 * if it happens on every join and leave, hence the interval floor.
 *
 * Off unless ENABLE_GATHER_QUEUE_MESSAGE is set. The token is required at
 * import by the discord package, so the rest client is loaded on demand rather
 * than at module scope - the staging engine runs without one.
 */

const CHANNEL_ID = process.env.GATHER_QUEUE_CHANNEL || '597415520337133571';
/** Never repost more often than this, however fast the queue changes. */
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
 * or either connection - triggers exactly one repost.
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
  let lastPostedAt = 0;
  let posting = false;

  const timer = setInterval(async () => {
    if (posting) return;
    const view = await fetchView(configId);
    if (!view) return;

    const current = signature(view);
    if (current === lastSignature) return;
    if (Date.now() - lastPostedAt < MIN_REPOST_INTERVAL_MS) return;

    posting = true;
    try {
      if (await repost(configId, buildEmbed(view, size))) {
        lastSignature = current;
        lastPostedAt = Date.now();
      }
    } catch (e) {
      warn('queueMessage', `Gather ${configId}: repost failed: ${parseError(e)}`);
    } finally {
      posting = false;
    }
  }, POLL_INTERVAL_MS);
  timer.unref();

  info('queueMessage', `Gather ${configId}: posting queue to channel ${CHANNEL_ID}`);
}
