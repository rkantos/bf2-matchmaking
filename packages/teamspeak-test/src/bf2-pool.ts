import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { error, info } from '@bf2-matchmaking/logging/winston';
import { testCdKeyForPlayer } from './cdkey';

export interface Bf2TestClientSpec {
  playerId: string;
  nick: string;
  keyhash: string;
}

export interface Bf2TestClientInfo extends Bf2TestClientSpec {
  connected: boolean;
  address: string;
}

interface PooledBf2Client extends Bf2TestClientInfo {
  child: ChildProcessWithoutNullStreams;
}

const pool = new Map<string, PooledBf2Client>();
let resizeQueue: Promise<unknown> = Promise.resolve();
let desiredClientCount = 0;
let latestRoster: Array<Bf2TestClientSpec> = [];
let latestAddress = '';
const CONNECT_TIMEOUT_MS = 20_000;
const AUTO_STAGGER_CEILING_MS = Math.max(
  20,
  Number(process.env.BF2_TEST_SPAWN_STAGGER_MS) || 70
);

const wait = (ms: number) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

function scriptPath() {
  const candidates = [
    process.env.BF2_HEADLESS_SCRIPT,
    resolve(process.cwd(), '../../bf2headless.js'),
    resolve(process.cwd(), 'bf2headless.js'),
    resolve(process.cwd(), '../../bf2-headless/bf2headless.js'),
    resolve(process.cwd(), '../bf2-headless/bf2headless.js'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const found = candidates.find(existsSync);
  if (!found) {
    throw new Error(
      'bf2headless.js not found. Include it at the repository root or set BF2_HEADLESS_SCRIPT.'
    );
  }
  return found;
}

function serverTarget(address: string) {
  const [host, port] = address.split(':');
  return { host, port: port ? Number(port) : null };
}

function toInfo({ child, ...entry }: PooledBf2Client): Bf2TestClientInfo {
  return entry;
}

function earlyExitMessage(spec: Bf2TestClientSpec, stdout: string, stderr: string) {
  if (/server full/i.test(stdout)) {
    const current = stdout.match(/GS field numplayers = (\d+)/)?.[1];
    const maximum = stdout.match(/GS field maxplayers = (\d+)/)?.[1];
    return `${spec.nick} was rejected: BF2 server is full${
      current && maximum ? ` (${current}/${maximum})` : ''
    }`;
  }
  const detail = (stderr || stdout).trim().slice(-1000);
  return `${spec.nick} exited before completing its BF2 handshake${
    detail ? `: ${detail}` : ''
  }`;
}

export function listBf2Clients() {
  return [...pool.values()]
    .sort((a, b) => Number(a.playerId) - Number(b.playerId))
    .map(toInfo);
}

async function connectClient(
  spec: Bf2TestClientSpec,
  address: string,
  onJoinAccepted: () => void
) {
  const generated = testCdKeyForPlayer(spec.playerId);
  if (generated.keyhash !== spec.keyhash.toLowerCase()) {
    throw new Error(
      `${spec.nick} database keyhash does not match its deterministic test CD key. ` +
        'Run tools/seed-test-keyhashes.ts.'
    );
  }

  const target = serverTarget(address);
  const args = [
    scriptPath(),
    '--name',
    spec.nick,
    '--cdkey',
    generated.cdKey,
    '--keyhash',
    generated.keyhash,
    '--lan-mode',
    '--profile-id',
    String(1_100_000 + Number(spec.playerId)),
    '--stagger',
    'auto',
  ];
  // Gather test servers conventionally use 2026. Supplying it is harmless for
  // the passwordless test servers we use, while protected servers require it
  // in the initial join packet. Override for a different testing deployment.
  const password = process.env.BF2_TEST_SERVER_PASSWORD || '2026';
  args.push('--password', password);
  if (target.port) args.push('--port', String(target.port));
  args.push(target.host);

  const child = spawn(process.execPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const entry: PooledBf2Client = {
    ...spec,
    keyhash: generated.keyhash,
    connected: false,
    address,
    child,
  };

  const connected = new Promise<void>((resolveConnected, reject) => {
    let settled = false;
    const fail = (cause: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(cause);
    };
    const timer = setTimeout(() => {
      fail(new Error(`${spec.nick} BF2 handshake timed out`));
    }, CONNECT_TIMEOUT_MS);
    let stderr = '';
    let stdout = '';
    let joinAccepted = false;
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + String(chunk)).slice(-2000);
    });
    child.stdout.on('data', (chunk) => {
      stdout = (stdout + String(chunk)).slice(-4000);
      if (!joinAccepted && stdout.includes('Server accepted the fake-player join')) {
        joinAccepted = true;
        onJoinAccepted();
      }
      if (stdout.includes('Initial BF2 player handshake completed')) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        entry.connected = true;
        resolveConnected();
      }
    });
    child.once('error', (cause) => {
      fail(cause);
    });
    child.once('exit', (code) => {
      if (!entry.connected) {
        fail(new Error(earlyExitMessage(spec, stdout, stderr)));
      }
      entry.connected = false;
    });
  });

  child.once('exit', () => {
    entry.connected = false;
    if (pool.get(spec.playerId) === entry) pool.delete(spec.playerId);
  });
  try {
    await connected;
    return entry;
  } catch (cause) {
    await terminateChild(child);
    throw cause;
  }
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number) {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise<boolean>((resolveExit) => {
    const timer = setTimeout(() => resolveExit(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveExit(true);
    });
  });
}

async function terminateChild(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null) return;
  child.kill();
  if (await waitForExit(child, 2000)) return;

  // On Windows, UDP-holding Node children do not always terminate from
  // ChildProcess.kill(). taskkill is scoped to the exact spawned PID and its
  // descendants, then we still wait for confirmation.
  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    });
    await new Promise<void>((resolveKill) => killer.once('exit', () => resolveKill()));
    await waitForExit(child, 2000);
  }
}

async function disconnectClient(entry: PooledBf2Client) {
  entry.connected = false;
  await terminateChild(entry.child);
}

export async function setBf2ClientCount(
  count: number,
  roster: Array<Bf2TestClientSpec>,
  address: string
) {
  desiredClientCount = Math.max(0, Math.min(count, roster.length));
  latestRoster = roster;
  latestAddress = address;
  const run = resizeQueue.catch(() => undefined).then(async () => {
    const target = Math.max(0, Math.min(count, roster.length));
    const initialPlayerIds = new Set(pool.keys());
    const desiredIds = new Set(
      roster.slice(0, target).map((spec) => spec.playerId)
    );
    for (const entry of [...pool.values()]) {
      if (!desiredIds.has(entry.playerId) || entry.address !== address) {
        await disconnectClient(entry);
        pool.delete(entry.playerId);
        info('Bf2TestClientPool', `Disconnected ${entry.nick} (${pool.size}/${target})`);
      }
    }
    try {
      const pending: Array<Promise<PromiseSettledResult<PooledBf2Client>>> = [];
      for (const spec of roster.slice(0, target)) {
        if (pool.has(spec.playerId)) continue;
        let signalAccepted: () => void = () => {};
        const accepted = new Promise<void>((resolveAccepted) => {
          signalAccepted = resolveAccepted;
        });
        const connection = connectClient(spec, address, signalAccepted).then(
          (entry): PromiseSettledResult<PooledBf2Client> => {
            pool.set(spec.playerId, entry);
            info('Bf2TestClientPool', `Connected ${entry.nick} (${pool.size}/${target})`);
            return { status: 'fulfilled', value: entry };
          },
          (reason): PromiseSettledResult<PooledBf2Client> => ({
            status: 'rejected',
            reason,
          })
        );
        // Attach both fulfillment and rejection handlers immediately. A BF2
        // child can be rejected while later clients are still launching; if
        // rejection handling is deferred until Promise.allSettled(), Node may
        // terminate the API for an unhandled rejection, taking every TS test
        // client's owning socket down with it.
        pending.push(connection);
        // Match bf2headless.js --stagger auto: launch the next identity as soon
        // as this join is accepted, with the same short fallback ceiling.
        await Promise.race([accepted, wait(AUTO_STAGGER_CEILING_MS)]);
      }
      const outcomes = await Promise.all(pending);
      const failed = outcomes.find(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
      );
      if (failed) {
        throw failed.reason;
      }
    } catch (cause) {
      // Remove clients added by this call if an increase fails.
      const additions = [...pool.values()].filter(
        (entry) => !initialPlayerIds.has(entry.playerId)
      );
      for (const entry of additions.reverse()) {
        await disconnectClient(entry);
        pool.delete(entry.playerId);
      }
      error('Bf2TestClientPool', cause);
      throw cause;
    }
    return listBf2Clients();
  });
  resizeQueue = run;
  return run;
}

/**
 * Reorder the requested BF2 clients to match the current TS queue. A TS drop
 * during summoning promotes an overflow player; keeping the old numeric BF2
 * roster would leave the totals at 8/8 while only seven identities overlap.
 */
export async function reconcileBf2ClientOrder(playerIds: Array<string>) {
  if (desiredClientCount === 0 || !latestAddress || latestRoster.length === 0) return;
  const byId = new Map(latestRoster.map((spec) => [spec.playerId, spec]));
  const ordered = playerIds
    .map((playerId) => byId.get(playerId))
    .filter((spec): spec is Bf2TestClientSpec => Boolean(spec));
  const orderedIds = new Set(ordered.map((spec) => spec.playerId));
  ordered.push(...latestRoster.filter((spec) => !orderedIds.has(spec.playerId)));
  await setBf2ClientCount(desiredClientCount, ordered, latestAddress);
}

export function stopAllBf2Clients() {
  desiredClientCount = 0;
  latestRoster = [];
  latestAddress = '';
  for (const entry of pool.values()) entry.child.kill();
  pool.clear();
}

process.once('exit', stopAllBf2Clients);
