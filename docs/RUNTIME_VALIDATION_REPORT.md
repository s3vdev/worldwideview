# Runtime-Validierung & Stabilisierung – Abschlussbericht

**Branch:** `integration/upstream-mar10-plus`  
**Datum:** Nach selektiver Upstream-Integration (Mar 10+)

---

## 1. Durchgeführte Tests / Checks

### Phase 1 – Schneller technischer Check
- **Projekt-Start:** Branch geprüft (`integration/upstream-mar10-plus`), TypeScript `tsc --noEmit` erfolgreich.
- **Code-Pfade:** Analyse der Daten- und Render-Pfade für Aviation, Military, Follow-Camera, HLS (kein manueller Browser-Lauf im Rahmen dieser Aufgabe).

### Phase 2 – Kritische Kernvalidierung (Code-Analyse)

**A. Aviation**
- `getDynamicPosition` in Aviation vorhanden und wird in AnimationLoop (Zeile 99–122) pro Frame aufgerufen.
- EntityRenderer setzt bei Plugins mit `getDynamicPosition` die Position nicht überschreibend; AnimationLoop ist alleiniger Schreibweg für bewegte Positionen.
- Bei neuen Daten: `hasNewData` invalidiert `basePosition`/`velocityVector`; Extrapolation nutzt aktuellen Stand.

**B. Military-Plugin**
- Registrierung in AppShell über PluginRegistry wie alle anderen Plugins.
- **Gefunden:** adsb.fi liefert `ac.gs` in **Knoten**, AnimationLoop/`extrapolatePosition` erwarten `entity.speed` in **m/s** → Extrapolation wäre falsch (Faktor ~0.51).

**C. Follow-Camera**
- Folgt `item.posRef`, der von AnimationLoop aus `getDynamicPosition` (Aviation) bzw. `extrapolatePosition` (Military) befüllt wird.
- `setFollowUpdateInProgress` verhindert Konflikt mit camera.moveStart/moveEnd.
- QUINTIC_IN_OUT betrifft nur flyTo (Presets, cameraGoTo), nicht die Follow-Lerp-Logik.

**D. HLS-Camera-Streams**
- **Gefunden:** Asynchroner `import("hls.js").then(...)` konnte nach Effect-Cleanup noch laufen → potentieller Hls-Instance-Leak und Zugriff auf entmountete Refs.

### Phase 3 – Bugfixing
- Zwei konkrete Bugs behoben (siehe unten).

### Phase 4 – Regressionen
- Keine doppelten/konfligierenden Plugin-IDs.
- Military nutzt dieselben Pfade (EntityRenderer → animatablesMap → AnimationLoop); kein getDynamicPosition, dafür Extrapolation mit speed/heading.
- GeoEntity.speed/heading werden nur in AnimationLoop und EntityRenderer (hasNewData) genutzt; keine veralteten Caches an anderen Stellen gefunden.

---

## 2. Gefundene konkrete Probleme

| # | Bereich | Problem |
|---|---------|---------|
| 1 | Military | `entity.speed` kam von adsb.fi in Knoten; AnimationLoop nutzt speed in m/s → Extrapolation und Follow-Camera würden Military-Flugzeuge mit falscher Geschwindigkeit bewegen. |
| 2 | HlsPlayer | Kein Cleanup bei Effect-Ende: async `import("hls.js").then(...)` konnte nach Unmount/src-Wechsel noch Hls instanziieren und an hlsRef hängen, ohne dass destroy aufgerufen wurde. Safari: video.src wurde beim Cleanup nicht geleert. |

---

## 3. Behobene Bugs

| Bug | Fix |
|-----|-----|
| **Military speed Einheit** | In `src/plugins/military/index.ts`: `speed: knotsToMs(groundSpeedKts)` ergänzt (1 kt ≈ 0.514444 m/s). `entity.speed` ist damit konsistent mit Aviation (m/s) für Extrapolation und Follow. |
| **HlsPlayer Lifecycle** | In `src/components/video/HlsPlayer.tsx`: `cancelled`-Flag im Effect; Cleanup setzt `cancelled = true` und ruft `cleanup()` auf. Im `import().then()` wird bei `cancelled` sofort `hls.destroy()` aufgerufen und nicht an ref gehängt. Safari-Cleanup: `video.src = ""` im return. |

---

## 4. Geänderte Dateien

- `src/plugins/military/index.ts` – Hilfsfunktion `knotsToMs`, Entity-Mapping setzt `speed` in m/s.
- `src/components/video/HlsPlayer.tsx` – Lifecycle mit `cancelled`-Flag, Safari-Cleanup, kein Hls-Leak bei Unmount/src-Wechsel.

---

## 5. Verbleibende Risiken / offene Punkte

- **Manueller Browser-Check:** Es wurde keine interaktive Browser-Session (Konsole, Network, Klick auf Aviation/Military/Follow/HLS) durchgeführt. Empfohlen: einmal App starten, Aviation + Military Layer aktivieren, Follow auf eine bewegte Entität, eine HLS-URL in einer Camera testen und Konsole/Network prüfen.
- **Build-Lock:** `npm run build` war wegen laufendem anderen Next-Prozess blockiert; `npx tsc --noEmit` war erfolgreich.
- **Military ohne getDynamicPosition:** Bewegen sich nur über Extrapolation (speed/heading); bei sehr langen Poll-Intervallen oder fehlenden Werten springen Positionen beim nächsten Poll. Optional später getDynamicPosition wie bei Aviation ergänzen.

---

## 6. Mergefähigkeit

**Einschätzung:** **Ja, unter Vorbehalt.**

- Integrations-Branch ist konsistent; zwei reale Bugs (Military-Einheit, HlsPlayer-Lifecycle) wurden behoben.
- Aviation- und Follow-Logik unverändert; Military nutzt dieselben Render-/Update-Pfade mit korrekter Einheit.
- Empfehlung: Vor Merge in `main` einmal manuell im Browser prüfen (Start, Plugins laden, Aviation/Military sichtbar und bewegt, Follow ohne Jitter, HLS-Stream wechseln/schließen ohne Fehler in der Konsole).

---

**Commit der Stabilisierung:**  
`fix: military speed units (knots→m/s) and HlsPlayer lifecycle`
