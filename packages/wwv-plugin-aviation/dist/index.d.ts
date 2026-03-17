import type { WorldPlugin, GeoEntity, TimeRange, PluginContext, LayerConfig, CesiumEntityOptions, SelectionBehavior, ServerPluginConfig, FilterDefinition } from "@worldwideview/wwv-plugin-sdk";
export declare class AviationPlugin implements WorldPlugin {
    id: string;
    name: string;
    description: string;
    icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    category: "aviation";
    version: string;
    private context;
    initialize(ctx: PluginContext): Promise<void>;
    destroy(): void;
    fetch(_timeRange: TimeRange): Promise<GeoEntity[]>;
    getPollingInterval(): number;
    getLayerConfig(): LayerConfig;
    renderEntity(entity: GeoEntity): CesiumEntityOptions;
    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null;
    getServerConfig(): ServerPluginConfig;
    getFilterDefinitions(): FilterDefinition[];
}
//# sourceMappingURL=index.d.ts.map