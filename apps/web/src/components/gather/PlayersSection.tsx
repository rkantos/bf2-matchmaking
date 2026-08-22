import { GatherPlayer } from '@bf2-matchmaking/types';
import PlayerConnectionIcons, {
  PlayerConnectionStatus,
} from '@/components/gather/PlayerConnectionIcons';

interface Props {
  players: Array<GatherPlayer>;
  connections: Record<string, PlayerConnectionStatus>;
}

export default function PlayersSection({ players, connections }: Props) {
  return (
    <section className="section flex-auto">
      <h2>Queueing Players</h2>
      {players.length === 0 ? (
        <p>Empty queue</p>
      ) : (
        <ol className="prose">
          {players.map((player) => (
            <li key={player.teamspeak_id}>
              <span className="inline-flex items-center gap-2">
                {player.nick}
                <PlayerConnectionIcons status={connections[player.id]} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
