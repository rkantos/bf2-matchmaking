import { Form } from '@remix-run/react';
import { User } from '@supabase/supabase-js';
import { FC } from 'react';
import { MatchesJoined, MatchStatus } from '@bf2-matchmaking/types';

interface Props {
  match: MatchesJoined;
  user: User;
}

const PlayerActions: FC<Props> = ({ match, user }) => {
  const hasJoined = match.players.some((player) => player.user_id === user.id);

  return (
    <div className="section grow flex gap-2 h-min">
      {match.status === MatchStatus.Open && hasJoined && (
        <Action action="./leave" name="Leave match" />
      )}
      {match.status === MatchStatus.Open && !hasJoined && (
        <Action action="./join" name="Join match" />
      )}
    </div>
  );
};

interface ActionProps {
  action: string;
  name: string;
  disabled?: boolean;
}
const Action: FC<ActionProps> = ({ action, name, disabled }) => (
  <Form method="post" action={action}>
    <button type="submit" className="filled-button" disabled={disabled}>
      {name}
    </button>
  </Form>
);

export default PlayerActions;
