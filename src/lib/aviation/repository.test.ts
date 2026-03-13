import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing repository
vi.mock("../db", () => {
    const mockPrisma = {
        aviationHistory: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            createMany: vi.fn(),
        },
    };
    return { prisma: mockPrisma };
});

import { prisma } from "../db";
import {
    getLatestFromDb,
    recordToDb,
    getAvailabilityRange,
    getHistoryAtTime,
} from "./repository";

const mockAviationHistory = prisma.aviationHistory as {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
};

describe("Aviation Repository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getLatestFromDb", () => {
        it("returns null when database is empty", async () => {
            mockAviationHistory.findFirst.mockResolvedValue(null);
            const result = await getLatestFromDb();
            expect(result).toBeNull();
        });

        it("returns formatted states from latest timestamp", async () => {
            const ts = new Date("2025-01-01T00:00:00Z");
            mockAviationHistory.findFirst.mockResolvedValue({ timestamp: ts });
            mockAviationHistory.findMany.mockResolvedValue([
                {
                    icao24: "abc123",
                    callsign: "TEST01",
                    timestamp: ts,
                    latitude: 40.0,
                    longitude: -74.0,
                    altitude: 10000,
                    speed: 250,
                    heading: 90,
                },
            ]);

            const result = await getLatestFromDb();

            expect(result).not.toBeNull();
            expect(result!._source).toBe("db");
            expect(result!._isFallback).toBe(true);
            expect(result!.states).toHaveLength(1);
            expect(result!.states[0][0]).toBe("abc123"); // icao24
            expect(result!.states[0][5]).toBe(-74.0); // longitude
            expect(result!.states[0][6]).toBe(40.0); // latitude
        });

        it("returns null if records list is empty", async () => {
            const ts = new Date("2025-01-01T00:00:00Z");
            mockAviationHistory.findFirst.mockResolvedValue({ timestamp: ts });
            mockAviationHistory.findMany.mockResolvedValue([]);

            const result = await getLatestFromDb();
            expect(result).toBeNull();
        });

        it("returns null and logs on error", async () => {
            mockAviationHistory.findFirst.mockRejectedValue(new Error("DB fail"));
            const result = await getLatestFromDb();
            expect(result).toBeNull();
        });
    });

    describe("recordToDb", () => {
        it("inserts valid states via createMany", async () => {
            mockAviationHistory.createMany.mockResolvedValue({ count: 1 });

            const states = [
                ["abc123", "TEST01 ", null, 1000, 1000, -74.0, 40.0, 10000, false, 250, 90],
            ];
            await recordToDb(states, 1000);

            expect(mockAviationHistory.createMany).toHaveBeenCalledOnce();
            const call = mockAviationHistory.createMany.mock.calls[0][0];
            expect(call.data[0].icao24).toBe("abc123");
            expect(call.data[0].callsign).toBe("TEST01");
            expect(call.data[0].longitude).toBe(-74.0);
        });

        it("skips states with null coordinates", async () => {
            const states = [
                ["abc123", "TEST01", null, 1000, 1000, null, null, null, false, null, null],
            ];
            await recordToDb(states, 1000);

            expect(mockAviationHistory.createMany).not.toHaveBeenCalled();
        });

        it("handles empty states array", async () => {
            await recordToDb([], 1000);
            expect(mockAviationHistory.createMany).not.toHaveBeenCalled();
        });
    });

    describe("getAvailabilityRange", () => {
        it("returns empty array when no data exists", async () => {
            mockAviationHistory.findFirst.mockResolvedValue(null);
            const result = await getAvailabilityRange();
            expect(result).toEqual([]);
        });

        it("returns start/end range from database", async () => {
            const minTs = new Date("2025-01-01T00:00:00Z");
            const maxTs = new Date("2025-01-02T00:00:00Z");
            mockAviationHistory.findFirst
                .mockResolvedValueOnce({ timestamp: minTs })
                .mockResolvedValueOnce({ timestamp: maxTs });

            const result = await getAvailabilityRange();
            expect(result).toHaveLength(1);
            expect(result[0].start).toBe(minTs.getTime());
            expect(result[0].end).toBe(maxTs.getTime());
        });
    });

    describe("getHistoryAtTime", () => {
        it("returns empty records when no data before target", async () => {
            mockAviationHistory.findFirst.mockResolvedValue(null);
            const result = await getHistoryAtTime(Date.now());
            expect(result.records).toEqual([]);
            expect(result.recordTime).toBeNull();
        });

        it("returns records at closest timestamp", async () => {
            const ts = new Date("2025-01-01T12:00:00Z");
            mockAviationHistory.findFirst.mockResolvedValue({ timestamp: ts });
            mockAviationHistory.findMany.mockResolvedValue([
                { icao24: "abc123", timestamp: ts, latitude: 40, longitude: -74, altitude: 10000, heading: 90, speed: 250, callsign: "TEST" },
            ]);

            const result = await getHistoryAtTime(ts.getTime() + 60000);
            expect(result.records).toHaveLength(1);
            expect(result.recordTime).toBe(ts.getTime());
        });
    });
});
