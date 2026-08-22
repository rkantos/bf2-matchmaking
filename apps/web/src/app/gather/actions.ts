'use server';
import { api } from '@bf2-matchmaking/utils';
import { api as servicesApi } from '@bf2-matchmaking/services/api';
import { getValues } from '@bf2-matchmaking/utils/form';
import { revalidatePath } from 'next/cache';
import { getPlayerToken } from '@/lib/token';
import { GatherDraftMode } from '@bf2-matchmaking/types/gather';

export async function setSummonTimeout(configId: number, summonTimeout: number) {
  const token = await getPlayerToken();
  const result = await servicesApi.postGatherSummonTimeout(
    configId,
    summonTimeout,
    token
  );
  if (!result.error) {
    revalidatePath('/gather');
  }
  return result;
}

export async function setDraftMode(configId: number, draftMode: GatherDraftMode) {
  const token = await getPlayerToken();
  const result = await servicesApi.postGatherDraftMode(configId, draftMode, token);
  if (!result.error) {
    revalidatePath('/gather');
  }
  return result;
}

export async function setTestClientCount(
  configId: number,
  kind: 'teamspeak' | 'bf2',
  count: number
) {
  const token = await getPlayerToken();
  const result = await servicesApi.postGatherTestClientCount(
    configId,
    kind,
    count,
    token
  );
  if (!result.error) revalidatePath('/gather');
  return result;
}

export async function pickDraftPlayer(
  configId: number,
  playerId: string,
  team: 1 | 2
) {
  const token = await getPlayerToken();
  const result = await servicesApi.postGatherDraftPick(configId, playerId, team, token);
  if (!result.error) {
    revalidatePath('/gather');
  }
  return result;
}

export async function undoDraftPick(configId: number, playerId: string) {
  const token = await getPlayerToken();
  const result = await servicesApi.postGatherDraftUndo(configId, playerId, token);
  if (!result.error) revalidatePath('/gather');
  return result;
}

export async function setGatherServer(data: FormData) {
  const { serverSelect, configId } = getValues(data, 'serverSelect', 'configId');
  const result = await api.v2.postGatherServer(configId, serverSelect);
  if (!result.error) {
    revalidatePath('/gather');
  }
  return result;
}
