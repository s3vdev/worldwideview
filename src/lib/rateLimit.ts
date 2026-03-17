import { NextResponse } from "next/server";

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-server deployments (ThinkPad).
 * For distributed rate limiting, swap to @upstash/ratelimit.
 */
export class RateLimiter {
    private readonly windowMs: number;
    private readonly maxRequests: number;
    private readonly store = new Map<string, RateLimitEntry>();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor(opts: { windowMs: number; maxRequests: number }) {
        this.windowMs = opts.windowMs;
        this.maxRequests = opts.maxRequests;
        // Periodic cleanup to prevent memory leaks
        this.cleanupTimer = setInterval(() => this.cleanup(), opts.windowMs * 2);
    }

    /** Returns null if allowed, or a 429 Response if rate-limited. */
    check(key: string): NextResponse | null {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now > entry.resetAt) {
            this.store.set(key, { count: 1, resetAt: now + this.windowMs });
            return null;
        }

        entry.count++;
        if (entry.count > this.maxRequests) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            return NextResponse.json(
                { error: "Too many requests" },
                {
                    status: 429,
                    headers: { "Retry-After": String(retryAfter) },
                },
            );
        }

        return null;
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.resetAt) this.store.delete(key);
        }
    }

    destroy(): void {
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    }
}

/** Extract client IP from request headers. */
export function getClientIp(request: Request): string {
    return (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown"
    );
}
