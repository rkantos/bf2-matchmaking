import { createContext, FC, PropsWithChildren, useContext, useMemo } from 'react';
import { MatchesJoined, PlayersRow } from '@bf2-matchmaking/types';
import invariant from 'tiny-invariant';

interface PlayerContextValue {
  player: PlayersRow | null;
  isMatchPlayer: (match: MatchesJoined) => boolean;
}
const PlayerContext = createContext<PlayerContextValue>({} as any);
interface Props {
  player: PlayersRow | null;
}
export const PlayerContextProvider: FC<PropsWithChildren<Props>> = ({ children, player }) => {
  const isMatchPlayer = (match: MatchesJoined) =>
    player ? match.players.some((p) => p.id === player.id) : false;

  const contextValue = useMemo(() => ({ player, isMatchPlayer }), [player, isMatchPlayer]);

  return <PlayerContext.Provider value={contextValue}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  invariant(context, 'usePlayer must be used inside PlayerContextProvider');
  return context;
};
