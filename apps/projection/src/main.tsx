import React, { memo, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { normalizeTeXForDisplay, type AppState } from "@scoreboard/shared";
import { MathJax, MathJaxContext } from "better-react-mathjax";
import "./styles.css";

const formatClock = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const normalizeDisplayAnswer = (text: string): string => text.trim().replace(/\.\s*$/, "");

const FullTeX = memo(function FullTeX({ text }: { text: string }) {
  const source = useMemo(() => normalizeTeXForDisplay(text), [text]);
  if (!source) return null;
  return <MathJax dynamic>{source}</MathJax>;
});

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [showPauseGlyph, setShowPauseGlyph] = useState(false);

  useEffect(() => {
    let mounted = true;
    window.scoreboardAPI
      ?.getState()
      .then((nextState) => {
        if (mounted) setState(nextState);
      })
      .catch(() => undefined);

    const unsubscribe = window.scoreboardAPI?.onStateSync((nextState) => setState(nextState));

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const anyPaused = Boolean(
    state &&
      state.started &&
      state.phase !== "round-ended" &&
      ((!state.roundTimer.running && state.roundTimer.secondsRemaining > 0) ||
        (!state.questionTimer.running && state.questionTimer.secondsRemaining > 0))
  );

  useEffect(() => {
    if (!anyPaused) {
      setShowPauseGlyph(false);
      return;
    }

    // Alternate exactly 1000ms clock then 1000ms pause glyph.
    setShowPauseGlyph(false);
    const intervalId = window.setInterval(() => setShowPauseGlyph((prev) => !prev), 1000);
    return () => window.clearInterval(intervalId);
  }, [anyPaused]);

  if (!state) {
    return <main className="projection" />;
  }

  const roundPaused =
    state.started && state.phase !== "round-ended" && !state.roundTimer.running && state.roundTimer.secondsRemaining > 0;
  const questionPaused =
    state.started && state.phase !== "round-ended" && !state.questionTimer.running && state.questionTimer.secondsRemaining > 0;
  const displayTimer = (seconds: number, paused: boolean): string =>
    paused && showPauseGlyph ? "||" : formatClock(seconds);

  const displayPrompt = !state.started
    ? "Awaiting game start"
    : state.question.prompt || "Awaiting question content";
  const activeQuestionPhases: AppState["phase"][] = [
    "tossup:active",
    "tossup:review",
    "followup:active-open",
    "followup:active-claimed-left",
    "followup:active-claimed-right",
    "followup:review",
    "answer:eligible",
    "answer:revealed"
  ];
  const showingQuestion = activeQuestionPhases.includes(state.phase);
  const isGameComplete = /game complete/i.test(displayPrompt);
  const questionKindLabel = isGameComplete
    ? "GAME COMPLETE"
    : !showingQuestion
      ? "STANDBY"
      : state.questionKind === "followup"
        ? "FOLLOW-UP"
        : "TOSS-UP";
  const questionKindClass = isGameComplete
    ? "complete"
    : !showingQuestion
      ? "standby"
      : state.questionKind === "followup"
        ? "followup"
        : "tossup";

  const isEmptyPrompt = displayPrompt.trim().toLowerCase().includes("awaiting");
  const isAwaitingNextPhase = displayPrompt.trim().toLowerCase() === "awaiting next phase";
  const promptLength = displayPrompt.trim().length;
  const promptHasMath = /\$\$?|\\\(|\\\[|\\[a-zA-Z]+/.test(displayPrompt);
  const promptDensityClass = promptHasMath
    ? promptLength > 210
      ? "ultra-dense"
      : promptLength > 130
        ? "dense"
        : promptLength > 80
          ? "max-dense"
          : ""
    : promptLength > 360
      ? "ultra-dense"
      : promptLength > 230
        ? "dense"
        : promptLength > 150
          ? "max-dense"
        : ""
  const answerVisible = state.question.displayMode === "answer-revealed" || state.question.displayMode === "solution-revealed";

  const answerBody = answerVisible ? (
    <div className="answer-content">
      <FullTeX text={normalizeDisplayAnswer(state.question.answer)} />
      {state.question.displayMode === "solution-revealed" && state.question.solution ? (
        <div className="answer-solution">
          <FullTeX text={normalizeDisplayAnswer(state.question.solution)} />
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <MathJaxContext
      config={{
        tex: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"]
          ],
          displayMath: [
            ["$$", "$$"],
            ["\\[", "\\]"]
          ],
          processEscapes: true
        },
        chtml: {
          displayOverflow: "linebreak",
          linebreaks: {
            automatic: true,
            width: "container"
          }
        },
        svg: {
          displayOverflow: "linebreak",
          linebreaks: {
            automatic: true,
            width: "container"
          }
        }
      }}
    >
      <main className="projection">
        <div className="projection-frame">
          <section className="top-zone">
            <div className={`team team-l ${state.leftTeam.hasClaim ? "has-claim" : ""}`}>
              <div>
                <h2 className="team-name">{state.leftTeam.name}</h2>
                <p className={`claim-label ${state.leftTeam.hasClaim ? "visible" : ""}`}>HAS CLAIM</p>
              </div>
              <p className="team-score score-inner-right">{state.leftTeam.score}</p>
            </div>

            <div className="timer-stack">
              <section
                className={`question-timer ${
                  state.questionTimer.secondsRemaining > 0 && state.questionTimer.secondsRemaining <= 10 ? "critical" : ""
                }`}
              >
                <h1>{displayTimer(state.questionTimer.secondsRemaining, questionPaused)}</h1>
              </section>

              <section className="round-timer">
                <h2>ROUND</h2>
                <h1>{displayTimer(state.roundTimer.secondsRemaining, roundPaused)}</h1>
                <h2>TIMER</h2>
              </section>
            </div>

            <div className={`team team-r ${state.rightTeam.hasClaim ? "has-claim" : ""}`}>
              <p className="team-score score-inner-left">{state.rightTeam.score}</p>
              <div>
                <h2 className="team-name">{state.rightTeam.name}</h2>
                <p className={`claim-label ${state.rightTeam.hasClaim ? "visible" : ""}`}>HAS CLAIM</p>
              </div>
            </div>
          </section>

          <section className={`problem-panel ${isEmptyPrompt ? "empty" : ""} ${answerVisible ? "answer-visible" : ""}`}>
            <div className={`question-kind-banner ${questionKindClass}`}>
              {questionKindLabel}
            </div>
            <p className="panel-label current-question-label">Current Question</p>
            <div className={`problem-prompt ${promptDensityClass}`}>
              {isAwaitingNextPhase ? (
                <div className="awaiting-spinner-wrap" aria-label="Awaiting next phase">
                  <div className="awaiting-spinner" />
                </div>
              ) : (
                <FullTeX text={displayPrompt} />
              )}
            </div>

            <div className={`answer-drawer ${answerVisible ? "visible" : ""}`}>
              <p className="panel-label answer-label">Answer</p>
              {answerVisible ? answerBody : null}
            </div>
          </section>
        </div>
      </main>
    </MathJaxContext>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
