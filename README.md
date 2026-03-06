# Nepal Election Results Platform

A real-time election results platform for Nepal, designed for post-election result tracking.

## Features

- **Real-time results**: Regularly updated vote counts from multiple sources
- **Interactive map**: Explore results by province, district, and constituency
- **Data transparency**: Clear source labeling and timestamps on all data
- **Mobile-first**: Responsive design optimized for all devices
- **Accessible**: WCAG 2.1 AA compliant

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data Sources

- **Primary**: Election Commission of Nepal (official verification)
- **Secondary**: Ekantipur (real-time provisional data via server-side scraping)

All scraped data is clearly labeled as **Provisional** until verified against official sources.

## Configuration

Copy `.env.example` to `.env` and adjust settings:

- `DATA_MODE`: Set to `demo` for sample data or `live` for real scraping
- `SCRAPE_INTERVAL_SECONDS`: Polling frequency (default: 45s)

## Architecture

- **Next.js 14** — SSR pages for SEO, React components for interactivity
- **Custom server** — Express wrapper running cron-scheduled scrapers
- **In-memory store** — Fast data access with periodic file persistence
- **Reconciliation engine** — Cross-references multiple data sources

## Disclaimer

This platform aggregates publicly available election data for informational purposes. Vote counts labeled "Provisional" are sourced from media reports and may differ from official Election Commission figures. Always refer to the Election Commission of Nepal for certified results.
