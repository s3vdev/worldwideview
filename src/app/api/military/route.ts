import { NextResponse } from "next/server";
import { getCachedMilitaryData, fetchMilitaryIfNeeded } from "@/lib/military";

export async function GET() {
    await fetchMilitaryIfNeeded();
    const cache = getCachedMilitaryData();

    if (cache.data) {
        return NextResponse.json(cache.data);
    }

    return NextResponse.json(
        { ac: [], total: 0, now: Date.now() },
        { status: 200 },
    );
}
