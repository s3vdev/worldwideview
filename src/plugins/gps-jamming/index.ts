import { Radio } from "lucide-react";
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
 * GPS Jamming / GNSS Interference Plugin
 *
 * Data source: gpsjam.org (verified: /data/manifest.csv and /data/{date}-h3_4.csv).
 * Real H3 hexagon data; no dummy or fallback data. Empty layer if source unavailable.
 * Renders interference areas as semi-transparent Cesium polygon primitives.
 * Color by severity (GPSJAM thresholds): low 0-2% -> yellow, medium 2-10% -> orange, high >10% -> red.
 * Polygons are static until data refresh; no heavy allocations in animation loop.
 */

interface GpsJammingPolygon {
    id: string;
    severity: "low" | "medium" | "high";
    affectedPercent: number;
    positions: Array<{ latitude: number; longitude: number; altitude?: number }>;
    timestamp: string;
    region?: string;
}

function severityToColor(severity: string): string {
    switch (severity) {
        case "high":
            return "#ef4444"; // red
        case "medium":
            return "#f97316"; // orange
        case "low":
            return "#eab308"; // yellow
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

/** Centroid of polygon (for entity position / selection) */
function polygonCentroid(
    positions: Array<{ latitude: number; longitude: number }>
): { latitude: number; longitude: number } {
    if (!positions.length) return { latitude: 0, longitude: 0 };
    let lat = 0, lon = 0;
    for (const p of positions) {
        lat += p.latitude;
        lon += p.longitude;
    }
    return { latitude: lat / positions.length, longitude: lon / positions.length };
}

export class GPSJammingPlugin implements WorldPlugin {
    id = "gps-jamming";
    name = "GPS Jamming";
    description = "GNSS interference areas from gpsjam.org data (polygon visualization)";
    icon = Radio;
    category = "infrastructure" as const;
    version = "2.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
        console.log("[GPSJammingPlugin] Initialized");
    }

    destroy(): void {
        this.context = null;
        console.log("[GPSJammingPlugin] Destroyed");
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const cacheMs = useStore.getState().dataConfig.cacheEnabled ? useStore.getState().dataConfig.cacheMaxAge : 0;
            const res = await fetch(`/api/gps-jamming?cacheMaxAgeMs=${cacheMs}`);
            if (!res.ok) {
                console.error(`[GPSJammingPlugin] API returned ${res.status}: ${res.statusText}`);
                return [];
            }
            const data = await res.json();
            if (data.error || !Array.isArray(data.polygons)) {
                console.warn("[GPSJammingPlugin] Invalid response:", data.error || "no polygons");
                return [];
            }
            if (data.debug) {
                console.log("[GPSJammingPlugin] Debug:", data.debug.source, data.debug.polygonCount, "polygons", data.debug.notes?.join("; "));
            }
            if (data.polygons.length === 0) {
                console.log("[GPSJammingPlugin] No interference data (source unavailable or no hexes for date). No fallback used.");
                return [];
            }

            const entities: GeoEntity[] = data.polygons.map((poly: GpsJammingPolygon) => {
                const centroid = polygonCentroid(poly.positions);
                return {
                    id: `gps-jamming-${poly.id}`,
                    pluginId: "gps-jamming",
                    latitude: centroid.latitude,
                    longitude: centroid.longitude,
                    altitude: 0,
                    timestamp: new Date(poly.timestamp),
                    label: `${poly.severity.toUpperCase()} (${poly.affectedPercent}%)`,
                    properties: {
                        severity: poly.severity,
                        affectedPercent: poly.affectedPercent,
                        region: poly.region ?? "Unknown",
                        source: data.source ?? "gpsjam.org",
                        positions: poly.positions,
                        description: `Interference area: ${poly.affectedPercent}% of aircraft reported degraded navigation accuracy`,
                    },
                };
            });

            console.log(`[GPSJammingPlugin] Loaded ${entities.length} interference polygons`);
            return entities;
        } catch (err) {
            console.error("[GPSJammingPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 12 * 60 * 60 * 1000; // 12 hours
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#f97316",
            clusterEnabled: false,
            clusterDistance: 0,
            maxEntities: 500,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const severity = entity.properties.severity as string;
        const positions = entity.properties.positions as Array<{ latitude: number; longitude: number; altitude?: number }>;
        const affectedPercent = (entity.properties.affectedPercent as number) ?? 0;

        if (!positions || positions.length < 3) {
            return { type: "point", color: severityToColor(severity), size: 8 };
        }

        const color = severityToColor(severity);
        const fillOpacity = severityToFillOpacity(severity);

        return {
            type: "polygon",
            positions,
            color,
            fillOpacity,
            outlineColor: color,
            showOutline: true,
            outlineWidth: 1.5,
            distanceDisplayCondition: { near: 10, far: 10_000_000 },
            labelText: affectedPercent >= 10 ? entity.label : undefined,
            labelFont: "11px JetBrains Mono, monospace",
        };
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/gps-jamming",
            pollingIntervalMs: 12 * 60 * 60 * 1000,
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
                    { value: "low", label: "Low (<2%)" },
                    { value: "medium", label: "Medium (2-10%)" },
                    { value: "high", label: "High (>10%)" },
                ],
            },
            {
                id: "affectedPercent",
                label: "Affected %",
                type: "range",
                propertyKey: "affectedPercent",
                range: { min: 0, max: 100, step: 5 },
            },
        ];
    }
}
