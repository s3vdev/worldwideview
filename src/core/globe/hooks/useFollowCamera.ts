import { useEffect } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { useStore } from "@/core/state/store";
import { dataBus } from "@/core/data/DataBus";

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

        const controller = viewer.scene.screenSpaceCameraController;
        const stopFollowOnUserMove = () => {
            if (useStore.getState().followEntityId) setFollowEntityId(null);
        };
        controller.moveStart.addEventListener(stopFollowOnUserMove);
        controller.rotateStart.addEventListener(stopFollowOnUserMove);
        controller.zoomStart.addEventListener(stopFollowOnUserMove);

        return () => {
            unsubFollow();
            unsubStop();
            controller.moveStart.removeEventListener(stopFollowOnUserMove);
            controller.rotateStart.removeEventListener(stopFollowOnUserMove);
            controller.zoomStart.removeEventListener(stopFollowOnUserMove);
        };
    }, [viewer, isReady, setFollowEntityId]);
}
