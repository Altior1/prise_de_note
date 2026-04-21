// ⚠️ Module hérité (mock in-memory) — REMPLACÉ par lib/notes-storage.js.
// Conservé uniquement pour tests/notes.test.js. À supprimer au nettoyage Sprint 2.
// Ne rien câbler dessus depuis main.js / preload.js.

let notes = [
  {
    id: 1,
    title: "Bienvenue",
    content: "Ceci est votre première note.",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

// Génère un nouvel ID unique (simple auto-incrément pour le mock)
function getNextId() {
  return notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
}

// CRUD

export function getAllNotes() {
  // Retourne une copie pour éviter les mutations externes
  return notes.map((note) => ({ ...note }));
}

export function getNoteById(id) {
  return notes.find((note) => note.id === id) || null;
}

export function createNote({ title, content }) {
  const now = new Date().toISOString();
  const note = {
    id: getNextId(),
    title: title || "",
    content: content || "",
    createdAt: now,
    updatedAt: now,
  };
  notes.push(note);
  return { ...note };
}

export function updateNote(id, { title, content }) {
  const note = notes.find((n) => n.id === id);
  if (!note) return null;
  if (typeof title === "string") note.title = title;
  if (typeof content === "string") note.content = content;
  note.updatedAt = new Date().toISOString();
  return { ...note };
}

export function deleteNote(id) {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  notes.splice(idx, 1);
  return true;
}

// Pour les tests : reset le mock
export function _resetNotes(newNotes = []) {
  notes = newNotes.map((n) => ({ ...n }));
}
