"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaritimePlugin = void 0;
var lucide_react_1 = require("lucide-react");
var VESSEL_COLORS = {
    cargo: "#f59e0b",
    tanker: "#ef4444",
    passenger: "#3b82f6",
    fishing: "#22d3ee",
    military: "#a78bfa",
    sailing: "#4ade80",
    tug: "#f97316",
    other: "#94a3b8",
};
function getVesselColor(type) {
    var lower = type.toLowerCase();
    for (var _i = 0, _a = Object.entries(VESSEL_COLORS); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], color = _b[1];
        if (lower.includes(key))
            return color;
    }
    return VESSEL_COLORS.other;
}
function generateDemoVessels() {
    var vessels = [
        { name: "EVER GIVEN", mmsi: "353136000", type: "cargo", lat: 30.0, lon: 32.5, speed: 12.5, heading: 340 },
        { name: "MAERSK SEALAND", mmsi: "220417000", type: "cargo", lat: 51.9, lon: 1.2, speed: 15.0, heading: 210 },
        { name: "PACIFIC RUBY", mmsi: "538004561", type: "tanker", lat: 1.2, lon: 103.7, speed: 8.3, heading: 125 },
        { name: "QUEEN MARY 2", mmsi: "310627000", type: "passenger", lat: 40.6, lon: -74.0, speed: 22.0, heading: 90 },
        { name: "OCEAN EXPLORER", mmsi: "245390000", type: "fishing", lat: -33.8, lon: 18.4, speed: 4.2, heading: 180 },
        { name: "ARCTIC SUNRISE", mmsi: "246585000", type: "other", lat: 69.0, lon: 18.0, speed: 6.0, heading: 45 },
        { name: "BLUE MARLIN", mmsi: "244870698", type: "cargo", lat: 22.3, lon: 113.9, speed: 10.5, heading: 270 },
        { name: "STENA BULK", mmsi: "265548750", type: "tanker", lat: 57.7, lon: 11.9, speed: 12.0, heading: 300 },
        { name: "SPIRIT OF BRITAIN", mmsi: "235082198", type: "passenger", lat: 50.9, lon: 1.4, speed: 20.0, heading: 160 },
        { name: "DEEP BLUE", mmsi: "538006050", type: "fishing", lat: -4.0, lon: 39.6, speed: 3.5, heading: 95 },
        { name: "CRIMSON ACE", mmsi: "477558200", type: "tanker", lat: 26.2, lon: 56.3, speed: 14.0, heading: 200 },
        { name: "SAGA HORIZON", mmsi: "311000596", type: "passenger", lat: 35.3, lon: 139.6, speed: 18.0, heading: 0 },
        { name: "ATLANTIC GUARDIAN", mmsi: "219354000", type: "tug", lat: 56.1, lon: -3.2, speed: 7.5, heading: 245 },
        { name: "JADE STAR", mmsi: "636092783", type: "cargo", lat: -12.0, lon: -77.0, speed: 11.0, heading: 320 },
        { name: "NORTHERN SPIRIT", mmsi: "257038700", type: "fishing", lat: 62.4, lon: 6.1, speed: 5.0, heading: 170 },
    ];
    return vessels.map(function (v) { return ({
        id: "maritime-".concat(v.mmsi),
        pluginId: "maritime",
        latitude: v.lat + (Math.random() - 0.5) * 0.1,
        longitude: v.lon + (Math.random() - 0.5) * 0.1,
        heading: v.heading,
        speed: v.speed,
        timestamp: new Date(),
        label: v.name,
        properties: { mmsi: v.mmsi, vesselName: v.name, vesselType: v.type, speed_knots: v.speed, heading: v.heading },
    }); });
}
var MaritimePlugin = /** @class */ (function () {
    function MaritimePlugin() {
        this.id = "maritime";
        this.name = "Maritime";
        this.description = "Vessel tracking via AIS feeds";
        this.icon = lucide_react_1.Ship;
        this.category = "maritime";
        this.version = "1.0.0";
        this.context = null;
    }
    MaritimePlugin.prototype.initialize = function (ctx) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            this.context = ctx;
            return [2 /*return*/];
        }); });
    };
    MaritimePlugin.prototype.destroy = function () { this.context = null; };
    MaritimePlugin.prototype.fetch = function (_timeRange) {
        return __awaiter(this, void 0, void 0, function () {
            var res, data, vessels, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("/api/maritime")];
                    case 1:
                        res = _b.sent();
                        if (!res.ok)
                            throw new Error("Maritime API returned ".concat(res.status));
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _b.sent();
                        vessels = data.vessels || generateDemoVessels();
                        return [2 /*return*/, vessels.map(function (v) { return (__assign(__assign({}, v), { timestamp: new Date(v.timestamp) })); })];
                    case 3:
                        _a = _b.sent();
                        return [2 /*return*/, generateDemoVessels()];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MaritimePlugin.prototype.getPollingInterval = function () { return 60000; };
    MaritimePlugin.prototype.getLayerConfig = function () {
        return { color: "#f59e0b", clusterEnabled: true, clusterDistance: 50 };
    };
    MaritimePlugin.prototype.renderEntity = function (entity) {
        var vesselType = entity.properties.vesselType || "other";
        return {
            type: "point", color: getVesselColor(vesselType), size: 7,
            rotation: entity.heading, outlineColor: "#000000", outlineWidth: 1,
            labelText: entity.label || undefined, labelFont: "11px JetBrains Mono, monospace",
        };
    };
    MaritimePlugin.prototype.getFilterDefinitions = function () {
        return [
            {
                id: "vessel_type", label: "Vessel Type", type: "select", propertyKey: "vesselType",
                options: [
                    { value: "cargo", label: "Cargo" }, { value: "tanker", label: "Tanker" },
                    { value: "passenger", label: "Passenger" }, { value: "fishing", label: "Fishing" },
                    { value: "military", label: "Military" }, { value: "sailing", label: "Sailing" },
                    { value: "tug", label: "Tug" }, { value: "other", label: "Other" },
                ],
            },
            { id: "speed", label: "Speed (knots)", type: "range", propertyKey: "speed_knots", range: { min: 0, max: 30, step: 1 } },
        ];
    };
    return MaritimePlugin;
}());
exports.MaritimePlugin = MaritimePlugin;
