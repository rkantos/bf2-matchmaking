import { createContext, FC, PropsWithChildren, useContext } from 'react';
import { PlayersRow } from '@bf2-matchmaking/supabase';
import invariant from 'tiny-invariant';

interface PlayerContextValue {
  player: PlayersRow | null;
}
const PlayerContext = createContext<PlayerContextValue>({ player: null });
interface Props {
  player: PlayersRow | null;
}
export const PlayerContextProvider: FC<PropsWithChildren<Props>> = ({ children, player }) => {
  return <PlayerContext.Provider value={{ player }}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  invariant(context, 'usePlayer must be used inside PlayerContextProvider');
  return context;
};
