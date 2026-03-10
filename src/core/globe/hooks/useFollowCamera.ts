import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { Cartesian3 } from "cesium";
import { useStore } from "@/core/state/store";

const FOLLOW_INTERVAL_MS = 500;
const FOLLOW_ALTITUDE_OFFSET = 8000; // meters above entity

/**
 * When followEntityId is set, smoothly updates the camera to track that entity.
 * Stops when entity is not found (e.g. disappeared from data) or followEntityId is cleared.
 */
export function useFollowCamera(viewer: CesiumViewer | null, isReady: boolean) {
    const followEntityId = useStore((s) => s.followEntityId);
    const setFollowEntityId = useStore((s) => s.setFollowEntityId);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!viewer || !isReady) return;

        const tick = () => {
            const id = useStore.getState().followEntityId;
            if (!id) return;

            const entitiesByPlugin = useStore.getState().entitiesByPlugin;
            const allEntities = Object.values(entitiesByPlugin).flat();
            const entity = allEntities.find((e) => e.id === id);

            if (!entity) {
                useStore.getState().setFollowEntityId(null);
                return;
            }

            const lon = entity.longitude;
            const lat = entity.latitude;
            const alt = entity.altitude ?? 0;
            const destination = Cartesian3.fromDegrees(
                lon,
                lat,
                Math.max(alt + FOLLOW_ALTITUDE_OFFSET, 10000)
            );

            viewer.camera.flyTo({
                destination,
                duration: 0.4,
                complete: undefined,
            });
        };

        if (followEntityId) {
            tick();
            intervalRef.current = setInterval(tick, FOLLOW_INTERVAL_MS);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [viewer, isReady, followEntityId, setFollowEntityId]);
}
