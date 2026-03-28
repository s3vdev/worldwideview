# Creating a WorldWideView Plugin

This guide walks you through building, publishing, and listing your own WorldWideView plugin from scratch.

---

## Overview

WorldWideView plugins display geospatial data on a 3D Cesium globe. Every plugin must implement the `WorldPlugin` interface from the **Plugin SDK** (`@worldwideview/wwv-plugin-sdk`).

There are **three plugin formats**:

| Format | Use Case | Example |
|---|---|---|
| **`static`** | GeoJSON file loaded at startup — no API calls at runtime | Military Bases, Nuclear Facilities, Embassies |
| **`bundle`** | Full TypeScript class with custom logic, live API data, UI components | Aviation, Maritime, Wildfire |
| **`declarative`** | JSON-only manifest that points to an external API — no code needed | *(Future)* |

---

## Prerequisites

- Node.js ≥ 18
- npm account (for publishing)
- The WorldWideView monorepo cloned locally

---

## Step 1 — Create Your Plugin Package

All plugins live under `packages/` in the monorepo.

```bash
mkdir packages/wwv-plugin-my-data
cd packages/wwv-plugin-my-data
```

Create `package.json`:

```json
{
  "name": "@worldwideview/wwv-plugin-my-data",
  "version": "1.0.0",
  "description": "WorldWideView plugin — my custom data layer",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "files": ["src"],
  "keywords": [
    "worldwideview",
    "worldwideview-plugin",
    "geojson",
    "cesium",
    "globe"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/silvertakana/worldwideview.git",
    "directory": "packages/wwv-plugin-my-data"
  },
  "license": "ISC",
  "author": "WorldWideView",
  "peerDependencies": {
    "@worldwideview/wwv-plugin-sdk": "*"
  },
  "worldwideview": {
    "id": "my-data",
    "icon": "MapPin",
    "category": "Custom",
    "format": "bundle"
  }
}
```

> [!IMPORTANT]
> The `"worldwideview"` object block is strictly required if you intend to publish your plugin to the WorldWideView Marketplace. The marketplace uses this internal manifest to determine how to categorize and display your plugin automatically.
> * `id`: The unique string identifier.
> * `icon`: The Lucide React icon name (e.g. `MapPin`, `Satellite`, `Plane`).
> * `category`: Must match an existing category (e.g. `Aviation`, `Maritime`, `Natural Disaster`, `Custom`).
> * `format`: Either `bundle`, `static`, or `declarative`.

> [!IMPORTANT]
> The SDK is declared as a **peer dependency**, not a direct dependency. The host application provides it at runtime.

---

## Step 2 — Write Your Plugin Code

Create `src/index.ts`. Here are examples for the two most common formats:

### Option A — Static GeoJSON Plugin (simplest)

For static plugins, the npm package is just metadata. The actual loading is handled by the `StaticDataPlugin` loader at runtime, driven by a manifest + GeoJSON file.

```typescript
/**
 * @worldwideview/wwv-plugin-my-data
 *
 * Static GeoJSON plugin — my custom dataset.
 *
 * This package exists for npm registry metadata. The actual plugin logic
 * is handled by WorldWideView's StaticDataPlugin loader at runtime using
 * the manifest + GeoJSON data file served from the host application.
 */
export const PLUGIN_ID = "my-data" as const;
```

For static plugins you also need:
1. A **GeoJSON file** placed at `public/data/my_data.geojson` in the main app
2. A **manifest entry** in the marketplace (see Step 4)

### Option B — Bundle Plugin (full control)

For bundle plugins, you write a class that implements the `WorldPlugin` interface:

```typescript
import type {
  WorldPlugin,
  GeoEntity,
  TimeRange,
  PluginContext,
  LayerConfig,
  CesiumEntityOptions,
} from "@worldwideview/wwv-plugin-sdk";

export class MyDataPlugin implements WorldPlugin {
  // ─── Required Metadata ──────────────────────────────
  id = "my-data";
  name = "My Data Layer";
  description = "Displays custom points on the globe.";
  icon = "MapPin"; // Lucide icon name (string)
  category = "custom" as const;
  version = "1.0.0";

  // ─── Lifecycle ──────────────────────────────────────
  async initialize(ctx: PluginContext): Promise<void> {
    // Called once when the plugin is loaded.
    // Use ctx.apiBaseUrl, ctx.timeRange, ctx.onDataUpdate, etc.
  }

  destroy(): void {
    // Called when the plugin is unloaded. Clean up timers, sockets, etc.
  }

  // ─── Data ───────────────────────────────────────────
  async fetch(timeRange: TimeRange): Promise<GeoEntity[]> {
    // Fetch your data from an API and return GeoEntity objects.
    const res = await fetch("https://api.example.com/points");
    const data = await res.json();

    return data.map((item: any) => ({
      id: String(item.id),
      pluginId: this.id,
      latitude: item.lat,
      longitude: item.lon,
      altitude: 0,
      timestamp: new Date(),
      label: item.name,
      properties: { type: item.type },
    }));
  }

  getPollingInterval(): number {
    return 60_000; // Re-fetch every 60 seconds
  }

  // ─── Rendering ──────────────────────────────────────
  getLayerConfig(): LayerConfig {
    return {
      color: "#3b82f6",
      clusterEnabled: true,
      clusterDistance: 40,
      maxEntities: 5000,
    };
  }

  renderEntity(entity: GeoEntity): CesiumEntityOptions {
    return {
      type: "point",
      color: "#3b82f6",
      size: 8,
    };
  }
}
```

---

## Step 3 — Publish to npm

```bash
cd packages/wwv-plugin-my-data
npm publish --access public
```

> [!NOTE]
> The marketplace pulls metadata (version, description, keywords) directly from the npm registry at runtime. You do not need to duplicate this metadata in the marketplace.

---

## Step 4 — Register in the Marketplace

### 4a. Add to `knownPlugins.ts`

Open `worldwideview-marketplace/src/data/knownPlugins.ts` and add your plugin:

```typescript
{
  id: "my-data",
  npmPackage: "@worldwideview/wwv-plugin-my-data",
  icon: "MapPin",              // Lucide icon name
  category: "Custom",          // Must match a value in CATEGORIES
  format: "static",            // "static" | "bundle"
  trust: "verified",           // "built-in" | "verified" | "unverified"
  capabilities: ["data:own"],
  longDescription:
    "Description shown on the plugin detail page in the marketplace.",
  changelog:
    "v1.0.0 — Initial release.",
},
```

### 4b. Add a manifest (static plugins only)

For **static** format plugins, open `worldwideview-marketplace/src/data/pluginManifests.ts` and add:

```typescript
"my-data": {
  id: "my-data",
  name: "My Data Layer",
  version: "1.0.0",
  description: "My custom data layer",
  type: "data-layer",
  format: "static",
  trust: "verified",
  capabilities: ["data:own"],
  category: "Custom",
  icon: "MapPin",
  dataFile: "/data/my_data.geojson",   // Path to GeoJSON in public/
  rendering: {
    entityType: "point",
    color: "#3b82f6",
    labelField: "name",
    clusterEnabled: true,
    clusterDistance: 50,
    maxEntities: 5000,
  },
},
```

Bundle plugins do **not** need a manifest entry here — their code is loaded via dynamic import.

---

## Step 5 — Test Locally

1. Start the WorldWideView app: `npm run dev` (in the `worldwideview` directory)
2. Start the marketplace: `npm run dev` (in the `worldwideview-marketplace` directory)
3. Open the marketplace at `http://localhost:3001/browse`
4. Find your plugin and click **Install**
5. Verify the data appears on the globe at `http://localhost:3000`

---

## SDK Interface Reference

The `WorldPlugin` interface requires these properties and methods:

### Required Properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique plugin identifier (e.g., `"my-data"`) |
| `name` | `string` | Display name shown in the sidebar |
| `description` | `string` | Short description |
| `icon` | `string \| ComponentType` | Lucide icon name or React component |
| `category` | `PluginCategory` | One of: `aviation`, `maritime`, `conflict`, `natural-disaster`, `infrastructure`, `cyber`, `economic`, `custom` |
| `version` | `string` | Semver version string |

### Required Methods

| Method | Returns | Description |
|---|---|---|
| `initialize(ctx)` | `Promise<void>` | Set up the plugin. Receives `PluginContext` with API URLs, time range, callbacks |
| `destroy()` | `void` | Clean up resources (timers, sockets, etc.) |
| `fetch(timeRange)` | `Promise<GeoEntity[]>` | Return the data to display on the globe |
| `getPollingInterval()` | `number` | Milliseconds between `fetch()` calls |
| `getLayerConfig()` | `LayerConfig` | Layer appearance (color, clustering, limits) |
| `renderEntity(entity)` | `CesiumEntityOptions` | How each entity renders on the globe |

### Optional Methods

| Method | Returns | Description |
|---|---|---|
| `getSelectionBehavior(entity)` | `SelectionBehavior \| null` | Trail / fly-to on click |
| `getServerConfig()` | `ServerPluginConfig` | Server-side API routing |
| `getFilterDefinitions()` | `FilterDefinition[]` | Declarative filter UI |
| `getSidebarComponent()` | `ComponentType` | Custom sidebar panel |
| `getDetailComponent()` | `ComponentType<{ entity }>` | Custom detail panel |
| `getSettingsComponent()` | `ComponentType<{ pluginId }>` | Custom settings panel |

### Key Types

```typescript
interface GeoEntity {
  id: string;
  pluginId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
  label?: string;
  properties: Record<string, unknown>;
}

interface LayerConfig {
  color: string;
  iconUrl?: string;
  clusterEnabled: boolean;
  clusterDistance: number;
  minZoomLevel?: number;
  maxEntities?: number;
}

interface CesiumEntityOptions {
  type: "billboard" | "point" | "polyline" | "polygon" | "label" | "model";
  color?: string;
  size?: number;
  iconUrl?: string;
  rotation?: number;
  modelUrl?: string;
  modelScale?: number;
  // ... more options
}
```

---

## Real Examples

### Borders Plugin (bundle format)

A minimal bundle plugin that implements the `WorldPlugin` interface directly:

- **Source**: `packages/wwv-plugin-borders/src/index.ts`
- **npm**: `@worldwideview/wwv-plugin-borders`

### Military Bases Plugin (static format)

A static GeoJSON plugin where the npm package is just metadata:

- **Source**: `packages/wwv-plugin-military-bases/src/index.ts`
- **GeoJSON**: `public/data/military_bases.geojson`
- **npm**: `@worldwideview/wwv-plugin-military-bases`
- **Manifest**: Defined in `worldwideview-marketplace/src/data/pluginManifests.ts`

---

## How It All Connects

```
Developer writes plugin
        │
        ▼
Publish to npm ──────────────────────────────────►  npm registry
        │                                            │
        ▼                                            │
Add to knownPlugins.ts ──►  Marketplace ◄────────────┘
(+ pluginManifests.ts        shows plugin       (fetches version,
 for static plugins)         in browse grid      description, etc.)
                                  │
                                  ▼
                           User clicks "Install"
                                  │
                                  ▼
                       Marketplace sends manifest
                       to WorldWideView instance
                                  │
                                  ▼
                       InstalledPluginsLoader saves
                       manifest to database (Prisma)
                                  │
                                  ▼
                       loadPluginFromManifest() routes
                       by format: static → StaticDataPlugin
                                  bundle → dynamic import
                                  │
                                  ▼
                       Plugin renders on the 3D globe
```
