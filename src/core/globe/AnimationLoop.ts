import {
    Cartesian3,
    Color,
    Math as CesiumMath,
    Ellipsoid,
    BoundingSphere,
    Intersect,
    CullingVolume,
    Matrix4,
    Transforms,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";
import { getEntityColor, createLabel, removeLabel, type AnimatableItem } from "./EntityRenderer";
import { updateModelTransform } from "./ModelManager";
import { pluginManager } from "@/core/plugins/PluginManager";
import { setFollowUpdateInProgress } from "./followCameraState";

/** Touch-friendly default point size: larger on mobile (coarse pointer). */
function defaultPointSize(): number {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return 12;
    return 8;
}

const HIGHLIGHT_COLOR_SELECTED = Color.fromCssColorString("#00fff7");
const HIGHLIGHT_COLOR_HOVERED = Color.YELLOW;

const R_WGS84_MIN = 6356752.0;
const R2 = R_WGS84_MIN * R_WGS84_MIN;

// Pre-allocate objects for Zero-Allocation Loop
const scratchDisplacement = new Cartesian3();
const scratchNorth = new Cartesian3();
const scratchEast = new Cartesian3();
const scratchVelocity = new Cartesian3();
const scratchSphere = new BoundingSphere(new Cartesian3(), 100); // 100m radius roughly
const scratchNorthPole = new Cartesian3(0, 0, 1);
const scratchSurfaceNormal = new Cartesian3();

// Follow camera: reuse scratch vectors (no per-frame allocation)
const FOLLOW_DISTANCE = 5000;
const FOLLOW_PITCH_DEG = -25;
const FOLLOW_LERP = 0.12;
const scratchFollowENU = new Cartesian3();
const scratchFollowFixed = new Cartesian3();
const scratchFollowCameraPos = new Cartesian3();
const scratchFollowMatrix = new Matrix4();

/**
 * Creates the per-frame update function for entity position extrapolation,
 * horizon culling, frustum culling, and highlight styling.
 */
export function createUpdateLoop(
    viewer: CesiumViewer,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>,
    hoveredEntityIdRef: React.MutableRefObject<string | null>
): () => void {
    let frameCount = 0;

    // We instantiate a reusable culling volume object
    let cullingVolume = new CullingVolume();

    return () => {
        if (!viewer || viewer.isDestroyed()) return;

        // Lazy fetch of labels collection just once per frame
        const labelsCollection = (viewer as any)._wwvLabels;

        const state = useStore.getState();
        const nowMs = state.isPlaybackMode ? state.currentTime.getTime() : Date.now();
        const cam = viewer.camera;
        const camPos = cam.positionWC;
        const camDistSqr = Cartesian3.magnitudeSquared(camPos);

        if (camDistSqr <= R2) return;

        const Dh = Math.sqrt(camDistSqr - R2);
        const isFullUpdate = frameCount++ % 2 === 0;

        // Extract camera culling volume for this frame
        cullingVolume = cam.frustum.computeCullingVolume(cam.positionWC, cam.directionWC, cam.upWC);

        // Iterate over the live animatables map
        for (const [, item] of animatablesMapRef.current.entries()) {
            const { primitive, entity, posRef } = item;
            const isModel = item.options.type === "model";
            const isSelected = state.selectedEntity?.id === entity.id;
            const isHovered = hoveredEntityIdRef.current === entity.id;

            if (!primitive || primitive.isDestroyed?.()) continue;

            // 1. Frustum Culling
            scratchSphere.center = posRef;
            scratchSphere.radius = 1000;
            const intersect = cullingVolume.computeVisibility(scratchSphere);
            const inFrustum = intersect !== Intersect.OUTSIDE;

            if (!inFrustum && !isSelected && !isHovered) {
                if (primitive.show !== false) primitive.show = false;
                if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.() && item.labelPrimitive.show !== false) item.labelPrimitive.show = false;
                continue;
            }

            // 2. Horizon culling
            const posDistSqr = Cartesian3.magnitudeSquared(posRef);
            const Dph = Math.sqrt(Math.max(0, posDistSqr - R2));
            const distanceToPoint = Cartesian3.distance(camPos, posRef);
            const isVisible = distanceToPoint <= (Dh + Dph);

            if (!isVisible && !isSelected && !isHovered) {
                if (primitive.show !== false) primitive.show = false;
                if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.() && item.labelPrimitive.show !== false) item.labelPrimitive.show = false;
                if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.() && labelsCollection) removeLabel(item, labelsCollection);
                continue;
            }

            // 3. Position update for all (including promoted 3D models) so interpolation stays smooth
            const managed = pluginManager.getPlugin(entity.pluginId);
            let positionUpdated = false;
            if (managed?.plugin.getDynamicPosition) {
                try {
                    const updatedPos = managed.plugin.getDynamicPosition(entity, new Date(nowMs));
                    if (updatedPos) {
                        Cartesian3.fromDegrees(
                            updatedPos.longitude,
                            updatedPos.latitude,
                            updatedPos.altitude || 0,
                            Ellipsoid.WGS84,
                            posRef
                        );
                        if (!primitive.isDestroyed?.()) primitive.position = posRef;
                        if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) item.labelPrimitive.position = posRef;
                        positionUpdated = true;
                    }
                } catch (err) {
                    console.warn(`[AnimationLoop] getDynamicPosition failed for ${entity.id}:`, err);
                }
            }
            if (!positionUpdated && entity.timestamp && entity.speed !== undefined && entity.heading !== undefined) {
                const needsExtrapolation = entity.speed > 0 || isSelected || isHovered || isFullUpdate;
                if (needsExtrapolation) {
                    extrapolatePosition(item, nowMs);
                    if (isModel) updateModelTransform(item, item.posRef, entity.heading);
                }
            }

            if (item._modelPromoted) continue;

            if (primitive.show !== true) primitive.show = true;

            // 4. Highlight styling (skip for models — they use silhouette instead)
            if (!isModel) {
                applyHighlight(item, isSelected, isHovered);
            } else {
                // Simple model highlight: silhouette
                if (isSelected && primitive.silhouetteSize !== 2) {
                    primitive.silhouetteSize = 2;
                } else if (isHovered && primitive.silhouetteSize !== 1) {
                    primitive.silhouetteSize = 1;
                } else if (!isSelected && !isHovered && primitive.silhouetteSize !== 0) {
                    primitive.silhouetteSize = 0;
                }
            }

            // 5. Label visibility and lazy creation
            const showLabel = isVisible && (distanceToPoint < 500000 || isSelected || isHovered);

            if (showLabel) {
                if (!item.labelPrimitive && labelsCollection) {
                    // Create if missing and should be shown
                    createLabel(item, labelsCollection);
                }
                if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
                    if (item.labelPrimitive.show !== true) item.labelPrimitive.show = true;
                    const targetFillColor = isSelected ? HIGHLIGHT_COLOR_SELECTED : Color.WHITE;
                    if (!Color.equals(item.labelPrimitive.fillColor, targetFillColor)) {
                        item.labelPrimitive.fillColor = targetFillColor;
                    }
                }
            } else {
                if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
                    if (item.labelPrimitive.show !== false) item.labelPrimitive.show = false;
                    if (labelsCollection) removeLabel(item, labelsCollection);
                }
            }
        }

        // Follow camera: smooth tracking of followed entity (runs every frame, no flyTo)
        const followId = useStore.getState().followEntityId;
        if (followId) {
            const item = animatablesMapRef.current.get(followId);
            if (!item) {
                useStore.getState().setFollowEntityId(null);
            } else {
                setFollowUpdateInProgress(true);
                try {
                    const entityPos = item.posRef;
                    const headingDeg = item.entity.heading ?? 0;
                    const headingRad = CesiumMath.toRadians(headingDeg);
                    const pitchRad = CesiumMath.toRadians(FOLLOW_PITCH_DEG);
                    const horizontalDist = FOLLOW_DISTANCE * Math.cos(pitchRad);
                    const upOffset = FOLLOW_DISTANCE * Math.sin(pitchRad);
                    // Offset "behind" entity: opposite to heading in ENU (east, north, up)
                    scratchFollowENU.x = -horizontalDist * Math.sin(headingRad);
                    scratchFollowENU.y = -horizontalDist * Math.cos(headingRad);
                    scratchFollowENU.z = upOffset;
                    Transforms.eastNorthUpToFixedFrame(entityPos, Ellipsoid.WGS84, scratchFollowMatrix);
                    Matrix4.multiplyByPoint(scratchFollowMatrix, scratchFollowENU, scratchFollowFixed);
                    Cartesian3.add(entityPos, scratchFollowFixed, scratchFollowCameraPos);
                    Cartesian3.lerp(cam.position, scratchFollowCameraPos, FOLLOW_LERP, scratchFollowFixed);
                    cam.position.x = scratchFollowFixed.x;
                    cam.position.y = scratchFollowFixed.y;
                    cam.position.z = scratchFollowFixed.z;
                    Cartesian3.subtract(entityPos, cam.position, scratchFollowFixed);
                    Cartesian3.normalize(scratchFollowFixed, cam.direction);
                    Ellipsoid.WGS84.geodeticSurfaceNormal(cam.position, cam.up);
                } finally {
                    setFollowUpdateInProgress(false);
                }
            }
        }
    };
}

/** Extrapolate entity position forward/backward in time using zero-allocation mathematics. */
function extrapolatePosition(item: AnimatableItem, nowMs: number): void {
    const { entity, posRef } = item;
    if (!entity.timestamp) return;
    const timestamp = typeof entity.timestamp === 'string' ? new Date(entity.timestamp) : entity.timestamp;

    const dtSec = (nowMs - timestamp.getTime()) / 1000;
    if (Math.abs(dtSec) > 300) return;

    // Cache base position and velocity vector only once
    if (!item.velocityVector) {
        const headingRad = CesiumMath.toRadians(entity.heading!);
        // Use scratchSurfaceNormal to avoid allocation
        Ellipsoid.WGS84.geodeticSurfaceNormal(posRef, scratchSurfaceNormal);

        Cartesian3.cross(scratchNorthPole, scratchSurfaceNormal, scratchNorth);
        Cartesian3.cross(scratchSurfaceNormal, scratchNorth, scratchNorth);
        Cartesian3.normalize(scratchNorth, scratchNorth);

        Cartesian3.cross(scratchNorth, scratchSurfaceNormal, scratchEast);
        Cartesian3.normalize(scratchEast, scratchEast);

        Cartesian3.multiplyByScalar(scratchNorth, Math.cos(headingRad), scratchVelocity);

        Cartesian3.multiplyByScalar(scratchEast, Math.sin(headingRad), scratchEast); // reuse scratchEast as tempEast
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
            // Calculate original scale from size option
            const baseScale = options.size ? options.size / 24 : 0.5;
            primitive.scale = baseScale * 1.4; // 40% larger when selected
        } else {
            primitive.pixelSize = (options.size || defaultPointSize()) * 2.0;
            primitive.outlineColor = HIGHLIGHT_COLOR_SELECTED;
            primitive.outlineWidth = 3;
        }
    } else if (targetState === 'hovered') {
        primitive.color = HIGHLIGHT_COLOR_HOVERED;
        if (options.type === "billboard") {
            // Calculate original scale from size option
            const baseScale = options.size ? options.size / 24 : 0.5;
            primitive.scale = baseScale * 1.2; // 20% larger when hovered
        } else {
            primitive.pixelSize = (options.size || defaultPointSize()) * 1.5;
            primitive.outlineColor = HIGHLIGHT_COLOR_HOVERED;
            primitive.outlineWidth = 2;
        }
    } else {
        primitive.color = item.baseColor;
        if (options.type === "billboard") {
            // Restore original scale from size option
            const baseScale = options.size ? options.size / 24 : 0.5;
            primitive.scale = baseScale;
        } else {
            primitive.pixelSize = options.size || defaultPointSize();
            primitive.outlineColor = item.baseOutlineColor;
            primitive.outlineWidth = options.outlineWidth || 1;
        }
    }
}
