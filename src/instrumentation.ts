export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startAviationPolling } = await import("./lib/aviation-polling");
        // startAisStream is handled by api route to prevent serverless deadlocks
        startAviationPolling();
    }
}
