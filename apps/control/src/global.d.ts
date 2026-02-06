import type { ScoreboardAPI } from "@scoreboard/shared";

declare global {
  interface Window {
    scoreboardAPI?: ScoreboardAPI;
  }
}

export {};
