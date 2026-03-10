import { Activity } from "lucide-react";
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
 * Earthquake Plugin - Real-time global seismic activity
 * 
 * Data source: USGS GeoJSON Feed
 * https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
 * 
 * Features:
 * - Live data from USGS (all earthquakes in the last 24 hours)
 * - Dual visualization: center point marker + area ellipse
 * - Alert-based coloring (with magnitude fallback) and magnitude-based sizing
 * - No plugin-specific rendering logic (uses generic ellipse rendering)
 * 
 * Visualization Logic:
 * - Marker color: USGS alert level (green/yellow/orange/red) with magnitude fallback
 * - Marker size: Magnitude (larger earthquakes = larger markers)
 * - Ellipse radius: Magnitude (approximate felt/impact radius)
 * - Ellipse color: Matches marker color (alert-based with fallback)
 */

interface USGSFeature {
    id: string;
    type: "Feature";
    properties: {
        mag: number;
        place: string;
        time: number;
        updated: number;
        tz: number | null;
        url: string;
        detail: string;
        felt: number | null;
        cdi: number | null;
        mmi: number | null;
        alert: string | null;
        status: string;
        tsunami: number;
        sig: number;
        net: string;
        code: string;
        ids: string;
        sources: string;
        types: string;
        nst: number | null;
        dmin: number | null;
        rms: number;
        gap: number | null;
        magType: string;
        type: string;
        title: string;
    };
    geometry: {
        type: "Point";
        coordinates: [number, number, number]; // [longitude, latitude, depth]
    };
}

/**
 * Convert USGS alert level to color
 * 
 * USGS alert levels indicate the estimated impact:
 * - green: Little or no impact expected
 * - yellow: Local/regional impact possible
 * - orange: Regional impact likely
 * - red: Widespread disaster expected
 * 
 * This mapping preserves USGS semantics for accurate threat visualization.
 */
function alertToColor(alert: string | null): string {
    if (!alert) return null!; // Return null to trigger magnitude fallback
    
    switch (alert.toLowerCase()) {
        case "green":
            return "#22c55e"; // green — minimal impact
        case "yellow":
            return "#eab308"; // yellow — local impact
        case "orange":
            return "#f97316"; // orange — regional impact
        case "red":
            return "#ef4444"; // red — widespread disaster
        default:
            return null!; // Unknown alert → use magnitude fallback
    }
}

/**
 * Convert magnitude to color for visualization (FALLBACK ONLY)
 * 
 * Used when USGS alert level is not available.
 * Scale based on seismic intensity:
 * - M < 3: Minor (green) - usually not felt
 * - M 3-4: Light (yellow) - often felt, rarely causes damage
 * - M 4-5: Moderate (orange) - noticeable shaking
 * - M 5-6: Strong (red) - can cause damage
 * - M >= 6: Major (dark red) - serious damage
 */
function magnitudeToColor(magnitude: number): string {
    if (magnitude < 3) return "#22c55e"; // green — minor
    if (magnitude < 4) return "#eab308"; // yellow — light
    if (magnitude < 5) return "#f97316"; // orange — moderate
    if (magnitude < 6) return "#ef4444"; // red — strong
    return "#dc2626"; // dark red — major
}

/**
 * Get display color with alert priority and magnitude fallback
 * 
 * Decision: Prioritize USGS alert level for marker AND ellipse color
 * because alert represents actual threat assessment (population density,
 * building codes, depth, etc.), not just raw magnitude.
 */
function getDisplayColor(alert: string | null, magnitude: number): string {
    const alertColor = alertToColor(alert);
    return alertColor || magnitudeToColor(magnitude);
}

/**
 * Calculate approximate affected area radius in meters based on magnitude
 * 
 * This uses empirical approximations for seismic impact zones.
 * - Felt radius: approximate distance where shaking is perceptible
 * - Damage radius varies significantly based on depth, soil conditions, etc.
 * 
 * These are visual approximations, not precise scientific boundaries.
 */
function magnitudeToRadius(magnitude: number): number {
    if (magnitude < 2) return 5_000; // ~5 km
    if (magnitude < 3) return 15_000; // ~15 km
    if (magnitude < 4) return 30_000; // ~30 km
    if (magnitude < 5) return 80_000; // ~80 km
    if (magnitude < 6) return 150_000; // ~150 km
    if (magnitude < 7) return 300_000; // ~300 km
    return 500_000; // ~500 km for M7+
}

/**
 * Convert magnitude to fill opacity
 * Higher magnitudes → more opaque for better visibility
 */
function magnitudeToFillOpacity(magnitude: number): number {
    if (magnitude < 3) return 0.10; // 10% — very subtle
    if (magnitude < 4) return 0.15; // 15%
    if (magnitude < 5) return 0.20; // 20%
    if (magnitude < 6) return 0.25; // 25%
    return 0.30; // 30% — most visible
}

/**
 * Convert magnitude to point size for center marker
 */
function magnitudeToSize(magnitude: number): number {
    return Math.max(4, magnitude * 2); // Min 4px, scale by magnitude
}

export class EarthquakePlugin implements WorldPlugin {
    id = "earthquakes";
    name = "Earthquakes";
    description = "Live global earthquake activity from USGS";
    icon = Activity;
    category = "natural-disaster" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
        console.log("[EarthquakePlugin] Initialized");
    }

    destroy(): void {
        this.context = null;
        console.log("[EarthquakePlugin] Destroyed");
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const cacheMs = useStore.getState().dataConfig.cacheEnabled ? useStore.getState().dataConfig.cacheMaxAge : 0;
            const res = await fetch(`/api/earthquakes?cacheMaxAgeMs=${cacheMs}`);

            if (!res.ok) {
                console.error(`[EarthquakePlugin] API returned ${res.status}: ${res.statusText}`);
                return [];
            }

            const data = await res.json();

            if (data.error) {
                console.error("[EarthquakePlugin] API error:", data.error);
                return [];
            }

            if (!data.features || !Array.isArray(data.features)) {
                console.warn("[EarthquakePlugin] Invalid data format");
                return [];
            }

            const entities: GeoEntity[] = data.features.map((feature: USGSFeature) => {
                const [longitude, latitude, depth] = feature.geometry.coordinates;
                const magnitude = feature.properties.mag;
                const place = feature.properties.place;
                const timestamp = new Date(feature.properties.time);
                const alert = feature.properties.alert;

                // Determine color meaning for InfoCard transparency
                const colorMeaning = alert ? "alert" : "magnitude";

                // Use both: ellipse for area + center point marker
                // Return as ellipse type - the rendering system will handle both
                return {
                    id: `earthquake-${feature.id}`,
                    pluginId: "earthquakes",
                    latitude,
                    longitude,
                    altitude: 0, // Ground-level visualization
                    timestamp,
                    label: `M${magnitude.toFixed(1)}`,
                    properties: {
                        magnitude,
                        depth,
                        place,
                        source: "USGS",
                        alert,
                        tsunami: feature.properties.tsunami === 1,
                        status: feature.properties.status,
                        type: feature.properties.type,
                        magType: feature.properties.magType,
                        url: feature.properties.url,
                        felt: feature.properties.felt,
                        significance: feature.properties.sig,
                        // Store radius for info card display
                        radiusKm: Math.round(magnitudeToRadius(magnitude) / 1000),
                        // Explicit visualization semantics for InfoCard
                        colorMeaning, // "alert" or "magnitude"
                        sizeMeaning: "magnitude", // Always magnitude-based
                        areaMeaning: "approximate impact radius by magnitude",
                    },
                };
            });

            console.log(`[EarthquakePlugin] Fetched ${entities.length} earthquakes from USGS`);
            return entities;
        } catch (err) {
            console.error("[EarthquakePlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        // USGS updates continuously, but we poll every 5 minutes
        // to avoid excessive API calls while still staying reasonably current
        return 5 * 60 * 1000; // 5 minutes
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444", // Default red for earthquakes
            clusterEnabled: false, // Disable clustering for area visualization
            clusterDistance: 0,
            maxEntities: 1000, // Reasonable limit for performance
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const magnitude = (entity.properties.magnitude as number) || 0;
        const alert = entity.properties.alert as string | null;
        
        // Visualization rules:
        // - Color: Alert-based (with magnitude fallback)
        // - Size: Magnitude-based
        // - Radius: Magnitude-based
        const color = getDisplayColor(alert, magnitude);
        const size = magnitudeToSize(magnitude);
        const radiusMeters = magnitudeToRadius(magnitude);
        const fillOpacity = magnitudeToFillOpacity(magnitude);

        // Return ellipse-type entity with center point marker
        // The generic rendering system will handle the ellipse area
        return {
            type: "ellipse",
            color, // Alert-based color (or magnitude fallback) for marker and ellipse
            outlineColor: color, // Same color for outline
            radiusMeters, // Magnitude-based affected area radius
            fillOpacity, // Magnitude-based opacity
            outlineWidth: 2,
            showOutline: true,
            size, // Magnitude-based center point marker size
            distanceDisplayCondition: { near: 10, far: 20_000_000 }, // Show up to 20,000km
            labelText: magnitude >= 5 ? entity.label : undefined, // Only show labels for M5+
            labelFont: "12px JetBrains Mono, monospace",
        };
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/earthquakes",
            pollingIntervalMs: 5 * 60 * 1000, // 5 minutes
            requiresAuth: false, // USGS API is public
            historyEnabled: false, // No history support (yet)
            availabilityEnabled: false,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "magnitude",
                label: "Magnitude",
                type: "range",
                propertyKey: "magnitude",
                range: { min: 0, max: 10, step: 0.5 },
            },
            {
                id: "depth",
                label: "Depth (km)",
                type: "range",
                propertyKey: "depth",
                range: { min: 0, max: 700, step: 10 },
            },
            {
                id: "tsunami",
                label: "Tsunami Warning",
                type: "boolean",
                propertyKey: "tsunami",
            },
        ];
    }
}
