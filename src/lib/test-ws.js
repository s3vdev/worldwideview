const WebSocket = require('ws');

console.log("Starting test script...");
const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

ws.on('open', () => {
    console.log('[Test] Connected securely to aisstream.io');
    const subscriptionMessage = {
        ApiKey: '091996a067bdae356f6b57244109e0192b373aef',
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ["PositionReport"]
    };
    ws.send(JSON.stringify(subscriptionMessage));
});

ws.on('message', (data) => {
    console.log('[Test] Received:', data.toString().substring(0, 100));
});

ws.on('close', (code, reason) => {
    console.log('[Test] Connection closed. Code:', code, 'Reason:', reason.toString());
});

ws.on('error', (err) => {
    console.error('[Test] Error:', err);
});

// Ping interval
setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
        console.log("Pinging...");
        ws.ping();
    } else {
        console.log("WS state is", ws.readyState);
    }
}, 3000);
