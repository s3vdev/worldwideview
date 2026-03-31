import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Cartographic, Cartesian3 } from "cesium";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { renderEntities, AnimatableItem } from "../EntityRenderer";
import { createUpdateLoop } from "../AnimationLoop";
import { rebuildStacks, calculateGridSizeDegrees } from "../StackManager";


export function useEntityRendering(
    viewer: CesiumViewer | null,
    isReady: boolean,
    visibleEntities: Array<{ entity: GeoEntity; options: CesiumEntityOptions }>,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>,
    hoveredEntityIdRef: React.MutableRefObject<string | null>,
    sceneSettings: {
        showFps: boolean;
        resolutionScale: number;
        antiAliasing: string;
        maxScreenSpaceError: number;
        shadowsEnabled: boolean;
        enableLighting: boolean;
    }
) {
    // Cached array ref — rebuilt only after renderEntities, not every frame
    const cachedAnimatablesRef = useRef<{ current: AnimatableItem[] }>({ current: [] });

    // Handle scene settings updates separately to avoid tearing down the animation loop
    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;
        
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;

        // Apply Anti-Aliasing Mode
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.antiAliasing === "fxaa";
        
        switch (sceneSettings.antiAliasing) {
            case "none":
            case "fxaa":
                viewer.scene.msaaSamples = 1;
                break;
            case "msaa2x":
                viewer.scene.msaaSamples = 2;
                break;
            case "msaa4x":
                viewer.scene.msaaSamples = 4;
                break;
            case "msaa8x":
                viewer.scene.msaaSamples = 8;
                break;
            default:
                viewer.scene.msaaSamples = 1;
        }
        viewer.shadowMap.enabled = sceneSettings.shadowsEnabled;
        viewer.scene.globe.enableLighting = sceneSettings.enableLighting;
        const primitives = viewer.scene.primitives as any;
        for (let i = 0; i < primitives.length; i++) {
            const p = primitives.get(i);
            if (p?.maximumScreenSpaceError !== undefined) {
                p.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
            }
        }
        viewer.scene.requestRender();
    }, [
        viewer,
        isReady,
        sceneSettings.showFps,
        sceneSettings.resolutionScale,
        sceneSettings.antiAliasing,
        sceneSettings.maxScreenSpaceError,
        sceneSettings.shadowsEnabled,
        sceneSettings.enableLighting
    ]);

    // Handle initial entity rendering and animation loop
    useEffect(() => {
        if (!viewer || !isReady || viewer.isDestroyed()) return;

        // Attach animation loop with cached array ref (no per-frame allocation)
        const updatePositions = createUpdateLoop(
            viewer,
            cachedAnimatablesRef.current,
            hoveredEntityIdRef
        );
        viewer.scene.preUpdate.addEventListener(updatePositions);

        // Synchronous render — all entities processed atomically in a single frame
        renderEntities(viewer, visibleEntities, animatablesMapRef.current);

        // Rebuild cached array after render
        cachedAnimatablesRef.current.current = Array.from(animatablesMapRef.current.values());

        // Camera distance-based dynamic clustering
        let lastAltitude = 0;
        if (viewer.camera && viewer.camera.positionCartographic) lastAltitude = viewer.camera.positionCartographic.height;
        
        const R_WGS84 = 6356752.0;
        const handlePreUpdateClustering = () => {
            if (viewer.isDestroyed() || !viewer.camera?.position) return;
            const distSqr = Cartesian3.magnitudeSquared(viewer.camera.position);
            const altitude = Math.max(0, Math.sqrt(distSqr) - R_WGS84);

            // Re-cluster if altitude changed significantly (15%)
            if (Math.abs(altitude - lastAltitude) / Math.max(lastAltitude, 1) > 0.15) {
                lastAltitude = altitude;
                rebuildStacks(animatablesMapRef.current, calculateGridSizeDegrees(altitude));
                // Call requestRender to ensure the new offsets are drawn in the very next frame
                viewer.scene.requestRender();
            }
        };
        viewer.scene.preUpdate.addEventListener(handlePreUpdateClustering);

        // Signal Cesium that the scene needs a re-render (requestRenderMode is on)
        viewer.scene.requestRender();

        return () => {
            if (!viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(updatePositions);
                viewer.scene.preUpdate.removeEventListener(handlePreUpdateClustering);
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
        animatablesMapRef,
        hoveredEntityIdRef
    ]);
}
