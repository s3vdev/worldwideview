# Internet Outages: Echtes Playback + optional Summary (V2)

## 1. Aktueller Stand

- **Route:** `src/app/api/internet-outages/route.ts` – nutzt fest `from = now - 6h`, `until = now` (Unix-Sekunden), keine Query-Parameter.
- **Plugin:** `src/plugins/internetOutages/index.ts` – `fetch(_timeRange)` ignoriert `timeRange`, ruft `/api/internet-outages` ohne Parameter auf.
- **Playback:** `TimelineSync` ruft bei Zeitänderung (alle 15 s im Playback) `pluginManager.updateTimeRange(timeRange)` auf; alle Plugins bekommen dasselbe `timeRange`. Das Internet-Outages-Plugin leitet es nicht an die API weiter und filtert nicht nach `currentTime`.

---

## 2. Echtes Playback – technische Umsetzung

### 2.1 Woher das Plugin die Playback-Zeit bekommt

- **timeRange:** Wird bereits an `plugin.fetch(timeRange)` übergeben (`PluginManager.fetchForPlugin` → `managed.context.timeRange = timeRange`).
- **currentTime:** Kommt aus dem Store (`useStore(s => s.currentTime)`). Das Plugin liefert nur Entities; die **Sichtbarkeit** nach aktueller Zeit muss in der **Anzeige** entschieden werden (s. 2.3).

Konkret:

- **Für den Request:** Nur `timeRange` (`.start`, `.end`) wird genutzt → daraus `from` und `until` für IODA.
- **Für die Anzeige:** `currentTime` aus dem Store wird genutzt, um zu entscheiden, welche Outage-Entities zum aktuellen Playback-Zeitpunkt sichtbar sind.

### 2.2 Berechnung von `from` und `until`

- **API:**  
  - Query-Parameter: `from`, `until` (Unix-Epoch-Sekunden, String).  
  - Wenn fehlend: Fallback wie heute (z. B. `now - 6*3600`, `now`).

- **Plugin in `fetch(timeRange: TimeRange)`:**  
  - `fromSec = String(Math.floor(timeRange.start.getTime() / 1000))`  
  - `untilSec = String(Math.floor(timeRange.end.getTime() / 1000))`  
  - Request: `GET /api/internet-outages?from=${fromSec}&until=${untilSec}`

- **Cache (Route):**  
  - Cache-Key von `CACHE_KEY` auf z. B. `CACHE_KEY + ":" + fromSec + ":" + untilSec` umstellen, damit pro Zeitfenster ein eigener Cache-Eintrag existiert und bei gleichem Fenster (z. B. alle 15 s im Playback) Cache-Hits entstehen.

### 2.3 Wann ein Reload ausgelöst wird

- **Bereits vorhanden:**  
  - Beim Klick auf das Zeitfenster im Header (1h/6h/24h/…) wird `setTimeWindow` + `pluginManager.updateTimeRange(range)` aufgerufen → alle Plugins inkl. Internet Outages fetchen mit dem neuen `timeRange`.  
  - In `TimelineSync` (Playback): wenn sich `currentTime` um mehr als 15 s ändert, wird `pluginManager.updateTimeRange(timeRange)` aufgerufen. Dabei bleibt `timeRange` (start/end) unverändert; nur die App-Zeit läuft.

- **Kein zusätzlicher Reload nötig für reines Playback:**  
  - Einmaliger Fetch pro gesetztem Zeitfenster reicht. Die gefetchten Events haben `startTime` und `endTime` in den Entity-`properties`.  
  - Die **Anzeige** filtert nach `currentTime` (s. 2.4). Dafür ist **kein** erneuter Request nötig.

### 2.4 Sichtbarkeit nach aktueller Playback-Zeit (ohne Reload-Spam)

- **Stelle:** `src/core/globe/GlobeView.tsx` – dort wird `visibleEntities` in einem `useMemo` gebaut (Zeilen ~91–117).
- **Erweiterung:**  
  - `currentTime` aus dem Store in die Dependency-Liste des `useMemo` aufnehmen.  
  - Beim Sammeln der Entities für das Plugin `internetOutages`: nur Entities einbeziehen, bei denen die **aktuelle Playback-Zeit** im Outage-Intervall liegt:
    - `entity.properties.startTime` und `entity.properties.endTime` (ISO-String oder Zeitstempel) auslesen.
    - Bedingung: `currentTime >= startTime && currentTime <= endTime` (oder `< endTime` je nach IODA-Definition).  
  - So werden pro Zeitpunkt nur die gerade aktiven Outages gezeichnet; kein zusätzlicher API-Call pro Zeitänderung.

- **Reload-Verhalten:**  
  - Reload passiert nur, wenn sich das **Zeitfenster** ändert (Header-Klick oder zukünftig z. B. `timeRangeChanged`).  
  - Die 15-s-Aktualisierung im Playback löst weiterhin `updateTimeRange(timeRange)` aus; die API wird mit dem **gleichen** `from`/`until` aufgerufen → Cache-Hit, kein Request-Spam.  
  - Optional: Für das Internet-Outages-Plugin könnte man in `TimelineSync` oder im PluginManager eine Ausnahme einbauen, dass bei unverändertem `timeRange` (nur `currentTime` geändert) kein erneuter Fetch ausgelöst wird; dann würde nur die Client-seitige Filterung (visibleEntities) die Anzeige aktualisieren. Das ist zur Vermeidung von Spam sinnvoll, aber nicht zwingend, solange der API-Cache pro (from, until) greift.

---

## 3. Zusammenfassung Implementierung Playback

| Komponente | Änderung |
|------------|----------|
| **Route** `src/app/api/internet-outages/route.ts` | Query-Parameter `from`, `until` auslesen; falls fehlen, Fallback wie bisher. Cache-Key um `from` und `until` erweitern. |
| **Plugin** `src/plugins/internetOutages/index.ts` | In `fetch(timeRange)` die URL mit `timeRange.start`/`timeRange.end` bauen: `?from=…&until=…`. |
| **GlobeView** `src/core/globe/GlobeView.tsx` | Im `useMemo` für `visibleEntities`: `currentTime` aus Store; für Layer `internetOutages` Entities nach `startTime`/`endTime` filtern (nur anzeigen, wenn `currentTime` im Intervall). |

Keine Änderungen an Aviation, Military, Satellites, EntityRenderer, AnimationLoop außer ggf. der eine useMemo-Anpassung in GlobeView.

---

## 4. Optional V2: Summary als Zusatz-Request

- **Rolle von `/v2/outages/summary`:**  
  Nur Ergänzung: aggregierter Score pro Entity (z. B. Land) über das Zeitfenster – für stabilere Einfärbung und Tooltips, **nicht** als Ersatz für Events.

- **Ablauf:**  
  1. **Events** wie bisher (oder wie in Abschnitt 2 mit `from`/`until` aus dem Zeitfenster) – bleiben Basis für sichtbare Outages und Playback-Filterung.  
  2. **Summary** zusätzlich: gleiches Zeitfenster, z. B. `GET /v2/outages/summary?entityType=country&from=…&until=…&limit=…`.  
  3. **Merge:** Anhand `entityCode` (Land) Events mit Summary-Einträgen zusammenführen; z. B. `properties.overallScore` oder `properties.summaryScore` aus der Summary in die Entity-`properties` übernehmen.  
  4. **Darstellung:**  
     - Severity/Farbe optional aus Summary-Score ableiten (z. B. gleiche Schwellen wie heute, aber auf aggregiertem Score), falls gewünscht.  
     - Tooltip/InfoCard: zusätzlich „Overall score (window)“ aus der Summary anzeigen.

- **Umsetzung:**  
  - In der Route: optional zweiter Request an IODA Summary; Ergebnis nach Country-Code in eine Map; bei der Normalisierung der Events (parseOutagesFromResponse / Aufbau der `outages`-Liste) pro Land den Summary-Score eintragen.  
  - Oder: separates kleines Endpoint/Query-Parameter „withSummary=true“, das die Route einmal Events und einmal Summary holt und merged.  
  - Plugin bleibt unverändert in der Logik „eine Liste von Outages mit Ländercode“; nur die Entities sind angereichert (z. B. `properties.summaryScore`).

- **Wichtig:**  
  - Playback und „welche Outages sind sichtbar“ weiterhin aus **Events** + Zeitfilter (`currentTime` in [startTime, endTime]).  
  - Summary nur für Anreicherung (Farbe/Tooltip/Ranking), nicht für die Entscheidung „wird diese Entity gezeichnet“.

---

## 5. TODO V2 Summary (optional)

- [ ] In der Route: zweiten Request an `/v2/outages/summary?entityType=country&from=…&until=…`; Response nach Country-Code mergen; `properties.summaryScore` / `overallScore` in die Outage-Items übernehmen.
- [ ] Plugin/Entity: Tooltip oder InfoCard um „Overall score (Fenster)“ aus Summary erweitern; Severity-Farbe optional aus Summary-Score ableiten.

## 6. Dateien-Übersicht

| Änderung | Datei |
|----------|--------|
| Query `from`/`until`, Cache-Key | `src/app/api/internet-outages/route.ts` |
| `fetch(timeRange)` → API mit from/until | `src/plugins/internetOutages/index.ts` |
| Filter nach currentTime für internetOutages | `src/core/globe/GlobeView.tsx` |
| Optional V2: Summary-Request + Merge | `src/app/api/internet-outages/route.ts` (intern) |

Damit ist echtes Playback (zeitfensterabhängige Anzeige, keine unnötigen Reloads) und optional Summary als Zusatz sauber abgedeckt.
