const net = require('net');

const eventPort = 8080;

const eventHandler = net.createServer((socket) => {
  console.log('wa connected');
  let serverInfo;

  socket.on('data', (chunk) => {
    const data = chunk.toString().split('\t');
    const eventType = data[0];
    try {
      switch (eventType) {
        case 'gameStateEndGame':
          return handleGameStateEndGame(data);
        case 'serverInfo':
          return handleServerInfo(data);
        default:
          console.log(`wa: ${chunk.toString()}.`);
      }
    } catch (e) {
      console.error(e);
    }
  });
  socket.on('end', () => {
    console.log('wa disconnected');
  });
  socket.on('error', (err) => {
    console.log(`Event handler error: ${err}`);
  });

  const handleGameStateEndGame = async (data) => {
    console.log(`handling ${data[0]}`);
    const event = {
      type: data[0],
      team1: {
        name: data[1],
        tickets: data[2],
      },
      team2: {
        name: data[3],
        tickets: data[4],
      },
      map: data[5],
    };
    const res = await fetch('https://bf2-rcon-api-production.up.railway.app/rounds', {
      method: 'POST',
      body: JSON.stringify({ event, serverInfo }),
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
    const textRes = await res.text();
    console.log(`POST /rounds, Status: ${res.status}, Message: ${textRes}`);
  };

  const handleServerInfo = (data) => {
    console.log(`handling ${data[0]}`);
    const event = {
      type: data[0],
      serverName: data[1],
      mapList: data[2],
      gamePort: data[3],
      queryPort: data[4],
      maxPlayers: data[5],
      ip: process.env.BF2_SERVER_IP,
    };
    serverInfo = event;
  };
});

eventHandler.listen(eventPort, () => {
  console.log(`Event handler listening on localhost:${eventPort}.`);
  initWebAdmin();
});

const initWebAdmin = () => {
  console.log(`connecting to localhost:${process.env.RCON_PORT}`);

  const waClient = net.createConnection({ port: process.env.RCON_PORT, host: 'localhost' }, () => {
    console.log('connected to rcon');
  });

  waClient.on('data', (chunk) => {
    const data = chunk.toString();
    if (data.includes('### Digest seed: ')) {
      handleLogin(data);
    }
    if (data.includes('Authentication successful')) {
      console.log('authenticated');
      handleWaConnection();
    }
    waClient.end();
  });

  waClient.on('end', () => {
    console.log('disconnected from rcon');
  });

  waClient.on('error', (err) => {
    console.log(`WA client error: ${err}`);
  });

  const handleLogin = (data) => {
    const seed = data.replace('### Digest seed: ', '').trim();
    console.log(`authenticating with seed ${seed}`);
    waClient.write(
      'login ' +
        crypto
          .createHash('md5')
          .update(seed + process.env.RCON_PASSWORD)
          .digest('hex') +
        '\n'
    );
  };

  const handleWaConnection = () => {
    const rconCmd = `wa connect localhost ${eventPort} \n`;
    console.log(`setting up wa connection with command "${rconCmd}"`);
    waClient.write(rconCmd);
    waClient.once('data', (response) => {
      console.log(response.toString());
    });
  };
};

const verify = (variable, message) => {
  if (!variable) {
    throw new Error(message);
  }
};
verify(process.env.RCON_PORT, 'process.env.RCON_PORT is not defined.');
verify(process.env.RCON_PASSWORD, 'process.env.RCON_PASSWORD is not defined.');
verify(process.env.BF2_SERVER_IP, 'process.env.BF2_SERVER_IP is not defined.');
verify(fetch, 'Fetch not defined, use node 18 or newer.');
