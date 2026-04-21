// Stockage des notes en fichiers Markdown avec frontmatter YAML.
// Module pur : prend le dossier de notes en paramètre, aucune dépendance Electron
// (permet les tests en env node sans booter Electron).
//
// Format sur disque : un fichier .md par note, nom "<slug-titre>-<id>.md".
// Le frontmatter porte id/title/createdAt/updatedAt ; le body est le contenu.

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import matter from "gray-matter";

// 10 hex chars = 40 bits d'entropie : largement suffisant pour des notes locales
// et assez court pour rester lisible dans le nom de fichier.
// va etre appele pour generer l'id du fichier.
function generateId() {
  return crypto.randomBytes(5).toString("hex");
}

// Transforme un titre en chaîne utilisable dans un nom de fichier :
// - retire les accents (NFD + suppression des diacritiques)
// - remplace tout caractère non [a-z0-9] par un tiret
// - tronque à 60 car pour éviter des chemins trop longs sur Windows
// - "note" par défaut si le titre est vide
function slugify(title) {
  const slug = (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "note";
}

function makeFilename(title, id) {
  return `${slugify(title)}-${id}.md`;
}

// gray-matter renvoie parfois un Date (quand YAML parse une date ISO),
// parfois une string — on force toujours une ISO string côté sortie.
function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializeNote({ id, title, createdAt, updatedAt, content }) {
  return matter.stringify(content || "", {
    id,
    title: title || "",
    createdAt,
    updatedAt,
  });
}

function parseNote(text, filename) {
  const { data, content } = matter(text);
  return {
    id: data.id,
    title: data.title || "",
    createdAt: normalizeDate(data.createdAt),
    updatedAt: normalizeDate(data.updatedAt),
    // gray-matter conserve les \n autour du body — on trim pour éviter qu'ils
    // s'accumulent à chaque save/load.
    content: content.replace(/^\n+/, "").replace(/\n+$/, ""),
    filename,
  };
}

// Écriture atomique : on écrit d'abord dans un .tmp puis on rename.
// rename() est atomique sur un même filesystem → pas de fichier à moitié
// écrit visible si l'app crashe en cours de save.
async function atomicWrite(filePath, content) {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

// Factory : isole le dossier de notes pour faciliter les tests (dossier temp)
// et éviter un état global partagé.
export function createStorage(notesDir) {
  async function ensureDir() {
    await fs.mkdir(notesDir, { recursive: true });
  }

  async function listFilenames() {
    await ensureDir();
    const entries = await fs.readdir(notesDir);
    return entries.filter((f) => f.endsWith(".md"));
  }

  // Deux stratégies :
  // 1) fast-path : le nom de fichier contient `-<id>.md` → match direct.
  // 2) fallback : lire le frontmatter (cas où un fichier a été renommé à la
  //    main, l'id dans le YAML reste la source de vérité).
  async function findFilenameById(id) {
    const filenames = await listFilenames();
    const fastMatch = filenames.find((f) => f.endsWith(`-${id}.md`));
    if (fastMatch) return fastMatch;
    for (const fn of filenames) {
      // Un fichier corrompu ne doit pas casser la recherche par id.
      try {
        const text = await fs.readFile(path.join(notesDir, fn), "utf-8");
        const { data } = matter(text);
        if (data.id === id) return fn;
      } catch {
        continue;
      }
    }
    return null;
  }

  async function create({ title = "", content = "" } = {}) {
    await ensureDir();
    const id = generateId();
    const now = new Date().toISOString();
    const note = { id, title, content, createdAt: now, updatedAt: now };
    const filename = makeFilename(title, id);
    await atomicWrite(path.join(notesDir, filename), serializeNote(note));
    return { ...note, filename };
  }

  async function read(id) {
    const filename = await findFilenameById(id);
    if (!filename) return null;
    const text = await fs.readFile(path.join(notesDir, filename), "utf-8");
    return parseNote(text, filename);
  }

  async function list() {
    const filenames = await listFilenames();
    const notes = [];
    const invalidFiles = [];
    // Lecture séquentielle — suffisant pour des volumes modestes (<100 notes).
    // Si la volumétrie grossit, passer à Promise.all(filenames.map(...)).
    for (const fn of filenames) {
      // Un fichier corrompu (YAML cassé, permission, disparu entre readdir et
      // readFile) ne doit pas casser la liste entière — on l'isole et on continue.
      try {
        const text = await fs.readFile(path.join(notesDir, fn), "utf-8");
        notes.push(parseNote(text, fn));
      } catch (err) {
        invalidFiles.push({ filename: fn, error: err?.message ?? String(err) });
      }
    }
    return { notes, invalidFiles };
  }

  async function update(id, patch = {}) {
    const existing = await read(id);
    if (!existing) return null;
    // patch partiel : on garde la valeur existante si le champ est absent.
    // Note : le nom de fichier n'est PAS régénéré si le titre change, pour
    // préserver la stabilité des chemins (cf. test associé).
    const updated = {
      ...existing,
      title: patch.title !== undefined ? patch.title : existing.title,
      content: patch.content !== undefined ? patch.content : existing.content,
      updatedAt: new Date().toISOString(),
    };
    await atomicWrite(
      path.join(notesDir, existing.filename),
      serializeNote(updated),
    );
    return updated;
  }

  async function remove(id) {
    const filename = await findFilenameById(id);
    if (!filename) return false;
    await fs.unlink(path.join(notesDir, filename));
    return true;
  }

  return { create, read, update, remove, list };
}
