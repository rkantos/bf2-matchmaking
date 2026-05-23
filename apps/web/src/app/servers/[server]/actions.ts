'use server';
import { supabase } from '@/lib/supabase/supabase-server';
import { cookies } from 'next/headers';
import {
  isNotNull,
  isString,
  ServerRconsUpdate,
  ServersUpdate,
} from '@bf2-matchmaking/types';
import { revalidatePath } from 'next/cache';
import { hasError } from '@bf2-matchmaking/supabase';
import { logErrorMessage, logMessage } from '@bf2-matchmaking/logging';
import { api } from '@bf2-matchmaking/services/api';
import { getPlayerToken } from '@/lib/token';

export async function pauseRound(address: string) {
  const token = await getPlayerToken();
  const result = await api.postServerPause(address, token);

  if (!result.error) {
    revalidatePath(`/servers/${address}`);
  }

  return result;
}

export async function unpauseRound(address: string) {
  const token = await getPlayerToken();
  const result = await api.postServerUnpause(address, token);

  if (!result.error) {
    revalidatePath(`/servers/${address}`);
  }
  return result;
}

export async function restartRound(address: string) {
  const token = await getPlayerToken();
  const result = await api.postServerExec(address, { cmd: 'admin.restartMap' }, token);

  if (!result.error) {
    revalidatePath(`/servers/${address}`);
  }

  return result;
}

export async function rebootServer(address: string) {
  const token = await getPlayerToken();
  return await api.postServerReboot(address, token);
}

export async function restartServer(address: string) {
  const token = await getPlayerToken();
  return await api.postServerExec(address, { cmd: 'quit' }, token);
}

export async function restartServerInfantry(ip: string) {
  const token = await getPlayerToken();
  const result = await api.postServerRestart(
    ip,
    { mode: 'infantry', admins: 'all' },
    token
  );
  if (!result.error) {
    revalidatePath(`/servers/${ip}`);
  }
  return result;
}

export async function restartServerVehicles(ip: string) {
  const token = await getPlayerToken();
  const result = await api.postServerRestart(
    ip,
    { mode: 'vehicles', admins: 'all' },
    token
  );
  if (!result.error) {
    revalidatePath(`/servers/${ip}`);
  }
  return result;
}

export async function updateServer(ip: string, data: FormData) {
  const { portInput, demosInput } = Object.fromEntries(data);
  let serverValues: ServersUpdate = {};
  if (isString(portInput)) {
    serverValues.port = portInput;
  }
  if (isString(demosInput)) {
    serverValues.demos_path = demosInput;
  }

  const cookieStore = await cookies();
  const serverUpdate =
    Object.keys(serverValues).length > 0
      ? supabase(cookieStore).updateServer(ip, serverValues)
      : null;

  const rconValues = toRconUpdateValues(data);
  const rconUpdate = rconValues
    ? supabase(cookieStore).updateServerRcon(ip, rconValues)
    : null;

  const results = await Promise.all([serverUpdate, rconUpdate].filter(isNotNull));
  if (results.some(hasError)) {
    return { ok: false };
  }
  revalidatePath(`/servers/${ip}`);
  return { ok: true };
}

const toRconUpdateValues = (data: FormData) => {
  const values: ServerRconsUpdate = {};

  const port = data.get('rconPortInput');
  if (port && isString(port)) {
    values.rcon_port = parseInt(port);
  }

  const pw = data.get('rconPwInput');
  if (pw && isString(pw)) {
    values.rcon_pw = pw;
  }

  if (Object.keys(values).length === 0) {
    return null;
  }

  return values;
};

export async function deleteServer(address: string) {
  const token = await getPlayerToken();
  const result = await api.deleteServer(address, token);

  if (result.error) {
    logErrorMessage(`Server ${address}: Failed to delete`, result.error);
    return result;
  }

  logMessage(`Server ${address}: Deleted successfully`, {
    result,
  });
  revalidatePath(`/servers`);
  return result;
}
