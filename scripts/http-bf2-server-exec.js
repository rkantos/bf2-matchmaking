const http = require('http');
const crypto = require('crypto');
const { execFile, exec } = require('child_process');
const path = require('path');

const PORT = 1025;

const restartBf2Path = path.resolve(__dirname, './restart-bf2.sh');
const getWhitelistExec = (ip) =>
  `firewall-cmd --zone=public --add-rich-rule='  rule priority=1 family="ipv4" source address="${ip}/32" port protocol="udp" port="16567" accept'`;
const getBlockExec = () =>
  `firewall-cmd --zone=public --add-rich-rule=' rule priority=2 family=ipv4 port port="16567" protocol="udp" reject'`;
const getUnblockExec = () => `firewall-cmd --reload`;

const hash = crypto.createHash('sha512');
const HASHED_KEY =
  'CDaLUXjI8DHQi2Dk9hn5Aqe1HcSRU8npql+c6DvRrGGPzHgC9HO4jwGhlAC2MLuN3+Tx1FofxOCfZzibpo3ucA==';
const isAuthorized = (apiKey) => {
  return typeof apiKey === 'string'
    ? crypto.timingSafeEqual(hash.copy().update(apiKey).digest(), Buffer.from(HASHED_KEY, 'base64'))
    : false;
};

const httpHandler = (req, res, body) => {
  const { method, url, headers } = req;
  if (!isAuthorized(body.apiKey)) {
    console.log('401');
    res.statusCode = 401;
  } else if (method === 'POST' && url === '/restart') {
    console.log('restarting...');
    execFile(restartBf2Path, printExec);
  } else if (method === 'POST' && url === '/lock') {
    console.log('locking...');
    exec(getBlockExec(), printExec);
  } else if (method === 'POST' && url === '/whitelist') {
    body.whitelist.forEach((ip) => {
      if (ip.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
        console.log(`whitelisting ip ${ip}...`);
        exec(getWhitelistExec(ip), printExec);
      }
    });
  } else if (method === 'POST' && url === '/unlock') {
    console.log('unlocking...');
    exec(getUnblockExec(), printExec);
  } else {
    console.log('404');
    res.statusCode = 404;
  }
  res.end();
};

const parseBody = (cb) => (req, res) => {
  let chunks = [];
  req.on('data', (chunk) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    const buffer = Buffer.concat(chunks).toString();
    let body;
    try {
      body = JSON.parse(buffer);
    } catch (e) {
      body = {};
    }
    cb(req, res, body);
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

const server = http.createServer(parseBody(httpHandler));
server.listen(PORT, process.env.BF2_SERVER_IP, () => {
  console.log(`Listening on port http://${process.env.BF2_SERVER_IP}:${PORT}`);
});

const verify = (variable, message) => {
  if (!variable) {
    throw new Error(message);
  }
};
verify(process.env.BF2_SERVER_IP, 'process.env.BF2_SERVER_IP is not defined.');
