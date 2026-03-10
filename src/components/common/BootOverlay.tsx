"use client";

import "./BootOverlay.css";

interface BootOverlayProps {
    visible: boolean;
}

/**
 * Full-screen startup overlay with "Initializing Systems..." message.
 * Shown during app boot; fades out when boot sequence advances.
 */
export function BootOverlay({ visible }: BootOverlayProps) {
    return (
        <div className={`boot-overlay ${visible ? "" : "boot-overlay--hidden"}`}>
            <div className="boot-overlay__rings">
                <div className="boot-overlay__ring boot-overlay__ring--1" />
                <div className="boot-overlay__ring boot-overlay__ring--2" />
                <div className="boot-overlay__ring boot-overlay__ring--3" />
                <div className="boot-overlay__core" />
            </div>
            <div className="boot-overlay__title">WorldWideView</div>
            <div className="boot-overlay__status">Initializing Systems...</div>
        </div>
    );
}
