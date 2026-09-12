# UrbanPulse Frontend Client (`frontend/`)

This directory contains the architecture for the UrbanPulse client application (built with Next.js App Router, TypeScript, and modern 3D map spatial engines).

## Directory Structure

```
frontend/
├── app/          # Next.js App Router: routes, layouts, and route handlers
├── components/   # Atomic, reusable UI primitives (buttons, modals, tooltips)
├── features/     # Domain feature modules (traffic, routing, hazards, 3d-map, environment)
├── hooks/        # Custom React hooks (geolocation, radius queries, websocket sync)
├── lib/          # Client utilities, math helpers, MapLibre/DeckGL abstractions
├── services/     # Backend REST and WebSocket API client services
├── stores/       # Global client-side state (Zustand: active city, 50km radius filter, user position)
├── types/        # Frontend-specific TypeScript types and interfaces
├── styles/       # Global styling tokens, Tailwind configuration, CSS modules
├── public/       # Static web assets (icons, municipal logos, map marker SVGs)
└── tests/        # Unit, component, and E2E test suites (Vitest / Playwright)
```

## Architecture Principles
1. **Domain-Driven Features**: Feature logic is self-contained in `features/` rather than mixed into global component trees.
2. **Strict Spatial Separation**: Map and 3D rendering pipelines (Deck.gl / MapLibre) reside cleanly inside their respective feature modules or `lib/`.
3. **Reactive State**: Active city location (Mysuru vs. Bengaluru) and 50 km intelligence radius filters are managed centrally via stores.
