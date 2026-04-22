/**
 * @jest-environment node
 * @file tests/notes-ui.test.js
 * Test d'intégration pour vue/script/notes-ui.js
 * Vérifie l'affichage, la création, la sélection, l'édition, la suppression,
 * l'état vide, la recherche, l'autosave débouncé et les toasts d'erreur.
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

function buildDom() {
  return new JSDOM(
    `
    <!DOCTYPE html>
    <html lang="fr">
      <body>
        <section id="onboarding" hidden>
          <button type="button" id="onboarding-pick">Choisir un dossier</button>
          <div id="onboarding-error" hidden></div>
        </section>
        <section id="app-main" hidden>
          <aside id="sidebar">
            <input type="search" id="notes-search" />
            <ul id="notes-list"></ul>
            <div id="search-empty" hidden></div>
            <div id="empty-state" hidden></div>
            <button type="button" id="sidebar-create"></button>
          </aside>
          <section id="editor-panel">
            <div id="detail-placeholder"></div>
            <div id="note-detail" hidden>
              <button type="button" id="detail-toggle-view" aria-label="Afficher l'aperçu"></button>
              <input type="text" id="detail-title" />
              <div class="detail-editor-stack">
                <textarea id="detail-content"></textarea>
                <article id="detail-preview" class="detail-preview"></article>
              </div>
              <div id="save-indicator"></div>
              <div class="detail-actions">
                <button type="button" id="detail-save" hidden>Enregistrer</button>
                <button type="button" id="detail-delete">Supprimer</button>
              </div>
            </div>
            <section id="settings-panel" hidden>
              <code id="settings-notes-dir"></code>
              <button type="button" id="settings-change">Changer...</button>
              <button type="button" id="settings-open">Ouvrir</button>
            </section>
          </section>
        </section>
        <div id="toast-container"></div>
      </body>
    </html>
  `,
    { runScripts: "dangerously", resources: "usable" },
  );
}

function installFakeTimers(window) {
  const pending = new Map();
  let nextId = 1;
  const realSetTimeout = window.setTimeout;
  const realClearTimeout = window.clearTimeout;
  window.setTimeout = function (cb, delay) {
    const id = nextId++;
    pending.set(id, { cb, delay, at: Date.now() });
    return id;
  };
  window.clearTimeout = function (id) {
    pending.delete(id);
  };
  return {
    pending,
    advance(ms) {
      const ids = Array.from(pending.keys());
      for (const id of ids) {
        const entry = pending.get(id);
        if (!entry) continue;
        if (entry.delay <= ms) {
          pending.delete(id);
          entry.cb();
        }
      }
    },
    restore() {
      window.setTimeout = realSetTimeout;
      window.clearTimeout = realClearTimeout;
    },
  };
}

describe("notes-ui.js (intégration DOM)", () => {
  let dom;
  let window;
  let document;
  let notesMock;
  let settingsMock;
  let notesDirChangedCb;
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(
      path.resolve(__dirname, "../vue/script/notes-ui.js"),
      "utf-8",
    );
  });

  // Pose window.settings avec des jest.fn() stubbés. initialDir = null
  // simule le cas "aucun dossier configuré" (onboarding attendu au boot).
  // Le callback passé à onNotesDirChanged est capturé dans notesDirChangedCb
  // pour permettre aux tests de le déclencher manuellement.
  function installSettingsMock(initialDir) {
    let currentDir = initialDir;
    notesDirChangedCb = null;
    settingsMock = {
      getNotesDir: jest.fn(async () => currentDir),
      pickNotesDir: jest.fn(async () => ({ canceled: true })),
      setNotesDir: jest.fn(async (payload) => {
        currentDir = payload.path;
        return { notesDir: payload.path };
      }),
      openNotesDir: jest.fn(async () => ({ ok: true })),
      onNotesDirChanged: jest.fn((cb) => {
        notesDirChangedCb = cb;
        return () => {
          notesDirChangedCb = null;
        };
      }),
    };
    window.settings = settingsMock;
  }

  function installNotesMock(initial) {
    let notesData = initial.slice();
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
      update: jest.fn(async (id, patch) => {
        const note = notesData.find((n) => n.id === id);
        if (!note) return null;
        if (typeof patch.title === "string") note.title = patch.title;
        if (typeof patch.content === "string") note.content = patch.content;
        note.updatedAt = new Date().toISOString();
        return { ...note };
      }),
      remove: jest.fn(async (id) => {
        notesData = notesData.filter((n) => n.id !== id);
        return true;
      }),
    };
    window.notes = notesMock;
  }

  function runScript() {
    const scriptEl = document.createElement("script");
    scriptEl.textContent = scriptContent;
    document.body.appendChild(scriptEl);
  }

  beforeEach(() => {
    dom = buildDom();
    window = dom.window;
    document = window.document;
    // Mock des icônes : les tests jsdom ne chargent pas icons.js (inséré via
    // <script src> dans la page réelle), on pose un AppIcons factice pour
    // que les appels renderIcon et les accès aux chaînes SVG ne plantent pas.
    window.AppIcons = {
      plusIcon: "<svg data-icon='plus'></svg>",
      trashIcon: "<svg data-icon='trash'></svg>",
      cogIcon: "<svg data-icon='cog'></svg>",
      folderIcon: "<svg data-icon='folder'></svg>",
      searchIcon: "<svg data-icon='search'></svg>",
      checkIcon: "<svg data-icon='check'></svg>",
      xIcon: "<svg data-icon='x'></svg>",
      documentPlusIcon: "<svg data-icon='document-plus'></svg>",
      eyeIcon: "<svg data-icon='eye'></svg>",
      pencilIcon: "<svg data-icon='pencil'></svg>",
      renderIcon: (container, svgString) => {
        if (container) container.innerHTML = svgString;
      },
    };
    // Stub minimaliste : on ne veut pas réimporter markdown-it + DOMPurify ici
    // (couvert par tests/markdown.test.js). Le HTML produit reste identifiable
    // pour vérifier que la preview a bien été peuplée à partir du textarea.
    window.AppMarkdown = {
      renderMarkdown: (src) => `<article class="stub">${src}</article>`,
    };
    // Par défaut, un dossier configuré : les tests existants attendent que
    // l'app démarre directement, pas l'onboarding. Les tests d'onboarding
    // surchargent ce mock avec null.
    installSettingsMock("C:\\fake\\notes");
  });

  afterEach(() => {
    window.close();
    jest.clearAllMocks();
  });

  test("affiche la note initiale au chargement", async () => {
    installNotesMock([
      {
        id: "aaaaaaaaaa",
        title: "Note initiale",
        content: "Contenu de départ",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    runScript();
    await flush();

    const notesList = document.getElementById("notes-list");
    expect(notesMock.list).toHaveBeenCalled();
    expect(notesList.children.length).toBe(1);
    expect(notesList.textContent).toContain("Note initiale");
  });

  test("clic sur une note remplit le panneau détail et la marque comme sélectionnée", async () => {
    installNotesMock([
      {
        id: "note-1",
        title: "Titre A",
        content: "Contenu A",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "note-2",
        title: "Titre B",
        content: "Contenu B",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    runScript();
    await flush();

    const notesList = document.getElementById("notes-list");
    const detailPanel = document.getElementById("note-detail");
    const detailPlaceholder = document.getElementById("detail-placeholder");
    const detailTitle = document.getElementById("detail-title");
    const detailContent = document.getElementById("detail-content");

    expect(detailPanel.hidden).toBe(true);
    expect(detailPlaceholder.hidden).toBe(false);

    const items = notesList.querySelectorAll("li");
    items[1].dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();

    expect(detailPanel.hidden).toBe(false);
    expect(detailPlaceholder.hidden).toBe(true);
    expect(detailTitle.value).toBe("Titre B");
    expect(detailContent.value).toBe("Contenu B");
    expect(items[1].classList.contains("selected")).toBe(true);
    expect(items[0].classList.contains("selected")).toBe(false);
  });

  test("Enregistrer appelle window.notes.update et rafraîchit la liste", async () => {
    installNotesMock([
      {
        id: "note-1",
        title: "Avant",
        content: "Corps",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    runScript();
    await flush();

    const notesList = document.getElementById("notes-list");
    notesList.querySelector("li").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();

    document.getElementById("detail-title").value = "Après";
    document.getElementById("detail-content").value = "Corps modifié";
    document.getElementById("detail-save").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();

    expect(notesMock.update).toHaveBeenCalledWith("note-1", {
      title: "Après",
      content: "Corps modifié",
    });
    expect(notesList.textContent).toContain("Après");
  });

  test("Supprimer retire la note quand la confirmation est acceptée", async () => {
    installNotesMock([
      {
        id: "note-1",
        title: "À supprimer",
        content: "Bye",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    runScript();
    await flush();

    window.confirm = jest.fn(() => true);

    const notesList = document.getElementById("notes-list");
    notesList.querySelector("li").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();

    document.getElementById("detail-delete").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();

    expect(window.confirm).toHaveBeenCalled();
    expect(notesMock.remove).toHaveBeenCalledWith("note-1");
    expect(notesList.children.length).toBe(0);

    const detailPanel = document.getElementById("note-detail");
    const emptyState = document.getElementById("empty-state");
    expect(detailPanel.hidden).toBe(true);
    expect(emptyState.hidden).toBe(false);
  });

  test("Supprimer ne fait rien si la confirmation est refusée", async () => {
    installNotesMock([
      {
        id: "note-1",
        title: "Garde-moi",
        content: "Still here",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    runScript();
    await flush();

    window.confirm = jest.fn(() => false);

    const notesList = document.getElementById("notes-list");
    notesList.querySelector("li").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();

    document.getElementById("detail-delete").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await flush();

    expect(window.confirm).toHaveBeenCalled();
    expect(notesMock.remove).not.toHaveBeenCalled();
    expect(notesList.children.length).toBe(1);
  });

  describe("Recherche", () => {
    test("filtre la liste par titre (insensible à la casse)", async () => {
      installNotesMock([
        {
          id: "n1",
          title: "Recette de cookies",
          content: "beurre, sucre",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "n2",
          title: "Liste courses",
          content: "pain, lait",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const search = document.getElementById("notes-search");
      const notesList = document.getElementById("notes-list");

      search.value = "COOKIES";
      search.dispatchEvent(new window.Event("input", { bubbles: true }));

      expect(notesList.children.length).toBe(1);
      expect(notesList.textContent).toContain("Recette de cookies");
      expect(notesList.textContent).not.toContain("Liste courses");
    });

    test("filtre la liste par contenu", async () => {
      installNotesMock([
        {
          id: "n1",
          title: "Alpha",
          content: "contient le mot magique xylophone",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "n2",
          title: "Beta",
          content: "quelque chose d'autre",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const search = document.getElementById("notes-search");
      const notesList = document.getElementById("notes-list");

      search.value = "xylophone";
      search.dispatchEvent(new window.Event("input", { bubbles: true }));

      expect(notesList.children.length).toBe(1);
      expect(notesList.textContent).toContain("Alpha");
    });

    test("affiche le message 'aucun résultat' si rien ne matche (sans masquer l'état vide de base)", async () => {
      installNotesMock([
        {
          id: "n1",
          title: "Alpha",
          content: "contenu",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const search = document.getElementById("notes-search");
      const notesList = document.getElementById("notes-list");
      const searchEmpty = document.getElementById("search-empty");
      const emptyState = document.getElementById("empty-state");

      search.value = "zzz-nope";
      search.dispatchEvent(new window.Event("input", { bubbles: true }));

      expect(searchEmpty.hidden).toBe(false);
      expect(notesList.hidden).toBe(true);
      expect(emptyState.hidden).toBe(true);
    });
  });

  describe("Autosave débouncé", () => {
    test("sauvegarde automatiquement après 700ms d'inactivité", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "Titre",
          content: "Corps",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      const timers = installFakeTimers(window);
      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      notesList.querySelector("li").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const detailContent = document.getElementById("detail-content");
      detailContent.value = "Nouveau corps";
      detailContent.dispatchEvent(new window.Event("input", { bubbles: true }));

      expect(notesMock.update).not.toHaveBeenCalled();

      timers.advance(700);
      await flush();

      expect(notesMock.update).toHaveBeenCalledTimes(1);
      expect(notesMock.update).toHaveBeenCalledWith("note-1", {
        title: "Titre",
        content: "Nouveau corps",
      });

      timers.restore();
    });

    test("annule le timer si la sélection change avant l'échéance", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "A",
          content: "aa",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "note-2",
          title: "B",
          content: "bb",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      const timers = installFakeTimers(window);
      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      const items = notesList.querySelectorAll("li");
      items[0].dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const detailContent = document.getElementById("detail-content");
      detailContent.value = "aa modifié";
      detailContent.dispatchEvent(new window.Event("input", { bubbles: true }));

      items[1].dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      timers.advance(700);
      await flush();

      expect(notesMock.update).not.toHaveBeenCalledWith(
        "note-1",
        expect.objectContaining({ content: "aa modifié" }),
      );

      timers.restore();
    });
  });

  describe("Concurrence écriture (autosave + save manuel)", () => {
    test("désactive le bouton Enregistrer pendant un autosave en vol, évitant un double update", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "Titre",
          content: "Corps",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      const timers = installFakeTimers(window);

      let releaseUpdate;
      const pendingPromise = new Promise((resolve) => {
        releaseUpdate = resolve;
      });
      let updateCalls = 0;
      notesMock = {
        list: jest.fn(async () => [
          {
            id: "note-1",
            title: "Titre",
            content: "Corps",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
        create: jest.fn(),
        get: jest.fn(),
        update: jest.fn(async (id, patch) => {
          updateCalls += 1;
          await pendingPromise;
          return {
            id,
            title: patch.title,
            content: patch.content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }),
        remove: jest.fn(),
      };
      window.notes = notesMock;

      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      notesList.querySelector("li").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const detailContent = document.getElementById("detail-content");
      detailContent.value = "Nouveau corps";
      detailContent.dispatchEvent(new window.Event("input", { bubbles: true }));

      timers.advance(700);
      await flush();

      expect(updateCalls).toBe(1);
      const detailSave = document.getElementById("detail-save");
      expect(detailSave.disabled).toBe(true);

      detailSave.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      expect(updateCalls).toBe(1);

      releaseUpdate();
      await flush();
      await flush();

      expect(detailSave.disabled).toBe(false);

      timers.restore();
    });

    test("le save manuel ne doit pas écraser les frappes utilisateur pendant l'await", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "Hello",
          content: "World",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      let releaseUpdate;
      const pendingPromise = new Promise((resolve) => {
        releaseUpdate = resolve;
      });
      notesMock.update.mockImplementationOnce(async (id, patch) => {
        await pendingPromise;
        return {
          id,
          title: patch.title,
          content: patch.content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      notesList.querySelector("li").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const detailTitle = document.getElementById("detail-title");
      detailTitle.value = "Hello modifié";
      document.getElementById("detail-save").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      detailTitle.value = "Hello modifié encore en train de taper";

      releaseUpdate();
      await flush();
      await flush();

      expect(detailTitle.value).toBe(
        "Hello modifié encore en train de taper",
      );
    });
  });

  describe("Recherche insensible aux accents", () => {
    test("'cafe' matche une note dont le titre est 'Café'", async () => {
      installNotesMock([
        {
          id: "n1",
          title: "Café",
          content: "arabica",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "n2",
          title: "Thé",
          content: "matcha",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const search = document.getElementById("notes-search");
      const notesList = document.getElementById("notes-list");

      search.value = "cafe";
      search.dispatchEvent(new window.Event("input", { bubbles: true }));

      expect(notesList.children.length).toBe(1);
      expect(notesList.textContent).toContain("Café");
      expect(notesList.textContent).not.toContain("Thé");
    });
  });

  describe("Toast d'erreur", () => {
    test("affiche un toast quand window.notes.update rejette", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "Hello",
          content: "World",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      notesList.querySelector("li").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      notesMock.update.mockRejectedValueOnce(new Error("disque plein"));

      document.getElementById("detail-title").value = "Hello modifié";
      document.getElementById("detail-save").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const toastContainer = document.getElementById("toast-container");
      const toasts = toastContainer.querySelectorAll(".toast");
      expect(toasts.length).toBe(1);
      expect(toasts[0].classList.contains("toast--error")).toBe(true);
      expect(toasts[0].textContent).toContain("Impossible d'enregistrer");
      expect(toasts[0].textContent).toContain("disque plein");
    });
  });

  describe("Création via bouton +", () => {
    test("clic sur + crée une note vide et l'affiche dans la liste", async () => {
      installNotesMock([]);
      runScript();
      await flush();

      const sidebarCreate = document.getElementById("sidebar-create");
      sidebarCreate.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();
      await flush();

      expect(notesMock.create).toHaveBeenCalledWith({ title: "", content: "" });
      const notesList = document.getElementById("notes-list");
      expect(notesList.children.length).toBe(1);
      expect(notesList.querySelector("li").classList.contains("selected")).toBe(
        true,
      );
    });

    test("clic sur + donne le focus au champ titre", async () => {
      installNotesMock([]);
      runScript();
      await flush();

      const sidebarCreate = document.getElementById("sidebar-create");
      sidebarCreate.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();
      await flush();

      const detailTitle = document.getElementById("detail-title");
      expect(document.activeElement).toBe(detailTitle);
    });

    test("le bouton + est désactivé pendant la création en cours", async () => {
      let releaseCreate;
      const pendingPromise = new Promise((resolve) => {
        releaseCreate = resolve;
      });
      let createCalls = 0;
      notesMock = {
        list: jest.fn(async () => []),
        create: jest.fn(async ({ title, content }) => {
          createCalls += 1;
          await pendingPromise;
          return {
            id: `id${createCalls}`,
            title,
            content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }),
        get: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
      };
      window.notes = notesMock;

      runScript();
      await flush();

      const sidebarCreate = document.getElementById("sidebar-create");
      sidebarCreate.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      expect(sidebarCreate.disabled).toBe(true);
      expect(createCalls).toBe(1);

      // Un second clic pendant l'écriture ne doit pas déclencher un 2ᵉ create.
      sidebarCreate.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();
      expect(createCalls).toBe(1);

      releaseCreate();
      await flush();
      await flush();

      expect(sidebarCreate.disabled).toBe(false);
    });

    test("l'état vide est masqué dès qu'une note existe (via +)", async () => {
      installNotesMock([]);
      runScript();
      await flush();

      const emptyState = document.getElementById("empty-state");
      const notesList = document.getElementById("notes-list");
      expect(emptyState.hidden).toBe(false);
      expect(notesList.hidden).toBe(true);

      const sidebarCreate = document.getElementById("sidebar-create");
      sidebarCreate.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();
      await flush();

      expect(emptyState.hidden).toBe(true);
      expect(notesList.hidden).toBe(false);
      expect(notesList.children.length).toBe(1);
    });
  });

  describe("Raccourcis clavier", () => {
    test("Ctrl+N déclenche la création d'une note", async () => {
      installNotesMock([]);
      runScript();
      await flush();

      document.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "n",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await flush();
      await flush();

      expect(notesMock.create).toHaveBeenCalledWith({ title: "", content: "" });
    });

    test("Ctrl+F focus le champ de recherche", async () => {
      installNotesMock([]);
      runScript();
      await flush();

      const search = document.getElementById("notes-search");
      expect(document.activeElement).not.toBe(search);

      document.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "f",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await flush();

      expect(document.activeElement).toBe(search);
    });
  });

  describe("Onboarding et paramètres", () => {
    test("affiche l'onboarding si notesDir est null au boot", async () => {
      installSettingsMock(null);
      installNotesMock([
        {
          id: "note-1",
          title: "Existante",
          content: "Contenu",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const onboarding = document.getElementById("onboarding");
      const appMain = document.getElementById("app-main");

      expect(onboarding.hidden).toBe(false);
      expect(appMain.hidden).toBe(true);
      // Pas de fetch tant qu'aucun dossier n'est configuré.
      expect(notesMock.list).not.toHaveBeenCalled();
    });

    test("clic sur 'Choisir un dossier' appelle pickNotesDir puis setNotesDir", async () => {
      installSettingsMock(null);
      installNotesMock([]);
      settingsMock.pickNotesDir.mockResolvedValueOnce({
        canceled: false,
        path: "D:\\mes-notes",
      });
      settingsMock.setNotesDir.mockResolvedValueOnce({
        notesDir: "D:\\mes-notes",
      });
      runScript();
      await flush();

      document.getElementById("onboarding-pick").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();
      await flush();

      expect(settingsMock.pickNotesDir).toHaveBeenCalledTimes(1);
      expect(settingsMock.setNotesDir).toHaveBeenCalledWith({
        path: "D:\\mes-notes",
      });

      const onboarding = document.getElementById("onboarding");
      const appMain = document.getElementById("app-main");
      expect(onboarding.hidden).toBe(true);
      expect(appMain.hidden).toBe(false);
    });

    test("clic sur 'Choisir un dossier' ne fait rien si l'utilisateur annule", async () => {
      installSettingsMock(null);
      installNotesMock([]);
      settingsMock.pickNotesDir.mockResolvedValueOnce({ canceled: true });
      runScript();
      await flush();

      document.getElementById("onboarding-pick").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      expect(settingsMock.pickNotesDir).toHaveBeenCalledTimes(1);
      expect(settingsMock.setNotesDir).not.toHaveBeenCalled();

      const onboarding = document.getElementById("onboarding");
      expect(onboarding.hidden).toBe(false);
    });

    test("affiche le chemin courant dans la section paramètres", async () => {
      installSettingsMock("C:\\Users\\moi\\notes");
      installNotesMock([]);
      runScript();
      await flush();
      await flush();

      const settingsPath = document.getElementById("settings-notes-dir");
      const settingsPanel = document.getElementById("settings-panel");

      expect(settingsPath.textContent).toBe("C:\\Users\\moi\\notes");
      expect(settingsPanel.hidden).toBe(false);
    });

    test("l'event notes-dir-changed déclenche un re-fetch", async () => {
      installSettingsMock("C:\\old");
      installNotesMock([
        {
          id: "note-1",
          title: "Ancienne",
          content: "Contenu",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();
      await flush();

      const initialListCalls = notesMock.list.mock.calls.length;
      expect(notesDirChangedCb).toBeTruthy();

      settingsMock.getNotesDir.mockResolvedValueOnce("D:\\new");

      await notesDirChangedCb({ notesDir: "D:\\new" });
      await flush();

      expect(notesMock.list.mock.calls.length).toBeGreaterThan(initialListCalls);

      const settingsPath = document.getElementById("settings-notes-dir");
      expect(settingsPath.textContent).toBe("D:\\new");
    });
  });

  describe("Toggle Edit/Preview", () => {
    test("clic sur #detail-toggle-view passe en mode preview et peuple #detail-preview", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "Titre",
          content: "# Bonjour",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      notesList.querySelector("li").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const detailPanel = document.getElementById("note-detail");
      const detailContent = document.getElementById("detail-content");
      const detailPreview = document.getElementById("detail-preview");
      const toggleBtn = document.getElementById("detail-toggle-view");

      // Le contenu affiché dans la preview doit venir du textarea, pas du
      // cache — c'est ce qui permet d'avoir la prévisualisation des frappes
      // non encore sauvegardées.
      detailContent.value = "# Modifié en direct";

      expect(detailPanel.classList.contains("mode-preview")).toBe(false);

      toggleBtn.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      expect(detailPanel.classList.contains("mode-preview")).toBe(true);
      expect(detailPreview.innerHTML).toContain("# Modifié en direct");
      expect(detailPreview.innerHTML).toContain('class="stub"');
    });

    test("second clic retire la classe .mode-preview (retour en édition)", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "Titre",
          content: "# H1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      notesList.querySelector("li").dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const detailPanel = document.getElementById("note-detail");
      const detailPreview = document.getElementById("detail-preview");
      const toggleBtn = document.getElementById("detail-toggle-view");

      toggleBtn.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();
      expect(detailPanel.classList.contains("mode-preview")).toBe(true);
      const populatedHtml = detailPreview.innerHTML;
      expect(populatedHtml.length).toBeGreaterThan(0);

      toggleBtn.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      expect(detailPanel.classList.contains("mode-preview")).toBe(false);
      // Le retour en édition ne réinitialise pas l'innerHTML de la preview :
      // choix produit (masquage via CSS, pas reset du HTML).
      expect(detailPreview.innerHTML).toBe(populatedHtml);
    });

    test("changer de note réinitialise le mode à édition (retrait de .mode-preview)", async () => {
      installNotesMock([
        {
          id: "note-1",
          title: "A",
          content: "# A",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "note-2",
          title: "B",
          content: "# B",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      runScript();
      await flush();

      const notesList = document.getElementById("notes-list");
      const items = notesList.querySelectorAll("li");
      items[0].dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      const detailPanel = document.getElementById("note-detail");
      const toggleBtn = document.getElementById("detail-toggle-view");

      toggleBtn.dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();
      expect(detailPanel.classList.contains("mode-preview")).toBe(true);

      items[1].dispatchEvent(
        new window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await flush();

      expect(detailPanel.classList.contains("mode-preview")).toBe(false);
    });
  });

});
