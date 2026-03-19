import { Cartesian3, Color } from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { createLabel, removeLabel, type AnimatableItem } from "./EntityRenderer";
import { updateModelTransform } from "./ModelManager";
import {
    HIGHLIGHT_COLOR_SELECTED,
    extrapolatePosition,
    applyHighlight,
} from "./animationHelpers";

const R_WGS84_MIN = 6356752.0;
const R2 = R_WGS84_MIN * R_WGS84_MIN;

/** Interval (in frames) between horizon-culling passes for static entities. */
const STATIC_HORIZON_INTERVAL = 30;

// ── DOD: Pre-sorted entity buckets ──────────────────────────
interface AnimationBuckets {
    dynamic: AnimatableItem[];
    staticBatch: AnimatableItem[];
}

let cachedBuckets: AnimationBuckets = { dynamic: [], staticBatch: [] };
let bucketSourceRef: AnimatableItem[] = [];

/** Rebuild buckets when the animatables array identity changes. */
function ensureBuckets(animatables: AnimatableItem[]): AnimationBuckets {
    if (animatables === bucketSourceRef && (cachedBuckets.dynamic.length + cachedBuckets.staticBatch.length > 0)) {
        return cachedBuckets;
    }
    bucketSourceRef = animatables;
    const dynamic: AnimatableItem[] = [];
    const staticBatch: AnimatableItem[] = [];
    for (let i = 0; i < animatables.length; i++) {
        const speed = animatables[i].entity.speed;
        (speed !== undefined && speed > 0) ? dynamic.push(animatables[i]) : staticBatch.push(animatables[i]);
    }
    cachedBuckets = { dynamic, staticBatch };
    return cachedBuckets;
}

/**
 * Creates the per-frame update function.
 * DOD: Entities are split into dynamic/static buckets so each
 * sub-loop processes homogeneous data without branching on type.
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
        const camPos = viewer.camera.positionWC;
        const camDistSqr = Cartesian3.magnitudeSquared(camPos);
        if (camDistSqr <= R2) return;

        const Dh = Math.sqrt(camDistSqr - R2);
        const frame = frameCount++;
        const isStaticCullFrame = frame % STATIC_HORIZON_INTERVAL === 0;
        const selectedId = state.selectedEntity?.id ?? null;
        const hoveredId = hoveredEntityIdRef.current;

        const { dynamic, staticBatch } = ensureBuckets(animatables);

        // Pass 1: Dynamic entities — every frame
        for (let i = 0; i < dynamic.length; i++) {
            processEntity(dynamic[i], camPos, Dh, nowMs, selectedId, hoveredId, labelsCollection, true);
        }

        // Pass 2: Static entities — cull frames only (unless interactive)
        if (isStaticCullFrame) {
            for (let i = 0; i < staticBatch.length; i++) {
                processEntity(staticBatch[i], camPos, Dh, nowMs, selectedId, hoveredId, labelsCollection, false);
            }
        } else {
            for (let i = 0; i < staticBatch.length; i++) {
                const id = staticBatch[i].entity.id;
                if (id === selectedId || id === hoveredId) {
                    processEntity(staticBatch[i], camPos, Dh, nowMs, selectedId, hoveredId, labelsCollection, false);
                }
            }
        }
    };
}

/** Process a single entity (shared by both dynamic and static passes). */
function processEntity(
    item: AnimatableItem, camPos: Cartesian3, Dh: number, nowMs: number,
    selectedId: string | null, hoveredId: string | null, labelsCollection: any, isDynamic: boolean
): void {
    const { primitive, entity, posRef } = item;
    if (!primitive || primitive.isDestroyed?.()) return;

    const isSelected = selectedId === entity.id;
    const isHovered = hoveredId === entity.id;

    // Horizon culling
    const posDistSqr = Cartesian3.magnitudeSquared(posRef);
    const Dph = Math.sqrt(Math.max(0, posDistSqr - R2));
    const distSqr = Cartesian3.distanceSquared(camPos, posRef);
    const horizonLimit = Dh + Dph;
    if (distSqr > horizonLimit * horizonLimit && !isSelected && !isHovered) {
        if (primitive.show !== false) primitive.show = false;
        hideLabel(item, labelsCollection);
        return;
    }

    if (isDynamic && entity.timestamp && entity.heading !== undefined) {
        extrapolatePosition(item, nowMs);
        if (item.options.type === "model") updateModelTransform(item, item.posRef, entity.heading);
    }

    if (item._modelPromoted) return;
    if (primitive.show !== true) primitive.show = true;

    // Highlight styling
    if (item.options.type !== "model") {
        applyHighlight(item, isSelected, isHovered);
    } else {
        if (isSelected && primitive.silhouetteSize !== 2) primitive.silhouetteSize = 2;
        else if (isHovered && primitive.silhouetteSize !== 1) primitive.silhouetteSize = 1;
        else if (!isSelected && !isHovered && primitive.silhouetteSize !== 0) primitive.silhouetteSize = 0;
    }

    // Label visibility
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

/** Hide + remove label to free memory. */
function hideLabel(item: AnimatableItem, labelsCollection: any): void {
    if (!item.labelPrimitive || item.labelPrimitive.isDestroyed?.()) return;
    if (item.labelPrimitive.show !== false) item.labelPrimitive.show = false;
    if (labelsCollection) removeLabel(item, labelsCollection);
}
