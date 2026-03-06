/**
 * Simplify Nepal provinces GeoJSON using Douglas-Peucker algorithm.
 * Reduces 5MB+ down to ~150KB while preserving geographic accuracy.
 */
const fs = require('fs');
const path = require('path');

// ─── Douglas-Peucker Line Simplification ─────────────────────────────
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt(
    (point[0] - lineStart[0]) ** 2 + (point[1] - lineStart[1]) ** 2
  );
  const u = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (mag * mag);
  const closestX = lineStart[0] + u * dx;
  const closestY = lineStart[1] + u * dy;
  return Math.sqrt((point[0] - closestX) ** 2 + (point[1] - closestY) ** 2);
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[end]];
}

function simplifyRing(ring, epsilon) {
  const simplified = douglasPeucker(ring, epsilon);
  // Ensure ring is closed
  if (simplified.length >= 3) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([...first]);
    }
  }
  return simplified;
}

function roundCoords(coords, decimals = 4) {
  return coords.map(c => [
    parseFloat(c[0].toFixed(decimals)),
    parseFloat(c[1].toFixed(decimals)),
  ]);
}

// ─── Main ─────────────────────────────────────────────────────────────
const inputPath = path.join(__dirname, '..', 'data', 'nepal-provinces.geojson');
const outputPath = path.join(__dirname, '..', 'data', 'nepal-provinces-simplified.json');

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Province names mapping
const PROVINCE_NAMES = {
  '1': 'Koshi',
  '2': 'Madhesh',
  '3': 'Bagmati',
  '4': 'Gandaki',
  '5': 'Lumbini',
  '6': 'Karnali',
  '7': 'Sudurpashchim',
};

// Epsilon = 0.003 degrees ≈ ~300m — good balance of accuracy vs size
const EPSILON = 0.003;

const simplified = {
  type: 'FeatureCollection',
  features: raw.features.map((feature) => {
    const provinceNum = feature.properties.ADM1_EN;
    const geom = feature.geometry;
    let newCoords;

    if (geom.type === 'MultiPolygon') {
      newCoords = geom.coordinates.map(polygon =>
        polygon.map(ring => roundCoords(simplifyRing(ring, EPSILON)))
      );
    } else if (geom.type === 'Polygon') {
      newCoords = geom.coordinates.map(ring =>
        roundCoords(simplifyRing(ring, EPSILON))
      );
    }

    const totalPoints = newCoords.flat(2).length;

    console.log(
      `Province ${provinceNum} (${PROVINCE_NAMES[provinceNum]}): ` +
      `${feature.geometry.coordinates.flat(2).length} → ${totalPoints} points`
    );

    return {
      type: 'Feature',
      properties: {
        id: parseInt(provinceNum, 10),
        name: PROVINCE_NAMES[provinceNum],
        code: feature.properties.ADM1_PCODE,
      },
      geometry: {
        type: geom.type,
        coordinates: newCoords,
      },
    };
  }),
};

fs.writeFileSync(outputPath, JSON.stringify(simplified));

const originalSize = fs.statSync(inputPath).size;
const newSize = fs.statSync(outputPath).size;
console.log(`\nOriginal: ${(originalSize / 1024).toFixed(0)} KB`);
console.log(`Simplified: ${(newSize / 1024).toFixed(0)} KB`);
console.log(`Reduction: ${((1 - newSize / originalSize) * 100).toFixed(1)}%`);
