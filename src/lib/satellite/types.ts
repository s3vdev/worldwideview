/** Shape of a single GP record returned by CelesTrak's JSON API. */
export interface CelesTrakGP {
    OBJECT_NAME: string;
    OBJECT_ID: string;
    NORAD_CAT_ID: number;
    OBJECT_TYPE: string;
    CLASSIFICATION_TYPE: string;
    TLE_LINE1: string;
    TLE_LINE2: string;
    EPOCH: string;
    MEAN_MOTION: number;
    ECCENTRICITY: number;
    INCLINATION: number;
    RA_OF_ASC_NODE: number;
    ARG_OF_PERICENTER: number;
    MEAN_ANOMALY: number;
    PERIOD: number;
    APOAPSIS: number;
    PERIAPSIS: number;
    COUNTRY_CODE?: string;
    LAUNCH_DATE?: string;
}

/** Propagated position returned from our API. */
export interface SatellitePosition {
    noradId: number;
    name: string;
    latitude: number;
    longitude: number;
    altitude: number; // kilometers
    heading: number;  // degrees
    speed: number;    // m/s orbital velocity
    group: string;
    country?: string;
    objectType?: string;
    period?: number;  // minutes
}
