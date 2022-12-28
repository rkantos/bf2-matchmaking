// Include Nodejs' net module.
const Net = require('net');
// The port on which the server is listening.
const port = 8080;

// Use net.createServer() in your code. This is just for illustration purpose.
// Create a new TCP server.
const server = new Net.Server();
// The server listens to a socket for a client to make a connection request.
// Think of a socket as an end point.
server.listen(port, function () {
  console.log(`Server listening for connection requests on socket localhost:${port}.`);
});

// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function (socket) {
  let serverInfo;
  console.log('A new connection has been established.');

  // Now that a TCP connection has been established, the server can send data to
  // the client by writing to its socket.
  socket.write('Hello, client.');

  // The server can also receive data from the client by reading from its socket.
  socket.on('data', function (chunk) {
    const data = chunk.toString().split('\t');
    const eventType = data[0];
    try {
      switch (eventType) {
        case 'gameStateEndGame':
          return handleGameStateEndGame(data);
        case 'serverInfo':
          return handleServerInfo(data);
        default:
          console.log(`Data received from client: ${chunk.toString()}.`);
      }
    } catch (e) {
      console.error(e);
    }
  });

  // When the client requests to end the TCP connection with the server, the server
  // ends the connection.
  socket.on('end', function () {
    console.log('Closing connection with the client');
  });

  // Don't forget to catch error, for your own sake.
  socket.on('error', function (err) {
    console.log(`Error: ${err}`);
  });
});

const handleGameStateEndGame = async (data) => {
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
  const event = {
    type: data[0],
    serverName: data[1],
    mapList: data[2],
    gamePort: data[3],
    queryPort: data[4],
    maxPlayers: data[5],
  };
  serverInfo = event;
};
