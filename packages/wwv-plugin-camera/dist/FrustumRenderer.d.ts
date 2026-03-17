/**
 * Manages Cesium Entity polylines for camera frustum outlines.
 *
 * Draws 4 side-edge lines from the camera apex to the 4 far
 * corners of the view pyramid. No far-plane rectangle is drawn
 * (it would clip the earth surface).
 *
 * Architecture: corners come from frustumGeometry.ts so a future
 * ground-projection step can replace the far-plane corners with
 * terrain-intersection points without changing this renderer.
 */
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity } from "@worldwideview/wwv-plugin-sdk";
export declare class FrustumRenderer {
    /** Map from entity id → array of 4 Cesium.Entity polylines */
    private entityMap;
    /**
     * Sync frustum outlines with the current set of camera entities.
     * Only draws for entities whose `properties` include heading.
     */
    update(viewer: CesiumViewer, entities: GeoEntity[]): void;
    /** Remove all frustum entities from the viewer. */
    clear(viewer: CesiumViewer): void;
    private resolveHeading;
    private buildEdges;
    private createNew;
    private updateExisting;
    private removeStale;
    private addEdgeLine;
}
//# sourceMappingURL=FrustumRenderer.d.ts.map