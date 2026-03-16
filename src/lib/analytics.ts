/**
 * Umami analytics helper.
 *
 * Wraps `window.umami.track()` with:
 *  - Null-safety (no-op when the tracker hasn't loaded or is blocked)
 *  - A single import for every call-site
 *
 * Usage:
 *   import { trackEvent } from "@/lib/analytics";
 *   trackEvent("layer-toggle", { layer: "aviation", enabled: true });
 */

type EventData = Record<string, string | number | boolean>;

/**
 * Fire a custom Umami event.
 * Silently no-ops if the Umami script hasn't loaded (e.g. ad-blockers).
 */
export function trackEvent(name: string, data?: EventData): void {
    try {
        window.umami?.track(name, data);
    } catch {
        // Swallow — analytics must never break the app
    }
}
