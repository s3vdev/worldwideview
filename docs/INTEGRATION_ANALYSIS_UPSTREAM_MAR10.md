# Integrationsanalyse: Upstream silvertakana ab 10. März 2026

## Phase 1 – Risikobewertung der Upstream-Commits

| Commit    | Kurzbeschreibung | Betroffene Bereiche | Risiko | Begründung |
|-----------|------------------|---------------------|--------|------------|
| 7db1980   | Docker/Next.js build fix | Dockerfile, next.config.ts | **LOW** | Kein Plugin-/Rendering-Code |
| f4c420a   | Alpha stage badge | globals.css, DiscordIcon, Header | **LOW** | Nur UI |
| f5ea9d6   | Discord link Data Layers | Header, LayerPanel, globals | **LOW** | LayerPanel evtl. Konflikt |
| 6c6f44c   | Stream-Utilities | streamUtils.ts | **LOW** | Eine Datei, klar getrennt |
| bccdc6a   | HLS GDOT | CameraStream, HlsPlayer, streamUtils | **LOW** | Neue Komponenten |
| 60a584d   | military_bases.geojson | eine GeoJSON-Datei | **LOW** | Nur Daten |
| 9f9e0fb   | Military aircraft colors | plugins/military/index.ts | **LOW** | Nur Styling |
| 665893e   | Military plugin adsb.fi | neues Plugin, AppShell, API, lib | **MEDIUM** | Plugin über PluginManager registrieren |
| 6cfef39   | QUINTIC_IN_OUT easing | CameraController, useCameraActions | **MEDIUM** | Kein Follow-Camera-Code (der ist in AnimationLoop) |
| 9748d02   | GeoJSON importer + plugin registration | geojson plugin, LayerPanel, store | **MEDIUM** | Neue Plugin-Architektur kompatibel halten |
| 53f4a02   | Insecam Supabase cache | camera plugin, InsecamSection, API | **MEDIUM** | Insecam behalten, Cache optional |
| c4f32ec   | GlobeView, 3D Tiles, GDOT/Caltrans/TFL | GlobeView, camera plugin, APIs | **HIGH** | Kern-Globe/Camera – nur adaptieren |
| fcdea75   | GeoJSON camera feed, Insecam entfernen | camera plugin, insecam entfernt | **AUSLASSEN** | Würde unsere Camera-/Insecam-Architektur entfernen |

## Phase 2 – Thematische Bündelung und Integrationsreihenfolge

1. **Build/DevOps:** 7db1980  
2. **UI only:** f4c420a, f5ea9d6  
3. **Stream-Utilities:** 6c6f44c, bccdc6a  
4. **Military:** 60a584d, 9f9e0fb, 665893e  
5. **Camera-Easing:** 6cfef39  
6. **GeoJSON-Importer:** 9748d02  
7. **Insecam-Cache:** 53f4a02 (selektiv)  
8. **GlobeView/Data-Sources:** c4f32ec (manuell adaptiert)  
9. **Nicht übernehmen:** fcdea75  

## Geschützte lokale Architektur

- PluginManager / PluginRegistry / plugin lifecycle  
- getDynamicPosition in AnimationLoop  
- Aviation-Animation (dynamisch)  
- useFollowCamera + followCameraState + dataBus followEntity/stopFollow  
- EntityRenderer, useEntityRendering, AnimationLoop  
- Custom-Plugins und Registrierung  
- SVG/Icon/Images der Plugins  
