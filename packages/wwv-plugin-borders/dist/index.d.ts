import type { WorldPlugin, GeoEntity, TimeRange, PluginContext, LayerConfig, CesiumEntityOptions } from "@worldwideview/wwv-plugin-sdk";
export declare class BordersPlugin implements WorldPlugin {
    id: string;
    name: string;
    description: string;
    icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    category: "custom";
    version: string;
    initialize(_ctx: PluginContext): Promise<void>;
    destroy(): void;
    fetch(_timeRange: TimeRange): Promise<GeoEntity[]>;
    getPollingInterval(): number;
    getLayerConfig(): LayerConfig;
    renderEntity(_entity: GeoEntity): CesiumEntityOptions;
}
//# sourceMappingURL=index.d.ts.map