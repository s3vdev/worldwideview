/**
 * DOD: Color cache and scratch allocations for the rendering pipeline.
 *
 * Centralizes cache utilities that are shared across EntityRenderer,
 * AnimationLoop, and other rendering modules.
 */
import { Cartesian3, Color, Ellipsoid } from "cesium";
import type { CesiumEntityOptions } from "@/core/plugins/PluginTypes";
import type { AnimatableItem } from "./EntityRenderer";

// ── Scratch Cartesian3 for position computation ─────────────
// Reused across all renderSingleEntity calls to avoid heap alloc per entity.
export const scratchPosition = new Cartesian3();

// ── Color cache ─────────────────────────────────────────────
// Deduplicates Color objects by CSS string. Most plugins reuse a
// small set of colors (e.g. altitude bands), avoiding thousands
// of Color.fromCssColorString() calls per render cycle.
const colorCache = new Map<string, Color>();

/** Resolve a CSS color string to a cached Color instance. */
export function getCachedColor(css: string | undefined): Color {
    if (!css) return Color.CYAN;
    let c = colorCache.get(css);
    if (!c) {
        c = Color.fromCssColorString(css);
        colorCache.set(css, c);
    }
    return c;
}

/**
 * Resolve entity color from options, defaulting to cyan.
 * Uses the color cache for zero-allocation on repeated CSS strings.
 */
export function getEntityColor(options: CesiumEntityOptions): Color {
    return getCachedColor(options.color);
}

// ── Stable array cache ──────────────────────────────────────
// Avoids Array.from(map.values()) allocation every render cycle.
let stableAnimatables: AnimatableItem[] = [];
let stableArrayDirty = true;

/** Mark that the animatables map changed and the stable array needs rebuilding. */
export function markAnimatablesDirty(): void {
    stableArrayDirty = true;
}

/** Return a stable array of AnimatableItems, only rebuilding when dirty. */
export function getStableAnimatables(map: Map<string, AnimatableItem>): AnimatableItem[] {
    if (stableArrayDirty) {
        stableAnimatables = Array.from(map.values());
        stableArrayDirty = false;
    }
    return stableAnimatables;
}
