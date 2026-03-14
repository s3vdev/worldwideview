# Abschlussbericht: Selektive Upstream-Integration (ab 10. März 2026)

**Branch:** `integration/upstream-mar10-plus`  
**Basis:** `main` @ bb4acbb  
**Upstream:** `silvertakana/worldwideview` (fetch vor Integration)

---

## 1. Vollständig übernommene Upstream-Commits

| Upstream-Commit | Beschreibung | Lokale Commits |
|-----------------|--------------|----------------|
| **7db1980** | Docker/Next.js build fix (CopyPlugin raus, Cesium nach Build kopieren) | 9b3370c |
| **f4c420a** | Alpha-Badge im Header | 519e29e (architekturschonend: Header-Suche/Follow beibehalten) |
| **f5ea9d6** | Discord-Link Data Layers | e5c1408 (nur LayerPanel + CSS, kein Import-Tab) |
| **6c6f44c** | Stream-Utilities (isHlsUrl, getYouTubeEmbedUrl, getStreamErrorMessage) | e5c1408 |
| **bccdc6a** | HLS-Stream-Wiedergabe (HlsPlayer, CameraStream-Anpassung) | a6918da |
| **9f9e0fb** | Hellere Military-Farben | 708180c |
| **665893e** | Military-Plugin (adsb.fi), API, Polling, Registrierung | 708180c |
| **6cfef39** | QUINTIC_IN_OUT Easing für alle camera flyTo | da3f72e |

---

## 2. Teilweise / manuell portiert

- **f4c420a / f5ea9d6:** Header und LayerPanel hatten Konflikte; Alpha-Badge und Discord wurden übernommen, bestehende Search-/Follow-Logik und Satellites-/Config-Handling im LayerPanel unverändert.
- **60a584d (military_bases.geojson):** Nicht übernommen (große GeoJSON-Datei; bei Bedarf manuell nach `public/` legen).

---

## 3. Bewusst ausgelassen – Begründung

| Commit | Grund |
|--------|--------|
| **fcdea75** | Entfernt Insecam und stellt auf reines GeoJSON-Camera-Feed um. Würde unsere Camera-/Insecam-Architektur und Validierung (9972253) verwerfen. |
| **53f4a02** | Insecam mit Supabase-Cache – optional später portierbar; aktuell keine Änderung an Camera-Plugin/InsecamSection, um Konflikte mit unserer Pipeline zu vermeiden. |
| **9748d02** | GeoJSON-Importer mit dynamischer Plugin-Registrierung – neuer Store-Slice und LayerPanel-Import-Tab; bewusst zurückgestellt, um Plugin-Registry und Panel-Struktur nicht in diesem Zug zu verändern. |
| **c4f32ec** | GlobeView, Google 3D Tiles, GDOT/Caltrans/TFL – tiefe Eingriffe in GlobeView und Camera-Plugin; Follow-Camera und Entity-Rendering nicht anfassen. Sollte in separatem Schritt adaptiert werden. |

---

## 4. Besonders angepasste Dateien

- **src/components/layout/Header.tsx** – Konflikte aufgelöst: Alpha-Badge + Discord, Suche/Follow und `followLabel`-Typ (String) beibehalten.
- **src/app/globals.css** – Alpha-Badge + Discord-Sidebar-Styles ergänzt, bestehende Spinner/Styles unverändert.
- **src/components/panels/LayerPanel.tsx** – Nur Discord-Link im Data-Layers-Tab; kein GeoJSON-Import-Tab, keine Änderung an Satellites/Config-Logik.
- **src/components/video/CameraStream.tsx** – Nutzung von streamUtils + HlsPlayer für HLS; bestehende Pop-Out-/Store-Integration unverändert.
- **src/plugins/military/index.ts** – Neu; nutzt bestehende PluginTypes (getSelectionBehavior, getFilterDefinitions, getServerConfig), keine getDynamicPosition (poll-basiert wie andere Data-Plugins).
- **src/instrumentation.ts** – `startMilitaryPolling()` ergänzt; Aviation/AIS unverändert.

---

## 5. Risiken / offene Punkte

- **Military-Plugin:** Kein `getDynamicPosition` – Positionen springen beim Poll (60 s). Optional später Interpolation wie bei Aviation ergänzen.
- **military_bases.geojson:** Nicht integriert; bei Bedarf manuell nach `public/` und ggf. eigenes Layer/Plugin anbinden.
- **53f4a02 / 9748d02 / c4f32ec:** Noch nicht integriert; bei nächster Runde gezielt prüfen (Insecam-Cache, GeoJSON-Importer, GlobeView/Tiles).

---

## 6. Git-Befehle / Branchname

```bash
# Branch (bereits erstellt und mit Commits gefüllt)
git checkout integration/upstream-mar10-plus

# Commits auf diesem Branch (neueste zuerst)
da3f72e feat: add QUINTIC_IN_OUT easing to camera flyTo (upstream 6cfef39)
708180c feat: add military flight tracking plugin via adsb.fi (upstream 665893e, 9f9e0fb)
a6918da feat: add HLS stream playback for traffic cameras (upstream bccdc6a)
e5c1408 feat: add stream utils and Discord link in Data Layers (upstream 6c6f44c, f5ea9d6)
519e29e feat: add alpha stage badge and Discord icon (upstream f4c420a)
9b3370c fix: prevent Docker build failure during Next.js build traces (upstream 7db1980)
```

**Basis von main:** `bb4acbb` (fix: ensure viewer reference in useEntityRendering).

---

## 7. Nächste sinnvolle Schritte

1. **Merge/Merge-Request:** `integration/upstream-mar10-plus` nach `main` nur nach manueller Prüfung (Aviation, Follow-Camera, Entity-Rendering im Browser testen).
2. **Optional – Insecam-Cache:** Commit 53f4a02 (Supabase-Cache, stale-while-revalidate) gezielt portieren, sofern Insecam-API-Route und Camera-Plugin beibehalten werden.
3. **Optional – GeoJSON-Importer:** 9748d02 in kleinem Schritt nachziehen: zuerst nur Lib/Converter und Typen, dann Plugin und LayerPanel-Import-Tab, ohne bestehende Plugin-Registrierung zu brechen.
