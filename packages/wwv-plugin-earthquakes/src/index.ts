import { Activity } from "lucide-react";
import {
    createSvgIconUrl,
    type WorldPlugin,
    type GeoEntity,
    type TimeRange,
    type PluginContext,
    type LayerConfig,
    type CesiumEntityOptions,
    type FilterDefinition,
    type ServerPluginConfig,
} from "@worldwideview/wwv-plugin-sdk";

function magToColor(mag: number): string {
    if (mag < 5.0) return "#fcd34d"; // Yellow
    if (mag < 6.0) return "#f97316"; // Orange
    if (mag < 7.0) return "#ef4444"; // Red
    return "#7f1d1d"; // Dark Red
}

function magToSize(mag: number): number {
    if (mag < 5.0) return 5;
    if (mag < 6.0) return 8;
    if (mag < 7.0) return 12;
    return 16;
}

export class EarthquakesPlugin implements WorldPlugin {
    id = "earthquakes";
    name = "Earthquakes";
    description = "USGS Real-Time Earthquakes (4.5+)";
    icon = Activity;
    category = "natural-disaster" as const;
    version = "1.0.0";
    private context: PluginContext | null = null;
    private iconUrls: Record<string, string> = {};

    async initialize(ctx: PluginContext): Promise<void> { this.context = ctx; }
    destroy(): void { this.context = null; }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await globalThis.fetch("/api/external/earthquakes");
            if (!res.ok) throw new Error(`Earthquakes API returned ${res.status}`);
            const data = await res.json();
            if (!data.items || !Array.isArray(data.items)) return [];

            return data.items.map((eq: any): GeoEntity => ({
                id: eq.id,
                pluginId: this.id,
                latitude: eq.lat,
                longitude: eq.lon,
                timestamp: new Date(eq.occurredAt),
                label: `M${eq.magnitude} - ${eq.place}`,
                properties: {
                    magnitude: eq.magnitude,
                    depth_km: eq.depth_km,
                    place: eq.place,
                    url: eq.url,
                    nearTestSite: eq.nearTestSite,
                    nearestSiteName: eq.nearestSiteName,
                },
            }));
        } catch (err) {
            console.error("[EarthquakesPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number { return 0; } // 0 for WebSocket push

    getServerConfig(): ServerPluginConfig {
        return { apiBasePath: "/api/external/earthquakes", pollingIntervalMs: 0, historyEnabled: true };
    }
    
    getLayerConfig(): LayerConfig {
        return { color: "#f97316", clusterEnabled: true, clusterDistance: 40 };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const mag = (entity.properties.magnitude as number) || 4.5;
        const color = magToColor(mag);
        
        if (!this.iconUrls[color]) {
            this.iconUrls[color] = createSvgIconUrl(Activity, { color });
        }

        return {
            type: "billboard", 
            iconUrl: this.iconUrls[color], 
            color,
            size: magToSize(mag),
            outlineColor: "#000000", 
            outlineWidth: 1,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            { id: "magnitude", label: "Magnitude", type: "range", propertyKey: "magnitude", range: { min: 4.5, max: 10.0, step: 0.1 } },
            { id: "depth", label: "Depth (km)", type: "range", propertyKey: "depth_km", range: { min: 0, max: 800, step: 10 } },
            {
                id: "nuclear", label: "Nuclear Site Proximity", type: "select", propertyKey: "nearTestSite",
                options: [{ value: "true", label: "Suspicious (<10km from test site)" }],
            }
        ];
    }
}
