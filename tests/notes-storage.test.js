/**
 * @jest-environment node
 */
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createStorage } from "../lib/notes-storage.js";

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "notes-storage-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("notes-storage", () => {
  test("create écrit un fichier et retourne la note", async () => {
    const storage = createStorage(tmpDir);
    const note = await storage.create({
      title: "Mes courses",
      content: "Lait",
    });

    expect(note.id).toMatch(/^[a-f0-9]{10}$/);
    expect(note.title).toBe("Mes courses");
    expect(note.content).toBe("Lait");
    expect(note.filename).toMatch(/^mes-courses-[a-f0-9]{10}\.md$/);
    expect(note.createdAt).toBe(note.updatedAt);

    const files = await fs.readdir(tmpDir);
    expect(files).toContain(note.filename);
  });

  test("read retourne une note précédemment créée", async () => {
    const storage = createStorage(tmpDir);
    const created = await storage.create({ title: "Titre", content: "Body" });
    const found = await storage.read(created.id);

    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.title).toBe("Titre");
    expect(found.content).toBe("Body");
  });

  test("read sur un id inconnu retourne null", async () => {
    const storage = createStorage(tmpDir);
    expect(await storage.read("inconnu")).toBeNull();
  });

  test("list retourne toutes les notes", async () => {
    const storage = createStorage(tmpDir);
    await storage.create({ title: "Un", content: "1" });
    await storage.create({ title: "Deux", content: "2" });

    const { notes, invalidFiles } = await storage.list();
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.title).sort()).toEqual(["Deux", "Un"]);
    expect(invalidFiles).toEqual([]);
  });

  test("list renvoie un tableau vide invalidFiles quand tout va bien", async () => {
    const storage = createStorage(tmpDir);
    await storage.create({ title: "Seule", content: "x" });

    const { notes, invalidFiles } = await storage.list();
    expect(notes).toHaveLength(1);
    expect(invalidFiles).toEqual([]);
  });

  test("list skippe un fichier avec YAML cassé", async () => {
    const storage = createStorage(tmpDir);
    await storage.create({ title: "Un", content: "1" });
    await storage.create({ title: "Deux", content: "2" });
    const brokenFilename = "casse-aaaaaaaaaa.md";
    await fs.writeFile(
      path.join(tmpDir, brokenFilename),
      "---\nid: [unclosed\ntitle: cassé\n---\nbody",
      "utf-8",
    );

    const { notes, invalidFiles } = await storage.list();
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.title).sort()).toEqual(["Deux", "Un"]);
    expect(invalidFiles).toHaveLength(1);
    expect(invalidFiles[0].filename).toBe(brokenFilename);
    expect(typeof invalidFiles[0].error).toBe("string");
    expect(invalidFiles[0].error.length).toBeGreaterThan(0);
  });

  test("list ne throw pas si tous les fichiers sont cassés", async () => {
    const storage = createStorage(tmpDir);
    await fs.writeFile(
      path.join(tmpDir, "broken-1.md"),
      "---\nid: [bad\n---\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(tmpDir, "broken-2.md"),
      "---\n: pas: de: clé\n---\n",
      "utf-8",
    );

    const { notes, invalidFiles } = await storage.list();
    expect(notes).toEqual([]);
    expect(invalidFiles).toHaveLength(2);
    expect(invalidFiles.map((e) => e.filename).sort()).toEqual([
      "broken-1.md",
      "broken-2.md",
    ]);
  });

  test("findFilenameById ignore les fichiers corrompus dans le fallback", async () => {
    const storage = createStorage(tmpDir);
    const created = await storage.create({ title: "Valide", content: "ok" });
    // On casse le fast-path en renommant vers un nom qui ne se termine pas par
    // `-<id>.md`, pour forcer le fallback qui lit le frontmatter.
    const renamed = "mysterious.md";
    await fs.rename(
      path.join(tmpDir, created.filename),
      path.join(tmpDir, renamed),
    );
    await fs.writeFile(
      path.join(tmpDir, "broken.md"),
      "---\nid: [bad\n---\n",
      "utf-8",
    );

    const found = await storage.read(created.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.title).toBe("Valide");
    expect(await storage.read("inconnu")).toBeNull();
  });

  test("update modifie les champs et rafraîchit updatedAt", async () => {
    const storage = createStorage(tmpDir);
    const created = await storage.create({ title: "T", content: "old" });
    await new Promise((r) => setTimeout(r, 10));

    const updated = await storage.update(created.id, { content: "new" });
    expect(updated.content).toBe("new");
    expect(updated.title).toBe("T");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
  });

  test("update conserve le même nom de fichier même si le titre change", async () => {
    const storage = createStorage(tmpDir);
    const created = await storage.create({ title: "Premier", content: "x" });
    const updated = await storage.update(created.id, {
      title: "Tout autre titre",
    });

    expect(updated.filename).toBe(created.filename);
    const files = await fs.readdir(tmpDir);
    expect(files).toEqual([created.filename]);
  });

  test("update sur un id inconnu retourne null", async () => {
    const storage = createStorage(tmpDir);
    expect(await storage.update("inconnu", { title: "X" })).toBeNull();
  });

  test("remove supprime le fichier", async () => {
    const storage = createStorage(tmpDir);
    const created = await storage.create({ title: "T", content: "x" });

    expect(await storage.remove(created.id)).toBe(true);
    expect(await storage.read(created.id)).toBeNull();
    const files = await fs.readdir(tmpDir);
    expect(files).toHaveLength(0);
  });

  test("remove sur un id inconnu retourne false", async () => {
    const storage = createStorage(tmpDir);
    expect(await storage.remove("inconnu")).toBe(false);
  });

  test("les notes survivent à la réouverture du stockage", async () => {
    const storage1 = createStorage(tmpDir);
    const created = await storage1.create({
      title: "Persiste",
      content: "Toujours là",
    });

    const storage2 = createStorage(tmpDir);
    const found = await storage2.read(created.id);
    expect(found).not.toBeNull();
    expect(found.title).toBe("Persiste");
    expect(found.content).toBe("Toujours là");
  });

  test("le frontmatter contient les métadonnées attendues", async () => {
    const storage = createStorage(tmpDir);
    const created = await storage.create({
      title: "Avec YAML",
      content: "Body",
    });
    const text = await fs.readFile(
      path.join(tmpDir, created.filename),
      "utf-8",
    );

    expect(text.startsWith("---")).toBe(true);
    expect(text).toContain(`id: ${created.id}`);
    expect(text).toContain("title: Avec YAML");
    expect(text).toContain("createdAt:");
    expect(text).toContain("updatedAt:");
    expect(text).toContain("Body");
  });

  test("les caractères spéciaux du titre sont slugifiés proprement", async () => {
    const storage = createStorage(tmpDir);
    const note = await storage.create({
      title: "Projet: notes/app!",
      content: "",
    });
    expect(note.filename).toMatch(/^projet-notes-app-[a-f0-9]{10}\.md$/);
  });

  test("un titre vide génère un slug par défaut", async () => {
    const storage = createStorage(tmpDir);
    const note = await storage.create({ title: "", content: "" });
    expect(note.filename).toMatch(/^note-[a-f0-9]{10}\.md$/);
  });

  test("les accents sont retirés du slug", async () => {
    const storage = createStorage(tmpDir);
    const note = await storage.create({
      title: "Idée à noter",
      content: "",
    });
    expect(note.filename).toMatch(/^idee-a-noter-[a-f0-9]{10}\.md$/);
  });

  test("une écriture atomique ne laisse pas de fichier .tmp en cas de succès", async () => {
    const storage = createStorage(tmpDir);
    await storage.create({ title: "T", content: "x" });
    const files = await fs.readdir(tmpDir);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });
});
