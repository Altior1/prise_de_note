# Prise de Note

Application desktop de prise de notes construite avec **Electron**. CRUD simple, stockage local en fichiers Markdown (avec frontmatter YAML), sans dépendance cloud.

> ⚠️ Projet en cours de Sprint 1 (MVP). Plusieurs tickets P0 du backlog ne sont pas encore implémentés côté UI (recherche, édition, suppression avec confirmation, autosave…). Voir [`docs/sprint-1.md`](docs/sprint-1.md) et [`docs/sprint-1-kanban.md`](docs/sprint-1-kanban.md).

## Fonctionnalités

- Création d'une note (titre + contenu) depuis l'UI
- Listing des notes existantes avec date de dernière modification
- API IPC complète côté main : `list`, `get`, `create`, `update`, `remove`
- Persistance sur disque : un fichier `.md` par note, avec métadonnées YAML en frontmatter (`id`, `title`, `createdAt`, `updatedAt`)
- Écriture atomique (fichier temporaire puis `rename`) pour éviter la corruption

## Stack technique

| Domaine | Choix |
|---|---|
| Runtime desktop | Electron 41 |
| Langage | JavaScript ESM (`"type": "module"` dans `package.json`) |
| UI | HTML + JS vanilla (aucun framework) |
| Parsing Markdown + frontmatter | [`gray-matter`](https://www.npmjs.com/package/gray-matter) |
| Tests | Jest 30 + `jest-environment-jsdom` |

> Le dossier s'appelle `vue/` mais **n'utilise pas Vue.js** — c'est juste le nom choisi pour la couche présentation (renderer Electron).

## Prérequis

- **Node.js ≥ 18** (Electron 41 nécessite au moins Node 18)
- **npm** (fourni avec Node)

## Installation

```bash
git clone <url-du-repo>
cd "prise de note"
npm install
```

## Lancer l'application

```bash
npm start
```

Cette commande démarre Electron et ouvre la fenêtre principale sur `vue/accueil.html`.

## Lancer les tests

```bash
npm test
```

Les tests utilisent Jest en mode ESM expérimental (`--experimental-vm-modules`). Trois suites :

- `tests/notes.test.js` — logique métier in-memory (`lib/notes.js`)
- `tests/notes-storage.test.js` — stockage disque (`lib/notes-storage.js`), utilise un `tmpdir` isolé par test
- `tests/notes-ui.test.js` — intégration DOM du renderer (jsdom)

## Structure du projet

```
.
├── main.js                     # Process main Electron : fenêtre + enregistrement IPC
├── preload.js                  # Bridge sécurisé : expose window.notes (contextBridge + ipcRenderer.invoke)
├── lib/
│   ├── notes.js                # CRUD in-memory (utilisé par les tests unitaires)
│   └── notes-storage.js        # Stockage Markdown + frontmatter (utilisé en runtime)
├── vue/
│   ├── accueil.html            # Page d'accueil (form + liste)
│   └── script/notes-ui.js      # Logique renderer (consomme window.notes)
├── tests/                      # Suites Jest
├── docs/                       # Backlog Sprint 1 + kanban
└── .github/agents/             # Définitions d'agents custom (codeur, qualité, PO)
```

## Architecture

```
┌──────────────────┐  ipcRenderer.invoke   ┌──────────────┐   createStorage()   ┌──────────────┐
│  Renderer        │ ────────────────────▶ │ preload.js   │ ──────────────────▶ │ main.js      │
│  (vue/script)    │                       │ (contextBridge│                    │ (ipcMain)    │
│  window.notes.*  │ ◀──────────────────── │  → window.notes)                   │ notes-storage│
└──────────────────┘                       └──────────────┘                     └──────┬───────┘
                                                                                       │
                                                                                       ▼
                                                                            <userData>/notes/*.md
```

Les canaux IPC exposés (`main.js`) :

| Canal | Payload | Retour |
|---|---|---|
| `notes:list` | — | `Note[]` |
| `notes:get` | `id: string` | `Note \| null` |
| `notes:create` | `{ title, content }` | `Note` |
| `notes:update` | `id, { title?, content? }` | `Note \| null` |
| `notes:delete` | `id: string` | `boolean` |

### Emplacement des notes sur disque

Les notes sont écrites dans `<userData>/notes/`, où `<userData>` est fourni par `app.getPath("userData")` :

- **Windows** : `%APPDATA%\prise-de-note\notes\`
- **macOS** : `~/Library/Application Support/prise-de-note/notes/`
- **Linux** : `~/.config/prise-de-note/notes/`

Chaque note est un fichier `<slug-du-titre>-<id>.md` de la forme :

```markdown
---
id: a1b2c3d4e5
title: Mes courses
createdAt: '2026-04-20T12:34:56.000Z'
updatedAt: '2026-04-20T12:34:56.000Z'
---
Contenu de la note en Markdown.
```

## Sécurité / configuration Electron

`main.js` configure la `BrowserWindow` avec :

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: false` ← **ne pas changer** sans précaution (voir ci-dessous)
- `preload: preload.js`

### Pourquoi `sandbox: false`

Le preload est chargé en ES module parce que `package.json` déclare `"type": "module"`. Electron n'autorise l'ESM dans le preload **que si le sandbox est désactivé**. Réactiver `sandbox: true` fait silencieusement échouer l'import du preload → `window.notes` devient `undefined` → toutes les actions UI plantent sans erreur visible.

Si la sécurité renforcée est requise plus tard, deux options :
1. Passer le preload en CommonJS (retirer les `import`, renommer ou adapter).
2. Conserver le sandbox désactivé mais ne rien exécuter de sensible dans le preload.

## Conventions

- Le code est en **ESM** (`import`/`export`) partout — y compris preload et tests.
- Pas de framework UI : le renderer manipule le DOM directement dans une IIFE.
- `lib/notes-storage.js` est **pur** (prend `notesDir` en paramètre), ce qui facilite les tests sans Electron.
- Tests qui touchent le disque : utiliser `fs.mkdtemp` + cleanup dans `afterEach`, jamais de chemin en dur.

## Roadmap (Sprint 1 restant)

D'après le backlog, à faire côté UI/renderer :

- [ ] S1-T08 — écran détail + édition
- [ ] S1-T10 — suppression avec confirmation
- [ ] S1-T11 — recherche texte (titre + contenu)
- [ ] S1-T12 — autosave avec debounce (~700 ms)
- [ ] S1-T13 — gestion d'erreurs UI (toast/alerte)
- [ ] S1-T14 — état vide + onboarding minimal
- [ ] S1-T15 — recette manuelle MVP

## Licence

ISC (voir `package.json`).
