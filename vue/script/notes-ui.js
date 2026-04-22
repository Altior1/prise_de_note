// Logique d'affichage, de création, d'édition, de suppression des notes,
// de recherche, d'autosave et d'affichage des erreurs.
// Utilise window.notes exposé par le preload (IPC vers le main).
//
// Enveloppé dans une IIFE pour éviter de polluer le scope global
// (le script est chargé en classique, pas en module).

(function () {
  // Garde-fou : si le preload n'a pas tourné (dev/test hors Electron),
  // on n'attache aucun listener — le reste de la page reste utilisable.
  // Double ceinture : boot() revérifie window.settings avant de démarrer.
  if (!window.notes) {
    console.error("window.notes absent — preload non chargé ?");
    return;
  }

  // Délai avant autosave : compromis entre réactivité et nombre d'I/O.
  // 700ms correspond à une pause de frappe "naturelle".
  const AUTOSAVE_DELAY_MS = 700;
  const TOAST_DURATION_MS = 4000;

  // --- Références DOM (résolues une seule fois au chargement) --------------
  const notesList = document.getElementById("notes-list");
  const emptyState = document.getElementById("empty-state");
  const searchEmpty = document.getElementById("search-empty");
  const searchInput = document.getElementById("notes-search");
  const detailPlaceholder = document.getElementById("detail-placeholder");
  const detailPanel = document.getElementById("note-detail");
  const detailTitle = document.getElementById("detail-title");
  const detailContent = document.getElementById("detail-content");
  const detailSaveBtn = document.getElementById("detail-save");
  const detailDeleteBtn = document.getElementById("detail-delete");
  const detailToggleViewBtn = document.getElementById("detail-toggle-view");
  const detailPreview = document.getElementById("detail-preview");
  const saveIndicator = document.getElementById("save-indicator");
  const toastContainer = document.getElementById("toast-container");

  // --- État local du renderer ----------------------------------------------
  // notesCache : source de vérité pour l'UI, reflet du dernier list() du main.
  // selectedId : id de la note affichée dans le panneau détail (ou null).
  // autosaveTimer / autosaveTargetId : timer debounce + id ciblé pour éviter
  //   qu'un timer en vol n'écrase une autre note si l'utilisateur change
  //   de sélection avant l'échéance.
  // inFlightWrites : compteur de writes en cours — désactive le bouton
  //   "Enregistrer" tant qu'un autosave ou save manuel est en vol, pour
  //   prévenir un double update concurrent.
  let notesCache = [];
  let selectedId = null;
  let searchQuery = "";
  let autosaveTimer = null;
  let autosaveTargetId = null;
  let inFlightWrites = 0;
  let viewMode = "edit";

  function beginWrite() {
    inFlightWrites += 1;
    if (detailSaveBtn) detailSaveBtn.disabled = true;
  }

  function endWrite() {
    // Math.max évite un compteur négatif en cas d'appariement cassé.
    inFlightWrites = Math.max(0, inFlightWrites - 1);
    if (detailSaveBtn && inFlightWrites === 0) {
      detailSaveBtn.disabled = false;
    }
  }

  // Toast d'erreur auto-dismiss — non bloquant, contrairement à alert().
  function showError(message) {
    const text = typeof message === "string" && message.length > 0
      ? message
      : "Une erreur est survenue.";
    if (!toastContainer) {
      console.error(text);
      return;
    }
    const toast = document.createElement("div");
    toast.className = "toast toast--error";
    toast.setAttribute("role", "alert");
    toast.textContent = text;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, TOAST_DURATION_MS);
  }

  // Wrapper autour des appels IPC : capture toute erreur, affiche un toast,
  // et retourne null. Permet d'écrire le flux nominal sans try/catch partout.
  // Limite : null est aussi une valeur de retour légitime (ex: note non trouvée)
  // — les callers ne distinguent donc pas "erreur" de "absent".
  async function safeCall(fn, errorMessage) {
    try {
      return await fn();
    } catch (err) {
      const detail = err && err.message ? err.message : String(err);
      showError(`${errorMessage} (${detail})`);
      return null;
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  }

  function formatTime(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return "";
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function setSaveIndicator(state, text) {
    if (!saveIndicator) return;
    saveIndicator.classList.remove("is-saving", "is-saved");
    if (state === "saving") saveIndicator.classList.add("is-saving");
    if (state === "saved") saveIndicator.classList.add("is-saved");
    saveIndicator.textContent = text || "";
  }

  // Normalisation pour la recherche : insensible à la casse ET aux accents.
  // NFD sépare les lettres des diacritiques ; le regex \p{Diacritic} les retire.
  // Ex: "Café" → "cafe", "ÉTÉ" → "ete".
  function normalize(str) {
    return (str || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  }

  function matchesSearch(note, query) {
    if (!query) return true;
    const q = normalize(query);
    if (!q) return true;
    const title = normalize(note.title);
    const content = normalize(note.content);
    return title.includes(q) || content.includes(q);
  }

  function getFilteredNotes() {
    return notesCache.filter((n) => matchesSearch(n, searchQuery));
  }

  // Trois états visuels mutuellement exclusifs :
  // - base vide    → "Aucune note pour le moment" (empty-state)
  // - filtré vide  → "Aucun résultat" (search-empty)
  // - non vide     → affichage normal de la liste
  function renderEmptyState(isBaseEmpty, filteredCount) {
    if (!emptyState || !notesList) return;
    if (isBaseEmpty) {
      notesList.hidden = true;
      emptyState.hidden = false;
      if (searchEmpty) searchEmpty.hidden = true;
      return;
    }
    emptyState.hidden = true;
    if (filteredCount === 0) {
      notesList.hidden = true;
      if (searchEmpty) searchEmpty.hidden = false;
    } else {
      notesList.hidden = false;
      if (searchEmpty) searchEmpty.hidden = true;
    }
  }

  function renderDetail(note) {
    if (!detailPanel || !detailPlaceholder) return;
    if (!note) {
      detailPanel.hidden = true;
      detailPlaceholder.hidden = false;
      detailTitle.value = "";
      detailContent.value = "";
      setSaveIndicator(null, "");
      return;
    }
    detailPlaceholder.hidden = true;
    detailPanel.hidden = false;
    detailTitle.value = note.title || "";
    detailContent.value = note.content || "";
    setSaveIndicator(null, "");
  }

  function highlightSelected() {
    if (!notesList) return;
    const items = notesList.querySelectorAll("li");
    items.forEach((li) => {
      if (li.dataset.id === selectedId) {
        li.classList.add("selected");
      } else {
        li.classList.remove("selected");
      }
    });
  }

  // textContent (jamais innerHTML) : prévient l'injection XSS si un titre
  // ou contenu contient du HTML — le navigateur l'affiche tel quel.
  function buildListItem(note) {
    const li = document.createElement("li");
    li.dataset.id = note.id;

    const titre = document.createElement("span");
    titre.className = "note-title";
    titre.textContent = note.title || "(sans titre)";
    li.appendChild(titre);

    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = `Modifiée : ${formatDate(note.updatedAt)}`;
    li.appendChild(date);

    li.addEventListener("click", () => {
      selectNote(note.id);
    });

    return li;
  }

  function cancelAutosave() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    autosaveTargetId = null;
  }

  function selectNote(id) {
    // Changement de sélection = on annule tout autosave en attente sur
    // l'ancienne note. Sans ça, le timer pourrait tirer après qu'on soit
    // passé sur une autre note et écraser cette dernière avec d'anciennes
    // valeurs d'input.
    if (selectedId !== id) {
      cancelAutosave();
    }
    const note = notesCache.find((n) => n.id === id);
    if (!note) {
      selectedId = null;
      resetViewMode();
      renderDetail(null);
      highlightSelected();
      return;
    }
    selectedId = id;
    resetViewMode();
    renderDetail(note);
    highlightSelected();
  }

  // Reset systématique au changement de note : revenir en édition évite
  // qu'on reste bloqué sur un aperçu rendu à partir du contenu d'une autre
  // note pendant la fraction de seconde avant le prochain toggle.
  function resetViewMode() {
    viewMode = "edit";
    if (detailPanel) detailPanel.classList.remove("mode-preview");
    updateToggleViewButton();
  }

  function updateToggleViewButton() {
    if (!detailToggleViewBtn) return;
    if (!window.AppIcons || !window.AppIcons.renderIcon) return;
    const isPreview = viewMode === "preview";
    const icon = isPreview ? window.AppIcons.pencilIcon : window.AppIcons.eyeIcon;
    window.AppIcons.renderIcon(detailToggleViewBtn, icon);
    detailToggleViewBtn.setAttribute(
      "aria-label",
      isPreview ? "Revenir à l'édition" : "Afficher l'aperçu",
    );
  }

  function decorateDetailToggleView() {
    if (!detailToggleViewBtn) return;
    updateToggleViewButton();
    detailToggleViewBtn.addEventListener("click", () => {
      viewMode = viewMode === "edit" ? "preview" : "edit";
      if (detailPanel) detailPanel.classList.toggle("mode-preview", viewMode === "preview");
      if (viewMode === "preview" && detailPreview && detailContent) {
        // renderMarkdown retourne du HTML déjà sanitisé par DOMPurify
        // (cf. markdown.js) — innerHTML est sûr ici.
        const html = window.AppMarkdown && window.AppMarkdown.renderMarkdown
          ? window.AppMarkdown.renderMarkdown(detailContent.value)
          : "";
        detailPreview.innerHTML = html;
      }
      updateToggleViewButton();
    });
  }

  function renderList() {
    notesList.innerHTML = "";
    const filtered = getFilteredNotes();
    const isBaseEmpty = notesCache.length === 0;
    renderEmptyState(isBaseEmpty, filtered.length);

    filtered.forEach((note) => {
      notesList.appendChild(buildListItem(note));
    });
    highlightSelected();
  }

  // Re-sync complet : tire la liste fraîche du main, reconstruit l'UI.
  // Conserve la sélection si la note existe toujours (cas : après update) ;
  // sinon reset le panneau détail (cas : après delete).
  async function afficherNotes() {
    const notes = await safeCall(
      () => window.notes.list(),
      "Impossible de charger les notes.",
    );
    notesCache = Array.isArray(notes) ? notes : [];

    if (notesCache.length === 0) {
      renderList();
      selectedId = null;
      renderDetail(null);
      return;
    }

    renderList();

    if (selectedId && notesCache.some((n) => n.id === selectedId)) {
      const current = notesCache.find((n) => n.id === selectedId);
      renderDetail(current);
      highlightSelected();
    } else {
      selectedId = null;
      renderDetail(null);
    }
  }

  // targetId est capturé au moment où l'autosave a été planifié :
  // si la sélection a changé entre-temps, on abandonne (vérification en entrée
  // et avant de mettre à jour l'indicator "saved").
  async function runAutosave(targetId, title, content) {
    if (selectedId !== targetId) return;
    beginWrite();
    setSaveIndicator("saving", "Enregistrement…");
    let updated;
    try {
      updated = await safeCall(
        () => window.notes.update(targetId, { title, content }),
        "Échec de l'enregistrement automatique.",
      );
    } finally {
      endWrite();
    }
    if (updated === null || updated === undefined) {
      setSaveIndicator(null, "");
      return;
    }
    // Merge dans le cache local pour éviter un full list() à chaque autosave.
    const idx = notesCache.findIndex((n) => n.id === targetId);
    if (idx !== -1) {
      notesCache[idx] = { ...notesCache[idx], ...updated };
    }
    renderList();
    if (selectedId === targetId) {
      setSaveIndicator("saved", `Enregistré ${formatTime(updated.updatedAt)}`);
    }
  }

  // Debounce : chaque frappe relance le timer, seul le dernier input déclenche
  // un write. Les valeurs title/content sont capturées au moment du schedule
  // pour être stables même si l'utilisateur continue à taper pendant l'await.
  function scheduleAutosave() {
    if (!selectedId) return;
    cancelAutosave();
    const targetId = selectedId;
    autosaveTargetId = targetId;
    const title = detailTitle.value;
    const content = detailContent.value;
    setSaveIndicator("saving", "Enregistrement…");
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      // Double vérif : autosaveTargetId peut avoir été réinitialisé par
      // cancelAutosave entre-temps, ou selectedId avoir changé.
      if (autosaveTargetId !== targetId || selectedId !== targetId) return;
      runAutosave(targetId, title, content);
    }, AUTOSAVE_DELAY_MS);
  }

  function setupDetailActions() {
    if (detailSaveBtn) {
      detailSaveBtn.addEventListener("click", async () => {
        if (!selectedId) return;
        // Double-check disabled : si un write est en vol, on ne déclenche pas
        // un save manuel concurrent (cf. test "désactive le bouton pendant
        // un autosave en vol").
        if (detailSaveBtn.disabled) return;
        cancelAutosave();
        const title = detailTitle.value;
        const content = detailContent.value;
        const targetId = selectedId;
        beginWrite();
        setSaveIndicator("saving", "Enregistrement…");
        let updated;
        try {
          updated = await safeCall(
            () => window.notes.update(targetId, { title, content }),
            "Impossible d'enregistrer la note.",
          );
        } finally {
          endWrite();
        }
        if (updated === null || updated === undefined) {
          setSaveIndicator(null, "");
          return;
        }
        const idx = notesCache.findIndex((n) => n.id === targetId);
        if (idx !== -1) {
          notesCache[idx] = { ...notesCache[idx], ...updated };
        }
        renderList();
        if (selectedId === targetId) {
          setSaveIndicator("saved", `Enregistré ${formatTime(updated.updatedAt)}`);
        }
      });
    }

    if (detailDeleteBtn) {
      detailDeleteBtn.addEventListener("click", async () => {
        if (!selectedId) return;
        const ok = window.confirm("Supprimer cette note ?");
        if (!ok) return;
        const idToRemove = selectedId;
        cancelAutosave();
        const result = await safeCall(
          () => window.notes.remove(idToRemove),
          "Impossible de supprimer la note.",
        );
        if (result === null) return;
        if (selectedId === idToRemove) {
          selectedId = null;
        }
        await afficherNotes();
      });
    }

    if (detailTitle) {
      detailTitle.addEventListener("input", scheduleAutosave);
    }
    if (detailContent) {
      detailContent.addEventListener("input", scheduleAutosave);
    }
  }

  function setupSearch() {
    if (!searchInput) return;
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value || "";
      renderList();
    });
  }

  // Bouton + de la sidebar : création instantanée d'une note vide, flow
  // Obsidian/Apple Notes — pas de formulaire, aucun champ obligatoire.
  // Le bouton est désactivé pendant l'écriture pour éviter qu'un double
  // clic rapide ne crée deux notes vides.
  function setupSidebarCreate() {
    const btn = document.getElementById("sidebar-create");
    if (!btn) return;

    if (window.AppIcons && window.AppIcons.renderIcon) {
      window.AppIcons.renderIcon(btn, window.AppIcons.plusIcon);
    }

    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const created = await safeCall(
          () => window.notes.create({ title: "", content: "" }),
          "Impossible de créer la note.",
        );
        if (!created) return;
        await afficherNotes();
        selectNote(created.id);
        if (detailTitle) {
          detailTitle.focus();
          detailTitle.select();
        }
      } finally {
        btn.disabled = false;
      }
    });
  }

  function showOnboarding() {
    const onboarding = document.getElementById("onboarding");
    const appMain = document.getElementById("app-main");
    const settingsPanel = document.getElementById("settings-panel");
    if (onboarding) onboarding.hidden = false;
    if (appMain) appMain.hidden = true;
    if (settingsPanel) settingsPanel.hidden = true;
  }

  function showApp() {
    const onboarding = document.getElementById("onboarding");
    const appMain = document.getElementById("app-main");
    const settingsPanel = document.getElementById("settings-panel");
    if (onboarding) onboarding.hidden = true;
    if (appMain) appMain.hidden = false;
    if (settingsPanel) settingsPanel.hidden = false;
  }

  // On relit getNotesDir à chaque event plutôt que de se fier au payload :
  // garantit que l'UI reflète l'état réel du disque même si plusieurs events
  // arrivent dans un ordre inattendu.
  async function refreshSettingsDisplay() {
    const el = document.getElementById("settings-notes-dir");
    if (!el) return;
    const dir = await safeCall(
      () => window.settings.getNotesDir(),
      "Impossible de lire le dossier courant.",
    );
    el.textContent = dir || "";
  }

  // Flow partagé par l'onboarding ET le bouton "Changer…" : pick → set.
  // Retourne true si l'utilisateur a bien validé un dossier.
  async function pickAndSetNotesDir() {
    const picked = await safeCall(
      () => window.settings.pickNotesDir(),
      "Impossible d'ouvrir le sélecteur.",
    );
    if (!picked || picked.canceled) return false;
    const result = await safeCall(
      () => window.settings.setNotesDir({ path: picked.path }),
      "Impossible d'enregistrer le dossier.",
    );
    return Boolean(result && result.notesDir);
  }

  function setupOnboarding() {
    const btn = document.getElementById("onboarding-pick");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const ok = await pickAndSetNotesDir();
      if (!ok) return;
      // L'event notes-dir-changed va rafraîchir la liste ; on bascule l'UI
      // immédiatement pour que la transition soit perceptible côté utilisateur.
      showApp();
      await refreshSettingsDisplay();
      await afficherNotes();
    });
  }

  // Injecte l'icône trash dans le bouton de suppression du panneau détail.
  // Le bouton n'a plus de texte visible (aria-label assure l'accessibilité).
  function decorateDetailDelete() {
    const btn = document.getElementById("detail-delete");
    if (!btn) return;
    if (!window.AppIcons || !window.AppIcons.trashIcon) return;
    window.AppIcons.renderIcon(btn, window.AppIcons.trashIcon);
  }

  // Injecte l'icône folder à gauche du label "Ouvrir" du bouton settings-open.
  // Purement visuel — n'affecte ni l'id, ni le handler de clic.
  function decorateSettingsOpen() {
    const btn = document.getElementById("settings-open");
    if (!btn) return;
    if (!window.AppIcons || !window.AppIcons.folderIcon) return;

    const iconSlot = document.createElement("span");
    iconSlot.className = "button-icon";
    window.AppIcons.renderIcon(iconSlot, window.AppIcons.folderIcon);

    const label = document.createElement("span");
    label.textContent = "Ouvrir";

    btn.textContent = "";
    btn.appendChild(iconSlot);
    btn.appendChild(label);
  }

  // Raccourcis globaux :
  // - Ctrl/Cmd+N : déclencher la création (équivalent clic sur #sidebar-create).
  // - Ctrl/Cmd+F : focus la barre de recherche.
  // preventDefault évite que Ctrl+F ouvre la barre "find in page" native
  // d'Electron et que Ctrl+N tente d'ouvrir une "nouvelle fenêtre".
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;

      const key = e.key.toLowerCase();

      if (key === "n") {
        e.preventDefault();
        const btn = document.getElementById("sidebar-create");
        if (btn && !btn.disabled) btn.click();
        return;
      }

      if (key === "f") {
        e.preventDefault();
        const search = document.getElementById("notes-search");
        if (search) {
          search.focus();
          search.select();
        }
        return;
      }
    });
  }

  function setupSettingsPanel() {
    const changeBtn = document.getElementById("settings-change");
    const openBtn = document.getElementById("settings-open");
    if (changeBtn) {
      changeBtn.addEventListener("click", async () => {
        // L'event notes-dir-changed se charge du refresh en cas de succès ;
        // en cas d'annulation ou d'erreur, rien à faire.
        await pickAndSetNotesDir();
      });
    }
    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        const result = await safeCall(
          () => window.settings.openNotesDir(),
          "Impossible d'ouvrir le dossier.",
        );
        if (result && result.ok === false && result.error) {
          showError(result.error);
        }
      });
    }
  }

  async function boot() {
    if (!window.settings) {
      console.error("window.settings absent — preload non chargé ?");
      return;
    }
    // Ordre : poser les listeners et l'abonnement avant le premier fetch,
    // pour ne rater aucun événement utilisateur ou notif entre le chargement
    // et le retour de list().
    setupOnboarding();
    setupSettingsPanel();
    decorateSettingsOpen();
    decorateDetailDelete();
    decorateDetailToggleView();
    setupDetailActions();
    setupSearch();
    setupSidebarCreate();
    setupKeyboardShortcuts();

    // Abonnement au changement de dossier : reset la sélection (la note
    // éditée n'existe pas forcément dans le nouveau dossier) puis re-fetch.
    window.settings.onNotesDirChanged(async () => {
      cancelAutosave();
      selectedId = null;
      await refreshSettingsDisplay();
      await afficherNotes();
    });

    const notesDir = await safeCall(
      () => window.settings.getNotesDir(),
      "Impossible de lire la configuration.",
    );
    if (!notesDir) {
      showOnboarding();
      return;
    }
    showApp();
    await refreshSettingsDisplay();
    await afficherNotes();
  }

  boot();
})();
