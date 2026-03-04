export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startAviationPolling } = await import("./lib/aviation-polling");
        startAviationPolling();
    }
}
