"use strict";
/**
 * Pure math for computing 3D camera frustum edges.
 * No Cesium dependency — fully unit-testable.
 *
 * The frustum is a pyramid with:
 *   - apex at the camera position
 *   - 4 corner rays extending outward at `range` meters
 *   - orientation defined by heading, pitch, and FOV
 *
 * Architecture note: returns raw corner positions so that
 * a future ground-projection step can raycast these rays
 * onto the terrain surface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRUSTUM_DEFAULTS = void 0;
exports.computeFrustumEdges = computeFrustumEdges;
exports.cardinalToHeading = cardinalToHeading;
var DEG2RAD = Math.PI / 180;
var EARTH_RADIUS = 6371000; // metres
// ─── Defaults ────────────────────────────────────────────────
exports.FRUSTUM_DEFAULTS = {
    alt: 8,
    headingDeg: 0,
    pitchDeg: -10,
    hFovDeg: 50,
    vFovDeg: 35,
    rangeMtrs: 200,
};
// ─── Core computation ────────────────────────────────────────
/**
 * Compute the 4 frustum corner points at `range` distance
 * from the camera, given orientation and FOV.
 *
 * Returns edges that can be drawn as 4 polylines from apex
 * to each corner, or passed to a ground-projection step.
 */
function computeFrustumEdges(params) {
    var lat = params.lat, lon = params.lon, alt = params.alt, headingDeg = params.headingDeg, pitchDeg = params.pitchDeg, hFovDeg = params.hFovDeg, vFovDeg = params.vFovDeg, rangeMtrs = params.rangeMtrs;
    var apex = { lat: lat, lon: lon, alt: alt };
    var halfH = (hFovDeg / 2) * DEG2RAD;
    var halfV = (vFovDeg / 2) * DEG2RAD;
    var heading = headingDeg * DEG2RAD;
    var pitch = pitchDeg * DEG2RAD;
    // For each corner we compute horizontal bearing offset ± halfH
    // and vertical pitch offset ± halfV, then project to a destination.
    var corners = [
        [-halfH, halfV], // topLeft
        [halfH, halfV], // topRight
        [-halfH, -halfV], // bottomLeft
        [halfH, -halfV], // bottomRight
    ];
    var _a = corners.map(function (_a) {
        var hOff = _a[0], vOff = _a[1];
        return projectCorner(lat, lon, alt, heading, pitch, hOff, vOff, rangeMtrs);
    }), topLeft = _a[0], topRight = _a[1], bottomLeft = _a[2], bottomRight = _a[3];
    return { apex: apex, topLeft: topLeft, topRight: topRight, bottomLeft: bottomLeft, bottomRight: bottomRight };
}
// ─── Cardinal direction helper ───────────────────────────────
var CARDINAL_MAP = {
    n: 0, north: 0, nb: 0, northbound: 0,
    ne: 45, northeast: 45, neb: 45,
    e: 90, east: 90, eb: 90, eastbound: 90,
    se: 135, southeast: 135, seb: 135,
    s: 180, south: 180, sb: 180, southbound: 180,
    sw: 225, southwest: 225, swb: 225,
    w: 270, west: 270, wb: 270, westbound: 270,
    nw: 315, northwest: 315, nwb: 315,
};
/**
 * Convert a cardinal direction string to degrees.
 * Returns `undefined` if not recognised.
 */
function cardinalToHeading(dir) {
    return CARDINAL_MAP[dir.trim().toLowerCase()];
}
// ─── Internal math ───────────────────────────────────────────
/**
 * Project a single frustum corner from the camera position.
 *
 * 1. Compute the bearing = heading + horizontal offset
 * 2. Compute the ground distance = range * cos(pitch + vOff)
 * 3. Compute the altitude delta = range * sin(pitch + vOff)
 * 4. Use haversine destination formula for the ground position
 */
function projectCorner(latDeg, lonDeg, altM, headingRad, pitchRad, hOffRad, vOffRad, range) {
    var bearing = headingRad + hOffRad;
    var elevation = pitchRad + vOffRad;
    var groundDist = range * Math.cos(elevation);
    var altDelta = range * Math.sin(elevation);
    var dest = destinationPoint(latDeg, lonDeg, Math.abs(groundDist), bearing);
    return {
        lat: dest.lat,
        lon: dest.lon,
        alt: Math.max(0, altM + altDelta),
    };
}
/**
 * Haversine destination point given start coords (deg),
 * distance (m), and bearing (rad).
 */
function destinationPoint(latDeg, lonDeg, distMetres, bearingRad) {
    var lat1 = latDeg * DEG2RAD;
    var lon1 = lonDeg * DEG2RAD;
    var angularDist = distMetres / EARTH_RADIUS;
    var sinLat1 = Math.sin(lat1);
    var cosLat1 = Math.cos(lat1);
    var sinD = Math.sin(angularDist);
    var cosD = Math.cos(angularDist);
    var lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(bearingRad));
    var lon2 = lon1 + Math.atan2(Math.sin(bearingRad) * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));
    return { lat: lat2 / DEG2RAD, lon: lon2 / DEG2RAD };
}
