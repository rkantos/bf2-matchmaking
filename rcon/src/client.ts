import net from 'net';
import crypto from 'crypto';
import { info } from './logging';

interface Options {
  host: string;
  port: number;
  password: string;
}

interface Client {
  send: (message: string) => Promise<string>;
}

export const createClient = ({ host, port, password }: Options) => {
  return new Promise<Client>((resolve) => {
    const client = net.connect({
      host,
      port,
    });
    info('client', 'Initialized');

    client.on('connect', () => {
      info('client', 'Connected');
    });

    client.on('data', (data) => {
      const sent = data.toString();
      if (sent.indexOf('### Digest seed: ') != -1) {
        const seed = sent.replace('### Digest seed: ', '').trim();
        info('client', `seed: ${seed}`);
        client.write(
          'login ' +
            crypto
              .createHash('md5')
              .update(seed + password)
              .digest('hex') +
            '\n'
        );
      }

      if (sent.indexOf('Authentication successful') != -1) {
        info('client', 'Authenticated');
        resolve({
          send: (message: string) =>
            new Promise((resolve, reject) => {
              info('client', `sending message: ${message}`);

              client.write(message + '\n');
              client.once('data', (response) => {
                info('client', 'Received response');
                resolve(response.toString());
              });
            }),
        });
      }
    });
  });
};
