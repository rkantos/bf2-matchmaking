import { Form } from '@remix-run/react';
import { User } from '@supabase/supabase-js';
import { FC } from 'react';
import { MatchesJoined, MatchStatus } from '@bf2-matchmaking/types';

interface Props {
  match: MatchesJoined;
  user: User;
}

const MatchActions: FC<Props> = ({ match, user }) => {
  const playerCount = match.players.length;
  const hasJoined = match.players.some((player) => player.user_id === user.id);
  const hasUnpickedPlayers = match.teams.some(({ team }) => team === null);

  return (
    <div className="flex gap-2">
      {match.status === MatchStatus.Open && hasJoined && (
        <Action action="./leave" name="Leave match" />
      )}
      {match.status === MatchStatus.Open && !hasJoined && (
        <Action action="./join" name="Join match" />
      )}
      {match.status === MatchStatus.Open && match.pick === 'random' && (
        <Action action="./start" name="Start match" disabled={playerCount < match.size} />
      )}
      {match.status === MatchStatus.Open && match.pick === 'captain' && (
        <Action action="./drafting" name="Start drafting" disabled={playerCount < match.size} />
      )}
      {match.status === MatchStatus.Drafting && (
        <Action action="./start" name="Start match" disabled={hasUnpickedPlayers} />
      )}
      {match.status === MatchStatus.Ongoing && <Action action="./close" name="Close match" />}
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
