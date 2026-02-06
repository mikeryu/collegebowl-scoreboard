const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

const CONTROL_URL = process.env.CONTROL_URL;
const PROJECTION_URL = process.env.PROJECTION_URL;

const IPC_CHANNELS = {
  getState: "scoreboard:get-state",
  command: "scoreboard:command",
  stateSync: "scoreboard:state-sync"
};

const DEFAULT_CONFIG = {
  roundLengthSeconds: 15 * 60,
  tossupLengthSeconds: 45,
  followupLengthSeconds: 120,
  warningThresholdSeconds: 10
};

const REVEAL_HOLD_MS = 1000;

function clampNonNegative(value) {
  return value < 0 ? 0 : value;
}

function otherSide(side) {
  return side === "left" ? "right" : "left";
}

function setClaim(nextState, side) {
  nextState.claimOwner = side;
  nextState.leftTeam.hasClaim = side === "left";
  nextState.rightTeam.hasClaim = side === "right";
}

function setQuestionTimer(nextState, seconds, running) {
  nextState.questionTimer.durationSeconds = seconds;
  nextState.questionTimer.secondsRemaining = seconds;
  nextState.questionTimer.running = running;
}

function clearQuestionContent(nextState, prompt = "Awaiting next phase") {
  nextState.question.prompt = prompt;
  nextState.question.answer = "";
  nextState.question.solution = "";
  nextState.question.displayMode = "prompt";
}

function clearEligibility(nextState) {
  nextState.eligibility.tossupAttempted.left = false;
  nextState.eligibility.tossupAttempted.right = false;
  nextState.eligibility.followupAttempted.left = false;
  nextState.eligibility.followupAttempted.right = false;
}

function enterFollowupClaimed(nextState, side, resetTimer) {
  nextState.questionKind = "followup";
  setClaim(nextState, side);
  if (resetTimer) {
    setQuestionTimer(nextState, nextState.config.followupLengthSeconds, false);
  } else {
    nextState.questionTimer.running = true;
  }
  nextState.revealEligible = false;
  nextState.phase = resetTimer ? "followup:standby" : side === "left" ? "followup:active-claimed-left" : "followup:active-claimed-right";
}

function enterAnswerEligible(nextState, target) {
  nextState.questionTimer.running = false;
  nextState.revealEligible = true;
  nextState.question.displayMode = "answer-hidden";
  nextState.postAnswerTarget = target;
  nextState.phase = "answer:eligible";
}

function canReveal(nextState, atMs) {
  if (!nextState.started) return false;
  if (!nextState.revealEligible) return false;
  if (nextState.phase !== "answer:eligible") return false;
  if (!nextState.revealHoldStartedAtMs) return false;
  return atMs - nextState.revealHoldStartedAtMs >= REVEAL_HOLD_MS;
}

function initialState() {
  const seedNowMs = Date.now();

  return {
    phase: "idle",
    projectionOpen: false,
    leftTeam: { name: "LEFT TEAM", score: 0, hasClaim: false },
    rightTeam: { name: "RIGHT TEAM", score: 0, hasClaim: false },
    config: { ...DEFAULT_CONFIG },
    roundTimer: {
      running: false,
      secondsRemaining: DEFAULT_CONFIG.roundLengthSeconds,
      durationSeconds: DEFAULT_CONFIG.roundLengthSeconds,
      warningAtSeconds: DEFAULT_CONFIG.warningThresholdSeconds
    },
    questionTimer: {
      running: false,
      secondsRemaining: 0,
      durationSeconds: DEFAULT_CONFIG.tossupLengthSeconds,
      warningAtSeconds: DEFAULT_CONFIG.warningThresholdSeconds
    },
    question: {
      index: 1,
      prompt: "Awaiting question content",
      answer: "",
      solution: "",
      displayMode: "prompt"
    },
    eligibility: {
      tossupAttempted: { left: false, right: false },
      followupAttempted: { left: false, right: false }
    },
    questionKind: "tossup",
    claimOwner: "none",
    currentRoundIndex: 0,
    revealEligible: false,
    started: false,
    revealHoldStartedAtMs: null,
    postAnswerTarget: "none",
    lastUpdatedMs: seedNowMs,
    sessionStartedAtMs: seedNowMs
  };
}

/** @type {ReturnType<typeof initialState>} */
let state = initialState();

/** @type {BrowserWindow | null} */
let controlWindow = null;
/** @type {BrowserWindow | null} */
let projectionWindow = null;
/** @type {NodeJS.Timeout | null} */
let tickHandle = null;

function reduceCommand(previous, command) {
  const nextState = structuredClone(previous);
  const atMs = command.type === "clock:tick" ? (command.nowMs ?? Date.now()) : Date.now();

  switch (command.type) {
    case "setup:apply": {
      nextState.leftTeam.name = command.payload.leftTeamName.trim() || nextState.leftTeam.name;
      nextState.rightTeam.name = command.payload.rightTeamName.trim() || nextState.rightTeam.name;
      if (nextState.started) break;

      nextState.config.roundLengthSeconds = clampNonNegative(command.payload.roundLengthSeconds);
      nextState.config.tossupLengthSeconds = clampNonNegative(command.payload.tossupLengthSeconds);
      nextState.config.followupLengthSeconds = clampNonNegative(command.payload.followupLengthSeconds);
      nextState.config.warningThresholdSeconds = clampNonNegative(command.payload.warningThresholdSeconds);

      nextState.roundTimer.durationSeconds = nextState.config.roundLengthSeconds;
      nextState.roundTimer.secondsRemaining = nextState.config.roundLengthSeconds;
      nextState.roundTimer.warningAtSeconds = nextState.config.warningThresholdSeconds;
      nextState.roundTimer.running = false;

      nextState.questionTimer.durationSeconds = nextState.config.tossupLengthSeconds;
      nextState.questionTimer.secondsRemaining = 0;
      nextState.questionTimer.warningAtSeconds = nextState.config.warningThresholdSeconds;
      nextState.questionTimer.running = false;

      nextState.currentRoundIndex = 0;
      nextState.question.index = 1;
      nextState.started = false;
      nextState.revealEligible = false;
      nextState.revealHoldStartedAtMs = null;
      nextState.postAnswerTarget = "none";
      setClaim(nextState, "none");
      clearEligibility(nextState);
      nextState.phase = "pregame-ready";
      break;
    }

    case "round:toggle": {
      const nowRunning = !nextState.roundTimer.running;
      nextState.roundTimer.running = nowRunning;
      if (!nowRunning) {
        nextState.questionTimer.running = false;
      }
      if (nowRunning) {
        nextState.started = true;
        if (nextState.phase === "pregame-ready" || nextState.phase === "idle") {
          nextState.phase = "round-running:standby";
        }
      }
      break;
    }

    case "game:reset": {
      nextState.leftTeam.score = 0;
      nextState.rightTeam.score = 0;
      nextState.roundTimer.running = false;
      nextState.roundTimer.durationSeconds = nextState.config.roundLengthSeconds;
      nextState.roundTimer.secondsRemaining = nextState.config.roundLengthSeconds;
      nextState.questionTimer.running = false;
      nextState.questionTimer.durationSeconds = nextState.config.tossupLengthSeconds;
      nextState.questionTimer.secondsRemaining = 0;
      nextState.question.displayMode = "prompt";
      nextState.question.prompt = "Awaiting game start";
      nextState.question.answer = "";
      nextState.question.solution = "";
      nextState.currentRoundIndex = 0;
      nextState.question.index = 1;
      nextState.started = false;
      nextState.revealEligible = false;
      nextState.revealHoldStartedAtMs = null;
      nextState.postAnswerTarget = "none";
      nextState.questionKind = "tossup";
      setClaim(nextState, "none");
      clearEligibility(nextState);
      nextState.phase = "pregame-ready";
      break;
    }

    case "question:toggle-pause": {
      if (!nextState.roundTimer.running || nextState.phase === "round-ended") break;
      if (nextState.questionTimer.secondsRemaining <= 0) break;
      nextState.questionTimer.running = !nextState.questionTimer.running;
      break;
    }

    case "question:reset": {
      nextState.questionTimer.running = false;
      nextState.questionTimer.secondsRemaining = 0;
      nextState.questionTimer.durationSeconds = nextState.config.tossupLengthSeconds;
      nextState.question.displayMode = "prompt";
      nextState.revealEligible = false;
      nextState.revealHoldStartedAtMs = null;
      nextState.postAnswerTarget = "none";
      setClaim(nextState, "none");
      clearEligibility(nextState);
      nextState.phase = nextState.roundTimer.running ? "round-running:standby" : "round-paused";
      break;
    }

    case "question:set-content": {
      nextState.question.prompt = command.payload.prompt;
      nextState.question.answer = command.payload.answer;
      nextState.question.solution = command.payload.solution ?? "";
      nextState.question.displayMode = "prompt";
      break;
    }

    case "score:increment": {
      if (command.side === "left") nextState.leftTeam.score += 1;
      if (command.side === "right") nextState.rightTeam.score += 1;
      break;
    }

    case "score:decrement": {
      if (command.side === "left") nextState.leftTeam.score = clampNonNegative(nextState.leftTeam.score - 1);
      if (command.side === "right") nextState.rightTeam.score = clampNonNegative(nextState.rightTeam.score - 1);
      break;
    }

    case "claim:manual-set": {
      setClaim(nextState, command.side);
      break;
    }

    case "flow:next": {
      if (!nextState.started || !nextState.roundTimer.running) break;

      if (nextState.phase === "round-running:standby" || nextState.phase === "pregame-ready") {
        nextState.questionKind = "tossup";
        setClaim(nextState, "none");
        nextState.eligibility.tossupAttempted.left = false;
        nextState.eligibility.tossupAttempted.right = false;
        nextState.revealEligible = false;
        nextState.question.displayMode = "prompt";
        setQuestionTimer(nextState, nextState.config.tossupLengthSeconds, true);
        nextState.phase = "tossup:active";
      } else if (nextState.phase === "followup:standby") {
        if (nextState.claimOwner === "left") {
          nextState.phase = "followup:active-claimed-left";
        } else if (nextState.claimOwner === "right") {
          nextState.phase = "followup:active-claimed-right";
        } else {
          nextState.phase = "followup:active-open";
        }
        nextState.questionTimer.running = true;
      } else if (nextState.phase === "answer:revealed") {
        nextState.revealEligible = false;
        nextState.revealHoldStartedAtMs = null;
        nextState.questionTimer.running = false;
        clearQuestionContent(nextState);

        if (nextState.postAnswerTarget === "followup-standby") {
          nextState.questionKind = "followup";
          nextState.eligibility.followupAttempted.left = false;
          nextState.eligibility.followupAttempted.right = false;
          setQuestionTimer(nextState, nextState.config.followupLengthSeconds, false);
          nextState.postAnswerTarget = "none";
          nextState.phase = "followup:standby";
        } else {
          nextState.currentRoundIndex += 1;
          nextState.question.index = nextState.currentRoundIndex + 1;
          nextState.postAnswerTarget = "none";
          setClaim(nextState, "none");
          clearEligibility(nextState);
          nextState.questionTimer.secondsRemaining = 0;
          nextState.phase = "round-running:standby";
        }
      }
      break;
    }

    case "flow:override-next": {
      nextState.started = true;
      if (!nextState.roundTimer.running && nextState.roundTimer.secondsRemaining > 0) {
        nextState.roundTimer.running = true;
      }

      if (nextState.phase === "answer:revealed") {
        nextState.revealEligible = false;
        nextState.revealHoldStartedAtMs = null;
        nextState.questionTimer.running = false;
        clearQuestionContent(nextState);

        if (nextState.postAnswerTarget === "followup-standby") {
          nextState.questionKind = "followup";
          nextState.eligibility.followupAttempted.left = false;
          nextState.eligibility.followupAttempted.right = false;
          setQuestionTimer(nextState, nextState.config.followupLengthSeconds, false);
          nextState.postAnswerTarget = "none";
          nextState.phase = "followup:standby";
        } else {
          nextState.currentRoundIndex += 1;
          nextState.question.index = nextState.currentRoundIndex + 1;
          nextState.postAnswerTarget = "none";
          setClaim(nextState, "none");
          clearEligibility(nextState);
          nextState.questionTimer.secondsRemaining = 0;
          nextState.phase = nextState.roundTimer.running ? "round-running:standby" : "round-paused";
        }
        break;
      }

      if (nextState.phase === "answer:eligible") {
        nextState.revealEligible = true;
        nextState.question.displayMode = "answer-revealed";
        nextState.revealHoldStartedAtMs = null;
        nextState.phase = "answer:revealed";
        break;
      }

      if (nextState.phase === "followup:standby") {
        if (nextState.questionTimer.secondsRemaining <= 0) {
          setQuestionTimer(nextState, nextState.config.followupLengthSeconds, true);
        } else {
          nextState.questionTimer.running = true;
        }
        if (nextState.claimOwner === "left") {
          nextState.phase = "followup:active-claimed-left";
        } else if (nextState.claimOwner === "right") {
          nextState.phase = "followup:active-claimed-right";
        } else {
          nextState.phase = "followup:active-open";
        }
        break;
      }

      if (
        nextState.phase === "followup:active-open" ||
        nextState.phase === "followup:active-claimed-left" ||
        nextState.phase === "followup:active-claimed-right" ||
        nextState.phase === "followup:review"
      ) {
        enterAnswerEligible(nextState, "round-standby");
        break;
      }

      if (nextState.phase === "tossup:active" || nextState.phase === "tossup:review") {
        enterAnswerEligible(nextState, "followup-standby");
        break;
      }

      nextState.questionKind = "tossup";
      setClaim(nextState, "none");
      nextState.eligibility.tossupAttempted.left = false;
      nextState.eligibility.tossupAttempted.right = false;
      nextState.revealEligible = false;
      nextState.question.displayMode = "prompt";
      setQuestionTimer(nextState, nextState.config.tossupLengthSeconds, true);
      nextState.phase = "tossup:active";
      break;
    }

    case "flow:claim-left":
    case "flow:claim-right": {
      const side = command.type === "flow:claim-left" ? "left" : "right";
      if (nextState.phase === "tossup:active") {
        setClaim(nextState, side);
        nextState.phase = "tossup:review";
      } else if (nextState.phase === "followup:active-open") {
        setClaim(nextState, side);
        nextState.phase = "followup:review";
      }
      break;
    }

    case "flow:tossup-correct": {
      if (nextState.phase !== "tossup:review") break;
      if (nextState.claimOwner !== "none" && nextState.claimOwner !== command.side) break;
      if (nextState.eligibility.tossupAttempted[command.side]) break;
      setClaim(nextState, command.side);
      if (command.side === "left") nextState.leftTeam.score += 1;
      if (command.side === "right") nextState.rightTeam.score += 1;
      enterAnswerEligible(nextState, "followup-standby");
      break;
    }

    case "flow:tossup-incorrect": {
      if (nextState.phase !== "tossup:review") break;
      if (nextState.claimOwner !== command.side) break;
      nextState.eligibility.tossupAttempted[command.side] = true;
      const other = otherSide(command.side);
      const otherEligible = !nextState.eligibility.tossupAttempted[other] && nextState.questionTimer.secondsRemaining > 0;
      setClaim(nextState, "none");
      if (otherEligible) {
        nextState.phase = "tossup:active";
      } else {
        enterAnswerEligible(nextState, "followup-standby");
      }
      break;
    }

    case "flow:tossup-timeout": {
      if (nextState.phase !== "tossup:active" && nextState.phase !== "tossup:review") break;
      setClaim(nextState, "none");
      nextState.questionTimer.running = false;
      nextState.phase = "tossup:review";
      break;
    }

    case "flow:tossup-no-answer": {
      if (nextState.phase !== "tossup:review") break;
      if (nextState.claimOwner !== "none") break;
      enterAnswerEligible(nextState, "followup-standby");
      break;
    }

    case "flow:followup-timeout": {
      if (
        ![
          "followup:active-claimed-left",
          "followup:active-claimed-right",
          "followup:active-open",
          "followup:review"
        ].includes(nextState.phase)
      ) {
        break;
      }
      setClaim(nextState, "none");
      nextState.questionTimer.running = false;
      nextState.phase = "followup:review";
      break;
    }

    case "flow:followup-correct": {
      if (
        ![
          "followup:active-claimed-left",
          "followup:active-claimed-right",
          "followup:active-open",
          "followup:review"
        ].includes(nextState.phase)
      ) {
        break;
      }
      if (nextState.eligibility.followupAttempted[command.side]) break;
      if (nextState.phase !== "followup:active-open" && nextState.phase !== "followup:review") {
        if (nextState.claimOwner !== command.side) break;
      }
      if (
        nextState.phase === "followup:review" &&
        nextState.claimOwner !== "none" &&
        nextState.claimOwner !== command.side
      ) {
        break;
      }
      setClaim(nextState, command.side);
      if (command.side === "left") nextState.leftTeam.score += 2;
      if (command.side === "right") nextState.rightTeam.score += 2;
      enterAnswerEligible(nextState, "round-standby");
      break;
    }

    case "flow:followup-incorrect": {
      if (
        ![
          "followup:active-claimed-left",
          "followup:active-claimed-right",
          "followup:active-open",
          "followup:review"
        ].includes(nextState.phase)
      ) {
        break;
      }

      const side = command.side;
      if (
        nextState.phase === "followup:active-claimed-left" ||
        nextState.phase === "followup:active-claimed-right" ||
        nextState.phase === "followup:review"
      ) {
        if (nextState.claimOwner !== side) break;
      }

      nextState.eligibility.followupAttempted[side] = true;
      const other = otherSide(side);
      const otherEligible = !nextState.eligibility.followupAttempted[other] && nextState.questionTimer.secondsRemaining > 0;

      if (otherEligible) {
        enterFollowupClaimed(nextState, other, false);
      } else {
        enterAnswerEligible(nextState, "round-standby");
      }
      break;
    }

    case "flow:switch-claim": {
      if (!["followup:active-claimed-left", "followup:active-claimed-right"].includes(nextState.phase)) break;
      if (nextState.claimOwner === "none") break;
      const other = otherSide(nextState.claimOwner);
      // Manual override: always switch claim ownership to keep adjudication controls available.
      setClaim(nextState, other);
      nextState.phase = other === "left" ? "followup:active-claimed-left" : "followup:active-claimed-right";
      break;
    }

    case "flow:followup-no-answer": {
      if (nextState.phase !== "followup:review") break;
      if (nextState.claimOwner !== "none") break;
      enterAnswerEligible(nextState, "round-standby");
      break;
    }

    case "flow:reveal-hold-start": {
      if (!nextState.started || !nextState.revealEligible || nextState.phase !== "answer:eligible") break;
      nextState.revealHoldStartedAtMs = atMs;
      break;
    }

    case "flow:reveal-hold-cancel": {
      nextState.revealHoldStartedAtMs = null;
      break;
    }

    case "flow:reveal-hold-complete": {
      if (!canReveal(nextState, atMs)) break;
      nextState.question.displayMode = "answer-revealed";
      nextState.phase = "answer:revealed";
      nextState.revealHoldStartedAtMs = null;
      break;
    }

    case "flow:advance-round": {
      if (nextState.phase !== "answer:revealed") break;
      nextState.currentRoundIndex += 1;
      nextState.question.index = nextState.currentRoundIndex + 1;
      nextState.revealEligible = false;
      nextState.question.displayMode = "prompt";
      nextState.postAnswerTarget = "none";
      setClaim(nextState, "none");
      clearEligibility(nextState);
      nextState.questionTimer.running = false;
      nextState.questionTimer.secondsRemaining = 0;
      nextState.phase = nextState.roundTimer.running ? "round-running:standby" : "round-paused";
      break;
    }

    case "flow:jump-round": {
      const target = Math.max(0, Math.floor(command.roundIndex));
      nextState.currentRoundIndex = target;
      nextState.question.index = target + 1;
      nextState.questionKind = "tossup";
      nextState.questionTimer.running = false;
      nextState.questionTimer.durationSeconds = nextState.config.tossupLengthSeconds;
      nextState.questionTimer.secondsRemaining = 0;
      nextState.revealEligible = false;
      nextState.revealHoldStartedAtMs = null;
      nextState.postAnswerTarget = "none";
      setClaim(nextState, "none");
      clearEligibility(nextState);
      clearQuestionContent(nextState, nextState.started ? "Awaiting next phase" : "Awaiting game start");
      if (nextState.roundTimer.running) {
        nextState.phase = "round-running:standby";
      } else {
        nextState.phase = nextState.started ? "round-paused" : "pregame-ready";
      }
      break;
    }

    case "projection:open":
    case "projection:refresh":
    case "projection:reopen": {
      break;
    }

    case "projection:close": {
      break;
    }

    case "clock:tick": {
      const elapsed = Math.max(0, Math.floor((atMs - nextState.lastUpdatedMs) / 1000));

      if (elapsed > 0) {
        if (nextState.roundTimer.running) {
          nextState.roundTimer.secondsRemaining = clampNonNegative(nextState.roundTimer.secondsRemaining - elapsed);
        }

        if (nextState.questionTimer.running) {
            nextState.questionTimer.secondsRemaining = clampNonNegative(nextState.questionTimer.secondsRemaining - elapsed);
            if (nextState.questionTimer.secondsRemaining === 0) {
              nextState.questionTimer.running = false;

              if (nextState.phase === "tossup:active" || nextState.phase === "tossup:review") {
                setClaim(nextState, "none");
                nextState.phase = "tossup:review";
              } else if (
                nextState.phase === "followup:active-claimed-left" ||
                nextState.phase === "followup:active-claimed-right" ||
                nextState.phase === "followup:active-open" ||
                nextState.phase === "followup:review"
              ) {
                setClaim(nextState, "none");
                nextState.phase = "followup:review";
              }
            }
          }
      }

      if (elapsed > 0) {
        nextState.lastUpdatedMs = atMs;
      }
      return nextState;
    }

    default:
      break;
  }

  nextState.lastUpdatedMs = atMs;
  return nextState;
}

function broadcastState() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send(IPC_CHANNELS.stateSync, state);
  }
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.webContents.send(IPC_CHANNELS.stateSync, state);
  }
}

function applyCommand(command) {
  state = reduceCommand(state, command);
  broadcastState();
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    title: "Scoreboard Control",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  if (CONTROL_URL) {
    controlWindow.loadURL(CONTROL_URL);
  } else {
    controlWindow.loadFile(path.join(app.getAppPath(), "apps", "control", "dist", "index.html"));
  }
  controlWindow.webContents.on("did-finish-load", broadcastState);
}

function createProjectionWindow() {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    state.projectionOpen = true;
    projectionWindow.show();
    projectionWindow.focus();
    broadcastState();
    return;
  }

  projectionWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Scoreboard Projection",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  if (PROJECTION_URL) {
    projectionWindow.loadURL(PROJECTION_URL);
  } else {
    projectionWindow.loadFile(path.join(app.getAppPath(), "apps", "projection", "dist", "index.html"));
  }
  projectionWindow.webContents.setBackgroundThrottling(false);
  projectionWindow.webContents.on("did-finish-load", broadcastState);
  projectionWindow.on("closed", () => {
    projectionWindow = null;
    state.projectionOpen = false;
    broadcastState();
  });
  state.projectionOpen = true;
  broadcastState();
}

function handleProjectionWindowCommand(type) {
  if (type === "projection:open") {
    createProjectionWindow();
    return true;
  }
  if (type === "projection:refresh") {
    createProjectionWindow();
    projectionWindow?.webContents.reloadIgnoringCache();
    return true;
  }
  if (type === "projection:reopen") {
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.close();
    }
    createProjectionWindow();
    return true;
  }
  if (type === "projection:close") {
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.close();
    } else {
      state.projectionOpen = false;
      broadcastState();
    }
    return true;
  }
  return false;
}

app.whenReady().then(() => {
  createControlWindow();

  ipcMain.handle(IPC_CHANNELS.getState, async () => state);

  ipcMain.on(IPC_CHANNELS.command, (_event, command) => {
    if (!command || typeof command !== "object" || typeof command.type !== "string") {
      return;
    }
    if (handleProjectionWindowCommand(command.type)) {
      return;
    }
    applyCommand(command);
  });

  tickHandle = setInterval(() => {
    applyCommand({ type: "clock:tick", nowMs: Date.now() });
  }, 250);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
