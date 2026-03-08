import {
    Cartesian3,
    Color,
    Entity,
    PolylineGraphics,
    PolylineDashMaterialProperty,
    DistanceDisplayCondition,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";

/**
 * Generic Polyline Entity Manager
 * 
 * Handles rendering of polyline-type entities from any plugin.
 * This is a reusable, plugin-agnostic component of the rendering system.
 * 
 * Usage: Any plugin can return type: "polyline" with positions array,
 * and this manager will render it as a 3D or ground-clamped path.
 * 
 * Examples:
 * - Satellite orbits (3D space paths)
 * - Satellite ground tracks (surface-clamped)
 * - Flight paths
 * - Maritime routes
 * - Any path-based visualization
 */

interface ManagedPolyline {
    cesiumEntity: Entity;
    geoEntity: GeoEntity;
    options: CesiumEntityOptions;
}

export class PolylineEntityManager {
    private viewer: CesiumViewer | null = null;
    private polylines: Map<string, ManagedPolyline> = new Map();

    /**
     * Initialize or update the manager with current viewer
     */
    setViewer(viewer: CesiumViewer | null) {
        if (this.viewer !== viewer) {
            this.clear();
            this.viewer = viewer;
        }
    }

    /**
     * Update polyline entities based on visible entities
     * This is called by the main rendering loop
     */
    update(visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>) {
        if (!this.viewer || this.viewer.isDestroyed()) return;

        // Filter to polyline-type entities only
        const polylineEntities = visibleEntities.filter(e => e.options.type === "polyline");
        const currentIds = new Set<string>();

        // Add or update polylines
        polylineEntities.forEach(({ entity, options }) => {
            currentIds.add(entity.id);
            this.addOrUpdatePolyline(entity, options);
        });

        // Remove polylines that are no longer visible
        for (const [id, managed] of this.polylines.entries()) {
            if (!currentIds.has(id)) {
                this.removePolyline(id);
            }
        }
    }

    /**
     * Add or update a single polyline entity
     */
    private addOrUpdatePolyline(geoEntity: GeoEntity, options: CesiumEntityOptions) {
        if (!this.viewer) return;
        if (!options.positions || options.positions.length < 2) {
            console.warn(`[PolylineEntityManager] Entity ${geoEntity.id} has insufficient positions for polyline`);
            return;
        }

        const existing = this.polylines.get(geoEntity.id);

        // Convert positions to Cartesian3 array
        const positions = options.positions.map(pos =>
            Cartesian3.fromDegrees(
                pos.longitude,
                pos.latitude,
                pos.altitude || 0
            )
        );

        // Parse color and opacity
        const baseColor = options.color 
            ? Color.fromCssColorString(options.color)
            : Color.CYAN;
        
        const opacity = options.opacity !== undefined ? options.opacity : 1.0;
        const color = baseColor.withAlpha(opacity);

        // Line width
        const width = options.width || 2;

        // Clamp to ground
        const clampToGround = options.clampToGround || false;

        // Distance display condition
        const distanceCondition = options.distanceDisplayCondition
            ? new DistanceDisplayCondition(
                options.distanceDisplayCondition.near,
                options.distanceDisplayCondition.far
              )
            : undefined;

        // Material (solid or dashed)
        let material: any;
        if (options.dashed) {
            material = new PolylineDashMaterialProperty({
                color,
                dashLength: options.dashLength || 16,
            });
        } else {
            material = color;
        }

        if (existing) {
            // Update existing polyline
            existing.geoEntity = geoEntity;
            existing.options = options;
            
            if (existing.cesiumEntity.polyline) {
                existing.cesiumEntity.polyline.positions = positions as any;
                existing.cesiumEntity.polyline.width = width as any;
                existing.cesiumEntity.polyline.material = material as any;
                existing.cesiumEntity.polyline.clampToGround = clampToGround as any;
                if (distanceCondition) {
                    existing.cesiumEntity.polyline.distanceDisplayCondition = distanceCondition as any;
                }
            }
        } else {
            // Create new polyline
            const cesiumEntity = this.viewer.entities.add({
                id: `polyline-${geoEntity.id}`,
                polyline: new PolylineGraphics({
                    positions,
                    width,
                    material,
                    clampToGround,
                    distanceDisplayCondition: distanceCondition,
                }),
                // Store reference to original GeoEntity for selection
                _wwvEntity: geoEntity,
            } as any);

            this.polylines.set(geoEntity.id, {
                cesiumEntity,
                geoEntity,
                options,
            });
        }
    }

    /**
     * Remove a single polyline by entity ID
     */
    private removePolyline(entityId: string) {
        const managed = this.polylines.get(entityId);
        if (managed && this.viewer) {
            this.viewer.entities.remove(managed.cesiumEntity);
            this.polylines.delete(entityId);
        }
    }

    /**
     * Clear all polylines
     */
    clear() {
        if (this.viewer && !this.viewer.isDestroyed()) {
            this.polylines.forEach(managed => {
                this.viewer!.entities.remove(managed.cesiumEntity);
            });
        }
        this.polylines.clear();
    }

    /**
     * Get count of managed polylines
     */
    getCount(): number {
        return this.polylines.size;
    }
}

/**
 * Global singleton instance for polyline management
 */
export const polylineEntityManager = new PolylineEntityManager();
