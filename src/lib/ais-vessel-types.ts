/**
 * AIS vessel type code (0–99) to UI category mapping.
 * Reference: ITU-R M.1371, common ranges (20–29 WIG, 30–39 fishing/towing/sailing/military, etc.)
 * Raw code is kept in metadata; this drives display category and filters.
 */
export type MaritimeVesselCategory =
    | "cargo"
    | "tanker"
    | "passenger"
    | "fishing"
    | "tug"
    | "sailing"
    | "military"
    | "other";

const CATEGORY_OTHER: MaritimeVesselCategory = "other";

/**
 * Map AIS ship type code (0–99) to UI category. Returns "other" for unknown/invalid.
 */
export function aisShipTypeToCategory(shipType: number | null | undefined): MaritimeVesselCategory {
    if (shipType == null || typeof shipType !== "number" || shipType < 0 || shipType > 99) {
        return CATEGORY_OTHER;
    }
    // 0 = not available
    if (shipType === 0) return CATEGORY_OTHER;
    // 20–29: Wing in ground
    if (shipType >= 20 && shipType <= 29) return "other";
    // 30–39: Fishing (30), Towing (31–32), Dredging (33), Diving (34), Military (35), Sailing (36), Pleasure (37)
    if (shipType >= 30 && shipType <= 39) {
        if (shipType === 30) return "fishing";
        if (shipType === 31 || shipType === 32) return "tug";
        if (shipType === 35) return "military";
        if (shipType === 36) return "sailing";
        return "other";
    }
    // 40–49: High speed craft
    if (shipType >= 40 && shipType <= 49) return "passenger";
    // 50–59: Pilot (50), SAR (51), Tug (52), Port Tender (53), Law enforcement (55), etc.
    if (shipType >= 50 && shipType <= 59) {
        if (shipType === 50 || shipType === 52 || shipType === 53) return "tug";
        if (shipType === 55) return "military";
        return "other";
    }
    // 60–69: Passenger
    if (shipType >= 60 && shipType <= 69) return "passenger";
    // 70–79: Cargo
    if (shipType >= 70 && shipType <= 79) return "cargo";
    // 80–89: Tanker
    if (shipType >= 80 && shipType <= 89) return "tanker";
    // 90–99: Other
    if (shipType >= 90 && shipType <= 99) return "other";
    return CATEGORY_OTHER;
}

export const MARITIME_CATEGORIES: MaritimeVesselCategory[] = [
    "cargo",
    "tanker",
    "passenger",
    "fishing",
    "tug",
    "sailing",
    "military",
    "other",
];
