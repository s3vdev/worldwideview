# GPS Jamming Plugin (DEMO ONLY)

⚠️ **WARNING: This plugin uses STATIC DEMONSTRATION DATA, not live GPS jamming feeds.**

A WorldWideView plugin demonstrating GPS/GNSS interference visualization architecture.

## ⚠️ CRITICAL LIMITATIONS

**This is NOT a live GPS jamming plugin.** It displays static hotspot data from public reports.

### Why No Live Data?

1. **GPSJAM has NO machine-readable API**
   - Only provides visual map interface
   - No JSON/GeoJSON endpoints exist
   - Web scraping unreliable and potentially against ToS

2. **Real-time GPS interference data requires:**
   - Commercial ADS-B Exchange API access
   - Direct ADS-B receiver infrastructure
   - Licensed GPS monitoring services

3. **Current implementation:**
   - Static coordinates from public reports
   - No real-time updates
   - Timestamps are display-only (not actual detection time)

## Overview

This plugin displays GPS/GNSS interference patterns on the 3D globe based on aircraft navigation accuracy degradation reports. It provides real-time visualization of regions experiencing GPS jamming or spoofing activity.

## Data Source

**Primary Source:** GPSJAM (https://gpsjam.org/)

- **Data Provider:** ADS-B Exchange (https://www.adsbexchange.com/data/)
- **Method:** Aggregates aircraft navigation accuracy reports from ADS-B transponder data
- **Coverage:** Global (dependent on flight density)
- **Update Frequency:** Daily (24-hour aggregation)

### How It Works

1. Commercial aircraft broadcast their GPS navigation accuracy via ADS-B (Navigation Integrity Category - NIC values)
2. When multiple aircraft in proximity report degraded accuracy simultaneously, it indicates potential GPS interference
3. Data is aggregated into geographic regions and classified by severity

## Severity Levels

| Level | Color | Criteria | Description |
|-------|-------|----------|-------------|
| **High** | Red (#ef4444) | >10% aircraft affected | Significant GPS interference detected |
| **Medium** | Amber (#f59e0b) | 2-10% aircraft affected | Moderate GPS interference detected |
| **Low** | Green (#22c55e) | <2% aircraft affected | Minimal interference, mostly normal operation |

## Features

- ✅ Global coverage of GPS/GNSS interference events
- ✅ Color-coded severity visualization
- ✅ Interactive entity selection with detailed metadata
- ✅ Clustering for dense regions
- ✅ Filter by severity level and affected percentage
- ✅ 12-hour polling interval (matches data cadence)
- ✅ No API keys required

## Visualization

The plugin renders GPS jamming data as **semi-transparent circular regions** on the Cesium globe:

### Area Representation

Each hotspot is visualized with:
- **Center Point Marker:** Indicates the approximate hotspot center
  - Size: 8px (fixed)
  - Color: Severity-based (red/amber/green)
  - Outline: Black, 2px
  
- **Circular Affected Area:** Semi-transparent overlay showing approximate interference region
  - **NOT a precise boundary** - visual approximation only
  - Radius scaled by severity and affected percentage
  - Fill: Semi-transparent (15-25% opacity)
  - Border: More visible (40-60% opacity), 2px width

### Radius Scaling

**Base radius by severity:**
- **High:** ~150km (affected area)
- **Medium:** ~100km (affected area)
- **Low:** ~60km (affected area)

**Additional scaling:** Radius increases 10-30% based on `affectedPercent` value

**Example:**
- High severity with 25% affected → ~165km radius
- Medium severity with 8% affected → ~108km radius
- Low severity with 2% affected → ~62km radius

### Color Scheme

| Severity | Fill Color | Border Color | Point Color |
|----------|-----------|--------------|-------------|
| **High** | `rgba(239, 68, 68, 0.25)` (red, 25% opacity) | `rgba(239, 68, 68, 0.6)` (red, 60% opacity) | `#ef4444` (red) |
| **Medium** | `rgba(245, 158, 11, 0.20)` (amber, 20% opacity) | `rgba(245, 158, 11, 0.5)` (amber, 50% opacity) | `#f59e0b` (amber) |
| **Low** | `rgba(34, 197, 94, 0.15)` (green, 15% opacity) | `rgba(34, 197, 94, 0.4)` (green, 40% opacity) | `#22c55e` (green) |

### Display Behavior

- **Labels:** Shown only for high-severity events (≥10% affected aircraft)
- **Clustering:** Disabled (areas need individual rendering)
- **Distance Culling:** Areas hidden beyond 10,000km camera distance (performance)
- **Selection:** Clicking area or center point shows entity details

## Entity Properties

Each GPS jamming entity includes the following metadata:

```typescript
{
  severity: "low" | "medium" | "high",
  affectedPercent: number,        // % of aircraft reporting degraded accuracy
  region: string,                 // Geographic region name
  source: "GPSJAM (Demo)",       // Data source identifier (marked as demo)
  description: string,            // Human-readable description
  
  // Area visualization properties
  radiusMeters: number,           // Calculated affected area radius
  fillColor: string,              // Semi-transparent fill (rgba)
  borderColor: string,            // Border color (rgba)
  areaNote: "Approximate visualization - not a precise boundary"
}
```

## Filtering

The plugin supports two filter types:

1. **Severity Filter:** Select low/medium/high severity events
2. **Affected Percentage:** Range slider (0-100%) to filter by impact level

## Known Hotspots

Based on public reports, common GPS jamming regions include:

- Eastern Europe (Ukraine conflict zones)
- Black Sea region
- Baltic States
- Middle East (Syria, Israel/Palestine, Iraq)
- Eastern Mediterranean
- Caucasus region

## Implementation Details

### Plugin Configuration

- **ID:** `gps-jamming`
- **Category:** Infrastructure
- **Icon:** Radio (from lucide-react)
- **Polling Interval:** 12 hours (43,200,000 ms)
- **Max Entities:** 2000
- **Clustering:** Disabled (area-based visualization)
- **Visualization:** Center points + circular areas

### API Route

`/api/gps-jamming`

Returns JSON with the following structure:

```json
{
  "dataPoints": [
    {
      "id": "string",
      "latitude": number,
      "longitude": number,
      "severity": "low" | "medium" | "high",
      "affectedPercent": number,
      "timestamp": "ISO8601 string",
      "region": "string"
    }
  ],
  "timestamp": "ISO8601 string",
  "source": "string",
  "updateInterval": "string",
  "note": "string"
}
```

## Current Status

**Status:** ⚠️ **DEMO MODE - STATIC DATA ONLY**

This plugin serves as an architectural example for how GPS jamming visualization *would* work with real data. Current limitations:

1. ❌ **NOT connected to GPSJAM** - No API exists
2. ❌ **NOT real-time** - Uses static coordinates
3. ❌ **NOT updated** - Hotspot list is hardcoded
4. ✅ **Architecture valid** - Plugin framework correctly implemented
5. ✅ **Visualization working** - Demonstrates how data would appear

### Data Source Reality Check

**GPSJAM (https://gpsjam.org/):**
- ❌ No public API (confirmed via research)
- ❌ No machine-readable data format
- ✅ Visual map interface only
- ✅ Data comes from ADS-B Exchange (requires commercial access)

**What This Plugin Actually Shows:**
- Static list of known GPS jamming hotspots
- Based on: Aviation authority reports, conflict zone analysis, public incident databases
- Updated: Never (hardcoded in source code)
- Accuracy: Historical/general regions only

### Path to Live Data

To transition to live data, consider:

1. **Contact GPSJAM:** Request official API access or data feed
2. **ADS-B Exchange Integration:** Implement NIC-based aggregation using their API
3. **Alternative Sources:** Integrate with Flightradar24 or similar services offering GPS jamming overlays

The current fallback data is based on:
- Historical GPS jamming reports from aviation authorities
- Conflict zone analysis
- Public GNSS interference databases
- News reports and incident logs

## Limitations

1. **Data Accuracy:** Interference detection depends on aircraft density; sparse regions may have incomplete data
2. **Latency:** Daily aggregation means real-time jamming events appear with ~12-24 hour delay
3. **False Positives:** Equipment malfunctions, atmospheric conditions, or solar activity can mimic jamming
4. **Coverage Gaps:** Oceanic and remote areas with minimal air traffic have limited visibility

## Security Considerations

- ✅ No authentication required (public data)
- ✅ Server-side data fetching (protects client from CORS issues)
- ✅ Input validation and error handling
- ✅ No sensitive information exposed

## Future Enhancements

- [ ] Integrate official GPSJAM API when available
- [ ] Add historical playback support
- [ ] Implement heatmap/polygon visualization for dense regions
- [ ] Add severity trend indicators (increasing/decreasing)
- [ ] Integrate with conflict/maritime/aviation layers for cross-correlation
- [ ] Add notification system for new high-severity events
- [ ] Implement region-specific alerts (e.g., "Your area affected")

## References

- GPSJAM: https://gpsjam.org/
- GPSJAM FAQ: https://gpsjam.org/faq
- ADS-B Exchange: https://www.adsbexchange.com/
- Flightradar24 GPS Jamming Map: https://www.flightradar24.com/data/gps-jamming

## License

This plugin follows the WorldWideView project license. Data sources may have their own terms of use.
