import { Ship } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    FilterDefinition,
} from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";

const VESSEL_COLORS: Record<string, string> = {
    cargo: "#f59e0b",     // amber
    tanker: "#ef4444",    // red
    passenger: "#3b82f6", // blue
    fishing: "#22d3ee",   // cyan
    military: "#a78bfa",  // purple
    sailing: "#4ade80",   // green
    tug: "#f97316",       // orange
    other: "#94a3b8",     // slate
};

function getVesselColor(type: string): string {
    const lower = type.toLowerCase();
    for (const [key, color] of Object.entries(VESSEL_COLORS)) {
        if (lower.includes(key)) return color;
    }
    return VESSEL_COLORS.other;
}

// Demo AIS data (used when no real AIS feed is configured)
function generateDemoVessels(): GeoEntity[] {
    const vessels = [
        { name: "EVER GIVEN", mmsi: "353136000", type: "cargo", lat: 30.0, lon: 32.5, speed: 12.5, heading: 340 },
        { name: "MAERSK SEALAND", mmsi: "220417000", type: "cargo", lat: 51.9, lon: 1.2, speed: 15.0, heading: 210 },
        { name: "PACIFIC RUBY", mmsi: "538004561", type: "tanker", lat: 1.2, lon: 103.7, speed: 8.3, heading: 125 },
        { name: "QUEEN MARY 2", mmsi: "310627000", type: "passenger", lat: 40.6, lon: -74.0, speed: 22.0, heading: 90 },
        { name: "OCEAN EXPLORER", mmsi: "245390000", type: "fishing", lat: -33.8, lon: 18.4, speed: 4.2, heading: 180 },
        { name: "ARCTIC SUNRISE", mmsi: "246585000", type: "other", lat: 69.0, lon: 18.0, speed: 6.0, heading: 45 },
        { name: "BLUE MARLIN", mmsi: "244870698", type: "cargo", lat: 22.3, lon: 113.9, speed: 10.5, heading: 270 },
        { name: "STENA BULK", mmsi: "265548750", type: "tanker", lat: 57.7, lon: 11.9, speed: 12.0, heading: 300 },
        { name: "SPIRIT OF BRITAIN", mmsi: "235082198", type: "passenger", lat: 50.9, lon: 1.4, speed: 20.0, heading: 160 },
        { name: "DEEP BLUE", mmsi: "538006050", type: "fishing", lat: -4.0, lon: 39.6, speed: 3.5, heading: 95 },
        { name: "CRIMSON ACE", mmsi: "477558200", type: "tanker", lat: 26.2, lon: 56.3, speed: 14.0, heading: 200 },
        { name: "SAGA HORIZON", mmsi: "311000596", type: "passenger", lat: 35.3, lon: 139.6, speed: 18.0, heading: 0 },
        { name: "ATLANTIC GUARDIAN", mmsi: "219354000", type: "tug", lat: 56.1, lon: -3.2, speed: 7.5, heading: 245 },
        { name: "JADE STAR", mmsi: "636092783", type: "cargo", lat: -12.0, lon: -77.0, speed: 11.0, heading: 320 },
        { name: "NORTHERN SPIRIT", mmsi: "257038700", type: "fishing", lat: 62.4, lon: 6.1, speed: 5.0, heading: 170 },
    ];

    // Add slight random jitter to make it feel alive
    return vessels.map((v) => ({
        id: `maritime-${v.mmsi}`,
        pluginId: "maritime",
        latitude: v.lat + (Math.random() - 0.5) * 0.1,
        longitude: v.lon + (Math.random() - 0.5) * 0.1,
        heading: v.heading,
        speed: v.speed * 0.514444, // Convert knots to m/s for AnimationLoop
        timestamp: new Date(),
        label: v.name,
        properties: {
            mmsi: v.mmsi,
            vesselName: v.name,
            vesselType: v.type,
            speed_knots: v.speed,
            heading: v.heading,
        },
    }));
}

export class MaritimePlugin implements WorldPlugin {
    id = "maritime";
    name = "Maritime";
    description = "Vessel tracking via AIS feeds";
    icon = Ship;
    category = "maritime" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const cacheMs = useStore.getState().dataConfig.cacheEnabled ? useStore.getState().dataConfig.cacheMaxAge : 0;
            const res = await fetch(`/api/maritime?cacheMaxAgeMs=${cacheMs}`);
            if (!res.ok) throw new Error(`Maritime API returned ${res.status}`);
            const data = await res.json();
            const vessels = data.vessels || generateDemoVessels();

            // Ensure timestamps are Date objects (JSON turns them into strings)
            return vessels.map((v: any) => ({
                ...v,
                timestamp: new Date(v.timestamp)
            }));
        } catch {
            // Fall back to demo data
            return generateDemoVessels();
        }
    }

    getPollingInterval(): number {
        return 60000; // 60 seconds
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#f59e0b",
            clusterEnabled: true,
            clusterDistance: 50,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const vesselType = (entity.properties.vesselType as string) || "other";
        const speed = entity.speed || 0;
        const isMoving = speed > 1; // Moving if speed > 1 knot
        
        return {
            type: "billboard",
            iconUrl: "/ship-icon.svg",
            color: getVesselColor(vesselType),
            size: isMoving ? 32 : 24, // Like aviation: larger when moving
            rotation: entity.heading,
            labelText: entity.label || undefined,
            labelFont: "11px JetBrains Mono, monospace",
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "vessel_type",
                label: "Vessel Type",
                type: "select",
                propertyKey: "vesselType",
                options: [
                    { value: "cargo", label: "Cargo" },
                    { value: "tanker", label: "Tanker" },
                    { value: "passenger", label: "Passenger" },
                    { value: "fishing", label: "Fishing" },
                    { value: "military", label: "Military" },
                    { value: "sailing", label: "Sailing" },
                    { value: "tug", label: "Tug" },
                    { value: "other", label: "Other" },
                ],
            },
            {
                id: "speed",
                label: "Speed (knots)",
                type: "range",
                propertyKey: "speed_knots",
                range: { min: 0, max: 30, step: 1 },
            },
        ];
    }
}
