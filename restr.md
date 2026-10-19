# Restructure overview

## Goal

Replace the fixed-tier memory model with an emergent, weighted memory graph, and rebuild the interface around it so the graph's behaviour is visible and the app works on any screen size.

## Backend

- Tiers and promotion thresholds are gone. Every memory carries a continuous weight (0–1) seeded from authored importance.
- Retrieval raises weight from query similarity and connected neighbours, with diminishing headroom. Weight decays continuously against time since last use; use only ever raises it, only time lowers it.
- Memories retrieved together are linked. New memories inherit links from embedding similarity at creation, and both edge strength and node weight decay over time.
- Pruning only forgets memories that are weak *and* isolated; weak-but-connected ones survive.
- Existing databases migrate in place (`weight` column backfilled from importance, `memory_edges` table added).
- The old tier, consolidate and decay endpoints were removed; the remaining JSON API keeps the same routes and shapes.

## Frontend

- Tier cards are replaced by one weight-sorted list with weight meters, retrieval counts, connection chips and a detail sheet.
- Chat shows which memories a reply used, so retrieval and reinforcement are observable.
- UI rebuilt mobile-first on a new warm light palette: responsive two-pane desktop, bottom tab bar on mobile, toasts, confirmations for destructive actions, search/sort/filter on the memory graph.

## Out of scope

Migrating the Python service to TypeScript. That option was analysed but is not part of this change; the FastAPI backend remains the source of truth.
