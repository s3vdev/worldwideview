import type { CelesTrakGP } from "./types";

const CACHE_TTL = 3600000; // 60 minutes — TLE data updates infrequently

interface TLECache {
    data: CelesTrakGP[];
    timestamp: number;
}

const cacheByGroup = new Map<string, TLECache>();

export function getCachedTLEs(group: string): CelesTrakGP[] | null {
    const entry = cacheByGroup.get(group);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        cacheByGroup.delete(group);
        return null;
    }
    return entry.data;
}

export function setCachedTLEs(group: string, data: CelesTrakGP[]): void {
    cacheByGroup.set(group, { data, timestamp: Date.now() });
}
