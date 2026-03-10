"use client";

import React from "react";
import { useStore } from "@/core/state/store";
import { Satellite, Settings } from "lucide-react";

export const SatelliteSettings: React.FC<{ pluginId: string }> = ({ pluginId }) => {
    const settingsRaw = useStore((s) => s.dataConfig.pluginSettings[pluginId]);
    const updatePluginSettings = useStore((s) => s.updatePluginSettings);
    
    // Default settings
    const settings = {
        pollingInterval: 6 * 60 * 60 * 1000, // 6 hours (TLE data doesn't change rapidly)
        starlinkLimit: 50,       // Limit Starlink to avoid overload
        activeLimit: 100,        // Limit Active group (6000+ sats) to avoid overload
        maxVisibleSatellites: 500, // Performance cap
        showLabels: false,       // Labels disabled by default (clutter)
        showOrbitForSelected: true,   // Show orbit when satellite selected
        showGroundTrackForSelected: true, // Show ground track when selected
        highlightISS: true,      // Make ISS stand out
        orbitSampleCount: 90,    // Number of points in orbit path
        ...(settingsRaw || {}),
    };

    const handlePollingIntervalChange = (hours: number) => {
        updatePluginSettings(pluginId, {
            pollingInterval: hours * 60 * 60 * 1000,
        });
    };

    const handleStarlinkLimitChange = (limit: number) => {
        updatePluginSettings(pluginId, {
            starlinkLimit: Math.max(10, Math.min(200, limit)),
        });
    };

    const handleActiveLimitChange = (limit: number) => {
        updatePluginSettings(pluginId, {
            activeLimit: Math.max(50, Math.min(500, limit)),
        });
    };

    const handleMaxSatellitesChange = (max: number) => {
        updatePluginSettings(pluginId, {
            maxVisibleSatellites: Math.max(100, Math.min(2000, max)),
        });
    };

    const handleOrbitSamplesChange = (samples: number) => {
        updatePluginSettings(pluginId, {
            orbitSampleCount: Math.max(30, Math.min(180, samples)),
        });
    };

    const pollingHours = settings.pollingInterval / (60 * 60 * 1000);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            {/* Header */}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "-8px" }}>
                Satellite Layer Configuration
            </div>

            {/* Info: Filters */}
            <div style={{
                padding: "var(--space-md)",
                background: "rgba(34, 211, 238, 0.05)",
                border: "1px solid rgba(34, 211, 238, 0.2)",
                borderRadius: "var(--radius-sm)",
            }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <Satellite size={14} style={{ color: "var(--accent-cyan)", flexShrink: 0, marginTop: "1px" }} />
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)" }}>
                        Satellite Groups
                    </div>
                </div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    Use the <strong>Filters</strong> tab to select which satellite groups to display (Space Stations, GPS, Weather, Starlink, OneWeb, Iridium, Planet, Military, Active).
                </div>
            </div>

            {/* Limits */}
            <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-sm)" }}>
                    Performance Limits
                </div>
                
                {/* Starlink Limit */}
                <div style={{ marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <label style={{ fontSize: 10, color: "var(--text-muted)" }}>Starlink Limit</label>
                        <span style={{ fontSize: 10, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
                            {settings.starlinkLimit}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="200"
                        step="10"
                        value={settings.starlinkLimit}
                        onChange={(e) => handleStarlinkLimitChange(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--accent-cyan)" }}
                    />
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: "2px" }}>
                        Limit Starlink satellites to avoid overload
                    </div>
                </div>

                {/* Active Limit */}
                <div style={{ marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <label style={{ fontSize: 10, color: "var(--text-muted)" }}>Active Limit</label>
                        <span style={{ fontSize: 10, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
                            {settings.activeLimit ?? 100}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="50"
                        max="500"
                        step="50"
                        value={settings.activeLimit ?? 100}
                        onChange={(e) => handleActiveLimitChange(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--accent-cyan)" }}
                    />
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: "2px" }}>
                        Limit Active satellites (6000+ total) for performance
                    </div>
                </div>

                {/* Max Visible Satellites */}
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <label style={{ fontSize: 10, color: "var(--text-muted)" }}>Max Visible Satellites</label>
                        <span style={{ fontSize: 10, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
                            {settings.maxVisibleSatellites}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="100"
                        max="2000"
                        step="100"
                        value={settings.maxVisibleSatellites}
                        onChange={(e) => handleMaxSatellitesChange(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--accent-cyan)" }}
                    />
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: "2px" }}>
                        Hard cap to prevent performance issues
                    </div>
                </div>
            </div>

            {/* Visualization */}
            <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-sm)" }}>
                    Visualization
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {[
                        { key: "showLabels", label: "Show Labels", desc: "Display satellite names" },
                        { key: "showOrbitForSelected", label: "Show Orbit Path", desc: "When satellite selected" },
                        { key: "showGroundTrackForSelected", label: "Show Ground Track", desc: "When satellite selected" },
                        { key: "highlightISS", label: "Highlight ISS", desc: "Make ISS larger and labeled" },
                    ].map(({ key, label, desc }) => (
                        <button
                            key={key}
                            onClick={() => updatePluginSettings(pluginId, { [key]: !settings[key as keyof typeof settings] })}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "6px var(--space-md)",
                                background: settings[key as keyof typeof settings] ? "rgba(34, 211, 238, 0.05)" : "transparent",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                                <span style={{ fontSize: 10, color: "var(--text-primary)" }}>{label}</span>
                                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{desc}</span>
                            </div>
                            <div style={{
                                width: 32,
                                height: 16,
                                background: settings[key as keyof typeof settings] ? "var(--accent-cyan)" : "var(--bg-tertiary)",
                                borderRadius: 8,
                                position: "relative",
                                transition: "all 0.2s ease",
                            }}>
                                <div style={{
                                    width: 12,
                                    height: 12,
                                    background: "white",
                                    borderRadius: "50%",
                                    position: "absolute",
                                    top: 2,
                                    left: settings[key as keyof typeof settings] ? 18 : 2,
                                    transition: "all 0.2s ease",
                                }} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Advanced */}
            <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-sm)" }}>
                    Advanced
                </div>
                
                {/* Polling Interval */}
                <div style={{ marginBottom: "var(--space-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <label style={{ fontSize: 10, color: "var(--text-muted)" }}>TLE Update Interval</label>
                        <span style={{ fontSize: 10, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
                            {pollingHours}h
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="24"
                        step="1"
                        value={pollingHours}
                        onChange={(e) => handlePollingIntervalChange(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--accent-cyan)" }}
                    />
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: "2px" }}>
                        How often to fetch new TLE data (orbital elements)
                    </div>
                </div>

                {/* Orbit Sample Count */}
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <label style={{ fontSize: 10, color: "var(--text-muted)" }}>Orbit Path Samples</label>
                        <span style={{ fontSize: 10, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
                            {settings.orbitSampleCount}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="30"
                        max="180"
                        step="10"
                        value={settings.orbitSampleCount}
                        onChange={(e) => handleOrbitSamplesChange(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--accent-cyan)" }}
                    />
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: "2px" }}>
                        Higher = smoother orbit paths, but more computation
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div style={{
                padding: "var(--space-md)",
                background: "rgba(34, 211, 238, 0.05)",
                border: "1px solid rgba(34, 211, 238, 0.2)",
                borderRadius: "var(--radius-sm)",
            }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <Satellite size={14} style={{ color: "var(--accent-cyan)", flexShrink: 0, marginTop: "1px" }} />
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)" }}>
                        Live Orbital Tracking
                    </div>
                </div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    Satellites use real-time orbital propagation (SGP4/SDP4) from CelesTrak TLE data.
                    Position updates happen at 60 FPS for smooth motion along curved orbital paths.
                </div>
            </div>
        </div>
    );
};
