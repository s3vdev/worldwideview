"use client";

import { useStore } from "@/core/state/store";
import { pluginManager } from "@/core/plugins/PluginManager";
import { PluginIcon } from "@/components/common/PluginIcon";
import { Shield } from "lucide-react";

const CARD_WIDTH = 260;
const CARD_HEIGHT_EST = 220; // Increased for military section
const OFFSET_X = 16;
const OFFSET_Y = 16;
const EDGE_PADDING = 12;

export function EntityInfoCard() {
    const hoveredEntity = useStore((s) => s.hoveredEntity);
    const screenPos = useStore((s) => s.hoveredScreenPosition);
    const selectedEntity = useStore((s) => s.selectedEntity);

    // Don't show the hover card if an entity is selected (IntelPanel is open)
    // or if the hovered entity IS the selected entity
    if (
        !hoveredEntity ||
        !screenPos ||
        (selectedEntity && selectedEntity.id === hoveredEntity.id)
    )
        return null;

    // Find plugin info
    const managed = pluginManager.getPlugin(hoveredEntity.pluginId);
    const pluginIcon = managed?.plugin.icon;
    const pluginName = managed?.plugin.name || hoveredEntity.pluginId;

    // Check if military aircraft
    const isMilitary = hoveredEntity.properties?.military === true;
    const militaryReason = hoveredEntity.properties?.militaryDetectionReason as string | undefined;

    // Satellite-specific visualization semantics
    const isSatellite = hoveredEntity.pluginId === "satellites";
    const orbitPathShown = isSatellite && selectedEntity?.id === hoveredEntity.id;
    const groundTrackShown = isSatellite && selectedEntity?.id === hoveredEntity.id;

    // Earthquake specific semantics
    const colorMeaning = hoveredEntity.properties?.colorMeaning as string | undefined;
    const sizeMeaning = hoveredEntity.properties?.sizeMeaning as string | undefined;
    const areaMeaning = hoveredEntity.properties?.areaMeaning as string | undefined;

    // Clamp position to keep card within viewport
    let x = screenPos.x + OFFSET_X;
    let y = screenPos.y + OFFSET_Y;

    if (typeof window !== "undefined") {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (x + CARD_WIDTH > vw - EDGE_PADDING) {
            x = screenPos.x - CARD_WIDTH - OFFSET_X;
        }
        if (y + CARD_HEIGHT_EST > vh - EDGE_PADDING) {
            y = screenPos.y - CARD_HEIGHT_EST - OFFSET_Y;
        }
        if (x < EDGE_PADDING) x = EDGE_PADDING;
        if (y < EDGE_PADDING) y = EDGE_PADDING;
    }

    // Format values
    const altitude = hoveredEntity.altitude;
    const altitudeDisplay =
        altitude !== undefined ? `${(altitude / 10).toFixed(0)} m` : null;

    const speed = hoveredEntity.speed;
    const speedDisplay =
        speed !== undefined ? `${speed.toFixed(0)} m/s` : null;

    const heading = hoveredEntity.heading;
    const headingDisplay =
        heading !== undefined ? `${heading.toFixed(0)}°` : null;

    return (
        <div
            className="entity-info-card"
            style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${CARD_WIDTH}px`,
            }}
        >
            {/* Header */}
            <div className="entity-info-card__header">
                <span className="entity-info-card__icon">
                    {pluginIcon && <PluginIcon icon={pluginIcon} size={16} />}
                </span>
                <div className="entity-info-card__title-group">
                    <div className="entity-info-card__title">
                        {hoveredEntity.label || hoveredEntity.id}
                        {isMilitary && (
                            <Shield 
                                size={14} 
                                style={{ 
                                    marginLeft: "6px", 
                                    color: "#f97316",
                                    display: "inline-block",
                                    verticalAlign: "middle"
                                }} 
                            />
                        )}
                    </div>
                    <div className="entity-info-card__badge">{pluginName}</div>
                </div>
            </div>

            {/* Military Classification Badge */}
            {isMilitary && militaryReason && (
                <div style={{
                    background: "rgba(249, 115, 22, 0.1)",
                    border: "1px solid rgba(249, 115, 22, 0.3)",
                    borderRadius: "4px",
                    padding: "6px 8px",
                    marginBottom: "8px",
                }}>
                    <div style={{
                        fontSize: "9px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "#f97316",
                        marginBottom: "2px",
                    }}>
                        Military Classification
                    </div>
                    <div style={{
                        fontSize: "10px",
                        color: "rgba(255, 255, 255, 0.7)",
                        lineHeight: "1.4",
                    }}>
                        {militaryReason}
                    </div>
                </div>
            )}

            {/* Properties */}
            <div className="entity-info-card__props">
                <div className="entity-info-card__prop">
                    <span className="entity-info-card__prop-key">Position</span>
                    <span className="entity-info-card__prop-value">
                        {hoveredEntity.latitude.toFixed(3)}°,{" "}
                        {hoveredEntity.longitude.toFixed(3)}°
                    </span>
                </div>
                {altitudeDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">
                            Altitude
                        </span>
                        <span className="entity-info-card__prop-value">
                            {altitudeDisplay}
                        </span>
                    </div>
                )}
                {speedDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">
                            Speed
                        </span>
                        <span className="entity-info-card__prop-value">
                            {speedDisplay}
                        </span>
                    </div>
                )}
                {headingDisplay && (
                    <div className="entity-info-card__prop">
                        <span className="entity-info-card__prop-key">
                            Heading
                        </span>
                        <span className="entity-info-card__prop-value">
                            {headingDisplay}
                        </span>
                    </div>
                )}

                {/* Military Bases: type / country / operator */}
                {hoveredEntity.pluginId === "militaryBases" && (
                    <>
                        {(hoveredEntity.properties?.type as string) && (
                            <div className="entity-info-card__prop">
                                <span className="entity-info-card__prop-key">Type</span>
                                <span className="entity-info-card__prop-value">{String(hoveredEntity.properties.type)}</span>
                            </div>
                        )}
                        {(hoveredEntity.properties?.country as string) && (
                            <div className="entity-info-card__prop">
                                <span className="entity-info-card__prop-key">Country</span>
                                <span className="entity-info-card__prop-value">{String(hoveredEntity.properties.country)}</span>
                            </div>
                        )}
                        {(hoveredEntity.properties?.operator as string) && (
                            <div className="entity-info-card__prop">
                                <span className="entity-info-card__prop-key">Operator</span>
                                <span className="entity-info-card__prop-value">{String(hoveredEntity.properties.operator)}</span>
                            </div>
                        )}
                    </>
                )}

                {/* Satellite-specific semantics */}
                {isSatellite && (
                    <>
                        <div className="entity-info-card__prop">
                            <span className="entity-info-card__prop-key">Marker</span>
                            <span className="entity-info-card__prop-value">satellite position</span>
                        </div>
                        {orbitPathShown && (
                            <div className="entity-info-card__prop">
                                <span className="entity-info-card__prop-key">Orbit Path</span>
                                <span className="entity-info-card__prop-value">shown (3D trajectory)</span>
                            </div>
                        )}
                        {groundTrackShown && (
                            <div className="entity-info-card__prop">
                                <span className="entity-info-card__prop-key">Ground Track</span>
                                <span className="entity-info-card__prop-value">shown (earth projection)</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer hint */}
            <div className="entity-info-card__hint">Click for details</div>
        </div>
    );
}
