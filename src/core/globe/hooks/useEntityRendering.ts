import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { renderEntities, AnimatableItem } from "../EntityRenderer";
import { createUpdateLoop } from "../AnimationLoop";


export function useEntityRendering(
    viewer: CesiumViewer | null,
    isReady: boolean,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>,
    hoveredEntityIdRef: React.MutableRefObject<string | null>,
    sceneSettings: {
        showFps: boolean;
        resolutionScale: number;
        msaaSamples: number;
        enableFxaa: boolean;
        maxScreenSpaceError: number;
    }
) {
    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        // Sync scene settings
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;
        viewer.scene.msaaSamples = sceneSettings.msaaSamples;
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.enableFxaa;
        const primitives = viewer.scene.primitives as any;
        for (let i = 0; i < primitives.length; i++) {
            const p = primitives.get(i);
            if (p?.maximumScreenSpaceError !== undefined) {
                p.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
            }
        }

        // Attach animation loop immediately with a live getter so it sees entities
        // as they are added during chunked loading (horizon culling runs from frame 1)
        const updatePositions = createUpdateLoop(
            viewer,
            () => Array.from(animatablesMapRef.current.values()),
            hoveredEntityIdRef
        );
        viewer.scene.preUpdate.addEventListener(updatePositions);

        // Synchronous render — all entities processed atomically in a single frame
        // to prevent ghost points from the async chunked processor's race condition
        renderEntities(viewer, visibleEntities, animatablesMapRef.current);

        return () => {
            if (!viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(updatePositions);
                // Synchronously flush all labels to prevent stale labels persisting
                const labels = (viewer as any)?._wwvLabels;
                if (labels) {
                    for (const item of animatablesMapRef.current.values()) {
                        if (item.labelPrimitive && !item.labelPrimitive.isDestroyed?.()) {
                            labels.remove(item.labelPrimitive);
                            item.labelPrimitive = undefined;
                        }
                    }
                }
            }
        };
    }, [
        viewer,
        isReady,
        visibleEntities,
        sceneSettings.showFps,
        sceneSettings.resolutionScale,
        sceneSettings.msaaSamples,
        sceneSettings.enableFxaa,
        sceneSettings.maxScreenSpaceError,
        animatablesMapRef,
        hoveredEntityIdRef
    ]);
}
