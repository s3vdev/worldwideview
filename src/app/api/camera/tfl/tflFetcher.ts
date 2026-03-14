/**
 * Fetches all TfL JamCams from the Transport for London API.
 * Free, no authentication required. Returns ~900 cameras with JPEG and MP4 URLs.
 */

import type { GdotCameraFeature } from "../gdot/gdotFetcher";

const TFL_URL = "https://api.tfl.gov.uk/Place/Type/JamCam";

function getProp(props: any[], key: string): string {
    const found = props?.find((p: any) => p.key === key);
    return found?.value || "";
}

function toGeoJsonFeature(raw: any): GdotCameraFeature | null {
    if (!raw.lat || !raw.lon) return null;

    const imageUrl = getProp(raw.additionalProperties, "imageUrl");
    const videoUrl = getProp(raw.additionalProperties, "videoUrl");
    const available = getProp(raw.additionalProperties, "available");

    if (available === "false") return null;

    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [raw.lon, raw.lat] },
        properties: {
            stream: videoUrl || imageUrl || "",
            hls: null,
            country: "United Kingdom",
            region: "London",
            city: "London",
            source: "tfl",
            name: raw.commonName || raw.id || "",
            route: getProp(raw.additionalProperties, "view"),
            direction: "",
            location_description: raw.commonName || "",
            categories: ["traffic"],
        },
    };
}

export async function fetchTflCameras(): Promise<GdotCameraFeature[]> {
    const res = await fetch(TFL_URL, {
        headers: { "User-Agent": "WorldWideView/1.0" },
    });

    if (!res.ok) throw new Error(`TfL API returned ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const cameras: GdotCameraFeature[] = [];
    for (const place of data) {
        const feature = toGeoJsonFeature(place);
        if (feature) cameras.push(feature);
    }

    return cameras;
}
