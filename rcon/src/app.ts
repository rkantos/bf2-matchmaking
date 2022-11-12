import express from 'express';
import invariant from 'tiny-invariant';
import { createClient } from './client';

const app = express();
const PORT = process.env.PORT || 3000;

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
    res.send(data);
  } else {
    res.send('No valid command defined.');
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
