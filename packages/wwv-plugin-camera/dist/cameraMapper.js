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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRawCamera = mapRawCamera;
exports.mapGeoJsonFeature = mapGeoJsonFeature;
var DEFAULT_CAMERA_ALT = 8;
function mapRawCamera(cam, index, prefix) {
    var _a, _b;
    return {
        id: "camera-".concat(prefix, "-").concat(index),
        pluginId: "camera",
        latitude: cam.latitude,
        longitude: cam.longitude,
        altitude: (_b = (_a = cam.altitude) !== null && _a !== void 0 ? _a : cam.elevation) !== null && _b !== void 0 ? _b : DEFAULT_CAMERA_ALT,
        timestamp: new Date(),
        label: cam.city || cam.country || "Unknown Camera",
        properties: __assign({}, cam),
    };
}
function mapGeoJsonFeature(feature, index, prefix) {
    var _a, _b, _c;
    var f = feature;
    var _d = (_b = (_a = f.geometry) === null || _a === void 0 ? void 0 : _a.coordinates) !== null && _b !== void 0 ? _b : [0, 0], lon = _d[0], lat = _d[1];
    var props = (_c = f.properties) !== null && _c !== void 0 ? _c : {};
    return {
        id: "camera-".concat(prefix, "-").concat(index),
        pluginId: "camera",
        latitude: lat,
        longitude: lon,
        altitude: DEFAULT_CAMERA_ALT,
        timestamp: new Date(),
        label: props.city || props.country || "Unknown Camera",
        properties: __assign({}, props),
    };
}
