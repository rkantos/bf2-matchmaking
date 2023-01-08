import { FC } from 'react';
import { useFirstRenderDefault } from '../../hooks/ssr-hooks';
import { RoundsJoined } from '@bf2-matchmaking/supabase/src/types';

interface Props {
  round: RoundsJoined;
}

const RoundItem: FC<Props> = ({ round }) => {
  const date = useFirstRenderDefault(round.created_at, () =>
    new Date(round.created_at).toLocaleTimeString()
  );
  return (
    <li className="flex gap-4 p-4 border rounded w-full">
      <div className="mr-auto">
        <p className="text-xl">{round.map.name}</p>
        <p className="text-sm">{date}</p>
      </div>
      <div>
        <p className="text-md font-bold">{round.team1_name}</p>
        <p className="text-md">{round.team1_tickets}</p>
      </div>
      <div>
        <p className="text-md font-bold">{round.team2_name}</p>
        <p className="text-md">{round.team2_tickets}</p>
      </div>
    </li>
  );
};

export default RoundItem;
