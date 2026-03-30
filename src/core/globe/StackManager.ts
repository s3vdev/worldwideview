/**
 * StackManager — Groups co-located entities into expandable "stacks".
 *
 * When multiple entities share the same coordinates they visually overlap.
 * This module detects those groups, assigns concentric ring target offsets,
 * and exposes expansion state so the AnimationLoop can smoothly fan them out.
 */
import type { AnimatableItem } from "./EntityRenderer";

// ── Ring layout constants ───────────────────────────────────
/** Max items per ring, and pixel radius for each concentric ring. */
const RINGS = [
    { capacity: 8,  radius: 55 },
    { capacity: 14, radius: 100 },
    { capacity: 20, radius: 145 },
    { capacity: 26, radius: 190 },
];

/** Collapse when mouse is this many pixels beyond the outermost ring. */
export const COLLAPSE_PADDING_PX = 40;

// ── Types ───────────────────────────────────────────────────
export type StackState = "collapsed" | "expanding" | "expanded" | "collapsing";

export interface EntityStack {
    id: string;                       // hash key (rounded lat,lon)
    hubItem: AnimatableItem;          // first item — visible when collapsed
    children: AnimatableItem[];       // all items INCLUDING hub
    state: StackState;
    /** Timestamp (ms) when the state last transitioned. */
    stateStartMs: number;
    /** Outermost ring radius in pixels (for collapse distance check). */
    outerRadius: number;
}

/** Pixel offset target assigned to each AnimatableItem inside a stack. */
export interface SpiderOffset {
    targetX: number;
    targetY: number;
    currentX: number;
    currentY: number;
}

// ── Module state ────────────────────────────────────────────
const stacks = new Map<string, EntityStack>();
const spiderOffsets = new Map<string, SpiderOffset>();

export function getStacks(): ReadonlyMap<string, EntityStack> { return stacks; }
export function getSpiderOffset(entityId: string): SpiderOffset | undefined { return spiderOffsets.get(entityId); }

// ── Coordinate key ──────────────────────────────────────────
/** Calculate dynamic grid size based on camera altitude. */
export function calculateGridSizeDegrees(altitude: number): number {
    return Math.max(0.005, (altitude * 0.05) / 111320);
}

/** Group lat/lon by dynamic grid size to support zoom-based clustering. */
function coordKey(pluginId: string, lat: number, lon: number, gridSizeDegrees: number): string {
    const gridLat = Math.round(lat / gridSizeDegrees) * gridSizeDegrees;
    const gridLon = Math.round(lon / gridSizeDegrees) * gridSizeDegrees;
    return `${pluginId}_${gridLat.toFixed(4)},${gridLon.toFixed(4)}`;
}

// ── Rebuild stacks after a render cycle or camera move ────────
export function rebuildStacks(existingMap: Map<string, AnimatableItem>, gridSizeDegrees: number = 0.01): void {
    // Group by coordinate key per plugin
    const groups = new Map<string, AnimatableItem[]>();
    for (const item of existingMap.values()) {
        const key = coordKey(item.entity.pluginId, item.entity.latitude, item.entity.longitude, gridSizeDegrees);
        let list = groups.get(key);
        if (!list) { list = []; groups.set(key, list); }
        list.push(item);
    }

    // Remove stacks that no longer exist
    for (const key of stacks.keys()) {
        if (!groups.has(key) || (groups.get(key)!.length < 2)) {
            stacks.delete(key);
        }
    }

    // Create / update stacks (only groups with 2+ items)
    for (const [key, items] of groups) {
        if (items.length < 2) continue;
        const existing = stacks.get(key);
        if (existing) {
            existing.hubItem = items[0];
            existing.children = items;
            
            // Force collapse if cluster survived rebuild but needs resizing/re-grouping
            if (existing.state === "expanded" || existing.state === "expanding") {
                existing.state = "collapsing";
                existing.stateStartMs = Date.now();
            }
            
            assignRingOffsets(existing);
        } else {
            const stack: EntityStack = {
                id: key, hubItem: items[0], children: items,
                state: "collapsed", stateStartMs: Date.now(), outerRadius: 0,
            };
            assignRingOffsets(stack);
            stacks.set(key, stack);
        }
    }
}

// ── Ring offset assignment ──────────────────────────────────
function assignRingOffsets(stack: EntityStack): void {
    let placed = 0;
    let outerRadius = 0;

    for (let ri = 0; ri < RINGS.length && placed < stack.children.length; ri++) {
        const ring = RINGS[ri];
        const count = Math.min(ring.capacity, stack.children.length - placed);
        for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count - Math.PI / 2; // start from top
            const childItem = stack.children[placed + i];
            spiderOffsets.set(childItem.entity.id, {
                targetX: ring.radius * Math.cos(angle),
                targetY: ring.radius * Math.sin(angle),
                currentX: 0, currentY: 0,
            });
        }
        placed += count;
        outerRadius = ring.radius;
    }
    stack.outerRadius = outerRadius;
}

// ── Expansion / Collapse triggers ───────────────────────────
export function expandStack(stackId: string): void {
    const s = stacks.get(stackId);
    if (!s || s.state === "expanded" || s.state === "expanding") return;
    s.state = "expanding";
    s.stateStartMs = Date.now();
}

export function collapseStack(stackId: string): void {
    const s = stacks.get(stackId);
    if (!s || s.state === "collapsed" || s.state === "collapsing") return;
    s.state = "collapsing";
    s.stateStartMs = Date.now();
}

/** Find the stack that contains a given entity id. */
export function findStackByEntityId(entityId: string): EntityStack | undefined {
    for (const s of stacks.values()) {
        if (s.children.some(c => c.entity.id === entityId)) return s;
    }
    return undefined;
}

/** Check if an entity is a hub (leader) of any stack. */
export function isHubEntity(entityId: string): boolean {
    for (const s of stacks.values()) {
        if (s.hubItem.entity.id === entityId) return true;
    }
    return false;
}
