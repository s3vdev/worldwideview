"use client";

import { useEffect, useState, useRef } from "react";
import { dataBus } from "@/core/data/DataBus";

const ANIM_DURATION_MS = 2400;

/**
 * Location pin overlay shown after search/Go-To camera fly-to.
 * Listens for showLocationPin; displays a brief pin animation at screen center.
 */
export function LocationPinOverlay() {
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsub = dataBus.on("showLocationPin", () => {
            setVisible(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setVisible(false), ANIM_DURATION_MS);
        });
        return () => {
            unsub();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            className="location-pin-overlay"
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                zIndex: 9999,
            }}
        >
            <div className="location-pin-ripple" />
            <div className="location-pin-icon">
                <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M20 0C8.954 0 0 8.954 0 20C0 34 20 52 20 52C20 52 40 34 40 20C40 8.954 31.046 0 20 0Z"
                        fill="rgba(255, 220, 60, 0.95)"
                    />
                    <circle cx="20" cy="20" r="8" fill="rgba(0,0,0,0.55)" />
                </svg>
            </div>
            <style>{`
                @keyframes pin-drop {
                    0%   { transform: translateY(-60px); opacity: 0; }
                    30%  { transform: translateY(6px);   opacity: 1; }
                    45%  { transform: translateY(-10px); }
                    55%  { transform: translateY(3px); }
                    65%  { transform: translateY(0);     }
                    80%  { transform: translateY(0);   opacity: 1; }
                    100% { transform: translateY(0);   opacity: 0; }
                }
                @keyframes ripple-out {
                    0%   { transform: scale(0.2); opacity: 0.7; }
                    100% { transform: scale(3.5); opacity: 0;   }
                }
                .location-pin-icon {
                    position: absolute;
                    transform: translateY(-26px);
                    animation: pin-drop 2.4s cubic-bezier(0.4, 0, 0.6, 1) forwards;
                    filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5));
                }
                .location-pin-ripple {
                    position: absolute;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: 3px solid rgba(255, 220, 60, 0.8);
                    animation: ripple-out 1.4s ease-out 1.2s forwards;
                }
                .location-pin-ripple::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    border: 3px solid rgba(255, 200, 30, 0.5);
                    animation: ripple-out 1.4s ease-out 1.5s forwards;
                }
            `}</style>
        </div>
    );
}
