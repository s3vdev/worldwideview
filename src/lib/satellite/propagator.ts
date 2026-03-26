import * as satellite from "satellite.js";
import type { CelesTrakGP, SatellitePosition } from "./types";

/** Earth radius in km (WGS84 mean). */
const EARTH_RADIUS_KM = 6371;

/**
 * Propagate a list of TLE records to a given time using SGP4.
 * Returns positions with lat/lon/alt for each satellite.
 */
export function propagateAll(
    records: CelesTrakGP[],
    time: Date,
    group: string,
): SatellitePosition[] {
    const gmst = satellite.gstime(time);
    const results: SatellitePosition[] = [];

    for (const rec of records) {
        try {
            const satrec = satellite.twoline2satrec(
                rec.TLE_LINE1,
                rec.TLE_LINE2,
            );
            const pv = satellite.propagate(satrec, time);
            if (
                !pv.position ||
                typeof pv.position === "boolean" ||
                !pv.velocity ||
                typeof pv.velocity === "boolean"
            ) {
                continue;
            }

            const geo = satellite.eciToGeodetic(pv.position, gmst);
            const lat = satellite.degreesLat(geo.latitude);
            const lon = satellite.degreesLong(geo.longitude);
            const alt = geo.height; // km

            // Skip invalid propagations
            if (!isFinite(lat) || !isFinite(lon) || !isFinite(alt)) continue;
            if (alt < 0 || alt > 100000) continue;

            // Orbital velocity magnitude (km/s → m/s)
            const vel = pv.velocity as satellite.EciVec3<number>;
            const speed =
                Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) * 1000;

            // Approximate heading from velocity in ECI
            // (simplified — accurate enough for interpolation)
            const heading =
                (Math.atan2(vel.x, vel.z) * (180 / Math.PI) + 360) % 360;

            results.push({
                noradId: rec.NORAD_CAT_ID,
                name: rec.OBJECT_NAME,
                latitude: lat,
                longitude: lon,
                altitude: alt,
                heading,
                speed,
                group,
                country: rec.COUNTRY_CODE,
                objectType: rec.OBJECT_TYPE,
                period: rec.PERIOD,
            });
        } catch {
            // Skip satellites with invalid TLE data
        }
    }

    return results;
}
