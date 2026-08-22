'use client';

import { useEffect, useRef } from 'react';

/**
 * Launches BF2 into the gather server when the summon starts.
 *
 * The page re-renders on every gather event (EventList refreshes the route), so
 * this sees the move to Summoning as it happens and hands the browser the
 * bf2:// address the manual "Start bf2" link uses.
 *
 * Navigating rather than opening a window: a popup to a custom protocol is
 * blocked far more often, and assigning location for an external scheme leaves
 * the page itself untouched. Browsers still decide whether to prompt first, so
 * the manual links stay where they are for anyone whose browser declines.
 */
interface Props {
  /** The viewer turned the toggle on. */
  enabled: boolean;
  /** Summoning, this viewer is queued, and they are not on the server yet. */
  active: boolean;
  /** bf2:// address, absent until the live server is readable. */
  joinUrl: string | null | undefined;
  /**
   * Identifies this summon. The route refreshes constantly, so without it the
   * effect would relaunch the game on every render; a new summon changes the
   * value and so is allowed to fire once more.
   */
  summonKey: string;
}

export default function AutoJoinBf2({ enabled, active, joinUrl, summonKey }: Props) {
  const launched = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !active || !joinUrl) {
      return;
    }
    // Survives the remounts a route refresh causes, and a reload of the page
    // during the same summon, which would otherwise launch the game again.
    const key = `gather:auto-join:${summonKey}`;
    if (launched.current === key || window.sessionStorage.getItem(key)) {
      return;
    }
    launched.current = key;
    window.sessionStorage.setItem(key, String(Date.now()));
    window.location.href = joinUrl;
  }, [enabled, active, joinUrl, summonKey]);

  return null;
}
