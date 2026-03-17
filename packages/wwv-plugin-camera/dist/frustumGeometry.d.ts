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
export interface Point3D {
    lat: number;
    lon: number;
    alt: number;
}
/** The 4 far-plane corners + the apex, ready for rendering. */
export interface FrustumEdges {
    apex: Point3D;
    topLeft: Point3D;
    topRight: Point3D;
    bottomLeft: Point3D;
    bottomRight: Point3D;
}
export interface FrustumParams {
    lat: number;
    lon: number;
    alt: number;
    headingDeg: number;
    pitchDeg: number;
    hFovDeg: number;
    vFovDeg: number;
    rangeMtrs: number;
}
export declare const FRUSTUM_DEFAULTS: {
    readonly alt: 8;
    readonly headingDeg: 0;
    readonly pitchDeg: -10;
    readonly hFovDeg: 50;
    readonly vFovDeg: 35;
    readonly rangeMtrs: 200;
};
/**
 * Compute the 4 frustum corner points at `range` distance
 * from the camera, given orientation and FOV.
 *
 * Returns edges that can be drawn as 4 polylines from apex
 * to each corner, or passed to a ground-projection step.
 */
export declare function computeFrustumEdges(params: FrustumParams): FrustumEdges;
/**
 * Convert a cardinal direction string to degrees.
 * Returns `undefined` if not recognised.
 */
export declare function cardinalToHeading(dir: string): number | undefined;
//# sourceMappingURL=frustumGeometry.d.ts.map