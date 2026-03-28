import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { issueMarketplaceToken } from "@/lib/marketplace/marketplaceToken";
import { grantTokenLimiter } from "@/lib/rateLimiters";
import { getClientIp } from "@/lib/rateLimit";
import { isPluginInstallEnabled } from "@/core/edition";

const ALLOWED_REDIRECT_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "worldwideview.dev",
]);

function isSafeRedirect(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            ALLOWED_REDIRECT_HOSTS.has(parsed.hostname) ||
            parsed.hostname.endsWith(".worldwideview.dev") ||
            parsed.hostname.startsWith("192.168.") ||
            parsed.hostname.startsWith("10.") ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(parsed.hostname)
        );
    } catch {
        return false;
    }
}

/**
 * GET /api/marketplace/grant-token
 * Issues a marketplace JWT for an authenticated user without requiring an install.
 * Used by the Manage page when the user configures their instance URL directly.
 *
 * Query params:
 *   redirectTo - URL to redirect to with ?token=<jwt> appended (must be allowlisted)
 */
export async function GET(request: NextRequest) {
    if (!isPluginInstallEnabled) {
        return NextResponse.json(
            { error: "Marketplace tokens are not available on this instance" },
            { status: 403 },
        );
    }

    const rateLimited = grantTokenLimiter.check(getClientIp(request));
    if (rateLimited) return rateLimited;

    const { searchParams } = request.nextUrl;
    const redirectTo = searchParams.get("redirectTo") ?? "";

    try {
        const session = await auth();

        if (!session?.user) {
            // Use forwarded host or Host header for correct public URL behind reverse proxy
            const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
            const proto = request.headers.get("x-forwarded-proto") ?? (request.nextUrl.protocol.replace(":", ""));
            const origin = `${proto}://${host}`;
            const loginUrl = new URL("/login", origin);
            const callbackUrl = request.nextUrl.pathname + request.nextUrl.search;
            loginUrl.searchParams.set("callbackUrl", `${origin}${callbackUrl}`);
            return NextResponse.redirect(loginUrl);
        }

        if (!redirectTo || !isSafeRedirect(redirectTo)) {
            return NextResponse.json({ error: "Invalid or missing redirectTo" }, { status: 400 });
        }

        const token = await issueMarketplaceToken(session.user.id ?? "");
        const dest = new URL(redirectTo);
        // Token in fragment — never sent to server in logs/referer
        return NextResponse.redirect(`${dest.toString()}#token=${token}`);
    } catch (err) {
        console.error("[grant-token] Unexpected error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
