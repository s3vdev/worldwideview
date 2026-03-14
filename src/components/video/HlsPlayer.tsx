"use client";

import React, { useRef, useEffect, useCallback } from "react";

interface HlsPlayerProps {
    src: string;
    onReady?: () => void;
    onError?: (message: string) => void;
}

/**
 * Video player that handles HLS (.m3u8) streams.
 *
 * - Safari/iOS: uses native HLS support via <video>.
 * - Other browsers: dynamically imports hls.js to demux the stream.
 */
export const HlsPlayer: React.FC<HlsPlayerProps> = ({ src, onReady, onError }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);

    const cleanup = useCallback(() => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        let cancelled = false;

        // Safari / iOS have native HLS support
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = src;
            video.addEventListener("loadeddata", () => onReady?.(), { once: true });
            video.addEventListener(
                "error",
                () => onError?.("Native HLS playback failed. The stream may be offline or blocked by CORS."),
                { once: true },
            );
            return () => {
                cancelled = true;
                video.src = "";
            };
        }

        // Dynamically import hls.js for non-Safari browsers
        import("hls.js").then((mod) => {
            if (cancelled) return;
            const Hls = mod.default;

            if (!Hls.isSupported()) {
                onError?.("HLS playback is not supported in this browser.");
                return;
            }

            cleanup(); // teardown any previous instance

            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            if (cancelled) {
                hls.destroy();
                return;
            }
            hlsRef.current = hls;

            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (cancelled) return;
                onReady?.();
                video.play().catch(() => {
                    // Autoplay may be blocked — not critical
                });
            });

            hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal?: boolean; details?: string }) => {
                if (data.fatal) {
                    const detail = data.details || "unknown error";
                    onError?.(`HLS Error: ${detail}. The stream may be offline or blocked by CORS.`);
                    hls.destroy();
                    hlsRef.current = null;
                }
            });
        }).catch(() => {
            if (!cancelled) onError?.("Failed to load HLS player library.");
        });

        return () => {
            cancelled = true;
            cleanup();
        };
    }, [src, onReady, onError, cleanup]);

    return (
        <video
            ref={videoRef}
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backgroundColor: "black",
            }}
            autoPlay
            muted
            playsInline
            controls
        />
    );
};
