const OPENSKY_TOKEN_URL =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

/** Threshold: rotate when credits fall below this value. */
const ROTATION_THRESHOLD = 50;

export interface OpenSkyCredential {
    clientId: string;
    clientSecret: string;
    accessToken: string | null;
    tokenExpiry: number;
    creditsRemaining: number | null;
    exhausted: boolean;
}

// ─── Pool state (survives HMR) ──────────────────────────────
const pool = globalThis as unknown as {
    _openskyPool: OpenSkyCredential[] | null;
    _openskyActiveIdx: number;
};

if (!pool._openskyPool) {
    pool._openskyPool = null;
    pool._openskyActiveIdx = 0;
}

// ─── Public API ─────────────────────────────────────────────

/** Parse credentials from env and initialise the pool (idempotent). */
export function initCredentialPool(): void {
    if (pool._openskyPool) return;

    const creds: OpenSkyCredential[] = [];

    // Primary: OPENSKY_CREDENTIALS=id1:secret1,id2:secret2
    const raw = process.env.OPENSKY_CREDENTIALS;
    if (raw) {
        for (const pair of raw.split(",")) {
            const trimmed = pair.trim();
            const colonIdx = trimmed.indexOf(":");
            if (colonIdx === -1) continue;
            const clientId = trimmed.slice(0, colonIdx);
            const clientSecret = trimmed.slice(colonIdx + 1);
            if (clientId && clientSecret) {
                creds.push(makeCredential(clientId, clientSecret));
            }
        }
    }

    // Fallback: legacy single-credential env vars
    if (creds.length === 0) {
        const clientId = process.env.OPENSKY_CLIENTID;
        const clientSecret = process.env.OPENSKY_CLIENTSECRET;
        if (clientId && clientSecret) {
            creds.push(makeCredential(clientId, clientSecret));
        }
    }

    pool._openskyPool = creds;
    pool._openskyActiveIdx = 0;

    const ids = creds.map((c) => c.clientId).join(", ");
    console.log(`[Credentials] Initialised pool with ${creds.length} credential(s): ${ids || "(none)"}`);
    if (creds.length > 0) {
        console.log(`[Credentials] Active credential: ${creds[0].clientId}`);
    }
}

/** Return the active credential, or null if all are exhausted / empty. */
export function getActiveCredential(): OpenSkyCredential | null {
    const creds = pool._openskyPool;
    if (!creds || creds.length === 0) return null;

    // Current is still usable
    const current = creds[pool._openskyActiveIdx];
    if (current && !current.exhausted) return current;

    // Try to find another non-exhausted credential
    for (let i = 0; i < creds.length; i++) {
        if (!creds[i].exhausted) {
            pool._openskyActiveIdx = i;
            console.log(`[Credentials] Rotated → now using credential ${i + 1}/${creds.length}: ${creds[i].clientId}`);
            return creds[i];
        }
    }

    console.warn(`[Credentials] All ${creds.length} credentials exhausted — falling back to Supabase`);
    return null;
}

/** Mark the current credential as exhausted and rotate to the next. */
export function rotateCredential(): void {
    const creds = pool._openskyPool;
    if (!creds || creds.length === 0) return;

    const current = creds[pool._openskyActiveIdx];
    if (current) {
        current.exhausted = true;
        console.log(`[Credentials] Credential ${pool._openskyActiveIdx + 1}/${creds.length} exhausted: ${current.clientId}`);
    }

    // getActiveCredential will find the next non-exhausted one
    getActiveCredential();
}

/** Update credit count on the active credential; rotate if below threshold. */
export function updateCredentialCredits(remaining: number): void {
    const cred = getActiveCredential();
    if (!cred) return;

    cred.creditsRemaining = remaining;

    if (remaining <= ROTATION_THRESHOLD) {
        console.log(`[Credentials] Credits low (${remaining}) on ${cred.clientId}, rotating...`);
        rotateCredential();
    }
}

/** Get how many credentials are still usable. */
export function getUsableCount(): number {
    const creds = pool._openskyPool;
    if (!creds) return 0;
    return creds.filter((c) => !c.exhausted).length;
}

/** Reset the pool (for testing only). */
export function resetPool(): void {
    pool._openskyPool = null;
    pool._openskyActiveIdx = 0;
}

// ─── Token fetch ────────────────────────────────────────────

/** Fetch or return a cached OAuth2 token for the given credential. */
export async function fetchTokenForCredential(
    cred: OpenSkyCredential,
): Promise<string | null> {
    const now = Date.now();
    if (cred.accessToken && now < cred.tokenExpiry) {
        return cred.accessToken;
    }

    try {
        const res = await fetch(OPENSKY_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: cred.clientId,
                client_secret: cred.clientSecret,
            }),
            cache: "no-store",
        });

        if (!res.ok) {
            console.error(`[Credentials] Token error for ${cred.clientId} (${res.status})`);
            return null;
        }

        const data = await res.json();
        cred.accessToken = data.access_token;
        cred.tokenExpiry = now + data.expires_in * 1000 - 30_000;

        console.log(`[Credentials] Token acquired for ${cred.clientId}`);
        return cred.accessToken;
    } catch (err) {
        console.error(`[Credentials] Token request failed for ${cred.clientId}:`, err);
        return null;
    }
}

// ─── Helpers ────────────────────────────────────────────────

function makeCredential(clientId: string, clientSecret: string): OpenSkyCredential {
    return {
        clientId,
        clientSecret,
        accessToken: null,
        tokenExpiry: 0,
        creditsRemaining: null,
        exhausted: false,
    };
}
