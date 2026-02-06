import type {
  AppCommand,
  AppState,
  ClaimOwner,
  GamePhase,
  PostAnswerTarget,
  PregameConfig,
  TeamSide
} from "@scoreboard/shared";

const DEFAULT_CONFIG: PregameConfig = {
  roundLengthSeconds: 15 * 60,
  tossupLengthSeconds: 45,
  followupLengthSeconds: 120,
  warningThresholdSeconds: 10
};

const REVEAL_HOLD_MS = 1000;

const clampNonNegative = (value: number): number => (value < 0 ? 0 : value);
const now = (): number => Date.now();

const otherSide = (side: TeamSide): TeamSide => (side === "left" ? "right" : "left");

const setClaim = (state: AppState, side: ClaimOwner): void => {
  state.claimOwner = side;
  state.leftTeam.hasClaim = side === "left";
  state.rightTeam.hasClaim = side === "right";
};

const setQuestionTimer = (state: AppState, seconds: number, running: boolean): void => {
  state.questionTimer.durationSeconds = seconds;
  state.questionTimer.secondsRemaining = seconds;
  state.questionTimer.running = running;
};

const clearQuestionContent = (state: AppState, prompt: string = "Awaiting next phase"): void => {
  state.question.prompt = prompt;
  state.question.answer = "";
  state.question.solution = "";
  state.question.displayMode = "prompt";
};

const setPhase = (state: AppState, phase: GamePhase): void => {
  state.phase = phase;
};

const clearEligibility = (state: AppState): void => {
  state.eligibility.tossupAttempted.left = false;
  state.eligibility.tossupAttempted.right = false;
  state.eligibility.followupAttempted.left = false;
  state.eligibility.followupAttempted.right = false;
};

const enterFollowupClaimed = (state: AppState, side: TeamSide, resetTimer: boolean): void => {
  state.questionKind = "followup";
  setClaim(state, side);
  if (resetTimer) {
    setQuestionTimer(state, state.config.followupLengthSeconds, false);
  } else {
    state.questionTimer.running = true;
  }
  state.revealEligible = false;
  setPhase(state, resetTimer ? "followup:standby" : side === "left" ? "followup:active-claimed-left" : "followup:active-claimed-right");
};

const enterAnswerEligible = (state: AppState, target: PostAnswerTarget): void => {
  state.questionTimer.running = false;
  state.revealEligible = true;
  state.question.displayMode = "answer-hidden";
  state.postAnswerTarget = target;
  setPhase(state, "answer:eligible");
};

const canReveal = (state: AppState, atMs: number): boolean => {
  if (!state.started) return false;
  if (!state.revealEligible) return false;
  if (state.phase !== "answer:eligible") return false;
  if (!state.revealHoldStartedAtMs) return false;
  return atMs - state.revealHoldStartedAtMs >= REVEAL_HOLD_MS;
};

export const createInitialState = (seedNowMs: number = now()): AppState => ({
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
});

export const reduceCommand = (previous: AppState, command: AppCommand): AppState => {
  const state: AppState = structuredClone(previous);
  const atMs = command.type === "clock:tick" ? (command.nowMs ?? now()) : now();

  switch (command.type) {
    case "setup:apply": {
      state.leftTeam.name = command.payload.leftTeamName.trim() || state.leftTeam.name;
      state.rightTeam.name = command.payload.rightTeamName.trim() || state.rightTeam.name;
      if (state.started) break;

      state.config.roundLengthSeconds = clampNonNegative(command.payload.roundLengthSeconds);
      state.config.tossupLengthSeconds = clampNonNegative(command.payload.tossupLengthSeconds);
      state.config.followupLengthSeconds = clampNonNegative(command.payload.followupLengthSeconds);
      state.config.warningThresholdSeconds = clampNonNegative(command.payload.warningThresholdSeconds);

      state.roundTimer.durationSeconds = state.config.roundLengthSeconds;
      state.roundTimer.secondsRemaining = state.config.roundLengthSeconds;
      state.roundTimer.warningAtSeconds = state.config.warningThresholdSeconds;
      state.roundTimer.running = false;

      state.questionTimer.durationSeconds = state.config.tossupLengthSeconds;
      state.questionTimer.secondsRemaining = 0;
      state.questionTimer.warningAtSeconds = state.config.warningThresholdSeconds;
      state.questionTimer.running = false;

      state.currentRoundIndex = 0;
      state.question.index = 1;
      state.started = false;
      state.revealEligible = false;
      state.revealHoldStartedAtMs = null;
      state.postAnswerTarget = "none";
      setClaim(state, "none");
      clearEligibility(state);
      setPhase(state, "pregame-ready");
      break;
    }

    case "round:toggle": {
      const nowRunning = !state.roundTimer.running;
      state.roundTimer.running = nowRunning;
      if (!nowRunning) {
        state.questionTimer.running = false;
      }
      if (nowRunning) {
        state.started = true;
        if (state.phase === "pregame-ready" || state.phase === "idle") {
          setPhase(state, "round-running:standby");
        }
      }
      break;
    }

    case "game:reset": {
      state.leftTeam.score = 0;
      state.rightTeam.score = 0;
      state.roundTimer.running = false;
      state.roundTimer.durationSeconds = state.config.roundLengthSeconds;
      state.roundTimer.secondsRemaining = state.config.roundLengthSeconds;
      state.questionTimer.running = false;
      state.questionTimer.durationSeconds = state.config.tossupLengthSeconds;
      state.questionTimer.secondsRemaining = 0;
      state.question.displayMode = "prompt";
      state.question.prompt = "Awaiting game start";
      state.question.answer = "";
      state.question.solution = "";
      state.currentRoundIndex = 0;
      state.question.index = 1;
      state.started = false;
      state.revealEligible = false;
      state.revealHoldStartedAtMs = null;
      state.postAnswerTarget = "none";
      state.questionKind = "tossup";
      setClaim(state, "none");
      clearEligibility(state);
      setPhase(state, "pregame-ready");
      break;
    }

    case "question:toggle-pause": {
      if (!state.roundTimer.running || state.phase === "round-ended") break;
      if (state.questionTimer.secondsRemaining <= 0) break;
      state.questionTimer.running = !state.questionTimer.running;
      break;
    }

    case "question:reset": {
      state.questionTimer.running = false;
      state.questionTimer.secondsRemaining = 0;
      state.questionTimer.durationSeconds = state.config.tossupLengthSeconds;
      state.question.displayMode = "prompt";
      state.revealEligible = false;
      state.postAnswerTarget = "none";
      setClaim(state, "none");
      clearEligibility(state);
      setPhase(state, state.roundTimer.running ? "round-running:standby" : "round-paused");
      break;
    }

    case "question:set-content": {
      state.question.prompt = command.payload.prompt;
      state.question.answer = command.payload.answer;
      state.question.solution = command.payload.solution ?? "";
      state.question.displayMode = "prompt";
      break;
    }

    case "score:increment": {
      if (command.side === "left") state.leftTeam.score += 1;
      if (command.side === "right") state.rightTeam.score += 1;
      break;
    }

    case "score:decrement": {
      if (command.side === "left") state.leftTeam.score = clampNonNegative(state.leftTeam.score - 1);
      if (command.side === "right") state.rightTeam.score = clampNonNegative(state.rightTeam.score - 1);
      break;
    }

    case "claim:manual-set": {
      setClaim(state, command.side);
      break;
    }

    case "flow:next": {
      if (!state.started || !state.roundTimer.running) break;
      if (state.phase === "round-running:standby" || state.phase === "pregame-ready") {
        state.questionKind = "tossup";
        setClaim(state, "none");
        state.eligibility.tossupAttempted.left = false;
        state.eligibility.tossupAttempted.right = false;
        state.revealEligible = false;
        state.question.displayMode = "prompt";
        setQuestionTimer(state, state.config.tossupLengthSeconds, true);
        setPhase(state, "tossup:active");
      } else if (state.phase === "followup:standby") {
        if (state.claimOwner === "left") {
          setPhase(state, "followup:active-claimed-left");
        } else if (state.claimOwner === "right") {
          setPhase(state, "followup:active-claimed-right");
        } else {
          setPhase(state, "followup:active-open");
        }
        state.questionTimer.running = true;
      } else if (state.phase === "answer:revealed") {
        state.revealEligible = false;
        state.revealHoldStartedAtMs = null;
        state.questionTimer.running = false;
        clearQuestionContent(state);

        if (state.postAnswerTarget === "followup-standby") {
          state.questionKind = "followup";
          state.eligibility.followupAttempted.left = false;
          state.eligibility.followupAttempted.right = false;
          setQuestionTimer(state, state.config.followupLengthSeconds, false);
          state.postAnswerTarget = "none";
          setPhase(state, "followup:standby");
        } else {
          state.currentRoundIndex += 1;
          state.question.index = state.currentRoundIndex + 1;
          state.postAnswerTarget = "none";
          setClaim(state, "none");
          clearEligibility(state);
          state.questionTimer.secondsRemaining = 0;
          setPhase(state, "round-running:standby");
        }
      }
      break;
    }

    case "flow:override-next": {
      state.started = true;
      if (!state.roundTimer.running && state.roundTimer.secondsRemaining > 0) {
        state.roundTimer.running = true;
      }

      if (state.phase === "answer:revealed") {
        state.revealEligible = false;
        state.revealHoldStartedAtMs = null;
        state.questionTimer.running = false;
        clearQuestionContent(state);

        if (state.postAnswerTarget === "followup-standby") {
          state.questionKind = "followup";
          state.eligibility.followupAttempted.left = false;
          state.eligibility.followupAttempted.right = false;
          setQuestionTimer(state, state.config.followupLengthSeconds, false);
          state.postAnswerTarget = "none";
          setPhase(state, "followup:standby");
        } else {
          state.currentRoundIndex += 1;
          state.question.index = state.currentRoundIndex + 1;
          state.postAnswerTarget = "none";
          setClaim(state, "none");
          clearEligibility(state);
          state.questionTimer.secondsRemaining = 0;
          setPhase(state, state.roundTimer.running ? "round-running:standby" : "round-paused");
        }
        break;
      }

      if (state.phase === "answer:eligible") {
        state.revealEligible = true;
        state.question.displayMode = "answer-revealed";
        state.revealHoldStartedAtMs = null;
        setPhase(state, "answer:revealed");
        break;
      }

      if (state.phase === "followup:standby") {
        if (state.questionTimer.secondsRemaining <= 0) {
          setQuestionTimer(state, state.config.followupLengthSeconds, true);
        } else {
          state.questionTimer.running = true;
        }
        if (state.claimOwner === "left") {
          setPhase(state, "followup:active-claimed-left");
        } else if (state.claimOwner === "right") {
          setPhase(state, "followup:active-claimed-right");
        } else {
          setPhase(state, "followup:active-open");
        }
        break;
      }

      if (
        state.phase === "followup:active-open" ||
        state.phase === "followup:active-claimed-left" ||
        state.phase === "followup:active-claimed-right" ||
        state.phase === "followup:review"
      ) {
        enterAnswerEligible(state, "round-standby");
        break;
      }

      if (state.phase === "tossup:active" || state.phase === "tossup:review") {
        enterAnswerEligible(state, "followup-standby");
        break;
      }

      state.questionKind = "tossup";
      setClaim(state, "none");
      state.eligibility.tossupAttempted.left = false;
      state.eligibility.tossupAttempted.right = false;
      state.revealEligible = false;
      state.question.displayMode = "prompt";
      setQuestionTimer(state, state.config.tossupLengthSeconds, true);
      setPhase(state, "tossup:active");
      break;
    }

    case "flow:claim-left":
    case "flow:claim-right": {
      const side: TeamSide = command.type === "flow:claim-left" ? "left" : "right";
      if (state.phase === "tossup:active") {
        setClaim(state, side);
        setPhase(state, "tossup:review");
      } else if (state.phase === "followup:active-open") {
        setClaim(state, side);
        setPhase(state, "followup:review");
      }
      break;
    }

    case "flow:tossup-correct": {
      if (state.phase !== "tossup:review") break;
      if (state.claimOwner !== "none" && state.claimOwner !== command.side) break;
      if (state.eligibility.tossupAttempted[command.side]) break;
      setClaim(state, command.side);
      state.leftTeam.score += command.side === "left" ? 1 : 0;
      state.rightTeam.score += command.side === "right" ? 1 : 0;
      enterAnswerEligible(state, "followup-standby");
      break;
    }

    case "flow:tossup-incorrect": {
      if (state.phase !== "tossup:review") break;
      if (state.claimOwner !== command.side) break;
      state.eligibility.tossupAttempted[command.side] = true;
      const other = otherSide(command.side);
      const otherEligible = !state.eligibility.tossupAttempted[other] && state.questionTimer.secondsRemaining > 0;
      setClaim(state, "none");
      if (otherEligible) {
        setPhase(state, "tossup:active");
      } else {
        enterAnswerEligible(state, "followup-standby");
      }
      break;
    }

    case "flow:tossup-timeout": {
      if (state.phase !== "tossup:active" && state.phase !== "tossup:review") break;
      setClaim(state, "none");
      state.questionTimer.running = false;
      setPhase(state, "tossup:review");
      break;
    }

    case "flow:tossup-no-answer": {
      if (state.phase !== "tossup:review") break;
      if (state.claimOwner !== "none") break;
      enterAnswerEligible(state, "followup-standby");
      break;
    }

    case "flow:followup-timeout": {
      if (!["followup:active-claimed-left", "followup:active-claimed-right", "followup:active-open", "followup:review"].includes(state.phase)) break;
      setClaim(state, "none");
      state.questionTimer.running = false;
      setPhase(state, "followup:review");
      break;
    }

    case "flow:followup-correct": {
      if (!["followup:active-claimed-left", "followup:active-claimed-right", "followup:active-open", "followup:review"].includes(state.phase)) break;
      if (state.eligibility.followupAttempted[command.side]) break;
      if (state.phase !== "followup:active-open" && state.phase !== "followup:review") {
        if (state.claimOwner !== command.side) break;
      }
      if (state.phase === "followup:review" && state.claimOwner !== "none" && state.claimOwner !== command.side) break;
      setClaim(state, command.side);
      if (command.side === "left") state.leftTeam.score += 2;
      if (command.side === "right") state.rightTeam.score += 2;
      enterAnswerEligible(state, "round-standby");
      break;
    }

    case "flow:followup-incorrect": {
      if (!["followup:active-claimed-left", "followup:active-claimed-right", "followup:active-open", "followup:review"].includes(state.phase)) break;
      const side = command.side;
      if (state.phase === "followup:active-claimed-left" || state.phase === "followup:active-claimed-right" || state.phase === "followup:review") {
        if (state.claimOwner !== side) break;
      }
      state.eligibility.followupAttempted[side] = true;
      const other = otherSide(side);
      const otherEligible = !state.eligibility.followupAttempted[other] && state.questionTimer.secondsRemaining > 0;
      if (otherEligible) {
        enterFollowupClaimed(state, other, false);
      } else {
        enterAnswerEligible(state, "round-standby");
      }
      break;
    }

    case "flow:followup-no-answer": {
      if (state.phase !== "followup:review") break;
      if (state.claimOwner !== "none") break;
      enterAnswerEligible(state, "round-standby");
      break;
    }

    case "flow:switch-claim": {
      if (!["followup:active-claimed-left", "followup:active-claimed-right"].includes(state.phase)) break;
      if (state.claimOwner === "none") break;
      const other = otherSide(state.claimOwner);
      // Manual override: always switch claim ownership to keep adjudication controls available.
      setClaim(state, other);
      setPhase(state, other === "left" ? "followup:active-claimed-left" : "followup:active-claimed-right");
      break;
    }

    case "flow:reveal-hold-start": {
      if (!state.started || !state.revealEligible || state.phase !== "answer:eligible") break;
      state.revealHoldStartedAtMs = atMs;
      break;
    }

    case "flow:reveal-hold-cancel": {
      state.revealHoldStartedAtMs = null;
      break;
    }

    case "flow:reveal-hold-complete": {
      if (!canReveal(state, atMs)) break;
      state.question.displayMode = "answer-revealed";
      setPhase(state, "answer:revealed");
      state.revealHoldStartedAtMs = null;
      break;
    }

    case "flow:advance-round": {
      if (state.phase !== "answer:revealed") break;
      state.currentRoundIndex += 1;
      state.question.index = state.currentRoundIndex + 1;
      state.revealEligible = false;
      state.question.displayMode = "prompt";
      state.postAnswerTarget = "none";
      setClaim(state, "none");
      clearEligibility(state);
      state.questionTimer.running = false;
      state.questionTimer.secondsRemaining = 0;
      setPhase(state, state.roundTimer.running ? "round-running:standby" : "round-paused");
      break;
    }

    case "flow:jump-round": {
      const target = Math.max(0, Math.floor(command.roundIndex));
      state.currentRoundIndex = target;
      state.question.index = target + 1;
      state.questionKind = "tossup";
      state.questionTimer.running = false;
      state.questionTimer.durationSeconds = state.config.tossupLengthSeconds;
      state.questionTimer.secondsRemaining = 0;
      state.revealEligible = false;
      state.revealHoldStartedAtMs = null;
      state.postAnswerTarget = "none";
      setClaim(state, "none");
      clearEligibility(state);
      clearQuestionContent(state, state.started ? "Awaiting next phase" : "Awaiting game start");
      if (state.roundTimer.running) {
        setPhase(state, "round-running:standby");
      } else {
        setPhase(state, state.started ? "round-paused" : "pregame-ready");
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
      const elapsed = Math.max(0, Math.floor((atMs - state.lastUpdatedMs) / 1000));
      if (elapsed > 0) {
        if (state.roundTimer.running) {
          state.roundTimer.secondsRemaining = clampNonNegative(state.roundTimer.secondsRemaining - elapsed);
        }

        if (state.questionTimer.running) {
            state.questionTimer.secondsRemaining = clampNonNegative(state.questionTimer.secondsRemaining - elapsed);
            if (state.questionTimer.secondsRemaining === 0) {
              state.questionTimer.running = false;
              if (state.phase === "tossup:active" || state.phase === "tossup:review") {
                setClaim(state, "none");
                setPhase(state, "tossup:review");
              } else if (
              state.phase === "followup:active-claimed-left" ||
              state.phase === "followup:active-claimed-right" ||
              state.phase === "followup:active-open" ||
              state.phase === "followup:review"
            ) {
              setClaim(state, "none");
              setPhase(state, "followup:review");
            }
          }
        }
      }

      if (elapsed > 0) {
        state.lastUpdatedMs = atMs;
      }
      return state;
    }

    default: {
      const _never: never = command;
      return _never;
    }
  }

  state.lastUpdatedMs = atMs;
  return state;
};
