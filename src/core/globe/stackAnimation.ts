/**
 * stackAnimation — Per-frame lerping of spider offsets and hub badge management.
 *
 * Called from the AnimationLoop every frame. Smoothly interpolates
 * pixelOffset towards the target (expand) or back to zero (collapse).
 * Uses a dedicated persistent Billboard per stack for the textual hub badge.
 */
import { Cartesian2, Cartesian3, HorizontalOrigin, VerticalOrigin, NearFarScalar } from "cesium";
import type { LabelCollection, BillboardCollection } from "cesium";
import {
    getStacks, getSpiderOffset,
    type EntityStack,
} from "./StackManager";

/** Scale hub icons down when zooming out. */
const hubScaleByDistance = new NearFarScalar(2.0e6, 1.0, 1.5e7, 0.5);

/** Duration of expand/collapse animation in ms. */
const ANIM_DURATION_MS = 220;

/** Reusable scratch Cartesian2 to avoid allocation. */
const scratchOffset = new Cartesian2();

/** Tracks the dedicated textual badge primitive for each stack. */
const hubBillboards = new Map<string, any>();

/** Generates a base64 encoded SVG for the cluster hub icon. */
function getClusterIcon(count: number, hexColor: string): string {
    const size = 36;
    const center = size / 2;
    const textStr = count > 99 ? '99+' : count.toString();
    const fillValue = "rgba(15, 23, 42, 0.95)";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <circle cx="${center}" cy="${center}" r="16" fill="${fillValue}" stroke="${hexColor}" stroke-width="2.5"/>
        <text x="${center}" y="${center + 1}" font-family="Inter, sans-serif" font-size="14px" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${textStr}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Lerp a single value. */
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/**
 * Run one animation tick for all stacks.
 * Returns true if ANY stack is currently animating (requiring a continuous render).
 */
export function tickStackAnimation(labels: LabelCollection | null, billboards: BillboardCollection | null): boolean {
    const now = Date.now();
    const activeStacks = getStacks();
    let needsRender = false;
    
    // 1. Garbage Collect abandoned hub billboards
    for (const [stackId, bb] of hubBillboards.entries()) {
        if (!activeStacks.has(stackId)) {
            if (billboards) billboards.remove(bb);
            hubBillboards.delete(stackId);
            needsRender = true;
        }
    }

    // 2. Tick active stacks
    for (const stack of activeStacks.values()) {
        const running = tickSingle(stack, now, billboards);
        if (running) needsRender = true;
    }

    return needsRender;
}

function tickSingle(stack: EntityStack, now: number, billboards: BillboardCollection | null): boolean {
    const { state, stateStartMs, children } = stack;
    const elapsed = now - stateStartMs;
    const t = Math.min(elapsed / ANIM_DURATION_MS, 1.0);

    const isOpen = state === "expanding" || state === "expanded";
    const isClosed = state === "collapsed" || state === "collapsing";
    const isAnimating = state === "expanding" || state === "collapsing";

    // Transition end
    if (state === "expanding" && t >= 1) stack.state = "expanded";
    if (state === "collapsing" && t >= 1) stack.state = "collapsed";

    // Animate ALL children (no one is left behind!)
    for (let i = 0; i < children.length; i++) {
        const item = children[i];
        const prim = item.primitive;
        if (!prim || prim.isDestroyed?.()) continue;

        const offset = getSpiderOffset(item.entity.id);
        if (!offset) continue;

        // Animate pixel offset
        if (state === "expanding") {
            offset.currentX = lerp(0, offset.targetX, easeOut(t));
            offset.currentY = lerp(0, offset.targetY, easeOut(t));
        } else if (state === "collapsing") {
            offset.currentX = lerp(offset.targetX, 0, easeOut(t));
            offset.currentY = lerp(offset.targetY, 0, easeOut(t));
        } else if (state === "expanded") {
            offset.currentX = offset.targetX;
            offset.currentY = offset.targetY;
        } else {
            // collapsed — snap to zero
            offset.currentX = 0;
            offset.currentY = 0;
        }

        // Apply pixel offset
        if (prim.pixelOffset !== undefined) {
            Cartesian2.fromElements(offset.currentX, offset.currentY, scratchOffset);
            prim.pixelOffset = scratchOffset;
        }

        // Parent point primitives have no pixelOffset support natively, 
        // they just won't fan out cleanly unless using billboards, but this project heavily uses billboards.

        // Show/hide child items
        if (isClosed && t >= 1) {
            if (prim.show) prim.show = false;
        } else if (isOpen || state === "collapsing") {
            if (!prim.show) prim.show = true;
        }
    }

    // Manage the dedicated central Hub Billboard
    if (billboards && stack.children.length > 1) {
        manageDedicatedHub(stack, billboards);
    }

    return isAnimating;
}

function manageDedicatedHub(stack: EntityStack, billboards: BillboardCollection) {
    let bb = hubBillboards.get(stack.id);
    const count = stack.children.length;
    const cssColor = stack.hubItem.baseColor?.toCssColorString() ?? "#ffffff";
    const expectedImage = getClusterIcon(count, cssColor);

    if (!bb || bb.isDestroyed?.()) {
        bb = billboards.add({
            position: stack.hubItem.posRef,
            image: expectedImage,
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.CENTER,
            disableDepthTestDistance: 500_000,
            pixelOffset: new Cartesian2(0, 0),
            scaleByDistance: hubScaleByDistance,
            show: true,
            // Tag with same ID as top entity! So clicking it triggers interaction/selection.
            id: { _wwvEntity: stack.hubItem.entity }
        });
        hubBillboards.set(stack.id, bb);
    } else {
        // Update position if moved
        if (!Cartesian3.equals(bb.position, stack.hubItem.posRef)) {
            bb.position = stack.hubItem.posRef;
        }
        if (bb.image !== expectedImage) bb.image = expectedImage;
        // Always ensure it's shown, it persists even when expanded!
        if (!bb.show) bb.show = true;
    }
}

/** Ease-out cubic for smooth deceleration. */
function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}
