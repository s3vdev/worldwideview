import {
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    defined,
    SceneMode,
    SceneTransforms,
} from "cesium";
import type { Viewer as CesiumViewer, Cartesian2 } from "cesium";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";
import {
    findStackByEntityId, expandStack, collapseStack, getStacks
} from "./StackManager";

/**
 * Pick a WorldWideView entity at a screen position using the Cesium pick API.
 */
function findEntityAtPosition(viewer: CesiumViewer, position: { x: number; y: number }): GeoEntity | null {
    if (!viewer || viewer.isDestroyed()) return null;
    const picked = viewer.scene.pick(position as Cartesian2);
    if (defined(picked) && picked.id && picked.id._wwvEntity) {
        return picked.id._wwvEntity as GeoEntity;
    }
    return null;
}

/**
 * Sets up click and hover handlers on the viewer canvas.
 * Returns a cleanup function that destroys the handler and resets the cursor.
 */
export function setupInteractionHandlers(
    viewer: CesiumViewer,
    hoveredEntityIdRef: React.MutableRefObject<string | null>
): () => void {
    if (!viewer || viewer.isDestroyed() || !viewer.scene) {
        return () => { };
    }
    const canvas = viewer.scene.canvas;
    const handler = new ScreenSpaceEventHandler(canvas);

    /** Currently expanded stack id (only one at a time). */
    let expandedStackId: string | null = null;

    // Click → select entity or expand stack
    handler.setInputAction(
        (event: { position: { x: number; y: number } }) => {
            if (!viewer || viewer.isDestroyed()) return;
            const entity = findEntityAtPosition(viewer, event.position);

            if (entity) {
                const stack = findStackByEntityId(entity.id);
                // If clicked entity is in a stack
                if (stack && stack.children.length > 1) {
                    if (stack.state === "collapsed" || stack.state === "collapsing") {
                        // Expand the stack and select the hub
                        expandStack(stack.id);
                        if (expandedStackId && expandedStackId !== stack.id) {
                            collapseStack(expandedStackId);
                        }
                        expandedStackId = stack.id;
                        useStore.getState().setSelectedEntity(entity);
                    } else {
                        // Stack is already expanded, user clicked a leaf node -> select it
                        useStore.getState().setSelectedEntity(entity);
                    }
                } else {
                    // Clicked a standalone entity -> select it and close any open stack
                    useStore.getState().setSelectedEntity(entity);
                    if (expandedStackId) {
                        collapseStack(expandedStackId);
                        expandedStackId = null;
                    }
                }
            } else {
                // Clicked empty space -> clear selection and close any open stack
                useStore.getState().setSelectedEntity(null);
                if (expandedStackId) {
                    collapseStack(expandedStackId);
                    expandedStackId = null;
                }
            }

            if (entity) {
                useStore.getState().setHoveredEntity(null, null);
                hoveredEntityIdRef.current = null;
            }

            // Immediately request a render frame to apply highlight changes
            // or to kickstart the CSS spiderifier animation loop
            viewer.scene.requestRender();
        },
        ScreenSpaceEventType.LEFT_CLICK
    );

    let latestHoverRequestId = 0;

    // Hover → show tooltip card only
    handler.setInputAction(
        (event: { endPosition: { x: number; y: number } }) => {
            const pos = { x: event.endPosition.x, y: event.endPosition.y };

            if (hoveredEntityIdRef.current) {
                useStore.getState().setHoveredEntity(useStore.getState().hoveredEntity, pos);
            }

            if (!viewer || viewer.isDestroyed()) return;
            if (viewer.scene.mode === SceneMode.MORPHING) return;

            latestHoverRequestId++;
            const currentRequestId = latestHoverRequestId;

            const entity = findEntityAtPosition(viewer, pos);
            
            if (currentRequestId !== latestHoverRequestId) {
                return; // Another mouse move happened, ignore this result
            }

            const prevId = hoveredEntityIdRef.current;
            const newId = entity ? entity.id : null;

            if (prevId !== newId) {
                hoveredEntityIdRef.current = newId;
                canvas.style.cursor = entity ? "pointer" : "default";
                useStore.getState().setHoveredEntity(entity, entity ? pos : null);
                // Trigger render to apply hover highlights immediately
                viewer.scene.requestRender();
            }
        },
        ScreenSpaceEventType.MOUSE_MOVE
    );

    return () => {
        handler.destroy();
        canvas.style.cursor = "default";
    };
}
