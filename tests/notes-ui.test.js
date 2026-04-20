/**
 * @jest-environment node
 * @file tests/notes-ui.test.js
 * Test d'intégration pour vue/script/notes-ui.js
 * Vérifie l'affichage et la création de notes dans le DOM.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function flush() {
  await new Promise((r) => setTimeout(r, 10));
}

describe("notes-ui.js (intégration DOM)", () => {
  let dom;
  let window;
  let document;
  let notesMock;
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(
      path.resolve(__dirname, "../vue/script/notes-ui.js"),
      "utf-8",
    );
  });

  beforeEach(() => {
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html lang="fr">
        <body>
          <form id="note-form">
            <input type="text" id="note-title" name="note-title" required />
            <textarea id="note-content" name="note-content" required></textarea>
            <button type="submit">Créer la note</button>
          </form>
          <ul id="notes-list"></ul>
        </body>
      </html>
    `,
      { runScripts: "dangerously", resources: "usable" },
    );

    window = dom.window;
    document = window.document;

    let notesData = [
      {
        id: "aaaaaaaaaa",
        title: "Note initiale",
        content: "Contenu de départ",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    notesMock = {
      list: jest.fn(async () => notesData.slice()),
      create: jest.fn(async ({ title, content }) => {
        const note = {
          id: `id${notesData.length + 1}`,
          title,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        notesData.push(note);
        return note;
      }),
      get: jest.fn(async (id) => notesData.find((n) => n.id === id) ?? null),
      update: jest.fn(),
      remove: jest.fn(),
    };

    window.notes = notesMock;

    const scriptEl = document.createElement("script");
    scriptEl.textContent = scriptContent;
    document.body.appendChild(scriptEl);
  });

  afterEach(() => {
    window.close();
    jest.clearAllMocks();
  });

  test("affiche la note initiale au chargement", async () => {
    await flush();
    const notesList = document.getElementById("notes-list");
    expect(notesMock.list).toHaveBeenCalled();
    expect(notesList.children.length).toBe(1);
    expect(notesList.textContent).toContain("Note initiale");
    expect(notesList.textContent).toContain("Contenu de départ");
  });

  test("crée une nouvelle note via le formulaire et met à jour la liste", async () => {
    await flush();

    const form = document.getElementById("note-form");
    const titleInput = document.getElementById("note-title");
    const contentInput = document.getElementById("note-content");
    const notesList = document.getElementById("notes-list");

    titleInput.value = "Nouvelle note";
    contentInput.value = "Texte de test";

    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();

    expect(notesMock.create).toHaveBeenCalledWith({
      title: "Nouvelle note",
      content: "Texte de test",
    });

    expect(notesList.children.length).toBe(2);
    expect(notesList.textContent).toContain("Nouvelle note");
    expect(notesList.textContent).toContain("Texte de test");
  });

  test("reset le formulaire après création", async () => {
    await flush();

    const form = document.getElementById("note-form");
    const titleInput = document.getElementById("note-title");
    const contentInput = document.getElementById("note-content");

    titleInput.value = "Titre";
    contentInput.value = "Contenu";
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();

    expect(titleInput.value).toBe("");
    expect(contentInput.value).toBe("");
  });
});
