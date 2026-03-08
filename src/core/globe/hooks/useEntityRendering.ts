import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { renderEntitiesChunked, renderEntities, AnimatableItem } from "../EntityRenderer";
import { ellipseEntityManager } from "../EllipseEntityManager";
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

        // Initialize ellipse manager with current viewer
        ellipseEntityManager.setViewer(viewer);

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

        let updatePositions: (() => void) | undefined;

        // Separate ellipse-type entities from primitive-based entities
        const primitiveEntities = visibleEntities.filter(e => e.options.type !== "ellipse");
        
        // Render ellipse entities through EllipseEntityManager (generic, not GPS-specific)
        ellipseEntityManager.update(visibleEntities);

        // Use chunked rendering for primitive-based entities (points/billboards)
        renderEntitiesChunked(viewer, primitiveEntities, animatablesMapRef.current).then(animatables => {
            if (!viewer || viewer.isDestroyed()) return;
            updatePositions = createUpdateLoop(viewer, animatables, hoveredEntityIdRef);
            viewer.scene.preUpdate.addEventListener(updatePositions);
        });

        return () => {
            if (updatePositions && !viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(updatePositions);
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
