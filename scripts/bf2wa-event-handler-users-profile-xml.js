const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Log file path
const LOG_FILE_PATH = path.resolve(__dirname, 'log-bf2wa-event-handler-users-profile-xml.log');

// Create a write stream (append mode)
const logStream = fs.createWriteStream(LOG_FILE_PATH, { flags: 'a' });

// Timestamped loggers
const log = (...args) => {
	const ts = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
	const message = `[${ts}] ${args.join(' ')}\n`;
	console.log(message.trim());
	logStream.write(message);
};

const logError = (...args) => {
	const ts = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
	const message = `[${ts}] ERROR: ${args.join(' ')}\n`;
	console.error(message.trim());
	logStream.write(message);
};

// Log uncaught exceptions but do not exit
process.on('uncaughtException', (err) => {
	logError('Uncaught Exception:', err.stack || err);
	// do not call process.exit(1)
});

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	logError('Unhandled Rejection at:', promise, 'reason:', reason);
});

const eventPort = 8080;
const LOCALHOST = '127.0.0.1';
let client;

const eventHandler = net.createServer((socket) => {
	log('wa connected');
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
					log(`wa: ${chunk.toString()}.`);
			}
		} catch (e) {
			logError(e);
		}
	});
	socket.on('end', () => {
		log('wa disconnected');
		handleClientError();
	});
	socket.on('error', (err) => {
		logError(`Event handler error: ${err}`);
	});

	const handleGameStateEndGame = async (data) => {
		log(`handling ${data[0]}`);

		if (isForcefullyEndingRound) {
			log('Forcefully ended round detected.');
			isForcefullyEndingRound = false;
			return;
		}
		const event = {
			type: data[0],
			team1: { name: data[1], tickets: data[2] },
			team2: { name: data[3], tickets: data[4] },
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
		log(`POST /rounds, Status: ${res.status}, Message: ${textRes}`);
	};

	const handleServerInfo = (data) => {
		log(`handling ${data[0]}`);
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
		log(`${channel}: ${text} [flags: ${flags}]`);
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
				log(`retrying connection in ${timeout / 1000} seconds...`);
				handleDisconnect(timeout * 1.5);
			}
		});
	}, timeout);
};

eventHandler.listen(eventPort, () => {
	log(`Event handler listening on port ${eventPort}.`);
	client = initWebAdmin();
});

const initWebAdmin = () => {
	log(`connecting to ${LOCALHOST}:${process.env.RCON_PORT}`);

	const waClient = net.createConnection(
		{ port: process.env.RCON_PORT, host: LOCALHOST },
		() => {
			log('connected to rcon');
		}
	);

	waClient.on('data', (chunk) => {
		const data = chunk.toString();
		if (data.includes('### Digest seed: ')) {
			handleLogin(data);
		}
		if (data.includes('Authentication successful')) {
			log('authenticated');
			handleWaConnection();
		}
	});

	waClient.on('end', () => {
		log('disconnected from rcon');
	});

	waClient.on('error', (err) => {
		logError(`WA client error: ${err}`);
		handleClientError();
	});

	const handleLogin = (data) => {
		const seed = data.split('### Digest seed: ').at(-1).trim();
		log(`authenticating with seed ${seed}`);
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
		log(`setting up wa connection with command "${rconCmd}"`);
		waClient.write(rconCmd);
		waClient.once('data', (response) => {
			log(`response from wa: ${response.toString()}`);
		});
	};

	return {
		send: (message) =>
			new Promise((resolve, reject) => {
				log(`sending message: ${message}`);
				waClient.write(message + '\n');
				waClient.once('data', (response) => {
					log('response received');
					resolve(response.toString());
				});
			}),
	};
};

const handleClientError = () => {
	log(`WA client retrying in 10 seconds...`);
	setTimeout(() => {
		eventHandler.getConnections((err, count) => {
			if (count === 0) {
				client = initWebAdmin();
			}
		});
	}, 10000);
};

const verify = (variable, message) => {
	if (!variable) throw new Error(message);
};
verify(process.env.RCON_PORT, 'process.env.RCON_PORT is not defined.');
verify(process.env.RCON_PASSWORD, 'process.env.RCON_PASSWORD is not defined.');
verify(process.env.BF2_SERVER_IP, 'process.env.BF2_SERVER_IP is not defined.');
verify(fetch, 'Fetch not defined, use node 18 or newer.');

//
const { execFile, exec } = require('child_process');

const PORT = 1025;

const restartBf2Path = path.resolve(__dirname, './restart-bf2.sh');
const getWhitelistExec = (ip) =>
	`sudo firewall-cmd --zone=public --add-rich-rule='  rule priority=-1 family="ipv4" source address="${ip}/32" port protocol="udp" port="16567" accept'`;
const getBlockExec = () =>
	`sudo /usr/bin/firewall-cmd --zone=public --add-rich-rule=' rule priority=0 family=ipv4 port port="16567" protocol="udp" reject'`;
const getUnblockExec = () => `sudo /usr/bin/firewall-cmd --reload`;

const hash = crypto.createHash('sha512');
const HASHED_KEY =
	'CDaLUXjI8DHQi2Dk9hn5Aqe1HcSRU8npql+c6DvRrGGPzHgC9HO4jwGhlAC2MLuN3+Tx1FofxOCfZzibpo3ucA==';
const isAuthorized = (apiKey) => {
	return typeof apiKey === 'string'
		? crypto.timingSafeEqual(
				hash.copy().update(apiKey).digest(),
				Buffer.from(HASHED_KEY, 'base64')
		  )
		: false;
};

const fsp = require('fs/promises');

const USERS_XML_PATH = path.resolve(__dirname, 'server', 'users.xml');
const BF2TOP_XML_PATH = path.resolve(__dirname, 'server', 'bf2top.profile');

const httpHandler = async (req, res, body) => {
	const { method, url } = req;

	if (!isAuthorized(body.apiKey)) {
		logError('401 Unauthorized');
		res.statusCode = 401;
		res.end();
		return;
	}

	if (method === 'POST' && url === '/restart') {
		log(`/restart endpoint hit.`);
		try {
			if (body.usersxml) {
				log('Writing to file:', USERS_XML_PATH, 'with data:', body.usersxml);
				log('Saving users.xml from request body...');
				const decodedXml = Buffer.from(body.usersxml, 'base64').toString('utf8');
				await fsp.writeFile(USERS_XML_PATH, decodedXml, { encoding: 'utf8' });
				log(`users.xml saved to ${USERS_XML_PATH}`);
			} else {
				logError('No users.xml provided in the request body');
			}

			const hasProfileXml = Boolean(body.profilexml);
			if (hasProfileXml || body.profilexml !== null) {
				log('Writing to file:', BF2TOP_XML_PATH, 'with data:', body.profilexml);
				log('Saving bf2top.xml from request body...');
				const decodedProfileXml = Buffer.from(body.profilexml, 'base64').toString('utf8');
				await fsp.writeFile(BF2TOP_XML_PATH, decodedProfileXml, { encoding: 'utf8' });
				log(`bf2top.xml saved to ${BF2TOP_XML_PATH}`);
			} else {
				logError('No bf2top.profile (profilexml) provided in the request body');
			}

			const args = [body.mapName || ''];
			const mode = body.mode;
			log(`MODE: ${body.mode}`);
			if (hasProfileXml) {
				args.push('bf2top');
			} else if (mode === 'infantry') {
				args.push('inf');
			} else if (mode === 'vehicles') {
				args.push('vehicles');
			} else {
				throw new Error(`Invalid mode: ${mode}. Expected 'infantry' or 'vehicles'.`);
			}

			if (body.serverName) {
				args.push(body.serverName);
			}

			log(`Restarting server with args: ${args.join(', ')}`);
			execFile(restartBf2Path, args.filter(Boolean), printExec);

			exec(getUnblockExec(), printExec);
		} catch (error) {
			logError(`Error in /restart: ${error.message}`);
			res.statusCode = 500;
			res.end(`Error: ${error.message}`);
			return;
		}
	} else if (method === 'POST' && url === '/lock') {
		log('Locking server...');
		exec(getBlockExec(), printExec);
	} else if (method === 'POST' && url === '/whitelist') {
		body.whitelist.forEach((ip) => {
			if (ip.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
				log(`Whitelisting IP ${ip}...`);
				exec(getWhitelistExec(ip), printExec);
			}
		});
	} else if (method === 'POST' && url === '/unlock') {
		log('Unlocking server...');
		exec(getUnblockExec(), printExec);
	} else {
		logError('404 Not Found');
		res.statusCode = 404;
	}

	res.statusCode = 204;
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
		logError(err);
	} else {
		log(`stdout: ${stdout}`);
		log(`stderr: ${stderr}`);
	}
};

const server = http.createServer(parseBody(httpHandler));
server.listen(PORT, process.env.BF2_SERVER_IP, () => {
	log(`Listening on port http://${process.env.BF2_SERVER_IP}:${PORT}`);
});

const serverLockfile = path.resolve('server/bf2_firewall.lockfile');
const ipStreamLockfile = path.resolve('server/bf2_stream.lockfile');
let lastLine = '';

try {
	lastLine = fs.readFileSync(serverLockfile, 'utf-8').trim().split('\n').pop();
} catch (error) {
	logError(`Failed to read file: ${error}`);
	fs.writeFileSync(serverLockfile, '');
	logError(`File ${serverLockfile} created`);
}
try {
	ipLastLine = fs.readFileSync(ipStreamLockfile, 'utf-8').trim().split('\n').pop();
} catch (error) {
	logError(`Failed to read file: ${error}`);
	fs.writeFileSync(ipStreamLockfile, '');
	logError(`File ${ipStreamLockfile} created`);
}

fs.watch(serverLockfile, { persistent: true }, (eventType, filename) => {
	if (eventType === 'change' && filename === path.basename(serverLockfile)) {
		let currentLine = '';
		try {
			currentLine = fs.readFileSync(serverLockfile, 'utf-8').trim().split('\n').pop();
		} catch (error) {
			logError(`Failed to read file: ${error}`);
			return;
		}
		if (lastLine !== currentLine) {
			lastLine = currentLine;
			if (currentLine === 'lock') {
				log('Run command when file ends with "lock"');
				exec(getBlockExec(), printExec);
				log('locking...');
			} else if (currentLine === 'unlock') {
				log('Run command when file ends with "unlock"');
				exec(getUnblockExec(), printExec);
				log('unlocking...');
			}
		}
	}
});

fs.watch(ipStreamLockfile, { persistent: true }, (eventType, filename) => {
	if (eventType === 'change' && filename === path.basename(ipStreamLockfile)) {
		let currentLine = '';
		try {
			ipCurrentLine = fs.readFileSync(ipStreamLockfile, 'utf8').trim().split('\n').pop();
		} catch (error) {
			logError(`Failed to read file: ${error}`);
			return;
		}
		if (ipLastLine !== ipCurrentLine) {
			ipLastLine = ipCurrentLine;
			const ips = ipCurrentLine.match(/\d+\.\d+\.\d+\.\d+/g) || [];
			ips.forEach((ip) => {
				exec(getWhitelistExec(ip), printExec);
				log('whitelisting some streamer...');
			});
		}
	}
});
