import { useEffect, useRef } from "react";
import {
    GeoJsonDataSource,
    Color,
    JulianDate,
    BoundingSphere,
    Cartographic,
    Cartesian3,
    LabelGraphics,
    PolylineGraphics,
    LabelStyle,
    VerticalOrigin,
    HorizontalOrigin,
    DistanceDisplayCondition,
    NearFarScalar,
    ClassificationType,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";

/**
 * Hook to manage GeoJSON country borders and labels on the Cesium viewer.
 */
export function useBorders(viewer: CesiumViewer | null, enabled: boolean) {
    const dataSourceRef = useRef<GeoJsonDataSource | null>(null);

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        async function initBorders() {
            if (!viewer) return;

            if (!dataSourceRef.current) {
                try {
                    const ds = await GeoJsonDataSource.load("/borders.geojson", {
                        clampToGround: true,
                        stroke: Color.CYAN.withAlpha(0.6),
                        strokeWidth: 1.5,
                        fill: Color.TRANSPARENT,
                    });

                    addLabelsAndPolylines(ds);
                    dataSourceRef.current = ds;
                } catch (err) {
                    console.warn("[useBorders] Failed to load borders GeoJSON", err);
                    return;
                }
            }

            const ds = dataSourceRef.current;
            if (enabled) {
                if (!viewer.dataSources.contains(ds)) {
                    viewer.dataSources.add(ds);
                }
            } else {
                if (viewer.dataSources.contains(ds)) {
                    viewer.dataSources.remove(ds, false);
                }
            }
        }

        initBorders();
    }, [viewer, enabled]);

    // Cleanup on unmount or viewer change
    useEffect(() => {
        return () => {
            if (viewer && !viewer.isDestroyed() && dataSourceRef.current) {
                if (viewer.dataSources.contains(dataSourceRef.current)) {
                    viewer.dataSources.remove(dataSourceRef.current, true);
                }
                dataSourceRef.current = null;
            }
        };
    }, [viewer]);
}

/**
 * Iterates loaded entities and adds labels + border polylines.
 */
function addLabelsAndPolylines(ds: GeoJsonDataSource): void {
    const entities = ds.entities.values;
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (!entity.name || !entity.polygon) continue;

        const hierarchy = entity.polygon.hierarchy?.getValue(JulianDate.now());
        if (!hierarchy) continue;

        const positions = hierarchy.positions;
        if (!positions || positions.length === 0) continue;

        // Label at polygon center
        const center = BoundingSphere.fromPoints(positions).center;
        const cartographic = Cartographic.fromCartesian(center);
        cartographic.height = 1000;

        entity.position = Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            cartographic.height
        ) as any;

        entity.label = new LabelGraphics({
            text: entity.name,
            font: "bold 18px Inter, sans-serif",
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK.withAlpha(0.8),
            outlineWidth: 3,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.CENTER,
            horizontalOrigin: HorizontalOrigin.CENTER,
            distanceDisplayCondition: new DistanceDisplayCondition(10.0, 10000000.0),
            scaleByDistance: new NearFarScalar(1.0e6, 1.5, 1.0e7, 0.5),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });

        // Border polyline (clamped to ground/3D tiles)
        entity.polyline = new PolylineGraphics({
            positions: [...positions, positions[0]],
            width: 2,
            material: Color.WHITE.withAlpha(0.5),
            clampToGround: true,
            classificationType: ClassificationType.BOTH,
        });

        // Hide original polygon fill
        entity.polygon.show = false as any;
    }
}
