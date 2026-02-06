# College Bowl Scoreboard (v3)

Electron + React scoreboard for live quiz/math events with two windows:
- Control (operator)
- Projection (audience)

## Requirements

- Node.js 20+
- Bun

## Install

```bash
bun install
```

## Run (Development)

```bash
bun run dev
```

This launches:
- Control renderer (`127.0.0.1:5173`)
- Projection renderer (`127.0.0.1:5174`)
- Electron main process

## Build/Validate

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

## Package (Unsigned macOS)

```bash
bun run package:mac:unsigned
```

Artifact:
- `dist/mac-unsigned/Scoreboard-0.1.0-mac-unsigned-arm64.zip`

First run on recipient Mac:
1. Move `Scoreboard.app` to `/Applications`.
2. Run:

```bash
xattr -dr com.apple.quarantine "/Applications/Scoreboard.app"
```

Unsigned/notarization note:
- This is for trusted/internal distribution. Gatekeeper prompts are expected.

## Operator Workflow

1. Open `Setup` tab.
2. Set team names/timers and load a `.tex` round file.
3. Go to `Live`, open projector, and run game via on-screen state controls.
4. Use `Full Reset` to return to pregame state (required to unlock non-name setup changes).

## `.tex` Round File Requirements

Each round must include:
- `tossup`
- `tossupanswer`
- `followup`
- `followupanswer`

Optional:
- `emceenotes` (ignored for gameplay content)

Expected wrappers:
- one `game`
- one or more `round`

## Notes

- Keyboard shortcuts are not part of the current control surface; use on-screen controls.
- Main code lives under `apps/*` and `packages/*`.
