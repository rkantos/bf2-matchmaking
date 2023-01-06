const net = require('net');
const crypto = require('crypto');

const eventPort = 8080;
const LOCALHOST = '127.0.0.1';
let client;

const eventHandler = net.createServer((socket) => {
  console.log('wa connected');
  let serverInfo;
  let isForcefullyEndingRound = false;

  socket.on('data', (chunk) => {
    const data = chunk.toString().split('\t');
    const eventType = data[0];
    try {
      switch (eventType) {
        case 'gameStateEndGame':
          return handleGameStateEndGame(data);
        case 'serverInfo':
          return handleServerInfo(data);
        case 'chatServer':
          return handleChatServer(data);
        default:
          console.log(`wa: ${chunk.toString()}.`);
      }
    } catch (e) {
      console.error(e);
    }
  });
  socket.on('end', () => {
    console.log('wa disconnected');
    handleDisconnect(5000);
  });
  socket.on('error', (err) => {
    console.log(`Event handler error: ${err}`);
  });

  const handleGameStateEndGame = async (data) => {
    console.log(`handling ${data[0]}`);

    if (isForcefullyEndingRound) {
      console.log('Forcefully ended round detected.');
      isForcefullyEndingRound = false;
      return;
    }
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

    const si = await client?.send('bf2cc si');
    const pl = await client?.send('bf2cc pl');

    const res = await fetch('https://bf2-rcon-api-production.up.railway.app/rounds', {
      method: 'POST',
      body: JSON.stringify({ event, serverInfo, si, pl }),
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

  const handleChatServer = (data) => {
    const [type, channel, flags, text] = data;
    console.log(`${channel}: ${text} [flags: ${flags}]`);
    if (channel === 'ServerMessage' && text.includes('Changing Map to:')) {
      isForcefullyEndingRound = true;
    }
  };
});
const handleDisconnect = (timeout) => {
  client = initWebAdmin();
  setTimeout(() => {
    eventHandler.getConnections((err, count) => {
      if (count === 0) {
        console.log(`retrying connection in ${timeout / 1000} seconds...`);
        handleDisconnect(timeout * 1.5);
      }
    });
  }, timeout);
};

eventHandler.listen(eventPort, () => {
  console.log(`Event handler listening on port ${eventPort}.`);
  client = initWebAdmin();
});

const initWebAdmin = () => {
  console.log(`connecting to ${LOCALHOST}:${process.env.RCON_PORT}`);

  const waClient = net.createConnection(
    { port: process.env.RCON_PORT, host: LOCALHOST },
    () => {
      console.log('connected to rcon');
    }
  );

  waClient.on('data', (chunk) => {
    const data = chunk.toString();
    if (data.includes('### Digest seed: ')) {
      handleLogin(data);
    }
    if (data.includes('Authentication successful')) {
      console.log('authenticated');
      handleWaConnection();
    }
  });

  waClient.on('end', () => {
    console.log('disconnected from rcon');
  });

  waClient.on('error', (err) => {
    console.log(`WA client error: ${err}`);
    handleClientError();
  });

  const handleLogin = (data) => {
    const seed = data.split('### Digest seed: ').at(-1).trim();
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
    const rconCmd = `wa connect ${LOCALHOST} ${eventPort} \n`;
    console.log(`setting up wa connection with command "${rconCmd}"`);
    waClient.write(rconCmd);
    waClient.once('data', (response) => {
      console.log(`response from wa: ${response.toString()}`);
    });
  };

  return {
    send: (message) =>
      new Promise((resolve, reject) => {
        console.log(`sending message: ${message}`);
        waClient.write(message + '\n');
        waClient.once('data', (response) => {
          console.log('response received');
          resolve(response.toString());
        });
      }),
  };
};

const handleClientError = () => {
  console.log(`WA client retrying in 10 seconds...`);
  setTimeout(() => {
    eventHandler.getConnections((err, count) => {
      if (count === 0) {
        client = initWebAdmin();
      }
    });
  }, 10000);
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
