/**
 * SmartFetcher 
 * Encapsulates a robust, tiered fetching strategy to bypass CORS and handle large payloads.
 * 
 * Strategy:
 * 1. Direct fetch (Browser GET)
 * 2. Public Proxy check (Browser HEAD via corsproxy)
 *    -> If < 1MB, Public Proxy GET
 *    -> If > 1MB or check fails, Local Server Proxy GET
 */

const PUBLIC_CORS_PROXY = 'https://corsproxy.io/?';
const LOCAL_PROXY_ENDPOINT = '/api/camera/proxy?url=';

// Memory for failed proxies to prevent retrying bad public nodes
const failedProxies = new Set<string>();

export class SmartFetcher {
    /**
     * Attempts to fetch JSON data from a URL. Local paths (e.g. /cameras.json) are fetched
     * directly; absolute http(s) URLs use the tiered proxy fallback.
     */
    static async fetchJson(url: string): Promise<any> {
        const isLocalPath = url.startsWith("/") && !url.startsWith("//");
        if (isLocalPath) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`[SmartFetcher] Local path failed: ${url} (${res.status})`);
            return await this.parseResponse(res);
        }

        // Step 1: Try Direct Fetch (Fastest)
        try {
            const res = await fetch(url);
            if (res.ok) {
                return await this.parseResponse(res);
            }
        } catch (e) {
            // Direct fetch failed (likely CORS). Fall through to next tier.
        }

        // Step 2: Tiered Proxy Logic
        if (!failedProxies.has(PUBLIC_CORS_PROXY)) {
            try {
                // Try HEAD request to public proxy first
                const headRes = await fetch(`${PUBLIC_CORS_PROXY}${encodeURIComponent(url)}`, { method: 'HEAD' });
                if (headRes.ok) {
                    const contentLengthStr = headRes.headers.get('content-length');
                    const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

                    // Proceed via Public Proxy only if we know it's under 1MB (or exact size isn't known, hope for best)
                    // (Using 1,000,000 bytes as the safe threshold for most free proxies)
                    if (!contentLength || contentLength < 1000000) {
                        const getRes = await fetch(`${PUBLIC_CORS_PROXY}${encodeURIComponent(url)}`);
                        if (getRes.ok) {
                            return await this.parseResponse(getRes);
                        } else if (getRes.status === 413 || getRes.status === 408) {
                            // The public proxy lied or choked, blacklist it for this session.
                            console.warn(`[SmartFetcher] Public proxy choked on payload. Blacklisting ${PUBLIC_CORS_PROXY}`);
                            failedProxies.add(PUBLIC_CORS_PROXY);
                        }
                    }
                } else {
                    // Head request failed, proxy might be down or blocking
                    console.warn(`[SmartFetcher] Public proxy head check failed. Blacklisting ${PUBLIC_CORS_PROXY}`);
                    failedProxies.add(PUBLIC_CORS_PROXY);
                }
            } catch (e) {
                // Network error to proxy itself
                console.warn(`[SmartFetcher] Network error reaching public proxy. Blacklisting ${PUBLIC_CORS_PROXY}`);
                failedProxies.add(PUBLIC_CORS_PROXY);
            }
        }

        // Step 3: Local Server Proxy (Last resort, handles massive payloads)
        const localProxyUrl = `${LOCAL_PROXY_ENDPOINT}${encodeURIComponent(url)}`;
        const localRes = await fetch(localProxyUrl);
        if (!localRes.ok) {
            throw new Error(`[SmartFetcher] Local proxy failed to load URL: ${url} (Status: ${localRes.status})`);
        }

        return await localRes.json();
    }

    private static async parseResponse(res: Response): Promise<any> {
        // Read as text to support both direct JSON HTTP responses and file download streams
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error("Target URL did not return a valid JSON format.");
        }
    }
}
