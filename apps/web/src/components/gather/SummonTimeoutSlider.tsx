'use client';

import { useCallback, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import {
  MAX_SUMMON_TIMEOUT_MS,
  MIN_SUMMON_TIMEOUT_MS,
  SUMMON_TIMEOUT_STEP_MS,
} from '@bf2-matchmaking/utils/constants';

interface Props {
  configId: number;
  summonTimeout: number;
  onChange: (summonTimeout: number) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) {
    return `${seconds}s`;
  }
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export default function SummonTimeoutSlider({ summonTimeout, onChange }: Props) {
  // Track the slider locally so dragging stays responsive, and only persist on
  // release - otherwise every intermediate value would fire a request.
  const [value, setValue] = useState(summonTimeout);
  const [pending, startTransition] = useTransition();

  const commit = useCallback(
    (next: number) =>
      startTransition(async () => {
        const result = await onChange(next);
        if (result.error) {
          toast.error(`Failed to set summon timer: ${result.error.message}`);
          setValue(summonTimeout);
          return;
        }
        toast.success(`Summon timer set to ${formatDuration(next)}`);
      }),
    [onChange, summonTimeout]
  );

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium">Summon timer</span>
        <span className="badge badge-neutral font-mono">{formatDuration(value)}</span>
      </div>
      <input
        type="range"
        className="range range-sm range-accent"
        min={MIN_SUMMON_TIMEOUT_MS}
        max={MAX_SUMMON_TIMEOUT_MS}
        step={SUMMON_TIMEOUT_STEP_MS}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(Number(e.target.value))}
        onMouseUp={(e) => commit(Number(e.currentTarget.value))}
        onTouchEnd={(e) => commit(Number(e.currentTarget.value))}
        onKeyUp={(e) => commit(Number(e.currentTarget.value))}
      />
      <div className="flex justify-between text-xs text-base-content/60 mt-1">
        <span>{formatDuration(MIN_SUMMON_TIMEOUT_MS)}</span>
        <span>{formatDuration(MAX_SUMMON_TIMEOUT_MS)}</span>
      </div>
      <p className="text-xs text-base-content/60 mt-2">
        How long summoned players have to join the BF2 server before being removed
        from the queue.
      </p>
    </div>
  );
}
