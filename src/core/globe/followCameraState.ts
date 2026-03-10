/**
 * Flag used to avoid clearing follow when the AnimationLoop updates the camera programmatically.
 * Cesium fires camera.moveStart/moveEnd for programmatic changes; we skip stopFollow in that case.
 */
export let followUpdateInProgress = false;

export function setFollowUpdateInProgress(value: boolean): void {
    followUpdateInProgress = value;
}
