import { Building2 } from "lucide-react";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
} from "@/core/plugins/PluginTypes";

const DATA_URL = "/military_bases.geojson";
const DEFAULT_LABEL = "Military base";

/** GeoJSON Feature with Point geometry and optional properties. */
interface GeoJsonFeature {
    type: "Feature";
    geometry?: {
        type: string;
        coordinates?: [number, number] | [number, number, number];
    };
    properties?: Record<string, unknown> & {
        name?: string;
        type?: string;
        country?: string;
        operator?: string;
        description?: string;
    };
}

function isUsablePoint(f: GeoJsonFeature): boolean {
    const coords = f.geometry?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length < 2) return false;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    return Number.isFinite(lon) && Number.isFinite(lat);
}

/** Use a displayable name: treat empty or "unknown" as missing and fall back to type or default. */
function displayName(props: GeoJsonFeature["properties"]): string {
    const raw = (props?.name as string)?.trim();
    if (raw && raw.toLowerCase() !== "unknown") return raw;
    const typeStr = (props?.type as string)?.trim();
    if (typeStr) return typeStr;
    return DEFAULT_LABEL;
}

function mapFeatureToEntity(feature: GeoJsonFeature, index: number): GeoEntity {
    const coords = feature.geometry!.coordinates!;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    const props = feature.properties ?? {};
    const name = displayName(props);
    const osmId = props.osm_id ?? index;
    return {
        id: `militaryBases-${osmId}-${index}`,
        pluginId: "militaryBases",
        latitude: lat,
        longitude: lon,
        altitude: 0,
        timestamp: new Date(),
        label: name,
        properties: {
            name: props.name,
            type: props.type,
            country: props.country,
            operator: props.operator,
            description: props.description,
            osm_id: props.osm_id,
            wikipedia: props.wikipedia,
            wikidata: props.wikidata,
        },
    };
}

export class MilitaryBasesPlugin implements WorldPlugin {
    id = "militaryBases";
    name = "Military Bases";
    description = "Static military installations from GeoJSON (airfields, barracks, etc.)";
    icon = Building2;
    category = "infrastructure" as const;
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
            const res = await fetch(DATA_URL);
            if (!res.ok) {
                if (res.status === 404) {
                    console.warn("[MilitaryBasesPlugin] Dataset not found:", DATA_URL);
                    return [];
                }
                console.warn("[MilitaryBasesPlugin] Load failed:", res.status, res.statusText);
                return [];
            }
            const text = await res.text();
            if (!text?.trim()) return [];
            const data = JSON.parse(text) as { type?: string; features?: unknown[] };
            if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
                console.warn("[MilitaryBasesPlugin] Invalid GeoJSON: expected FeatureCollection with features");
                return [];
            }
            const entities: GeoEntity[] = [];
            for (let i = 0; i < data.features.length; i++) {
                const f = data.features[i] as GeoJsonFeature;
                if (f?.type !== "Feature" || !isUsablePoint(f)) continue;
                try {
                    entities.push(mapFeatureToEntity(f, i));
                } catch {
                    // Skip malformed feature
                }
            }
            return entities;
        } catch (err) {
            console.warn("[MilitaryBasesPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 24 * 60 * 60 * 1000; // 24h — static data, no need to re-fetch
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#94a3b8",
            clusterEnabled: true,
            clusterDistance: 50,
            maxEntities: 5000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        return {
            type: "point",
            color: "#64748b",
            size: 10,
            distanceDisplayCondition: { near: 0, far: 15_000_000 },
            labelText: entity.label,
            labelFont: "11px sans-serif",
        };
    }
}
