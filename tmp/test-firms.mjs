async function testFirms() {
    const key = "invalid_key_12345";
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`;
    const response = await fetch(url);
    const text = await response.text();
    console.log("Status:", response.status);
    console.log("Text:", text);
}

testFirms();
