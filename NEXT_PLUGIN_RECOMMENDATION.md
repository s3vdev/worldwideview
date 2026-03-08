# Next Plugin Recommendation: Real Public Data Sources

## Summary: GPS Jamming Plugin Status

The GPS Jamming plugin has been marked as **DEMO ONLY** because:

- ❌ GPSJAM provides **NO machine-readable API**
- ❌ Only visual web interface available
- ❌ Web scraping unreliable and potentially against ToS
- ✅ Plugin architecture is valid and working
- ✅ Serves as demonstration of how such a plugin *would* work

---

## Recommended Next Plugins (with REAL public APIs)

### 🥇 **#1 PRIORITY: USGS Earthquakes**

**Why This Should Be Next:**
- ✅ **Fully public, no authentication required**
- ✅ **Real-time GeoJSON feed**
- ✅ **Well-documented API**
- ✅ **Perfect fit for WorldWideView**
- ✅ **Natural disaster category (matches existing Wildfire plugin)**

#### Data Source Details

**API Endpoint:**
```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
```

**Update Frequency:** Real-time (every 1-5 minutes)

**Data Format:** GeoJSON FeatureCollection
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "mag": 4.5,
        "place": "10 km SW of Volcano, Hawaii",
        "time": 1609459200000,
        "updated": 1609459800000,
        "tz": null,
        "url": "https://earthquake.usgs.gov/earthquakes/eventpage/...",
        "detail": "...",
        "felt": 12,
        "cdi": 3.4,
        "mmi": 2.8,
        "alert": "green",
        "status": "reviewed",
        "tsunami": 0,
        "sig": 312,
        "net": "us",
        "code": "6000abcd",
        "ids": ",us6000abcd,",
        "sources": ",us,",
        "types": ",origin,phase-data,..
        "nst": 45,
        "dmin": 0.123,
        "rms": 0.42,
        "gap": 48,
        "magType": "mww",
        "type": "earthquake"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-155.27, 19.41, 10.5]
      },
      "id": "us6000abcd"
    }
  ]
}
```

**Available Feeds:**
- Past Hour: `/all_hour.geojson`
- Past Day: `/all_day.geojson`
- Past 7 Days: `/all_week.geojson`
- Past 30 Days: `/all_month.geojson`

**Filtering Options:**
- Significant earthquakes only
- Magnitude thresholds (M1.0+, M2.5+, M4.5+)

**Documentation:** https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

#### Implementation Notes

**Plugin Properties:**
```typescript
id: "earthquake"
name: "Earthquakes"
description: "Real-time seismic activity from USGS"
category: "natural-disaster"
icon: Activity (from lucide-react)
```

**Visualization:**
- Point markers sized by magnitude
- Color coding by alert level (green/yellow/orange/red)
- Depth visualization (altitude = -depth for underground)
- Circle radius proportional to magnitude

**Entity Properties:**
```typescript
{
  magnitude: number,
  depth_km: number,
  place: string,
  alert_level: "green" | "yellow" | "orange" | "red" | null,
  tsunami_warning: boolean,
  felt_reports: number,
  significance: number,
  review_status: "automatic" | "reviewed"
}
```

**Polling Interval:** 2-5 minutes (matches USGS update frequency)

**Filters:**
- Magnitude range (0-10)
- Depth range (0-700km)
- Alert level
- Tsunami warning (yes/no)
- Review status

---

### 🥈 **#2 ALTERNATIVE: Satellite Tracking (ISS & Major Satellites)**

**Why This Is Good:**
- ✅ Public TLE (Two-Line Element) data available
- ✅ Real-time orbital position calculation
- ✅ No authentication for basic satellite list
- ✅ Fascinating visualization on 3D globe

#### Data Source Details

**API Options:**

1. **Celestrak (Recommended)**
   - URL: `https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json`
   - Format: JSON with TLE data
   - Coverage: ISS, Space Stations, Major Satellites
   - No auth required

2. **N2YO**
   - URL: `https://api.n2yo.com/rest/v1/satellite/positions/{satid}/{lat}/{lng}/{alt}/{seconds}`
   - Requires free API key (5000 requests/day)
   - More detailed position data

**TLE Data Example:**
```json
{
  "OBJECT_NAME": "ISS (ZARYA)",
  "OBJECT_ID": "1998-067A",
  "EPOCH": "2026-03-08T12:00:00.000000",
  "MEAN_MOTION": 15.49,
  "ECCENTRICITY": 0.0001234,
  "INCLINATION": 51.6416,
  "RA_OF_ASC_NODE": 123.4567,
  "ARG_OF_PERICENTER": 67.8901,
  "MEAN_ANOMALY": 123.4567,
  "EPHEMERIS_TYPE": 0,
  "CLASSIFICATION_TYPE": "U",
  "NORAD_CAT_ID": 25544,
  "ELEMENT_SET_NO": 999,
  "REV_AT_EPOCH": 12345,
  "BSTAR": 0.00012345,
  "MEAN_MOTION_DOT": 0.00001234,
  "MEAN_MOTION_DDOT": 0
}
```

**Implementation:**
- Use TLE data to calculate real-time orbital positions
- Libraries: `satellite.js` for position calculation
- Update every 10-30 seconds for smooth movement
- Show orbit trail/path

**Challenges:**
- Requires orbital mechanics calculation (use satellite.js library)
- Many satellites to track (performance consideration)
- Need to filter to interesting satellites (ISS, Hubble, major comm sats)

---

### 🥉 **#3 ALTERNATIVE: Internet Outages / BGP Anomalies**

**Why This Is Interesting:**
- ✅ Cyber/infrastructure monitoring (unique category)
- ✅ Some public data available
- ⚠️ Most detailed sources require authentication

#### Data Source Options

1. **RIPE RIS (Routing Information Service)**
   - URL: `https://ris.ripe.net/`
   - Format: JSON
   - Coverage: Global BGP routing data
   - ✅ No auth required for basic queries

2. **Cloudflare Radar (Limited)**
   - URL: `https://radar.cloudflare.com/`
   - Some public API endpoints
   - Outage and traffic anomaly data
   - ⚠️ May require API key for programmatic access

3. **ThousandEyes**
   - ❌ Requires paid account
   - Not suitable for public plugin

**Data Challenges:**
- BGP data is complex and requires interpretation
- Outages are infrequent and sparse
- Geographic mapping not always straightforward (AS numbers vs. locations)

**Visualization Challenges:**
- Not point-based (networks/regions affected)
- Requires polygon/heatmap rendering
- Less intuitive for general users

---

## Final Recommendation

**Build the USGS Earthquakes plugin next** because:

1. ✅ **Easiest to implement** - Clean GeoJSON, no calculation needed
2. ✅ **Most reliable** - USGS is authoritative and stable
3. ✅ **Best user experience** - Intuitive, visually compelling
4. ✅ **Perfect data fit** - Point-based, real-time, global coverage
5. ✅ **Zero auth/keys** - Completely public and free
6. ✅ **Proven source** - Used by thousands of apps/sites

### Implementation Priority

```
1. Earthquakes (USGS) ⭐⭐⭐⭐⭐
   - Easiest, most reliable, perfect fit

2. Satellites (Celestrak) ⭐⭐⭐⭐☆
   - Cool visualization, requires orbital math library

3. Internet Outages (RIPE) ⭐⭐⭐☆☆
   - Complex data, harder to visualize geographically
```

---

## Next Steps

1. Keep GPS Jamming plugin as demo/reference architecture
2. Implement USGS Earthquakes plugin with real API
3. Demonstrate that WorldWideView can integrate *actual* live data
4. Use Earthquakes as template for other natural disaster plugins (volcanoes, weather alerts)

**Estimated Implementation Time:**
- Earthquakes: 1-2 hours (straightforward GeoJSON parsing)
- Satellites: 3-4 hours (orbital calculations + visualization)
- Internet Outages: 4-6 hours (complex data interpretation + polygon rendering)
