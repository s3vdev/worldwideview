"use client";
// @refresh reset

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Viewer } from "resium";
import {
    Ion,
    createGooglePhotorealistic3DTileset,
    Cartesian3,
    Entity as CesiumEntity,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import { applyFilters } from "@/core/filters/filterEngine";
import { subscribeToCameraPresets } from "./CameraController";
import { setupInteractionHandlers } from "./InteractionHandler";
import { dataBus } from "@/core/data/DataBus";
import { useBorders } from "./useBorders";
import { initPrimitiveCollections, AnimatableItem } from "./EntityRenderer";
import { handleEntitySelection, cleanupTrail } from "./SelectionHandler";
import { useImageryManager } from "./useImageryManager";

// New Hooks
import { useCameraActions } from "./hooks/useCameraActions";
import { useSelectionAnchor } from "./hooks/useSelectionAnchor";
import { useCameraSync } from "./hooks/useCameraSync";
import { useFollowCamera } from "./hooks/useFollowCamera";
import { useEntityRendering } from "./hooks/useEntityRendering";
import { useModelRendering } from "./hooks/useModelRendering";
import { useFrustumRendering } from "./hooks/useFrustumRendering";

// Set Cesium Ion token
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_TOKEN) {
    Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
}

export default function GlobeView() {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const hoveredEntityIdRef = useRef<string | null>(null);
    const trailEntityRef = useRef<CesiumEntity | null>(null);
    const selectionEntityRef = useRef<CesiumEntity | null>(null);
    const animatablesMapRef = useRef(new Map<string, AnimatableItem>());
    const [viewerReady, setViewerReady] = useState(false);

    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const currentTime = useStore((s) => s.currentTime);
    const showLabels = layers["borders"]?.enabled ?? false;
    const sceneSettings = {
        showFps: useStore((s) => s.mapConfig.showFps),
        resolutionScale: useStore((s) => s.mapConfig.resolutionScale),
        msaaSamples: useStore((s) => s.mapConfig.msaaSamples),
        enableFxaa: useStore((s) => s.mapConfig.enableFxaa),
        maxScreenSpaceError: useStore((s) => s.mapConfig.maxScreenSpaceError),
    };
    const filters = useStore((s) => s.filters);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const setCameraPosition = useStore((s) => s.setCameraPosition);
    const setFps = useStore((s) => s.setFps);

    // Re-fetch when filters change (for plugins that use filters to determine what to fetch)
    // Only trigger if filter actually changed (not on initial mount)
    const prevSatellitesFiltersRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        const satellitesFilters = filters["satellites"];
        const managed = pluginManager.getPlugin("satellites");
        
        // Serialize current filter state for comparison
        const currentFilterKey = satellitesFilters ? JSON.stringify(satellitesFilters) : "empty";
        
        // Skip on initial mount
        if (prevSatellitesFiltersRef.current === undefined) {
            prevSatellitesFiltersRef.current = currentFilterKey;
            return;
        }
        
        // Only trigger if filter actually changed
        if (currentFilterKey !== prevSatellitesFiltersRef.current) {
            if (managed && managed.enabled) {
                pluginManager.fetchForPlugin("satellites", managed.context.timeRange).catch(err => {
                    console.error("[GlobeView] Failed to re-fetch satellites after filter change:", err);
                });
            }
            
            prevSatellitesFiltersRef.current = currentFilterKey;
        }
    }, [filters["satellites"]]);

    // Compute visible & filtered entities
    const visibleEntities = useMemo(() => {
        const result: Array<{ entity: GeoEntity; options: CesiumEntityOptions }> = [];
        const nowMs = currentTime.getTime();

        pluginManager.getAllPlugins().forEach((managed) => {
            if (!layers[managed.plugin.id]?.enabled) return;
            let entities = entitiesByPlugin[managed.plugin.id] || [];

            if (managed.plugin.id === "internetOutages") {
                const loadedCount = entities.length;
                entities = entities.filter((entity) => {
                    const startTime = entity.properties?.startTime;
                    const endTime = entity.properties?.endTime;
                    if (startTime == null || endTime == null) return false;
                    const startMs = typeof startTime === "string" ? new Date(startTime).getTime() : (startTime as Date)?.getTime?.();
                    const endMs = typeof endTime === "string" ? new Date(endTime).getTime() : (endTime as Date)?.getTime?.();
                    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
                    return nowMs >= startMs && nowMs <= endMs;
                });
                const visibleCount = entities.length;
                if (process.env.NODE_ENV === "development" && loadedCount > 0) {
                    console.debug(
                        "[internetOutages] loaded:",
                        loadedCount,
                        "visible (currentTime in range):",
                        visibleCount,
                        "discarded:",
                        loadedCount - visibleCount
                    );
                }
            }

            const defs = managed.plugin.getFilterDefinitions?.() || [];
            const active = filters[managed.plugin.id] || {};
            applyFilters(entities, defs, active).forEach((entity) => {
                result.push({ entity, options: managed.plugin.renderEntity(entity) });
            });
        });
        
        // Generic: Inject derived entities for selected entity (e.g., satellite orbits, ground track) only when that layer is enabled
        if (selectedEntity) {
            const managed = pluginManager.getPlugin(selectedEntity.pluginId);
            const layerEnabled = layers[selectedEntity.pluginId]?.enabled;
            if (managed && layerEnabled && managed.plugin.getSelectionDerivedEntities) {
                const derivedEntities = managed.plugin.getSelectionDerivedEntities(selectedEntity);
                derivedEntities.forEach((derivedEntity) => {
                    const options = managed.plugin.renderEntity(derivedEntity);
                    result.push({ entity: derivedEntity, options });
                });
            }
        }
        
        return result;
    }, [layers, entitiesByPlugin, filters, selectedEntity, currentTime]);

    // Imagery & Scene Management Hooks
    useImageryManager(viewerRef.current);
    useBorders(viewerRef.current, showLabels);

    // UI/Interaction Hooks
    useSelectionAnchor(viewerRef.current, viewerReady, selectedEntity, selectionEntityRef, animatablesMapRef);
    useCameraSync(viewerRef.current, viewerReady, setCameraPosition, setFps);
    useCameraActions(viewerRef.current, viewerReady);
    useFollowCamera(viewerRef.current, viewerReady);
    // All entities go through billboard/point pipeline (including model-type as fallback)
    useEntityRendering(viewerRef, viewerReady, visibleEntities, animatablesMapRef, hoveredEntityIdRef, sceneSettings);
    // LOD: promote nearby model-type entities to 3D models, hiding their billboard
    useModelRendering(viewerRef.current, viewerReady, animatablesMapRef);

    // Frustum outlines for camera entities
    const cameraLayerEnabled = layers["camera"]?.enabled ?? false;
    const cameraEntities = entitiesByPlugin["camera"] || [];
    useFrustumRendering(viewerRef.current, viewerReady, cameraEntities, cameraLayerEnabled);

    // Camera preset events
    useEffect(() => {
        if (!viewerRef.current) return;
        return subscribeToCameraPresets(viewerRef.current);
    }, [viewerReady]);

    // Click/hover handlers
    useEffect(() => {
        if (!viewerRef.current) return;
        return setupInteractionHandlers(viewerRef.current, hoveredEntityIdRef);
    }, [viewerReady]);

    // Viewer initialization
    const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
        viewerRef.current = viewer;
        viewer.scene.requestRenderMode = false;
        viewer.scene.maximumRenderTimeChange = Infinity;
        viewer.scene.debugShowFramesPerSecond = sceneSettings.showFps;
        viewer.resolutionScale = sceneSettings.resolutionScale;
        viewer.scene.msaaSamples = sceneSettings.msaaSamples;
        viewer.scene.postProcessStages.fxaa.enabled = sceneSettings.enableFxaa;

        // Initialize Google Photorealistic 3D Tiles once
        try {
            const tileset = await createGooglePhotorealistic3DTileset({
                key: process.env.GOOGLE_MAPS_API_KEY || undefined,
            });
            tileset.maximumScreenSpaceError = sceneSettings.maxScreenSpaceError;
            viewer.scene.primitives.add(tileset);
        } catch (err) {
            console.warn("[GlobeView] Failed to initialize Google 3D Tiles:", err);
        }

        initPrimitiveCollections(viewer);
        viewer.camera.setView({ destination: Cartesian3.fromDegrees(0, 20, 20000000) });
        setViewerReady(true);
        dataBus.emit("globeReady", {});
    }, [sceneSettings]);

    // Entity selection → fly-to + trail
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;
        cleanupTrail(viewer, trailEntityRef);
        if (selectedEntity) handleEntitySelection(viewer, selectedEntity, trailEntityRef, animatablesMapRef.current);
    }, [selectedEntity, viewerReady]);

    // Camera lock
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        if (lockedEntityId && selectionEntityRef.current) {
            viewer.trackedEntity = selectionEntityRef.current;
        } else {
            viewer.trackedEntity = undefined;
        }
    }, [lockedEntityId, viewerReady]);

    return (
        <Viewer
            full
            ref={(e) => {
                if (e?.cesiumElement && !viewerRef.current) handleViewerReady(e.cesiumElement);
            }}
            animation={false} baseLayerPicker={false} fullscreenButton={false}
            geocoder={false} homeButton={false} infoBox={false}
            navigationHelpButton={false} sceneModePicker={false}
            selectionIndicator={false} timeline={false} vrButton={false}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
    );
}
