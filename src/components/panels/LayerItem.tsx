"use client";

import { ShieldAlert } from "lucide-react";
import { PluginIcon } from "@/components/common/PluginIcon";
import { pluginManager } from "@/core/plugins/PluginManager";
import { BUILT_IN_PLUGIN_IDS } from "@/lib/marketplace/builtinPlugins";
import type { WorldPlugin } from "@/core/plugins/PluginTypes";
import "./LayerItem.css";

// ─── Category Labels ────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
    aviation: "Aviation",
    maritime: "Maritime",
    "natural-disaster": "Natural Disaster",
    conflict: "Conflict",
    infrastructure: "Infrastructure",
    cyber: "Cyber",
    economic: "Economic",
    custom: "Custom",
};

// ─── Trust Helpers ──────────────────────────────────────────

type TrustTier = "built-in" | "verified" | "unverified";

function getTrust(pluginId: string): TrustTier {
    if ((BUILT_IN_PLUGIN_IDS as readonly string[]).includes(pluginId)) {
        return "built-in";
    }
    const manifest = pluginManager.getManifest(pluginId);
    return manifest?.trust ?? "unverified";
}

function TrustIcon({ trust }: { trust: TrustTier }) {
    if (trust !== "unverified") return null;

    return (
        <span
            className="layer-item__unverified-icon-wrapper"
            data-tooltip="Unverified plugin, use at your own risk"
        >
            <ShieldAlert
                size={12}
                className="layer-item__unverified-icon"
                aria-label="Unverified plugin"
            />
        </span>
    );
}

// ─── LayerItem Component ────────────────────────────────────

interface LayerItemProps {
    plugin: WorldPlugin;
    isEnabled: boolean;
    isLoading: boolean;
    entityCount: number;
    onToggle: () => void;
}

export function LayerItem({
    plugin,
    isEnabled,
    isLoading,
    entityCount,
    onToggle,
}: LayerItemProps) {
    const trust = getTrust(plugin.id);


    return (
        <div className="layer-item" onClick={onToggle}>
            <span className="layer-item__icon">
                <PluginIcon icon={plugin.icon} size={18} />
            </span>

            <div className="layer-item__info">
                <div className="layer-item__header">
                    <span className="layer-item__name">{plugin.name}</span>
                    <TrustIcon trust={trust} />
                </div>
                <div className="layer-item__desc">{plugin.description}</div>
                <div className="layer-item__footer">
                    {isEnabled && !isLoading && entityCount > 0 && (
                        <span className="layer-item__count">
                            {entityCount.toLocaleString()}
                        </span>
                    )}
                </div>
            </div>

            {isEnabled && isLoading && (
                <span className="layer-item__spinner" aria-label="Loading" />
            )}

            <div
                className={`layer-item__toggle ${isEnabled ? "layer-item__toggle--on" : ""}`}
            />
        </div>
    );
}
