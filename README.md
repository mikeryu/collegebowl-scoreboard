# College Bowl Scoreboard (v3)

Modern Electron + React scoreboard for live math/quiz events.

This repo now runs a two-window system:
- Control window (operator UI)
- Projection window (audience-facing UI)

The legacy single-page app files (`index.html`, `script.js`, `style.css`) are retained as fallback reference, but active development is on the v3 app under `apps/*` and `packages/*`.

## Tech Stack

- Electron (main process + desktop windows)
- React + Vite (control and projection renderers)
- TypeScript workspace monorepo
- Bun workspaces
- Vitest (core state reducer tests)

## Repository Layout

- `apps/main`: Electron main process and preload
- `apps/control`: operator control UI
- `apps/projection`: projector/audience UI
- `packages/shared`: shared types + command contracts
- `packages/core`: canonical reducer/state machine
- `resources/`: reference docs and source game materials
- `scoreboard-game-template.tex`: compilable game packet template
- `TODOS.md`: implementation handoff log and progress

## Requirements

- Node.js 20+
- Bun

## Setup

```bash
bun install
```

## Run (Development)

```bash
bun run dev
```

This starts:
- Vite dev server for control (`127.0.0.1:5173`)
- Vite dev server for projection (`127.0.0.1:5174`)
- Electron app connected to both

## Quality Commands

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

## Game Flow Model (Guided)

The app uses a reducer-driven guided state machine. Operators mostly use contextual `Next`/branch actions.

Key behavior:
- Toss-up -> review/adjudication -> reveal gate
- Follow-up standby -> hold to show/start -> review/adjudication -> reveal gate
- Long-press guards for dangerous reveal/reset actions
- Timeout adjudication supports:
  - Left correct
  - Right correct
  - No one answered
- Claim ownership can be manually overridden from control top strip (exclusive)

## Timing + Audio

- Warning beep at 10 seconds
- Expired alarm at 00:00
- Round pause pauses question timer
- Round unpause does not auto-resume question timer

## Projection Controls

Projection window is controller-managed:
- Open projector
- Refresh projector
- Hold-to-close projector

## Question Pack Workflow (.tex)

Use Setup tab:
1. Download template
2. Fill rounds in `.tex` (Overleaf-compatible)
3. Upload `.tex`

Parser expectations:
- One `game` wrapper
- One or more `round` blocks
- Each `round` requires:
  - `tossup`
  - `tossupanswer`
  - `followup`
  - `followupanswer`
- Optional `emceenotes` section per round is parsed but ignored for gameplay prompt/answer content

## Keyboard Notes (Control)

- `Esc`: pause/resume round timer
- `Space`: pause/resume question timer
- `A` + `W/S`: left score +/-
- `D` + `W/S`: right score +/-

## Current Status

Core v3 architecture, guided flow engine, LaTeX rendering pipeline, and presenter/projection UX are implemented and validated through lint/typecheck/tests/build.
