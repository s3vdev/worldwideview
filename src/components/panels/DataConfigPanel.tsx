"use client";

import { useState } from "react";

import { useStore } from "@/core/state/store";
import { FilterSection } from "./FilterPanel";

export function DataConfigPanel() {
    const configPanelOpen = useStore((s) => s.configPanelOpen);
    const dataConfig = useStore((s) => s.dataConfig);
    const updateDataConfig = useStore((s) => s.updateDataConfig);
    const setPollingInterval = useStore((s) => s.setPollingInterval);
    const layers = useStore((s) => s.layers);
    const mapConfig = useStore((s) => s.mapConfig);
    const updateMapConfig = useStore((s) => s.updateMapConfig);

    const enabledPlugins = Object.entries(dataConfig.pollingIntervals).filter(
        ([pluginId]) => layers[pluginId]?.enabled
    );

    const [activeTab, setActiveTab] = useState<"filters" | "cache" | "overlay">("filters");

    return (
        <aside
            className={`sidebar sidebar--right glass-panel ${configPanelOpen ? "" : "sidebar--closed"
                }`}
            style={{ width: 320, padding: "var(--space-xl)", zIndex: 101, borderLeft: "var(--glass-border)" }}
        >
            <div className="sidebar__title" style={{ marginBottom: "var(--space-md)", color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 }}>Data Configuration</div>

            <div className="panel-tabs">
                <button
                    className={`panel-tab ${activeTab === "filters" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("filters")}
                >
                    Filters
                </button>
                <button
                    className={`panel-tab ${activeTab === "cache" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("cache")}
                >
                    Cache & Limits
                </button>
                <button
                    className={`panel-tab ${activeTab === "overlay" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("overlay")}
                >
                    Config & Overlay
                </button>
            </div>

            {activeTab === "filters" && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={sectionHeaderStyle}>Entity Filters</div>
                    <FilterSection />
                </div>
            )}

            {activeTab === "cache" && (
                <div style={{ marginBottom: "var(--space-lg)" }}>
                    <div style={sectionHeaderStyle}>Cache & Limits</div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Enable Cache</label>
                        <input
                            type="checkbox"
                            checked={dataConfig.cacheEnabled}
                            onChange={(e) => updateDataConfig({ cacheEnabled: e.target.checked })}
                            style={checkboxStyle}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Cache Max Age (ms)</label>
                        <input
                            type="number"
                            value={dataConfig.cacheMaxAge}
                            onChange={(e) => updateDataConfig({ cacheMaxAge: parseInt(e.target.value) || 0 })}
                            style={inputStyle}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Max Concurrent Req</label>
                        <input
                            type="number"
                            value={dataConfig.maxConcurrentRequests}
                            onChange={(e) => updateDataConfig({ maxConcurrentRequests: parseInt(e.target.value) || 0 })}
                            style={inputStyle}
                        />
                    </div>

                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Retry Attempts</label>
                        <input
                            type="number"
                            value={dataConfig.retryAttempts}
                            onChange={(e) => updateDataConfig({ retryAttempts: parseInt(e.target.value) || 0 })}
                            style={inputStyle}
                        />
                    </div>
                </div>
            )}

            {activeTab === "overlay" && (
                <>
                    {/* Active Layer Configurations */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Active Layer Configs</div>
                        {enabledPlugins.length === 0 ? (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", padding: "var(--space-sm) 0" }}>
                                No layers enabled. Turn on a layer to configure it.
                            </div>
                        ) : (
                            enabledPlugins.map(([pluginId, interval]) => (
                                <div key={pluginId} style={{
                                    marginBottom: "var(--space-md)",
                                    background: "var(--bg-tertiary)",
                                    padding: "var(--space-md)",
                                    borderRadius: "var(--radius-md)",
                                    border: "1px solid var(--border-subtle)"
                                }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: "var(--space-sm)", textTransform: "capitalize" }}>
                                        {pluginId} Layer
                                    </div>
                                    <div style={inputGroupStyle}>
                                        <label style={labelStyle}>Polling Interval (ms)</label>
                                        <input
                                            type="number"
                                            value={interval}
                                            onChange={(e) => setPollingInterval(pluginId, parseInt(e.target.value) || 0)}
                                            style={inputStyle}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Experimental Features */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Experimental Features</div>

                        {Object.entries(dataConfig.experimentalFeatures).map(([feature, enabled]) => {
                            const labels: Record<string, string> = {
                                predictiveLoading: "Predictive Loading",
                                realtimeStreaming: "Realtime Streaming",
                                clusteringEnabled: "Clustering",
                                showTimelineHighlight: "Timeline Data Highlights",
                            };
                            return (
                                <div key={feature} style={inputGroupStyle}>
                                    <label style={labelStyle}>{labels[feature] || feature}</label>
                                    <input
                                        type="checkbox"
                                        checked={enabled}
                                        onChange={(e) => updateDataConfig({
                                            experimentalFeatures: { ...dataConfig.experimentalFeatures, [feature]: e.target.checked }
                                        })}
                                        style={checkboxStyle}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Map Overlays */}
                    <div style={{ marginBottom: "var(--space-lg)" }}>
                        <div style={sectionHeaderStyle}>Map Overlays</div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Show Labels & Borders</label>
                            <input
                                type="checkbox"
                                checked={mapConfig?.showLabels || false}
                                onChange={(e) => updateMapConfig({ showLabels: e.target.checked })}
                                style={checkboxStyle}
                            />
                        </div>
                    </div>
                </>
            )}
        </aside>
    );
}

// Inline styles for simplicity matching the current design tokens where possible
const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: "var(--space-sm)",
    borderBottom: "1px solid var(--border-subtle)",
    paddingBottom: "var(--space-xs)"
};

const inputGroupStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--space-sm)",
};

const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--text-secondary)",
    textTransform: "capitalize",
};

const inputStyle: React.CSSProperties = {
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)",
    padding: "var(--space-xs) var(--space-sm)",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    width: "80px",
    outline: "none",
};

const checkboxStyle: React.CSSProperties = {
    cursor: "pointer",
    accentColor: "var(--accent-cyan)",
};
