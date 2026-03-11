import type { GeoEntity } from "@/core/plugins/PluginTypes";

/** Default height above ground for mounted traffic cameras (metres). */
const DEFAULT_CAMERA_ALT = 8;

/** Map a raw URL/File camera object to a GeoEntity. */
export function mapRawCamera(cam: any, index: number, prefix: string): GeoEntity {
    return {
        id: `camera-${prefix}-${index}`,
        pluginId: "camera",
        latitude: cam.latitude,
        longitude: cam.longitude,
        altitude: cam.altitude ?? cam.elevation ?? DEFAULT_CAMERA_ALT,
        timestamp: new Date(),
        label: cam.city || cam.country || "Unknown Camera",
        properties: { ...cam },
    };
}

/** Map a GeoJSON Feature (from public-cameras.json) to a GeoEntity. */
export function mapGeoJsonFeature(feature: any, index: number, prefix: string): GeoEntity {
    const [lon, lat] = feature.geometry?.coordinates ?? [0, 0];
    const props = feature.properties ?? {};
    return {
        id: `camera-${prefix}-${index}`,
        pluginId: "camera",
        latitude: lat,
        longitude: lon,
        altitude: DEFAULT_CAMERA_ALT,
        timestamp: new Date(),
        label: props.city || props.country || "Unknown Camera",
        properties: { ...props },
    };
}
