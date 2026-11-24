import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { clientMessage } from '../shared/protocol';
import { World } from './world';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const MAX_PLAYERS = 40;
const MSGS_PER_SEC = 60;
const MSG_BURST = 300;
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2',
};

const http = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const file = normalize(join(DIST, path === '/' ? 'index.html' : path));
    if (!file.startsWith(DIST + sep)) throw new Error('outside dist');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const sockets = new Map<string, WebSocket>();
const world = new World((id, msg) => {
  const ws = sockets.get(id);
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
});

const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 4096 });
const alive = new WeakSet<WebSocket>();

wss.on('connection', (ws) => {
  if (sockets.size >= MAX_PLAYERS) return ws.close(1013, 'full');
  const id = randomUUID();
  sockets.set(id, ws);
  alive.add(ws);
  let tokens = MSG_BURST;
  let refilledAt = Date.now();

  ws.on('pong', () => alive.add(ws));
  ws.on('error', () => ws.terminate());
  ws.on('message', (raw) => {
    const now = Date.now();
    tokens = Math.min(MSG_BURST, tokens + ((now - refilledAt) / 1000) * MSGS_PER_SEC);
    refilledAt = now;
    // 그림 메시지를 골라 버리면 두 화면이 어긋나므로, 한도를 넘으면 연결을 끊는다.
    if (--tokens < 0) return ws.close(1008, 'too many messages');
    let json: unknown;
    try {
      json = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const parsed = clientMessage.safeParse(json);
    if (parsed.success) world.handle(id, parsed.data);
  });
  ws.on('close', () => {
    sockets.delete(id);
    world.disconnect(id);
  });
});

setInterval(() => world.flush(), 1000 / 15);
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, 15_000);

http.listen(PORT, HOST, () => console.log(`server ready on http://${HOST}:${PORT}`));
