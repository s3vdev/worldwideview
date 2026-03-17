"use strict";
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
exports.MilitaryPlugin = void 0;
var lucide_react_1 = require("lucide-react");
function militaryAltitudeToColor(altFeet) {
    if (altFeet === null || altFeet <= 0)
        return "#39ff14";
    if (altFeet < 10000)
        return "#ff6f00";
    if (altFeet < 25000)
        return "#ff1744";
    if (altFeet < 40000)
        return "#ff4081";
    return "#ffea00";
}
function feetToMeters(feet) { return feet * 0.3048; }
var MilitaryPlugin = /** @class */ (function () {
    function MilitaryPlugin() {
        this.id = "military";
        this.name = "Military Aviation";
        this.description = "Real-time military aircraft tracking via adsb.fi";
        this.icon = lucide_react_1.Shield;
        this.category = "aviation";
        this.version = "1.0.0";
        this.context = null;
    }
    MilitaryPlugin.prototype.initialize = function (ctx) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            this.context = ctx;
            return [2 /*return*/];
        }); });
    };
    MilitaryPlugin.prototype.destroy = function () { this.context = null; };
    MilitaryPlugin.prototype.fetch = function (_timeRange) {
        return __awaiter(this, void 0, void 0, function () {
            var res, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("/api/military")];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("Military API returned ".concat(res.status));
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        if (!data.ac || !Array.isArray(data.ac))
                            return [2 /*return*/, []];
                        return [2 /*return*/, data.ac
                                .filter(function (ac) { return ac.lat != null && ac.lon != null; })
                                .map(function (ac) {
                                var _a, _b, _c, _d, _e, _f;
                                var altFeet = typeof ac.alt_baro === "number" ? ac.alt_baro : null;
                                var altMeters = altFeet !== null ? feetToMeters(altFeet) : null;
                                var isOnGround = ac.alt_baro === "ground";
                                return {
                                    id: "military-".concat(ac.hex), pluginId: "military",
                                    latitude: ac.lat, longitude: ac.lon,
                                    altitude: altMeters !== null ? altMeters * 10 : 0,
                                    heading: (_a = ac.track) !== null && _a !== void 0 ? _a : undefined, speed: (_b = ac.gs) !== null && _b !== void 0 ? _b : undefined,
                                    timestamp: new Date(),
                                    label: ((_c = ac.flight) === null || _c === void 0 ? void 0 : _c.trim()) || ac.r || ac.hex,
                                    properties: { hex: ac.hex, callsign: ((_d = ac.flight) === null || _d === void 0 ? void 0 : _d.trim()) || null, registration: ac.r || null, aircraft_type: ac.t || null, altitude_ft: altFeet, altitude_m: altMeters, ground_speed_kts: (_e = ac.gs) !== null && _e !== void 0 ? _e : null, heading: (_f = ac.track) !== null && _f !== void 0 ? _f : null, squawk: ac.squawk || null, on_ground: isOnGround, category: ac.category || null, emergency: ac.emergency || null },
                                };
                            })];
                    case 3:
                        err_1 = _a.sent();
                        console.error("[MilitaryPlugin] Fetch error:", err_1);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MilitaryPlugin.prototype.getPollingInterval = function () { return 60000; };
    MilitaryPlugin.prototype.getLayerConfig = function () { return { color: "#ff6f00", clusterEnabled: true, clusterDistance: 40, maxEntities: 3000 }; };
    MilitaryPlugin.prototype.renderEntity = function (entity) {
        var altFeet = entity.properties.altitude_ft;
        var isAirborne = !entity.properties.on_ground;
        return {
            type: "model", iconUrl: "/military-plane-icon.svg", size: isAirborne ? 8 : 5,
            modelUrl: "/airplane/scene.gltf", modelScale: 75, modelMinPixelSize: 16, modelHeadingOffset: 180,
            color: militaryAltitudeToColor(altFeet), rotation: entity.heading,
            labelText: entity.label || undefined, labelFont: "11px JetBrains Mono, monospace",
        };
    };
    MilitaryPlugin.prototype.getSelectionBehavior = function (entity) {
        if (entity.properties.on_ground)
            return null;
        return { showTrail: true, trailDurationSec: 60, trailStepSec: 5, trailColor: "#ffea00", flyToOffsetMultiplier: 3, flyToBaseDistance: 30000 };
    };
    MilitaryPlugin.prototype.getServerConfig = function () {
        return { apiBasePath: "/api/military", pollingIntervalMs: 60000, requiresAuth: false };
    };
    MilitaryPlugin.prototype.getFilterDefinitions = function () {
        return [
            { id: "aircraft_type", label: "Aircraft Type", type: "text", propertyKey: "aircraft_type" },
            { id: "callsign", label: "Callsign", type: "text", propertyKey: "callsign" },
            { id: "registration", label: "Registration", type: "text", propertyKey: "registration" },
            { id: "altitude", label: "Altitude (ft)", type: "range", propertyKey: "altitude_ft", range: { min: 0, max: 60000, step: 1000 } },
            { id: "on_ground", label: "On Ground", type: "boolean", propertyKey: "on_ground" },
        ];
    };
    return MilitaryPlugin;
}());
exports.MilitaryPlugin = MilitaryPlugin;
