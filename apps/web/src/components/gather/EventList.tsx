'use client';
import { useEffect, useRef, useState } from 'react';
import { StreamEventReply } from '@bf2-matchmaking/types/redis';
import { api } from '@bf2-matchmaking/utils';
import Time from '@/components/commons/Time';
import { useRouter } from 'next/navigation';
import { GatherEvent } from '@bf2-matchmaking/types/gather';

const MAX_BACKOFF_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;
// A /gather server-component refresh also resolves the live BF2 server panels
// and can take several seconds. Starting another refresh before that one has
// committed can leave the browser continuously rendering stale requests.
const STATE_REFRESH_MS = 10_000;
const MIN_STATE_REFRESH_GAP_MS = 6_000;

interface Props {
  defaultEvents: Array<StreamEventReply>;
  config: number;
}
export default function EventList({ defaultEvents, config }: Props) {
  const [events, setEvents] = useState(defaultEvents);
  const [isConnected, setConnected] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();
  const latestEventId = useRef(defaultEvents.at(0)?.id);

  useEffect(() => {
    let source: EventSource;
    let heartbeatTimeoutId: number | undefined;
    let reconnectTimeoutId: number | undefined;
    let stateRefreshId: number | undefined;
    let backoff = 1000;
    let stopped = false;
    let lastStateRefreshAt = 0;

    function refreshState() {
      const now = Date.now();
      if (now - lastStateRefreshAt < MIN_STATE_REFRESH_GAP_MS) return;
      lastStateRefreshAt = now;
      router.refresh();
    }

    function connect() {
      source = api.v2.getGatherEventsStream(config, latestEventId.current);

      source.addEventListener('data', (event) => {
        const newEvent = JSON.parse(event.data);
        latestEventId.current = newEvent.id;
        setEvents((currentEvents) => [newEvent, ...currentEvents]);
        refreshState();
      });

      source.addEventListener('heartbeat', () => {
        setConnected(true);
        backoff = 1000;
        window.clearTimeout(heartbeatTimeoutId);
        heartbeatTimeoutId = window.setTimeout(() => {
          setConnected(false);
          source.close();
          scheduleReconnect();
        }, HEARTBEAT_TIMEOUT_MS);
      });

      source.onerror = () => {
        setConnected(false);
        source.close();
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (stopped) return;
      window.clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = window.setTimeout(() => {
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        connect();
      }, backoff);
    }

    connect();
    // SSE is the fast path, but browser/proxy reconnects can miss the precise
    // render transition even though Redis state has advanced. Periodically
    // refresh the server component data so queue, summoning and draft state
    // converge without requiring a manual page reload.
    stateRefreshId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshState();
    }, STATE_REFRESH_MS);

    return () => {
      stopped = true;
      window.clearTimeout(heartbeatTimeoutId);
      window.clearTimeout(reconnectTimeoutId);
      window.clearInterval(stateRefreshId);
      source.close();
    };
  }, [config, router]);

  useEffect(() => {
    listRef.current?.scrollTo(0, 0);
  }, [events]);

  return (
    <>
      <ul ref={listRef} className="overflow-auto max-h-60">
        {events.map((entry) => (
          <li key={entry.id}>
            <span className="mr-1">
              <Time date={Number(entry.message.timestamp)} format="LLL dd TT" />
            </span>
            <span className="inline-block mr-1 text-accent min-w-32">
              [{entry.message.event}]
            </span>
            <span className="text-info">{getText(entry as GatherEvent)}</span>
          </li>
        ))}
      </ul>
      {isConnected ? (
        <p className="text-success text-xs text-right">Connected</p>
      ) : (
        <p className="text-warning text-xs text-right">Disconnected</p>
      )}
    </>
  );
}

function getText({ message }: GatherEvent): string {
  switch (message.event) {
    case 'initiated':
      return `Gather initiated at ${message.payload.address} with ${message.payload.clientUIds.length} players`;
    case 'playerJoining':
      return `${message.payload.nick} is joining...`;
    case 'playerJoined':
      return `${message.payload.nick} joined.`;
    case 'playerRejected':
      return `${message.payload.nick} was rejected: Missing ${message.payload.reason}`;
    case 'playerLeft':
      return `${message.payload.nick} left.`;
    case 'playersSummoned':
      return `Summoning ${message.payload.clientUIds.length} players to ${message.payload.address}`;
    case 'playerRemoved':
      return `${message.payload.nick} was removed from the queue: ${message.payload.reason}`;
    case 'summonComplete':
      return `Summon complete for ${message.payload.clientUIds.length} players.`;
    case 'draftStarted':
      return `Captain draft started for match ${message.payload.matchId}.`;
    case 'draftUpdated':
      return message.payload.complete
        ? `Draft complete for match ${message.payload.matchId}.`
        : `Draft pick ${message.payload.pickIndex} recorded for match ${message.payload.matchId}.`;
    case 'playerMoved':
      return `${message.payload.nick} moved to ${message.payload.toChannel}.`;
    case 'gatherStarted':
      return `Gather started with match ${message.payload.matchId}.`;
    case 'nextQueue':
      return `Starting next queue at ${message.payload.address} with ${message.payload.clientUIds.length} players.`;
    case 'summonFail':
      return `Summon failed with ${message.payload.missingClientUIds.length} players not joining server.`;
  }
}
