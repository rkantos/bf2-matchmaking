import { FC } from 'react';
import { useFirstRenderDefault } from '../../hooks/ssr-hooks';
import { JoinedRound } from '../../lib/supabase.server';

interface Props {
  round: JoinedRound;
}

const RoundItem: FC<Props> = ({ round }) => {
  const date = useFirstRenderDefault(round.created_at, () =>
    new Date(round.created_at).toLocaleString()
  );
  return (
    <li className="flex gap-4 m-4 p-4 border rounded w-96">
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
