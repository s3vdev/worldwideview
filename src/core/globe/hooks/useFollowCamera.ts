import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";
import { followUpdateInProgress } from "../followCameraState";

/**
 * Subscribes to dataBus followEntity/stopFollow and stops follow on manual camera move.
 * Actual camera tracking runs every frame inside AnimationLoop (no setInterval, no flyTo).
 */
export function useFollowCamera(viewer: CesiumViewer | null, isReady: boolean) {
    const setFollowEntityId = useStore((s) => s.setFollowEntityId);

    useEffect(() => {
        if (!viewer || !isReady) return;

        const unsubFollow = dataBus.on("followEntity", ({ id }) => {
            setFollowEntityId(id);
        });
        const unsubStop = dataBus.on("stopFollow", () => {
            setFollowEntityId(null);
        });

        const camera = viewer.camera;
        const stopFollowOnUserMove = () => {
            if (followUpdateInProgress) return;
            if (useStore.getState().followEntityId) setFollowEntityId(null);
        };
        camera.moveStart.addEventListener(stopFollowOnUserMove);
        camera.moveEnd.addEventListener(stopFollowOnUserMove);

        return () => {
            unsubFollow();
            unsubStop();
            camera.moveStart.removeEventListener(stopFollowOnUserMove);
            camera.moveEnd.removeEventListener(stopFollowOnUserMove);
        };
    }, [viewer, isReady, setFollowEntityId]);
}
