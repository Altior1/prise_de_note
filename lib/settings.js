// Stockage du settings.json de l'application (dossier de notes, etc.).
// Deux fonctions pures qui prennent le chemin en paramètre — pas de factory,
// pas d'état de module. Appelé 1-2 fois par session seulement.

import fs from "fs/promises";
import path from "path";

// schemaVersion est posé dès maintenant pour préparer de futures migrations :
// on force toujours la valeur courante en sortie, même si le fichier ou le
// patch contiennent autre chose, tant qu'aucune logique de migration n'existe.
const DEFAULTS = Object.freeze({ schemaVersion: 1, notesDir: null });

function defaults() {
  return { ...DEFAULTS };
}

async function atomicWrite(filePath, content) {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

export async function readSettings(filePath) {
  if (typeof filePath !== "string") {
    throw new TypeError("readSettings: filePath doit être une string");
  }

  let raw;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return defaults();
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // On log pour aider au debug mais on ne touche pas au disque :
    // l'utilisateur peut encore corriger son fichier à la main avant qu'un
    // writeSettings explicite ne l'écrase.
    console.warn(
      `settings: JSON corrompu à ${filePath} (${err.message}), utilisation des valeurs par défaut en mémoire`,
    );
    return defaults();
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.warn(
      `settings: contenu inattendu à ${filePath} (pas un objet), utilisation des valeurs par défaut en mémoire`,
    );
    return defaults();
  }

  return { ...defaults(), ...parsed, schemaVersion: 1 };
}

export async function writeSettings(filePath, patch) {
  if (typeof filePath !== "string") {
    throw new TypeError("writeSettings: filePath doit être une string");
  }
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("writeSettings: patch doit être un objet");
  }
  if (
    "notesDir" in patch &&
    patch.notesDir !== null &&
    typeof patch.notesDir !== "string"
  ) {
    throw new TypeError(
      "writeSettings: notesDir doit être une string ou null",
    );
  }

  const current = await readSettings(filePath);
  const merged = { ...current, ...patch, schemaVersion: 1 };

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWrite(filePath, JSON.stringify(merged, null, 2));

  return merged;
}
