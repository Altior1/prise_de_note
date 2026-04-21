// Pont sécurisé entre le renderer (vue/) et le main.
// On n'expose PAS ipcRenderer directement : seule cette surface restreinte
// (list/get/create/update/remove) est accessible au renderer via window.notes.
// Toute nouvelle opération doit être ajoutée ici ET dans main.js::registerNotesIpc.

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("notes", {
  list: () => ipcRenderer.invoke("notes:list"),
  get: (id) => ipcRenderer.invoke("notes:get", id),
  // Destructuration : on ne transmet que title/content, même si le renderer
  // passe un objet avec d'autres champs — défense en profondeur côté preload.
  create: ({ title, content } = {}) =>
    ipcRenderer.invoke("notes:create", { title, content }),
  update: (id, patch) => ipcRenderer.invoke("notes:update", id, patch),
  remove: (id) => ipcRenderer.invoke("notes:delete", id),
});

// Même règle que window.notes : surface restreinte, ipcRenderer jamais exposé brut.
contextBridge.exposeInMainWorld("settings", {
  getNotesDir: () => ipcRenderer.invoke("settings:getNotesDir"),
  openNotesDir: () => ipcRenderer.invoke("settings:openNotesDir"),
  pickNotesDir: () => ipcRenderer.invoke("settings:pickNotesDir"),
  setNotesDir: (payload) => ipcRenderer.invoke("settings:setNotesDir", payload),
  // Abonnement one-way au changement de dossier. Retourne une fonction
  // unsubscribe : le renderer peut se désabonner sans exposer ipcRenderer.
  onNotesDirChanged: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on("notes-dir-changed", listener);
    return () => ipcRenderer.removeListener("notes-dir-changed", listener);
  },
});
