'use client';

import { useCallback, useState, useTransition } from 'react';
import { toast } from 'react-toastify';
import { GatherDraftMode } from '@bf2-matchmaking/types/gather';

interface Props {
  draftMode: GatherDraftMode;
  onChange: (
    draftMode: GatherDraftMode
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export default function DraftModeToggle({ draftMode, onChange }: Props) {
  const [mode, setMode] = useState(draftMode);
  const [pending, startTransition] = useTransition();

  const toggle = useCallback(
    (checked: boolean) => {
      const next = checked ? GatherDraftMode.Captains : GatherDraftMode.Elo;
      setMode(next);
      startTransition(async () => {
        const result = await onChange(next);
        if (result.error) {
          toast.error(`Failed to set draft mode: ${result.error.message}`);
          setMode(draftMode);
          return;
        }
        toast.success(
          next === GatherDraftMode.Captains
            ? 'Captains will draft teams'
            : 'Teams by ELO'
        );
      });
    },
    [onChange, draftMode]
  );

  const isCaptains = mode === GatherDraftMode.Captains;

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-medium">Team selection</span>
        <span className="badge badge-neutral">
          {isCaptains ? 'Captain draft' : 'Teams by ELO'}
        </span>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="toggle toggle-accent"
          checked={isCaptains}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span className="text-sm">
          {isCaptains ? 'Captains pick (snake draft)' : 'Balanced automatically'}
        </span>
      </label>
      <p className="text-xs text-base-content/60 mt-2">
        Applies from the next completed summon. A draft already running is not
        affected.
      </p>
    </div>
  );
}
