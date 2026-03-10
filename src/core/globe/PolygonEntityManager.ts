import {
    Cartesian3,
    Color,
    PolygonGraphics,
    PolygonHierarchy,
    Entity,
    DistanceDisplayCondition,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";

/**
 * Generic Polygon Entity Manager
 *
 * Renders polygon-type entities (e.g. interference areas) as static Cesium polygons.
 * Polygons are not updated every frame; only on data refresh.
 */

interface ManagedPolygon {
    cesiumEntity: Entity;
    geoEntity: GeoEntity;
    options: CesiumEntityOptions;
}

export class PolygonEntityManager {
    private viewer: CesiumViewer | null = null;
    private polygons: Map<string, ManagedPolygon> = new Map();

    setViewer(viewer: CesiumViewer | null) {
        if (this.viewer !== viewer) {
            this.clear();
            this.viewer = viewer;
        }
    }

    update(visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>) {
        if (!this.viewer || this.viewer.isDestroyed()) return;

        const polygonEntities = visibleEntities.filter(e => e.options.type === "polygon");
        const currentIds = new Set<string>();

        polygonEntities.forEach(({ entity, options }) => {
            currentIds.add(entity.id);
            this.addOrUpdatePolygon(entity, options);
        });

        for (const [id] of this.polygons.entries()) {
            if (!currentIds.has(id)) this.removePolygon(id);
        }
    }

    private addOrUpdatePolygon(geoEntity: GeoEntity, options: CesiumEntityOptions) {
        if (!this.viewer) return;

        const positions = options.positions;
        if (!positions || positions.length < 3) return;

        const hierarchy = new PolygonHierarchy(
            positions.map(p =>
                Cartesian3.fromDegrees(
                    p.longitude,
                    p.latitude,
                    p.altitude ?? 0
                )
            )
        );

        const baseColor = options.color ? Color.fromCssColorString(options.color) : Color.YELLOW;
        const fillOpacity = options.fillOpacity ?? 0.35;
        const fillColor = baseColor.withAlpha(fillOpacity);
        const outlineOpacity = Math.min(fillOpacity * 2, 1);
        const outlineColor = (options.outlineColor ? Color.fromCssColorString(options.outlineColor) : baseColor).withAlpha(outlineOpacity);
        const showOutline = options.showOutline !== false;
        const outlineWidth = options.outlineWidth ?? 1.5;
        const distanceCondition = options.distanceDisplayCondition
            ? new DistanceDisplayCondition(options.distanceDisplayCondition.near, options.distanceDisplayCondition.far)
            : new DistanceDisplayCondition(10, 10_000_000);

        const existing = this.polygons.get(geoEntity.id);
        if (existing) {
            existing.geoEntity = geoEntity;
            existing.options = options;
            if (existing.cesiumEntity.polygon) {
                existing.cesiumEntity.polygon.hierarchy = hierarchy as any;
                existing.cesiumEntity.polygon.material = fillColor as any;
                existing.cesiumEntity.polygon.outline = showOutline as any;
                existing.cesiumEntity.polygon.outlineColor = outlineColor as any;
                existing.cesiumEntity.polygon.outlineWidth = outlineWidth as any;
                existing.cesiumEntity.polygon.distanceDisplayCondition = distanceCondition as any;
            }
            return;
        }

        const cesiumEntity = this.viewer.entities.add({
            id: `polygon-${geoEntity.id}`,
            polygon: new PolygonGraphics({
                hierarchy,
                material: fillColor,
                outline: showOutline,
                outlineColor,
                outlineWidth,
                distanceDisplayCondition: distanceCondition,
            }),
            _wwvEntity: geoEntity,
        } as any);

        this.polygons.set(geoEntity.id, { cesiumEntity, geoEntity, options });
    }

    private removePolygon(entityId: string) {
        const managed = this.polygons.get(entityId);
        if (managed && this.viewer) {
            this.viewer.entities.remove(managed.cesiumEntity);
            this.polygons.delete(entityId);
        }
    }

    clear() {
        if (this.viewer && !this.viewer.isDestroyed()) {
            this.polygons.forEach(managed => this.viewer!.entities.remove(managed.cesiumEntity));
        }
        this.polygons.clear();
    }

    getCount(): number {
        return this.polygons.size;
    }
}

export const polygonEntityManager = new PolygonEntityManager();
