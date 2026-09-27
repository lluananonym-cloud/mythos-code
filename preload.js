const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mythos", {
  getCfg: () => ipcRenderer.invoke("cfg:get"), setCfg: (c) => ipcRenderer.invoke("cfg:set", c),
  open: (u) => ipcRenderer.invoke("open", u), pickFolder: () => ipcRenderer.invoke("pickFolder"),
  pickFiles: () => ipcRenderer.invoke("pickFiles"), tool: (t, cwd) => ipcRenderer.invoke("tool", t, cwd),
});
