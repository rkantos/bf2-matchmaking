import net from 'net';
import fs from 'fs';
import { info } from './logging';

const socketPath = '/tmp/node-python-sock';

const handler = (socket: net.Socket) => {
  socket.on('data', (bytes) => {
    const msg = bytes.toString();
    info('server', `Received data: ${msg}`);
    if (msg === 'python connected') {
      return socket.write('hi');
    }
    socket.write('end');
    return process.exit(0);
  });
};
export const createServer = () => {
  info('server', `Creating server with path: ${socketPath}`);
  fs.unlink(socketPath, () => net.createServer(handler).listen(socketPath));
};
