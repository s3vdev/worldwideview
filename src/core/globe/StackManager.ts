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
/** Tracks which stack each entity belongs to for ungrouping detection. */
const entityStackMembership = new Map<string, string>();
/** Last grid size that produced a successful grouping. */
let lastAppliedGridSize = 0;
/** Minimum interval (ms) between rebuilds to prevent rapid re-clustering. */
const REBUILD_COOLDOWN_MS = 300;
let lastRebuildMs = 0;

export function getStacks(): ReadonlyMap<string, EntityStack> { return stacks; }
export function getSpiderOffset(entityId: string): SpiderOffset | undefined { return spiderOffsets.get(entityId); }

// ── Coordinate key ──────────────────────────────────────────
let stackStateVersion = 0;
export function getStackStateVersion(): number { return stackStateVersion; }

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

/** Compute candidate grouping without mutating state. */
function computeGroups(existingMap: Map<string, AnimatableItem>, gridSize: number): Map<string, AnimatableItem[]> {
    const groups = new Map<string, AnimatableItem[]>();
    for (const item of existingMap.values()) {
        const key = coordKey(item.entity.pluginId, item.entity.latitude, item.entity.longitude, gridSize);
        let list = groups.get(key);
        if (!list) { list = []; groups.set(key, list); }
        list.push(item);
    }
    return groups;
}

/** Count how many entities are in groups of 2+. */
function countGroupedEntities(groups: Map<string, AnimatableItem[]>): number {
    let count = 0;
    for (const items of groups.values()) {
        if (items.length >= 2) count += items.length;
    }
    return count;
}

// ── Rebuild stacks after a render cycle or camera move ────────
export function rebuildStacks(existingMap: Map<string, AnimatableItem>, gridSizeDegrees: number = 0.01, force = false): void {
    const now = Date.now();

    // Cooldown: skip rebuilds that come too fast (unless forced, e.g. data change)
    if (!force && now - lastRebuildMs < REBUILD_COOLDOWN_MS) return;

    // Compute candidate grouping at the new grid size
    const candidateGroups = computeGroups(existingMap, gridSizeDegrees);
    const candidateGrouped = countGroupedEntities(candidateGroups);

    // Sticky guard: only block ungrouping when the grid size barely changed
    // (jitter at the same zoom level). A real zoom (>20% grid change) always applies.
    if (stacks.size > 0 && lastAppliedGridSize > 0 && !force) {
        const gridRatio = Math.abs(gridSizeDegrees - lastAppliedGridSize) / lastAppliedGridSize;
        if (gridRatio < 0.2) {
            const currentGrouped = countGroupedEntities(computeGroups(existingMap, lastAppliedGridSize));
            if (candidateGrouped < currentGrouped) return;
        }
    }

    lastRebuildMs = now;
    lastAppliedGridSize = gridSizeDegrees;
    applyGroups(candidateGroups);
}

/** Apply a computed grouping to the live stacks (mutates module state). */
function applyGroups(groups: Map<string, AnimatableItem[]>): void {
    // Remove stacks whose key no longer has 2+ items
    for (const key of stacks.keys()) {
        if (!groups.has(key) || (groups.get(key)!.length < 2)) {
            const stack = stacks.get(key)!;
            for (const child of stack.children) entityStackMembership.delete(child.entity.id);
            stacks.delete(key);
        }
    }

    // Create / update stacks (only groups with 2+ items)
    for (const [key, items] of groups) {
        if (items.length < 2) continue;
        const existing = stacks.get(key);
        if (existing) {
            let needsCollapse = existing.children.length !== items.length;
            if (!needsCollapse) {
                for (let i = 0; i < items.length; i++) {
                    if (existing.children[i].entity.id !== items[i].entity.id) {
                        needsCollapse = true;
                        break;
                    }
                }
            }

            existing.hubItem = items[0];
            existing.children = items;

            if (needsCollapse && (existing.state === "expanded" || existing.state === "expanding")) {
                existing.state = "collapsing";
                existing.stateStartMs = Date.now();
                stackStateVersion++;
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
        // Track membership
        for (const item of items) entityStackMembership.set(item.entity.id, key);
    }
}

// ── Ring offset assignment ──────────────────────────────────
function assignRingOffsets(stack: EntityStack): void {
    const count = stack.children.length;
    let outerRadius = 0;

    // Scale down spacing for mobile to match reduced icon size
    const spacingScale = (typeof window !== "undefined" && window.innerWidth <= 768) ? 0.7 : 1.0;

    // Use a single perfect circle for up to 18 items
    if (count <= 18) {
        // Dynamically scale radius based on count so they don't overlap.
        // Base circumference ~ 45 pixels per item
        const circumference = count * (45 * spacingScale);
        // Min radius 55 to avoid overlapping the central hub icon
        const radius = Math.max(55 * spacingScale, circumference / (2 * Math.PI));
        outerRadius = radius;

        for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count - Math.PI / 2; // start from top
            const childItem = stack.children[i];
            spiderOffsets.set(childItem.entity.id, {
                targetX: radius * Math.cos(angle),
                targetY: radius * Math.sin(angle),
                currentX: 0, currentY: 0,
            });
        }
    } else {
        // For large clusters, use a Fermat's spiral (sunflower) which packs evenly
        // and forms a beautiful, balanced cluster shape regardless of count.
        const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
        for (let i = 0; i < count; i++) {
            // i + 1 so we don't put the first item exactly at radius 0 (which is the hub)
            const n = i + 1;
            // Radius scales with sqrt of count to preserve uniform area/spacing
            const radius = (35 * spacingScale) * Math.sqrt(n);
            const angle = n * GOLDEN_ANGLE - Math.PI / 2;
            
            if (radius > outerRadius) outerRadius = radius;

            const childItem = stack.children[i];
            spiderOffsets.set(childItem.entity.id, {
                targetX: radius * Math.cos(angle),
                targetY: radius * Math.sin(angle),
                currentX: 0, currentY: 0,
            });
        }
    }

    stack.outerRadius = outerRadius;
}

// ── Expansion / Collapse triggers ───────────────────────────
export function expandStack(stackId: string): void {
    const s = stacks.get(stackId);
    if (!s || s.state === "expanded" || s.state === "expanding") return;
    s.state = "expanding";
    s.stateStartMs = Date.now();
    stackStateVersion++;
}

export function collapseStack(stackId: string): void {
    const s = stacks.get(stackId);
    if (!s || s.state === "collapsed" || s.state === "collapsing") return;
    s.state = "collapsing";
    s.stateStartMs = Date.now();
    stackStateVersion++;
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

/** Returns true if any stack is currently expanded or expanding. */
export function isAnyStackExpanded(): boolean {
    for (const s of stacks.values()) {
        if (s.state === "expanded" || s.state === "expanding") return true;
    }
    return false;
}

/** Returns true if the given entity is inside a stack that is currently expanded or expanding. */
export function isEntityInExpandedStack(entityId: string): boolean {
    const stackId = entityStackMembership.get(entityId);
    if (!stackId) return false;
    const s = stacks.get(stackId);
    return !!s && (s.state === "expanded" || s.state === "expanding");
}

/** Returns true if the entity is part of any stack (group of 2+) */
export function isEntityClustered(entityId: string): boolean {
    return entityStackMembership.has(entityId);
}

/** Given an entity ID, returns the central hub's position if it's clustered, or undefined if it's standalone. */
export function getEntityTargetPosition(entityId: string) {
    const stackId = entityStackMembership.get(entityId);
    if (!stackId) return undefined;
    return stacks.get(stackId)?.hubItem.posRef;
}
