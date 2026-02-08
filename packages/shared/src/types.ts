export type TeamSide = "left" | "right";
export type ClaimOwner = TeamSide | "none";
export type QuestionKind = "tossup" | "followup";
export type PostAnswerTarget = "none" | "followup-standby" | "round-standby";

export type GamePhase =
  | "idle"
  | "pregame-ready"
  | "round-running:standby"
  | "tossup:active"
  | "tossup:review"
  | "followup:standby"
  | "followup:active-claimed-left"
  | "followup:active-claimed-right"
  | "followup:active-open"
  | "followup:review"
  | "answer:eligible"
  | "answer:revealed"
  | "round-paused"
  | "round-ended";

export type DisplayMode = "prompt" | "answer-hidden" | "answer-revealed" | "solution-revealed";

export interface TeamState {
  name: string;
  score: number;
  hasClaim: boolean;
}

export interface TimerState {
  running: boolean;
  secondsRemaining: number;
  durationSeconds: number;
  warningAtSeconds: number;
}

export interface PregameConfig {
  roundLengthSeconds: number;
  tossupLengthSeconds: number;
  followupLengthSeconds: number;
  warningThresholdSeconds: number;
}

export interface EligibilityState {
  tossupAttempted: Record<TeamSide, boolean>;
  followupAttempted: Record<TeamSide, boolean>;
}

export interface QuestionState {
  index: number;
  prompt: string;
  answer: string;
  solution?: string;
  displayMode: DisplayMode;
}

export interface AppState {
  phase: GamePhase;
  projectionOpen: boolean;
  testingMode: boolean;
  leftTeam: TeamState;
  rightTeam: TeamState;
  config: PregameConfig;
  roundTimer: TimerState;
  questionTimer: TimerState;
  question: QuestionState;
  eligibility: EligibilityState;
  questionKind: QuestionKind;
  claimOwner: ClaimOwner;
  currentRoundIndex: number;
  revealEligible: boolean;
  started: boolean;
  revealHoldStartedAtMs: number | null;
  postAnswerTarget: PostAnswerTarget;
  lastUpdatedMs: number;
  sessionStartedAtMs: number;
}

export interface SetupPayload {
  leftTeamName: string;
  rightTeamName: string;
  roundLengthSeconds: number;
  tossupLengthSeconds: number;
  followupLengthSeconds: number;
  warningThresholdSeconds: number;
}

export type AppCommand =
  | { type: "setup:apply"; payload: SetupPayload }
  | { type: "testing-mode:set"; enabled: boolean }
  | { type: "round:toggle" }
  | { type: "game:reset" }
  | { type: "question:toggle-pause" }
  | { type: "question:reset" }
  | { type: "score:increment"; side: TeamSide }
  | { type: "score:decrement"; side: TeamSide }
  | { type: "claim:manual-set"; side: ClaimOwner }
  | { type: "question:set-content"; payload: Pick<QuestionState, "prompt" | "answer" | "solution"> }
  | { type: "flow:next" }
  | { type: "flow:override-next" }
  | { type: "flow:tossup-correct"; side: TeamSide }
  | { type: "flow:tossup-incorrect"; side: TeamSide }
  | { type: "flow:tossup-timeout" }
  | { type: "flow:tossup-no-answer" }
  | { type: "flow:claim-left" }
  | { type: "flow:claim-right" }
  | { type: "flow:followup-timeout" }
  | { type: "flow:followup-correct"; side: TeamSide }
  | { type: "flow:followup-incorrect"; side: TeamSide }
  | { type: "flow:followup-no-answer" }
  | { type: "flow:switch-claim" }
  | { type: "flow:reveal-hold-start" }
  | { type: "flow:reveal-hold-cancel" }
  | { type: "flow:reveal-hold-complete" }
  | { type: "flow:advance-round" }
  | { type: "flow:jump-round"; roundIndex: number }
  | { type: "projection:open" }
  | { type: "projection:refresh" }
  | { type: "projection:reopen" }
  | { type: "projection:close" }
  | { type: "clock:tick"; nowMs?: number };
