import { readFileSync, writeFileSync } from "fs";

const raw = JSON.parse(readFileSync("tmp/nuclear_raw.json", "utf-8"));

const features = raw.elements
  .map((el) => {
    // For ways/relations, use center coords
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) return null;

    const tags = el.tags || {};
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        name: tags.name || tags["name:en"] || "Unknown",
        operator: tags.operator || null,
        country: tags["addr:country"] || tags["is_in:country"] || null,
        plant_output: tags["plant:output:electricity"] || null,
        reactor_type: tags["reactor:type"] || null,
        status: tags["disused:power"] ? "decommissioned" :
                tags["abandoned:power"] ? "abandoned" :
                tags["construction:power"] ? "under construction" : "operational",
        osm_id: el.id,
      },
    };
  })
  .filter(Boolean);

const geojson = {
  type: "FeatureCollection",
  features,
};

writeFileSync("public/data/nuclear_facilities.geojson", JSON.stringify(geojson));
console.log(`Wrote ${features.length} nuclear facilities`);
