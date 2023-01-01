const http = require('http');
const { execFile } = require('child_process');
const path = require('path');

const PORT = 1025;
var restartBf2Path = path.resolve(__dirname, './restart-bf2.sh');

const httpHandler = (req, res) => {
  const { method, url, headers } = req;
  if (method === 'POST' && url === '/restart') {
    console.log('restarting...');
    execFile(restartBf2Path, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      }
    });
  } else {
    console.log('404');
    res.statusCode = 404;
  }
  res.writeHead(200);
  res.end();
};

const server = http.createServer(httpHandler);
server.listen(PORT, process.env.BF2_SERVER_IP, () => {
  console.log(`Listening on port http://${process.env.BF2_SERVER_IP}:${PORT}`);
});

const verify = (variable, message) => {
  if (!variable) {
    throw new Error(message);
  }
};
verify(process.env.BF2_SERVER_IP, 'process.env.BF2_SERVER_IP is not defined.');
