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
            const vessels = Array.isArray(data.vessels) ? data.vessels : [];
            if (data.debug) {
                console.log("[MaritimePlugin]", data.debug.source, "vessels:", data.debug.vesselCount, data.debug.reasonIfEmpty ?? "");
            }
            return vessels.map((v: { timestamp?: string | Date; [k: string]: unknown }) => ({
                ...v,
                timestamp: v.timestamp ? new Date(v.timestamp as string) : new Date(),
            }));
        } catch (err) {
            console.warn("[MaritimePlugin] Fetch failed, returning no vessels:", err);
            return [];
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
