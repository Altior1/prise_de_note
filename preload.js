import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("notes", {
  list: () => ipcRenderer.invoke("notes:list"),
  get: (id) => ipcRenderer.invoke("notes:get", id),
  create: ({ title, content } = {}) =>
    ipcRenderer.invoke("notes:create", { title, content }),
  update: (id, patch) => ipcRenderer.invoke("notes:update", id, patch),
  remove: (id) => ipcRenderer.invoke("notes:delete", id),
});
