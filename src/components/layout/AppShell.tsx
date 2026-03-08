"use client";

import { useEffect } from "react";
import { Header } from "./Header";
import { LayerPanel } from "@/components/panels/LayerPanel";
import { EntityInfoCard } from "@/components/panels/EntityInfoCard";
import { DataConfigPanel } from "@/components/panels/DataConfig";
import CameraStatsPanel from "@/components/panels/CameraStatsPanel";
import { Timeline } from "@/components/timeline/Timeline";
import { TimelineSync } from "@/core/globe/TimelineSync";
import { pluginManager } from "@/core/plugins/PluginManager";
import { pluginRegistry } from "@/core/plugins/PluginRegistry";
import { AviationPlugin } from "@/plugins/aviation";
import { MaritimePlugin } from "@/plugins/maritime";
import { WildfirePlugin } from "@/plugins/wildfire";
import { BordersPlugin } from "@/plugins/borders";
import { CameraPlugin } from "@/plugins/camera";
import { GPSJammingPlugin } from "@/plugins/gps-jamming";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { PanelToggleArrows } from "@/components/layout/PanelToggleArrows";
import { FloatingVideoManager } from "@/components/video/FloatingVideoManager";
import dynamic from "next/dynamic";

// A small functional component strictly for subscribing to non-rendering state/events
function DataBusSubscriber() {
    const setPollingInterval = useStore((s) => s.setPollingInterval);
    const setEntities = useStore((s) => s.setEntities);
    const setEntityCount = useStore((s) => s.setEntityCount);
    const cacheMaxAge = useStore((s) => s.dataConfig.cacheMaxAge);

    useEffect(() => {
        // Sync cache limit any time the UI setting changes
        pluginManager.setCacheMaxAge(cacheMaxAge);
    }, [cacheMaxAge]);

    useEffect(() => {
        const unsubReg = dataBus.on("pluginRegistered", ({ pluginId, defaultInterval }) => {
            // Only set if we don't already have one (e.g. from persisted state later)
            const currentIntervals = useStore.getState().dataConfig.pollingIntervals;
            if (!currentIntervals[pluginId]) {
                setPollingInterval(pluginId, defaultInterval);
            }
        });

        const unsubData = dataBus.on("dataUpdated", ({ pluginId, entities }) => {
            setEntities(pluginId, entities);
            setEntityCount(pluginId, entities.length);
        });

        return () => {
            unsubReg();
            unsubData();
        };
    }, [setPollingInterval, setEntities, setEntityCount]);

    return null;
}

// Dynamically import GlobeView with SSR disabled (CesiumJS requires window)
const GlobeView = dynamic(() => import("@/core/globe/GlobeView"), {
    ssr: false,
    loading: () => (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-primary)",
            }}
        >
            <div className="status-badge">
                <span className="status-badge__dot" />
                Loading Engine...
            </div>
        </div>
    ),
});

export function AppShell() {
    const initLayer = useStore((s) => s.initLayer);

    useEffect(() => {
        const startPlatform = async () => {
            console.log("[AppShell] Initializing Platform...");

            // 1. Register built-in plugins
            pluginRegistry.register(new AviationPlugin());
            pluginRegistry.register(new MaritimePlugin());
            pluginRegistry.register(new WildfirePlugin());
            pluginRegistry.register(new BordersPlugin());
            pluginRegistry.register(new CameraPlugin());
            pluginRegistry.register(new GPSJammingPlugin());

            // 2. Init PluginManager
            await pluginManager.init();

            // 3. Register and init Layer state for all plugins
            for (const plugin of pluginRegistry.getAll()) {
                await pluginManager.registerPlugin(plugin);
                initLayer(plugin.id);
            }

            console.log("[AppShell] Platform Ready.");
        };

        startPlatform();

        return () => {
            pluginManager.destroy();
        };
    }, [initLayer]);

    return (
        <div className="app-shell">
            {/* Background Globe */}
            <div className="app-shell__globe">
                <GlobeView />
            </div>

            {/* Logic Syncs */}
            <TimelineSync />
            <DataBusSubscriber />

            {/* Foreground UI Components */}
            <PanelToggleArrows />
            <Header />
            <LayerPanel />
            <DataConfigPanel />
            <CameraStatsPanel />
            <EntityInfoCard />
            <Timeline />
            <FloatingVideoManager />
        </div>
    );
}
