export interface PlayerConnectionStatus {
  teamspeak: boolean;
  bf2: boolean;
  bf2Team?: string;
}

interface Props {
  status?: PlayerConnectionStatus;
  showBf2?: boolean;
}

/** Compact brand indicators shown only while that connection is live. */
export default function PlayerConnectionIcons({ status, showBf2 = true }: Props) {
  if (!status?.teamspeak && !(showBf2 && status?.bf2)) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1" aria-label="Connections">
      {status.teamspeak && (
        <span
          className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-[#2580c3] px-0.5 text-[8px] font-black leading-none text-white"
          title="Connected to TeamSpeak 3"
          aria-label="Connected to TeamSpeak 3"
        >
          TS3
        </span>
      )}
      {showBf2 && status.bf2 && (
        <span
          className="inline-flex h-4 min-w-5 items-center justify-center rounded-sm bg-neutral px-1 text-[8px] font-black italic leading-none tracking-tighter text-warning"
          title="Connected to Battlefield 2"
          aria-label="Connected to Battlefield 2"
        >
          BF2
        </span>
      )}
    </span>
  );
}
