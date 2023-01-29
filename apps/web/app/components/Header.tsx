import React, { FC } from 'react';
import { NavLink, useNavigate } from '@remix-run/react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useUser } from '@supabase/auth-helpers-react';
import { usePlayer } from '~/state/PlayerContext';

const authRedirect =
  process.env.NODE_ENV === 'production'
    ? 'https://bf2-matchmaking.netlify.app/matches/'
    : 'http://localhost:5003/matches/';

const Header: FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const { player } = usePlayer();
  const navigate = useNavigate();

  return (
    <header className="header">
      <h1 className="text-2xl bold justify-self-start">BF2 Matchmaking</h1>
      <nav className="justify-self-center">
        <ul className="flex gap-4">
          <li>
            <NavLink to="/" className={({ isActive }) => (isActive ? 'underline' : undefined)}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/matches"
              className={({ isActive }) => (isActive ? 'underline' : undefined)}
            >
              Matches
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/rounds"
              className={({ isActive }) => (isActive ? 'underline' : undefined)}
            >
              Rounds
            </NavLink>
          </li>
          {player && <li>{player.full_name}</li>}
          {user && (
            <li>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/');
                }}
              >
                Sign out
              </button>
            </li>
          )}
          {!user && (
            <li>
              <button
                onClick={async () => {
                  await supabase.auth.signInWithOAuth({
                    provider: 'discord',
                    options: {
                      redirectTo: authRedirect,
                    },
                  });
                }}
              >
                Sign in
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
