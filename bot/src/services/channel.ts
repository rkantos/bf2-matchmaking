import { getChannels } from '../libs/supabase/supabase';

export const getChannelMap = async (): Promise<Array<[string, number]>> => {
  const { data } = await getChannels();
  return data?.map(({ channel_id, id }) => [channel_id, id]) || [];
};
