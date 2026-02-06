const { contextBridge, ipcRenderer } = require("electron");

const IPC_CHANNELS = {
  getState: "scoreboard:get-state",
  command: "scoreboard:command",
  stateSync: "scoreboard:state-sync"
};

contextBridge.exposeInMainWorld("scoreboardAPI", {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState),
  sendCommand: (command) => ipcRenderer.send(IPC_CHANNELS.command, command),
  onStateSync: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.stateSync, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.stateSync, listener);
  }
});
