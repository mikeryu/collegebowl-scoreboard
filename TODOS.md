# Scoreboard v2 TODO Tracker

Last updated: February 6, 2026
Current phase: `Phase 2 - Feature Hardening`

## In Progress: UX Balance + Control Affordance Pass

- [x] Projection UX rebalance
  - [x] reduce lateral/bottom dead space and improve fullscreen composition
  - [x] split question and answer into separate visual panels
  - [x] apply state-aware answer panel transitions (hidden -> armed/eligible -> revealed)
- [x] Control UX hierarchy refresh
  - [x] reduce visual weight of timers and score controls
  - [x] enlarge/spotlight state transition controls
  - [x] show previous step, current choices, and likely next steps with sequencing cues
- [x] Transition feedback and danger affordances
  - [x] add click/tap feedback animation for transition actions
  - [x] add reveal hold progress fill with decimal countdown
  - [x] add explicit dangerous styling for reveal action (yellow/black caution cues)

## In Progress: Projection Lifecycle + Transition Standby Refinement

- [x] State-flow refinements
  - [x] add explicit standby transition between toss-up resolution and follow-up start
  - [x] keep question/answer transitions moderator-driven (no premature reveal/open)
- [x] Projection lifecycle controls
  - [x] stop auto-opening projection window on app launch
  - [x] add controller-triggered projection open
  - [x] add force refresh and close/reopen controls without state loss
  - [x] harden projection window against unfocused WSOD behavior
- [x] Projection UI refinements
  - [x] make question panel width align with top scoreboard/timer frame
  - [x] move claim indicator from timer markers to clear team-card claim outline + text
  - [x] replace always-on answer panel with bottom-up slide-in answer drawer inside question panel
- [x] Controller UI refinements
  - [x] slim global bar for round/question/score controls
  - [x] separate global controls from state-transition controls
  - [x] render transition graph style: previous action -> current choices (vertical) -> future actions

## In Progress: UX Tightening Pass 2

- [x] Presenter mode layout tightening
  - [x] make top round/question/left/right bar slimmer
  - [x] split presenter section into three panels (projector controls / global game controls / state controls)
- [x] Projector claim + spacing refinements
  - [x] make HAS CLAIM outline more prominent
  - [x] reserve HAS CLAIM label area to avoid team-name jump
  - [x] add inner padding between team scores and center timer stack
- [x] Projector white-screen hardening
  - [x] add additional Electron background/throttling hardening flags
  - [x] keep projection renderer stable when unfocused for long periods

## In Progress: State Gating + Future-Hint Fix

- [x] enforce answer-first progression on toss-up before follow-up reveal
- [x] keep standby gate between answered question and next question reveal
- [x] require long-press for actions that reveal a new question
- [x] fix "Likely after" to show true future states (not current action echo)

## In Progress: Controller Scale Rebalance

- [x] aggressively shrink top score/timer strip footprint
- [x] shrink projector/global 3-button control panels
- [x] enlarge bottom main state controls for primary operator actions

## In Progress: Top Strip Non-Scaling Fix

- [x] remove viewport-proportional growth from top status strip typography/sizing
- [x] keep top number panels content-height only on large windows

## In Progress: Top Wrapper Stretch Fix

- [x] prevent parent grid stretch from expanding the 4-panel wrapper container

## In Progress: Question Visibility/Timer Coupling

- [x] clear current question when advancing from revealed answer into standby
- [x] ensure question content is only pushed when active phase starts (timer starts)

## In Progress: Legacy Sound Asset Migration

- [x] locate Base64-encoded warning/alarm audio in legacy app
- [x] replace synthesized beeps with legacy decoded sounds in control app
- [x] verify warning and time-expired triggers still fire at correct thresholds

## In Progress: Follow-up Standby Sequencing + Control Legibility

- [x] Flow fix: `answer:revealed` should advance to `followup:standby` immediately (no hold)
- [x] Flow fix: `followup:standby` should require hold to reveal follow-up prompt and start timer
- [x] Live actions: include reveal action in the main action stack with label `HOLD TO REVEAL + ANSWER`
- [x] Controller readability: increase top strip round/question/score text and button sizing

## In Progress: Reveal Label Copy Fix

- [x] Change reveal hold label text to `HOLD TO REVEAL ANSWER` (remove `+`)

## In Progress: Projector Control Safety Refinement

- [x] Replace `Reopen Projector` control with long-press `Close Projector`
- [x] Add `projection:close` command handling in shared contracts and main process

## In Progress: Projector Close Button Visual Tone

- [x] Make hold-to-close projector button neutral greytone (reduce danger prominence)

## In Progress: Manual Claim Override Controls

- [x] Add manual claim buttons to team score panel
- [x] Enforce manual exclusivity (only one team can hold claim at a time)
- [x] Support manual clear of claim state

## In Progress: Round Toggle Behavior + CTA Styling

- [x] Make `Start Round` button red-emphasis in presenter global controls
- [x] Change round pause behavior so it only pauses/resumes round timer (no forced phase/question-timer mutation)

## In Progress: Timeout Answer-Adjudication Flow

- [x] On timer expiry, enter review step with `Left Correct / Right Correct / No One Answered`
- [x] Support toss-up and follow-up no-answer transitions before reveal
- [x] Add reducer tests for timeout adjudication branches

## In Progress: Timer Urgency Styling + Compact Claim Controls

- [x] Add question timer urgent visual state under 10s remaining
- [x] Add round timer warning state under 60s and blink state under 10s
- [x] Move claim toggle inline with +/- score buttons to preserve compact strip height

## In Progress: Projector Claim + Timer Emphasis Pass

- [x] Increase projector claim prominence (stronger outline/badge visibility)
- [x] Add projector-only question timer blink indicator under 10s

## In Progress: Paused Timer Alternating Indicator

- [x] Alternate paused timers between pause icon and remaining time every 1 second
- [x] Apply pause alternation behavior in both Control and Projector views

## In Progress: TeX Emcee Notes Template + Parser Support

- [x] Add `emceenotes` section to downloadable template and root template file
- [x] Update parser to optionally parse `emceenotes` while keeping gameplay question parsing unchanged

## In Progress: Emcee Note Refactor In Root Template

- [x] Find inline `Emcee note:` text inside prompts in `scoreboard-game-template.tex`
- [x] Move those notes into the round `emceenotes` section and clean prompt text

## In Progress: Pause Coupling + UI Clarity Pass

- [x] Make round pause also pause question timer, while round unpause does not auto-unpause question timer
- [x] Remove redundant `Current step:` and `Previous step:` text lines in controller state panel
- [x] Add prominent projector label for question type (`Toss-Up` vs `Follow-Up`)

## In Progress: Full Game Reset Control

- [x] Add `game:reset` command to reset gameplay state while preserving loaded question rounds in controller
- [x] Add bottom controller reset panel with 3-second hold confirmation

## In Progress: Projection Typography + Alignment Refinement

- [x] Center-align toss/follow indicator and current-question header text
- [x] Keep question body alignment unchanged while right-aligning answer drawer text
- [x] Slightly increase question and answer text sizes for readability

## In Progress: Release Docs + PR

- [x] Update root `README.md` to match current v3 architecture and operations
- [x] Commit all changes and push branch
- [x] Open PR via `gh` with implementation summary and validation notes

## In Progress: Minor UI Corrections

- [x] Center projector toss/follow indicator pill precisely
- [x] Make controller `Open Projector` button red-emphasis

## In Progress: Queue List Visual Cleanup

- [x] Style/hide queue scrollbar to match dark control theme
- [x] Simplify queue rows to round number + single truncated question line

## In Progress: Dynamic Round Swap Control

- [x] Replace queue `Open Setup` button with `USE NOW` hold action (2s)
- [x] Add command/state handling to jump active round index safely during live operation

## In Progress: Expired Alarm Trigger Precision

- [x] Trigger expired alarm only on `01 -> 00` transition (no repeats at steady `00:00`)

## In Progress: Projector Question-Type Pill State

- [x] Show grey `STANDBY` pill unless a question is actively on-screen

## In Progress: Force-Advance Safety Override

- [x] Add always-visible `Override: Force Advance` action at bottom of `Buttons Available Now`
- [x] Add `flow:override-next` reducer path to force progression when normal transitions are blocked

## In Progress: Override Control Affordance Tuning

- [x] Make override action compact (low-height) and visually secondary
- [x] Require 2-second hold for override action

## In Progress: Projector Toggle Control Simplification

- [x] Make `Open Projector` a state-aware toggle (open vs hold-to-close)
- [x] Reduce projector controls panel to 2 buttons total

## In Progress: Projector-Open Safety Gating

- [x] Disable score/game-state/state-transition controls when projector is closed
- [x] Gate related keyboard shortcuts behind projector-open state

## In Progress: Projection Prompt Overflow Safety

- [x] Ensure question text never clips/overflows out of view
- [x] Force safe wrapping behavior for long MathJax-rendered prompt content

## In Progress: Remove Reset Standby Control

- [x] Remove `Reset Standby` button from controller global controls

## In Progress: Setup Tab Layout Polish

- [x] Default controller startup tab to `Setup`
- [x] Make `Apply Setup` full-width with top margin
- [x] Move `Go To Live` to its own row and make it full-width

## In Progress: Setup File Action Copy + Layout

- [x] Make `Download Template` and `Load .tex` buttons 50/50 width in setup row
- [x] Replace UI copy `Upload` -> `Load` in control setup/preflight surfaces

## In Progress: Global Control Button Layout + Copy

- [x] Make `Start Round` and `Pause/Resume Question Timer` 50/50 width in global game controls
- [x] Rename `Pause/Resume Q Timer` -> `Pause/Resume Question Timer`

## In Progress: Projector Long Prompt Readability Hotfix

- [x] Prevent long plain-text toss-ups from rendering as single unbreakable TeX line
- [x] Add safe prompt-area overflow handling so all question text remains readable

## In Progress: Projector Prompt No-Clipping Refinement

- [x] Apply constrained readable line width for question prose in projector panel
- [x] Fix question header label copy and rebalance vertical spacing
- [x] Eliminate residual right-edge clipping for long plain-text prompts

## In Progress: Unified LaTeX Text Rendering Consistency

- [x] Make mixed plain-text + LaTeX prompts render through one unified LaTeX formatting path
- [x] Preserve inline math fidelity while matching plain-text visual rhythm

## In Progress: Mixed TeX Clipping Regression + Answer Punctuation

- [x] Fix mixed plain+LaTeX prompt wrapping to prevent right-edge clipping regressions
- [x] Remove trailing periods from answers during parse and projection display

## In Progress: Answer Typography Proportion Tuning

- [x] Match answer text scale to question text scale at approximately 2pt smaller

## In Progress: Answer Panel Label Alignment

- [x] Center `ANSWER` label text on the answer panel

## In Progress: Unsigned macOS Packaging

- [x] Add electron-builder config and npm script for unsigned macOS zip packaging
- [x] Support packaged-mode renderer loading (file:// dist assets without dev servers)
- [x] Produce unsigned macOS zip artifact and document first-run quarantine bypass

## In Progress: Projector Zero-Clipping Hardening

- [x] Add robust mixed-text/math token wrapping so long inline equations cannot overflow panel width
- [x] Tighten dense-mode trigger logic for math-heavy prompts to reduce clipping risk at large sizes

## In Progress: Queue Exhaustion End-of-Game Signal

- [x] Signal explicit end-of-game state in Controller when question queue is exhausted
- [x] Signal explicit end-of-game state in Projector when question queue is exhausted

## In Progress: Packaged App WSOD Fix

- [x] Fix packaged renderer asset resolution for `file://` loads (Control + Projection)
- [x] Rebuild unsigned macOS artifact and verify packaged bundle contains correct relative asset paths

## In Progress: Setup Lock During Active Game

- [x] Lock setup editing/actions once game has started
- [x] Require full reset before setup changes are allowed again
- [x] Enforce setup lock at reducer level (not only UI)

## In Progress: Distribution Repackage

- [x] Rebuild unsigned macOS zip distribution after latest setup-lock changes

## In Progress: In-Game Team Name Editing

- [x] Allow team name updates during active game
- [x] Keep non-name setup fields locked until full reset
- [x] Repackage unsigned macOS distribution after change

## In Progress: CI Lint Fix

- [x] Fix `no-useless-escape` error in `apps/projection/src/main.tsx`

## In Progress: Post-Lint Release Sync

- [x] Repackage unsigned macOS artifact after lint fix
- [x] Commit and push release-sync changes

## In Progress: README Distribution Update + Main Push

- [x] Update README with unsigned distribution packaging/install instructions
- [x] Commit and push latest changes directly to `main`

## In Progress: README Accuracy Cleanup

- [x] Remove outdated README content (including removed keyboard shortcuts)
- [x] Make README concise and current for setup, run, packaging, and operation
- [x] Push README cleanup to `main`

## In Progress: Root Distribution Drop + README Link

- [x] Copy latest unsigned macOS zip artifact to repository root
- [x] Add direct download-and-try link in README to root artifact
- [x] Commit and push to `main`

## In Progress: README Top CTA + Sample Packet

- [x] Move distribution download link to the top of README for prominence
- [x] Add a root-level 3-round sample `.tex` packet
- [x] Add adjacent README link to the sample `.tex` packet

## In Progress: Sample Packet Content Safety

- [x] Replace sample packet problems with middle-school-level math only

## In Progress: README Audience Split

- [x] Restructure README into separate Regular User and Developer sections
- [x] Expand Regular User instructions for download, first launch, setup, and running a game

## In Progress: Sample File Publish Fix

- [x] Track and push `scoreboard-sample-3-rounds.tex` to `main` to resolve README link 404

## In Progress: Plaintext/TeX Wrap Bug Fix

- [x] Stop treating escaped `\\$` in plaintext as math delimiters
- [x] Normalize plaintext TeX escapes to prevent `\\textbackslash{}` artifacts in projection

## In Progress: Branch + Distribution Refresh PR

- [x] Rebuild unsigned macOS distribution artifact after plaintext/TeX fix
- [x] Create branch, commit, push, and open PR to `main`

## In Progress: Remove Leaking `\allowbreak`

- [x] Remove `\allowbreak` injection from projection mixed-math normalization to prevent literal render artifacts

## In Progress: Main Artifact Refresh

- [x] Rebuild and refresh root unsigned macOS zip artifact after `\allowbreak` fix

## In Progress: Round Expiry + Switch Claim Stability

- [x] Prevent round timer expiry from auto-changing game phase/state
- [x] Harden follow-up `Switch Claim` so correct/incorrect actions remain available after switching
- [x] Add reducer regression tests for both behaviors

## In Progress: Awaiting-State Spinner UX

- [x] Replace projector `Awaiting next phase` text placeholder with spinner indicator

## In Progress: Control Surface Simplification

- [ ] Remove `Reset Standby` control from global game controls
- [ ] Remove keyboard shortcut handling from controller UI (panel-only operation)

## In Progress: Rules-Aligned Guided Flow Refactor

- [x] Shared contracts overhaul (`packages/shared/src/types.ts`)
  - [x] finalize canonical game phases for guided flow
  - [x] remove legacy reveal commands and old question-start commands
  - [x] add/lock guided flow command set (`flow:*`)
- [x] Core reducer hardening (`packages/core/src/state.ts`)
  - [x] enforce no question reveal before game start
  - [x] enforce toss-up/follow-up attempt eligibility per team
  - [x] implement no-claim toss-up -> open follow-up path
  - [x] implement follow-up claim switch with remaining time
  - [x] enforce reveal hold guard (~1s) only in `answer:eligible`
  - [x] keep round advancement/end-of-game behavior deterministic
- [x] Main process reducer parity (`apps/main/src/main.cjs`)
  - [x] mirror guided transitions and guards from core reducer
  - [x] broadcast state on all valid commands/ticks
- [x] Live controls simplification (`apps/control/src/main.tsx`)
  - [x] remove template upload/download controls from Live tab
  - [x] make Live primary flow `Next` + contextual branch actions only
  - [x] keep manual score +/- as secondary controls
  - [x] update keyboard mappings to guided flow commands
- [x] Projection rendering and layout (`apps/projection/src/main.tsx`, `apps/projection/src/styles.css`)
  - [x] render full prompt/answer via MathJax path for consistency
  - [x] keep answer hidden until eligible/revealed state
  - [x] reduce dead space and rebalance fullscreen margins/padding
- [x] Tests and validation
  - [x] rewrite reducer tests for guided flow (`packages/core/src/state.test.ts`)
  - [x] run `bun run lint`
  - [x] run `bun run typecheck`
  - [x] run `bun run test`
  - [x] run `bun run build`

## Urgent Directives (From Latest Review)

- [x] Restore audible warnings matching v1 behavior:
  - [x] 10-second warning beep
  - [x] time-expired alarm at `00:00`
- [ ] Re-apply trendy UX:
  - [x] Projection (live screen): keep existing color palette but apply best-practice glassmorphism styling.
  - [x] Control panel: dark mode glassmorphism redesign.
- [ ] Projection visual hierarchy refresh:
  - [x] improve team-name contrast
  - [x] reduce wasted vertical space
  - [x] make question timer and current problem more visually dominant
- [ ] Projection palette refresh:
  - [x] remove split red/gray background and replace with cohesive premium composition using `#9D2235`, `#63666A`, `#CEB888`, `#FFFFFF`
  - [x] maintain high legibility and strong hierarchy
- [ ] Projection fullscreen balance polish:
  - [x] increase padding/margins for full-screen elegance
  - [x] improve marker readability in inactive state
  - [x] increase round timer label readability
  - [x] improve empty-state problem card proportions
- [ ] Round-atomic question system + `.tex` workflow:
  - [x] enforce round structure (each round has toss-up + toss-up answer + follow-up + follow-up answer)
  - [x] provide downloadable `.tex` template for admins
  - [x] add `.tex` upload in setup flow
  - [x] add Live-tab preflight modal requiring `.tex` upload before beginning
  - [x] add lightweight `.tex` validation to reject malformed/dangerous files
  - [x] map parsed rounds to visible queue and presenter actions
  - [x] make template and filled game files valid compilable LaTeX documents (Overleaf-friendly)
  - [x] populate a full realistic multi-round test game file from `11-12-final.tex`
  - [x] add clear visual structure in compiled LaTeX output (round/toss-up/follow-up/answers visibly distinct)
- [x] Rework projection UI to maintain v1 visual hierarchy (team score band -> round timer bar -> big question timer), and insert problem rendering without extra game-state labels.
- [x] Simplify admin panel:
  - [x] keep large timers and score controls front-and-center
  - [x] move setup/config behind a dedicated tab/panel
  - [x] add blatantly clear “what screen comes next” flow for toss-up -> follow-up -> answer reveal
  - [x] make question queue visible and operable
- [x] Fix LaTeX rendering immediately and verify in projection with real math content (no plaintext fallback for TeX expressions).

## Completed This Session

- Closed `Phase 0 - Foundation`.
- Added baseline quality tooling and CI:
  - root ESLint + Prettier configuration
  - root scripts: `lint`, `format`, `format:check`, `test`, `ci`
  - GitHub Actions workflow (`.github/workflows/ci.yml`)
- Implemented typed contracts for app state and command bus in `packages/shared`.
- Implemented core game reducer/state machine in `packages/core`:
  - phase transitions
  - score/claim controls
  - timer tick logic
  - reveal guard (`arm` + confirm window + override)
- Added `vitest` coverage for reducer behavior in `packages/core/src/state.test.ts`.
- Replaced placeholder Electron `ping` IPC with real typed command dispatch + continuous clock tick updates.
- Built production-ready v2 renderer UIs:
  - modern glassmorphism control window with setup panel + keyboard command panel
  - modern glassmorphism projection window with high-contrast scoreboard/problem display
- Added question content push flow from control window to projection window.

## Critical Hotfixes (Post-Implementation)

- Fixed TeX rendering in projection:
  - added MathJax runtime via `better-react-mathjax`
  - projection prompt/answer/solution now render LaTeX instead of plain text
- Fixed timer countdown bug:
  - preserved sub-second tick accumulation by not resetting `lastUpdatedMs` on zero-elapsed ticks
  - applied fix in both `packages/core` reducer and Electron main-process reducer
- Fixed reveal/hide key chord behavior:
  - reveal is now `Shift+Enter` then `Enter` (within 1.5s)
  - hide is now `Shift+Backspace` then `Backspace` (within 1.5s)
  - added capture-phase key handling so focused buttons/controls do not swallow chord input
- Fixed question timer pause behavior:
  - `Space` now toggles question timer pause/resume (`question:toggle-pause`)
  - added test coverage for pause toggling and sub-second timer accumulation

## Validation Results

- `bun run lint` ✅
- `bun run typecheck` ✅
- `bun run test` ✅
- `bun run build` ✅
- `bun run ci` ✅

## Phase 0 Checklist (Now Complete)

- [x] Create monorepo/workspace scaffold (`apps/*`, `packages/*`).
- [x] Add root project metadata (`package.json`, `tsconfig.base.json`).
- [x] Add `packages/shared` with theme + IPC + shared types.
- [x] Add `packages/core` with initial app-state factory.
- [x] Create control renderer app scaffold (`apps/control`, React + Vite + TS).
- [x] Create projection renderer app scaffold (`apps/projection`, React + Vite + TS).
- [x] Create Electron main app scaffold (`apps/main`) with control + projection windows.
- [x] Keep legacy v1 files in place as fallback (`index.html`, `style.css`, `script.js`).
- [x] Install dependencies and run first end-to-end boot.
- [x] Add CI/lint/format baseline tooling.

## Phase 1 Core Features (Implemented)

- [x] Typed shared app model + command contract.
- [x] Reducer-based game engine behavior in `packages/core`.
- [x] Main process command bus and state synchronization.
- [x] Safe reveal flow (arm + confirm, timer lockout, override toggle).
- [x] Keyboard-first controls in control renderer.
- [x] Projection state rendering for prompt/answer/solution modes.

## Next Priorities (Phase 2)

1. Add persistent storage for setup/session recovery (file-backed profile + save/load).
2. Add question-pack import pipeline from `.tex` into canonical JSON.
3. Add reveal audit log and operator-visible event timeline.
4. Expand tests:
   - keyboard command mapping tests in control app
   - IPC integration tests for main/control/projection sync
5. Add operator UX polish:
   - in-app command toasts
   - explicit warning indicators for timer thresholds
   - projector presets (1080p/1440p/4k scale profiles)

## Primary Files Changed This Session

- `/Users/ryu/Documents/Code/Utils/Scoreboard/package.json`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/eslint.config.mjs`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/.prettierrc.json`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/.prettierignore`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/.github/workflows/ci.yml`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/main/src/main.cjs`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/main/src/preload.cjs`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/main/src/global.d.ts`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/main/tsconfig.json`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/control/src/main.tsx`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/control/src/styles.css`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/control/src/global.d.ts`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/projection/src/main.tsx`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/projection/src/styles.css`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/projection/src/global.d.ts`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/apps/projection/package.json`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/packages/shared/src/types.ts`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/packages/shared/src/ipc.ts`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/packages/core/src/state.ts`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/packages/core/src/state.test.ts`
- `/Users/ryu/Documents/Code/Utils/Scoreboard/packages/core/package.json`
