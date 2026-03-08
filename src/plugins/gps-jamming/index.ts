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

/**
 * GPS Jamming / GNSS Interference Plugin (DEMO/FALLBACK ONLY)
 * 
 * ⚠️ WARNING: This plugin uses STATIC DEMONSTRATION DATA, not live feeds.
 * 
 * Why? GPSJAM (https://gpsjam.org/) does NOT provide a machine-readable API.
 * - GPSJAM is a visual-only tool with no JSON/GeoJSON endpoints
 * - Data requires web scraping (unreliable, potentially ToS violation)
 * - ADS-B Exchange direct integration requires commercial agreements
 * 
 * Current Implementation: Curated fallback data based on publicly reported hotspots
 * Future: Replace with real data source or remove this plugin
 * 
 * Visualization: Semi-transparent circular regions around hotspots
 * - Represents approximate affected area (not precise boundaries)
 * - Radius scaled by severity and affected percentage
 */

interface GPSJammingDataPoint {
    id: string;
    latitude: number;
    longitude: number;
    severity: "low" | "medium" | "high";
    affectedPercent: number;
    timestamp: string;
    region?: string;
}

function severityToColor(severity: string): string {
    switch (severity) {
        case "high":
            return "#ef4444"; // red — >10% aircraft affected
        case "medium":
            return "#f59e0b"; // amber/yellow — 2-10% affected
        case "low":
            return "#22c55e"; // green — minimal interference
        default:
            return "#94a3b8"; // gray — unknown
    }
}

/**
 * Calculate affected area radius in meters based on severity
 * These are approximate visual representations, not measured boundaries
 */
function severityToRadius(severity: string, affectedPercent: number): number {
    // Base radius in meters (approximate affected area)
    let baseRadius: number;
    
    switch (severity) {
        case "high":
            baseRadius = 150000; // ~150km for high severity
            break;
        case "medium":
            baseRadius = 100000; // ~100km for medium severity
            break;
        case "low":
            baseRadius = 60000; // ~60km for low severity
            break;
        default:
            baseRadius = 50000;
    }
    
    // Scale slightly by affected percentage (10-30% scaling range)
    const percentScale = 1.0 + (affectedPercent / 100) * 0.3;
    
    return baseRadius * percentScale;
}

/**
 * Convert severity to fill opacity for ellipse visualization
 */
function severityToFillOpacity(severity: string): number {
    switch (severity) {
        case "high":
            return 0.25; // 25% opacity for high severity
        case "medium":
            return 0.20; // 20% opacity for medium
        case "low":
            return 0.15; // 15% opacity for low
        default:
            return 0.15;
    }
}

/**
 * Convert severity to outline opacity
 */
function severityToOutlineOpacity(severity: string): number {
    switch (severity) {
        case "high":
            return 0.6; // 60% opacity for high severity
        case "medium":
            return 0.5; // 50% opacity for medium
        case "low":
            return 0.4; // 40% opacity for low
        default:
            return 0.4;
    }
}

export class GPSJammingPlugin implements WorldPlugin {
    id = "gps-jamming";
    name = "GPS Jamming (Demo)";
    description = "⚠️ Demo only - static hotspot data, not live feed";
    icon = Radio;
    category = "infrastructure" as const;
    version = "1.0.0-demo";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
        console.log("[GPSJammingPlugin] Initialized with context:", ctx);
    }

    destroy(): void {
        this.context = null;
        console.log("[GPSJammingPlugin] Destroyed");
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/gps-jamming");
            
            if (!res.ok) {
                console.error(`[GPSJammingPlugin] API returned ${res.status}: ${res.statusText}`);
                return [];
            }

            const data = await res.json();

            if (data.error) {
                console.warn("[GPSJammingPlugin] API Warning:", data.error);
                return [];
            }

            if (!data.dataPoints || !Array.isArray(data.dataPoints)) {
                console.warn("[GPSJammingPlugin] Invalid data format");
                return [];
            }

            const entities = data.dataPoints.map((point: GPSJammingDataPoint): GeoEntity => {
                const radiusMeters = severityToRadius(point.severity, point.affectedPercent);
                
                return {
                    id: `gps-jamming-${point.id}`,
                    pluginId: "gps-jamming",
                    latitude: point.latitude,
                    longitude: point.longitude,
                    altitude: 0, // Ground-level visualization
                    timestamp: new Date(point.timestamp),
                    label: `${point.severity.toUpperCase()} (${point.affectedPercent}%)`,
                    properties: {
                        severity: point.severity,
                        affectedPercent: point.affectedPercent,
                        region: point.region || "Unknown",
                        source: "GPSJAM (Demo)",
                        description: `Approximate affected area (demo): ${point.affectedPercent}% of aircraft reporting degraded navigation accuracy`,
                        radiusKm: Math.round(radiusMeters / 1000), // For display in info card
                        areaNote: "Approximate visualization - not a precise boundary",
                    },
                };
            });

            console.warn(`[GPSJammingPlugin] ⚠️ DEMO MODE: Displaying ${entities.length} static hotspot data points (NOT LIVE)`);
            return entities;
        } catch (err) {
            console.error("[GPSJammingPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        // GPSJAM updates daily with 24-hour aggregation
        // Poll every 12 hours to stay reasonably fresh without being aggressive
        return 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#f59e0b", // Default amber/warning color
            clusterEnabled: false, // Disable clustering for area-based visualization
            clusterDistance: 0,
            maxEntities: 2000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const severity = entity.properties.severity as string;
        const affectedPercent = entity.properties.affectedPercent as number;

        // Calculate rendering parameters
        const radiusMeters = severityToRadius(severity, affectedPercent);
        const fillOpacity = severityToFillOpacity(severity);
        const baseColor = severityToColor(severity);

        // Return ellipse-type entity with generic rendering options
        return {
            type: "ellipse",
            color: baseColor, // Used for fill color
            outlineColor: baseColor, // Same color but will be more opaque
            radiusMeters, // Generic ellipse parameter
            fillOpacity, // Generic ellipse parameter
            outlineWidth: 2,
            showOutline: true,
            distanceDisplayCondition: { near: 10, far: 10_000_000 }, // Show up to 10,000km
            labelText: affectedPercent >= 10 ? entity.label : undefined, // Only show labels for significant interference
            labelFont: "12px JetBrains Mono, monospace",
        };
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/gps-jamming",
            pollingIntervalMs: 12 * 60 * 60 * 1000, // 12 hours
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
                label: "Affected Aircraft %",
                type: "range",
                propertyKey: "affectedPercent",
                range: { min: 0, max: 100, step: 5 },
            },
        ];
    }
}
