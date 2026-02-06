# Scoreboard v2 Plan

## 1) Product Goal

Build a production-grade game administration app that combines:

- scoreboard + timers + keyboard control
- safe problem/solution projection (LaTeX math rendering)
- round-aware game flow (toss-up -> follow-up -> scoring)
- pregame setup for teams, timings, and loaded question sets

The app must preserve the current Westmont color scheme and keyboard-driven operation.

## 2) Core Requirements (From Current Context)

- Keep color identity:
  - `#9D2235` (primary), `#63666A`, `#CEB888`, white
- Maintain keyboard-first operation (minimal mouse dependence during live rounds).
- Add middle problem display with `.tex`-based content rendering.
- Prevent accidental reveal of answer/solution.
- Support projector resolutions and large displays (desktop/tablet-class only, not phone-first).
- Make setup easy:
  - preload questions
  - set team names
  - set round lengths/timer presets

## 3) Architecture Decision

### Recommendation: Multi-window Electron app, TypeScript, React, Vite

Use a desktop app with two windows:

- **Control Window** (operator view): full controls, state, reveal actions
- **Projection Window** (public view): scoreboard + problem display only

Why this is the best fit:

- reliable local desktop runtime for events (offline-first)
- direct keyboard capture and global app-state control
- controlled projection output without exposing admin controls
- easier packaging/distribution for non-technical operators

### Bun question

- **Use Bun optionally for dev scripts/tests**, not as the core runtime.
- Electron runtime remains Node/Chromium for stability and ecosystem support.

Rationale: Bun is promising, but for a live event tool where reliability matters most, Electron + Node has less integration risk today.

## 4) High-Level System Design

## 4.1 Modules

- `app/main`:
  - Electron main process
  - window lifecycle, IPC routing, persistence
- `app/control`:
  - admin UI + keyboard command handling
- `app/projection`:
  - audience/projector UI
- `packages/core`:
  - game engine state machine
  - timer logic
  - scoring rules
  - keybinding maps
- `packages/content`:
  - question-pack schema
  - parser/import pipeline
  - validation
- `packages/shared`:
  - DTOs, IPC contracts, constants, theme tokens

## 4.2 Game Engine (State Machine)

Model game flow explicitly to prevent invalid transitions.

Top-level states:

- `idle`
- `pregame-configured`
- `round-running`
- `round-paused`
- `question-tossup-active`
- `question-followup-active`
- `question-review`
- `round-ended`

Transitions enforce:

- toss-up before follow-up
- claim ownership rules
- answer reveal only from valid review states

## 4.3 Projection Safety (Critical)

Implement **three independent safeguards** against accidental answer reveal:

1. **Separated actions**:
   - `Next Prompt` and `Reveal Answer` are different commands.
2. **Armed reveal**:
   - reveal requires a deliberate key chord (example: hold `Shift` + press `Enter` twice within 1.5s).
3. **State guard + lockouts**:
   - reveal command ignored while timer active unless operator explicitly toggles `Reveal Override`.

Additional protections:

- optional confirmation toast in control window only
- reveal audit log entry (`timestamp`, `operator action`, `question id`)
- hard disable mouse wheel/navigation in projection window

## 5) Content Strategy (.tex and Presentation Flow)

### 5.1 Canonical internal format

Adopt a normalized JSON format for runtime:

- `QuestionPack`
- `Round`
- `QuestionPair` (toss-up + follow-up)
- `prompt`, `answer`, optional `solution`
- `mathMode`: inline/display segments

### 5.2 Import pipeline

Support two inputs:

- existing presentation/problem `.tex` files
- future curated JSON/YAML packs

Plan:

1. Write import scripts to extract toss-up/follow-up/answer blocks from existing `.tex`.
2. Validate structure and produce canonical `question-pack.json`.
3. Runtime app loads only validated canonical packs.

Reason: parsing arbitrary LaTeX at runtime is brittle; normalization gives predictable behavior and maintainability.

### 5.3 Rendering

- Render math with KaTeX or MathJax in projection window.
- Keep typography large and high-contrast for projection distance.
- Provide modes:
  - `Prompt Only`
  - `Answer Placeholder` (e.g., “Answer hidden”)
  - `Answer Revealed`
  - optional `Solution Revealed`

## 6) UX / UI Plan

## 6.1 Layout

Projection view:

- top: round timer
- center: problem card (prompt/answer states)
- left/right: teams + score
- bottom: status strip (phase, claim side, question number)

Control view:

- compact operator dashboard
- current phase + timers + claim owner
- explicit action buttons mirroring keyboard shortcuts
- keybinding cheat sheet panel

## 6.2 Styling

- Preserve current palette and general visual identity.
- Convert to design tokens (`--color-primary`, etc.).
- Use scale-safe sizing (`clamp`) tuned for 1080p/1440p/4K projectors.
- Keep readability targets:
  - prompt body minimum effective size for back-row legibility
  - high contrast for math expressions

## 7) Keyboard Controls (v2 Draft)

Preserve existing commands where possible:

- `ESC`: pause/unpause round
- `SPACE`: pause/unpause question timer
- arrows: toss-up/follow-up/reset question timer behavior
- `A/D + W/S`: score up/down
- `[`, `]`, `\`: claim indicators
- `T`: edit team names (control view modal)

Add new safe flow commands:

- `N`: next display state (non-reveal progression)
- `Shift+Enter` then `Enter` (within 1.5s): reveal answer
- `Shift+Backspace` then `Backspace`: hide answer (admin correction)

All commands visible in in-app keyboard help panel.

## 8) Setup and Persistence

Pregame setup screen:

- select/import question pack
- choose prelim/final mode
- set round length, toss-up/follow-up durations, warning threshold
- enter team names
- preview first question

Persistence:

- local profile file for last used settings
- game session save/load (for recovery during event interruptions)

## 9) Reliability and Testing Plan

- Unit tests:
  - state machine transitions
  - scoring constraints
  - timer pause/resume accuracy
  - reveal lockouts
- Integration tests:
  - control -> projection IPC sync
  - question pack load/validation failures
- Manual operator checklist:
  - full prelim simulation
  - final-round simulation
  - accidental-key stress test for reveal protection

## 10) Implementation Phases

## Phase 0: Foundation

- Initialize Electron + React + TypeScript workspace.
- Add lint/format/test tooling.
- Define shared theme tokens and constants.

Deliverable:

- app boots with control + projection windows and shared state skeleton.

## Phase 1: Core Engine

- Implement `packages/core` state machine and timer service.
- Port existing scoring and key behaviors into typed command handlers.

Deliverable:

- full scoreboard/timer parity with v1, no problem display yet.

## Phase 2: Content Pipeline

- Build canonical schema + validators.
- Create importer from current `.tex` sources into canonical JSON.
- Add sample generated pack in repo.

Deliverable:

- app loads and navigates structured question content.

## Phase 3: Problem Projection

- Build projection problem panel with math rendering.
- Implement prompt/answer/solution display states.
- Add anti-accidental reveal safeguards (arming, lockouts, audit log).

Deliverable:

- safe live projection flow with controlled reveal.

## Phase 4: Pregame Setup + Persistence

- Setup wizard for teams/timers/question pack.
- local session persistence and restore.

Deliverable:

- event-ready startup workflow.

## Phase 5: Hardening + Packaging

- test pass and manual rehearsal scripts
- build installers (macOS first, optional Windows)
- operator quickstart guide

Deliverable:

- distributable v2 release candidate.

## 11) Repo Changes Planned

Proposed structure to create:

- `apps/control/`
- `apps/projection/`
- `apps/main/`
- `packages/core/`
- `packages/content/`
- `packages/shared/`
- `data/question-packs/`
- `scripts/import-tex/`

Current v1 (`index.html`, `style.css`, `script.js`) will remain temporarily for fallback until Phase 3 stabilizes.

## 12) Risks and Mitigations

- Risk: `.tex` variability breaks importer.
  - Mitigation: canonical schema + strict validation + manual override files.
- Risk: operator mis-key reveals answer.
  - Mitigation: multi-step reveal arming + state lockouts + audit trail.
- Risk: projection readability at different venues.
  - Mitigation: projector-safe typography presets and rehearsal checklist.
- Risk: runtime complexity.
  - Mitigation: keep pure game logic in `packages/core`, UI thin and state-driven.

## 13) Success Criteria

- Operator can run an entire round from keyboard without touching raw files.
- Answer reveal cannot occur by accidental single keypress.
- Question flow matches existing toss-up/follow-up process.
- Setup takes under 5 minutes for a returning event operator.
- Projection remains legible and stable at common auditorium resolutions.

