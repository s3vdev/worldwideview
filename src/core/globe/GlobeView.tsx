"use client";

import React, { useEffect, useRef, useCallback, useMemo, useState } from "react";
import {
    Viewer,
    Entity,
    BillboardGraphics,
    PointGraphics,
} from "resium";
import {
    Ion,
    GeoJsonDataSource,
    createGooglePhotorealistic3DTileset,
    Cartesian3,
    Color,
    VerticalOrigin,
    HorizontalOrigin,
    NearFarScalar,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    defined,
    Math as CesiumMath,
    JulianDate,
    PointPrimitiveCollection,
    BillboardCollection,
    LabelCollection,
    Ellipsoid,
    CullingVolume,
    BoundingSphere,
    Intersect,
    Cartographic,
    DistanceDisplayCondition,
    LabelStyle,
    LabelGraphics,
    PolylineGraphics,
    PolylineDashMaterialProperty,
    ClassificationType,
    SceneTransforms,
    Cartesian2,
    Entity as CesiumEntity,
} from "cesium";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { pluginManager } from "@/core/plugins/PluginManager";
import type { GeoEntity, CesiumEntityOptions } from "@/core/plugins/PluginTypes";

// Set Cesium Ion token
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_CESIUM_TOKEN) {
    Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
}

// Camera presets
const CAMERA_PRESETS: Record<string, { lat: number; lon: number; alt: number; heading: number; pitch: number }> = {
    global: { lat: 20, lon: 0, alt: 20000000, heading: 0, pitch: -90 },
    americas: { lat: 15, lon: -80, alt: 12000000, heading: 0, pitch: -80 },
    europe: { lat: 50, lon: 15, alt: 6000000, heading: 0, pitch: -75 },
    mena: { lat: 28, lon: 42, alt: 6000000, heading: 0, pitch: -75 },
    asiaPacific: { lat: 30, lon: 105, alt: 10000000, heading: 0, pitch: -80 },
    africa: { lat: 2, lon: 22, alt: 8000000, heading: 0, pitch: -80 },
    oceania: { lat: -25, lon: 140, alt: 7000000, heading: 0, pitch: -75 },
    arctic: { lat: 80, lon: 0, alt: 6000000, heading: 0, pitch: -85 },
};

function getEntityColor(entity: GeoEntity, options: CesiumEntityOptions): Color {
    if (options.color) {
        return Color.fromCssColorString(options.color);
    }
    return Color.CYAN;
}


export default function GlobeView() {
    const viewerRef = useRef<CesiumViewer | null>(null);
    const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
    const hoveredEntityIdRef = useRef<string | null>(null);
    const [viewerReady, setViewerReady] = useState(false);
    const setSelectedEntity = useStore((s) => s.setSelectedEntity);
    const setHoveredEntity = useStore((s) => s.setHoveredEntity);
    const selectedEntity = useStore((s) => s.selectedEntity);
    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);
    const layers = useStore((s) => s.layers);
    const showLabels = useStore((s) => s.mapConfig.showLabels);
    const showFps = useStore((s) => s.mapConfig.showFps);
    const resolutionScale = useStore((s) => s.mapConfig.resolutionScale);
    const msaaSamples = useStore((s) => s.mapConfig.msaaSamples);
    const enableFxaa = useStore((s) => s.mapConfig.enableFxaa);
    const maxScreenSpaceError = useStore((s) => s.mapConfig.maxScreenSpaceError);
    const bordersDataSourceRef = useRef<import("cesium").GeoJsonDataSource | null>(null);
    const trailEntityRef = useRef<CesiumEntity | null>(null);


    const visibleEntities = useMemo(() => {
        const result: Array<{ entity: GeoEntity; options: CesiumEntityOptions }> = [];
        pluginManager.getAllPlugins().forEach((managed) => {
            if (!layers[managed.plugin.id]?.enabled) return;
            const entities = entitiesByPlugin[managed.plugin.id] || [];
            entities.forEach((entity) => {
                const options = managed.plugin.renderEntity(entity);
                result.push({ entity, options });
            });
        });
        return result;
    }, [layers, entitiesByPlugin]);

    // Fly to camera preset
    const flyToPreset = useCallback((presetId: string) => {
        const preset = CAMERA_PRESETS[presetId];
        if (!preset || !viewerRef.current) return;
        viewerRef.current.camera.flyTo({
            destination: Cartesian3.fromDegrees(preset.lon, preset.lat, preset.alt),
            orientation: {
                heading: CesiumMath.toRadians(preset.heading),
                pitch: CesiumMath.toRadians(preset.pitch),
                roll: 0,
            },
            duration: 2.5,
        });
    }, []);

    // Listen for camera preset events
    useEffect(() => {
        const unsub = dataBus.on("cameraPreset", ({ presetId }) => {
            flyToPreset(presetId);
        });
        return unsub;
    }, [flyToPreset]);

    // Handle camera position changes from store
    const cameraLat = useStore((s) => s.cameraLat);
    const cameraLon = useStore((s) => s.cameraLon);
    const cameraAlt = useStore((s) => s.cameraAlt);
    const cameraHeading = useStore((s) => s.cameraHeading);
    const cameraPitch = useStore((s) => s.cameraPitch);

    useEffect(() => {
        if (!viewerRef.current) return;

        // Use flyTo for smooth movement
        viewerRef.current.camera.flyTo({
            destination: Cartesian3.fromDegrees(cameraLon, cameraLat, cameraAlt),
            orientation: {
                heading: CesiumMath.toRadians(cameraHeading),
                pitch: CesiumMath.toRadians(cameraPitch),
                roll: 0,
            },
            duration: 2.0,
        });
    }, [cameraLat, cameraLon, cameraAlt, cameraHeading, cameraPitch]);

    // Set up click handler for entity selection
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const canvas = viewer.scene.canvas;

        // Helper to find entity under the cursor using native picking
        const findEntityAtPosition = (position: { x: number; y: number }) => {
            const picked = viewer.scene.pick(position as import("cesium").Cartesian2);
            if (defined(picked) && picked.id && picked.id._wwvEntity) {
                return picked.id._wwvEntity as GeoEntity;
            }
            return null;
        };

        handlerRef.current = new ScreenSpaceEventHandler(canvas);
        handlerRef.current.setInputAction(
            (event: { position: { x: number; y: number } }) => {
                const entity = findEntityAtPosition(event.position);
                setSelectedEntity(entity);
                // Clear hover when clicking (selection takes over)
                if (entity) {
                    setHoveredEntity(null, null);
                    hoveredEntityIdRef.current = null;
                }
            },
            ScreenSpaceEventType.LEFT_CLICK
        );

        let moveRafId: number | null = null;
        handlerRef.current.setInputAction(
            (event: { endPosition: { x: number; y: number } }) => {
                if (moveRafId !== null) return;

                // Debounce rapid mouse moves to screen refresh rate
                moveRafId = requestAnimationFrame(() => {
                    const entity = findEntityAtPosition(event.endPosition);
                    const prevId = hoveredEntityIdRef.current;
                    const newId = entity ? entity.id : null;

                    // Only update store when hover target actually changes
                    if (prevId !== newId) {
                        hoveredEntityIdRef.current = newId;
                        canvas.style.cursor = entity ? "pointer" : "default";
                        setHoveredEntity(
                            entity,
                            entity ? { x: event.endPosition.x, y: event.endPosition.y } : null
                        );
                    } else if (entity) {
                        // Same entity, just update screen position for tooltip tracking
                        useStore.setState({
                            hoveredScreenPosition: { x: event.endPosition.x, y: event.endPosition.y },
                        });
                    }
                    moveRafId = null;
                });
            },
            ScreenSpaceEventType.MOUSE_MOVE
        );

        return () => {
            handlerRef.current?.destroy();
            canvas.style.cursor = "default";
        };
    }, [setSelectedEntity, setHoveredEntity]);

    // Handle Labels & Custom Borders Layer
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        // Ensure globe stays hidden (we only need it for draping if required)
        viewer.scene.globe.show = false;

        if (showLabels) {
            // Load custom border GeoJSON (once)
            if (!bordersDataSourceRef.current) {
                GeoJsonDataSource.load('/borders.geojson', {
                    clampToGround: true,
                    stroke: Color.CYAN.withAlpha(0.6),
                    strokeWidth: 1.5,
                    fill: Color.TRANSPARENT,
                }).then((ds) => {
                    const viewer = viewerRef.current;
                    if (!viewer) return;

                    // Iterate and add labels to the center of the entities
                    const entities = ds.entities.values;
                    for (let i = 0; i < entities.length; i++) {
                        const entity = entities[i];
                        if (entity.name && entity.polygon) {
                            const hierarchy = entity.polygon.hierarchy?.getValue(JulianDate.now());

                            if (hierarchy) {
                                const positions = hierarchy.positions;
                                if (positions && positions.length > 0) {
                                    // 1. Label
                                    const center = BoundingSphere.fromPoints(positions).center;
                                    const cartographic = Cartographic.fromCartesian(center);
                                    // We elevate it slightly, but really we rely on disableDepthTestDistance
                                    cartographic.height = 1000;

                                    entity.position = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height) as any;
                                    entity.label = new LabelGraphics({
                                        text: entity.name,
                                        font: "bold 14px Inter, sans-serif",
                                        fillColor: Color.WHITE,
                                        outlineColor: Color.BLACK.withAlpha(0.8),
                                        outlineWidth: 3,
                                        style: LabelStyle.FILL_AND_OUTLINE,
                                        verticalOrigin: VerticalOrigin.CENTER,
                                        horizontalOrigin: HorizontalOrigin.CENTER,
                                        distanceDisplayCondition: new DistanceDisplayCondition(10.0, 8000000.0),
                                        scaleByDistance: new NearFarScalar(1.5e6, 1.2, 8e6, 0.0),
                                        disableDepthTestDistance: Number.POSITIVE_INFINITY, // Ensure it shows through 3D tiles
                                    });

                                    // 2. Borders
                                    // Polygons don't show outlines well when clamped, so we construct a Polyline
                                    entity.polyline = new PolylineGraphics({
                                        positions: [...positions, positions[0]], // Close the loop
                                        width: 1.5,
                                        material: Color.CYAN.withAlpha(0.5),
                                        clampToGround: true,
                                        classificationType: ClassificationType.BOTH, // Drape on 3D tiles and terrain
                                    });
                                    // Hide original polygon
                                    entity.polygon.show = false as any;
                                }
                            }
                        }
                    }

                    bordersDataSourceRef.current = ds;
                    viewer.dataSources.add(ds);
                }).catch((err) => {
                    console.warn('[GlobeView] Failed to load borders GeoJSON', err);
                });
            } else if (!viewer.dataSources.contains(bordersDataSourceRef.current)) {
                viewer.dataSources.add(bordersDataSourceRef.current);
            }
        } else {
            // Remove border data source
            if (bordersDataSourceRef.current && viewer.dataSources.contains(bordersDataSourceRef.current)) {
                viewer.dataSources.remove(bordersDataSourceRef.current, false);
            }
        }
    }, [showLabels]);

    // Init Google 3D tiles
    const handleViewerReady = useCallback(async (viewer: CesiumViewer) => {
        viewerRef.current = viewer;

        // Performance optimizations
        viewer.scene.requestRenderMode = false;
        viewer.scene.maximumRenderTimeChange = Infinity;
        viewer.scene.debugShowFramesPerSecond = showFps;
        viewer.resolutionScale = resolutionScale;
        viewer.scene.msaaSamples = msaaSamples;
        viewer.scene.postProcessStages.fxaa.enabled = enableFxaa;

        // Remove default imagery/terrain
        viewer.scene.globe.show = false;

        // Add Google Photorealistic 3D Tiles
        try {
            const tileset = await createGooglePhotorealistic3DTileset({
                key: process.env.GOOGLE_MAPS_API_KEY || undefined,
            });
            tileset.maximumScreenSpaceError = maxScreenSpaceError;
            viewer.scene.primitives.add(tileset);
        } catch (err) {
            console.warn("[GlobeView] Failed to load Google 3D Tiles, falling back to default globe:", err);
            viewer.scene.globe.show = true;
        }

        // Initialize empty collections on the viewer for reuse
        (viewer as any)._wwvPoints = viewer.scene.primitives.add(new PointPrimitiveCollection());
        (viewer as any)._wwvBillboards = viewer.scene.primitives.add(new BillboardCollection());
        (viewer as any)._wwvLabels = viewer.scene.primitives.add(new LabelCollection());

        // Set initial camera position
        viewer.camera.setView({
            destination: Cartesian3.fromDegrees(0, 20, 20000000),
        });

        // Signal that the viewer is ready — this triggers the rendering effect
        setViewerReady(true);
    }, []);

    // Native Cesium Rendering for Entities
    // NOTE: viewerReady is in deps so this effect re-runs once the viewer initialises,
    // ensuring entities that loaded before the viewer was ready get rendered.
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        const points = (viewer as any)._wwvPoints as import("cesium").PointPrimitiveCollection;
        const billboards = (viewer as any)._wwvBillboards as import("cesium").BillboardCollection;
        const labels = (viewer as any)._wwvLabels as import("cesium").LabelCollection;

        if (!points || !billboards || !labels) return;

        points.removeAll();
        billboards.removeAll();
        labels.removeAll();

        const animatables: Array<{
            primitive: any;
            labelPrimitive?: any;
            entity: GeoEntity;
            posRef: import("cesium").Cartesian3;
            options: CesiumEntityOptions;
        }> = [];

        for (const { entity, options } of visibleEntities) {
            const position = Cartesian3.fromDegrees(
                entity.longitude,
                entity.latitude,
                entity.altitude || 0
            );
            const color = getEntityColor(entity, options);
            const clickId = { _wwvEntity: entity };

            let addedPrimitive: any;

            if (options.type === "billboard" && options.iconUrl) {
                addedPrimitive = billboards.add({
                    position,
                    image: options.iconUrl,
                    scale: 0.5,
                    verticalOrigin: VerticalOrigin.CENTER,
                    horizontalOrigin: HorizontalOrigin.CENTER,
                    rotation: options.rotation
                        ? -CesiumMath.toRadians(options.rotation)
                        : 0,
                    color,
                    scaleByDistance: new NearFarScalar(1e3, 1.0, 1e7, 0.3),
                    id: clickId,
                });
            } else {
                addedPrimitive = points.add({
                    position,
                    pixelSize: options.size || 6,
                    color,
                    outlineColor: options.outlineColor
                        ? Color.fromCssColorString(options.outlineColor)
                        : Color.BLACK,
                    outlineWidth: options.outlineWidth || 1,
                    scaleByDistance: new NearFarScalar(1e3, 1.0, 1e7, 0.4),
                    id: clickId,
                });
            }

            let addedLabel: any;
            if (options.labelText) {
                addedLabel = labels.add({
                    position,
                    text: options.labelText,
                    font: options.labelFont || "12px Inter, sans-serif",
                    fillColor: Color.WHITE,
                    outlineColor: Color.BLACK,
                    outlineWidth: 2,
                    verticalOrigin: VerticalOrigin.BOTTOM,
                    pixelOffset: { x: 0, y: -12 } as any,
                    show: false, // Default to hidden, visibility managed in updatePositions loop
                    id: clickId,
                });
            }

            animatables.push({
                primitive: addedPrimitive,
                labelPrimitive: addedLabel,
                entity,
                posRef: position,
                options,
            });
        }


        // --- Animation Loop ---
        const updatePositions = () => {
            if (!viewerRef.current) return;
            const state = useStore.getState();
            // Use current time from timeline if in playback, or clock time if live (to prevent stuttering)
            const nowMs = state.isPlaybackMode ? state.currentTime.getTime() : Date.now();

            const cam = viewerRef.current.camera;
            const camPos = cam.positionWC;
            const R_WGS84_MIN = 6356752.0; // Safe underestimate for occlusion
            const R2 = R_WGS84_MIN * R_WGS84_MIN;

            // Throttling: only update all entities every N frames for general movement
            // but update selected/hovered every frame.
            const frameCount = (viewer as any)._wwvFrameCount || 0;
            (viewer as any)._wwvFrameCount = frameCount + 1;
            const isFullUpdate = frameCount % 2 === 0; // Update movement every 2nd frame

            // Camera distance from the center of the earth squared
            const camDistSqr = Cartesian3.magnitudeSquared(camPos);

            // If camera is inside the earth (e.g. debugging/errors), don't cull
            if (camDistSqr <= R2) return;

            // Distance from camera to the horizon purely mathematically
            const Dh = Math.sqrt(camDistSqr - R2);

            for (let i = 0; i < animatables.length; i++) {
                const item = animatables[i];
                const { primitive, labelPrimitive, entity, posRef } = item;

                const isSelected = state.selectedEntity && state.selectedEntity.id === entity.id;
                const isHovered = hoveredEntityIdRef.current === entity.id;

                // --- Position Extrapolation ---
                if (entity.timestamp && entity.speed !== undefined && entity.heading !== undefined) {
                    // Only calculate movement if it's a full update frame OR if the entity is interactive
                    if (isFullUpdate || isSelected || isHovered) {
                        // Calculate time difference in seconds.
                        const dtSec = (nowMs - entity.timestamp.getTime()) / 1000;

                        // Allow extrapolation up to 5 minutes forward or backward
                        if (Math.abs(dtSec) <= 300) {
                            // Pre-calculate the Cartesian3 velocity vector ONLY ONCE and cache it on the item
                            if (!(item as any).velocityVector) {
                                const speedMps = entity.speed;
                                const headingRad = CesiumMath.toRadians(entity.heading);

                                // Get a unit vector pointing North at the entity's position
                                const surfaceNormal = Ellipsoid.WGS84.geodeticSurfaceNormal(posRef);
                                const northPole = new Cartesian3(0, 0, 1);
                                let northDir = new Cartesian3();
                                // If the entity is exactly at the north pole, this cross product approaches 0.
                                // We handle this by picking an arbitrary tangent if needed, 
                                // but generally airplanes aren't at lat 90.0000.
                                Cartesian3.cross(northPole, surfaceNormal, northDir); // Points East
                                Cartesian3.cross(surfaceNormal, northDir, northDir);  // Points North
                                Cartesian3.normalize(northDir, northDir);

                                // Get a unit vector pointing East
                                let eastDir = new Cartesian3();
                                Cartesian3.cross(northDir, surfaceNormal, eastDir); // Points East
                                Cartesian3.normalize(eastDir, eastDir);

                                // Combine North and East based on heading to get the final velocity vector
                                // A heading of 0 means North (cos(0)=1, sin(0)=0). Heading 90 means East.
                                const northComp = Math.cos(headingRad);
                                const eastComp = Math.sin(headingRad);

                                const velocityVector = new Cartesian3();
                                Cartesian3.multiplyByScalar(northDir, northComp, velocityVector);
                                let tempEast = new Cartesian3();
                                Cartesian3.multiplyByScalar(eastDir, eastComp, tempEast);
                                Cartesian3.add(velocityVector, tempEast, velocityVector);

                                // Scale by speed (meters per second)
                                Cartesian3.multiplyByScalar(velocityVector, speedMps, velocityVector);

                                // Cache the original calculated position to add the vector onto
                                (item as any).basePosition = Cartesian3.clone(posRef);
                                (item as any).velocityVector = velocityVector;
                            }

                            // Apply the cached velocity vector (simple vector addition, NO TRIGONOMETRY)
                            const vel = (item as any).velocityVector as import("cesium").Cartesian3;
                            const basePos = (item as any).basePosition as import("cesium").Cartesian3;

                            // We use a scratch Cartesian3 if needed, but we can do it inline by modifying posRef
                            const displacement = new Cartesian3();
                            Cartesian3.multiplyByScalar(vel, dtSec, displacement);
                            Cartesian3.add(basePos, displacement, posRef);

                            // Note: For long distances (>100s of km), moving via a linear 3D tangent vector 
                            // will cause the plane to "fly off" the curved earth into space.
                            // However, since we only extrapolate for max 5 mins at typical plane speeds (~250m/s),
                            // the max linear distance is ~75km. Over 75km, the Earth's curvature drop is ~440 meters.
                            // This visual error is negligible at global zoom levels and barely noticeable at low zoom.
                            // The performance gain of skipping 10,000 trig calls 60x a second is worth the slight altitude delta.

                            primitive.position = posRef;
                            if (labelPrimitive) {
                                labelPrimitive.position = posRef;
                            }
                        }
                    }
                }

                // --- Horizon Culling ---
                // The max line-of-sight distance without hitting the Earth is Dh + Dph.
                const posDistSqr = Cartesian3.magnitudeSquared(posRef);
                const Dph = Math.sqrt(Math.max(0, posDistSqr - R2));
                const distanceToPoint = Cartesian3.distance(camPos, posRef);

                const isVisible = distanceToPoint <= (Dh + Dph);
                primitive.show = isVisible;

                // --- Highlight ---

                if (isSelected) {
                    // Selected: bright cyan with glow effect
                    primitive.color = Color.fromCssColorString('#00fff7');
                    if (item.options.type === "billboard") {
                        primitive.scale = 0.7;
                    } else {
                        primitive.pixelSize = (item.options.size || 6) * 2.0;
                        primitive.outlineColor = Color.fromCssColorString('#00fff7');
                        primitive.outlineWidth = 3;
                    }
                } else if (isHovered) {
                    // Hovered: yellow highlight
                    primitive.color = Color.YELLOW;
                    if (item.options.type === "billboard") {
                        primitive.scale = 0.6;
                    } else {
                        primitive.pixelSize = (item.options.size || 6) * 1.5;
                        primitive.outlineColor = Color.YELLOW;
                        primitive.outlineWidth = 2;
                    }
                } else {
                    // Normal state
                    primitive.color = getEntityColor(entity, item.options);
                    if (item.options.type === "billboard") {
                        primitive.scale = 0.5;
                    } else {
                        primitive.pixelSize = item.options.size || 6;
                        primitive.outlineColor = item.options.outlineColor
                            ? Color.fromCssColorString(item.options.outlineColor)
                            : Color.BLACK;
                        primitive.outlineWidth = item.options.outlineWidth || 1;
                    }
                }

                if (labelPrimitive) {
                    let showLabel = false;
                    if (isVisible) {
                        if (distanceToPoint < 500000) { // Up close (500km)
                            showLabel = true;
                        } else if (isSelected || isHovered) {
                            showLabel = true;
                        }
                    }
                    labelPrimitive.show = showLabel;
                    // Make selected label more prominent
                    if (isSelected) {
                        labelPrimitive.fillColor = Color.fromCssColorString('#00fff7');
                    } else {
                        labelPrimitive.fillColor = Color.WHITE;
                    }
                }
            }
        };

        // Dynamic update of scene settings when store changes
        if (viewer) {
            viewer.scene.debugShowFramesPerSecond = showFps;
            viewer.resolutionScale = resolutionScale;
            viewer.scene.msaaSamples = msaaSamples;
            viewer.scene.postProcessStages.fxaa.enabled = enableFxaa;

            // Update tileset SSE if it exists
            const primitives = (viewer.scene.primitives as any);
            for (let i = 0; i < primitives.length; i++) {
                const p = primitives.get(i);
                if (p && p.maximumScreenSpaceError !== undefined) {
                    p.maximumScreenSpaceError = maxScreenSpaceError;
                }
            }
        }

        viewer.scene.preUpdate.addEventListener(updatePositions);

        return () => {
            if (viewer && !viewer.isDestroyed()) {
                viewer.scene.preUpdate.removeEventListener(updatePositions);
            }
        };
    }, [visibleEntities, viewerReady]);

    // ─── Fly-to on entity selection + trail ────────────────
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || !viewerReady) return;

        // Clean up previous trail
        if (trailEntityRef.current) {
            viewer.entities.remove(trailEntityRef.current);
            trailEntityRef.current = null;
        }

        if (!selectedEntity) return;

        // Look up selection behavior from the plugin (generic, no plugin-specific checks)
        const managed = pluginManager.getPlugin(selectedEntity.pluginId);
        const selectionBehavior = managed?.plugin.getSelectionBehavior?.(selectedEntity) ?? null;

        // Fly camera to the selected entity
        const entityAlt = selectedEntity.altitude || 0;
        const offsetMultiplier = selectionBehavior?.flyToOffsetMultiplier ?? 3;
        const baseDistance = selectionBehavior?.flyToBaseDistance ?? 30000;
        const viewDistance = Math.max(50000, entityAlt * offsetMultiplier + baseDistance);
        viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(
                selectedEntity.longitude,
                selectedEntity.latitude,
                entityAlt + viewDistance
            ),
            orientation: {
                heading: CesiumMath.toRadians(0),
                pitch: CesiumMath.toRadians(-45),
                roll: 0,
            },
            duration: 1.5,
        });

        // Render trail if the plugin opts in via getSelectionBehavior()
        if (selectionBehavior?.showTrail && selectedEntity.heading !== undefined) {
            const trailDuration = selectionBehavior.trailDurationSec ?? 60;
            const trailStep = selectionBehavior.trailStepSec ?? 5;
            const trailColor = selectionBehavior.trailColor ?? '#00fff7';

            const positions: Cartesian3[] = [];
            const speed = selectedEntity.speed || 200;
            const headingRad = CesiumMath.toRadians(selectedEntity.heading);

            // Create trail points going backward from current position
            for (let t = trailDuration; t >= 0; t -= trailStep) {
                const dist = speed * t;
                const dLat = -Math.cos(headingRad) * dist / 111320;
                const dLon = -Math.sin(headingRad) * dist / (111320 * Math.cos(CesiumMath.toRadians(selectedEntity.latitude)));
                positions.push(Cartesian3.fromDegrees(
                    selectedEntity.longitude + dLon,
                    selectedEntity.latitude + dLat,
                    entityAlt
                ));
            }

            trailEntityRef.current = viewer.entities.add({
                polyline: {
                    positions,
                    width: 2,
                    material: new PolylineDashMaterialProperty({
                        color: Color.fromCssColorString(trailColor).withAlpha(0.6),
                        dashLength: 16,
                    }),
                } as any,
            });
        }
    }, [selectedEntity, viewerReady]);

    return (
        <Viewer
            full
            ref={(e) => {
                if (e?.cesiumElement && !viewerRef.current) {
                    handleViewerReady(e.cesiumElement);
                }
            }}
            animation={false}
            baseLayerPicker={false}
            fullscreenButton={false}
            geocoder={false}
            homeButton={false}
            infoBox={false}
            navigationHelpButton={false}
            sceneModePicker={false}
            selectionIndicator={false}
            timeline={false}
            vrButton={false}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
    );
}
