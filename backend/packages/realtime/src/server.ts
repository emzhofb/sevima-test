import { WebSocketServer, type WebSocket } from 'ws';
import Redis from 'ioredis';
import { loadConfig, createLogger, createDbClient, startMetricsServer } from '@flowforge/shared';
import { verifyJwt } from '@flowforge/auth';
import { SubscriptionManager, type Connection } from './subscription-manager.js';

export function createRealtimeServer(opts: {
  port: number;
  db: any;
  redis: Redis;
}) {
  const log = createLogger('realtime');
  const manager = new SubscriptionManager();
  const wss = new WebSocketServer({ port: opts.port, path: '/ws' });

  // Redis Pub/Sub Bridge
  opts.redis.subscribe('flowforge:events').catch((err) => {
    log.error({ err }, 'Failed to subscribe to Redis events');
  });

  opts.redis.on('message', (channel, message) => {
    if (channel !== 'flowforge:events') return;
    try {
      const event = JSON.parse(message);
      manager.broadcast(event);
    } catch (err) {
      log.error({ err, message }, 'Failed to process Redis pubsub event');
    }
  });

  const HEARTBEAT_INTERVAL = 30_000;
  const HEARTBEAT_TIMEOUT = 60_000;

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4401, 'No token');
      return;
    }

    const config = loadConfig();
    const claims = verifyJwt(token, config.JWT_SECRET);
    if (!claims) {
      ws.close(4401, 'Invalid token');
      return;
    }

    const conn: Connection = {
      ws,
      tenant_id: claims.tenant_id,
      user_id: claims.user_id,
      subscribed_runs: new Set<string>(),
    };

    manager.register(conn);
    log.info({ tenant_id: claims.tenant_id, user_id: claims.user_id }, 'WebSocket client connected');

    let isAlive = true;
    let lastPong = Date.now();

    ws.on('pong', () => {
      isAlive = true;
      lastPong = Date.now();
    });

    const interval = setInterval(() => {
      if (Date.now() - lastPong > HEARTBEAT_TIMEOUT) {
        ws.terminate();
        clearInterval(interval);
        return;
      }
      isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
        clearInterval(interval);
      }
    }, HEARTBEAT_INTERVAL);

    ws.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return ws.send(JSON.stringify({ error: 'invalid_json' }));
      }

      if (msg.action === 'subscribe' && typeof msg.run_id === 'string') {
        try {
          const res = await opts.db.query(
            'SELECT id FROM runs WHERE id = $1 AND tenant_id = $2',
            [msg.run_id, claims.tenant_id],
          );
          if (res.rows.length === 0) {
            return ws.send(JSON.stringify({ error: 'run_not_found' }));
          }
          manager.subscribeRun(conn, msg.run_id);
          ws.send(JSON.stringify({ subscribed: msg.run_id }));
        } catch (err) {
          log.error({ err }, 'Error checking run subscription ownership');
          ws.send(JSON.stringify({ error: 'internal_error' }));
        }
      } else if (msg.action === 'unsubscribe' && typeof msg.run_id === 'string') {
        manager.unsubscribeRun(conn, msg.run_id);
        ws.send(JSON.stringify({ unsubscribed: msg.run_id }));
      }
    });

    ws.on('close', () => {
      clearInterval(interval);
      manager.unregister(conn);
      log.info({ tenant_id: claims.tenant_id }, 'WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      log.error({ err, tenant_id: claims.tenant_id }, 'WebSocket client error');
    });
  });

  return { wss, manager };
}

if (process.env.NODE_ENV !== 'test') {
  const config = loadConfig();
  const db = createDbClient(config);
  const redisPubSub = new Redis(config.REDIS_URL);
  createRealtimeServer({ port: 3001, db, redis: redisPubSub });
  createLogger('realtime').info('Realtime server listening on :3001/ws');
  startMetricsServer(Number(process.env.METRICS_PORT ?? 3005));
}
