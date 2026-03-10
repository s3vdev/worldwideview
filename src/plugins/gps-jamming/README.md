# GPS Jamming Plugin

Real-time GPS/GNSS interference visualization using **live data from gpsjam.org**. Renders H3 hexagon polygons by severity; no dummy or fallback data.

## Data Source

**Primary source:** [gpsjam.org](https://gpsjam.org/)

- **Manifest:** `https://gpsjam.org/data/manifest.csv` (available dates)
- **Daily data:** `https://gpsjam.org/data/{YYYY-MM-DD}-h3_4.csv` (H3 resolution 4 hexagons; columns: hex, count_good_aircraft, count_bad_aircraft)
- **Update frequency:** Daily (UTC); API resolves latest available date via manifest or fallback (today, today−1, today−2, today−3)
- **No API key** required

### How It Works

1. Aircraft report navigation accuracy via ADS-B; degraded accuracy in a region indicates potential GPS interference.
2. gpsjam.org aggregates by H3 cells; we fetch the CSV, compute percent affected (GPSJAM formula: `100 * (bad - 1) / (good + bad)`), and convert hexagons to polygons with h3-js.
3. Only cells with ≥2% affected are shown (medium/high severity); low (<2%) are skipped.

## Severity Levels

| Level   | Color  | Criteria        | Description                    |
|--------|--------|-----------------|--------------------------------|
| **High**   | Red    | >10% affected   | Significant GPS interference   |
| **Medium** | Amber  | 2–10% affected  | Moderate interference          |
| **Low**    | Green  | <2% affected    | Not rendered (filtered out)    |

## Features

- Real data from gpsjam.org (manifest + daily CSV)
- H3 hexagon polygons (no circles/ellipses)
- Latest-available-date resolution (manifest first, then date fallback)
- Server-side caching (Cache & Limits → Cache Max Age); manifest and per-date CSV cached
- No dummy/fallback polygons; empty layer when source unavailable
- Color by severity; optional filters (severity, affected %)
- 12-hour default polling; cache TTL from Data Config → Cache & Limits

## API Route

`/api/gps-jamming`

**Query parameters:**

- `date` (optional): Requested date (YYYY-MM-DD); default today (UTC). API resolves to latest available.
- `cacheMaxAgeMs` (optional): Server cache TTL in ms (from Data Config → Cache & Limits; 0 = no cache).

**Response:**

- `polygons`: Array of `{ id, severity, affectedPercent, positions[], timestamp }`
- `debug`: `requestedDate`, `resolvedDate`, `manifestUsed`, `cacheHit`, `fetchAttempts`, `sourceUrlTried`, `finalUrlUsed`, etc.

## Plugin Configuration

- **ID:** `gps-jamming`
- **Category:** Infrastructure
- **Polling interval:** 12 hours (default); cache TTL from Cache & Limits
- **Max polygons:** 2000 (performance cap; only ≥2% severity included)

## Limitations

- **Latency:** Daily aggregation; data is typically one day behind UTC.
- **Coverage:** Depends on aircraft density; sparse regions may have fewer cells.
- **False positives:** Equipment or atmospheric issues can mimic jamming.

## References

- [gpsjam.org](https://gpsjam.org/)
- [GPSJAM FAQ](https://gpsjam.org/faq)
