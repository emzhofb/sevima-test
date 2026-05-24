import type { WebSocket } from 'ws';

export type Connection = {
  ws: WebSocket;
  tenant_id: string;
  user_id: string;
  subscribed_runs: Set<string>;
};

export class SubscriptionManager {
  private connections = new Set<Connection>();

  register(conn: Connection): void {
    this.connections.add(conn);
  }

  unregister(conn: Connection): void {
    this.connections.delete(conn);
  }

  subscribeRun(conn: Connection, runId: string): void {
    conn.subscribed_runs.add(runId);
  }

  unsubscribeRun(conn: Connection, runId: string): void {
    conn.subscribed_runs.delete(runId);
  }

  broadcast(event: { tenant_id: string; run_id: string; type: string; [key: string]: any }): void {
    const message = JSON.stringify(event);
    for (const conn of this.connections) {
      if (conn.tenant_id !== event.tenant_id) continue;
      if (conn.subscribed_runs.size > 0 && !conn.subscribed_runs.has(event.run_id)) continue;
      try {
        conn.ws.send(message);
      } catch {
        // ignore failed sends; conn will be cleaned up on close
      }
    }
  }

  size(): number {
    return this.connections.size;
  }
}
