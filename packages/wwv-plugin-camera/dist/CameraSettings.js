"use client";
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
exports.CameraSettings = void 0;
var react_1 = require("react");
var store_1 = require("@/core/state/store");
var lucide_react_1 = require("lucide-react");
var PluginManager_1 = require("@/core/plugins/PluginManager");
var cameraSettingsStyles_1 = require("./cameraSettingsStyles");
var CameraSettings = function (_a) {
    var pluginId = _a.pluginId;
    var settingsRaw = (0, store_1.useStore)(function (s) { return s.dataConfig.pluginSettings[pluginId]; });
    var settings = __assign({ sourceType: "default" }, (settingsRaw || {}));
    var updatePluginSettings = (0, store_1.useStore)(function (s) { return s.updatePluginSettings; });
    var setHighlightLayerId = (0, store_1.useStore)(function (s) { return s.setHighlightLayerId; });
    var _b = react_1.default.useState(false), isLoading = _b[0], setIsLoading = _b[1];
    var handleSourceTypeChange = function (type) {
        updatePluginSettings(pluginId, { sourceType: type });
        setHighlightLayerId(null);
    };
    var triggerFetch = function () { return __awaiter(void 0, void 0, void 0, function () {
        var managed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    managed = PluginManager_1.pluginManager.getPlugin(pluginId);
                    if (!(managed && managed.enabled)) return [3 /*break*/, 2];
                    return [4 /*yield*/, PluginManager_1.pluginManager.fetchForPlugin(pluginId, managed.context.timeRange)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    }); };
    var handleLoadData = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsLoading(true);
                    updatePluginSettings(pluginId, { action: "load", actionId: Date.now(), loaded: true });
                    setHighlightLayerId(null);
                    return [4 /*yield*/, triggerFetch()];
                case 1:
                    _a.sent();
                    setIsLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var handleResetAll = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updatePluginSettings(pluginId, { action: "reset", actionId: Date.now(), loaded: false, customUrl: "", customData: null });
                    setHighlightLayerId(null);
                    return [4 /*yield*/, triggerFetch()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var handleFileUpload = function (e) {
        var _a;
        var file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        var reader = new FileReader();
        reader.onload = function (event) { return __awaiter(void 0, void 0, void 0, function () {
            var json, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        json = JSON.parse((_b = event.target) === null || _b === void 0 ? void 0 : _b.result);
                        updatePluginSettings(pluginId, { customData: json, action: "load", actionId: Date.now(), loaded: true });
                        setHighlightLayerId(null);
                        return [4 /*yield*/, triggerFetch()];
                    case 1:
                        _c.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _c.sent();
                        alert("Invalid JSON file format.");
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        reader.readAsText(file);
    };
    return (<div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: "var(--space-xs)" }}>Data Source Configuration</div>
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                {[["default", lucide_react_1.Database, "Default"], ["traffic", lucide_react_1.TrafficCone, "Traffic Cams"], ["url", lucide_react_1.Link, "URL"], ["file", lucide_react_1.Upload, "File"]].map(function (_a) {
            var type = _a[0], Icon = _a[1], label = _a[2];
            return (<button key={type} onClick={function () { return handleSourceTypeChange(type); }} style={(0, cameraSettingsStyles_1.sourceTabStyle)(settings.sourceType === type)}>
                            <Icon size={14}/><span style={{ fontSize: 10 }}>{label}</span>
                        </button>);
        })}
            </div>
            {settings.sourceType === "default" && (<div style={cameraSettingsStyles_1.inputGroupStyle}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Built-in camera dataset</div>
                    <button onClick={handleLoadData} disabled={isLoading} style={(0, cameraSettingsStyles_1.loadButtonStyle)(isLoading)}>{isLoading ? "Loading..." : settings.loaded ? "Reload" : "Load"}</button>
                </div>)}
            {settings.sourceType === "traffic" && (<div style={cameraSettingsStyles_1.inputGroupStyle}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>DOT traffic cameras (GDOT + more)</div>
                    <button onClick={handleLoadData} disabled={isLoading} style={(0, cameraSettingsStyles_1.loadButtonStyle)(isLoading)}>{isLoading ? "Loading..." : settings.loaded ? "Reload" : "Load"}</button>
                </div>)}
            {settings.sourceType === "url" && (<div style={cameraSettingsStyles_1.inputGroupStyle}>
                    <label style={cameraSettingsStyles_1.labelStyle}>URL</label>
                    <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "4px" }}>
                        <input type="text" placeholder="http://..." value={settings.customUrl || ""} onChange={function (e) { return updatePluginSettings(pluginId, { customUrl: e.target.value }); }} style={__assign(__assign({}, cameraSettingsStyles_1.inputStyle), { flex: 1 })}/>
                        <button onClick={handleLoadData} disabled={!settings.customUrl || isLoading} style={(0, cameraSettingsStyles_1.loadButtonStyle)(!settings.customUrl || isLoading)}>{isLoading ? "Loading..." : "Load"}</button>
                    </div>
                </div>)}
            {settings.sourceType === "file" && (<div style={cameraSettingsStyles_1.inputGroupStyle}>
                    <label style={cameraSettingsStyles_1.labelStyle}>JSON File</label>
                    <input type="file" accept=".json" onChange={handleFileUpload} style={__assign(__assign({}, cameraSettingsStyles_1.inputStyle), { width: "100%", marginTop: "4px", padding: "4px", fontSize: "10px" })}/>
                    {settings.customData && Array.isArray(settings.customData) && (<div style={{ fontSize: 10, color: "var(--accent-green)", marginTop: "4px" }}>✓ Data loaded ({settings.customData.length} cameras)</div>)}
                </div>)}
            <button onClick={handleResetAll} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "6px var(--space-md)", fontSize: 11, color: "var(--text-muted)", cursor: "pointer", transition: "all 0.2s ease" }}>
                <lucide_react_1.RotateCcw size={12}/> Reset All Sources
            </button>
        </div>);
};
exports.CameraSettings = CameraSettings;
