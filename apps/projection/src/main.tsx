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

const normalizePlainTeXEscapes = (text: string): string =>
  text
    .replace(/\\([#$%&_{}])/g, "$1")
    .replace(/\\textbackslash\{\}/g, "\\");

const wrapPlainTextLines = (text: string, maxCharsPerLine: number = 52): string[] => {
  const normalized = normalizePlainTeXEscapes(text);
  const words = normalized.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
};

const GAME_ENVIRONMENTS = ["tossup", "followup", "answer", "solution", "emceenotes"] as const;
const GAME_ENV_PATTERN = new RegExp(
  String.raw`\\begin\{(${GAME_ENVIRONMENTS.join("|")})\}([\s\S]*?)\\end\{\1\}`,
  "gi"
);
const ORPHAN_GAME_ENV_TAG_PATTERN = new RegExp(
  String.raw`\\(begin|end)\{(${GAME_ENVIRONMENTS.join("|")})\}`,
  "gi"
);

const stripGameEnvironmentWrappers = (text: string): string => {
  let next = text;
  let previous = "";
  while (next !== previous) {
    previous = next;
    next = next.replace(GAME_ENV_PATTERN, (_match, _env, inner) => `${String(inner).trim()}\n`);
  }
  return next.replace(ORPHAN_GAME_ENV_TAG_PATTERN, "").trim();
};

const hasComplexTeXStructure = (text: string): boolean =>
  /\\begin\{(?!matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|array)[^}]+\}/.test(text);

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string };

const MATH_SEGMENT_PATTERN =
  /((?<!\\)\$\$[\s\S]+?(?<!\\)\$\$|\\\[[\s\S]+?\\\]|(?<!\\)\$[^$\n]+?(?<!\\)\$|\\\([\s\S]+?\\\))/g;

const splitMixedSegments = (line: string): Segment[] => {
  const segments: Segment[] = [];
  let cursor = 0;

  line.replace(MATH_SEGMENT_PATTERN, (match, _group, offset: number) => {
    if (offset > cursor) {
      segments.push({ kind: "text", value: line.slice(cursor, offset) });
    }
    segments.push({ kind: "math", value: match });
    cursor = offset + match.length;
    return match;
  });

  if (cursor < line.length) {
    segments.push({ kind: "text", value: line.slice(cursor) });
  }

  return segments;
};

const isBreakableMathToken = (math: string): boolean => {
  if (math.length < 24) return false;
  if (/[{}]/.test(math)) return false;
  if (/\\(frac|sqrt|begin|left|right|overline|underline|text)/.test(math)) return false;
  return true;
};

const splitMathForWrap = (math: string): string[] => {
  const compact = math.trim().replace(/\s+/g, " ");
  if (!compact) return [];
  if (!isBreakableMathToken(compact)) return [`$${compact}$`];

  return compact
    .replace(/([=+-])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `$${token}$`);
};

const wrapMixedLine = (line: string, maxCharsPerLine: number = 52): string[] => {
  const segments = splitMixedSegments(line);
  const tokens: string[] = [];

  for (const segment of segments) {
    if (segment.kind === "math") {
      const math = unwrapMathDelimiters(segment.value);
      if (math) tokens.push(...splitMathForWrap(math));
      continue;
    }

    const words = segment.value.trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) tokens.push(...words.map((word) => normalizePlainTeXEscapes(word)));
  }

  if (tokens.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const token of tokens) {
    const tokenWeight = /^\$|^\\\(|^\\\[/.test(token) ? Math.max(7, Math.floor(token.length * 0.32)) : token.length;
    const currentWeight = current.length;
    const nextWeight = currentWeight === 0 ? tokenWeight : currentWeight + 1 + tokenWeight;

    if (current && nextWeight > maxCharsPerLine) {
      lines.push(current);
      current = token;
    } else {
      current = current ? `${current} ${token}` : token;
    }
  }

  if (current) lines.push(current);
  return lines;
};

const unwrapMathDelimiters = (value: string): string => {
  if (value.startsWith("$$") && value.endsWith("$$")) return value.slice(2, -2).trim();
  if (value.startsWith("\\[") && value.endsWith("\\]")) return value.slice(2, -2).trim();
  if (value.startsWith("$") && value.endsWith("$")) return value.slice(1, -1).trim();
  if (value.startsWith("\\(") && value.endsWith("\\)")) return value.slice(2, -2).trim();
  return value.trim();
};

const convertMixedLineToTeX = (line: string): string => {
  const segments = splitMixedSegments(line);
  const parts: string[] = [];

  for (const segment of segments) {
    if (segment.kind === "math") {
      const math = unwrapMathDelimiters(segment.value);
      if (math) parts.push(math);
      continue;
    }

    const textChunk = normalizePlainTeXEscapes(segment.value);
    if (!textChunk.trim()) {
      if (textChunk.length > 0) parts.push("\\,");
      continue;
    }

    parts.push(`\\text{${escapeTeXText(textChunk)}}`);
  }

  return parts.join(" ");
};

const normalizeTeX = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const sanitized = stripGameEnvironmentWrappers(trimmed);
  if (!sanitized) return "";

  if (hasComplexTeXStructure(sanitized)) return sanitized;
  const hasDisplayMathBlock = /(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]/.test(sanitized);
  if (hasDisplayMathBlock) return sanitized;

  const hasTeXSyntax = /\\[a-zA-Z]+|(?<!\\)\$\$?|\\\(|\\\[/.test(sanitized);
  const hasExplicitMathDelimiters = /(?<!\\)\$\$?|\\\(|\\\[/.test(sanitized);

  if (hasTeXSyntax && !hasExplicitMathDelimiters) return sanitized;

  const sourceLines = hasExplicitMathDelimiters
    ? sanitized
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => wrapMixedLine(line, 52))
    : wrapPlainTextLines(sanitized, 52);

  if (sourceLines.length === 0) return "";
  const texLines = sourceLines.map((line) => convertMixedLineToTeX(line)).filter(Boolean).join(" \\\\ ");
  if (!texLines) return "";
  return `\\[\\begin{array}{@{}l@{}}${texLines}\\end{array}\\]`;
};

const normalizeDisplayAnswer = (text: string): string => text.trim().replace(/\.\s*$/, "");

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
    ? promptLength > 260
      ? "ultra-dense"
      : promptLength > 140
        ? "dense"
        : ""
    : promptLength > 420
      ? "ultra-dense"
      : promptLength > 260
        ? "dense"
        : "";
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
