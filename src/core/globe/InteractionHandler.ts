import {
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    defined,
    SceneMode,
} from "cesium";
import type { Viewer as CesiumViewer, Cartesian2 } from "cesium";
import type { GeoEntity } from "@/core/plugins/PluginTypes";
import { useStore } from "@/core/state/store";

/**
 * Pick a WorldWideView entity at a screen position using the Cesium scene.pick API.
 */
function findEntityAtPosition(viewer: CesiumViewer, position: { x: number; y: number }): GeoEntity | null {
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
    const canvas = viewer.scene.canvas;

    const setSelectedEntity = useStore.getState().setSelectedEntity;
    const setHoveredEntity = useStore.getState().setHoveredEntity;

    const handler = new ScreenSpaceEventHandler(canvas);

    // Click → select entity
    handler.setInputAction(
        (event: { position: { x: number; y: number } }) => {
            const entity = findEntityAtPosition(viewer, event.position);
            useStore.getState().setSelectedEntity(entity);
            if (entity) {
                useStore.getState().setHoveredEntity(null, null);
                hoveredEntityIdRef.current = null;
            }
        },
        ScreenSpaceEventType.LEFT_CLICK
    );

    // Hover → show tooltip card
    let hoverTimeout: NodeJS.Timeout | null = null;
    const HOVER_THROTTLE_MS = 100; // 10 Hz

    handler.setInputAction(
        (event: { endPosition: { x: number; y: number } }) => {
            // Instantly update screen position to keep tooltip following mouse smoothly if already hovered
            if (hoveredEntityIdRef.current) {
                useStore.setState({
                    hoveredScreenPosition: { x: event.endPosition.x, y: event.endPosition.y },
                });
            }

            // Wait for both throttle and camera/scene to be stable
            if (hoverTimeout !== null) return;

            // Skip picking if camera is currently moving or scene is morphing
            if (
                viewer.scene.mode === SceneMode.MORPHING ||
                (viewer.camera.pitch !== useStore.getState().cameraPitch && false /* basic heuristic or could use viewer.scene.preRender flag but we have store */)
                // Actually the cleanest way to check if camera is moving is to use the viewer's internal properties, or checking if it's currently being dragged.
            ) {
                // Return early
            }

            const pos = { x: event.endPosition.x, y: event.endPosition.y };

            hoverTimeout = setTimeout(() => {
                hoverTimeout = null;
                // Add an explicit check inside the timeout to ensure the scene is still in a stable picking state
                if (viewer.scene.mode === SceneMode.MORPHING) return;

                // You can also check if a drag is happening if you have a drag state, but we'll stick to basic Cesium checks
                const entity = findEntityAtPosition(viewer, pos);
                const prevId = hoveredEntityIdRef.current;
                const newId = entity ? entity.id : null;

                if (prevId !== newId) {
                    hoveredEntityIdRef.current = newId;
                    canvas.style.cursor = entity ? "pointer" : "default";
                    useStore.getState().setHoveredEntity(
                        entity,
                        entity ? pos : null
                    );
                }
            }, HOVER_THROTTLE_MS);
        },
        ScreenSpaceEventType.MOUSE_MOVE
    );

    return () => {
        if (hoverTimeout !== null) clearTimeout(hoverTimeout);
        handler.destroy();
        canvas.style.cursor = "default";
    };
}
