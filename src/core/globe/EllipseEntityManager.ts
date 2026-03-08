import {
    Cartesian3,
    Color,
    EllipseGraphics,
    PointGraphics,
    Entity,
    DistanceDisplayCondition,
    ConstantPositionProperty,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";

/**
 * Generic Ellipse Entity Manager
 * 
 * Handles rendering of ellipse-type entities from any plugin.
 * This is a reusable, plugin-agnostic component of the rendering system.
 * 
 * Usage: Any plugin can return type: "ellipse" with radiusMeters,
 * and this manager will render it as a circular/elliptical area
 * with an optional center point marker.
 */

interface ManagedEllipse {
    cesiumEntity: Entity;
    centerPointEntity: Entity | null; // Optional center point marker
    geoEntity: GeoEntity;
    options: CesiumEntityOptions;
}

export class EllipseEntityManager {
    private viewer: CesiumViewer | null = null;
    private ellipses: Map<string, ManagedEllipse> = new Map();

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
     * Update ellipse entities based on visible entities
     * This is called by the main rendering loop
     */
    update(visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>) {
        if (!this.viewer || this.viewer.isDestroyed()) return;

        // Filter to ellipse-type entities only
        const ellipseEntities = visibleEntities.filter(e => e.options.type === "ellipse");
        const currentIds = new Set<string>();

        // Add or update ellipses
        ellipseEntities.forEach(({ entity, options }) => {
            currentIds.add(entity.id);
            this.addOrUpdateEllipse(entity, options);
        });

        // Remove ellipses that are no longer visible
        for (const [id, managed] of this.ellipses.entries()) {
            if (!currentIds.has(id)) {
                this.removeEllipse(id);
            }
        }
    }

    /**
     * Add or update a single ellipse entity
     */
    private addOrUpdateEllipse(geoEntity: GeoEntity, options: CesiumEntityOptions) {
        if (!this.viewer) return;

        const existing = this.ellipses.get(geoEntity.id);
        
        // Create Cartesian3 position from geographic coordinates
        const cartesianPosition = Cartesian3.fromDegrees(
            geoEntity.longitude,
            geoEntity.latitude,
            geoEntity.altitude || 0
        );
        
        // Wrap in ConstantPositionProperty for proper Cesium Entity positioning
        // This ensures the position is properly georeferenced and doesn't drift
        const position = new ConstantPositionProperty(cartesianPosition);

        // Calculate ellipse parameters
        const radiusMeters = options.radiusMeters || 50000; // Default 50km
        const semiMajorAxis = options.semiMajorAxis || radiusMeters;
        const semiMinorAxis = options.semiMinorAxis || radiusMeters;
        
        // Parse colors
        const baseColor = options.color 
            ? Color.fromCssColorString(options.color)
            : Color.CYAN;
        
        const fillColor = baseColor.withAlpha(options.fillOpacity || 0.2);
        
        // Outline uses same base color but typically higher opacity (60% of base)
        const outlineOpacity = options.fillOpacity ? Math.min(options.fillOpacity * 3, 1.0) : 0.6;
        const outlineColor = options.outlineColor
            ? Color.fromCssColorString(options.outlineColor).withAlpha(outlineOpacity)
            : baseColor.withAlpha(outlineOpacity);

        const showOutline = options.showOutline !== false; // Default true
        const outlineWidth = options.outlineWidth || 2;

        // Distance display condition (default: show up to 10,000km)
        const distanceCondition = options.distanceDisplayCondition
            ? new DistanceDisplayCondition(
                options.distanceDisplayCondition.near,
                options.distanceDisplayCondition.far
              )
            : new DistanceDisplayCondition(10.0, 10_000_000.0);

        if (existing) {
            // Update existing ellipse
            existing.geoEntity = geoEntity;
            existing.options = options;
            existing.cesiumEntity.position = position as any;
            
            if (existing.cesiumEntity.ellipse) {
                existing.cesiumEntity.ellipse.semiMajorAxis = semiMajorAxis as any;
                existing.cesiumEntity.ellipse.semiMinorAxis = semiMinorAxis as any;
                existing.cesiumEntity.ellipse.material = fillColor as any;
                existing.cesiumEntity.ellipse.outlineColor = outlineColor as any;
                existing.cesiumEntity.ellipse.outline = showOutline as any;
                existing.cesiumEntity.ellipse.outlineWidth = outlineWidth as any;
                existing.cesiumEntity.ellipse.distanceDisplayCondition = distanceCondition as any;
            }

            // Update center point if it should exist
            if (options.size && options.size > 0) {
                if (existing.centerPointEntity) {
                    existing.centerPointEntity.position = position as any;
                    if (existing.centerPointEntity.point) {
                        existing.centerPointEntity.point.color = baseColor as any;
                        existing.centerPointEntity.point.pixelSize = options.size as any;
                        existing.centerPointEntity.point.outlineColor = Color.BLACK as any;
                        existing.centerPointEntity.point.outlineWidth = 1 as any;
                    }
                } else {
                    // Create center point if it doesn't exist yet
                    const centerPoint = this.viewer.entities.add({
                        id: `ellipse-center-${geoEntity.id}`,
                        position,
                        point: new PointGraphics({
                            pixelSize: options.size,
                            color: baseColor,
                            outlineColor: Color.BLACK,
                            outlineWidth: 1,
                            // Do NOT disable depth test - this causes visual drift/floating
                            // The point should behave like a normal geospatial marker
                            distanceDisplayCondition: distanceCondition,
                        }),
                        _wwvEntity: geoEntity,
                    } as any);
                    existing.centerPointEntity = centerPoint;
                }
            } else if (existing.centerPointEntity) {
                // Remove center point if size is 0 or undefined
                this.viewer.entities.remove(existing.centerPointEntity);
                existing.centerPointEntity = null;
            }
        } else {
            // Create new ellipse
            const cesiumEntity = this.viewer.entities.add({
                id: `ellipse-${geoEntity.id}`,
                position,
                ellipse: new EllipseGraphics({
                    semiMinorAxis,
                    semiMajorAxis,
                    material: fillColor,
                    outline: showOutline,
                    outlineColor,
                    outlineWidth,
                    height: 0, // Ground-clamped
                    distanceDisplayCondition: distanceCondition,
                }),
                // Store reference to original GeoEntity for selection
                _wwvEntity: geoEntity,
            } as any);

            // Create optional center point marker
            let centerPointEntity: Entity | null = null;
            if (options.size && options.size > 0) {
                centerPointEntity = this.viewer.entities.add({
                    id: `ellipse-center-${geoEntity.id}`,
                    position,
                    point: new PointGraphics({
                        pixelSize: options.size,
                        color: baseColor,
                        outlineColor: Color.BLACK,
                        outlineWidth: 1,
                        // Do NOT disable depth test - this causes visual drift/floating
                        // The point should behave like a normal geospatial marker
                        distanceDisplayCondition: distanceCondition,
                    }),
                    _wwvEntity: geoEntity,
                } as any);
            }

            this.ellipses.set(geoEntity.id, {
                cesiumEntity,
                centerPointEntity,
                geoEntity,
                options,
            });
        }
    }

    /**
     * Remove a single ellipse by entity ID
     */
    private removeEllipse(entityId: string) {
        const managed = this.ellipses.get(entityId);
        if (managed && this.viewer) {
            this.viewer.entities.remove(managed.cesiumEntity);
            if (managed.centerPointEntity) {
                this.viewer.entities.remove(managed.centerPointEntity);
            }
            this.ellipses.delete(entityId);
        }
    }

    /**
     * Clear all ellipses
     */
    clear() {
        if (this.viewer && !this.viewer.isDestroyed()) {
            this.ellipses.forEach(managed => {
                this.viewer!.entities.remove(managed.cesiumEntity);
                if (managed.centerPointEntity) {
                    this.viewer!.entities.remove(managed.centerPointEntity);
                }
            });
        }
        this.ellipses.clear();
    }

    /**
     * Get count of managed ellipses
     */
    getCount(): number {
        return this.ellipses.size;
    }
}

/**
 * Global singleton instance for ellipse management
 */
export const ellipseEntityManager = new EllipseEntityManager();
