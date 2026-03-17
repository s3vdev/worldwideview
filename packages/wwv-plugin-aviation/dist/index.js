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
exports.AviationPlugin = void 0;
var lucide_react_1 = require("lucide-react");
function altitudeToColor(altitude) {
    if (altitude === null || altitude <= 0)
        return "#4ade80";
    if (altitude < 3000)
        return "#22d3ee";
    if (altitude < 8000)
        return "#3b82f6";
    if (altitude < 12000)
        return "#a78bfa";
    return "#f472b6";
}
var AviationPlugin = /** @class */ (function () {
    function AviationPlugin() {
        this.id = "aviation";
        this.name = "Aviation";
        this.description = "Real-time aircraft tracking via OpenSky Network";
        this.icon = lucide_react_1.Plane;
        this.category = "aviation";
        this.version = "1.0.0";
        this.context = null;
    }
    AviationPlugin.prototype.initialize = function (ctx) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            this.context = ctx;
            return [2 /*return*/];
        }); });
    };
    AviationPlugin.prototype.destroy = function () { this.context = null; };
    AviationPlugin.prototype.fetch = function (_timeRange) {
        return __awaiter(this, void 0, void 0, function () {
            var time, res_1, historyData, res, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        if (!this.context.isPlaybackMode()) return [3 /*break*/, 3];
                        time = this.context.getCurrentTime().getTime();
                        return [4 /*yield*/, fetch("/api/aviation/history?time=".concat(time))];
                    case 1:
                        res_1 = _a.sent();
                        if (!res_1.ok)
                            throw new Error("History API returned ".concat(res_1.status));
                        return [4 /*yield*/, res_1.json()];
                    case 2:
                        historyData = _a.sent();
                        if (!historyData.records || !Array.isArray(historyData.records))
                            return [2 /*return*/, []];
                        return [2 /*return*/, historyData.records.map(function (s) { return ({
                                id: "aviation-history-".concat(s.icao24),
                                pluginId: "aviation",
                                latitude: s.latitude,
                                longitude: s.longitude,
                                altitude: (s.altitude || 0) * 10,
                                heading: s.heading || undefined,
                                speed: s.speed || undefined,
                                timestamp: new Date(s.timestamp),
                                label: s.callsign || s.icao24,
                                properties: { icao24: s.icao24, callsign: s.callsign, altitude_m: s.altitude, velocity_ms: s.speed, heading: s.heading, on_ground: s.altitude === null || s.altitude <= 0 },
                            }); })];
                    case 3: return [4 /*yield*/, fetch("/api/aviation")];
                    case 4:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("Aviation API returned ".concat(res.status));
                        return [4 /*yield*/, res.json()];
                    case 5:
                        data = _a.sent();
                        if (data.error && !data.states)
                            return [2 /*return*/, []];
                        if (!data.states || !Array.isArray(data.states))
                            return [2 /*return*/, []];
                        return [2 /*return*/, data.states
                                .filter(function (s) { return s[6] !== null && s[5] !== null; })
                                .map(function (s) {
                                var _a;
                                var st = {
                                    icao24: s[0], callsign: ((_a = s[1]) === null || _a === void 0 ? void 0 : _a.trim()) || null,
                                    origin_country: s[2], time_position: s[3],
                                    last_contact: s[4], longitude: s[5],
                                    latitude: s[6], baro_altitude: s[7],
                                    on_ground: s[8], velocity: s[9],
                                    true_track: s[10], vertical_rate: s[11],
                                    sensors: s[12], geo_altitude: s[13],
                                    squawk: s[14], spi: s[15], position_source: s[16],
                                };
                                return {
                                    id: "aviation-".concat(st.icao24), pluginId: "aviation",
                                    latitude: st.latitude, longitude: st.longitude,
                                    altitude: (st.baro_altitude || 0) * 10,
                                    heading: st.true_track || undefined, speed: st.velocity || undefined,
                                    timestamp: new Date((st.time_position || st.last_contact) * 1000),
                                    label: st.callsign || st.icao24,
                                    properties: { icao24: st.icao24, callsign: st.callsign, origin_country: st.origin_country, altitude_m: st.baro_altitude, velocity_ms: st.velocity, heading: st.true_track, vertical_rate: st.vertical_rate, on_ground: st.on_ground, squawk: st.squawk },
                                };
                            })];
                    case 6:
                        err_1 = _a.sent();
                        console.error("[AviationPlugin] Fetch error:", err_1);
                        return [2 /*return*/, []];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    AviationPlugin.prototype.getPollingInterval = function () { return 15000; };
    AviationPlugin.prototype.getLayerConfig = function () { return { color: "#3b82f6", clusterEnabled: true, clusterDistance: 40, maxEntities: 5000 }; };
    AviationPlugin.prototype.renderEntity = function (entity) {
        var alt = entity.properties.altitude_m;
        var isAirborne = !entity.properties.on_ground;
        return {
            type: "model", iconUrl: "/plane-icon.svg", size: isAirborne ? 8 : 5,
            modelUrl: "/airplane/scene.gltf", modelScale: 75, modelMinPixelSize: 16, modelHeadingOffset: 180,
            color: altitudeToColor(alt), rotation: entity.heading,
            labelText: entity.label || undefined, labelFont: "11px JetBrains Mono, monospace",
        };
    };
    AviationPlugin.prototype.getSelectionBehavior = function (entity) {
        if (entity.properties.on_ground)
            return null;
        return { showTrail: true, trailDurationSec: 60, trailStepSec: 5, trailColor: "#00fff7", flyToOffsetMultiplier: 3, flyToBaseDistance: 30000 };
    };
    AviationPlugin.prototype.getServerConfig = function () {
        return { apiBasePath: "/api/aviation", pollingIntervalMs: 5000, requiresAuth: true, historyEnabled: true, availabilityEnabled: true };
    };
    AviationPlugin.prototype.getFilterDefinitions = function () {
        return [
            { id: "origin_country", label: "Country", type: "select", propertyKey: "origin_country", options: [{ value: "United States", label: "United States" }, { value: "China", label: "China" }, { value: "United Kingdom", label: "United Kingdom" }, { value: "Germany", label: "Germany" }, { value: "France", label: "France" }, { value: "Japan", label: "Japan" }, { value: "Australia", label: "Australia" }, { value: "Canada", label: "Canada" }, { value: "India", label: "India" }, { value: "Brazil", label: "Brazil" }, { value: "Russia", label: "Russia" }, { value: "Turkey", label: "Turkey" }, { value: "South Korea", label: "South Korea" }, { value: "Indonesia", label: "Indonesia" }, { value: "Mexico", label: "Mexico" }] },
            { id: "altitude", label: "Altitude (m)", type: "range", propertyKey: "altitude_m", range: { min: 0, max: 15000, step: 500 } },
            { id: "on_ground", label: "On Ground", type: "boolean", propertyKey: "on_ground" },
            { id: "callsign", label: "Callsign", type: "text", propertyKey: "callsign" },
        ];
    };
    return AviationPlugin;
}());
exports.AviationPlugin = AviationPlugin;
