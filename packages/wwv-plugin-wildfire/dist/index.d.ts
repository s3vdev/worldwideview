import type { WorldPlugin, GeoEntity, TimeRange, PluginContext, LayerConfig, CesiumEntityOptions, FilterDefinition } from "@worldwideview/wwv-plugin-sdk";
export declare class WildfirePlugin implements WorldPlugin {
    id: string;
    name: string;
    description: string;
    icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    category: "natural-disaster";
    version: string;
    private context;
    initialize(ctx: PluginContext): Promise<void>;
    destroy(): void;
    fetch(_timeRange: TimeRange): Promise<GeoEntity[]>;
    getPollingInterval(): number;
    getLayerConfig(): LayerConfig;
    renderEntity(entity: GeoEntity): CesiumEntityOptions;
    getFilterDefinitions(): FilterDefinition[];
}
//# sourceMappingURL=index.d.ts.map