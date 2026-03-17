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
exports.CameraPlugin = void 0;
var lucide_react_1 = require("lucide-react");
var CameraDetail_1 = require("./CameraDetail");
var CameraSettings_1 = require("./CameraSettings");
var cameraMapper_1 = require("./cameraMapper");
var analytics_1 = require("@/lib/analytics");
var CameraPlugin = /** @class */ (function () {
    function CameraPlugin() {
        this.id = "camera";
        this.name = "Cameras";
        this.description = "Public live cameras from across the globe";
        this.icon = lucide_react_1.Camera;
        this.category = "infrastructure";
        this.version = "1.0.0";
        this.context = null;
        this.sourceBuckets = {};
        this.lastActionId = null;
    }
    CameraPlugin.prototype.initialize = function (ctx) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            this.context = ctx;
            return [2 /*return*/];
        }); });
    };
    CameraPlugin.prototype.destroy = function () { this.context = null; };
    CameraPlugin.prototype.requiresConfiguration = function (settingsRaw) {
        var _a;
        var s = settingsRaw;
        var sourceType = (_a = s === null || s === void 0 ? void 0 : s.sourceType) !== null && _a !== void 0 ? _a : "default";
        if (sourceType === "default" || sourceType === "traffic")
            return false;
        if (sourceType === "url" && !(s === null || s === void 0 ? void 0 : s.customUrl))
            return true;
        if (sourceType === "file" && !(s === null || s === void 0 ? void 0 : s.customData))
            return true;
        return false;
    };
    CameraPlugin.prototype.getAllEntities = function () { return Object.values(this.sourceBuckets).flat(); };
    CameraPlugin.prototype.pushUpdate = function () { var _a; (_a = this.context) === null || _a === void 0 ? void 0 : _a.onDataUpdate(this.getAllEntities()); };
    CameraPlugin.prototype.fetch = function (_timeRange) {
        return __awaiter(this, void 0, void 0, function () {
            var rawSettings, settings, isAutoDefault, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        rawSettings = this.context.getPluginSettings(this.id);
                        settings = __assign({ sourceType: "default", action: undefined, actionId: undefined, loaded: undefined, customUrl: undefined, customData: undefined }, (rawSettings || {}));
                        if (settings.action === "reset") {
                            this.sourceBuckets = {};
                            this.lastActionId = settings.actionId;
                            return [2 /*return*/, []];
                        }
                        isAutoDefault = (settings.sourceType === "default" || settings.sourceType === "traffic")
                            && !this.lastActionId && !this.sourceBuckets["default"];
                        if (!isAutoDefault && (settings.action !== "load" || settings.actionId === this.lastActionId)) {
                            return [2 /*return*/, this.getAllEntities()];
                        }
                        this.lastActionId = (_a = settings.actionId) !== null && _a !== void 0 ? _a : -1;
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 9, , 10]);
                        if (!(settings.sourceType === "default")) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.loadDefaultSource()];
                    case 2:
                        _c.sent();
                        return [3 /*break*/, 8];
                    case 3:
                        if (!(settings.sourceType === "traffic")) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.loadTrafficCameras()];
                    case 4:
                        _c.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        if (!(settings.sourceType === "url")) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.loadUrlSource(settings)];
                    case 6:
                        _c.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        if (settings.sourceType === "file") {
                            this.loadFileSource(settings);
                        }
                        _c.label = 8;
                    case 8:
                        (0, analytics_1.trackEvent)("camera-source-load", { sourceType: settings.sourceType });
                        return [2 /*return*/, this.getAllEntities()];
                    case 9:
                        error_1 = _c.sent();
                        console.error("[CameraPlugin] Fetch error:", error_1);
                        (_b = this.context) === null || _b === void 0 ? void 0 : _b.onError(error_1 instanceof Error ? error_1 : new Error(String(error_1)));
                        return [2 /*return*/, this.getAllEntities()];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    CameraPlugin.prototype.loadDefaultSource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, geojson;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("/public-cameras.json")];
                    case 1:
                        res = _a.sent();
                        if (!res.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, res.json()];
                    case 2:
                        geojson = _a.sent();
                        if (geojson && Array.isArray(geojson.features)) {
                            this.sourceBuckets["default"] = geojson.features.map(function (f, i) { return (0, cameraMapper_1.mapGeoJsonFeature)(f, i, "default"); });
                        }
                        _a.label = 3;
                    case 3:
                        this.pushUpdate();
                        return [2 /*return*/];
                }
            });
        });
    };
    CameraPlugin.prototype.loadTrafficCameras = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch("/api/camera/traffic")];
                    case 1:
                        res = _a.sent();
                        if (!res.ok)
                            throw new Error("API returned ".concat(res.status));
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        if (data.cameras && Array.isArray(data.cameras)) {
                            this.sourceBuckets["default"] = data.cameras.map(function (f, i) { return (0, cameraMapper_1.mapGeoJsonFeature)(f, i, "traffic"); });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        console.warn("[CameraPlugin] Traffic cameras API failed:", err_1);
                        return [3 /*break*/, 4];
                    case 4:
                        this.pushUpdate();
                        return [2 /*return*/];
                }
            });
        });
    };
    CameraPlugin.prototype.loadUrlSource = function (settings) {
        return __awaiter(this, void 0, void 0, function () {
            var url, res, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!settings.customUrl)
                            return [2 /*return*/];
                        url = settings.customUrl;
                        if (!/^https?:\/\//i.test(url))
                            url = "http://".concat(url);
                        return [4 /*yield*/, fetch(url)];
                    case 1:
                        res = _a.sent();
                        if (!res.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, res.json()];
                    case 2:
                        data = _a.sent();
                        if (Array.isArray(data)) {
                            this.sourceBuckets["url"] = data.map(function (c, i) { return (0, cameraMapper_1.mapRawCamera)(c, i, "url"); });
                        }
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    CameraPlugin.prototype.loadFileSource = function (settings) {
        if (!settings.customData || !Array.isArray(settings.customData))
            return;
        this.sourceBuckets["file"] = settings.customData.map(function (c, i) { return (0, cameraMapper_1.mapRawCamera)(c, i, "file"); });
    };
    CameraPlugin.prototype.getPollingInterval = function () { return 3600000; };
    CameraPlugin.prototype.getLayerConfig = function () {
        return { color: "#60a5fa", clusterEnabled: true, clusterDistance: 50, maxEntities: 10000 };
    };
    CameraPlugin.prototype.renderEntity = function (entity) {
        return {
            type: "point", color: "#60a5fa", size: 6,
            outlineColor: "#ffffff", outlineWidth: 1.5,
            labelText: entity.label, labelFont: "11px Inter, system-ui, sans-serif",
        };
    };
    CameraPlugin.prototype.getDetailComponent = function () { return CameraDetail_1.CameraDetail; };
    CameraPlugin.prototype.getSettingsComponent = function () { return CameraSettings_1.CameraSettings; };
    CameraPlugin.prototype.getFilterDefinitions = function () {
        return [
            { id: "country", label: "Country", type: "text", propertyKey: "country" },
            { id: "city", label: "City", type: "text", propertyKey: "city" },
            { id: "is_popular", label: "Popular Only", type: "boolean", propertyKey: "is_popular" },
        ];
    };
    return CameraPlugin;
}());
exports.CameraPlugin = CameraPlugin;
