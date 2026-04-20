import * as notes from "../lib/notes.js";

describe("Module notes.js", () => {
  beforeEach(() => {
    // Reset le mock avant chaque test
    notes._resetNotes([
      {
        id: 1,
        title: "Note initiale",
        content: "Contenu de départ",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  });

  test("getAllNotes retourne toutes les notes", () => {
    const all = notes.getAllNotes();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(1);
    expect(all[0].title).toBe("Note initiale");
  });

  test("createNote ajoute une nouvelle note", () => {
    const note = notes.createNote({ title: "Nouvelle", content: "Texte" });
    expect(note.id).toBeDefined();
    expect(note.title).toBe("Nouvelle");
    expect(notes.getAllNotes().length).toBe(2);
  });

  test("getNoteById retourne la bonne note", () => {
    const note = notes.getNoteById(1);
    expect(note).not.toBeNull();
    expect(note.title).toBe("Note initiale");
  });

  test("updateNote modifie une note existante", () => {
    const updated = notes.updateNote(1, {
      title: "Modifiée",
      content: "Nouveau contenu",
    });
    expect(updated).not.toBeNull();
    expect(updated.title).toBe("Modifiée");
    expect(updated.content).toBe("Nouveau contenu");
  });

  test("deleteNote supprime une note", () => {
    const ok = notes.deleteNote(1);
    expect(ok).toBe(true);
    expect(notes.getAllNotes().length).toBe(0);
  });

  test("updateNote sur un id inconnu retourne null", () => {
    const result = notes.updateNote(999, { title: "X" });
    expect(result).toBeNull();
  });

  test("deleteNote sur un id inconnu retourne false", () => {
    const ok = notes.deleteNote(999);
    expect(ok).toBe(false);
  });
});
