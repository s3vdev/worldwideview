# API Reference

This document provides a technical reference for the core internal services of WorldWideView. These services are designed to be used by plugins and core components for communication and data management.

## `DataBus`

The `DataBus` is a central event emitter used for decoupled, typed communication between different parts of the application.

- **Import**: `import { dataBus } from "@/core/data/DataBus";`
- **Source**: `src/core/data/DataBus.ts`

### Methods

#### `on<K>(event: K, handler: Handler): () => void`
Subscribes to an event. Returns an unsubscribe function.
- **event**: The event name (keys of `DataBusEvents`).
- **handler**: A callback function receiving the event data.

#### `off<K>(event: K, handler: Handler): void`
Unsubscribes from an event.
- **event**: The event name.
- **handler**: The handler function to remove.

#### `emit<K>(event: K, data: T): void`
Broadcasts an event to all subscribers.
- **event**: The event name.
- **data**: The payload for the event.

#### `removeAllListeners(event?: string): void`
Removes all listeners for a specific event, or all listeners if no event is provided.

---

## `PluginRegistry`

The `PluginRegistry` manages the registration and discovery of all `WorldPlugin` implementations.

- **Import**: `import { pluginRegistry } from "@/core/plugins/PluginRegistry";`
- **Source**: `src/core/plugins/PluginRegistry.ts`

### Methods

#### `register(plugin: WorldPlugin): void`
Adds a new plugin to the registry. Throws a warning if the plugin ID is already registered.

#### `get(pluginId: string): WorldPlugin | undefined`
Retrieves a plugin by its unique ID.

#### `getAll(): WorldPlugin[]`
Returns an array of all registered plugins.

#### `getByCategory(category: string): WorldPlugin[]`
Returns all plugins belonging to a specific category.

#### `has(pluginId: string): boolean`
Checks if a plugin with the given ID is registered.

#### `unregister(pluginId: string): void`
Removes a plugin from the registry.

---

## `CacheLayer`

The `CacheLayer` provides a two-tier caching mechanism for geographical entities.

- **Import**: `import { cacheLayer } from "@/core/data/CacheLayer";`
- **Source**: `src/core/data/CacheLayer.ts`

### Methods

#### `init(): Promise<void>`
Initializes the IndexedDB store. Must be called before persistent storage operations.

#### `set(pluginId: string, entities: GeoEntity[], ttlMs?: number): void`
Caches entities for a plugin.
- **pluginId**: Unique identifier for the data source.
- **entities**: Array of `GeoEntity` objects.
- **ttlMs**: Time-to-live in milliseconds (default: 30,000).

#### `get(pluginId: string): GeoEntity[] | null`
Retrieves entities from the L1 (Memory) cache. Returns `null` if expired or missing.

#### `getFromPersistent(pluginId: string): Promise<GeoEntity[] | null>`
Retrieves entities from the L2 (IndexedDB) cache. This method also populates the L1 cache on success.

#### `invalidate(pluginId: string): void`
Removes entries for a plugin from both L1 and L2 caches.

#### `clear(): void`
Purges all data from both cache tiers.
