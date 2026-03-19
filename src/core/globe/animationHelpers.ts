/**
 * DOD: Position extrapolation and highlight styling helpers.
 *
 * Extracted from AnimationLoop.ts for modularity.
 * These are the per-entity processing functions used by the
 * batched animation loop.
 */
import { Cartesian3, Color, Math as CesiumMath, Ellipsoid } from "cesium";
import type { AnimatableItem } from "./EntityRenderer";

/** Returns a touch-friendly default point size: larger on mobile. */
function defaultPointSize(): number {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return 12;
    return 8;
}

export const HIGHLIGHT_COLOR_SELECTED = Color.fromCssColorString("#00fff7");
export const HIGHLIGHT_COLOR_HOVERED = Color.YELLOW;

// Pre-allocate scratch objects for zero-allocation math
const scratchDisplacement = new Cartesian3();
const scratchNorth = new Cartesian3();
const scratchEast = new Cartesian3();
const scratchVelocity = new Cartesian3();
const scratchNorthPole = new Cartesian3(0, 0, 1);
const scratchSurfaceNormal = new Cartesian3();

/** Extrapolate entity position forward/backward in time (zero-allocation). */
export function extrapolatePosition(item: AnimatableItem, nowMs: number): void {
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
export function applyHighlight(item: AnimatableItem, isSelected: boolean, isHovered: boolean): void {
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
