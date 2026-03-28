// ─── WorldWideView Plugin SDK ─────────────────────────────────
// The public API for building WorldWideView plugins.
// Import from "@worldwideview/wwv-plugin-sdk" in your plugin.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
export function createSvgIconUrl(Icon, props = {}) {
    const svgString = renderToStaticMarkup(createElement(Icon, props));
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}
