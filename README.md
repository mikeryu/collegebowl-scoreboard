# College Bowl Scoreboard (v3)

Electron app for running a live two-screen game:
- Control window (for moderator/operator)
- Projection window (for audience)

Download and try:
- [macOS app (.zip)](./Scoreboard-0.1.0-mac-unsigned-arm64.zip)
- [sample game packet (.tex)](./scoreboard-sample-3-rounds.tex)

## For Regular Users

### 1) Download

Download these files from the repository root:
- `Scoreboard-0.1.0-mac-unsigned-arm64.zip`
- `scoreboard-sample-3-rounds.tex` (optional sample question file)

### 2) Install and first launch (macOS)

1. Unzip `Scoreboard-0.1.0-mac-unsigned-arm64.zip`.
2. Move `Scoreboard.app` to `/Applications`.
3. Open Terminal and run:

```bash
xattr -dr com.apple.quarantine "/Applications/Scoreboard.app"
```

4. Launch `Scoreboard.app`.

Notes:
- This app is unsigned/not notarized. macOS warnings are expected.
- If needed, right-click app -> `Open` to approve launch.

### 3) Initial setup before game start

1. App opens to the `Setup` tab.
2. Enter:
   - Left team name
   - Right team name
   - Round/toss-up/follow-up/warning times
3. Load a `.tex` game file:
   - Click `Load .tex`
   - Select your packet (or `scoreboard-sample-3-rounds.tex`)
4. Click `Apply Setup`.
5. Click `Go To Live`.

### 4) Start and run the game

1. In `Live`, click `Open Projector`.
2. Click `Start Round`.
3. Use the large state buttons to progress:
   - Show toss-up
   - Record claim/correct/incorrect
   - Reveal answer (hold action)
   - Move to follow-up, then next round
4. Use score +/- and manual claim controls when needed.

Important behavior:
- If no game `.tex` is loaded, the `Live` tab is visibly locked and controls are disabled.
- Once game has started, only team names can be changed from Setup.
- Timer/config and question-file changes are locked until `Full Reset`.
- Use `Full Reset` in Setup to return to pregame and unlock full setup edits.

### 5) Question file format requirements

Each round must include:
- `tossup`
- `tossupanswer`
- `followup`
- `followupanswer`

Optional:
- `emceenotes` (ignored for displayed gameplay content)

Wrapper expectations:
- exactly one `game`
- one or more `round`

## For Developers

### Stack

- Electron
- React + Vite
- TypeScript
- Bun workspaces
- Vitest (core reducer tests)

### Repo layout

- `apps/main`: Electron main/preload
- `apps/control`: control renderer
- `apps/projection`: projection renderer
- `packages/shared`: shared types/contracts
- `packages/core`: canonical reducer/state machine

### Local setup

```bash
bun install
```

### Run in development

```bash
bun run dev
```

Starts:
- control renderer on `127.0.0.1:5173`
- projection renderer on `127.0.0.1:5174`
- Electron main process

### Validate

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

### Build unsigned macOS package

```bash
bun run package:mac:unsigned
```

Output artifact:
- `dist/mac-unsigned/Scoreboard-0.1.0-mac-unsigned-arm64.zip`
