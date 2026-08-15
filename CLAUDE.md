# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Code exists. `backend/` (FastAPI) and `frontend/` (a Lovable-generated TanStack Start app) are the real application. An earlier Vite + react-router scaffold (previously at `frontend/`, then `frontend-v2/`) has been removed — don't reference its tooling (pnpm, react-router, base-ui, port 5173).

## What this project is

A medication-tracking app for elderly care, built for the Hackathon IFRS Campus Feliz (14–15 Aug 2026, ~16h dev window, team of 5). Full context — problem definition, functional requirements (RF01–RF14), non-functional requirements (RNF01–RNF13), and business rules (RN01–RN20) — lives in `planejamento.md`. Read it in full before implementing any feature; it is the source of truth for scope and behavior.

Core differentiator: a medication diary shared across multiple caregivers for the same elderly person, with automatic drug-interaction checking (against a curated internal dataset, not an external API) and duplicate-dose blocking (if one caregiver already confirmed a dose, others are blocked and told who/when).

### Actual stack
- Frontend (`frontend/`): React 19 + TanStack Start (SSR, file-based routing) + Tailwind CSS v4 + Radix UI (shadcn-style components), npm as package manager. Dev server is pinned to port 8080 by the Lovable Vite config (`@lovable.dev/vite-tanstack-config`) — don't fight it with a custom `server.port`.
- Backend (`backend/`): Python + FastAPI + SQLAlchemy 2.0, deployed on Render as a continuous Web Service (**not** Vercel serverless — cold starts/timeouts break Postgres connections)
- Database: PostgreSQL 17, managed by Render in production
- Frontend and backend are deployed separately with distinct URLs, communicating over HTTP via `VITE_API_URL` (frontend) / `CORS_ORIGIN` (backend, must match the deployed frontend origin exactly)
- Color palette (light mode, defined in `frontend/src/styles.css`): `#B7DDE3` azul-claro, `#2a4a74` azul-marinho, `#D2E6C5` verde-claro, `#3094B5` azul-petróleo, `#1251BC` azul-forte (primary)

### Non-negotiable business rules to preserve in any implementation
- RN07–RN15 (drug-interaction check + duplicate-dose blocking) is the core of the product — prioritize this over everything else if time is short.
- RN15: never allow the same dose (same medication, same scheduled time) to be confirmed twice; if already confirmed, block and show who/when.
- RN06 / RN20: medication removal is a soft delete (inactivation); dose history is immutable — view-only, never erasable.
- RN09–RN11: high-risk interactions require explicit caregiver confirmation before saving; moderate-risk is informational only; when multiple interactions exist, show the highest-risk one.
- RNF03/RNF05/RNF11: user-facing errors must be jargon-free (never a raw "Error 500"), backend failures must degrade gracefully in the UI (never a blank screen), and endpoints need explicit try/except with proper HTTP responses (no leaked stack traces).
- RNF10: keep routes, models, and business logic in separate layers.

## SDD workflow (governs how work in this repo proceeds)

This repo follows a 3-phase Spec Driven Development process, driven by prompt templates in `SDD/`. Each phase is a distinct mode with its own rules — check which phase is active before acting:

1. **`SDD/busca.md` — Research.** Investigates the existing codebase for a given feature and produces *only* a `PRD.md`, saved to `SDD/PRDs/YYYY-MM-DD-{feature-kebab}.md`. No code changes, no architecture critique or suggestions. Must use the Context7 MCP (`resolve-library-id` then `query-docs`) for any library/framework documentation instead of relying on training knowledge.
2. **`SDD/planejamento.md` — Workshop + Plan/Spec generation.** Interactive session that turns a `PRD.md` into `plan.md` (phased checklist with Automated/Manual success criteria) and `Spec.md` (tactical per-file changes). No code changes and **no file generation** until the user explicitly types `GERAR PLAN E SPEC`. Output paths: `SDD/PLAN/YYYY-MM-DD-{feature-kebab}.md` and `SDD/SPEC/YYYY-MM-DD-{feature-kebab}.md`.
3. **`SDD/implementar.md` — Implementation.** Executes an approved Plan + Spec phase-by-phase. Requires both `PLAN PATH` and `SPEC PATH` before starting. Do not expand scope beyond what Plan/Spec specify. Run each phase's Automated Verification before moving on; never mark Manual Verification items done without explicit user confirmation. If Plan and Spec conflict, or either conflicts with the actual codebase, stop and report the mismatch (Expected / Found / Why it matters / Options) rather than improvising.

`SDD/implementar.md` also documents a Flask-Migrate/Alembic migration discipline (never hand-edit schema, always `flask db migrate` → review → `flask db upgrade`, commit model + migration together, avoid correlated-subquery DML, batch large updates, 30s migration limit). Note this conflicts with the FastAPI + SQLAlchemy 2.0 stack decided in `planejamento.md` — treat the SDD templates as reused boilerplate from a prior (Flask-based) project, and confirm the actual migration tool with the user before relying on these specifics once a backend exists.
