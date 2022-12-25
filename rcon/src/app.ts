import express from 'express';
import bodyParser from 'body-parser';
import invariant from 'tiny-invariant';
import { createClient } from './client';
import { mapServerInfo } from './mappers';

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/run', async (req, res) => {
  const { host, port, password, cmd } = req.body;

  if (host && port) {
    const client = await createClient({
      host,
      port,
      password,
    });
    const data = await client.send(cmd);
    res.send(data);
  } else {
    res.status(400).send('Missing host or port.');
  }
});

app.post('/si', async (req, res) => {
  const { host, port, password } = req.body;

  if (host && port) {
    const client = await createClient({
      host,
      port,
      password,
    });
    const data = await client.send('bf2cc si');
    res.send(mapServerInfo(data));
  } else {
    res.status(400).send('Missing host or port.');
  }
});

app.get('/', async (req, res) => {
  const { cmd } = req.query;
  invariant(process.env.RCON_HOST, 'HOST not defined in .env');
  invariant(process.env.RCON_PORT, 'PORT not defined in .env');
  invariant(process.env.RCON_PASSWORD, 'PASSWORD not defined in .env');

  const client = await createClient({
    host: process.env.RCON_HOST,
    port: parseInt(process.env.RCON_PORT),
    password: process.env.RCON_PASSWORD,
  });
  if (cmd && cmd === 'bf2cc si') {
    const data = await client.send(cmd.toString());
    res.send(mapServerInfo(data));
  } else {
    res.send('No valid command defined.');
  }
});

/**
 * Get rounds from one time to another
 * server can note info every second into a round variable with the current time.
 * When time is lower than pervious a new round has started, and we now store info in a new variable
 * We then can fetch all rounds between match start and now(), and in frontend select the wanted rounds.
 */

app.get('/rounds', async (req, res) => {
  const { from, to, host, port, password } = req.query;
  console.log(`${from}, ${to}, ${host}, ${port}, ${password}`);
  return res.status(501).send('Endpoint is not ready yet.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
