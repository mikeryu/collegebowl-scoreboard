import type { AppCommand, AppState } from "./types";

export const IPC_CHANNELS = {
  getState: "scoreboard:get-state",
  command: "scoreboard:command",
  stateSync: "scoreboard:state-sync"
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface ScoreboardAPI {
  getState: () => Promise<AppState>;
  sendCommand: (command: AppCommand) => void;
  onStateSync: (callback: (state: AppState) => void) => () => void;
}
