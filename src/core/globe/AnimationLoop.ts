import {
    Cartesian3,
    Color,
    Math as CesiumMath,
    Ellipsoid,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { getEntityColor, createLabel, removeLabel, type AnimatableItem } from "./EntityRenderer";
import { updateModelTransform } from "./ModelManager";

/** Returns a touch-friendly default point size: larger on mobile. */
function defaultPointSize(): number {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return 12;
    return 8;
}

const HIGHLIGHT_COLOR_SELECTED = Color.fromCssColorString("#00fff7");
const HIGHLIGHT_COLOR_HOVERED = Color.YELLOW;

const R_WGS84_MIN = 6356752.0;
const R2 = R_WGS84_MIN * R_WGS84_MIN;

// Pre-allocate scratch objects for zero-allocation math
const scratchDisplacement = new Cartesian3();
const scratchNorth = new Cartesian3();
const scratchEast = new Cartesian3();
const scratchVelocity = new Cartesian3();
const scratchNorthPole = new Cartesian3(0, 0, 1);
const scratchSurfaceNormal = new Cartesian3();

/**
 * Interval (in frames) between horizon-culling passes for static entities.
 * At 60fps this is ~0.5s — generous enough to avoid wasted work,
 * frequent enough that the user won't see delayed show/hide.
 */
const STATIC_HORIZON_INTERVAL = 30;

/**
 * Creates the per-frame update function.
 *
 * Key design: separate "dynamic" entities (aviation with speed/heading)
 * from "static" entities (embassies, bases, nuclear — GeoJSON with no movement).
 *
 * - Dynamic: iterated every frame for position extrapolation + horizon culling.
 * - Static: horizon-culled only every STATIC_HORIZON_INTERVAL frames (batch).
 *   Cesium's GPU handles frustum culling natively for PointPrimitiveCollection,
 *   so JS-side frustum culling is removed entirely.
 */
export function createUpdateLoop(
    viewer: CesiumViewer,
    animatablesRef: { current: AnimatableItem[] },
    hoveredEntityIdRef: React.MutableRefObject<string | null>
): () => void {
    let frameCount = 0;

    return () => {
        if (!viewer || viewer.isDestroyed()) return;

        const animatables = animatablesRef.current;
        if (animatables.length === 0) return;

        const labelsCollection = (viewer as any)._wwvLabels;
        const state = useStore.getState();
        const nowMs = state.isPlaybackMode ? state.currentTime.getTime() : Date.now();
        const cam = viewer.camera;
        const camPos = cam.positionWC;
        const camDistSqr = Cartesian3.magnitudeSquared(camPos);

        if (camDistSqr <= R2) return;

        const Dh = Math.sqrt(camDistSqr - R2);
        const frame = frameCount++;
        const isStaticCullFrame = frame % STATIC_HORIZON_INTERVAL === 0;

        for (let i = 0; i < animatables.length; i++) {
            const item = animatables[i];
            const { primitive, entity, posRef } = item;

            if (!primitive || primitive.isDestroyed?.()) continue;

            const isDynamic = entity.speed !== undefined && entity.speed > 0;
            const isSelected = state.selectedEntity?.id === entity.id;
            const isHovered = hoveredEntityIdRef.current === entity.id;

            // ── Static entities: only process on cull frames or if interactive ──
            if (!isDynamic && !isStaticCullFrame && !isSelected && !isHovered) {
                continue;
            }

            // ── Horizon culling (the only culling we do in JS) ──
            const posDistSqr = Cartesian3.magnitudeSquared(posRef);
            const Dph = Math.sqrt(Math.max(0, posDistSqr - R2));
            const distSqr = Cartesian3.distanceSquared(camPos, posRef);
            const horizonLimit = Dh + Dph;
            const isVisible = distSqr <= horizonLimit * horizonLimit;

            if (!isVisible && !isSelected && !isHovered) {
                if (primitive.show !== false) primitive.show = false;
                hideLabel(item, labelsCollection);
                continue;
            }

            // ── Position extrapolation (dynamic entities only) ──
            if (isDynamic && entity.timestamp && entity.heading !== undefined) {
                extrapolatePosition(item, nowMs);
                if (item.options.type === "model") {
                    updateModelTransform(item, item.posRef, entity.heading);
                }
            }

            // Don't show billboard if LOD hook has promoted this item to a 3D model
            if (item._modelPromoted) continue;

            if (primitive.show !== true) primitive.show = true;

            // ── Highlight styling ──
            const isModel = item.options.type === "model";
            if (!isModel) {
                applyHighlight(item, isSelected, isHovered);
            } else {
                if (isSelected && primitive.silhouetteSize !== 2) primitive.silhouetteSize = 2;
                else if (isHovered && primitive.silhouetteSize !== 1) primitive.silhouetteSize = 1;
                else if (!isSelected && !isHovered && primitive.silhouetteSize !== 0) primitive.silhouetteSize = 0;
            }

            // ── Label visibility (lazy creation) ──
            const distanceToPoint = Math.sqrt(distSqr);
            const showLabel = distanceToPoint < 500000 || isSelected || isHovered;

            if (showLabel) {
                if (!item.labelPrimitive && labelsCollection) createLabel(item, labelsCollection);
                if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
                    if (item.labelPrimitive.show !== true) item.labelPrimitive.show = true;
                    const fill = isSelected ? HIGHLIGHT_COLOR_SELECTED : Color.WHITE;
                    if (!Color.equals(item.labelPrimitive.fillColor, fill)) item.labelPrimitive.fillColor = fill;
                }
            } else {
                hideLabel(item, labelsCollection);
            }
        }
    };
}

/** Hide + remove label to free memory. */
function hideLabel(item: AnimatableItem, labelsCollection: any): void {
    if (!item.labelPrimitive || item.labelPrimitive.isDestroyed?.()) return;
    if (item.labelPrimitive.show !== false) item.labelPrimitive.show = false;
    if (labelsCollection) removeLabel(item, labelsCollection);
}

/** Extrapolate entity position forward/backward in time (zero-allocation). */
function extrapolatePosition(item: AnimatableItem, nowMs: number): void {
    const { entity, posRef } = item;
    if (!entity.timestamp) return;
    const timestamp = typeof entity.timestamp === 'string' ? new Date(entity.timestamp) : entity.timestamp;

    const dtSec = (nowMs - timestamp.getTime()) / 1000;
    if (Math.abs(dtSec) > 300) return;

    if (!item.velocityVector) {
        const headingRad = CesiumMath.toRadians(entity.heading!);
        Ellipsoid.WGS84.geodeticSurfaceNormal(posRef, scratchSurfaceNormal);

        Cartesian3.cross(scratchNorthPole, scratchSurfaceNormal, scratchNorth);
        Cartesian3.cross(scratchSurfaceNormal, scratchNorth, scratchNorth);
        Cartesian3.normalize(scratchNorth, scratchNorth);

        Cartesian3.cross(scratchNorth, scratchSurfaceNormal, scratchEast);
        Cartesian3.normalize(scratchEast, scratchEast);

        Cartesian3.multiplyByScalar(scratchNorth, Math.cos(headingRad), scratchVelocity);
        Cartesian3.multiplyByScalar(scratchEast, Math.sin(headingRad), scratchEast);
        Cartesian3.add(scratchVelocity, scratchEast, scratchVelocity);
        Cartesian3.multiplyByScalar(scratchVelocity, entity.speed!, scratchVelocity);

        item.basePosition = Cartesian3.clone(posRef);
        item.velocityVector = Cartesian3.clone(scratchVelocity);
    }

    if (entity.speed === 0) {
        if (item.primitive && !item.primitive.isDestroyed?.() && item.primitive.position !== posRef) {
            item.primitive.position = posRef;
            if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) item.labelPrimitive.position = posRef;
        }
        return;
    }

    Cartesian3.multiplyByScalar(item.velocityVector, dtSec, scratchDisplacement);
    Cartesian3.add(item.basePosition!, scratchDisplacement, posRef);

    if (item.primitive && !item.primitive.isDestroyed?.()) item.primitive.position = posRef;
    if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) item.labelPrimitive.position = posRef;
}

/** Apply selected/hovered/normal highlight styling. */
function applyHighlight(item: AnimatableItem, isSelected: boolean, isHovered: boolean): void {
    const { primitive, options } = item;

    let targetState: 'selected' | 'hovered' | 'normal' = 'normal';
    if (isSelected) targetState = 'selected';
    else if (isHovered) targetState = 'hovered';

    if (item.lastHighlightState === targetState) return;
    item.lastHighlightState = targetState;

    if (targetState === 'selected') {
        primitive.color = HIGHLIGHT_COLOR_SELECTED;
        if (options.type === "billboard") {
            primitive.scale = 0.7;
        } else {
            primitive.pixelSize = (options.size || defaultPointSize()) * 2.0;
            primitive.outlineColor = HIGHLIGHT_COLOR_SELECTED;
            primitive.outlineWidth = 3;
        }
    } else if (targetState === 'hovered') {
        primitive.color = HIGHLIGHT_COLOR_HOVERED;
        if (options.type === "billboard") {
            primitive.scale = 0.6;
        } else {
            primitive.pixelSize = (options.size || defaultPointSize()) * 1.5;
            primitive.outlineColor = HIGHLIGHT_COLOR_HOVERED;
            primitive.outlineWidth = 2;
        }
    } else {
        primitive.color = item.baseColor;
        if (options.type === "billboard") {
            primitive.scale = 0.5;
        } else {
            primitive.pixelSize = options.size || defaultPointSize();
            primitive.outlineColor = item.baseOutlineColor;
            primitive.outlineWidth = options.outlineWidth || 1;
        }
    }
}
