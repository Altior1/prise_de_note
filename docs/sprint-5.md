# Sprint 5 - Rendu Markdown + thème sombre (Electron)

Date de création : 2026-04-22
Owner : Product Owner

## 1. Objectif du sprint

Deux objectifs alignés et dimensionnés pour un incrément sûr :

1. **Rendre le Markdown** de la note courante en HTML (titres, listes, code, citations, liens, emphase) de façon sécurisée, avec un look proche d'Obsidian.
2. **Livrer un thème sombre** en plus du clair actuel, piloté par un override de `vue/style/tokens.css`, avec persistance du choix utilisateur.

Le Sprint 5 est un sprint **front + preload** : `main.js` ne bouge quasiment pas, sauf pour étendre `settings.json` (`theme`) via les fonctions existantes de `lib/settings.js`.

Valeurs attendues :
- L'utilisateur voit enfin ses notes rendues (listes cliquables, blocs de code coloriés, titres hiérarchisés).
- Le thème sombre valide l'infrastructure de tokens CSS posée au Sprint 3 — s'il marche avec un thème, il marchera avec N thèmes au Sprint 6.

## 2. Périmètre fonctionnel

Inclus :
- Parsing Markdown via `markdown-it` + sanitisation systématique via `DOMPurify` (les deux en renderer, le preload n'y touche pas — voir section 4).
- Mode **toggle Edit / Preview** (un seul panneau visible à la fois, bouton icône en coin haut droit du panneau éditeur).
- Rendu styé Obsidian-like dans une feuille dédiée `vue/style/markdown.css` : titres `#`/`##`/`###`, `code` inline et `<pre><code>` en bloc, `>` citation, `-`/`1.` listes, `**gras**`, `*italique*`, liens cliquables (`target="_blank"` + `rel="noopener noreferrer"`).
- Transitions douces (200 ms fade) entre edit et preview (CSS pur, pas de JS d'animation).
- Nouveau fichier `vue/style/themes/dark.css` qui redéfinit les tokens de `tokens.css` sous `:root[data-theme="dark"]`.
- Bouton toggle thème dans le panneau Paramètres (ou icône lune/soleil dans la barre d'actions sidebar, cf. décision section 8).
- Persistance du thème dans `settings.json` via un nouveau champ `theme: "light" | "dark"` (aucune migration nécessaire, `schemaVersion` reste à 1 : champ optionnel avec défaut `"light"` si absent).
- Tests jsdom : `renderMarkdown(source)` pure, toggle edit/preview, application de `data-theme`, persistance mockée.

Hors périmètre (explicitement reporté Sprint 6 ou plus) :
- Live preview split (éditeur + preview côte à côte synchronisés en temps réel) — trop coûteux à débuguer, peu utile tant que la préview-only marche.
- **Thèmes multiples interchangeables** (palette personnalisée, import de thèmes) — Sprint 6 validera la lecture d'un thème externe une fois l'infra sombre rodée.
- Syntax highlighting des blocs de code (`highlight.js`, `Prism`) — nice-to-have, ajoute une dépendance lourde, peut venir en Sprint 6.
- Tables Markdown étendues (GFM), footnotes, task lists cochables — markdown-it les supporte via plugins mais on reste sur le cœur CommonMark pour ce sprint.
- Images inline dans le rendu (problème de chemin relatif + sync cloud) — ticket dédié plus tard.
- Export HTML / PDF depuis le rendu Markdown — pas demandé.
- Raccourci clavier Ctrl+E pour toggle edit/preview : **P1, glissé en fin de sprint si temps**.

## 3. User stories priorisées

### US-1 (P0) Lire mes notes en Markdown rendu
En tant qu'utilisateur, je veux voir le Markdown de ma note courante rendu visuellement (titres, listes, code, citations, liens), afin de relire mes notes comme dans Obsidian.
- Given une note contient `# Titre\n- puce 1\n- puce 2\n**gras**`, when je bascule en preview, then je vois un `<h1>Titre</h1>`, une liste à puces, et le mot `gras` en gras.
- Given une note contient `<script>alert(1)</script>`, when je bascule en preview, then le `<script>` n'est pas exécuté (sanitisé par DOMPurify), et le texte brut n'apparaît pas non plus sous forme exécutable.
- Given un lien `[obsidian](https://obsidian.md)`, when je clique dessus dans la preview, then il s'ouvre dans le navigateur externe (et pas dans la fenêtre Electron).

### US-2 (P0) Basculer entre édition et preview facilement
En tant qu'utilisateur, je veux un bouton en coin du panneau pour alterner édition et preview de la note sélectionnée, afin de vérifier le rendu sans quitter le flux.
- Given je suis en mode édition, when je clique sur le bouton « Aperçu », then le `<textarea>` disparaît et un conteneur de preview apparaît à la place, avec le rendu HTML de la note.
- Given je suis en mode preview, when je clique sur le bouton « Éditer » (même bouton, icône alternée), then je reviens sur le `<textarea>` avec le curseur au début.
- Given je change de note, when la nouvelle note s'affiche, then je reviens par défaut en mode édition (le mode n'est **pas** mémorisé par note, seulement par session).

### US-3 (P0) Activer un thème sombre
En tant qu'utilisateur, je veux pouvoir activer un thème sombre depuis les paramètres, afin de travailler le soir sans me brûler les rétines.
- Given le thème est clair, when je clique sur « Thème sombre » dans le panneau Paramètres, then toute l'UI (sidebar, panneau éditeur, toasts, onboarding, preview Markdown) passe en palette sombre en moins de 300 ms.
- Given j'ai activé le thème sombre, when je redémarre l'application, then le thème sombre est toujours actif.
- Given j'active puis désactive le thème sombre, when j'inspecte le DOM, then l'attribut `data-theme="dark"` apparaît / disparaît sur `<html>`.

### US-4 (P1) Animation discrète lors du toggle
En tant qu'utilisateur, je veux que les transitions entre édit/preview et entre clair/sombre soient fluides et non brutales, afin d'éviter le flash visuel.
- Given je toggle edit → preview, when la transition joue, then j'observe un fade de 200 ms (opacity 0 → 1) sans déplacement brutal du layout.
- Given je toggle clair → sombre, when la transition joue, then les couleurs de fond et de texte transitent sur 200 ms via `transition: background-color 200ms ease, color 200ms ease` appliquée aux éléments clés.
- Contrainte : respecter `@media (prefers-reduced-motion: reduce)` — aucune transition si l'OS l'indique.

### US-5 (P2) Raccourci Ctrl+E toggle edit/preview
En tant qu'utilisateur power-user, je veux un raccourci clavier Ctrl+E (Cmd+E sur macOS) pour basculer edit/preview sans quitter le clavier.
- Given j'ai une note sélectionnée, when j'appuie sur Ctrl+E, then le mode bascule comme si j'avais cliqué sur le bouton.
- Given je suis dans la barre de recherche, when j'appuie sur Ctrl+E, then rien ne se passe (focus hors du panneau note → raccourci ignoré).

## 4. Choix techniques tranchés

### 4.1 Librairie Markdown : `markdown-it` (retenu), pas `marked`

**Décision : `markdown-it`**.

Arguments pour `markdown-it` :
- API de plugins mature : si plus tard on veut `markdown-it-task-lists`, `markdown-it-footnote`, `markdown-it-anchor` (ancres de titres pour un sommaire), l'écosystème existe déjà.
- **Sécurité par défaut plus stricte** : options `html: false` (on refuse le HTML brut inline dans le Markdown) et `linkify: true` (les URLs nues deviennent des liens), ce qui élimine une classe d'XSS en amont avant même DOMPurify.
- Conformité CommonMark + GFM de qualité.
- Taille ≈ 100 Ko minifiée ESM — acceptable pour une app desktop.

Arguments contre `marked` :
- API plus minimaliste mais l'extension via `marked.use()` est moins standardisée.
- Historique de CVE XSS sur les versions anciennes (corrigées) — avec `markdown-it` + `html: false` + DOMPurify, on a une défense en profondeur plus nette à documenter.
- Parsing de certains edge cases (listes imbriquées, code fences avec caractères exotiques) moins robuste que `markdown-it` sur les benchmarks CommonMark.

**Dépendance ajoutée** : `markdown-it` (runtime) + `dompurify` (runtime).

### 4.2 Sanitisation : `DOMPurify` côté renderer, pas preload

**Décision : sanitisation dans `vue/script/markdown.js`, jamais dans le preload ni le main**.

Raisonnement :
- Le HTML dangereux n'existe qu'au moment de l'insertion DOM. Le sanitiser dans le main ou preload obligerait à trimballer du HTML pré-purifié via IPC, ce qui **élargit** la surface d'attaque au lieu de la réduire (un bug de serialization IPC pourrait corrompre le HTML purifié).
- DOMPurify a besoin d'un DOM (jsdom en Node, `window` en navigateur) — il est **fait pour tourner côté renderer**.
- La règle d'or : on sanitise **au point d'insertion**, pas en amont.

**Règle non négociable** : aucune fonction dans `vue/script/notes-ui.js` ne doit faire `element.innerHTML = markdownRenderedString`. L'insertion passe exclusivement par `renderMarkdownInto(container, source)` qui fait `container.innerHTML = DOMPurify.sanitize(md.render(source))`. Le seul autre usage d'`innerHTML` autorisé reste celui des icônes SVG statiques (déjà documenté dans `README.md` section Sécurité).

**Config DOMPurify** :
- `ALLOWED_TAGS` : liste blanche explicite (`h1`-`h6`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `pre`, `blockquote`, `a`, `hr`, `br`, `span`).
- `ALLOWED_ATTR` : `href`, `class` (pour code blocks), `target`, `rel`.
- Hook `afterSanitizeAttributes` pour forcer `target="_blank"` et `rel="noopener noreferrer"` sur chaque `<a>` (évite le tabnabbing et la capture de la fenêtre Electron).

### 4.3 Mode d'affichage : toggle Edit/Preview, pas split

**Décision : toggle** (un seul panneau visible à la fois, bouton bascule).

Raisonnement :
- Le scope sprint est serré : un split-view implique de synchroniser scroll, sélection, debounce parsing sur chaque frappe, gérer les largeurs responsives — c'est un demi-sprint à lui seul.
- Obsidian propose les deux modes (Source, Reading, Live Preview) mais la vue **Reading** (= preview pleine largeur) est celle qu'il propose par défaut à l'ouverture d'une note — c'est la cible MVP.
- Chemin d'upgrade propre : si en Sprint 6 on veut du split, il suffira d'ajouter un 3e état `split` au state machine du mode d'affichage (edit / preview / split).

Implémentation :
- State local dans `notes-ui.js` : `viewMode: "edit" | "preview"`, défaut `"edit"`.
- Toggle implémenté en CSS via une classe sur `#note-detail` (`.mode-edit` ou `.mode-preview`), pas en masquant/affichant en JS : plus fluide pour la transition CSS.
- Le `<textarea>` reste monté en DOM même en preview (on garde la valeur en vie), juste masqué via CSS — évite de perdre l'undo stack du textarea.

### 4.4 Architecture du module Markdown

**Décision : fonction pure `renderMarkdown(source): string` + helper `renderMarkdownInto(container, source): void`, pas de factory**.

Fichier : `vue/script/markdown.js`, chargé **avant** `notes-ui.js` dans `accueil.html`.

```
export function renderMarkdown(source: string): string
  // source → MarkdownIt.render(source) → DOMPurify.sanitize(html) → string
  // Aucun side-effect, pure, testable en unitaire.

export function renderMarkdownInto(container: HTMLElement, source: string): void
  // container.innerHTML = renderMarkdown(source)
  // Helper d'ergonomie, évite de répéter l'insertion dans notes-ui.js.
```

Respecte la règle « Pas de factory gratuite » de la mémoire projet : pas d'état partagé, pas de closure autour d'une config — si plus tard on veut configurer les plugins, on passera la config en second argument.

### 4.5 Persistance du thème : `settings.json`, champ optionnel

**Décision : étendre `settings.json` avec `theme: "light" | "dark"`, défaut `"light"` si absent**.

- Pas de bump de `schemaVersion` : un champ optionnel avec valeur par défaut en lecture est rétro-compatible avec les installations Sprint 1-4.
- `lib/settings.js::writeSettings` gère déjà le merge patch (`...current, ...patch`), il faut juste :
  1. Ajouter `theme: null` dans `DEFAULTS` (ou accepter l'absence du champ et coercer en `"light"` à la lecture côté renderer).
  2. Étendre la validation de `writeSettings` : si `theme` est présent dans le patch, il doit être `"light"` ou `"dark"`.
- Nouveau canal IPC : `settings:setTheme { theme }` et `settings:getTheme` (ou étendre `settings:get` générique — on reste sur deux canaux dédiés pour cohérence avec `getNotesDir` / `setNotesDir`).
- Event optionnel `theme-changed` émis main → renderer **uniquement si** on veut supporter un futur bouton externe qui change le thème (pas nécessaire en Sprint 5, l'UI appelle directement `setTheme` et applique le `data-theme` de façon optimiste).

### 4.6 Emplacement du thème sombre : fichier dédié

**Décision : nouveau fichier `vue/style/themes/dark.css`**, importé après `tokens.css` dans `accueil.css`.

```css
/* dark.css */
:root[data-theme="dark"] {
  --color-bg: #1e1e20;
  --color-surface: #242428;
  --color-surface-hover: #2d2d32;
  --color-surface-selected: #3a3f4b;
  --color-border: #3a3a40;
  --color-text: #d4d4d8;
  --color-text-muted: #8a8a93;
  /* ...etc, override de TOUS les tokens de couleur */
}
```

- Aucun token **non-couleur** n'est redéfini (espacements, typo, rayons restent identiques) — principe : un thème = un jeu de couleurs, pas une refonte layout.
- Zéro modification des consommateurs (`sidebar.css`, `detail.css`, etc.) tant qu'ils consomment via `var(--color-*)`. Un audit rapide en J1 confirmera.

## 5. Backlog Sprint 5 (tickets ≤ 0.5 jour)

### J1 — Infrastructure Markdown (parse + sanitize)

- **S5-T01 (P0)** Ajouter `markdown-it` et `dompurify` comme dépendances npm
  - Couche : config/tooling
  - Acceptance : `package.json` contient les deux paquets dans `dependencies`, `package-lock.json` régénéré, `npm install` et `npm test` passent sans régression (67/67 tests verts).
  - Effort : 0.1 j

- **S5-T02 (P0)** Créer `vue/script/markdown.js` — fonction pure `renderMarkdown`
  - Couche : renderer
  - Acceptance :
    - Fichier exporte `renderMarkdown(source)` via `window.AppMarkdown.renderMarkdown` (cohérent avec `window.AppIcons`, pas de module ESM dans le renderer, `notes-ui.js` étant en classique).
    - `renderMarkdown("# Hello")` retourne une string contenant `<h1>Hello</h1>`.
    - `renderMarkdown("<script>alert(1)</script>")` retourne une string **sans** `<script>`.
    - `renderMarkdown` est instrumenté avec `markdown-it({ html: false, linkify: true, breaks: false })` puis `DOMPurify.sanitize(...)` avec liste blanche de tags.
    - Hook DOMPurify `afterSanitizeAttributes` ajoute `target="_blank"` et `rel="noopener noreferrer"` sur tous les `<a>`.
  - Effort : 0.4 j

- **S5-T03 (P0)** Tests unitaires `renderMarkdown`
  - Couche : tests
  - Acceptance :
    - Nouveau fichier `tests/markdown.test.js` ≥ 8 cas : titre, liste, code inline, code fence, citation, lien, XSS inline (`<script>`), XSS attribut (`<img onerror=...>`).
    - Assertion sur `target="_blank" rel="noopener noreferrer"` pour les liens.
    - Tous les 67 tests existants + nouveaux tests verts.
  - Effort : 0.3 j

### J2 — UI toggle Edit / Preview

- **S5-T04 (P0)** Ajouter bouton toggle Edit/Preview dans `#note-detail`
  - Couche : renderer (HTML + CSS)
  - Acceptance :
    - Nouveau bouton `#detail-toggle-view` dans `vue/accueil.html` en coin haut droit du panneau éditeur (à côté de `#detail-delete`).
    - Icône `eyeIcon` (mode edit, signifie « cliquer pour voir ») / `pencilIcon` (mode preview, signifie « cliquer pour éditer »). Icônes ajoutées à `vue/script/icons.js`.
    - `aria-label` dynamique : « Afficher l'aperçu » / « Revenir à l'édition ».
    - Ids préservés : `#detail-title`, `#detail-content`, `#detail-save`, `#detail-delete`, `#save-indicator`, `#note-detail`.
  - Effort : 0.2 j

- **S5-T05 (P0)** Ajouter conteneur preview `#detail-preview` dans `#note-detail`
  - Couche : renderer (HTML)
  - Acceptance :
    - Nouveau `<article id="detail-preview" class="detail-preview"></article>` monté dans `#note-detail`, vide par défaut.
    - Hidden via CSS tant que `#note-detail` n'a pas la classe `.mode-preview`.
    - Pas de `style=` inline, tout en CSS dans `vue/style/detail.css` ou nouvelle `vue/style/markdown.css`.
  - Effort : 0.1 j

- **S5-T06 (P0)** Logique toggle dans `notes-ui.js`
  - Couche : renderer
  - Acceptance :
    - Variable locale `viewMode` (`"edit" | "preview"`), init `"edit"`.
    - Clic sur `#detail-toggle-view` bascule `viewMode` + toggle les classes `.mode-edit`/`.mode-preview` sur `#note-detail`.
    - En entrant en mode preview : `renderMarkdownInto(detailPreview, detailContent.value)` est appelé.
    - Changer de note sélectionnée (selectNote) reset `viewMode` à `"edit"`.
    - L'icône du bouton change selon le mode (eye ↔ pencil) via `AppIcons.renderIcon`.
  - Effort : 0.3 j

- **S5-T07 (P0)** Styles Markdown Obsidian-like dans `vue/style/markdown.css`
  - Couche : renderer
  - Acceptance :
    - Fichier `vue/style/markdown.css` importé dans `accueil.css`.
    - Styles pour `h1/h2/h3` (hiérarchie visuelle claire, espacement supérieur, bordure basse sur `h1`/`h2`), `p`, `ul/ol/li` (indentation, bullets), `blockquote` (bordure gauche accent 3px), `code` inline (fond `--color-surface-hover`, radius-sm, police mono système), `pre > code` (bloc scrollable horizontalement, padding, fond identique), `a` (couleur accent, underline au hover), `hr`.
    - Toutes les couleurs via `var(--color-*)` — aucune valeur hex/px codée en dur pour les couleurs.
    - Pas de `<style>` inline ni `style=` HTML.
  - Effort : 0.4 j

- **S5-T08 (P0)** Transitions douces edit ↔ preview
  - Couche : renderer (CSS)
  - Acceptance :
    - `.mode-edit`, `.mode-preview` : `opacity` + `transition: opacity 200ms ease` sur `#detail-content` et `#detail-preview`.
    - `@media (prefers-reduced-motion: reduce) { transition: none; }` appliqué.
    - Pas de flash blanc / flash de layout shift (le conteneur parent garde sa hauteur).
  - Effort : 0.2 j

- **S5-T09 (P0)** Tests jsdom du toggle Edit/Preview
  - Couche : tests
  - Acceptance :
    - Nouveaux cas dans `tests/notes-ui.test.js` :
      - Clic sur `#detail-toggle-view` → `#note-detail` a la classe `.mode-preview` + `#detail-preview` contient du HTML rendu depuis `detail-content.value`.
      - Second clic → classe `.mode-edit` restaurée, `#detail-preview` peut rester peuplé (pas de reset obligatoire en edit).
      - Changer de note via sélection → classe reset à `.mode-edit`.
    - Les 67 tests existants restent verts + nouveaux tests.
  - Effort : 0.3 j

### J3 — Thème sombre

- **S5-T10 (P0)** Créer `vue/style/themes/dark.css` avec override complet des tokens
  - Couche : renderer
  - Acceptance :
    - Fichier créé, cible `:root[data-theme="dark"]`.
    - Override de TOUS les tokens `--color-*` définis dans `tokens.css` (bg, surface, surface-hover, surface-selected, border, border-strong, text, text-muted, text-inverse, accent, accent-hover, danger, danger-soft, warning, success).
    - Importé dans `accueil.css` **après** `tokens.css` (ordre critique pour la cascade).
    - Palette sombre inspirée Obsidian Dark : `#1e1e20` bg, `#242428` surface, `#5b82eb` accent conservé (bonne lisibilité sur sombre), `#d4d4d8` texte.
  - Effort : 0.3 j

- **S5-T11 (P0)** Étendre `lib/settings.js` avec champ `theme`
  - Couche : main/lib
  - Acceptance :
    - `DEFAULTS` inclut `theme: null` (interprété `"light"` côté renderer).
    - `writeSettings` valide : si `"theme" in patch`, `patch.theme` doit être `"light"`, `"dark"`, ou `null` (sinon `TypeError`).
    - `schemaVersion` reste à 1 (champ optionnel, rétro-compatible).
    - Tests existants `tests/settings.test.js` restent verts + 2 nouveaux cas : `writeSettings({ theme: "dark" })` persiste, `writeSettings({ theme: "neon" })` lève `TypeError`.
  - Effort : 0.3 j

- **S5-T12 (P0)** Canaux IPC `settings:getTheme` et `settings:setTheme`
  - Couche : main + preload
  - Acceptance :
    - `main.js` expose deux nouveaux handlers : `settings:getTheme` (retourne `"light"` si null ou absent, sinon la valeur) et `settings:setTheme` (appelle `writeSettings({ theme })`).
    - `preload.js` expose `window.settings.getTheme()` et `window.settings.setTheme(theme)`.
    - Pas de casse des canaux existants.
  - Effort : 0.2 j

- **S5-T13 (P0)** Bouton toggle thème dans le panneau Paramètres
  - Couche : renderer
  - Acceptance :
    - Nouveau bouton `#settings-theme-toggle` dans `#settings-panel` (sidebar, sous les boutons `Changer…` / `Ouvrir`).
    - Libellé dynamique : « Thème sombre » en mode clair / « Thème clair » en mode sombre.
    - Icône lune/soleil optionnelle si temps (P1 dans T13, sinon texte seul).
    - Clic → `window.settings.setTheme(next)` → applique `document.documentElement.setAttribute("data-theme", next)` → met à jour le libellé.
  - Effort : 0.2 j

- **S5-T14 (P0)** Chargement du thème au boot + transition globale
  - Couche : renderer
  - Acceptance :
    - Au boot de `notes-ui.js`, `window.settings.getTheme()` est appelé **avant** `showApp()` / `showOnboarding()` pour éviter un flash.
    - La valeur est appliquée via `document.documentElement.setAttribute("data-theme", theme)` (ou retrait de l'attribut si `"light"`).
    - `vue/style/accueil.css` ajoute `transition: background-color 200ms ease, color 200ms ease` sur `body, .sidebar, .editor-panel` (avec fallback `prefers-reduced-motion: reduce`).
    - Pas de FOUC (flash of unstyled content) : si on doit, appliquer le `data-theme` depuis un `<script>` inline minimal en `<head>` (exception documentée au principe « pas de `<style>` inline » car c'est un script, pas un style ; si refusé, accepter un flash de 50 ms au boot).
  - Effort : 0.3 j

- **S5-T15 (P0)** Tests jsdom thème + persistance
  - Couche : tests
  - Acceptance :
    - Nouveaux cas dans `tests/notes-ui.test.js` :
      - Boot avec `getTheme` retournant `"dark"` → `document.documentElement.dataset.theme === "dark"` après boot.
      - Clic sur `#settings-theme-toggle` en mode clair → `setTheme("dark")` est appelé + `data-theme="dark"` appliqué au DOM.
      - Clic à nouveau → `setTheme("light")` + `data-theme` retiré (ou passé à `"light"`).
    - Mocks existants `window.settings` étendus avec `getTheme` et `setTheme`.
  - Effort : 0.3 j

### J4 — Polish + recette + docs

- **S5-T16 (P1)** Raccourci Ctrl+E toggle edit/preview
  - Couche : renderer
  - Acceptance :
    - Dans `setupKeyboardShortcuts`, cas `key === "e"` : si une note est sélectionnée ET le focus n'est pas dans `#notes-search`, toggle le mode comme un clic sur `#detail-toggle-view`.
    - `preventDefault` pour éviter un éventuel raccourci natif.
    - 1 test jsdom.
  - Effort : 0.2 j

- **S5-T17 (P0)** Recette manuelle Sprint 5 + correctifs
  - Couche : transverse
  - Acceptance : checklist section 7 validée de bout en bout, tests Jest verts, aucun warning console.
  - Effort : 0.3 j

- **S5-T18 (P0)** Mise à jour `README.md` + index docs
  - Couche : docs
  - Acceptance :
    - README section « Fonctionnalités livrées » : ajouter bloc Rendu Markdown + Thème sombre.
    - README section « Stack technique » : ajouter `markdown-it`, `dompurify`.
    - README section « Sécurité » : documenter que `DOMPurify` est appelé côté renderer avant toute insertion DOM de HTML rendu.
    - Tableau des sprints (ligne Sprint 5) passé à « Livré » avec scope réel.
    - Pas de création de nouvelle doc `.md` d'index globale (le README fait office d'index actuellement — vérifié J1 de ce sprint, aucun fichier `docs/index.md` existant).
  - Effort : 0.2 j

- **S5-T19 (P1)** Kanban Sprint 5
  - Couche : docs
  - Acceptance : créer `docs/sprint-5-kanban.md` sur le même format que `sprint-3-kanban.md` (colonnes À faire / En cours / Fait).
  - Effort : 0.1 j

**Total effort estimé** : ~3.7 j (P0) + 0.3 j (P1) sur 4 jours de sprint — marge raisonnable pour absorber la recette.

## 6. Dépendances entre tickets

- T01 avant T02/T03 (lib nécessaire pour coder et tester).
- T02 avant T03/T06 (fonction nécessaire pour tester et consommer).
- T04 avant T05/T06 (bouton avant conteneur avant logique).
- T05 avant T06 (preview container nécessaire pour y rendre).
- T07 indépendant mais souhaitable avant T09 pour que la recette visuelle soit significative.
- T10/T11/T12 avant T13 (infrastructure thème avant UI toggle).
- T13 avant T14 (bouton avant boot-load).
- T14 avant T15 (boot avant test du boot).
- T16 après T06 (dépend du toggle edit/preview).
- T17/T18/T19 en fin : T01–T16 finis.

## 7. Checklist de validation manuelle (recette)

Environnement : Windows, `npm start` depuis le projet, un dossier de notes contenant au moins 3 notes existantes (dont une vide).

### Rendu Markdown
- [ ] Ouvrir une note, taper le contenu suivant dans l'éditeur :
  ```
  # Titre 1
  ## Titre 2

  Un paragraphe avec du **gras**, de l'*italique* et du `code inline`.

  - puce 1
  - puce 2
    - sous-puce

  1. ordre 1
  2. ordre 2

  > Une citation
  > sur deux lignes

  ```js
  const x = 42;
  ```

  [Obsidian](https://obsidian.md)
  ```
  → Attendre l'autosave (Enregistré HH:MM), puis cliquer sur le bouton Aperçu (icône œil).
- [ ] Vérifier : h1 plus gros que h2, liste à puces et numérotée correctes, citation avec bordure gauche, bloc de code monospaced avec fond, lien cliquable couleur accent.
- [ ] Cliquer sur le lien `[Obsidian]` dans la preview → le navigateur externe s'ouvre sur `obsidian.md` (ou rien ne se passe dans la fenêtre Electron : les deux comportements acceptables selon la config Electron, pas de navigation dans la fenêtre de l'app).
- [ ] Repasser en édition (bouton redevenu icône crayon) → le `<textarea>` contient toujours le texte tapé.

### XSS / sécurité
- [ ] Taper `<script>alert('XSS')</script>` dans une note → basculer en preview → **aucune alerte ne s'affiche**, le texte est soit retiré soit affiché en tant que texte brut.
- [ ] Taper `<img src=x onerror="alert('XSS')">` → basculer en preview → pas d'alerte.
- [ ] Taper `[evil](javascript:alert('XSS'))` → basculer en preview → le lien existe mais son `href` est nettoyé (soit pointe vers rien, soit le lien a disparu).
- [ ] Inspecter un `<a>` rendu dans la preview : il a `target="_blank"` et `rel="noopener noreferrer"`.

### Toggle Edit/Preview
- [ ] Bouton visible en coin haut droit du panneau éditeur.
- [ ] Clic bascule edit ↔ preview avec un fade de ~200 ms (observable à l'œil).
- [ ] Sélectionner une autre note → on revient en mode édition par défaut.
- [ ] Taper du Markdown, basculer en preview, rebasculer en édition → le texte tapé est toujours là, le curseur n'est pas perdu au milieu d'un texte aléatoire.

### Thème sombre
- [ ] Ouvrir le panneau Paramètres (sidebar bas) → le bouton « Thème sombre » est visible.
- [ ] Cliquer → toute l'UI passe en sombre en <300 ms : sidebar fond sombre, éditeur fond sombre, texte clair, accents bleus toujours lisibles.
- [ ] Vérifier la preview Markdown en mode sombre : citation, bloc de code, liens, listes toujours lisibles.
- [ ] Cliquer à nouveau (libellé « Thème clair ») → retour clair.
- [ ] Activer sombre, fermer l'app, relancer → l'app démarre en sombre (pas de flash clair visible > 200 ms).
- [ ] Ouvrir DevTools → `document.documentElement.dataset.theme === "dark"` pendant que le thème est actif.

### Non-régression
- [ ] Créer une nouvelle note via `+` → OK.
- [ ] Rechercher une note via le champ de recherche → filtre la liste.
- [ ] Supprimer une note → confirmation + retrait.
- [ ] Changer de dossier via « Changer… » → onboarding ou liste rechargée, thème préservé.
- [ ] `npm test` → tous les tests verts (69+ attendus).

## 8. Risques identifiés

### R1 — XSS via rendu Markdown (CRITIQUE)
- **Impact** : exécution de JS arbitraire dans le renderer Electron. Avec `sandbox: false` et ESM preload, un XSS permet potentiellement d'appeler `window.notes`, `window.settings` et de lire/écrire tous les fichiers du dossier de notes.
- **Mitigation** :
  - `markdown-it({ html: false })` → pas de HTML brut interprété dans le Markdown.
  - `DOMPurify` en sortie, liste blanche stricte de tags/attributs.
  - **Aucun** chemin d'insertion DOM ne contourne `renderMarkdown()` (ticket T02 trace la règle, T07 ne fait que du CSS, T03 teste les payloads XSS connus).
  - Recette manuelle T17 contient 3 payloads XSS à tester à la main.
- **Résiduel** : une CVE future sur `markdown-it` ou `DOMPurify` — mitigation par `npm audit` en fin de sprint et bump régulier.

### R2 — Perf sur gros fichiers Markdown
- **Impact** : une note de 10 000 lignes rend en > 500 ms sur chaque toggle preview → UX figée.
- **Mitigation** :
  - Le rendu n'est déclenché **que** sur toggle edit → preview, pas sur chaque frappe (différent d'un live preview qui aurait ce souci).
  - Si un bench interne montre un problème sur > 1 MB (peu probable dans la vraie vie pour des notes), on ajoutera un `requestIdleCallback` en Sprint 6.
  - Noter dans `docs/sprint-5.md` la limite connue (notes > 500 Ko = rendu > 200 ms sur machine moyenne).

### R3 — Compat Windows (path, line endings)
- **Impact** : CRLF Windows peut casser certains parsers Markdown laxistes.
- **Mitigation** : `markdown-it` normalise les line endings en interne. Les frontmatter parsés par `gray-matter` sont déjà OK sous Windows (Sprint 1/2 validé). À retester dans la recette.

### R4 — FOUC au boot sur thème sombre
- **Impact** : flash blanc de 100-300 ms entre le chargement HTML et l'application de `data-theme` par JS.
- **Mitigation** :
  - T14 recommande un `<script>` inline minimal en `<head>` pour appliquer le thème avant le premier paint. Justification sécurité : ce script ne touche pas à du contenu utilisateur, il lit seulement `localStorage`/IPC.
  - **Alternative si refusé** : accepter le flash, considéré comme non bloquant pour un MVP desktop mono-utilisateur. À ré-arbitrer si l'utilisateur le remonte comme gênant.

### R5 — Thème sombre oublie certains tokens
- **Impact** : un élément reste en couleur claire au milieu du sombre (contraste illisible).
- **Mitigation** :
  - T10 oblige à override **TOUS** les tokens `--color-*` de `tokens.css` (audit exhaustif).
  - Recette T17 : scanner visuellement sidebar, panneau, toasts, onboarding, panneau Paramètres, preview Markdown, states hover/selected.

### R6 — Régression sur les 69 tests Jest
- **Impact** : ajout de DOM + logique renderer → risque de casser les tests UI existants.
- **Mitigation** :
  - Ids stables (`#note-detail`, `#detail-content`, `#detail-title`, etc.) préservés par tous les tickets.
  - Chaque ticket qui touche au DOM liste les ids concernés.
  - `npm test` à la fin de chaque jour de sprint.

### R7 — Scope creep sur le thème
- **Impact** : tentation d'ajouter un 3e thème, un picker de couleur, des polices custom → sprint à tiroir.
- **Mitigation** : section 2 verrouille le périmètre à un seul thème sombre, thèmes multiples en Sprint 6 avec son propre backlog.

## 9. Definition of Done (Sprint 5)

- Tous les critères d'acceptance des tickets P0 vérifiés.
- Aucune régression sur les flux CRUD Sprint 1, dossier configurable Sprint 2, UI Sprint 3 (sidebar, `+`, onboarding, paramètres, delete, autosave, recherche).
- `contextIsolation=true`, `nodeIntegration=false`, `sandbox=false`, preload ESM inchangés.
- Aucun `<style>` inline ni `style=` HTML ajouté (exception documentée du `<script>` inline en `<head>` pour le boot du thème, si retenu en T14).
- Tous les rendus HTML issus de Markdown passent par `renderMarkdown()` → `DOMPurify.sanitize()`.
- Zéro `.innerHTML = markdownSource` brut dans le code renderer (hors icônes SVG statiques déjà en place).
- Tests Jest ESM verts (`--experimental-vm-modules`), compte ≥ 69 + nouveaux tests (estimation ~80 après S5).
- Vérification manuelle Sprint 5 complète (section 7), dont les 3 payloads XSS.
- README et backlog à jour.

## 10. Questions produit tranchées

- **Lib Markdown** : `markdown-it` (cf. 4.1).
- **Sanitisation** : `DOMPurify` côté renderer uniquement, à l'insertion (cf. 4.2).
- **Mode d'affichage** : toggle edit/preview, pas de split (cf. 4.3). Reporté Sprint 6 si demandé.
- **Persistance thème** : `settings.json` champ `theme` optionnel, pas de bump `schemaVersion` (cf. 4.5).
- **Position du toggle thème** : dans le panneau Paramètres (`#settings-panel` en bas de sidebar), pas dans la barre d'actions. Raison : un thème se change 1 fois par session, pas besoin d'y accéder en 1 clic depuis le chrome.
- **Mémorisation du mode edit/preview** : par session uniquement, reset à `edit` au changement de note. Raison : éviter de stocker du state par note, simplifie le reducer.
- **Syntax highlighting** : reporté Sprint 6. Raison : dépendance lourde (`highlight.js` ≈ 500 Ko), et les blocs de code Obsidian-like sans coloration restent lisibles grâce au contraste monospace + fond.
- **Animations** : 200 ms fade, respect `prefers-reduced-motion`. Raison : standard UI desktop, n'alourdit pas.

## 11. Hypothèses à valider en J1

- L'audit des tokens `--color-*` consommés dans `sidebar.css`, `detail.css`, `accueil.css` confirme qu'aucune valeur hex/rgb n'est codée en dur (sinon ticket additionnel de nettoyage avant T10).
- `DOMPurify` en version ≥ 3 est compatible ESM et fonctionne en renderer Electron avec `sandbox: false` (à vérifier en 5 min de POC).
- `markdown-it` peut être importé via un `<script>` classique UMD (pour cohérence avec `icons.js` et `notes-ui.js`) ou nécessite un wrapper — à trancher en T01.
