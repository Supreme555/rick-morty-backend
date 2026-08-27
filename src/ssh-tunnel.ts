import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { createTunnel } from 'tunnel-ssh';
import type { Server } from 'node:net';

const logger = new Logger('SSHTunnel');

let tunnelServer: Server | null = null;

export async function openSSHTunnel(): Promise<void> {
  const keyPath = path.join(
    process.env.HOME || '',
    '.ssh',
    process.env.SSH_KEY_NAME || 'id_ed25519',
  );

  if (!fs.existsSync(keyPath)) {
    throw new Error(`SSH ключ не найден: ${keyPath}`);
  }

  const localPort = parseInt(process.env.SSH_LOCAL_PORT!, 10);
  const sshPort = parseInt(process.env.SSH_PORT!, 10);
  const dstPort = parseInt(process.env.SSH_DST_PORT!, 10);

  const [server] = await createTunnel(
    { autoClose: false, reconnectOnError: false },
    { port: localPort },
    {
      host: process.env.SSH_HOST,
      port: sshPort,
      username: process.env.SSH_USER,
      privateKey: fs.readFileSync(keyPath),
    },
    {
      srcAddr: '127.0.0.1',
      srcPort: localPort,
      dstAddr: process.env.SSH_DST_HOST,
      dstPort: dstPort,
    },
  );

  tunnelServer = server;
  logger.log('SSH tunnel established');
}

export function closeSSHTunnel(): void {
  if (tunnelServer) {
    tunnelServer.close();
    logger.log('SSH tunnel closed');
    tunnelServer = null;
  }
}
