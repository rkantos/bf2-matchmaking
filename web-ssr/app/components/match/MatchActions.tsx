import { Form } from '@remix-run/react';
import { User } from '@supabase/supabase-js';
import { FC } from 'react';
import { JoinedMatch } from '~/lib/supabase.server';

interface Props {
  match: JoinedMatch;
  user: User;
}

const MatchActions: FC<Props> = ({ match, user }) => {
  const playerCount = match.players.length;
  const hasJoined = match.players.some((player) => player.id === user?.id);
  const hasUnpickedPlayers = match.teams.some(({ team }) => team === null);

  return (
    <div className="flex gap-2">
      {match.status === 'open' && hasJoined && <Action action="./leave" name="Leave match" />}
      {match.status === 'open' && !hasJoined && <Action action="./join" name="Join match" />}
      {match.status === 'open' && match.pick === 'random' && (
        <Action action="./start" name="Start match" disabled={playerCount < match.size} />
      )}
      {match.status === 'open' && match.pick === 'captain' && (
        <Action action="./pick" name="Start picking" disabled={playerCount < match.size} />
      )}
      {match.status === 'picking' && (
        <Action action="./start" name="Start match" disabled={hasUnpickedPlayers} />
      )}
      {match.status === 'started' && <Action action="./close" name="Close match" />}
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

export default MatchActions;
