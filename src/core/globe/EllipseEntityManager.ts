import {
    Cartesian3,
    Color,
    EllipseGraphics,
    Entity,
    DistanceDisplayCondition,
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
 * and this manager will render it as a circular/elliptical area.
 */

interface ManagedEllipse {
    cesiumEntity: Entity;
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
        const position = Cartesian3.fromDegrees(
            geoEntity.longitude,
            geoEntity.latitude,
            geoEntity.altitude || 0
        );

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
                    distanceDisplayCondition,
                }),
                // Store reference to original GeoEntity for selection
                _wwvEntity: geoEntity,
            } as any);

            this.ellipses.set(geoEntity.id, {
                cesiumEntity,
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
