# Shared Module (`shared/`)

The `shared/` directory contains contracts, constants, schemas, and enums that are common to both the frontend and backend services, as well as the AI layer.

## Structure

```
shared/
├── constants/    # Canonical city coordinates (Mysuru, Bengaluru), 50km radius constants, defaults
├── enums/        # Incident categories, severity levels, verification states, city enums
├── schemas/      # JSON Schema specifications for incidents, telemetry, and alerts
└── types/        # Cross-stack interface definitions and data structures
```

## Guiding Principles
- **Single Source of Truth**: All cross-cutting constants and domain enums must be declared here before use in frontend or backend.
- **Language Agnostic**: Use JSON Schema / TypeScript / standardized formats easily consumable by both Python and TypeScript runtimes.
