"use strict";
/**
 * Manages Cesium Entity polylines for camera frustum outlines.
 *
 * Draws 4 side-edge lines from the camera apex to the 4 far
 * corners of the view pyramid. No far-plane rectangle is drawn
 * (it would clip the earth surface).
 *
 * Architecture: corners come from frustumGeometry.ts so a future
 * ground-projection step can replace the far-plane corners with
 * terrain-intersection points without changing this renderer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrustumRenderer = void 0;
var cesium_1 = require("cesium");
var frustumGeometry_1 = require("./frustumGeometry");
var FRUSTUM_COLOR = cesium_1.Color.fromCssColorString("#00ccff").withAlpha(0.6);
var EDGE_WIDTH = 2;
var FrustumRenderer = /** @class */ (function () {
    function FrustumRenderer() {
        /** Map from entity id → array of 4 Cesium.Entity polylines */
        this.entityMap = new Map();
    }
    /**
     * Sync frustum outlines with the current set of camera entities.
     * Only draws for entities whose `properties` include heading.
     */
    FrustumRenderer.prototype.update = function (viewer, entities) {
        if (!viewer || viewer.isDestroyed())
            return;
        var activeIds = new Set();
        for (var _i = 0, entities_1 = entities; _i < entities_1.length; _i++) {
            var geo = entities_1[_i];
            if (geo.pluginId !== "camera")
                continue;
            var heading = this.resolveHeading(geo);
            if (heading === undefined)
                continue;
            activeIds.add(geo.id);
            var edges = this.buildEdges(geo, heading);
            if (this.entityMap.has(geo.id)) {
                this.updateExisting(viewer, geo.id, edges);
            }
            else {
                this.createNew(viewer, geo.id, edges);
            }
        }
        this.removeStale(viewer, activeIds);
    };
    /** Remove all frustum entities from the viewer. */
    FrustumRenderer.prototype.clear = function (viewer) {
        if (!viewer || viewer.isDestroyed()) {
            this.entityMap.clear();
            return;
        }
        for (var _i = 0, _a = this.entityMap; _i < _a.length; _i++) {
            var _b = _a[_i], lines = _b[1];
            for (var _c = 0, lines_1 = lines; _c < lines_1.length; _c++) {
                var line = lines_1[_c];
                viewer.entities.remove(line);
            }
        }
        this.entityMap.clear();
    };
    // ─── Private helpers ─────────────────────────────────────
    FrustumRenderer.prototype.resolveHeading = function (geo) {
        var p = geo.properties;
        if (typeof p.heading === "number")
            return p.heading;
        if (typeof p.azimuth === "number")
            return p.azimuth;
        if (typeof p.heading === "string") {
            return parseFloat(p.heading) || undefined;
        }
        return geo.heading;
    };
    FrustumRenderer.prototype.buildEdges = function (geo, heading) {
        var p = geo.properties;
        return (0, frustumGeometry_1.computeFrustumEdges)({
            lat: geo.latitude,
            lon: geo.longitude,
            alt: toNum(p.altitude, toNum(p.alt, frustumGeometry_1.FRUSTUM_DEFAULTS.alt)),
            headingDeg: heading,
            pitchDeg: toNum(p.pitch, frustumGeometry_1.FRUSTUM_DEFAULTS.pitchDeg),
            hFovDeg: toNum(p.fov, toNum(p.hFov, frustumGeometry_1.FRUSTUM_DEFAULTS.hFovDeg)),
            vFovDeg: toNum(p.vFov, frustumGeometry_1.FRUSTUM_DEFAULTS.vFovDeg),
            rangeMtrs: toNum(p.range, frustumGeometry_1.FRUSTUM_DEFAULTS.rangeMtrs),
        });
    };
    FrustumRenderer.prototype.createNew = function (viewer, id, edges) {
        var _this = this;
        var corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        var lines = corners.map(function (corner) {
            return _this.addEdgeLine(viewer, id, edges.apex, corner);
        });
        this.entityMap.set(id, lines);
    };
    FrustumRenderer.prototype.updateExisting = function (viewer, id, edges) {
        var corners = [edges.topLeft, edges.topRight, edges.bottomLeft, edges.bottomRight];
        var existing = this.entityMap.get(id);
        for (var i = 0; i < 4; i++) {
            existing[i].polyline.positions = toPositions(edges.apex, corners[i]);
        }
    };
    FrustumRenderer.prototype.removeStale = function (viewer, activeIds) {
        for (var _i = 0, _a = this.entityMap; _i < _a.length; _i++) {
            var _b = _a[_i], id = _b[0], lines = _b[1];
            if (!activeIds.has(id)) {
                for (var _c = 0, lines_2 = lines; _c < lines_2.length; _c++) {
                    var line = lines_2[_c];
                    viewer.entities.remove(line);
                }
                this.entityMap.delete(id);
            }
        }
    };
    FrustumRenderer.prototype.addEdgeLine = function (viewer, parentId, from, to) {
        return viewer.entities.add({
            id: "frustum-".concat(parentId, "-").concat(Math.random().toString(36).slice(2, 8)),
            polyline: {
                positions: toPositions(from, to),
                width: EDGE_WIDTH,
                material: new cesium_1.PolylineGlowMaterialProperty({
                    glowPower: 0.15,
                    color: FRUSTUM_COLOR,
                }),
                clampToGround: false,
            },
        });
    };
    return FrustumRenderer;
}());
exports.FrustumRenderer = FrustumRenderer;
// ─── Utilities ───────────────────────────────────────────────
function toPositions(a, b) {
    return [
        cesium_1.Cartesian3.fromDegrees(a.lon, a.lat, a.alt),
        cesium_1.Cartesian3.fromDegrees(b.lon, b.lat, b.alt),
    ];
}
function toNum(val, fallback) {
    if (typeof val === "number" && !Number.isNaN(val))
        return val;
    if (typeof val === "string") {
        var n = parseFloat(val);
        if (!Number.isNaN(n))
            return n;
    }
    return fallback;
}
