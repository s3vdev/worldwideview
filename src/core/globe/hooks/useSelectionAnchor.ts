import { useEffect } from "react";
import type { Viewer as CesiumViewer, Entity as CesiumEntity } from "cesium";
import { Cartesian3, CallbackProperty } from "cesium";
import type { AnimatableItem } from "../EntityRenderer";

const SELECTION_BOX_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- Top Left -->
  <path d="M 20 2 L 2 2 L 2 20" fill="none" stroke="#00fff7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Bottom Left -->
  <path d="M 2 44 L 2 62 L 20 62" fill="none" stroke="#00fff7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Top Right -->
  <path d="M 44 2 L 62 2 L 62 20" fill="none" stroke="#00fff7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Bottom Right -->
  <path d="M 62 44 L 62 62 L 44 62" fill="none" stroke="#00fff7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`)}`;

export function useSelectionAnchor(
    viewer: CesiumViewer | null,
    isReady: boolean,
    selectedEntity: any,
    lockedEntityId: string | null,
    selectionEntityRef: React.MutableRefObject<CesiumEntity | null>,
    animatablesMapRef: React.MutableRefObject<Map<string, AnimatableItem>>
) {
    // Initialization of Selection Entity
    useEffect(() => {
        if (!viewer || viewer.isDestroyed() || !isReady) return;

        let entity: CesiumEntity | null = null;
        try {
            // Create a hidden entity for camera tracking/flying
            if (!viewer.entities) {
                console.warn("[GlobeView] Viewer entities collection not available during selection anchor init");
                return;
            }

            entity = viewer.entities.add({
                id: "__wwv_selection_anchor",
                point: {
                    pixelSize: 0,
                },
                billboard: {
                    image: SELECTION_BOX_SVG,
                    width: 56,
                    height: 56,
                    show: false,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY, // Always rendered on top
                } as any
            });
            selectionEntityRef.current = entity;
        } catch (error) {
            console.warn("[GlobeView] Error accessing viewer entities:", error);
            return;
        }

        return () => {
            try {
                if (viewer && !viewer.isDestroyed() && viewer.entities && entity) {
                    viewer.entities.remove(entity);
                }
            } catch (error) {
                // Ignore cleanup errors if viewer is partially destroyed
            }
        };
    }, [viewer, isReady, selectionEntityRef]);

    // Update Selection Entity Position — use CallbackProperty to track extrapolated position
    useEffect(() => {
        const selectionEntity = selectionEntityRef.current;
        if (!selectionEntity) return;

        if (selectionEntity.billboard) {
            selectionEntity.billboard.show = (!!selectedEntity && lockedEntityId !== selectedEntity.id) as any;
        }

        if (!selectedEntity) return;

        const entityId = selectedEntity.id;

        // Use a CallbackProperty so viewer.trackedEntity follows the
        // extrapolated position in real-time, not just the polled position.
        const fallbackPos = Cartesian3.fromDegrees(
            selectedEntity.longitude,
            selectedEntity.latitude,
            selectedEntity.altitude || 0
        );

        selectionEntity.position = new CallbackProperty(() => {
            const item = animatablesMapRef.current?.get(entityId);
            return item ? item.posRef : fallbackPos;
        }, false) as any;
    }, [selectedEntity, lockedEntityId, selectionEntityRef, animatablesMapRef]);
}
