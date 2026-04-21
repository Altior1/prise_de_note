// Process principal Electron.
// Rôles : créer la BrowserWindow, résoudre le stockage sur disque à partir
// du settings.json, et enregistrer les handlers IPC exposés au renderer via
// preload.js.

import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { constants as fsConstants } from "fs";
import { createStorage } from "./lib/notes-storage.js";
import { readSettings, writeSettings } from "./lib/settings.js";
import { resolveStorage } from "./lib/boot.js";

// __dirname n'existe pas en ESM — reconstitué depuis import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));

// Holder mutable : les handlers IPC lisent storageHolder.current à chaque
// invocation, ce qui permettra un hot-swap du storage quand le changement
// de dossier arrivera (ticket T03c) sans ré-enregistrer les canaux IPC.
// current peut être null si aucun notesDir n'est configuré — dans ce cas
// les handlers notes:* rejettent explicitement plutôt que de fallback
// silencieusement vers userData/notes (décision produit).
const storageHolder = { current: null };

let settingsPath;

function requireStorage() {
  if (!storageHolder.current) {
    throw new Error("Aucun dossier de notes configuré");
  }
  return storageHolder.current;
}

// --- Sanitisation des payloads reçus du renderer ---------------------------
// Le renderer est traité comme non fiable : tout ce qui traverse l'IPC est
// normalisé en types primitifs avant d'atteindre la couche de stockage.
// Cela neutralise les objets exotiques (prototype pollution, getters, etc.).

function sanitizeString(v) {
  return typeof v === "string" ? v : "";
}

function sanitizeId(v) {
  return typeof v === "string" ? v : "";
}

// create exige title + content : les champs absents deviennent "".
function sanitizePayload(p) {
  const src = p && typeof p === "object" ? p : {};
  return {
    title: sanitizeString(src.title),
    content: sanitizeString(src.content),
  };
}

// update est un patch partiel : seuls les champs string sont propagés,
// les absences sont préservées pour que le storage conserve la valeur existante.
function sanitizePatch(p) {
  const src = p && typeof p === "object" ? p : {};
  const out = {};
  if (typeof src.title === "string") out.title = src.title;
  if (typeof src.content === "string") out.content = src.content;
  return out;
}

// Les noms de canaux doivent rester synchronisés avec preload.js.
function registerNotesIpc() {
  // TODO(S2-T02): exposer invalidFiles au renderer pour le toast cumulé.
  ipcMain.handle("notes:list", async () => {
    const { notes } = await requireStorage().list();
    return notes;
  });
  ipcMain.handle("notes:get", (_e, id) =>
    requireStorage().read(sanitizeId(id)),
  );
  ipcMain.handle("notes:create", (_e, payload) =>
    requireStorage().create(sanitizePayload(payload)),
  );
  ipcMain.handle("notes:update", (_e, id, patch) =>
    requireStorage().update(sanitizeId(id), sanitizePatch(patch)),
  );
  ipcMain.handle("notes:delete", (_e, id) =>
    requireStorage().remove(sanitizeId(id)),
  );
}

// Surface IPC settings : lecture seule pour ce ticket. Le changement de
// dossier (settings:setNotesDir / settings:pickNotesDir) arrivera à T03c.
// On relit readSettings à chaque appel plutôt que de cacher en mémoire : le
// fichier peut avoir été édité à la main par l'utilisateur entre deux appels,
// et la charge est négligeable (quelques ko lus rarement).
function registerSettingsIpc() {
  ipcMain.handle("settings:getNotesDir", async () => {
    const settings = await readSettings(settingsPath);
    return settings.notesDir;
  });

  ipcMain.handle("settings:openNotesDir", async () => {
    const settings = await readSettings(settingsPath);
    if (!settings.notesDir) {
      return { ok: false, error: "Aucun dossier configuré" };
    }
    // shell.openPath renvoie "" en cas de succès, sinon un message d'erreur
    // string — on normalise en { ok, error } pour simplifier le renderer.
    const result = await shell.openPath(settings.notesDir);
    if (result === "") return { ok: true };
    return { ok: false, error: result };
  });

  ipcMain.handle("settings:pickNotesDir", async () => {
    // Ancrage sur la première fenêtre active : certaines plateformes placent
    // mal la dialog si elle n'a pas de parent.
    const win = BrowserWindow.getAllWindows()[0] ?? null;
    const options = {
      properties: ["openDirectory"],
      title: "Choisir le dossier de vos notes",
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle("settings:setNotesDir", async (_e, payload) => {
    const notesDir =
      payload && typeof payload.path === "string" ? payload.path : null;
    if (!notesDir || !path.isAbsolute(notesDir)) {
      throw new Error("Chemin invalide");
    }
    // Vérifier que le dossier existe ET est accessible en écriture avant le
    // swap : sans ça, un chemin read-only basculerait l'app dans un état où
    // la liste fonctionne mais toute création échoue silencieusement.
    const stat = await fs.stat(notesDir);
    if (!stat.isDirectory()) {
      throw new Error("Le chemin n'est pas un dossier");
    }
    await fs.access(notesDir, fsConstants.W_OK);

    storageHolder.current = createStorage(notesDir);
    await writeSettings(settingsPath, { notesDir });

    // Notifier toutes les fenêtres pour qu'elles relisent la liste et mettent
    // à jour l'affichage du chemin courant.
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send("notes-dir-changed", { notesDir });
    }

    return { notesDir };
  });
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    // Sidebar fixe 280px + ~360 pour un éditeur utilisable = 640 minimum.
    minWidth: 640,
    minHeight: 480,
    webPreferences: {
      // contextIsolation + nodeIntegration=false = renderer isolé du Node.
      // Seule l'API exposée via contextBridge dans preload.js est accessible.
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:false est obligatoire ici car preload.js est en ESM —
      // un sandbox activé impose CommonJS au preload. Ne pas réactiver
      // sans convertir preload.js en CJS.
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("vue/accueil.html");
};

app.whenReady().then(async () => {
  // userData est le dossier propre à l'app (différent en dev / packagé) —
  // garantit que settings.json survit aux mises à jour de l'app.
  settingsPath = path.join(app.getPath("userData"), "settings.json");
  const settings = await readSettings(settingsPath);
  storageHolder.current = resolveStorage(settings, { createStorage });
  registerNotesIpc();
  registerSettingsIpc();
  createWindow();
});
