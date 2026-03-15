import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth?.user;
    const path = nextUrl.pathname;

    // Allow static assets and API routes through
    if (
        path.startsWith("/_next") ||
        path.startsWith("/api") ||
        path.startsWith("/data") ||
        path.includes(".")
    ) {
        return NextResponse.next();
    }

    // Allow setup and login pages
    if (path.startsWith("/setup") || path.startsWith("/login")) {
        return NextResponse.next();
    }

    // Check if first run (no users exist) — redirect to setup
    // Uses a lightweight API check to avoid importing Prisma in middleware
    if (!isLoggedIn) {
        try {
            const statusUrl = new URL("/api/auth/setup-status", nextUrl.origin);
            const res = await fetch(statusUrl);
            const data = await res.json();
            if (data.needsSetup) {
                return NextResponse.redirect(new URL("/setup", nextUrl));
            }
        } catch {
            // If check fails, fall through to login
        }

        return NextResponse.redirect(new URL("/login", nextUrl));
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
