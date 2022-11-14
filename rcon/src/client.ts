import net from 'net';
import crypto from 'crypto';
import { mapServerInfo, ServerInfo } from './mappers';

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
    console.log('Initialized');

    client.on('connect', () => {
      console.log('Connected');
    });

    client.on('data', (data) => {
      const sent = data.toString();
      if (sent.indexOf('### Digest seed: ') != -1) {
        const seed = sent.replace('### Digest seed: ', '').trim();
        console.log('seed: ' + seed);
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
        console.log('Authorized');
        resolve({
          send: (message: string) =>
            new Promise((resolve, reject) => {
              console.log('Sending message');

              client.write(message + '\n');
              client.once('data', (response) => {
                console.log('Received response');
                resolve(response.toString());
              });
            }),
        });
      }
    });
  });
};
