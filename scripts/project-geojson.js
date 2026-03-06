/**
 * Pre-project the simplified GeoJSON to SVG path strings.
 * This eliminates the need for d3-geo at runtime.
 * Uses d3-geo's Mercator projection fitted to Nepal.
 */
async function main() {
const fs = require('fs');
const path = require('path');
const { geoMercator, geoPath } = await import('d3-geo');

const inputPath = path.join(__dirname, '..', 'data', 'nepal-provinces-simplified.json');
const outputPath = path.join(__dirname, '..', 'data', 'nepal-map-paths.json');

const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// SVG dimensions
const WIDTH = 960;
const HEIGHT = 480;

// Create a Mercator projection fitted to Nepal's bounds
const projection = geoMercator().fitSize([WIDTH, HEIGHT], geojson);
const pathGenerator = geoPath().projection(projection);

// Compute centroid for each province (for labels)
const provinces = geojson.features.map((feature) => {
  const d = pathGenerator(feature);
  const centroid = pathGenerator.centroid(feature);
  const bounds = pathGenerator.bounds(feature);
  
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    d: d,
    labelX: Math.round(centroid[0]),
    labelY: Math.round(centroid[1]),
    bounds: {
      x1: Math.round(bounds[0][0]),
      y1: Math.round(bounds[0][1]),
      x2: Math.round(bounds[1][0]),
      y2: Math.round(bounds[1][1]),
    },
  };
});

// Also project Kathmandu (27.7172° N, 85.3240° E)
const ktmCoord = projection([85.3240, 27.7172]);
const kathmandu = {
  x: Math.round(ktmCoord[0] * 10) / 10,
  y: Math.round(ktmCoord[1] * 10) / 10,
};

// Also project Pokhara (28.2096° N, 83.9856° E)
const pkrCoord = projection([83.9856, 28.2096]);
const pokhara = {
  x: Math.round(pkrCoord[0] * 10) / 10,
  y: Math.round(pkrCoord[1] * 10) / 10,
};

// Also project Biratnagar (26.4525° N, 87.2718° E)
const birCoord = projection([87.2718, 26.4525]);
const biratnagar = {
  x: Math.round(birCoord[0] * 10) / 10,
  y: Math.round(birCoord[1] * 10) / 10,
};

const output = {
  viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
  width: WIDTH,
  height: HEIGHT,
  provinces,
  cities: {
    kathmandu,
    pokhara,
    biratnagar,
  },
};

// Write as a JS module for direct import
const jsModulePath = path.join(__dirname, '..', 'lib', 'nepal-map-data.js');

const jsContent = `/**
 * Pre-projected SVG paths for Nepal's 7 provinces.
 * Generated from official GeoJSON data (mesaugat/geoJSON-Nepal).
 * Projection: Mercator, fitted to ${WIDTH}x${HEIGHT} SVG viewport.
 * 
 * DO NOT EDIT — regenerate with: node scripts/project-geojson.js
 */

export const MAP_CONFIG = {
  viewBox: '0 0 ${WIDTH} ${HEIGHT}',
  width: ${WIDTH},
  height: ${HEIGHT},
};

export const PROVINCE_PATHS = ${JSON.stringify(provinces, null, 2)};

export const CITIES = ${JSON.stringify({ kathmandu, pokhara, biratnagar }, null, 2)};
`;

fs.writeFileSync(jsModulePath, jsContent);
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log('Generated:');
console.log(`  ${jsModulePath} (${(fs.statSync(jsModulePath).size / 1024).toFixed(1)} KB)`);
console.log(`  ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
console.log('\nProvince details:');
provinces.forEach(p => {
  console.log(`  ${p.id}. ${p.name}: label(${p.labelX}, ${p.labelY}), path length=${p.d.length} chars`);
});
console.log(`\nCities: Kathmandu(${kathmandu.x}, ${kathmandu.y}), Pokhara(${pokhara.x}, ${pokhara.y}), Biratnagar(${biratnagar.x}, ${biratnagar.y})`);
}

main().catch(console.error);