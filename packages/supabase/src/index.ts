import {
  createClient,
  PostgrestResponse,
  PostgrestSingleResponse,
} from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { Database } from './database.types';
import { createServerClient } from '@supabase/auth-helpers-remix';
import api from './supabase-api';

export const client = () => {
  invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
  invariant(process.env.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_KEY not defined.');
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  return { ...api(supabase) };
};

export const remixClient = (request: Request) => {
  invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
  invariant(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY not defined.');
  const response = new Response();
  const supabase = createServerClient<Database>(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      request,
      response,
    }
  );

  return {
    ...api(supabase),
    response,
    getSession: () => supabase.auth.getSession(),
  };
};

export const verifyResult = <T>({ data, error }: PostgrestResponse<T>) => {
  if (error) {
    throw error;
  }
  return data;
};

export const verifySingleResult = <T>({ data, error }: PostgrestSingleResponse<T>) => {
  if (error) {
    throw error;
  }
  return data;
};

export * from './services/match-service';
export * from './types';
