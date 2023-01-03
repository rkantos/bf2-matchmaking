import React, { FC } from 'react';
import { NavLink, useNavigate } from '@remix-run/react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useUser } from '@supabase/auth-helpers-react';

const Header: FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between h-20 m-auto px-4 border-b">
      <h2 className="text-2xl bold justify-self-start">BF2 Matchmaking</h2>
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
          {user && (
            <li>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/');
                }}
              >
                Log out
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
