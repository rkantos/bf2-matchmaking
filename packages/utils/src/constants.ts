export const SUMMONING_DURATION = 1000 * 60 * 5;

/**
 * Bounds for the gather's configurable summon window - how long summoned players
 * get to appear on the BF2 server before being dropped from the queue.
 *
 * Lives here rather than in @bf2-matchmaking/teamspeak so the api can validate
 * against the same numbers the admin slider offers, without depending on the
 * TeamSpeak client library for two constants.
 *
 * 15s steps keep test iterations short; the lower bound stays above the time it
 * realistically takes to launch BF2 and connect.
 */
export const DEFAULT_SUMMON_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * How often summon verification re-checks the BF2 server. Frequent enough that
 * a full lobby starts promptly, sparse enough not to hammer RCON - and note
 * that a failing `bf2cc pl` costs a socket timeout per attempt.
 *
 * In seconds, matching wait() in @bf2-matchmaking/utils/async.
 */
export const SUMMON_POLL_INTERVAL_SECONDS = 10;
export const SUMMON_TIMEOUT_STEP_MS = 15 * 1000;
export const MIN_SUMMON_TIMEOUT_MS = 15 * 1000;
export const MAX_SUMMON_TIMEOUT_MS = 5 * 60 * 1000;
