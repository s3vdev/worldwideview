import { Wifi } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    ServerPluginConfig,
    FilterDefinition,
} from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";

/**
 * Internet Outages Plugin – IODA API v2, country-level
 * Fetches /api/internet-outages (serverside IODA), joins with borders.geojson by iso_a2,
 * renders affected countries as colored polygons (severity: low=yellow, medium=orange, high=red).
 * No per-frame updates; polling every 10 min.
 */

interface InternetOutageItem {
    entityType: string;
    entityCode: string;
    name: string;
    severity: "low" | "medium" | "high";
    startTime: string | null;
    endTime: string | null;
    source: string;
}

interface GeoJSONFeature {
    type: string;
    properties?: Record<string, unknown> & { iso_a2?: string; name?: string };
    geometry?: {
        type: string;
        coordinates: number[][] | number[][][] | number[][][][];
    };
}

interface GeoJSONFC {
    type: string;
    features: GeoJSONFeature[];
}

function severityToColor(severity: string): string {
    switch (severity) {
        case "high":
            return "#ef4444";
        case "medium":
            return "#f97316";
        case "low":
            return "#eab308";
        default:
            return "#94a3b8";
    }
}

function severityToFillOpacity(severity: string): number {
    switch (severity) {
        case "high":
            return 0.35;
        case "medium":
            return 0.3;
        case "low":
            return 0.25;
        default:
            return 0.25;
    }
}

/** Extract first exterior ring from GeoJSON Polygon or MultiPolygon → { latitude, longitude }[] */
function featureToPositions(feature: GeoJSONFeature): Array<{ latitude: number; longitude: number; altitude?: number }> | null {
    const geom = feature?.geometry;
    if (!geom || !geom.coordinates) return null;
    // GeoJSON: Polygon = number[][][] (rings; ring = array of [lon,lat]); MultiPolygon = number[][][][]
    let ring: number[][];
    if (geom.type === "Polygon") {
        const coords = geom.coordinates as number[][][];
        ring = coords?.[0] ?? [];
    } else if (geom.type === "MultiPolygon") {
        const coords = geom.coordinates as number[][][][];
        const firstPoly = coords?.[0];
        ring = firstPoly?.[0] ?? [];
    } else {
        return null;
    }
    if (!ring || ring.length < 3) return null;
    return ring.map(([lon, lat]) => ({ latitude: lat, longitude: lon, altitude: 0 }));
}

/** Build iso_a2 → feature map from FeatureCollection */
function buildCountryMap(fc: GeoJSONFC): Map<string, GeoJSONFeature> {
    const map = new Map<string, GeoJSONFeature>();
    for (const f of fc?.features ?? []) {
        const code = f.properties?.iso_a2;
        if (typeof code === "string" && code.length === 2) {
            map.set(code.toUpperCase(), f);
        }
    }
    return map;
}

/** Centroid of polygon (for entity position) */
function polygonCentroid(
    positions: Array<{ latitude: number; longitude: number }>
): { latitude: number; longitude: number } {
    if (!positions.length) return { latitude: 0, longitude: 0 };
    let lat = 0,
        lon = 0;
    for (const p of positions) {
        lat += p.latitude;
        lon += p.longitude;
    }
    return { latitude: lat / positions.length, longitude: lon / positions.length };
}

let bordersCache: GeoJSONFC | null = null;

async function loadBorders(): Promise<GeoJSONFC> {
    if (bordersCache) return bordersCache;
    const res = await fetch("/borders.geojson", { cache: "force-cache" });
    if (!res.ok) throw new Error(`borders ${res.status}`);
    const fc = (await res.json()) as GeoJSONFC;
    bordersCache = fc;
    return fc;
}

export class InternetOutagesPlugin implements WorldPlugin {
    id = "internetOutages";
    name = "Internet Outages";
    description = "Country-level internet outages from IODA API v2 (polygon visualization)";
    icon = Wifi;
    category = "infrastructure" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
        console.log("[InternetOutagesPlugin] Initialized");
    }

    destroy(): void {
        this.context = null;
        console.log("[InternetOutagesPlugin] Destroyed");
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/internet-outages");
            if (!res.ok) {
                console.error(`[InternetOutagesPlugin] API returned ${res.status}`);
                return [];
            }
            const data = await res.json();
            const outages: InternetOutageItem[] = Array.isArray(data?.outages) ? data.outages : [];
            if (outages.length === 0) {
                if (data?.debug) console.log("[InternetOutagesPlugin]", data.debug);
                return [];
            }

            const fc = await loadBorders();
            const countryMap = buildCountryMap(fc);
            const entities: GeoEntity[] = [];

            for (const o of outages) {
                if (o.entityType !== "country") continue;
                const code = o.entityCode.toUpperCase();
                const feature = countryMap.get(code);
                if (!feature) continue;
                const positions = featureToPositions(feature);
                if (!positions || positions.length < 3) continue;
                const centroid = polygonCentroid(positions);
                const startStr = o.startTime ? new Date(o.startTime).toISOString() : "—";
                const endStr = o.endTime ? new Date(o.endTime).toISOString() : "—";
                entities.push({
                    id: `internet-outages-${code}`,
                    pluginId: "internetOutages",
                    latitude: centroid.latitude,
                    longitude: centroid.longitude,
                    altitude: 0,
                    timestamp: o.startTime ? new Date(o.startTime) : new Date(),
                    label: `${o.name} (${o.severity})`,
                    properties: {
                        countryCode: code,
                        countryName: o.name,
                        severity: o.severity,
                        startTime: o.startTime,
                        endTime: o.endTime,
                        entityType: o.entityType,
                        source: o.source ?? "IODA",
                        positions,
                        description: `Internet outage: ${o.name}, severity ${o.severity}`,
                    },
                });
            }

            console.log(`[InternetOutagesPlugin] Loaded ${entities.length} country polygons`);
            return entities;
        } catch (err) {
            console.error("[InternetOutagesPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 10 * 60 * 1000; // 10 minutes
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#f97316",
            clusterEnabled: false,
            clusterDistance: 0,
            maxEntities: 300,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const severity = (entity.properties?.severity as string) ?? "medium";
        const positions = entity.properties?.positions as Array<{
            latitude: number;
            longitude: number;
            altitude?: number;
        }>;

        if (!positions || positions.length < 3) {
            return { type: "point", color: severityToColor(severity), size: 8 };
        }

        return {
            type: "polygon",
            positions,
            color: severityToColor(severity),
            fillOpacity: severityToFillOpacity(severity),
            outlineColor: severityToColor(severity),
            showOutline: true,
            outlineWidth: 1.5,
            distanceDisplayCondition: { near: 10, far: 10_000_000 },
            labelText: severity === "high" ? entity.label : undefined,
            labelFont: "11px JetBrains Mono, monospace",
        };
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/internet-outages",
            pollingIntervalMs: 10 * 60 * 1000,
            requiresAuth: false,
            historyEnabled: false,
            availabilityEnabled: false,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "severity",
                label: "Severity",
                type: "select",
                propertyKey: "severity",
                options: [
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                ],
            },
        ];
    }
}
