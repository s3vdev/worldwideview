"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { ImageryPicker } from "./ImageryPicker";
import { PluginIcon } from "@/components/common/PluginIcon";
import { FavoritesTab } from "./FavoritesTab";


export function LayerPanel() {
    const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
    const layers = useStore((s) => s.layers);
    const entitiesByPlugin = useStore((s) => s.entitiesByPlugin);

    const allPlugins = pluginManager.getAllPlugins();

    // Group by category
    const grouped: Record<string, typeof allPlugins> = {};
    allPlugins.forEach((managed) => {
        const cat = managed.plugin.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(managed);
    });

    const categoryLabels: Record<string, string> = {
        aviation: "Aviation",
        maritime: "Maritime",
        "natural-disaster": "Natural Disasters",
        conflict: "Conflict",
        infrastructure: "Infrastructure",
        cyber: "Cyber",
        economic: "Economic",
        custom: "Custom",
    };

    const handleToggle = (pluginId: string) => {
        const isEnabled = layers[pluginId]?.enabled;
        if (isEnabled) {
            pluginManager.disablePlugin(pluginId);
            useStore.getState().setLayerEnabled(pluginId, false);
            useStore.getState().clearEntities(pluginId);
            useStore.getState().setEntityCount(pluginId, 0);
        } else {
            pluginManager.enablePlugin(pluginId);
            useStore.getState().setLayerEnabled(pluginId, true);

            const managed = pluginManager.getPlugin(pluginId);
            const settings = useStore.getState().dataConfig.pluginSettings[pluginId];
            // Satellites: open Data Configuration panel on Config/Overlay tab (like Cameras)
            if (pluginId === "satellites") {
                useStore.getState().setConfigPanelOpen(true);
                useStore.getState().setActiveConfigTab("overlay");
                useStore.getState().setHighlightLayerId(pluginId);
            } else if (managed?.plugin.requiresConfiguration?.(settings)) {
                useStore.getState().setConfigPanelOpen(true);
                useStore.getState().setActiveConfigTab("overlay");
                useStore.getState().setHighlightLayerId(pluginId);
            }
        }
    };

    const [activeTab, setActiveTab] = useState<"layers" | "imagery" | "favorites">("layers");

    return (
        <aside
            className={`sidebar sidebar--left glass-panel ${leftSidebarOpen ? "" : "sidebar--closed"
                }`}
        >
            <div className="sidebar__title">Data Sources</div>

            <div className="panel-tabs">
                <button
                    className={`panel-tab ${activeTab === "layers" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("layers")}
                >
                    Data Layers
                </button>
                <button
                    className={`panel-tab ${activeTab === "imagery" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("imagery")}
                >
                    Imagery
                </button>
                <button
                    className={`panel-tab ${activeTab === "favorites" ? "panel-tab--active" : ""}`}
                    onClick={() => setActiveTab("favorites")}
                >
                    Favorites
                </button>
            </div>

            {activeTab === "layers" && (
                <>
                    {Object.entries(grouped).map(([category, plugins]) => (
                        <div key={category} style={{ marginBottom: "var(--space-lg)" }}>
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    letterSpacing: "0.08em",
                                    textTransform: "uppercase",
                                    color: "var(--text-muted)",
                                    marginBottom: "var(--space-sm)",
                                    paddingLeft: "var(--space-md)",
                                }}
                            >
                                {categoryLabels[category] || category}
                            </div>
                            {plugins.map((managed) => {
                                const isEnabled = layers[managed.plugin.id]?.enabled || false;
                                const isLoading = layers[managed.plugin.id]?.isLoading || false;
                                const count = (entitiesByPlugin[managed.plugin.id] || []).length;

                                return (
                                    <div
                                        key={managed.plugin.id}
                                        className="layer-item"
                                        onClick={() => handleToggle(managed.plugin.id)}
                                    >
                                        <span className="layer-item__icon">
                                            {typeof managed.plugin.icon === "string" ? (
                                                managed.plugin.icon
                                            ) : (
                                                <managed.plugin.icon size={18} />
                                            )}
                                        </span>
                                        <div className="layer-item__info">
                                            <div className="layer-item__name">{managed.plugin.name}</div>
                                            <div className="layer-item__desc">
                                                {managed.plugin.description}
                                            </div>
                                        </div>
                                        {isEnabled && isLoading && (
                                            <span className="layer-item__loading" aria-hidden="true">
                                                <Loader2 size={14} className="layer-item__spinner" style={{ color: "var(--accent-cyan)" }} />
                                            </span>
                                        )}
                                        {isEnabled && !isLoading && count > 0 && (
                                            <span className="layer-item__count">
                                                {count.toLocaleString()}
                                            </span>
                                        )}
                                        <div
                                            className={`layer-item__toggle ${isEnabled ? "layer-item__toggle--on" : ""
                                                }`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </>
            )}

            {activeTab === "imagery" && (
                <ImageryPicker />
            )}

            {activeTab === "favorites" && (
                <FavoritesTab />
            )}
        </aside>
    );
}
