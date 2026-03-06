"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MAP_CONFIG, PROVINCE_PATHS, CITIES } from "../lib/nepal-map-data";

/**
 * Interactive SVG Map of Nepal — 7 Provinces
 *
 * Uses geographically accurate province boundaries derived from
 * official GeoJSON data (OCHA Nepal administrative boundaries),
 * pre-projected with d3-geo Mercator projection.
 *
 * Each province is clickable and shows a tooltip on hover.
 * Province fill color reflects the leading party.
 */

const DEFAULT_FILL = "#d6d3cd";

// Distinct vibrant colors for each province
const PROVINCE_COLORS = {
  1: "#2563eb", // Koshi — blue
  2: "#16a34a", // Madhesh — green
  3: "#dc2626", // Bagmati — red
  4: "#7c3aed", // Gandaki — purple
  5: "#ea580c", // Lumbini — orange
  6: "#0891b2", // Karnali — teal
  7: "#c026d3", // Sudurpashchim — magenta
};

const PROVINCE_LABELS = {
  1: "Koshi",
  2: "Madhesh",
  3: "Bagmati",
  4: "Gandaki",
  5: "Lumbini",
  6: "Karnali",
  7: "Sudurpashchim",
};

export default function NepalMap({ provinceSummaries, onProvinceClick }) {
  const [hoveredProvince, setHoveredProvince] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const router = useRouter();

  // Map province IDs to colors — use leading party color when counting,
  // otherwise use distinct per-province colors
  const provinceColors = useMemo(() => {
    const colors = {};
    if (!provinceSummaries) {
      // No data yet, use default province colors
      for (const id of Object.keys(PROVINCE_COLORS)) {
        colors[id] = PROVINCE_COLORS[id];
      }
      return colors;
    }
    for (const ps of provinceSummaries) {
      const leadingParty = ps.partySeats?.[0];
      const hasResults = (ps.completed || 0) + (ps.counting || 0) > 0;
      if (hasResults && leadingParty?.partyColor) {
        colors[ps.province.id] = leadingParty.partyColor;
      } else {
        colors[ps.province.id] =
          PROVINCE_COLORS[ps.province.id] || DEFAULT_FILL;
      }
    }
    return colors;
  }, [provinceSummaries]);

  const getProvinceSummaryData = useCallback(
    (provinceId) => {
      if (!provinceSummaries) return null;
      return provinceSummaries.find((ps) => ps.province.id === provinceId);
    },
    [provinceSummaries],
  );

  const handleMouseMove = useCallback((e, provinceId) => {
    const svgRect = e.currentTarget.closest("svg").getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - svgRect.left,
      y: e.clientY - svgRect.top,
    });
    setHoveredProvince(provinceId);
  }, []);

  const handleClick = useCallback(
    (provinceId) => {
      if (onProvinceClick) {
        onProvinceClick(provinceId);
      } else {
        router.push(`/province/${provinceId}`);
      }
    },
    [onProvinceClick, router],
  );

  const hovered = hoveredProvince
    ? getProvinceSummaryData(hoveredProvince)
    : null;

  return (
    <div className="nepal-map-container">
      <div className="nepal-map">
        <svg
          viewBox={MAP_CONFIG.viewBox}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Map of Nepal showing election results by province"
          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.08))" }}
        >
          <title>Nepal Election Results Map</title>

          {/* Definitions for visual effects */}
          <defs>
            <filter
              id="province-shadow"
              x="-2%"
              y="-2%"
              width="104%"
              height="104%"
            >
              <feDropShadow
                dx="1"
                dy="1"
                stdDeviation="1.5"
                floodOpacity="0.08"
              />
            </filter>
          </defs>

          {/* Country outline (subtle shadow layer) */}
          <g opacity="0.04">
            {PROVINCE_PATHS.map((prov) => (
              <path
                key={`shadow-${prov.id}`}
                d={prov.d}
                fill="#000"
                transform="translate(2,2)"
              />
            ))}
          </g>

          {/* Province shapes */}
          {PROVINCE_PATHS.map((prov) => (
            <g key={prov.id}>
              <path
                className={`nepal-map__province ${hoveredProvince === prov.id ? "nepal-map__province--active" : ""}`}
                d={prov.d}
                fill={provinceColors[prov.id] || DEFAULT_FILL}
                onMouseMove={(e) => handleMouseMove(e, prov.id)}
                onMouseLeave={() => setHoveredProvince(null)}
                onClick={() => handleClick(prov.id)}
                tabIndex={0}
                role="button"
                aria-label={`Province ${prov.id}: ${prov.name}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleClick(prov.id);
                }}
              />
              {/* Province name label */}
              <text
                className="nepal-map__label"
                x={prov.labelX}
                y={prov.labelY}
              >
                {PROVINCE_LABELS[prov.id] || prov.name}
              </text>
              {/* Province number */}
              <text
                x={prov.labelX}
                y={prov.labelY + 14}
                style={{
                  fontSize: "8px",
                  fill: "rgba(255,255,255,0.6)",
                  textAnchor: "middle",
                  dominantBaseline: "central",
                  pointerEvents: "none",
                  fontWeight: 400,
                }}
              >
                Province {prov.id}
              </text>
            </g>
          ))}

          {/* Kathmandu marker */}
          <g className="nepal-map__city-marker">
            <circle
              cx={CITIES.kathmandu.x}
              cy={CITIES.kathmandu.y}
              r="3.5"
              fill="#fff"
              stroke="#1c1917"
              strokeWidth="1.2"
            />
            <text
              x={CITIES.kathmandu.x}
              y={CITIES.kathmandu.y - 8}
              style={{
                fontSize: "8px",
                fill: "#1c1917",
                textAnchor: "middle",
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              Kathmandu
            </text>
          </g>

          {/* Pokhara marker */}
          <g className="nepal-map__city-marker">
            <circle
              cx={CITIES.pokhara.x}
              cy={CITIES.pokhara.y}
              r="2.5"
              fill="#fff"
              stroke="#1c1917"
              strokeWidth="1"
            />
            <text
              x={CITIES.pokhara.x}
              y={CITIES.pokhara.y - 6}
              style={{
                fontSize: "6.5px",
                fill: "#44403c",
                textAnchor: "middle",
                fontWeight: 500,
              }}
            >
              Pokhara
            </text>
          </g>
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredProvince && hovered && (
        <div
          className="nepal-map__tooltip"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
          }}
        >
          <strong>{hovered.province.name}</strong>
          <div
            style={{
              fontSize: "var(--text-xs)",
              opacity: 0.7,
              marginTop: "2px",
            }}
          >
            {hovered.completed} declared &middot; {hovered.counting} counting
            &middot; {hovered.pending} pending
          </div>
          {hovered.partySeats?.[0] && (
            <div style={{ fontSize: "var(--text-xs)", marginTop: "3px" }}>
              Leading: {hovered.partySeats[0].partyName} (
              {hovered.partySeats[0].seats})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
