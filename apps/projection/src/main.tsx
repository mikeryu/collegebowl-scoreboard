import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AppState } from "@scoreboard/shared";
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

const escapeTeXText = (text: string): string =>
  text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (match) => `\\${match}`)
    .replace(/[$%#&_]/g, (match) => `\\${match}`)
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\n/g, "\\\\ ");

const normalizeTeX = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const hasTeXSyntax = /\\begin\{|\\[a-zA-Z]+|\$\$?|\\\(|\\\[/.test(trimmed);
  if (hasTeXSyntax) return trimmed;

  return `\\[\\text{${escapeTeXText(trimmed)}}\\]`;
};

function FullTeX({ text }: { text: string }) {
  const source = normalizeTeX(text);
  if (!source) return null;
  return <MathJax dynamic>{source}</MathJax>;
}

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

  useEffect(() => {
    if (!state) {
      setShowPauseGlyph(false);
      return;
    }

    const roundPaused =
      state.started && state.phase !== "round-ended" && !state.roundTimer.running && state.roundTimer.secondsRemaining > 0;
    const questionPaused =
      state.started &&
      state.phase !== "round-ended" &&
      !state.questionTimer.running &&
      state.questionTimer.secondsRemaining > 0;
    const anyPaused = roundPaused || questionPaused;

    if (!anyPaused) {
      setShowPauseGlyph(false);
      return;
    }

    setShowPauseGlyph(true);
    const intervalId = window.setInterval(() => setShowPauseGlyph((prev) => !prev), 1000);
    return () => window.clearInterval(intervalId);
  }, [
    state,
    state?.phase,
    state?.started,
    state?.roundTimer.running,
    state?.roundTimer.secondsRemaining,
    state?.questionTimer.running,
    state?.questionTimer.secondsRemaining
  ]);

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
  const questionKindLabel = state.questionKind === "followup" ? "FOLLOW-UP" : "TOSS-UP";

  const isEmptyPrompt = displayPrompt.trim().toLowerCase().includes("awaiting");
  const answerVisible = state.question.displayMode === "answer-revealed" || state.question.displayMode === "solution-revealed";

  const answerBody = answerVisible ? (
    <div className="answer-content">
      <FullTeX text={state.question.answer} />
      {state.question.displayMode === "solution-revealed" && state.question.solution ? (
        <div className="answer-solution">
          <FullTeX text={state.question.solution} />
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

          <section className={`problem-panel ${isEmptyPrompt ? "empty" : ""}`}>
            <div className={`question-kind-banner ${state.questionKind === "followup" ? "followup" : "tossup"}`}>
              {questionKindLabel}
            </div>
            <p className="panel-label current-question-label">Current Question</p>
            <div className="problem-prompt">
              <FullTeX text={displayPrompt} />
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
