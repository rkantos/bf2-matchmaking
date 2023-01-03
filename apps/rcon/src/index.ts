import readline from 'readline';
import invariant from 'tiny-invariant';
import { createClient } from './client';

const run = async () => {
  invariant(process.env.RCON_HOST, 'HOST not defined in .env');
  invariant(process.env.RCON_PORT, 'PORT not defined in .env');
  invariant(process.env.RCON_PASSWORD, 'PASSWORD not defined in .env');

  const client = await createClient({
    host: process.env.RCON_HOST,
    port: parseInt(process.env.RCON_PORT),
    password: process.env.RCON_PASSWORD,
  });
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  prompt.question('Input rcon command:', async (cmd) => {
    const data = await client.send(cmd);
    prompt.write(JSON.stringify(data));
    prompt.close();
  });
};

run();
