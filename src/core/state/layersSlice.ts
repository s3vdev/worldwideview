import type { StateCreator } from "zustand";
import type { AppStore } from "./store";

// ─── Layers Slice ────────────────────────────────────────────
export interface LayerState {
    enabled: boolean;
    entityCount: number;
    isLoading: boolean; // Track if layer is currently fetching data
}

export interface LayersSlice {
    layers: Record<string, LayerState>;
    toggleLayer: (pluginId: string) => void;
    setLayerEnabled: (pluginId: string, enabled: boolean) => void;
    setEntityCount: (pluginId: string, count: number) => void;
    setLayerLoading: (pluginId: string, loading: boolean) => void;
    initLayer: (pluginId: string) => void;
}

export const createLayersSlice: StateCreator<AppStore, [], [], LayersSlice> = (set) => ({
    layers: {},
    toggleLayer: (pluginId) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: {
                    ...state.layers[pluginId],
                    enabled: !state.layers[pluginId]?.enabled,
                },
            },
        })),
    setLayerEnabled: (pluginId, enabled) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: { ...state.layers[pluginId], enabled },
            },
        })),
    setEntityCount: (pluginId, count) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: { ...state.layers[pluginId], entityCount: count },
            },
        })),
    setLayerLoading: (pluginId, loading) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: { ...state.layers[pluginId], isLoading: loading },
            },
        })),
    initLayer: (pluginId) =>
        set((state) => ({
            layers: {
                ...state.layers,
                [pluginId]: state.layers[pluginId] || { enabled: false, entityCount: 0, isLoading: false },
            },
        })),
});
