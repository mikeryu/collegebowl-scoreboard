import { describe, expect, it } from "vitest";
import { createInitialState, reduceCommand } from "./state";

const setupState = (seedNowMs = 0) =>
  reduceCommand(createInitialState(seedNowMs), {
    type: "setup:apply",
    payload: {
      leftTeamName: "L",
      rightTeamName: "R",
      roundLengthSeconds: 600,
      tossupLengthSeconds: 45,
      followupLengthSeconds: 120,
      warningThresholdSeconds: 10
    }
  });

describe("core state reducer", () => {
  it("applies setup and enters pregame-ready", () => {
    const state = setupState(1000);

    expect(state.phase).toBe("pregame-ready");
    expect(state.leftTeam.name).toBe("L");
    expect(state.rightTeam.name).toBe("R");
    expect(state.roundTimer.secondsRemaining).toBe(600);
    expect(state.questionTimer.durationSeconds).toBe(45);
  });

  it("starts toss-up from standby on flow:next", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });

    const next = reduceCommand(state, { type: "flow:next" });
    expect(next.phase).toBe("tossup:active");
    expect(next.questionKind).toBe("tossup");
    expect(next.questionTimer.running).toBe(true);
    expect(next.questionTimer.secondsRemaining).toBe(45);
  });

  it("toss-up incorrect keeps opposite side eligible", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:claim-left" });

    const next = reduceCommand(state, { type: "flow:tossup-incorrect", side: "left" });
    expect(next.phase).toBe("tossup:active");
    expect(next.eligibility.tossupAttempted.left).toBe(true);
    expect(next.eligibility.tossupAttempted.right).toBe(false);
  });

  it("moves to toss-up timeout review and then no-answer to eligibility", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });

    const timeout = reduceCommand(state, { type: "flow:tossup-timeout" });
    expect(timeout.phase).toBe("tossup:review");
    expect(timeout.claimOwner).toBe("none");

    const noAnswer = reduceCommand(timeout, { type: "flow:tossup-no-answer" });
    expect(noAnswer.phase).toBe("answer:eligible");
    expect(noAnswer.questionKind).toBe("tossup");
    expect(noAnswer.claimOwner).toBe("none");
    expect(noAnswer.postAnswerTarget).toBe("followup-standby");
  });

  it("allows either team to be marked correct from toss-up timeout review", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });

    state = reduceCommand(state, { type: "flow:tossup-timeout" });
    const rightCorrect = reduceCommand(state, { type: "flow:tossup-correct", side: "right" });

    expect(rightCorrect.phase).toBe("answer:eligible");
    expect(rightCorrect.rightTeam.score).toBe(1);
    expect(rightCorrect.claimOwner).toBe("right");
    expect(rightCorrect.postAnswerTarget).toBe("followup-standby");
  });

  it("moves to follow-up timeout review and then no-answer to eligibility", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:tossup-timeout" });
    state = reduceCommand(state, { type: "flow:tossup-no-answer" });
    state = { ...state, revealHoldStartedAtMs: state.lastUpdatedMs - 1500 };
    state = reduceCommand(state, { type: "flow:reveal-hold-complete" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:next" });

    const timeout = reduceCommand(state, { type: "flow:followup-timeout" });
    expect(timeout.phase).toBe("followup:review");
    expect(timeout.claimOwner).toBe("none");

    const noAnswer = reduceCommand(timeout, { type: "flow:followup-no-answer" });
    expect(noAnswer.phase).toBe("answer:eligible");
    expect(noAnswer.questionKind).toBe("followup");
    expect(noAnswer.claimOwner).toBe("none");
    expect(noAnswer.postAnswerTarget).toBe("round-standby");
  });

  it("awards toss-up correct as +1 and enters toss-up answer reveal flow", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:claim-right" });

    const next = reduceCommand(state, { type: "flow:tossup-correct", side: "right" });
    expect(next.rightTeam.score).toBe(1);
    expect(next.phase).toBe("answer:eligible");
    expect(next.claimOwner).toBe("right");
    expect(next.postAnswerTarget).toBe("followup-standby");
  });

  it("follow-up incorrect switches claim with remaining time", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:claim-left" });
    state = reduceCommand(state, { type: "flow:tossup-correct", side: "left" });
    state = { ...state, revealHoldStartedAtMs: state.lastUpdatedMs - 1500 };
    state = reduceCommand(state, { type: "flow:reveal-hold-complete" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:next" });

    const ticked = reduceCommand(state, { type: "clock:tick", nowMs: state.lastUpdatedMs + 35_000 });
    const switched = reduceCommand(ticked, { type: "flow:followup-incorrect", side: "left" });

    expect(switched.phase).toBe("followup:active-claimed-right");
    expect(switched.claimOwner).toBe("right");
    expect(switched.questionTimer.secondsRemaining).toBe(ticked.questionTimer.secondsRemaining);
  });

  it("enforces one follow-up attempt per team", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:tossup-timeout" });
    state = reduceCommand(state, { type: "flow:tossup-no-answer" });
    state = { ...state, revealHoldStartedAtMs: state.lastUpdatedMs - 1500 };
    state = reduceCommand(state, { type: "flow:reveal-hold-complete" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:claim-left" });
    state = reduceCommand(state, { type: "flow:followup-incorrect", side: "left" });
    const rightIncorrect = reduceCommand(state, { type: "flow:followup-incorrect", side: "right" });

    expect(rightIncorrect.phase).toBe("answer:eligible");
    expect(rightIncorrect.eligibility.followupAttempted.left).toBe(true);
    expect(rightIncorrect.eligibility.followupAttempted.right).toBe(true);

    const invalidRetry = reduceCommand(rightIncorrect, { type: "flow:followup-correct", side: "left" });
    expect(invalidRetry.phase).toBe("answer:eligible");
    expect(invalidRetry.leftTeam.score).toBe(0);
  });

  it("awards follow-up correct as +2", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:tossup-timeout" });
    state = reduceCommand(state, { type: "flow:tossup-no-answer" });
    state = { ...state, revealHoldStartedAtMs: state.lastUpdatedMs - 1500 };
    state = reduceCommand(state, { type: "flow:reveal-hold-complete" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:claim-right" });

    const next = reduceCommand(state, { type: "flow:followup-correct", side: "right" });
    expect(next.rightTeam.score).toBe(2);
    expect(next.phase).toBe("answer:eligible");
    expect(next.revealEligible).toBe(true);
  });

  it("blocks reveal before round start and before answer eligible", () => {
    let state = setupState();

    const blockedStart = reduceCommand(state, { type: "flow:reveal-hold-start" });
    expect(blockedStart.revealHoldStartedAtMs).toBeNull();

    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    const blockedEligible = reduceCommand(state, { type: "flow:reveal-hold-start" });
    expect(blockedEligible.revealHoldStartedAtMs).toBeNull();
  });

  it("reveals only after hold-complete threshold in answer:eligible", () => {
    let state = setupState(1000);
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:tossup-timeout" });
    state = reduceCommand(state, { type: "flow:tossup-no-answer" });
    state = { ...state, revealHoldStartedAtMs: state.lastUpdatedMs - 1500 };
    state = reduceCommand(state, { type: "flow:reveal-hold-complete" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:claim-left" });
    state = reduceCommand(state, { type: "flow:followup-correct", side: "left" });

    const started = reduceCommand(state, { type: "flow:reveal-hold-start" });
    const deterministicStarted = { ...started, revealHoldStartedAtMs: started.lastUpdatedMs };
    const tooSoon = reduceCommand(deterministicStarted, { type: "flow:reveal-hold-complete" });
    expect(tooSoon.phase).toBe("answer:eligible");

    const maturedHold = { ...tooSoon, revealHoldStartedAtMs: Date.now() - 1500 };
    const revealed = reduceCommand(maturedHold, { type: "flow:reveal-hold-complete" });
    expect(revealed.phase).toBe("answer:revealed");
    expect(revealed.question.displayMode).toBe("answer-revealed");
  });

  it("advances round on next from answer-revealed", () => {
    let state = setupState();
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:tossup-timeout" });
    state = reduceCommand(state, { type: "flow:tossup-no-answer" });
    state = { ...state, revealHoldStartedAtMs: state.lastUpdatedMs - 1500 };
    state = reduceCommand(state, { type: "flow:reveal-hold-complete" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "flow:claim-right" });
    state = reduceCommand(state, { type: "flow:followup-correct", side: "right" });
    state = {
      ...state,
      revealHoldStartedAtMs: state.lastUpdatedMs - 1500
    };
    state = reduceCommand(state, { type: "flow:reveal-hold-complete" });

    const advanced = reduceCommand(state, { type: "flow:next" });
    expect(advanced.currentRoundIndex).toBe(1);
    expect(advanced.question.index).toBe(2);
    expect(advanced.phase).toBe("round-running:standby");
    expect(advanced.question.prompt).toBe("Awaiting next phase");
    expect(advanced.question.answer).toBe("");
  });

  it("accumulates sub-second ticks correctly", () => {
    let state = setupState(0);
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });

    const tick1 = reduceCommand(state, { type: "clock:tick", nowMs: state.lastUpdatedMs + 400 });
    const tick2 = reduceCommand(tick1, { type: "clock:tick", nowMs: state.lastUpdatedMs + 800 });
    const tick3 = reduceCommand(tick2, { type: "clock:tick", nowMs: state.lastUpdatedMs + 1200 });

    expect(tick3.questionTimer.secondsRemaining).toBe(44);
  });

  it("pausing round timer pauses question timer, while unpause does not auto-resume question timer", () => {
    let state = setupState(0);
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });

    const beforePausePhase = state.phase;
    expect(state.questionTimer.running).toBe(true);

    const paused = reduceCommand(state, { type: "round:toggle" });
    expect(paused.roundTimer.running).toBe(false);
    expect(paused.phase).toBe(beforePausePhase);
    expect(paused.questionTimer.running).toBe(false);

    const resumed = reduceCommand(paused, { type: "round:toggle" });
    expect(resumed.roundTimer.running).toBe(true);
    expect(resumed.phase).toBe(beforePausePhase);
    expect(resumed.questionTimer.running).toBe(false);
  });

  it("full game reset clears gameplay state but keeps configured team names/timers", () => {
    let state = setupState(0);
    state = reduceCommand(state, { type: "round:toggle" });
    state = reduceCommand(state, { type: "flow:next" });
    state = reduceCommand(state, { type: "score:increment", side: "left" });
    state = reduceCommand(state, { type: "claim:manual-set", side: "right" });

    const reset = reduceCommand(state, { type: "game:reset" });
    expect(reset.phase).toBe("pregame-ready");
    expect(reset.started).toBe(false);
    expect(reset.leftTeam.name).toBe("L");
    expect(reset.rightTeam.name).toBe("R");
    expect(reset.leftTeam.score).toBe(0);
    expect(reset.rightTeam.score).toBe(0);
    expect(reset.claimOwner).toBe("none");
    expect(reset.roundTimer.running).toBe(false);
    expect(reset.roundTimer.secondsRemaining).toBe(600);
    expect(reset.questionTimer.running).toBe(false);
    expect(reset.questionTimer.secondsRemaining).toBe(0);
    expect(reset.question.prompt).toBe("Awaiting game start");
    expect(reset.currentRoundIndex).toBe(0);
    expect(reset.question.index).toBe(1);
  });
});
