/**
 * Edition detection module.
 *
 * Reads NEXT_PUBLIC_WWV_EDITION from the environment and exposes
 * typed constants + feature-flag helpers for the rest of the codebase.
 *
 * Use the NEXT_PUBLIC_ prefix so the value is available on both
 * server and client (Next.js inlines it at build time).
 */

// ---------------------------------------------------------------------------
// Edition type & constant
// ---------------------------------------------------------------------------

export type Edition = "local" | "cloud" | "demo";

const VALID_EDITIONS: ReadonlySet<string> = new Set<Edition>([
    "local",
    "cloud",
    "demo",
]);

/**
 * Resolve the current edition from the environment.
 * Falls back to `"local"` when the env var is unset or invalid.
 */
export function resolveEdition(raw?: string): Edition {
    const value = (raw ?? "").trim().toLowerCase();
    if (VALID_EDITIONS.has(value)) return value as Edition;
    return "local";
}

/** Current deployment edition — determined once at module load. */
export const edition: Edition = resolveEdition(
    process.env.NEXT_PUBLIC_WWV_EDITION,
);

// ---------------------------------------------------------------------------
// Boolean helpers
// ---------------------------------------------------------------------------

/** True when running as a self-hosted local instance. */
export const isLocal: boolean = edition === "local";

/** True when running as a managed cloud instance. */
export const isCloud: boolean = edition === "cloud";

/** True when running as the public demo instance. */
export const isDemo: boolean = edition === "demo";

// ---------------------------------------------------------------------------
// Feature flags (derived from edition)
// ---------------------------------------------------------------------------

/** Auth (login / registration) is available on local & cloud, not demo. */
export const isAuthEnabled: boolean = !isDemo;

/** Plugin install/uninstall is available on local & cloud, not demo. */
export const isPluginInstallEnabled: boolean = !isDemo;

/** Settings are editable on local & cloud, read-only on demo. */
export const isSettingsEditable: boolean = !isDemo;

/**
 * History playback is available on local & cloud, not demo.
 * On demo the server uses shared credentials — storing and redistributing
 * OpenSky data to third-party users would breach the non-transferable clause.
 * On local/cloud each user supplies their own credentials, so they hold their
 * own licence relationship with OpenSky.
 */
export const isHistoryEnabled: boolean = !isDemo;

// ---------------------------------------------------------------------------
// Demo admin override
// ---------------------------------------------------------------------------

/**
 * Server-side secret used as the admin password on the demo edition.
 * Set `WWV_DEMO_ADMIN_SECRET` in `.env` — never use `NEXT_PUBLIC_`.
 */
const DEMO_ADMIN_SECRET: string | undefined =
    process.env.WWV_DEMO_ADMIN_SECRET?.trim() || undefined;

/**
 * Returns the demo admin secret for use by the auth provider.
 * Only returns a value on demo edition when the secret is configured.
 */
export function getDemoAdminSecret(): string | undefined {
    if (!isDemo) return undefined;
    return DEMO_ADMIN_SECRET;
}

/** Demo admin session role constant. */
export const DEMO_ADMIN_ROLE = "demo-admin";

/**
 * Returns `true` when the session belongs to the demo admin user.
 * Accepts any session-like object (uses runtime narrowing to avoid
 * type conflicts with Auth.js `Session` which doesn't declare `role`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isDemoAdmin(session: any): boolean {
    return isDemo && session?.user?.role === DEMO_ADMIN_ROLE;
}

