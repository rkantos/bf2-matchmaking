import { PlayerListItem, ServerInfo } from '@bf2-matchmaking/types/rcon';
import { set } from '@bf2-matchmaking/redis/set';
import { isDevelopment } from '@bf2-matchmaking/utils';

/**
 * Injects fake BF2 players into RCON responses, for testing the parts of the
 * platform that require players to actually be on a game server.
 *
 * Applied at the RCON boundary rather than at any single call site, so every
 * consumer sees a consistent picture: the gather's summon verification, the live
 * server view (/servers/:ip), and the raw player list (/servers/:ip/pl) all
 * agree without each needing its own seam.
 *
 * Keyhash is what matters - it is column 42 of `bf2cc pl` and what the gather
 * matches against players.keyhash.
 *
 * Enabling requires ENABLE_FAKE_BF2_PLAYERS=true, development mode, and a
 * non-empty keyhash set for the specific address. Absent any of those this is a
 * no-op, so the flag alone cannot change behaviour and production is unaffected.
 */

const FAKE_PLAYER_NAME_PREFIX = 'FakeBf2Player';

export function fakePlayerStore(address: string) {
  return set(`servers:${address}:test:players`);
}

function isEnabled() {
  return isDevelopment() && process.env.ENABLE_FAKE_BF2_PLAYERS === 'true';
}

export async function getFakeKeyhashes(address: string): Promise<Array<string>> {
  if (!isEnabled()) {
    return [];
  }
  return fakePlayerStore(address).members();
}

/**
 * A `bf2cc pl` row with every field populated.
 *
 * The real parser always yields all 46 fields as strings; returning a partial
 * object would break any consumer reading more than keyhash.
 */
export function buildFakePlayer(keyhash: string, index: number): PlayerListItem {
  const zero = '0';
  return {
    index: String(index),
    getName: `${FAKE_PLAYER_NAME_PREFIX}${index}`,
    // Alternate teams so a faked server looks plausibly balanced.
    getTeam: index % 2 === 0 ? '1' : '2',
    getPing: '30',
    isConnected: '1',
    isValid: '1',
    isRemote: '1',
    isAIPlayer: zero,
    isAlive: '1',
    isManDown: zero,
    getProfileId: String(900000 + index),
    isFlagHolder: zero,
    getSuicide: zero,
    getTimeToSpawn: zero,
    getSquadId: zero,
    isSquadLeader: zero,
    isCommander: zero,
    getSpawnGroup: zero,
    getAddress: '127.0.0.1',
    scoreDamageAssists: zero,
    scorePassengerAssists: zero,
    scoreTargetAssists: zero,
    scoreRevives: zero,
    scoreTeamDamages: zero,
    scoreTeamVehicleDamages: zero,
    scoreCpCaptures: zero,
    scoreCpDefends: zero,
    scoreCpAssists: zero,
    scoreCpNeutralizes: zero,
    scoreCpNeutralizeAssists: zero,
    scoreSuicides: zero,
    scoreKills: zero,
    scoreTKs: zero,
    vehicleType: zero,
    kitTemplateName: '',
    kiConnectedAt: zero,
    deaths: zero,
    score: zero,
    vehicleName: '',
    rank: zero,
    position: zero,
    idleTime: zero,
    keyhash,
    punished: zero,
    timesPunished: zero,
    timesForgiven: zero,
  };
}

/**
 * Fake rows for this address, numbered from `startIndex` so they slot in after
 * however many real players there are. Empty when the seam is off.
 */
export async function getFakePlayers(
  address: string,
  startIndex = 0
): Promise<Array<PlayerListItem>> {
  const keyhashes = await getFakeKeyhashes(address);
  return keyhashes.map((keyhash, i) => buildFakePlayer(keyhash, startIndex + i));
}

/**
 * Inflate connectedPlayers by the number of fakes.
 *
 * Required, not cosmetic: createLiveInfo throws 'Invalid live state' unless
 * players.length equals Number(connectedPlayers), so faking the player list
 * without this would make the live server view fail outright.
 */
export async function withFakePlayerCount(
  address: string,
  serverInfo: ServerInfo
): Promise<ServerInfo> {
  const keyhashes = await getFakeKeyhashes(address);
  if (!keyhashes.length) {
    return serverInfo;
  }
  return {
    ...serverInfo,
    connectedPlayers: String(Number(serverInfo.connectedPlayers) + keyhashes.length),
  };
}
