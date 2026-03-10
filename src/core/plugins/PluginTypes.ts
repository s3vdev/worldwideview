import type { ComponentType } from "react";

// ─── Categories ──────────────────────────────────────────────
export type PluginCategory =
    | "aviation"
    | "maritime"
    | "conflict"
    | "natural-disaster"
    | "infrastructure"
    | "cyber"
    | "economic"
    | "custom";

// ─── Time ────────────────────────────────────────────────────
export interface TimeRange {
    start: Date;
    end: Date;
}

export type TimeWindow = "1h" | "6h" | "24h" | "48h" | "7d";

// ─── Geo Entities ────────────────────────────────────────────
export interface GeoEntity {
    id: string;
    pluginId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    timestamp: Date;
    label?: string;
    properties: Record<string, unknown>;
}

// ─── Layer Config ────────────────────────────────────────────
export interface LayerConfig {
    color: string;
    iconUrl?: string;
    clusterEnabled: boolean;
    clusterDistance: number;
    minZoomLevel?: number;
    maxEntities?: number;
}

// ─── Cesium Entity Options ───────────────────────────────────
export interface CesiumEntityOptions {
    type: "billboard" | "point" | "polyline" | "polygon" | "label" | "model" | "ellipse";
    color?: string;
    size?: number;
    iconUrl?: string;
    rotation?: number;
    outlineColor?: string;
    outlineWidth?: number;
    labelText?: string;
    labelFont?: string;
    /** Label text color (CSS color string) */
    labelColor?: string;
    distanceDisplayCondition?: { near: number; far: number };
    /** URL to a glTF/glb model (used when type is "model") */
    modelUrl?: string;
    /** Scale factor for the 3D model (default: 1.0) */
    modelScale?: number;
    /** Minimum pixel size for the model (prevents vanishing at distance) */
    modelMinPixelSize?: number;
    
    // ─── Ellipse Options (for type: "ellipse") ─────────────────
    /** Radius in meters for ellipse/circular area visualization */
    radiusMeters?: number;
    /** Semi-major axis in meters (if different from radiusMeters) */
    semiMajorAxis?: number;
    /** Semi-minor axis in meters (if different from radiusMeters) */
    semiMinorAxis?: number;
    /** Fill opacity (0.0 - 1.0) for area visualization */
    fillOpacity?: number;
    /** Whether to show outline/border */
    showOutline?: boolean;
    
    // ─── Polyline Options (for type: "polyline") ─────────────────
    /** Array of positions for the polyline path */
    positions?: Array<{ latitude: number; longitude: number; altitude?: number }>;
    /** Line width in pixels (default: 2) */
    width?: number;
    /** Whether to clamp polyline to ground (default: false) */
    clampToGround?: boolean;
    /** Opacity for polyline material (0.0 - 1.0, default: 1.0) */
    opacity?: number;
    /** Whether to use dashed line style (default: false) */
    dashed?: boolean;
    /** Dash length in pixels if dashed is true (default: 16) */
    dashLength?: number;
}

// ─── Selection Behavior ──────────────────────────────────────
export interface SelectionBehavior {
    /** Render a polyline trail behind the entity on selection */
    showTrail?: boolean;
    /** How far back the trail extends in seconds (default: 60) */
    trailDurationSec?: number;
    /** Trail step interval in seconds (default: 5) */
    trailStepSec?: number;
    /** CSS color string for the trail (default: '#00fff7') */
    trailColor?: string;
    /** Camera offset = altitude * this + base distance (default: 3) */
    flyToOffsetMultiplier?: number;
    /** Base camera distance in meters added to the offset (default: 30000) */
    flyToBaseDistance?: number;
}

// ─── Server Plugin Config ────────────────────────────────────
export interface ServerPluginConfig {
    /** Base path for this plugin's API routes, e.g. "/api/aviation" */
    apiBasePath: string;
    /** Server-side polling interval in ms */
    pollingIntervalMs: number;
    /** Whether the plugin requires authentication (OAuth/API keys) */
    requiresAuth?: boolean;
    /** Whether the plugin supports history/playback via a history endpoint */
    historyEnabled?: boolean;
    /** Whether the plugin reports data availability ranges */
    availabilityEnabled?: boolean;
}

// ─── Plugin Context ──────────────────────────────────────────
export interface PluginContext {
    apiBaseUrl: string;
    timeRange: TimeRange;
    onDataUpdate: (entities: GeoEntity[]) => void;
    onError: (error: Error) => void;
}

// ─── Filter Definitions ──────────────────────────────────────
export interface FilterSelectOption {
    value: string;
    label: string;
}

export interface FilterRangeConfig {
    min: number;
    max: number;
    step: number;
}

export interface FilterDefinition {
    id: string;
    label: string;
    type: "text" | "select" | "range" | "boolean";
    propertyKey: string;
    options?: FilterSelectOption[];
    range?: FilterRangeConfig;
}

export type FilterValue =
    | { type: "text"; value: string }
    | { type: "select"; values: string[] }
    | { type: "range"; min: number; max: number }
    | { type: "boolean"; value: boolean };

// ─── World Plugin Interface ──────────────────────────────────
export interface WorldPlugin {
    id: string;
    name: string;
    description: string;
    icon: string | ComponentType<{ size?: number; color?: string }>;
    category: PluginCategory;
    version: string;

    // Lifecycle
    initialize(ctx: PluginContext): Promise<void>;
    destroy(): void;

    // Data
    fetch(timeRange: TimeRange): Promise<GeoEntity[]>;
    getPollingInterval(): number; // ms

    // Rendering
    getLayerConfig(): LayerConfig;
    renderEntity(entity: GeoEntity): CesiumEntityOptions;

    // Optional: Selection behavior (trails, camera offsets)
    getSelectionBehavior?(entity: GeoEntity): SelectionBehavior | null;

    /**
     * Optional: Return additional entities to render when this entity is selected.
     * 
     * This is a generic mechanism for selection-based derived visualization.
     * The returned entities will be passed through renderEntity() automatically.
     * 
     * Examples:
     * - Satellite orbit path and ground track for selected satellite
     * - Flight path projection for selected aircraft
     * - Coverage area for selected radar
     * - Sensor cone for selected camera
     * 
     * The derived entities are automatically added to the visible entities
     * and removed when selection changes.
     * 
     * @param entity - The selected entity
     * @returns Array of additional GeoEntity objects to render, or empty array
     */
    getSelectionDerivedEntities?(entity: GeoEntity): GeoEntity[];

    /**
     * Optional: Compute dynamic position for entities with custom physics/movement.
     * 
     * This is a generic mechanism for frame-by-frame position updates using
     * plugin-specific physics or propagation models.
     * 
     * If this method is provided, the animation loop will call it every frame
     * to update the entity's position instead of using linear extrapolation.
     * 
     * Examples:
     * - Satellites: orbital propagation using TLE and SGP4/SDP4
     * - Ballistic missiles: trajectory computation
     * - Weather balloons: atmospheric model-based movement
     * - Drones: path following with wind compensation
     * 
     * The core renderer remains generic and does not need to know about
     * specific movement types or physics models.
     * 
     * @param entity - The entity to update
     * @param time - Current simulation time (Date object)
     * @returns Updated coordinates, or undefined to keep current position
     */
    getDynamicPosition?(entity: GeoEntity, time: Date): {
        latitude: number;
        longitude: number;
        altitude?: number;
    } | undefined;

    // Optional: Server-side data layer configuration
    getServerConfig?(): ServerPluginConfig;

    // Optional: Filter definitions for entity-level filtering
    getFilterDefinitions?(): FilterDefinition[];

    // Optional UI extensions
    getSidebarComponent?(): ComponentType;
    getDetailComponent?(): ComponentType<{ entity: GeoEntity }>;
    getSettingsComponent?(): ComponentType<{ pluginId: string }>;

    /**
     * Optional: Returns true if the plugin requires configuration (e.g. data source URL)
     * before it can be fully enabled.
     */
    requiresConfiguration?(settings: any): boolean;
}

// ─── Data Bus Event Types ────────────────────────────────────
export type DataBusEvents = {
    pluginRegistered: { pluginId: string; defaultInterval: number };
    dataUpdated: { pluginId: string; entities: GeoEntity[] };
    entitySelected: { entity: GeoEntity | null };
    layerToggled: { pluginId: string; enabled: boolean };
    timeRangeChanged: { timeRange: TimeRange };
    globeReady: Record<string, never>;
    cameraPreset: { presetId: string };
    cameraFaceTowards: { lat: number; lon: number; alt: number };
    cameraGoTo: { lat: number; lon: number; alt: number; distance?: number; maxPitch?: number; heading?: number };
};
