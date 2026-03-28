import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "https://marketplace.worldwideview.dev",
];

function isLocalNetwork(origin: string): boolean {
    if (!origin.startsWith("http://") && !origin.startsWith("https://")) return false;
    try {
        const url = new URL(origin);
        return (
            url.hostname === "localhost" ||
            url.hostname === "127.0.0.1" ||
            url.hostname.startsWith("192.168.") ||
            url.hostname.startsWith("10.") ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url.hostname)
        );
    } catch {
        return false;
    }
}

/** Build CORS headers for the marketplace bridge API. */
export function corsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get("origin") ?? "";
    const allowed = ALLOWED_ORIGINS.includes(origin) || isLocalNetwork(origin) ? origin : null;

    // If origin is not allowlisted, return no CORS headers (browser will block)
    if (!allowed) return {};

    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Private-Network": "true",
        "Access-Control-Max-Age": "86400",
    };
}

/** Standard preflight response. */
export function handlePreflight(request: Request): NextResponse {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(request),
    });
}

/** Wrap a NextResponse with CORS headers. */
export function withCors(response: NextResponse, request: Request): NextResponse {
    const headers = corsHeaders(request);
    for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
    }
    return response;
}
