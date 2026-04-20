// Logique d'affichage et de création des notes pour le renderer.
// Utilise l'API asynchrone window.notes exposée par le preload (IPC vers le main).

(function () {
  if (!window.notes) {
    console.error("window.notes absent — preload non chargé ?");
    return;
  }

  const notesList = document.getElementById("notes-list");

  async function afficherNotes() {
    notesList.innerHTML = "";
    const notes = await window.notes.list();
    notes.forEach((note) => {
      const li = document.createElement("li");

      const titre = document.createElement("strong");
      titre.textContent = note.title || "(sans titre)";
      li.appendChild(titre);
      li.appendChild(document.createElement("br"));

      li.appendChild(document.createTextNode(note.content));
      li.appendChild(document.createElement("br"));

      const maj = document.createElement("em");
      maj.textContent = `Dernière modification : ${new Date(note.updatedAt).toLocaleString()}`;
      li.appendChild(maj);

      notesList.appendChild(li);
    });
  }

  function setupForm() {
    const form = document.getElementById("note-form");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const title = document.getElementById("note-title").value;
      const content = document.getElementById("note-content").value;
      await window.notes.create({ title, content });
      form.reset();
      await afficherNotes();
    });
  }

  setupForm();
  afficherNotes();
})();
