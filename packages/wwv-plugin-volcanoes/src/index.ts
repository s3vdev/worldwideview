import { Mountain } from "lucide-react";
import type {
    WorldPlugin, GeoEntity, TimeRange, PluginContext,
    LayerConfig, CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";

export class VolcanoesPlugin implements WorldPlugin {
    id = "volcanoes";
    name = "Volcanoes";
    description = "Active and dormant volcanoes worldwide from OSM";
    icon = Mountain;
    category = "natural-disaster" as const;
    version = "1.0.0";

    async initialize(_ctx: PluginContext): Promise<void> { }
    destroy(): void { }
    async fetch(_tr: TimeRange): Promise<GeoEntity[]> { return []; }
    getPollingInterval(): number { return 0; }

    getLayerConfig(): LayerConfig {
        return {
            color: "#ef4444",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 1000,
        };
    }

    renderEntity(_e: GeoEntity): CesiumEntityOptions {
        return { type: "point", color: "#ef4444", size: 8 };
    }
}
