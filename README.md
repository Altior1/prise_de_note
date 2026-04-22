# Prise de Note

Application desktop de prise de notes construite avec **Electron**. CRUD local, stockage en fichiers Markdown (frontmatter YAML), dossier de notes **choisi par l'utilisateur** (compatible synchronisation OneDrive / Dropbox / iCloud), zéro backend.

Interface inspirée d'Obsidian : sidebar de navigation à gauche, éditeur pleine hauteur à droite, création instantanée via un bouton « + ».

## État du projet

| Sprint | Contenu | Statut |
|---|---|---|
| Sprint 1 | MVP CRUD + persistance + recherche + autosave + gestion d'erreurs | Livré |
| Sprint 2 | Dossier de notes configurable (onboarding, hot-swap, settings.json) — J1 à J3 | Livré (J4/J5 reportés Sprint 4) |
| Sprint 3 | Refonte UX/UI Obsidian-like — J1 à J4 | En cours (J5/J6 à faire) |
| Sprint 4 | Reprise S2-J4 (`.md` externes) + S2-J5 (modale migration) sur la nouvelle UI | À planifier |
| Sprint 5 | Rendu Markdown (markdown-it + DOMPurify) + thème sombre (toggle via tokens CSS) | À démarrer |

Backlogs détaillés : [`docs/sprint-1.md`](docs/sprint-1.md), [`docs/sprint-2.md`](docs/sprint-2.md), [`docs/sprint-3.md`](docs/sprint-3.md), [`docs/sprint-4.md`](docs/sprint-4.md), [`docs/sprint-5.md`](docs/sprint-5.md).

## Fonctionnalités livrées

### Gestion des notes
- Création instantanée via le bouton « + » en bas de sidebar (note vide, sélectionnée, focus immédiat dans le titre).
- Édition inline : titre + contenu, autosave debouncée à 700 ms, indicateur « Enregistré à HH:MM ».
- Suppression avec confirmation.
- Recherche full-text (titre + contenu), insensible à la casse et aux accents.
- Liste triée, sélection mise en évidence, états vides (« aucune note » / « aucun résultat »).
- Tolérance aux fichiers `.md` corrompus dans le dossier de notes (skip sans crash, listés via `invalidFiles`).

### Dossier configurable
- Onboarding bloquant au 1er lancement : l'utilisateur doit choisir un dossier (pas de défaut silencieux).
- Paramètres en bas de sidebar : chemin courant affiché + boutons « Changer… » et « Ouvrir ».
- Hot-swap : changement de dossier sans redémarrage (event `notes-dir-changed` → re-list automatique).
- `settings.json` versionné (`schemaVersion: 1`) dans `<userData>`.
- Corruption de `settings.json` détectée → `console.warn` + fallback en mémoire sans écraser le fichier.

### Stockage
- Un fichier `.md` par note dans le dossier choisi, frontmatter YAML (`id`, `title`, `createdAt`, `updatedAt`).
- Écriture atomique (`.tmp` + `rename`) pour éviter la corruption en cas de crash.
- Compatible synchronisation cloud côté OS (OneDrive, Dropbox, iCloud) sans code dédié.

## Stack technique

| Domaine | Choix |
|---|---|
| Runtime desktop | Electron 41 |
| Langage | JavaScript ESM (`"type": "module"` dans `package.json`) |
| UI | HTML + CSS + JS vanilla (zéro framework) |
| Icônes | SVG inline copiés depuis heroicons.com (pas de dépendance npm) |
| Parsing Markdown + frontmatter | [`gray-matter`](https://www.npmjs.com/package/gray-matter) |
| Tests | Jest 30 + `jest-environment-jsdom` en mode `--experimental-vm-modules` |

Le dossier s'appelle `vue/` mais **n'utilise pas Vue.js** — c'est juste le nom de la couche renderer.

## Prérequis

- **Node.js ≥ 18**
- **npm**

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

Au **premier lancement** (ou si `settings.json` est absent), l'application présente un écran d'onboarding qui force l'utilisateur à choisir un dossier de notes avant de pouvoir utiliser l'interface principale.

## Lancer les tests

```bash
npm test
```

5 suites, 67 tests au moment de la rédaction :

- `tests/notes.test.js` — logique métier historique (mock in-memory, hérité).
- `tests/notes-storage.test.js` — stockage disque (`lib/notes-storage.js`), `tmpdir` isolé par test.
- `tests/settings.test.js` — lecture/écriture du `settings.json` (`lib/settings.js`).
- `tests/boot.test.js` — résolution du storage au boot (`lib/boot.js`).
- `tests/notes-ui.test.js` — intégration DOM du renderer (jsdom, ~30 tests : liste, détail, recherche, autosave, concurrence, toasts, onboarding, settings).

## Structure du projet

```
.
├── main.js                     # Process main : boot, résolution settings, handlers IPC
├── preload.js                  # Bridge sécurisé : expose window.notes + window.settings
├── lib/
│   ├── notes.js                # CRUD in-memory hérité (conservé pour tests)
│   ├── notes-storage.js        # Stockage Markdown + frontmatter, factory createStorage(dir)
│   ├── settings.js             # readSettings / writeSettings (settings.json versionné)
│   └── boot.js                 # resolveStorage(settings, deps) — fonction pure testable
├── vue/
│   ├── accueil.html            # Onboarding + sidebar + panneau éditeur + toasts
│   ├── style/
│   │   ├── tokens.css          # Variables CSS : couleurs, espacement, typo, rayons
│   │   ├── sidebar.css         # Styles sidebar + paramètres compacts
│   │   ├── detail.css          # Styles panneau éditeur
│   │   └── accueil.css         # Glue : body, flex app-main, toasts, onboarding
│   └── script/
│       ├── icons.js            # window.AppIcons : 8 icônes SVG heroicons + renderIcon
│       └── notes-ui.js         # Logique renderer (consomme window.notes + window.settings)
├── tests/
├── docs/                       # Backlogs sprint-1/2/3 + kanbans
├── .claude/agents/             # Agents Claude Code custom (codeur, commentateur, qualité, PO)
└── .github/agents/             # Doc miroir des agents
```

## Architecture

```
┌──────────────────────────┐  ipcRenderer.invoke   ┌─────────────────┐
│ Renderer (vue/script)    │ ────────────────────▶ │ preload.js      │
│ window.notes.*           │                       │ contextBridge   │
│ window.settings.*        │ ◀──────────────────── │ → window.*      │
│ (écoute notes-dir-changed)│                      └────────┬────────┘
└──────────────────────────┘                                │
                                                            ▼
                          ┌───────────────────────────────────────────────┐
                          │ main.js                                        │
                          │ ┌───────────────────────────────────────────┐ │
                          │ │ readSettings(settings.json)               │ │
                          │ │ → resolveStorage(settings)                │ │
                          │ │ → storageHolder.current (hot-swappable)   │ │
                          │ └───────────────────────────────────────────┘ │
                          │                                                │
                          │ IPC handlers:                                  │
                          │  notes:list|get|create|update|delete           │
                          │  settings:getNotesDir|pickNotesDir|            │
                          │           setNotesDir|openNotesDir             │
                          └────────────┬─────────────────────────┬────────┘
                                       │                          │
                                       ▼                          ▼
                          <userData>/settings.json          <notesDir>/*.md
                          (notesDir, schemaVersion)         (frontmatter YAML)
```

### Canaux IPC

**`window.notes`** (CRUD notes) :

| Canal | Payload | Retour |
|---|---|---|
| `notes:list` | — | `Note[]` (invalidFiles logué côté main, à exposer au renderer en Sprint 4) |
| `notes:get` | `id: string` | `Note \| null` |
| `notes:create` | `{ title, content }` | `Note` |
| `notes:update` | `id, { title?, content? }` | `Note \| null` |
| `notes:delete` | `id: string` | `boolean` |

Si aucun `notesDir` n'est configuré, tous ces canaux **rejettent** avec `"Aucun dossier de notes configuré"` — l'UI bascule alors sur l'onboarding.

**`window.settings`** (configuration) :

| Canal | Payload | Retour |
|---|---|---|
| `settings:getNotesDir` | — | `string \| null` |
| `settings:pickNotesDir` | — | `{ canceled: true } \| { canceled: false, path }` |
| `settings:setNotesDir` | `{ path }` | `{ notesDir }` (valide, swap, persiste, émet event) |
| `settings:openNotesDir` | — | `{ ok: true } \| { ok: false, error }` |

**Event main → renderer** : `notes-dir-changed` (émis après un `setNotesDir` réussi, payload `{ notesDir }`).

### Emplacement des fichiers sur disque

**`settings.json`** dans le dossier fourni par `app.getPath("userData")` :

- **Windows** : `%APPDATA%\prise-de-note\settings.json`
- **macOS** : `~/Library/Application Support/prise-de-note/settings.json`
- **Linux** : `~/.config/prise-de-note/settings.json`

Format :

```json
{
  "schemaVersion": 1,
  "notesDir": "C:\\Users\\alice\\OneDrive\\Notes"
}
```

**Notes** dans le dossier choisi par l'utilisateur, un fichier `<slug-du-titre>-<id>.md` de la forme :

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
- `minWidth: 640` / `minHeight: 480` pour préserver le layout sidebar + éditeur

### Pourquoi `sandbox: false`

Le preload est chargé en ES module parce que `package.json` déclare `"type": "module"`. Electron n'autorise l'ESM dans le preload **que si le sandbox est désactivé**. Réactiver `sandbox: true` fait silencieusement échouer l'import du preload → `window.notes` / `window.settings` deviennent `undefined` → toutes les actions UI plantent sans erreur visible.

Si la sécurité renforcée est requise plus tard, deux options :
1. Passer le preload en CommonJS (retirer les `import`, renommer ou adapter).
2. Conserver le sandbox désactivé mais ne rien exécuter de sensible dans le preload (c'est le cas aujourd'hui : juste de l'IPC).

### Défense en profondeur

- Le payload IPC est sanitisé dans `main.js` avant d'atteindre la couche stockage (`sanitizeString`, `sanitizeId`, `sanitizePayload`, `sanitizePatch`) — neutralise les objets exotiques envoyés depuis le renderer.
- Le renderer utilise **exclusivement `textContent`** (jamais `innerHTML`) pour afficher du contenu utilisateur — anti-XSS.
- Les icônes SVG sont injectées via `innerHTML` uniquement depuis des chaînes statiques contrôlées (`window.AppIcons.*`), jamais depuis une entrée utilisateur.

## Conventions

- **ESM** partout (`import`/`export`), y compris preload et tests.
- Pas de framework UI : manipulation DOM directe dans une IIFE.
- **Pas de factory** quand la closure n'évite pas de répétition côté appelant (cf. `lib/settings.js` = fonctions pures vs `lib/notes-storage.js` = factory justifiée).
- CSS **toujours** dans un fichier séparé : jamais de `<style>` inline, jamais de `style=` dans le HTML. Tokens CSS centralisés dans `vue/style/tokens.css`.
- Icônes : une seule source (`vue/script/icons.js`). On ajoute une icône uniquement quand un ticket la consomme.
- Tests qui touchent le disque : `fs.mkdtemp` + cleanup dans `afterEach`, jamais de chemin en dur.
- Ids DOM utilisés par les tests (`#notes-list`, `#detail-title`, `#onboarding`, `#settings-panel`, etc.) : préserver la stabilité, tout changement doit mettre à jour `tests/notes-ui.test.js`.

## Dette connue

- **Flake test frontmatter** : `tests/notes-storage.test.js` → `"le frontmatter contient les métadonnées attendues"` peut échouer ~1/1000 quand l'id aléatoire (hex 10 chars) ne contient que des chiffres. YAML quote alors la valeur et l'assertion `toContain(\`id: ${id}\`)` rate. Fix trivial : assouplir l'assertion en regex ou garantir une lettre `a-f` dans l'id.

## Licence

ISC (voir `package.json`).
