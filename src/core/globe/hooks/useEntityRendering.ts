import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { renderEntitiesChunked, renderEntities, AnimatableItem } from "../EntityRenderer";
import { ellipseEntityManager } from "../EllipseEntityManager";
import { polylineEntityManager } from "../PolylineEntityManager";
import { polygonEntityManager } from "../PolygonEntityManager";
import { createUpdateLoop } from "../AnimationLoop";

export function useEntityRendering(
    viewerRef: React.MutableRefObject<CesiumViewer | null>,
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

    // Initialize animation loop once and keep it running (loop reads viewerRef.current every frame)
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        // Register loop once; pass refs so the loop always reads current viewer and map.
        // preUpdate runs before render so position updates are visible the same frame.
        if (!isAnimationLoopRegisteredRef.current) {
            updateLoopRef.current = createUpdateLoop(viewerRef, animatablesMapRef, hoveredEntityIdRef);
            viewer.scene.preUpdate.addEventListener(updateLoopRef.current);
            isAnimationLoopRegisteredRef.current = true;
        }

        return () => {
            const v = viewerRef.current;
            if (updateLoopRef.current && v && !v.isDestroyed() && isAnimationLoopRegisteredRef.current) {
                v.scene.preUpdate.removeEventListener(updateLoopRef.current);
                isAnimationLoopRegisteredRef.current = false;
                updateLoopRef.current = null;
            }
        };
    }, [viewerRef, isReady, animatablesMapRef, hoveredEntityIdRef]);

    // Update entities without recreating the animation loop
    useEffect(() => {
        const viewer = viewerRef.current;
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
        viewerRef,
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
