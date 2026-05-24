import client from 'prom-client';
import http from 'http';

// Collect default system metrics (CPU, Memory, GC, etc.)
client.collectDefaultMetrics();

export const httpDuration = new client.Histogram({
  name: 'flowforge_http_request_duration_ms',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const runsTotal = new client.Counter({
  name: 'flowforge_runs_total',
  help: 'Total runs',
  labelNames: ['status', 'trigger_type'],
});

export const rateLimitHitTotal = new client.Counter({
  name: 'flowforge_rate_limit_hit_total',
  help: 'Total rate limit hits',
  labelNames: ['tenant'],
});

export const activeRuns = new client.Gauge({
  name: 'flowforge_active_runs',
  help: 'Currently active runs',
});

export const registry = client.register;

/**
 * Exposes a simple HTTP metrics server for non-API services (orchestrator, worker, scheduler, realtime).
 */
export function startMetricsServer(port: number): () => void {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': registry.contentType });
      res.end(await registry.metrics());
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, '0.0.0.0');

  return () => {
    server.close();
  };
}
