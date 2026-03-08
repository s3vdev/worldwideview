import { Plane } from "lucide-react";
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
import { useStore } from "@/core/state/store";

interface OpenSkyState {
    icao24: string;
    callsign: string | null;
    origin_country: string;
    time_position: number | null;
    last_contact: number;
    longitude: number | null;
    latitude: number | null;
    baro_altitude: number | null;
    on_ground: boolean;
    velocity: number | null;
    true_track: number | null;
    vertical_rate: number | null;
    sensors: number[] | null;
    geo_altitude: number | null;
    squawk: string | null;
    spi: boolean;
    position_source: number;
}

/**
 * Military Aircraft Detection
 * 
 * Detects military aircraft based on multiple heuristics:
 * 1. Military callsign patterns
 * 2. ICAO 24-bit address ranges reserved for military use
 * 3. Special squawk codes (7700, 7600, 7500)
 * 
 * This is a best-effort heuristic - not all military aircraft broadcast ADS-B,
 * and some may use civilian-looking identifiers for operational security.
 */

/**
 * Known military callsign prefixes
 * Sources: Military aviation databases, flight tracking communities
 */
const MILITARY_CALLSIGN_PREFIXES = [
    // US Military
    'RCH',    // US Air Force Reach (cargo/transport)
    'CNV',    // US Air Force Convoy
    'EVAL',   // US Air Force evaluation flights
    'SPAR',   // US Air Force Special Air Mission
    'VALOR',  // US Air Force
    'KNIFE',  // US special operations
    'HUNTR',  // US special operations
    'TORCH',  // US special operations
    'JACKAL', // US special operations
    'JOSA',   // Joint Special Operations Aviation
    'EVAC',   // Medical evacuation
    'MEDEVAC',// Medical evacuation
    'ARMY',   // US Army
    'NAVY',   // US Navy
    'USAF',   // US Air Force
    'USCG',   // US Coast Guard
    'TANKER', // US Air Force tankers
    'RACER',  // US training flights
    
    // NATO
    'NATO',   // NATO flights
    'LION',   // NATO
    'TIGER',  // NATO
    
    // UK Military
    'RRR',    // RAF flights
    'TARTAN', // RAF
    'ASCOT',  // RAF transport
    'TYPHOON',// RAF Typhoon fighters
    
    // French Military
    'COTAM',  // French Air Force transport
    'FAGOT',  // French military
    'CTM',    // French military transport
    
    // German Military
    'GAF',    // German Air Force (Luftwaffe)
    'GERMAN', // German military
    
    // Russian Military
    'RSD',    // Russian military
    'RFF',    // Russian Air Force
    
    // Other
    'FORTE',  // US Air Force RQ-4 Global Hawk surveillance
    'LAGR',   // US surveillance
    'JAKE',   // Various military
    'HOMER',  // Various military
    'VIPER',  // Various military
    'SNAKE',  // Various military
    'EAGLE',  // Various military
];

/**
 * ICAO 24-bit address ranges for military aircraft
 * Format: Hex ranges (start-end)
 * 
 * These ranges are allocated to military branches by aviation authorities.
 * Note: This is not exhaustive and some countries don't have clear ranges.
 */
const MILITARY_ICAO_RANGES = [
    // US Military ranges (AE prefix typically)
    { start: 0xAE0000, end: 0xAEFFFF, country: 'United States' },
    { start: 0xADF000, end: 0xADFFFF, country: 'United States' },
    
    // Note: More ranges can be added as data becomes available
    // Many military aircraft use standard national ranges making detection harder
];

/**
 * Special squawk codes that may indicate military/emergency operations
 */
const SPECIAL_SQUAWK_CODES = [
    '7700', // Emergency
    '7600', // Radio failure
    '7500', // Hijacking
    // Note: These are emergency codes, not exclusively military
];

/**
 * Detect if an aircraft is military based on available data
 * 
 * @param icao24 - ICAO 24-bit address (hex string)
 * @param callsign - Aircraft callsign (may be null)
 * @param squawk - Transponder code (may be null)
 * @param originCountry - Country of registration
 * @returns Object with military status and detection reasons
 */
function isMilitaryAircraft(
    icao24: string,
    callsign: string | null,
    squawk: string | null,
    originCountry: string
): { isMilitary: boolean; reasons: string[] } {
    const reasons: string[] = [];
    
    // 1. Check callsign patterns
    if (callsign) {
        const cleanCallsign = callsign.trim().toUpperCase();
        
        // Check for military callsign prefixes
        for (const prefix of MILITARY_CALLSIGN_PREFIXES) {
            if (cleanCallsign.startsWith(prefix)) {
                reasons.push(`Military callsign prefix: ${prefix}`);
                return { isMilitary: true, reasons };
            }
        }
        
        // REMOVED: Numeric-only callsign check
        // This was causing false positives with cargo/charter flights
        // that use numeric callsigns (FedEx, UPS, etc.)
    }
    
    // 2. Check ICAO address ranges
    if (icao24) {
        const icaoInt = parseInt(icao24, 16);
        
        for (const range of MILITARY_ICAO_RANGES) {
            if (icaoInt >= range.start && icaoInt <= range.end) {
                // Verify country matches if specified
                if (!range.country || range.country === originCountry) {
                    reasons.push(`ICAO address in military range: ${icao24.toUpperCase()}`);
                    return { isMilitary: true, reasons };
                }
            }
        }
    }
    
    // 3. Check special squawk codes (emergency/military)
    // Note: These are not exclusively military but often interesting
    // Kept commented out to avoid false positives from civilian emergencies
    // if (squawk && SPECIAL_SQUAWK_CODES.includes(squawk)) {
    //     reasons.push(`Special squawk code: ${squawk}`);
    //     return { isMilitary: true, reasons };
    // }
    
    return { isMilitary: false, reasons: [] };
}

function altitudeToColor(altitude: number | null, isMilitary: boolean): string {
    // Military aircraft get distinct color scheme
    if (isMilitary) {
        if (altitude === null || altitude <= 0) return "#fb923c"; // orange — ground
        if (altitude < 3000) return "#f97316"; // orange — low
        if (altitude < 8000) return "#ea580c"; // dark orange — medium
        if (altitude < 12000) return "#c2410c"; // darker orange — high
        return "#9a3412"; // darkest orange — very high
    }
    
    // Civilian aircraft keep original color scheme
    if (altitude === null || altitude <= 0) return "#4ade80"; // green — ground
    if (altitude < 3000) return "#22d3ee"; // cyan — low
    if (altitude < 8000) return "#3b82f6"; // blue — medium
    if (altitude < 12000) return "#a78bfa"; // purple — high
    return "#f472b6"; // pink — very high
}

export class AviationPlugin implements WorldPlugin {
    id = "aviation";
    name = "Aviation";
    description = "Real-time aircraft tracking via OpenSky Network";
    icon = Plane;
    category = "aviation" as const;
    version = "1.0.0";

    private context: PluginContext | null = null;

    async initialize(ctx: PluginContext): Promise<void> {
        this.context = ctx;
    }

    destroy(): void {
        this.context = null;
    }

    async fetch(_timeRange: TimeRange): Promise<GeoEntity[]> {
        try {
            const state = useStore.getState();
            let res;
            let data: any;

            if (state.isPlaybackMode) {
                res = await fetch(`/api/aviation/history?time=${state.currentTime.getTime()}`);
                if (!res.ok) throw new Error(`History API returned ${res.status}`);
                const historyData = await res.json();

                if (!historyData.records || !Array.isArray(historyData.records)) return [];

                return historyData.records.map((s: any): GeoEntity => {
                    const detection = isMilitaryAircraft(
                        s.icao24,
                        s.callsign,
                        null, // squawk not in history
                        s.origin_country || ''
                    );
                    
                    return {
                        id: `aviation-history-${s.icao24}`,
                        pluginId: "aviation",
                        latitude: s.latitude,
                        longitude: s.longitude,
                        altitude: (s.altitude || 0) * 10, // Scale for visibility matching Live mode
                        heading: s.heading || undefined,
                        speed: s.speed || undefined,
                        timestamp: new Date(s.timestamp), // from DB
                        label: s.callsign || s.icao24,
                        properties: {
                            icao24: s.icao24,
                            callsign: s.callsign,
                            altitude_m: s.altitude,
                            velocity_ms: s.speed,
                            heading: s.heading,
                            on_ground: s.altitude === null || s.altitude <= 0,
                            military: detection.isMilitary,
                            militaryDetectionReason: detection.reasons.length > 0 ? detection.reasons.join(', ') : undefined,
                        },
                    };
                });
            } else {
                res = await fetch("/api/aviation");
                if (!res.ok) throw new Error(`Aviation API returned ${res.status}`);
                data = await res.json();

                if (data.error && !data.states) {
                    console.warn("[AviationPlugin] API Warning:", data.error);
                    return [];
                }

                if (data._isFallback) {
                    console.warn("[AviationPlugin] Warning: Using historical fallback data from Supabase due to live API rate-limiting.");
                }
            }

            if (!data.states || !Array.isArray(data.states)) return [];

            const entities = data.states
                .filter((s: unknown[]) => s[6] !== null && s[5] !== null)
                .map((s: unknown[]): GeoEntity => {
                    const state: OpenSkyState = {
                        icao24: s[0] as string,
                        callsign: (s[1] as string)?.trim() || null,
                        origin_country: s[2] as string,
                        time_position: s[3] as number | null,
                        last_contact: s[4] as number,
                        longitude: s[5] as number | null,
                        latitude: s[6] as number | null,
                        baro_altitude: s[7] as number | null,
                        on_ground: s[8] as boolean,
                        velocity: s[9] as number | null,
                        true_track: s[10] as number | null,
                        vertical_rate: s[11] as number | null,
                        sensors: s[12] as number[] | null,
                        geo_altitude: s[13] as number | null,
                        squawk: s[14] as string | null,
                        spi: s[15] as boolean,
                        position_source: s[16] as number,
                    };

                    // Detect military aircraft
                    const detection = isMilitaryAircraft(
                        state.icao24,
                        state.callsign,
                        state.squawk,
                        state.origin_country
                    );

                    return {
                        id: `aviation-${state.icao24}`,
                        pluginId: "aviation",
                        latitude: state.latitude!,
                        longitude: state.longitude!,
                        altitude: (state.baro_altitude || 0) * 10, // Scale for visibility
                        heading: state.true_track || undefined,
                        speed: state.velocity || undefined,
                        timestamp: new Date(
                            (state.time_position || state.last_contact) * 1000
                        ),
                        label: state.callsign || state.icao24,
                        properties: {
                            icao24: state.icao24,
                            callsign: state.callsign,
                            origin_country: state.origin_country,
                            altitude_m: state.baro_altitude,
                            velocity_ms: state.velocity,
                            heading: state.true_track,
                            vertical_rate: state.vertical_rate,
                            on_ground: state.on_ground,
                            squawk: state.squawk,
                            military: detection.isMilitary,
                            militaryDetectionReason: detection.reasons.length > 0 ? detection.reasons.join(', ') : undefined,
                        },
                    };
                });
            return entities;
        } catch (err) {
            console.error("[AviationPlugin] Fetch error:", err);
            return [];
        }
    }

    getPollingInterval(): number {
        return 15000; // 15 seconds (matches OpenSky anon limit + backend cache)
    }

    getLayerConfig(): LayerConfig {
        return {
            color: "#3b82f6",
            clusterEnabled: true,
            clusterDistance: 40,
            maxEntities: 5000,
        };
    }

    renderEntity(entity: GeoEntity): CesiumEntityOptions {
        const alt = entity.properties.altitude_m as number | null;
        const isAirborne = !entity.properties.on_ground;
        const isMilitary = entity.properties.military as boolean || false;
        
        return {
            type: "model",
            // Billboard fallback for distant aircraft (LOD)
            iconUrl: "/plane-icon.svg",
            size: isAirborne ? 8 : 5,
            // 3D model config for nearby aircraft
            modelUrl: "/airplane/scene.gltf",
            modelScale: 75,
            modelMinPixelSize: 16,
            color: altitudeToColor(alt, isMilitary),
            rotation: entity.heading,
            labelText: entity.label || undefined,
            labelFont: "11px JetBrains Mono, monospace",
        };
    }

    getSelectionBehavior(entity: GeoEntity): SelectionBehavior | null {
        const isAirborne = !entity.properties.on_ground;
        if (!isAirborne) return null;
        return {
            showTrail: true,
            trailDurationSec: 60,
            trailStepSec: 5,
            trailColor: "#00fff7",
            flyToOffsetMultiplier: 3,
            flyToBaseDistance: 30000,
        };
    }

    getServerConfig(): ServerPluginConfig {
        return {
            apiBasePath: "/api/aviation",
            pollingIntervalMs: 5000,
            requiresAuth: true,
            historyEnabled: true,
            availabilityEnabled: true,
        };
    }

    getFilterDefinitions(): FilterDefinition[] {
        return [
            {
                id: "military",
                label: "Military Aircraft",
                type: "boolean",
                propertyKey: "military",
            },
            {
                id: "origin_country",
                label: "Country",
                type: "select",
                propertyKey: "origin_country",
                options: [
                    { value: "United States", label: "United States" },
                    { value: "China", label: "China" },
                    { value: "United Kingdom", label: "United Kingdom" },
                    { value: "Germany", label: "Germany" },
                    { value: "France", label: "France" },
                    { value: "Japan", label: "Japan" },
                    { value: "Australia", label: "Australia" },
                    { value: "Canada", label: "Canada" },
                    { value: "India", label: "India" },
                    { value: "Brazil", label: "Brazil" },
                    { value: "Russia", label: "Russia" },
                    { value: "Turkey", label: "Turkey" },
                    { value: "South Korea", label: "South Korea" },
                    { value: "Indonesia", label: "Indonesia" },
                    { value: "Mexico", label: "Mexico" },
                ],
            },
            {
                id: "altitude",
                label: "Altitude (m)",
                type: "range",
                propertyKey: "altitude_m",
                range: { min: 0, max: 15000, step: 500 },
            },
            {
                id: "on_ground",
                label: "On Ground",
                type: "boolean",
                propertyKey: "on_ground",
            },
            {
                id: "callsign",
                label: "Callsign",
                type: "text",
                propertyKey: "callsign",
            },
        ];
    }
}
