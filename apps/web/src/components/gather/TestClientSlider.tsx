'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'react-toastify';

interface Props {
  kind: 'teamspeak' | 'bf2';
  initialCount: number;
  onChange: (count: number) => Promise<{
    data: { count: number } | null;
    error: { message: string } | null;
  }>;
}

export default function TestClientSlider({ kind, initialCount, onChange }: Props) {
  const [value, setValue] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const label = kind === 'teamspeak' ? 'Test TS clients' : 'Test BF2 clients';

  // The engine can move clients out of the queue after a match or summon
  // failure. Keep this controlled slider aligned with that server state;
  // useState(initialCount) alone only observes the value on first mount.
  useEffect(() => {
    if (!pending) setValue(initialCount);
  }, [initialCount, pending]);

  const commit = useCallback(
    (next: number) =>
      startTransition(async () => {
        const result = await onChange(next);
        if (result.error) {
          toast.error(`Failed to set ${label}: ${result.error.message}`);
          setValue(initialCount);
          return;
        }
        const actual = result.data?.count ?? next;
        setValue(actual);
        toast.success(`${label}: ${actual}`);
      }),
    [initialCount, label, onChange]
  );

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="badge badge-neutral font-mono">{value}</span>
      </div>
      <input
        type="range"
        className="range range-sm range-accent"
        min={0}
        max={16}
        step={1}
        value={value}
        disabled={pending}
        onChange={(event) => setValue(Number(event.target.value))}
        onMouseUp={(event) => commit(Number(event.currentTarget.value))}
        onTouchEnd={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => commit(Number(event.currentTarget.value))}
      />
      <div className="flex justify-between text-xs text-base-content/60 mt-1">
        <span>0</span>
        <span>16</span>
      </div>
      <p className="text-xs text-base-content/60 mt-2">
        {kind === 'teamspeak'
          ? 'Connects Test0–Test15 to the gather TeamSpeak channel.'
          : 'Connects Test0–Test15 to the selected real BF2 server.'}
      </p>
    </div>
  );
}
