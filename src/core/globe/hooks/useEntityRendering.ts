import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { renderEntitiesChunked, renderEntities, AnimatableItem } from "../EntityRenderer";
import { ellipseEntityManager } from "../EllipseEntityManager";
import { polylineEntityManager } from "../PolylineEntityManager";
import { polygonEntityManager } from "../PolygonEntityManager";
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
    const updateLoopRef = useRef<(() => void) | null>(null);
    const isAnimationLoopRegisteredRef = useRef(false);

    // Initialize animation loop once and keep it running
    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        // Only register the animation loop once
        if (!isAnimationLoopRegisteredRef.current) {
            updateLoopRef.current = createUpdateLoop(viewer, animatablesMapRef, hoveredEntityIdRef);
            viewer.scene.preUpdate.addEventListener(updateLoopRef.current);
            isAnimationLoopRegisteredRef.current = true;
        }

        return () => {
            if (updateLoopRef.current && !viewer.isDestroyed() && isAnimationLoopRegisteredRef.current) {
                viewer.scene.preUpdate.removeEventListener(updateLoopRef.current);
                isAnimationLoopRegisteredRef.current = false;
                updateLoopRef.current = null;
            }
        };
    }, [viewer, isReady, animatablesMapRef, hoveredEntityIdRef]);

    // Update entities without recreating the animation loop
    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        // Initialize ellipse manager with current viewer
        ellipseEntityManager.setViewer(viewer);
        
        // Initialize polyline manager with current viewer
        polylineEntityManager.setViewer(viewer);
        polygonEntityManager.setViewer(viewer);

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

        // Separate entities by render type
        const primitiveEntities = visibleEntities.filter(e => 
            e.options.type !== "ellipse" && e.options.type !== "polyline" && e.options.type !== "polygon"
        );
        
        ellipseEntityManager.update(visibleEntities);
        polylineEntityManager.update(visibleEntities);
        polygonEntityManager.update(visibleEntities);

        // Update primitive-based entities without destroying the animation loop
        renderEntitiesChunked(viewer, primitiveEntities, animatablesMapRef.current);

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
    ]);
}
