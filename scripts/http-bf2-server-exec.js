const http = require('http');
const { execFile, exec } = require('child_process');
const path = require('path');

const PORT = 1025;

const restartBf2Path = path.resolve(__dirname, './restart-bf2.sh');
const getWhitelistExec = (ip) =>
  `firewall-cmd --zone=public --add-rich-rule='  rule priority=1 family="ipv4" source address="${ip}/32" port protocol="udp" port="16567" accept'`;
const getBlockExec = () =>
  `firewall-cmd --zone=public --add-rich-rule=' rule priority=2 family=ipv4 port port="16567" protocol="udp" reject'`;
const getUnblockExec = () => `firewall-cmd --reload`;

const httpHandler = (req, res) => {
  const { method, url, headers } = req;
  if (method === 'POST' && url === '/restart') {
    console.log('restarting...');
    execFile(restartBf2Path, printExec);
  } else if (method === 'POST' && url === '/lock') {
    console.log('locking...');
    exec(getBlockExec(), printExec);
  } else if (method === 'POST' && url === '/whitelist') {
    parseBody(req, (data) => {
      data.whitelist.forEach((ip) => {
        if (ip.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
          console.log(`whitelisting ip ${ip}...`);
          exec(getWhitelistExec(ip), printExec);
        }
      });
    });
  } else if (method === 'POST' && url === '/unlock') {
    console.log('unlocking...');
    exec(getUnblockExec(), printExec);
  } else {
    console.log('404');
    res.statusCode = 404;
  }
  res.writeHead(200);
  res.end();
};

const parseBody = (req, cb) => {
  let chunks = [];
  req.on('data', (chunk) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    const buffer = Buffer.concat(chunks).toString();
    cb(JSON.parse(buffer));
  });
};

const printExec = (err, stdout, stderr) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`stdout: ${stdout}`);
    console.log(`stderr: ${stderr}`);
  }
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
