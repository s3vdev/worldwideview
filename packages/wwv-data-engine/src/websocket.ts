import type { WebSocket } from 'ws';

// Track active connections and their subscriptions
const connections = new Set<WebSocket>();
const subscriptions = new Map<WebSocket, Set<string>>();

export function handleConnection(connection: WebSocket, request: any) {
  // Option A (Secure Defaults): In a highly public plugin ecosystem, 
  // checking the token is optional/opt-in via env vars.
  const requireToken = process.env.REQUIRE_WS_TOKEN === 'true';
  const providedToken = request.query?.token;

  if (requireToken && providedToken !== process.env.API_SECRET) {
    connection.send(JSON.stringify({ error: 'Unauthorized: Invalid or missing token' }));
    connection.close(1008);
    return;
  }

  connections.add(connection);
  subscriptions.set(connection, new Set());

  connection.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.action === 'subscribe' && data.pluginId) {
        subscriptions.get(connection)?.add(data.pluginId);
        // console.log(`[WS] Client subscribed to ${data.pluginId}`); // Comment out to avoid log spam
      }
      if (data.action === 'unsubscribe' && data.pluginId) {
        subscriptions.get(connection)?.delete(data.pluginId);
      }
    } catch (e) {
      console.error('[WS] Invalid message', e);
    }
  });

  connection.on('close', () => {
    connections.delete(connection);
    subscriptions.delete(connection);
  });
}

export function broadcastPluginData(pluginId: string, payload: any) {
  const message = JSON.stringify({ type: 'data', pluginId, payload });
  for (const connection of connections) {
    if (subscriptions.get(connection)?.has(pluginId)) {
      connection.send(message);
    }
  }
}
