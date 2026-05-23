import { assertString } from '@bf2-matchmaking/utils';
import { NodeSSH } from 'node-ssh';
import { AsyncResult } from '@bf2-matchmaking/types';
import { toAsyncError } from '@bf2-matchmaking/utils/async';

export async function executeSSHCommand(
  address: string,
  command: string
): Promise<AsyncResult<string>> {
  const ssh = new NodeSSH();
  try {
    assertString(process.env.SSH_PRIVATE_KEY_B64, 'SSH_PRIVATE_KEY_B64 is not defined');
    await ssh.connect({
      host: address,
      username: 'bf2',
      privateKey: Buffer.from(process.env.SSH_PRIVATE_KEY_B64, 'base64').toString('utf8'),
    });
    const result = await ssh.execCommand(command);

    if (result.code === 0) {
      return { data: 'ok', error: null };
    } else {
      return { data: null, error: { message: result.stderr, properties: { ...result } } };
    }
  } catch (e) {
    return toAsyncError(e);
  } finally {
    ssh.dispose();
  }
}
