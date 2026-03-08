import { Satellite } from "lucide-react";
import {
    twoline2satrec,
    propagate,
    gstime,
    eciToGeodetic,
    degreesLat,
    degreesLong,
} from "satellite.js";
import type { SatRec, EciVec3 } from "satellite.js";
import type {
    WorldPlugin,
    GeoEntity,
    TimeRange,
    PluginContext,
    LayerConfig,
    CesiumEntityOptions,
    SelectionBehavior,
    ServerPluginConfig,
    FilterDefinition,
} from "@/core/plugins/PluginTypes";

/**
 * Satellites Plugin - Real-time orbital tracking
 * 
 * Data source: CelesTrak TLE (Two-Line Element) data
 * https://celestrak.org/
 * 
 * Features:
 * - Live satellite position calculation from TLE
 * - Orbit path visualization (full orbital trajectory)
 * - Ground track visualization (projected path on Earth surface)
 * - Real-time propagation using SGP4 algorithm
 * - Multiple satellite groups (stations, Starlink, weather, GPS)
 * 
 * Technical:
 * - Uses satellite.js for SGP4 orbital propagation
 * - Renders satellite markers using normal point rendering
 * - Renders orbits/tracks using generic polyline rendering (no plugin-specific hacks)
 * - Positions calculated every fetch interval for smooth animation
 */

interface TLERecord {
    name: string;
    line1: string;
    line2: string;
    group: string;
}

interface SatelliteAPIResponse {
    tles: TLERecord[];
    timestamp: string;
    source: string;
    groups: string[];
}

/**
 * Get color for satellite group
 */
function groupToColor(group: string): string {
    switch (group) {
        case "stations":
            return "#22d3ee"; // cyan — space stations (ISS, etc.)
        case "starlink":
            return "#a78bfa"; // purple — Starlink constellation
        case "weather":
            return "#f59e0b"; // amber — weather satellites
        case "gps-ops":
            return "#22c55e"; // green — GPS satellites
        default:
            return "#94a3b8"; // gray — unknown
    }
}

/**
 * Calculate satellite position from TLE at given time
 * Returns null if calculation fails
 */
function calculateSatellitePosition(
    satrec: SatRec,
    date: Date
): { latitude: number; longitude: number; altitude: number } | null {
    try {
        const positionAndVelocity = propagate(satrec, date);
        
        // Check if propagation failed
        if (!positionAndVelocity || typeof positionAndVelocity.position === "boolean") {
            // Propagation failed
            return null;
        }

        const positionEci = positionAndVelocity.position as EciVec3<number>;
        
        // Convert ECI to geodetic coordinates
        const gmst = gstime(date);
        const positionGd = eciToGeodetic(positionEci, gmst);
        
        return {
            latitude: degreesLat(positionGd.latitude),
            longitude: degreesLong(positionGd.longitude),
            altitude: positionGd.height * 1000, // km to meters
        };
    } catch (err) {
        console.warn("[Satellites] Position calculation error:", err);
        return null;
    }
}

/**
 * Calculate orbital period in minutes from TLE
 */
function calculateOrbitalPeriod(satrec: SatRec): number {
    // Mean motion (satrec.no) is in radians per minute
    // Orbital period in minutes = 2π / mean_motion
    const meanMotion = satrec.no; // radians per minute
    const periodMinutes = (2 * Math.PI) / meanMotion;
    const periodSeconds = periodMinutes * 60;
    return periodSeconds; // Return period in seconds
}

/**
 * Generate orbit path positions (one full orbit)
 * Returns array of positions sampling the orbit
 * Orbit is centered around the reference time for visual stability
 */
function generateOrbitPath(
    satrec: SatRec,
    startDate: Date,
    samples: number = 90 // 90 points for smooth orbit
): Array<{ latitude: number; longitude: number; altitude: number }> {
    const positions: Array<{ latitude: number; longitude: number; altitude: number }> = [];
    const periodSeconds = calculateOrbitalPeriod(satrec);
    
    // Center the orbit around the reference time for better visual representation
    // Start from half a period before, end half a period after
    const startOffset = -periodSeconds / 2;
    const stepSeconds = periodSeconds / samples;
    
    for (let i = 0; i < samples; i++) {
        const offsetSeconds = startOffset + i * stepSeconds;
        const date = new Date(startDate.getTime() + offsetSeconds * 1000);
        const pos = calculateSatellitePosition(satrec, date);
        if (pos) {
            positions.push(pos);
        }
    }
    
    // Close the orbit by adding the first position again
    if (positions.length > 0) {
        positions.push(positions[0]);
    }
    
    return positions;
}

/**
 * Generate ground track positions (projected path on Earth surface)
 * Returns array of surface-level positions
 * Ground track is centered around the reference time for visual stability
 */
function generateGroundTrack(
    satrec: SatRec,
    startDate: Date,
    samples: number = 90
): Array<{ latitude: number; longitude: number; altitude: number }> {
    const positions: Array<{ latitude: number; longitude: number; altitude: number }> = [];
    const periodSeconds = calculateOrbitalPeriod(satrec);
    
    // Center the ground track around the reference time
    // Start from half a period before, end half a period after
    const startOffset = -periodSeconds / 2;
    const stepSeconds = periodSeconds / samples;
    
    for (let i = 0; i < samples; i++) {
        const offsetSeconds = startOffset + i * stepSeconds;
        const date = new Date(startDate.getTime() + offsetSeconds * 1000);
        const pos = calculateSatellitePosition(satrec, date);
        if (pos) {
            positions.push({
                latitude: pos.latitude,
                longitude: pos.longitude,
                altitude: 0, // Ground level
            });
        }
    }
    
    return positions;
}

export class SatellitesPlugin implements WorldPlugin {
    id = "satellites";
    name = "Satellites";
    description = "Live orbital tracking from CelesTrak TLE data";
    icon = Satellite;
    category = "infrastructure" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;
    private tleCache: Map<string, { satrec: SatRec; tle: TLERecord }> = new Map();

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
        console.log("[SatellitesPlugin] Initialized");
    }

    destroy(): void {
        this.context = null;
        this.tleCache.clear();
        console.log("[SatellitesPlugin] Destroyed");
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const res = await fetch("/api/satellites");

            if (!res.ok) {
                console.error(`[SatellitesPlugin] API returned ${res.status}: ${res.statusText}`);
                return [];
            }

            const data: SatelliteAPIResponse = await res.json();

            if (!data.tles || !Array.isArray(data.tles)) {
                return [];
            }
            
            if (data.tles.length === 0) {
                return [];
            }

            const now = new Date();
            const entities: GeoEntity[] = [];

            // Process each TLE
            for (const tle of data.tles) {
                try {
                    // Parse TLE
                    const satrec = twoline2satrec(tle.line1, tle.line2);
                    
                    // Cache the TLE for orbit/ground track generation
                    const satId = `satellite-${tle.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
                    this.tleCache.set(satId, { satrec, tle });
                    
                    // Calculate current position from TLE
                    const positionAndVelocity = propagate(satrec, now);
                    if (!positionAndVelocity || typeof positionAndVelocity.position === "boolean") {
                        continue;
                    }

                    const positionEci = positionAndVelocity.position as EciVec3<number>;
                    
                    // Convert ECI to geodetic coordinates
                    const gmst = gstime(now);
                    const positionGd = eciToGeodetic(positionEci, gmst);
                    
                    const position = {
                        latitude: degreesLat(positionGd.latitude),
                        longitude: degreesLong(positionGd.longitude),
                        altitude: positionGd.height * 1000, // km to meters
                    };

                    // Extract NORAD catalog number from line 1
                    const noradId = tle.line1.substring(2, 7).trim();

                    // Create satellite marker entity
                    // Orbital propagation is handled by getDynamicPosition() for smooth per-frame motion
                    entities.push({
                        id: satId,
                        pluginId: "satellites",
                        latitude: position.latitude,
                        longitude: position.longitude,
                        altitude: position.altitude,
                        timestamp: now,
                        label: tle.name.length > 20 ? tle.name.substring(0, 20) + "..." : tle.name,
                        properties: {
                            name: tle.name,
                            noradId,
                            group: tle.group,
                            source: "CelesTrak",
                            altitudeKm: Math.round(position.altitude / 1000),
                            orbitalPeriod: Math.round(calculateOrbitalPeriod(satrec)),
                            // Store TLE lines for continuous orbital propagation via getDynamicPosition()
                            tleLine1: tle.line1,
                            tleLine2: tle.line2,
                        },
                    });
                } catch (err) {
                    // Ignore individual satellite errors
                }
            }

            console.log(`[SatellitesPlugin] Fetched ${entities.length} satellite positions`);
            return entities;
        } catch (err) {
            console.error("[SatellitesPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        // Update TLE data every 6 hours
        // Satellites now use per-frame orbital propagation, so we don't need frequent polling
        // TLE data itself doesn't change rapidly - updates every few hours are sufficient
        // Note: API has 30-minute cache, actual TLE updates happen when cache expires
        return 6 * 60 * 60 * 1000; // 6 hours
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#22d3ee", // Default cyan for satellites
            clusterEnabled: false, // Don't cluster satellites (they're globally distributed)
            clusterDistance: 0,
            maxEntities: 2000, // Allow up to 2000 satellites
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        // Check if this is a derived entity (orbit or ground track)
        const renderType = entity.properties.renderType as string | undefined;
        
        if (renderType === "orbit") {
            return this.renderOrbitPath(entity);
        }
        
        if (renderType === "groundtrack") {
            return this.renderGroundTrack(entity);
        }
        
        // Normal satellite marker rendering
        const group = entity.properties.group as string;
        const altitudeKm = entity.properties.altitudeKm as number;
        const satelliteName = entity.properties.name as string; // Use full name from properties
        
        // Color based on satellite group
        const color = groupToColor(group);
        
        // Size based on orbital altitude for visual hierarchy
        // LEO satellites (< 1000 km): largest, closest to earth
        // MEO satellites (1000-20000 km): medium size
        // GEO satellites (> 20000 km): smaller, very distant
        let size = altitudeKm > 20000 ? 32 : altitudeKm > 1000 ? 36 : 40;
        
        // ISS HIGHLIGHT: Make ISS significantly larger and more prominent
        // Detect ISS via common naming patterns: "ISS", "ISS (ZARYA)", "ZARYA"
        const isISS = satelliteName && (
            satelliteName.toUpperCase().includes("ISS") || 
            satelliteName.toUpperCase().includes("ZARYA")
        );
        if (isISS) {
            size = 56; // Much larger than other satellites for visibility
        }
        
        return {
            type: "billboard", // Use billboard for recognizable satellite icon
            iconUrl: "/satellite-icon.svg",
            color, // Tint the icon based on group
            size, // Altitude-aware sizing (32-40px), ISS: 56px
            labelText: isISS ? "ISS" : entity.label, // Clear "ISS" label for ISS
            labelFont: "9px JetBrains Mono, monospace",
            labelColor: color, // Match label color to satellite group
            distanceDisplayCondition: { near: 10, far: 50_000_000 }, // Visible up to 50,000km
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        // When a satellite is selected, show orbit and ground track via getSelectionDerivedEntities()
        // No trail needed here
        return null;
    }

    /**
     * Generic method: Return additional entities to render when a satellite is selected.
     * This is called by GlobeView generically for any selected entity.
     * 
     * Returns orbit path and ground track entities that will be rendered via renderEntity().
     */
    getSelectionDerivedEntities(entity: GeoEntity): GeoEntity[] {
        const derived: GeoEntity[] = [];
        
        // Generate orbit path entity
        const orbitEntity = this.createOrbitPathEntity(entity);
        if (orbitEntity) {
            derived.push(orbitEntity);
        }
        
        // Generate ground track entity
        const groundTrackEntity = this.createGroundTrackEntity(entity);
        if (groundTrackEntity) {
            derived.push(groundTrackEntity);
        }
        
        return derived;
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/satellites",
            pollingIntervalMs: 2 * 60 * 1000, // 2 minutes
            requiresAuth: false,
            historyEnabled: false,
            availabilityEnabled: false,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "group",
                label: "Satellite Group",
                type: "select",
                propertyKey: "group",
                options: [
                    { value: "stations", label: "Space Stations" },
                    { value: "starlink", label: "Starlink" },
                    { value: "weather", label: "Weather" },
                    { value: "gps-ops", label: "GPS" },
                ],
            },
            {
                id: "altitudeKm",
                label: "Altitude (km)",
                type: "range",
                propertyKey: "altitudeKm",
                range: { min: 0, max: 40000, step: 1000 },
            },
        ];
    }

    /**
     * Create orbit path entity for a selected satellite
     * Returns a derived GeoEntity with renderType: "orbit"
     */
    private createOrbitPathEntity(entity: GeoEntity): GeoEntity | null {
        const cached = this.tleCache.get(entity.id);
        if (!cached) return null;

        // Use the satellite's current timestamp as orbit calculation basis
        // This ensures the orbit remains stable when re-rendered
        const referenceTime = entity.timestamp ? new Date(entity.timestamp) : new Date();
        const positions = generateOrbitPath(cached.satrec, referenceTime);
        if (positions.length === 0) return null;

        return {
            id: `${entity.id}-orbit`,
            pluginId: "satellites",
            latitude: entity.latitude,
            longitude: entity.longitude,
            altitude: entity.altitude,
            timestamp: entity.timestamp,
            properties: {
                ...entity.properties,
                renderType: "orbit",
                orbitPositions: positions,
            },
        };
    }

    /**
     * Create ground track entity for a selected satellite
     * Returns a derived GeoEntity with renderType: "groundtrack"
     */
    private createGroundTrackEntity(entity: GeoEntity): GeoEntity | null {
        const cached = this.tleCache.get(entity.id);
        if (!cached) return null;

        // Use the satellite's current timestamp as ground track calculation basis
        // This ensures the ground track remains stable when re-rendered
        const referenceTime = entity.timestamp ? new Date(entity.timestamp) : new Date();
        const positions = generateGroundTrack(cached.satrec, referenceTime);
        if (positions.length === 0) return null;

        return {
            id: `${entity.id}-groundtrack`,
            pluginId: "satellites",
            latitude: entity.latitude,
            longitude: entity.longitude,
            altitude: 0,
            timestamp: entity.timestamp,
            properties: {
                ...entity.properties,
                renderType: "groundtrack",
                groundTrackPositions: positions,
            },
        };
    }

    /**
     * Render orbit path polyline
     * Called by renderEntity() when renderType === "orbit"
     */
    private renderOrbitPath(entity: GeoEntity): CesiumEntityOptions {
        const positions = entity.properties.orbitPositions as Array<{ latitude: number; longitude: number; altitude: number }>;
        if (!positions || positions.length === 0) {
            console.warn(`[SatellitesPlugin] No orbit positions for ${entity.id}`);
            return { type: "point", color: "#ff0000", size: 1 }; // Fallback
        }

        const group = entity.properties.group as string;
        const color = groupToColor(group);

        // Return positions as lat/lon/alt objects - PolylineEntityManager will convert to Cartesian3
        return {
            type: "polyline",
            positions, // Send raw position objects, not Cartesian3
            width: 2,
            color,
            opacity: 0.6,
            dashed: false,
            clampToGround: false,
            distanceDisplayCondition: { near: 0, far: 100_000_000 }, // Show orbit up to 100,000km
        };
    }

    /**
     * Render ground track polyline
     * Called by renderEntity() when renderType === "groundtrack"
     */
    private renderGroundTrack(entity: GeoEntity): CesiumEntityOptions {
        const positions = entity.properties.groundTrackPositions as Array<{ latitude: number; longitude: number; altitude: number }>;
        if (!positions || positions.length === 0) {
            console.warn(`[SatellitesPlugin] No ground track positions for ${entity.id}`);
            return { type: "point", color: "#ff0000", size: 1 }; // Fallback
        }

        const group = entity.properties.group as string;
        const color = groupToColor(group);

        // Return positions as lat/lon/alt objects - PolylineEntityManager will convert to Cartesian3
        return {
            type: "polyline",
            positions, // Send raw position objects, not Cartesian3
            width: 2,
            color,
            opacity: 0.7,
            dashed: true,
            dashLength: 16,
            clampToGround: true,
            distanceDisplayCondition: { near: 0, far: 50_000_000 }, // Show ground track up to 50,000km
        };
    }

    /**
     * Compute dynamic satellite position using orbital propagation.
     * Called by AnimationLoop every frame for smooth orbital motion.
     */
    getDynamicPosition(entity: GeoEntity, time: Date): { latitude: number; longitude: number; altitude: number } | undefined {
        // Extract TLE lines from entity properties
        const tleLine1 = entity.properties.tleLine1 as string | undefined;
        const tleLine2 = entity.properties.tleLine2 as string | undefined;
        
        if (!tleLine1 || !tleLine2) {
            // No TLE data, fallback to static position
            return undefined;
        }
        
        // Try to get cached satrec from tleCache
        let satrec = this.tleCache.get(entity.id)?.satrec;
        
        // If not cached, parse TLE now and cache it
        if (!satrec) {
            try {
                satrec = twoline2satrec(tleLine1, tleLine2);
                const tle: TLERecord = {
                    name: entity.properties.name as string,
                    line1: tleLine1,
                    line2: tleLine2,
                    group: entity.properties.group as string,
                };
                this.tleCache.set(entity.id, { satrec, tle });
            } catch (err) {
                console.warn(`[SatellitesPlugin] Failed to parse TLE for ${entity.id}`, err);
                return undefined;
            }
        }
        
        // Propagate to current frame time
        try {
            const positionAndVelocity = propagate(satrec, time);
            if (!positionAndVelocity || typeof positionAndVelocity.position === "boolean") {
                return undefined;
            }
            
            const positionEci = positionAndVelocity.position as EciVec3<number>;
            
            // Convert ECI to geodetic coordinates
            const gmst = gstime(time);
            const positionGd = eciToGeodetic(positionEci, gmst);
            
            return {
                latitude: degreesLat(positionGd.latitude),
                longitude: degreesLong(positionGd.longitude),
                altitude: positionGd.height * 1000, // km to meters
            };
        } catch (err) {
            // Propagation failed (satellite might be too old or corrupt TLE)
            return undefined;
        }
    }
}
