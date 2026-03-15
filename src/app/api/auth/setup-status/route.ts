import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Lightweight endpoint for middleware to check if first-run setup is needed. */
export async function GET() {
    const count = await prisma.user.count();
    return NextResponse.json({ needsSetup: count === 0 });
}
