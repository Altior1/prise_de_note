import { app, BrowserWindow, ipcMain } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createStorage } from "./lib/notes-storage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let storage;

function sanitizeString(v) {
  return typeof v === "string" ? v : "";
}

function sanitizeId(v) {
  return typeof v === "string" ? v : "";
}

function sanitizePayload(p) {
  const src = p && typeof p === "object" ? p : {};
  return {
    title: sanitizeString(src.title),
    content: sanitizeString(src.content),
  };
}

function sanitizePatch(p) {
  const src = p && typeof p === "object" ? p : {};
  const out = {};
  if (typeof src.title === "string") out.title = src.title;
  if (typeof src.content === "string") out.content = src.content;
  return out;
}

function registerNotesIpc() {
  ipcMain.handle("notes:list", () => storage.list());
  ipcMain.handle("notes:get", (_e, id) => storage.read(sanitizeId(id)));
  ipcMain.handle("notes:create", (_e, payload) =>
    storage.create(sanitizePayload(payload)),
  );
  ipcMain.handle("notes:update", (_e, id, patch) =>
    storage.update(sanitizeId(id), sanitizePatch(patch)),
  );
  ipcMain.handle("notes:delete", (_e, id) => storage.remove(sanitizeId(id)));
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("vue/accueil.html");
};

app.whenReady().then(() => {
  const notesDir = path.join(app.getPath("userData"), "notes");
  storage = createStorage(notesDir);
  registerNotesIpc();
  createWindow();
});
