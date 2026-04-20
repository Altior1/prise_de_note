// Stockage des notes en fichiers Markdown avec frontmatter YAML.
// Module pur : prend le dossier de notes en paramètre, aucune dépendance Electron.

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import matter from "gray-matter";

function generateId() {
  return crypto.randomBytes(5).toString("hex");
}

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
    content: content.replace(/^\n+/, "").replace(/\n+$/, ""),
    filename,
  };
}

async function atomicWrite(filePath, content) {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
}

export function createStorage(notesDir) {
  async function ensureDir() {
    await fs.mkdir(notesDir, { recursive: true });
  }

  async function listFilenames() {
    await ensureDir();
    const entries = await fs.readdir(notesDir);
    return entries.filter((f) => f.endsWith(".md"));
  }

  async function findFilenameById(id) {
    const filenames = await listFilenames();
    const fastMatch = filenames.find((f) => f.endsWith(`-${id}.md`));
    if (fastMatch) return fastMatch;
    for (const fn of filenames) {
      const text = await fs.readFile(path.join(notesDir, fn), "utf-8");
      const { data } = matter(text);
      if (data.id === id) return fn;
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
    for (const fn of filenames) {
      const text = await fs.readFile(path.join(notesDir, fn), "utf-8");
      notes.push(parseNote(text, fn));
    }
    return notes;
  }

  async function update(id, patch = {}) {
    const existing = await read(id);
    if (!existing) return null;
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
