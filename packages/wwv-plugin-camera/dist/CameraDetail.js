"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CameraDetail = void 0;
var react_1 = require("react");
var CameraStream_1 = require("@/components/video/CameraStream");
var CameraDetail = function (_a) {
    var entity = _a.entity;
    var properties = entity.properties;
    var stream = properties.stream;
    var previewUrl = properties.preview_url;
    var city = properties.city;
    var region = properties.region;
    var country = properties.country;
    var isIframe = !!properties.is_iframe;
    var categories = properties.categories || [];
    return (<div className="flex flex-col gap-4">
            <CameraStream_1.CameraStream id={entity.id} streamUrl={stream} previewUrl={previewUrl} isIframe={isIframe} label={city || country}/>
            <div className="intel-panel__props">
                <div className="intel-panel__prop" style={{ flexDirection: "column", alignItems: "flex-start", gap: "var(--space-xs)", borderBottom: "1px solid var(--border-subtle)", padding: "var(--space-sm) 0" }}>
                    <span className="intel-panel__prop-key">Location</span>
                    <span className="intel-panel__prop-value" style={{ textAlign: "left", width: "100%", whiteSpace: "normal", lineHeight: "1.4", fontSize: "12px", color: "var(--text-primary)" }}>
                        {[city, region, country].filter(Boolean).join(", ")}
                    </span>
                </div>
                {categories.length > 0 && (<div className="intel-panel__prop" style={{ flexDirection: "column", alignItems: "flex-start", gap: "var(--space-sm)", borderBottom: "none", padding: "var(--space-sm) 0" }}>
                        <span className="intel-panel__prop-key">Categories</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {categories.map(function (cat) { return (<span key={cat} style={{ borderRadius: "12px", backgroundColor: "var(--bg-tertiary)", padding: "2px 8px", fontSize: "10px", fontWeight: 500, color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                                    {cat}
                                </span>); })}
                        </div>
                    </div>)}
            </div>
        </div>);
};
exports.CameraDetail = CameraDetail;
