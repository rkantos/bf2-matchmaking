import { Match } from '~/lib/supabase.server';

export const isNotDeleted = (match: Match) => match.status !== 'deleted';
