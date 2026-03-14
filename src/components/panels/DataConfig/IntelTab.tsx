import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import { Eye, MapPin, Lock, Unlock, Star, Crosshair, Square } from "lucide-react";
import { dataBus } from "@/core/data/DataBus";
import { sectionHeaderStyle } from "./sharedStyles";

/** Format entity property value for display (avoid [object Object] for arrays/objects) */
function formatPropValue(key: string, value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) {
        if (value.length === 0) return "—";
        const first = value[0];
        if (typeof first === "object" && first !== null && "latitude" in first) {
            return `${value.length} vertices (polygon boundary)`;
        }
        if (typeof first === "object") return `${value.length} items`;
        return value.map((v) => String(v)).join(", ");
    }
    if (typeof value === "object") return JSON.stringify(value).slice(0, 80) + (JSON.stringify(value).length > 80 ? "…" : "");
    return String(value);
}

export function IntelTab() {
    const selectedEntity = useStore((s) => s.selectedEntity);
    const lockedEntityId = useStore((s) => s.lockedEntityId);
    const followEntityId = useStore((s) => s.followEntityId);
    const setLockedEntityId = useStore((s) => s.setLockedEntityId);
    const setFollowEntityId = useStore((s) => s.setFollowEntityId);
    const favorites = useStore((s) => s.favorites);
    const addFavorite = useStore((s) => s.addFavorite);
    const removeFavorite = useStore((s) => s.removeFavorite);

    if (!selectedEntity) {
        return (
            <div style={{ padding: "var(--space-md)", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", textAlign: "center" }}>
                Select an entity on the map to view its intelligence report.
            </div>
        );
    }

    const managed = pluginManager.getPlugin(selectedEntity.pluginId);
    const pluginIcon = managed?.plugin.icon;
    const pluginName = managed?.plugin.name || selectedEntity.pluginId;

    const displayProps = Object.entries(selectedEntity.properties).filter(
        ([key]) =>
            !["id", "pluginId"].includes(key) &&
            selectedEntity.properties[key] !== null &&
            selectedEntity.properties[key] !== undefined
    );

    const DetailComp = managed?.plugin.getDetailComponent?.();

    const isFavorited = favorites.some((f) => f.id === selectedEntity.id);

    // Prefer label; for militaryBases/others avoid showing "Unknown" — use properties.name/type or id
    const rawTitle = selectedEntity.label || (selectedEntity.properties?.name as string)?.trim() || (selectedEntity.properties?.type as string) || selectedEntity.id;
    const displayTitle = (rawTitle && String(rawTitle).toLowerCase() !== "unknown") ? rawTitle : (selectedEntity.properties?.type as string) || selectedEntity.id;

    return (
        <div className="intel-panel__entity">
            <div className="intel-panel__entity-header">
                <span className="intel-panel__entity-icon">
                    {pluginIcon && <PluginIcon icon={pluginIcon} size={20} />}
                </span>
                <div style={{ flex: 1 }}>
                    <div className="intel-panel__entity-title">
                        {displayTitle}
                    </div>
                    <div className="intel-panel__entity-subtitle">{pluginName}</div>
                </div>
                <button
                    className="intel-panel__close"
                    style={{ position: "relative", top: 0, right: 0 }}
                    onClick={() => {
                        if (isFavorited) {
                            removeFavorite(selectedEntity.id);
                        } else {
                            addFavorite(selectedEntity, pluginName, pluginIcon);
                        }
                    }}
                    title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star size={14} fill={isFavorited ? "currentColor" : "none"} />
                </button>
            </div>
            <div className="intel-panel__props">
                <div className="intel-panel__prop">
                    <span className="intel-panel__prop-key">Latitude</span>
                    <span className="intel-panel__prop-value">
                        {selectedEntity.latitude.toFixed(4)}°
                    </span>
                </div>
                <div className="intel-panel__prop">
                    <span className="intel-panel__prop-key">Longitude</span>
                    <span className="intel-panel__prop-value">
                        {selectedEntity.longitude.toFixed(4)}°
                    </span>
                </div>
                {selectedEntity.altitude !== undefined && (
                    <div className="intel-panel__prop">
                        <span className="intel-panel__prop-key">Altitude</span>
                        <span className="intel-panel__prop-value">
                            {selectedEntity.altitude.toFixed(0)} m
                        </span>
                    </div>
                )}
                <div className="intel-panel__prop">
                    <span className="intel-panel__prop-key">Timestamp</span>
                    <span className="intel-panel__prop-value">
                        {selectedEntity.timestamp.toLocaleTimeString()}
                    </span>
                </div>

                {DetailComp ? (
                    <div className="intel-panel__custom-detail" style={{ marginTop: "var(--space-md)", maxWidth: "100%", overflow: "hidden" }}>
                        <DetailComp entity={selectedEntity} />
                    </div>
                ) : (
                    <>
                        {displayProps.map(([key, value]) => (
                            <div key={key} className="intel-panel__prop">
                                <span className="intel-panel__prop-key">
                                    {key.replace(/_/g, " ")}
                                </span>
                                <span className="intel-panel__prop-value">
                                    {formatPropValue(key, value)}
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </div>
            <div className="intel-panel__actions">
                <button
                    className="intel-panel__action-btn"
                    title="Face towards"
                    onClick={() => {
                        console.log("[Intel] Face button clicked", selectedEntity.latitude, selectedEntity.longitude);
                        dataBus.emit("cameraFaceTowards", {
                            lat: selectedEntity.latitude,
                            lon: selectedEntity.longitude,
                            alt: selectedEntity.altitude || 0,
                        });
                    }}
                >
                    <Eye size={14} />
                    <span>Face</span>
                </button>
                <button
                    className="intel-panel__action-btn"
                    title="Go to entity (one-time)"
                    onClick={() => {
                        dataBus.emit("cameraGoTo", {
                            lat: selectedEntity.latitude,
                            lon: selectedEntity.longitude,
                            alt: selectedEntity.altitude || 0,
                        });
                    }}
                >
                    <MapPin size={14} />
                    <span>Go To</span>
                </button>
                <button
                    className={`intel-panel__action-btn ${followEntityId === selectedEntity.id ? "intel-panel__action-btn--active" : ""}`}
                    title={followEntityId === selectedEntity.id ? "Stop following" : "Follow (camera tracks entity over time)"}
                    onClick={() => {
                        if (followEntityId === selectedEntity.id) {
                            setFollowEntityId(null);
                        } else {
                            setLockedEntityId(null);
                            setFollowEntityId(selectedEntity.id);
                        }
                    }}
                >
                    {followEntityId === selectedEntity.id
                        ? <><Square size={14} /><span>Stop Follow</span></>
                        : <><Crosshair size={14} /><span>Follow</span></>
                    }
                </button>
                <button
                    className={`intel-panel__action-btn ${lockedEntityId === selectedEntity.id ? "intel-panel__action-btn--active" : ""}`}
                    title={lockedEntityId === selectedEntity.id ? "Unlock camera" : "Lock camera to entity"}
                    onClick={() => {
                        if (lockedEntityId === selectedEntity.id) {
                            setLockedEntityId(null);
                        } else {
                            setFollowEntityId(null);
                            setLockedEntityId(selectedEntity.id);
                        }
                    }}
                >
                    {lockedEntityId === selectedEntity.id
                        ? <><Unlock size={14} /><span>Unlock</span></>
                        : <><Lock size={14} /><span>Lock</span></>
                    }
                </button>
            </div>
        </div>
    );
}
