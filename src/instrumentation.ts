export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startAisStream } = await import("./lib/ais-stream");
        startAisStream();
        // Aviation & Military: no background polling; data fetched on demand when layer is enabled (GET /api/aviation, GET /api/military)
    }
}
