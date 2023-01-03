import { createBrowserClient } from '@supabase/auth-helpers-remix';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

export const useSupabaseClient = (env: any, initialSession: Session) => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(initialSession);

  useEffect(() => {
    if (!supabase) {
      const supabaseClient = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
      setSupabase(supabaseClient);
      const {
        data: { subscription },
      } = supabaseClient.auth.onAuthStateChange((_, session) => setSession(session));
      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);
};
