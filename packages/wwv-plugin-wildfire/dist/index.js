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
exports.WildfirePlugin = void 0;
var lucide_react_1 = require("lucide-react");
var userApiKeys_1 = require("@/lib/userApiKeys");
function frpToColor(frp) {
    if (frp < 10)
        return "#fbbf24";
    if (frp < 50)
        return "#f97316";
    if (frp < 100)
        return "#ef4444";
    return "#dc2626";
}
function frpToSize(frp) {
    if (frp < 10)
        return 5;
    if (frp < 50)
        return 7;
    if (frp < 100)
        return 9;
    return 12;
}
var WildfirePlugin = /** @class */ (function () {
    function WildfirePlugin() {
        this.id = "wildfire";
        this.name = "Wildfire";
        this.description = "Active fire detection via NASA FIRMS (VIIRS)";
        this.icon = lucide_react_1.Flame;
        this.category = "natural-disaster";
        this.version = "1.0.0";
        this.context = null;
    }
    WildfirePlugin.prototype.initialize = function (ctx) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            this.context = ctx;
            return [2 /*return*/];
        }); });
    };
    WildfirePlugin.prototype.destroy = function () { this.context = null; };
    WildfirePlugin.prototype.fetch = function (_timeRange) {
        return __awaiter(this, void 0, void 0, function () {
            var res, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, globalThis.fetch("/api/wildfire", { headers: (0, userApiKeys_1.buildUserKeyHeaders)() })];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("Wildfire API returned ".concat(res.status));
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        if (!data.fires || !Array.isArray(data.fires))
                            return [2 /*return*/, []];
                        return [2 /*return*/, data.fires.map(function (fire) { return ({
                                id: "wildfire-".concat(fire.latitude.toFixed(4), "-").concat(fire.longitude.toFixed(4), "-").concat(fire.acq_date, "-").concat(fire.tier || 3),
                                pluginId: "wildfire",
                                latitude: fire.latitude,
                                longitude: fire.longitude,
                                timestamp: new Date("".concat(fire.acq_date, "T").concat(fire.acq_time.padStart(4, "0").slice(0, 2), ":").concat(fire.acq_time.padStart(4, "0").slice(2), ":00Z")),
                                label: "FRP: ".concat(fire.frp),
                                properties: {
                                    frp: fire.frp, confidence: fire.confidence, satellite: fire.satellite,
                                    acq_date: fire.acq_date, acq_time: fire.acq_time,
                                    bright_ti4: fire.bright_ti4, bright_ti5: fire.bright_ti5, tier: fire.tier,
                                },
                            }); })];
                    case 3:
                        err_1 = _a.sent();
                        console.error("[WildfirePlugin] Fetch error:", err_1);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    WildfirePlugin.prototype.getPollingInterval = function () { return 300000; };
    WildfirePlugin.prototype.getLayerConfig = function () {
        return { color: "#ef4444", clusterEnabled: true, clusterDistance: 30 };
    };
    WildfirePlugin.prototype.renderEntity = function (entity) {
        var frp = entity.properties.frp || 0;
        var tier = entity.properties.tier || 3;
        var distanceDisplayCondition;
        if (tier === 1)
            distanceDisplayCondition = { near: 3500000, far: Number.POSITIVE_INFINITY };
        else if (tier === 2)
            distanceDisplayCondition = { near: 1000000, far: 3500000 };
        else if (tier === 3)
            distanceDisplayCondition = { near: 0, far: 1000000 };
        return {
            type: "point", color: frpToColor(frp),
            size: frpToSize(frp) * (tier === 1 ? 2 : tier === 2 ? 1.5 : 1),
            outlineColor: "#000000", outlineWidth: 1,
            distanceDisplayCondition: distanceDisplayCondition,
        };
    };
    WildfirePlugin.prototype.getFilterDefinitions = function () {
        return [
            { id: "frp", label: "Fire Radiative Power (MW)", type: "range", propertyKey: "frp", range: { min: 0, max: 500, step: 10 } },
            {
                id: "confidence", label: "Confidence", type: "select", propertyKey: "confidence",
                options: [{ value: "low", label: "Low" }, { value: "nominal", label: "Nominal" }, { value: "high", label: "High" }],
            },
            {
                id: "satellite", label: "Satellite", type: "select", propertyKey: "satellite",
                options: [{ value: "N", label: "Suomi NPP" }, { value: "1", label: "NOAA-20" }, { value: "2", label: "NOAA-21" }],
            },
        ];
    };
    return WildfirePlugin;
}());
exports.WildfirePlugin = WildfirePlugin;
