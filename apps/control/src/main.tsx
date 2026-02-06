import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AppCommand, AppState, SetupPayload, TeamSide } from "@scoreboard/shared";
import "./styles.css";
import warningSoundDataUrl from "./assets/legacy-warning-dataurl.txt?raw";
import expiredSoundDataUrl from "./assets/legacy-expired-dataurl.txt?raw";

type TabKey = "live" | "setup";
type QuestionPhase = "tossup" | "followup";

interface RoundItem {
  id: string;
  title: string;
  tossup: string;
  tossupAnswer: string;
  followup: string;
  followupAnswer: string;
  emceeNotes?: string;
}

interface ParseResult {
  rounds: RoundItem[];
  errors: string[];
}

interface LiveAction {
  key: string;
  label: string;
  command: AppCommand;
  primary?: boolean;
  danger?: boolean;
  requiresHold?: boolean;
  holdKind?: "flow" | "reveal";
}

const MAX_TEX_BYTES = 750_000;
const MAX_ROUNDS = 200;
const REVEAL_HOLD_MS = 1000;
const PROJECTOR_CLOSE_HOLD_MS = 1000;
const GAME_RESET_HOLD_MS = 3000;

const TEX_TEMPLATE = String.raw`% Scoreboard Game Template (.tex)
% Valid and compilable in Overleaf.

\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,amssymb}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{xcolor}
\usepackage[most]{tcolorbox}
\usepackage{lmodern}

\definecolor{wmred}{HTML}{9D2235}
\definecolor{wmgray}{HTML}{63666A}
\definecolor{wmgold}{HTML}{CEB888}

\tcbset{
  enhanced,
  breakable,
  boxrule=0.8pt,
  arc=2mm,
  left=2mm,
  right=2mm,
  top=1.2mm,
  bottom=1.2mm
}

\newcounter{roundctr}
\newenvironment{game}{
  \setcounter{roundctr}{0}
  \begin{center}
    {\LARGE\bfseries Scoreboard Game Packet}\\[2mm]
    {\large Structured Toss-Up / Follow-Up Rounds}
  \end{center}
  \vspace{3mm}
}{}
\newenvironment{round}{
  \refstepcounter{roundctr}
  \clearpage
  \begin{tcolorbox}[colback=wmgold!22,colframe=wmgold!65!black,title={Round \theroundctr},fonttitle=\bfseries\large]
}{\end{tcolorbox}}
\newenvironment{tossup}{
  \begin{tcolorbox}[colback=wmgray!8,colframe=wmgray!65!black,title={1. Toss-Up Question},fonttitle=\bfseries]
}{\end{tcolorbox}}
\newenvironment{tossupanswer}{
  \begin{tcolorbox}[colback=green!5,colframe=green!45!black,title={1.1 Toss-Up Answer},fonttitle=\bfseries]
}{\end{tcolorbox}}
\newenvironment{followup}{
  \begin{tcolorbox}[colback=wmred!4,colframe=wmred!70!black,title={2. Follow-Up Question},fonttitle=\bfseries]
}{\end{tcolorbox}}
\newenvironment{followupanswer}{
  \begin{tcolorbox}[colback=blue!4,colframe=blue!45!black,title={2.2 Follow-Up Answer},fonttitle=\bfseries]
}{\end{tcolorbox}}
\newenvironment{emceenotes}{
  \begin{tcolorbox}[colback=yellow!8,colframe=yellow!45!black,title={Emcee Notes (Ignored by Parser for Question Content)},fonttitle=\bfseries]
  \footnotesize
}{\end{tcolorbox}}

\begin{document}
\begin{game}

\begin{round}
\begin{tossup}
Evaluate $\int_0^1 (3x^2+2x)\,dx$.
\end{tossup}
\begin{tossupanswer}
$2$
\end{tossupanswer}
\begin{followup}
If $f(x)=x^3$, compute $f'(2)$.
\end{followup}
\begin{followupanswer}
$12$
\end{followupanswer}
\begin{emceenotes}
Read units clearly. Accept equivalent forms.
\end{emceenotes}
\end{round}

\end{game}

\end{document}
`;

const formatClock = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

const countMatches = (text: string, pattern: RegExp): number => (text.match(pattern) || []).length;

const extractEnv = (source: string, envName: string): string | null => {
  const re = new RegExp(`\\\\begin\\{${envName}\\}([\\s\\S]*?)\\\\end\\{${envName}\\}`, "m");
  const match = source.match(re);
  return match?.[1].trim() || null;
};

const parseRoundsFromTex = (rawText: string): ParseResult => {
  const errors: string[] = [];
  const text = rawText.replace(/\r\n/g, "\n").trim();

  if (!text) {
    return { rounds: [], errors: ["File is empty."] };
  }

  if (new TextEncoder().encode(text).length > MAX_TEX_BYTES) {
    errors.push(`File is too large. Max ${MAX_TEX_BYTES} bytes.`);
  }

  if (!/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(text)) {
    errors.push("Missing \\documentclass. Upload a full compilable LaTeX document.");
  }

  if (!/\\begin\{document\}/.test(text) || !/\\end\{document\}/.test(text)) {
    errors.push("Missing \\begin{document}/\\end{document}. Upload a full compilable LaTeX document.");
  }

  const forbiddenCommand = /\\(input|include|openout|write|write18|read|catcode|immediate)\b/i;
  if (forbiddenCommand.test(text)) {
    errors.push("Unsafe TeX command detected (input/include/write/read/catcode). Remove it and retry.");
  }

  const beginGameCount = countMatches(text, /\\begin\{game\}/g);
  const endGameCount = countMatches(text, /\\end\{game\}/g);
  if (beginGameCount !== endGameCount || beginGameCount !== 1) {
    errors.push("Game wrapper missing/unbalanced: include exactly one \\begin{game} ... \\end{game} section.");
  }

  const beginRoundCount = countMatches(text, /\\begin\{round\}/g);
  const endRoundCount = countMatches(text, /\\end\{round\}/g);
  if (beginRoundCount !== endRoundCount) {
    errors.push("Unbalanced round blocks: each \\begin{round} must have a matching \\end{round}.");
  }

  const roundBlocks = [...text.matchAll(/\\begin\{round\}([\s\S]*?)\\end\{round\}/g)].map((m) =>
    (m[1] || "").trim()
  );

  if (roundBlocks.length === 0) {
    errors.push("No round blocks found. Use the provided template format.");
  }

  if (roundBlocks.length > MAX_ROUNDS) {
    errors.push(`Too many rounds (${roundBlocks.length}). Max supported is ${MAX_ROUNDS}.`);
  }

  const rounds: RoundItem[] = [];

  roundBlocks.forEach((block, index) => {
    const tossup = extractEnv(block, "tossup");
    const tossupAnswer = extractEnv(block, "tossupanswer");
    const followup = extractEnv(block, "followup");
    const followupAnswer = extractEnv(block, "followupanswer");
    const emceeNotes = extractEnv(block, "emceenotes");

    if (!tossup || !tossupAnswer || !followup || !followupAnswer) {
      errors.push(
        `Round ${index + 1} is missing required section(s). Required: tossup, tossupanswer, followup, followupanswer.`
      );
      return;
    }

    rounds.push({
      id: `round-${index + 1}`,
      title: `Round ${index + 1}`,
      tossup,
      tossupAnswer,
      followup,
      followupAnswer,
      emceeNotes: emceeNotes ?? ""
    });
  });

  return { rounds, errors };
};

const playLegacySound = (dataUrl: string): void => {
  const snd = new Audio(dataUrl.trim());
  snd.preload = "auto";
  snd.currentTime = 0;
  snd.play().catch(() => undefined);
};

const playWarningBeep = (): void => {
  playLegacySound(warningSoundDataUrl);
};

const playExpiredAlarm = (): void => {
  playLegacySound(expiredSoundDataUrl);
};

function send(command: AppCommand): void {
  window.scoreboardAPI?.sendCommand(command);
}

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("live");
  const [leftHeld, setLeftHeld] = useState(false);
  const [rightHeld, setRightHeld] = useState(false);
  const [rounds, setRounds] = useState<RoundItem[]>([]);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(true);

  const previousTimesRef = useRef<{ round: number; question: number } | null>(null);
  const previousPhaseRef = useRef<AppState["phase"] | null>(null);
  const revealHoldTimeoutRef = useRef<number | null>(null);
  const revealHoldTickRef = useRef<number | null>(null);
  const revealHoldStartedAtRef = useRef<number | null>(null);
  const actionHoldTimeoutRef = useRef<number | null>(null);
  const actionHoldTickRef = useRef<number | null>(null);
  const actionHoldStartedAtRef = useRef<number | null>(null);
  const projectorCloseHoldTimeoutRef = useRef<number | null>(null);
  const projectorCloseHoldTickRef = useRef<number | null>(null);
  const projectorCloseHoldStartedAtRef = useRef<number | null>(null);
  const gameResetHoldTimeoutRef = useRef<number | null>(null);
  const gameResetHoldTickRef = useRef<number | null>(null);
  const gameResetHoldStartedAtRef = useRef<number | null>(null);
  const revealHoldCompletedRef = useRef(false);
  const [revealHoldProgress, setRevealHoldProgress] = useState(0);
  const [revealHoldRemainingMs, setRevealHoldRemainingMs] = useState(REVEAL_HOLD_MS);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [lastActionLabel, setLastActionLabel] = useState<string>("None yet");
  const [actionHoldProgress, setActionHoldProgress] = useState(0);
  const [actionHoldRemainingMs, setActionHoldRemainingMs] = useState(REVEAL_HOLD_MS);
  const [actionHoldKey, setActionHoldKey] = useState<string | null>(null);
  const [projectorCloseHoldProgress, setProjectorCloseHoldProgress] = useState(0);
  const [projectorCloseHoldRemainingMs, setProjectorCloseHoldRemainingMs] = useState(PROJECTOR_CLOSE_HOLD_MS);
  const [gameResetHoldProgress, setGameResetHoldProgress] = useState(0);
  const [gameResetHoldRemainingMs, setGameResetHoldRemainingMs] = useState(GAME_RESET_HOLD_MS);
  const [showPauseGlyph, setShowPauseGlyph] = useState(false);

  const [setup, setSetup] = useState<SetupPayload>({
    leftTeamName: "LEFT TEAM",
    rightTeamName: "RIGHT TEAM",
    roundLengthSeconds: 15 * 60,
    tossupLengthSeconds: 45,
    followupLengthSeconds: 120,
    warningThresholdSeconds: 10
  });

  const gameLoaded = rounds.length > 0;
  const currentRoundIndex = state?.currentRoundIndex ?? 0;
  const currentRound = rounds[currentRoundIndex] ?? null;
  const selectedRound = rounds[selectedRoundIndex] ?? null;

  const pushRoundPhase = useCallback((round: RoundItem, phase: QuestionPhase) => {
    if (phase === "tossup") {
      send({
        type: "question:set-content",
        payload: {
          prompt: round.tossup,
          answer: round.tossupAnswer,
          solution: ""
        }
      });
      return;
    }

    send({
      type: "question:set-content",
      payload: {
        prompt: round.followup,
        answer: round.followupAnswer,
        solution: ""
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    window.scoreboardAPI
      ?.getState()
      .then((nextState) => {
        if (mounted) {
          setState(nextState);
          setSetup({
            leftTeamName: nextState.leftTeam.name,
            rightTeamName: nextState.rightTeam.name,
            roundLengthSeconds: nextState.config.roundLengthSeconds,
            tossupLengthSeconds: nextState.config.tossupLengthSeconds,
            followupLengthSeconds: nextState.config.followupLengthSeconds,
            warningThresholdSeconds: nextState.config.warningThresholdSeconds
          });
        }
      })
      .catch(() => undefined);

    const unsubscribe = window.scoreboardAPI?.onStateSync((nextState) => setState(nextState));

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!state) return;

    if (!previousTimesRef.current) {
      previousTimesRef.current = {
        round: state.roundTimer.secondsRemaining,
        question: state.questionTimer.secondsRemaining
      };
      return;
    }

    const prev = previousTimesRef.current;
    const roundNow = state.roundTimer.secondsRemaining;
    const questionNow = state.questionTimer.secondsRemaining;

    if (prev.round > 10 && roundNow <= 10 && roundNow > 0) playWarningBeep();
    if (prev.question > 10 && questionNow <= 10 && questionNow > 0) playWarningBeep();

    if (prev.round > 0 && roundNow === 0) playExpiredAlarm();
    if (prev.question > 0 && questionNow === 0) playExpiredAlarm();

    previousTimesRef.current = { round: roundNow, question: questionNow };
  }, [state]);

  useEffect(() => {
    if (!state || !gameLoaded || !currentRound) return;

    const was = previousPhaseRef.current;
    const now = state.phase;
    const wasFollowupActive =
      was === "followup:active-claimed-left" ||
      was === "followup:active-claimed-right" ||
      was === "followup:active-open" ||
      was === "followup:review";
    const nowFollowupActive =
      now === "followup:active-claimed-left" ||
      now === "followup:active-claimed-right" ||
      now === "followup:active-open" ||
      now === "followup:review";

    if (now === "tossup:active" && was !== "tossup:active") {
      pushRoundPhase(currentRound, "tossup");
    }

    if (nowFollowupActive && !wasFollowupActive) {
      pushRoundPhase(currentRound, "followup");
    }

    if (now === "round-running:standby" && was === "answer:revealed" && !rounds[currentRoundIndex]) {
      send({
        type: "question:set-content",
        payload: {
          prompt: "Awaiting question content",
          answer: "",
          solution: ""
        }
      });
    }

    previousPhaseRef.current = now;
  }, [currentRound, currentRoundIndex, gameLoaded, pushRoundPhase, rounds, state]);

  useEffect(() => {
    return () => {
      if (revealHoldTimeoutRef.current) {
        window.clearTimeout(revealHoldTimeoutRef.current);
        revealHoldTimeoutRef.current = null;
      }
      if (revealHoldTickRef.current) {
        window.clearInterval(revealHoldTickRef.current);
        revealHoldTickRef.current = null;
      }
      if (actionHoldTimeoutRef.current) {
        window.clearTimeout(actionHoldTimeoutRef.current);
        actionHoldTimeoutRef.current = null;
      }
      if (actionHoldTickRef.current) {
        window.clearInterval(actionHoldTickRef.current);
        actionHoldTickRef.current = null;
      }
      if (projectorCloseHoldTimeoutRef.current) {
        window.clearTimeout(projectorCloseHoldTimeoutRef.current);
        projectorCloseHoldTimeoutRef.current = null;
      }
      if (projectorCloseHoldTickRef.current) {
        window.clearInterval(projectorCloseHoldTickRef.current);
        projectorCloseHoldTickRef.current = null;
      }
      if (gameResetHoldTimeoutRef.current) {
        window.clearTimeout(gameResetHoldTimeoutRef.current);
        gameResetHoldTimeoutRef.current = null;
      }
      if (gameResetHoldTickRef.current) {
        window.clearInterval(gameResetHoldTickRef.current);
        gameResetHoldTickRef.current = null;
      }
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

  const handleTexFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      try {
        if (!file.name.toLowerCase().endsWith(".tex")) {
          setUploadError("Please upload a .tex file.");
          return;
        }

        const text = await file.text();
        const parsed = parseRoundsFromTex(text);

        if (parsed.errors.length > 0) {
          setUploadError(parsed.errors.join(" "));
          return;
        }

        setRounds(parsed.rounds);
        setSelectedRoundIndex(0);
        setUploadedFileName(file.name);
        setShowUploadModal(false);
        setUploadError(null);

        if (parsed.rounds[0]) {
          send({
            type: "question:set-content",
            payload: {
              prompt: "Awaiting game start",
              answer: parsed.rounds[0].tossupAnswer,
              solution: ""
            }
          });
        }
      } catch {
        setUploadError("Unable to read the file. Please retry with a valid .tex template.");
      }
    },
    []
  );

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([TEX_TEMPLATE], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scoreboard-game-template.tex";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const beginRevealHold = useCallback(() => {
    if (!state || state.phase !== "answer:eligible") return;
    if (revealHoldTimeoutRef.current) return;
    revealHoldCompletedRef.current = false;
    revealHoldStartedAtRef.current = performance.now();
    setRevealHoldProgress(0);
    setRevealHoldRemainingMs(REVEAL_HOLD_MS);
    send({ type: "flow:reveal-hold-start" });

    revealHoldTickRef.current = window.setInterval(() => {
      if (!revealHoldStartedAtRef.current) return;
      const elapsed = performance.now() - revealHoldStartedAtRef.current;
      const nextProgress = Math.max(0, Math.min(1, elapsed / REVEAL_HOLD_MS));
      setRevealHoldProgress(nextProgress);
      setRevealHoldRemainingMs(Math.max(0, REVEAL_HOLD_MS - elapsed));
    }, 40);

    revealHoldTimeoutRef.current = window.setTimeout(() => {
      revealHoldCompletedRef.current = true;
      send({ type: "flow:reveal-hold-complete" });
      setRevealHoldProgress(1);
      setRevealHoldRemainingMs(0);
      if (revealHoldTickRef.current) {
        window.clearInterval(revealHoldTickRef.current);
        revealHoldTickRef.current = null;
      }
      revealHoldTimeoutRef.current = null;
    }, REVEAL_HOLD_MS);
  }, [state]);

  const cancelRevealHold = useCallback(() => {
    if (revealHoldTimeoutRef.current) {
      window.clearTimeout(revealHoldTimeoutRef.current);
      revealHoldTimeoutRef.current = null;
    }
    if (!revealHoldCompletedRef.current) {
      send({ type: "flow:reveal-hold-cancel" });
    }
    if (revealHoldTickRef.current) {
      window.clearInterval(revealHoldTickRef.current);
      revealHoldTickRef.current = null;
    }
    revealHoldCompletedRef.current = false;
    revealHoldStartedAtRef.current = null;
    setRevealHoldProgress(0);
    setRevealHoldRemainingMs(REVEAL_HOLD_MS);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!state) return;
      const key = event.key;
      const editable = isEditableTarget(event.target);

      if (!editable && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Escape"].includes(key)) {
        event.preventDefault();
      }

      if (key.toLowerCase() === "a") setLeftHeld(true);
      if (key.toLowerCase() === "d") setRightHeld(true);

      if (editable) return;

      if (event.repeat && !["w", "s"].includes(key.toLowerCase())) return;

      if (key === "Escape") {
        if (!gameLoaded) {
          setShowUploadModal(true);
          return;
        }
        send({ type: "round:toggle" });
        return;
      }

      if (key === " ") {
        send({ type: "question:toggle-pause" });
        return;
      }

      if (key.toLowerCase() === "w") {
        if (leftHeld) send({ type: "score:increment", side: "left" });
        if (rightHeld) send({ type: "score:increment", side: "right" });
      }

      if (key.toLowerCase() === "s") {
        if (leftHeld) send({ type: "score:decrement", side: "left" });
        if (rightHeld) send({ type: "score:decrement", side: "right" });
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "a") setLeftHeld(false);
      if (key === "d") setRightHeld(false);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gameLoaded, leftHeld, rightHeld, state]);

  const nextFlowStep = useMemo(() => {
    if (!state || !gameLoaded) return "Upload game and start round";

    switch (state.phase) {
      case "round-running:standby":
        return "Toss-up";
      case "tossup:active":
      case "tossup:review":
        return "Resolve toss-up";
      case "followup:standby":
        return "Hold to show follow-up + start timer";
      case "followup:active-open":
      case "followup:active-claimed-left":
      case "followup:active-claimed-right":
      case "followup:review":
        return "Resolve follow-up";
      case "answer:eligible":
        return "Press-and-hold reveal + answer";
      case "answer:revealed":
        return state.postAnswerTarget === "followup-standby" ? "Standby follow-up" : "Next round";
      default:
        return "Start round";
    }
  }, [gameLoaded, state]);

  const liveActions = useMemo<LiveAction[]>(() => {
    if (!state) return [];

    const actions: LiveAction[] = [];

    if (state.phase === "round-running:standby") {
      actions.push({
        key: "next",
        label: "Hold: Show Toss-up",
        command: { type: "flow:next" },
        primary: true,
        requiresHold: true
      });
      return actions;
    }

    if (state.phase === "followup:standby") {
      actions.push({
        key: "next-followup",
        label: "Hold: Show Follow-up + Start Timer",
        command: { type: "flow:next" },
        primary: true,
        requiresHold: true,
        holdKind: "flow"
      });
      return actions;
    }

    if (state.phase === "tossup:active") {
      actions.push({ key: "claim-left", label: "Left Claims", command: { type: "flow:claim-left" }, primary: true });
      actions.push({ key: "claim-right", label: "Right Claims", command: { type: "flow:claim-right" }, primary: true });
      actions.push({ key: "timeout", label: "Time Expired / No Claim", command: { type: "flow:tossup-timeout" } });
      return actions;
    }

    if (state.phase === "tossup:review" && state.claimOwner !== "none") {
      actions.push({
        key: "tossup-correct",
        label: `${state.claimOwner === "left" ? "Left" : "Right"} Correct (+1)`,
        command: { type: "flow:tossup-correct", side: state.claimOwner },
        primary: true
      });
      actions.push({
        key: "tossup-incorrect",
        label: `${state.claimOwner === "left" ? "Left" : "Right"} Incorrect`,
        command: { type: "flow:tossup-incorrect", side: state.claimOwner },
        danger: true
      });
      return actions;
    }

    if (state.phase === "tossup:review" && state.claimOwner === "none") {
      actions.push({
        key: "tossup-timeout-left-correct",
        label: "Left Correct (+1)",
        command: { type: "flow:tossup-correct", side: "left" },
        primary: true
      });
      actions.push({
        key: "tossup-timeout-right-correct",
        label: "Right Correct (+1)",
        command: { type: "flow:tossup-correct", side: "right" },
        primary: true
      });
      actions.push({
        key: "tossup-no-answer",
        label: "No One Answered",
        command: { type: "flow:tossup-no-answer" }
      });
      return actions;
    }

    if (state.phase === "followup:active-open") {
      actions.push({ key: "followup-claim-left", label: "Left Claims Follow-up", command: { type: "flow:claim-left" }, primary: true });
      actions.push({ key: "followup-claim-right", label: "Right Claims Follow-up", command: { type: "flow:claim-right" }, primary: true });
      actions.push({ key: "followup-timeout-open", label: "Time Expired", command: { type: "flow:followup-timeout" } });
      return actions;
    }

    if (state.phase === "followup:review" && state.claimOwner !== "none") {
      actions.push({
        key: "followup-correct-review",
        label: `${state.claimOwner === "left" ? "Left" : "Right"} Correct (+2)`,
        command: { type: "flow:followup-correct", side: state.claimOwner },
        primary: true
      });
      actions.push({
        key: "followup-incorrect-review",
        label: `${state.claimOwner === "left" ? "Left" : "Right"} Incorrect`,
        command: { type: "flow:followup-incorrect", side: state.claimOwner },
        danger: true
      });
      return actions;
    }

    if (state.phase === "followup:review" && state.claimOwner === "none") {
      actions.push({
        key: "followup-timeout-left-correct",
        label: "Left Correct (+2)",
        command: { type: "flow:followup-correct", side: "left" },
        primary: true
      });
      actions.push({
        key: "followup-timeout-right-correct",
        label: "Right Correct (+2)",
        command: { type: "flow:followup-correct", side: "right" },
        primary: true
      });
      actions.push({
        key: "followup-no-answer",
        label: "No One Answered",
        command: { type: "flow:followup-no-answer" }
      });
      return actions;
    }

    if (state.phase === "followup:active-claimed-left" || state.phase === "followup:active-claimed-right") {
      const side: TeamSide = state.phase === "followup:active-claimed-left" ? "left" : "right";
      actions.push({
        key: "followup-correct-claimed",
        label: `${side === "left" ? "Left" : "Right"} Correct (+2)`,
        command: { type: "flow:followup-correct", side },
        primary: true
      });
      actions.push({
        key: "followup-incorrect-claimed",
        label: `${side === "left" ? "Left" : "Right"} Incorrect`,
        command: { type: "flow:followup-incorrect", side },
        danger: true
      });
      actions.push({ key: "switch-claim", label: "Switch Claim", command: { type: "flow:switch-claim" }, danger: true });
      actions.push({ key: "followup-timeout-claimed", label: "Time Expired", command: { type: "flow:followup-timeout" } });
      return actions;
    }

    if (state.phase === "answer:revealed") {
      actions.push({
        key: "advance",
        label: state.postAnswerTarget === "followup-standby" ? "Next: Standby Follow-up" : "Next Round",
        command: { type: "flow:next" },
        primary: true
      });
      return actions;
    }

    if (state.phase === "answer:eligible") {
      actions.push({
        key: "reveal-answer",
        label: "HOLD TO REVEAL ANSWER",
        command: { type: "flow:reveal-hold-complete" },
        primary: true,
        danger: true,
        requiresHold: true,
        holdKind: "reveal"
      });
      return actions;
    }

    return actions;
  }, [state]);

  if (!state) {
    return <main className="control-shell" />;
  }

  const roundPaused =
    state.started && state.phase !== "round-ended" && !state.roundTimer.running && state.roundTimer.secondsRemaining > 0;
  const questionPaused =
    state.started && state.phase !== "round-ended" && !state.questionTimer.running && state.questionTimer.secondsRemaining > 0;
  const displayTimer = (seconds: number, paused: boolean): string =>
    paused && showPauseGlyph ? "||" : formatClock(seconds);

  const changeScore = (side: TeamSide, delta: 1 | -1): void => {
    send({ type: delta > 0 ? "score:increment" : "score:decrement", side });
  };

  const toggleManualClaim = (side: TeamSide): void => {
    send({ type: "claim:manual-set", side: state.claimOwner === side ? "none" : side });
  };

  const runAction = (action: LiveAction): void => {
    setLastActionLabel(action.label);
    setActiveActionKey(action.key);
    send(action.command);
    window.setTimeout(() => setActiveActionKey((current) => (current === action.key ? null : current)), 220);
  };

  const beginActionHold = (action: LiveAction): void => {
    if (actionHoldTimeoutRef.current) return;
    setActionHoldKey(action.key);
    actionHoldStartedAtRef.current = performance.now();
    setActionHoldProgress(0);
    setActionHoldRemainingMs(REVEAL_HOLD_MS);

    actionHoldTickRef.current = window.setInterval(() => {
      if (!actionHoldStartedAtRef.current) return;
      const elapsed = performance.now() - actionHoldStartedAtRef.current;
      setActionHoldProgress(Math.max(0, Math.min(1, elapsed / REVEAL_HOLD_MS)));
      setActionHoldRemainingMs(Math.max(0, REVEAL_HOLD_MS - elapsed));
    }, 40);

    actionHoldTimeoutRef.current = window.setTimeout(() => {
      runAction(action);
      setActionHoldProgress(0);
      setActionHoldRemainingMs(REVEAL_HOLD_MS);
      setActionHoldKey(null);
      actionHoldStartedAtRef.current = null;
      if (actionHoldTickRef.current) {
        window.clearInterval(actionHoldTickRef.current);
        actionHoldTickRef.current = null;
      }
      actionHoldTimeoutRef.current = null;
    }, REVEAL_HOLD_MS);
  };

  const cancelActionHold = (): void => {
    if (actionHoldTimeoutRef.current) {
      window.clearTimeout(actionHoldTimeoutRef.current);
      actionHoldTimeoutRef.current = null;
    }
    if (actionHoldTickRef.current) {
      window.clearInterval(actionHoldTickRef.current);
      actionHoldTickRef.current = null;
    }
    actionHoldStartedAtRef.current = null;
    setActionHoldProgress(0);
    setActionHoldRemainingMs(REVEAL_HOLD_MS);
    setActionHoldKey(null);
  };

  const projectionAction = (type: "projection:open" | "projection:refresh" | "projection:close"): void => {
    send({ type });
  };

  const beginProjectorCloseHold = (): void => {
    if (projectorCloseHoldTimeoutRef.current) return;
    projectorCloseHoldStartedAtRef.current = performance.now();
    setProjectorCloseHoldProgress(0);
    setProjectorCloseHoldRemainingMs(PROJECTOR_CLOSE_HOLD_MS);

    projectorCloseHoldTickRef.current = window.setInterval(() => {
      if (!projectorCloseHoldStartedAtRef.current) return;
      const elapsed = performance.now() - projectorCloseHoldStartedAtRef.current;
      setProjectorCloseHoldProgress(Math.max(0, Math.min(1, elapsed / PROJECTOR_CLOSE_HOLD_MS)));
      setProjectorCloseHoldRemainingMs(Math.max(0, PROJECTOR_CLOSE_HOLD_MS - elapsed));
    }, 40);

    projectorCloseHoldTimeoutRef.current = window.setTimeout(() => {
      projectionAction("projection:close");
      setProjectorCloseHoldProgress(0);
      setProjectorCloseHoldRemainingMs(PROJECTOR_CLOSE_HOLD_MS);
      projectorCloseHoldStartedAtRef.current = null;
      if (projectorCloseHoldTickRef.current) {
        window.clearInterval(projectorCloseHoldTickRef.current);
        projectorCloseHoldTickRef.current = null;
      }
      projectorCloseHoldTimeoutRef.current = null;
    }, PROJECTOR_CLOSE_HOLD_MS);
  };

  const cancelProjectorCloseHold = (): void => {
    if (projectorCloseHoldTimeoutRef.current) {
      window.clearTimeout(projectorCloseHoldTimeoutRef.current);
      projectorCloseHoldTimeoutRef.current = null;
    }
    if (projectorCloseHoldTickRef.current) {
      window.clearInterval(projectorCloseHoldTickRef.current);
      projectorCloseHoldTickRef.current = null;
    }
    projectorCloseHoldStartedAtRef.current = null;
    setProjectorCloseHoldProgress(0);
    setProjectorCloseHoldRemainingMs(PROJECTOR_CLOSE_HOLD_MS);
  };

  const beginGameResetHold = (): void => {
    if (gameResetHoldTimeoutRef.current) return;
    gameResetHoldStartedAtRef.current = performance.now();
    setGameResetHoldProgress(0);
    setGameResetHoldRemainingMs(GAME_RESET_HOLD_MS);

    gameResetHoldTickRef.current = window.setInterval(() => {
      if (!gameResetHoldStartedAtRef.current) return;
      const elapsed = performance.now() - gameResetHoldStartedAtRef.current;
      setGameResetHoldProgress(Math.max(0, Math.min(1, elapsed / GAME_RESET_HOLD_MS)));
      setGameResetHoldRemainingMs(Math.max(0, GAME_RESET_HOLD_MS - elapsed));
    }, 40);

    gameResetHoldTimeoutRef.current = window.setTimeout(() => {
      send({ type: "game:reset" });
      setGameResetHoldProgress(0);
      setGameResetHoldRemainingMs(GAME_RESET_HOLD_MS);
      gameResetHoldStartedAtRef.current = null;
      if (gameResetHoldTickRef.current) {
        window.clearInterval(gameResetHoldTickRef.current);
        gameResetHoldTickRef.current = null;
      }
      gameResetHoldTimeoutRef.current = null;
    }, GAME_RESET_HOLD_MS);
  };

  const cancelGameResetHold = (): void => {
    if (gameResetHoldTimeoutRef.current) {
      window.clearTimeout(gameResetHoldTimeoutRef.current);
      gameResetHoldTimeoutRef.current = null;
    }
    if (gameResetHoldTickRef.current) {
      window.clearInterval(gameResetHoldTickRef.current);
      gameResetHoldTickRef.current = null;
    }
    gameResetHoldStartedAtRef.current = null;
    setGameResetHoldProgress(0);
    setGameResetHoldRemainingMs(GAME_RESET_HOLD_MS);
  };

  const futureStepHints = (() => {
    switch (state.phase) {
      case "round-running:standby":
        return ["Toss-up Active"];
      case "tossup:active":
        return ["Toss-up Review", "Answer Eligible (timeout)"];
      case "tossup:review":
        return ["Answer Eligible (toss-up)", "Toss-up Active (other team)"];
      case "answer:eligible":
        return ["Answer Revealed"];
      case "answer:revealed":
        return state.postAnswerTarget === "followup-standby"
          ? ["Follow-up Standby", "Follow-up Active"]
          : ["Round Standby", "Toss-up Active"];
      case "followup:standby":
        return ["Follow-up Active"];
      case "followup:active-open":
        return ["Follow-up Review", "Answer Eligible (timeout)"];
      case "followup:review":
        return ["Answer Eligible", "Follow-up Active (switch)"];
      case "followup:active-claimed-left":
      case "followup:active-claimed-right":
        return ["Answer Eligible", "Claim Switch"];
      default:
        return ["No branch actions"];
    }
  })();

  const phaseLabel = state.phase.replace(/:/g, " ");

  return (
    <main className="control-shell">
      <header className="topbar">
        <h1>Scoreboard Control</h1>
        <div className="tab-row">
          <button className={activeTab === "live" ? "active" : ""} onClick={() => setActiveTab("live")}>Live</button>
          <button className={activeTab === "setup" ? "active" : ""} onClick={() => setActiveTab("setup")}>Setup</button>
        </div>
      </header>

      {activeTab === "live" ? (
        <section className="live-layout">
          <div className="left-column">
            <section className="compact-strip panel">
              <div
                className={[
                  "mini-timer",
                  state.roundTimer.secondsRemaining > 0 && state.roundTimer.secondsRemaining <= 10
                    ? "critical"
                    : state.roundTimer.secondsRemaining > 0 && state.roundTimer.secondsRemaining <= 60
                      ? "warning"
                      : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p>Round</p>
                <h2>{displayTimer(state.roundTimer.secondsRemaining, roundPaused)}</h2>
              </div>
              <div
                className={[
                  "mini-timer",
                  state.questionTimer.secondsRemaining > 0 && state.questionTimer.secondsRemaining <= 10 ? "critical" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <p>Question</p>
                <h2>{displayTimer(state.questionTimer.secondsRemaining, questionPaused)}</h2>
              </div>
              <article className="mini-score">
                <h3>{state.leftTeam.name}</h3>
                <div className="score-line">
                  <strong>{state.leftTeam.score}</strong>
                  <span>
                    <button onClick={() => changeScore("left", 1)}>+1</button>
                    <button onClick={() => changeScore("left", -1)}>-1</button>
                    <button
                      className={state.claimOwner === "left" ? "claim-btn active" : "claim-btn"}
                      onClick={() => toggleManualClaim("left")}
                    >
                      Claim
                    </button>
                  </span>
                </div>
              </article>
              <article className="mini-score">
                <h3>{state.rightTeam.name}</h3>
                <div className="score-line">
                  <strong>{state.rightTeam.score}</strong>
                  <span>
                    <button onClick={() => changeScore("right", 1)}>+1</button>
                    <button onClick={() => changeScore("right", -1)}>-1</button>
                    <button
                      className={state.claimOwner === "right" ? "claim-btn active" : "claim-btn"}
                      onClick={() => toggleManualClaim("right")}
                    >
                      Claim
                    </button>
                  </span>
                </div>
              </article>
            </section>

            <section className="presenter-layout">
              <article className="panel presenter-panel">
                <p className="label">Projector Controls</p>
                <div className="global-controls projector-controls">
                  <button onClick={() => projectionAction("projection:open")}>Open Projector</button>
                  <button onClick={() => projectionAction("projection:refresh")}>Refresh Projector</button>
                  <button
                    className="reveal-hold hold-close-projector"
                    onMouseDown={beginProjectorCloseHold}
                    onMouseUp={cancelProjectorCloseHold}
                    onMouseLeave={cancelProjectorCloseHold}
                    onTouchStart={beginProjectorCloseHold}
                    onTouchEnd={cancelProjectorCloseHold}
                    onTouchCancel={cancelProjectorCloseHold}
                  >
                    <span
                      className="hold-fill"
                      style={{ transform: `scaleX(${projectorCloseHoldProgress})` }}
                    />
                    <span className="hold-label">
                      HOLD TO CLOSE PROJECTOR ({(projectorCloseHoldRemainingMs / 1000).toFixed(2)}s)
                    </span>
                  </button>
                </div>
              </article>

              <article className="panel presenter-panel">
                <p className="label">Global Game Controls</p>
                <div className="global-controls game-controls">
                  <button
                    className={state.roundTimer.running ? "round-toggle-btn pause-mode" : "round-toggle-btn start-mode"}
                    onClick={() => send({ type: "round:toggle" })}
                    disabled={!gameLoaded}
                  >
                    {state.roundTimer.running ? "Pause Round" : "Start Round"}
                  </button>
                  <button onClick={() => send({ type: "question:toggle-pause" })}>Pause/Resume Q Timer</button>
                  <button onClick={() => send({ type: "question:reset" })}>Reset Standby</button>
                </div>
              </article>

              <article className="panel presenter-panel">
                <p className="label">State Controls</p>
                <div className="transition-graph">
                  <div className="graph-col">
                    <p className="label">Just Selected</p>
                    <div className="sequence-card previous">{lastActionLabel}</div>
                    <p className="hint">State: {phaseLabel}</p>
                  </div>
                  <div className="graph-arrow">→</div>
                  <div className="graph-col">
                    <p className="label">Buttons Available Now</p>
                    <div className="choices-stack">
                      {liveActions.map((action) => (
                        action.requiresHold ? (
                          <button
                            key={action.key}
                            className={[
                              "primary action-btn reveal-hold",
                              action.holdKind === "reveal" ? "caution" : "",
                              activeActionKey === action.key ? "pulse" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onMouseDown={() =>
                              action.holdKind === "reveal" ? beginRevealHold() : beginActionHold(action)
                            }
                            onMouseUp={action.holdKind === "reveal" ? cancelRevealHold : cancelActionHold}
                            onMouseLeave={action.holdKind === "reveal" ? cancelRevealHold : cancelActionHold}
                            onTouchStart={() =>
                              action.holdKind === "reveal" ? beginRevealHold() : beginActionHold(action)
                            }
                            onTouchEnd={action.holdKind === "reveal" ? cancelRevealHold : cancelActionHold}
                            onTouchCancel={action.holdKind === "reveal" ? cancelRevealHold : cancelActionHold}
                            disabled={!gameLoaded}
                          >
                            <span
                              className="hold-fill"
                              style={{
                                transform: `scaleX(${
                                  action.holdKind === "reveal"
                                    ? revealHoldProgress
                                    : actionHoldKey === action.key
                                      ? actionHoldProgress
                                      : 0
                                })`
                              }}
                            />
                            <span className="hold-label">
                              {action.label} (
                              {(
                                (
                                  action.holdKind === "reveal"
                                    ? revealHoldRemainingMs
                                    : actionHoldKey === action.key
                                      ? actionHoldRemainingMs
                                      : REVEAL_HOLD_MS
                                ) / 1000
                              ).toFixed(2)}
                              s)
                            </span>
                          </button>
                        ) : (
                          <button
                            key={action.key}
                            className={[
                              action.primary ? "primary action-btn" : "action-btn",
                              action.danger ? "danger" : "",
                              activeActionKey === action.key ? "pulse" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => runAction(action)}
                            disabled={!gameLoaded}
                          >
                            {action.label}
                          </button>
                        )
                      ))}
                      {liveActions.length === 0 ? (
                        <div className="sequence-card current">No branch actions right now</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="graph-arrow">→</div>
                  <div className="graph-col">
                    <p className="label">Likely After</p>
                    <div className="future-list">
                      {futureStepHints.map((hint) => (
                        <div key={hint} className="sequence-card future">{hint}</div>
                      ))}
                    </div>
                    <p className="next">Next on screen: {nextFlowStep}</p>
                  </div>
                </div>

                {!gameLoaded ? (
                  <p className="warning-inline">Upload a game .tex file in Setup before starting Live.</p>
                ) : (
                  <p className="ok-inline">Loaded: {uploadedFileName || `${rounds.length} rounds`}</p>
                )}
              </article>
            </section>

            <section className="panel reset-panel">
              <p className="label">Game Reset</p>
              <button
                className="reveal-hold reset-hold-btn"
                onMouseDown={beginGameResetHold}
                onMouseUp={cancelGameResetHold}
                onMouseLeave={cancelGameResetHold}
                onTouchStart={beginGameResetHold}
                onTouchEnd={cancelGameResetHold}
                onTouchCancel={cancelGameResetHold}
                disabled={!gameLoaded}
              >
                <span className="hold-fill" style={{ transform: `scaleX(${gameResetHoldProgress})` }} />
                <span className="hold-label">
                  HOLD TO FULL RESET ({(gameResetHoldRemainingMs / 1000).toFixed(2)}s)
                </span>
              </button>
              <p className="hint">Resets scores/timers/state to pregame. Loaded question file stays in memory.</p>
            </section>
          </div>

          <aside className="right-column panel">
            <p className="label">Questions Queue</p>
            <div className="queue-list">
              {rounds.map((round, index) => (
                <button
                  key={round.id}
                  className={index === currentRoundIndex ? "queue-item active" : "queue-item"}
                  onClick={() => setSelectedRoundIndex(index)}
                >
                  <strong>{round.title}</strong>
                  <span>Toss-up: {round.tossup.slice(0, 80)}</span>
                  <span>Follow-up: {round.followup.slice(0, 80)}</span>
                </button>
              ))}
            </div>
            <div className="queue-actions">
              <button
                onClick={() => setSelectedRoundIndex((prev) => Math.max(0, prev - 1))}
                disabled={!gameLoaded}
              >
                Previous
              </button>
              <button
                onClick={() => setSelectedRoundIndex((prev) => Math.min(rounds.length - 1, prev + 1))}
                disabled={!gameLoaded}
              >
                Next
              </button>
              <button className="primary" onClick={() => setActiveTab("setup")}>Open Setup</button>
            </div>
            {selectedRound ? (
              <div className="queue-preview">
                <p><strong>{selectedRound.title}</strong></p>
                <p><strong>Toss-up:</strong> {selectedRound.tossup}</p>
                <p><strong>Toss-up Ans:</strong> {selectedRound.tossupAnswer}</p>
                <p><strong>Follow-up:</strong> {selectedRound.followup}</p>
                <p><strong>Follow-up Ans:</strong> {selectedRound.followupAnswer}</p>
              </div>
            ) : (
              <div className="queue-preview">
                <p>No rounds loaded yet.</p>
              </div>
            )}
          </aside>
        </section>
      ) : (
        <section className="setup-layout panel">
          <h2>Setup</h2>
          <div className="setup-grid">
            <div>
              <label>Left Team</label>
              <input
                value={setup.leftTeamName}
                onChange={(event) => setSetup((prev) => ({ ...prev, leftTeamName: event.target.value }))}
              />
            </div>
            <div>
              <label>Right Team</label>
              <input
                value={setup.rightTeamName}
                onChange={(event) => setSetup((prev) => ({ ...prev, rightTeamName: event.target.value }))}
              />
            </div>
            <div>
              <label>Round Seconds</label>
              <input
                type="number"
                value={setup.roundLengthSeconds}
                onChange={(event) =>
                  setSetup((prev) => ({ ...prev, roundLengthSeconds: Number(event.target.value) }))
                }
              />
            </div>
            <div>
              <label>Warning Seconds</label>
              <input
                type="number"
                value={setup.warningThresholdSeconds}
                onChange={(event) =>
                  setSetup((prev) => ({ ...prev, warningThresholdSeconds: Number(event.target.value) }))
                }
              />
            </div>
            <div>
              <label>Toss-up Seconds</label>
              <input
                type="number"
                value={setup.tossupLengthSeconds}
                onChange={(event) =>
                  setSetup((prev) => ({ ...prev, tossupLengthSeconds: Number(event.target.value) }))
                }
              />
            </div>
            <div>
              <label>Follow-up Seconds</label>
              <input
                type="number"
                value={setup.followupLengthSeconds}
                onChange={(event) =>
                  setSetup((prev) => ({ ...prev, followupLengthSeconds: Number(event.target.value) }))
                }
              />
            </div>
          </div>
          <button className="primary" onClick={() => send({ type: "setup:apply", payload: setup })}>
            Apply Setup
          </button>

          <h3>Game .tex File</h3>
          <p className="hint">
            Download template, fill rounds, then upload. One round contains toss-up + toss-up answer + follow-up + follow-up answer.
          </p>
          <div className="queue-actions">
            <button onClick={downloadTemplate}>Download Template</button>
            <label className="file-btn">
              Upload .tex
              <input
                type="file"
                accept=".tex,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleTexFile(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button className="primary" onClick={() => setActiveTab("live")}>Go To Live</button>
          </div>
          <p className="ok-inline">{uploadedFileName ? `Loaded ${uploadedFileName} (${rounds.length} rounds).` : "No game file loaded."}</p>
          {uploadError ? <p className="warning-inline">{uploadError}</p> : null}
        </section>
      )}

      {showUploadModal && !gameLoaded ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>Upload Game .tex Before Beginning</h2>
            <p>
              The game queue is round-based. Download the template, fill your rounds, and upload the `.tex` file.
            </p>
            <div className="queue-actions">
              <button onClick={downloadTemplate}>Download Template</button>
              <label className="file-btn">
                Upload .tex
                <input
                  type="file"
                  accept=".tex,text/plain"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleTexFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button onClick={() => setActiveTab("setup")}>Open Setup Tab</button>
            </div>
            {uploadError ? <p className="warning-inline">{uploadError}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
